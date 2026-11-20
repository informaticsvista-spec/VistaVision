import { useState } from "react";
import { useSettings } from "../settings";
import { useAnalytics } from "../analytics/AnalyticsProvider";
import { useBackendHealth } from "../hooks/useBackendHealth";
import { Alert, Badge, PageHeader, Spinner } from "../components/ui";
import { cameraService } from "../services/camera";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-mist-100 py-3 last:border-0 sm:grid-cols-[260px_1fr] sm:items-center">
      <div><p className="text-sm font-semibold">{label}</p>{hint && <p className="text-xs text-navy-700">{hint}</p>}</div>
      <div>{children}</div>
    </div>
  );
}

/** Staff view: open Settings with ?admin=1 (remembered for this tab). Visitors never see the technical server details. */
function useStaffMode(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("admin") === "1") sessionStorage.setItem("vistavision.staff", "1");
    return sessionStorage.getItem("vistavision.staff") === "1";
  } catch {
    return new URLSearchParams(window.location.search).get("admin") === "1";
  }
}

export default function SettingsPage() {
  const staff = useStaffMode();
  const { settings, update, reset } = useSettings();
  const analytics = useAnalytics();
  const { state, recheck } = useBackendHealth();
  const [apiDraft, setApiDraft] = useState(settings.apiBase);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" subtitle="Tune performance and privacy. Settings are saved in this browser only." />

      {staff ? (
        <section className="card mb-4" aria-labelledby="srv">
          <h2 id="srv" className="mb-1 text-lg font-bold">AI server</h2>
          <Row label="Server address" hint="Leave empty to use this site's own /api (recommended in development). Use https:// in production.">
            <div className="flex flex-wrap gap-2">
              <input className="input max-w-md" value={apiDraft} placeholder="https://your-backend.example.com" onChange={(e) => setApiDraft(e.target.value)} aria-label="Server address" inputMode="url" />
              <button className="btn-secondary" onClick={() => { update({ apiBase: apiDraft.trim() }); setTimeout(recheck, 0); }}>Save &amp; test</button>
            </div>
          </Row>
          <div className="pt-3" aria-live="polite">
            {state.status === "checking" && <p className="text-sm"><Spinner /> Checking the server…</p>}
            {state.status === "offline" && <Alert tone="error" title="Not connected">{state.message}</Alert>}
            {state.status === "online" && (
              <div className="space-y-2">
                <Alert tone={state.health.status === "ok" ? "success" : "warn"} title={`Connected · server v${state.health.version} · ${state.health.status === "ok" ? "all models installed" : "some models missing"}`} />
                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                  {Object.entries(state.health.models).map(([key, m]) => (
                    <li key={key} className="flex items-center gap-2"><Badge tone={m.installed ? "green" : "red"}>{m.installed ? "installed" : "missing"}</Badge> {m.purpose}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="card mb-4" aria-labelledby="srv" aria-live="polite">
          <h2 id="srv" className="mb-1 text-lg font-bold">AI status</h2>
          {state.status === "checking" && <p className="text-sm"><Spinner /> Getting the AI ready…</p>}
          {state.status === "offline" && <Alert tone="warn" title="The AI is waking up">It can take up to a minute the first time. Please wait a moment and try again.</Alert>}
          {state.status === "online" && <Alert tone={state.health.status === "ok" ? "success" : "warn"} title={state.health.status === "ok" ? "AI is ready" : "AI is partly ready"} />}
        </section>
      )}

      <section className="card mb-4" aria-labelledby="perf">
        <h2 id="perf" className="mb-1 text-lg font-bold">Performance &amp; analytics</h2>
        <Row label={`Face frame sampling: every ${settings.faceIntervalMs} ms`} hint="Higher = lighter on slow devices and the network.">
          <input type="range" min={300} max={2000} step={100} className="w-full max-w-sm accent-indigo-600" value={settings.faceIntervalMs} onChange={(e) => update({ faceIntervalMs: Number(e.target.value) })} aria-label="Face frame sampling interval" />
        </Row>
        <Row label={`Save a face snapshot every ${settings.sampleSeconds} s`} hint="How often live face counts are written to the dashboard (not every frame).">
          <input type="range" min={1} max={30} className="w-full max-w-sm accent-indigo-600" value={settings.sampleSeconds} onChange={(e) => update({ sampleSeconds: Number(e.target.value) })} aria-label="Snapshot interval seconds" />
        </Row>
        <Row label={`“Uncertain” below ${Math.round(settings.uncertainThreshold * 100)}%`} hint="Expressions the AI is less sure about are labelled Uncertain.">
          <input type="range" min={0.2} max={0.9} step={0.05} className="w-full max-w-sm accent-indigo-600" value={settings.uncertainThreshold} onChange={(e) => update({ uncertainThreshold: Number(e.target.value) })} aria-label="Uncertain threshold" />
        </Row>
        <Row label="Maximum upload size (MB)" hint={state.status === "online" ? `The server accepts up to ${state.health.limits.max_upload_mb} MB.` : undefined}>
          <input type="number" min={1} max={20} className="input max-w-[120px]" value={settings.maxUploadMb} onChange={(e) => update({ maxUploadMb: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })} aria-label="Maximum upload size in megabytes" />
        </Row>
      </section>

      <section className="card mb-4" aria-labelledby="ux">
        <h2 id="ux" className="mb-1 text-lg font-bold">Comfort</h2>
        <Row label="Mirror the front camera" hint="Looks like a mirror. Never applied to rear cameras."><input type="checkbox" className="h-6 w-6 accent-indigo-600" checked={settings.mirrorFrontCamera} onChange={(e) => update({ mirrorFrontCamera: e.target.checked })} aria-label="Mirror the front camera" /></Row>
        <Row label="Sound effects"><input type="checkbox" className="h-6 w-6 accent-indigo-600" checked={settings.sound} onChange={(e) => update({ sound: e.target.checked })} aria-label="Sound effects" /></Row>
        <Row label="Reduce motion" hint="Turns off animations. Also follows your device's accessibility setting."><input type="checkbox" className="h-6 w-6 accent-indigo-600" checked={settings.reduceMotion} onChange={(e) => update({ reduceMotion: e.target.checked })} aria-label="Reduce motion" /></Row>
      </section>

      <section className="card mb-4" aria-labelledby="priv">
        <h2 id="priv" className="mb-1 text-lg font-bold">Privacy</h2>
        <Row label="Keep records in this browser" hint="Off by default: analytics vanish when you close the tab. If turned on, only the structured records (labels and counts) are saved on this device, never images.">
          <input type="checkbox" className="h-6 w-6 accent-indigo-600" checked={settings.persistData} onChange={(e) => update({ persistData: e.target.checked })} aria-label="Keep records in this browser" />
        </Row>
        <Row label="Save records on the server" hint="Saves only the structured records (labels, counts, game rounds, your checks) in the VistaVision database so the Data Visualization page is still there after a refresh. No images, no names. It is tied to this browser by a random code, not to you.">
          <input type="checkbox" className="h-6 w-6 accent-indigo-600" checked={settings.serverSave} onChange={(e) => update({ serverSave: e.target.checked })} aria-label="Save records on the server" />
        </Row>
        {settings.serverSave && (
          <p className="mt-1 text-sm text-navy-800" role="status">
            {analytics.server.status === "loading" && "Loading saved records…"}
            {analytics.server.status === "saving" && "Saving…"}
            {analytics.server.status === "saved" && `Saved on the server${analytics.server.savedAt ? ` at ${new Date(analytics.server.savedAt).toLocaleTimeString()}` : ""}.`}
            {analytics.server.status === "error" && "Could not reach the server. Records stay on this page and will be saved when it is back."}
            {analytics.server.status === "unavailable" && "The server database is not available right now. Everything still works; records just are not saved."}
          </p>
        )}
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-navy-800">
          <li>Camera frames are sent to the VistaVision server only while a recognition tool is analysing, are processed in memory and are discarded.</li>
          <li>No photos, face images or face embeddings are stored, and nobody is identified by name.</li>
          <li>Expression results are estimates of a visible expression, not of feelings, and AI predictions can be wrong.</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-danger" onClick={() => { cameraService.stop(); window.confirm("Reset the session and delete all records?") && analytics.reset(); }}>Reset session</button>
          <button className="btn-secondary" onClick={() => { void analytics.eraseServerCopy().then((ok) => window.alert(ok ? "Your saved records were deleted from the server." : "Could not reach the server to delete them.")); }}>Delete my saved records from the server</button>
          <button className="btn-secondary" onClick={reset}>Restore default settings</button>
        </div>
      </section>

      <section className="card" aria-labelledby="cam">
        <h2 id="cam" className="mb-2 text-lg font-bold">Camera help</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-navy-800">
          <li><b>“Permission blocked”:</b> click the camera icon next to the web address, choose Allow, then press Start Camera again.</li>
          <li><b>Phones and tablets need HTTPS</b> (a link starting with https://). Plain http:// links cannot use the camera, though drawing and image upload still work.</li>
          <li><b>“Camera busy”:</b> close other apps or tabs using the camera (video calls, other browsers).</li>
          <li><b>iPhone/iPad:</b> use Safari 14.3 or newer, and keep the screen on while the camera is running.</li>
          <li>Several cameras? Use the Camera menu under the preview. On phones, choose the back camera to show paper.</li>
        </ul>
      </section>
    </div>
  );
}
