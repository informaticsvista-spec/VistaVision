import { useEffect, useRef, type ReactNode } from "react";
import { cameraService } from "../services/camera";
import { useCamera } from "../hooks/useCamera";
import { Alert, Badge, Spinner } from "./ui";
import { cx } from "../lib/format";

/**
 * The one shared camera view. Every recognition tool renders this panel (never its own stream),
 * and passes its overlay (boxes, labels) as children. Start/Stop and camera choice live here.
 */
export function CameraPanel({ children, footer, className, mirror }: { children?: ReactNode; footer?: ReactNode; className?: string; mirror?: boolean }) {
  const camera = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    cameraService.attach(videoRef.current);
    return () => cameraService.attach(null);
  }, []);

  const live = camera.status === "live";
  const aspect = camera.width && camera.height ? `${camera.width} / ${camera.height}` : "4 / 3";
  const canFlip = camera.devices.length > 1;

  return (
    <div className={cx("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={live ? "green" : camera.status === "error" ? "red" : "gray"}>
          <span className={cx("h-2 w-2 rounded-full", live ? "bg-emerald-500" : camera.status === "error" ? "bg-red-500" : "bg-slate-400")} />
          Camera: {camera.status === "live" ? "On" : camera.status === "starting" ? "Starting…" : camera.status === "error" ? "Problem" : "Off"}
        </Badge>
        {live && camera.width > 0 && <span className="text-xs text-navy-700">{camera.width}×{camera.height}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {live ? (
            <button className="btn-danger" onClick={camera.stop}>Stop Camera</button>
          ) : (
            <button className="btn-primary" disabled={camera.status === "starting"} onClick={() => void camera.start({ deviceId: camera.deviceId })}>
              {camera.status === "starting" ? <><Spinner /> Starting…</> : "Start Camera"}
            </button>
          )}
        </div>
      </div>

      {camera.error && (
        <Alert tone="error" title="Camera problem" action={camera.supported && <button className="btn-secondary" onClick={() => void camera.start({ deviceId: camera.deviceId })}>Try again</button>}>
          {camera.error}
        </Alert>
      )}

      <div className="relative w-full overflow-hidden rounded-2xl bg-navy-950 shadow-inner" style={{ aspectRatio: aspect }}>
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          aria-label="Live camera preview"
          className={cx("absolute inset-0 h-full w-full object-fill", (mirror ?? camera.mirrored) && "-scale-x-100", !live && "invisible")}
        />
        {!live && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white/80">
            <p className="text-lg font-semibold text-white">Camera is off</p>
            <p className="max-w-sm text-sm">Press <b>Start Camera</b> and allow access when your browser asks. Video stays on this device unless you analyse a frame.</p>
          </div>
        )}
        {live && children}
      </div>

      {live && canFlip && (
        <div className="flex items-center gap-2">
          <label htmlFor="camera-select" className="label !mb-0 shrink-0">Camera</label>
          <select
            id="camera-select"
            className="input"
            value={camera.deviceId ?? ""}
            onChange={(e) => void camera.start({ deviceId: e.target.value })}
          >
            {camera.devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
            ))}
          </select>
        </div>
      )}
      {footer}
    </div>
  );
}
