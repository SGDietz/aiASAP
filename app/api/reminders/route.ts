import { NextResponse } from "next/server";
import { getUser, getUserId } from "../../../src/lib/auth/getUser";
import { getSupabaseAdminConfig } from "../../../src/lib/supabaseAdmin";
import { assertAllowedOrigin } from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { isValidTimezone } from "../../../src/lib/timezone/userTimezone";

/**
 * Never Forget reminders (2026-06-10, G: "all you gotta do is talk to six").
 * POST  — create a reminder captured by voice (anonymous allowed: session-only
 *         card until they sign in; signed-in reminders also get the email nudge
 *         from the delivery cron).
 * GET   — pending reminders for the signed-in user (or by session for anon).
 * PATCH — mark done / cancelled.
 * All writes go through the service role; auth_user_id is the live identity
 * column (reminders.user_id FKs the legacy empty ai_users table — unused).
 */

function adminHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateErr = await checkRateLimit(request);
  if (rateErr) return rateErr;

  let body: {
    title?: unknown;
    rawText?: unknown;
    dueAtIso?: unknown;
    timezone?: unknown;
    sessionId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  const dueAtIso =
    typeof body.dueAtIso === "string" && !Number.isNaN(Date.parse(body.dueAtIso))
      ? new Date(body.dueAtIso).toISOString()
      : null;

  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const user = await getUser();
  const authUserId = user?.id ?? null;
  // Timezone ladder (2026-06-11): the request's zone (device or voice-set in
  // session) wins; a signed-in account's voice-set zone is the fallback.
  // BOTH rungs validate — an invalid stored zone would make the delivery
  // cron's toLocaleString throw and retry that row forever (review 2026-06-11).
  const accountTz = (user?.user_metadata as Record<string, unknown> | undefined)
    ?.timezone;
  const timezone = isValidTimezone(body.timezone)
    ? body.timezone
    : isValidTimezone(accountTz)
      ? accountTz
      : null;

  const res = await fetch(`${url}/rest/v1/reminders`, {
    method: "POST",
    headers: { ...adminHeaders(serviceRoleKey), Prefer: "return=representation" },
    body: JSON.stringify({
      auth_user_id: authUserId,
      session_id:
        typeof body.sessionId === "string" ? body.sessionId.slice(0, 200) : null,
      title,
      raw_text: typeof body.rawText === "string" ? body.rawText.slice(0, 500) : null,
      due_at: dueAtIso,
      timezone,
      status: "pending",
    }),
  });
  if (!res.ok) {
    console.error("reminders insert failed", res.status, (await res.text()).slice(0, 200));
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }
  const rows = (await res.json()) as Array<{ id: string }>;
  return NextResponse.json({ ok: true, id: rows[0]?.id ?? null, signedIn: Boolean(authUserId) });
}

export async function GET(request: Request) {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const authUserId = await getUserId();
  const sessionId = new URL(request.url).searchParams.get("sessionId");

  const filter = authUserId
    ? `auth_user_id=eq.${encodeURIComponent(authUserId)}`
    : sessionId
      ? `session_id=eq.${encodeURIComponent(sessionId)}`
      : null;
  if (!filter) return NextResponse.json({ reminders: [] });

  const res = await fetch(
    `${url}/rest/v1/reminders?${filter}&status=eq.pending&select=id,title,due_at,timezone&order=due_at.asc.nullslast&limit=30`,
    { headers: adminHeaders(serviceRoleKey) },
  );
  if (!res.ok) return NextResponse.json({ reminders: [] });
  return NextResponse.json({ reminders: await res.json() });
}

export async function PATCH(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateErr = await checkRateLimit(request);
  if (rateErr) return rateErr;
  let body: {
    id?: unknown;
    status?: unknown;
    dueAtIso?: unknown;
    sessionId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : null;
  const status =
    body.status === "done" || body.status === "cancelled" ? body.status : null;
  // Late time-merge: "remind me to X" with no time, then a bare "9 AM
  // tomorrow" follow-up sets due_at on the reminder it created (2026-06-11 —
  // G's trash reminder saved with due_at null and could never fire).
  const dueAtIso =
    typeof body.dueAtIso === "string" && !Number.isNaN(Date.parse(body.dueAtIso))
      ? new Date(body.dueAtIso).toISOString()
      : null;
  if (!id || (!status && !dueAtIso)) {
    return NextResponse.json({ error: "id + status or dueAtIso required" }, { status: 400 });
  }
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const authUserId = await getUserId();
  // Ownership guard (hardened 2026-06-11 review): signed-in = their rows only.
  // Anonymous = must present the creating session's id AND can only touch
  // anonymous rows — a bare reminder UUID is no longer a write credential.
  let guard: string;
  if (authUserId) {
    guard = `&auth_user_id=eq.${encodeURIComponent(authUserId)}`;
  } else {
    const sessionId =
      typeof body.sessionId === "string" && body.sessionId
        ? body.sessionId.slice(0, 200)
        : null;
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }
    guard = `&auth_user_id=is.null&session_id=eq.${encodeURIComponent(sessionId)}`;
  }
  const patch: Record<string, string> = { updated_at: new Date().toISOString() };
  if (status) patch.status = status;
  if (dueAtIso) patch.due_at = dueAtIso;
  const res = await fetch(
    `${url}/rest/v1/reminders?id=eq.${encodeURIComponent(id)}${guard}`,
    {
      method: "PATCH",
      headers: adminHeaders(serviceRoleKey),
      body: JSON.stringify(patch),
    },
  );
  return NextResponse.json({ ok: res.ok });
}
