import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { askTutor } from "@/lib/study.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AnswerSheet } from "@/components/AnswerSheet";

export const Route = createFileRoute("/_authenticated/tutor")({
  head: () => ({
    meta: [
      { title: "AI tutor — Imtihanat" },
      {
        name: "description",
        content:
          "Ask any BAC programme question in Arabic, French, English or Tamazight and get guided hints instead of ready answers.",
      },
      { property: "og:title", content: "AI tutor — Imtihanat" },
      {
        property: "og:description",
        content: "A patient tutor that guides you to the answer with hints and questions.",
      },
    ],
  }),
  component: TutorPage,
});

type Msg = { role: "user" | "assistant"; content: string };

function TutorPage() {
  const { user } = useAuth();
  const ask = useServerFn(askTutor);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("tutor_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(40)
      .then(({ data }) => setMessages((data ?? []) as Msg[]));
  }, [user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const history = messages.slice(-10);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const res = await ask({ data: { message: text, history } });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The tutor is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rise mx-auto max-w-3xl">
      <h1 className="text-4xl md:text-5xl">Tutor</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Write in Arabic, French, English or Tamazight and get the model answer on an exam
        sheet.
      </p>

      <div className="paper mt-8 flex h-[26rem] flex-col gap-4 overflow-y-auto p-6">
        {messages.length === 0 && (
          <p className="m-auto max-w-sm text-center text-sm text-muted-foreground">
            Try: “اشرح لي فكرة الالتزام في الشعر” or “Explain the past perfect continuous with
            examples”.
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div
              key={i}
              className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground"
            >
              {m.content}
            </div>
          ) : (
            <div key={i} className="w-full self-start">
              <AnswerSheet text={m.content} />
            </div>
          ),
        )}
        {busy && (
          <div className="self-start rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
            Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-4 flex gap-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder="Ask your question…"
          className="resize-none"
        />
        <Button onClick={() => void send()} disabled={busy}>
          Send
        </Button>
      </div>
    </div>
  );
}
