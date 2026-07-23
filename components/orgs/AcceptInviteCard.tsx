"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "@/app/actions/orgs";

export function AcceptInviteCard({ token, invitedEmail }: { token: string; invitedEmail: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleAccept() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError("");

    const result = await acceptInvite(token);

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    router.push(`/dashboard/org/${result.orgId}`);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
      <p className="font-display text-lg text-slate-text">You&apos;ve been invited</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        This invite was sent to <span className="font-medium text-slate-700">{invitedEmail}</span>. Accept it to join
        the team and see the cohort dashboard.
      </p>

      {error && <p className="mt-4 text-sm text-signal-pivot">{error}</p>}

      <button
        type="button"
        onClick={handleAccept}
        disabled={isSubmitting}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-dim disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isSubmitting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Joining…
          </>
        ) : (
          "Accept invite"
        )}
      </button>
    </div>
  );
}
