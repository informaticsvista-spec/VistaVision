// Pure aggregation over VistaEvent[]. Every chart, KPI and report is computed from these functions,
// so what you see always matches the underlying dataset.
import type { Activity, InputSource, Origin, VistaEvent } from "../types";
import { EXPRESSIONS, NO_FACES } from "./events";

export interface Filters {
  from?: string; // yyyy-mm-dd (local)
  to?: string;
  origin?: Origin | "all";
  source?: InputSource | "all";
  activity?: Activity | "all";
  category?: string; // exact label, "" or undefined = all
}

const startOfDay = (value: string) => new Date(`${value}T00:00:00`).getTime();
const endOfDay = (value: string) => new Date(`${value}T23:59:59.999`).getTime();
const time = (e: VistaEvent) => new Date(e.timestamp).getTime();

export function filterEvents(events: VistaEvent[], f: Filters): VistaEvent[] {
  const from = f.from ? startOfDay(f.from) : -Infinity;
  const to = f.to ? endOfDay(f.to) : Infinity;
  return events.filter((e) => {
    const t = time(e);
    if (t < from || t > to) return false;
    if (f.origin && f.origin !== "all" && e.origin !== f.origin) return false;
    if (f.source && f.source !== "all" && e.source !== f.source) return false;
    if (f.activity && f.activity !== "all" && e.activity !== f.activity) return false;
    if (f.category && e.label !== f.category) return false;
    return true;
  });
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const faceObservations = (events: VistaEvent[]) => events.filter((e) => e.activity === "face" && e.label !== NO_FACES);

/** One entry per face snapshot (events sharing a groupId count once). */
export function faceSnapshots(events: VistaEvent[]): { key: string; t: number; faceCount: number; trackedIds: number[]; origin: Origin }[] {
  const snapshots = new Map<string, { key: string; t: number; faceCount: number; trackedIds: number[]; origin: Origin }>();
  for (const e of events) {
    if (e.activity !== "face") continue;
    const key = e.groupId ?? e.id;
    const faceCount = e.faceCount ?? (e.label === NO_FACES ? 0 : e.count);
    const existing = snapshots.get(key);
    if (!existing) snapshots.set(key, { key, t: time(e), faceCount, trackedIds: e.trackedIds ?? [], origin: e.origin });
    else if (e.faceCount === undefined) existing.faceCount = Math.max(existing.faceCount, faceCount);
  }
  return [...snapshots.values()].sort((a, b) => a.t - b.t);
}

export interface Kpis {
  totalRecords: number;
  currentFaces: number | null;
  trackedFaces: number;
  expressionObservations: number;
  digitAttempts: number;
  objectDetections: number;
  latest: VistaEvent | null;
  byOrigin: Record<Origin, number>;
}

export function computeKpis(events: VistaEvent[]): Kpis {
  const records = new Set(events.map((e) => e.groupId ?? e.id));
  const snapshots = faceSnapshots(events);
  const tracked = new Set<number>();
  for (const s of snapshots) if (s.origin === "ai") s.trackedIds.forEach((id) => tracked.add(id));
  const sorted = [...events].sort((a, b) => time(b) - time(a));
  const byOrigin: Record<Origin, number> = { ai: 0, manual: 0, sample: 0 };
  const seen = new Set<string>();
  for (const e of events) {
    const key = e.groupId ?? e.id;
    if (!seen.has(key)) {
      seen.add(key);
      byOrigin[e.origin] += 1;
    }
  }
  return {
    totalRecords: records.size,
    currentFaces: snapshots.length ? snapshots[snapshots.length - 1].faceCount : null,
    trackedFaces: tracked.size,
    expressionObservations: sum(faceObservations(events).map((e) => e.count)),
    digitAttempts: sum(events.filter((e) => e.activity === "digit").map((e) => e.count)),
    objectDetections: sum(events.filter((e) => e.activity === "object").map((e) => e.count)),
    latest: sorted[0] ?? null,
    byOrigin,
  };
}

export interface CountRow {
  name: string;
  count: number;
  percent: number;
}

function toRows(map: Map<string, number>, order?: readonly string[]): CountRow[] {
  const total = sum([...map.values()]);
  const rows = [...map.entries()].map(([name, count]) => ({ name, count, percent: total ? (count / total) * 100 : 0 }));
  if (order) {
    const rank = (n: string) => (order.includes(n) ? order.indexOf(n) : order.length);
    return rows.sort((a, b) => rank(a.name) - rank(b.name) || b.count - a.count);
  }
  return rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Expression observations per label. Percentages are shares of observations, not of people. */
export function expressionCounts(events: VistaEvent[]): CountRow[] {
  const map = new Map<string, number>();
  for (const e of faceObservations(events)) if (e.count > 0) map.set(e.label, (map.get(e.label) ?? 0) + e.count);
  return toRows(map, EXPRESSIONS);
}

export function objectFrequency(events: VistaEvent[]): CountRow[] {
  const map = new Map<string, number>();
  for (const e of events) if (e.activity === "object" && e.count > 0) map.set(e.label, (map.get(e.label) ?? 0) + e.count);
  return toRows(map);
}

/** Counts of free categories typed in by hand ("Other" activity). */
export function otherFrequency(events: VistaEvent[]): CountRow[] {
  const map = new Map<string, number>();
  for (const e of events) if (e.activity === "other" && e.count > 0) map.set(e.label, (map.get(e.label) ?? 0) + e.count);
  return toRows(map);
}

/** Predicted digit frequency 0-9; multi-digit numbers contribute each of their digits. */
export function digitFrequency(events: VistaEvent[]): { digit: string; count: number }[] {
  const counts = Array.from({ length: 10 }, () => 0);
  for (const e of events) {
    if (e.activity !== "digit") continue;
    for (const ch of e.label) if (ch >= "0" && ch <= "9") counts[Number(ch)] += e.count;
  }
  return counts.map((count, i) => ({ digit: String(i), count }));
}

export function faceCountSeries(events: VistaEvent[]): { t: number; faceCount: number; origin: Origin }[] {
  return faceSnapshots(events).map((s) => ({ t: s.t, faceCount: s.faceCount, origin: s.origin }));
}

const BUCKETS = [5, 15, 30, 60, 300, 900, 3600].map((s) => s * 1000);
export function pickBucket(events: VistaEvent[], target = 24): number {
  if (events.length < 2) return BUCKETS[0];
  const times = events.map(time);
  const span = Math.max(...times) - Math.min(...times);
  return BUCKETS.find((b) => span / b <= target) ?? BUCKETS[BUCKETS.length - 1];
}

export interface TimeBucketRow {
  t: number;
  [expression: string]: number;
}

export function expressionSeries(events: VistaEvent[]): { rows: TimeBucketRow[]; labels: string[]; bucketMs: number } {
  const obs = faceObservations(events).filter((e) => e.count > 0);
  if (!obs.length) return { rows: [], labels: [], bucketMs: BUCKETS[0] };
  const bucketMs = pickBucket(obs);
  const labels = EXPRESSIONS.filter((l) => obs.some((e) => e.label === l));
  const rows = new Map<number, TimeBucketRow>();
  for (const e of obs) {
    const t = Math.floor(time(e) / bucketMs) * bucketMs;
    const row = rows.get(t) ?? ({ t } as TimeBucketRow);
    row[e.label] = (row[e.label] ?? 0) + e.count;
    rows.set(t, row);
  }
  const sorted = [...rows.values()].sort((a, b) => a.t - b.t).map((row) => {
    for (const l of labels) row[l] = row[l] ?? 0;
    return row;
  });
  return { rows: sorted, labels: [...labels], bucketMs };
}

export interface Heatmap {
  columns: number[];
  rows: { label: string; values: number[] }[];
  max: number;
  bucketMs: number;
}

/** Returns null until there are at least 2 time buckets and 6 observations. */
export function expressionHeatmap(events: VistaEvent[]): Heatmap | null {
  const { rows, labels, bucketMs } = expressionSeries(events);
  const total = sum(rows.flatMap((r) => labels.map((l) => r[l])));
  if (rows.length < 2 || total < 6) return null;
  const grid = labels.map((label) => ({ label, values: rows.map((r) => r[label]) }));
  return { columns: rows.map((r) => r.t), rows: grid, max: Math.max(1, ...grid.flatMap((g) => g.values)), bucketMs };
}

export function confidenceHistogram(events: VistaEvent[]): { bin: string; count: number }[] | null {
  const values = events.filter((e) => e.confidence !== undefined && e.origin === "ai").map((e) => e.confidence as number);
  if (values.length < 5) return null;
  const bins = Array.from({ length: 10 }, (_, i) => ({ bin: `${i * 10}-${i * 10 + 10}%`, count: 0 }));
  for (const v of values) bins[Math.min(9, Math.floor(v * 10))].count += 1;
  return bins;
}

export interface OriginRow {
  activity: string;
  ai: number;
  manual: number;
  sample: number;
}

export function originComparison(events: VistaEvent[]): OriginRow[] {
  const names: Record<Activity, string> = { face: "Expressions", digit: "Digits", object: "Objects", other: "Other" };
  const out: OriginRow[] = [];
  for (const activity of ["face", "digit", "object", "other"] as Activity[]) {
    const subset = events.filter((e) => e.activity === activity && e.label !== NO_FACES);
    if (!subset.length) continue;
    const row: OriginRow = { activity: names[activity], ai: 0, manual: 0, sample: 0 };
    for (const e of subset) row[e.origin] += e.count;
    out.push(row);
  }
  return out;
}

export interface HistoryRow {
  id: string;
  timestamp: string;
  source: InputSource;
  origin: Origin;
  activity: Activity;
  prediction: string;
  count: number;
  confidence?: number;
}

export function historyRows(events: VistaEvent[]): HistoryRow[] {
  return [...events]
    .sort((a, b) => time(b) - time(a))
    .map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      source: e.source,
      origin: e.origin,
      activity: e.activity,
      prediction: e.label,
      count: e.count,
      confidence: e.confidence,
    }));
}

export interface Summary {
  records: number;
  byOrigin: Record<Origin, number>;
  firstAt: string | null;
  lastAt: string | null;
  averageConfidence: number | null;
  averageFacesPerSnapshot: number | null;
  maxFacesAtOnce: number;
  faceSnapshots: number;
  trackedFaces: number;
  topExpression: CountRow | null;
  topObject: CountRow | null;
  topDigit: { digit: string; count: number } | null;
  digitAttempts: number;
  expressionObservations: number;
  objectDetections: number;
}

export function summarize(events: VistaEvent[]): Summary {
  const kpis = computeKpis(events);
  const conf = events.filter((e) => e.origin === "ai" && e.confidence !== undefined).map((e) => e.confidence as number);
  const snaps = faceSnapshots(events);
  const sorted = [...events].sort((a, b) => time(a) - time(b));
  const digits = digitFrequency(events).filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
  return {
    records: kpis.totalRecords,
    byOrigin: kpis.byOrigin,
    firstAt: sorted[0]?.timestamp ?? null,
    lastAt: sorted[sorted.length - 1]?.timestamp ?? null,
    averageConfidence: conf.length ? sum(conf) / conf.length : null,
    averageFacesPerSnapshot: snaps.length ? sum(snaps.map((s) => s.faceCount)) / snaps.length : null,
    maxFacesAtOnce: snaps.reduce((m, s) => Math.max(m, s.faceCount), 0),
    faceSnapshots: snaps.length,
    trackedFaces: kpis.trackedFaces,
    topExpression: expressionCounts(events)[0] ?? null,
    topObject: objectFrequency(events)[0] ?? null,
    topDigit: digits[0] ?? null,
    digitAttempts: kpis.digitAttempts,
    expressionObservations: kpis.expressionObservations,
    objectDetections: kpis.objectDetections,
  };
}

export function categoriesOf(events: VistaEvent[]): string[] {
  return [...new Set(events.filter((e) => e.label !== NO_FACES).map((e) => e.label))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

// ---- Human vs AI scoreboard -------------------------------------------------------------------

export interface AccuracyRow { activity: "face" | "digit" | "object"; name: string; checked: number; correct: number; percent: number }
export interface Mixup { predicted: string; actual: string; count: number }
export interface Scoreboard { checked: number; correct: number; percent: number | null; rows: AccuracyRow[]; mixups: Mixup[]; avgConfidenceRight: number | null; avgConfidenceWrong: number | null }

const TOOL_NAME = { face: "Expressions", digit: "Handwriting", object: "Objects" } as const;

/** Accuracy is the share of human-checked predictions the AI got right. Only predictions someone actually checked are counted. */
export function scoreboard(feedback: import("../types").Feedback[]): Scoreboard {
  const rows: AccuracyRow[] = (["digit", "object", "face"] as const).map((activity) => {
    const mine = feedback.filter((f) => f.activity === activity);
    const correct = mine.filter((f) => f.correct).length;
    return { activity, name: TOOL_NAME[activity], checked: mine.length, correct, percent: mine.length ? (correct / mine.length) * 100 : 0 };
  });
  const wrong = feedback.filter((f) => !f.correct);
  const counts = new Map<string, Mixup>();
  for (const f of wrong) {
    const key = `${f.predicted}\u0000${f.actual}`;
    const m = counts.get(key) ?? { predicted: f.predicted, actual: f.actual, count: 0 };
    m.count += 1;
    counts.set(key, m);
  }
  const avg = (list: import("../types").Feedback[]) => {
    const values = list.map((f) => f.confidence).filter((v): v is number => typeof v === "number");
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  const correct = feedback.filter((f) => f.correct).length;
  return {
    checked: feedback.length,
    correct,
    percent: feedback.length ? (correct / feedback.length) * 100 : null,
    rows,
    mixups: [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    avgConfidenceRight: avg(feedback.filter((f) => f.correct)),
    avgConfidenceWrong: avg(wrong),
  };
}
