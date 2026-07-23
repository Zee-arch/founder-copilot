import { cookies } from "next/headers";
import OpenAI from "openai";
import { buildValidationUserPrompt, VALIDATION_SYSTEM_PROMPT } from "@/lib/prompt";
import { parseValidationReport } from "@/lib/parse-report";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/org-cookie";

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

// Groq's free tier for this model has a real 8,000-token-per-minute cap
// (confirmed live via a standalone diagnostic script, not documentation —
// Groq's docs don't surface the exact per-model number). This app's system
// prompt alone is ~3,000 tokens, so a single generation can leave very
// little headroom for a same-minute second request; a 429 here more often
// means "wait for the TPM window to refill" than "try again right away."
// One retry, but the backoff below is driven by Groq's own `retry-after`
// response header (present on real 429s, confirmed live) rather than a
// fixed guess — that header told us to wait anywhere from ~6s to ~17s
// during testing, which a flat 2s backoff would not have covered.
const MAX_MODEL_RETRIES = 1;
const FALLBACK_RETRY_BACKOFF_MS = 2000;
// Guards against a header value large enough to blow past `maxDuration`.
const MAX_RETRY_BACKOFF_MS = 30000;

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

function getRetryBackoffMs(error: unknown, attempt: number): number {
  if (typeof error === "object" && error !== null && "headers" in error) {
    const headers = (error as { headers?: unknown }).headers;
    if (headers instanceof Headers) {
      const retryAfter = Number(headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        return Math.min(retryAfter * 1000, MAX_RETRY_BACKOFF_MS);
      }
    }
  }
  return FALLBACK_RETRY_BACKOFF_MS * attempt;
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
          // gpt-oss-120b is a reasoning model — without this, it was
          // measured spending ~800 of its ~3,000-token completion budget on
          // hidden reasoning before writing any JSON, then hitting the
          // token cap mid-report (buildBrief, the last field in the shape,
          // came back empty). "low" cut reasoning to ~30-60 tokens and let
          // real generations finish with finish_reason "stop" instead of
          // "length" across repeated live tests. Confirmed live, not from
          // Groq's docs — this parameter isn't part of the OpenAI SDK's
          // types, hence the cast below.
          reasoning_effort: "low",
        } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);
        break;
      } catch (error) {
        if (attempt >= MAX_MODEL_RETRIES || !isRetryableStatus(error)) throw error;
        const backoffMs = getRetryBackoffMs(error, attempt + 1);
        attempt += 1;
        console.log(
          `[generate] Groq returned ${getApiErrorStatus(error)}, retry ${attempt}/${MAX_MODEL_RETRIES} after ${backoffMs}ms`,
        );
        await sleep(backoffMs);
      }
    }

    console.log(`[generate] ${Date.now() - generateStart}ms, model=openai/gpt-oss-120b, retries=${attempt}`);

    // A truncated-but-still-valid-JSON response (the model hit its token
    // cap mid-report) isn't a hard failure — lib/parse-report.ts already
    // falls back gracefully per field — but it's worth knowing about if it
    // keeps happening, since it means a real field the founder sees is
    // silently thinner than the model could have produced.
    if (completion.choices[0]?.finish_reason === "length") {
      console.warn("[generate] completion hit the token cap (finish_reason=length) — report may have missing fields");
    }

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
        // Tags the report with the signed-in user's active org, if any.
        // Not re-validated against membership here — RLS's own insert
        // policy (`org_id is null or is_org_member(org_id)`) already
        // enforces that, and this insert is best-effort/silent on failure
        // anyway, so a stale/spoofed cookie value just fails closed.
        const cookieStore = await cookies();
        const orgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;

        const { error: insertError } = await supabase
          .from("reports")
          .insert({ user_id: user.id, idea, report, org_id: orgId });
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
