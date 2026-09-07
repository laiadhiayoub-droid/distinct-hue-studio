type Line = { kind: "key" | "info" | "warn"; text: string };

export type Block = {
  title: string | null;
  question: string | null;
  lines: Line[];
};

export type ParsedAnswer = {
  question: string | null;
  subject: string | null;
  lines: Line[];
  blocks: Block[];
  raw: string;
};

export function parseAnswer(raw: string): ParsedAnswer {
  const rawLines = raw.split("\n").map((l) => l.trim());
  let subject: string | null = null;
  const blocks: Block[] = [];

  const current = (): Block => {
    let b = blocks[blocks.length - 1];
    if (!b) {
      b = { title: null, question: null, lines: [] };
      blocks.push(b);
    }
    return b;
  };

  for (const line of rawLines) {
    if (!line) continue;

    const e = line.match(/^(?:EXERCISE|EXERCICE|التمرين|تمرين)\s*:\s*(.+)$/i);
    if (e) {
      blocks.push({ title: e[1]!, question: null, lines: [] });
      continue;
    }

    const s = line.match(/^SUBJECT\s*:\s*(.+)$/i);
    if (s) {
      subject = s[1]!;
      continue;
    }

    const q = line.match(/^QUESTION\s*:\s*(.+)$/i);
    if (q) {
      const b = current();
      if (b.question || b.lines.length) {
        blocks.push({ title: null, question: q[1]!, lines: [] });
      } else {
        b.question = q[1]!;
      }
      continue;
    }

    const b = line.match(/^(KEY|INFO|WARN)\s*:\s*(.+)$/i);
    if (b) {
      current().lines.push({
        kind: b[1]!.toLowerCase() as Line["kind"],
        text: b[2]!,
      });
      continue;
    }
  }

  const all = blocks.flatMap((b) => b.lines);
  return {
    question: blocks[0]?.question ?? null,
    subject,
    lines: all,
    blocks,
    raw,
  };
}

const STYLE: Record<Line["kind"], { icon: string; cls: string }> = {
  key: { icon: "✅", cls: "border-success/60 bg-success/10 text-foreground" },
  info: { icon: "💡", cls: "border-info/60 bg-info/10 text-foreground" },
  warn: { icon: "⚠️", cls: "border-warning/70 bg-warning/15 text-foreground" },
};

export function AnswerSheet({ text, subject }: { text: string; subject?: string | null }) {
  const parsed = parseAnswer(text);

  if (parsed.lines.length === 0) {
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

      {parsed.blocks.map((block, bi) => (
        <div key={bi} className={bi > 0 ? "border-t-2 border-ink/25" : undefined}>
          {block.title && (
            <div className="bg-secondary/40 px-5 py-2.5 text-sm font-semibold">{block.title}</div>
          )}

          {block.question && (
            <section className="border-b border-dashed border-border px-5 py-4">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Question
              </p>
              <p className="mt-1.5 text-sm leading-relaxed">{block.question}</p>
            </section>
          )}

          <section className="space-y-2.5 px-5 py-5">
            {block.lines.map((l, i) => (
              <div
                key={i}
                className={`flex gap-3 rounded-lg border-l-4 px-4 py-3 text-sm leading-relaxed ${STYLE[l.kind].cls}`}
              >
                <span aria-hidden>{STYLE[l.kind].icon}</span>
                <span>{l.text}</span>
              </div>
            ))}
          </section>
        </div>
      ))}
    </div>
  );
}
