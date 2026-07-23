import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { PricingCards } from "@/components/pricing/PricingCards";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";

export const metadata: Metadata = {
  title: "Pricing — FounderCopilot",
  description: "Hybrid pricing for FounderCopilot: free lead-gen tier, Prosumer credits, Team/Accelerator seats, and custom Enterprise.",
};

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentPlanId: PlanId | null = null;
  if (user) {
    const entitlements = await getEntitlements(user.id);
    currentPlanId = entitlements.planId;
  }

  const plans = PLAN_ORDER.map((id) => PLANS[id]);

  return (
    <div className="min-h-screen bg-paper text-slate-text">
      <div className="relative overflow-hidden">
        <div aria-hidden className="hero-glow pointer-events-none absolute inset-0" />
        <div aria-hidden className="bg-grid-faint pointer-events-none absolute inset-0" />
        <SiteHeader />

        <section className="relative mx-auto max-w-3xl px-6 pt-12 text-center sm:pt-16">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-brand">Pricing</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-slate-text sm:text-5xl">
            Cheaper than one consultant call
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-500">
            A startup consultant charges <strong className="text-slate-700">$5,000–$15,000</strong> for idea
            validation, market sizing, and a go-to-market plan. FounderCopilot starts free and scales with how
            many ideas — and how often — you need to check.
          </p>
        </section>
      </div>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mt-10">
          <PricingCards plans={plans} currentPlanId={currentPlanId} isSignedIn={Boolean(user)} />
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            All plans include the same 8-factor scoring model — higher tiers add more credits, more seats, and
            capabilities for teams validating a portfolio of ideas rather than one at a time. Cancel anytime from
            your dashboard.
          </p>
        </div>
      </main>
    </div>
  );
}
