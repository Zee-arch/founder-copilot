"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// No createOrg/setActiveOrg here — org creation is exclusively tied to
// Stripe Team-plan checkout (see app/api/stripe/checkout/route.ts), and a
// user has at most one org (see lib/entitlements.ts's findOrgMembership).
// These actions only manage membership *within* an org that already
// exists: inviting, accepting, and role/removal management.

export async function inviteToOrg(
  orgId: string,
  email: string,
  role: "admin" | "member",
): Promise<{ token?: string; error?: string }> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) return { error: "Enter an email address." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data, error } = await supabase
    .from("org_invites")
    .insert({ org_id: orgId, email: trimmedEmail, role, invited_by: user.id })
    .select("token")
    .single();

  // RLS silently blocks this insert for a non-owner/admin (returns a
  // policy-violation error here rather than a fake success) — surfaced
  // as-is since it's already a clear, actionable message for that case.
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/org/${orgId}/settings`);
  return { token: data.token as string };
}

export async function revokeInvite(orgId: string, inviteId: string) {
  const supabase = await createClient();
  await supabase.from("org_invites").delete().eq("id", inviteId);
  revalidatePath(`/dashboard/org/${orgId}/settings`);
}

export async function removeMember(orgId: string, userId: string) {
  const supabase = await createClient();
  await supabase.from("organization_members").delete().eq("org_id", orgId).eq("user_id", userId);
  revalidatePath(`/dashboard/org/${orgId}/settings`);
}

export async function updateMemberRole(orgId: string, userId: string, role: "admin" | "member") {
  const supabase = await createClient();
  await supabase.from("organization_members").update({ role }).eq("org_id", orgId).eq("user_id", userId);
  revalidatePath(`/dashboard/org/${orgId}/settings`);
}

export async function leaveOrg(orgId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("organization_members").delete().eq("org_id", orgId).eq("user_id", user.id);

  redirect("/dashboard");
}

export async function acceptInvite(token: string): Promise<{ orgId?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_org_invite", { invite_token: token });
  if (error) return { error: error.message };

  return { orgId: data as string };
}
