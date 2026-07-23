"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/org-cookie";

const ONE_YEAR = 60 * 60 * 24 * 365;

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // A random suffix, not a numeric counter — sidesteps a slug-collision
  // query entirely, and `orgs.slug` still has a unique constraint as the
  // real backstop.
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "org"}-${suffix}`;
}

export async function createOrg(name: string): Promise<{ orgId?: string; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Give your org a name." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_org", {
    org_name: trimmed,
    org_slug: slugify(trimmed),
  });

  if (error) return { error: error.message };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, data as string, { path: "/", maxAge: ONE_YEAR });

  revalidatePath("/dashboard");
  return { orgId: data as string };
}

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
  await supabase.from("org_members").delete().eq("org_id", orgId).eq("user_id", userId);
  revalidatePath(`/dashboard/org/${orgId}/settings`);
}

export async function updateMemberRole(orgId: string, userId: string, role: "admin" | "member") {
  const supabase = await createClient();
  await supabase.from("org_members").update({ role }).eq("org_id", orgId).eq("user_id", userId);
  revalidatePath(`/dashboard/org/${orgId}/settings`);
}

export async function leaveOrg(orgId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("org_members").delete().eq("org_id", orgId).eq("user_id", user.id);

  const cookieStore = await cookies();
  if (cookieStore.get(ACTIVE_ORG_COOKIE)?.value === orgId) {
    cookieStore.delete(ACTIVE_ORG_COOKIE);
  }

  redirect("/dashboard");
}

export async function acceptInvite(token: string): Promise<{ orgId?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_org_invite", { invite_token: token });
  if (error) return { error: error.message };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, data as string, { path: "/", maxAge: ONE_YEAR });

  return { orgId: data as string };
}

// Never trusts the client-passed orgId blindly — even though a spoofed
// value would also just fail RLS on the next report insert, checking
// membership here means the switch fails immediately with a clear
// redirect instead of a silently-swallowed insert failure later.
export async function setActiveOrg(orgId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();

  if (orgId === null) {
    cookieStore.delete(ACTIVE_ORG_COOKIE);
    revalidatePath("/dashboard");
    return;
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) redirect("/dashboard");

  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, { path: "/", maxAge: ONE_YEAR });
  revalidatePath("/dashboard");
}
