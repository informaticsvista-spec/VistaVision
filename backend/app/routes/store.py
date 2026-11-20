"""Save and restore the session's structured records (never images) in the server database."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Path
from pydantic import BaseModel, Field

from app.config import settings
from app.services.record_store import RecordStore

router = APIRouter(tags=["store"])

_store: RecordStore | None = None


def get_store() -> RecordStore:
    global _store
    if _store is None:
        _store = RecordStore(settings.db_path)
    return _store


ClientId = Path(pattern=r"^[A-Za-z0-9_-]{16,64}$", description="Anonymous workspace id created by the browser")
Kind = Literal["event", "feedback"]


class Upsert(BaseModel):
    kind: Kind
    id: str = Field(min_length=1, max_length=80)
    dedupe_key: str | None = Field(default=None, max_length=200)
    payload: dict


class Delete(BaseModel):
    kind: Kind
    id: str = Field(min_length=1, max_length=80)


class SyncRequest(BaseModel):
    upserts: list[Upsert] = Field(default_factory=list, max_length=500)
    deletes: list[Delete] = Field(default_factory=list, max_length=500)


@router.get("/store/{client}")
def load(client: str = ClientId, store: RecordStore = Depends(get_store)) -> dict:
    return store.load(client)


@router.post("/store/{client}/sync")
def sync(body: SyncRequest, client: str = ClientId, store: RecordStore = Depends(get_store)) -> dict:
    return store.sync(
        client,
        [{"kind": u.kind, "id": u.id, "dedupe_key": u.dedupe_key, "payload": u.payload} for u in body.upserts],
        [(d.kind, d.id) for d in body.deletes],
    )


@router.delete("/store/{client}")
def wipe(client: str = ClientId, store: RecordStore = Depends(get_store)) -> dict:
    return {"removed": store.wipe(client)}
