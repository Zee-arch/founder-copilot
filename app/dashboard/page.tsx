import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { DashboardReports, type ReportRow } from "@/components/dashboard/DashboardReports";
import { BillingSummary } from "@/components/dashboard/BillingSummary";
import { ApiKeysManager, type ApiKeyRow } from "@/components/dashboard/ApiKeysManager";
import { getEntitlements } from "@/lib/entitlements";

export const metadata: Metadata = {
  title: "Dashboard — FounderCopilot",
  description: "Your saved startup idea validation reports.",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/dashboard");

  const [{ data: reports, error }, entitlements] = await Promise.all([
    supabase.from("reports").select("id, idea, report, created_at").order("created_at", { ascending: false }),
    getEntitlements(user.id),
  ]);

  const rows = (reports ?? []) as ReportRow[];

  let hasStripeCustomer = false;
  let apiKeys: ApiKeyRow[] = [];
  let canManageApiKeys = false;

  if (entitlements.source === "org") {
    const [{ data: org }, { data: keys }, { data: membership }] = await Promise.all([
      supabase.from("organizations").select("stripe_customer_id").eq("id", entitlements.orgId).maybeSingle(),
      supabase
        .from("api_keys")
        .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
        .eq("org_id", entitlements.orgId)
        .order("created_at", { ascending: false }),
      supabase.from("organization_members").select("role").eq("org_id", entitlements.orgId).eq("user_id", user.id).maybeSingle(),
    ]);
    hasStripeCustomer = Boolean(org?.stripe_customer_id);
    apiKeys = (keys ?? []) as ApiKeyRow[];
    canManageApiKeys = membership?.role === "owner" || membership?.role === "admin";
  } else {
    const { data: billing } = await supabase
      .from("user_billing")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    hasStripeCustomer = Boolean(billing?.stripe_customer_id);
  }

  return (
    <div className="min-h-screen bg-paper text-slate-text">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <p className="font-mono text-xs font-semibold uppercase tracking-wider text-brand">Dashboard</p>
        <h1 className="mt-2 font-display text-3xl text-slate-text">Your reports</h1>

        <div className="mt-6 space-y-4">
          <BillingSummary entitlements={entitlements} hasStripeCustomer={hasStripeCustomer} />
          {entitlements.source === "org" && <ApiKeysManager initialKeys={apiKeys} canManage={canManageApiKeys} />}
        </div>

        {error && (
          <div className="mt-8 rounded-2xl border border-signal-pivot/30 bg-signal-pivot-dim px-5 py-3 text-sm text-signal-pivot">
            Couldn&apos;t load your reports right now. Try refreshing the page.
          </div>
        )}

        {!error && rows.length === 0 && (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center">
            <FolderOpen className="h-8 w-8 text-slate-300" />
            <p className="font-display text-lg text-slate-text">No reports yet</p>
            <p className="max-w-sm text-sm text-slate-500">
              Generate a validation report for a startup idea and, while signed in, it&apos;ll be saved here
              automatically.
            </p>
            <Link
              href="/"
              className="mt-2 inline-flex items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dim"
            >
              Validate an idea
            </Link>
          </div>
        )}

        {!error && rows.length > 0 && <DashboardReports rows={rows} />}
      </main>
    </div>
  );
}
