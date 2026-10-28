// "Build your own chart" data: free labels and numbers typed by the user. Kept in memory for the session only.
import { useSyncExternalStore } from "react";

export type ChartType = "bar" | "line" | "pie" | "area";
export type SortMode = "entered" | "high" | "low" | "az";
export interface CustomRow { id: string; label: string; value: string }
export interface CustomState { title: string; xName: string; yName: string; rows: CustomRow[]; type: ChartType; sort: SortMode }

const uid = () => Math.random().toString(36).slice(2, 10);
const initial = (): CustomState => ({ title: "My chart", xName: "Category", yName: "Value", rows: [], type: "bar", sort: "entered" });

let state: CustomState = initial();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (patch: Partial<CustomState>) => { state = { ...state, ...patch }; emit(); };

export const customStore = {
  get: () => state,
  subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
  setMeta: (patch: Partial<Pick<CustomState, "title" | "xName" | "yName" | "type" | "sort">>) => set(patch),
  addRow: (label: string, value: string) => set({ rows: [...state.rows, { id: uid(), label, value }] }),
  updateRow: (id: string, patch: Partial<Pick<CustomRow, "label" | "value">>) => set({ rows: state.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }),
  removeRow: (id: string) => set({ rows: state.rows.filter((r) => r.id !== id) }),
  replaceRows: (rows: { label: string; value: string }[], meta: Partial<CustomState> = {}) => set({ ...meta, rows: rows.map((r) => ({ id: uid(), ...r })) }),
  clear: () => { state = initial(); emit(); },
};

export const useCustomData = (): CustomState => useSyncExternalStore(customStore.subscribe, customStore.get, customStore.get);

export interface Point { name: string; value: number }
export interface Prepared { points: Point[]; ignored: { row: number; reason: string }[]; merged: number; total: number; average: number | null; max: Point | null; min: Point | null }

/** Turns typed rows into chart points. Blank rows are skipped, bad numbers are reported, duplicate labels are added together. */
export function prepare(rows: CustomRow[], sort: SortMode): Prepared {
  const ignored: Prepared["ignored"] = [];
  const byLabel = new Map<string, number>();
  let merged = 0;
  rows.forEach((r, i) => {
    const label = r.label.replace(/\s+/g, " ").trim();
    const raw = r.value.trim().replace(/,/g, "");
    if (!label && !raw) return;
    if (!label) return void ignored.push({ row: i + 1, reason: "needs a label" });
    if (raw === "" || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(raw)) return void ignored.push({ row: i + 1, reason: `“${r.value}” is not a number` });
    const value = Number(raw);
    if (!Number.isFinite(value) || Math.abs(value) > 1e12) return void ignored.push({ row: i + 1, reason: "number is too large" });
    const key = label;
    if (byLabel.has(key)) merged += 1;
    byLabel.set(key, (byLabel.get(key) ?? 0) + value);
  });
  let points: Point[] = [...byLabel].map(([name, value]) => ({ name, value: Math.round(value * 1e6) / 1e6 }));
  if (sort === "high") points.sort((a, b) => b.value - a.value);
  else if (sort === "low") points.sort((a, b) => a.value - b.value);
  else if (sort === "az") points.sort((a, b) => a.name.localeCompare(b.name));
  const total = points.reduce((s, p) => s + p.value, 0);
  const byValue = [...points].sort((a, b) => a.value - b.value);
  return { points, ignored, merged, total, average: points.length ? total / points.length : null, max: byValue.at(-1) ?? null, min: byValue[0] ?? null };
}

/** Parses pasted text: one "label, value" (or tab / semicolon / colon separated) pair per line. */
export function parsePasted(text: string): { rows: { label: string; value: string }[]; skipped: number } {
  const rows: { label: string; value: string }[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = line.match(/^(.*?)[\t,;:]\s*([-+]?[\d.,]+)\s*$/) ?? line.match(/^(.*\S)\s+([-+]?\d[\d.,]*)\s*$/);
    if (m) rows.push({ label: m[1].replace(/^"|"$/g, "").trim(), value: m[2] }); else skipped += 1;
  }
  return { rows, skipped };
}

export const EXAMPLES: { name: string; title: string; xName: string; yName: string; rows: [string, string][] }[] = [
  { name: "Favourite subject (votes)", title: "Favourite subject", xName: "Subject", yName: "Votes", rows: [["Maths", "12"], ["Science", "18"], ["English", "9"], ["Computer", "21"], ["Art", "7"]] },
  { name: "Marks of 5 students", title: "Test marks", xName: "Student", yName: "Marks", rows: [["Anu", "78"], ["Ravi", "92"], ["Meena", "65"], ["John", "88"], ["Priya", "71"]] },
  { name: "Pocket money by week", title: "Pocket money saved", xName: "Week", yName: "Rupees", rows: [["Week 1", "50"], ["Week 2", "80"], ["Week 3", "65"], ["Week 4", "120"]] },
];
