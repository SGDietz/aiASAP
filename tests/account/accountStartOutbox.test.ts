import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACCOUNT_CREATED_NOTIFICATION_KIND,
  accountCreatedDedupeKey,
  accountCreatedIdempotencyKey,
  createMemoryAccountNotifyOutbox,
  deliverAccountCreatedNotification,
  drainDueAccountNotifications,
  type AccountNotifyTransport,
} from "../../src/lib/accountCreatedNotify";
import {
  followUpDedupeKey,
  partialFollowUpDedupeKey,
} from "../../src/lib/leadFollowUpNotify";
import { visitorConfirmationDedupeKey } from "../../src/lib/visitorConfirmation";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function recordingTransport(impl?: AccountNotifyTransport["send"]): AccountNotifyTransport & { calls: number; keys: string[] } {
  const keys: string[] = [];
  const send = impl ?? (async ({ idempotencyKey }) => {
    keys.push(idempotencyKey);
    return { providerId: "re_acct_1" };
  });
  const wrapped: AccountNotifyTransport & { calls: number; keys: string[] } = {
    calls: 0,
    keys,
    async send(args) {
      wrapped.calls += 1;
      return send(args);
    },
  };
  return wrapped;
}

const email = "pat@example.invalid";

describe("account_created_notification durable outbox", () => {
  it("routes account/start through the durable outbox — no fire-and-forget notifyTeam", () => {
    const route = source("app/api/account/start/route.ts");
    expect(route).toContain("deliverAccountCreatedNotification");
    expect(route).toContain("createHttpAccountNotifyOutbox");
    expect(route).not.toContain("notifyTeam(");
    expect(route).not.toContain("void notifyTeam");
    // await the delivery — the audit called out fire-and-forget as the
    // ambiguous behavior that must be replaced.
    expect(route).toMatch(/await\s+deliverAccountCreatedNotification/);
  });

  it("dedupe key is a distinct namespace so account/start cannot double-send vs verbal submit_contact", () => {
    const account = accountCreatedDedupeKey(email);
    const owner = followUpDedupeKey("opp-x", "email", email);
    const partial = partialFollowUpDedupeKey("opp-x");
    const visitor = visitorConfirmationDedupeKey("opp-x", "email", email);
    expect(account).toBe(`account_created:${email}`);
    expect(account.startsWith("account_created:")).toBe(true);
    expect(owner.startsWith("follow_up_requested:")).toBe(true);
    expect(partial.startsWith("partial_follow_up_requested:")).toBe(true);
    expect(visitor.startsWith("visitor_confirmation:")).toBe(true);
    expect(new Set([account, owner, partial, visitor]).size).toBe(4);
    expect(accountCreatedIdempotencyKey(email)).toBe(`team:account_created:${email}`);
  });

  it("normalizes email so two account/start calls for the same address produce one send", async () => {
    const store = createMemoryAccountNotifyOutbox();
    const transport = recordingTransport();
    const first = await deliverAccountCreatedNotification({
      store,
      transport,
      email: "Pat@Example.INVALID",
      fullName: "Pat First",
    });
    const second = await deliverAccountCreatedNotification({
      store,
      transport,
      email: "PAT@example.invalid",
      fullName: "Pat Second",
    });
    expect(first.status).toBe("sent");
    expect(first.providerId).toBe("re_acct_1");
    expect(second.status).toBe("sent");
    expect(second.duplicate).toBe(true);
    expect(transport.calls).toBe(1);
    expect(transport.keys[0]).toBe(accountCreatedIdempotencyKey(email));
  });

  it("keeps a durable row on failure that the cron drainer picks up after next-attempt", async () => {
    const store = createMemoryAccountNotifyOutbox();
    let fail = true;
    const transport = recordingTransport(async () => {
      if (fail) throw new Error("resend 503");
      return { providerId: "re_acct_retry" };
    });
    const now = new Date("2026-09-03T12:00:00.000Z");
    const first = await deliverAccountCreatedNotification({ store, transport, email, now });
    expect(first.status).toBe("failed");
    expect(first.error).toBe("resend 503");
    const row = await store.getByDedupe(accountCreatedDedupeKey(email));
    expect(row?.status).toBe("failed");
    fail = false;
    const tooSoon = await drainDueAccountNotifications({ store, transport, now });
    expect(tooSoon).toHaveLength(0);
    const later = new Date(now.getTime() + 16 * 60 * 1000);
    const drained = await drainDueAccountNotifications({ store, transport, now: later });
    expect(drained).toHaveLength(1);
    expect(drained[0].status).toBe("sent");
    expect(drained[0].providerId).toBe("re_acct_retry");
    expect(transport.calls).toBe(2);
  });

  it("has the migration constraint that allows the new event kind and its null opportunity_id", () => {
    const sql = source("supabase/migrations/20260903092000_lead_follow_up_reliability.sql");
    expect(sql).toContain("'account_created_notification'");
    expect(sql).toContain("opportunity_id drop not null");
    expect(sql).toContain("opportunity_notification_outbox_opportunity_id_required");
    // Every other event kind must still carry an opportunity_id.
    expect(sql).toContain("event_kind = 'account_created_notification'");
  });

  it("expected kind constant matches the migration allow-list", () => {
    expect(ACCOUNT_CREATED_NOTIFICATION_KIND).toBe("account_created_notification");
  });
});
