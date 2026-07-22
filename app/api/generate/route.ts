import OpenAI from "openai";
import { buildValidationUserPrompt, VALIDATION_SYSTEM_PROMPT } from "@/lib/prompt";
import { parseValidationReport } from "@/lib/parse-report";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const MAX_IDEA_LENGTH = 500;

// 2026-07-22 (later still): swapped Gemini for Groq — purely a testing-
// reliability decision, not a quality one (see HANDOFF.md). Groq's free
// tier (14,400 req/day, 30 req/min, no billing card) has been consistently
// available where Gemini's free tier was returning 503 "high demand" on a
// majority of attempts. Groq's LPU inference is also fast — a real
// generation is expected in low single-digit seconds, not the 60-80s+
// stalls measured under Gemini load — so `maxDuration` comes down from 280
// accordingly. Revisit before launch: the founder still wants to compare
// providers on actual output quality once the product is feature-complete,
// same open decision as before this swap.
export const maxDuration = 60;

// Groq's free tier is far more available than Gemini's was, but still has
// a real 30 req/min ceiling that a quick round of manual testing could
// realistically hit — worth one retry with backoff rather than failing
// immediately, same reasoning as the Gemini 503 retry this replaces.
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
  const status = getApiErrorStatus(error);
  return status === 429 || status === 503;
}

// The OpenAI SDK's error `.message` is the raw API response body — readable
// in server logs, but showing that to a founder in the UI is neither
// friendly nor honest about what actually went wrong.
function friendlyErrorMessage(error: unknown): string {
  const status = getApiErrorStatus(error);

  if (status === 429) {
    return "The free API rate limit was hit. Please wait a few seconds and try again.";
  }

  if (status === 503) {
    return "The AI model is temporarily unavailable. Please wait a moment and try again.";
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

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error: "Groq API key is missing. Add GROQ_API_KEY to your .env.local file and restart the server.",
        },
        { status: 500 },
      );
    }

    const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });

    const generateStart = Date.now();

    let completion;
    let attempt = 0;

    while (true) {
      try {
        completion = await client.chat.completions.create({
          model: "openai/gpt-oss-120b",
          messages: [
            { role: "system", content: VALIDATION_SYSTEM_PROMPT },
            { role: "user", content: buildValidationUserPrompt(idea) },
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
        });
        break;
      } catch (error) {
        if (attempt >= MAX_MODEL_RETRIES || !isRetryableStatus(error)) throw error;
        attempt += 1;
        console.log(`[generate] Groq returned ${getApiErrorStatus(error)}, retry ${attempt}/${MAX_MODEL_RETRIES}`);
        await sleep(RETRY_BACKOFF_MS * attempt);
      }
    }

    console.log(`[generate] ${Date.now() - generateStart}ms, model=openai/gpt-oss-120b, retries=${attempt}`);

    const text = completion.choices[0]?.message?.content ?? "";

    if (!text.trim()) {
      return Response.json({ error: "The model returned an empty response." }, { status: 500 });
    }

    // No search grounding on this provider (see HANDOFF.md) — always an
    // empty sources array, same "no web access" tier the prompt now
    // instructs the model to write for. Never self-reported by the model:
    // an open-weight model with no live web access has no way to produce a
    // real URL, only a plausible-looking one, which is exactly the kind of
    // fabrication this project's "never fabricate, stay strict on honesty"
    // rule exists to block.
    const report = parseValidationReport(text, []);

    console.log(`[generate] category=${report.category}`);

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
