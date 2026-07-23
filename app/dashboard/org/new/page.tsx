import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { CreateOrgForm } from "@/components/orgs/CreateOrgForm";

export const metadata: Metadata = {
  title: "Create a team — FounderCopilot",
  description: "Create a shared team workspace for comparing idea validation reports across a cohort.",
};

export default async function NewOrgPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/dashboard/org/new");

  return (
    <div className="min-h-screen bg-paper text-slate-text">
      <SiteHeader />

      <main className="mx-auto max-w-md px-6 py-12 sm:py-16">
        <p className="font-mono text-xs font-semibold uppercase tracking-wider text-brand">Dashboard</p>
        <h1 className="mt-2 font-display text-3xl text-slate-text">New team</h1>

        <div className="mt-8">
          <CreateOrgForm />
        </div>
      </main>
    </div>
  );
}
