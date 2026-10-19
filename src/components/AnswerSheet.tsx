type Line =
  | { kind: "key" | "info" | "warn" | "step"; text: string }
  | { kind: "code"; lines: string[] }
  | { kind: "table"; header: string[]; rows: string[][] };

export type Block = {
  title: string | null;
  question: string | null;
  lines: Line[];
};

export type ParsedAnswer = {
  subject: string | null;
  blocks: Block[];
  count: number;
};

const splitCells = (s: string) =>
  s
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export function parseAnswer(raw: string): ParsedAnswer {
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

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    let m = line.match(/^(?:EXERCISE|EXERCICE|التمرين|تمرين)\s*:\s*(.+)$/i);
    if (m) {
      blocks.push({ title: m[1]!, question: null, lines: [] });
      continue;
    }
    if ((m = line.match(/^SUBJECT\s*:\s*(.+)$/i))) {
      subject = m[1]!;
      continue;
    }
    if ((m = line.match(/^QUESTION\s*:\s*(.+)$/i))) {
      const b = current();
      if (b.question || b.lines.length) blocks.push({ title: null, question: m[1]!, lines: [] });
      else b.question = m[1]!;
      continue;
    }
    if ((m = line.match(/^TABLE\s*:\s*(.+)$/i))) {
      current().lines.push({ kind: "table", header: splitCells(m[1]!), rows: [] });
      continue;
    }
    if ((m = line.match(/^ROW\s*:\s*(.+)$/i))) {
      const b = current();
      const last = b.lines[b.lines.length - 1];
      if (last?.kind === "table") last.rows.push(splitCells(m[1]!));
      else b.lines.push({ kind: "table", header: [], rows: [splitCells(m[1]!)] });
      continue;
    }
    if ((m = line.match(/^CODE\s*:\s?(.*)$/i))) {
      const b = current();
      const last = b.lines[b.lines.length - 1];
      if (last?.kind === "code") last.lines.push(m[1]!);
      else b.lines.push({ kind: "code", lines: [m[1]!] });
      continue;
    }
    if ((m = line.match(/^(KEY|INFO|WARN|STEP)\s*:\s*(.+)$/i))) {
      current().lines.push({
        kind: m[1]!.toLowerCase() as "key" | "info" | "warn" | "step",
        text: m[2]!,
      });
    }
  }

  return { subject, blocks, count: blocks.reduce((n, b) => n + b.lines.length, 0) };
}

/** Plain-text version for the Copy button. */
export function answerToText(raw: string): string {
  const p = parseAnswer(raw);
  if (p.count === 0) return raw;
  const out: string[] = [];
  for (const b of p.blocks) {
    if (b.title) out.push(`■ ${b.title}`);
    if (b.question) out.push(b.question, "");
    let n = 0;
    for (const l of b.lines) {
      if (l.kind === "step") out.push(`${++n}. ${l.text}`);
      else if (l.kind === "key") out.push(`✅ ${l.text}`);
      else if (l.kind === "info") out.push(`💡 ${l.text}`);
      else if (l.kind === "warn") out.push(`⚠️ ${l.text}`);
      else if (l.kind === "code") out.push(...l.lines.map((c) => `    ${c}`));
      else out.push(...[l.header, ...l.rows].filter((r) => r.length).map((r) => r.join(" | ")));
    }
    out.push("");
  }
  return out.join("\n").trim();
}

const STYLE: Record<"key" | "info" | "warn", { icon: string; cls: string }> = {
  key: { icon: "✅", cls: "border-success bg-success/10 font-semibold" },
  info: { icon: "💡", cls: "border-info/70 bg-info/10" },
  warn: { icon: "⚠️", cls: "border-warning bg-warning/15" },
};

/** Keeps Latin/maths runs left-to-right inside Arabic text. */
function BidiText({ text }: { text: string }) {
  const parts = text.split(/([^\u0600-\u06FF\n]{3,})/g).filter(Boolean);
  return (
    <span dir="auto">
      {parts.map((p, i) =>
        /[\u0600-\u06FF]/.test(p) ? (
          <span key={i}>{p}</span>
        ) : (
          <bdi key={i} dir="ltr">
            {p}
          </bdi>
        ),
      )}
    </span>
  );
}

export function AnswerSheet({ text, subject }: { text: string; subject?: string | null }) {
  const parsed = parseAnswer(text);
  if (parsed.count === 0) {
    return <div className="whitespace-pre-wrap text-sm leading-relaxed">{text}</div>;
  }

  const date = new Date().toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="overflow-hidden rounded-xl border-2 border-foreground/80 bg-card">
      <header className="bg-foreground px-5 py-3 text-sm font-bold tracking-wide text-background">
        📝 Solution — {subject || parsed.subject || "General"} — {date}
      </header>

      {parsed.blocks.map((block, bi) => {
        let step = 0;
        return (
          <div key={bi} className={bi > 0 ? "border-t-2 border-foreground/30" : undefined}>
            {block.title && (
              <h3 dir="auto" className="border-b-2 border-primary bg-primary/10 px-5 py-3 text-lg font-extrabold text-foreground">
                {block.title}
              </h3>
            )}
            {block.question && (
              <section className="border-b border-dashed border-border px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Question</p>
                <p dir="auto" className="mt-1.5 text-sm leading-relaxed">
                  <BidiText text={block.question} />
                </p>
              </section>
            )}

            <section className="space-y-2.5 px-5 py-5">
              {block.lines.map((l, i) => {
                if (l.kind === "table")
                  return (
                    <div key={i} className="overflow-x-auto rounded-lg border-2 border-foreground/40">
                      <table className="w-full border-collapse text-center text-sm">
                        {l.header.length > 0 && (
                          <thead className="bg-secondary">
                            <tr>
                              {l.header.map((h, hi) => (
                                <th key={hi} className="border border-border px-3 py-2 font-bold">
                                  <BidiText text={h} />
                                </th>
                              ))}
                            </tr>
                          </thead>
                        )}
                        <tbody>
                          {l.rows.map((row, ri) => (
                            <tr key={ri} className="even:bg-secondary/30">
                              {row.map((c, ci) => (
                                <td key={ci} className="border border-border px-3 py-2">
                                  <BidiText text={c} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                if (l.kind === "code")
                  return (
                    <pre
                      key={i}
                      dir="auto"
                      className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-muted px-4 py-3 font-mono text-[13px] leading-relaxed text-foreground"
                    >
                      {l.lines.join("\n")}
                    </pre>
                  );
                if (l.kind === "step") {
                  step += 1;
                  return (
                    <div key={i} className="flex items-start gap-3 text-sm leading-relaxed">
                      <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-bold text-background">
                        {step}
                      </span>
                      <BidiText text={l.text} />
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    className={`flex gap-3 rounded-lg border-s-4 px-4 py-3 text-sm leading-relaxed text-foreground ${STYLE[l.kind].cls}`}
                  >
                    <span aria-hidden>{STYLE[l.kind].icon}</span>
                    <BidiText text={l.text} />
                  </div>
                );
              })}
            </section>
          </div>
        );
      })}
    </div>
  );
}
