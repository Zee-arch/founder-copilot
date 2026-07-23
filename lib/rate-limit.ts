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
const GENERATE_LIMIT_PER_IP = 8; // matches the in-memory fallback's existing limit, see below
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
const MAX_REQUESTS_PER_WINDOW = 8; // generous for testing, tight enough to block abuse

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
