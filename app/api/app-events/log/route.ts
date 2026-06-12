import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { getUserId } from "../../../../src/lib/auth/getUser";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";

// Product telemetry ingest (2026-06-12, G: "make sup record all these
// things"). Append-only writes to public.app_events via service role.
// Best-effort by design: this endpoint never returns an error for a write
// failure — telemetry must never teach the client to retry-loop.

const MAX_TYPE = 100;
const MAX_ROUTE = 1000;
const MAX_PAYLOAD_BYTES = 24000;
// The live table's CHECK constraint: critical | high | medium | low.
const VALID_SEVERITIES = new Set(["critical", "high", "medium", "low"]);

export async function POST(request: NextRequest) {
  const limitErr = await checkRateLimit(request);
  if (limitErr) return limitErr;

  let body: {
    event_type?: unknown;
    severity?: unknown;
    session_id?: unknown;
    route?: unknown;
    payload?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (typeof body?.event_type !== "string" || !body.event_type.trim()) {
    return NextResponse.json(
      { error: "event_type required" },
      { status: 400 },
    );
  }

  let payload: Record<string, unknown> = {};
  if (body.payload && typeof body.payload === "object") {
    try {
      const json = JSON.stringify(body.payload);
      payload =
        json.length > MAX_PAYLOAD_BYTES
          ? { _truncated: true, _bytes: json.length }
          : (body.payload as Record<string, unknown>);
    } catch {
      payload = { _unserializable: true };
    }
  }

  const userId = await getUserId();
  const userAgent = request.headers.get("user-agent") ?? null;

  let url: string;
  let serviceRoleKey: string;
  try {
    ({ url, serviceRoleKey } = getSupabaseAdminConfig());
  } catch {
    return NextResponse.json({ ok: false });
  }

  try {
    await fetch(`${url}/rest/v1/app_events`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        session_id:
          typeof body.session_id === "string"
            ? body.session_id.slice(0, 200)
            : null,
        event_type: body.event_type.slice(0, MAX_TYPE),
        severity: VALID_SEVERITIES.has(body.severity as string)
          ? (body.severity as string)
          : "low",
        provider: "client",
        route:
          typeof body.route === "string"
            ? body.route.slice(0, MAX_ROUTE)
            : null,
        // The live table has no user_id/user_agent columns — ride in payload.
        payload: { ...payload, user_id: userId, user_agent: userAgent },
      }),
    });
  } catch {
    // Best-effort.
  }

  return NextResponse.json({ ok: true });
}
