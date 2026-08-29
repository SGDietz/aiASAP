import { NextResponse, type NextRequest } from "next/server";
import { assertAllowedOrigin, isSafeTranscriptionSessionId } from "../../../src/lib/apiRouteSecurity";
import { getUser } from "../../../src/lib/auth/getUser";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { getSupabaseAdminConfig } from "../../../src/lib/supabaseAdmin";
import { normalizeTesterLabel } from "../../../src/lib/testerAttribution";
import {
  EMPTY_OPPORTUNITY_STATE,
  buildMinimalAlertPayload,
  isOperatorTraffic,
  reduceOpportunity,
  shouldQueueUnfinished,
  type OpportunityEndReason,
  type OpportunityState,
} from "../../../src/lib/opportunityWatchdog";

type WatchdogAction =
  | "session_started"
  | "turn"
  | "contact_captured"
  | "submit_contact"
  | "account_created"
  | "build_submitted"
  | "declined"
  | "terminal"
  | "reconnect";

type Row = {
  id: string;
  session_id: string;
  visitor_state: OpportunityState["visitorState"];
  opportunity_state: OpportunityState["opportunityState"];
  contact_state: OpportunityState["contactState"] | "confirming" | "saving" | "failed";
  account_state: OpportunityState["accountState"] | "offered" | "declined";
  discovery_stage: string;
  terminal_at: string | null;
  grace_until: string | null;
  end_reason: OpportunityEndReason | null;
  summary: OpportunityState["summary"];
  operator_excluded: boolean;
};

const ACTIONS = new Set<WatchdogAction>([
  "session_started", "turn", "contact_captured", "submit_contact", "account_created",
  "build_submitted", "declined", "terminal", "reconnect",
]);

function headers(key: string, prefer = "return=representation") {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: prefer };
}

function stateFromRow(row: Row): OpportunityState {
  return {
    visitorState: row.visitor_state,
    opportunityState: row.opportunity_state,
    contactState: row.contact_state === "submitted" ? "submitted" : row.contact_state === "captured" ? "captured" : "absent",
    accountState: row.account_state === "created" ? "created" : "anonymous",
    discoveryStage: row.discovery_stage,
    terminalAt: row.terminal_at ? Date.parse(row.terminal_at) : null,
    graceUntil: row.grace_until ? Date.parse(row.grace_until) : null,
    endReason: row.end_reason,
    summary: row.summary ?? { meaningfulTurns: 0 },
  };
}

function rowPatch(state: OpportunityState) {
  return {
    visitor_state: state.visitorState,
    opportunity_state: state.opportunityState,
    contact_state: state.contactState,
    account_state: state.accountState,
    discovery_stage: state.discoveryStage,
    terminal_at: state.terminalAt ? new Date(state.terminalAt).toISOString() : null,
    grace_until: state.graceUntil ? new Date(state.graceUntil).toISOString() : null,
    end_reason: state.endReason,
    summary: state.summary,
  };
}

function schemaUnavailable(status: number, detail: string): boolean {
  return status === 404 || /visitor_opportunities|submit_opportunity_contact|schema cache|does not exist/i.test(detail);
}

function safeReferrer(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`.slice(0, 300);
  } catch {
    return null;
  }
}

async function getRow(url: string, key: string, sessionId: string): Promise<Row | null> {
  const res = await fetch(`${url}/rest/v1/visitor_opportunities?session_id=eq.${encodeURIComponent(sessionId)}&select=*&limit=1`, { headers: headers(key) });
  if (!res.ok) {
    const detail = await res.text();
    if (schemaUnavailable(res.status, detail)) throw new Error("WATCHDOG_SCHEMA_NOT_APPLIED");
    throw new Error(`watchdog read failed ${res.status}`);
  }
  const rows = (await res.json()) as Row[];
  return rows[0] ?? null;
}

async function queueOutbox(url: string, key: string, row: Row, kind: "new_visitor" | "unfinished_opportunity", payload: Record<string, unknown>) {
  const dedupeKey = `${kind}:${row.id}`;
  const res = await fetch(`${url}/rest/v1/opportunity_notification_outbox?on_conflict=dedupe_key`, {
    method: "POST",
    headers: headers(key, "resolution=ignore-duplicates,return=minimal"),
    body: JSON.stringify({ opportunity_id: row.id, event_kind: kind, dedupe_key: dedupeKey, payload, status: "queued" }),
  });
  if (!res.ok) {
    const detail = await res.text();
    if (schemaUnavailable(res.status, detail)) throw new Error("WATCHDOG_SCHEMA_NOT_APPLIED");
    throw new Error(`watchdog outbox failed ${res.status}`);
  }
}

export async function POST(request: NextRequest) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const limitErr = await checkRateLimit(request);
  if (limitErr) return limitErr;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "valid JSON required" }, { status: 400 });
  }
  const action = body?.action;
  const sessionId = typeof body?.session_id === "string" ? body.session_id : "";
  if (!ACTIONS.has(action as WatchdogAction) || !isSafeTranscriptionSessionId(sessionId)) {
    return NextResponse.json({ error: "valid action and session_id required" }, { status: 400 });
  }

  const user = await getUser();
  const host = request.headers.get("host");
  const operatorExcluded = isOperatorTraffic({
    authenticatedUserId: user?.id,
    authenticatedEmail: user?.email,
    operatorUserIds: process.env.AIASAP_OPERATOR_USER_IDS,
    operatorEmails: process.env.AIASAP_OPERATOR_EMAILS,
    signedMarker: request.cookies.get("aiasap_operator")?.value ?? null,
    markerSecret: process.env.AIASAP_OPERATOR_MARKER_SECRET,
    hostname: host,
    forwardedFor: request.headers.get("x-forwarded-for"),
  });
  const testerLabel = normalizeTesterLabel(body.tester_label);
  const conversationSessionId = typeof body.conversation_session_id === "string" && isSafeTranscriptionSessionId(body.conversation_session_id)
    ? body.conversation_session_id : null;
  let url: string;
  let serviceRoleKey: string;
  try {
    ({ url, serviceRoleKey } = getSupabaseAdminConfig());
  } catch {
    return NextResponse.json({ ok: false, state: "storage_unavailable", submitted: false }, { status: 503 });
  }

  try {
    let row = await getRow(url, serviceRoleKey, sessionId);
    if (!row) {
      const deviceClass = body.device_class === "phone" ? "phone" : body.device_class === "computer" ? "computer" : null;
      const referrer = safeReferrer(body.referrer);
      const insert = await fetch(`${url}/rest/v1/visitor_opportunities?on_conflict=session_id`, {
        method: "POST",
        headers: headers(serviceRoleKey, "resolution=ignore-duplicates,return=representation"),
        body: JSON.stringify({
          session_id: sessionId,
          conversation_session_id: conversationSessionId,
          user_id: user?.id ?? null,
          tester_label: testerLabel,
          operator_excluded: operatorExcluded,
          visitor_state: "detected",
          summary: { meaningfulTurns: 0, device_class: deviceClass, referrer },
        }),
      });
      if (!insert.ok) {
        const detail = await insert.text();
        if (schemaUnavailable(insert.status, detail)) throw new Error("WATCHDOG_SCHEMA_NOT_APPLIED");
        throw new Error(`watchdog insert failed ${insert.status}`);
      }
      const inserted = (await insert.json()) as Row[];
      row = inserted[0] ?? await getRow(url, serviceRoleKey, sessionId);
      if (!row) throw new Error("watchdog row unavailable");
      if (!operatorExcluded) {
        await queueOutbox(url, serviceRoleKey, row, "new_visitor", {
          opportunityId: row.id,
          sessionReviewRef: `/admin/sessions/${encodeURIComponent(sessionId)}`,
          arrivalTime: new Date().toISOString(),
          anonymous: !user,
          testerLabel,
          deviceClass,
          referrer,
        });
      }
    }
    if (row.operator_excluded || operatorExcluded) {
      return NextResponse.json({ ok: true, state: "operator_excluded", submitted: false });
    }

    if (action === "submit_contact") {
      const method = body.method === "email" || body.method === "phone" ? body.method : null;
      const value = typeof body.value === "string" ? body.value.trim() : "";
      if (!method || !value) return NextResponse.json({ error: "confirmed contact required", submitted: false }, { status: 400 });
      const rpc = await fetch(`${url}/rest/v1/rpc/submit_opportunity_contact`, {
        method: "POST",
        headers: headers(serviceRoleKey),
        body: JSON.stringify({
          p_session_id: sessionId,
          p_conversation_session_id: conversationSessionId,
          p_method: method,
          p_value: value,
          p_full_name: typeof body.full_name === "string" ? body.full_name.slice(0, 200) : null,
          p_source_text: "explicitly confirmed voice follow-up contact",
          p_tester_label: testerLabel,
        }),
      });
      if (!rpc.ok) {
        const detail = await rpc.text();
        if (schemaUnavailable(rpc.status, detail)) throw new Error("WATCHDOG_SCHEMA_NOT_APPLIED");
        return NextResponse.json({ ok: false, state: "failed", submitted: false }, { status: 502 });
      }
      const data = await rpc.json();
      return NextResponse.json({ ok: true, state: "submitted", submitted: true, opportunity_id: data?.opportunity_id ?? null });
    }

    const now = Date.now();
    let state = stateFromRow(row);
    if (action === "session_started") {
      state = state.graceUntil !== null
        ? reduceOpportunity(state, { kind: "reconnect", at: now })
        : reduceOpportunity(state, { kind: "session_started", at: now });
    }
    else if (action === "turn") {
      const text = typeof body.text === "string" ? body.text.slice(0, 2000) : "";
      state = reduceOpportunity(state, { kind: "turn", at: now, text });
    } else if (action === "contact_captured") {
      const method = body.method === "phone" ? "phone" : "email";
      state = reduceOpportunity(state, { kind: "contact_captured", at: now, method });
    } else if (action === "account_created") state = reduceOpportunity(state, { kind: "account_created", at: now });
    else if (action === "build_submitted") state = reduceOpportunity(state, { kind: "build_submitted", at: now });
    else if (action === "declined") state = reduceOpportunity(state, { kind: "declined", at: now });
    else if (action === "reconnect") state = reduceOpportunity(state, { kind: "reconnect", at: now });
    else if (action === "terminal") {
      const reason: OpportunityEndReason = body.reason === "idle_timeout" || body.reason === "disconnect" || body.reason === "clean_end" ? body.reason : "explicit_stop";
      state = reduceOpportunity(state, { kind: "terminal", at: now, reason });
    }

    const update = await fetch(`${url}/rest/v1/visitor_opportunities?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH", headers: headers(serviceRoleKey),
      body: JSON.stringify({ ...rowPatch(state), conversation_session_id: conversationSessionId ?? undefined, user_id: user?.id ?? undefined }),
    });
    if (!update.ok) throw new Error(`watchdog update failed ${update.status}`);

    if (shouldQueueUnfinished(state, now)) {
      await queueOutbox(url, serviceRoleKey, row, "unfinished_opportunity", buildMinimalAlertPayload(row.id, sessionId, state));
      if (["draft", "build_interest", "contact_captured"].includes(state.opportunityState)) {
        state = { ...state, opportunityState: "abandoned" };
        await fetch(`${url}/rest/v1/visitor_opportunities?id=eq.${encodeURIComponent(row.id)}`, {
          method: "PATCH",
          headers: headers(serviceRoleKey, "return=minimal"),
          body: JSON.stringify({ opportunity_state: "abandoned", visitor_state: "abandoned" }),
        });
      }
    }
    return NextResponse.json({ ok: true, state: state.opportunityState, submitted: state.opportunityState === "submitted" });
  } catch (error) {
    if (error instanceof Error && error.message === "WATCHDOG_SCHEMA_NOT_APPLIED") {
      return NextResponse.json({ ok: false, state: "schema_not_applied", submitted: false }, { status: 503 });
    }
    console.error("[opportunity-watchdog] failed", error);
    return NextResponse.json({ ok: false, state: "failed", submitted: false }, { status: 500 });
  }
}
