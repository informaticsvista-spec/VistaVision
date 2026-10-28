import type { VistaEvent } from "../types";
import { downloadText, eventsToCsv } from "../analytics/csv";
import { buildReportHtml } from "../analytics/report";

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

export const exportCsv = (events: VistaEvent[]) => downloadText(`vistavision-data-${stamp()}.csv`, eventsToCsv(events), "text/csv");

export const downloadReport = (events: VistaEvent[], meta: { sessionId: string; sessionStart: string; filtersNote?: string; feedback?: import("../types").Feedback[] }) =>
  downloadText(`vistavision-report-${stamp()}.html`, buildReportHtml(events, meta), "text/html");
