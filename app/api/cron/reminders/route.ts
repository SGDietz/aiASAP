import { NextResponse } from "next/server";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";
import { sendResendEmail } from "../../../../src/lib/sendResendEmail";
import { sendTwilioSms, twilioConfigured } from "../../../../src/lib/sendTwilioSms";

/**
 * Never Forget delivery (2026-06-10). Every 5 minutes: find due, pending,
 * signed-in reminders → email "6 here — don't forget" → log notifications_sent
 * → mark the reminder done (v1 = one-shot; recurrence later). Anonymous
 * reminders have no address — they live on the in-session card only.
 * Auth mirrors the purge-deletions cron (vercel-cron UA, or CRON_SECRET).
 */
export const maxDuration = 120;

function authorized(request: Request): boolean {
  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  if (ua.includes("vercel-cron")) return true;
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth === `Bearer ${secret}`) return true;
    if (new URL(request.url).searchParams.get("key") === secret) return true;
  }
  return false;
}

function escapeHtml(value: string): string {
  return (
    value.replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch] ?? ch,
    )
  );
}

function publicBaseUrl(request: Request): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return (configured || new URL(request.url).origin).replace(/\/$/, "");
}

function nextDailyDueAtIso(dueAtIso: string): string {
  const next = new Date(dueAtIso);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

function reminderEmailHtml(
  title: string,
  whenText: string,
  cancelUrl?: string | null,
): string {
  const safeTitle = escapeHtml(title);
  const safeWhenText = escapeHtml(whenText);
  const safeCancelUrl = cancelUrl ? escapeHtml(cancelUrl) : null;
  const stopButton = safeCancelUrl
    ? `<p class="stopwrap"><a class="stopbtn" href="${safeCancelUrl}">Stop these reminders</a></p>`
    : "";
  // Same skeleton as the G-locked magic-link email (src/lib/magicLinkEmail.ts):
  // dark radial wrap, framed card, wordmark + TAKE THE LEAP, 6's photo, SOLID
  // gold text (never background-clip:text — it goes invisible on Android
  // Gmail), matching footer. G 2026-06-11: "make this email more similar to
  // the other ones" — and his line gets the signature spot ("I LOVE you
  // talked, I remembered").
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>aiASAP &mdash; Don't forget</title>
<style>
  body { margin:0; padding:0; background:#0e0803; -webkit-font-smoothing:antialiased; }
  .wrap { width:100%; background: radial-gradient(circle at 50% -8%, #34200f 0%, #1a0f06 50%, #0e0803 100%); background-color:#160c04; padding: 40px 16px; }
  .card { max-width: 540px; margin:0 auto; background:#1d1209; background-color:#1d1209; border:1px solid #4a2f14; border-radius:24px; overflow:hidden; box-shadow:0 24px 70px rgba(0,0,0,.6); }
  .inner { padding: 40px 40px 30px; text-align:center; font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif; }
  .wordmark { font-family:'Arial Black','Archivo Black',Impact,sans-serif; font-style:italic; font-size:36px; letter-spacing:.5px; color:#f4d086; margin:0 0 4px; }
  /* G, 2026-09-04: "it is no longer take the leap, change that too" and "all emails should have the top of 6, his face at least". Copy + asset only - the locked LAYOUT is untouched. 7px spacing wrapped the longer tagline onto two lines, so 12px/2.2px here as in emailTheme. */
  .tag { font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif; font-size:12px; font-weight:800; letter-spacing:2.2px; text-transform:uppercase; color:#d9a85e; margin:0 0 24px; }
  .sixwrap { display:inline-block; line-height:0; font-size:0; }
  .six { display:block; width:300px; max-width:78%; border-radius:34px; border:1px solid rgba(215,160,90,0.40); background:rgba(0,0,0,0.35); box-shadow:0 0 0 1px rgba(215,160,90,0.45), 0 30px 90px rgba(0,0,0,0.72); margin:0 auto; }
  .lead { font-size:16px; color:#e2bd84; margin:26px 0 6px; }
  h1 { font-size:26px; color:#f1c87e; margin:6px 0 10px; font-weight:800; }
  .when { font-size:15px; color:#d9a85e; margin:0 0 8px; }
  .sig { font-size:17px; font-weight:800; color:#f1c87e; margin:24px 0 0; }
  .stopwrap { margin:24px 0 0; }
  .stopbtn { display:inline-block; padding:13px 20px; border-radius:999px; background:#d7a05a; background:linear-gradient(135deg,#ffe9c2 0%,#d7a05a 58%,#3a2108 100%); color:#160c04 !important; font-weight:900; text-decoration:none; box-shadow:0 10px 26px rgba(215,160,90,.25); }
  .divider { height:1px; width:70%; margin:30px auto 0; background:#4a2f14; }
  .fine { font-size:13px; line-height:1.55; margin-top:22px; color:#a98a63; }
  .foot { text-align:center; padding:22px 20px 4px; font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif; font-size:12px; line-height:1.7; color:#b39a50; }
  .foot a { text-decoration:none; color:#cda966; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="inner">
        <div class="wordmark">aiASAP</div>
        <div class="tag">Gorgeous Brilliant Fast Cheap</div>
        <span class="sixwrap"><img src="https://wqszxsqzkaatghyrqviv.supabase.co/storage/v1/object/public/email-assets/six_face.png" alt="6, your a-i-buddy" class="six"></span>
        <p class="lead">6 here &mdash; you asked me not to let you forget:</p>
        <h1>${safeTitle}</h1>
        <p class="when">${safeWhenText}</p>
        <p class="sig">You talked, I remembered. &#129309;</p>
        ${stopButton}
        <div class="divider"></div>
        <p class="fine">You set this reminder by voice. Want another? Just come talk to me.</p>
      </div>
    </div>
    <div class="foot">
      Sent by 6 at <a href="https://aiASAP.ai">aiASAP.ai</a> &#128155;<br>
      &copy; 2026 aiASAP &middot; DietzX LLC
    </div>
  </div>
</body>
</html>`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  const baseUrl = publicBaseUrl(request);

  // Due now (small grace window back 24h so an outage never silently drops one).
  const nowIso = new Date().toISOString();
  const floorIso = new Date(Date.now() - 24 * 3600_000).toISOString();
  const dueRes = await fetch(
    `${url}/rest/v1/reminders?status=eq.pending&auth_user_id=not.is.null&due_at=lte.${encodeURIComponent(nowIso)}&due_at=gte.${encodeURIComponent(floorIso)}&select=id,auth_user_id,title,due_at,timezone,recurrence,cancel_token&limit=50`,
    { headers },
  );
  if (!dueRes.ok) {
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
  const due = (await dueRes.json()) as Array<{
    id: string;
    auth_user_id: string;
    title: string;
    due_at: string;
    timezone: string | null;
    recurrence: "daily" | null;
    cancel_token: string | null;
  }>;

  let sent = 0;
  let failed = 0;
  for (const r of due) {
    try {
      // Resolve the email from auth.
      const uRes = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(r.auth_user_id)}`, { headers });
      if (!uRes.ok) { failed++; continue; }
      const user = (await uRes.json()) as {
        email?: string;
        user_metadata?: { phone?: string; sms_opt_in?: boolean };
      };
      const phone =
        user.user_metadata?.sms_opt_in && typeof user.user_metadata?.phone === "string"
          ? user.user_metadata.phone
          : null;
      if (!user.email && !phone) { failed++; continue; }

      const whenText = new Date(r.due_at).toLocaleString("en-US", {
        weekday: "long", month: "long", day: "numeric",
        hour: "numeric", minute: "2-digit",
        ...(r.timezone ? { timeZone: r.timezone } : {}),
      });

      // CHANNEL PICK (2026-06-10, G: "not just email reminders, but text"):
      // SMS first when the user opted in AND Twilio is configured (dormant
      // until G's number + A2P land); email is the fallback either way.
      let channel: "sms" | "email" | null = null;
      let recipient = "";
      // Recurring reminders carry a one-click STOP link (G 2026-06-14).
      const cancelUrl =
        r.recurrence === "daily" && r.cancel_token
          ? `${baseUrl}/api/reminders/cancel?token=${encodeURIComponent(r.cancel_token)}`
          : null;
      if (phone && twilioConfigured()) {
        const smsOk = await sendTwilioSms({
          to: phone,
          body: `6 here — don't forget: ${r.title} (${whenText}). You talked, I remembered.${cancelUrl ? ` Stop: ${cancelUrl}` : ""} — aiASAP`,
        });
        if (smsOk) { channel = "sms"; recipient = phone; }
      }
      if (!channel && user.email) {
        const ok = await sendResendEmail({
          to: user.email,
          subject: `Don't forget: ${r.title}`,
          html: reminderEmailHtml(r.title, whenText, cancelUrl),
          // Per-occurrence key so a DAILY reminder isn't suppressed after day 1.
          idempotencyKey: `reminder:${r.id}:${r.due_at}`,
        });
        if (ok) { channel = "email"; recipient = user.email; }
      }
      if (!channel) { failed++; continue; }

      await fetch(`${url}/rest/v1/notifications_sent`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          user_id: r.auth_user_id,
          channel,
          recipient,
          template_id: "reminder",
          context: { reminder_id: r.id, title: r.title, due_at: r.due_at, recurrence: r.recurrence },
          status: "sent",
        }),
      }).catch(() => {});

      // Daily reminders roll forward one day and stay pending; one-shots finish.
      const reminderPatch =
        r.recurrence === "daily"
          ? { due_at: nextDailyDueAtIso(r.due_at), updated_at: new Date().toISOString() }
          : { status: "done", updated_at: new Date().toISOString() };
      await fetch(`${url}/rest/v1/reminders?id=eq.${encodeURIComponent(r.id)}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(reminderPatch),
      });
      sent++;
    } catch (e) {
      console.error("[cron:reminders] item failed", r.id, e);
      failed++;
    }
  }
  console.log(`[cron:reminders] due=${due.length} sent=${sent} failed=${failed}`);
  return NextResponse.json({ ok: true, due: due.length, sent, failed });
}
