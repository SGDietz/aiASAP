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
  | "account";

const SENDERS: Record<EmailPurpose, string> = {
  bug: process.env.BUG_REPORT_FROM_EMAIL || "6 from aiASAP <BugAlert@aiasap.ai>",
  crash: "aiASAP Watchdog <CrashReport@aiasap.ai>",
  feedback: "6 from aiASAP <UserFeedback@aiasap.ai>",
  digest: "6 from aiASAP <Reports@aiasap.ai>",
  account: process.env.ACCOUNT_LINK_FROM_EMAIL || "aiASAP <accounts@aiasap.ai>",
};

export function senderFor(purpose: EmailPurpose): string {
  return SENDERS[purpose];
}

/**
 * Purpose-routed plain-text email via Resend. Best-effort: returns
 * { ok, error } instead of throwing — email must never break a caller.
 */
export async function sendPurposeEmail(opts: {
  purpose: EmailPurpose;
  to: string;
  subject: string;
  text: string;
  idempotencyKey?: string;
}): Promise<{ ok: boolean; error: string | null }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { ok: false, error: "RESEND_API_KEY missing" };
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
      }),
    });
    return res.ok
      ? { ok: true, error: null }
      : { ok: false, error: `resend ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
