import { GoogleGenAI } from "@google/genai";
import { buildValidationUserPrompt, VALIDATION_SYSTEM_PROMPT } from "@/lib/prompt";
import { parseValidationReport } from "@/lib/parse-report";
import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { Source } from "@/lib/types";

const MAX_IDEA_LENGTH = 500;

// Search grounding is back on (2026-07-22, see HANDOFF.md) — was off for a
// few days purely to cut costs while iterating, restored because it was the
// single biggest quality/competitive gap. Was already 280 for the old
// Claude+search path and stayed 280 through the brief no-search window
// (proven safe on this Vercel plan either way) — grounding adds real
// latency on top of Gemini's free tier already being prone to 60-80s+
// stalls under load (measured live), so this needs the same headroom as
// before, not less.
export const maxDuration = 280;

// Gemini's free tier genuinely returns 503 "high demand" fairly often right
// now — confirmed live while testing this integration. The API's own error
// message says spikes are "usually temporary," so retry once with backoff
// before giving up; anything else (bad key, quota exhausted, malformed
// request) fails immediately. Only one retry, not several: a single attempt
// has been observed taking up to ~80s on its own while overloaded, so each
// extra retry meaningfully eats into `maxDuration` — more so now that
// grounding adds its own latency on top.
const MAX_MODEL_RETRIES = 1;
const RETRY_BACKOFF_MS = 2000;

// Google's googleSearch tool cannot be combined with responseMimeType:
// "application/json" (confirmed against Google's own docs/issue tracker —
// tool use and native JSON mode are mutually exclusive on this API). So
// this relies on the prompt's own "return ONLY valid JSON" instruction
// plus lib/parse-report.ts's existing defensive extractJson() fence/brace
// matching, the same mechanism the original Claude+search version always
// used. Not a new risk class, just giving up the JSON-mode reliability
// boost gained during the brief no-search window.
const GROUNDING_TOOL = { googleSearch: {} };

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

// Sources come from Gemini's own groundingMetadata, not from asking the
// model to self-report a "sources" field in its JSON — groundingChunks are
// structured data the API actually returned for pages it really retrieved,
// which is a stronger guarantee than trusting the model's own claim (which
// is all the original Claude version had, since Claude self-reports
// sources inside its JSON response instead). Same defensive filtering tier
// as everything else in lib/parse-report.ts: never hard-throws on missing
// or malformed grounding data.
const HTTP_URL_PATTERN = /^https?:\/\//i;

function extractGroundingSources(response: Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>): Source[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();

  return chunks
    .map((chunk) => ({ url: chunk.web?.uri?.trim(), label: chunk.web?.title?.trim() }))
    .filter(
      (s): s is { url: string; label: string } =>
        typeof s.url === "string" && HTTP_URL_PATTERN.test(s.url) && typeof s.label === "string" && s.label.length > 0,
    )
    .filter((s) => {
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    })
    .slice(0, 8);
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
            tools: [GROUNDING_TOOL],
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

    const sources = extractGroundingSources(response);

    console.log(
      `[generate] ${Date.now() - generateStart}ms, model=gemini-3.5-flash, retries=${attempt}, sources=${sources.length}`,
    );

    const text = response.text ?? "";

    if (!text.trim()) {
      return Response.json({ error: "The model returned an empty response." }, { status: 500 });
    }

    const report = { ...parseValidationReport(text), sources };

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
