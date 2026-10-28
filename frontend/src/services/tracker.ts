// Lightweight face tracker. It gives faces *temporary* ids across frames so that one person standing
// in front of the camera is not counted as a new person in every frame. IDs are not identities:
// no face features are stored, and a face that leaves and returns may receive a new id.
import type { Box } from "../types";

export interface Detection {
  box: Box;
  probabilities: Record<string, number>;
}

export interface TrackedFace {
  id: number;
  box: Box;
  label: string; // smoothed expression, or "Uncertain"
  confidence: number;
  uncertain: boolean;
}

interface Track {
  id: number;
  box: Box;
  history: Record<string, number>[];
  missed: number;
}

export function iou(a: Box, b: Box): number {
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

export class FaceTracker {
  private tracks: Track[] = [];
  private nextId = 1;
  private everSeen = new Set<number>();

  constructor(private opts = { iouThreshold: 0.25, maxMissed: 4, smoothing: 5 }) {}

  /** Distinct ids handed out since the last reset (a count of tracks, not of people). */
  get totalTracked(): number {
    return this.everSeen.size;
  }

  reset(): void {
    this.tracks = [];
    this.nextId = 1;
    this.everSeen.clear();
  }

  update(detections: Detection[], uncertainThreshold: number): TrackedFace[] {
    const pairs: { t: number; d: number; score: number }[] = [];
    this.tracks.forEach((track, t) =>
      detections.forEach((det, d) => {
        const score = iou(track.box, det.box);
        if (score >= this.opts.iouThreshold) pairs.push({ t, d, score });
      }),
    );
    pairs.sort((a, b) => b.score - a.score);

    const trackForDetection = new Map<number, Track>();
    const usedTracks = new Set<number>();
    for (const { t, d } of pairs) {
      if (usedTracks.has(t) || trackForDetection.has(d)) continue;
      usedTracks.add(t);
      trackForDetection.set(d, this.tracks[t]);
    }
    this.tracks.forEach((track, t) => {
      if (!usedTracks.has(t)) track.missed += 1;
    });

    const result: TrackedFace[] = detections.map((det, d) => {
      let track = trackForDetection.get(d);
      if (!track) {
        track = { id: this.nextId++, box: det.box, history: [], missed: 0 };
        this.tracks.push(track);
      }
      track.box = det.box;
      track.missed = 0;
      this.everSeen.add(track.id);
      if (Object.keys(det.probabilities).length) track.history = [...track.history, det.probabilities].slice(-this.opts.smoothing);

      const averaged = averageProbabilities(track.history);
      const [label, confidence] = topOf(averaged);
      const uncertain = !label || confidence < uncertainThreshold;
      return { id: track.id, box: det.box, label: uncertain ? "Uncertain" : label, confidence, uncertain };
    });

    this.tracks = this.tracks.filter((t) => t.missed <= this.opts.maxMissed);
    return result.sort((a, b) => a.id - b.id);
  }
}

function averageProbabilities(history: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const probs of history) for (const [k, v] of Object.entries(probs)) out[k] = (out[k] ?? 0) + v / history.length;
  return out;
}

function topOf(probs: Record<string, number>): [string, number] {
  let best = "";
  let bestValue = 0;
  for (const [k, v] of Object.entries(probs)) if (v > bestValue) [best, bestValue] = [k, v];
  return [best, bestValue];
}
