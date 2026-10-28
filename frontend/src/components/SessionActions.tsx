import type { Filters } from "../analytics/aggregate";
import type { VistaEvent } from "../types";
import { useAnalytics } from "../analytics/AnalyticsProvider";
import { downloadReport, exportCsv } from "../lib/exports";
import { describeFilters } from "./FilterBar";

/** Export / report / clear controls shared by the dashboard and report pages. */
export function SessionActions({ events, filters = {}, showClear = true }: { events: VistaEvent[]; filters?: Filters; showClear?: boolean }) {
  const analytics = useAnalytics();
  const empty = events.length === 0;
  return (
    <>
      <button className="btn-secondary" disabled={empty} onClick={() => exportCsv(events)}>Export CSV</button>
      <button className="btn-secondary" disabled={empty} onClick={() => downloadReport(events, { sessionId: analytics.sessionId, sessionStart: analytics.sessionStart, feedback: analytics.feedback, filtersNote: describeFilters(filters) })}>Download Report</button>
      {showClear && (
        <button className="btn-danger" disabled={analytics.events.length === 0} onClick={() => window.confirm("Remove every record from this session? This cannot be undone.") && analytics.clear()}>
          Clear Data
        </button>
      )}
    </>
  );
}
