import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { solveExam } from "@/lib/study.functions";
import { enhanceScan, normalizeOriginal } from "@/lib/enhance";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SUBJECTS } from "@/lib/subjects";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { AnswerSheet, answerToText } from "@/components/AnswerSheet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Exam & Exercise Solver — محلل الاختبارات والتمارين" },
      {
        name: "description",
        content:
          "Photograph any exam or exercise sheet, pick the subject, and get a detailed step-by-step AI solution.",
      },
      { property: "og:title", content: "Exam & Exercise Solver — محلل الاختبارات والتمارين" },
      {
        property: "og:description",
        content: "Upload an exam photo, choose the subject, get every exercise solved step by step.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Solver,
});

type Stage = "idle" | "enhancing" | "uploading" | "solving";
const STAGE_LABEL: Record<Stage, string> = {
  idle: "",
  enhancing: "Enhancing image…",
  uploading: "Uploading…",
  solving: "Reading & solving every exercise…",
};

function Solver() {
  const { user, loading } = useAuth();
  const solve = useServerFn(solveExam);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [subject, setSubject] = useState<string>("");
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<string | null>(null);
  const [solvedFor, setSolvedFor] = useState<string>("");
  const busy = stage !== "idle";

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setRotation(0);
    setEnhancedUrl(null);
    setResult(null);
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setEnhancedUrl(null);
    setResult(null);
    setRotation(0);
  }

  async function run() {
    if (!file || !user) return;
    setResult(null);
    try {
      setStage("enhancing");
      const [enhanced, original] = await Promise.all([
        enhanceScan(file, rotation),
        normalizeOriginal(file, rotation),
      ]);
      setEnhancedUrl(URL.createObjectURL(enhanced));

      setStage("uploading");
      const base = `${user.id}/${Date.now()}`;
      const enhancedPath = `${base}-enhanced.jpg`;
      const originalPath = `${base}-original.jpg`;
      const ups = await Promise.all([
        supabase.storage.from("study-uploads").upload(enhancedPath, enhanced, { contentType: "image/jpeg" }),
        supabase.storage.from("study-uploads").upload(originalPath, original, { contentType: "image/jpeg" }),
      ]);
      const upErr = ups.find((u) => u.error)?.error;
      if (upErr) throw upErr;

      setStage("solving");
      const res = await solve({ data: { enhancedPath, originalPath, subject: subject || null } });
      setResult(res.analysis);
      setSolvedFor(subject);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not solve that image.");
    } finally {
      setStage("idle");
    }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(answerToText(result));
    toast.success("Solution copied");
  }

  const subjectSelect = (
    <select
      value={subject}
      onChange={(e) => setSubject(e.target.value)}
      disabled={busy}
      aria-label="Subject"
      className="h-10 rounded-md border-2 border-input bg-card px-3 text-sm font-medium"
    >
      <option value="">Auto-detect subject</option>
      {SUBJECTS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );

  return (
    <div className="grain relative min-h-screen">
      <div className="rule-grid pointer-events-none absolute inset-0 opacity-30" />
      <header className="relative border-b-2 border-foreground/80 bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-baseline justify-between gap-4 px-5 py-4">
          <h1 className="text-lg font-extrabold tracking-tight md:text-xl">Exam &amp; Exercise Solver</h1>
          <span dir="rtl" className="text-sm font-semibold text-muted-foreground">
            محلل الاختبارات والتمارين
          </span>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl space-y-6 px-5 py-8">
        {/* Step 1 + 2 */}
        <section className="paper space-y-5 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">1</span>
            <h2 className="text-base font-bold">Upload the exam page</h2>
          </div>

          {!file ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button size="lg" className="h-20 text-base" onClick={() => cameraRef.current?.click()}>
                📷 Take a photo
              </Button>
              <Button size="lg" variant="outline" className="h-20 border-2 text-base" onClick={() => fileRef.current?.click()}>
                🖼️ Upload image
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <figure className="space-y-1">
                <figcaption className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Original</figcaption>
                {preview && (
                  <img
                    src={preview}
                    alt="Uploaded exam page"
                    style={{ transform: `rotate(${rotation}deg)` }}
                    className="max-h-72 w-full rounded-lg border-2 border-border bg-muted object-contain transition-transform"
                  />
                )}
              </figure>
              <figure className="space-y-1">
                <figcaption className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Enhanced for reading</figcaption>
                {enhancedUrl ? (
                  <img src={enhancedUrl} alt="Enhanced scan" className="max-h-72 w-full rounded-lg border-2 border-border bg-muted object-contain" />
                ) : (
                  <div className="flex h-72 items-center justify-center rounded-lg border-2 border-dashed border-border text-center text-xs text-muted-foreground">
                    Shadows, blur, tilt and low contrast are corrected automatically when you solve.
                  </div>
                )}
              </figure>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button variant="outline" size="sm" disabled={busy} onClick={() => { setRotation((r) => (r + 90) % 360); setEnhancedUrl(null); }}>
                  ↻ Rotate
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={reset}>
                  ✕ Change image
                </Button>
              </div>
            </div>
          )}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />

          <div className="flex flex-wrap items-center gap-3 border-t border-dashed border-border pt-5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">2</span>
            <h2 className="text-base font-bold">Subject</h2>
            {subjectSelect}
            <Button className="ms-auto h-11 px-6 text-base font-bold" disabled={!file || busy || loading} onClick={() => void run()}>
              {busy ? STAGE_LABEL[stage] : "Solve →"}
            </Button>
          </div>
        </section>

        {/* Step 3 */}
        {(busy || result) && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">3</span>
              <h2 className="me-auto text-base font-bold">Solution</h2>
              {result && (
                <>
                  {subject !== solvedFor && (
                    <Button size="sm" disabled={busy} onClick={() => void run()}>
                      Re-solve as {subject || "auto"}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => void copy()}>
                    📋 Copy solution
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      reset();
                      cameraRef.current?.click();
                    }}
                  >
                    📷 Retake
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { reset(); fileRef.current?.click(); }}>
                    🖼️ New image
                  </Button>
                </>
              )}
            </div>
            {busy ? (
              <div className="paper animate-pulse p-8 text-sm text-muted-foreground">{STAGE_LABEL[stage]}</div>
            ) : (
              result && <AnswerSheet text={result} subject={solvedFor || null} />
            )}
          </section>
        )}
      </main>
      <Toaster />
    </div>
  );
}
