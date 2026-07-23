import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FolderOpen, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { CohortStats } from "@/components/orgs/CohortStats";
import { CohortReports } from "@/components/orgs/CohortReports";
import type { CohortReportRow } from "@/components/orgs/CohortReportRow";
import type { ValidationReport } from "@/lib/types";
import type { OrgRole } from "@/lib/org-types";

export const metadata: Metadata = {
  title: "Team dashboard — FounderCopilot",
  description: "Compare idea validation reports across your team or cohort.",
};

export default async function OrgDashboardPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(`/dashboard/org/${orgId}`)}`);

  const { data: org } = await supabase.from("organizations").select("id, name").eq("id", orgId).maybeSingle();
  if (!org) notFound();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  const myRole = (membership?.role ?? null) as OrgRole | null;
  if (!myRole) notFound();

  const { data: reportRows, error } = await supabase
    .from("reports")
    .select("id, idea, report, created_at, user_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const userIds = Array.from(new Set((reportRows ?? []).map((r) => r.user_id)));
  const { data: profileRows } = userIds.length
    ? await supabase.from("profiles").select("id, email, display_name").in("id", userIds)
    : { data: [] as { id: string; email: string; display_name: string | null }[] };

  const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));

  const rows: CohortReportRow[] = (reportRows ?? []).map((r) => {
    const profile = profileById.get(r.user_id);
    return {
      id: r.id,
      idea: r.idea,
      report: r.report as ValidationReport,
      created_at: r.created_at,
      submitterName: profile?.display_name || profile?.email || "Unknown",
    };
  });

  return (
    <div className="min-h-screen bg-paper text-slate-text">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-brand">Team dashboard</p>
            <h1 className="mt-2 font-display text-3xl text-slate-text">{org.name}</h1>
          </div>
          {(myRole === "owner" || myRole === "admin") && (
            <Link
              href={`/dashboard/org/${orgId}/settings`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand/40 hover:text-slate-900"
            >
              <Settings className="h-4 w-4" />
              Team settings
            </Link>
          )}
        </div>

        {error && (
          <div className="mt-8 rounded-2xl border border-signal-pivot/30 bg-signal-pivot-dim px-5 py-3 text-sm text-signal-pivot">
            Couldn&apos;t load the team&apos;s reports right now. Try refreshing the page.
          </div>
        )}

        {!error && rows.length === 0 && (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center">
            <FolderOpen className="h-8 w-8 text-slate-300" />
            <p className="font-display text-lg text-slate-text">No reports yet</p>
            <p className="max-w-sm text-sm text-slate-500">
              Once members generate a report while this team is active, it&apos;ll show up here for everyone on the
              team to see.
            </p>
            <Link
              href="/"
              className="mt-2 inline-flex items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dim"
            >
              Validate an idea
            </Link>
          </div>
        )}

        {!error && rows.length > 0 && (
          <div className="mt-8">
            <CohortStats rows={rows} />
            <CohortReports rows={rows} />
          </div>
        )}
      </main>
    </div>
  );
}
