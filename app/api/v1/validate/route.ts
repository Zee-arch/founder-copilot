import { requireApiKey } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { MAX_IDEA_LENGTH, friendlyGenerationErrorMessage, generateValidationReport } from "@/lib/generate-report";

export const maxDuration = 60;

// Team-tier API access: POST { "idea": "..." } with `Authorization: Bearer
// <api key>`, get back the same validation report the web UI produces.
// Credits are spent from the org's pooled balance, same accounting as the
// dashboard's generations — see consume_org_credit_for_api_key in
// supabase/schema.sql for why this is a separate RPC from the
// session-authenticated one.
export async function POST(request: Request) {
  const auth = await requireApiKey(request);
  if ("error" in auth) return auth.error;

  const service = createServiceClient();
  const { data: allowed, error: consumeError } = await service.rpc("consume_org_credit_for_api_key", {
    p_org_id: auth.key.orgId,
  });

  if (consumeError) {
    console.error("[api/v1/validate] credit consumption failed:", consumeError.message);
    return Response.json({ error: "Internal error checking credit balance." }, { status: 500 });
  }

  if (!allowed) {
    return Response.json({ error: "Your organization is out of credits for this billing period." }, { status: 402 });
  }

  const body = (await request.json().catch(() => ({}))) as { idea?: string };
  const idea = body.idea?.trim();

  if (!idea) {
    return Response.json({ error: "Please provide an `idea` string." }, { status: 400 });
  }

  if (idea.length > MAX_IDEA_LENGTH) {
    return Response.json({ error: `Keep \`idea\` under ${MAX_IDEA_LENGTH} characters.` }, { status: 400 });
  }

  try {
    const report = await generateValidationReport(idea);
    return Response.json({ idea, report });
  } catch (error) {
    console.error("[api/v1/validate] generation failed:", error);
    return Response.json({ error: friendlyGenerationErrorMessage(error) }, { status: 500 });
  }
}
