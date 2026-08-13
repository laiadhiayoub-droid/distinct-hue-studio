import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { gradeAnswer } from "@/lib/study.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SUBJECTS, MOTIVATION } from "@/lib/subjects";
import {
  checkImprovement,
  checkVolumeBadges,
  registerStudyDay,
  shuffle,
  todayISO,
} from "@/lib/progress";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/quiz")({
  validateSearch: (search: Record<string, unknown>) => ({
    daily: search["daily"] === true || search["daily"] === "true",
  }),
  head: () => ({
    meta: [
      { title: "Take a quiz — Imtihanat" },
      {
        name: "description",
        content:
          "Timed, randomised quizzes across the eleven BAC subjects with AI marking out of 20.",
      },
      { property: "og:title", content: "Take a quiz — Imtihanat" },
      {
        property: "og:description",
        content: "Pick a subject, start the timer and get examiner-style feedback.",
      },
    ],
  }),
  component: QuizPage,
});

type Question = {
  id: string;
  subject: string;
  qtype: "mcq" | "short" | "essay";
  prompt: string;
  choices: string[] | null;
  correct_answer: string | null;
  explanation: string | null;
};

type Graded = {
  question: Question;
  answer: string;
  correct: boolean | null;
  score: number;
  feedback: string | null;
};

function QuizPage() {
  const { user } = useAuth();
  const { daily } = Route.useSearch();
  const grade = useServerFn(gradeAnswer);

  const [subject, setSubject] = useState<string>(daily ? "Daily Challenge" : "");
  const [count, setCount] = useState(5);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{ score: number; items: Graded[] } | null>(null);

  const quote = useMemo(() => MOTIVATION[Math.floor(Math.random() * MOTIVATION.length)], [results]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (daily && user && !questions) void start(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily, user]);

  async function start(isDaily = false) {
    if (!isDaily && !subject) {
      toast.error("Pick a subject first.");
      return;
    }
    let query = supabase
      .from("questions")
      .select("id, subject, qtype, prompt, choices, correct_answer, explanation");
    if (!isDaily) query = query.eq("subject", subject);

    const { data, error } = await query;
    if (error || !data?.length) {
      toast.error("No questions available yet for this subject.");
      return;
    }

    const picked = shuffle(data as unknown as Question[]).slice(0, isDaily ? 3 : count);
    setQuestions(picked);
    setAnswers({});
    setResults(null);
    setSeconds(0);
    setRunning(true);

    if (isDaily && user) {
      await supabase.from("daily_challenges").upsert(
        {
          user_id: user.id,
          challenge_date: todayISO(),
          question_ids: picked.map((q) => q.id),
        },
        { onConflict: "user_id,challenge_date" },
      );
    }
  }

  async function submit() {
    if (!questions || !user) return;
    setSubmitting(true);
    setRunning(false);

    try {
      const items: Graded[] = [];

      for (const q of questions) {
        const answer = (answers[q.id] ?? "").trim();

        if (q.qtype === "mcq") {
          const correct = answer === q.correct_answer;
          items.push({ question: q, answer, correct, score: correct ? 20 : 0, feedback: q.explanation });
          continue;
        }

        if (!answer) {
          items.push({ question: q, answer, correct: false, score: 0, feedback: "No answer given." });
          continue;
        }

        const res = await grade({
          data: {
            subject: q.subject,
            question: q.prompt,
            answer,
            guidance: q.explanation ?? q.correct_answer ?? null,
          },
        });
        items.push({
          question: q,
          answer,
          correct: null,
          score: res.grade ?? 10,
          feedback: res.feedback,
        });
      }

      const score = Number(
        (items.reduce((sum, i) => sum + i.score, 0) / items.length).toFixed(2),
      );

      const { data: attempt } = await supabase
        .from("quiz_attempts")
        .insert({
          user_id: user.id,
          subject: questions[0]?.subject ?? subject ?? "Mixed",
          score,
          total_questions: items.length,
          duration_seconds: seconds,
          is_daily_challenge: daily,
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (attempt) {
        await supabase.from("quiz_answers").insert(
          items.map((i) => ({
            attempt_id: attempt.id,
            user_id: user.id,
            question_id: i.question.id,
            answer: i.answer,
            is_correct: i.correct,
            ai_grade: i.question.qtype === "mcq" ? null : i.score,
            ai_feedback: i.feedback,
          })),
        );
      }

      if (daily) {
        await supabase
          .from("daily_challenges")
          .update({ completed: true, xp_awarded: 60 })
          .eq("user_id", user.id)
          .eq("challenge_date", todayISO());
      }

      await registerStudyDay(user.id, daily ? 60 : 10 * items.length);
      await checkVolumeBadges(user.id);
      await checkImprovement(user.id, questions[0]?.subject ?? subject, score);

      setResults({ score, items });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not mark your quiz.");
      setRunning(true);
    } finally {
      setSubmitting(false);
    }
  }

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  if (results) {
    return (
      <div className="rise mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Result</p>
        <h1 className="mt-3 text-5xl md:text-6xl">
          {results.score.toFixed(2)}
          <span className="text-muted-foreground">/20</span>
        </h1>
        <p className="mt-3 text-sm italic text-muted-foreground">{quote}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {results.items.length} questions · {mmss}
        </p>

        <div className="mt-8 space-y-4">
          {results.items.map((item, i) => (
            <article key={item.question.id} className="paper p-6">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg leading-snug">
                  {i + 1}. {item.question.prompt}
                </h2>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    item.score >= 10
                      ? "bg-success/20 text-success-foreground"
                      : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {item.score}/20
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Your answer: </span>
                {item.answer || "—"}
              </p>
              {item.feedback && (
                <div className="mt-3 whitespace-pre-wrap rounded-lg bg-secondary/60 p-4 text-sm leading-relaxed">
                  {item.feedback}
                </div>
              )}
            </article>
          ))}
        </div>

        <Button
          className="mt-8"
          onClick={() => {
            setQuestions(null);
            setResults(null);
          }}
        >
          Another quiz
        </Button>
      </div>
    );
  }

  if (!questions) {
    return (
      <div className="rise mx-auto max-w-2xl">
        <h1 className="text-4xl md:text-5xl">New quiz</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Questions are drawn at random from the bank, so no two sessions repeat.
        </p>

        <div className="paper mt-8 space-y-6 p-7">
          <div>
            <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Subject</p>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    subject === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
              Questions
            </p>
            <div className="flex gap-2">
              {[3, 5, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`rounded-full border px-4 py-1.5 text-sm ${
                    count === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" onClick={() => void start(false)}>
            Start the timer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rise mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl">{daily ? "Daily challenge" : subject}</h1>
        <span className="rounded-full bg-secondary px-4 py-1.5 font-mono text-sm">{mmss}</span>
      </div>

      <div className="mt-8 space-y-5">
        {questions.map((q, i) => (
          <article key={q.id} className="paper p-6">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {q.subject} · {q.qtype === "mcq" ? "Multiple choice" : q.qtype === "short" ? "Short answer" : "Essay"}
            </p>
            <h2 className="mt-3 text-lg leading-snug">
              {i + 1}. {q.prompt}
            </h2>

            {q.qtype === "mcq" && q.choices ? (
              <div className="mt-4 space-y-2">
                {q.choices.map((choice) => (
                  <label
                    key={choice}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                      answers[q.id] === choice
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-secondary/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      className="accent-[var(--primary)]"
                      checked={answers[q.id] === choice}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: choice }))}
                    />
                    {choice}
                  </label>
                ))}
              </div>
            ) : (
              <Textarea
                className="mt-4"
                rows={q.qtype === "essay" ? 8 : 3}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                placeholder={
                  q.qtype === "essay"
                    ? "Write your full answer — introduction, development, conclusion."
                    : "Your answer…"
                }
              />
            )}
          </article>
        ))}
      </div>

      <Button className="mt-8 w-full" disabled={submitting} onClick={() => void submit()}>
        {submitting ? "The examiner is marking…" : "Submit for marking"}
      </Button>
    </div>
  );
}
