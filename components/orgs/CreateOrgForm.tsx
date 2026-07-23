"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrg } from "@/app/actions/orgs";

export function CreateOrgForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    const result = await createOrg(name);

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    router.push(`/dashboard/org/${result.orgId}`);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="font-display text-lg text-slate-text">Create a team</p>
      <p className="mt-1 text-sm text-slate-500">
        Give your accelerator, cohort, or investment team a shared space to compare everyone&apos;s idea validation
        reports.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="org-name" className="block text-sm font-medium text-slate-700">
            Team name
          </label>
          <input
            id="org-name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Acme Accelerator, Cohort 12"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
          />
        </div>

        {error && <p className="text-sm text-signal-pivot">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-dim disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Creating team…
            </>
          ) : (
            "Create team"
          )}
        </button>
      </form>
    </div>
  );
}
