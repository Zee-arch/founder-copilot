import { createGroq } from "@ai-sdk/groq";
import { generateObject, type LanguageModel } from "ai";
import {
  MARKET_AGENT_SYSTEM_PROMPT,
  COMPETITIVE_AGENT_SYSTEM_PROMPT,
  EXECUTION_AGENT_SYSTEM_PROMPT,
  CRITIC_SYSTEM_PROMPT,
  SYNTHESIS_SYSTEM_PROMPT,
  buildMarketAgentPrompt,
  buildCompetitiveAgentPrompt,
  buildExecutionAgentPrompt,
  buildCriticPrompt,
  buildSynthesisPrompt,
} from "@/lib/prompt";
import {
  marketDraftSchema,
  competitiveDraftSchema,
  executionDraftSchema,
  critiqueSchema,
  synthesisSchema,
  type MarketDraft,
  type CompetitiveDraft,
  type ExecutionDraft,
  type Critique,
  type Synthesis,
} from "@/lib/report-schemas";
import { finalizeReport } from "@/lib/parse-report";
import type { ValidationReport } from "@/lib/types";

export const MAX_IDEA_LENGTH = 500;

// Shared by the web UI's /api/generate and the Team-tier /api/v1/* routes —
// pulled out of app/api/generate/route.ts so both call the exact same
// council pipeline (retries, honesty guardrails) instead of two copies
// drifting apart. See git history on app/api/generate/route.ts for why
// each of these exists.

// `openai/gpt-oss-120b` (a *reasoning* model, 8,000 TPM free-tier limit —
// see HANDOFF.md for the incident this was first discovered in) does NOT
// fit this 5-call council pipeline: confirmed live, a single report
// generation exceeded it mid-pipeline ("Limit 8000, Used 6984, Requested
// 2616"). Switched to `llama-3.3-70b-versatile` (12K TPM, same 30 RPM on
// Groq's free tier, confirmed via Groq's rate-limits page) — a non-
// reasoning model, so it also skips the hidden chain-of-thought tax that
// made `reasoning_effort` necessary in the first place.
//
// Still tight, not comfortable: measured live across several real
// generations, one full report consumes ~11,700-11,900 of this model's
// 12,000 TPM budget — on its own, before any concurrent traffic. Trimmed
// what fixed prompt overhead I safely could (see CATEGORY_EMPHASIS_RULES
// in lib/prompt.ts), but output length (the report content itself)
// dominates the total and isn't something to cut without cutting quality.
// Practical effect: this free-tier key can sustain roughly one report per
// rolling minute — a second report request (or a batch run) landing in
// the same window will very likely 429. Fine for solo testing; upgrading
// to a paid Groq/Portkey tier is a real prerequisite before real traffic,
// not just a nice-to-have.
//
// This also means the `@ai-sdk/openai` compatible-mode client had to go:
// it always requests native `response_format: json_schema`, which Groq
// only supports on the GPT-OSS family (confirmed live — llama-3.3 rejects
// it outright: "This model does not support response format
// `json_schema`"). Using `@ai-sdk/groq` directly instead, whose
// `structuredOutputs` provider option (see STRUCTURED_OUTPUT_OPTIONS
// below) explicitly falls back to `json_object` mode for models like this
// one — the schema is still enforced client-side by Zod after parsing.
const GROQ_MODEL = "llama-3.3-70b-versatile";

// Portkey's OpenAI-compatible gateway — not worth a whole dependency for
// one URL constant (see git history: this used to come from the
// `portkey-ai` package).
const PORTKEY_GATEWAY_URL = "https://api.portkey.ai/v1";

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
  // AI SDK wraps provider errors — the real HTTP status lives one level
  // down on APICallError's `.cause` (or the error itself, depending on
  // where it's thrown from), so check both shapes.
  if (typeof error === "object" && error !== null && "cause" in error) {
    return getApiErrorStatus((error as { cause?: unknown }).cause);
  }
  return undefined;
}

function isRetryableStatus(error: unknown): boolean {
  const status = getApiErrorStatus(error);
  return status === 429 || status === 503;
}

function getRetryBackoffMs(error: unknown, attempt: number): number {
  if (typeof error === "object" && error !== null && "responseHeaders" in error) {
    const headers = (error as { responseHeaders?: Record<string, string> }).responseHeaders;
    const retryAfter = Number(headers?.["retry-after"]);
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return Math.min(retryAfter * 1000, MAX_RETRY_BACKOFF_MS);
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

// Routes through Portkey's gateway when configured (gets fallback/caching
// config, cost tracking, and observability logging for free — see
// HANDOFF.md), otherwise falls back to calling Groq directly. Deliberately
// not a hard requirement: a missing/misconfigured PORTKEY_API_KEY should
// degrade to "no gateway features" rather than take generation down
// entirely, same never-fail-closed-on-an-optional-integration pattern as
// Supabase elsewhere in this app.
function getModel(): LanguageModel {
  const portkeyApiKey = process.env.PORTKEY_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (portkeyApiKey) {
    // The slug is whatever you named the Groq credential when adding it to
    // Portkey's Model Catalog (Settings -> Model Catalog -> AI Providers ->
    // Add Provider -> Groq) — "groq" is Portkey's own example/default
    // naming, not a hardcoded requirement, hence the env var override.
    const slug = process.env.PORTKEY_GROQ_SLUG || "groq";
    const provider = createGroq({ apiKey: portkeyApiKey, baseURL: PORTKEY_GATEWAY_URL });
    return provider.languageModel(`@${slug}/${GROQ_MODEL}`);
  }

  if (groqApiKey) {
    const provider = createGroq({ apiKey: groqApiKey });
    return provider.languageModel(GROQ_MODEL);
  }

  throw new GenerationConfigError(
    "No AI provider is configured. Add PORTKEY_API_KEY (recommended) or GROQ_API_KEY to your .env.local file and restart the server.",
  );
}

// Every generateObject call in the council goes through this — reuses the
// same retry/backoff tuning that fixed a real Groq TPM incident (see
// GROQ_MODEL comment above), instead of the AI SDK's own default retries
// (disabled per-call via maxRetries: 0) which don't know about Groq's
// retry-after header or this app's maxDuration budget.
async function withRetry<T extends { usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } }>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      const result = await fn();
      // Logged for the TPM verification gate (see GROQ_MODEL comment) —
      // this app's whole reason for switching models was hitting a real
      // per-minute token ceiling, so token usage per call is worth
      // keeping visible, not just latency.
      console.log(`[generate] ${label}: ${JSON.stringify(result.usage)}`);
      return result;
    } catch (error) {
      if (attempt >= MAX_MODEL_RETRIES || !isRetryableStatus(error)) throw error;
      const backoffMs = getRetryBackoffMs(error, attempt + 1);
      attempt += 1;
      console.log(
        `[generate] ${label}: Groq returned ${getApiErrorStatus(error)}, retry ${attempt}/${MAX_MODEL_RETRIES} after ${backoffMs}ms`,
      );
      await sleep(backoffMs);
    }
  }
}

// llama-3.3-70b-versatile doesn't support Groq's native json_schema
// response format (GPT-OSS-only — see GROQ_MODEL comment above), so force
// the json_object fallback; Zod still validates the parsed result, just
// without Groq enforcing the shape server-side.
const STRUCTURED_OUTPUT_OPTIONS = { groq: { structuredOutputs: false } };

async function runMarketAgent(model: LanguageModel, idea: string): Promise<MarketDraft> {
  const { object } = await withRetry("market", () =>
    generateObject({
      model,
      schema: marketDraftSchema,
      system: MARKET_AGENT_SYSTEM_PROMPT,
      prompt: buildMarketAgentPrompt(idea),
      temperature: 0.7,
      maxRetries: 0,
      providerOptions: STRUCTURED_OUTPUT_OPTIONS,
    }),
  );
  return object;
}

async function runCompetitiveAgent(model: LanguageModel, idea: string): Promise<CompetitiveDraft> {
  const { object } = await withRetry("competitive", () =>
    generateObject({
      model,
      schema: competitiveDraftSchema,
      system: COMPETITIVE_AGENT_SYSTEM_PROMPT,
      prompt: buildCompetitiveAgentPrompt(idea),
      temperature: 0.7,
      maxRetries: 0,
      providerOptions: STRUCTURED_OUTPUT_OPTIONS,
    }),
  );
  return object;
}

async function runExecutionAgent(model: LanguageModel, idea: string): Promise<ExecutionDraft> {
  const { object } = await withRetry("execution", () =>
    generateObject({
      model,
      schema: executionDraftSchema,
      system: EXECUTION_AGENT_SYSTEM_PROMPT,
      prompt: buildExecutionAgentPrompt(idea),
      temperature: 0.7,
      maxRetries: 0,
      providerOptions: STRUCTURED_OUTPUT_OPTIONS,
    }),
  );
  return object;
}

async function runCritic(
  model: LanguageModel,
  idea: string,
  market: MarketDraft,
  competitive: CompetitiveDraft,
  execution: ExecutionDraft,
): Promise<Critique> {
  const { object } = await withRetry("critic", () =>
    generateObject({
      model,
      schema: critiqueSchema,
      system: CRITIC_SYSTEM_PROMPT,
      prompt: buildCriticPrompt(idea, market, competitive, execution),
      temperature: 0.5,
      maxRetries: 0,
      providerOptions: STRUCTURED_OUTPUT_OPTIONS,
    }),
  );
  return object;
}

async function runSynthesis(
  model: LanguageModel,
  idea: string,
  market: MarketDraft,
  competitive: CompetitiveDraft,
  execution: ExecutionDraft,
  critique: Critique,
): Promise<Synthesis> {
  const { object } = await withRetry("synthesis", () =>
    generateObject({
      model,
      schema: synthesisSchema,
      system: SYNTHESIS_SYSTEM_PROMPT,
      prompt: buildSynthesisPrompt(idea, market.category, market, competitive, execution, critique),
      temperature: 0.6,
      maxRetries: 0,
      providerOptions: STRUCTURED_OUTPUT_OPTIONS,
    }),
  );
  return object;
}

export async function generateValidationReport(idea: string): Promise<ValidationReport> {
  const model = getModel();
  const generateStart = Date.now();

  // Wave 1: three specialists draft independently, in parallel — each owns
  // a disjoint slice of the schema, see lib/report-schemas.ts.
  const [market, competitive, execution] = await Promise.all([
    runMarketAgent(model, idea),
    runCompetitiveAgent(model, idea),
    runExecutionAgent(model, idea),
  ]);

  // Wave 2: critic reads all 3 drafts together — this is where cross-draft
  // inconsistencies a single specialist couldn't see get caught.
  const critique = await runCritic(model, idea, market, competitive, execution);

  // Wave 3: synthesis assigns scores and lightly edits the section prose;
  // the structured fields (market/financials/roadmap/etc.) are merged
  // verbatim from wave 1 in finalizeReport below — no LLM cost for those.
  const synthesis = await runSynthesis(model, idea, market, competitive, execution, critique);

  console.log(`[generate] ${Date.now() - generateStart}ms, model=${GROQ_MODEL}, waves=3`);

  const report = finalizeReport(market, competitive, execution, synthesis);
  console.log(`[generate] category=${report.category}`);

  return report;
}
