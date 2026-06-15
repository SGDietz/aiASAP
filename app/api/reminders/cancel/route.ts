import { NextResponse } from "next/server";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";

// Stop-button target for recurring reminder emails (G 2026-06-14: "a button to
// stop that reminder"). The cancel_token IS the credential — no login needed —
// so we validate its shape, rate-limit, and never log the full URL.
const TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function adminHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

function pageHtml(status: "ok" | "bad" | "error"): string {
  const title =
    status === "ok"
      ? "Reminders stopped"
      : status === "bad"
        ? "Bad stop link"
        : "Try again";
  const copy =
    status === "ok"
      ? "Those reminders are stopped. Come talk to 6 any time you want them back."
      : status === "bad"
        ? "That stop link is not valid. Open _aiASAP_ and ask 6 to check your reminders."
        : "I could not stop that reminder yet. Open _aiASAP_ and ask 6 to help.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>aiASAP — ${title}</title>
<style>
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:radial-gradient(circle at 50% -8%,#34200f 0%,#1a0f06 50%,#0e0803 100%); color:#ffe9c2; font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif; }
  .card { width:min(520px, calc(100vw - 32px)); box-sizing:border-box; padding:34px 28px; border:1px solid #4a2f14; border-radius:24px; background:#1d1209; text-align:center; box-shadow:0 24px 70px rgba(0,0,0,.6); }
  .brand { font-family:'Arial Black','Archivo Black',Impact,sans-serif; font-style:italic; font-size:36px; color:#f4d086; margin-bottom:4px; }
  .tag { color:#d9a85e; font-size:13px; font-weight:900; letter-spacing:6px; text-transform:uppercase; margin-bottom:24px; }
  h1 { margin:0 0 12px; color:#f1c87e; font-size:28px; }
  p { margin:0; color:#e2bd84; font-size:16px; line-height:1.5; }
  em { font-style:italic; }
</style>
</head>
<body>
  <main class="card">
    <div class="brand"><em>aiASAP</em></div>
    <div class="tag">Take the Leap</div>
    <h1>${title}</h1>
    <p>${copy.replace("_aiASAP_", "<em>aiASAP</em>")}</p>
  </main>
</body>
</html>`;
}

export async function GET(request: Request) {
  const rateErr = await checkRateLimit(request);
  if (rateErr) return rateErr;

  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  if (!TOKEN_RE.test(token)) {
    return new NextResponse(pageHtml("bad"), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const res = await fetch(
    `${url}/rest/v1/reminders?cancel_token=eq.${encodeURIComponent(token)}`,
    {
      method: "PATCH",
      headers: { ...adminHeaders(serviceRoleKey), Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      }),
    },
  );

  if (!res.ok) {
    console.error(
      "reminder cancel failed",
      res.status,
      (await res.text()).slice(0, 200),
    );
    return new NextResponse(pageHtml("error"), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new NextResponse(pageHtml("ok"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
