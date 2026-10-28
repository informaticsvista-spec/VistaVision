// Reusable camera service. It knows nothing about AI models: recognition modules just ask it for frames.
//
// - One MediaStream at a time, shared by every module (no competing streams).
// - Explicit stop() releases the hardware; the camera light goes off.
// - Components subscribe to state changes (useCamera hook).

export type CameraStatus = "idle" | "starting" | "live" | "error";

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export interface CameraState {
  status: CameraStatus;
  error: string | null;
  devices: CameraDevice[];
  deviceId: string | null;
  facing: "user" | "environment" | "unknown";
  width: number;
  height: number;
}

const IDLE: CameraState = { status: "idle", error: null, devices: [], deviceId: null, facing: "unknown", width: 0, height: 0 };

export function describeCameraError(error: unknown): string {
  const name = (error as DOMException | undefined)?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Camera permission was blocked. Allow camera access for this site in your browser's address bar or settings, then press Start Camera again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera was found. Plug in a webcam or try a different device. Image upload and touchscreen drawing still work without a camera.";
    case "NotReadableError":
    case "TrackStartError":
      return "The camera is busy or unavailable. Close other apps or tabs that are using it, then try again.";
    case "OverconstrainedError":
      return "That camera could not be started with the requested settings. Try choosing another camera.";
    case "SecurityError":
      return "The browser blocked camera access. Camera needs a secure (HTTPS) connection or localhost.";
    case "AbortError":
      return "The camera did not start. Please try again.";
    default:
      return "The camera could not be started. Check permissions and that no other app is using it.";
  }
}

class CameraService {
  private state: CameraState = IDLE;
  private listeners = new Set<() => void>();
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private startToken = 0;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", () => this.stop());
      navigator.mediaDevices?.addEventListener?.("devicechange", () => {
        if (this.state.status === "live") void this.refreshDevices();
      });
    }
  }

  // --- subscription (useSyncExternalStore compatible) ---
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getState = (): CameraState => this.state;
  private set(patch: Partial<CameraState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  isSupported(): boolean {
    return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  }

  /** Register the <video> element that shows the preview. The stream is attached immediately if live. */
  attach(video: HTMLVideoElement | null): void {
    if (this.video && this.video !== video) this.video.srcObject = null;
    this.video = video;
    if (video && this.stream) {
      video.srcObject = this.stream;
      void video.play().catch(() => undefined);
    }
  }

  async start(options: { deviceId?: string | null; facingMode?: "user" | "environment" } = {}): Promise<void> {
    if (!this.isSupported()) {
      const secure = typeof window !== "undefined" && window.isSecureContext;
      this.set({
        status: "error",
        error: secure
          ? "This browser does not support camera access. Try a recent Chrome, Edge, Firefox or Safari."
          : "Camera access needs HTTPS (or localhost). Open the secure link to the site and try again.",
      });
      return;
    }
    const token = ++this.startToken;
    this.releaseStream();
    this.set({ status: "starting", error: null });

    const video: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 } };
    if (options.deviceId) video.deviceId = { exact: options.deviceId };
    else video.facingMode = options.facingMode ?? "user";

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      } catch (error) {
        // A remembered deviceId can go stale (camera unplugged). Fall back to any camera once.
        if ((error as DOMException).name === "OverconstrainedError" && options.deviceId) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        } else throw error;
      }
      if (token !== this.startToken) {
        stream.getTracks().forEach((t) => t.stop()); // a newer start/stop superseded this one
        return;
      }
      this.stream = stream;
      const track = stream.getVideoTracks()[0];
      track.addEventListener("ended", () => {
        if (this.stream === stream) {
          this.releaseStream();
          this.set({ ...IDLE, devices: this.state.devices, status: "error", error: "The camera was disconnected." });
        }
      });
      const settings = track.getSettings();
      this.attach(this.video);
      this.set({
        status: "live",
        error: null,
        deviceId: settings.deviceId ?? options.deviceId ?? null,
        facing: (settings.facingMode as CameraState["facing"]) ?? (options.facingMode ?? "unknown"),
        width: settings.width ?? 0,
        height: settings.height ?? 0,
      });
      await this.refreshDevices(); // labels are only available after permission is granted
    } catch (error) {
      if (token !== this.startToken) return;
      this.releaseStream();
      this.set({ status: "error", error: describeCameraError(error) });
    }
  }

  async refreshDevices(): Promise<void> {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const devices = all
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
      this.set({ devices });
    } catch {
      /* listing is optional */
    }
  }

  private releaseStream() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }

  /** Stop the camera completely and release the hardware. Safe to call at any time. */
  stop(): void {
    this.startToken++;
    this.releaseStream();
    this.set({ ...IDLE, devices: this.state.devices });
  }

  /** Grab the current frame as a JPEG, scaled so its width is at most maxWidth. */
  async captureFrame(options: { maxWidth?: number; quality?: number; type?: "image/jpeg" | "image/png" } = {}): Promise<Blob> {
    const video = this.video;
    if (!video || this.state.status !== "live" || video.readyState < 2 || !video.videoWidth) {
      throw new Error("The camera is not ready yet.");
    }
    const { maxWidth = 640, quality = 0.8, type = "image/jpeg" } = options;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not capture a frame."))), type, quality));
  }
}

export const cameraService = new CameraService();
