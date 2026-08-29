import { NextResponse } from "next/server";
import { getUser } from "../../../../src/lib/auth/getUser";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";
import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../src/lib/rateLimit";

/**
 * Durable list persistence (2026-06-13, G dogfood: "next time I open you, the
 * Walmart list comes up exactly like this, right?" — 6 promised it; it wasn't
 * true). A signed-in user's lists + active-list pointer are saved to
 * user_metadata.assistant_lists so they come back EXACTLY next session. GoTrue
 * merges metadata keys, so this never clobbers full_name / timezone / zip /
 * ui_size_level. Anonymous users stay in-memory only (no account to save to).
 *
 * The LOAD/restore side already exists: /api/account/me reads this back and the
 * client calls setAssistantLists() on return.
 */
export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  let body: { lists?: unknown; resumeState?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  // Accept only a sane array of lists; cap count so user_metadata never bloats.
  const lists = Array.isArray(body.lists) ? body.lists.slice(0, 30) : [];
  const resumeState =
    body.resumeState &&
    typeof body.resumeState === "object" &&
    !Array.isArray(body.resumeState)
      ? body.resumeState
      : null;

  const saved = { lists, resumeState, savedAt: new Date().toISOString() };
  // Hard size guard: user_metadata must stay small. Reject absurd payloads.
  if (JSON.stringify(saved).length > 60_000) {
    return NextResponse.json({ ok: false, error: "too large" }, { status: 413 });
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
      body: JSON.stringify({ user_metadata: { assistant_lists: saved } }),
    },
  );
  if (!res.ok) {
    console.error("list save failed", res.status);
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
