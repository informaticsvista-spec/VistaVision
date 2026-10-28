export const percent = (value: number | null | undefined, digits = 0) => (value === null || value === undefined ? "—" : `${(value * 100).toFixed(digits)}%`);
export const timeLabel = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const toLocalInput = (d = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/** Expression colours: fixed per label (never per rank), drawn from the validated categorical palette.
 *  Neutral/Uncertain use a neutral grey. Labels always accompany colour in every chart. */
export const EXPRESSION_COLORS: Record<string, string> = {
  Surprise: "#2a78d6", Contempt: "#eb6834", Happy: "#eda100", Fear: "#e87ba4", Disgust: "#008300",
  Sad: "#6250d6", Angry: "#e34948", Neutral: "#6b7a99", Uncertain: "#a3adc2", None: "#a3adc2",
};
export const colorFor = (label: string) => EXPRESSION_COLORS[label] ?? "#2a78d6";
export const SERIES = { ai: "#2a78d6", manual: "#eb6834", sample: "#1baf7a", primary: "#2a78d6", grid: "#e3e7ee", axis: "#52607f" };
