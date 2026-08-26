export type AnswerBlock =
  | { kind: "key" | "info" | "warn"; text: string }
  | { kind: "section"; text: string };

export type ParsedAnswer = {
  question: string | null;
  blocks: AnswerBlock[];
  scores: { label: string; score: string }[];
  total: string | null;
  raw: string;
};

/** Parses the tagged answer format produced by ANSWER_SYSTEM. */
export function parseAnswer(raw: string): ParsedAnswer {
  const lines = raw.split(/\r?\n/);
  let question: string | null = null;
  const blocks: AnswerBlock[] = [];
  const scores: { label: string; score: string }[] = [];
  let total: string | null = null;

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^(QUESTION|SECTION|KEY|INFO|WARN|SCORE|TOTAL)\s*:\s*(.*)$/i);
    if (!m) {
      const last = blocks[blocks.length - 1];
      if (last && last.kind !== "section") last.text += `\n${t}`;
      else blocks.push({ kind: "info", text: t });
      continue;
    }
    const tag = m[1]!.toUpperCase();
    const value = m[2]!.trim();
    if (!value) continue;
    if (tag === "QUESTION") question = question ? `${question}\n${value}` : value;
    else if (tag === "SECTION") blocks.push({ kind: "section", text: value });
    else if (tag === "KEY") blocks.push({ kind: "key", text: value });
    else if (tag === "INFO") blocks.push({ kind: "info", text: value });
    else if (tag === "WARN") blocks.push({ kind: "warn", text: value });
    else if (tag === "SCORE") {
      const [label, score] = value.split("|");
      if (label && score) scores.push({ label: label.trim(), score: score.trim() });
    } else if (tag === "TOTAL") total = value;
  }

  return { question, blocks, scores, total, raw };
}
