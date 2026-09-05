/**
 * THE DRAIN FOR VISITOR ALERTS — `new_visitor` and `unfinished_opportunity`.
 *
 * G, 2026-09-04: "build the drain with the internal filter."
 *
 * These two event kinds were being QUEUED by the opportunity watchdog and
 * nothing ever sent them. Measured that day: 100 rows sitting in `queued`
 * with `attempt_count` 0 — 91 `new_visitor`, 9 `unfinished_opportunity`.
 * Not a broken sender: no sender was ever written. `drainDueFollowUps`,
 * `drainDueVisitorReceipts` and `drainDueAccountNotifications` exist and run
 * every five minutes; there was no fourth.
 *
 * THE FILTER IS THE POINT. Turning this on without one would email G every
 * time he opens his own site, which is the bug-email flood he already had
 * switched off once. Internal rows are not deleted and not skipped silently —
 * they are marked `dead_letter` with the reason and the signals that matched,
 * so the suppression is auditable and the outbox stops growing.
 *
 * Legacy rows queued before the watchdog started recording signals are
 * re-checked here from whatever the payload does carry (`referrer`,
 * `testerLabel`), which is why the filter runs on the payload rather than
 * trusting a stored boolean.
 */
import { randomUUID } from "node:crypto";
import {
  emailShell,
  emailRows,
  emailParagraph,
  emailDivider,
  emailFine,
} from "./emailTheme";
import {
  internalTrafficSignals,
  type InternalTrafficSignal,
} from "./internalTraffic";

export const NEW_VISITOR_KIND = "new_visitor" as const;
export const UNFINISHED_KIND = "unfinished_opportunity" as const;

export type OpportunityAlertKind =
  | typeof NEW_VISITOR_KIND
  | typeof UNFINISHED_KIND;

export type OpportunityAlertStatus =
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "dead_letter";

export type OpportunityAlertPayload = {
  opportunityId?: string | null;
  sessionReviewRef?: string | null;
  referrer?: string | null;
  testerLabel?: string | null;
  deviceClass?: string | null;
  arrivalTime?: string | null;
  reason?: string | null;
  valueSummary?: string | null;
  buildSummary?: string | null;
  nextAction?: string | null;
  discoveryStage?: string | null;
  contactStatus?: string | null;
  /** Derived labels recorded at queue time. Never a raw IP. */
  internalSignals?: string[] | null;
};

export type OpportunityAlertRow = {
  dedupeKey: string;
  eventKind: OpportunityAlertKind;
  opportunityId: string;
  status: OpportunityAlertStatus;
  attemptCount: number;
  payload: OpportunityAlertPayload;
  providerId: string | null;
  error: string | null;
  nextAttemptAt: string | null;
  createdAt: string | null;
  /** Proof we hold the claim. Every write is scoped to it. */
  leaseToken: string | null;
};

export type OpportunityAlertDelivery = {
  dedupeKey: string;
  status: OpportunityAlertStatus;
  providerId: string | null;
  error: string | null;
  /** Present only when the row was suppressed as ours. */
  internalSignals?: InternalTrafficSignal[];
};

export type OpportunityAlertTransport = {
  send(args: {
    dedupeKey: string;
    idempotencyKey: string;
    kind: OpportunityAlertKind;
    payload: OpportunityAlertPayload;
  }): Promise<{ providerId: string }>;
};

export type OpportunityAlertStore = {
  listDue(now: Date, limit: number): Promise<OpportunityAlertRow[]>;
  claim(dedupeKey: string, now: Date): Promise<OpportunityAlertRow | null>;
  /**
   * Every write carries the lease token from claim(). Without it two
   * overlapping cron runs can overwrite each other's result - the house
   * follow-up store scopes its patches the same way.
   */
  markSent(
    dedupeKey: string,
    leaseToken: string | null,
    providerId: string,
    now: Date,
  ): Promise<void>;
  /**
   * `attemptCount` is written explicitly: the old RPC incremented it, and the
   * conditional claim that replaced it does not. Without this the count stays
   * 0, MAX_ATTEMPTS is never reached, and a permanently failing row retries
   * every 15 minutes forever.
   */
  markFailed(
    dedupeKey: string,
    leaseToken: string | null,
    error: string,
    nextAttemptAt: string | null,
    attemptCount: number,
    now: Date,
  ): Promise<void>;
  markDeadLetter(
    dedupeKey: string,
    leaseToken: string | null,
    reason: string,
    now: Date,
  ): Promise<void>;
};

/** After this many tries a row stops costing us provider calls. */
export const MAX_ATTEMPTS = 5;
export const INTERNAL_REASON = "internal_traffic";
export const STALE_REASON = "stale_backlog";

/**
 * AN ALERT IS ONLY WORTH SENDING WHILE IT IS STILL TRUE.
 *
 * "Someone is on your site" has a shelf life measured in minutes. Found the
 * hard way: a dry run of this drain over the real outbox on 2026-09-04 would
 * have sent 142 emails, most of them about visits from 2026-08-22, because
 * those rows predate the signal recording and carry no origin clue - so the
 * fail-open filter passed them all.
 *
 * A staleness cut is the honest answer rather than a bigger filter. It retires
 * the backlog, and it permanently stops any future outage from turning into a
 * flood the moment the drain comes back up.
 */
export const MAX_ALERT_AGE_MINUTES = 120;

export function alertIdempotencyKey(
  kind: OpportunityAlertKind,
  opportunityId: string,
): string {
  return `${kind}:${opportunityId}`;
}

export function retryAt(now: Date, minutes = 15): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

/**
 * Re-derive the signals for a row. Prefers what the watchdog recorded; falls
 * back to reading the payload for rows queued before that existed.
 */
export function rowInternalSignals(
  payload: OpportunityAlertPayload,
  founderEmails?: string | null,
): InternalTrafficSignal[] {
  const recorded = (payload.internalSignals ?? []).filter(
    Boolean,
  ) as InternalTrafficSignal[];
  if (recorded.length) return recorded;

  // Legacy rows: the referrer is the one origin clue they carry, and a tester
  // label is an explicit "this is us" marker.
  const derived = internalTrafficSignals({
    hostname: safeHost(payload.referrer ?? null),
    founderEmails,
  });
  if (payload.testerLabel) derived.push("operator_flag");
  return derived;
}

function safeHost(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname;
  } catch {
    return null;
  }
}

export function isStaleAlert(
  row: Pick<OpportunityAlertRow, "createdAt">,
  now: Date,
  maxAgeMinutes = MAX_ALERT_AGE_MINUTES,
): boolean {
  if (!row.createdAt) return false;
  const created = Date.parse(row.createdAt);
  if (!Number.isFinite(created)) return false;
  return now.getTime() - created > maxAgeMinutes * 60_000;
}

export async function drainOpportunityAlertRow(
  store: OpportunityAlertStore,
  transport: OpportunityAlertTransport,
  dedupeKey: string,
  now: Date,
  founderEmails?: string | null,
): Promise<OpportunityAlertDelivery> {
  const claimed = await store.claim(dedupeKey, now);
  if (!claimed) {
    return { dedupeKey, status: "queued", providerId: null, error: "not due" };
  }

  // Too old to be true any more. Checked before the filter so a stale row is
  // retired even when we cannot tell whose visit it was.
  if (isStaleAlert(claimed, now)) {
    await store.markDeadLetter(dedupeKey, claimed.leaseToken, STALE_REASON, now);
    return { dedupeKey, status: "dead_letter", providerId: null, error: STALE_REASON };
  }

  // THE FILTER, before a single provider call is spent.
  const signals = rowInternalSignals(claimed.payload, founderEmails);
  if (signals.length) {
    await store.markDeadLetter(
      dedupeKey,
      claimed.leaseToken,
      `${INTERNAL_REASON}: ${signals.join(",")}`,
      now,
    );
    return {
      dedupeKey,
      status: "dead_letter",
      providerId: null,
      error: INTERNAL_REASON,
      internalSignals: signals,
    };
  }

  if (claimed.attemptCount >= MAX_ATTEMPTS) {
    await store.markDeadLetter(dedupeKey, claimed.leaseToken, "max_attempts", now);
    return {
      dedupeKey,
      status: "dead_letter",
      providerId: null,
      error: "max_attempts",
    };
  }

  try {
    const sent = await transport.send({
      dedupeKey,
      idempotencyKey: alertIdempotencyKey(
        claimed.eventKind,
        claimed.opportunityId,
      ),
      kind: claimed.eventKind,
      payload: claimed.payload,
    });
    await store.markSent(dedupeKey, claimed.leaseToken, sent.providerId, now);
    return {
      dedupeKey,
      status: "sent",
      providerId: sent.providerId,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const attempts = claimed.attemptCount + 1;
    const next = attempts >= MAX_ATTEMPTS ? null : retryAt(now);
    if (next === null) {
      await store.markDeadLetter(dedupeKey, claimed.leaseToken, `max_attempts: ${message}`, now);
      return {
        dedupeKey,
        status: "dead_letter",
        providerId: null,
        error: message,
      };
    }
    await store.markFailed(dedupeKey, claimed.leaseToken, message, next, attempts, now);
    return { dedupeKey, status: "failed", providerId: null, error: message };
  }
}

export async function drainDueOpportunityAlerts(args: {
  store: OpportunityAlertStore;
  transport: OpportunityAlertTransport;
  now?: Date;
  limit?: number;
  founderEmails?: string | null;
}): Promise<OpportunityAlertDelivery[]> {
  const now = args.now ?? new Date();
  const due = await args.store.listDue(now, args.limit ?? 25);
  const out: OpportunityAlertDelivery[] = [];
  for (const row of due) {
    out.push(
      await drainOpportunityAlertRow(
        args.store,
        args.transport,
        row.dedupeKey,
        now,
        args.founderEmails,
      ),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Storage. Same table and the SAME claim RPC the follow-up drain uses -
// `claim_opportunity_follow_up` keys only on dedupe_key with no event_kind
// filter, so it serves these kinds too and this needed no migration.
// ---------------------------------------------------------------------------

const ALERT_LEASE_MS = 60_000;

function headers(key: string, prefer = "return=representation") {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: prefer,
  };
}

function fromHttp(row: Record<string, unknown>): OpportunityAlertRow {
  return {
    dedupeKey: String(row.dedupe_key ?? ""),
    eventKind: row.event_kind as OpportunityAlertKind,
    opportunityId: String(row.opportunity_id ?? ""),
    status: (row.status as OpportunityAlertStatus) ?? "queued",
    attemptCount: Number(row.attempt_count ?? 0),
    payload: (row.payload as OpportunityAlertPayload) ?? {},
    providerId: (row.provider_id as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    nextAttemptAt: (row.next_attempt_at as string | null) ?? null,
    createdAt: (row.created_at as string | null) ?? null,
    leaseToken: typeof row.lease_token === "string" ? row.lease_token : null,
  };
}

export function createHttpOpportunityAlertOutbox(
  url: string,
  key: string,
): OpportunityAlertStore {
  const base = `${url}/rest/v1/opportunity_notification_outbox`;
  const kinds = `(${NEW_VISITOR_KIND},${UNFINISHED_KIND})`;
  return {
    async listDue(now, limit) {
      const due = encodeURIComponent(now.toISOString());
      const res = await fetch(
        `${base}?event_kind=in.${kinds}&status=in.(queued,failed)` +
          `&or=(next_attempt_at.is.null,next_attempt_at.lte.${due})` +
          `&select=*&order=created_at.asc&limit=${limit}`,
        { headers: headers(key) },
      );
      if (!res.ok) throw new Error(`alert outbox read failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      return rows.map(fromHttp);
    },
    /**
     * DO NOT REUSE `claim_opportunity_follow_up` HERE.
     *
     * It looked safe - it keys only on dedupe_key and has no event_kind filter
     * on the claim itself - but reading it to the end (2026-09-04) shows the
     * branch our kinds fall into does this:
     *
     *     update ... set status = 'dead_letter',
     *                   error  = 'superseded_by_complete_lead'
     *      where opportunity_id = target.opportunity_id
     *        and event_kind = 'partial_follow_up_requested'
     *        and status in ('queued','failed');
     *
     * It assumes any non-partial claimant is the COMPLETE lead email, so
     * claiming a `new_visitor` alert would kill a pending partial-lead email
     * for the same opportunity - destroying a real notification G should have
     * received. It would also dead-letter OUR row whenever a partial was
     * already sending.
     *
     * So this claims with a plain conditional update instead: one statement,
     * no sibling side effects, and Postgres row locking makes it atomic - a
     * second run finds the row already `sending` and matches nothing. A lease
     * that has expired is reclaimable, so a crashed run cannot strand a row.
     */
    async claim(dedupeKey, now) {
      const leaseToken = randomUUID();
      const expired = encodeURIComponent(now.toISOString());
      const res = await fetch(
        `${base}?dedupe_key=eq.${encodeURIComponent(dedupeKey)}` +
          `&or=(status.in.(queued,failed),and(status.eq.sending,lease_expires_at.lt.${expired}))` +
          `&select=*`,
        {
          method: "PATCH",
          headers: headers(key),
          body: JSON.stringify({
            status: "sending",
            error: null,
            lease_token: leaseToken,
            lease_expires_at: new Date(now.getTime() + ALERT_LEASE_MS).toISOString(),
          }),
        },
      );
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`alert claim failed ${res.status}: ${detail.slice(0, 160)}`);
      }
      const rows = (await res.json()) as Record<string, unknown>[];
      return rows[0] ? fromHttp(rows[0]) : null;
    },
    async markSent(dedupeKey, leaseToken, providerId, now) {
      await patch(base, key, dedupeKey, leaseToken, {
        status: "sent",
        provider_id: providerId,
        error: null,
        next_attempt_at: null,
        sent_at: now.toISOString(),
        lease_token: null,
        lease_expires_at: null,
      });
    },
    async markFailed(dedupeKey, leaseToken, error, nextAttemptAt, attemptCount, now) {
      await patch(base, key, dedupeKey, leaseToken, {
        status: "failed",
        error: error.slice(0, 400),
        attempt_count: attemptCount,
        next_attempt_at: nextAttemptAt,
        updated_at: now.toISOString(),
        lease_token: null,
        lease_expires_at: null,
      });
    },
    async markDeadLetter(dedupeKey, leaseToken, reason, now) {
      await patch(base, key, dedupeKey, leaseToken, {
        status: "dead_letter",
        error: reason.slice(0, 400),
        next_attempt_at: null,
        updated_at: now.toISOString(),
        lease_token: null,
        lease_expires_at: null,
      });
    },
  };
}

async function patch(
  base: string,
  key: string,
  dedupeKey: string,
  leaseToken: string | null,
  body: Record<string, unknown>,
): Promise<void> {
  // Scoped to the claim we hold: status must still be `sending` and the lease
  // token must match. A run whose lease expired writes nothing rather than
  // clobbering whoever picked the row up next.
  const lease = leaseToken
    ? `&status=eq.sending&lease_token=eq.${encodeURIComponent(leaseToken)}`
    : "";
  const res = await fetch(
    `${base}?dedupe_key=eq.${encodeURIComponent(dedupeKey)}${lease}`,
    { method: "PATCH", headers: headers(key, "return=minimal"), body: JSON.stringify(body) },
  );
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`alert outbox write failed ${res.status}: ${detail.slice(0, 160)}`);
  }
}

// ---------------------------------------------------------------------------
// Delivery. Painted with the shared aiASAP email theme, so these look like
// every other message from 6 - including his face, which G asked for on ALL
// email on 2026-09-04.
// ---------------------------------------------------------------------------

export function createResendOpportunityAlertTransport(): OpportunityAlertTransport {
  return {
    async send({ idempotencyKey, kind, payload }) {
      const to = process.env.AIASAP_FOUNDER_REPORT_EMAIL;
      if (!to) throw new Error("no recipient");
      if (process.env.TEAM_EMAILS_ENABLED === "false") {
        throw new Error("TEAM_EMAILS_ENABLED=false");
      }
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) throw new Error("RESEND_API_KEY not set");

      const isNew = kind === NEW_VISITOR_KIND;
      const subject = isNew
        ? "aiASAP: someone is on the site"
        : "aiASAP: someone left without giving contact details";
      const heading = isNew
        ? "Someone is on the site."
        : "Someone left without leaving contact details.";

      const rows: Array<[string, string | null | undefined]> = isNew
        ? [
            ["Arrived", payload.arrivalTime ?? null],
            ["On", payload.deviceClass ?? null],
            ["Came from", payload.referrer ?? "typed the address or a direct link"],
          ]
        : [
            ["How it ended", payload.reason ?? null],
            ["Where they got to", payload.discoveryStage ?? null],
            ["Contact", payload.contactStatus ?? null],
            ["What they wanted", payload.buildSummary ?? payload.valueSummary ?? null],
            ["Next", payload.nextAction ?? null],
          ];

      const bodyHtml = [
        emailParagraph(
          isNew
            ? "6 is talking to somebody right now. Nothing has been captured yet."
            : "They got far enough to be worth knowing about, but no contact details were captured.",
        ),
        emailRows(rows),
        emailDivider(),
        emailFine(
          "Sent once per visitor. If this is you testing, the filter did not recognise your device - tell Claude and it can be tightened.",
        ),
      ].join("");

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          from: process.env.AIASAP_REPORTS_FROM ?? "6 from aiASAP <Reports@aiasap.ai>",
          to: [to],
          subject,
          html: emailShell({ title: subject, heading, align: "left", bodyHtml }),
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`resend failed ${res.status}: ${detail.slice(0, 160)}`);
      }
      const json = (await res.json()) as { id?: string };
      if (!json.id) throw new Error("resend returned no id");
      return { providerId: json.id };
    },
  };
}
