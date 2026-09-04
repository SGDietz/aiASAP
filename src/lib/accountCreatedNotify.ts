/**
 * Durable "someone signed up" team notification for /api/account/start.
 *
 * BEFORE: /api/account/start called `void notifyTeam({ kind: "new_account", ... })`
 * fire-and-forget after the magic link. On any Resend failure the notice was
 * dropped, and there was no durable row to retry — the audit called this out.
 *
 * NOW: an outbox row is inserted synchronously (event_kind
 * `account_created_notification`) with dedupe_key `account_created:<email>`,
 * then a claim-and-send is awaited. A transport failure keeps the row in
 * `failed`/`sending` for the existing follow-up cron to drain.
 *
 * The dedupe_key namespace is DISTINCT from `follow_up_requested:<sha256>` and
 * `visitor_confirmation:<sha256>`, so this event can never collide with the
 * verbal `submit_contact` durable follow-up or the visitor receipt. Two
 * account/start requests for the same email produce one row and one send.
 */
import { randomUUID } from "node:crypto";
import { sendPurposeEmail } from "./emailSenders";
import { buildTeamNotifyHtml, buildTeamNotifyText, type TeamNotifyInput } from "./teamNotify";

export const ACCOUNT_CREATED_NOTIFICATION_KIND = "account_created_notification" as const;
export const ACCOUNT_NOTIFY_SEND_LEASE_MS = 5 * 60 * 1000;

export type AccountNotifyStatus =
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "dead_letter";

export type AccountNotifyPayload = {
  email: string;
  fullName: string | null;
  sessionId: string | null;
  lists: string[];
};

export type AccountNotifyRow = {
  id: string;
  dedupeKey: string;
  payload: AccountNotifyPayload;
  status: AccountNotifyStatus;
  attemptCount: number;
  providerId: string | null;
  error: string | null;
  nextAttemptAt: string | null;
  sentAt: string | null;
  updatedAt: string;
  leaseToken: string | null;
  leaseExpiresAt: string | null;
};

export type AccountNotifyDelivery = {
  status: AccountNotifyStatus;
  providerId: string | null;
  error: string | null;
  nextAttemptAt: string | null;
  duplicate: boolean;
};

export type AccountNotifyTransport = {
  send(args: {
    dedupeKey: string;
    idempotencyKey: string;
    payload: AccountNotifyPayload;
  }): Promise<{ providerId: string }>;
};

export type AccountNotifyOutboxStore = {
  insertIgnoreDuplicate(row: {
    dedupeKey: string;
    payload: AccountNotifyPayload;
  }): Promise<AccountNotifyRow>;
  getByDedupe(dedupeKey: string): Promise<AccountNotifyRow | null>;
  claim(dedupeKey: string, now: Date): Promise<AccountNotifyRow | null>;
  markSent(id: string, leaseToken: string, providerId: string, now: Date): Promise<AccountNotifyRow>;
  markFailed(id: string, leaseToken: string, error: string, nextAttemptAt: string, now: Date): Promise<AccountNotifyRow>;
  listDue(now: Date): Promise<AccountNotifyRow[]>;
};

export function accountCreatedDedupeKey(email: string): string {
  return `account_created:${email.trim().toLowerCase()}`;
}

export function accountCreatedIdempotencyKey(email: string): string {
  return `team:${accountCreatedDedupeKey(email)}`;
}

export function accountNotifyRetryAt(now: Date, minutes = 15): string {
  return new Date(now.getTime() + minutes * 60 * 1000).toISOString();
}

function isDue(row: AccountNotifyRow, now: Date): boolean {
  if (row.status === "sent" || row.status === "dead_letter") return false;
  if (row.status === "queued") return !row.nextAttemptAt || Date.parse(row.nextAttemptAt) <= now.getTime();
  if (row.status === "sending") {
    const expiry = row.leaseExpiresAt ? Date.parse(row.leaseExpiresAt) : NaN;
    return !Number.isFinite(expiry) || expiry <= now.getTime();
  }
  if (row.status !== "failed") return false;
  if (!row.nextAttemptAt) return true;
  return Date.parse(row.nextAttemptAt) <= now.getTime();
}

export function createMemoryAccountNotifyOutbox(): AccountNotifyOutboxStore {
  const rows = new Map<string, AccountNotifyRow>();
  let n = 0;
  const save = (row: AccountNotifyRow) => {
    rows.set(row.dedupeKey, { ...row });
    return rows.get(row.dedupeKey)!;
  };
  return {
    async insertIgnoreDuplicate(input) {
      const existing = rows.get(input.dedupeKey);
      if (existing) return { ...existing };
      return save({
        id: `mem-acct-${++n}`,
        dedupeKey: input.dedupeKey,
        payload: input.payload,
        status: "queued",
        attemptCount: 0,
        providerId: null,
        error: null,
        nextAttemptAt: null,
        sentAt: null,
        updatedAt: new Date().toISOString(),
        leaseToken: null,
        leaseExpiresAt: null,
      });
    },
    async getByDedupe(dedupeKey) {
      const row = rows.get(dedupeKey);
      return row ? { ...row } : null;
    },
    async claim(dedupeKey, now) {
      const row = rows.get(dedupeKey);
      if (!row || !isDue(row, now)) return null;
      return save({
        ...row,
        status: "sending",
        attemptCount: row.attemptCount + 1,
        error: null,
        updatedAt: now.toISOString(),
        leaseToken: randomUUID(),
        leaseExpiresAt: new Date(now.getTime() + ACCOUNT_NOTIFY_SEND_LEASE_MS).toISOString(),
      });
    },
    async markSent(id, leaseToken, providerId, now) {
      const found = [...rows.values()].find((r) => r.id === id);
      if (!found) throw new Error("account notify row missing");
      if (found.status !== "sending" || found.leaseToken !== leaseToken) {
        throw new Error("account notify claim lost before markSent");
      }
      return save({
        ...found,
        status: "sent",
        providerId,
        error: null,
        nextAttemptAt: null,
        sentAt: now.toISOString(),
        updatedAt: now.toISOString(),
        leaseToken: null,
        leaseExpiresAt: null,
      });
    },
    async markFailed(id, leaseToken, error, nextAttemptAt, now) {
      const found = [...rows.values()].find((r) => r.id === id);
      if (!found) throw new Error("account notify row missing");
      if (found.status !== "sending" || found.leaseToken !== leaseToken) {
        throw new Error("account notify claim lost before markFailed");
      }
      return save({
        ...found,
        status: "failed",
        error,
        nextAttemptAt,
        updatedAt: now.toISOString(),
        leaseToken: null,
        leaseExpiresAt: null,
      });
    },
    async listDue(now) {
      return [...rows.values()].filter((r) => isDue(r, now)).map((r) => ({ ...r }));
    },
  };
}

function h(key: string, prefer = "return=representation") {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: prefer,
  };
}

function fromHttp(row: Record<string, unknown>): AccountNotifyRow {
  const payload = (row.payload ?? {}) as AccountNotifyPayload;
  return {
    id: String(row.id),
    dedupeKey: String(row.dedupe_key),
    payload,
    status: row.status as AccountNotifyStatus,
    attemptCount: Number(row.attempt_count ?? 0),
    providerId: typeof row.provider_id === "string" ? row.provider_id : null,
    error: typeof row.error === "string" ? row.error : null,
    nextAttemptAt: typeof row.next_attempt_at === "string" ? row.next_attempt_at : null,
    sentAt: typeof row.sent_at === "string" ? row.sent_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
    leaseToken: typeof row.lease_token === "string" ? row.lease_token : null,
    leaseExpiresAt: typeof row.lease_expires_at === "string" ? row.lease_expires_at : null,
  };
}

// The outbox table's opportunity_id was NOT NULL for the visitor/follow-up
// event kinds. Account-created notifications originate at /api/account/start,
// which has no visitor_opportunities row to attach to. The 20260903 migration
// drops the NOT NULL and adds a check that opportunity_id may only be null
// for this specific event kind, so the FK still bites for visitor/follow-up.

export function createHttpAccountNotifyOutbox(url: string, key: string): AccountNotifyOutboxStore {
  const base = `${url}/rest/v1/opportunity_notification_outbox`;
  return {
    async insertIgnoreDuplicate(input) {
      const res = await fetch(`${base}?on_conflict=dedupe_key&select=*`, {
        method: "POST",
        headers: h(key, "resolution=ignore-duplicates,return=representation"),
        body: JSON.stringify({
          opportunity_id: null,
          event_kind: ACCOUNT_CREATED_NOTIFICATION_KIND,
          dedupe_key: input.dedupeKey,
          payload: input.payload,
          status: "queued",
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`account notify insert failed ${res.status}: ${detail.slice(0, 200)}`);
      }
      const rows = (await res.json()) as Record<string, unknown>[];
      if (rows[0]) return fromHttp(rows[0]);
      const existing = await this.getByDedupe(input.dedupeKey);
      if (!existing) throw new Error("account notify row missing after duplicate insert");
      return existing;
    },
    async getByDedupe(dedupeKey) {
      const res = await fetch(
        `${base}?dedupe_key=eq.${encodeURIComponent(dedupeKey)}&select=*&limit=1`,
        { headers: h(key) },
      );
      if (!res.ok) throw new Error(`account notify read failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      return rows[0] ? fromHttp(rows[0]) : null;
    },
    async claim(dedupeKey, now) {
      const leaseToken = randomUUID();
      const iso = now.toISOString();
      const leaseExpires = new Date(now.getTime() + ACCOUNT_NOTIFY_SEND_LEASE_MS).toISOString();
      const filter =
        `dedupe_key=eq.${encodeURIComponent(dedupeKey)}` +
        `&event_kind=eq.${ACCOUNT_CREATED_NOTIFICATION_KIND}` +
        `&or=(and(status.in.(queued,failed),or(next_attempt_at.is.null,next_attempt_at.lte.${encodeURIComponent(iso)}))` +
        `,and(status.eq.sending,lease_expires_at.lte.${encodeURIComponent(iso)}))`;
      const res = await fetch(`${base}?${filter}&select=*`, {
        method: "PATCH",
        headers: h(key),
        body: JSON.stringify({
          status: "sending",
          error: null,
          lease_token: leaseToken,
          lease_expires_at: leaseExpires,
        }),
      });
      if (!res.ok) throw new Error(`account notify claim failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      if (!rows[0]) return null;
      const claimed = fromHttp(rows[0]);
      const inc = await fetch(
        `${base}?id=eq.${encodeURIComponent(claimed.id)}&lease_token=eq.${encodeURIComponent(leaseToken)}&select=*`,
        {
          method: "PATCH",
          headers: h(key),
          body: JSON.stringify({ attempt_count: claimed.attemptCount + 1 }),
        },
      );
      if (!inc.ok) return claimed;
      const incRows = (await inc.json()) as Record<string, unknown>[];
      return incRows[0] ? fromHttp(incRows[0]) : claimed;
    },
    async markSent(id, leaseToken, providerId, now) {
      const res = await fetch(
        `${base}?id=eq.${encodeURIComponent(id)}&status=eq.sending&lease_token=eq.${encodeURIComponent(leaseToken)}&select=*`,
        {
          method: "PATCH",
          headers: h(key),
          body: JSON.stringify({
            status: "sent",
            provider_id: providerId,
            error: null,
            next_attempt_at: null,
            sent_at: now.toISOString(),
            lease_token: null,
            lease_expires_at: null,
          }),
        },
      );
      if (!res.ok) throw new Error(`account notify markSent failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      if (!rows[0]) throw new Error("account notify claim lost before markSent");
      return fromHttp(rows[0]);
    },
    async markFailed(id, leaseToken, error, nextAttemptAt) {
      const res = await fetch(
        `${base}?id=eq.${encodeURIComponent(id)}&status=eq.sending&lease_token=eq.${encodeURIComponent(leaseToken)}&select=*`,
        {
          method: "PATCH",
          headers: h(key),
          body: JSON.stringify({
            status: "failed",
            error: error.slice(0, 300),
            next_attempt_at: nextAttemptAt,
            lease_token: null,
            lease_expires_at: null,
          }),
        },
      );
      if (!res.ok) throw new Error(`account notify markFailed failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      if (!rows[0]) throw new Error("account notify claim lost before markFailed");
      return fromHttp(rows[0]);
    },
    async listDue(now) {
      const iso = now.toISOString();
      const res = await fetch(
        `${base}?event_kind=eq.${ACCOUNT_CREATED_NOTIFICATION_KIND}` +
          `&status=in.(queued,failed,sending)` +
          `&or=(next_attempt_at.is.null,next_attempt_at.lte.${encodeURIComponent(iso)})` +
          `&select=*&order=created_at.asc&limit=10`,
        { headers: h(key) },
      );
      if (!res.ok) throw new Error(`account notify listDue failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      return rows.map(fromHttp).filter((row) => isDue(row, now));
    },
  };
}

export function accountNotifyTeamInput(payload: AccountNotifyPayload, dedupeKey: string): TeamNotifyInput {
  return {
    kind: "new_account",
    who: payload.fullName?.trim() || payload.email,
    email: payload.email,
    facts: [
      ["Name given", payload.fullName],
      [
        "Lists they asked about",
        payload.lists.length ? payload.lists.slice(0, 10).join(", ") : null,
      ],
    ],
    nextStep: "Nothing to do yet - this is just so you know they exist. The interview comes next.",
    sessionId: payload.sessionId,
    dedupeKey,
  };
}

export function createResendAccountNotifyTransport(): AccountNotifyTransport {
  return {
    async send({ dedupeKey, idempotencyKey, payload }) {
      const to = process.env.AIASAP_FOUNDER_REPORT_EMAIL;
      if (!to) throw new Error("no recipient");
      if (process.env.TEAM_EMAILS_ENABLED === "false") throw new Error("TEAM_EMAILS_ENABLED=false");
      const input = accountNotifyTeamInput(payload, dedupeKey);
      const res = await sendPurposeEmail({
        purpose: "digest",
        to,
        subject: `aiASAP: ${input.who} signed up`,
        text: buildTeamNotifyText(input),
        html: buildTeamNotifyHtml(input),
        idempotencyKey,
      });
      if (!res.ok) throw new Error(res.error ?? "resend failed");
      const providerId = res.id?.trim();
      if (!providerId) throw new Error("resend accepted without id");
      return { providerId };
    },
  };
}

export async function drainAccountNotifyRow(
  store: AccountNotifyOutboxStore,
  transport: AccountNotifyTransport,
  dedupeKey: string,
  now: Date,
): Promise<AccountNotifyDelivery> {
  const existing = await store.getByDedupe(dedupeKey);
  if (!existing) {
    return { status: "failed", providerId: null, error: "account notify row missing", nextAttemptAt: accountNotifyRetryAt(now), duplicate: false };
  }
  if (existing.status === "sent") {
    return { status: "sent", providerId: existing.providerId, error: null, nextAttemptAt: null, duplicate: true };
  }
  const claimed = await store.claim(dedupeKey, now);
  if (!claimed) {
    const latest = await store.getByDedupe(dedupeKey);
    if (latest?.status === "sent") {
      return { status: "sent", providerId: latest.providerId, error: null, nextAttemptAt: null, duplicate: true };
    }
    return {
      status: latest?.status ?? "failed",
      providerId: latest?.providerId ?? null,
      error: latest?.error ?? "not due",
      nextAttemptAt: latest?.nextAttemptAt ?? null,
      duplicate: false,
    };
  }
  try {
    const sent = await transport.send({
      dedupeKey,
      idempotencyKey: accountCreatedIdempotencyKey(claimed.payload.email),
      payload: claimed.payload,
    });
    try {
      const stored = await store.markSent(claimed.id, claimed.leaseToken!, sent.providerId, now);
      return { status: "sent", providerId: stored.providerId, error: null, nextAttemptAt: null, duplicate: false };
    } catch (persistError) {
      const latest = await store.getByDedupe(dedupeKey).catch(() => null);
      if (latest?.status === "sent") {
        return { status: "sent", providerId: latest.providerId, error: null, nextAttemptAt: null, duplicate: true };
      }
      return {
        status: latest?.status ?? "sending",
        providerId: latest?.providerId ?? sent.providerId,
        error: persistError instanceof Error ? persistError.message : String(persistError),
        nextAttemptAt: latest?.nextAttemptAt ?? new Date(now.getTime() + ACCOUNT_NOTIFY_SEND_LEASE_MS).toISOString(),
        duplicate: false,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "account notify transport failed";
    try {
      const stored = await store.markFailed(claimed.id, claimed.leaseToken!, message, accountNotifyRetryAt(now), now);
      return { status: "failed", providerId: stored.providerId, error: stored.error, nextAttemptAt: stored.nextAttemptAt, duplicate: false };
    } catch (persistError) {
      const latest = await store.getByDedupe(dedupeKey).catch(() => null);
      if (latest?.status === "sent") {
        return { status: "sent", providerId: latest.providerId, error: null, nextAttemptAt: null, duplicate: true };
      }
      const persistMessage = persistError instanceof Error ? persistError.message : String(persistError);
      return {
        status: latest?.status ?? "sending",
        providerId: latest?.providerId ?? null,
        error: `${message}; could not persist failure: ${persistMessage}`.slice(0, 300),
        nextAttemptAt: latest?.nextAttemptAt ?? new Date(now.getTime() + ACCOUNT_NOTIFY_SEND_LEASE_MS).toISOString(),
        duplicate: false,
      };
    }
  }
}

export async function deliverAccountCreatedNotification(args: {
  store: AccountNotifyOutboxStore;
  transport: AccountNotifyTransport;
  email: string;
  fullName?: string | null;
  sessionId?: string | null;
  lists?: string[];
  now?: Date;
}): Promise<AccountNotifyDelivery> {
  const now = args.now ?? new Date();
  const email = args.email.trim().toLowerCase();
  const dedupeKey = accountCreatedDedupeKey(email);
  const payload: AccountNotifyPayload = {
    email,
    fullName: args.fullName?.trim().slice(0, 200) || null,
    sessionId: args.sessionId ?? null,
    lists: (args.lists ?? []).map((l) => String(l)).slice(0, 50),
  };
  try {
    await args.store.insertIgnoreDuplicate({ dedupeKey, payload });
  } catch (error) {
    return {
      status: "failed",
      providerId: null,
      error: error instanceof Error ? error.message.slice(0, 300) : "account notify outbox insert failed",
      nextAttemptAt: null,
      duplicate: false,
    };
  }
  return drainAccountNotifyRow(args.store, args.transport, dedupeKey, now);
}

export async function drainDueAccountNotifications(args: {
  store: AccountNotifyOutboxStore;
  transport: AccountNotifyTransport;
  now?: Date;
}): Promise<AccountNotifyDelivery[]> {
  const now = args.now ?? new Date();
  const due = await args.store.listDue(now);
  const results: AccountNotifyDelivery[] = [];
  for (const row of due) results.push(await drainAccountNotifyRow(args.store, args.transport, row.dedupeKey, now));
  return results;
}
