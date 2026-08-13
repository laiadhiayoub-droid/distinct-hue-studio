import { createFileRoute, Link } from "@tanstack/react-router";

import { SUBJECTS } from "@/lib/subjects";

export const Route = createFileRoute("/")({
  component: Landing,
});

const FEATURES = [
  {
    kicker: "01 — Question bank",
    title: "Timed quizzes, never the same twice",
    body: "Pick a subject, set the clock, and get a randomised mix of multiple-choice, short-answer and essay questions aligned with the Algerian programme.",
  },
  {
    kicker: "02 — AI examiner",
    title: "Marked out of 20, like the real thing",
    body: "Your essays come back with a grade, your strengths, your weaknesses and concrete next steps — never a ready-made model answer to copy.",
  },
  {
    kicker: "03 — Camera",
    title: "Photograph the page, get the method",
    body: "Snap handwriting, a diagram or a maths exercise. The assistant reads it, explains it step by step, or translates it between Arabic, French and English.",
  },
  {
    kicker: "04 — Tutor",
    title: "A patient voice at midnight",
    body: "Ask anything from the programme in the language you think in. You get hints and leading questions first, answers only once you are close.",
  },
];

function Landing() {
  return (
    <main className="grain relative min-h-screen overflow-hidden">
      <div className="rule-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="drifting pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/25 blur-3xl" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
        <span className="text-xs font-semibold uppercase tracking-[0.35em]">Imtihanat</span>
        <Link
          to="/auth"
          className="rounded-full border border-border bg-card px-5 py-2 text-sm font-medium transition-colors hover:bg-secondary"
        >
          Sign in
        </Link>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-10">
        <div className="grid gap-12 md:grid-cols-[1.35fr_1fr] md:items-end">
          <div className="rise">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              3AS · Foreign Languages · Algeria
            </p>
            <h1 className="mt-6 text-5xl leading-[0.95] md:text-8xl">
              Revise like
              <br />
              <span className="text-primary">the examiner</span>
              <br />
              is watching.
            </h1>
          </div>
          <div className="rise space-y-6 md:pb-4" style={{ animationDelay: "140ms" }}>
            <p className="text-base leading-relaxed text-muted-foreground">
              A calm, private study desk for the Algerian BAC: eleven subjects, an AI examiner
              that marks out of 20, a camera that reads your handwriting, and a tutor that
              refuses to just hand you the answer.
            </p>
            <Link
              to="/auth"
              className="inline-flex items-center rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Start studying free
            </Link>
          </div>
        </div>

        <ul className="rise mt-16 flex flex-wrap gap-2" style={{ animationDelay: "220ms" }}>
          {SUBJECTS.map((s) => (
            <li
              key={s}
              className="rounded-full border border-border bg-card/70 px-4 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {s}
            </li>
          ))}
        </ul>
      </section>

      <section className="relative mx-auto max-w-6xl px-6 pb-28">
        <div className="grid gap-6 md:grid-cols-2">
          {FEATURES.map((f, i) => (
            <article
              key={f.kicker}
              className={`paper rise p-8 ${i % 2 === 1 ? "md:translate-y-8" : ""}`}
              style={{ animationDelay: `${180 + i * 90}ms` }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-accent-foreground/70">
                {f.kicker}
              </p>
              <h2 className="mt-4 text-2xl leading-snug">{f.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="relative border-t border-border/70 py-8 text-center text-xs text-muted-foreground">
        Your work stays yours — every quiz, photo and note is private to your account.
      </footer>
    </main>
  );
}
