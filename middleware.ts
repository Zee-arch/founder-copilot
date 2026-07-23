import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkGenerateRateLimit, getClientIp } from "@/lib/rate-limit";

// 2026-07-23: durable rate limiting for report generation moved here, in
// front of app/api/generate/route.ts, so an abusive request is rejected
// before it spends a Groq/Portkey token — the route's own in-memory check
// (lib/rate-limit.ts's checkRateLimit) stays as-is for local dev without
// Upstash configured, but is not durable across serverless instances on
// Vercel, which is exactly the gap this closes. Only applied to the one
// route that actually costs money to call; every other request just gets
// the existing session refresh.
async function checkGenerateLimit(request: NextRequest, userId: string | null): Promise<NextResponse | null> {
  const identity = userId ? ({ type: "user", id: userId } as const) : ({ type: "ip", id: getClientIp(request) } as const);

  let result;
  try {
    result = await checkGenerateRateLimit(identity);
  } catch (error) {
    // A Redis/network hiccup on Upstash's end should never take down
    // report generation entirely — fail open (let the request through)
    // and rely on the route's own in-memory fallback for that request,
    // same never-fail-closed-on-an-optional-integration pattern as
    // everywhere else in this app.
    console.error("[middleware] rate limit check failed, allowing request:", error);
    return null;
  }

  // `null` means Upstash isn't configured — fall through to the route's
  // own in-memory fallback rather than blocking every request here.
  if (!result || result.allowed) return null;

  return NextResponse.json(
    {
      error: `You've hit the limit for now. Try again in about ${Math.ceil((result.retryAfterSeconds ?? 0) / 60)} minutes.`,
    },
    { status: 429 },
  );
}

export async function middleware(request: NextRequest) {
  const { response, userId } = await updateSession(request);

  if (request.nextUrl.pathname === "/api/generate" && request.method === "POST") {
    const limited = await checkGenerateLimit(request, userId);
    if (limited) return limited;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
