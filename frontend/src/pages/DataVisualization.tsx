import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { categoriesOf, computeKpis, filterEvents, type Filters } from "../analytics/aggregate";
import { useAnalytics } from "../analytics/AnalyticsProvider";
import { ACTIVITY_LABEL, SOURCE_LABEL } from "../analytics/events";
import { CustomChartBuilder } from "../components/CustomChartBuilder";
import { ComparisonChart, ConfidenceChart, DigitBar, ExpressionBarChart, ExpressionDonut, ExpressionLine, FaceCountLine, HeatmapChart, ObjectBar, OtherBar, ScoreboardChart } from "../components/charts";
import { FilterBar } from "../components/FilterBar";
import { HistoryTable } from "../components/HistoryTable";
import { ManualEntryForm } from "../components/ManualEntryForm";
import { SessionActions } from "../components/SessionActions";
import { SessionSummary } from "../components/SessionSummary";
import { Alert, PageHeader, Stat } from "../components/ui";

export default function DataVisualization() {
  const analytics = useAnalytics();
  const [filters, setFilters] = useState<Filters>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const events = useMemo(() => filterEvents(analytics.events, filters), [analytics.events, filters]);
  const kpis = useMemo(() => computeKpis(events), [events]);
  const categories = useMemo(() => categoriesOf(analytics.events), [analytics.events]);
  const editing = analytics.events.find((e) => e.id === editingId) ?? null;
  const hasSample = analytics.events.some((e) => e.origin === "sample");
  const latest = kpis.latest;

  return (
    <div>
      <PageHeader
        title="Data Visualization"
        subtitle="Every chart is calculated from the records below: AI results from the recognition tools, anything typed in by hand, and optional sample data. No camera needed."
        actions={
          <>
            <button className="btn-cyan" onClick={analytics.loadSample}>Load Sample Dataset</button>
            <SessionActions events={events} filters={filters} />
          </>
        }
      />

      <div className="mb-5"><CustomChartBuilder /></div>

      <h2 className="mb-2 mt-2 text-xl font-extrabold">📊 Dashboard from AI results and records</h2>
      {analytics.paused && <div className="mb-4"><Alert tone="warn" title="AI analytics are paused">New AI results are not being recorded. Manual records still work.</Alert></div>}
      {hasSample && <div className="mb-4"><Alert tone="info" title="Sample data is included">Records marked <b>Sample</b> are made-up demonstration numbers, not real AI predictions. Use the “Data origin” filter to hide them.</Alert></div>}

      <FilterBar filters={filters} onChange={setFilters} categories={categories} />

      <section aria-label="Key figures" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Total records" value={kpis.totalRecords} hint={`AI ${kpis.byOrigin.ai} · manual ${kpis.byOrigin.manual} · sample ${kpis.byOrigin.sample}`} tone="indigo" />
        <Stat label="Faces visible now" value={kpis.currentFaces ?? "—"} hint={`${kpis.trackedFaces} temporary tracker IDs`} />
        <Stat label="Expression observations" value={kpis.expressionObservations} hint="Not a head-count" />
        <Stat label="Digit attempts" value={kpis.digitAttempts} />
        <Stat label="Object detections" value={kpis.objectDetections} />
        <Stat
          label="Most recent"
          tone="cyan"
          value={<span className="block truncate text-xl sm:text-2xl">{latest ? latest.label : "—"}</span>}
          hint={latest ? `${ACTIVITY_LABEL[latest.activity]} · ${SOURCE_LABEL[latest.source]}${latest.confidence !== undefined ? ` · ${Math.round(latest.confidence * 100)}%` : ""}` : "No records yet"}
        />
      </section>

      {analytics.events.length === 0 && (
        <div className="mt-4">
          <Alert tone="info" title="Start with data" action={<Link to="/recognition/faces" className="btn-secondary">Open Smart Recognition</Link>}>
            Add a record below, load the sample dataset, or run a recognition tool. Charts update the moment the data changes.
          </Alert>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ExpressionBarChart events={events} />
        <ExpressionDonut events={events} />
        <FaceCountLine events={events} />
        <ExpressionLine events={events} />
        <DigitBar events={events} />
        <ObjectBar events={events} />
        <OtherBar events={events} />
        <ConfidenceChart events={events} />
        <ComparisonChart events={events} />
        <HeatmapChart events={events} />
        <ScoreboardChart feedback={analytics.feedback} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <ManualEntryForm editing={editing} onDone={() => setEditingId(null)} />
        <section className="card" aria-labelledby="summary-h">
          <h2 id="summary-h" className="mb-2 text-lg font-bold">Session summary</h2>
          <SessionSummary events={events} />
        </section>
      </div>

      <section className="card mt-4" aria-labelledby="history-h">
        <h2 id="history-h" className="mb-3 text-lg font-bold">Prediction &amp; record history</h2>
        <HistoryTable
          events={events}
          onEdit={(id) => { setEditingId(id); document.getElementById("manual-entry")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
          onDelete={(id) => { if (id === editingId) setEditingId(null); analytics.remove(id); }}
        />
      </section>
    </div>
  );
}
