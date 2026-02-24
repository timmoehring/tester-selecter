/**
 * In-memory rate limiter for API endpoints.
 *
 * TODO: Wire up to API routes. This module is currently a placeholder
 * providing the rate limiting infrastructure. Integration into routes
 * (especially /api/projects/[projectId]/sentiment and /solve) will be
 * done in a future PR.
 *
 * @example
 * // Future usage in API route:
 * import { rateLimit } from "@/lib/rate-limit";
 *
 * const { success } = rateLimit(session.user.id, 10, 60_000);
 * if (!success) {
 *   return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
 * }
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 60_000);

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count < limit) {
    entry.count++;
    return { success: true, remaining: limit - entry.count };
  }

  return { success: false, remaining: 0 };
}
