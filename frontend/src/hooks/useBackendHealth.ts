import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../services/api";
import type { HealthResponse } from "../types";
import { useSettings } from "../settings";

export type HealthState = { status: "checking" } | { status: "online"; health: HealthResponse } | { status: "offline"; message: string };

export function useBackendHealth(): { state: HealthState; recheck: () => void } {
  const { settings } = useSettings();
  const [state, setState] = useState<HealthState>({ status: "checking" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "checking" });
    api
      .health()
      .then((health) => !cancelled && setState({ status: "online", health }))
      .catch((error) => !cancelled && setState({ status: "offline", message: error instanceof ApiError ? error.message : "The server could not be reached." }));
    return () => {
      cancelled = true;
    };
  }, [settings.apiBase, nonce]);

  return { state, recheck: useCallback(() => setNonce((n) => n + 1), []) };
}
