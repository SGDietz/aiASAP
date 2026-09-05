// LATE MEDIA -> G'S INBOX (G, 2026-09-05, by voice during a smoke test):
// "say I give my information, I want Scott to reach out to me ... the system
// sends the email. Then I upload some pictures. Then the system needs to send
// me a follow-up email saying, hey ... so that I receive them ... so when I
// reach out to the people, I know everything."
//
// The lead email already carries every file uploaded BEFORE it went out (see
// loadSessionMediaEvents, which now reads the storage bucket, not the table
// that never existed). This module covers files uploaded AFTER it went out:
//
//   1. The capture route calls notifyLateMedia(final=false) after every upload.
//      If a lead email has been SENT for this conversation, G gets one
//      "sent photos" email listing EVERY file so far, with 7-day links and the
//      vision caption for each.
//   2. Uploads inside the next ten minutes do not each send a mail. The
//      end-of-session sync calls notifyLateMedia(final=true), which sends one
//      more mail only if files arrived that no mail has carried yet.
//
// State is one small JSON marker in the bucket next to the files
// (<session>/_notify/media.json), so this needs no table and no migration.
// Best-effort throughout: a failure here never breaks an upload or a sync.

import {
  buildOwnerMediaManifest,
  createHttpSignedUrlSigner,
  listSessionMediaFromStorage,
  readMediaCaption,
  type MediaEventRow,
} from "./emails/leadMediaManifest";
import { notifyTeam } from "./teamNotify";

export const LATE_MEDIA_QUIET_MS = 10 * 60 * 1000;
const MEDIA_BUCKET = process.env.AIASAP_MEDIA_BUCKET || "aiasap-media";

export type LateMediaMarker = { lastSentAt: string; count: number };

export type LateMediaDecision =
  | { send: true; reason: "first_late_upload" | "new_files_final" | "quiet_window_over" }
  | { send: false; reason: "nothing_new" | "quiet_window" };

/**
 * Pure: should a "sent photos" mail go out now? `count` is every file the
 * conversation has in storage; the marker says how many the last mail carried
 * and when. Exported so the rule is unit-tested without a bucket.
 */
export function decideLateMediaSend(args: {
  marker: LateMediaMarker | null;
  count: number;
  final: boolean;
  now: number;
  quietMs?: number;
}): LateMediaDecision {
  const quietMs = args.quietMs ?? LATE_MEDIA_QUIET_MS;
  if (args.count <= 0) return { send: false, reason: "nothing_new" };
  if (!args.marker) return { send: true, reason: "first_late_upload" };
  if (args.count <= args.marker.count) return { send: false, reason: "nothing_new" };
  if (args.final) return { send: true, reason: "new_files_final" };
  const since = args.now - Date.parse(args.marker.lastSentAt);
  if (Number.isFinite(since) && since < quietMs) return { send: false, reason: "quiet_window" };
  return { send: true, reason: "quiet_window_over" };
}

type SentLead = {
  who: string;
  email: string | null;
  phone: string | null;
};

function headers(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

/** The lead email that already went out for this conversation, if any. */
export async function findSentLead(
  url: string,
  key: string,
  sessionId: string,
): Promise<SentLead | null> {
  const sid = encodeURIComponent(sessionId);
  // payload.sessionId is the opportunity's key; the review/evidence refs carry
  // the conversation id. Either match means "this conversation's lead".
  const or = encodeURIComponent(
    `(payload->>sessionId.eq.${sessionId},payload->>sessionReviewRef.like.*${sessionId}*,payload->>transcriptEvidenceRef.like.*${sessionId}*)`,
  );
  const res = await fetch(
    `${url}/rest/v1/opportunity_notification_outbox?event_kind=eq.follow_up_requested&status=eq.sent&or=${or}&select=payload,sent_at&order=sent_at.desc&limit=1`,
    { headers: headers(key) },
  ).catch(() => null);
  void sid;
  if (!res || !res.ok) return null;
  const rows = (await res.json().catch(() => [])) as Array<{ payload?: Record<string, unknown> }>;
  const payload = rows?.[0]?.payload;
  if (!payload) return null;
  const method = payload.contactMethod === "phone" ? "phone" : "email";
  const value = typeof payload.contactValue === "string" ? payload.contactValue : "";
  const name =
    (typeof payload.sanitizedName === "string" && payload.sanitizedName.trim()) ||
    (typeof payload.fullName === "string" && payload.fullName.trim()) ||
    value ||
    "A visitor";
  return {
    who: name,
    email: method === "email" ? value || null : null,
    phone: method === "phone" ? value || null : null,
  };
}

function markerPath(sessionId: string): string {
  return `${sessionId}/_notify/media.json`;
}

async function readMarker(
  url: string,
  key: string,
  sessionId: string,
  bucket: string,
): Promise<LateMediaMarker | null> {
  const res = await fetch(
    `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURI(markerPath(sessionId))}`,
    { headers: headers(key) },
  ).catch(() => null);
  if (!res || !res.ok) return null;
  const body = (await res.json().catch(() => null)) as Partial<LateMediaMarker> | null;
  if (!body || typeof body.count !== "number" || typeof body.lastSentAt !== "string") return null;
  return { count: body.count, lastSentAt: body.lastSentAt };
}

async function writeMarker(
  url: string,
  key: string,
  sessionId: string,
  bucket: string,
  marker: LateMediaMarker,
): Promise<void> {
  await fetch(
    `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURI(markerPath(sessionId))}`,
    {
      method: "POST",
      headers: { ...headers(key), "Content-Type": "application/json", "x-upsert": "true" },
      body: JSON.stringify(marker),
    },
  ).catch(() => undefined);
}

export type LateMediaResult = {
  sent: boolean;
  reason: string;
  count: number;
};

export async function notifyLateMedia(args: {
  url: string;
  serviceRoleKey: string;
  sessionId: string;
  final: boolean;
  bucket?: string;
  now?: number;
}): Promise<LateMediaResult> {
  const bucket = args.bucket ?? MEDIA_BUCKET;
  const now = args.now ?? Date.now();
  try {
    const lead = await findSentLead(args.url, args.serviceRoleKey, args.sessionId);
    if (!lead) return { sent: false, reason: "no_lead_sent", count: 0 };

    const rows: MediaEventRow[] = await listSessionMediaFromStorage(
      args.url,
      args.serviceRoleKey,
      args.sessionId,
      bucket,
    );
    const marker = await readMarker(args.url, args.serviceRoleKey, args.sessionId, bucket);
    const decision = decideLateMediaSend({ marker, count: rows.length, final: args.final, now });
    if (!decision.send) return { sent: false, reason: decision.reason, count: rows.length };

    const manifest = await buildOwnerMediaManifest({
      rows,
      signer: createHttpSignedUrlSigner(args.url, args.serviceRoleKey),
      reviewRef: `/admin/sessions/${encodeURIComponent(args.sessionId)}`,
      bucket,
    });
    const facts: Array<[string, string | null]> = [
      ["Files from this conversation", String(rows.length)],
    ];
    const secureLinks: Array<{ label: string; href: string }> = [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const link = manifest.links[i];
      const caption = await readMediaCaption(args.url, args.serviceRoleKey, row, bucket);
      const n = i + 1;
      if (link) {
        const kb = Math.max(1, Math.round(link.sizeBytes / 1024));
        facts.push([`File ${n}`, `${link.label} · ${kb} KB · link good 7 days`]);
      }
      if (caption) facts.push([`File ${n} - what 6 saw`, caption]);
      if (link) secureLinks.push({ label: `Open file ${n}`, href: link.href });
    }
    if (manifest.signingFailed) {
      facts.push(["Links", `Some links could not be signed. Review: ${manifest.reviewRef}`]);
    }
    const result = await notifyTeam({
      kind: "photos_received",
      who: lead.who,
      email: lead.email,
      phone: lead.phone,
      facts,
      secureLinks,
      nextStep: args.final
        ? "Their conversation has ended. Open every link before you reach out, so you know everything they showed 6."
        : "They are still talking to 6. Open the links now; a final mail follows if more files arrive.",
      sessionId: args.sessionId,
      dedupeKey: `${args.sessionId}:media:${rows.length}`,
    });
    if (result.emailed) {
      await writeMarker(args.url, args.serviceRoleKey, args.sessionId, bucket, {
        lastSentAt: new Date(now).toISOString(),
        count: rows.length,
      });
    }
    return { sent: result.emailed, reason: result.emailed ? decision.reason : (result.reason ?? "send_failed"), count: rows.length };
  } catch (e) {
    console.warn("[late-media] failed", e instanceof Error ? e.message : String(e));
    return { sent: false, reason: "threw", count: 0 };
  }
}
