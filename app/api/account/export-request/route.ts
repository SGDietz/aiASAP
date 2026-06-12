import { NextResponse } from "next/server";
import { getUser } from "../../../../src/lib/auth/getUser";
import { signDownloadToken } from "../../../../src/lib/downloadToken";
import { buildDataDownloadEmailHtml } from "../../../../src/lib/dataDownloadEmail";

/**
 * Request a data download (G 2026-06-07). 6 calls this for a signed-in user who
 * asks to download/export their data. We do NOT push a file to their device —
 * instead we EMAIL a secure, time-limited download link to the address on their
 * account (proves identity, no creepy auto-download). The link points at
 * /api/account/download?token=... which serves the actual file.
 */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const email = user.email ?? null;
  if (!email) {
    return NextResponse.json({ error: "no email on account" }, { status: 400 });
  }
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "email not configured" }, { status: 500 });
  }

  const origin = (() => {
    try {
      return new URL(request.url).origin;
    } catch {
      return "";
    }
  })();
  const fromEmail =
    process.env.ACCOUNT_LINK_FROM_EMAIL || "aiASAP <accounts@aiasap.ai>";

  try {
    const token = signDownloadToken(user.id, email);
    const downloadLink = `${origin}/api/account/download?token=${encodeURIComponent(token)}`;
    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "Your aiASAP data — download link",
        html: buildDataDownloadEmailHtml(downloadLink),
      }),
    });
    if (!sendRes.ok) {
      const detail = await sendRes.text();
      console.error(
        "export-request Resend failed:",
        sendRes.status,
        detail.slice(0, 200),
      );
      return NextResponse.json({ error: "send failed" }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: "send failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, email });
}
