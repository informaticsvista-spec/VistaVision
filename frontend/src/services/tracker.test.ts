import { describe, expect, it } from "vitest";
import { FaceTracker, iou, type Detection } from "./tracker";

const det = (x: number, label = "Happy", p = 0.9): Detection => ({
  box: { x, y: 0.3, w: 0.2, h: 0.3 },
  probabilities: { [label]: p, Neutral: 1 - p },
});

describe("FaceTracker", () => {
  it("keeps the same id for a face that barely moves, so frames are not counted as new people", () => {
    const tracker = new FaceTracker();
    for (let frame = 0; frame < 30; frame++) tracker.update([det(0.2 + frame * 0.002)], 0.45);
    expect(tracker.totalTracked).toBe(1);
  });
  it("gives separate ids to simultaneous faces and reports the current count", () => {
    const tracker = new FaceTracker();
    const faces = tracker.update([det(0.05), det(0.4), det(0.7)], 0.45);
    expect(faces.map((f) => f.id)).toEqual([1, 2, 3]);
    expect(tracker.update([det(0.05), det(0.4)], 0.45)).toHaveLength(2);
    expect(tracker.totalTracked).toBe(3);
  });
  it("smooths flickering expressions over recent frames", () => {
    const tracker = new FaceTracker();
    const labels = ["Happy", "Happy", "Sad", "Happy", "Happy"];
    let last = "";
    for (const l of labels) last = tracker.update([det(0.3, l, 0.8)], 0.45)[0].label;
    expect(last).toBe("Happy");
  });
  it("labels low-confidence faces Uncertain", () => {
    const tracker = new FaceTracker();
    const [face] = tracker.update([{ box: { x: 0.3, y: 0.3, w: 0.2, h: 0.3 }, probabilities: { Happy: 0.3, Neutral: 0.3, Sad: 0.2, Angry: 0.2 } }], 0.45);
    expect(face.label).toBe("Uncertain");
    expect(face.uncertain).toBe(true);
  });
  it("drops lost tracks and starts fresh ids afterwards", () => {
    const tracker = new FaceTracker({ iouThreshold: 0.25, maxMissed: 2, smoothing: 5 });
    tracker.update([det(0.3)], 0.45);
    for (let i = 0; i < 4; i++) tracker.update([], 0.45);
    expect(tracker.update([det(0.3)], 0.45)[0].id).toBe(2);
  });
  it("computes IoU", () => {
    expect(iou({ x: 0, y: 0, w: 1, h: 1 }, { x: 0, y: 0, w: 1, h: 1 })).toBe(1);
    expect(iou({ x: 0, y: 0, w: 1, h: 1 }, { x: 2, y: 2, w: 1, h: 1 })).toBe(0);
  });
});
