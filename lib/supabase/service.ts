import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses Row Level Security entirely. Only ever
// import this from trusted server-only code paths that have already
// established *why* the caller is allowed to act (a verified Stripe webhook
// signature, a verified API key hash), never from anything that forwards a
// browser's own request unchecked. Distinct on purpose from
// lib/supabase/server.ts, which is scoped to the signed-in user's own
// session and respects RLS like a normal user would.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL) is missing. Add it to your .env.local file — find it under Project Settings > API > service_role in Supabase.",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
