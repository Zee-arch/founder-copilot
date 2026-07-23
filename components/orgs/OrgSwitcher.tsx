"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { setActiveOrg } from "@/app/actions/orgs";
import type { OrgWithRole } from "@/lib/org-types";

export function OrgSwitcher({ orgs, activeOrgId }: { orgs: OrgWithRole[]; activeOrgId: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleSetActive(orgId: string | null) {
    setPendingId(orgId);
    startTransition(async () => {
      await setActiveOrg(orgId);
      router.refresh();
      setPendingId(null);
    });
  }

  if (orgs.length === 0) {
    return (
      <div className="mt-8 flex items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-4">
        <p className="text-sm text-slate-500">Not on a team yet — create one to compare reports with a cohort.</p>
        <Link
          href="/dashboard/org/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-dim"
        >
          <Plus className="h-3.5 w-3.5" />
          New team
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Your teams</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleSetActive(null)}
          disabled={isPending}
          className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium transition ${
            activeOrgId === null ? "border-brand bg-brand/10 text-brand" : "border-slate-200 bg-white text-slate-600 hover:border-brand/40"
          }`}
        >
          {activeOrgId === null && pendingId !== "new-team" && <Check className="h-3.5 w-3.5" />}
          Personal
        </button>

        {orgs.map((org) => (
          <div key={org.id} className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSetActive(org.id)}
              disabled={isPending}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium transition ${
                activeOrgId === org.id ? "border-brand bg-brand/10 text-brand" : "border-slate-200 bg-white text-slate-600 hover:border-brand/40"
              }`}
            >
              {activeOrgId === org.id && <Check className="h-3.5 w-3.5" />}
              {org.name}
            </button>
            <Link
              href={`/dashboard/org/${org.id}`}
              className="text-xs font-medium text-slate-400 underline-offset-2 hover:text-brand hover:underline"
            >
              View
            </Link>
          </div>
        ))}

        <Link
          href="/dashboard/org/new"
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-4 py-2 text-xs font-medium text-slate-500 transition hover:border-brand/40 hover:text-slate-900"
        >
          <Plus className="h-3.5 w-3.5" />
          New team
        </Link>
      </div>
      {activeOrgId !== null && (
        <p className="mt-2 text-xs text-slate-400">
          New reports you generate will be tagged to this team and visible to your teammates.
        </p>
      )}
    </div>
  );
}
