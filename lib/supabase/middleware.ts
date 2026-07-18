import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the auth session cookie on every request. Must run in middleware,
// not in a Server Component — Server Components can't write cookies, so
// without this, a session would silently expire mid-visit.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // This runs on every request, including anonymous ones — generation is
  // meant to keep working with zero setup, so if Supabase isn't configured
  // yet (or misconfigured on a preview deploy), skip auth instead of taking
  // the whole site down.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Revalidates the session against Supabase (not just reading the cookie) —
  // required so an expired/revoked session is caught here rather than in
  // every page that happens to check auth state.
  await supabase.auth.getUser();

  return response;
}
