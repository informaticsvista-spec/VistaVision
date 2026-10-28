import { useState } from "react";
import type { VistaEvent } from "../types";
import { historyRows } from "../analytics/aggregate";
import { ACTIVITY_LABEL, ORIGIN_LABEL, SOURCE_LABEL } from "../analytics/events";
import { percent } from "../lib/format";
import { Badge, EmptyState } from "./ui";

const tone = { ai: "indigo", manual: "amber", sample: "gray" } as const;

export function HistoryTable({ events, onEdit, onDelete }: { events: VistaEvent[]; onEdit?: (id: string) => void; onDelete?: (id: string) => void }) {
  const [limit, setLimit] = useState(12);
  const rows = historyRows(events);
  if (!rows.length) return <EmptyState title="No records yet">Predictions and typed-in records will be listed here with their time, source and confidence.</EmptyState>;
  const editable = new Map(events.map((e) => [e.id, e.origin !== "ai"]));
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-mist-200">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Prediction and record history, newest first</caption>
          <thead className="bg-mist-100 text-xs uppercase text-navy-700">
            <tr>{["Time", "Origin", "Source", "Type", "Result", "Count", "Confidence", ""].map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((r) => (
              <tr key={r.id} className="border-t border-mist-100">
                <td className="whitespace-nowrap px-3 py-2">{new Date(r.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                <td className="px-3 py-2"><Badge tone={tone[r.origin]}>{ORIGIN_LABEL[r.origin]}</Badge></td>
                <td className="px-3 py-2">{SOURCE_LABEL[r.source]}</td>
                <td className="px-3 py-2">{ACTIVITY_LABEL[r.activity]}</td>
                <td className="px-3 py-2 font-semibold">{r.prediction}</td>
                <td className="px-3 py-2">{r.count}</td>
                <td className="px-3 py-2">{percent(r.confidence)}</td>
                <td className="whitespace-nowrap px-3 py-1 text-right">
                  {onEdit && editable.get(r.id) && <button className="btn-ghost !min-h-[36px] !px-2 text-indigo-700" onClick={() => onEdit(r.id)} aria-label={`Edit ${r.prediction}`}>Edit</button>}
                  {onDelete && <button className="btn-ghost !min-h-[36px] !px-2 text-red-700" onClick={() => onDelete(r.id)} aria-label={`Delete ${r.prediction}`}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && <button className="btn-secondary mt-3" onClick={() => setLimit((l) => l + 20)}>Show more ({rows.length - limit} left)</button>}
    </div>
  );
}
