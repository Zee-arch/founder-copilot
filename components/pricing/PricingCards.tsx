"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import type { Plan, PlanId } from "@/lib/pricing";

const CONTACT_EMAIL = "zaeemather7@gmail.com";

export function PricingCards({
  plans,
  currentPlanId,
  isSignedIn,
}: {
  plans: Plan[];
  currentPlanId: PlanId | null;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(planId: Extract<PlanId, "prosumer" | "team">) {
    setError(null);

    if (!isSignedIn) {
      router.push(`/login?next=/pricing`);
      return;
    }

    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        setError(data.error || "Couldn't start checkout. Please try again.");
        setLoadingPlan(null);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setLoadingPlan(null);
    }
  }

  return (
    <div>
      {error && (
        <div className="mx-auto mb-6 max-w-2xl rounded-2xl border border-signal-pivot/30 bg-signal-pivot-dim px-5 py-3 text-center text-sm text-signal-pivot">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = currentPlanId === plan.id;

          return (
            <div
              key={plan.id}
              className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                plan.highlighted ? "border-brand ring-1 ring-brand" : "border-slate-200"
              }`}
            >
              {plan.highlighted && (
                <span className="mb-3 inline-flex w-fit items-center rounded-full bg-brand/10 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-brand">
                  Most popular
                </span>
              )}

              <p className="font-display text-xl text-slate-text">{plan.name}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{plan.tagline}</p>

              <div className="mt-5">
                {plan.monthlyPriceUsd === null ? (
                  <p className="font-display text-3xl text-slate-text">Custom</p>
                ) : (
                  <p className="font-display text-3xl text-slate-text">
                    ${plan.monthlyPriceUsd}
                    <span className="text-base font-normal text-slate-400">/mo</span>
                  </p>
                )}
                {plan.seatsIncluded !== null && plan.seatsIncluded > 1 && (
                  <p className="mt-1 text-xs text-slate-400">{plan.seatsIncluded} seats included</p>
                )}
              </div>

              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <span className="flex w-full items-center justify-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-400">
                    Current plan
                  </span>
                ) : plan.id === "free" ? (
                  <Link
                    href={isSignedIn ? "/dashboard" : "/sign-up"}
                    className="flex w-full items-center justify-center rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-ink-text transition hover:opacity-90"
                  >
                    {plan.cta}
                  </Link>
                ) : plan.id === "enterprise" ? (
                  <a
                    href={`mailto:${CONTACT_EMAIL}?subject=FounderCopilot%20Enterprise`}
                    className="flex w-full items-center justify-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => startCheckout(plan.id as "prosumer" | "team")}
                    disabled={loadingPlan === plan.id}
                    className="flex w-full items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dim disabled:opacity-60"
                  >
                    {loadingPlan === plan.id ? "Redirecting…" : plan.cta}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
