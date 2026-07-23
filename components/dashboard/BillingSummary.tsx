"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { PLANS } from "@/lib/pricing";
import type { Entitlements } from "@/lib/entitlements";

export function BillingSummary({ entitlements, hasStripeCustomer }: { entitlements: Entitlements; hasStripeCustomer: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = PLANS[entitlements.planId];

  async function openBillingPortal() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || "Couldn't open billing portal.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-brand">
            {entitlements.source === "org" ? entitlements.orgName : "Your plan"}
          </p>
          <p className="mt-1 font-display text-xl text-slate-text">{plan.name}</p>
          <p className="mt-1 text-sm text-slate-500">
            {entitlements.creditsBalance} credit{entitlements.creditsBalance === 1 ? "" : "s"} remaining
            {plan.creditsPerMonth ? ` of ${plan.creditsPerMonth}/month` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {entitlements.planId === "free" && (
            <Link
              href="/pricing"
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dim"
            >
              Upgrade
            </Link>
          )}
          {hasStripeCustomer && (
            <button
              type="button"
              onClick={openBillingPortal}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-60"
            >
              <CreditCard className="h-3.5 w-3.5" />
              {loading ? "Opening…" : "Manage billing"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-signal-pivot">{error}</p>}
    </div>
  );
}
