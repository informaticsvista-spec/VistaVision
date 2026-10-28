import { useCallback } from "react";
import { api } from "../services/api";
import type { DigitResponse, InputSource } from "../types";
import { useAnalytics } from "../analytics/AnalyticsProvider";
import { digitEvent, uid } from "../analytics/events";
import { useRecognizer } from "./useRecognizer";
import { useSettings } from "../settings";
import { play } from "../lib/sound";

/** Sends an image to the digit model and records exactly one analytics event per request. */
export function useDigitRecognition(source: InputSource, apiSource: "paper" | "canvas") {
  const { record } = useAnalytics();
  const { settings } = useSettings();
  const recognizer = useRecognizer<DigitResponse>();
  const { run } = recognizer;

  const recognize = useCallback(
    (blob: Blob, mode: "single" | "multi") =>
      run(async (signal) => {
        const requestId = uid();
        const response = await api.recognizeDigits(blob, { source: apiSource, mode }, { signal });
        record([digitEvent({ number: response.number, confidence: response.mean_confidence, source, requestId })]);
        play("success", settings.sound);
        return response;
      }),
    [run, record, source, apiSource, settings.sound],
  );
  return { ...recognizer, recognize };
}
