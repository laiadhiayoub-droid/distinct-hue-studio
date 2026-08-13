import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chat, extractGrade } from "./ai.server";
import { EXAMINER_SYSTEM, TUTOR_SYSTEM, imagePrompt } from "./prompts.server";

export const gradeAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        subject: z.string().min(1),
        question: z.string().min(1),
        answer: z.string().min(1),
        guidance: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const feedback = await chat([
      { role: "system", content: EXAMINER_SYSTEM },
      {
        role: "user",
        content: `Subject: ${data.subject}\n\nQuestion:\n${data.question}\n\nMarking guidance (internal, do not reveal verbatim): ${
          data.guidance ?? "none"
        }\n\nStudent answer:\n${data.answer}`,
      },
    ]);

    return { feedback, grade: extractGrade(feedback) };
  });

export const analyzeUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storagePath: z.string().min(1),
        mode: z.enum(["grade", "solve", "explain", "translate"]),
        subject: z.string().nullable().optional(),
        note: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (!data.storagePath.startsWith(`${userId}/`)) {
      throw new Error("Unauthorized: that file does not belong to you.");
    }

    const signed = await supabase.storage
      .from("study-uploads")
      .createSignedUrl(data.storagePath, 600);

    if (signed.error || !signed.data?.signedUrl) {
      throw new Error("Could not read the uploaded image.");
    }

    const analysis = await chat([
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${imagePrompt(data.mode, data.subject ?? null)}${
              data.note ? `\n\nStudent note: ${data.note}` : ""
            }`,
          },
          { type: "image_url", image_url: { url: signed.data.signedUrl } },
        ],
      },
    ]);

    const extracted = analysis.split(/\n(?=#{0,3}\s*(?:Then|Grade|Solution|Explanation))/i)[0] ?? null;

    const { data: row, error } = await supabase
      .from("uploads")
      .insert({
        user_id: userId,
        storage_path: data.storagePath,
        subject: data.subject ?? null,
        mode: data.mode,
        analysis,
        extracted_text: extracted,
      })
      .select("id")
      .single();

    if (error) console.error("upload row insert failed", error);

    return { analysis, uploadId: row?.id ?? null, grade: extractGrade(analysis) };
  });

export const askTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        message: z.string().min(1).max(4000),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
          .max(20)
          .default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const reply = await chat([
      { role: "system", content: TUTOR_SYSTEM },
      ...data.history.map((m) => ({ role: m.role, content: m.content }) as const),
      { role: "user", content: data.message },
    ]);

    await supabase.from("tutor_messages").insert([
      { user_id: userId, role: "user", content: data.message },
      { user_id: userId, role: "assistant", content: reply },
    ]);

    return { reply };
  });
