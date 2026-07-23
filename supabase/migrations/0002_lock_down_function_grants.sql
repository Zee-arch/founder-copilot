-- Postgres functions in this project's `public` schema get EXECUTE granted
-- directly to `anon`/`authenticated` at creation time (a Supabase default-
-- privileges rule on the `postgres` owner role, not the PUBLIC pseudo-role
-- — `revoke ... from public` alone does nothing here, confirmed via
-- `select proacl from pg_proc`). 0001 only added grants; it never revoked
-- the automatic anon grant, so every org function was reachable by signed-
-- out requests. All fail safe under a null auth.uid() (Supabase's advisor
-- flagged this as WARN, not ERROR) except get_invite_preview: an anonymous
-- caller who knows/guesses a token could read the invited email address
-- without signing in. This locks all of them down to `authenticated` only,
-- and handle_new_user (only ever invoked by the on_auth_user_created
-- trigger, never through the exposed REST API) down to neither.
revoke execute on function public.create_org(text, text) from anon;
revoke execute on function public.accept_org_invite(uuid) from anon;
revoke execute on function public.get_invite_preview(uuid) from anon;
revoke execute on function public.is_org_member(uuid) from anon;
revoke execute on function public.org_role(uuid) from anon;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
