import { useEffect, useState, type FormEvent } from "react";
import type { Activity, VistaEvent } from "../types";
import { EXPRESSIONS, ACTIVITY_LABEL } from "../analytics/events";
import { validateRecord, type RecordInput } from "../analytics/validate";
import { useAnalytics } from "../analytics/AnalyticsProvider";
import { toLocalInput } from "../lib/format";
import { Alert } from "./ui";

const SOURCE_TYPES = ["Classroom observation", "Survey", "Practice activity", "Other"];
const blank = (): RecordInput => ({ activity: "object", label: "", count: "1", timestamp: "", faceCount: "" });

export function ManualEntryForm({ editing, onDone }: { editing: VistaEvent | null; onDone: () => void }) {
  const { addManual, updateManual } = useAnalytics();
  const [form, setForm] = useState<RecordInput>(blank);
  const [note, setNote] = useState(SOURCE_TYPES[0]);
  const [errors, setErrors] = useState<Partial<Record<keyof RecordInput, string>>>({});
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({ activity: editing.activity, label: editing.label, count: String(editing.count), timestamp: toLocalInput(new Date(editing.timestamp)), faceCount: editing.faceCount?.toString() ?? "" });
      setNote(editing.sourceNote && SOURCE_TYPES.includes(editing.sourceNote) ? editing.sourceNote : SOURCE_TYPES[0]);
      setErrors({});
    } else setForm(blank());
  }, [editing]);

  const set = <K extends keyof RecordInput>(key: K, value: RecordInput[K]) => {
    setForm((f) => ({ ...f, [key]: value, ...(key === "activity" ? { label: "", faceCount: "" } : {}) }));
    setAdded(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateRecord(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const sourceNote = editing?.origin === "sample" ? editing.sourceNote : note;
    if (editing) {
      updateManual(editing.id, result.value, sourceNote);
      onDone();
    } else {
      addManual(result.value, note);
      setAdded(`${result.value.label}: ${result.value.count}`);
      setForm((f) => ({ ...blank(), activity: f.activity }));
    }
  };

  const err = (key: keyof RecordInput) => (errors[key] ? <p id={`err-${key}`} className="mt-1 text-xs font-medium text-red-700">{errors[key]}</p> : null);
  const bad = (key: keyof RecordInput) => (errors[key] ? { "aria-invalid": true, "aria-describedby": `err-${key}` } : {});

  return (
    <form id="manual-entry" onSubmit={submit} noValidate className="card space-y-3" aria-label={editing ? "Edit record" : "Add record"}>
      <h2 className="text-lg font-bold">{editing ? "Edit record" : "Add a record by hand"}</h2>
      {editing?.origin === "sample" && <Alert tone="warn">This is sample data. Editing keeps it labelled as sample.</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="m-activity">Activity type</label>
          <select id="m-activity" className="input" value={form.activity} onChange={(e) => set("activity", e.target.value as Activity)}>
            {(Object.keys(ACTIVITY_LABEL) as Activity[]).map((a) => <option key={a} value={a}>{ACTIVITY_LABEL[a]}{a === "face" ? " (face expression)" : a === "digit" ? " (handwritten number)" : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="m-label">{form.activity === "face" ? "Expression" : form.activity === "digit" ? "Number" : "Category / label"}</label>
          {form.activity === "face" ? (
            <select id="m-label" className="input" value={form.label} onChange={(e) => set("label", e.target.value)} {...bad("label")}>
              <option value="">Choose…</option>
              {EXPRESSIONS.map((x) => <option key={x}>{x}</option>)}
            </select>
          ) : (
            <input id="m-label" className="input" value={form.label} maxLength={40} inputMode={form.activity === "digit" ? "numeric" : "text"} placeholder={form.activity === "digit" ? "e.g. 7 or 43" : "e.g. Apple"} onChange={(e) => set("label", e.target.value)} {...bad("label")} />
          )}
          {err("label")}
        </div>
        <div>
          <label className="label" htmlFor="m-count">Count</label>
          <input id="m-count" className="input" inputMode="numeric" value={form.count} onChange={(e) => set("count", e.target.value)} placeholder="e.g. 5" {...bad("count")} />
          {err("count")}
        </div>
        {form.activity === "face" && (
          <div>
            <label className="label" htmlFor="m-faces">Faces visible (optional)</label>
            <input id="m-faces" className="input" inputMode="numeric" value={form.faceCount} onChange={(e) => set("faceCount", e.target.value)} placeholder="adds to the faces-over-time chart" {...bad("faceCount")} />
            {err("faceCount")}
          </div>
        )}
        <div>
          <label className="label" htmlFor="m-time">Date &amp; time (optional)</label>
          <input id="m-time" type="datetime-local" className="input" value={form.timestamp} onChange={(e) => set("timestamp", e.target.value)} {...bad("timestamp")} />
          {err("timestamp")}
        </div>
        <div>
          <label className="label" htmlFor="m-source">Source type (optional)</label>
          <select id="m-source" className="input" value={note} onChange={(e) => setNote(e.target.value)}>
            {SOURCE_TYPES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn-primary">{editing ? "Save changes" : "Add Record"}</button>
        {editing && <button type="button" className="btn-secondary" onClick={onDone}>Cancel</button>}
        {added && <span role="status" className="text-sm font-medium text-emerald-700">Added {added} ✓ — charts updated</span>}
      </div>
    </form>
  );
}
