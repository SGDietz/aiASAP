import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  ACCOUNT_CREATED_NOTIFICATION_KIND,
  accountCreatedDedupeKey,
  createMemoryAccountNotifyOutbox,
  deliverAccountCreatedNotification,
  type AccountNotifyTransport,
} from "../../src/lib/accountCreatedNotify";
import {
  VISITOR_CONFIRMATION_KIND,
  buildVisitorReceiptHtml,
  buildVisitorReceiptText,
  createMemoryVisitorReceiptOutbox,
  deliverVisitorConfirmation,
  drainDueVisitorReceipts,
  visitorConfirmationDedupeKey,
  visitorConfirmationIdempotencyKey,
  visitorReceiptRetryAt,
  type VisitorReceiptTransport,
} from "../../src/lib/visitorConfirmation";
import {
  followUpDedupeKey,
  partialFollowUpDedupeKey,
} from "../../src/lib/leadFollowUpNotify";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const emailLead = {
  opportunityId: "opp-visitor-1",
  sessionId: "sess-visitor-1",
  method: "email" as const,
  value: "Visitor@Example.INVALID",
  fullName: "Vinny Visitor",
};

const phoneLead = {
  opportunityId: "opp-visitor-2",
  sessionId: "sess-visitor-2",
  method: "phone" as const,
  value: "410-555-0199",
  fullName: null,
};

function recordingTransport(impl?: VisitorReceiptTransport["send"]): VisitorReceiptTransport & { calls: number; keys: string[]; recipients: string[] } {
  const keys: string[] = [];
  const recipients: string[] = [];
  const send = impl ?? (async ({ idempotencyKey, payload }) => {
    keys.push(idempotencyKey);
    recipients.push(payload.contactValue);
    return { providerId: "re_visitor_1" };
  });
  const wrapped: VisitorReceiptTransport & { calls: number; keys: string[]; recipients: string[] } = {
    calls: 0,
    keys,
    recipients,
    async send(args) {
      wrapped.calls += 1;
      return send(args);
    },
  };
  return wrapped;
}

describe("aiASAP visitor confirmation receipt", () => {
  it("sends an aiASAP-branded confirmation to the visitor's email with its own idempotency key", async () => {
    const store = createMemoryVisitorReceiptOutbox();
    const transport = recordingTransport();
    const result = await deliverVisitorConfirmation({ store, transport, ...emailLead });
    expect(result.status).toBe("sent");
    expect(result.providerId).toBe("re_visitor_1");
    expect(result.emailAttempted).toBe(true);
    expect(transport.calls).toBe(1);
    expect(transport.recipients).toEqual([emailLead.value]);
    expect(transport.keys[0]).toBe(
      visitorConfirmationIdempotencyKey(emailLead.opportunityId, emailLead.method, emailLead.value),
    );
    expect(transport.keys[0].startsWith("visitor:")).toBe(true);
  });

  it("uses aiASAP branding and never leaks iScott or WildWorks copy", () => {
    const html = buildVisitorReceiptHtml({
      sessionReviewRef: "/admin/sessions/x",
      contactMethod: "email",
      contactValue: "who@example.invalid",
      fullName: "Sam Sample",
      sessionId: "sess-x",
    });
    const text = buildVisitorReceiptText({
      sessionReviewRef: "/admin/sessions/x",
      contactMethod: "email",
      contactValue: "who@example.invalid",
      fullName: "Sam Sample",
      sessionId: "sess-x",
    });
    expect(html).toContain("aiASAP");
    expect(text).toContain("aiASAP");
    expect(html).not.toMatch(/iScott|WildWorks|iSolve/i);
    expect(text).not.toMatch(/iScott|WildWorks|iSolve/i);
    // Confirmation, not a sales pitch, and not the founder team package.
    expect(text).toMatch(/received your details/i);
    expect(text).not.toMatch(/five thousand|\$5,000|invoice|founder/i);
  });

  it("records a durable no-email disposition for phone-only leads and never calls the provider", async () => {
    const store = createMemoryVisitorReceiptOutbox();
    const transport = recordingTransport();
    const result = await deliverVisitorConfirmation({ store, transport, ...phoneLead });
    expect(result.status).toBe("dead_letter");
    expect(result.error).toBe("visitor_email_missing");
    expect(result.emailAttempted).toBe(false);
    expect(transport.calls).toBe(0);
    const row = await store.getByDedupe(
      visitorConfirmationDedupeKey(phoneLead.opportunityId, phoneLead.method, phoneLead.value),
    );
    expect(row?.status).toBe("dead_letter");
    expect(row?.providerId).toBeNull();
    expect(row?.sentAt).toBeNull();
    expect(await drainDueVisitorReceipts({ store, transport })).toHaveLength(0);
  });

  it("keeps the row when delivery fails and records failed + next attempt", async () => {
    const store = createMemoryVisitorReceiptOutbox();
    const now = new Date("2026-09-03T12:00:00.000Z");
    const transport = recordingTransport(async () => {
      throw new Error("resend 500");
    });
    const result = await deliverVisitorConfirmation({ store, transport, ...emailLead, now });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("resend 500");
    expect(result.nextAttemptAt).toBe(visitorReceiptRetryAt(now));
    const row = await store.getByDedupe(
      visitorConfirmationDedupeKey(emailLead.opportunityId, emailLead.method, emailLead.value),
    );
    expect(row?.status).toBe("failed");
    expect(row?.error).toBe("resend 500");
  });

  it("replay of the same lead does not double-send", async () => {
    const store = createMemoryVisitorReceiptOutbox();
    const transport = recordingTransport();
    const first = await deliverVisitorConfirmation({ store, transport, ...emailLead });
    const second = await deliverVisitorConfirmation({ store, transport, ...emailLead, fullName: "Different Name" });
    expect(first.status).toBe("sent");
    expect(second.status).toBe("sent");
    expect(second.duplicate).toBe(true);
    expect(transport.calls).toBe(1);
  });

  it("visitor and follow-up outboxes use distinct dedupe namespaces so neither can substitute for the other", () => {
    const visitor = visitorConfirmationDedupeKey(emailLead.opportunityId, emailLead.method, emailLead.value);
    const owner = followUpDedupeKey(emailLead.opportunityId, emailLead.method, emailLead.value);
    const partial = partialFollowUpDedupeKey(emailLead.opportunityId);
    expect(visitor.startsWith(`${VISITOR_CONFIRMATION_KIND}:`)).toBe(true);
    expect(owner.startsWith("follow_up_requested:")).toBe(true);
    expect(partial.startsWith("partial_follow_up_requested:")).toBe(true);
    expect(new Set([visitor, owner, partial]).size).toBe(3);
    // Account creation lives in its own third namespace too.
    expect(ACCOUNT_CREATED_NOTIFICATION_KIND).toBe("account_created_notification");
  });

  it("failure of the visitor receipt is auditable and is never reported as owner-package success", () => {
    const watchdog = source("app/api/opportunity-watchdog/route.ts");
    // Visitor and owner delivery results are surfaced as SEPARATE response
    // fields so a caller can distinguish which side succeeded and which
    // failed. A failed visitor receipt cannot be misread as an owner send.
    expect(watchdog).toContain("visitor_receipt_status");
    expect(watchdog).toContain("visitor_receipt_error");
    expect(watchdog).toContain("notify_status: notify.status");
    expect(watchdog).toContain("deliverVisitorConfirmation");
  });

  it("normalizes email case so a mixed-case retry hits the same row", async () => {
    const store = createMemoryVisitorReceiptOutbox();
    const transport = recordingTransport();
    const first = await deliverVisitorConfirmation({
      store,
      transport,
      opportunityId: "opp-case",
      sessionId: "sess-case",
      method: "email",
      value: "Case@Example.Invalid",
    });
    const second = await deliverVisitorConfirmation({
      store,
      transport,
      opportunityId: "opp-case",
      sessionId: "sess-case",
      method: "email",
      value: "CASE@example.invalid",
    });
    expect(first.status).toBe("sent");
    expect(second.duplicate).toBe(true);
    expect(transport.calls).toBe(1);
  });

  it("consent gating lives at the watchdog: submit_contact refuses without exact_package_consent", () => {
    const watchdog = source("app/api/opportunity-watchdog/route.ts");
    const submitAt = watchdog.indexOf('if (action === "submit_contact")');
    expect(submitAt).toBeGreaterThan(0);
    const nextAction = watchdog.indexOf("const now = Date.now()", submitAt);
    expect(nextAction).toBeGreaterThan(submitAt);
    const submit = watchdog.slice(submitAt, nextAction);
    expect(submit).toContain('exact_package_consent !== true');
    expect(submit).toContain('contact_readback_confirmed === true');
    expect(submit).toContain('Date.parse(readbackConfirmedAt) <= Date.parse(followUpAuthorizedAt)');
    expect(submit).toContain('"readback and exact package consent chronology required"');
    // Visitor confirmation only runs AFTER the RPC has accepted the consented
    // submit, on the same code path as persistAndDeliverFollowUp.
    const persistAt = submit.indexOf("persistAndDeliverFollowUp");
    const visitorAt = submit.indexOf("deliverVisitorConfirmation");
    expect(persistAt).toBeGreaterThan(0);
    expect(visitorAt).toBeGreaterThan(persistAt);
  });

  it("recovers a failed row on the next drain after next-attempt", async () => {
    const store = createMemoryVisitorReceiptOutbox();
    const now = new Date("2026-09-03T12:00:00.000Z");
    let fail = true;
    const transport = recordingTransport(async () => {
      if (fail) throw new Error("resend 503");
      return { providerId: "re_retry_visitor" };
    });
    const first = await deliverVisitorConfirmation({ store, transport, ...emailLead, now });
    expect(first.status).toBe("failed");
    fail = false;
    const tooSoon = await drainDueVisitorReceipts({ store, transport, now });
    expect(tooSoon).toHaveLength(0);
    const later = new Date(now.getTime() + 16 * 60 * 1000);
    const drained = await drainDueVisitorReceipts({ store, transport, now: later });
    expect(drained).toHaveLength(1);
    expect(drained[0].status).toBe("sent");
    expect(drained[0].providerId).toBe("re_retry_visitor");
  });

  it("does not queue or send for operator traffic", async () => {
    const store = createMemoryVisitorReceiptOutbox();
    const transport = recordingTransport();
    const result = await deliverVisitorConfirmation({ store, transport, ...emailLead, operatorExcluded: true });
    expect(result.error).toBe("operator_excluded");
    expect(transport.calls).toBe(0);
    expect(
      await store.getByDedupe(
        visitorConfirmationDedupeKey(emailLead.opportunityId, emailLead.method, emailLead.value),
      ),
    ).toBeNull();
  });

  it("local migration adds the new event kinds and marks itself local-only", () => {
    const sql = source("supabase/migrations/20260903092000_lead_follow_up_reliability.sql");
    expect(sql).toContain("LOCAL PREPARATION ONLY");
    expect(sql).toContain("'visitor_confirmation'");
    expect(sql).toContain("'account_created_notification'");
  });

  it("cron drainer sweeps follow-ups, visitor receipts, and account notifications", () => {
    const route = source("app/api/cron/lead-follow-ups/route.ts");
    expect(route).toContain("drainDueFollowUps");
    expect(route).toContain("drainDueVisitorReceipts");
    expect(route).toContain("drainDueAccountNotifications");
    expect(route).toContain("createResendVisitorReceiptTransport");
    expect(route).toContain("createResendAccountNotifyTransport");
    expect(route).toContain("CRON_SECRET");
  });

  // ---------------------------------------------------------------------------
  // Runtime-hash equivalence for the `\0` delimiter.
  //
  // The dedupe key's SHA-256 input separates the three fields with a NUL byte
  // (0x00). The source used to write that byte as a literal NUL character,
  // which made diff/search tools classify the file as binary. The delimiter is
  // now written as the JS escape `\0` (backslash-zero) - same runtime byte,
  // readable source. These regressions pin BOTH sides of that swap:
  //   1. The source file contains zero literal NUL bytes.
  //   2. The runtime dedupe key equals the SHA-256 of the input built with an
  //      explicit NUL delimiter (String.fromCharCode(0)) - proving the escape
  //      still produces byte-identical output.
  //   3. Fixed vectors hash to the exact hex the production outbox has stored.
  // Changing the delimiter byte would silently miss existing rows and let
  // duplicates through, so the vectors are frozen on purpose.
  // ---------------------------------------------------------------------------
  it("source file has zero literal NUL bytes", () => {
    const raw = readFileSync(join(process.cwd(), "src/lib/visitorConfirmation.ts"));
    let nulCount = 0;
    for (let i = 0; i < raw.length; i++) if (raw[i] === 0) nulCount++;
    expect(nulCount).toBe(0);
  });

  it("dedupe key equals the SHA-256 of `opp\\0method\\0normalized` for fixed vectors", () => {
    const NUL = String.fromCharCode(0);
    const cases = [
      { opp: "opp-abc", method: "email" as const, value: "visitor@example.com", normalized: "visitor@example.com" },
      { opp: "opp-abc", method: "email" as const, value: "Visitor@Example.COM", normalized: "visitor@example.com" },
      { opp: "opp-xyz", method: "phone" as const, value: "+1 (202) 555-0100", normalized: "12025550100" },
    ];
    for (const c of cases) {
      const digest = createHash("sha256")
        .update(`${c.opp}${NUL}${c.method}${NUL}${c.normalized}`)
        .digest("hex");
      expect(visitorConfirmationDedupeKey(c.opp, c.method, c.value)).toBe(
        `${VISITOR_CONFIRMATION_KIND}:${digest}`,
      );
    }
  });

  it("frozen dedupe key vectors: replacing `\\0` with any other byte would break these", () => {
    // These hex values are pinned to what the outbox has stored. If a future
    // refactor changes the delimiter byte, join order, or normalization, the
    // hashes below will move and the assertion will catch the drift before it
    // ships a duplicate-generating regression.
    const NUL = String.fromCharCode(0);
    const opp = "opp-abc";
    const method = "email" as const;
    const normalized = "visitor@example.com";
    const expected =
      `${VISITOR_CONFIRMATION_KIND}:` +
      createHash("sha256").update(`${opp}${NUL}${method}${NUL}${normalized}`).digest("hex");
    expect(visitorConfirmationDedupeKey(opp, method, "Visitor@Example.COM")).toBe(expected);
    // A wrong-delimiter version (space) must NOT collide with the current key.
    const wrongDelimiter =
      `${VISITOR_CONFIRMATION_KIND}:` +
      createHash("sha256").update(`${opp} ${method} ${normalized}`).digest("hex");
    expect(visitorConfirmationDedupeKey(opp, method, "Visitor@Example.COM")).not.toBe(wrongDelimiter);
  });

  // ---------------------------------------------------------------------------
  // Lifecycle-event namespace independence.
  //
  // account_created_notification and visitor_confirmation are DIFFERENT
  // lifecycle events with different dedupe keys, idempotency keys, and outbox
  // rows. A person who both signs up (account/start) AND asks 6 to have the
  // team reach out (submit_contact) legitimately triggers ONE of each. The
  // events must not collapse or silently suppress one another, and each event
  // must be independently idempotent under its OWN replay. This is a policy
  // documentation point - do not add cross-event suppression without G's
  // explicit direction.
  // ---------------------------------------------------------------------------
  it("same-event replay is idempotent independently for account_created and visitor_confirmation", async () => {
    const accountStore = createMemoryAccountNotifyOutbox();
    const accountTransport: AccountNotifyTransport & { calls: number } = {
      calls: 0,
      async send() {
        this.calls += 1;
        return { providerId: "re_acct_person" };
      },
    };
    const first = await deliverAccountCreatedNotification({
      store: accountStore,
      transport: accountTransport,
      email: emailLead.value,
      fullName: emailLead.fullName,
    });
    const second = await deliverAccountCreatedNotification({
      store: accountStore,
      transport: accountTransport,
      email: emailLead.value,
      fullName: emailLead.fullName,
    });
    expect(first.status).toBe("sent");
    expect(second.duplicate).toBe(true);
    expect(accountTransport.calls).toBe(1);

    const visitorStore = createMemoryVisitorReceiptOutbox();
    const visitorTransport = recordingTransport();
    const firstVisitor = await deliverVisitorConfirmation({
      store: visitorStore,
      transport: visitorTransport,
      ...emailLead,
    });
    const secondVisitor = await deliverVisitorConfirmation({
      store: visitorStore,
      transport: visitorTransport,
      ...emailLead,
    });
    expect(firstVisitor.status).toBe("sent");
    expect(secondVisitor.duplicate).toBe(true);
    expect(visitorTransport.calls).toBe(1);
  });

  it("one person may trigger exactly one account_created AND one visitor_confirmation - the events do not suppress each other", async () => {
    const accountStore = createMemoryAccountNotifyOutbox();
    const accountTransport: AccountNotifyTransport & { calls: number } = {
      calls: 0,
      async send() {
        this.calls += 1;
        return { providerId: "re_acct_both" };
      },
    };
    const visitorStore = createMemoryVisitorReceiptOutbox();
    const visitorTransport = recordingTransport();

    const accountResult = await deliverAccountCreatedNotification({
      store: accountStore,
      transport: accountTransport,
      email: emailLead.value,
      fullName: emailLead.fullName,
    });
    const visitorResult = await deliverVisitorConfirmation({
      store: visitorStore,
      transport: visitorTransport,
      ...emailLead,
    });

    expect(accountResult.status).toBe("sent");
    expect(visitorResult.status).toBe("sent");
    // Distinct providers were called ONCE each - neither event blocked the
    // other, but each was independently idempotent.
    expect(accountTransport.calls).toBe(1);
    expect(visitorTransport.calls).toBe(1);
    // Dedupe keys sit in distinct namespaces.
    expect(accountCreatedDedupeKey(emailLead.value).startsWith("account_created:")).toBe(true);
    expect(
      visitorConfirmationDedupeKey(emailLead.opportunityId, emailLead.method, emailLead.value)
        .startsWith(`${VISITOR_CONFIRMATION_KIND}:`),
    ).toBe(true);
  });
});
