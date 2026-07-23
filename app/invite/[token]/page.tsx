import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { AcceptInviteCard } from "@/components/orgs/AcceptInviteCard";

export const metadata: Metadata = {
  title: "Team invite — FounderCopilot",
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const { data: previewRow } = await supabase.rpc("get_invite_preview", { invite_token: token }).maybeSingle();
  // Supabase client here isn't generated against a Database type (this
  // project doesn't use `supabase gen types` — see supabase/schema.sql
  // convention), so an rpc()'s return shape isn't known statically.
  const preview = previewRow as { org_name: string; email: string; role: string; valid: boolean } | null;

  return (
    <div className="min-h-screen bg-paper text-slate-text">
      <SiteHeader />

      <main className="mx-auto max-w-md px-6 py-12 sm:py-16">
        <p className="font-mono text-xs font-semibold uppercase tracking-wider text-brand">Team invite</p>

        {!preview || !preview.valid ? (
          <div className="mt-8 rounded-2xl border border-signal-pivot/30 bg-signal-pivot-dim px-5 py-4 text-sm text-signal-pivot">
            This invite link is invalid or has expired. Ask whoever invited you to send a new one.
          </div>
        ) : (
          <>
            <h1 className="mt-2 font-display text-3xl text-slate-text">Join {preview.org_name}</h1>
            <div className="mt-8">
              <AcceptInviteCard token={token} invitedEmail={preview.email} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
