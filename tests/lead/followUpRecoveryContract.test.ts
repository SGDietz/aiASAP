import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EMPTY_BUILD_INTEREST_STATE, stepBuildInterest } from "../../src/lib/buildInterestFlow";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("aiASAP completed and abandoned lead delivery contract", () => {
  it("requires a readback plus exact owner-package consent before save", () => {
    const opened = stepBuildInterest(EMPTY_BUILD_INTEREST_STATE, "Please have someone contact me");
    expect(opened.state.sendConsent).toBe(true);
    const captured = stepBuildInterest(opened.state, "pat at example dot com");
    expect(captured.state.stage).toBe("confirming");
    // Beat one reads the value back only.
    expect(captured.spoken).toMatch(/did i get that email right/i);
    expect(captured.spoken).not.toMatch(/send/i);
    expect(stepBuildInterest(captured.state, "okay").effect).toEqual({ kind: "none" });
    const confirmed = stepBuildInterest(captured.state, "yes that's correct");
    expect(confirmed.state.stage).toBe("permission");
    expect(confirmed.effect).toEqual({ kind: "none" });
    // Beat two is the only door to a save, and it names what leaves the room.
    // G, ride 2026-09-03 19:43, word for word: "can you say, can you send
    // that to the team at AI ASAP?" Dashed a-i-ASAP for the voice.
    expect(confirmed.spoken).toMatch(/can i send that to the team at a-i-asap/i);
    const sending = stepBuildInterest(confirmed.state, "yes");
    expect(sending.effect).toMatchObject({ kind: "save_contact" });
    expect(sending.state.packageConsent).toBe(true);
  });

  it("keeps provider transcript sync observation-only", () => {
    const sync = source("app/api/liveavatar/session-transcript/sync/route.ts");
    expect(sync).toContain("Official LiveAvatar transcript sync remains append-only evidence only");
    expect(sync).not.toContain("persistAndDeliverFollowUp");
    expect(sync).not.toContain("schedulePartialFollowUp");
  });

  it("wires a protected due-row drain without embedding a real provider call in tests", () => {
    const route = source("app/api/cron/lead-follow-ups/route.ts");
    const config = source("vercel.json");
    expect(route).toContain("drainDueFollowUps");
    expect(route).toContain("createResendFollowUpTransport");
    expect(route).toContain("CRON_SECRET");
    expect(route).not.toContain("vercel-cron");
    expect(config).toContain('"path": "/api/cron/lead-follow-ups"');
    expect(config).toContain('"schedule": "*/5 * * * *"');
    expect(source("tests/lead/followUpEmail.test.ts")).toContain("recordingTransport");
  });

  it("prepares lease, partial, and dead-letter schema locally only", () => {
    const sql = source("supabase/migrations/20260903092000_lead_follow_up_reliability.sql");
    expect(sql).toContain("LOCAL PREPARATION ONLY");
    expect(sql).toContain("partial_follow_up_requested");
    expect(sql).toContain("dead_letter");
    expect(sql).toContain("lease_token uuid");
    expect(sql).toContain("lease_expires_at timestamptz");
    expect(sql).toContain("claim_opportunity_follow_up");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql.indexOf("pg_advisory_xact_lock")).toBeLessThan(sql.indexOf("for update"));
  });
});
