import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import type { Feedback, VistaEvent } from "../types";
import { useSettings } from "../settings";
import { dedupe, initialState, reducer, type AnalyticsState } from "./reducer";
import { buildSampleEvents } from "./sample";
import { uid } from "./events";
import { customStore } from "../lib/customData";
import type { ValidRecord } from "./validate";
import { api } from "../services/api";
import { applyBatch, chunk, diffRecords, getClientId, looksLikeEvent, looksLikeFeedback, markSynced, type Synced } from "./serverSync";

export type ServerStatus = "off" | "loading" | "saving" | "saved" | "error" | "unavailable";
export interface ServerInfo { status: ServerStatus; savedAt: string | null; message?: string }

interface Ctx extends AnalyticsState {
  /** Record AI events. Returns how many were actually stored (0 when paused or duplicate). */
  record: (events: VistaEvent[]) => number;
  addManual: (record: ValidRecord, sourceNote?: string) => void;
  updateManual: (id: string, record: ValidRecord, sourceNote?: string) => void;
  remove: (id: string) => void;
  /** Save a human check of an AI prediction (feeds the "Human vs AI" scoreboard). */
  addFeedback: (feedback: Omit<Feedback, "id" | "timestamp" | "correct">) => void;
  loadSample: () => void;
  clear: () => void;
  reset: () => void;
  setPaused: (paused: boolean) => void;
  /** State of the server-side copy of the records (SQLite on the backend). */
  server: ServerInfo;
  /** Delete this browser's saved records from the server (the records on screen stay). */
  eraseServerCopy: () => Promise<boolean>;
}

const AnalyticsContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "vista.events.v1";

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Optional, opt-in persistence: only the structured records, never images.
  useEffect(() => {
    if (!settings.persistData) {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.events));
    } catch { /* storage full or blocked */ }
  }, [settings.persistData, state.events]);

  useEffect(() => {
    if (!settings.persistData) return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(saved) && saved.length) dispatch({ type: "hydrate", events: saved });
    } catch { /* ignore corrupt data */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Server database copy (structured records only, never images) ----
  const [server, setServer] = useState<ServerInfo>({ status: "off", savedAt: null });
  const synced = useRef<Synced>(new Map());
  const hydrated = useRef(false);
  const busy = useRef(false);
  const [loadRetry, setLoadRetry] = useState(0);
  const [syncRetry, setSyncRetry] = useState(0);

  useEffect(() => {
    if (!settings.serverSave) { hydrated.current = false; setServer({ status: "off", savedAt: null }); return; }
    let cancelled = false;
    setServer((s) => ({ ...s, status: "loading" }));
    api.storeLoad(getClientId())
      .then((data) => {
        if (cancelled) return;
        const events = (data.events ?? []).filter(looksLikeEvent);
        const feedback = (data.feedback ?? []).filter(looksLikeFeedback);
        markSynced(synced.current, events, feedback);
        dispatch({ type: "merge", events, feedback });
        hydrated.current = true;
        setServer({ status: "saved", savedAt: new Date().toISOString() });
      })
      .catch((e: { code?: string; message?: string }) => {
        if (cancelled) return;
        const unavailable = e?.code === "storage_unavailable";
        setServer({ status: unavailable ? "unavailable" : "error", savedAt: null, message: e?.message });
        if (!unavailable) setTimeout(() => !cancelled && setLoadRetry((n) => n + 1), 10000);
      });
    return () => { cancelled = true; };
  }, [settings.serverSave, loadRetry]);

  useEffect(() => {
    if (!settings.serverSave || !hydrated.current) return;
    const timer = setTimeout(async () => {
      if (busy.current) { setSyncRetry((n) => n + 1); return; }
      const batch = diffRecords(synced.current, stateRef.current.events, stateRef.current.feedback);
      if (!batch.upserts.length && !batch.deletes.length) return;
      busy.current = true;
      setServer((s) => ({ ...s, status: "saving" }));
      try {
        const id = getClientId();
        const parts = [...chunk(batch.upserts).map((u) => ({ upserts: u, deletes: [] })), ...chunk(batch.deletes).map((d) => ({ upserts: [], deletes: d }))];
        for (const part of parts) {
          await api.storeSync(id, part);
          applyBatch(synced.current, part as never);
        }
        setServer({ status: "saved", savedAt: new Date().toISOString() });
      } catch (e) {
        const err = e as { code?: string; message?: string };
        setServer((s) => ({ ...s, status: err.code === "storage_unavailable" ? "unavailable" : "error", message: err.message }));
        if (err.code !== "storage_unavailable") setTimeout(() => setSyncRetry((n) => n + 1), 8000);
      } finally {
        busy.current = false;
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [state.events, state.feedback, settings.serverSave, syncRetry, server.status === "loading"]);

  const eraseServerCopy = useCallback(async () => {
    try {
      await api.storeWipe(getClientId());
      synced.current.clear();
      return true;
    } catch {
      return false;
    }
  }, []);

  const record = useCallback((events: VistaEvent[]) => {
    const current = stateRef.current;
    const allowed = events.filter((e) => !(current.paused && e.origin === "ai"));
    const fresh = dedupe(current.events, allowed);
    if (fresh.length) dispatch({ type: "add", events: fresh });
    return fresh.length;
  }, []);

  const toEvent = (r: ValidRecord, sourceNote?: string): VistaEvent => {
    const id = uid();
    return {
      id, dedupeKey: `manual:${id}`, timestamp: r.timestamp, activity: r.activity, origin: "manual", source: "manual",
      label: r.label, count: r.count, faceCount: r.faceCount, sourceNote: sourceNote || undefined, groupId: undefined,
    };
  };

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      record,
      addManual: (r, note) => dispatch({ type: "add", events: [toEvent(r, note)] }),
      updateManual: (id, r, note) =>
        dispatch({ type: "update", id, patch: { label: r.label, count: r.count, timestamp: r.timestamp, activity: r.activity, faceCount: r.faceCount, sourceNote: note || undefined } }),
      remove: (id) => dispatch({ type: "remove", id }),
      addFeedback: (f) => dispatch({ type: "addFeedback", feedback: { ...f, id: uid(), timestamp: new Date().toISOString(), correct: f.predicted.trim().toLowerCase() === f.actual.trim().toLowerCase() } }),
      loadSample: () => dispatch({ type: "replaceSamples", events: buildSampleEvents() }),
      clear: () => dispatch({ type: "clear" }),
      reset: () => { customStore.clear(); dispatch({ type: "reset" }); void eraseServerCopy(); },
      setPaused: (paused) => dispatch({ type: "setPaused", paused }),
      server,
      eraseServerCopy,
    }),
    [state, record, server, eraseServerCopy],
  );
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(): Ctx {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error("useAnalytics must be used inside AnalyticsProvider");
  return ctx;
}
