import { useCallback, useEffect, useRef, useState } from "react";
import { CameraPanel } from "../../components/CameraPanel";
import { DetectionOverlay, ObjectResults, objectOverlayItems } from "../../components/results";
import { Alert, Spinner } from "../../components/ui";
import { useAnalytics } from "../../analytics/AnalyticsProvider";
import { objectEvents, uid } from "../../analytics/events";
import { useCamera } from "../../hooks/useCamera";
import { useRecognizer } from "../../hooks/useRecognizer";
import { useSettings } from "../../settings";
import { api } from "../../services/api";
import { cameraService } from "../../services/camera";
import { play } from "../../lib/sound";
import type { ObjectResponse } from "../../types";

export default function ObjectTool() {
  const camera = useCamera();
  const { settings } = useSettings();
  const { record } = useAnalytics();
  const { loading, error, result, run, reset } = useRecognizer<ObjectResponse>();
  const [frozen, setFrozen] = useState<{ url: string; blob: Blob } | null>(null);
  const [live, setLive] = useState(false);
  const [liveResult, setLiveResult] = useState<ObjectResponse | null>(null);
  const [labels, setLabels] = useState<string[] | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const frozenUrl = useRef<string | null>(null);

  useEffect(() => () => { if (frozenUrl.current) URL.revokeObjectURL(frozenUrl.current); }, []);
  useEffect(() => { if (camera.status !== "live") setLive(false); }, [camera.status]);

  // Optional live preview of boxes (not recorded to analytics; only "Analyze" records).
  useEffect(() => {
    if (!live || frozen) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const frame = await cameraService.captureFrame({ maxWidth: 480, quality: 0.7 });
        const response = await api.detectObjects(frame, { minScore: 0.5 });
        if (!cancelled) setLiveResult(response);
      } catch { /* transient; try again */ }
      if (!cancelled) timer = setTimeout(tick, 1200);
    };
    void tick();
    return () => { cancelled = true; clearTimeout(timer); setLiveResult(null); };
  }, [live, frozen]);

  const freeze = useCallback((blob: Blob) => {
    if (frozenUrl.current) URL.revokeObjectURL(frozenUrl.current);
    frozenUrl.current = URL.createObjectURL(blob);
    setFrozen({ url: frozenUrl.current, blob });
    setLive(false);
  }, []);

  /** Capture Image: freeze the current camera frame so it can be looked at (no analysis yet). */
  const capture = useCallback(async () => {
    const frame = await cameraService.captureFrame({ maxWidth: 800, quality: 0.85 }).catch(() => null);
    if (frame) { reset(); freeze(frame); }
  }, [freeze, reset]);

  /** Analyze: run the object model on the frozen frame, or on a fresh frame (which is then frozen so boxes line up). */
  const analyse = useCallback(async () => {
    const frame = frozen?.blob ?? (await cameraService.captureFrame({ maxWidth: 800, quality: 0.85 }).catch(() => null));
    if (!frame) return;
    const out = await run(async (signal) => {
      const requestId = uid();
      const response = await api.detectObjects(frame, { minScore: 0.4 }, { signal });
      record(objectEvents({ detections: response.detections, source: "webcam", requestId }));
      play(response.detections.length ? "success" : "wrong", settings.sound);
      return response;
    });
    if (out && !frozen) freeze(frame);
  }, [frozen, run, record, settings.sound, freeze]);

  const retry = () => { reset(); setFrozen(null); };
  const loadLabels = async () => {
    setShowLabels((v) => !v);
    if (!labels) api.objectLabels().then((r) => setLabels(r.labels)).catch(() => setLabels([]));
  };

  const shown = frozen ? result : liveResult;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        {frozen ? (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl bg-navy-950">
              <img src={frozen.url} alt="Captured camera frame" className={`block w-full ${camera.mirrored ? "-scale-x-100" : ""}`} />
              {result && <DetectionOverlay items={objectOverlayItems(result)} mirrored={camera.mirrored} />}
            </div>
            <p className="text-xs text-navy-700">Showing the captured image. Press Retry to go back to the live camera.</p>
          </div>
        ) : (
          <CameraPanel>{shown && live && <DetectionOverlay items={objectOverlayItems(shown)} mirrored={camera.mirrored} />}</CameraPanel>
        )}
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={(camera.status !== "live" && !frozen) || loading} onClick={() => void analyse()}>{loading ? <><Spinner /> Analysing…</> : "Analyze"}</button>
          <button className="btn-cyan" disabled={camera.status !== "live" || loading || !!frozen} onClick={() => void capture()}>Capture Image</button>
          <button className="btn-secondary" disabled={!frozen && !result && !error} onClick={retry}>Retry</button>
          <label className="ml-auto flex items-center gap-2 text-sm font-semibold text-navy-800">
            <input type="checkbox" className="h-5 w-5 accent-indigo-600" checked={live} disabled={camera.status !== "live" || !!frozen} onChange={(e) => setLive(e.target.checked)} />
            Live boxes
          </label>
        </div>
        {error && <Alert tone="error" title="Could not analyse">{error}</Alert>}
      </div>

      <aside className="space-y-4" aria-live="polite">
        <div className="card min-h-[200px]">
          <h2 className="mb-2 text-base font-bold">Object result</h2>
          {result ? <ObjectResults result={result} source="webcam" /> : <p className="text-sm text-navy-700">Show an object such as an apple, banana or cup to the camera and press <b>Analyze</b>. “Live boxes” previews what the model sees; only Analyze saves a result to the dashboard.</p>}
        </div>
        <div className="card text-sm">
          <button className="font-semibold text-indigo-700 underline-offset-2 hover:underline" onClick={loadLabels} aria-expanded={showLabels}>{showLabels ? "Hide" : "Show"} the 80 objects this AI knows</button>
          {showLabels && (labels ? <p className="mt-2 leading-relaxed text-navy-800">{labels.length ? labels.join(" · ") : "Could not load the list from the server."}</p> : <p className="mt-2"><Spinner /> Loading…</p>)}
        </div>
      </aside>
    </div>
  );
}
