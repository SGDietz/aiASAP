/**
 * Tiny Resend sender (G 2026-06-07) — one place for the transactional email send
 * the deletion flow + cron reuse. Mirrors the existing magic-link send in
 * app/api/account/start. Best-effort: returns false instead of throwing.
 */
export async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  idempotencyKey?: string;
}): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return false;
  const fromEmail =
    process.env.ACCOUNT_LINK_FROM_EMAIL || "aiASAP <accounts@aiasap.ai>";
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
        from: fromEmail,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
