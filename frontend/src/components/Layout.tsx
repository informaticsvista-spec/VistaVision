import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAnalytics } from "../analytics/AnalyticsProvider";
import { downloadReport, exportCsv } from "../lib/exports";
import { cx } from "../lib/format";
import { useCamera } from "../hooks/useCamera";
import { InstitutionLogos } from "./InstitutionLogos";
import { Logo } from "./Logo";
import { Badge } from "./ui";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/recognition", label: "Smart Recognition" },
  { to: "/data", label: "Data Visualization" },
  { to: "/activities", label: "Learning Activities" },
  { to: "/report", label: "Session Report" },
  { to: "/settings", label: "Settings" },
];

function SessionBar() {
  const a = useAnalytics();
  const camera = useCamera();
  const live = camera.status === "live";
  return (
    <div className="border-b border-mist-200 bg-white/90 backdrop-blur" role="region" aria-label="Session controls">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2 sm:px-6 lg:px-8">
        <span className="text-xs font-semibold text-navy-700">Session: {new Set(a.events.map((e) => e.groupId ?? e.id)).size} records</span>
        {a.paused && <Badge tone="amber">Analytics paused</Badge>}
        {live && <Badge tone="green"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Camera on</Badge>}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {live && <button className="btn-danger !min-h-[36px] !px-3" onClick={camera.stop}>Stop Camera</button>}
          <button className="btn-secondary !min-h-[36px] !px-3" aria-pressed={a.paused} onClick={() => a.setPaused(!a.paused)}>{a.paused ? "Resume analytics" : "Pause analytics"}</button>
          <button className="btn-secondary !min-h-[36px] !px-3" disabled={!a.events.length} onClick={() => exportCsv(a.events)}>Export CSV</button>
          <button className="btn-secondary !min-h-[36px] !px-3" disabled={!a.events.length} onClick={() => downloadReport(a.events, { sessionId: a.sessionId, sessionStart: a.sessionStart, feedback: a.feedback })}>Download Report</button>
          <button className="btn-ghost !min-h-[36px] !px-3 text-red-700" onClick={() => window.confirm("Reset the session? All records will be removed.") && a.reset()}>Reset Session</button>
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const home = pathname === "/";
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <header className="sticky top-0 z-40 bg-gradient-to-r from-indigo-700 via-indigo-600 to-cyan-500 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="VistaVision home" onClick={() => setOpen(false)}>
            <Logo size={38} bare />
            <span className="hidden text-lg font-extrabold tracking-tight min-[420px]:inline">Vista<span className="text-sun-300">Vision</span></span>
          </Link>
          <nav aria-label="Main" className="ml-6 hidden items-center gap-1 whitespace-nowrap xl:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx("rounded-lg px-3 py-2 text-sm font-semibold transition", isActive ? "bg-white text-indigo-700" : "text-white/90 hover:bg-white/10 hover:text-white")}>{n.label}</NavLink>
            ))}
          </nav>
          <InstitutionLogos height={26} className="ml-auto !gap-2 !px-2 !py-1 sm:!gap-3 sm:!px-3 sm:!py-1.5 [&_img]:sm:!h-[32px]" />
          <button className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg hover:bg-white/10 xl:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>{open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label="Main (mobile)" className="border-t border-white/10 px-4 pb-3 xl:hidden">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => cx("block rounded-lg px-3 py-3 text-base font-semibold", isActive ? "bg-white/15" : "text-white/80")}>{n.label}</NavLink>
            ))}
          </nav>
        )}
      </header>
      {!home && <SessionBar />}
      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center text-xs text-navy-700 sm:px-6">
        VistaVision · AI predictions can be wrong · Expression results are estimates of visible expression only · Images are never stored
      </footer>
    </div>
  );
}
