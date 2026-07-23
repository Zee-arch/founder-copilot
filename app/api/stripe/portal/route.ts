import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

function getSiteUrl(request: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
}

// Points the signed-in user at Stripe's hosted Billing Portal, so plan
// changes/cancellation/invoice history stay Stripe's problem instead of
// screens this app has to build and keep correct.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Please log in first." }, { status: 401 });
  }

  const { data: billing } = await supabase
    .from("user_billing")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = billing?.stripe_customer_id ?? null;

  if (!customerId) {
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1);

    if (memberships?.[0]) {
      const { data: org } = await supabase
        .from("organizations")
        .select("stripe_customer_id")
        .eq("id", memberships[0].org_id)
        .maybeSingle();
      customerId = org?.stripe_customer_id ?? null;
    }
  }

  if (!customerId) {
    return Response.json(
      { error: "No billing account yet — subscribe to a paid plan first." },
      { status: 400 },
    );
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getSiteUrl(request)}/dashboard`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error("[stripe/portal] failed:", error);
    return Response.json({ error: "Couldn't open the billing portal. Please try again." }, { status: 500 });
  }
}
