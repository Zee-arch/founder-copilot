-- Addresses the Supabase performance advisor's findings on the 0001/0002
-- org tables. Purely mechanical — no policy is more or less permissive
-- than before, just cheaper to evaluate at real row counts.

-- Missing indexes on FK columns (membership lookups, invite lookups, and
-- "my reports" queries all filter on these).
create index if not exists org_invites_invited_by_idx on org_invites(invited_by);
create index if not exists org_invites_org_id_idx on org_invites(org_id);
create index if not exists org_members_user_id_idx on org_members(user_id);
create index if not exists orgs_created_by_idx on orgs(created_by);
create index if not exists reports_user_id_idx on reports(user_id);

-- Wrapping a direct auth.<fn>() call in `(select ...)` lets Postgres
-- evaluate it once per statement instead of once per row — auth.uid()
-- doesn't vary per row, so there's nothing to recompute. This does NOT
-- apply to is_org_member(org_id)/org_role(org_id) calls elsewhere in these
-- policies — those take the per-row org_id as an argument, so they
-- legitimately can't be hoisted the same way.
drop policy if exists "members can leave, owners/admins can remove members" on org_members;
create policy "members can leave, owners/admins can remove members"
  on org_members for delete
  using (user_id = (select auth.uid()) or public.org_role(org_id) in ('owner', 'admin'));

drop policy if exists "owners/admins can create invites" on org_invites;
create policy "owners/admins can create invites"
  on org_invites for insert
  with check (public.org_role(org_id) in ('owner', 'admin') and invited_by = (select auth.uid()));

drop policy if exists "users can read their own or their org's reports" on reports;
create policy "users can read their own or their org's reports"
  on reports for select
  using ((select auth.uid()) = user_id or public.is_org_member(org_id));

drop policy if exists "users can insert their own reports, optionally into their org" on reports;
create policy "users can insert their own reports, optionally into their org"
  on reports for insert
  with check ((select auth.uid()) = user_id and (org_id is null or public.is_org_member(org_id)));

-- profiles had two separate permissive SELECT policies (own profile,
-- org-mates' profile) — Postgres evaluates every permissive policy on
-- every row, so merging them into one OR'd policy is strictly cheaper,
-- not just a style preference. Same access as before: yourself, or anyone
-- who shares an org with you.
drop policy if exists "users can read their own profile" on profiles;
drop policy if exists "org-mates can read each other's profile" on profiles;
create policy "users can read their own or org-mates' profile"
  on profiles for select
  using (
    (select auth.uid()) = id
    or exists (
      select 1 from org_members mine
      join org_members theirs on theirs.org_id = mine.org_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );

drop policy if exists "users can update their own profile" on profiles;
create policy "users can update their own profile"
  on profiles for update
  using ((select auth.uid()) = id);
