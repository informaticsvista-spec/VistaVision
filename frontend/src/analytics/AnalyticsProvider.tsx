import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import type { Feedback, VistaEvent } from "../types";
import { useSettings } from "../settings";
import { dedupe, initialState, reducer, type AnalyticsState } from "./reducer";
import { buildSampleEvents } from "./sample";
import { uid } from "./events";
import { customStore } from "../lib/customData";
import type { ValidRecord } from "./validate";

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
      reset: () => { customStore.clear(); dispatch({ type: "reset" }); },
      setPaused: (paused) => dispatch({ type: "setPaused", paused }),
    }),
    [state, record],
  );
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(): Ctx {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error("useAnalytics must be used inside AnalyticsProvider");
  return ctx;
}
