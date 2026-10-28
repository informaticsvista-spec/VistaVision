import { useState } from "react";
import { Link } from "react-router-dom";
import { DataDetective } from "../components/DataDetective";
import { Quiz } from "../components/Quiz";
import { PageHeader } from "../components/ui";
import { cx } from "../lib/format";

type Panel = "detective" | "quiz" | null;

const ACTIVITIES = [
  { n: 1, icon: "😀", title: "Expression Challenge", text: "Stand in front of the camera with friends. Watch the detected faces, estimated expressions and live counts. Can you make the AI say “Surprise”?", to: "/recognition/faces", cta: "Open face tool" },
  { n: 2, icon: "✍️", title: "Draw and Predict", text: "Draw a digit on the screen with your finger and see the AI's prediction instantly. Try a messy 4 or a fancy 7!", to: "/recognition/numbers", cta: "Start drawing" },
  { n: 3, icon: "📄", title: "Paper Number Challenge", text: "Write numbers on paper with a dark pen and show them to the camera. Try two-digit numbers too.", to: "/recognition/numbers", cta: "Open number tool" },
  { n: 4, icon: "🍎", title: "Object Explorer", text: "Show an apple, banana or cup. What else does the AI know? Check the list of 80 objects, and see what it gets wrong.", to: "/recognition/objects", cta: "Explore objects" },
  { n: 5, icon: "🔎", title: "Data Detective", text: "Change the counts and see bar charts, pie charts and statistics change together.", panel: "detective" as const, cta: "Play" },
  { n: 6, icon: "🧠", title: "AI Quiz", text: "8 quick questions on AI, machine learning, computer vision, data science, charts and confidence.", panel: "quiz" as const, cta: "Take the quiz" },
];

export default function Activities() {
  const [panel, setPanel] = useState<Panel>(null);
  return (
    <div>
      <PageHeader title="Learning Activities" subtitle="Six short activities for students. Each one uses real AI or real data, and everything you do shows up in the Data Visualization dashboard." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIVITIES.map((a) => (
          <article key={a.n} className={cx("card flex flex-col", a.panel && panel === a.panel && "ring-2 ring-indigo-500")}>
            <p className="text-3xl" aria-hidden>{a.icon}</p>
            <h2 className="mt-2 text-lg font-bold">Activity {a.n}: {a.title}</h2>
            <p className="mt-1 flex-1 text-sm text-navy-700">{a.text}</p>
            {a.to ? (
              <Link to={a.to} className="btn-primary mt-3">{a.cta}</Link>
            ) : (
              <button className="btn-primary mt-3" aria-expanded={panel === a.panel} onClick={() => setPanel(panel === a.panel ? null : a.panel!)}>{panel === a.panel ? "Close" : a.cta}</button>
            )}
          </article>
        ))}
      </div>
      <div className="mt-6" aria-live="polite">
        {panel === "detective" && <DataDetective />}
        {panel === "quiz" && <Quiz />}
      </div>
    </div>
  );
}
