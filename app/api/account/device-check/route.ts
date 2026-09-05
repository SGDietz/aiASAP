import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";
import { getUserId } from "../../../../src/lib/auth/getUser";
import { sendResendEmail } from "../../../../src/lib/sendResendEmail";

// NEW-DEVICE ALERT (2026-06-11, G: "Yes new device alert. Yes magic link
// through email for all new devices. Can stay logged in to multiple
// devices."): every signed-in visit posts its device marker; the first time
// a device touches an account, the owner gets an email. Login itself already
// requires the magic link per device (sessions are device-local), and staying
// signed in on many devices stays allowed — this adds the tripwire.

const MAX_KNOWN_DEVICES = 12;
const DEVICE_ID_RE = /^[a-z0-9-]{8,64}$/;

function alertHtml(deviceLabel: string, whenText: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;background:#0e0803;padding:36px 14px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#1d1209;border:1px solid #4a2f14;border-radius:22px;padding:34px 34px 26px;text-align:center;">
    <div style="font-family:'Arial Black','Archivo Black',Impact,sans-serif;font-style:italic;font-size:32px;color:#f4d086;">aiASAP</div>
    <div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#d9a85e;margin:2px 0 22px;">Gorgeous Brilliant Fast Cheap</div>
    <p style="font-size:16px;color:#e2bd84;margin:0 0 6px;">6 here &mdash; a new device just signed in to your account:</p>
    <p style="font-size:20px;color:#f1c87e;font-weight:800;margin:6px 0 4px;">${deviceLabel}</p>
    <p style="font-size:14px;color:#d9a85e;margin:0 0 18px;">${whenText}</p>
    <p style="font-size:15px;color:#e2bd84;line-height:1.6;margin:0;">If this was you, you're all set. If it wasn't, come talk to me at <a href="https://aiASAP.ai" style="color:#cda966;">aiASAP.ai</a> and say <b style="color:#f1c87e;">&ldquo;sign everyone else out&rdquo;</b> &mdash; and I'll lock it down.</p>
    <p style="font-size:16px;font-weight:800;color:#f1c87e;margin:22px 0 0;">I've got your back. &#129309;</p>
  </div>
  <p style="text-align:center;font-size:12px;color:#b39a50;margin-top:18px;">Sent by 6 at aiASAP.ai &middot; &copy; 2026 aiASAP &middot; DietzX LLC</p>
</body></html>`;
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  const userId = await getUserId();
  if (!userId) {
    return new Response(JSON.stringify({ error: "not signed in" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await request.json()) as { deviceId?: string; label?: string };
    const deviceId = (body.deviceId ?? "").toLowerCase();
    if (!DEVICE_ID_RE.test(deviceId)) {
      return new Response(JSON.stringify({ error: "bad device id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const label =
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim().slice(0, 80)
        : "An unknown device";

    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const headers = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    };
    const uRes = await fetch(
      `${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      { headers },
    );
    if (!uRes.ok) throw new Error(`user fetch ${uRes.status}`);
    const user = (await uRes.json()) as {
      email?: string;
      user_metadata?: { known_devices?: Array<{ id: string }> };
    };
    const known = Array.isArray(user.user_metadata?.known_devices)
      ? user.user_metadata!.known_devices!
      : [];
    if (known.some((d) => d && d.id === deviceId)) {
      return new Response(JSON.stringify({ ok: true, known: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const nextKnown = [
      ...known.slice(-(MAX_KNOWN_DEVICES - 1)),
      { id: deviceId, label, first_seen: new Date().toISOString() },
    ];
    await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ user_metadata: { known_devices: nextKnown } }),
    });

    // First-ever device = the signup device itself; no alert for that one.
    if (known.length > 0 && user.email) {
      const whenText = new Date().toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      });
      await sendResendEmail({
        to: user.email,
        subject: "New device signed in to your aiASAP account",
        html: alertHtml(label, `${whenText} (US Eastern)`),
        idempotencyKey: `device-alert:${userId}:${deviceId}`,
      });
    }
    return new Response(JSON.stringify({ ok: true, known: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[device-check] failed", e);
    return new Response(JSON.stringify({ error: "failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
