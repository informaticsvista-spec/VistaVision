import { EXPRESSION_CHOICES, FeedbackBar } from "../../components/FeedbackBar";
import { useEffect, useMemo, useState } from "react";
import { CameraPanel } from "../../components/CameraPanel";
import { DetectionOverlay, type OverlayItem } from "../../components/DetectionOverlay";
import { Disclaimer } from "../../components/results";
import { Alert, Badge, EmptyState } from "../../components/ui";
import { useAnalytics } from "../../analytics/AnalyticsProvider";
import { useCamera } from "../../hooks/useCamera";
import { useFaceAnalysis } from "../../hooks/useFaceAnalysis";
import { useSettings } from "../../settings";
import { colorFor, percent } from "../../lib/format";

export default function FaceTool() {
  const camera = useCamera();
  const { settings, update } = useSettings();
  const analytics = useAnalytics();
  const [analysing, setAnalysing] = useState(true);
  const active = camera.status === "live" && analysing;
  const { faces, trackedTotal, latencyMs, error, reset } = useFaceAnalysis(active);

  useEffect(() => {
    if (camera.status !== "live") reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.status]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    faces.forEach((f) => map.set(f.label, (map.get(f.label) ?? 0) + 1));
    return [...map].sort((a, b) => b[1] - a[1]);
  }, [faces]);

  const items: OverlayItem[] = faces.map((f) => ({
    key: f.id, box: f.box, color: colorFor(f.label), dashed: f.uncertain,
    label: `Face ${String(f.id).padStart(2, "0")} · ${f.label}${f.uncertain ? "" : ` ${percent(f.confidence)}`}`,
  }));

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <CameraPanel
          footer={camera.status === "live" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button className={analysing ? "btn-secondary" : "btn-primary"} onClick={() => setAnalysing((v) => !v)}>{analysing ? "Pause analysis" : "Resume analysis"}</button>
                <button className="btn-ghost" onClick={reset}>Reset face tracking</button>
                {latencyMs !== null && <span className="text-xs text-navy-700">Model time {Math.round(latencyMs)} ms</span>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-navy-700">Frame sampling: every {settings.faceIntervalMs} ms
                  <input type="range" min={300} max={2000} step={100} value={settings.faceIntervalMs} onChange={(e) => update({ faceIntervalMs: Number(e.target.value) })} className="w-full accent-indigo-600" />
                </label>
                <label className="text-xs font-semibold text-navy-700">“Uncertain” below {percent(settings.uncertainThreshold)} confidence
                  <input type="range" min={0.2} max={0.9} step={0.05} value={settings.uncertainThreshold} onChange={(e) => update({ uncertainThreshold: Number(e.target.value) })} className="w-full accent-indigo-600" />
                </label>
              </div>
            </div>
          )}
        >
          <DetectionOverlay items={items} mirrored={camera.mirrored} />
          {active && <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/50 px-2 py-1 text-[11px] font-semibold text-white">● Analysing</div>}
        </CameraPanel>
        {error && camera.status === "live" && <Alert tone="error" title="Analysis problem">{error}</Alert>}
        {analytics.paused && <Alert tone="warn" title="Analytics are paused">You still see live results here, but they are not saved to the dashboard.</Alert>}
      </div>

      <aside className="space-y-4" aria-label="Face results">
        <div className="card">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-indigo-500/10 p-3">
              <p className="text-xs font-semibold uppercase text-navy-700">Faces now</p>
              <p className="text-4xl font-extrabold text-indigo-700" aria-live="polite">{faces.length}</p>
            </div>
            <div className="rounded-xl bg-mist-100 p-3">
              <p className="text-xs font-semibold uppercase text-navy-700">Tracker IDs used</p>
              <p className="text-4xl font-extrabold">{trackedTotal}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-navy-700">“Faces now” is who is visible right now. Tracker IDs are temporary numbers that stop one face being counted again every frame. They are not identities.</p>
        </div>

        <div className="card">
          <h2 className="mb-2 text-base font-bold">Expressions right now</h2>
          {!faces.length ? (
            <EmptyState title={camera.status === "live" ? "No faces in view" : "Start the camera"}>{camera.status === "live" ? "Step in front of the camera." : "Face detection runs on the live camera view."}</EmptyState>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {counts.map(([label, n]) => <Badge key={label} tone="indigo">{label}: {n} ({Math.round((n / faces.length) * 100)}%)</Badge>)}
              </div>
              <ul className="space-y-1.5 text-sm">
                {faces.map((f) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colorFor(f.label) }} aria-hidden />
                    <span>Face {String(f.id).padStart(2, "0")} — Estimated expression: <b>{f.label}</b>{!f.uncertain && <span className="text-navy-700"> ({percent(f.confidence)})</span>}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {faces[0] && !faces[0].uncertain && (
            <div className="mt-3"><FeedbackBar activity="face" predicted={faces[0].label} confidence={faces[0].confidence} source="webcam" options={EXPRESSION_CHOICES} what={`“${faces[0].label}” for Face ${String(faces[0].id).padStart(2, "0")}`} /></div>
          )}
          <div className="mt-3"><Disclaimer kind="face" /></div>
        </div>

        <div className="card text-sm text-navy-800">
          <p className="font-semibold">Privacy</p>
          <p className="mt-1">While analysis runs, small frames are sent to the VistaVision server, analysed in memory and discarded. No photos or face data are stored. Only counts and expression labels are kept in this session. Press <b>Stop Camera</b> any time.</p>
        </div>
      </aside>
    </div>
  );
}
