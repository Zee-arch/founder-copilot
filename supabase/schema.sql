-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
--
-- Not used yet by the app — this table exists so Stage 2 (saving generated
-- reports + a dashboard to browse them) can be built without a schema
-- migration. Stage 1 only needs auth to work; this just gets the table
-- ready ahead of time.

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idea text not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);

alter table reports enable row level security;

create policy "users can read their own reports"
  on reports for select
  using (auth.uid() = user_id);

create policy "users can insert their own reports"
  on reports for insert
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Billing (added 2026-07-23): hybrid pricing — free / prosumer (solo,
-- credit-metered) / team (org, seats + pooled credits) / enterprise
-- (custom, no self-serve row). Safe to re-run this whole file — every
-- statement below is idempotent (`if not exists` / `create or replace`).
--
-- Written and shipped without a live Stripe account to test against — the
-- founder needs to add real STRIPE_* env vars and run one real checkout +
-- webhook delivery before this is "verified," same pattern as the Groq/
-- Gemini key setups. See HANDOFF.md.
-- ---------------------------------------------------------------------

-- One row per user for solo plans (free/prosumer). Team/enterprise users
-- are billed at the org level (see `organizations` below) — a user's
-- effective plan is "whichever org they belong to, else this row."
create table if not exists user_billing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'prosumer')),
  stripe_customer_id text,
  stripe_subscription_id text,
  -- New signups start with the free tier's monthly allotment (kept in sync
  -- with lib/pricing.ts's PLANS.free.creditsPerMonth — not read from the DB).
  credits_balance int not null default 3,
  credits_renew_at timestamptz not null default (now() + interval '1 month'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_billing enable row level security;

-- `create policy` has no `if not exists` clause in Postgres, unlike
-- `create table` — dropping first is what actually makes this file safe to
-- re-run in full.
drop policy if exists "users can read their own billing row" on user_billing;
create policy "users can read their own billing row"
  on user_billing for select
  using (auth.uid() = user_id);

-- No insert/update policy for regular users on purpose: credits and plan
-- changes only ever happen from trusted server code (the Stripe webhook,
-- the entitlements module's monthly top-up) using the service-role key,
-- which bypasses RLS entirely. A user should never be able to grant
-- themselves credits by calling the client SDK directly.

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'team' check (plan in ('team', 'enterprise')),
  stripe_customer_id text,
  stripe_subscription_id text,
  seats int not null default 5,
  credits_balance int not null default 0,
  credits_renew_at timestamptz not null default (now() + interval '1 month'),
  -- Schema-ready for white-labeled exports; not yet read by the report/PDF
  -- UI — see lib/pricing.ts's "(coming soon)" note. Don't advertise this as
  -- live until the report view actually branches on it.
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table organizations enable row level security;

create table if not exists organization_members (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

alter table organization_members enable row level security;

drop policy if exists "org members can read their org" on organizations;
create policy "org members can read their org"
  on organizations for select
  using (
    id in (select org_id from organization_members where user_id = auth.uid())
  );

drop policy if exists "org members can read their membership roster" on organization_members;
create policy "org members can read their membership roster"
  on organization_members for select
  using (
    org_id in (select org_id from organization_members where user_id = auth.uid())
  );

-- Org creation/seat management/plan changes happen via the Stripe webhook
-- and checkout routes (service-role key) — same reasoning as user_billing.

-- Audit trail for every credit grant/consumption, across both solo users
-- and orgs. Not the source of truth for "how many credits does X have
-- right now" (that's the cached `credits_balance` columns above, kept
-- accurate via consume_credit() below) — this is what the dashboard's
-- billing history and any support debugging reads instead.
create table if not exists credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  delta int not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint credit_ledger_owner check (user_id is not null or org_id is not null)
);

alter table credit_ledger enable row level security;

drop policy if exists "users can read their own credit history" on credit_ledger;
create policy "users can read their own credit history"
  on credit_ledger for select
  using (
    auth.uid() = user_id
    or org_id in (select org_id from organization_members where user_id = auth.uid())
  );

-- API keys (Team+ only). Split into a public-safe table and a secrets
-- table on purpose: `api_keys` is readable by org members via RLS so the
-- dashboard can list/revoke keys, but the actual key hash never has a
-- select policy at all — only the service-role key (used exclusively by
-- the /api/v1/* routes to verify an incoming key) can ever read it.
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null default 'API key',
  key_prefix text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

alter table api_keys enable row level security;

drop policy if exists "org members can read their org's api keys" on api_keys;
create policy "org members can read their org's api keys"
  on api_keys for select
  using (
    org_id in (select org_id from organization_members where user_id = auth.uid())
  );

create table if not exists api_key_secrets (
  key_id uuid primary key references api_keys(id) on delete cascade,
  key_hash text not null
);

alter table api_key_secrets enable row level security;
-- Deliberately zero policies: RLS with no policies blocks every role
-- except the service-role key (which bypasses RLS entirely), so this
-- table is server-only no matter what.

-- Idempotency guard for the Stripe webhook — Stripe can and does redeliver
-- the same event, and "grant credits again" is not safe to double-run.
create table if not exists stripe_webhook_events (
  id text primary key,
  created_at timestamptz not null default now()
);

alter table stripe_webhook_events enable row level security;
-- No policies here either — service-role only, same reasoning as api_key_secrets.

-- Atomically decrements a solo user's credit balance by 1, only if they
-- have at least 1 credit. Returning a boolean (rather than decrementing in
-- application code after a separate read) closes the race where two
-- concurrent requests both read "1 credit left" and both proceed.
--
-- `security definer` means this runs with the function owner's privileges
-- (bypassing user_billing's RLS, which has no update policy for regular
-- users) — so it must do its own authorization instead of relying on RLS:
-- it only ever lets a caller touch *their own* row. Called with the
-- signed-in user's own Supabase client (not the service-role client), so
-- auth.uid() reflects who's actually calling.
create or replace function consume_user_credit(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows int;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'not authorized';
  end if;

  update user_billing
  set credits_balance = credits_balance - 1, updated_at = now()
  where user_id = p_user_id and credits_balance > 0;

  get diagnostics updated_rows = row_count;

  if updated_rows > 0 then
    insert into credit_ledger (user_id, delta, reason) values (p_user_id, -1, 'report_generated');
  end if;

  return updated_rows > 0;
end;
$$;

revoke execute on function consume_user_credit(uuid) from public;
grant execute on function consume_user_credit(uuid) to authenticated;

-- Same, for an org's pooled balance (Team/Enterprise) — same
-- self-authorization reasoning, plus a membership check since org credits
-- are shared across every seat.
create or replace function consume_org_credit(p_org_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows int;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1 from organization_members
    where org_id = p_org_id and user_id = p_user_id
  ) then
    raise exception 'not a member of this organization';
  end if;

  update organizations
  set credits_balance = credits_balance - 1, updated_at = now()
  where id = p_org_id and credits_balance > 0;

  get diagnostics updated_rows = row_count;

  if updated_rows > 0 then
    insert into credit_ledger (user_id, org_id, delta, reason) values (p_user_id, p_org_id, -1, 'report_generated');
  end if;

  return updated_rows > 0;
end;
$$;

revoke execute on function consume_org_credit(uuid, uuid) from public;
grant execute on function consume_org_credit(uuid, uuid) to authenticated;

-- Variant for /api/v1/* requests, which authenticate via an API key
-- (checked in application code against api_key_secrets) rather than a
-- Supabase session — there's no auth.uid() to check here, so this is
-- deliberately NOT granted to `authenticated`, only reachable through the
-- service-role client the API routes already use to verify the key hash.
create or replace function consume_org_credit_for_api_key(p_org_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows int;
begin
  update organizations
  set credits_balance = credits_balance - 1, updated_at = now()
  where id = p_org_id and credits_balance > 0;

  get diagnostics updated_rows = row_count;

  if updated_rows > 0 then
    insert into credit_ledger (org_id, delta, reason) values (p_org_id, -1, 'api_report_generated');
  end if;

  return updated_rows > 0;
end;
$$;

revoke execute on function consume_org_credit_for_api_key(uuid) from public;
revoke execute on function consume_org_credit_for_api_key(uuid) from authenticated;
