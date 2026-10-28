import type { DigitResponse, FaceResponse, ObjectResponse } from "../types";
import { colorFor, percent } from "../lib/format";
import { DetectionOverlay, type OverlayItem } from "./DetectionOverlay";
import { Alert, Badge, ConfidenceBar } from "./ui";
import { EXPRESSION_CHOICES, FeedbackBar } from "./FeedbackBar";
import { COCO_NAMES } from "../lib/cocoNames";
import type { InputSource } from "../types";

export const faceOverlayItems = (r: FaceResponse): OverlayItem[] =>
  r.faces.map((f, i) => ({ key: i, box: f.box, color: colorFor(f.expression.label), dashed: f.expression.uncertain, label: `Face ${String(i + 1).padStart(2, "0")} · ${f.expression.label}${f.expression.uncertain ? "" : ` ${percent(f.expression.confidence)}`}` }));

export const objectOverlayItems = (r: ObjectResponse): OverlayItem[] =>
  r.detections.map((d, i) => ({ key: i, box: d.box, color: "#2a78d6", label: `${d.label} ${percent(d.confidence)}` }));

export const digitOverlayItems = (r: DigitResponse): OverlayItem[] =>
  r.digits.map((d, i) => ({ key: i, box: d.box, color: "#18a9cf", label: `${d.digit} · ${percent(d.confidence)}` }));

export function Disclaimer({ kind }: { kind: "face" | "digit" | "object" }) {
  const text = {
    face: "Expressions are the AI's estimate of a visible facial expression. They do not show how anyone really feels, and the AI can be wrong. Nobody is identified.",
    digit: "The AI can make mistakes, especially with unusual handwriting. Confidence shows how sure it is, not whether it is right.",
    object: "The model only knows 80 everyday object types and can be wrong or miss things. It is not able to recognise every object.",
  }[kind];
  return <p className="text-xs text-navy-700">ⓘ {text}</p>;
}

export function FaceResults({ result, source = "upload" }: { result: FaceResponse; source?: InputSource }) {
  if (!result.faces.length) return <Alert tone="info" title="No faces found">Try better lighting and face the camera. Small or turned-away faces may be missed.</Alert>;
  const counts = new Map<string, number>();
  result.faces.forEach((f) => counts.set(f.expression.label, (counts.get(f.expression.label) ?? 0) + 1));
  return (
    <div className="space-y-3">
      <p className="text-lg font-bold">Faces detected: {result.faces.length}</p>
      <div className="flex flex-wrap gap-2">
        {[...counts].map(([label, n]) => <Badge key={label} tone="indigo">{label}: {n} ({Math.round((n / result.faces.length) * 100)}%)</Badge>)}
      </div>
      <ul className="space-y-1 text-sm">
        {result.faces.map((f, i) => (
          <li key={i}>Face {String(i + 1).padStart(2, "0")} — Estimated expression: <b>{f.expression.label}</b>{f.expression.uncertain && f.expression.top_label ? ` (best guess ${f.expression.top_label}, ${percent(f.expression.confidence)})` : ` (${percent(f.expression.confidence)})`}</li>
        ))}
      </ul>
      {result.faces[0] && !result.faces[0].expression.uncertain && (
        <FeedbackBar key={result.elapsed_ms} activity="face" predicted={result.faces[0].expression.label} confidence={result.faces[0].expression.confidence} source={source} options={EXPRESSION_CHOICES} what={`“${result.faces[0].expression.label}” for Face 01`} />
      )}
      <Disclaimer kind="face" />
    </div>
  );
}

export function ObjectResults({ result, source = "upload" }: { result: ObjectResponse; source?: InputSource }) {
  if (!result.detections.length) return <Alert tone="info" title="No supported object found">Hold the object closer, in good light, against a plain background. Only 80 common object types are supported.</Alert>;
  const top = result.detections[0];
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-700">Best match</p>
        <p className="text-4xl font-extrabold text-indigo-700">{top.label}</p>
      </div>
      <ConfidenceBar value={top.confidence} />
      {result.detections.length > 1 && (
        <ul className="space-y-1 text-sm">
          {result.detections.slice(1).map((d, i) => <li key={i} className="flex justify-between gap-2"><span>{d.label}</span><span className="text-navy-700">{percent(d.confidence)}</span></li>)}
        </ul>
      )}
      <FeedbackBar key={`${result.elapsed_ms}-${top.label}`} activity="object" predicted={top.label} confidence={top.confidence} source={source} options={COCO_NAMES} what={`a ${top.label.toLowerCase()}`} />
      <Disclaimer kind="object" />
    </div>
  );
}

export function DigitResults({ result, source = "upload" }: { result: DigitResponse; source?: InputSource }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-indigo-700 to-cyan-500 p-5 text-center text-white shadow-lg shadow-indigo-600/30">
        <p className="text-xs font-semibold uppercase tracking-widest text-sun-300">AI Prediction</p>
        <p className="mt-1 text-sm text-white/80">Detected Number:</p>
        <p className="text-7xl font-extrabold tracking-wide sm:text-8xl" aria-live="polite">{result.number}</p>
        <p className="mt-1 text-sm text-white/80">{result.digit_count > 1 ? `Average confidence ${percent(result.mean_confidence)}` : `Confidence ${percent(result.mean_confidence)}`}</p>
      </div>
      {result.low_confidence && <Alert tone="warn" title="The AI is not very sure">Try writing larger and darker, with the digits clearly apart, then capture again.</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        {result.digits.map((d, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-mist-200 p-3">
            <img src={d.tile_png} alt={`Processed digit ${i + 1}`} width={64} height={64} className="rounded bg-black [image-rendering:pixelated]" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">Digit {i + 1}: <span className="text-2xl text-indigo-700">{d.digit}</span></p>
              <ConfidenceBar value={d.confidence} />
              <p className="mt-1 text-xs text-navy-700">Other guesses: {d.alternatives.slice(0, 3).map((a) => `${a.digit} (${percent(a.probability)})`).join(", ")}</p>
            </div>
          </div>
        ))}
      </div>
      <FeedbackBar key={`${result.elapsed_ms}-${result.number}`} activity="digit" predicted={result.number} confidence={result.mean_confidence} source={source} what={result.number} />
      <Disclaimer kind="digit" />
    </div>
  );
}

export { DetectionOverlay };
