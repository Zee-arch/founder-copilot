import { GoogleGenAI } from "@google/genai";
import { buildValidationUserPrompt, VALIDATION_SYSTEM_PROMPT } from "@/lib/prompt";
import { parseValidationReport } from "@/lib/parse-report";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const MAX_IDEA_LENGTH = 500;

// No web search in this generation path (see HANDOFF.md) — a single
// non-streaming call finishes well under Vercel's default limits, so no
// need for the extended maxDuration the search-heavy Claude path required.
export const maxDuration = 60;

function getClientIp(request: Request): string {
  // Vercel/most proxies set this; falls back to a shared bucket if absent
  // (e.g. running locally without a proxy in front).
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(ip);

    if (!rateLimit.allowed) {
      return Response.json(
        {
          error: `You've hit the limit for now. Try again in about ${Math.ceil(
            (rateLimit.retryAfterSeconds ?? 0) / 60,
          )} minutes.`,
        },
        { status: 429 },
      );
    }

    const body = (await request.json()) as { idea?: string };
    const idea = body.idea?.trim();

    if (!idea) {
      return Response.json({ error: "Please enter a startup idea." }, { status: 400 });
    }

    if (idea.length > MAX_IDEA_LENGTH) {
      return Response.json(
        { error: `Keep your idea under ${MAX_IDEA_LENGTH} characters — one or two sentences is plenty.` },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error: "Gemini API key is missing. Add GEMINI_API_KEY to your .env.local file and restart the server.",
        },
        { status: 500 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const generateStart = Date.now();

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: buildValidationUserPrompt(idea),
      config: {
        systemInstruction: VALIDATION_SYSTEM_PROMPT,
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    });

    console.log(`[generate] ${Date.now() - generateStart}ms, model=gemini-3.5-flash`);

    const text = response.text ?? "";

    if (!text.trim()) {
      return Response.json({ error: "The model returned an empty response." }, { status: 500 });
    }

    const report = parseValidationReport(text);

    // Best-effort save for signed-in users — generation already succeeded,
    // so a persistence failure (RLS misconfig, transient DB error, etc.)
    // should never turn into a failed response. Anonymous generation is
    // unaffected: `getUser()` just returns null and this is skipped.
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error: insertError } = await supabase.from("reports").insert({ user_id: user.id, idea, report });
        if (insertError) {
          console.error("[generate] failed to save report:", insertError.message);
        }
      }
    } catch (persistError) {
      console.error("[generate] report persistence error:", persistError);
    }

    return Response.json({ idea, report });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong while generating your report.";

    return Response.json({ error: message }, { status: 500 });
  }
}
