import { NextResponse } from "next/server";
import { getUser } from "../../../../src/lib/auth/getUser";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";
import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";
import { isValidTimezone } from "../../../../src/lib/timezone/userTimezone";

/**
 * Account-level preferences (2026-06-10). Residents: ui_size_level —
 * G: "the pill boxes stay the size of when last used by the user... if they
 * have an account and are returning." — and timezone (2026-06-11, voice-set
 * IANA zone; sticks until the user changes it by voice again). GoTrue merges
 * metadata keys, so this never clobbers full_name / phone / preferred_locale.
 */
export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }
  let body: { uiSizeLevel?: unknown; timezone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const level =
    typeof body.uiSizeLevel === "number" &&
    Number.isInteger(body.uiSizeLevel) &&
    body.uiSizeLevel >= 0 &&
    body.uiSizeLevel <= 4
      ? body.uiSizeLevel
      : null;
  const timezone =
    body.timezone !== undefined && isValidTimezone(body.timezone)
      ? body.timezone
      : null;
  if (level === null && timezone === null) {
    return NextResponse.json(
      { error: "uiSizeLevel 0-4 or a valid timezone required" },
      { status: 400 },
    );
  }
  const metadata: Record<string, unknown> = {};
  if (level !== null) metadata.ui_size_level = level;
  if (timezone !== null) metadata.timezone = timezone;
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
      body: JSON.stringify({ user_metadata: metadata }),
    },
  );
  if (!res.ok) {
    console.error("prefs save failed", res.status);
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
