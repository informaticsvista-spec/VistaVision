// Session state for analytics. Kept as a pure reducer so duplicate handling is unit-testable.
import type { Feedback, VistaEvent } from "../types";
import { uid } from "./events";

export interface AnalyticsState {
  events: VistaEvent[];
  feedback: Feedback[];
  paused: boolean;
  sessionId: string;
  sessionStart: string;
}

export type Action =
  | { type: "add"; events: VistaEvent[] }
  | { type: "update"; id: string; patch: Partial<Pick<VistaEvent, "label" | "count" | "timestamp" | "activity" | "faceCount" | "sourceNote">> }
  | { type: "remove"; id: string }
  | { type: "replaceSamples"; events: VistaEvent[] }
  | { type: "clear" }
  | { type: "reset" }
  | { type: "addFeedback"; feedback: Feedback }
  | { type: "setPaused"; paused: boolean }
  | { type: "hydrate"; events: VistaEvent[] };

export const initialState = (): AnalyticsState => ({ events: [], feedback: [], paused: false, sessionId: uid(), sessionStart: new Date().toISOString() });

/** Drop events whose id or dedupeKey is already present (or repeated inside the batch). */
export function dedupe(existing: VistaEvent[], incoming: VistaEvent[]): VistaEvent[] {
  const ids = new Set(existing.map((e) => e.id));
  const keys = new Set(existing.map((e) => e.dedupeKey));
  const fresh: VistaEvent[] = [];
  for (const e of incoming) {
    if (ids.has(e.id) || keys.has(e.dedupeKey)) continue;
    ids.add(e.id);
    keys.add(e.dedupeKey);
    fresh.push(e);
  }
  return fresh;
}

export function reducer(state: AnalyticsState, action: Action): AnalyticsState {
  switch (action.type) {
    case "add": {
      // AI results arriving while analytics are paused are ignored; manual records always go through.
      const allowed = action.events.filter((e) => !(state.paused && e.origin === "ai"));
      const fresh = dedupe(state.events, allowed);
      return fresh.length ? { ...state, events: [...state.events, ...fresh] } : state;
    }
    case "update":
      return {
        ...state,
        events: state.events.map((e) => (e.id === action.id && e.origin !== "ai" ? { ...e, ...action.patch } : e)),
      };
    case "remove":
      return { ...state, events: state.events.filter((e) => e.id !== action.id) };
    case "replaceSamples":
      return { ...state, events: [...state.events.filter((e) => e.origin !== "sample"), ...action.events] };
    case "clear":
      return { ...state, events: [], feedback: [] };
    case "addFeedback":
      return state.feedback.some((f) => f.id === action.feedback.id) ? state : { ...state, feedback: [...state.feedback, action.feedback] };
    case "reset":
      return initialState();
    case "setPaused":
      return { ...state, paused: action.paused };
    case "hydrate":
      return { ...state, events: dedupe([], action.events) };
  }
}
