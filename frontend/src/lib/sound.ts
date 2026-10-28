// Tiny sound effects generated with the Web Audio API (no audio files to load).
let ctx: AudioContext | null = null;

function tone(freq: number, start: number, duration: number, type: OscillatorType = "sine", gain = 0.06) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(0, ctx.currentTime + start);
  amp.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.05);
}

export type SoundName = "success" | "correct" | "wrong" | "click";

export function play(name: SoundName, enabled: boolean): void {
  if (!enabled || typeof window === "undefined") return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    if (name === "success" || name === "correct") {
      tone(660, 0, 0.12);
      tone(880, 0.1, 0.18);
    } else if (name === "wrong") tone(220, 0, 0.25, "triangle");
    else tone(520, 0, 0.06);
  } catch {
    /* audio is optional */
  }
}
