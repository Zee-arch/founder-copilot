-- Org/team multi-tenancy: profiles, orgs, org_members, org_invites, and
-- reports.org_id + updated RLS. Run this once in the Supabase SQL Editor
-- (or via the Supabase MCP apply_migration tool) after schema.sql.
--
-- Design notes:
--   - There is no service-role key anywhere in this app (see HANDOFF.md) —
--     every policy below must hold under the signed-in user's own JWT.
--   - RLS policies that reference the same table they're defined on (e.g.
--     "am I a member of the org this row belongs to") tend to recurse.
--     `is_org_member` / `org_role` are SECURITY DEFINER functions precisely
--     to break that recursion — they run once, outside RLS, and return a
--     plain boolean/text the calling policy can use.
--   - Creating an org and accepting an invite both have a bootstrap
--     problem (you need to already be a member to pass the "member" check
--     that would let you become a member) — solved with two more
--     SECURITY DEFINER functions (`create_org`, `accept_org_invite`) that
--     do the whole thing atomically instead of a raw table insert.

-- ---------------------------------------------------------------------
-- profiles — one row per auth user, world-readable-by-org-mates copy of
-- the display name/email. Needed because `auth.users` itself isn't
-- readable across users under RLS, but a cohort dashboard needs to show
-- "whose idea is this" to teammates.
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "users can read their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill any users created before this migration existed.
insert into public.profiles (id, email, display_name)
select id, email, coalesce(raw_user_meta_data->>'full_name', email)
from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- orgs + org_members
-- ---------------------------------------------------------------------
create table if not exists orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table orgs enable row level security;

create table if not exists org_members (
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

alter table org_members enable row level security;

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from org_members
    where org_id = target_org_id and user_id = auth.uid()
  );
$$;

create or replace function public.org_role(target_org_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from org_members
  where org_id = target_org_id and user_id = auth.uid();
$$;

-- No direct insert policy on `orgs` — creation only happens through
-- create_org() below, which needs to insert the org row AND the owner's
-- membership row atomically (a raw insert can't satisfy org_role() before
-- the membership exists).
create policy "members can read their orgs"
  on orgs for select
  using (public.is_org_member(id));

create policy "owners/admins can update their org"
  on orgs for update
  using (public.org_role(id) in ('owner', 'admin'));

create policy "members can read their org's membership list"
  on org_members for select
  using (public.is_org_member(org_id));

create policy "owners/admins can add members"
  on org_members for insert
  with check (public.org_role(org_id) in ('owner', 'admin'));

create policy "owners/admins can change a member's role"
  on org_members for update
  using (public.org_role(org_id) in ('owner', 'admin'));

create policy "members can leave, owners/admins can remove members"
  on org_members for delete
  using (user_id = auth.uid() or public.org_role(org_id) in ('owner', 'admin'));

-- Org-mates can read each other's profile (but not arbitrary strangers') —
-- joins through org_members, a different table, so this can't recurse
-- into profiles' own RLS.
create policy "org-mates can read each other's profile"
  on profiles for select
  using (
    exists (
      select 1 from org_members mine
      join org_members theirs on theirs.org_id = mine.org_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

create or replace function public.create_org(org_name text, org_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into orgs (name, slug, created_by)
  values (org_name, org_slug, auth.uid())
  returning id into new_org_id;

  insert into org_members (org_id, user_id, role)
  values (new_org_id, auth.uid(), 'owner');

  return new_org_id;
end;
$$;

grant execute on function public.create_org(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- org_invites — shareable join links rather than relying solely on email
-- delivery. (Per HANDOFF.md: the current Resend free-tier sender only
-- delivers to its own registered address, so a copy-link path is the
-- reliable primary flow; sending the email too is a nice-to-have on top.)
-- ---------------------------------------------------------------------
create table if not exists org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz
);

alter table org_invites enable row level security;

create policy "owners/admins can view their org's invites"
  on org_invites for select
  using (public.org_role(org_id) in ('owner', 'admin'));

create policy "owners/admins can create invites"
  on org_invites for insert
  with check (public.org_role(org_id) in ('owner', 'admin') and invited_by = auth.uid());

create policy "owners/admins can revoke invites"
  on org_invites for delete
  using (public.org_role(org_id) in ('owner', 'admin'));

-- A non-member can't read `org_invites` (RLS above restricts select to
-- owner/admin) but the invite acceptance page still needs to show "this
-- invite was sent to X for team Y" before the person accepts. The invite
-- token itself is the capability (an unguessable random uuid, same trust
-- model as a password-reset link) — this function trades the row-level
-- read restriction for "you must already know the exact token," which is
-- the same set of people the accept flow already trusts.
create or replace function public.get_invite_preview(invite_token uuid)
returns table (org_name text, email text, role text, valid boolean)
language sql
security definer
stable
set search_path = public
as $$
  select o.name, i.email, i.role, (i.accepted_at is null and i.expires_at > now())
  from org_invites i
  join orgs o on o.id = i.org_id
  where i.token = invite_token;
$$;

grant execute on function public.get_invite_preview(uuid) to authenticated;

create or replace function public.accept_org_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  my_email text;
begin
  select * into inv
  from org_invites
  where token = invite_token and accepted_at is null and expires_at > now();

  if not found then
    raise exception 'This invite link is invalid or has expired.';
  end if;

  select email into my_email from auth.users where id = auth.uid();

  if my_email is null or lower(my_email) <> lower(inv.email) then
    raise exception 'This invite was sent to a different email address.';
  end if;

  insert into org_members (org_id, user_id, role)
  values (inv.org_id, auth.uid(), inv.role)
  on conflict (org_id, user_id) do nothing;

  update org_invites set accepted_at = now() where id = inv.id;

  return inv.org_id;
end;
$$;

grant execute on function public.accept_org_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- reports.org_id — nullable, so anonymous/personal generation (org_id
-- null) is untouched. Existing personal-only RLS is replaced with a
-- version that also allows any member of the report's org to read it.
-- ---------------------------------------------------------------------
alter table reports add column if not exists org_id uuid references orgs(id) on delete set null;

create index if not exists reports_org_id_idx on reports(org_id);

drop policy if exists "users can read their own reports" on reports;
create policy "users can read their own or their org's reports"
  on reports for select
  using (auth.uid() = user_id or public.is_org_member(org_id));

drop policy if exists "users can insert their own reports" on reports;
create policy "users can insert their own reports, optionally into their org"
  on reports for insert
  with check (auth.uid() = user_id and (org_id is null or public.is_org_member(org_id)));
