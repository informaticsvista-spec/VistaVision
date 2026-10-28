import type { VistaEvent } from "../types";

const HEADER = ["id", "timestamp", "origin", "activity", "source", "label", "count", "confidence", "group_id", "face_count", "tracked_ids", "source_note"];

/** Quote a cell and neutralise spreadsheet formula injection (cells starting with = + - @). */
export function csvCell(value: unknown): string {
  let text = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function eventsToCsv(events: VistaEvent[]): string {
  const rows = [...events]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((e) =>
      [
        e.id,
        e.timestamp,
        e.origin,
        e.activity,
        e.source,
        e.label,
        e.count,
        e.confidence !== undefined ? e.confidence.toFixed(4) : "",
        e.groupId ?? "",
        e.faceCount ?? "",
        e.trackedIds?.join(" ") ?? "",
        e.sourceNote ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  return [HEADER.join(","), ...rows].join("\r\n") + "\r\n";
}

export function downloadText(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
