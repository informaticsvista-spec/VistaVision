"""SQLite store for the structured analytics records (labels, counts, game rounds), never images.

Records belong to an anonymous "workspace" id that the browser creates and keeps (a random UUID). Whoever knows the id
can read and change that workspace, so treat it like a private link: there are no names, e-mail addresses or logins.
"""
from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator, Literal

from app.errors import ApiError

Kind = Literal["event", "feedback"]
MAX_ITEMS_PER_CLIENT = 20_000
MAX_PAYLOAD_BYTES = 8_000

_SCHEMA = """
CREATE TABLE IF NOT EXISTS clients (
    client TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    last_seen TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
    client TEXT NOT NULL,
    kind TEXT NOT NULL,
    id TEXT NOT NULL,
    dedupe_key TEXT,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (client, kind, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS items_dedupe ON items (client, kind, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS items_by_client ON items (client, kind);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class RecordStore:
    def __init__(self, path: Path | str):
        self.path = Path(path)
        self._lock = threading.Lock()  # SQLite allows one writer at a time; this keeps requests tidy
        self.ready = False
        self.error: str | None = None
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self._connect() as conn:
                conn.executescript(_SCHEMA)
            self.ready = True
        except (OSError, sqlite3.Error) as exc:  # read-only disk, bad path...: the rest of the API keeps working
            self.error = f"{type(exc).__name__}: {exc}"

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path, timeout=10)
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            yield conn
            conn.commit()
        except BaseException:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _require(self) -> None:
        if not self.ready:
            raise ApiError(503, "storage_unavailable", "The record database is not available on this server right now.")

    def sync(self, client: str, upserts: list[dict], deletes: list[tuple[str, str]]) -> dict:
        """Apply a batch: insert-or-replace each upsert (a repeated id just updates it) and delete the listed ids."""
        self._require()
        stored = ignored = removed = 0
        now = _now()
        with self._lock, self._connect() as conn:
            conn.execute(
                "INSERT INTO clients (client, created_at, last_seen) VALUES (?, ?, ?) "
                "ON CONFLICT(client) DO UPDATE SET last_seen = excluded.last_seen",
                (client, now, now),
            )
            for item in upserts:
                payload = json.dumps(item["payload"], separators=(",", ":"), ensure_ascii=False)
                if len(payload.encode()) > MAX_PAYLOAD_BYTES:
                    raise ApiError(422, "record_too_large", "One record is too large to store.")
                try:
                    conn.execute("SAVEPOINT one")
                    conn.execute(
                        "INSERT INTO items (client, kind, id, dedupe_key, payload, updated_at) VALUES (?, ?, ?, ?, ?, ?) "
                        "ON CONFLICT(client, kind, id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
                        (client, item["kind"], item["id"], item.get("dedupe_key"), payload, now),
                    )
                    conn.execute("RELEASE one")
                    stored += 1
                except sqlite3.IntegrityError:
                    # Same dedupe key under a different id: this round/record is already stored once. Keep exactly one.
                    conn.execute("ROLLBACK TO one")
                    conn.execute("RELEASE one")
                    ignored += 1
            for kind, item_id in deletes:
                removed += conn.execute("DELETE FROM items WHERE client = ? AND kind = ? AND id = ?", (client, kind, item_id)).rowcount
            total = conn.execute("SELECT COUNT(*) FROM items WHERE client = ?", (client,)).fetchone()[0]
            if total > MAX_ITEMS_PER_CLIENT:
                raise ApiError(413, "storage_full", f"This workspace already holds the maximum of {MAX_ITEMS_PER_CLIENT} records.")
        return {"stored": stored, "ignored": ignored, "removed": removed, "total": total}

    def load(self, client: str) -> dict:
        self._require()
        with self._connect() as conn:
            rows = conn.execute("SELECT kind, payload FROM items WHERE client = ? ORDER BY updated_at, rowid", (client,)).fetchall()
            conn.execute("UPDATE clients SET last_seen = ? WHERE client = ?", (_now(), client))
        out: dict[str, list] = {"events": [], "feedback": []}
        for kind, payload in rows:
            out["events" if kind == "event" else "feedback"].append(json.loads(payload))
        return out

    def wipe(self, client: str) -> int:
        self._require()
        with self._lock, self._connect() as conn:
            n = conn.execute("DELETE FROM items WHERE client = ?", (client,)).rowcount
            conn.execute("DELETE FROM clients WHERE client = ?", (client,))
        return n

    def prune(self, days: int = 90) -> int:
        """Delete workspaces nobody has opened for `days` days (keeps the database small)."""
        if not self.ready:
            return 0
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(timespec="seconds")
        with self._lock, self._connect() as conn:
            old = [r[0] for r in conn.execute("SELECT client FROM clients WHERE last_seen < ?", (cutoff,))]
            for c in old:
                conn.execute("DELETE FROM items WHERE client = ?", (c,))
                conn.execute("DELETE FROM clients WHERE client = ?", (c,))
        return len(old)

    def status(self) -> dict:
        if not self.ready:
            return {"enabled": False, "kind": "sqlite", "error": self.error}
        with self._connect() as conn:
            workspaces = conn.execute("SELECT COUNT(*) FROM clients").fetchone()[0]
            records = conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]
        return {"enabled": True, "kind": "sqlite", "workspaces": workspaces, "records": records}
