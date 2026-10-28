import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { InstitutionLogos } from "../components/InstitutionLogos";
import { Logo } from "../components/Logo";
import { useSettings } from "../settings";
import { cx } from "../lib/format";

export default function Home() {
  const [started, setStarted] = useState(false);
  const modules = useRef<HTMLElement>(null);
  const { motionOk } = useSettings();

  const start = () => {
    setStarted(true);
    requestAnimationFrame(() => modules.current?.scrollIntoView({ behavior: motionOk ? "smooth" : "auto", block: "start" }));
  };

  return (
    <div className="-mx-4 -mt-6 sm:-mx-6 lg:-mx-8">
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-cyan-500 px-4 py-14 text-white sm:px-8 sm:py-20">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className={cx("pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-sky-400/40 blur-3xl", motionOk && "animate-blob")} aria-hidden />
        <div className={cx("pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-sun-400/40 blur-3xl", motionOk && "animate-blob")} aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[1.2fr_.8fr]">
          <div>
            <InstitutionLogos height={92} className="mb-5 hidden shadow-lg sm:inline-flex" />
            <InstitutionLogos height={60} className="mb-5 shadow-lg sm:hidden" />
            <p className="block w-fit rounded-full bg-white/15 px-4 py-1 text-sm font-bold uppercase tracking-[0.2em] text-sun-300 backdrop-blur">Department of Informatics</p>
            <h1 className="mt-4 text-5xl font-extrabold tracking-tight sm:text-7xl">Vista<span className="bg-gradient-to-r from-sun-300 to-mint-300 bg-clip-text text-transparent">Vision</span></h1>
            <p className="mt-2 text-lg font-semibold text-white sm:text-xl">AI-Powered Computer Vision &amp; Data Analytics</p>
            <p className="mt-4 text-2xl font-bold italic text-sun-300 sm:text-3xl">“See Beyond. Discover Intelligence.”</p>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">
              Artificial Intelligence can <b className="text-sun-300">detect</b> faces, <b className="text-mint-300">recognise</b> handwriting and everyday objects,
              <b className="text-sky-300"> predict</b> what it sees with a confidence score, and turn all those results into charts that
              help us <b className="text-sun-300">visualise</b> data. Try it live with your camera, your finger or your own numbers!
            </p>
            <button onClick={start} className="mt-8 inline-flex min-h-[60px] items-center gap-2 rounded-2xl bg-sun-400 px-9 text-xl font-extrabold text-navy-950 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:bg-sun-300 active:translate-y-0">
              Let's Start <span aria-hidden>🚀</span>
            </button>
          </div>
          <div className="relative mx-auto flex w-full max-w-[320px] items-center justify-center py-6">
            <div className={cx("rounded-[2.5rem] bg-white/15 p-6 shadow-2xl shadow-black/25 ring-2 ring-white/40 backdrop-blur", motionOk && "animate-floaty")}>
              <Logo size={220} rounded="rounded-[2rem]" />
            </div>
            {[["😀", "left-0 top-2 sm:-left-2", "bg-sun-400"], ["🔢", "right-0 top-12 sm:-right-2", "bg-mint-400"], ["🍎", "left-0 bottom-6", "bg-coral-400"], ["📊", "right-2 bottom-2", "bg-sky-400"]].map(([e, pos, bg], i) => (
              <span key={e} aria-hidden className={cx("absolute flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shadow-lg ring-2 ring-white/60", pos, bg, motionOk && "animate-wiggle")} style={{ animationDelay: `${i * 0.4}s` }}>{e}</span>
            ))}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.5rem]" aria-hidden>
              {motionOk && <div className="scanline absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-white/30 to-transparent" />}
            </div>
          </div>
        </div>
      </section>

      {started && (
        <section ref={modules} aria-label="Choose a module" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:px-8">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Choose a module</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <Link to="/recognition" className="group animate-pop rounded-3xl bg-gradient-to-br from-indigo-600 to-sky-500 p-7 text-white shadow-lg shadow-indigo-600/30 transition hover:-translate-y-1.5 hover:rotate-[.4deg] hover:shadow-2xl">
              <p className="text-5xl" aria-hidden>👁️</p>
              <h3 className="mt-4 text-2xl font-extrabold ">1. Smart Recognition</h3>
              <p className="mt-2 text-white/90">Faces and expressions, handwritten numbers (paper or touchscreen), everyday objects and image upload.</p>
              <p className="mt-4 inline-block rounded-full bg-white/20 px-4 py-1 font-bold">Open →</p>
            </Link>
            <Link to="/data" className="group animate-pop rounded-3xl bg-gradient-to-br from-cyan-500 to-coral-400 p-7 text-white shadow-lg shadow-cyan-500/30 transition hover:-translate-y-1.5 hover:-rotate-[.4deg] hover:shadow-2xl">
              <p className="text-5xl" aria-hidden>📊</p>
              <h3 className="mt-4 text-2xl font-extrabold ">2. Data Visualization</h3>
              <p className="mt-2 text-white/90">Live charts from AI results and from numbers you type in yourself. No camera needed.</p>
              <p className="mt-4 inline-block rounded-full bg-white/20 px-4 py-1 font-bold">Open →</p>
            </Link>
          </div>
          <p className="mt-8 text-center text-sm text-navy-700">Looking for games? Try the <Link className="font-semibold text-indigo-700 underline" to="/activities">Learning Activities</Link>.</p>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-14 pt-10 sm:px-8">
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          {[["Private by default", "Photos are analysed in memory and never stored. No names, no face recognition."], ["Honest AI", "Every result shows confidence, and expressions are labelled as estimates."], ["Works anywhere", "Laptop, tablet or phone. Drawing and manual charts need no camera."]].map(([t, d]) => (
            <div key={t} className="rounded-2xl border-2 border-indigo-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300"><p className="font-bold">{t}</p><p className="mt-1 text-navy-700">{d}</p></div>
          ))}
        </div>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 text-center text-xs text-navy-700 sm:flex-row sm:text-left"><InstitutionLogos height={34} className="shrink-0" /> <span className="max-w-md">VistaVision · Department of Informatics · Periyar Maniammai Institute of Science &amp; Technology</span></div>
      </section>
    </div>
  );
}
