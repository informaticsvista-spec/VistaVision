// Clearly-labelled SAMPLE data (origin = "sample"). It is never presented as a real AI prediction.
import type { VistaEvent } from "../types";
import { EXPRESSIONS, uid } from "./events";

/** Small deterministic PRNG so the sample set is identical every time it is loaded. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSampleEvents(now = new Date()): VistaEvent[] {
  const rand = mulberry32(2026);
  const events: VistaEvent[] = [];
  const end = now.getTime();
  const base = { origin: "sample" as const, source: "sample" as const, sourceNote: "Sample dataset" };

  // 24 face snapshots over the last ~12 minutes
  const weights = [0.32, 0.26, 0.12, 0.1, 0.06, 0.05, 0.04, 0.02, 0.03];
  const pick = () => {
    let r = rand();
    for (let i = 0; i < EXPRESSIONS.length; i++) {
      r -= weights[i];
      if (r <= 0) return EXPRESSIONS[i];
    }
    return EXPRESSIONS[1];
  };
  for (let i = 0; i < 24; i++) {
    const t = new Date(end - (24 - i) * 30_000);
    const faceCount = 1 + Math.floor(rand() * 6);
    const counts = new Map<string, number>();
    for (let f = 0; f < faceCount; f++) {
      const label = pick();
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const groupId = `sample-face-${i}`;
    for (const [label, count] of counts) {
      events.push({ ...base, id: uid(), dedupeKey: `${groupId}:${label}`, timestamp: t.toISOString(), activity: "face", label, count, groupId, faceCount });
    }
  }
  // digit attempts
  const digits = ["3", "7", "4", "1", "9", "2", "43", "123", "5", "0", "8", "7", "6", "3", "21"];
  digits.forEach((label, i) => {
    events.push({ ...base, id: uid(), dedupeKey: `sample-digit-${i}`, timestamp: new Date(end - (digits.length - i) * 40_000).toISOString(), activity: "digit", label, count: 1, groupId: `sample-digit-${i}` });
  });
  // classroom object counts (typed-in style)
  [["Apple", 5], ["Banana", 3], ["Orange", 2], ["Cup", 4]].forEach(([label, count], i) => {
    events.push({ ...base, id: uid(), dedupeKey: `sample-object-${i}`, timestamp: new Date(end - (10 - i) * 20_000).toISOString(), activity: "object", label: String(label), count: Number(count) });
  });
  return events;
}
