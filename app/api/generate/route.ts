import Anthropic from "@anthropic-ai/sdk";
import { buildValidationUserPrompt, VALIDATION_SYSTEM_PROMPT } from "@/lib/prompt";
import { parseValidationReport } from "@/lib/parse-report";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_IDEA_LENGTH = 500;

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

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      temperature: 0.7,
      system: VALIDATION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildValidationUserPrompt(idea),
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");

    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ error: "Claude returned an empty response." }, { status: 500 });
    }

    const report = parseValidationReport(textBlock.text);

    return Response.json({ idea, report });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong while generating your report.";

    return Response.json({ error: message }, { status: 500 });
  }
}
