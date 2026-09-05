import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  internalTrafficSignals,
  isInternalTraffic,
  isTailnetIp,
} from "../../src/lib/internalTraffic";
import {
  drainDueOpportunityAlerts,
  rowInternalSignals,
  INTERNAL_REASON,
  STALE_REASON,
  MAX_ATTEMPTS,
  type OpportunityAlertRow,
  type OpportunityAlertStore,
} from "../../src/lib/opportunityAlertNotify";

/**
 * G, 2026-09-04: "build the drain with the internal filter."
 *
 * Before this, `new_visitor` and `unfinished_opportunity` were queued by the
 * watchdog and nothing sent them - 100 rows, attempt_count 0 on every one.
 * There was no fourth drain.
 *
 * The filter is the whole point: aiASAP's `operator_excluded` has never been
 * true for G (allowlists and marker secret unset, no cookie issuer, and he
 * tests signed out on the public domain), so wiring the drain to it would
 * email him for every visit he makes to his own site.
 */

function row(over: Partial<OpportunityAlertRow> = {}): OpportunityAlertRow {
  return {
    dedupeKey: "new_visitor:opp-1",
    eventKind: "new_visitor",
    opportunityId: "opp-1",
    status: "queued",
    attemptCount: 0,
    payload: {},
    providerId: null,
    error: null,
    nextAttemptAt: null,
    createdAt: "2026-09-04T19:59:00Z",
    leaseToken: "lease-1",
    ...over,
  };
}

function store(rows: OpportunityAlertRow[]) {
  const calls = { sent: [] as string[], dead: [] as string[], failed: [] as string[] };
  const api: OpportunityAlertStore = {
    listDue: async () => rows,
    claim: async (k) => rows.find((r) => r.dedupeKey === k) ?? null,
    // The token is threaded through every write; assert it arrives.
    markSent: async (k, lease) => void calls.sent.push(`${k}|${lease}`),
    markFailed: async (k, lease, _e, _next, attempts) =>
      void calls.failed.push(`${k}|${lease}|attempts=${attempts}`),
    markDeadLetter: async (k, lease, reason) =>
      void calls.dead.push(`${k}|${lease}|${reason}`),
  };
  return { api, calls };
}

describe("the internal-traffic filter", () => {
  it("recognises G's tailnet, which is how he actually tests", () => {
    // Taken verbatim from a real queued row's payload, 2026-09-04 15:00.
    expect(
      internalTrafficSignals({ hostname: "mission-control.tail00dfe0.ts.net" }),
    ).toContain("tailnet_host");
  });

  it("covers the Tailscale IP block the private-IP regex misses", () => {
    // 100.64.0.0/10 is CGNAT, not RFC 1918 - the old check had no idea.
    expect(isTailnetIp("100.64.1.9")).toBe(true);
    expect(isTailnetIp("100.127.255.1")).toBe(true);
    expect(isTailnetIp("100.128.0.1")).toBe(false);
    expect(isTailnetIp("100.63.0.1")).toBe(false);
    expect(isTailnetIp("8.8.8.8")).toBe(false);
  });

  it("catches localhost, private IPs, the founder's own address and headless agents", () => {
    expect(isInternalTraffic({ hostname: "localhost" })).toBe(true);
    expect(isInternalTraffic({ forwardedFor: "192.168.1.4" })).toBe(true);
    expect(
      isInternalTraffic({ email: "SGDietz@pm.me", founderEmails: "sgdietz@pm.me" }),
    ).toBe(true);
    expect(
      isInternalTraffic({ userAgent: "Mozilla/5.0 HeadlessChrome/152" }),
    ).toBe(true);
  });

  it("FAILS OPEN - a real stranger is never suppressed", () => {
    expect(
      isInternalTraffic({
        hostname: "aiasap.ai",
        forwardedFor: "72.14.201.9",
        userAgent:
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/152 Mobile Safari/537.36",
        email: "stranger@example.com",
        founderEmails: "sgdietz@pm.me",
      }),
    ).toBe(false);
  });
});

describe("legacy rows queued before signals were recorded", () => {
  it("still reads the tailnet out of the referrer", () => {
    expect(
      rowInternalSignals({
        referrer: "https://mission-control.tail00dfe0.ts.net:9447/",
      }),
    ).toContain("tailnet_host");
  });

  it("treats a tester label as an explicit 'this is us'", () => {
    expect(rowInternalSignals({ testerLabel: "g-phone" }).length).toBeGreaterThan(0);
  });

  it("lets a row with no origin clue through rather than guessing", () => {
    // The 12:40 row had referrer: null. Suppressing on no evidence would risk
    // silencing a real visitor, which costs more than one ignorable email.
    expect(rowInternalSignals({ referrer: null })).toEqual([]);
  });
});

describe("the drain", () => {
  it("suppresses our own visit without spending a provider call", async () => {
    const rows = [row({ payload: { internalSignals: ["tailnet_host"] } })];
    const { api, calls } = store(rows);
    const send = vi.fn();
    const out = await drainDueOpportunityAlerts({
      store: api,
      transport: { send },
      now: new Date("2026-09-04T20:00:00Z"),
    });
    expect(send).not.toHaveBeenCalled();
    expect(out[0].status).toBe("dead_letter");
    expect(out[0].error).toBe(INTERNAL_REASON);
    // Auditable: the reason records WHICH signal matched.
    expect(calls.dead[0]).toContain("tailnet_host");
  });

  it("sends for a genuine stranger", async () => {
    const rows = [row({ payload: { referrer: "https://google.com/" } })];
    const { api, calls } = store(rows);
    const send = vi.fn(async () => ({ providerId: "re_123" }));
    const out = await drainDueOpportunityAlerts({
      store: api,
      transport: { send },
      now: new Date("2026-09-04T20:00:00Z"),
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(out[0].status).toBe("sent");
    expect(out[0].providerId).toBe("re_123");
    expect(calls.sent).toHaveLength(1);
  });

  it("retries a transport failure, then dead-letters instead of looping forever", async () => {
    const { api, calls } = store([row({ attemptCount: 0 })]);
    const failing = { send: vi.fn(async () => { throw new Error("resend 500"); }) };
    const first = await drainDueOpportunityAlerts({
      store: api, transport: failing, now: new Date("2026-09-04T20:00:00Z"),
    });
    expect(first[0].status).toBe("failed");
    expect(calls.failed).toHaveLength(1);

    const { api: api2, calls: calls2 } = store([row({ attemptCount: MAX_ATTEMPTS })]);
    const out = await drainDueOpportunityAlerts({
      store: api2, transport: failing, now: new Date("2026-09-04T20:00:00Z"),
    });
    expect(out[0].status).toBe("dead_letter");
    expect(calls2.dead[0]).toContain("max_attempts");
  });

  it("retires a stale backlog instead of flooding the inbox", async () => {
    // MEASURED before shipping: a dry run over the real outbox would have sent
    // 142 emails, most about visits from 2026-08-22, because those rows predate
    // signal recording and the filter fails open. An alert that is no longer
    // true is not worth sending.
    const { api, calls } = store([
      row({ createdAt: "2026-08-22T18:33:00Z", payload: { referrer: null } }),
    ]);
    const send = vi.fn();
    const out = await drainDueOpportunityAlerts({
      store: api, transport: { send }, now: new Date("2026-09-04T20:00:00Z"),
    });
    expect(send).not.toHaveBeenCalled();
    expect(out[0].status).toBe("dead_letter");
    expect(out[0].error).toBe(STALE_REASON);
    expect(calls.dead[0]).toContain(STALE_REASON);
  });

  it("still sends a fresh alert about a stranger", async () => {
    const { api } = store([
      row({ createdAt: "2026-09-04T19:58:00Z", payload: { referrer: "https://google.com/" } }),
    ]);
    const send = vi.fn(async () => ({ providerId: "re_fresh" }));
    const out = await drainDueOpportunityAlerts({
      store: api, transport: { send }, now: new Date("2026-09-04T20:00:00Z"),
    });
    expect(out[0].status).toBe("sent");
  });

  it("persists the attempt count so retries actually reach the cap", async () => {
    // The claim used to be an RPC that incremented this. The conditional claim
    // that replaced it does not, so the drain must write it - otherwise the
    // count stays 0 and a broken row retries every 15 minutes forever.
    const { api, calls } = store([row({ attemptCount: 2 })]);
    await drainDueOpportunityAlerts({
      store: api,
      transport: { send: vi.fn(async () => { throw new Error("resend 500"); }) },
      now: new Date("2026-09-04T20:00:00Z"),
    });
    expect(calls.failed[0]).toContain("attempts=3");
  });

  it("scopes every write to the lease it claimed", async () => {
    // Without this two overlapping cron runs can overwrite each other's
    // result. The house follow-up store scopes its patches the same way.
    const { api, calls } = store([row({ leaseToken: "lease-xyz" })]);
    await drainDueOpportunityAlerts({
      store: api,
      transport: { send: vi.fn(async () => ({ providerId: "re_1" })) },
      now: new Date("2026-09-04T20:00:00Z"),
    });
    expect(calls.sent[0]).toContain("lease-xyz");
  });

  it("is actually wired into the five-minute cron", () => {
    const src = readFileSync(
      resolve(process.cwd(), "app/api/cron/lead-follow-ups/route.ts"),
      "utf8",
    );
    expect(src).toContain("drainDueOpportunityAlerts");
    expect(src).toContain("visitor_alerts");
    // and the watchdog records the signals the filter reads
    const wd = readFileSync(
      resolve(process.cwd(), "app/api/opportunity-watchdog/route.ts"),
      "utf8",
    );
    expect(wd).toContain("internalTrafficSignals");
    expect(wd).toContain("internalSignals");
  });
});
