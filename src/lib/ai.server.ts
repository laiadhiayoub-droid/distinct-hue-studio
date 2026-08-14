type Block =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Block[];
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export async function chat(
  messages: ChatMessage[],
  model = "google/gemini-3.5-flash",
): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured yet.");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({ model, messages, reasoning_effort: "none" }),
  });

  if (res.status === 429) throw new Error("Too many requests right now. Try again in a moment.");
  if (res.status === 402) throw new Error("AI credits are exhausted for this workspace.");
  if (!res.ok) {
    const detail = await res.text();
    console.error("AI gateway error", res.status, detail);
    throw new Error("The AI examiner could not be reached. Please try again.");
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return stripThinking(json.choices?.[0]?.message?.content ?? "");
}

/** Removes any leaked chain-of-thought so students only see the final answer. */
export function stripThinking(text: string): string {
  return text
    .replace(/<(think|thinking|reasoning)>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(think|thinking|reasoning)>[\s\S]*/gi, "")
    .replace(/^\s*(?:#{1,6}\s*)?\**\s*(?:thoughts?|thinking|reasoning|internal monologue)\s*\**\s*:?[^\n]*\n(?:[\s\S]*?\n)?(?=\s*(?:#{1,6}\s*)?\**\s*(?:answer|final answer|grade|response)\b)/gi, "")
    .trim();
}

export function extractGrade(text: string): number | null {
  const match = text.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*\/\s*20/);
  if (!match) return null;
  const value = Number(match[1]!.replace(",", "."));
  return Number.isFinite(value) ? Math.min(20, Math.max(0, value)) : null;
}
