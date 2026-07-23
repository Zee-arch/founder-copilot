import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { MAX_IDEA_LENGTH, friendlyGenerationErrorMessage, generateValidationReport } from "@/lib/generate-report";
import { consumeCredit } from "@/lib/entitlements";

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

function getClientIp(request: Request): string {
  // Vercel/most proxies set this; falls back to a shared bucket if absent
  // (e.g. running locally without a proxy in front).
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Signed-out generation is the "free tier (lead-gen)" experience — no
    // signup required, gated only by IP so it stays a genuine no-friction
    // try-before-you-buy path. A signed-in user (any plan, including the
    // free plan itself) is instead gated by their credit balance — see
    // lib/entitlements.ts — since that's what actually distinguishes free
    // from Prosumer/Team once someone has an account.
    if (!user) {
      const ip = getClientIp(request);
      const rateLimit = checkRateLimit(ip);

      if (!rateLimit.allowed) {
        return Response.json(
          {
            error: `You've hit the limit for now. Try again in about ${Math.ceil(
              (rateLimit.retryAfterSeconds ?? 0) / 60,
            )} minutes, or sign up for a free account for a running monthly allowance.`,
          },
          { status: 429 },
        );
      }
    } else {
      const { allowed, entitlements } = await consumeCredit(user.id);
      if (!allowed) {
        return Response.json(
          {
            error:
              entitlements.planId === "free"
                ? "You're out of free credits for this month. Upgrade to Prosumer for more, or wait for next month's renewal."
                : "You're out of credits for this billing period. Buy more or wait for renewal.",
            entitlements,
          },
          { status: 402 },
        );
      }
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

    const report = await generateValidationReport(idea);

    // Best-effort save for signed-in users — generation already succeeded,
    // so a persistence failure (RLS misconfig, transient DB error, etc.)
    // should never turn into a failed response.
    if (user) {
      try {
        const { error: insertError } = await supabase.from("reports").insert({ user_id: user.id, idea, report });
        if (insertError) {
          console.error("[generate] failed to save report:", insertError.message);
        }
      } catch (persistError) {
        console.error("[generate] report persistence error:", persistError);
      }
    }

    return Response.json({ idea, report });
  } catch (error) {
    console.error("[generate] failed:", error);
    return Response.json({ error: friendlyGenerationErrorMessage(error) }, { status: 500 });
  }
}
