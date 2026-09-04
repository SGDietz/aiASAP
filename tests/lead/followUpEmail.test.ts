import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createHttpFollowUpOutbox,
  createMemoryFollowUpOutbox,
  drainFollowUpRow,
  drainDueFollowUps,
  FOLLOW_UP_SEND_LEASE_MS,
  PARTIAL_FOLLOW_UP_DELAY_MS,
  followUpDedupeKey,
  followUpIdempotencyKey,
  partialFollowUpDedupeKey,
  partialFollowUpIdempotencyKey,
  persistAndDeliverFollowUp,
  retryAt,
  schedulePartialFollowUp,
  type FollowUpTransport,
} from "../../src/lib/leadFollowUpNotify";
import { buildTeamNotifyText } from "../../src/lib/teamNotify";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const contact = {
  opportunityId: "opp-1",
  sessionId: "sess-abc",
  method: "email" as const,
  value: "pat@example.com",
  fullName: "Pat",
};
const completeKey = () => followUpDedupeKey(contact.opportunityId, contact.method, contact.value);
const completeIdempotencyKey = () => followUpIdempotencyKey(contact.opportunityId, contact.method, contact.value);

function recordingTransport(impl?: FollowUpTransport["send"]): FollowUpTransport & { calls: number; keys: string[] } {
  const keys: string[] = [];
  const send = impl ?? (async ({ idempotencyKey }) => {
    keys.push(idempotencyKey);
    return { providerId: "re_test_1" };
  });
  const wrapped: FollowUpTransport & { calls: number; keys: string[] } = {
    calls: 0,
    keys,
    async send(args) {
      wrapped.calls += 1;
      keys.push(args.idempotencyKey);
      return send(args);
    },
  };
  return wrapped;
}

describe("durable follow_up_requested outbox", () => {
  it("parks a consented partial for ten minutes without contacting a provider", async () => {
    const store = createMemoryFollowUpOutbox();
    const transport = recordingTransport();
    const now = new Date("2026-09-03T12:00:00.000Z");
    await expect(schedulePartialFollowUp({
      store,
      opportunityId: "opp-partial",
      sessionId: "sess-partial",
      method: "email",
      value: "partial@example.invalid",
      explicitSendConsent: false,
      now,
    })).resolves.toBeNull();
    const queued = await schedulePartialFollowUp({
      store,
      opportunityId: "opp-partial",
      sessionId: "sess-partial",
      method: "email",
      value: "partial@example.invalid",
      explicitSendConsent: true,
      now,
    });
    expect(queued).toMatchObject({ eventKind: "partial_follow_up_requested", status: "queued" });
    expect(queued?.nextAttemptAt).toBe(new Date(now.getTime() + PARTIAL_FOLLOW_UP_DELAY_MS).toISOString());
    expect((await drainDueFollowUps({ store, transport, now }))).toHaveLength(0);
    expect(transport.calls).toBe(0);
  });

  it("refreshes a pending partial to the latest consented canonical contact without sending", async () => {
    const store = createMemoryFollowUpOutbox();
    const providerFetch = vi.spyOn(globalThis, "fetch");
    const first = new Date("2026-09-03T12:00:00.000Z");
    const corrected = new Date("2026-09-03T12:02:00.000Z");
    await schedulePartialFollowUp({ store, opportunityId: "opp-correction", sessionId: "sess-correction", method: "email", value: "wrong@example.invalid", explicitSendConsent: true, now: first });
    const refreshed = await schedulePartialFollowUp({ store, opportunityId: "opp-correction", sessionId: "sess-correction", method: "phone", value: "410-555-0199", explicitSendConsent: true, now: corrected });
    expect(refreshed?.payload).toMatchObject({ contactMethod: "phone", contactValue: "410-555-0199" });
    expect(refreshed?.nextAttemptAt).toBe(new Date(corrected.getTime() + PARTIAL_FOLLOW_UP_DELAY_MS).toISOString());
    expect(providerFetch).not.toHaveBeenCalled();
    providerFetch.mockRestore();
  });

  it("makes incomplete recovery status explicit in the provider message body", () => {
    const notifySource = source("src/lib/leadFollowUpNotify.ts");
    expect(notifySource).toContain("Incomplete abandoned conversation");
    expect(notifySource).toContain("not a completed owner package");
  });

  it("delivers an abandoned consented partial only when due with its own idempotency key", async () => {
    const store = createMemoryFollowUpOutbox();
    const transport = recordingTransport();
    const now = new Date("2026-09-03T12:00:00.000Z");
    await schedulePartialFollowUp({ store, opportunityId: "opp-partial", sessionId: "sess-partial", method: "phone", value: "4105550123", explicitSendConsent: true, now });
    const results = await drainDueFollowUps({ store, transport, now: new Date(now.getTime() + PARTIAL_FOLLOW_UP_DELAY_MS) });
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("sent");
    expect(transport.keys).toContain(partialFollowUpIdempotencyKey("opp-partial"));
  });

  it("dead-letters the pending partial after the completed package succeeds", async () => {
    const store = createMemoryFollowUpOutbox();
    const transport = recordingTransport();
    const now = new Date("2026-09-03T12:00:00.000Z");
    await schedulePartialFollowUp({ store, opportunityId: "opp-1", sessionId: "sess-abc", method: "email", value: "pat@example.com", explicitSendConsent: true, now });
    const completed = await persistAndDeliverFollowUp({ store, transport, ...contact, now });
    expect(completed.status).toBe("sent");
    const retired = await store.getByDedupe(partialFollowUpDedupeKey("opp-1"));
    expect(retired?.status).toBe("dead_letter");
    expect(retired?.error).toBe("superseded_by_complete_lead");
    expect(retired?.nextAttemptAt).toBeNull();
    expect(await drainDueFollowUps({ store, transport, now: new Date(now.getTime() + PARTIAL_FOLLOW_UP_DELAY_MS) })).toHaveLength(0);
    expect(transport.calls).toBe(1);
    expect(transport.keys).toContain(completeIdempotencyKey());
  });

  it("sweeps a queued partial to dead_letter with superseded_by_complete_lead when the complete lead claims first", async () => {
    const store = createMemoryFollowUpOutbox();
    const now = new Date("2026-09-03T12:00:00.000Z");
    await schedulePartialFollowUp({ store, opportunityId: "opp-sweep", sessionId: "sess-sweep", method: "email", value: "sweep@example.invalid", explicitSendConsent: true, now });
    const completeKey = followUpDedupeKey("opp-sweep", "email", "sweep@example.invalid");
    await store.insertIgnoreDuplicate({
      opportunityId: "opp-sweep",
      eventKind: "follow_up_requested",
      dedupeKey: completeKey,
      payload: {
        sessionReviewRef: "/admin/sessions/sess-sweep",
        transcriptEvidenceRef: "/admin/sessions/sess-sweep",
        contactMethod: "email",
        contactValue: "sweep@example.invalid",
        fullName: null,
        sessionId: "sess-sweep",
      },
    });
    const claimed = await store.claim(completeKey, now);
    expect(claimed?.status).toBe("sending");
    const partial = await store.getByDedupe(partialFollowUpDedupeKey("opp-sweep"));
    expect(partial?.status).toBe("dead_letter");
    expect(partial?.error).toBe("superseded_by_complete_lead");
    expect(partial?.nextAttemptAt).toBeNull();
  });

  it("retires a partial's own claim to superseded_by_complete_lead when a complete row already exists", async () => {
    const store = createMemoryFollowUpOutbox();
    const now = new Date("2026-09-03T12:00:00.000Z");
    const completeKey = followUpDedupeKey("opp-existing", "email", "who@example.invalid");
    await store.insertIgnoreDuplicate({
      opportunityId: "opp-existing",
      eventKind: "follow_up_requested",
      dedupeKey: completeKey,
      payload: {
        sessionReviewRef: "/admin/sessions/sess-existing",
        transcriptEvidenceRef: "/admin/sessions/sess-existing",
        contactMethod: "email",
        contactValue: "who@example.invalid",
        fullName: null,
        sessionId: "sess-existing",
      },
    });
    const partialKey = partialFollowUpDedupeKey("opp-existing");
    await store.insertIgnoreDuplicate({
      opportunityId: "opp-existing",
      eventKind: "partial_follow_up_requested",
      dedupeKey: partialKey,
      payload: {
        sessionReviewRef: "/admin/sessions/sess-existing#partial",
        transcriptEvidenceRef: "/admin/sessions/sess-existing",
        contactMethod: "email",
        contactValue: "who@example.invalid",
        fullName: null,
        sessionId: "sess-existing",
      },
    });
    await expect(store.claim(partialKey, now)).resolves.toBeNull();
    const partial = await store.getByDedupe(partialKey);
    expect(partial?.status).toBe("dead_letter");
    expect(partial?.error).toBe("superseded_by_complete_lead");
    expect(partial?.nextAttemptAt).toBeNull();
  });

  it("uses the exact canonical error string in the arbitration RPC", () => {
    const sql = source("supabase/migrations/20260903092000_lead_follow_up_reliability.sql");
    expect(sql).toContain("'superseded_by_complete_lead'");
    expect(sql).not.toContain("'completed_owner_package_exists'");
    expect(sql).not.toContain("'completed_owner_package_claimed'");
    expect(sql).not.toContain("'completed_owner_package_sent'");
  });

  it("never sends a completed package after the partial delivery has already been claimed", async () => {
    const store = createMemoryFollowUpOutbox();
    const transport = recordingTransport();
    const now = new Date("2026-09-03T12:00:00.000Z");
    await schedulePartialFollowUp({ store, opportunityId: "opp-race", sessionId: "sess-race", method: "email", value: "race@example.invalid", explicitSendConsent: true, now });
    const partialKey = partialFollowUpDedupeKey("opp-race");
    const partialClaim = await store.claim(partialKey, new Date(now.getTime() + PARTIAL_FOLLOW_UP_DELAY_MS));
    expect(partialClaim?.status).toBe("sending");
    const complete = await persistAndDeliverFollowUp({ store, transport, opportunityId: "opp-race", sessionId: "sess-race", method: "email", value: "race@example.invalid", now: new Date(now.getTime() + PARTIAL_FOLLOW_UP_DELAY_MS) });
    expect(complete.status).toBe("dead_letter");
    expect(transport.calls).toBe(0);
  });
  it("records queued -> sending -> sent with provider id after persist", async () => {
    const store = createMemoryFollowUpOutbox();
    const transport = recordingTransport();
    const result = await persistAndDeliverFollowUp({ store, transport, ...contact });
    expect(result.status).toBe("sent");
    expect(result.providerId).toBe("re_test_1");
    expect(result.duplicate).toBe(false);
    const row = await store.getByDedupe(completeKey());
    expect(row?.status).toBe("sent");
    expect(row?.providerId).toBe("re_test_1");
    expect(row?.attemptCount).toBe(1);
    expect(transport.calls).toBe(1);
    expect(transport.keys[0]).toBe(completeIdempotencyKey());
    expect(source("src/lib/teamNotify.ts")).toContain('follow_up_requested: "asked you to follow up"');
    expect(buildTeamNotifyText({
      kind: "follow_up_requested",
      who: "Pat",
      email: "pat@example.com",
      sessionId: "sess-abc",
      dedupeKey: "x",
    })).not.toMatch(/five thousand|\$5,000|sale_interest|transcript/i);
  });

  it("keeps the save when delivery fails and records failed + next attempt", async () => {
    const store = createMemoryFollowUpOutbox();
    const now = new Date("2026-08-31T22:30:00Z");
    const transport = recordingTransport(async () => {
      throw new Error("resend 500");
    });
    const result = await persistAndDeliverFollowUp({ store, transport, ...contact, now });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("resend 500");
    expect(result.nextAttemptAt).toBe(retryAt(now));
    const row = await store.getByDedupe(completeKey());
    expect(row?.status).toBe("failed");
    expect(row?.error).toBe("resend 500");
    const watchdog = source("app/api/opportunity-watchdog/route.ts");
    expect(watchdog).toContain("submitted: true");
    expect(watchdog).toContain("notify_status: notify.status");
    expect(watchdog).toContain("persistAndDeliverFollowUp");
    expect(watchdog).not.toContain("notifyTeam(");
  });

  it("duplicate replay does not send twice", async () => {
    const store = createMemoryFollowUpOutbox();
    const transport = recordingTransport();
    const first = await persistAndDeliverFollowUp({ store, transport, ...contact });
    const second = await persistAndDeliverFollowUp({ store, transport, ...contact, fullName: "Pat Two" });
    expect(first.status).toBe("sent");
    expect(second.status).toBe("sent");
    expect(second.duplicate).toBe(true);
    expect(second.providerId).toBe("re_test_1");
    expect(transport.calls).toBe(1);
    expect((await store.listDue(new Date())).filter((r) => r.dedupeKey === completeKey())).toHaveLength(0);
  });

  it("provider-accepted response-loss retries with the same Resend key then persists sent", async () => {
    const inner = createMemoryFollowUpOutbox();
    let loseReceipt = true;
    const store = {
      ...inner,
      async markSent(id: string, leaseToken: string, providerId: string, now: Date) {
        if (loseReceipt) throw new Error("response lost after provider accept");
        return inner.markSent(id, leaseToken, providerId, now);
      },
    };
    const transport = recordingTransport();
    const now = new Date("2026-08-31T22:31:00Z");
    const lost = await persistAndDeliverFollowUp({ store, transport, ...contact, now });
    expect(lost.status).toBe("sending");
    expect(lost.providerId).toBe("re_test_1");
    expect(lost.error).toMatch(/response lost/);
    const mid = await inner.getByDedupe(completeKey());
    expect(mid?.status).toBe("sending");
    expect(mid?.providerId).toBeNull();
    loseReceipt = false;
    const recovered = await persistAndDeliverFollowUp({
      store,
      transport,
      ...contact,
      now: new Date(now.getTime() + FOLLOW_UP_SEND_LEASE_MS + 1),
    });
    expect(recovered.status).toBe("sent");
    expect(recovered.providerId).toBe("re_test_1");
    expect(transport.calls).toBe(2);
    expect(new Set(transport.keys)).toEqual(new Set([completeIdempotencyKey()]));
    expect((await inner.getByDedupe(completeKey()))?.status).toBe("sent");
  });

  it("does not reclaim an in-flight send until its lease expires", async () => {
    const store = createMemoryFollowUpOutbox();
    const key = followUpDedupeKey("opp-lease");
    await store.insertIgnoreDuplicate({
      opportunityId: "opp-lease",
      eventKind: "follow_up_requested",
      dedupeKey: key,
      payload: {
        sessionReviewRef: "/admin/sessions/sess-lease",
        transcriptEvidenceRef: "/admin/sessions/sess-lease",
        contactMethod: "email",
        contactValue: "lease@example.invalid",
        fullName: null,
        sessionId: "sess-lease",
      },
    });
    const now = new Date("2026-08-31T22:31:00Z");
    const first = await store.claim(key, now);
    expect(first?.status).toBe("sending");
    expect(first?.attemptCount).toBe(1);
    await expect(
      store.claim(key, new Date(now.getTime() + FOLLOW_UP_SEND_LEASE_MS - 1)),
    ).resolves.toBeNull();
    const recovered = await store.claim(
      key,
      new Date(now.getTime() + FOLLOW_UP_SEND_LEASE_MS + 1),
    );
    expect(recovered?.attemptCount).toBe(2);
    await expect(
      store.markSent(first!.id, first!.leaseToken!, "re_stale", now),
    ).rejects.toThrow(/claim lost/);
    await expect(
      store.markSent(
        recovered!.id,
        recovered!.leaseToken!,
        "re_current",
        new Date(now.getTime() + FOLLOW_UP_SEND_LEASE_MS + 1),
      ),
    ).resolves.toMatchObject({ status: "sent", providerId: "re_current" });
  });

  it("claims the HTTP row through the atomic opportunity arbitration RPC", async () => {
    const calls: Array<{ url: string; method: string; body: string }> = [];
    const row = {
      id: "row-1",
      opportunity_id: "opp-1",
      event_kind: "follow_up_requested",
      dedupe_key: followUpDedupeKey("opp-1"),
      payload: {
        sessionReviewRef: "/admin/sessions/sess-abc",
        contactMethod: "email",
        contactValue: "pat@example.com",
        fullName: "Pat",
        sessionId: "sess-abc",
      },
      status: "queued",
      attempt_count: 0,
      provider_id: null,
      error: null,
      next_attempt_at: null,
      sent_at: null,
      updated_at: "2026-08-31T22:30:00.000Z",
    };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: String(init?.body ?? "") });
      if (url.endsWith("/rest/v1/rpc/claim_opportunity_follow_up") && method === "POST") return Response.json([row]);
      throw new Error(`unexpected ${method} ${url}`);
    }));
    try {
      const store = createHttpFollowUpOutbox("https://supabase.invalid", "test-key");
      await expect(store.claim(followUpDedupeKey("opp-1"), new Date())).resolves.toMatchObject({ id: "row-1" });
      const claim = calls.find((call) => call.url.includes("rpc/claim_opportunity_follow_up"));
      expect(claim?.method).toBe("POST");
      expect(claim?.body).toContain('"p_dedupe_key"');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the primary sent truth when older-row reconciliation cannot list", async () => {
    const inner = createMemoryFollowUpOutbox();
    const store = {
      ...inner,
      async listDue() {
        throw new Error("reconciliation unavailable");
      },
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const transport = recordingTransport();
      const result = await persistAndDeliverFollowUp({ store, transport, ...contact });
      expect(result.status).toBe("sent");
      expect(result.providerId).toBe("re_test_1");
      expect((await inner.getByDedupe(completeKey()))?.status).toBe("sent");
      expect(transport.calls).toBe(1);
    } finally {
      warn.mockRestore();
    }
  });

  it("reports the durable sending state if a transport failure cannot be recorded", async () => {
    const inner = createMemoryFollowUpOutbox();
    const store = {
      ...inner,
      async markFailed() {
        throw new Error("failure write unavailable");
      },
    };
    const transport = recordingTransport(async () => {
      throw new Error("resend 503");
    });
    const result = await persistAndDeliverFollowUp({ store, transport, ...contact });
    expect(result.status).toBe("sending");
    expect(result.error).toMatch(/resend 503.*failure write unavailable/);
    expect(result.nextAttemptAt).not.toBeNull();
    expect((await inner.getByDedupe(completeKey()))?.status).toBe("sending");
  });

  it("failed row is drained again after next-attempt", async () => {
    const store = createMemoryFollowUpOutbox();
    const now = new Date("2026-08-31T22:32:00Z");
    let fail = true;
    const transport = recordingTransport(async () => {
      if (fail) throw new Error("resend 503");
      return { providerId: "re_retry" };
    });
    const first = await persistAndDeliverFollowUp({ store, transport, ...contact, now });
    expect(first.status).toBe("failed");
    fail = false;
    const tooSoon = await drainFollowUpRow(store, transport, completeKey(), now);
    expect(tooSoon.status).toBe("failed");
    expect(transport.calls).toBe(1);
    const later = new Date(now.getTime() + 16 * 60 * 1000);
    const retried = await drainFollowUpRow(store, transport, completeKey(), later);
    expect(retried.status).toBe("sent");
    expect(retried.providerId).toBe("re_retry");
    expect(transport.calls).toBe(2);
  });

  it("does not queue or send for operator traffic", async () => {
    const store = createMemoryFollowUpOutbox();
    const transport = recordingTransport();
    const result = await persistAndDeliverFollowUp({
      store,
      transport,
      ...contact,
      operatorExcluded: true,
    });
    expect(result.error).toBe("operator_excluded");
    expect(transport.calls).toBe(0);
    expect(await store.getByDedupe(completeKey())).toBeNull();
  });

  it("does not send before explicit confirmation", () => {
    const watchdog = source("app/api/opportunity-watchdog/route.ts");
    const post = watchdog.slice(watchdog.indexOf("export async function POST"));
    const submitAt = post.indexOf('if (action === "submit_contact")');
    expect(submitAt).toBeGreaterThan(0);
    const before = post.slice(0, submitAt);
    const submit = post.slice(submitAt);
    expect(submit).toContain("persistAndDeliverFollowUp");
    expect(submit).toContain("submit_opportunity_contact");
    expect(before).not.toContain("persistAndDeliverFollowUp");
    const captured = watchdog.slice(watchdog.indexOf('action === "contact_captured"'));
    expect(captured.slice(0, 500)).not.toContain("persistAndDeliverFollowUp");
    expect(watchdog).toContain('state: "operator_excluded", submitted: false');
  });

  it("schema/outbox insert failure is recorded without unsaying the save", async () => {
    const inner = createMemoryFollowUpOutbox();
    const store = {
      ...inner,
      async insertIgnoreDuplicate() {
        throw new Error("violates check constraint event_kind");
      },
    };
    const transport = recordingTransport();
    const result = await persistAndDeliverFollowUp({ store, transport, ...contact });
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/event_kind/);
    expect(result.nextAttemptAt).toBeNull();
    expect(transport.calls).toBe(0);
  });

  it("missing config is recorded as failed, not as sent", async () => {
    const store = createMemoryFollowUpOutbox();
    const transport = recordingTransport(async () => {
      throw new Error("RESEND_API_KEY missing");
    });
    const result = await persistAndDeliverFollowUp({ store, transport, ...contact });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("RESEND_API_KEY missing");
    expect((await store.getByDedupe(completeKey()))?.status).toBe("failed");
  });

  it("local migration adds follow_up_requested and sending, and is marked local-only", () => {
    const sql = source("supabase/migrations/20260831223000_follow_up_requested_outbox.sql");
    expect(sql).toMatch(/LOCAL PREPARATION ONLY/);
    expect(sql).toContain("follow_up_requested");
    expect(sql).toContain("'sending'");
    expect(sql).not.toMatch(/alter table.*visitor_opportunities/i);
  });
});
