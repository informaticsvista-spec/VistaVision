// Validation for the manual data-entry form.
import type { Activity } from "../types";
import { EXPRESSIONS } from "./events";

export interface RecordInput {
  activity: Activity;
  label: string;
  count: string;
  timestamp: string; // datetime-local value or ""
  faceCount: string; // optional, expression records only
}

export interface ValidRecord {
  activity: Activity;
  label: string;
  count: number;
  timestamp: string; // ISO
  faceCount?: number;
}

export type ValidationResult = { ok: true; value: ValidRecord } | { ok: false; errors: Partial<Record<keyof RecordInput, string>> };

const MAX_COUNT = 100_000;
const titleCase = (s: string) => s.replace(/\s+/g, " ").trim().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

export function validateRecord(input: RecordInput, now = new Date()): ValidationResult {
  const errors: Partial<Record<keyof RecordInput, string>> = {};
  let label = input.label.replace(/\s+/g, " ").trim();

  if (input.activity === "face") {
    const match = EXPRESSIONS.find((e) => e.toLowerCase() === label.toLowerCase());
    if (!match) errors.label = "Choose an expression from the list.";
    else label = match;
  } else if (input.activity === "digit") {
    if (!/^\d{1,8}$/.test(label)) errors.label = "Enter a number made of digits 0-9 (up to 8 digits).";
  } else {
    if (label.length < 1) errors.label = "Enter a category name.";
    else if (label.length > 40) errors.label = "Keep the name under 40 characters.";
    else if (/[<>]/.test(label)) errors.label = "The name cannot contain < or >.";
    else label = input.activity === "object" ? titleCase(label) : label;
  }

  const countText = input.count.trim();
  let count = NaN;
  if (countText === "") errors.count = "Enter a count.";
  else if (!/^\d+$/.test(countText)) errors.count = "Use a whole number of 0 or more (no negatives or decimals).";
  else {
    count = Number(countText);
    if (count > MAX_COUNT) errors.count = `Counts above ${MAX_COUNT.toLocaleString()} are not supported.`;
  }

  let timestamp = now.toISOString();
  if (input.timestamp) {
    const parsed = new Date(input.timestamp);
    if (Number.isNaN(parsed.getTime())) errors.timestamp = "That date and time is not valid.";
    else if (parsed.getTime() > now.getTime() + 24 * 3600 * 1000) errors.timestamp = "The time cannot be more than a day in the future.";
    else timestamp = parsed.toISOString();
  }

  let faceCount: number | undefined;
  if (input.activity === "face" && input.faceCount.trim() !== "") {
    if (!/^\d+$/.test(input.faceCount.trim())) errors.faceCount = "Use a whole number of 0 or more.";
    else {
      faceCount = Number(input.faceCount.trim());
      if (Number.isFinite(count) && faceCount < count) errors.faceCount = "Faces visible cannot be fewer than the count.";
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { activity: input.activity, label, count, timestamp, faceCount } };
}
