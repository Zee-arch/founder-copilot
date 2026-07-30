import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export function getClientIp(request: Request): string {
  // Vercel/most proxies set this; falls back to a shared bucket if absent
  // (e.g. running locally without a proxy in front).
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

// 2026-07-23: durable, cross-instance rate limiting for report generation,
// enforced in Edge Middleware (see middleware.ts) so an abusive request is
// rejected before it ever reaches the Node function or spends a Groq/
// Portkey token. Upstash Redis is REST/HTTP-based, which is what makes it
// usable from the Edge runtime at all — a normal TCP Redis client can't
// run there. Two independent limiters, not one shared bucket: a signed-in
// request is limited by user id (a stable identity, fair to people behind
// a shared office/CGNAT IP), an anonymous request is limited by IP (the
// only identity available). Deliberately optional — if
// UPSTASH_REDIS_REST_URL/TOKEN aren't set, `checkGenerateRateLimit`
// returns `null` and middleware.ts skips the check entirely rather than
// failing closed on a missing optional integration, same pattern as
// Supabase elsewhere in this app. The in-memory limiter below this comment
// block is unrelated and unchanged — it stays as the route-level fallback
// for local dev without Upstash configured (see its own comment).
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
    : null;

const GENERATE_WINDOW = "1 h";
// Raised 8 -> 30 (2026-07-25) ahead of sharing this publicly. The anonymous
// limiter keys on IP, which is the only identity an anonymous request has —
// but mobile carriers route many subscribers through a handful of shared
// CGNAT addresses, so a burst of visitors arriving from one social post can
// look like a single abusive IP and lock each other out. 30/hour still stops
// a single scraper hammering the endpoint while leaving real shared-IP
// traffic room. Well within provider budget either way: Groq's free tier is
// 30 req/min and 14,400 req/day, far above what this ceiling can produce.
const GENERATE_LIMIT_PER_IP = 30; // keep in sync with the in-memory fallback below
// Unused in practice — middleware.ts deliberately skips the durable limiter
// for signed-in requests (their real throttle is the credit balance check in
// app/api/generate/route.ts), so this only matters if that ever changes.
const GENERATE_LIMIT_PER_USER = 8;

const ipLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(GENERATE_LIMIT_PER_IP, GENERATE_WINDOW),
      prefix: "ratelimit:generate:ip",
      analytics: true,
    })
  : null;

const userLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(GENERATE_LIMIT_PER_USER, GENERATE_WINDOW),
      prefix: "ratelimit:generate:user",
      analytics: true,
    })
  : null;

export type GenerateRateLimitIdentity = { type: "user"; id: string } | { type: "ip"; id: string };

// Returns `null` when Upstash isn't configured — callers must treat that
// as "no durable check available," not "allowed," and decide their own
// fallback (middleware.ts skips the check; nothing else currently calls
// this).
export async function checkGenerateRateLimit(
  identity: GenerateRateLimitIdentity,
): Promise<{ allowed: boolean; retryAfterSeconds?: number } | null> {
  const limiter = identity.type === "user" ? userLimiter : ipLimiter;
  if (!limiter) return null;

  const result = await limiter.limit(identity.id);
  if (result.success) return { allowed: true };
  return { allowed: false, retryAfterSeconds: Math.ceil((result.reset - Date.now()) / 1000) };
}

// Simple in-memory rate limiter, keyed by IP address — the route-level
// fallback used by app/api/generate/route.ts when Upstash isn't
// configured (see checkGenerateRateLimit above for the durable,
// Edge-Middleware-enforced version).
//
// Good enough for a small-scale v1 (you + friends testing). Two honest
// limitations worth knowing about:
// 1. It resets whenever the server restarts (or, on serverless hosts like
//    Vercel, whenever a fresh instance spins up) — it's a speed bump, not a
//    guarantee.
// 2. It only runs inside the Node.js function that app/api/generate/
//    route.ts executes in — it is NOT shared with the Edge Middleware
//    limiter above (different runtime, different memory), which is
//    exactly why the durable Upstash path exists.

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
// Kept in sync with GENERATE_LIMIT_PER_IP above (raised 8 -> 30, 2026-07-25).
// Both need changing together: which one actually applies depends on whether
// Upstash is configured in a given environment, so leaving them different
// would make the real limit silently depend on deploy config.
const MAX_REQUESTS_PER_WINDOW = 30;

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true };
}

// Prevents unbounded memory growth from the map itself over a long-running process.
setInterval(
  () => {
    const now = Date.now();
    for (const [ip, bucket] of buckets.entries()) {
      if (now > bucket.resetAt) buckets.delete(ip);
    }
  },
  10 * 60 * 1000,
).unref?.();
