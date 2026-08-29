import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every route here SPENDS REAL MONEY when it is called.
 *
 * Cross-site audit, 2026-08-21, found all three standing wide open on the live
 * domain: no origin check, no rate limit, and no middleware.ts in the repo to
 * cover for them. The credit cap that was supposed to be the backstop fails
 * open — `assertCanMintSessionToken` returns ok the moment its storage is
 * unconfigured — so it cannot be the only thing guarding a mint.
 *
 * These are SOURCE assertions on purpose. The obvious alternative — actually
 * calling the handler — would mint a real paid session against G's provider
 * account every time the suite ran. I made exactly that mistake once by hand
 * with curl; a test suite would make it every run. Reading the source proves
 * the guard is present without spending anything.
 */

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

const MINT_ROUTES = [
  ["start-custom-session", ["app", "api", "start-custom-session", "route.ts"]],
  ["start-session", ["app", "api", "start-session", "route.ts"]],
  ["debug-token", ["app", "api", "liveavatar", "debug-token", "route.ts"]],
] as const;

describe("routes that spend money are gated", () => {
  it.each(MINT_ROUTES)("%s checks the request origin", (_name, path) => {
    const src = read(...path);
    expect(src).toContain("assertAllowedOrigin(request)");
  });

  it.each(MINT_ROUTES)("%s is rate limited with the zero-config limiter", (_name, path) => {
    const src = read(...path);
    // checkLocalLimit, NOT checkRateLimit: the shared Upstash-backed helper
    // returns null when unconfigured, and it is unconfigured everywhere.
    expect(src).toContain("checkLocalLimit(");
    expect(src).toContain("MINT_LIMIT");
  });

  it("the ElevenLabs voice route is rate limited by CHARACTERS", () => {
    const src = read("app", "api", "elevenlabs-text-to-speech", "route.ts");
    expect(src).toContain("checkLocalLimit(");
    // Charged on text length, because ElevenLabs bills per character and a
    // request-count cap alone still permits 150,000 characters a minute.
    expect(src).toContain("rawText.length");
  });

  it("debug-token cannot be reached in production without an explicit opt-in", () => {
    const src = read("app", "api", "liveavatar", "debug-token", "route.ts");
    expect(src).toContain('process.env.NODE_ENV === "production"');
    expect(src).toContain("LIVEAVATAR_DEBUG_TOKEN_ENABLED");
    // It answers 404 rather than 403 — a debug harness should not advertise
    // that it exists on the live domain.
    expect(src).toContain("status: 404");
  });

  it("the credit cap says so out loud when it is switched off", () => {
    const src = read("src", "lib", "liveavatarCredits.ts");
    expect(src).toContain("warnIfCreditCapOff");
    // It still fails OPEN on purpose — failing closed would take the live site
    // down the moment a Supabase env var went missing. But never silently.
    expect(src).toContain("DAILY CREDIT CAP IS OFF");
  });

  it("the local limiter does not key on a caller-controlled header first", () => {
    const src = read("src", "lib", "localRateLimit.ts");
    const vercelAt = src.indexOf("x-vercel-forwarded-for");
    const realAt = src.indexOf('get("x-real-ip")');
    const fwdAt = src.indexOf('get("x-forwarded-for")');
    expect(vercelAt).toBeGreaterThan(-1);
    // x-forwarded-for is a list whose FIRST entry is whatever the caller sent,
    // so keying on it lets anyone rotate the header for a fresh quota. The
    // platform-set headers must be consulted before it.
    expect(vercelAt).toBeLessThan(fwdAt);
    expect(realAt).toBeLessThan(fwdAt);
  });
});
