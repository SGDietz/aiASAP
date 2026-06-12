/**
 * Tiny Twilio SMS sender (2026-06-10) — mirrors sendResendEmail: one place,
 * best-effort, returns false instead of throwing. DORMANT until the Twilio
 * envs exist (G's number + A2P approval are in flight); with them absent every
 * caller falls back to email, so this ships safely ahead of the account.
 */
export function twilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_PHONE,
  );
}

export async function sendTwilioSms(opts: {
  to: string; // E.164, e.g. +14105551234
  body: string;
}): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_PHONE;
  if (!sid || !token || !from) return false;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: opts.to,
          From: from,
          Body: opts.body.slice(0, 1500),
        }).toString(),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
