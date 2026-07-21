import { GoogleGenAI } from "@google/genai";
import { buildValidationUserPrompt, VALIDATION_SYSTEM_PROMPT } from "@/lib/prompt";
import { parseValidationReport } from "@/lib/parse-report";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const MAX_IDEA_LENGTH = 500;

// No web search in this generation path (see HANDOFF.md), but Gemini's free
// tier is currently overloaded often enough that a single call can itself
// take 60-80s before failing with 503 (measured live, not hypothetical) —
// so this needs real headroom for the retry below, not the bare minimum a
// single fast call would suggest.
export const maxDuration = 150;

// Gemini's free tier genuinely returns 503 "high demand" fairly often right
// now — confirmed live while testing this integration. The API's own error
// message says spikes are "usually temporary," so retry once with backoff
// before giving up; anything else (bad key, quota exhausted, malformed
// request) fails immediately. Only one retry, not several: a single attempt
// has been observed taking up to ~80s on its own while overloaded, so each
// extra retry meaningfully eats into `maxDuration`.
const MAX_MODEL_RETRIES = 1;
const RETRY_BACKOFF_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
    return error.status;
  }
  return undefined;
}

function isRetryableStatus(error: unknown): boolean {
  return getApiErrorStatus(error) === 503;
}

// The Gemini SDK's error `.message` is the raw API response body (a JSON
// string) — readable in server logs, but showing that to a founder in the
// UI is neither friendly nor honest about what actually went wrong.
function friendlyErrorMessage(error: unknown): string {
  const status = getApiErrorStatus(error);

  if (status === 503) {
    return "The AI model is experiencing high demand right now. Please wait a moment and try again.";
  }

  if (status === 429) {
    return "The free API quota has been used up for now. Try again later, or check your Gemini API plan.";
  }

  return error instanceof Error ? error.message : "Something went wrong while generating your report.";
}

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

    let response;
    let attempt = 0;

    while (true) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: buildValidationUserPrompt(idea),
          config: {
            systemInstruction: VALIDATION_SYSTEM_PROMPT,
            temperature: 0.7,
            responseMimeType: "application/json",
          },
        });
        break;
      } catch (error) {
        if (attempt >= MAX_MODEL_RETRIES || !isRetryableStatus(error)) throw error;
        attempt += 1;
        console.log(`[generate] Gemini returned 503 (high demand), retry ${attempt}/${MAX_MODEL_RETRIES}`);
        await sleep(RETRY_BACKOFF_MS * attempt);
      }
    }

    console.log(`[generate] ${Date.now() - generateStart}ms, model=gemini-3.5-flash, retries=${attempt}`);

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
    console.error("[generate] failed:", error);
    return Response.json({ error: friendlyErrorMessage(error) }, { status: 500 });
  }
}
