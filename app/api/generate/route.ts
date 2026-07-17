import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { buildValidationUserPrompt, VALIDATION_SYSTEM_PROMPT } from "@/lib/prompt";
import { parseValidationReport } from "@/lib/parse-report";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_IDEA_LENGTH = 500;

// Search adds real wall-clock time on top of generation — measured ~150s
// for a 3-search report even with direct (non-dynamic-filtering) calls, so
// give real headroom rather than hitting Vercel's default function timeout.
// Requires the deployment's plan/config to actually allow this — verify on
// the live Vercel deployment, not just locally.
export const maxDuration = 280;

// A search-heavy turn can pause (documented API behavior for long-running
// web_search sessions); resend the paused turn to let it finish, bounded so
// a pathological loop can't run away.
const MAX_PAUSE_CONTINUATIONS = 3;

// `allowed_callers: ["direct"]` skips dynamic filtering (which routes every
// search through an extra code-execution round trip — measured well over
// 5 minutes for a single report with the default). We don't need dynamic
// filtering's context-trimming benefit since the final output is compact
// structured JSON, not long prose quoting search results verbatim.
const WEB_SEARCH_TOOL = {
  type: "web_search_20260318" as const,
  name: "web_search" as const,
  max_uses: 4,
  allowed_callers: ["direct" as const],
};

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

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            "Claude API key is missing. Add ANTHROPIC_API_KEY to your .env.local file and restart the server.",
        },
        { status: 500 },
      );
    }

    const anthropic = new Anthropic({ apiKey });

    const messages: MessageParam[] = [
      {
        role: "user",
        content: buildValidationUserPrompt(idea),
      },
    ];

    const generateStart = Date.now();

    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      temperature: 0.7,
      system: VALIDATION_SYSTEM_PROMPT,
      messages,
      tools: [WEB_SEARCH_TOOL],
    });

    let continuations = 0;
    while (response.stop_reason === "pause_turn" && continuations < MAX_PAUSE_CONTINUATIONS) {
      messages.push({ role: "assistant", content: response.content });
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        temperature: 0.7,
        system: VALIDATION_SYSTEM_PROMPT,
        messages,
        tools: [WEB_SEARCH_TOOL],
      });
      continuations += 1;
    }

    console.log(
      `[generate] ${Date.now() - generateStart}ms, ${response.usage.server_tool_use?.web_search_requests ?? 0} searches, ${continuations} pause continuations, stop_reason=${response.stop_reason}`,
    );

    // Web search's citation mechanism can split Claude's single JSON output
    // across multiple sequential text blocks — concatenate all of them, not
    // just the first, or the JSON silently truncates.
    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (!text.trim()) {
      return Response.json({ error: "Claude returned an empty response." }, { status: 500 });
    }

    const report = parseValidationReport(text);

    return Response.json({ idea, report });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong while generating your report.";

    return Response.json({ error: message }, { status: 500 });
  }
}
