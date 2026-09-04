/**
 * aiASAP visitor confirmation receipt.
 *
 * Sent to the VISITOR (not the founder/team) after they explicitly confirmed
 * both their contact value AND the exact-package send consent — the two beats
 * that gate submit_contact. This is a DIFFERENT durable event from the
 * founder/team follow-up: it has its own event_kind, its own dedupe key, its
 * own provider idempotency key, and its own outbox row lifecycle. Neither
 * event can duplicate or substitute for the other, and a retry of one cannot
 * double-fire the other.
 *
 * For phone-only leads, we have no address to email. The row records the
 * no-email disposition explicitly (dead_letter, error `visitor_email_missing`)
 * and never contacts a provider. It is NOT reported as sent.
 *
 * aiASAP-branded via emailTheme. No sister-brand copy is ever mixed in.
 */
import { createHash, randomUUID } from "node:crypto";
import { sendPurposeEmail } from "./emailSenders";
import {
  emailShell,
  emailParagraph,
  emailFine,
  emailDivider,
  escapeHtml,
} from "./emailTheme";
import {
  FALLBACK_TOPIC,
  capitalizeProperNames,
  formatDisplayName,
  sanitizeProjectSummary,
  sanitizeSubjectFragment,
} from "./emails/leadTopicSelection";
import type { VisitorMediaSummary } from "./emails/leadMediaManifest";

export const VISITOR_CONFIRMATION_KIND = "visitor_confirmation" as const;
export const VISITOR_RECEIPT_SEND_LEASE_MS = 5 * 60 * 1000;

export type VisitorReceiptStatus =
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "dead_letter";

export type VisitorReceiptPayload = {
  sessionReviewRef: string;
  contactMethod: "email" | "phone";
  contactValue: string;
  fullName: string | null;
  sessionId: string;
  /**
   * Substantive topic sanitized by the shared topic layer, captured at
   * insert time so a retry renders the same labeled `Subject:` line the
   * visitor would have seen at t=0. Optional so historical rows queued
   * before this field existed still drain with the honest fallback.
   */
  sanitizedTopic?: string | null;
  projectSummary?: string | null;
  projectDetails?: string[] | null;
  /**
   * Visitor-safe media summary: counts and types only, never storage paths
   * or signed URLs. If null, we omit the media confirmation line entirely.
   */
  mediaSummary?: VisitorMediaSummary | null;
  readbackConfirmedAt?: string | null;
  followUpAuthorizedAt?: string | null;
};

export type VisitorReceiptRow = {
  id: string;
  opportunityId: string;
  dedupeKey: string;
  payload: VisitorReceiptPayload;
  status: VisitorReceiptStatus;
  attemptCount: number;
  providerId: string | null;
  error: string | null;
  nextAttemptAt: string | null;
  sentAt: string | null;
  updatedAt: string;
  leaseToken: string | null;
  leaseExpiresAt: string | null;
};

export type VisitorReceiptDelivery = {
  status: VisitorReceiptStatus;
  providerId: string | null;
  error: string | null;
  nextAttemptAt: string | null;
  duplicate: boolean;
  emailAttempted: boolean;
};

export type VisitorReceiptTransport = {
  send(args: {
    dedupeKey: string;
    idempotencyKey: string;
    payload: VisitorReceiptPayload;
  }): Promise<{ providerId: string }>;
};

export type VisitorReceiptOutboxStore = {
  insertIgnoreDuplicate(row: {
    opportunityId: string;
    dedupeKey: string;
    payload: VisitorReceiptPayload;
  }): Promise<VisitorReceiptRow>;
  getByDedupe(dedupeKey: string): Promise<VisitorReceiptRow | null>;
  claim(dedupeKey: string, now: Date): Promise<VisitorReceiptRow | null>;
  markSent(id: string, leaseToken: string, providerId: string, now: Date): Promise<VisitorReceiptRow>;
  markFailed(id: string, leaseToken: string, error: string, nextAttemptAt: string, now: Date): Promise<VisitorReceiptRow>;
  markDeadLetter(id: string, error: string, now: Date): Promise<VisitorReceiptRow>;
  listDue(now: Date): Promise<VisitorReceiptRow[]>;
};

export function visitorConfirmationDedupeKey(
  opportunityId: string,
  method: "email" | "phone",
  value: string,
): string {
  const normalized = method === "email" ? value.trim().toLowerCase() : value.replace(/\D/g, "");
  const digest = createHash("sha256")
    .update(`${opportunityId}\0${method}\0${normalized}`)
    .digest("hex");
  return `${VISITOR_CONFIRMATION_KIND}:${digest}`;
}

export function visitorConfirmationIdempotencyKey(
  opportunityId: string,
  method: "email" | "phone",
  value: string,
): string {
  return `visitor:${visitorConfirmationDedupeKey(opportunityId, method, value)}`;
}

export function visitorReceiptRetryAt(now: Date, minutes = 15): string {
  return new Date(now.getTime() + minutes * 60 * 1000).toISOString();
}

function isDue(row: VisitorReceiptRow, now: Date): boolean {
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

export function createMemoryVisitorReceiptOutbox(): VisitorReceiptOutboxStore {
  const rows = new Map<string, VisitorReceiptRow>();
  let n = 0;
  const save = (row: VisitorReceiptRow) => {
    rows.set(row.dedupeKey, { ...row });
    return rows.get(row.dedupeKey)!;
  };
  return {
    async insertIgnoreDuplicate(input) {
      const existing = rows.get(input.dedupeKey);
      if (existing) return { ...existing };
      return save({
        id: `mem-visitor-${++n}`,
        opportunityId: input.opportunityId,
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
        leaseExpiresAt: new Date(now.getTime() + VISITOR_RECEIPT_SEND_LEASE_MS).toISOString(),
      });
    },
    async markSent(id, leaseToken, providerId, now) {
      const found = [...rows.values()].find((r) => r.id === id);
      if (!found) throw new Error("visitor outbox row missing");
      if (found.status !== "sending" || found.leaseToken !== leaseToken) {
        throw new Error("visitor outbox claim lost before markSent");
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
      if (!found) throw new Error("visitor outbox row missing");
      if (found.status !== "sending" || found.leaseToken !== leaseToken) {
        throw new Error("visitor outbox claim lost before markFailed");
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
    async markDeadLetter(id, error, now) {
      const found = [...rows.values()].find((r) => r.id === id);
      if (!found) throw new Error("visitor outbox row missing");
      return save({
        ...found,
        status: "dead_letter",
        error,
        nextAttemptAt: null,
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

function fromHttp(row: Record<string, unknown>): VisitorReceiptRow {
  const payload = (row.payload ?? {}) as VisitorReceiptPayload;
  return {
    id: String(row.id),
    opportunityId: String(row.opportunity_id),
    dedupeKey: String(row.dedupe_key),
    payload,
    status: row.status as VisitorReceiptStatus,
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

export function createHttpVisitorReceiptOutbox(url: string, key: string): VisitorReceiptOutboxStore {
  const base = `${url}/rest/v1/opportunity_notification_outbox`;
  return {
    async insertIgnoreDuplicate(input) {
      const res = await fetch(`${base}?on_conflict=dedupe_key&select=*`, {
        method: "POST",
        headers: h(key, "resolution=ignore-duplicates,return=representation"),
        body: JSON.stringify({
          opportunity_id: input.opportunityId,
          event_kind: VISITOR_CONFIRMATION_KIND,
          dedupe_key: input.dedupeKey,
          payload: input.payload,
          status: "queued",
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`visitor outbox insert failed ${res.status}: ${detail.slice(0, 200)}`);
      }
      const rows = (await res.json()) as Record<string, unknown>[];
      if (rows[0]) return fromHttp(rows[0]);
      const existing = await this.getByDedupe(input.dedupeKey);
      if (!existing) throw new Error("visitor outbox row missing after duplicate insert");
      return existing;
    },
    async getByDedupe(dedupeKey) {
      const res = await fetch(
        `${base}?dedupe_key=eq.${encodeURIComponent(dedupeKey)}&select=*&limit=1`,
        { headers: h(key) },
      );
      if (!res.ok) throw new Error(`visitor outbox read failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      return rows[0] ? fromHttp(rows[0]) : null;
    },
    // Race-tolerant CAS: only the row that still matches (queued|failed with
    // due next_attempt_at, OR sending with an expired lease) is updated. If
    // the WHERE clause doesn't match, PATCH returns []. The visitor event has
    // no cross-kind arbitration, so a simple status/lease CAS is enough.
    async claim(dedupeKey, now) {
      const leaseToken = randomUUID();
      const iso = now.toISOString();
      const leaseExpires = new Date(now.getTime() + VISITOR_RECEIPT_SEND_LEASE_MS).toISOString();
      const filter =
        `dedupe_key=eq.${encodeURIComponent(dedupeKey)}` +
        `&event_kind=eq.${VISITOR_CONFIRMATION_KIND}` +
        `&or=(and(status.in.(queued,failed),or(next_attempt_at.is.null,next_attempt_at.lte.${encodeURIComponent(iso)}))` +
        `,and(status.eq.sending,lease_expires_at.lte.${encodeURIComponent(iso)}))`;
      const res = await fetch(`${base}?${filter}&select=*`, {
        method: "PATCH",
        headers: h(key),
        body: JSON.stringify({
          status: "sending",
          attempt_count: undefined,
          error: null,
          lease_token: leaseToken,
          lease_expires_at: leaseExpires,
        }),
      });
      if (!res.ok) throw new Error(`visitor outbox claim failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      if (!rows[0]) return null;
      const claimed = fromHttp(rows[0]);
      // Increment attempt_count separately since PostgREST cannot express
      // column = column + 1 in a JSON PATCH body.
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
      if (!res.ok) throw new Error(`visitor outbox markSent failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      if (!rows[0]) throw new Error("visitor outbox claim lost before markSent");
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
      if (!res.ok) throw new Error(`visitor outbox markFailed failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      if (!rows[0]) throw new Error("visitor outbox claim lost before markFailed");
      return fromHttp(rows[0]);
    },
    async markDeadLetter(id, error, now) {
      const res = await fetch(
        `${base}?id=eq.${encodeURIComponent(id)}&select=*`,
        {
          method: "PATCH",
          headers: h(key),
          body: JSON.stringify({
            status: "dead_letter",
            error: error.slice(0, 300),
            next_attempt_at: null,
            lease_token: null,
            lease_expires_at: null,
            updated_at: now.toISOString(),
          }),
        },
      );
      if (!res.ok) throw new Error(`visitor outbox markDeadLetter failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      if (!rows[0]) throw new Error("visitor outbox dead-letter target missing");
      return fromHttp(rows[0]);
    },
    async listDue(now) {
      const iso = now.toISOString();
      const res = await fetch(
        `${base}?event_kind=eq.${VISITOR_CONFIRMATION_KIND}` +
          `&status=in.(queued,failed,sending)` +
          `&or=(next_attempt_at.is.null,next_attempt_at.lte.${encodeURIComponent(iso)})` +
          `&select=*&order=created_at.asc&limit=10`,
        { headers: h(key) },
      );
      if (!res.ok) throw new Error(`visitor outbox listDue failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      return rows.map(fromHttp).filter((row) => isDue(row, now));
    },
  };
}

function displayTopic(payload: VisitorReceiptPayload): string {
  const raw = payload.sanitizedTopic?.trim() || FALLBACK_TOPIC;
  return sanitizeSubjectFragment(raw);
}

function mediaSummaryLine(summary: VisitorMediaSummary | null | undefined): string | null {
  if (!summary || summary.totalCount <= 0) return null;
  const parts: string[] = [];
  if (summary.imageCount) parts.push(`${summary.imageCount} photo${summary.imageCount === 1 ? "" : "s"}`);
  if (summary.videoCount) parts.push(`${summary.videoCount} video${summary.videoCount === 1 ? "" : "s"}`);
  if (summary.documentCount) parts.push(`${summary.documentCount} document${summary.documentCount === 1 ? "" : "s"}`);
  return `We also received ${parts.join(" and ")}. They are safely stored for the aiASAP team.`;
}

export function buildVisitorReceiptText(payload: VisitorReceiptPayload): string {
  const name = capitalizeProperNames(formatDisplayName(payload.fullName) ?? "there");
  const topic = displayTopic(payload);
  const mediaLine = mediaSummaryLine(payload.mediaSummary);
  const lines: string[] = [
    `Hi ${name},`,
    "",
    "This is 6 from aiASAP. We received your details.",
    "",
    `Subject: ${topic}`,
    "",
    `Important details: ${sanitizeProjectSummary(payload.projectSummary?.trim() || topic)}`,
    "",
    "The aiASAP team will review the details of your conversation and follow up by email.",
  ];
  if (mediaLine) {
    lines.push("", mediaLine);
  }
  lines.push(
    "",
    "You can reply to this email to reach the aiASAP team directly.",
    "",
    "— 6, at aiASAP.ai",
  );
  return lines.join("\n");
}

export function buildVisitorReceiptHtml(payload: VisitorReceiptPayload): string {
  const name = capitalizeProperNames(formatDisplayName(payload.fullName) ?? "there");
  const topic = displayTopic(payload);
  const mediaLine = mediaSummaryLine(payload.mediaSummary);
  const bodyParts: string[] = [
    emailParagraph("This is 6 from aiASAP. We received your details."),
    emailParagraph(`<strong>Subject:</strong> ${escapeHtml(topic)}`),
    emailParagraph(`<strong>Important details:</strong> ${escapeHtml(sanitizeProjectSummary(payload.projectSummary?.trim() || topic))}`),
    emailParagraph(
      "The aiASAP team will review the details of your conversation and follow up by email.",
    ),
  ];
  if (mediaLine) {
    bodyParts.push(emailParagraph(escapeHtml(mediaLine)));
  }
  bodyParts.push(
    emailParagraph(
      "You can reply to this email to reach the aiASAP team directly.",
    ),
    emailDivider(),
    emailFine(
      "You are getting this because you asked us to reach out during a live conversation with 6 at aiASAP.ai. If that was not you, ignore this note and no one will contact you.",
    ),
  );
  return emailShell({
    title: "aiASAP: we got your details",
    heading: `We got it, ${escapeHtml(name)}.`,
    showSix: true,
    align: "center",
    bodyHtml: bodyParts.join(""),
  });
}

export function createResendVisitorReceiptTransport(): VisitorReceiptTransport {
  return {
    async send({ idempotencyKey, payload }) {
      if (payload.contactMethod !== "email") {
        throw new Error("visitor_email_missing");
      }
      const to = payload.contactValue.trim();
      if (!to) throw new Error("visitor_email_missing");
      if (process.env.VISITOR_EMAILS_ENABLED === "false") throw new Error("VISITOR_EMAILS_ENABLED=false");
      // Visitor Reply-To is the aiASAP TEAM address, never the visitor's own
      // address (would send them to themselves), never a sister-brand address
      // (wrong brand), and never the outbound hello@ sender (nobody reads
      // that mailbox). Founder mail does NOT set replyTo — proven at the
      // callsite in createResendFollowUpTransport.
      const replyTo = process.env.AIASAP_TEAM_REPLY_TO_EMAIL
        || process.env.AIASAP_FOUNDER_REPORT_EMAIL
        || undefined;
      const topic = displayTopic(payload);
      const res = await sendPurposeEmail({
        purpose: "visitor",
        to,
        subject: `aiASAP: we got your details — ${topic}`,
        text: buildVisitorReceiptText(payload),
        html: buildVisitorReceiptHtml(payload),
        idempotencyKey,
        replyTo,
      });
      if (!res.ok) throw new Error(res.error ?? "resend failed");
      const providerId = res.id?.trim();
      if (!providerId) throw new Error("resend accepted without id");
      return { providerId };
    },
  };
}

// Rows for phone-only leads are recorded as a durable no-email disposition
// (dead_letter with a stable error string) and NEVER contact a provider. This
// is not a "sent" outcome and must not be reported as one.
export async function drainVisitorReceiptRow(
  store: VisitorReceiptOutboxStore,
  transport: VisitorReceiptTransport,
  dedupeKey: string,
  now: Date,
): Promise<VisitorReceiptDelivery> {
  const existing = await store.getByDedupe(dedupeKey);
  if (!existing) {
    return {
      status: "failed",
      providerId: null,
      error: "visitor outbox row missing",
      nextAttemptAt: visitorReceiptRetryAt(now),
      duplicate: false,
      emailAttempted: false,
    };
  }
  if (existing.status === "sent") {
    return {
      status: "sent",
      providerId: existing.providerId,
      error: null,
      nextAttemptAt: null,
      duplicate: true,
      emailAttempted: true,
    };
  }
  if (existing.status === "dead_letter") {
    return {
      status: "dead_letter",
      providerId: null,
      error: existing.error,
      nextAttemptAt: null,
      duplicate: true,
      emailAttempted: false,
    };
  }
  if (existing.payload.contactMethod !== "email") {
    const dead = await store.markDeadLetter(existing.id, "visitor_email_missing", now);
    return {
      status: "dead_letter",
      providerId: null,
      error: dead.error,
      nextAttemptAt: null,
      duplicate: false,
      emailAttempted: false,
    };
  }
  const claimed = await store.claim(dedupeKey, now);
  if (!claimed) {
    const latest = await store.getByDedupe(dedupeKey);
    if (latest?.status === "sent") {
      return {
        status: "sent",
        providerId: latest.providerId,
        error: null,
        nextAttemptAt: null,
        duplicate: true,
        emailAttempted: true,
      };
    }
    return {
      status: latest?.status ?? "failed",
      providerId: latest?.providerId ?? null,
      error: latest?.error ?? "not due",
      nextAttemptAt: latest?.nextAttemptAt ?? null,
      duplicate: false,
      emailAttempted: false,
    };
  }
  try {
    const sent = await transport.send({
      dedupeKey,
      idempotencyKey: visitorConfirmationIdempotencyKey(
        claimed.opportunityId,
        claimed.payload.contactMethod,
        claimed.payload.contactValue,
      ),
      payload: claimed.payload,
    });
    try {
      const stored = await store.markSent(claimed.id, claimed.leaseToken!, sent.providerId, now);
      return {
        status: "sent",
        providerId: stored.providerId,
        error: null,
        nextAttemptAt: null,
        duplicate: false,
        emailAttempted: true,
      };
    } catch (persistError) {
      const latest = await store.getByDedupe(dedupeKey).catch(() => null);
      if (latest?.status === "sent") {
        return {
          status: "sent",
          providerId: latest.providerId,
          error: null,
          nextAttemptAt: null,
          duplicate: true,
          emailAttempted: true,
        };
      }
      return {
        status: latest?.status ?? "sending",
        providerId: latest?.providerId ?? sent.providerId,
        error: persistError instanceof Error ? persistError.message : String(persistError),
        nextAttemptAt: latest?.nextAttemptAt ?? new Date(
          now.getTime() + VISITOR_RECEIPT_SEND_LEASE_MS,
        ).toISOString(),
        duplicate: false,
        emailAttempted: true,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "visitor transport failed";
    try {
      const stored = await store.markFailed(
        claimed.id,
        claimed.leaseToken!,
        message,
        visitorReceiptRetryAt(now),
        now,
      );
      return {
        status: "failed",
        providerId: stored.providerId,
        error: stored.error,
        nextAttemptAt: stored.nextAttemptAt,
        duplicate: false,
        emailAttempted: true,
      };
    } catch (persistError) {
      const latest = await store.getByDedupe(dedupeKey).catch(() => null);
      if (latest?.status === "sent") {
        return {
          status: "sent",
          providerId: latest.providerId,
          error: null,
          nextAttemptAt: null,
          duplicate: true,
          emailAttempted: true,
        };
      }
      const persistMessage = persistError instanceof Error ? persistError.message : String(persistError);
      return {
        status: latest?.status ?? "sending",
        providerId: latest?.providerId ?? null,
        error: `${message}; could not persist failure: ${persistMessage}`.slice(0, 300),
        nextAttemptAt: latest?.nextAttemptAt ?? new Date(
          now.getTime() + VISITOR_RECEIPT_SEND_LEASE_MS,
        ).toISOString(),
        duplicate: false,
        emailAttempted: true,
      };
    }
  }
}

export async function deliverVisitorConfirmation(args: {
  store: VisitorReceiptOutboxStore;
  transport: VisitorReceiptTransport;
  opportunityId: string;
  sessionId: string;
  method: "email" | "phone";
  value: string;
  fullName?: string | null;
  operatorExcluded?: boolean;
  now?: Date;
  sanitizedTopic?: string | null;
  projectSummary?: string | null;
  projectDetails?: string[] | null;
  mediaSummary?: VisitorMediaSummary | null;
  readbackConfirmedAt?: string | null;
  followUpAuthorizedAt?: string | null;
}): Promise<VisitorReceiptDelivery> {
  const now = args.now ?? new Date();
  if (args.operatorExcluded) {
    return {
      status: "failed",
      providerId: null,
      error: "operator_excluded",
      nextAttemptAt: null,
      duplicate: false,
      emailAttempted: false,
    };
  }
  const dedupeKey = visitorConfirmationDedupeKey(args.opportunityId, args.method, args.value);
  try {
    await args.store.insertIgnoreDuplicate({
      opportunityId: args.opportunityId,
      dedupeKey,
      payload: {
        sessionReviewRef: `/admin/sessions/${encodeURIComponent(args.sessionId)}`,
        contactMethod: args.method,
        contactValue: args.value.trim().slice(0, 254),
        fullName: args.fullName?.trim().slice(0, 200) || null,
        sessionId: args.sessionId,
        sanitizedTopic: args.sanitizedTopic?.slice(0, 200) ?? null,
        projectSummary: args.projectSummary?.slice(0, 500) ?? null,
        projectDetails: args.projectDetails?.slice(0, 5).map((detail) => detail.slice(0, 180)) ?? null,
        mediaSummary: args.mediaSummary ?? null,
        readbackConfirmedAt: args.readbackConfirmedAt ?? null,
        followUpAuthorizedAt: args.followUpAuthorizedAt ?? null,
      },
    });
  } catch (error) {
    return {
      status: "failed",
      providerId: null,
      error: error instanceof Error ? error.message.slice(0, 300) : "visitor outbox insert failed",
      nextAttemptAt: null,
      duplicate: false,
      emailAttempted: false,
    };
  }
  return drainVisitorReceiptRow(args.store, args.transport, dedupeKey, now);
}

export async function drainDueVisitorReceipts(args: {
  store: VisitorReceiptOutboxStore;
  transport: VisitorReceiptTransport;
  now?: Date;
}): Promise<VisitorReceiptDelivery[]> {
  const now = args.now ?? new Date();
  const due = await args.store.listDue(now);
  const results: VisitorReceiptDelivery[] = [];
  for (const row of due) results.push(await drainVisitorReceiptRow(args.store, args.transport, row.dedupeKey, now));
  return results;
}
