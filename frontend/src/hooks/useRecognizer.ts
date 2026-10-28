import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../services/api";

/** Runs one async recognition at a time, with loading + friendly error state and cancellation on unmount. */
export function useRecognizer<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback(async (job: (signal: AbortSignal) => Promise<T>): Promise<T | null> => {
    if (busy.current) return null; // ignore double taps / repeated callbacks while a request is in flight
    busy.current = true;
    controller.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const value = await job(controller.current.signal);
      setResult(value);
      return value;
    } catch (e) {
      if (e instanceof ApiError && e.code === "cancelled") return null;
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Something went wrong.");
      setResult(null);
      return null;
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { loading, error, result, run, reset };
}
