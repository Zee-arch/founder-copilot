// Single source of truth for pricing tiers — the pricing page, checkout
// route, webhook handler, and entitlements logic all read from here instead
// of duplicating plan details. Anchored against a $5,000-$15,000 consultant
// engagement (the real alternative for idea validation + ongoing
// re-checks), not against $29/mo hobbyist tools — see the roadmap memory
// for why.
//
// Prices/credit amounts below are a reasonable starting point, not
// something the founder specified — they live in one place on purpose so
// they're a five-minute edit, not a code change, once real usage data (or
// the founder's own judgment) says otherwise.

export type PlanId = "free" | "prosumer" | "team" | "enterprise";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyPriceUsd: number | null; // null = custom/"Contact us"
  creditsPerMonth: number | null; // null = not credit-metered (enterprise = custom)
  seatsIncluded: number | null; // team/enterprise only
  extraSeatPriceUsd: number | null;
  features: string[];
  // Env var names (not the values) holding the Stripe Price IDs for this
  // plan — kept as a lookup so checkout/webhook code never hardcodes a
  // price ID string.
  stripePriceEnvVar: string | null;
  stripeSeatPriceEnvVar: string | null;
  cta: string;
  highlighted?: boolean;
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Try it on your own idea, no card required.",
    monthlyPriceUsd: 0,
    creditsPerMonth: 3,
    seatsIncluded: 1,
    extraSeatPriceUsd: null,
    features: [
      "3 validation reports / month",
      "Full 8-factor score + verdict",
      "PDF export",
      "Community support",
    ],
    stripePriceEnvVar: null,
    stripeSeatPriceEnvVar: null,
    cta: "Start free",
  },
  prosumer: {
    id: "prosumer",
    name: "Prosumer",
    tagline: "For a founder validating and re-validating multiple ideas.",
    monthlyPriceUsd: 39,
    creditsPerMonth: 30,
    seatsIncluded: 1,
    extraSeatPriceUsd: null,
    features: [
      "30 credits / month (reports + re-validations)",
      "Unused credits roll over one month",
      "Priority model access",
      "Email support",
      "Ongoing monitoring & re-validation alerts (coming soon)",
    ],
    stripePriceEnvVar: "STRIPE_PRICE_PROSUMER",
    stripeSeatPriceEnvVar: null,
    cta: "Subscribe",
    highlighted: true,
  },
  team: {
    id: "team",
    name: "Team / Accelerator",
    tagline: "For accelerators, agencies, and teams validating a portfolio of ideas.",
    monthlyPriceUsd: 249,
    creditsPerMonth: 150,
    seatsIncluded: 5,
    extraSeatPriceUsd: 29,
    features: [
      "150 pooled credits / month across the org",
      "5 seats included, add more anytime",
      "API access for programmatic validation",
      "Batch validation (submit up to 20 ideas at once)",
      "White-labeled reports (coming soon)",
      "Priority support",
    ],
    stripePriceEnvVar: "STRIPE_PRICE_TEAM",
    stripeSeatPriceEnvVar: "STRIPE_PRICE_TEAM_SEAT",
    cta: "Start Team plan",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Custom volume, contracts, and support for larger organizations.",
    monthlyPriceUsd: null,
    creditsPerMonth: null,
    seatsIncluded: null,
    extraSeatPriceUsd: null,
    features: [
      "Custom credit volume and seats",
      "Custom contract & invoicing",
      "SSO & dedicated support (coming soon)",
      "Everything in Team",
    ],
    stripePriceEnvVar: null,
    stripeSeatPriceEnvVar: null,
    cta: "Contact sales",
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "prosumer", "team", "enterprise"];

export function isPaidPlan(planId: PlanId): boolean {
  return planId === "prosumer" || planId === "team";
}
