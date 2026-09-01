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

// 2026-09-01: `llama-3.3-70b-versatile` was decommissioned by Groq (404
// "model does not exist or you do not have access to it" on a valid key).
// Groq's current chat line-up on the free tier is the GPT-OSS family plus
// Qwen3; the closest drop-in for this council pipeline is
// `openai/gpt-oss-120b` — the highest-quality option still available, and
// the one the earlier `@ai-sdk/openai` notes below were already written
// around. Overridable via GROQ_MODEL env (no redeploy needed to switch
// again if Groq's catalogue shifts) — see .env.local.example.
//
// TPM note (historical, still relevant on a free key): the GPT-OSS models
// are reasoning models with a hidden chain-of-thought token cost, and a
// single 5-call report generation has been measured to brush the free-tier
// TPM ceiling on its own. `withRetry` below backs off and retries on 429,
// so a solo/demo workload rides through it; sustained or concurrent
// traffic still wants a paid Groq/Portkey tier.
//
// GPT-OSS *does* support Groq's native `response_format: json_schema`
// (it was llama-3.3 that rejected it), but json_object mode + Zod
// validation (STRUCTURED_OUTPUT_OPTIONS below) already works and is left
// as-is to keep this a one-line model swap.
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

// Portkey's OpenAI-compatible gateway — not worth a whole dependency for
// one URL constant (see git history: this used to come from the
// `portkey-ai` package).
const PORTKEY_GATEWAY_URL = "https://api.portkey.ai/v1";

// Groq's free tier caps report-generation models at 8,000 tokens/minute
// (confirmed live 2026-09-01 for openai/gpt-oss-*), and one full 5-call
// report runs ~10-14k tokens — so a generation *will* hit a 429 partway
// through and has to pace itself over more than one rolling minute. Groq
// returns a `retry-after` (~8s) on these; honouring it and retrying a few
// times is what carries a single generation through. Enough retries to
// cover every call in the pipeline eating one wait.
const MAX_MODEL_RETRIES = 5;
const FALLBACK_RETRY_BACKOFF_MS = 2000;
const MAX_RETRY_BACKOFF_MS = 30000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiErrorStatus(error: unknown): number | undefined {
  // AI SDK's APICallError exposes the HTTP status as `statusCode`; some
  // other error shapes use `status`. Check both (a real 429 was slipping
  // through as "not retryable" because only `status` was checked).
  if (typeof error === "object" && error !== null) {
    for (const key of ["statusCode", "status"] as const) {
      if (key in error && typeof (error as Record<string, unknown>)[key] === "number") {
        return (error as Record<string, number>)[key];
      }
    }
  }
  // AI SDK wraps provider errors — the real HTTP status can live one level
  // down on `.cause`, so check that too.
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
      // +1s slack so the rolling-minute window has actually cleared.
      return Math.min(retryAfter * 1000 + 1000, MAX_RETRY_BACKOFF_MS);
    }
  }
  // Groq puts "Please try again in 8.085s" in the message body even when
  // the header is absent — parse it as a second source of truth.
  const message = error instanceof Error ? error.message : "";
  const fromBody = Number(/try again in ([\d.]+)s/i.exec(message)?.[1]);
  if (Number.isFinite(fromBody) && fromBody > 0) {
    return Math.min(fromBody * 1000 + 1000, MAX_RETRY_BACKOFF_MS);
  }
  // Last resort: a 429 here is a per-minute token ceiling, so a short
  // linear backoff isn't enough — climb toward the cap.
  return Math.min(FALLBACK_RETRY_BACKOFF_MS * attempt * attempt, MAX_RETRY_BACKOFF_MS);
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

// GPT-OSS on Groq supports native `response_format: json_schema`, which
// makes the model *structurally unable* to return malformed JSON — worth
// far more than json_object mode here, where a low-reasoning run on a
// large schema was intermittently producing unparseable output ("Failed
// to generate JSON"). Zod still validates on top. `reasoningEffort: "low"`
// matters on GPT-OSS: at default effort the hidden chain-of-thought was
// ~1,000+ tokens per agent call, and against the 8,000 TPM free-tier
// ceiling that tax is what tips the pipeline into 429s — "low" keeps the
// models' judgement while cutting most of the overhead.
const STRUCTURED_OUTPUT_OPTIONS = { groq: { structuredOutputs: true, reasoningEffort: "low" as const } };

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

  // Wave 1: three specialists draft independently — each owns a disjoint
  // slice of the schema, see lib/report-schemas.ts.
  //
  // Run them in sequence by default. Firing all three at once instantly
  // claims ~7-8k tokens against Groq's 8,000 TPM free-tier window, which
  // leaves the critic/synthesis calls nothing to work with and no way to
  // pace — the whole generation then fails instead of just running slower.
  // Sequential lets withRetry's backoff space the calls across the rolling
  // window. Set GROQ_PARALLEL_AGENTS=1 on a paid tier to restore the
  // faster fan-out.
  let market: MarketDraft;
  let competitive: CompetitiveDraft;
  let execution: ExecutionDraft;
  if (process.env.GROQ_PARALLEL_AGENTS === "1") {
    [market, competitive, execution] = await Promise.all([
      runMarketAgent(model, idea),
      runCompetitiveAgent(model, idea),
      runExecutionAgent(model, idea),
    ]);
  } else {
    market = await runMarketAgent(model, idea);
    competitive = await runCompetitiveAgent(model, idea);
    execution = await runExecutionAgent(model, idea);
  }

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
