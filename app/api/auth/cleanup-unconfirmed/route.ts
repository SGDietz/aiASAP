import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";

/**
 * Cleanup endpoint — deletes auth.users rows where email was never confirmed
 * and the row is older than 24 hours.
 *
 * Per G 2026-05-21: "If someone does not click through the magic link...
 * the email should be struck from the system." A user who started signup
 * but never clicked the confirmation link should NOT be retained as a
 * member — they should be able to re-attempt later as if for the first time.
 *
 * Wired to Vercel cron in vercel.json (daily at 06:00 UTC).
 *
 * Security: requires the request to either:
 *  - Come from Vercel cron (User-Agent: vercel-cron/1.0)
 *  - Or carry a Bearer token matching CRON_SECRET env var
 * to prevent random calls from triggering mass deletes.
 */
const STALE_HOURS = 24;

function isAuthorized(request: NextRequest): boolean {
  // Vercel cron jobs send a specific User-Agent.
  const ua = request.headers.get("user-agent") ?? "";
  if (ua.toLowerCase().includes("vercel-cron")) return true;

  // Allow manual invocation with a shared secret (e.g., for testing).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth === `Bearer ${secret}`) return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let url: string;
  let serviceRoleKey: string;
  try {
    ({ url, serviceRoleKey } = getSupabaseAdminConfig());
  } catch {
    return NextResponse.json({ error: "supabase not configured" }, { status: 500 });
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  // Fetch list of users to identify candidates. The admin API doesn't
  // expose a filter directly so we scan + filter client-side.
  const listRes = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, {
    method: "GET",
    headers,
  });
  if (!listRes.ok) {
    const detail = await listRes.text();
    return NextResponse.json(
      { error: `failed to list users: ${listRes.status}`, detail: detail.slice(0, 200) },
      { status: 500 },
    );
  }
  const listJson = (await listRes.json()) as { users?: Array<Record<string, unknown>> };
  const users = listJson.users ?? [];

  const cutoffMs = Date.now() - STALE_HOURS * 60 * 60 * 1000;
  const candidates = users.filter((u) => {
    const created = typeof u.created_at === "string" ? Date.parse(u.created_at) : NaN;
    const confirmed = u.email_confirmed_at;
    return (
      Number.isFinite(created) &&
      created < cutoffMs &&
      (confirmed === null || confirmed === undefined || confirmed === "")
    );
  });

  const deleted: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];

  for (const u of candidates) {
    const id = typeof u.id === "string" ? u.id : null;
    if (!id) continue;
    try {
      const delRes = await fetch(`${url}/auth/v1/admin/users/${id}`, {
        method: "DELETE",
        headers,
      });
      if (delRes.ok) {
        deleted.push(id);
      } else {
        const detail = await delRes.text();
        failed.push({ id, reason: `${delRes.status}: ${detail.slice(0, 100)}` });
      }
    } catch (e) {
      failed.push({ id, reason: String(e) });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: users.length,
    candidates: candidates.length,
    deleted: deleted.length,
    failed: failed.length,
    cutoff_hours: STALE_HOURS,
  });
}
