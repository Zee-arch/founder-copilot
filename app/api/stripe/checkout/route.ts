import { getStripe } from "@/lib/stripe";
import { PLANS, type PlanId } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function getSiteUrl(request: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
}

// Only plans with a real Stripe Price ID are self-serve checkout-able —
// free has no charge, enterprise is "contact sales," not a button here.
function checkoutablePlan(planId: unknown): planId is Extract<PlanId, "prosumer" | "team"> {
  return planId === "prosumer" || planId === "team";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return Response.json({ error: "Please log in before subscribing." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { plan?: string };

  if (!checkoutablePlan(body.plan)) {
    return Response.json({ error: "Unknown plan." }, { status: 400 });
  }

  const plan = PLANS[body.plan];
  const priceId = plan.stripePriceEnvVar ? process.env[plan.stripePriceEnvVar] : undefined;

  if (!priceId) {
    return Response.json(
      {
        error: `${plan.stripePriceEnvVar} is not set. Create a recurring Price for "${plan.name}" in the Stripe Dashboard and add its ID to .env.local.`,
      },
      { status: 500 },
    );
  }

  const siteUrl = getSiteUrl(request);
  const stripe = getStripe();

  try {
    if (plan.id === "prosumer") {
      const { data: billing } = await supabase
        .from("user_billing")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: billing?.stripe_customer_id ?? undefined,
        customer_email: billing?.stripe_customer_id ? undefined : user.email,
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: user.id,
        metadata: { planId: "prosumer", userId: user.id },
        subscription_data: { metadata: { planId: "prosumer", userId: user.id } },
        success_url: `${siteUrl}/dashboard?checkout=success`,
        cancel_url: `${siteUrl}/pricing?checkout=cancelled`,
      });

      return Response.json({ url: session.url });
    }

    // Team plan: billed at the org level. A user who isn't in an org yet
    // gets one created here (owner + sole member) so checkout has
    // something to attach the subscription to — see the webhook handler
    // for how the org's Stripe fields get filled in once payment succeeds.
    const service = createServiceClient();

    let orgId: string;
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1);

    if (memberships?.[0]) {
      orgId = memberships[0].org_id;
    } else {
      const { data: org, error: orgError } = await service
        .from("organizations")
        .insert({ name: `${user.email.split("@")[0]}'s Team`, owner_id: user.id })
        .select("id")
        .single();

      if (orgError || !org) {
        throw new Error(`Failed to create organization: ${orgError?.message}`);
      }

      const { error: memberError } = await service
        .from("organization_members")
        .insert({ org_id: org.id, user_id: user.id, role: "owner" });

      if (memberError) {
        throw new Error(`Failed to add owner as org member: ${memberError.message}`);
      }

      orgId = org.id;
    }

    const { data: org } = await supabase.from("organizations").select("stripe_customer_id").eq("id", orgId).single();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: org?.stripe_customer_id ?? undefined,
      customer_email: org?.stripe_customer_id ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: orgId,
      metadata: { planId: "team", userId: user.id, orgId },
      subscription_data: { metadata: { planId: "team", userId: user.id, orgId } },
      success_url: `${siteUrl}/dashboard?checkout=success`,
      cancel_url: `${siteUrl}/pricing?checkout=cancelled`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error("[stripe/checkout] failed:", error);
    return Response.json({ error: "Couldn't start checkout. Please try again." }, { status: 500 });
  }
}
