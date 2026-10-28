import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAnalytics } from "../analytics/AnalyticsProvider";
import { SERIES } from "../lib/format";
import { Stat } from "./ui";

const FRUITS = [
  { name: "Apple", color: "#e34948" },
  { name: "Banana", color: "#eda100" },
  { name: "Orange", color: "#eb6834" },
];

/** Activity 5: change the numbers and watch the bar chart, pie chart and statistics recalculate. */
export function DataDetective() {
  const { addManual } = useAnalytics();
  const [counts, setCounts] = useState<Record<string, number>>({ Apple: 5, Banana: 3, Orange: 2 });
  const [sent, setSent] = useState(false);

  const rows = useMemo(() => {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return FRUITS.map((f) => ({ ...f, count: counts[f.name], percent: total ? (counts[f.name] / total) * 100 : 0 }));
  }, [counts]);
  const total = rows.reduce((a, r) => a + r.count, 0);
  const top = [...rows].sort((a, b) => b.count - a.count)[0];

  const sendToDashboard = () => {
    const timestamp = new Date().toISOString();
    rows.forEach((r) => addManual({ activity: "object", label: r.name, count: r.count, timestamp }, "Practice activity"));
    setSent(true);
  };

  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-bold">Data Detective: change the data, watch the charts</h3>
      <p className="text-sm text-navy-700">Move the sliders. Which chart changes the most? What happens to the percentages when you add more bananas?</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {rows.map((r) => (
          <label key={r.name} className="rounded-xl border border-mist-200 p-3 text-sm font-semibold">
            <span className="flex justify-between"><span>{r.name}</span><span className="text-xl font-extrabold">{r.count}</span></span>
            <input type="range" min={0} max={20} value={r.count} className="mt-2 w-full accent-indigo-600" onChange={(e) => { setCounts((c) => ({ ...c, [r.name]: Number(e.target.value) })); setSent(false); }} aria-label={`${r.name} count`} />
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total fruit" value={total} />
        <Stat label="Most common" value={total ? top.name : "—"} hint={total ? `${top.percent.toFixed(0)}% of the total` : undefined} />
        <Stat label="Average per type" value={(total / 3).toFixed(1)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={SERIES.grid} vertical={false} />
            <XAxis dataKey="name" tickLine={false} tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} domain={[0, 20]} tickLine={false} axisLine={false} width={30} tick={{ fontSize: 12 }} label={{ value: "Count", angle: -90, position: "insideLeft", style: { fontSize: 12, textAnchor: "middle" } }} />
            <Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>{rows.map((r) => <Cell key={r.name} fill={r.color} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
        {total === 0 ? <p className="flex items-center justify-center text-sm text-navy-700">Add some fruit to see the pie chart.</p> : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={rows.filter((r) => r.count > 0)} dataKey="count" nameKey="name" innerRadius="45%" outerRadius="75%" paddingAngle={2} stroke="#fff" strokeWidth={2} isAnimationActive={false} label={(p) => `${Math.round(p.percent * 100)}%`} labelLine={false}>
                {rows.filter((r) => r.count > 0).map((r) => <Cell key={r.name} fill={r.color} />)}
              </Pie>
              <Tooltip /><Legend iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={sendToDashboard} disabled={sent || total === 0}>Send these counts to the dashboard</button>
        {sent && <span role="status" className="text-sm font-medium text-emerald-700">Sent ✓ — see them in Data Visualization (marked “Manual”).</span>}
      </div>
    </div>
  );
}
