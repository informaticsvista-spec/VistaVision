// Pure helpers for saving analytics records to the server database. No React here, so they are unit-testable.
import type { Feedback, VistaEvent } from "../types";

export type StoreKind = "event" | "feedback";
export interface Upsert { kind: StoreKind; id: string; dedupe_key?: string; payload: Record<string, unknown> }
export interface Removal { kind: StoreKind; id: string }
export interface SyncBatch { upserts: Upsert[]; deletes: Removal[] }

/** What the server is known to hold: "kind:id" -> JSON of the payload it was last sent. */
export type Synced = Map<string, string>;

const CLIENT_KEY = "vistavision.clientId";

/** Anonymous per-browser workspace id (random, no personal data). Falls back to a per-page id if storage is blocked. */
let memoryId: string | null = null;
export function getClientId(): string {
  try {
    const saved = localStorage.getItem(CLIENT_KEY);
    if (saved && /^[A-Za-z0-9_-]{16,64}$/.test(saved)) return saved;
    const fresh = newId();
    localStorage.setItem(CLIENT_KEY, fresh);
    return fresh;
  } catch {
    return (memoryId ??= newId());
  }
}

function newId(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const k = (kind: StoreKind, id: string) => `${kind}:${id}`;

/** Sample data is demo content, never saved. */
export const isStorable = (e: VistaEvent) => e.origin !== "sample";

/** Work out what changed since the last successful sync (new/edited records to upsert, vanished ones to delete). */
export function diffRecords(synced: Synced, events: VistaEvent[], feedback: Feedback[]): SyncBatch {
  const upserts: Upsert[] = [];
  const seen = new Set<string>();
  const consider = (kind: StoreKind, id: string, payload: object, dedupe_key?: string) => {
    const key = k(kind, id);
    seen.add(key);
    const json = JSON.stringify(payload);
    if (synced.get(key) !== json) upserts.push({ kind, id, dedupe_key, payload: payload as Record<string, unknown> });
  };
  for (const e of events) if (isStorable(e)) consider("event", e.id, e, e.dedupeKey);
  for (const f of feedback) consider("feedback", f.id, f);
  const deletes: Removal[] = [];
  for (const key of synced.keys()) {
    if (seen.has(key)) continue;
    const i = key.indexOf(":");
    deletes.push({ kind: key.slice(0, i) as StoreKind, id: key.slice(i + 1) });
  }
  return { upserts, deletes };
}

/** Record a successful batch in the synced map. */
export function applyBatch(synced: Synced, batch: SyncBatch): void {
  for (const u of batch.upserts) synced.set(k(u.kind, u.id), JSON.stringify(u.payload));
  for (const d of batch.deletes) synced.delete(k(d.kind, d.id));
}

/** Mark records that came from the server as already synced. */
export function markSynced(synced: Synced, events: VistaEvent[], feedback: Feedback[]): void {
  for (const e of events) synced.set(k("event", e.id), JSON.stringify(e));
  for (const f of feedback) synced.set(k("feedback", f.id), JSON.stringify(f));
}

/** Keep batches inside the server's per-request limit. */
export function chunk<T>(items: T[], size = 400): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Light shape check so a corrupt row can never crash the page. */
export const looksLikeEvent = (x: unknown): x is VistaEvent =>
  !!x && typeof x === "object" && typeof (x as VistaEvent).id === "string" && typeof (x as VistaEvent).dedupeKey === "string" &&
  typeof (x as VistaEvent).timestamp === "string" && typeof (x as VistaEvent).activity === "string";
export const looksLikeFeedback = (x: unknown): x is Feedback =>
  !!x && typeof x === "object" && typeof (x as Feedback).id === "string" && typeof (x as Feedback).actual === "string";
