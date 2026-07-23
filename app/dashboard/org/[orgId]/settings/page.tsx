import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { OrgSettings } from "@/components/orgs/OrgSettings";
import type { OrgInviteRow, OrgMemberRow, OrgRole } from "@/lib/org-types";

export const metadata: Metadata = {
  title: "Team settings — FounderCopilot",
};

export default async function OrgSettingsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(`/dashboard/org/${orgId}/settings`)}`);

  const { data: org } = await supabase.from("orgs").select("id, name, slug").eq("id", orgId).maybeSingle();
  if (!org) notFound();

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  const myRole = (membership?.role ?? null) as OrgRole | null;
  if (!myRole) notFound();
  if (myRole === "member") redirect(`/dashboard/org/${orgId}`);

  const { data: memberRows } = await supabase
    .from("org_members")
    .select("user_id, role, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  const userIds = (memberRows ?? []).map((m) => m.user_id);
  const { data: profileRows } = userIds.length
    ? await supabase.from("profiles").select("id, email, display_name").in("id", userIds)
    : { data: [] as { id: string; email: string; display_name: string | null }[] };

  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));

  const members: OrgMemberRow[] = (memberRows ?? []).map((m) => ({
    user_id: m.user_id,
    role: m.role as OrgRole,
    created_at: m.created_at,
    email: profileById.get(m.user_id)?.email ?? "",
    display_name: profileById.get(m.user_id)?.display_name ?? null,
  }));

  const { data: inviteRows } = await supabase
    .from("org_invites")
    .select("id, email, role, token, created_at, expires_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  const invites = (inviteRows ?? []) as OrgInviteRow[];

  return (
    <div className="min-h-screen bg-paper text-slate-text">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <p className="font-mono text-xs font-semibold uppercase tracking-wider text-brand">Team</p>
        <h1 className="mt-2 font-display text-3xl text-slate-text">{org.name} settings</h1>

        <div className="mt-8">
          <OrgSettings orgId={orgId} myUserId={user.id} myRole={myRole} members={members} invites={invites} />
        </div>
      </main>
    </div>
  );
}
