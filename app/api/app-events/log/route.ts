import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { getUserId } from "../../../../src/lib/auth/getUser";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";
import {
  isPostgrestMissingColumnError,
  parseAppEventEnvelope,
  parseClientTimestamp,
} from "../../../../src/lib/appEventEnvelope";
import {
  assertAllowedOrigin,
  isSafeTranscriptionSessionId,
} from "../../../../src/lib/apiRouteSecurity";
import { normalizeTesterLabel } from "../../../../src/lib/testerAttribution";

// Product telemetry ingest (2026-06-12, G: "make sup record all these
// things"). Append-only writes to public.app_events via service role.
// Best-effort by design: this endpoint never returns an error for a write
// failure — telemetry must never teach the client to retry-loop.

const MAX_TYPE = 100;
const MAX_ROUTE = 1000;
const MAX_PAYLOAD_BYTES = 24000;
// The live table's CHECK constraint: critical | high | medium | low.
const VALID_SEVERITIES = new Set(["critical", "high", "medium", "low"]);

const ENRICHED_COLUMNS = [
  "user_id",
  "tester_label",
  "client_timestamp",
  "severity",
  "provider",
  "status_code",
  "event_id",
  "utterance_id",
  "trace_id",
  "parent_event_id",
  "idempotency_key",
  "mutation_version",
  "outcome",
  "error_code",
  "duration_ms",
  "provider_request_id",
] as const;

function definedEntries(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== null),
  );
}

export async function POST(request: NextRequest) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const limitErr = await checkRateLimit(request);
  if (limitErr) return limitErr;

  let body: Record<string, unknown>;
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
  const envelope = parseAppEventEnvelope(body);
  const sessionId =
    typeof body.session_id === "string" ? body.session_id.slice(0, 200) : null;
  if (sessionId && !isSafeTranscriptionSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid session_id" }, { status: 400 });
  }
  const testerLabel = normalizeTesterLabel(body.tester_label);
  const clientTimestamp = parseClientTimestamp(body.client_timestamp);

  let url: string;
  let serviceRoleKey: string;
  try {
    ({ url, serviceRoleKey } = getSupabaseAdminConfig());
  } catch {
    return NextResponse.json({ ok: false });
  }

  try {
    const baseRow = {
      session_id: sessionId,
      user_id: userId,
      tester_label: testerLabel,
      client_timestamp: clientTimestamp,
      event_type: body.event_type.slice(0, MAX_TYPE),
      severity: VALID_SEVERITIES.has(body.severity as string)
        ? (body.severity as string)
        : "low",
      provider:
        typeof body.provider === "string"
          ? body.provider.slice(0, 100)
          : "client",
      route:
        typeof body.route === "string"
          ? body.route.slice(0, MAX_ROUTE)
          : null,
      status_code: envelope.status_code,
      // Which deployment wrote this row (production / preview / development).
      // The cloud watcher filters on it so G's dev rides never read as trouble.
      payload: { ...payload, user_agent: userAgent, env: process.env.VERCEL_ENV ?? "development" },
    };
    const enrichedRow = { ...baseRow, ...envelope };
    const endpoint = envelope.event_id
      ? `${url}/rest/v1/app_events?on_conflict=event_id`
      : `${url}/rest/v1/app_events`;
    const enrichedResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: envelope.event_id
          ? "resolution=ignore-duplicates,return=minimal"
          : "return=minimal",
      },
      body: JSON.stringify(enrichedRow),
    });

    // Local code may run before the additive migration is applied remotely.
    // Retry only a verified schema-cache miss. Retrying auth, policy, conflict,
    // validation, or outage failures could create duplicate audit rows.
    let enrichedDetail = enrichedResponse.ok
      ? ""
      : await enrichedResponse.text().catch(() => "");
    if (
      !enrichedResponse.ok &&
      isPostgrestMissingColumnError(enrichedResponse.status, enrichedDetail, [
        ...ENRICHED_COLUMNS,
      ])
    ) {
      // The confirmed live schema has only session_id, created_at, event_type,
      // route, and payload. Keep timing/correlation in payload without copying
      // authenticated IDs, user-agent data, or arbitrary transcript content.
      const minimalRow = {
        session_id: baseRow.session_id,
        event_type: baseRow.event_type,
        route: baseRow.route,
        payload: definedEntries({
          stage: typeof payload.stage === "string" ? payload.stage : null,
          mode: typeof payload.mode === "string" ? payload.mode : null,
          event_id: envelope.event_id,
          utterance_id: envelope.utterance_id,
          trace_id: envelope.trace_id,
          parent_event_id: envelope.parent_event_id,
          idempotency_key: envelope.idempotency_key,
          mutation_version: envelope.mutation_version,
          outcome: envelope.outcome,
          error_code: envelope.error_code,
          status_code: envelope.status_code,
          duration_ms: envelope.duration_ms,
          provider: baseRow.provider,
          provider_request_id: envelope.provider_request_id,
        }),
      };
      const legacyResponse = await fetch(`${url}/rest/v1/app_events`, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(minimalRow),
      });
      if (!legacyResponse.ok) {
        enrichedDetail = await legacyResponse.text().catch(() => "");
        console.warn(
          "[app-events] legacy insert skipped",
          legacyResponse.status,
          enrichedDetail.slice(0, 200),
        );
      }
    } else if (!enrichedResponse.ok) {
      console.warn(
        "[app-events] enriched insert skipped",
        enrichedResponse.status,
        enrichedDetail.slice(0, 200),
      );
    }
  } catch {
    // Best-effort.
  }

  return NextResponse.json({ ok: true });
}
