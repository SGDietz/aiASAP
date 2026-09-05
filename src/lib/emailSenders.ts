/**
 * aiASAP email sender catalog (G 2026-06-12: "We need a system of emails,
 * like a bug alert should come from BugAlert@aiASAP.ai... and 6 should be
 * able to think and put them in the right email, for their subject").
 *
 * The aiasap.ai domain is verified in Resend, so any name@aiasap.ai can SEND
 * with zero mailbox setup. These are OUTBOUND-ONLY addresses — replies need
 * an inbound setup (future project, see the email-system directive).
 *
 * Add a purpose here, never hard-code a from-address in a route.
 */

export type EmailPurpose =
  | "bug"
  | "crash"
  | "feedback"
  | "digest"
  | "account"
  | "visitor";

const SENDERS: Record<EmailPurpose, string> = {
  bug: process.env.BUG_REPORT_FROM_EMAIL || "6 from aiASAP <BugAlert@aiasap.ai>",
  crash: "aiASAP Watchdog <CrashReport@aiasap.ai>",
  feedback: "6 from aiASAP <UserFeedback@aiasap.ai>",
  digest: "6 from aiASAP <Reports@aiasap.ai>",
  account: process.env.ACCOUNT_LINK_FROM_EMAIL || "aiASAP <accounts@aiasap.ai>",
  visitor: process.env.AIASAP_VISITOR_FROM_EMAIL || "6 from aiASAP <hello@aiasap.ai>",
};

export function senderFor(purpose: EmailPurpose): string {
  return SENDERS[purpose];
}

/**
 * Purpose-routed email via Resend. Best-effort: returns { ok, error } instead
 * of throwing — email must never break a caller.
 *
 * `html` added 2026-08-25 (G: all aiASAP emails should be in the aiASAP theme
 * colours). It is OPTIONAL and additive — every existing caller that passes
 * only `text` behaves exactly as before. When both are given, `text` stays on
 * the message as the plain-text alternative: it is what text-only clients and
 * watches render, and dropping it hurts deliverability. Build the html with
 * `emailShell` from ./emailTheme so the look stays in one place.
 */
export async function sendPurposeEmail(opts: {
  purpose: EmailPurpose;
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
  /**
   * Optional Reply-To address. Added narrowly for the visitor confirmation
   * (so a visitor's REPLY lands at the aiASAP team address instead of the
   * outbound-only hello@aiasap.ai sender that nobody reads). The founder
   * email path must NOT set this — it would misroute team replies. Enforced
   * at the callsite; this file just forwards the header to Resend.
   */
  replyTo?: string;
}): Promise<{ ok: boolean; error: string | null; id: string | null }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { ok: false, error: "RESEND_API_KEY missing", id: null };
  const headers: Record<string, string> = {
    Authorization: `Bearer ${resendKey}`,
    "Content-Type": "application/json",
  };
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: senderFor(opts.purpose),
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        ...(opts.html ? { html: opts.html } : {}),
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    const body = (await res.json().catch(() => null)) as { id?: unknown } | null;
    const id = body && typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;
    return res.ok
      ? { ok: true, error: null, id }
      : { ok: false, error: `resend ${res.status}`, id: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), id: null };
  }
}
