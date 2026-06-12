import {
  MAX_TRANSCRIPTION_TEXT_CHARS,
  assertAllowedOrigin,
  isSafeTranscriptionSessionId,
  truncateUtf8String,
} from "../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";

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
    };
    const sessionId = body.sessionId ?? "";
    const role = body.role === "assistant" ? "assistant" : "user";
    const message =
      typeof body.message === "string"
        ? truncateUtf8String(body.message.trim(), MAX_TRANSCRIPTION_TEXT_CHARS)
        : "";
    if (!isSafeTranscriptionSessionId(sessionId) || !message) {
      return new Response(JSON.stringify({ error: "bad payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const res = await fetch(`${url}/rest/v1/conversation_messages`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ session_id: sessionId, role, message }),
    });
    if (!res.ok) {
      const detail = await res.text();
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
