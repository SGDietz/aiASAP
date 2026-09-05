import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(join(process.cwd(), "app/api/cron/health/route.ts"), "utf8");
const monitor = readFileSync(join(process.cwd(), "src/lib/healthMonitor.ts"), "utf8");

/**
 * WildWorks went down for real visitors on 2026-09-04 because production was
 * minting against a LiveAvatar context that had been DELETED. The provider said
 * "Context not found" on every attempt. Nothing watched for it, so a stale env
 * value sat for 35 days and surfaced as a dead site instead of an alert.
 *
 * Chief rewrote the cloud watcher on 2026-09-05 (errors-only, G's order: the
 * 15-minute mail "was not productive, just something I ignored"). These lock
 * the parts of that design that protect against the WildWorks outage repeating.
 */
describe("the watcher checks that the ids we mint with still exist", () => {
  it("asks the provider about the avatar and the voice", () => {
    expect(route).toContain('ids: [["avatars", AVATAR_ID], ["voices", VOICE_ID]]');
    expect(monitor).toContain("for (const [collection, id] of settings.provider.ids)");
  });

  it("reads only - it must never mint or spend a credit", () => {
    expect(monitor).toContain("/v1/${collection}/${encodeURIComponent(id.trim())}");
    // A GET has no method override on the provider call, and no session route.
    expect(monitor).not.toContain("start-custom-session");
    expect(monitor).not.toContain("start-session");
    expect(monitor).toContain("Cloud checks never create avatar sessions");
  });

  it("separates 'deleted' from 'cannot reach the provider'", () => {
    expect(monitor).toContain('if (r.status === 404) add(`provider_missing:${collection}`');
    // Anything else - HTTP error, timeout, no network - is "unverified", a
    // different code, so a flaky provider never reads as a deleted id.
    expect(monitor).toContain("provider_unverified:${collection}");
    expect(monitor).toContain("lookup timed out or could not connect");
  });

  it("deliberately does NOT check the context id", () => {
    // aiASAP sends no context_id, and the value left in .env points at a
    // deleted context. Checking it would alarm about nothing.
    expect(route).not.toContain("contexts");
    expect(route).not.toContain("CONTEXT_ID");
  });

  it("fires only on findings, deduped for a day, and re-arms on recovery", () => {
    const notice = readFileSync(join(process.cwd(), "src/lib/healthNotice.ts"), "utf8");
    expect(notice).toContain("if (!findings.length) return false;");
    expect(notice).toContain("now - Date.parse(previous.at) >= 24 * 60 * 60_000");
    expect(notice).toContain("if (!args.findings.length) previous = null; // Silent recovery re-arms recurrence.");
  });

  it("every app event now says which deployment wrote it, so a monitor CAN tell dev rides from production", () => {
    // One Supabase project serves :3001 and production. The log route stamps
    // payload.env (Claude, 2026-09-05); filtering on it is the monitor owner's
    // (Codex) call - recommended in the 2026-09-05 review packet.
    const log = readFileSync(join(process.cwd(), "app/api/app-events/log/route.ts"), "utf8");
    expect(log).toContain('env: process.env.VERCEL_ENV ?? "development"');
  });
});
