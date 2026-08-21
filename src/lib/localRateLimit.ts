/**
 * ZERO-CONFIG rate limiting for the routes that spend real money.
 *
 * Why this exists (audit, 2026-08-21): `checkRateLimit` in rateLimit.ts returns
 * null — no limit at all — whenever Upstash is not configured:
 *
 *     const base = process.env.UPSTASH_REDIS_REST_URL?.trim();
 *     const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
 *     if (!base || !token) return null;
 *
 * There are no Upstash keys set on Vercel in ANY environment. So on aiasap.ai
 * that limiter has never once fired, and `/api/elevenlabs-text-to-speech` — a
 * route that spends ElevenLabs characters on every call — was effectively
 * unlimited. The only other gate is an Origin/Referer check, and any non-browser
 * client can simply set that header itself.
 *
 * This limiter needs no keys, no service, and no secrets. It cannot be left
 * switched off by accident, which is the entire point.
 *
 * HONEST LIMITATION: state lives in this process. On serverless each instance
 * counts separately, so a determined attacker spread across many cold starts
 * gets a multiple of these numbers. That is a real weakness and it is still
 * enormously better than unbounded — it converts "burn the account" into
 * "burn a little per instance". If Upstash is ever configured, keep BOTH:
 * shared counting plus a local backstop.
 *
 * It limits COST, not just requests. ElevenLabs bills per character, so a cap
 * of "30 requests a minute" still allows 150,000 characters a minute at the
 * 5,000-char request cap. The character budget is the limit that matters.
 */

type Hit = { at: number; cost: number };

const buckets = new Map<string, Hit[]>();

/** Stop the map growing without bound if a lot of distinct IPs show up. */
const MAX_TRACKED_KEYS = 5_000;

export type LocalLimitRule = {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests in the window. */
  maxRequests: number;
  /** Max total cost (e.g. characters of speech) in the window. */
  maxCost: number;
};

/**
 * Voice is the expensive one, so these are deliberately tight.
 *
 * A real person talking to 6 gets a line every several seconds, so 40 lines a
 * minute is far above normal conversation and far below anything that would
 * cost real money. 30,000 characters a minute is roughly 35 minutes of speech
 * generated in 60 seconds — nobody legitimate does that.
 */
export const TTS_LIMIT: LocalLimitRule = {
  windowMs: 60_000,
  maxRequests: 40,
  maxCost: 30_000,
};

/** A slower, wider net so a steady drip cannot run all day unnoticed. */
export const TTS_HOURLY_LIMIT: LocalLimitRule = {
  windowMs: 60 * 60_000,
  maxRequests: 600,
  maxCost: 400_000,
};

/**
 * Minting a LiveAvatar session is the single most expensive thing this app can
 * do — a block for the first 30 seconds, then a block every 6 seconds, running
 * whether or not anybody is talking. Before 2026-08-21 the mint routes had NO
 * origin check and NO rate limit, and the credit cap that was meant to be the
 * backstop fails open whenever its storage is unconfigured.
 *
 * A real person taps once and talks. Six mints a minute is already far more
 * than a human does (restarts, a reload, a flaky connection) and is nowhere
 * near enough to be worth attacking.
 */
export const MINT_LIMIT: LocalLimitRule = {
  windowMs: 60_000,
  maxRequests: 6,
  maxCost: 6,
};

/** Bounds a slow drip of mints that stays under the per-minute rule. */
export const MINT_HOURLY_LIMIT: LocalLimitRule = {
  windowMs: 60 * 60_000,
  maxRequests: 40,
  maxCost: 40,
};

function clientKey(request: Request): string {
  // Order matters, and it is a security choice rather than a preference.
  //
  // `x-forwarded-for` is a LIST, and its first entry is whatever the CALLER
  // sent — a proxy appends to it rather than replacing it. So keying on
  // `split(",")[0]` lets anyone rotate that header and draw a fresh quota on
  // every single request, which quietly voids the limit entirely. The existing
  // shared rateLimit.ts has exactly that bug.
  //
  // The platform-set headers below cannot be spoofed by the caller because the
  // platform overwrites them at the edge, so they are checked first.
  const vercel = request.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  // No IP header at all (local dev, or an odd proxy). Everyone shares one
  // bucket rather than everyone bypassing the limit.
  return "unknown";
}

function prune(hits: Hit[], cutoff: number): Hit[] {
  // Hits are appended in time order, so the first index still inside the window
  // is where the surviving slice begins.
  let i = 0;
  while (i < hits.length && hits[i].at < cutoff) i++;
  return i === 0 ? hits : hits.slice(i);
}

export type LocalLimitVerdict = {
  allowed: boolean;
  /** Which rule tripped, for logging. Empty when allowed. */
  reason: string;
  retryAfterSeconds: number;
};

/**
 * Record one request of `cost` against `bucket` and say whether it is allowed.
 * The hit is recorded even when it is rejected — otherwise a caller who is over
 * the limit could hammer forever, since each rejected call would leave no trace
 * and the window would drain as if they had stopped.
 */
export function checkLocalLimit(
  request: Request,
  bucket: string,
  cost: number,
  rules: LocalLimitRule[],
): LocalLimitVerdict {
  const now = Date.now();
  const key = `${bucket}:${clientKey(request)}`;

  if (!buckets.has(key) && buckets.size >= MAX_TRACKED_KEYS) {
    // Drop the coldest half rather than refusing to track anyone new. Under a
    // flood this loses history, but it never turns the limiter off.
    const entries = [...buckets.entries()];
    entries.sort((a, b) => {
      const aLast = a[1].length ? a[1][a[1].length - 1].at : 0;
      const bLast = b[1].length ? b[1][b[1].length - 1].at : 0;
      return aLast - bLast;
    });
    for (let i = 0; i < Math.floor(entries.length / 2); i++) {
      buckets.delete(entries[i][0]);
    }
  }

  const widest = Math.max(...rules.map((r) => r.windowMs));
  const hits = prune(buckets.get(key) ?? [], now - widest);
  hits.push({ at: now, cost: Math.max(0, cost) });
  buckets.set(key, hits);

  for (const rule of rules) {
    const cutoff = now - rule.windowMs;
    let count = 0;
    let total = 0;
    for (let i = hits.length - 1; i >= 0; i--) {
      if (hits[i].at < cutoff) break;
      count++;
      total += hits[i].cost;
    }
    if (count > rule.maxRequests) {
      return {
        allowed: false,
        reason: `requests>${rule.maxRequests}/${Math.round(rule.windowMs / 1000)}s`,
        retryAfterSeconds: Math.ceil(rule.windowMs / 1000),
      };
    }
    if (total > rule.maxCost) {
      return {
        allowed: false,
        reason: `cost>${rule.maxCost}/${Math.round(rule.windowMs / 1000)}s`,
        retryAfterSeconds: Math.ceil(rule.windowMs / 1000),
      };
    }
  }

  return { allowed: true, reason: "", retryAfterSeconds: 0 };
}

/** Test seam only — never call this from a route. */
export function __resetLocalLimits(): void {
  buckets.clear();
}
