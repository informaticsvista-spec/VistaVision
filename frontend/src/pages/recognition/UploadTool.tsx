import { useEffect, useRef, useState, type DragEvent } from "react";
import { DetectionOverlay, DigitResults, Disclaimer, FaceResults, ObjectResults, digitOverlayItems, faceOverlayItems, objectOverlayItems } from "../../components/results";
import { Alert, Spinner, Tabs } from "../../components/ui";
import { useAnalytics } from "../../analytics/AnalyticsProvider";
import { digitEvent, faceSnapshotEvents, objectEvents, uid } from "../../analytics/events";
import { useRecognizer } from "../../hooks/useRecognizer";
import { api } from "../../services/api";
import { ACCEPTED_TYPES, validateImageFile } from "../../services/imageUtils";
import { useSettings } from "../../settings";
import { play } from "../../lib/sound";
import type { DigitResponse, FaceResponse, ObjectResponse } from "../../types";

type Task = "faces" | "objects" | "digits";
type AnyResult = { task: "faces"; data: FaceResponse } | { task: "objects"; data: ObjectResponse } | { task: "digits"; data: DigitResponse };

export default function UploadTool() {
  const { settings } = useSettings();
  const { record } = useAnalytics();
  const [task, setTask] = useState<Task>("faces");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [multi, setMulti] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const { loading, error, result, run, reset } = useRecognizer<AnyResult>();

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const choose = (picked: File | undefined) => {
    if (!picked) return;
    const problem = validateImageFile(picked, settings.maxUploadMb);
    setFileError(problem);
    reset();
    if (problem) return;
    setFile(picked);
    setUrl(URL.createObjectURL(picked));
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files[0]); };

  const analyse = () => {
    if (!file) return;
    void run(async (signal): Promise<AnyResult> => {
      const requestId = uid();
      if (task === "faces") {
        const data = await api.analyzeFaces(file, { uncertainThreshold: settings.uncertainThreshold }, { signal, timeoutMs: 25000 });
        record(faceSnapshotEvents({ source: "upload", groupId: requestId, faces: data.faces.map((f) => ({ label: f.expression.label, confidence: f.expression.confidence })) }));
        play("success", settings.sound);
        return { task, data };
      }
      if (task === "objects") {
        const data = await api.detectObjects(file, {}, { signal, timeoutMs: 25000 });
        record(objectEvents({ detections: data.detections, source: "upload", requestId }));
        play("success", settings.sound);
        return { task, data };
      }
      const data = await api.recognizeDigits(file, { source: "paper", mode: multi ? "multi" : "single" }, { signal, timeoutMs: 30000 });
      record([digitEvent({ number: data.number, confidence: data.mean_confidence, source: "upload", requestId })]);
      play("success", settings.sound);
      return { task, data };
    });
  };

  const current = result && result.task === task ? result : null;
  const overlay = current ? (current.task === "faces" ? faceOverlayItems(current.data) : current.task === "objects" ? objectOverlayItems(current.data) : digitOverlayItems(current.data)) : [];

  return (
    <div className="space-y-4">
      <Tabs<Task> label="What should the AI look for?" value={task} onChange={(t) => { setTask(t); reset(); }} tabs={[{ id: "faces", label: "😀 Faces & expressions" }, { id: "objects", label: "🍎 Objects" }, { id: "digits", label: "🔢 Handwritten numbers" }]} />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
            className={`rounded-2xl border-2 border-dashed p-4 text-center transition ${dragging ? "border-cyan-500 bg-cyan-400/10" : "border-mist-300 bg-white"}`}
          >
            {url ? (
              <div className="relative mx-auto inline-block max-w-full overflow-hidden rounded-xl bg-navy-950">
                <img src={url} alt="Uploaded" className="block max-h-[60vh] max-w-full" />
                <DetectionOverlay items={overlay} />
              </div>
            ) : (
              <div className="py-10">
                <p className="text-lg font-semibold">Drop an image here</p>
                <p className="text-sm text-navy-700">JPG, PNG or WebP · up to {settings.maxUploadMb} MB · no camera needed</p>
              </div>
            )}
            <input ref={input} type="file" accept={ACCEPTED_TYPES.join(",")} className="sr-only" id="upload-input" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <label htmlFor="upload-input" className="btn-secondary cursor-pointer">{file ? "Choose another image" : "Choose an image"}</label>
              <button className="btn-primary" disabled={!file || loading} onClick={analyse}>{loading ? <><Spinner /> Analysing…</> : "Analyze image"}</button>
            </div>
          </div>
          {task === "digits" && (
            <label className="flex items-center gap-2 text-sm font-semibold text-navy-800">
              <input type="checkbox" className="h-5 w-5 accent-indigo-600" checked={multi} onChange={(e) => setMulti(e.target.checked)} /> Several digits (e.g. 43, 123)
            </label>
          )}
          {fileError && <Alert tone="error" title="That image can't be used">{fileError}</Alert>}
        </div>
        <div className="space-y-3" aria-live="polite">
          {error && <Alert tone="error" title="Could not analyse this image">{error}</Alert>}
          {current?.task === "faces" && <FaceResults result={current.data} source="upload" />}
          {current?.task === "objects" && <ObjectResults result={current.data} source="upload" />}
          {current?.task === "digits" && <DigitResults result={current.data} source="upload" />}
          {!current && !error && (
            <div className="rounded-2xl border border-mist-200 bg-white p-5 text-sm text-navy-700">
              <p>Choose an image, pick what to look for, then press <b>Analyze image</b>. Results are saved to the Data Visualization dashboard as “Image upload”.</p>
              <div className="mt-2"><Disclaimer kind={task === "faces" ? "face" : task === "objects" ? "object" : "digit"} /></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
