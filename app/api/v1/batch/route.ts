import { requireApiKey } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { MAX_IDEA_LENGTH, friendlyGenerationErrorMessage, generateValidationReport } from "@/lib/generate-report";

// Batch validation is inherently slower than a single report — up to
// MAX_BATCH_SIZE sequential-ish generations. 300s needs a Vercel plan that
// actually honors it: Hobby hard-caps every function at 60s no matter what
// this constant says, so a batch of more than a handful of ideas will get
// killed mid-run on Hobby. Team-tier customers doing real batch work need
// at least a Pro Vercel plan — flagging this now rather than after a
// founder discovers it from a support ticket.
export const maxDuration = 300;

const MAX_BATCH_SIZE = 20;
// Lowered 4 -> 2 (2026-07-31, council-of-agents rewrite): each report is
// now a 3-wave pipeline that fans out to 3 concurrent Groq calls at wave
// 1's peak, not 1 call total. 4 concurrent reports could spike to ~12
// concurrent Groq calls against the shared free-tier ceiling; 2 caps peak
// concurrent calls at ~6. See lib/generate-report.ts for the pipeline.
const CONCURRENCY = 2;

type BatchResult =
  | { idea: string; status: "ok"; report: Awaited<ReturnType<typeof generateValidationReport>> }
  | { idea: string; status: "error"; error: string }
  | { idea: string; status: "skipped"; error: string };

// Takes (item, index) rather than looking the index back up with
// indexOf — a batch of duplicate idea strings would otherwise make every
// occurrence resolve to the same index and silently drop a result.
async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) {
  let cursor = 0;
  async function next(): Promise<void> {
    const index = cursor++;
    if (index >= items.length) return;
    await worker(items[index], index);
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
}

export async function POST(request: Request) {
  const auth = await requireApiKey(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { ideas?: unknown };
  const ideas = Array.isArray(body.ideas) ? body.ideas.filter((i): i is string => typeof i === "string") : null;

  if (!ideas || ideas.length === 0) {
    return Response.json({ error: "Please provide a non-empty `ideas` array of strings." }, { status: 400 });
  }

  if (ideas.length > MAX_BATCH_SIZE) {
    return Response.json({ error: `A batch is limited to ${MAX_BATCH_SIZE} ideas at a time.` }, { status: 400 });
  }

  const oversizedIndex = ideas.findIndex((idea) => idea.trim().length === 0 || idea.length > MAX_IDEA_LENGTH);
  if (oversizedIndex !== -1) {
    return Response.json(
      { error: `Idea at index ${oversizedIndex} is empty or over ${MAX_IDEA_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const results: BatchResult[] = new Array(ideas.length);
  let outOfCredits = false;

  await runWithConcurrency(ideas, CONCURRENCY, async (idea, index) => {
    if (outOfCredits) {
      results[index] = { idea, status: "skipped", error: "Skipped — organization ran out of credits mid-batch." };
      return;
    }

    const { data: allowed, error: consumeError } = await service.rpc("consume_org_credit_for_api_key", {
      p_org_id: auth.key.orgId,
    });

    if (consumeError) {
      results[index] = { idea, status: "error", error: "Internal error checking credit balance." };
      return;
    }

    if (!allowed) {
      outOfCredits = true;
      results[index] = { idea, status: "skipped", error: "Organization is out of credits for this billing period." };
      return;
    }

    try {
      const report = await generateValidationReport(idea);
      results[index] = { idea, status: "ok", report };
    } catch (error) {
      results[index] = { idea, status: "error", error: friendlyGenerationErrorMessage(error) };
    }
  });

  return Response.json({ results });
}
