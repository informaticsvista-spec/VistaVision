import { useState } from "react";
import { useAnalytics } from "../analytics/AnalyticsProvider";
import { EXPRESSIONS } from "../analytics/events";
import type { Feedback, InputSource } from "../types";

interface Props {
  activity: Feedback["activity"];
  predicted: string;
  confidence?: number;
  source: InputSource;
  /** Choices offered when the AI was wrong. Digits use a free number box instead. */
  options?: string[];
  what: string;
}

/** "Was the AI right?" - one tap to confirm, or say what it really was. Feeds the Human vs AI scoreboard. */
export function FeedbackBar({ activity, predicted, confidence, source, options, what }: Props) {
  const { addFeedback } = useAnalytics();
  const [step, setStep] = useState<"ask" | "fix" | "done">("ask");
  const [asked, setAsked] = useState(predicted);
  const [actual, setActual] = useState("");
  const [verdict, setVerdict] = useState<boolean | null>(null);

  const save = (truth: string) => {
    addFeedback({ activity, source, predicted: asked, actual: truth, confidence });
    setVerdict(asked.trim().toLowerCase() === truth.trim().toLowerCase());
    setStep("done");
  };
  const valid = activity === "digit" ? /^\d{1,8}$/.test(actual) : actual.trim().length > 0;

  if (step === "done")
    return (
      <p role="status" className="rounded-xl bg-mint-300/30 px-3 py-2 text-sm font-semibold text-mint-600">
        {verdict ? "🎉 Thanks! The AI scores a point." : "🧠 Thanks! Mistakes help us learn where AI struggles."} See the <b>Human vs AI scoreboard</b> on the dashboard.
        <button className="ml-2 underline" onClick={() => { setStep("ask"); setActual(""); }}>Check again</button>
      </p>
    );

  return (
    <div className="rounded-2xl border-2 border-sun-300 bg-sun-300/15 p-3" aria-label="Check the AI">
      <p className="text-sm font-bold">🧐 Check the AI: was it right?</p>
      {step === "ask" ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn !bg-mint-500 !text-white hover:!bg-mint-600" onClick={() => { setAsked(predicted); save(predicted); }}>✅ Yes, it is {what}</button>
          <button className="btn border-2 border-coral-400 bg-white text-coral-500" onClick={() => { setAsked(predicted); setStep("fix"); }}>❌ No, it was wrong</button>
        </div>
      ) : (
        <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (valid) save(activity === "digit" ? actual : actual.trim()); }}>
          <label className="flex-1 text-sm font-semibold">
            It was really…
            {activity === "digit" ? (
              <input className="input mt-1" inputMode="numeric" autoFocus placeholder="Type the real number" value={actual} onChange={(e) => setActual(e.target.value.replace(/\D/g, "").slice(0, 8))} />
            ) : options ? (
              <select className="input mt-1" autoFocus value={actual} onChange={(e) => setActual(e.target.value)}>
                <option value="">Choose…</option>
                {options.filter((o) => o !== predicted).map((o) => <option key={o}>{o}</option>)}
                <option>Something else</option>
              </select>
            ) : (
              <input className="input mt-1" autoFocus value={actual} onChange={(e) => setActual(e.target.value)} />
            )}
          </label>
          <button className="btn-primary" type="submit" disabled={!valid}>Save</button>
          <button className="btn-ghost" type="button" onClick={() => setStep("ask")}>Back</button>
        </form>
      )}
    </div>
  );
}

export const EXPRESSION_CHOICES = EXPRESSIONS.filter((e) => e !== "Uncertain") as unknown as string[];
