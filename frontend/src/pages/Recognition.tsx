import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Alert, PageHeader } from "../components/ui";
import { useBackendHealth } from "../hooks/useBackendHealth";
import { cameraService } from "../services/camera";
import { cx } from "../lib/format";

const TOOLS = [
  { to: "/recognition/faces", icon: "😀", title: "Face Expressions", text: "Find every face in the camera view and estimate each visible expression.", needsCamera: true },
  { to: "/recognition/numbers", icon: "🔢", title: "Handwritten Numbers", text: "Write on paper for the camera, or draw with a finger on the screen.", needsCamera: false },
  { to: "/recognition/objects", icon: "🍎", title: "Object Recognition", text: "Show an apple, banana, cup or another everyday object to the camera.", needsCamera: true },
  { to: "/recognition/upload", icon: "🖼️", title: "Image Upload", text: "Analyse a saved photo for faces, objects or handwritten digits.", needsCamera: false },
];

export function RecognitionHub() {
  return (
    <div>
      <PageHeader title="Smart Recognition" subtitle="Pick a tool. The camera tools share one camera, and only the tool you choose runs its AI model." />
      <div className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <Link key={t.to} to={t.to} className="card group transition hover:-translate-y-0.5 hover:border-indigo-500/40 hover:shadow-md">
            <p className="text-3xl" aria-hidden>{t.icon}</p>
            <h2 className="mt-2 text-lg font-bold group-hover:text-indigo-700">{t.title}</h2>
            <p className="mt-1 text-sm text-navy-700">{t.text}</p>
            <p className="mt-2 text-xs font-semibold text-cyan-600">{t.needsCamera ? "Uses the camera" : "Works without a camera (camera optional)"}</p>
          </Link>
        ))}
        <div className="card border-dashed bg-mist-50">
          <p className="text-3xl" aria-hidden>🧩</p>
          <h2 className="mt-2 text-lg font-bold">Future modules</h2>
          <p className="mt-1 text-sm text-navy-700">New recognition tasks (for example colour, pose or sign recognition) plug into the same camera service and analytics. Nothing is running here yet.</p>
        </div>
      </div>
    </div>
  );
}

export default function Recognition() {
  const location = useLocation();
  const isHub = location.pathname.replace(/\/$/, "") === "/recognition";
  const { state, recheck } = useBackendHealth();

  // Leaving Smart Recognition releases the camera completely.
  useEffect(() => () => cameraService.stop(), []);

  return (
    <div>
      {!isHub && (
        <nav aria-label="Recognition tools" className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-mist-200/70 p-1">
          {TOOLS.map((t) => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => cx("min-h-[40px] shrink-0 rounded-lg px-3 py-2 text-sm font-semibold", isActive ? "bg-white text-indigo-700 shadow-sm" : "text-navy-700 hover:text-navy-900")}>
              <span aria-hidden>{t.icon}</span> {t.title}
            </NavLink>
          ))}
        </nav>
      )}
      {state.status === "offline" && (
        <div className="mb-4"><Alert tone="error" title="The AI server is not reachable" action={<button className="btn-secondary" onClick={recheck}>Check again</button>}>{state.message} Charts and manual data entry still work.</Alert></div>
      )}
      {state.status === "online" && state.health.status === "degraded" && (
        <div className="mb-4"><Alert tone="warn" title="Some AI models are not installed on the server">Run <code>python -m app.models.download</code> in the backend folder and restart it. Missing: {Object.entries(state.health.models).filter(([, m]) => !m.installed).map(([k]) => k).join(", ")}.</Alert></div>
      )}
      <Outlet />
    </div>
  );
}
