import {
  MAX_TRANSCRIPTION_TEXT_CHARS,
  assertAllowedOrigin,
  isSafeTranscriptionSessionId,
  truncateUtf8String,
} from "../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";
import { isPostgrestMissingColumnError } from "../../../../src/lib/appEventEnvelope";

// Voice-list mode transcript logging (2026-06-11 r19). While the avatar is
// stopped, turns never reach LiveAvatar's official transcript — they'd vanish
// from conversation_messages and G's sup debugging loop ("we will learn from
// real experience"). This writes them straight into the same table the
// avatar-leg sync fills, under the same session id.

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const body = (await request.json()) as {
      sessionId?: string;
      role?: string;
      message?: string;
      eventId?: string;
      utteranceId?: string;
    };
    const sessionId = body.sessionId ?? "";
    const role = body.role === "assistant" ? "assistant" : "user";
    const message =
      typeof body.message === "string"
        ? truncateUtf8String(body.message.trim(), MAX_TRANSCRIPTION_TEXT_CHARS)
        : "";
    const eventId =
      typeof body.eventId === "string" &&
      /^[A-Za-z0-9:_-]{1,200}$/.test(body.eventId)
        ? body.eventId
        : null;
    const utteranceId =
      typeof body.utteranceId === "string" &&
      /^[A-Za-z0-9_-]{1,200}$/.test(body.utteranceId)
        ? body.utteranceId
        : null;
    if (!isSafeTranscriptionSessionId(sessionId) || !message) {
      return new Response(JSON.stringify({ error: "bad payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const endpoint = eventId
      ? `${url}/rest/v1/conversation_messages?on_conflict=event_id`
      : `${url}/rest/v1/conversation_messages`;
    let res = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: eventId
          ? "resolution=ignore-duplicates,return=minimal"
          : "return=minimal",
      },
      body: JSON.stringify({
        session_id: sessionId,
        role,
        message,
        event_id: eventId,
        utterance_id: utteranceId,
      }),
    });
    let detail = res.ok ? "" : await res.text();
    if (
      !res.ok &&
      (eventId || utteranceId) &&
      isPostgrestMissingColumnError(res.status, detail, [
        "event_id",
        "utterance_id",
      ])
    ) {
      // Backward-compatible only when the additive columns are genuinely absent.
      res = await fetch(`${url}/rest/v1/conversation_messages`, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ session_id: sessionId, role, message }),
      });
      detail = res.ok ? "" : await res.text();
    }
    if (!res.ok) {
      console.error("[voice-mode:log-turn] insert failed", res.status, detail.slice(0, 200));
      return new Response(JSON.stringify({ error: "insert failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[voice-mode:log-turn] failed", e);
    return new Response(JSON.stringify({ error: "failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
