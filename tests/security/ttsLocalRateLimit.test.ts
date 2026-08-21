import { beforeEach, describe, expect, it } from "vitest";
import {
  TTS_HOURLY_LIMIT,
  TTS_LIMIT,
  __resetLocalLimits,
  checkLocalLimit,
} from "../../src/lib/localRateLimit";

/**
 * The hole this closes (audit 2026-08-21): /api/elevenlabs-text-to-speech spends
 * real money per call and nothing bounded it. checkRateLimit() returns null
 * without Upstash keys, and there are none set on any environment, so it has
 * never fired. These tests exist so the limiter cannot quietly become a no-op
 * again — that is exactly how the first one failed.
 */

function req(ip = "1.2.3.4"): Request {
  return new Request("https://aiasap.ai/api/elevenlabs-text-to-speech", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

describe("TTS local rate limit", () => {
  beforeEach(() => __resetLocalLimits());

  it("needs no configuration at all — no Upstash, no env, still limits", () => {
    // The whole point. Deliberately asserts nothing about process.env.
    let blocked = false;
    for (let i = 0; i < TTS_LIMIT.maxRequests + 5; i++) {
      if (!checkLocalLimit(req(), "tts", 1, [TTS_LIMIT]).allowed) {
        blocked = true;
        break;
      }
    }
    expect(blocked).toBe(true);
  });

  it("allows a normal conversation", () => {
    // A real person gets a line every few seconds. Twenty lines of ~200 chars
    // in a minute is already brisk talking and must never be refused.
    for (let i = 0; i < 20; i++) {
      expect(checkLocalLimit(req(), "tts", 200, [TTS_LIMIT]).allowed).toBe(true);
    }
  });

  it("limits CHARACTERS, not just request count", () => {
    // The failure the request-count cap misses: few calls, enormous cost.
    // ElevenLabs bills per character, so this is the limit that matters.
    const first = checkLocalLimit(req(), "tts", 5_000, [TTS_LIMIT]);
    expect(first.allowed).toBe(true);
    let verdict = first;
    for (let i = 0; i < 10; i++) {
      verdict = checkLocalLimit(req(), "tts", 5_000, [TTS_LIMIT]);
      if (!verdict.allowed) break;
    }
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain("cost");
    // Well under the request cap when it trips — proving cost is the binding rule.
    expect(TTS_LIMIT.maxRequests).toBeGreaterThan(11);
  });

  it("keeps counting a caller who is already over the limit", () => {
    // If rejected calls left no trace, an attacker could hammer forever: the
    // window would drain as though they had stopped.
    for (let i = 0; i < TTS_LIMIT.maxRequests + 1; i++) {
      checkLocalLimit(req(), "tts", 10, [TTS_LIMIT]);
    }
    expect(checkLocalLimit(req(), "tts", 10, [TTS_LIMIT]).allowed).toBe(false);
    expect(checkLocalLimit(req(), "tts", 10, [TTS_LIMIT]).allowed).toBe(false);
  });

  it("does not let one abuser lock out everybody else", () => {
    for (let i = 0; i < TTS_LIMIT.maxRequests + 5; i++) {
      checkLocalLimit(req("9.9.9.9"), "tts", 5_000, [TTS_LIMIT]);
    }
    expect(checkLocalLimit(req("9.9.9.9"), "tts", 10, [TTS_LIMIT]).allowed).toBe(false);
    expect(checkLocalLimit(req("5.5.5.5"), "tts", 10, [TTS_LIMIT]).allowed).toBe(true);
  });

  it("returns a Retry-After the route can actually send", () => {
    let verdict = checkLocalLimit(req(), "tts", 5_000, [TTS_LIMIT]);
    for (let i = 0; i < 50 && verdict.allowed; i++) {
      verdict = checkLocalLimit(req(), "tts", 5_000, [TTS_LIMIT]);
    }
    expect(verdict.allowed).toBe(false);
    expect(verdict.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("separates buckets so TTS spend cannot be starved by another route", () => {
    for (let i = 0; i < TTS_LIMIT.maxRequests + 5; i++) {
      checkLocalLimit(req(), "other-route", 5_000, [TTS_LIMIT]);
    }
    expect(checkLocalLimit(req(), "tts", 10, [TTS_LIMIT]).allowed).toBe(true);
  });

  it("the hourly net is wider than the minute net, not narrower", () => {
    // A misordered pair would make the hourly rule fire first and throttle
    // normal use, which is how well-meant limits get switched off again.
    expect(TTS_HOURLY_LIMIT.windowMs).toBeGreaterThan(TTS_LIMIT.windowMs);
    expect(TTS_HOURLY_LIMIT.maxRequests).toBeGreaterThan(TTS_LIMIT.maxRequests);
    expect(TTS_HOURLY_LIMIT.maxCost).toBeGreaterThan(TTS_LIMIT.maxCost);
  });
});
