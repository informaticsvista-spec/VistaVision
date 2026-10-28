// Builds a self-contained HTML session report (no scripts, prints cleanly to PDF).
import type { Feedback, VistaEvent } from "../types";
import { scoreboard, confidenceHistogram, digitFrequency, expressionCounts, historyRows, objectFrequency, originComparison, summarize, type CountRow } from "./aggregate";
import { ACTIVITY_LABEL, ORIGIN_LABEL, SOURCE_LABEL } from "./events";

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

function bars(rows: { name: string; count: number }[], empty: string): string {
  if (!rows.length) return `<p class="muted">${esc(empty)}</p>`;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return `<table class="bars">${rows
    .map((r) => `<tr><th>${esc(r.name)}</th><td><span style="width:${(r.count / max) * 100}%"></span></td><td class="n">${r.count}</td></tr>`)
    .join("")}</table>`;
}

const withPct = (rows: CountRow[]) => rows.map((r) => ({ name: `${r.name} (${r.percent.toFixed(0)}%)`, count: r.count }));

export function buildReportHtml(events: VistaEvent[], opts: { sessionId: string; sessionStart: string; filtersNote?: string; feedback?: Feedback[] }): string {
  const s = summarize(events);
  const history = historyRows(events).slice(0, 200);
  const comparison = originComparison(events);
  const hist = confidenceHistogram(events);
  const digits = digitFrequency(events);
  const board = scoreboard(opts.feedback ?? []);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VistaVision Session Report</title><style>
body{font:15px/1.5 system-ui,Segoe UI,Roboto,sans-serif;color:#25104f;max-width:900px;margin:0 auto;padding:24px}
h1{margin:0 0 4px}h2{margin:28px 0 8px;border-bottom:2px solid #db2777;padding-bottom:4px}.muted{color:#5a6485}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.card{background:#f3edff;border-radius:10px;padding:10px 12px}
.card b{display:block;font-size:22px}table{border-collapse:collapse;width:100%}th,td{padding:5px 8px;border-bottom:1px solid #e6dcfb;text-align:left;font-size:13px}
.bars th{width:32%;font-weight:600}.bars td span{display:block;height:12px;background:#7c3aed;border-radius:3px;min-width:2px}.n{text-align:right;width:56px}
.note{background:#fff7e0;border:1px solid #f0d98a;padding:8px 12px;border-radius:8px;font-size:13px}@media print{body{padding:0}}
</style></head><body>
<h1>VistaVision Session Report</h1>
<p class="muted">AI-Powered Computer Vision &amp; Data Analytics · Generated ${esc(new Date().toLocaleString())} · Session ${esc(opts.sessionId.slice(0, 8))} started ${esc(when(opts.sessionStart))}</p>
${opts.filtersNote ? `<p class="muted">Filters applied: ${esc(opts.filtersNote)}</p>` : ""}
<p class="note"><b>Please read:</b> AI predictions can be wrong. Expression results estimate <em>visible</em> facial expression only and do not tell us how anyone feels. Sample and manually entered records are labelled and are not AI predictions. No images or identities are stored in this report.</p>
<h2>Totals</h2><div class="grid">
<div class="card">Records<b>${s.records}</b></div>
<div class="card">AI-generated<b>${s.byOrigin.ai}</b></div>
<div class="card">Manual<b>${s.byOrigin.manual}</b></div>
<div class="card">Sample<b>${s.byOrigin.sample}</b></div>
<div class="card">Expression observations<b>${s.expressionObservations}</b></div>
<div class="card">Digit attempts<b>${s.digitAttempts}</b></div>
<div class="card">Object detections<b>${s.objectDetections}</b></div>
<div class="card">Average AI confidence<b>${pct(s.averageConfidence)}</b></div></div>
<h2>Faces</h2><p>Snapshots: ${s.faceSnapshots} · Most faces at once: ${s.maxFacesAtOnce} · Average faces per snapshot: ${s.averageFacesPerSnapshot === null ? "—" : s.averageFacesPerSnapshot.toFixed(1)} · Distinct tracker IDs (temporary, not identities): ${s.trackedFaces}</p>
<p class="muted">Percentages are shares of expression <em>observations</em>, not of people; one person can contribute many observations.</p>
${bars(withPct(expressionCounts(events)), "No expression data.")}
<h2>Digits</h2>${bars(digits.map((d) => ({ name: `Digit ${d.digit}`, count: d.count })), "No digit data.")}
<h2>Objects</h2>${bars(objectFrequency(events), "No object data.")}
<h2>AI vs manual vs sample</h2>${
    comparison.length
      ? `<table><tr><th>Activity</th><th>AI</th><th>Manual</th><th>Sample</th></tr>${comparison.map((r) => `<tr><td>${esc(r.activity)}</td><td>${r.ai}</td><td>${r.manual}</td><td>${r.sample}</td></tr>`).join("")}</table>`
      : '<p class="muted">No data.</p>'
  }
<h2>Confidence distribution</h2>${hist ? bars(hist.map((h) => ({ name: h.bin, count: h.count })), "") : '<p class="muted">Not enough AI predictions yet (needs 5 or more).</p>'}
<h2>Human vs AI scoreboard</h2>${board.checked ? `<p>People checked <b>${board.checked}</b> AI predictions; the AI was right <b>${board.correct}</b> times (<b>${pct(board.checked ? board.correct / board.checked : null)}</b>).</p>${bars(board.rows.filter((r) => r.checked).map((r) => ({ name: `${r.name} (${r.correct}/${r.checked})`, count: Math.round(r.percent) })), "")}${board.mixups.length ? `<p class="muted">Mix-ups: ${board.mixups.map((m) => `${esc(m.predicted)} → ${esc(m.actual)} ×${m.count}`).join("; ")}</p>` : ""}` : '<p class="muted">No predictions were checked this session.</p>'}
<h2>Prediction history${events.length > 200 ? " (latest 200)" : ""}</h2>${
    history.length
      ? `<table><tr><th>Time</th><th>Origin</th><th>Source</th><th>Activity</th><th>Result</th><th>Count</th><th>Confidence</th></tr>${history
          .map((r) => `<tr><td>${esc(new Date(r.timestamp).toLocaleTimeString())}</td><td>${ORIGIN_LABEL[r.origin]}</td><td>${SOURCE_LABEL[r.source]}</td><td>${ACTIVITY_LABEL[r.activity]}</td><td>${esc(r.prediction)}</td><td>${r.count}</td><td>${r.confidence === undefined ? "—" : pct(r.confidence)}</td></tr>`)
          .join("")}</table>`
      : '<p class="muted">No records yet.</p>'
  }
</body></html>`;
}
