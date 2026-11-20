import importlib

import pytest
from fastapi.testclient import TestClient

CID = "abcdefghijklmnop1234"


@pytest.fixture()
def db_client(tmp_path, monkeypatch):
    from app.routes import store as store_routes
    from app.services.record_store import RecordStore

    monkeypatch.setattr(store_routes, "_store", RecordStore(tmp_path / "t.db"))
    from app.main import app

    yield TestClient(app)


def ev(i, key=None):
    return {"kind": "event", "id": f"e{i}", "dedupe_key": key, "payload": {"id": f"e{i}", "activity": "rps", "n": i}}


def test_sync_load_roundtrip(db_client):
    r = db_client.post(f"/api/store/{CID}/sync", json={"upserts": [ev(1), ev(2), {"kind": "feedback", "id": "f1", "payload": {"id": "f1"}}]})
    assert r.status_code == 200 and r.json()["stored"] == 3
    d = db_client.get(f"/api/store/{CID}").json()
    assert [e["id"] for e in d["events"]] == ["e1", "e2"] and d["feedback"][0]["id"] == "f1"


def test_sync_is_idempotent_and_upserts(db_client):
    db_client.post(f"/api/store/{CID}/sync", json={"upserts": [ev(1)]})
    changed = ev(1); changed["payload"]["n"] = 99
    db_client.post(f"/api/store/{CID}/sync", json={"upserts": [changed, changed]})
    d = db_client.get(f"/api/store/{CID}").json()
    assert len(d["events"]) == 1 and d["events"][0]["n"] == 99


def test_dedupe_key_keeps_one(db_client):
    r = db_client.post(f"/api/store/{CID}/sync", json={"upserts": [ev(1, "rps:g:1"), ev(2, "rps:g:1")]})
    assert r.json()["stored"] == 1 and r.json()["ignored"] == 1
    assert len(db_client.get(f"/api/store/{CID}").json()["events"]) == 1


def test_delete_and_wipe_and_isolation(db_client):
    other = "zzzzzzzzzzzzzzzz9999"
    db_client.post(f"/api/store/{CID}/sync", json={"upserts": [ev(1), ev(2)]})
    db_client.post(f"/api/store/{other}/sync", json={"upserts": [ev(3)]})
    db_client.post(f"/api/store/{CID}/sync", json={"deletes": [{"kind": "event", "id": "e1"}]})
    assert [e["id"] for e in db_client.get(f"/api/store/{CID}").json()["events"]] == ["e2"]
    assert db_client.delete(f"/api/store/{CID}").json()["removed"] == 1
    assert db_client.get(f"/api/store/{CID}").json()["events"] == []
    assert len(db_client.get(f"/api/store/{other}").json()["events"]) == 1


def test_validation(db_client):
    assert db_client.get("/api/store/short").status_code == 422
    assert db_client.post(f"/api/store/{CID}/sync", json={"upserts": [{"kind": "bogus", "id": "x", "payload": {}}]}).status_code == 422
    big = {"kind": "event", "id": "b", "payload": {"x": "y" * 9000}}
    assert db_client.post(f"/api/store/{CID}/sync", json={"upserts": [big]}).status_code == 422


def test_persists_across_reopen(tmp_path):
    from app.services.record_store import RecordStore

    a = RecordStore(tmp_path / "p.db"); a.sync(CID, [{"kind": "event", "id": "e1", "payload": {"id": "e1"}}], [])
    b = RecordStore(tmp_path / "p.db")
    assert b.load(CID)["events"][0]["id"] == "e1"


def test_unavailable_storage_is_503_and_health_still_ok(tmp_path, monkeypatch):
    from app.routes import store as store_routes
    from app.services.record_store import RecordStore

    blocker = tmp_path / "file"; blocker.write_text("x")
    monkeypatch.setattr(store_routes, "_store", RecordStore(blocker / "sub" / "x.db"))
    from app.main import app

    c = TestClient(app)
    assert c.get(f"/api/store/{CID}").status_code == 503
    assert c.get("/api/health").json()["storage"]["enabled"] is False


def test_prune_old_workspaces(tmp_path):
    from app.services.record_store import RecordStore

    s = RecordStore(tmp_path / "q.db"); s.sync(CID, [{"kind": "event", "id": "e1", "payload": {}}], [])
    import sqlite3
    c = sqlite3.connect(tmp_path / "q.db"); c.execute("UPDATE clients SET last_seen='2000-01-01T00:00:00+00:00'"); c.commit(); c.close()
    assert s.prune(90) == 1 and s.load(CID)["events"] == []
