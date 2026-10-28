import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../lib/format";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" aria-label={label} className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

export function Alert({ tone = "info", title, children, action }: { tone?: "info" | "error" | "warn" | "success"; title?: string; children?: ReactNode; action?: ReactNode }) {
  const styles = {
    info: "border-cyan-400/40 bg-cyan-400/10 text-navy-900",
    error: "border-red-300 bg-red-50 text-red-900",
    warn: "border-amber-300 bg-amber-50 text-amber-900",
    success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm", styles)}>
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-mist-300 bg-mist-50 px-4 py-8 text-center">
      <p className="font-semibold text-navy-800">{title}</p>
      {children && <p className="max-w-md text-sm text-navy-700">{children}</p>}
      {action}
    </div>
  );
}

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "indigo" | "cyan" | "amber" | "green" | "red" }) {
  const t = {
    gray: "bg-mist-200 text-navy-800", indigo: "bg-indigo-500/15 text-indigo-700", cyan: "bg-cyan-400/20 text-cyan-600",
    amber: "bg-amber-100 text-amber-800", green: "bg-emerald-100 text-emerald-800", red: "bg-red-100 text-red-800",
  }[tone];
  return <span className={cx("chip", t)}>{children}</span>;
}

export function ConfidenceBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.8 ? "bg-emerald-500" : value >= 0.5 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-xs font-medium text-navy-700">
        <span>{label ?? "Confidence"}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-mist-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Confidence"}>
        <div className={cx("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "indigo" | "cyan" }) {
  return (
    <div className={cx("rounded-2xl border p-4", tone === "cyan" ? "border-cyan-400/40 bg-cyan-400/10" : tone === "indigo" ? "border-indigo-500/20 bg-indigo-500/5" : "border-mist-200 bg-white")}>
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-700">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy-900 sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-navy-700">{hint}</p>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; hint?: string }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-xl bg-mist-200/70 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === value}
          onClick={() => onChange(tab.id)}
          className={cx(
            "min-h-[40px] shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition",
            tab.id === value ? "bg-white text-indigo-700 shadow-sm" : "text-navy-700 hover:text-navy-900",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  const { label, children, className, ...rest } = props;
  return (
    <button aria-label={label} title={label} className={cx("btn-secondary !px-3", className)} {...rest}>
      {children}
    </button>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-navy-700 sm:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
