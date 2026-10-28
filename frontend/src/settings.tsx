import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Settings } from "./types";
import { configureApi } from "./services/api";

export const DEFAULT_SETTINGS: Settings = {
  apiBase: (import.meta.env.VITE_API_URL as string | undefined) ?? "",
  faceIntervalMs: 700,
  sampleSeconds: 3,
  uncertainThreshold: 0.45,
  mirrorFrontCamera: true,
  sound: true,
  reduceMotion: false,
  persistData: false,
  maxUploadMb: 8,
};

const KEY = "vista.settings.v1";

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  motionOk: boolean;
}
const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);
  const [systemReduce, setSystemReduce] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const onChange = () => setSystemReduce(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    configureApi({ baseUrl: settings.apiBase });
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* private mode: settings just won't persist */
    }
  }, [settings]);

  const motionOk = !(settings.reduceMotion || systemReduce);
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", !motionOk);
  }, [motionOk]);

  const value = useMemo<Ctx>(
    () => ({ settings, motionOk, update: (patch) => setSettings((s) => ({ ...s, ...patch })), reset: () => setSettings(DEFAULT_SETTINGS) }),
    [settings, motionOk],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
