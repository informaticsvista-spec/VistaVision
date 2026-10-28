import { describe, expect, it } from "vitest";
import { scoreboard, computeKpis, confidenceHistogram, digitFrequency, expressionCounts, expressionHeatmap, faceCountSeries, filterEvents, objectFrequency, originComparison, summarize } from "./aggregate";
import { eventsToCsv, csvCell } from "./csv";
import { digitEvent, faceSnapshotEvents, objectEvents } from "./events";
import { initialState, reducer } from "./reducer";
import { buildSampleEvents } from "./sample";
import { validateRecord } from "./validate";
import type { VistaEvent } from "../types";

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 27, 10, minutes, 0));
const manual = (label: string, count: number, activity: VistaEvent["activity"] = "object"): VistaEvent => ({
  id: `m-${label}`, dedupeKey: `m-${label}`, timestamp: at(0).toISOString(), activity, origin: "manual", source: "manual", label, count,
});

describe("face snapshots keep faces, tracks and observations separate", () => {
  const first = faceSnapshotEvents({ source: "webcam", timestamp: at(0), faces: [
    { trackId: 1, label: "Happy", confidence: 0.9 }, { trackId: 2, label: "Happy", confidence: 0.7 },
    { trackId: 3, label: "Neutral", confidence: 0.8 }, { trackId: 4, label: "Sad", confidence: 0.6 }, { trackId: 5, label: "Surprise", confidence: 0.9 } ] });
  const second = faceSnapshotEvents({ source: "webcam", timestamp: at(1), faces: [
    { trackId: 1, label: "Happy", confidence: 0.9 }, { trackId: 2, label: "Neutral", confidence: 0.8 }, { trackId: 6, label: "Happy", confidence: 0.8 } ] });
  const events = [...first, ...second];

  it("groups by expression with the spec example (5 faces: 2 happy, 1 neutral, 1 sad, 1 surprise)", () => {
    expect(first).toHaveLength(4);
    expect(first.every((e) => e.faceCount === 5)).toBe(true);
    expect(first.find((e) => e.label === "Happy")?.count).toBe(2);
  });
  it("current faces = latest snapshot, tracked = unique ids, observations = sum of counts", () => {
    const k = computeKpis(events);
    expect(k.currentFaces).toBe(3);
    expect(k.trackedFaces).toBe(6);
    expect(k.expressionObservations).toBe(8);
    expect(k.totalRecords).toBe(2);
  });
  it("expression counts and percentages are shares of observations", () => {
    const rows = expressionCounts(events);
    expect(rows.find((r) => r.name === "Happy")).toMatchObject({ count: 4, percent: 50 });
    expect(rows.reduce((a, r) => a + r.percent, 0)).toBeCloseTo(100);
  });
  it("face count series has one point per snapshot, not per event", () => {
    expect(faceCountSeries(events).map((p) => p.faceCount)).toEqual([5, 3]);
  });
  it("an empty frame records zero faces without inventing an expression", () => {
    const none = faceSnapshotEvents({ source: "webcam", timestamp: at(2), faces: [] });
    expect(none).toHaveLength(1);
    expect(computeKpis([...events, ...none]).currentFaces).toBe(0);
    expect(expressionCounts(none)).toEqual([]);
  });
});

describe("digits and objects", () => {
  const events = [
    digitEvent({ number: "43", confidence: 0.9, source: "paper-camera", requestId: "a" }),
    digitEvent({ number: "4", confidence: 0.8, source: "touch-canvas", requestId: "b" }),
    ...objectEvents({ detections: [{ label: "Apple", confidence: 0.9 }, { label: "Apple", confidence: 0.8 }, { label: "Banana", confidence: 0.7 }], source: "webcam", requestId: "c" }),
  ];
  it("digit frequency counts every digit of multi-digit numbers", () => {
    const f = digitFrequency(events);
    expect(f).toHaveLength(10);
    expect(f[4].count).toBe(2);
    expect(f[3].count).toBe(1);
    expect(computeKpis(events).digitAttempts).toBe(2);
  });
  it("object frequency", () => {
    expect(objectFrequency(events)[0]).toMatchObject({ name: "Apple", count: 2 });
  });
  it("manual digit records multiply by their count", () => {
    expect(digitFrequency([manual("7", 3, "digit")])[7].count).toBe(3);
  });
});

describe("store reducer", () => {
  it("ignores duplicate dedupe keys and ids (re-renders, double callbacks)", () => {
    const e = digitEvent({ number: "5", confidence: 0.9, source: "webcam", requestId: "req-1" });
    const again = { ...digitEvent({ number: "5", confidence: 0.9, source: "webcam", requestId: "req-1" }) };
    let s = reducer(initialState(), { type: "add", events: [e] });
    s = reducer(s, { type: "add", events: [e] });
    s = reducer(s, { type: "add", events: [again] });
    expect(s.events).toHaveLength(1);
  });
  it("paused analytics drop AI events but still accept manual records", () => {
    let s = reducer(initialState(), { type: "setPaused", paused: true });
    s = reducer(s, { type: "add", events: [digitEvent({ number: "1", confidence: 1, source: "webcam", requestId: "x" }), manual("Apple", 5)] });
    expect(s.events.map((e) => e.origin)).toEqual(["manual"]);
  });
  it("editing a manual record recalculates, and AI records cannot be edited", () => {
    const ai = digitEvent({ number: "9", confidence: 1, source: "webcam", requestId: "y" });
    let s = reducer(initialState(), { type: "add", events: [manual("Apple", 5), ai] });
    s = reducer(s, { type: "update", id: "m-Apple", patch: { count: 9 } });
    s = reducer(s, { type: "update", id: ai.id, patch: { label: "1" } });
    expect(objectFrequency(s.events)[0].count).toBe(9);
    expect(s.events.find((e) => e.id === ai.id)?.label).toBe("9");
    s = reducer(s, { type: "remove", id: "m-Apple" });
    expect(objectFrequency(s.events)).toEqual([]);
  });
  it("replaceSamples swaps sample data without touching other records", () => {
    let s = reducer(initialState(), { type: "add", events: [manual("Apple", 1)] });
    s = reducer(s, { type: "replaceSamples", events: buildSampleEvents(at(0)) });
    const n = s.events.length;
    s = reducer(s, { type: "replaceSamples", events: buildSampleEvents(at(5)) });
    expect(s.events).toHaveLength(n);
    expect(s.events.filter((e) => e.origin === "manual")).toHaveLength(1);
  });
});

describe("filters, comparison, empty data", () => {
  const sample = buildSampleEvents(at(30));
  it("sample data is always flagged as sample", () => {
    expect(sample.every((e) => e.origin === "sample" && e.source === "sample")).toBe(true);
  });
  it("filters by origin and category", () => {
    const mixed = [...sample, manual("Apple", 2)];
    expect(filterEvents(mixed, { origin: "manual" })).toHaveLength(1);
    expect(filterEvents(mixed, { category: "Apple" }).every((e) => e.label === "Apple")).toBe(true);
  });
  it("comparison separates AI, manual and sample", () => {
    const rows = originComparison([manual("Apple", 4), ...objectEvents({ detections: [{ label: "Apple", confidence: 1 }], source: "webcam", requestId: "z" })]);
    expect(rows[0]).toMatchObject({ activity: "Objects", ai: 1, manual: 4, sample: 0 });
  });
  it("empty datasets never throw", () => {
    expect(computeKpis([])).toMatchObject({ totalRecords: 0, currentFaces: null });
    expect(expressionCounts([])).toEqual([]);
    expect(expressionHeatmap([])).toBeNull();
    expect(confidenceHistogram([])).toBeNull();
    expect(summarize([]).averageConfidence).toBeNull();
  });
  it("heatmap and confidence histogram appear only with enough data", () => {
    expect(expressionHeatmap(sample)).not.toBeNull();
    const ai = Array.from({ length: 6 }, (_, i) => digitEvent({ number: "1", confidence: 0.5 + i / 20, source: "webcam", requestId: `r${i}` }));
    expect(confidenceHistogram(ai)?.reduce((a, b) => a + b.count, 0)).toBe(6);
    expect(confidenceHistogram(ai.slice(0, 3))).toBeNull();
  });
});

describe("manual validation", () => {
  const base = { activity: "object" as const, label: "apple", count: "5", timestamp: "", faceCount: "" };
  it("accepts a valid record and tidies the name", () => {
    const r = validateRecord(base);
    expect(r.ok && r.value).toMatchObject({ label: "Apple", count: 5 });
  });
  it.each([["-3"], ["2.5"], ["abc"], [""], ["100001"]])("rejects count %p", (count) => {
    expect(validateRecord({ ...base, count }).ok).toBe(false);
  });
  it("validates activity-specific labels", () => {
    expect(validateRecord({ ...base, activity: "digit", label: "4x" }).ok).toBe(false);
    expect(validateRecord({ ...base, activity: "digit", label: "43" }).ok).toBe(true);
    expect(validateRecord({ ...base, activity: "face", label: "happy" }).ok).toBe(true);
    expect(validateRecord({ ...base, activity: "face", label: "Hungry" }).ok).toBe(false);
  });
  it("rejects far-future timestamps and faces fewer than the count", () => {
    expect(validateRecord({ ...base, timestamp: "2999-01-01T00:00" }).ok).toBe(false);
    expect(validateRecord({ ...base, activity: "face", label: "Happy", count: "3", faceCount: "2" }).ok).toBe(false);
  });
});

describe("CSV export", () => {
  it("has a header, quotes commas and neutralises spreadsheet formulas", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    const csv = eventsToCsv([manual("Apple, red", 2)]);
    expect(csv.split("\r\n")[0]).toContain("origin,activity,source,label,count,confidence");
    expect(csv).toContain('"Apple, red"');
  });
});

describe("Human vs AI scoreboard", () => {
  const fb = (activity: "digit" | "object" | "face", predicted: string, actual: string, confidence = 0.9) => ({
    id: `${activity}-${predicted}-${actual}-${Math.random()}`, timestamp: new Date().toISOString(), activity, source: "webcam" as const, predicted, actual, correct: predicted === actual, confidence,
  });
  it("is empty and safe without feedback", () => {
    const b = scoreboard([]);
    expect(b).toMatchObject({ checked: 0, correct: 0, percent: null, mixups: [] });
  });
  it("counts only checked predictions and groups mix-ups", () => {
    const b = scoreboard([fb("digit", "4", "4"), fb("digit", "7", "1", 0.95), fb("digit", "7", "1", 0.85), fb("object", "Cup", "Cup")]);
    expect(b.checked).toBe(4);
    expect(b.correct).toBe(2);
    expect(b.percent).toBe(50);
    expect(b.rows.find((r) => r.activity === "digit")).toMatchObject({ checked: 3, correct: 1 });
    expect(b.mixups[0]).toEqual({ predicted: "7", actual: "1", count: 2 });
    expect(b.avgConfidenceWrong).toBeCloseTo(0.9);
  });
  it("feedback is stored once per id and cleared with the session data", () => {
    const f = fb("object", "Cup", "Bottle");
    let s = reducer(initialState(), { type: "addFeedback", feedback: f });
    s = reducer(s, { type: "addFeedback", feedback: f });
    expect(s.feedback).toHaveLength(1);
    expect(reducer(s, { type: "clear" }).feedback).toHaveLength(0);
    expect(reducer(s, { type: "reset" }).feedback).toHaveLength(0);
  });
});
