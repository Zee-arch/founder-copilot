// Simple in-memory rate limiter, keyed by IP address.
//
// Good enough for a small-scale v1 (you + friends testing). Two honest
// limitations worth knowing about:
// 1. It resets whenever the server restarts (or, on serverless hosts like
//    Vercel, whenever a fresh instance spins up) — it's a speed bump, not a
//    guarantee.
// 2. If you outgrow "me and some friends," swap this for a shared store
//    (e.g. Upstash Redis) so limits are enforced consistently across
//    instances.

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
