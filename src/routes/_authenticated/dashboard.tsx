import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BADGES, SUBJECTS, MOTIVATION } from "@/lib/subjects";
import { todayISO } from "@/lib/progress";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Imtihanat" },
      {
        name: "description",
        content:
          "Track your BAC progress: average out of 20 per subject, streaks, badges and today's challenge.",
      },
      { property: "og:title", content: "Dashboard — Imtihanat" },
      {
        property: "og:description",
        content: "See where you are strong, where you slip, and what to revise next.",
      },
    ],
  }),
  component: Dashboard,
});

type Attempt = { subject: string; score: number | null; created_at: string };

function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{
    full_name: string | null;
    xp: number;
    streak: number;
  } | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [badges, setBadges] = useState<string[]>([]);
  const [dailyDone, setDailyDone] = useState(false);
  const quote = MOTIVATION[new Date().getDate() % MOTIVATION.length];

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [p, a, b, d] = await Promise.all([
        supabase.from("profiles").select("full_name, xp, streak").eq("id", user.id).maybeSingle(),
        supabase
          .from("quiz_attempts")
          .select("subject, score, created_at")
          .eq("user_id", user.id)
          .not("score", "is", null)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("user_badges").select("code").eq("user_id", user.id),
        supabase
          .from("daily_challenges")
          .select("completed")
          .eq("user_id", user.id)
          .eq("challenge_date", todayISO())
          .maybeSingle(),
      ]);
      setProfile(p.data as never);
      setAttempts((a.data ?? []) as Attempt[]);
      setBadges((b.data ?? []).map((r) => r.code as string));
      setDailyDone(Boolean(d.data?.completed));
    })();
  }, [user]);

  const bySubject = SUBJECTS.map((s) => {
    const rows = attempts.filter((r) => r.subject === s && r.score != null);
    const avg = rows.length
      ? rows.reduce((sum, r) => sum + Number(r.score), 0) / rows.length
      : null;
    return { subject: s, avg, attempts: rows.length };
  });

  const studied = bySubject.filter((s) => s.avg != null);
  const overall = studied.length
    ? studied.reduce((sum, s) => sum + (s.avg ?? 0), 0) / studied.length
    : null;
  const weakest = [...studied].sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0)).slice(0, 3);

  return (
    <div className="rise space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </p>
          <h1 className="mt-3 text-5xl md:text-6xl">
            {overall != null ? overall.toFixed(1) : "—"}
            <span className="text-muted-foreground">/20</span>
          </h1>
          <p className="mt-2 max-w-md text-sm italic text-muted-foreground">{quote}</p>
        </div>
        <div className="flex gap-3">
          <Stat label="Streak" value={`${profile?.streak ?? 0}d`} />
          <Stat label="XP" value={String(profile?.xp ?? 0)} />
          <Stat label="Quizzes" value={String(attempts.length)} />
        </div>
      </header>

      <section className="grid gap-5 md:grid-cols-3">
        <Link
          to="/quiz"
          search={{ daily: true }}
          className="paper block p-6 transition-transform hover:-translate-y-1"
        >
          <p className="text-[11px] uppercase tracking-widest text-accent-foreground/70">
            Daily challenge
          </p>
          <h2 className="mt-3 text-2xl">{dailyDone ? "Done for today ✓" : "3 questions, mixed"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {dailyDone ? "Come back tomorrow to keep the streak." : "Worth 60 XP and keeps your streak alive."}
          </p>
        </Link>
        <Link to="/scan" className="paper block p-6 transition-transform hover:-translate-y-1">
          <p className="text-[11px] uppercase tracking-widest text-accent-foreground/70">Camera</p>
          <h2 className="mt-3 text-2xl">Scan a page</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Grade handwriting, solve an exercise or translate a passage.
          </p>
        </Link>
        <Link to="/tutor" className="paper block p-6 transition-transform hover:-translate-y-1">
          <p className="text-[11px] uppercase tracking-widest text-accent-foreground/70">Tutor</p>
          <h2 className="mt-3 text-2xl">Ask a question</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Hints and guiding questions, in your language.
          </p>
        </Link>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="paper p-7">
          <h2 className="text-2xl">Subject averages</h2>
          <ul className="mt-5 space-y-3">
            {bySubject.map((s) => (
              <li key={s.subject}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{s.subject}</span>
                  <span className="text-muted-foreground">
                    {s.avg != null ? `${s.avg.toFixed(1)}/20` : "not started"}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-all ${
                      s.avg == null
                        ? "bg-transparent"
                        : s.avg >= 14
                          ? "bg-success"
                          : s.avg >= 10
                            ? "bg-primary"
                            : "bg-destructive"
                    }`}
                    style={{ width: `${((s.avg ?? 0) / 20) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          <div className="paper p-7">
            <h2 className="text-2xl">Revise these next</h2>
            {weakest.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Take a few quizzes and your weak points will show up here.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {weakest.map((s) => (
                  <li key={s.subject} className="flex items-center justify-between text-sm">
                    <span>{s.subject}</span>
                    <Link
                      to="/quiz"
                      search={{ daily: false }}
                      className="rounded-full bg-secondary px-3 py-1 text-xs"
                    >
                      Practise
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="paper p-7">
            <h2 className="text-2xl">Badges</h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {Object.entries(BADGES).map(([code, b]) => {
                const earned = badges.includes(code);
                return (
                  <li
                    key={code}
                    className={`rounded-lg border p-3 ${
                      earned ? "border-primary/40 bg-primary/10" : "border-border opacity-50"
                    }`}
                  >
                    <p className="font-medium">{b.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{b.hint}</p>
                  </li>
                );
              })}

            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="paper px-5 py-4 text-center">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
