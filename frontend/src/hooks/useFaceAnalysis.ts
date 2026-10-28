import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../services/api";
import { cameraService } from "../services/camera";
import { FaceTracker, type TrackedFace } from "../services/tracker";
import { useSettings } from "../settings";
import { useAnalytics } from "../analytics/AnalyticsProvider";
import { faceSnapshotEvents } from "../analytics/events";

/**
 * Live face analysis over the shared camera.
 * - At most one request is in flight; frames are sampled every `faceIntervalMs`.
 * - Results go through a tracker, so a face keeps one temporary id and is not re-counted every frame.
 * - A snapshot is written to analytics at most every `sampleSeconds`, never once per video frame.
 */
export function useFaceAnalysis(active: boolean) {
  const { settings } = useSettings();
  const analytics = useAnalytics();
  const [faces, setFaces] = useState<TrackedFace[]>([]);
  const [trackedTotal, setTrackedTotal] = useState(0);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tracker = useRef(new FaceTracker());
  const latest = useRef({ settings, record: analytics.record });
  latest.current = { settings, record: analytics.record };
  const lastRecorded = useRef({ at: 0, faces: -1 });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    const tick = async () => {
      const started = performance.now();
      try {
        const frame = await cameraService.captureFrame({ maxWidth: 480, quality: 0.7 });
        const { settings: s } = latest.current;
        const response = await api.analyzeFaces(frame, { uncertainThreshold: s.uncertainThreshold });
        if (cancelled) return;
        failures = 0;
        setError(null);
        setLatencyMs(response.elapsed_ms);

        const tracked = tracker.current.update(
          response.faces.map((f) => ({ box: f.box, probabilities: f.expression.probabilities })),
          s.uncertainThreshold,
        );
        setFaces(tracked);
        setTrackedTotal(tracker.current.totalTracked);

        const now = Date.now();
        const due = now - lastRecorded.current.at >= s.sampleSeconds * 1000;
        const quietRepeat = tracked.length === 0 && lastRecorded.current.faces === 0;
        if (due && !quietRepeat) {
          lastRecorded.current = { at: now, faces: tracked.length };
          latest.current.record(
            faceSnapshotEvents({ source: "webcam", faces: tracked.map((f) => ({ trackId: f.id, label: f.label, confidence: f.confidence })) }),
          );
        }
      } catch (e) {
        if (cancelled) return;
        failures += 1;
        const message = e instanceof ApiError ? e.message : "Waiting for the camera…";
        setError(message);
      }
      if (!cancelled) {
        const wait = Math.max(50, latest.current.settings.faceIntervalMs - (performance.now() - started));
        timer = setTimeout(tick, wait + Math.min(failures, 5) * 1000); // back off while the server is unreachable
      }
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active]);

  const reset = useCallback(() => {
    tracker.current.reset();
    lastRecorded.current = { at: 0, faces: -1 };
    setFaces([]);
    setTrackedTotal(0);
  }, []);

  return { faces, trackedTotal, latencyMs, error, reset };
}
