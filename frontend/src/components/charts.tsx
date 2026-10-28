// All charts read from the same filtered VistaEvent[]; each shows an empty state instead of failing.
import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { VistaEvent } from "../types";
import {
  otherFrequency, scoreboard, confidenceHistogram, digitFrequency, expressionCounts, expressionHeatmap, expressionSeries, faceCountSeries, objectFrequency, originComparison,
} from "../analytics/aggregate";
import { colorFor, cx, SERIES, timeLabel } from "../lib/format";
import { EmptyState } from "./ui";

const AXIS = { fontSize: 12, fill: SERIES.axis };
const tooltipStyle = { borderRadius: 12, border: "1px solid #e6dcfb", fontSize: 13, boxShadow: "0 4px 14px rgba(37,16,79,.14)" };
const CHART_H = 260;

interface TableSpec {
  columns: string[];
  rows: (string | number)[][];
}

export function ChartCard({ title, subtitle, table, children, className }: { title: string; subtitle?: ReactNode; table?: TableSpec; children: ReactNode; className?: string }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={cx("card flex flex-col", className)} aria-label={title}>
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-navy-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-navy-700">{subtitle}</p>}
        </div>
        {table && table.rows.length > 0 && (
          <button className="btn-ghost !min-h-[32px] !px-2 !py-1 text-xs" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
            {asTable ? "Show chart" : "View as table"}
          </button>
        )}
      </header>
      {asTable && table ? (
        <div className="max-h-[260px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr>{table.columns.map((c) => <th key={c} className="border-b border-mist-200 px-2 py-1.5 text-xs font-semibold uppercase text-navy-700">{c}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i}>{row.map((cell, j) => <td key={j} className="border-b border-mist-100 px-2 py-1.5">{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

const Empty = ({ what }: { what: string }) => <EmptyState title="No data yet">{what}</EmptyState>;

export function ExpressionBarChart({ events }: { events: VistaEvent[] }) {
  const rows = expressionCounts(events);
  return (
    <ChartCard
      title="Expressions observed"
      subtitle="Count of expression observations (not people)."
      table={{ columns: ["Expression", "Observations", "Share"], rows: rows.map((r) => [r.name, r.count, `${r.percent.toFixed(1)}%`]) }}
    >
      {!rows.length ? <Empty what="Run the Face Expression tool, add manual expression records, or load the sample dataset." /> : (
        <ResponsiveContainer width="100%" height={CHART_H}>
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={SERIES.grid} vertical={false} />
            <XAxis dataKey="name" tick={AXIS} interval={0} tickLine={false} axisLine={{ stroke: SERIES.grid }} />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={36} label={{ value: "Observations", angle: -90, position: "insideLeft", style: { ...AXIS, textAnchor: "middle" } }} />
            <Tooltip cursor={{ fill: "rgba(42,120,214,.08)" }} contentStyle={tooltipStyle} formatter={(v: number, _n, item) => [`${v} (${(item.payload as { percent: number }).percent.toFixed(1)}%)`, "Observations"]} />
            <Bar isAnimationActive={false} dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={44}>
              {rows.map((r) => <Cell key={r.name} fill={colorFor(r.name)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function ExpressionDonut({ events }: { events: VistaEvent[] }) {
  const rows = expressionCounts(events);
  return (
    <ChartCard
      title="Expression share"
      subtitle="Share of all expression observations. One person can add many observations."
      table={{ columns: ["Expression", "Observations", "Share"], rows: rows.map((r) => [r.name, r.count, `${r.percent.toFixed(1)}%`]) }}
    >
      {!rows.length ? <Empty what="Expression percentages appear once expression data exists." /> : (
        <ResponsiveContainer width="100%" height={CHART_H}>
          <PieChart>
            <Pie data={rows} dataKey="count" nameKey="name" innerRadius="48%" outerRadius="78%" paddingAngle={2} stroke="#fff" strokeWidth={2} label={(p) => (p.percent >= 0.06 ? `${Math.round(p.percent * 100)}%` : "")} labelLine={false} isAnimationActive={false}>
              {rows.map((r) => <Cell key={r.name} fill={colorFor(r.name)} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string, item) => [`${v} observations (${(item.payload as { percent: number }).percent.toFixed(1)}%)`, name]} />
            <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function FaceCountLine({ events }: { events: VistaEvent[] }) {
  const series = faceCountSeries(events);
  return (
    <ChartCard
      title="Faces visible over time"
      subtitle="Faces in view at each snapshot (not a running total)."
      table={{ columns: ["Time", "Faces visible"], rows: series.map((p) => [timeLabel(p.t), p.faceCount]) }}
    >
      {series.length < 1 ? <Empty what="Face snapshots appear here while the face tool is running." /> : (
        <ResponsiveContainer width="100%" height={CHART_H}>
          <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={SERIES.grid} vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={timeLabel} tick={AXIS} tickLine={false} axisLine={{ stroke: SERIES.grid }} minTickGap={40} />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={36} domain={[0, (m: number) => Math.max(2, m)]} label={{ value: "Faces", angle: -90, position: "insideLeft", style: { ...AXIS, textAnchor: "middle" } }} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => timeLabel(Number(t))} formatter={(v: number) => [v, "Faces visible"]} />
            <Line type="stepAfter" dataKey="faceCount" stroke={SERIES.primary} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: SERIES.primary }} activeDot={{ r: 6 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function ExpressionLine({ events }: { events: VistaEvent[] }) {
  const { rows, labels, bucketMs } = expressionSeries(events);
  const bucketText = bucketMs >= 60000 ? `${bucketMs / 60000} min` : `${bucketMs / 1000} s`;
  return (
    <ChartCard
      title="Expression observations over time"
      subtitle={`Observations per ${bucketText} interval.`}
      table={{ columns: ["Time", ...labels], rows: rows.map((r) => [timeLabel(r.t), ...labels.map((l) => r[l])]) }}
    >
      {rows.length < 1 ? <Empty what="Expression trends appear after expression data has been recorded." /> : (
        <ResponsiveContainer width="100%" height={CHART_H}>
          <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={SERIES.grid} vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={timeLabel} tick={AXIS} tickLine={false} axisLine={{ stroke: SERIES.grid }} minTickGap={40} />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={36} label={{ value: "Observations", angle: -90, position: "insideLeft", style: { ...AXIS, textAnchor: "middle" } }} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => timeLabel(Number(t))} />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
            {labels.map((l) => <Line key={l} type="monotone" dataKey={l} stroke={colorFor(l)} strokeWidth={2} dot={{ r: 3, stroke: "#fff", strokeWidth: 1.5, fill: colorFor(l) }} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function DigitBar({ events }: { events: VistaEvent[] }) {
  const rows = digitFrequency(events);
  const any = rows.some((r) => r.count > 0);
  return (
    <ChartCard title="Predicted digit frequency" subtitle="How often each digit 0–9 was predicted (multi-digit numbers count each digit)." table={{ columns: ["Digit", "Count"], rows: rows.map((r) => [r.digit, r.count]) }}>
      {!any ? <Empty what="Draw or write digits in Number Recognition to fill this chart." /> : (
        <ResponsiveContainer width="100%" height={CHART_H}>
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={SERIES.grid} vertical={false} />
            <XAxis dataKey="digit" tick={AXIS} tickLine={false} axisLine={{ stroke: SERIES.grid }} label={{ value: "Predicted digit", position: "insideBottom", offset: -2, style: AXIS }} height={40} />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={36} label={{ value: "Count", angle: -90, position: "insideLeft", style: { ...AXIS, textAnchor: "middle" } }} />
            <Tooltip cursor={{ fill: "rgba(42,120,214,.08)" }} contentStyle={tooltipStyle} formatter={(v: number) => [v, "Predictions"]} labelFormatter={(d) => `Digit ${d}`} />
            <Bar isAnimationActive={false} dataKey="count" fill={SERIES.primary} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function ObjectBar({ events }: { events: VistaEvent[] }) {
  const rows = objectFrequency(events).slice(0, 12);
  return (
    <ChartCard title="Objects recognised" subtitle="Detections (or typed-in counts) per object category." table={{ columns: ["Object", "Count"], rows: rows.map((r) => [r.name, r.count]) }}>
      {!rows.length ? <Empty what="Show an apple or banana to the Object tool, or add records manually." /> : (
        <ResponsiveContainer width="100%" height={CHART_H}>
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={SERIES.grid} vertical={false} />
            <XAxis dataKey="name" tick={AXIS} interval={0} tickLine={false} axisLine={{ stroke: SERIES.grid }} />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={36} label={{ value: "Count", angle: -90, position: "insideLeft", style: { ...AXIS, textAnchor: "middle" } }} />
            <Tooltip cursor={{ fill: "rgba(42,120,214,.08)" }} contentStyle={tooltipStyle} formatter={(v: number) => [v, "Count"]} />
            <Bar isAnimationActive={false} dataKey="count" fill={SERIES.primary} radius={[4, 4, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function OtherBar({ events }: { events: VistaEvent[] }) {
  const rows = otherFrequency(events).slice(0, 12);
  if (!rows.length) return null; // only appears once someone has typed an "Other" category
  return (
    <ChartCard title="Your own categories" subtitle="Records added by hand with the activity type “Other”." table={{ columns: ["Category", "Count"], rows: rows.map((r) => [r.name, r.count]) }}>
      <ResponsiveContainer width="100%" height={CHART_H}>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={SERIES.grid} vertical={false} />
          <XAxis dataKey="name" tick={AXIS} interval={0} tickLine={false} axisLine={{ stroke: SERIES.grid }} />
          <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={36} />
          <Tooltip cursor={{ fill: "rgba(42,120,214,.08)" }} contentStyle={tooltipStyle} formatter={(v: number) => [v, "Count"]} />
          <Bar isAnimationActive={false} dataKey="count" fill="#eb6834" radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ConfidenceChart({ events }: { events: VistaEvent[] }) {
  const bins = confidenceHistogram(events);
  return (
    <ChartCard title="Confidence distribution" subtitle="How sure the AI was. Confidence is not the same as being correct." table={bins ? { columns: ["Confidence", "Predictions"], rows: bins.map((b) => [b.bin, b.count]) } : undefined}>
      {!bins ? <Empty what="Needs at least 5 AI predictions that include a confidence score." /> : (
        <ResponsiveContainer width="100%" height={CHART_H}>
          <BarChart data={bins} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={SERIES.grid} vertical={false} />
            <XAxis dataKey="bin" tick={{ ...AXIS, fontSize: 10 }} interval={0} tickLine={false} axisLine={{ stroke: SERIES.grid }} label={{ value: "Model confidence", position: "insideBottom", offset: -2, style: AXIS }} height={42} />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={36} label={{ value: "Predictions", angle: -90, position: "insideLeft", style: { ...AXIS, textAnchor: "middle" } }} />
            <Tooltip cursor={{ fill: "rgba(42,120,214,.08)" }} contentStyle={tooltipStyle} formatter={(v: number) => [v, "Predictions"]} />
            <Bar isAnimationActive={false} dataKey="count" fill={SERIES.primary} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function ComparisonChart({ events }: { events: VistaEvent[] }) {
  const rows = originComparison(events);
  return (
    <ChartCard
      title="AI-generated vs manual vs sample"
      subtitle="Observations by data origin, so typed-in and sample data are never mistaken for AI output."
      table={{ columns: ["Activity", "AI-generated", "Manual", "Sample"], rows: rows.map((r) => [r.activity, r.ai, r.manual, r.sample]) }}
    >
      {!rows.length ? <Empty what="Add manual records and run an AI tool to compare them here." /> : (
        <ResponsiveContainer width="100%" height={CHART_H}>
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={SERIES.grid} vertical={false} />
            <XAxis dataKey="activity" tick={AXIS} tickLine={false} axisLine={{ stroke: SERIES.grid }} />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={36} label={{ value: "Observations", angle: -90, position: "insideLeft", style: { ...AXIS, textAnchor: "middle" } }} />
            <Tooltip cursor={{ fill: "rgba(42,120,214,.08)" }} contentStyle={tooltipStyle} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
            <Bar isAnimationActive={false} dataKey="ai" name="AI-generated" fill={SERIES.ai} radius={[4, 4, 0, 0]} maxBarSize={30} />
            <Bar isAnimationActive={false} dataKey="manual" name="Manual" fill={SERIES.manual} radius={[4, 4, 0, 0]} maxBarSize={30} />
            <Bar isAnimationActive={false} dataKey="sample" name="Sample" fill={SERIES.sample} radius={[4, 4, 0, 0]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function HeatmapChart({ events }: { events: VistaEvent[] }) {
  const heat = expressionHeatmap(events);
  return (
    <ChartCard
      title="Expression heatmap over time"
      subtitle="Darker cells = more observations in that time interval."
      className="lg:col-span-2"
      table={heat ? { columns: ["Expression", ...heat.columns.map(timeLabel)], rows: heat.rows.map((r) => [r.label, ...r.values]) } : undefined}
    >
      {!heat ? <Empty what="Needs expression data spread over at least two time intervals (about 6 observations)." /> : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[420px] gap-[3px]" style={{ gridTemplateColumns: `92px repeat(${heat.columns.length}, minmax(26px, 1fr))` }} role="table" aria-label="Expression heatmap">
            <div />
            {heat.columns.map((t) => <div key={t} className="truncate text-center text-[10px] text-navy-700">{timeLabel(t).replace(/:\d\d(?!.*:)/, (m) => m)}</div>)}
            {heat.rows.map((row) => (
              <HeatRow key={row.label} label={row.label} values={row.values} max={heat.max} />
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function HeatRow({ label, values, max }: { label: string; values: number[]; max: number }) {
  return (
    <>
      <div className="flex items-center text-xs font-semibold text-navy-800">{label}</div>
      {values.map((v, i) => {
        const alpha = v === 0 ? 0 : 0.18 + 0.82 * (v / max);
        return (
          <div key={i} title={`${label}: ${v}`} className="flex h-8 items-center justify-center rounded text-[11px] font-semibold" style={{ background: v === 0 ? "#f3edff" : `rgba(42,120,214,${alpha})`, color: alpha > 0.55 ? "#fff" : "#25104f" }}>
            {v || ""}
          </div>
        );
      })}
    </>
  );
}

/** "Human vs AI": how often the AI was right, according to the people who checked it. */
export function ScoreboardChart({ feedback }: { feedback: import("../types").Feedback[] }) {
  const board = scoreboard(feedback);
  const rows = board.rows.filter((r) => r.checked > 0);
  return (
    <ChartCard
      title="Human vs AI scoreboard"
      subtitle="Share of checked predictions the AI got right. Only results someone confirmed or corrected are counted."
      table={{ columns: ["Tool", "Checked", "AI right", "Accuracy"], rows: board.rows.map((r) => [r.name, r.checked, r.correct, r.checked ? `${r.percent.toFixed(0)}%` : "—"]) }}
    >
      {board.checked === 0 ? (
        <Empty what="Use a recognition tool and press “Yes” or “No” under a result. Your checks build this scoreboard." />
      ) : (
        <div>
          <p className="mb-2 text-3xl font-extrabold text-indigo-700">{board.percent?.toFixed(0)}% <span className="text-base font-semibold text-navy-700">right · {board.correct} of {board.checked} checked</span></p>
          <ResponsiveContainer width="100%" height={CHART_H - 50}>
            <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid vertical={false} stroke={SERIES.grid} />
              <XAxis dataKey="name" tick={AXIS} />
              <YAxis domain={[0, 100]} unit="%" tick={AXIS} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, _n, p) => [`${v.toFixed(0)}% (${p.payload.correct}/${p.payload.checked})`, "AI right"]} />
              <Bar dataKey="percent" fill={SERIES.primary} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          {board.mixups.length > 0 && (
            <div className="mt-3">
              <p className="label">Biggest mix-ups (AI said → really was)</p>
              <ul className="space-y-1 text-sm">
                {board.mixups.slice(0, 4).map((m) => <li key={`${m.predicted}-${m.actual}`}>“{m.predicted}” → “{m.actual}” <span className="text-navy-700">× {m.count}</span></li>)}
              </ul>
            </div>
          )}
          {board.avgConfidenceRight !== null && board.avgConfidenceWrong !== null && (
            <p className="mt-2 text-xs text-navy-700">Average confidence when right: {Math.round(board.avgConfidenceRight * 100)}% · when wrong: {Math.round(board.avgConfidenceWrong * 100)}%. High confidence does not guarantee a correct answer.</p>
          )}
        </div>
      )}
    </ChartCard>
  );
}
