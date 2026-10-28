import { useMemo, useState } from "react";
import { prepareQuiz } from "../data/quiz";
import { useSettings } from "../settings";
import { play } from "../lib/sound";
import { cx } from "../lib/format";

export function Quiz() {
  const { settings } = useSettings();
  const [round, setRound] = useState(0);
  const questions = useMemo(() => prepareQuiz(8), [round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const finished = index >= questions.length;
  const score = answers.filter((a, i) => a === questions[i]?.answer).length;

  const choose = (option: number) => {
    if (picked !== null) return;
    setPicked(option);
    play(option === questions[index].answer ? "correct" : "wrong", settings.sound);
  };
  const next = () => { setAnswers((a) => [...a, picked]); setPicked(null); setIndex((i) => i + 1); };
  const restart = () => { setRound((r) => r + 1); setIndex(0); setPicked(null); setAnswers([]); };

  if (finished) {
    const message = score === questions.length ? "Perfect score! 🎉" : score >= questions.length * 0.7 ? "Great job! 🌟" : "Good effort — try again! 💪";
    return (
      <div className="card space-y-4" aria-live="polite">
        <h3 className="text-xl font-bold">Quiz complete</h3>
        <p className="text-4xl font-extrabold text-indigo-700">{score} / {questions.length}</p>
        <p className="font-semibold">{message}</p>
        <ol className="space-y-3 text-sm">
          {questions.map((q, i) => {
            const right = answers[i] === q.answer;
            return (
              <li key={q.id} className={cx("rounded-xl border p-3", right ? "border-emerald-300 bg-emerald-50" : "border-red-200 bg-red-50")}>
                <p className="font-semibold">{i + 1}. {q.question}</p>
                <p>{right ? "✔ Correct" : "✘ Your answer"}: {answers[i] !== null && answers[i] !== undefined ? q.options[answers[i] as number] : "No answer"}</p>
                {!right && <p>Correct answer: <b>{q.options[q.answer]}</b></p>}
                <p className="mt-1 text-navy-700">{q.explanation}</p>
              </li>
            );
          })}
        </ol>
        <button className="btn-primary" onClick={restart}>Play again with new questions</button>
      </div>
    );
  }

  const q = questions[index];
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between text-sm font-semibold text-navy-700">
        <span>Question {index + 1} of {questions.length} · {q.topic}</span>
        <span>Score {score}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-mist-200"><div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${(index / questions.length) * 100}%` }} /></div>
      <h3 className="text-lg font-bold sm:text-xl">{q.question}</h3>
      <div className="grid gap-2" role="group" aria-label="Answer choices">
        {q.options.map((option, i) => {
          const state = picked === null ? "idle" : i === q.answer ? "right" : i === picked ? "wrong" : "dim";
          return (
            <button key={option} onClick={() => choose(i)} disabled={picked !== null} aria-pressed={picked === i}
              className={cx("min-h-[48px] rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition sm:text-base",
                state === "idle" && "border-mist-300 bg-white hover:border-indigo-500",
                state === "right" && "border-emerald-500 bg-emerald-50 text-emerald-900",
                state === "wrong" && "border-red-400 bg-red-50 text-red-900",
                state === "dim" && "border-mist-200 bg-mist-50 text-navy-700/60")}>
              {state === "right" && "✔ "}{state === "wrong" && "✘ "}{option}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div role="status" className="animate-pop rounded-xl bg-indigo-500/10 p-3 text-sm">
          <p className="font-bold">{picked === q.answer ? "Correct!" : "Not quite."}</p>
          <p>{q.explanation}</p>
        </div>
      )}
      <button className="btn-primary" disabled={picked === null} onClick={next}>{index + 1 === questions.length ? "See my score" : "Next question"}</button>
    </div>
  );
}
