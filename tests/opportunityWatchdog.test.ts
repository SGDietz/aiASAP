import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  EMPTY_OPPORTUNITY_STATE,
  alertPayloadContainsPrivateRawData,
  buildMinimalAlertPayload,
  isOperatorTraffic,
  redactPrivateSummary,
  reduceOpportunity,
  shouldQueueUnfinished,
} from "../src/lib/opportunityWatchdog";
import { deliverOpportunityNotification } from "../src/lib/opportunityNotification";

describe("visitor and unfinished-opportunity watchdog", () => {
  it("redacts contact values from stored and alerted discovery summaries", () => {
    const text = "Build my site and reach me at visitor@example.com or 212-555-0199";
    expect(redactPrivateSummary(text)).toBe("Build my site and reach me at [email redacted] or [phone redacted]");
    const state = reduceOpportunity(EMPTY_OPPORTUNITY_STATE, { kind: "turn", at: 1, text });
    const alert = buildMinimalAlertPayload("opp", "session", {
      ...state,
      terminalAt: 2,
      graceUntil: 2,
      endReason: "explicit_stop",
    });
    expect(JSON.stringify(alert)).not.toContain("visitor@example.com");
    expect(JSON.stringify(alert)).not.toContain("212-555-0199");
  });

  it("excludes authenticated G/operator and local/private development traffic", () => {
    expect(isOperatorTraffic({ authenticatedUserId: "g", operatorUserIds: "g,admin" })).toBe(true);
    expect(isOperatorTraffic({ hostname: "localhost:3001" })).toBe(true);
    expect(isOperatorTraffic({ forwardedFor: "192.168.1.4" })).toBe(true);
    expect(isOperatorTraffic({ hostname: "aiasap.ai", forwardedFor: "203.0.113.10" })).toBe(false);
    const payload = `operator:${Date.now() + 60_000}`;
    const marker = `${payload}.${createHmac("sha256", "secret").update(payload).digest("hex")}`;
    expect(isOperatorTraffic({ signedMarker: marker, markerSecret: "secret" })).toBe(true);
  });

  it("does not create an opportunity from a greeting", () => {
    const state = reduceOpportunity(EMPTY_OPPORTUNITY_STATE, { kind: "turn", at: 1, text: "Hello 6" });
    expect(state.opportunityState).toBe("none");
  });

  it("substantive build discussion creates one resumable draft", () => {
    const state = reduceOpportunity(EMPTY_OPPORTUNITY_STATE, {
      kind: "turn", at: 1, text: "I want to build a website for my landscaping business and win more local customers",
    });
    expect(state.opportunityState).toBe("build_interest");
    expect(state.summary.meaningfulTurns).toBe(1);
  });

  it("contact supplied without account remains a captured draft, not submitted", () => {
    const draft = reduceOpportunity(EMPTY_OPPORTUNITY_STATE, {
      kind: "turn", at: 1, text: "I love restoring guitars and want to build a website for that business",
    });
    const captured = reduceOpportunity(draft, { kind: "contact_captured", at: 2, method: "email" });
    expect(captured).toMatchObject({ opportunityState: "contact_captured", contactState: "captured", accountState: "anonymous" });
  });

  it("explicit stop and idle timeout become terminal; disconnect gets grace", () => {
    const draft = { ...EMPTY_OPPORTUNITY_STATE, opportunityState: "draft" as const };
    const stopped = reduceOpportunity(draft, { kind: "terminal", at: 10, reason: "explicit_stop" });
    expect(shouldQueueUnfinished(stopped, 10)).toBe(true);
    const idle = reduceOpportunity(draft, { kind: "terminal", at: 20, reason: "idle_timeout" });
    expect(shouldQueueUnfinished(idle, 20)).toBe(true);
    const disconnected = reduceOpportunity(draft, { kind: "terminal", at: 30, reason: "disconnect" }, 100);
    expect(shouldQueueUnfinished(disconnected, 129)).toBe(false);
    expect(shouldQueueUnfinished(disconnected, 130)).toBe(true);
  });

  it("reconnect inside grace resumes; reconnect after grace does not", () => {
    const draft = { ...EMPTY_OPPORTUNITY_STATE, opportunityState: "draft" as const };
    const disconnected = reduceOpportunity(draft, { kind: "terminal", at: 100, reason: "disconnect" }, 100);
    expect(reduceOpportunity(disconnected, { kind: "reconnect", at: 150 }).terminalAt).toBeNull();
    expect(reduceOpportunity(disconnected, { kind: "reconnect", at: 201 }).terminalAt).toBe(100);
  });

  it("account created later closes the same draft", () => {
    const draft = { ...EMPTY_OPPORTUNITY_STATE, opportunityState: "build_interest" as const };
    const closed = reduceOpportunity(draft, { kind: "account_created", at: 2 });
    expect(closed).toMatchObject({ opportunityState: "account_created", accountState: "created", visitorState: "completed" });
  });

  it("alert summaries contain no raw contact, IP, or transcript", () => {
    const state = { ...EMPTY_OPPORTUNITY_STATE, opportunityState: "draft" as const, summary: { meaningfulTurns: 1, passion: "restoring guitars" }, endReason: "disconnect" as const };
    const payload = buildMinimalAlertPayload("opp", "session", state);
    expect(alertPayloadContainsPrivateRawData(payload)).toBe(false);
    expect(JSON.stringify(payload)).not.toMatch(/@|raw_ip|transcript/i);
  });

  it("delivery is durable dry-run by default and failure retries without a second opportunity", async () => {
    const payload = buildMinimalAlertPayload("opp", "session", { ...EMPTY_OPPORTUNITY_STATE, opportunityState: "draft", endReason: "explicit_stop" });
    await expect(deliverOpportunityNotification({ dedupeKey: "unfinished:opp", kind: "unfinished_opportunity", payload, enabled: false })).resolves.toMatchObject({ status: "queued" });
    const send = vi.fn().mockRejectedValue(new Error("down"));
    await expect(deliverOpportunityNotification({ dedupeKey: "unfinished:opp", kind: "unfinished_opportunity", payload, enabled: true, transport: { send } })).resolves.toMatchObject({ status: "failed" });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
