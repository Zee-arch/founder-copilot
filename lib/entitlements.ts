import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PLANS, type PlanId } from "@/lib/pricing";

export type Entitlements =
  | {
      source: "org";
      planId: Extract<PlanId, "team" | "enterprise">;
      orgId: string;
      orgName: string;
      creditsBalance: number;
    }
  | {
      source: "user";
      planId: Extract<PlanId, "free" | "prosumer">;
      creditsBalance: number;
    };

type UserBillingRow = {
  user_id: string;
  plan: "free" | "prosumer";
  credits_balance: number;
  credits_renew_at: string;
};

// Free/prosumer credits reset to the plan's monthly amount rather than
// accumulating uncapped — "3/month" and "30/month" are meant as a repeating
// allowance, not a balance that grows forever if unused. Prosumer's pricing
// copy promises one month of rollover, so it can carry over up to one
// extra month's worth before resetting; free has no rollover.
function renewedBalance(plan: "free" | "prosumer", currentBalance: number): number {
  const monthly = PLANS[plan].creditsPerMonth ?? 0;
  if (plan === "free") return monthly;
  return Math.min(currentBalance + monthly, monthly * 2);
}

async function ensureUserBillingRow(userId: string): Promise<UserBillingRow> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("user_billing")
    .select("user_id, plan, credits_balance, credits_renew_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) return data as UserBillingRow;

  // No row yet (first time this user's entitlements have been checked) —
  // regular users have no insert policy on user_billing (see schema.sql),
  // so this one-time bootstrap goes through the service-role client.
  const service = createServiceClient();
  const { data: created, error } = await service
    .from("user_billing")
    .insert({ user_id: userId })
    .select("user_id, plan, credits_balance, credits_renew_at")
    .single();

  if (error || !created) {
    throw new Error(`Failed to create billing row for user ${userId}: ${error?.message}`);
  }

  return created as UserBillingRow;
}

async function renewIfDue(row: UserBillingRow): Promise<UserBillingRow> {
  // Prosumer's renewal is driven by Stripe's `invoice.paid` webhook instead
  // (see app/api/stripe/webhook/route.ts), so it stays in sync with the
  // actual billing cycle/payment success rather than a client-computed
  // 30-day timer that could drift or fire even if a payment failed. This
  // lazy path only exists for the free plan, which has no Stripe
  // subscription to key off of.
  if (row.plan !== "free") return row;
  if (new Date(row.credits_renew_at) > new Date()) return row;

  const nextBalance = renewedBalance(row.plan, row.credits_balance);
  const nextRenewAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const service = createServiceClient();
  const { data, error } = await service
    .from("user_billing")
    .update({ credits_balance: nextBalance, credits_renew_at: nextRenewAt, updated_at: new Date().toISOString() })
    .eq("user_id", row.user_id)
    .select("user_id, plan, credits_balance, credits_renew_at")
    .single();

  if (error || !data) {
    // Renewal failing shouldn't block generation on the caller's existing
    // balance — worst case the user waits until the next check to renew.
    console.error("[entitlements] failed to renew credits:", error?.message);
    return row;
  }

  await service.from("credit_ledger").insert({
    user_id: row.user_id,
    delta: nextBalance - row.credits_balance,
    reason: "monthly_renewal",
  });

  return data as UserBillingRow;
}

async function findOrgMembership(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ id: string; name: string; plan: "team" | "enterprise"; credits_balance: number } | null> {
  // A user belonging to more than one org isn't a supported case yet (no UI
  // for switching orgs) — .limit(1) rather than .maybeSingle() so that,
  // should it ever happen, this picks one deterministically instead of
  // throwing.
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1);

  const membership = memberships?.[0];
  if (!membership) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, plan, credits_balance")
    .eq("id", membership.org_id)
    .maybeSingle();

  return org as { id: string; name: string; plan: "team" | "enterprise"; credits_balance: number } | null;
}

// The single place that answers "what plan is this signed-in user on, and
// how many credits do they have right now" — org membership takes priority
// over a solo user_billing row, and a solo row's monthly renewal is applied
// lazily on read rather than via a cron job (simpler, and correct as long
// as every credit-gated route calls this before checking the balance).
export async function getEntitlements(userId: string): Promise<Entitlements> {
  const supabase = await createServerClient();

  const org = await findOrgMembership(supabase, userId);
  if (org) {
    return {
      source: "org",
      planId: org.plan,
      orgId: org.id,
      orgName: org.name,
      creditsBalance: org.credits_balance,
    };
  }

  const row = await renewIfDue(await ensureUserBillingRow(userId));
  return { source: "user", planId: row.plan, creditsBalance: row.credits_balance };
}

// Atomically spends one credit against whichever balance applies, using the
// consume_user_credit/consume_org_credit Postgres functions (see
// schema.sql) so two concurrent requests can't both succeed off the last
// credit. Returns the up-to-date entitlements either way, for the caller to
// show "N credits left" or "you're out, upgrade" without a second read.
export async function consumeCredit(userId: string): Promise<{ allowed: boolean; entitlements: Entitlements }> {
  const entitlements = await getEntitlements(userId);
  const supabase = await createServerClient();

  if (entitlements.source === "org") {
    const { data: allowed, error } = await supabase.rpc("consume_org_credit", {
      p_org_id: entitlements.orgId,
      p_user_id: userId,
    });
    if (error) throw new Error(`consume_org_credit failed: ${error.message}`);
    return {
      allowed: Boolean(allowed),
      entitlements: allowed ? { ...entitlements, creditsBalance: entitlements.creditsBalance - 1 } : entitlements,
    };
  }

  const { data: allowed, error } = await supabase.rpc("consume_user_credit", { p_user_id: userId });
  if (error) throw new Error(`consume_user_credit failed: ${error.message}`);
  return {
    allowed: Boolean(allowed),
    entitlements: allowed ? { ...entitlements, creditsBalance: entitlements.creditsBalance - 1 } : entitlements,
  };
}
