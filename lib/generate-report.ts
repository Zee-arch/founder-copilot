import OpenAI from "openai";
import { buildValidationUserPrompt, VALIDATION_SYSTEM_PROMPT } from "@/lib/prompt";
import { parseValidationReport } from "@/lib/parse-report";
import type { ValidationReport } from "@/lib/types";

export const MAX_IDEA_LENGTH = 500;

// Shared by the web UI's /api/generate and the Team-tier /api/v1/* routes —
// pulled out of app/api/generate/route.ts so both call the exact same
// model logic (retries, token-budget workaround, honesty guardrails)
// instead of two copies drifting apart. See git history on
// app/api/generate/route.ts for why each of these exists.

const MAX_MODEL_RETRIES = 1;
const FALLBACK_RETRY_BACKOFF_MS = 2000;
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

export function friendlyGenerationErrorMessage(error: unknown): string {
  const status = getApiErrorStatus(error);

  if (status === 429) {
    return "The free API rate limit was hit. Please wait a few seconds and try again.";
  }

  if (status === 503) {
    return "The AI model is temporarily unavailable. Please wait a moment and try again.";
  }

  return error instanceof Error ? error.message : "Something went wrong while generating your report.";
}

export class GenerationConfigError extends Error {}

export async function generateValidationReport(idea: string): Promise<ValidationReport> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new GenerationConfigError("Groq API key is missing. Add GROQ_API_KEY to your .env.local file and restart the server.");
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

  if (completion.choices[0]?.finish_reason === "length") {
    console.warn("[generate] completion hit the token cap (finish_reason=length) — report may have missing fields");
  }

  const text = completion.choices[0]?.message?.content ?? "";

  if (!text.trim()) {
    throw new Error("The model returned an empty response.");
  }

  const report = parseValidationReport(text, []);
  console.log(`[generate] category=${report.category}`);

  return report;
}
