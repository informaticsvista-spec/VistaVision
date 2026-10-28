// Shared types: the analytics event model and the backend API responses.

export type Activity = "face" | "digit" | "object" | "other";
/** Where the data came from. Kept on every record so charts can always separate real AI output from typed-in or sample data. */
export type Origin = "ai" | "manual" | "sample";
export type InputSource = "webcam" | "upload" | "paper-camera" | "touch-canvas" | "manual" | "sample";

export interface VistaEvent {
  id: string;
  /** Stable key for one logical observation. The store ignores a second event with the same key (re-renders, double callbacks). */
  dedupeKey: string;
  timestamp: string; // ISO 8601
  activity: Activity;
  origin: Origin;
  source: InputSource;
  /** Expression name, digit string ("43"), object name or free category. */
  label: string;
  /** How many observations this record stands for (manual records: the typed count; AI: faces with this expression, or 1). */
  count: number;
  confidence?: number; // 0..1, AI records only
  /** Records created by one analysis share a group id (e.g. all expressions seen in one face snapshot). */
  groupId?: string;
  /** Face snapshots: faces visible at that moment (NOT cumulative). */
  faceCount?: number;
  /** Face snapshots: temporary tracker ids visible at that moment. Not identities. */
  trackedIds?: number[];
  /** Manual records: free-text source type, e.g. "Classroom observation". */
  sourceNote?: string;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ExpressionResult {
  label: string;
  top_label: string | null;
  confidence: number;
  uncertain: boolean;
  probabilities: Record<string, number>;
}

export interface FaceResult {
  box: Box;
  detection_score: number;
  expression: ExpressionResult;
}

export interface FaceResponse {
  image: { width: number; height: number };
  face_count: number;
  faces: FaceResult[];
  elapsed_ms: number;
  disclaimer: string;
}

export interface DigitAlternative {
  digit: number;
  probability: number;
}

export interface DigitResult {
  digit: number;
  confidence: number;
  alternatives: DigitAlternative[];
  box: Box;
  tile_png: string;
}

export interface DigitResponse {
  number: string;
  digit_count: number;
  digits: DigitResult[];
  mean_confidence: number;
  min_confidence: number;
  low_confidence: boolean;
  image: { width: number; height: number };
  mask_png: string;
  elapsed_ms: number;
}

export interface ObjectDetection {
  label: string;
  class_id: number;
  confidence: number;
  box: Box;
}

export interface ObjectResponse {
  image: { width: number; height: number };
  detections: ObjectDetection[];
  count: number;
  elapsed_ms: number;
  note: string;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  version: string;
  models: Record<string, { installed: boolean; loaded: boolean; purpose: string }>;
  limits: { max_upload_mb: number };
}

export interface Settings {
  apiBase: string;
  faceIntervalMs: number;
  sampleSeconds: number;
  uncertainThreshold: number;
  mirrorFrontCamera: boolean;
  sound: boolean;
  reduceMotion: boolean;
  persistData: boolean;
  maxUploadMb: number;
}

/** A human check of one AI prediction ("Was the AI right?"). Stored in memory for the session only. */
export interface Feedback {
  id: string;
  timestamp: string;
  activity: Exclude<Activity, "other">;
  source: InputSource;
  predicted: string;
  actual: string;
  correct: boolean;
  confidence?: number;
}
