import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// `createServerClient` throws outright if URL/key are missing, so callers
// on the "works with zero setup" paths (anonymous report generation) must
// check this first and skip auth entirely rather than 500 — same guard the
// middleware's `updateSession` and `SiteHeader` already apply.
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, which can't write cookies — the
            // middleware's session refresh already covers this case.
          }
        },
      },
    },
  );
}
