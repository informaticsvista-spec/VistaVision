import { useEffect, useRef, useState } from "react";
import { CameraPanel } from "../../components/CameraPanel";
import { CropSelector } from "../../components/CropSelector";
import { DrawingCanvas, type DrawingHandle } from "../../components/DrawingCanvas";
import { DetectionOverlay, DigitResults, digitOverlayItems } from "../../components/results";
import { Alert, Spinner, Tabs } from "../../components/ui";
import { useCamera } from "../../hooks/useCamera";
import { useDigitRecognition } from "../../hooks/useDigitRecognition";
import { cameraService } from "../../services/camera";
import { cropBlob } from "../../services/imageUtils";
import type { Box } from "../../types";

type Mode = "single" | "multi";
type Way = "draw" | "paper";

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-navy-800">
      <input type="checkbox" className="h-5 w-5 accent-indigo-600" checked={mode === "multi"} onChange={(e) => onChange(e.target.checked ? "multi" : "single")} />
      Several digits (e.g. 43, 123)
    </label>
  );
}

export default function NumberTool() {
  const [way, setWay] = useState<Way>("draw");
  return (
    <div className="space-y-4">
      <Tabs<Way> label="Number input method" value={way} onChange={setWay} tabs={[{ id: "draw", label: "✍️ Draw on screen" }, { id: "paper", label: "📄 Write on paper" }]} />
      {way === "draw" ? <DrawPanel /> : <PaperPanel />}
    </div>
  );
}

function DrawPanel() {
  const canvas = useRef<DrawingHandle>(null);
  const [mode, setMode] = useState<Mode>("multi");
  const [hasInk, setHasInk] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { loading, error, result, recognize, reset } = useDigitRecognition("touch-canvas", "canvas");

  const predict = async () => {
    if (!canvas.current?.hasInk()) return setNotice("Draw a number first, then tap Predict Number.");
    setNotice(null);
    const blob = await canvas.current.toBlob();
    if (blob) await recognize(blob, mode);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-3">
        <p className="text-sm text-navy-700">Draw a number with your finger, a stylus or the mouse. It works without a camera.</p>
        <DrawingCanvas ref={canvas} onInkChange={(v) => { setHasInk(v); if (!v) reset(); }} disabled={loading} />
        <ModeToggle mode={mode} onChange={setMode} />
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary flex-1 !text-base sm:flex-none" onClick={predict} disabled={loading || !hasInk}>{loading ? <><Spinner /> Thinking…</> : "Predict Number"}</button>
          <button className="btn-secondary" onClick={() => { canvas.current?.clear(); reset(); setNotice(null); }}>Draw again</button>
        </div>
        {notice && <Alert tone="info">{notice}</Alert>}
      </div>
      <div className="space-y-3" aria-live="polite">
        {error && <Alert tone="error" title="Could not read the drawing">{error}</Alert>}
        {result ? <DigitResults result={result} source="touch-canvas" /> : !error && <ResultPlaceholder text="Your prediction appears here." />}
      </div>
    </div>
  );
}

function PaperPanel() {
  const camera = useCamera();
  const [mode, setMode] = useState<Mode>("multi");
  const [captured, setCaptured] = useState<{ blob: Blob; url: string } | null>(null);
  const [crop, setCrop] = useState<Box | null>(null);
  const [capError, setCapError] = useState<string | null>(null);
  const [usedCrop, setUsedCrop] = useState(false);
  const { loading, error, result, recognize, reset } = useDigitRecognition("paper-camera", "paper");

  useEffect(() => () => { if (captured) URL.revokeObjectURL(captured.url); }, [captured]);

  const capture = async () => {
    try {
      setCapError(null);
      const blob = await cameraService.captureFrame({ maxWidth: 1280, quality: 0.92 });
      setCaptured({ blob, url: URL.createObjectURL(blob) });
      setCrop(null);
      reset();
    } catch {
      setCapError("The camera is not ready yet. Wait a second and try again.");
    }
  };

  const analyse = async () => {
    if (!captured) return;
    const blob = crop ? await cropBlob(captured.blob, crop) : captured.blob;
    setUsedCrop(!!crop);
    await recognize(blob, mode);
  };

  const again = () => { setCaptured(null); setCrop(null); reset(); };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-3">
        {!captured ? (
          <>
            <CameraPanel mirror={false}>{null}</CameraPanel>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-navy-700">
              <li>Write a big number with a dark pen or marker on plain white paper.</li>
              <li>Hold the paper steady so the number fills most of the picture.</li>
              <li>Press <b>Capture</b>.</li>
            </ol>
            <button className="btn-primary w-full !text-base" onClick={capture} disabled={camera.status !== "live"}>📸 Capture</button>
            {capError && <Alert tone="error">{capError}</Alert>}
          </>
        ) : (
          <>
            <p className="text-sm text-navy-700">Optional: drag a box around just the number to ignore the background. Otherwise the whole picture is used.</p>
            <CropSelector src={captured.url} onChange={setCrop}>
              {result && !usedCrop && !crop && <DetectionOverlay items={digitOverlayItems(result)} />}
            </CropSelector>
            <ModeToggle mode={mode} onChange={setMode} />
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={analyse} disabled={loading}>{loading ? <><Spinner /> Analysing…</> : crop ? "Recognize selected area" : "Recognize number"}</button>
              <button className="btn-secondary" onClick={again}>Capture again</button>
              {(result || error) && <button className="btn-ghost" onClick={reset}>Retry</button>}
            </div>
          </>
        )}
      </div>
      <div className="space-y-3" aria-live="polite">
        {error && <Alert tone="error" title="Could not read a number">{error}</Alert>}
        {result ? (
          <>
            <DigitResults result={result} source="paper-camera" />
            <div>
              <p className="label">What the AI saw (cleaned-up image)</p>
              <img src={result.mask_png} alt="Black and white version of the photo used for recognition" className="max-h-48 rounded-xl border border-mist-200" />
            </div>
          </>
        ) : !error && <ResultPlaceholder text={captured ? "Press Recognize number." : "Capture a photo of your handwritten number."} />}
      </div>
    </div>
  );
}

const ResultPlaceholder = ({ text }: { text: string }) => (
  <div className="flex min-h-[220px] items-center justify-center rounded-2xl border-2 border-dashed border-mist-300 bg-white p-6 text-center text-navy-700">{text}</div>
);
