import { useSyncExternalStore } from "react";
import { cameraService, type CameraState } from "../services/camera";
import { useSettings } from "../settings";

export function useCamera(): CameraState & { mirrored: boolean; start: typeof cameraService.start; stop: () => void; supported: boolean } {
  const state = useSyncExternalStore(cameraService.subscribe, cameraService.getState, cameraService.getState);
  const { settings } = useSettings();
  return {
    ...state,
    mirrored: settings.mirrorFrontCamera && state.facing !== "environment",
    start: (options) => cameraService.start(options),
    stop: () => cameraService.stop(),
    supported: cameraService.isSupported(),
  };
}
