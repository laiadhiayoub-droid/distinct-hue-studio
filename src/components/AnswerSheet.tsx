import { parseAnswer } from "@/lib/answer-format";

function today() {
  return new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function AnswerSheet({
  text,
  subject,
}: {
  text: string;
  subject?: string | null;
}) {
  const parsed = parseAnswer(text);
  const hasStructure =
    parsed.blocks.length > 0 || parsed.question || parsed.scores.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border-2 border-foreground/25 bg-card">
      <div className="border-b-2 border-foreground/25 bg-secondary px-4 py-3 text-sm font-semibold tracking-wide">
        📝 Answer{subject ? ` — ${subject}` : ""} — {today()}
      </div>

      <div className="space-y-4 p-4 md:p-5">
        {parsed.question && (
          <div className="rounded-lg border border-dashed border-foreground/30 bg-background/60 p-3">
            <p className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">
              Question
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{parsed.question}</p>
          </div>
        )}

        {!hasStructure ? (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{parsed.raw}</div>
        ) : (
          <div className="space-y-3 ps-1">
            {parsed.blocks.map((b, i) =>
              b.kind === "section" ? (
                <h3 key={i} className="pt-2 text-base font-semibold">
                  {b.text}
                </h3>
              ) : (
                <div
                  key={i}
                  className={`rounded-lg border-s-4 p-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    b.kind === "key"
                      ? "border-s-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                      : b.kind === "warn"
                        ? "border-s-orange-500 bg-orange-500/10 text-orange-900 dark:text-orange-100"
                        : "border-s-sky-500 bg-sky-500/10 text-sky-900 dark:text-sky-100"
                  }`}
                >
                  <span className="me-2">
                    {b.kind === "key" ? "✅" : b.kind === "warn" ? "⚠️" : "💡"}
                  </span>
                  {b.text}
                </div>
              ),
            )}
          </div>
        )}

        {parsed.scores.length > 0 && (
          <table className="w-full border-collapse border-2 border-foreground/25 text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="border border-foreground/20 px-3 py-2 text-start">Category</th>
                <th className="border border-foreground/20 px-3 py-2 text-start">Score</th>
              </tr>
            </thead>
            <tbody>
              {parsed.scores.map((s, i) => (
                <tr key={i}>
                  <td className="border border-foreground/20 px-3 py-2">{s.label}</td>
                  <td className="border border-foreground/20 px-3 py-2 tabular-nums">{s.score}</td>
                </tr>
              ))}
              {parsed.total && (
                <tr className="font-semibold">
                  <td className="border border-foreground/20 px-3 py-2">Total</td>
                  <td className="border border-foreground/20 px-3 py-2 tabular-nums">
                    {parsed.total}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
