/**
 * Durable founder follow-up after an explicitly confirmed contact save.
 * Queue insertion is not delivery. Await a drain. Persist sent+provider id
 * or failed+error+next-attempt. Contact persist is a separate fact.
 */
import { buildTeamNotifyHtml, buildTeamNotifyText } from "./teamNotify";
import { sendPurposeEmail } from "./emailSenders";
import { createHash, randomUUID } from "node:crypto";
import {
  FALLBACK_TOPIC,
  capitalizeProperNames,
  formatDisplayName,
  sanitizeProjectSummary,
  sanitizeSubjectFragment,
} from "./emails/leadTopicSelection";
import type { MediaLink } from "./emails/leadMediaManifest";

export const FOLLOW_UP_KIND = "follow_up_requested" as const;
export const PARTIAL_FOLLOW_UP_KIND = "partial_follow_up_requested" as const;
export const PARTIAL_FOLLOW_UP_DELAY_MS = 10 * 60 * 1000;
export const FOLLOW_UP_SEND_LEASE_MS = 5 * 60 * 1000;

export type FollowUpEventKind = typeof FOLLOW_UP_KIND | typeof PARTIAL_FOLLOW_UP_KIND;
export type FollowUpStatus = "queued" | "sending" | "sent" | "failed" | "dead_letter";

export type FollowUpPayload = {
  opportunityId?: string | null;
  sessionReviewRef?: string;
  contactMethod: "email" | "phone";
  contactValue: string;
  fullName: string | null;
  sessionId: string;
  transcriptEvidenceRef?: string;
  /**
   * Immutable sanitized topic + sanitized display name + owner media manifest,
   * captured at insert time so a retry N minutes later renders the SAME email
   * body a human would have seen at t=0. Optional so historical rows (queued
   * before this field existed) still drain cleanly with a safe fallback.
   */
  sanitizedTopic?: string | null;
  projectSummary?: string | null;
  projectDetails?: string[] | null;
  sanitizedName?: string | null;
  ownerMediaLinks?: MediaLink[] | null;
  mediaSigningFailed?: boolean;
  readbackConfirmedAt?: string | null;
  followUpAuthorizedAt?: string | null;
};

export type FollowUpOutboxRow = {
  id: string;
  opportunityId: string;
  eventKind: FollowUpEventKind;
  dedupeKey: string;
  payload: FollowUpPayload;
  status: FollowUpStatus;
  attemptCount: number;
  providerId: string | null;
  error: string | null;
  nextAttemptAt: string | null;
  sentAt: string | null;
  updatedAt: string;
  leaseToken: string | null;
  leaseExpiresAt: string | null;
};

export type FollowUpDelivery = {
  status: FollowUpStatus;
  providerId: string | null;
  error: string | null;
  nextAttemptAt: string | null;
  duplicate: boolean;
};

export type FollowUpTransport = {
  send(args: {
    dedupeKey: string;
    idempotencyKey: string;
    payload: FollowUpPayload;
  }): Promise<{ providerId: string }>;
};

export type FollowUpOutboxStore = {
  insertIgnoreDuplicate(row: {
    opportunityId: string;
    eventKind: FollowUpEventKind;
    dedupeKey: string;
    payload: FollowUpPayload;
    deferUntil?: string | null;
  }): Promise<FollowUpOutboxRow>;
  getByDedupe(dedupeKey: string): Promise<FollowUpOutboxRow | null>;
  claim(dedupeKey: string, now: Date): Promise<FollowUpOutboxRow | null>;
  markSent(id: string, leaseToken: string, providerId: string, now: Date): Promise<FollowUpOutboxRow>;
  markFailed(id: string, leaseToken: string, error: string, nextAttemptAt: string, now: Date): Promise<FollowUpOutboxRow>;
  refreshPendingPartial(dedupeKey: string, payload: FollowUpPayload, deferUntil: string, now: Date): Promise<FollowUpOutboxRow | null>;
  retirePartial(opportunityId: string, now: Date): Promise<boolean>;
  listDue(now: Date): Promise<FollowUpOutboxRow[]>;
};

export function followUpDedupeKey(
  opportunityId: string,
  method?: "email" | "phone",
  value?: string,
): string {
  if (!method || !value) return `${FOLLOW_UP_KIND}:${opportunityId}`;
  const normalized = method === "email" ? value.trim().toLowerCase() : value.replace(/\D/g, "");
  const digest = createHash("sha256").update(`${opportunityId}\u0000${method}\u0000${normalized}`).digest("hex");
  return `${FOLLOW_UP_KIND}:${digest}`;
}

export function partialFollowUpDedupeKey(opportunityId: string): string {
  return `${PARTIAL_FOLLOW_UP_KIND}:${opportunityId}`;
}

export function followUpIdempotencyKey(
  opportunityId: string,
  method?: "email" | "phone",
  value?: string,
): string {
  return `team:${followUpDedupeKey(opportunityId, method, value)}`;
}

export function partialFollowUpIdempotencyKey(opportunityId: string): string {
  return `team:${partialFollowUpDedupeKey(opportunityId)}`;
}

export function retryAt(now: Date, minutes = 15): string {
  return new Date(now.getTime() + minutes * 60 * 1000).toISOString();
}

export function isDue(row: FollowUpOutboxRow, now: Date): boolean {
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

export function createMemoryFollowUpOutbox(): FollowUpOutboxStore {
  const rows = new Map<string, FollowUpOutboxRow>();
  let n = 0;
  const save = (row: FollowUpOutboxRow) => {
    rows.set(row.dedupeKey, { ...row });
    return rows.get(row.dedupeKey)!;
  };
  return {
    async insertIgnoreDuplicate(input) {
      const existing = rows.get(input.dedupeKey);
      if (existing) return { ...existing };
      return save({
        id: `mem-${++n}`,
        opportunityId: input.opportunityId,
        eventKind: input.eventKind,
        dedupeKey: input.dedupeKey,
        payload: input.payload,
        status: "queued",
        attemptCount: 0,
        providerId: null,
        error: null,
        nextAttemptAt: input.deferUntil ?? null,
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
      const siblings = [...rows.values()].filter((candidate) => candidate.opportunityId === row.opportunityId);
      if (row.eventKind === PARTIAL_FOLLOW_UP_KIND) {
        const completeExists = siblings.some((candidate) => candidate.eventKind === FOLLOW_UP_KIND && candidate.status !== "dead_letter");
        if (completeExists) {
          save({ ...row, status: "dead_letter", error: "superseded_by_complete_lead", nextAttemptAt: null, updatedAt: now.toISOString() });
          return null;
        }
      } else {
        const partialInFlightOrSent = siblings.some((candidate) => candidate.eventKind === PARTIAL_FOLLOW_UP_KIND && ["sending", "sent"].includes(candidate.status));
        if (partialInFlightOrSent) {
          save({ ...row, status: "dead_letter", error: "partial_delivery_already_claimed", nextAttemptAt: null, updatedAt: now.toISOString() });
          return null;
        }
        for (const partial of siblings.filter((candidate) => candidate.eventKind === PARTIAL_FOLLOW_UP_KIND && ["queued", "failed"].includes(candidate.status))) {
          save({ ...partial, status: "dead_letter", error: "superseded_by_complete_lead", nextAttemptAt: null, updatedAt: now.toISOString() });
        }
      }
      return save({
        ...row,
        status: "sending",
        attemptCount: row.attemptCount + 1,
        error: null,
        updatedAt: now.toISOString(),
        leaseToken: randomUUID(),
        leaseExpiresAt: new Date(now.getTime() + FOLLOW_UP_SEND_LEASE_MS).toISOString(),
      });
    },
    async markSent(id, leaseToken, providerId, now) {
      const found = [...rows.values()].find((r) => r.id === id);
      if (!found) throw new Error("outbox row missing");
      if (found.status !== "sending" || found.leaseToken !== leaseToken) {
        throw new Error("outbox claim lost before markSent");
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
      if (!found) throw new Error("outbox row missing");
      if (found.status !== "sending" || found.leaseToken !== leaseToken) {
        throw new Error("outbox claim lost before markFailed");
      }
      return save({
        ...found,
        status: "failed",
        error,
        nextAttemptAt,
        providerId: found.providerId,
        updatedAt: now.toISOString(),
        leaseToken: null,
        leaseExpiresAt: null,
      });
    },
    async refreshPendingPartial(dedupeKey, payload, deferUntil, now) {
      const found = rows.get(dedupeKey);
      if (!found || found.eventKind !== PARTIAL_FOLLOW_UP_KIND || !["queued", "failed"].includes(found.status)) return null;
      return save({
        ...found,
        payload,
        status: "queued",
        error: null,
        nextAttemptAt: deferUntil,
        updatedAt: now.toISOString(),
        leaseToken: null,
        leaseExpiresAt: null,
      });
    },
    async retirePartial(opportunityId, now) {
      const key = partialFollowUpDedupeKey(opportunityId);
      const found = rows.get(key);
      if (!found || found.status === "sent" || found.status === "dead_letter") return false;
      save({ ...found, status: "dead_letter", error: "superseded_by_complete_lead", nextAttemptAt: null, leaseToken: null, leaseExpiresAt: null, updatedAt: now.toISOString() });
      return true;
    },
    async listDue(now) {
      return [...rows.values()].filter((r) => isDue(r, now)).map((r) => ({ ...r }));
    },
  };
}

function headers(key: string, prefer = "return=representation") {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: prefer,
  };
}

function fromHttp(row: Record<string, unknown>): FollowUpOutboxRow {
  const payload = (row.payload ?? {}) as FollowUpPayload;
  return {
    id: String(row.id),
    opportunityId: String(row.opportunity_id),
    eventKind: row.event_kind === PARTIAL_FOLLOW_UP_KIND ? PARTIAL_FOLLOW_UP_KIND : FOLLOW_UP_KIND,
    dedupeKey: String(row.dedupe_key),
    payload,
    status: row.status as FollowUpStatus,
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

export function createHttpFollowUpOutbox(url: string, key: string): FollowUpOutboxStore {
  const base = `${url}/rest/v1/opportunity_notification_outbox`;
  return {
    async insertIgnoreDuplicate(input) {
      const res = await fetch(`${base}?on_conflict=dedupe_key&select=*`, {
        method: "POST",
        headers: headers(key, "resolution=ignore-duplicates,return=representation"),
        body: JSON.stringify({
          opportunity_id: input.opportunityId,
          event_kind: input.eventKind,
          dedupe_key: input.dedupeKey,
          payload: input.payload,
          status: "queued",
          next_attempt_at: input.deferUntil ?? null,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`outbox insert failed ${res.status}: ${detail.slice(0, 200)}`);
      }
      const rows = (await res.json()) as Record<string, unknown>[];
      if (rows[0]) return fromHttp(rows[0]);
      const existing = await this.getByDedupe(input.dedupeKey);
      if (!existing) throw new Error("outbox row missing after duplicate insert");
      return existing;
    },
    async getByDedupe(dedupeKey) {
      const res = await fetch(
        `${base}?dedupe_key=eq.${encodeURIComponent(dedupeKey)}&select=*&limit=1`,
        { headers: headers(key) },
      );
      if (!res.ok) throw new Error(`outbox read failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      return rows[0] ? fromHttp(rows[0]) : null;
    },
    async claim(dedupeKey, now) {
      const leaseToken = randomUUID();
      const res = await fetch(`${url}/rest/v1/rpc/claim_opportunity_follow_up`, {
        method: "POST",
        headers: headers(key),
        body: JSON.stringify({
          p_dedupe_key: dedupeKey,
          p_now: now.toISOString(),
          p_lease_token: leaseToken,
          p_lease_expires_at: new Date(now.getTime() + FOLLOW_UP_SEND_LEASE_MS).toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`outbox claim failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      return rows[0] ? fromHttp(rows[0]) : null;
    },
    async markSent(id, leaseToken, providerId, now) {
      const res = await fetch(`${base}?id=eq.${encodeURIComponent(id)}&status=eq.sending&lease_token=eq.${encodeURIComponent(leaseToken)}&select=*`, {
        method: "PATCH",
        headers: headers(key),
        body: JSON.stringify({
          status: "sent",
          provider_id: providerId,
          error: null,
          next_attempt_at: null,
          sent_at: now.toISOString(),
          lease_token: null,
          lease_expires_at: null,
        }),
      });
      if (!res.ok) throw new Error(`outbox markSent failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      if (!rows[0]) throw new Error("outbox claim lost before markSent");
      return fromHttp(rows[0]);
    },
    async markFailed(id, leaseToken, error, nextAttemptAt) {
      const res = await fetch(`${base}?id=eq.${encodeURIComponent(id)}&status=eq.sending&lease_token=eq.${encodeURIComponent(leaseToken)}&select=*`, {
        method: "PATCH",
        headers: headers(key),
        body: JSON.stringify({
          status: "failed",
          error: error.slice(0, 300),
          next_attempt_at: nextAttemptAt,
          lease_token: null,
          lease_expires_at: null,
        }),
      });
      if (!res.ok) throw new Error(`outbox markFailed failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      if (!rows[0]) throw new Error("outbox claim lost before markFailed");
      return fromHttp(rows[0]);
    },
    async refreshPendingPartial(dedupeKey, payload, deferUntil, now) {
      const partial = await this.getByDedupe(dedupeKey);
      if (!partial || partial.eventKind !== PARTIAL_FOLLOW_UP_KIND || !["queued", "failed"].includes(partial.status)) return null;
      const res = await fetch(`${base}?id=eq.${encodeURIComponent(partial.id)}&event_kind=eq.${PARTIAL_FOLLOW_UP_KIND}&status=in.(queued,failed)&select=*`, {
        method: "PATCH",
        headers: headers(key),
        body: JSON.stringify({
          payload,
          status: "queued",
          error: null,
          next_attempt_at: deferUntil,
          lease_token: null,
          lease_expires_at: null,
          updated_at: now.toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`outbox refresh partial failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      return rows[0] ? fromHttp(rows[0]) : null;
    },
    async retirePartial(opportunityId, now) {
      const partial = await this.getByDedupe(partialFollowUpDedupeKey(opportunityId));
      if (!partial || partial.eventKind !== PARTIAL_FOLLOW_UP_KIND || !["queued", "failed"].includes(partial.status)) return false;
      const res = await fetch(`${base}?id=eq.${encodeURIComponent(partial.id)}&event_kind=eq.${PARTIAL_FOLLOW_UP_KIND}&status=in.(queued,failed)&select=*`, {
        method: "PATCH",
        headers: headers(key),
        body: JSON.stringify({ status: "dead_letter", error: "superseded_by_complete_lead", next_attempt_at: null, lease_token: null, lease_expires_at: null, updated_at: now.toISOString() }),
      });
      if (!res.ok) throw new Error(`outbox retire partial failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      return rows.length > 0;
    },
    async listDue(now) {
      const iso = now.toISOString();
      const res = await fetch(
        `${base}?event_kind=in.(${FOLLOW_UP_KIND},${PARTIAL_FOLLOW_UP_KIND})&status=in.(queued,failed,sending)&or=(next_attempt_at.is.null,next_attempt_at.lte.${encodeURIComponent(iso)})&select=*&order=created_at.asc&limit=10`,
        { headers: headers(key) },
      );
      if (!res.ok) throw new Error(`outbox listDue failed ${res.status}`);
      const rows = (await res.json()) as Record<string, unknown>[];
      return rows.map(fromHttp).filter((row) => isDue(row, now));
    },
  };
}

export function createResendFollowUpTransport(): FollowUpTransport {
  return {
    async send({ idempotencyKey, payload }) {
      const to = process.env.AIASAP_FOUNDER_REPORT_EMAIL;
      if (!to) throw new Error("no recipient");
      if (process.env.TEAM_EMAILS_ENABLED === "false") throw new Error("TEAM_EMAILS_ENABLED=false");
      const sessionReviewRef =
        typeof payload.sessionReviewRef === "string" ? payload.sessionReviewRef : "";
      const isPartial = sessionReviewRef.includes("#partial");
      const formattedName =
        formatDisplayName(payload.sanitizedName) ??
        formatDisplayName(payload.fullName) ??
        null;
      const who = capitalizeProperNames(formattedName ?? payload.contactValue);
      const rawTopic = payload.sanitizedTopic?.trim() || FALLBACK_TOPIC;
      const topic = sanitizeSubjectFragment(rawTopic);
      const projectSummary = sanitizeProjectSummary(payload.projectSummary?.trim() || topic);
      const projectDetails = (payload.projectDetails ?? [])
        .map((detail) => sanitizeSubjectFragment(detail, 180))
        .filter(Boolean)
        .slice(0, 5);
      // Founder subject = name + substantive topic. Never contact-action
      // filler. Partial recovery leads keep the INCOMPLETE prefix so a phone
      // reader can see a not-yet-closed lead at a glance.
      const subject = isPartial
        ? `INCOMPLETE aiASAP lead: ${who} — ${topic}`
        : `aiASAP: ${who} — ${topic}`;
      const facts: Array<[string, string]> = [
        ...(isPartial
          ? [
              [
                "Status",
                "Incomplete abandoned conversation — contact was captured with explicit send consent, but the owner package was not completed",
              ] as [string, string],
            ]
          : []),
        ["Project summary", projectSummary],
        ...(projectDetails.length > 1
          ? [["Project details", projectDetails.map((detail) => `• ${detail}`).join("\n")]] as Array<[string, string]>
          : []),
        ["Contact", `${payload.contactMethod}: ${payload.contactValue}`],
        ["Email permission", "Explicitly granted for this owner-and-visitor email package"],
      ];
      // Legacy/historical rows (queued before ownerMediaLinks shipped) or a
      // partial mock payload may carry malformed link entries. Skip anything
      // that would render as `undefined` in the email — never expose raw
      // storage paths, never emit a broken href.
      const rawLinks = Array.isArray(payload.ownerMediaLinks) ? payload.ownerMediaLinks : [];
      const links = rawLinks.filter(
        (link): link is MediaLink =>
          !!link
          && typeof link.href === "string"
          && link.href.startsWith("http")
          && typeof link.label === "string"
          && link.label.length > 0
          && typeof link.expiresAt === "string"
          && link.expiresAt.length > 0,
      );
      const internalBase = (process.env.AIASAP_ADMIN_BASE_URL || process.env.AIASAP_APP_URL || "https://aiASAP.ai").replace(/\/$/, "");
      const absoluteInternal = (ref: unknown): string => {
        if (typeof ref !== "string" || !ref) return internalBase;
        return ref.startsWith("http") ? ref : `${internalBase}${ref.startsWith("/") ? "" : "/"}${ref}`;
      };
      const transcriptEvidenceRef =
        typeof payload.transcriptEvidenceRef === "string" && payload.transcriptEvidenceRef
          ? payload.transcriptEvidenceRef
          : sessionReviewRef;
      // G 2026-09-05: the file links are gold BUTTONS under the facts, not raw
      // URLs in a row; each file's row says what it is, how long the link lives,
      // and what 6 saw in it.
      const mediaButtons: Array<{ label: string; href: string }> = [];
      if (links.length) {
        facts.push(["Uploads", `${links.length} file${links.length === 1 ? "" : "s"} — button${links.length === 1 ? "" : "s"} below, links good for 7 days`]);
        links.forEach((link, index) => {
          const n = index + 1;
          const until = new Date(link.expiresAt);
          const untilText = Number.isNaN(until.getTime()) ? "" : ` · link good until ${until.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}`;
          facts.push([`File ${n}`, `${link.label}${untilText}`]);
          if (typeof link.caption === "string" && link.caption.trim()) {
            facts.push([`File ${n} - what 6 saw`, link.caption.trim().slice(0, 500)]);
          }
          mediaButtons.push({ label: `Open file ${n}`, href: link.href });
        });
      } else if (payload.mediaSigningFailed) {
        facts.push([
          "Uploads",
          `Media was received but signed links could not be generated — review at ${absoluteInternal(transcriptEvidenceRef)}`,
        ]);
      } else {
        facts.push(["Uploads", "None received"]);
      }
      const leadRef = payload.opportunityId || payload.sessionId || "";
      const input = {
        kind: FOLLOW_UP_KIND,
        who,
        email: null,
        phone: null,
        facts,
        secureLinks: [
          ...mediaButtons,
          { label: "Open full lead", href: absoluteInternal(leadRef ? `/admin/opportunities/${encodeURIComponent(leadRef)}` : "") },
          { label: "Open full conversation", href: absoluteInternal(transcriptEvidenceRef) },
        ],
        nextStep: isPartial
          ? "Review the conversation evidence before following up; this is an incomplete recovery lead, not a completed owner package."
          : "Reach out. They asked 6 to have you follow up.",
        sessionId: payload.sessionId,
        dedupeKey: idempotencyKey,
      };
      const res = await sendPurposeEmail({
        purpose: "digest",
        to,
        subject,
        text: buildTeamNotifyText(input),
        html: buildTeamNotifyHtml(input),
        idempotencyKey,
        // NOTE: founder mail must NOT inherit visitor Reply-To. This call
        // deliberately omits replyTo.
      });
      if (!res.ok) throw new Error(res.error ?? "resend failed");
      const providerId = res.id?.trim();
      if (!providerId) throw new Error("resend accepted without id");
      return { providerId };
    },
  };
}

export async function drainFollowUpRow(
  store: FollowUpOutboxStore,
  transport: FollowUpTransport,
  dedupeKey: string,
  now: Date,
): Promise<FollowUpDelivery> {
  const existing = await store.getByDedupe(dedupeKey);
  if (!existing) {
    return { status: "failed", providerId: null, error: "outbox row missing", nextAttemptAt: retryAt(now), duplicate: false };
  }
  if (existing.status === "sent") {
    return {
      status: "sent",
      providerId: existing.providerId,
      error: null,
      nextAttemptAt: null,
      duplicate: true,
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
      };
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
      idempotencyKey: claimed.eventKind === PARTIAL_FOLLOW_UP_KIND
        ? partialFollowUpIdempotencyKey(claimed.opportunityId)
        : followUpIdempotencyKey(claimed.opportunityId, claimed.payload.contactMethod, claimed.payload.contactValue),
      payload: claimed.payload,
    });
    try {
      const stored = await store.markSent(
        claimed.id,
        claimed.leaseToken!,
        sent.providerId,
        now,
      );
      return {
        status: "sent",
        providerId: stored.providerId,
        error: null,
        nextAttemptAt: null,
        duplicate: false,
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
        };
      }
      return {
        status: latest?.status ?? "sending",
        providerId: latest?.providerId ?? sent.providerId,
        error: persistError instanceof Error ? persistError.message : String(persistError),
        nextAttemptAt: latest?.nextAttemptAt ?? new Date(
          now.getTime() + FOLLOW_UP_SEND_LEASE_MS,
        ).toISOString(),
        duplicate: false,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "transport failed";
    try {
      const stored = await store.markFailed(
        claimed.id,
        claimed.leaseToken!,
        message,
        retryAt(now),
        now,
      );
      return {
        status: "failed",
        providerId: stored.providerId,
        error: stored.error,
        nextAttemptAt: stored.nextAttemptAt,
        duplicate: false,
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
        };
      }
      const persistMessage = persistError instanceof Error
        ? persistError.message
        : String(persistError);
      return {
        // The durable row is still claimed as sending. Do not report a failed
        // transition that the store did not actually persist.
        status: latest?.status ?? "sending",
        providerId: latest?.providerId ?? null,
        error: `${message}; could not persist failure: ${persistMessage}`.slice(0, 300),
        nextAttemptAt: latest?.nextAttemptAt ?? new Date(
          now.getTime() + FOLLOW_UP_SEND_LEASE_MS,
        ).toISOString(),
        duplicate: false,
      };
    }
  }
}

export async function persistAndDeliverFollowUp(args: {
  store: FollowUpOutboxStore;
  transport: FollowUpTransport;
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
  ownerMediaLinks?: MediaLink[] | null;
  mediaSigningFailed?: boolean;
  readbackConfirmedAt?: string | null;
  followUpAuthorizedAt?: string | null;
}): Promise<FollowUpDelivery> {
  const now = args.now ?? new Date();
  if (args.operatorExcluded) {
    return { status: "failed", providerId: null, error: "operator_excluded", nextAttemptAt: null, duplicate: false };
  }
  const dedupeKey = followUpDedupeKey(args.opportunityId, args.method, args.value);
  try {
    await args.store.insertIgnoreDuplicate({
      opportunityId: args.opportunityId,
      eventKind: FOLLOW_UP_KIND,
      dedupeKey,
      payload: {
        opportunityId: args.opportunityId,
        sessionReviewRef: `/admin/sessions/${encodeURIComponent(args.sessionId)}`,
        contactMethod: args.method,
        contactValue: args.value.trim().slice(0, 254),
        fullName: args.fullName?.trim().slice(0, 200) || null,
        sessionId: args.sessionId,
        transcriptEvidenceRef: `/admin/sessions/${encodeURIComponent(args.sessionId)}`,
        sanitizedTopic: args.sanitizedTopic?.slice(0, 200) ?? null,
        projectSummary: args.projectSummary?.slice(0, 500) ?? null,
        projectDetails: args.projectDetails?.slice(0, 5).map((detail) => detail.slice(0, 180)) ?? null,
        sanitizedName: args.fullName?.trim().slice(0, 200) || null,
        ownerMediaLinks: args.ownerMediaLinks ?? null,
        mediaSigningFailed: args.mediaSigningFailed ?? false,
        readbackConfirmedAt: args.readbackConfirmedAt ?? null,
        followUpAuthorizedAt: args.followUpAuthorizedAt ?? null,
      },
    });
  } catch (error) {
    return {
      status: "failed",
      providerId: null,
      error: error instanceof Error ? error.message.slice(0, 300) : "outbox insert failed",
      // There is no durable row and therefore no persisted retry schedule.
      nextAttemptAt: null,
      duplicate: false,
    };
  }
  const primary = await drainFollowUpRow(args.store, args.transport, dedupeKey, now);
  if (primary.status === "sent") {
    try {
      await args.store.retirePartial(args.opportunityId, now);
    } catch (error) {
      console.warn("[follow-up] partial retirement failed", error instanceof Error ? error.message : String(error));
    }
  }
  // Opportunistic reconciliation must never overwrite the truthful result for
  // the lead handled by this request. Each older row remains durable and can be
  // retried by a later request if its own read/claim/send transition fails.
  try {
    const due = await args.store.listDue(now);
    for (const row of due) {
      if (row.dedupeKey === dedupeKey) continue;
      try {
        await drainFollowUpRow(args.store, args.transport, row.dedupeKey, now);
      } catch (error) {
        console.warn(
          "[follow-up] due-row reconciliation failed",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  } catch (error) {
    console.warn(
      "[follow-up] due-row listing failed",
      error instanceof Error ? error.message : String(error),
    );
  }
  return primary;
}

export async function schedulePartialFollowUp(args: {
  store: FollowUpOutboxStore;
  opportunityId: string;
  sessionId: string;
  method: "email" | "phone";
  value: string;
  explicitSendConsent: boolean;
  fullName?: string | null;
  now?: Date;
  sanitizedTopic?: string | null;
}): Promise<FollowUpOutboxRow | null> {
  if (!args.explicitSendConsent || !args.value.trim()) return null;
  const now = args.now ?? new Date();
  const dedupeKey = partialFollowUpDedupeKey(args.opportunityId);
  const deferUntil = new Date(now.getTime() + PARTIAL_FOLLOW_UP_DELAY_MS).toISOString();
  const payload: FollowUpPayload = {
    opportunityId: args.opportunityId,
    sessionReviewRef: `/admin/sessions/${encodeURIComponent(args.sessionId)}#partial`,
    transcriptEvidenceRef: `/admin/sessions/${encodeURIComponent(args.sessionId)}`,
    contactMethod: args.method,
    contactValue: args.value.trim().slice(0, 254),
    fullName: args.fullName?.trim().slice(0, 200) || null,
    sessionId: args.sessionId,
    sanitizedTopic: args.sanitizedTopic?.slice(0, 200) ?? null,
    sanitizedName: args.fullName?.trim().slice(0, 200) || null,
    ownerMediaLinks: null,
    mediaSigningFailed: false,
  };
  const existing = await args.store.getByDedupe(dedupeKey);
  if (existing) {
    return (await args.store.refreshPendingPartial(dedupeKey, payload, deferUntil, now)) ?? existing;
  }
  return args.store.insertIgnoreDuplicate({
    opportunityId: args.opportunityId,
    eventKind: PARTIAL_FOLLOW_UP_KIND,
    dedupeKey,
    deferUntil,
    payload,
  });
}

export async function drainDueFollowUps(args: {
  store: FollowUpOutboxStore;
  transport: FollowUpTransport;
  now?: Date;
}): Promise<FollowUpDelivery[]> {
  const now = args.now ?? new Date();
  const due = await args.store.listDue(now);
  const results: FollowUpDelivery[] = [];
  for (const row of due) results.push(await drainFollowUpRow(args.store, args.transport, row.dedupeKey, now));
  return results;
}
