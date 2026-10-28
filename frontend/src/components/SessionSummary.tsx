import type { VistaEvent } from "../types";
import { summarize } from "../analytics/aggregate";
import { percent } from "../lib/format";
import { EmptyState } from "./ui";

export function SessionSummary({ events }: { events: VistaEvent[] }) {
  const s = summarize(events);
  if (!s.records) return <EmptyState title="Nothing to summarise yet">Record some predictions or add data and the summary appears here.</EmptyState>;
  const rows: [string, string][] = [
    ["Records", `${s.records} (AI ${s.byOrigin.ai} · manual ${s.byOrigin.manual} · sample ${s.byOrigin.sample})`],
    ["Time span", s.firstAt && s.lastAt ? `${new Date(s.firstAt).toLocaleString()} → ${new Date(s.lastAt).toLocaleTimeString()}` : "—"],
    ["Average AI confidence", percent(s.averageConfidence, 1)],
    ["Face snapshots", `${s.faceSnapshots} · most faces at once ${s.maxFacesAtOnce} · average ${s.averageFacesPerSnapshot?.toFixed(1) ?? "—"} per snapshot`],
    ["Tracker IDs used (temporary)", String(s.trackedFaces)],
    ["Most frequent expression", s.topExpression ? `${s.topExpression.name} (${s.topExpression.count} observations, ${s.topExpression.percent.toFixed(0)}%)` : "—"],
    ["Most frequent object", s.topObject ? `${s.topObject.name} (${s.topObject.count})` : "—"],
    ["Most frequent digit", s.topDigit ? `${s.topDigit.digit} (${s.topDigit.count})` : "—"],
    ["Digit attempts", String(s.digitAttempts)],
  ];
  return (
    <dl className="divide-y divide-mist-100 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="grid gap-1 py-2 sm:grid-cols-[220px_1fr]">
          <dt className="font-semibold text-navy-700">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
