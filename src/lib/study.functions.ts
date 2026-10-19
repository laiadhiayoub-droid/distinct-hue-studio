import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chat } from "./ai.server";
import { OCR_SYSTEM, solvePrompt } from "./prompts.server";

export const solveExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        enhancedPath: z.string().min(1),
        originalPath: z.string().min(1),
        subject: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    for (const p of [data.enhancedPath, data.originalPath]) {
      if (!p.startsWith(`${userId}/`)) throw new Error("Unauthorized file.");
    }

    const signed = await supabase.storage
      .from("study-uploads")
      .createSignedUrls([data.enhancedPath, data.originalPath], 900);
    const urls = signed.data?.map((s) => s.signedUrl).filter(Boolean) ?? [];
    if (signed.error || urls.length !== 2) throw new Error("Could not read the uploaded image.");

    const images = urls.map((url) => ({ type: "image_url" as const, image_url: { url } }));

    // Pass 1 — dedicated OCR on enhanced + original.
    const transcript = await chat(
      [
        { role: "system", content: OCR_SYSTEM },
        {
          role: "user",
          content: [{ type: "text", text: "Transcribe this exam page." }, ...images],
        },
      ],
      "google/gemini-3.5-flash",
    );

    // Pass 2 — solve from transcript, with images for cross-checking.
    const subject = data.subject ?? null;
    const analysis = await chat([
      {
        role: "user",
        content: [{ type: "text", text: solvePrompt(subject, transcript) }, ...images],
      },
    ]);

    const { error } = await supabase.from("uploads").insert({
      user_id: userId,
      storage_path: data.originalPath,
      subject,
      mode: "solve",
      analysis,
      extracted_text: transcript,
    });
    if (error) console.error("upload row insert failed", error);

    return { analysis, transcript };
  });
