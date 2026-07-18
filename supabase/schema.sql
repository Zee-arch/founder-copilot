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
