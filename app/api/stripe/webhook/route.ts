import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { PLANS } from "@/lib/pricing";
import { createServiceClient } from "@/lib/supabase/service";

// Stripe needs the exact raw request bytes to verify the signature — any
// JSON re-serialization (even semantically identical) breaks it. Next.js
// App Router route handlers don't auto-parse the body, so request.text()
// here is already the raw payload.
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is missing — refusing to process unverifiable events.");
    return Response.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature ?? "", webhookSecret);
  } catch (error) {
    console.error("[stripe/webhook] signature verification failed:", error);
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  const service = createServiceClient();

  // Stripe redelivers events (timeouts, retries) — recording the event id
  // first and bailing on a duplicate means "grant credits" can never run
  // twice for the same event.
  const { error: dedupeError } = await service.from("stripe_webhook_events").insert({ id: event.id });
  if (dedupeError) {
    console.log(`[stripe/webhook] event ${event.id} already processed, skipping`);
    return Response.json({ received: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const planId = session.metadata?.planId;
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

        if (!subscriptionId || !customerId) break;

        if (planId === "prosumer" && session.metadata?.userId) {
          await service
            .from("user_billing")
            .update({
              plan: "prosumer",
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              credits_balance: PLANS.prosumer.creditsPerMonth,
              credits_renew_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", session.metadata.userId);

          await service.from("credit_ledger").insert({
            user_id: session.metadata.userId,
            delta: PLANS.prosumer.creditsPerMonth,
            reason: "subscription_started",
          });
        } else if (planId === "team" && session.metadata?.orgId) {
          await service
            .from("organizations")
            .update({
              plan: "team",
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              credits_balance: PLANS.team.creditsPerMonth,
              credits_renew_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", session.metadata.orgId);

          await service.from("credit_ledger").insert({
            org_id: session.metadata.orgId,
            delta: PLANS.team.creditsPerMonth,
            reason: "subscription_started",
          });
        }
        break;
      }

      // Recurring renewal — keeps credit top-ups tied to Stripe's actual
      // billing cycle/successful payment instead of a client-side timer.
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const billingReason = invoice.billing_reason;
        if (billingReason !== "subscription_cycle") break;

        const subscriptionId =
          typeof invoice.parent?.subscription_details?.subscription === "string"
            ? invoice.parent.subscription_details.subscription
            : invoice.parent?.subscription_details?.subscription?.id;
        if (!subscriptionId) break;

        const nextRenewAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const { data: billingRow } = await service
          .from("user_billing")
          .select("user_id, credits_balance")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (billingRow) {
          const nextBalance = Math.min(
            billingRow.credits_balance + (PLANS.prosumer.creditsPerMonth ?? 0),
            (PLANS.prosumer.creditsPerMonth ?? 0) * 2,
          );
          await service
            .from("user_billing")
            .update({ credits_balance: nextBalance, credits_renew_at: nextRenewAt, updated_at: new Date().toISOString() })
            .eq("user_id", billingRow.user_id);
          await service
            .from("credit_ledger")
            .insert({ user_id: billingRow.user_id, delta: nextBalance - billingRow.credits_balance, reason: "monthly_renewal" });
          break;
        }

        const { data: org } = await service
          .from("organizations")
          .select("id, credits_balance")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (org) {
          // Team credits reset to the plan allotment each cycle (pooled
          // across the org, no rollover) rather than accumulating.
          const nextBalance = PLANS.team.creditsPerMonth ?? 0;
          await service
            .from("organizations")
            .update({ credits_balance: nextBalance, credits_renew_at: nextRenewAt, updated_at: new Date().toISOString() })
            .eq("id", org.id);
          await service
            .from("credit_ledger")
            .insert({ org_id: org.id, delta: nextBalance - org.credits_balance, reason: "monthly_renewal" });
        }
        break;
      }

      // Subscription ended (cancelled, or payment failed past Stripe's own
      // retry schedule) — fall back to the free plan rather than leaving a
      // "prosumer" label on an account nobody's paying for. Any credits
      // already granted stay spendable; they just won't renew again.
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await service
          .from("user_billing")
          .update({ plan: "free", stripe_subscription_id: null, updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscription.id);

        // Team orgs keep their `plan` value (their subscription just isn't
        // active) — org identity and membership aren't torn down, but
        // credits stop renewing since no more invoice.paid events will
        // arrive for this subscription.
        await service
          .from("organizations")
          .update({ stripe_subscription_id: null, updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error(`[stripe/webhook] failed handling ${event.type}:`, error);
    // Undo the dedupe record so Stripe's automatic retry gets a real second
    // attempt instead of silently no-op'ing against an event we recorded
    // but never actually finished handling.
    await service.from("stripe_webhook_events").delete().eq("id", event.id);
    return Response.json({ error: "Internal error processing webhook." }, { status: 500 });
  }

  return Response.json({ received: true });
}
