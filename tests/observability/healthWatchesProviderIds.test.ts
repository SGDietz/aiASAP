import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const health = readFileSync(join(process.cwd(), "app/api/cron/health/route.ts"), "utf8");

/**
 * WildWorks went down for real visitors on 2026-09-04 because production was
 * minting against a LiveAvatar context that had been DELETED. The provider said
 * "Context not found" on every attempt. Nothing watched for it, so a stale env
 * value sat for 35 days and surfaced as a dead site instead of an alert.
 *
 * aiASAP's cloud watcher now asks the provider whether the ids it mints with
 * still exist.
 */
describe("the watcher checks that the ids we mint with still exist", () => {
  it("asks the provider about the avatar and the voice", () => {
    expect(health).toContain("providerIdState");
    expect(health).toContain('["avatar", "avatars", AVATAR_ID]');
    expect(health).toContain('["voice", "voices", VOICE_ID]');
  });

  it("reads only - it must never mint or spend a credit", () => {
    const fn = health.slice(health.indexOf("async function providerIdState"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    expect(body).toContain("/v1/${collection}/${id}");
    // A GET has no method override and no body.
    expect(body).not.toMatch(/method:\s*"POST"/);
    expect(body).not.toContain("start-custom-session");
    expect(body).not.toContain("start-session");
  });

  it("separates 'deleted' from 'cannot reach the provider'", () => {
    const fn = health.slice(health.indexOf("async function providerIdState"));
    expect(fn).toContain('res.status === 404) return "missing"');
    // Anything else, including a network throw, is unknown - never an alarm.
    expect(fn).toContain('return "unknown"');
    expect(health).toContain("crying wolf here would train G to ignore this alarm");
  });

  it("deliberately does NOT check the context id", () => {
    // aiASAP sends no context_id, and the value left in .env points at a
    // deleted context. Checking it would alarm every 15 minutes about nothing.
    expect(health).toContain("NOT checked here: LIVEAVATAR_CONTEXT_ID");
    expect(health).not.toContain('"contexts", CONTEXT_ID');
  });

  it("says the quiet part out loud: the billing message is a lie", () => {
    expect(health).toContain("Add credits");
    expect(health).toMatch(/NOT\s*\` \+\s*\`a billing problem|NOT ` \+\s*`a billing problem|not a billing problem/i);
  });
});
