"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createApiKey, revokeApiKey } from "@/lib/api-keys";

type MembershipResult = { error: string } | { orgId: string };

async function requireTeamOrgMembership(userId: string): Promise<MembershipResult> {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!membership) return { error: "You're not part of a Team organization." };

  // Only an owner/admin can mint or revoke keys that can spend the whole
  // org's shared credit balance — a plain member can use the product but
  // shouldn't be able to create standing API access to it.
  if (membership.role === "member") {
    return { error: "Only a Team org owner or admin can manage API keys." };
  }

  return { orgId: membership.org_id as string };
}

export async function createTeamApiKeyAction(
  name: string,
): Promise<{ rawKey: string; id: string; keyPrefix: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." };

  const membership = await requireTeamOrgMembership(user.id);
  if ("error" in membership) return membership;

  try {
    const { rawKey, keyRow } = await createApiKey(membership.orgId, user.id, name.trim() || "API key");
    revalidatePath("/dashboard");
    return { rawKey, id: keyRow.id, keyPrefix: keyRow.key_prefix };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create API key." };
  }
}

export async function revokeTeamApiKeyAction(keyId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." };

  const membership = await requireTeamOrgMembership(user.id);
  if ("error" in membership) return membership;

  try {
    await revokeApiKey(keyId, membership.orgId);
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to revoke API key." };
  }
}
