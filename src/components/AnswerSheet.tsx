type Line = { kind: "key" | "info" | "warn"; text: string };
type Row = { label: string; score: string };

export type ParsedAnswer = {
  question: string | null;
  subject: string | null;
  lines: Line[];
  rows: Row[];
  raw: string;
};

export function parseAnswer(raw: string): ParsedAnswer {
  const lines = raw.split("\n").map((l) => l.trim());
  let question: string | null = null;
  let subject: string | null = null;
  const body: Line[] = [];
  const rows: Row[] = [];

  for (const line of lines) {
    if (!line) continue;
    const q = line.match(/^QUESTION\s*:\s*(.+)$/i);
    if (q) {
      question = q[1]!;
      continue;
    }
    const s = line.match(/^SUBJECT\s*:\s*(.+)$/i);
    if (s) {
      subject = s[1]!;
      continue;
    }
    const b = line.match(/^(KEY|INFO|WARN)\s*:\s*(.+)$/i);
    if (b) {
      body.push({ kind: b[1]!.toLowerCase() as Line["kind"], text: b[2]! });
      continue;
    }
    const r = line.match(/^\|?\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|?$/);
    if (r && /\d/.test(r[2]!) && !/^(QUESTION|SUBJECT|ANSWER|GRADE)$/i.test(r[1]!)) {
      rows.push({ label: r[1]!, score: r[2]! });
    }
  }

  return { question, subject, lines: body, rows, raw };
}

const STYLE: Record<Line["kind"], { icon: string; cls: string }> = {
  key: { icon: "✅", cls: "border-success/60 bg-success/10 text-foreground" },
  info: { icon: "💡", cls: "border-info/60 bg-info/10 text-foreground" },
  warn: { icon: "⚠️", cls: "border-warning/70 bg-warning/15 text-foreground" },
};

export function AnswerSheet({ text, subject }: { text: string; subject?: string | null }) {
  const parsed = parseAnswer(text);

  if (parsed.lines.length === 0 && parsed.rows.length === 0) {
    return <div className="whitespace-pre-wrap text-sm leading-relaxed">{text}</div>;
  }

  const date = new Date().toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const subjectLabel = subject || parsed.subject || "General";

  return (
    <div className="overflow-hidden rounded-xl border-2 border-ink/40 bg-card">
      <header className="border-b-2 border-ink/40 bg-secondary/70 px-5 py-3 text-sm font-semibold tracking-wide">
        📝 Answer — {subjectLabel} — {date}
      </header>

      {parsed.question && (
        <section className="border-b border-dashed border-border px-5 py-4">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Question</p>
          <p className="mt-1.5 text-sm leading-relaxed">{parsed.question}</p>
        </section>
      )}

      <section className="space-y-2.5 px-5 py-5">
        {parsed.lines.map((l, i) => (
          <div
            key={i}
            className={`flex gap-3 rounded-lg border-l-4 px-4 py-3 text-sm leading-relaxed ${STYLE[l.kind].cls}`}
          >
            <span aria-hidden>{STYLE[l.kind].icon}</span>
            <span>{l.text}</span>
          </div>
        ))}
      </section>

      {parsed.rows.length > 0 && (
        <section className="border-t-2 border-ink/30 px-5 py-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="border border-border px-3 py-2 font-medium">Category</th>
                <th className="w-24 border border-border px-3 py-2 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((r, i) => (
                <tr key={i} className={/total/i.test(r.label) ? "font-semibold" : ""}>
                  <td className="border border-border px-3 py-2">{r.label}</td>
                  <td className="border border-border px-3 py-2 font-mono">{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
