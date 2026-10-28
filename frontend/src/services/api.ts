// Thin, typed client for the VistaVision backend with timeouts and friendly errors.
import type { DigitResponse, FaceResponse, HealthResponse, ObjectResponse } from "../types";

let baseUrl: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

/** Called by the settings provider so a user-entered server address takes effect immediately. */
export function configureApi(options: { baseUrl: string }): void {
  baseUrl = options.baseUrl.trim().replace(/\/$/, "");
}
export const getApiBase = () => baseUrl;

export class ApiError extends Error {
  constructor(message: string, public code: string, public status = 0) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

async function request<T>(path: string, init: RequestInit, { timeoutMs = 20000, signal }: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  const onAbort = () => controller.abort("cancelled");
  signal?.addEventListener("abort", onAbort);
  try {
    const response = await fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal });
    if (!response.ok) {
      let message = `The server returned an error (${response.status}).`;
      let code = "http_error";
      try {
        const body = await response.json();
        if (body?.error?.message) {
          message = body.error.message;
          code = body.error.code ?? code;
        } else if (Array.isArray(body?.detail)) {
          message = "The request was not accepted by the server.";
          code = "bad_request";
        }
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(message, code, response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      if (controller.signal.reason === "cancelled") throw new ApiError("Cancelled.", "cancelled");
      throw new ApiError("The server took too long to answer. Check your connection and try again.", "timeout");
    }
    throw new ApiError(
      "Cannot reach the VistaVision server. Check that the backend is running and the server address in Settings is correct.",
      "network",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function imageForm(blob: Blob, name = "frame.jpg"): FormData {
  const form = new FormData();
  form.append("file", blob, name);
  return form;
}

const query = (params: Record<string, string | number>) =>
  "?" + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

export const api = {
  health: (options?: RequestOptions) => request<HealthResponse>("/api/health", { method: "GET" }, { timeoutMs: 6000, ...options }),

  analyzeFaces: (blob: Blob, p: { uncertainThreshold: number; scoreThreshold?: number }, options?: RequestOptions) =>
    request<FaceResponse>(
      `/api/faces/analyze${query({ uncertain_threshold: p.uncertainThreshold, score_threshold: p.scoreThreshold ?? 0.6 })}`,
      { method: "POST", body: imageForm(blob) },
      { timeoutMs: 10000, ...options },
    ),

  recognizeDigits: (blob: Blob, p: { source: "paper" | "canvas"; mode: "single" | "multi" }, options?: RequestOptions) =>
    request<DigitResponse>(`/api/digits/recognize${query(p)}`, { method: "POST", body: imageForm(blob, "digits.png") }, { timeoutMs: 20000, ...options }),

  detectObjects: (blob: Blob, p: { minScore?: number } = {}, options?: RequestOptions) =>
    request<ObjectResponse>(`/api/objects/detect${query({ min_score: p.minScore ?? 0.4 })}`, { method: "POST", body: imageForm(blob) }, { timeoutMs: 15000, ...options }),

  objectLabels: (options?: RequestOptions) => request<{ count: number; labels: string[] }>("/api/objects/labels", { method: "GET" }, { timeoutMs: 8000, ...options }),
};
