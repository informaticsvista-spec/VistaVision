import type { Filters } from "../analytics/aggregate";
import { ACTIVITY_LABEL, ORIGIN_LABEL, SOURCE_LABEL } from "../analytics/events";
import type { Activity, InputSource, Origin } from "../types";

export function FilterBar({ filters, onChange, categories }: { filters: Filters; onChange: (f: Filters) => void; categories: string[] }) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const active = Object.values(filters).some((v) => v && v !== "all");
  return (
    <div className="card" role="group" aria-label="Filters">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div><label className="label" htmlFor="f-from">From</label><input id="f-from" type="date" className="input" value={filters.from ?? ""} onChange={(e) => set({ from: e.target.value })} /></div>
        <div><label className="label" htmlFor="f-to">To</label><input id="f-to" type="date" className="input" value={filters.to ?? ""} onChange={(e) => set({ to: e.target.value })} /></div>
        <div>
          <label className="label" htmlFor="f-origin">Data origin</label>
          <select id="f-origin" className="input" value={filters.origin ?? "all"} onChange={(e) => set({ origin: e.target.value as Origin | "all" })}>
            <option value="all">All</option>{(Object.keys(ORIGIN_LABEL) as Origin[]).map((o) => <option key={o} value={o}>{ORIGIN_LABEL[o]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-source">Input source</label>
          <select id="f-source" className="input" value={filters.source ?? "all"} onChange={(e) => set({ source: e.target.value as InputSource | "all" })}>
            <option value="all">All</option>{(Object.keys(SOURCE_LABEL) as InputSource[]).map((o) => <option key={o} value={o}>{SOURCE_LABEL[o]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-activity">Activity</label>
          <select id="f-activity" className="input" value={filters.activity ?? "all"} onChange={(e) => set({ activity: e.target.value as Activity | "all" })}>
            <option value="all">All</option>{(Object.keys(ACTIVITY_LABEL) as Activity[]).map((o) => <option key={o} value={o}>{ACTIVITY_LABEL[o]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-cat">Category</label>
          <select id="f-cat" className="input" value={filters.category ?? ""} onChange={(e) => set({ category: e.target.value })}>
            <option value="">All</option>{categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      {active && <button className="btn-ghost mt-2 !min-h-[36px] text-indigo-700" onClick={() => onChange({})}>Clear filters</button>}
    </div>
  );
}

export function describeFilters(f: Filters): string {
  const parts: string[] = [];
  if (f.from) parts.push(`from ${f.from}`);
  if (f.to) parts.push(`to ${f.to}`);
  if (f.origin && f.origin !== "all") parts.push(`origin: ${ORIGIN_LABEL[f.origin]}`);
  if (f.source && f.source !== "all") parts.push(`source: ${SOURCE_LABEL[f.source]}`);
  if (f.activity && f.activity !== "all") parts.push(`activity: ${ACTIVITY_LABEL[f.activity]}`);
  if (f.category) parts.push(`category: ${f.category}`);
  return parts.join(", ");
}
