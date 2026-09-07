import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { analyzeUpload } from "@/lib/study.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { checkVolumeBadges, registerStudyDay } from "@/lib/progress";
import { SUBJECTS } from "@/lib/subjects";
import { Button } from "@/components/ui/button";
import { AnswerSheet } from "@/components/AnswerSheet";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({
    meta: [
      { title: "Scan & analyse — Imtihanat" },
      {
        name: "description",
        content:
          "Photograph homework, handwriting, diagrams or maths problems and get OCR plus step-by-step feedback.",
      },
      { property: "og:title", content: "Scan & analyse — Imtihanat" },
      {
        property: "og:description",
        content: "Take a photo of your work and let the AI examiner read and explain it.",
      },
    ],
  }),
  component: ScanPage,
});

const MODES = [
  { id: "grade", label: "Grade my writing" },
  { id: "solve", label: "Solve step by step" },
  { id: "explain", label: "Explain this" },
  { id: "translate", label: "Translate" },
] as const;

function ScanPage() {
  const { user } = useAuth();
  const analyze = useServerFn(analyzeUpload);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("explain");
  const [subject, setSubject] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setResult(null);
    setPreview(URL.createObjectURL(f));
  }

  async function run() {
    if (!file || !user) return;
    setBusy(true);
    setResult(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("study-uploads").upload(path, file, {
        contentType: file.type || "image/jpeg",
      });
      if (up.error) throw up.error;

      const res = await analyze({
        data: { storagePath: path, mode, subject: subject || null },
      });
      setResult(res.analysis);
      await registerStudyDay(user.id, 15);
      await checkVolumeBadges(user.id);
      toast.success("Analysis ready (+15 XP)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not analyse that image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rise grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <h1 className="text-4xl md:text-5xl">Scan your page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Handwritten essay, textbook page, a graph, or a maths exercise — the assistant reads
          it and works with you on it.
        </p>

        <div className="paper mt-7 space-y-5 p-6">
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" onClick={() => cameraRef.current?.click()}>
              📷 Take a photo
            </Button>
            <Button size="lg" variant="outline" onClick={() => fileRef.current?.click()}>
              Upload image
            </Button>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              What should I do with it?
            </p>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    mode === m.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              Subject (optional)
            </p>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            >
              <option value="">Not specified</option>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {preview && (
            <img
              src={preview}
              alt="Preview of the page you uploaded"
              className="max-h-64 w-full rounded-lg border border-border object-contain"
            />
          )}

          <Button className="w-full" disabled={!file || busy} onClick={() => void run()}>
            {busy ? "Reading your page…" : "Analyse"}
          </Button>
        </div>
      </div>

      <div className="paper min-h-[24rem] p-7">
        <h2 className="text-2xl">Answer</h2>
        {!result && !busy && (
          <p className="mt-4 text-sm text-muted-foreground">
            The model answer to your page will appear here.
          </p>
        )}
        {busy && <p className="mt-4 text-sm text-muted-foreground">Working through it…</p>}
        {result && (
          <div className="mt-4">
            <AnswerSheet text={result} subject={subject || null} />
          </div>
        )}
      </div>
    </div>
  );
}
