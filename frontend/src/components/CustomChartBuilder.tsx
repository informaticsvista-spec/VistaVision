import { useRef, useState, type FormEvent } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { customStore, EXAMPLES, parsePasted, prepare, useCustomData, type ChartType, type SortMode } from "../lib/customData";
import { downloadText } from "../analytics/csv";
import { cx, SERIES } from "../lib/format";
import { ChartCard } from "./charts";
import { Alert, EmptyState } from "./ui";

const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#6250d6", "#e87ba4", "#e34948", "#6b7a99"];
const AXIS = { fontSize: 12, fill: SERIES.axis };
const tooltipStyle = { borderRadius: 12, border: "1px solid #e6dcfb", fontSize: 13 };
const TYPES: { id: ChartType; label: string; icon: string }[] = [{ id: "bar", label: "Bar", icon: "📊" }, { id: "line", label: "Line", icon: "📈" }, { id: "pie", label: "Pie", icon: "🥧" }, { id: "area", label: "Area", icon: "🏔️" }];
const csvSafe = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

/** Type your own labels and numbers, see the chart straight away. No camera, no AI, no setup. */
export function CustomChartBuilder() {
  const s = useCustomData();
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const data = prepare(s.rows, s.sort);
  const { points } = data;
  const negative = points.some((p) => p.value < 0);

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return setErr("Type a name first (for example Apple or Maths).");
    if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(value.trim().replace(/,/g, ""))) return setErr("Type the value as a number, for example 12 or 7.5.");
    customStore.addRow(label.trim(), value.trim());
    setLabel(""); setValue(""); setErr(null); setNote(null);
    labelRef.current?.focus();
  };

  const importPaste = () => {
    const { rows, skipped } = parsePasted(paste);
    if (!rows.length) return setNote("I could not find any “name, number” lines. Put one pair on each line, like  Maths, 12");
    customStore.replaceRows([...s.rows.filter((r) => r.label || r.value), ...rows].map((r) => ({ label: r.label, value: r.value })));
    setPaste(""); setShowPaste(false);
    setNote(`Added ${rows.length} row${rows.length === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} line${skipped === 1 ? "" : "s"} I could not read` : ""}.`);
  };

  const exportCsv = () =>
    downloadText("my-chart-data.csv", `${csvSafe(s.xName)},${csvSafe(s.yName)}\n${points.map((p) => `"${csvSafe(p.name).replace(/"/g, '""')}",${p.value}`).join("\n")}\n`, "text/csv");

  const chart = (() => {
    if (!points.length) return <EmptyState title="Your chart will appear here">Type a name and a number on the left, then press <b>Add</b>. Or press <b>Try an example</b>.</EmptyState>;
    if (s.type === "pie") {
      if (negative) return <Alert tone="warn" title="Pie charts need positive numbers">Choose Bar or Line to show negative numbers.</Alert>;
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={points.filter((p) => p.value > 0)} dataKey="value" nameKey="name" innerRadius={55} outerRadius={105} paddingAngle={2} isAnimationActive={false} label={(e) => `${Math.round((e.value / data.total) * 100)}%`}>
              {points.filter((p) => p.value > 0).map((p, i) => <Cell key={p.name} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth={2} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, s.yName]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    const common = { data: points, margin: { top: 10, right: 12, bottom: 24, left: 0 } };
    const axes = (
      <>
        <CartesianGrid vertical={false} stroke={SERIES.grid} />
        <XAxis dataKey="name" tick={AXIS} interval={0} angle={points.length > 4 ? -30 : 0} textAnchor={points.length > 4 ? "end" : "middle"} height={points.length > 4 ? 60 : 30} label={{ value: s.xName, position: "insideBottom", offset: -16, fontSize: 12, fill: SERIES.axis }} />
        <YAxis tick={AXIS} label={{ value: s.yName, angle: -90, position: "insideLeft", fontSize: 12, fill: SERIES.axis }} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, s.yName]} />
      </>
    );
    return (
      <ResponsiveContainer width="100%" height={320}>
        {s.type === "bar" ? (
          <BarChart {...common}>{axes}<Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64} isAnimationActive={false}>{points.map((p, i) => <Cell key={p.name} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart>
        ) : s.type === "line" ? (
          <LineChart {...common}>{axes}<Line dataKey="value" stroke={COLORS[0]} strokeWidth={3} dot={{ r: 5, strokeWidth: 2, fill: "#fff" }} isAnimationActive={false} /></LineChart>
        ) : (
          <AreaChart {...common}>{axes}<Area dataKey="value" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.2} strokeWidth={3} isAnimationActive={false} /></AreaChart>
        )}
      </ResponsiveContainer>
    );
  })();

  return (
    <section aria-labelledby="own-h" className="card border-indigo-300 bg-gradient-to-br from-white to-indigo-50">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="own-h" className="text-xl font-extrabold">✏️ Build your own chart</h2>
          <p className="text-sm text-navy-700">Type any names and numbers, for example marks, votes or fruits. The chart updates as you type. No camera needed.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Try an example" className="input !min-h-[40px] !w-auto" value="" onChange={(e) => { const ex = EXAMPLES[Number(e.target.value)]; if (ex) { customStore.replaceRows(ex.rows.map(([l, v]) => ({ label: l, value: v })), { title: ex.title, xName: ex.xName, yName: ex.yName }); setNote(null); } }}>
            <option value="">💡 Try an example…</option>
            {EXAMPLES.map((ex, i) => <option key={ex.name} value={i}>{ex.name}</option>)}
          </select>
          <button className="btn-secondary !min-h-[40px]" disabled={!s.rows.length} onClick={() => window.confirm("Remove all rows?") && (customStore.clear(), setNote(null))}>Clear</button>
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="space-y-4">
          <form onSubmit={add} noValidate className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-mist-200" aria-label="Add a value">
            <p className="label">1. Add a value</p>
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <div>
                <label className="sr-only" htmlFor="c-label">Name</label>
                <input ref={labelRef} id="c-label" className="input" placeholder="Name (e.g. Maths)" maxLength={40} value={label} onChange={(e) => { setLabel(e.target.value); setErr(null); }} />
              </div>
              <div>
                <label className="sr-only" htmlFor="c-value">Number</label>
                <input id="c-value" className="input" inputMode="decimal" placeholder="Number" value={value} onChange={(e) => { setValue(e.target.value); setErr(null); }} />
              </div>
            </div>
            {err && <p role="alert" className="mt-2 text-sm font-medium text-red-700">{err}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="submit" className="btn-primary">➕ Add</button>
              <button type="button" className="btn-ghost !min-h-[40px] text-sm" onClick={() => setShowPaste((v) => !v)} aria-expanded={showPaste}>📋 Paste many at once</button>
            </div>
            {showPaste && (
              <div className="mt-2 space-y-2">
                <label htmlFor="c-paste" className="text-xs text-navy-700">One per line, like <code>Maths, 12</code> (you can paste from Excel or Word too).</label>
                <textarea id="c-paste" className="input min-h-[110px] font-mono" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Maths, 12\nScience, 18\nEnglish, 9"} />
                <button type="button" className="btn-cyan !min-h-[40px]" disabled={!paste.trim()} onClick={importPaste}>Add these rows</button>
              </div>
            )}
            {note && <p role="status" className="mt-2 text-sm text-navy-800">{note}</p>}
          </form>

          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-mist-200">
            <p className="label">2. Your values ({s.rows.length}) <span className="normal-case text-navy-700">— click a cell to change it</span></p>
            {s.rows.length === 0 ? (
              <p className="py-3 text-sm text-navy-700">Nothing yet. Add your first value above.</p>
            ) : (
              <ul className="max-h-64 space-y-1.5 overflow-auto pr-1">
                {s.rows.map((r, i) => {
                  const bad = data.ignored.find((x) => x.row === i + 1);
                  return (
                    <li key={r.id} className="grid grid-cols-[1fr_88px_40px] items-center gap-1.5">
                      <input aria-label={`Name of row ${i + 1}`} className={cx("input !min-h-[40px] !py-1", bad && !r.label.trim() && "!border-red-400")} value={r.label} maxLength={40} onChange={(e) => customStore.updateRow(r.id, { label: e.target.value })} />
                      <input aria-label={`Number of row ${i + 1}`} inputMode="decimal" className={cx("input !min-h-[40px] !py-1", bad && r.label.trim() && "!border-red-400")} value={r.value} onChange={(e) => customStore.updateRow(r.id, { value: e.target.value })} />
                      <button className="btn-ghost !min-h-[40px] !px-0 text-red-700" aria-label={`Delete row ${i + 1}`} onClick={() => customStore.removeRow(r.id)}>🗑️</button>
                    </li>
                  );
                })}
              </ul>
            )}
            {data.ignored.length > 0 && <p role="alert" className="mt-2 text-xs font-medium text-red-700">Not shown in the chart: {data.ignored.map((x) => `row ${x.row} ${x.reason}`).join("; ")}.</p>}
            {data.merged > 0 && <p className="mt-2 text-xs text-navy-700">Rows with the same name were added together ({data.merged}).</p>}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-mist-200">
            <p className="label">3. Choose how to show it</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Chart type">
              {TYPES.map((t) => (
                <button key={t.id} aria-pressed={s.type === t.id} onClick={() => customStore.setMeta({ type: t.id })} className={cx("btn !min-h-[40px] border-2", s.type === t.id ? "border-indigo-600 bg-indigo-600 text-white" : "border-mist-300 bg-white text-navy-900 hover:bg-mist-100")}>{t.icon} {t.label}</button>
              ))}
              <label className="ml-auto flex items-center gap-2 text-sm font-semibold">Order
                <select className="input !min-h-[40px] !w-auto" value={s.sort} onChange={(e) => customStore.setMeta({ sort: e.target.value as SortMode })}>
                  <option value="entered">As typed</option><option value="high">Highest first</option><option value="low">Lowest first</option><option value="az">A → Z</option>
                </select>
              </label>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="text-xs font-semibold text-navy-700">Chart title<input className="input mt-1" value={s.title} maxLength={60} onChange={(e) => customStore.setMeta({ title: e.target.value })} /></label>
              <label className="text-xs font-semibold text-navy-700">Names are called<input className="input mt-1" value={s.xName} maxLength={30} onChange={(e) => customStore.setMeta({ xName: e.target.value })} /></label>
              <label className="text-xs font-semibold text-navy-700">Numbers are called<input className="input mt-1" value={s.yName} maxLength={30} onChange={(e) => customStore.setMeta({ yName: e.target.value })} /></label>
            </div>
          </div>

          <ChartCard
            title={s.title || "My chart"}
            subtitle={points.length ? `${points.length} value${points.length === 1 ? "" : "s"} · total ${Math.round(data.total * 100) / 100}` : undefined}
            table={{ columns: [s.xName, s.yName], rows: points.map((p) => [p.name, p.value]) }}
          >
            {chart}
          </ChartCard>

          {points.length > 0 && (
            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4" aria-label="Quick facts">
              {[["Total", data.total], ["Average", data.average], ["Biggest", data.max ? `${data.max.name} (${data.max.value})` : "—"], ["Smallest", data.min ? `${data.min.name} (${data.min.value})` : "—"]].map(([k, v]) => (
                <div key={String(k)} className="rounded-xl bg-white p-2 ring-1 ring-mist-200"><p className="text-[11px] font-semibold uppercase text-navy-700">{k}</p><p className="truncate text-base font-extrabold text-indigo-700">{typeof v === "number" ? Math.round(v * 100) / 100 : v}</p></div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" disabled={!points.length} onClick={exportCsv}>⬇️ Download my data (CSV)</button>
          </div>
        </div>
      </div>
    </section>
  );
}
