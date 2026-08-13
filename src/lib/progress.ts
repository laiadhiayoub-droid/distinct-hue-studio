import { supabase } from "@/integrations/supabase/client";

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function awardBadge(userId: string, code: string) {
  await supabase.from("user_badges").insert({ user_id: userId, code }).select().maybeSingle();
}

/** Adds XP, updates the day streak and returns the fresh profile row. */
export async function registerStudyDay(userId: string, xp: number) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("xp, streak, longest_streak, last_study_date")
    .eq("id", userId)
    .maybeSingle();

  const today = todayISO();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const last = profile?.last_study_date ?? null;
  const streak = last === today ? (profile?.streak ?? 1) : last === yesterday ? (profile?.streak ?? 0) + 1 : 1;

  const next = {
    xp: (profile?.xp ?? 0) + xp,
    streak,
    longest_streak: Math.max(profile?.longest_streak ?? 0, streak),
    last_study_date: today,
  };

  await supabase.from("profiles").update(next).eq("id", userId);

  if (streak >= 7) await awardBadge(userId, "streak_7");
  return next;
}

export async function checkVolumeBadges(userId: string) {
  const [{ count: quizzes }, { count: images }] = await Promise.all([
    supabase
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("completed_at", "is", null),
    supabase.from("uploads").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  if ((quizzes ?? 0) >= 1) await awardBadge(userId, "first_quiz");
  if ((quizzes ?? 0) >= 50) await awardBadge(userId, "quizzes_50");
  if ((images ?? 0) >= 10) await awardBadge(userId, "images_10");
}

/** Awards the improvement badge when the latest score beats the earlier average by 5+. */
export async function checkImprovement(userId: string, subject: string, latest: number) {
  const { data } = await supabase
    .from("quiz_attempts")
    .select("score")
    .eq("user_id", userId)
    .eq("subject", subject)
    .not("score", "is", null)
    .order("created_at", { ascending: true })
    .limit(20);

  const earlier = (data ?? []).slice(0, -1).map((r) => Number(r.score));
  if (earlier.length < 2) return;
  const avg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
  if (latest - avg >= 5) await awardBadge(userId, "improve_5");
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
