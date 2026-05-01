const buckets = globalThis.__VECAST_RATE_LIMITS__ ?? new Map();

globalThis.__VECAST_RATE_LIMITS__ = buckets;

const WINDOW_MS = 5 * 60 * 1000;
const PUBLIC_LIMIT = 20;
const SIGNED_LIMIT = 100;

export function getClientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

export function checkRateLimit({ key, authenticated = false }) {
  const now = Date.now();
  const limit = authenticated ? SIGNED_LIMIT : PUBLIC_LIMIT;
  const bucketKey = `${authenticated ? "signed" : "public"}:${key || "unknown"}`;
  const current = buckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + WINDOW_MS };
    buckets.set(bucketKey, next);
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetAt: next.resetAt,
    };
  }

  current.count += 1;
  const remaining = Math.max(0, limit - current.count);

  return {
    allowed: current.count <= limit,
    limit,
    remaining,
    resetAt: current.resetAt,
  };
}
