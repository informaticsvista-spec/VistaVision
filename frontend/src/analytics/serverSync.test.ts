import { describe, expect, it } from "vitest";
import { applyBatch, chunk, diffRecords, markSynced, looksLikeEvent, type Synced } from "./serverSync";
import { initialState, reducer } from "./reducer";
import type { Feedback, VistaEvent } from "../types";

const ev = (id: string, over: Partial<VistaEvent> = {}): VistaEvent =>
  ({ id, dedupeKey: `k:${id}`, timestamp: `2026-01-01T00:00:0${id.length}Z`, activity: "rps", origin: "ai", source: "camera", label: "rock", count: 1, ...over }) as VistaEvent;
const fb = (id: string): Feedback => ({ id, timestamp: "2026-01-01T00:00:00Z", activity: "digit", source: "upload", predicted: "3", actual: "3", correct: true });

describe("diffRecords", () => {
  it("uploads new records, skips sample data, and is quiet once synced", () => {
    const synced: Synced = new Map();
    const events = [ev("a"), ev("b", { origin: "sample" })];
    const batch = diffRecords(synced, events, [fb("f1")]);
    expect(batch.upserts.map((u) => `${u.kind}:${u.id}`).sort()).toEqual(["event:a", "feedback:f1"]);
    applyBatch(synced, batch);
    const again = diffRecords(synced, events, [fb("f1")]);
    expect(again.upserts).toHaveLength(0);
    expect(again.deletes).toHaveLength(0);
  });
  it("sends edits and deletions", () => {
    const synced: Synced = new Map();
    applyBatch(synced, diffRecords(synced, [ev("a"), ev("c")], []));
    const batch = diffRecords(synced, [ev("a", { label: "paper" })], []);
    expect(batch.upserts.map((u) => u.id)).toEqual(["a"]);
    expect(batch.deletes).toEqual([{ kind: "event", id: "c" }]);
  });
  it("does not delete or re-send what was just loaded from the server", () => {
    const synced: Synced = new Map();
    markSynced(synced, [ev("a")], [fb("f1")]);
    const batch = diffRecords(synced, [ev("a")], [fb("f1")]);
    expect(batch).toEqual({ upserts: [], deletes: [] });
  });
  it("chunks big batches", () => {
    expect(chunk(Array.from({ length: 950 }, (_, i) => i)).map((c) => c.length)).toEqual([400, 400, 150]);
  });
  it("rejects malformed rows", () => {
    expect(looksLikeEvent({ id: 1 })).toBe(false);
    expect(looksLikeEvent(ev("a"))).toBe(true);
  });
});

describe("reducer merge (records loaded from the server)", () => {
  it("adds missing records, never duplicates, keeps time order", () => {
    let s = reducer(initialState(), { type: "add", events: [ev("bb", { timestamp: "2026-01-02T00:00:00Z" })] });
    s = reducer(s, { type: "merge", events: [ev("bb", { timestamp: "2026-01-02T00:00:00Z" }), ev("a", { timestamp: "2026-01-01T00:00:00Z" })], feedback: [fb("f1")] });
    expect(s.events.map((e) => e.id)).toEqual(["a", "bb"]);
    expect(s.feedback).toHaveLength(1);
    const twice = reducer(s, { type: "merge", events: s.events, feedback: s.feedback });
    expect(twice).toBe(s);
  });
});
