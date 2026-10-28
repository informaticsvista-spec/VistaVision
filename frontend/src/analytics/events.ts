// Builders that turn recognition results into analytics events with a consistent structure.
import type { Activity, InputSource, Origin, VistaEvent } from "../types";

export const EXPRESSIONS = ["Happy", "Neutral", "Surprise", "Sad", "Angry", "Fear", "Disgust", "Contempt", "Uncertain"] as const;
export const NO_FACES = "None";

export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export interface FaceObservation {
  trackId?: number;
  label: string; // expression or "Uncertain"
  confidence: number;
}

/**
 * One face snapshot -> one event per expression label.
 * All events of a snapshot share groupId + faceCount, so the number of faces *currently visible*
 * is never confused with the number of expression observations or tracked people.
 */
export function faceSnapshotEvents(args: {
  faces: FaceObservation[];
  source: InputSource;
  timestamp?: Date;
  groupId?: string;
}): VistaEvent[] {
  const groupId = args.groupId ?? uid();
  const timestamp = (args.timestamp ?? new Date()).toISOString();
  const trackedIds = args.faces.map((f) => f.trackId).filter((id): id is number => typeof id === "number");
  const base = { timestamp, activity: "face" as Activity, origin: "ai" as Origin, source: args.source, groupId, faceCount: args.faces.length, trackedIds };

  if (args.faces.length === 0) {
    return [{ ...base, id: uid(), dedupeKey: `${groupId}:${NO_FACES}`, label: NO_FACES, count: 0 }];
  }
  const byLabel = new Map<string, FaceObservation[]>();
  for (const face of args.faces) byLabel.set(face.label, [...(byLabel.get(face.label) ?? []), face]);
  return [...byLabel.entries()].map(([label, items]) => ({
    ...base,
    id: uid(),
    dedupeKey: `${groupId}:${label}`,
    label,
    count: items.length,
    confidence: items.reduce((sum, f) => sum + f.confidence, 0) / items.length,
  }));
}

export function digitEvent(args: { number: string; confidence: number; source: InputSource; requestId: string }): VistaEvent {
  return {
    id: uid(),
    dedupeKey: `digit:${args.requestId}`,
    timestamp: new Date().toISOString(),
    activity: "digit",
    origin: "ai",
    source: args.source,
    label: args.number,
    count: 1,
    confidence: args.confidence,
    groupId: args.requestId,
  };
}

export function objectEvents(args: { detections: { label: string; confidence: number }[]; source: InputSource; requestId: string }): VistaEvent[] {
  const timestamp = new Date().toISOString();
  return args.detections.map((d, index) => ({
    id: uid(),
    dedupeKey: `object:${args.requestId}:${index}`,
    timestamp,
    activity: "object" as Activity,
    origin: "ai" as Origin,
    source: args.source,
    label: d.label,
    count: 1,
    confidence: d.confidence,
    groupId: args.requestId,
  }));
}

export const ACTIVITY_LABEL: Record<Activity, string> = {
  face: "Expression",
  digit: "Digit",
  object: "Object",
  other: "Other (any category)",
};
export const SOURCE_LABEL: Record<InputSource, string> = {
  webcam: "Webcam",
  upload: "Image upload",
  "paper-camera": "Paper (camera)",
  "touch-canvas": "Touchscreen",
  manual: "Manual entry",
  sample: "Sample data",
};
export const ORIGIN_LABEL: Record<Origin, string> = { ai: "AI-generated", manual: "Manual", sample: "Sample" };
