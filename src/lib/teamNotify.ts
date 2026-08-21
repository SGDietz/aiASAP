/**
 * AUTO-EMAIL TO THE TEAM — G, 2026-08-21:
 *
 *   "We need a system build so that when anything new comes in that the team
 *    needs to know about, an auto email is sent with all the important info."
 *
 * Deliberately NOT the crash path. `serverLogger` already emails when the
 * software breaks. This is the opposite kind of news: a real person did
 * something and a human now has work to do — somebody finished an interview,
 * sent photos, asked for their brand, or came back with feedback on a build.
 *
 * The design rule that matters: the email must be ACTIONABLE ON ITS OWN.
 * G reads it on a phone. If it says "new interview, go look in Supabase" it has
 * failed — he has to stop, find a laptop, and dig. So every notification
 * carries who it was, how to reach them, what they want, and what is needed
 * next, in plain words.
 */

import { sendPurposeEmail } from "./emailSenders";
import { sendTelegramAlert } from "./telegramAlert";

export type TeamNotifyKind =
  | "payment_received"
  | "sale_interest"
  | "interview_complete"
  | "interview_stopped_early"
  | "photos_received"
  | "new_account"
  | "build_feedback"
  | "mission_answered"
  | "consent_declined";

/** Plain-English headline per kind. The subject line is read on a lock screen. */
const HEADLINES: Record<TeamNotifyKind, string> = {
  // Money actually landed. Nothing in this file matters more, and nothing
  // else here is irreversible - a payment is.
  payment_received: "PAID - money is in",
  // The one that is worth money. 6 cannot take a card or see Stripe, so the
  // ONLY way a "yes" becomes real work is somebody being told it happened.
  // Without this the sale sits in a transcript nobody reads.
  sale_interest: "said YES to the five thousand package",
  interview_complete: "finished their interview",
  interview_stopped_early: "stopped part-way through",
  photos_received: "sent photos",
  new_account: "signed up",
  build_feedback: "gave feedback on their build",
  mission_answered: "answered the questions 6 had",
  consent_declined: "said no to being recorded",
};

/**
 * How urgent each kind is. Only the ones a human should act on TODAY also ring
 * the phone; the rest are email-only so the alert channel keeps its meaning.
 */
const ALSO_TELEGRAM: ReadonlySet<TeamNotifyKind> = new Set<TeamNotifyKind>([
  "payment_received",
  "interview_complete",
  "build_feedback",
  "consent_declined",
]);

export type TeamNotifyInput = {
  kind: TeamNotifyKind;
  /** Who it was. Their name if we have it, otherwise their email. */
  who: string;
  /** How to reach them. */
  email?: string | null;
  phone?: string | null;
  /**
   * The facts a human needs to act, already in plain words. Order matters —
   * most decision-changing first, because this gets read on a phone.
   */
  facts?: Array<[label: string, value: string | null | undefined]>;
  /** What the team actually has to DO. One sentence. */
  nextStep?: string;
  sessionId?: string | null;
  /**
   * Stable per real-world event, so a retry or a double-fire cannot send twice.
   * Resend honours this as an idempotency key.
   */
  dedupeKey: string;
};

function esc(v: unknown): string {
  return String(v ?? "").slice(0, 500);
}

export function buildTeamNotifyText(input: TeamNotifyInput): string {
  const when = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  const lines: string[] = [
    `${esc(input.who)} ${HEADLINES[input.kind]}.`,
    "",
    `When: ${when} Eastern`,
  ];
  if (input.email) lines.push(`Email: ${esc(input.email)}`);
  if (input.phone) lines.push(`Phone: ${esc(input.phone)}`);
  const facts = (input.facts ?? []).filter(
    (f): f is [string, string] => Boolean(f[1] && String(f[1]).trim()),
  );
  if (facts.length) {
    lines.push("");
    for (const [label, value] of facts) lines.push(`${label}: ${esc(value)}`);
  }
  if (input.nextStep) {
    lines.push("", `NEXT: ${input.nextStep}`);
  }
  if (input.sessionId) {
    lines.push("", `Session: ${esc(input.sessionId)}`);
  }
  lines.push(
    "",
    "The full conversation is in Supabase conversation_messages if you need it —",
    "but everything above should be enough to act on without opening it.",
  );
  return lines.join("\n");
}

export type TeamNotifyResult = {
  emailed: boolean;
  telegrammed: boolean;
  reason: string | null;
};

/**
 * Tell the team. Best-effort and never throws: a notification failure must
 * never break the thing the user was actually doing.
 */
export async function notifyTeam(
  input: TeamNotifyInput,
): Promise<TeamNotifyResult> {
  const to = process.env.AIASAP_FOUNDER_REPORT_EMAIL;
  if (!to) {
    console.warn("[team-notify] AIASAP_FOUNDER_REPORT_EMAIL not set — nobody told");
    return { emailed: false, telegrammed: false, reason: "no recipient" };
  }
  // Same switch as the other outbound mail, so a test session cannot spray G's
  // inbox with fake clients.
  if (process.env.TEAM_EMAILS_ENABLED === "false") {
    return { emailed: false, telegrammed: false, reason: "TEAM_EMAILS_ENABLED=false" };
  }

  const text = buildTeamNotifyText(input);
  const subject = `aiASAP: ${esc(input.who)} ${HEADLINES[input.kind]}`;

  let emailed = false;
  let reason: string | null = null;
  try {
    const res = await sendPurposeEmail({
      purpose: "digest",
      to,
      subject,
      text,
      // Same real event twice -> Resend drops the duplicate rather than G
      // getting told twice about one person.
      idempotencyKey: `team:${input.kind}:${input.dedupeKey}`,
    });
    emailed = res.ok;
    reason = res.error;
  } catch (e) {
    reason = e instanceof Error ? e.message : String(e);
  }

  let telegrammed = false;
  if (ALSO_TELEGRAM.has(input.kind)) {
    // Keyed by kind, not by person: two different people finishing should both
    // ring. The throttle exists for storms, not for genuine separate events.
    const r = await sendTelegramAlert(
      `team:${input.kind}:${input.dedupeKey}`,
      `${subject}\n\n${text}`,
    );
    telegrammed = r.sent;
  }

  if (!emailed) {
    console.warn(`[team-notify] email failed (${reason ?? "unknown"}) for ${input.kind}`);
  }
  return { emailed, telegrammed, reason };
}
