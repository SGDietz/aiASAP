import { NextResponse } from "next/server";
import { getUser } from "../../../../src/lib/auth/getUser";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";
import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";

/**
 * Save the spoken phone number for SMS reminders (2026-06-10). Signed-in
 * only — anonymous callers are told to make an account first (the client
 * handles that line). GoTrue merges user_metadata keys, so this never
 * clobbers full_name/preferred_locale.
 */
export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  let body: { phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const phone =
    typeof body.phone === "string" && /^\+1\d{10}$/.test(body.phone)
      ? body.phone
      : null;
  if (!phone) {
    return NextResponse.json({ error: "valid +1 phone required" }, { status: 400 });
  }
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const res = await fetch(
    `${url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`,
    {
      method: "PUT",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_metadata: { phone, sms_opt_in: true } }),
    },
  );
  if (!res.ok) {
    console.error("phone save failed", res.status);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
