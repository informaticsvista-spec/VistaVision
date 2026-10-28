import { useMemo } from "react";
import { useAnalytics } from "../analytics/AnalyticsProvider";
import { buildReportHtml } from "../analytics/report";
import { SessionActions } from "../components/SessionActions";
import { SessionSummary } from "../components/SessionSummary";
import { EmptyState, PageHeader } from "../components/ui";

export default function Report() {
  const analytics = useAnalytics();
  const html = useMemo(
    () => buildReportHtml(analytics.events, { sessionId: analytics.sessionId, sessionStart: analytics.sessionStart, feedback: analytics.feedback }),
    [analytics.events, analytics.feedback, analytics.sessionId, analytics.sessionStart],
  );
  return (
    <div>
      <PageHeader
        title="Session Report"
        subtitle="A summary of everything recorded in this session. Download it as an HTML file (open it and use Print → Save as PDF for a PDF) or export the raw records as CSV."
        actions={<SessionActions events={analytics.events} />}
      />
      <div className="grid gap-4">
        <section className="card" aria-labelledby="sum-h"><h2 id="sum-h" className="mb-2 text-lg font-bold">Summary</h2><SessionSummary events={analytics.events} /></section>
        <section className="card" aria-labelledby="prev-h">
          <h2 id="prev-h" className="mb-3 text-lg font-bold">Report preview</h2>
          {analytics.events.length === 0 ? (
            <EmptyState title="The report is empty">Run a recognition tool, add manual records or load sample data first.</EmptyState>
          ) : (
            <iframe title="Session report preview" srcDoc={html} sandbox="" className="h-[70vh] w-full rounded-xl border border-mist-200 bg-white" />
          )}
        </section>
      </div>
    </div>
  );
}
