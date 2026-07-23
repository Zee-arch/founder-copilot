import Stripe from "stripe";

// Lazily constructed so the app (and anonymous generation, which doesn't
// touch billing at all) keeps working with zero Stripe setup — same
// "fail quiet if unconfigured" pattern as lib/supabase/middleware.ts.
// Routes that actually need Stripe call this and get a clear error instead
// of a silent crash if the key is missing.
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is missing. Add it to your .env.local file and restart the server.");
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: "2026-06-24.dahlia",
  });

  return stripeClient;
}
