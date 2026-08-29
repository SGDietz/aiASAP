import {
  MAX_TRANSCRIPTION_TEXT_CHARS,
  assertAllowedOrigin,
  isSafeTranscriptionSessionId,
  truncateUtf8String,
} from "../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";
import { isPostgrestMissingColumnError } from "../../../../src/lib/appEventEnvelope";
import {
  FRAGMENT_SOURCE,
  linkPiecesToTurns,
} from "../../../../src/lib/transcript/fragmentLink";

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
    if (role === "user" && utteranceId) {
      // Back-link (2026-08-21). The provider's pieces of THIS turn usually reach
      // the table before this row: the 20 s transcript-sync poll beats this
      // fire-and-forget log by 0.1-20 s (03aef2a8: pieces at 01:07:05.070, this
      // row at 01:07:05.186), so they were stored with utterance_id NULL. Fill
      // that NULL now so readers fold them under this sentence. Fills only
      // NULLs, deletes nothing, and can never fail the insert that already
      // succeeded. Awaited, not void: Vercel freezes work that outlives the
      // response (see link-session's after() note).
      try {
        await backLinkProviderPieces({ url, serviceRoleKey, sessionId, utteranceId, message });
      } catch (e) {
        console.error("[voice-mode:log-turn] back-link failed", e);
      }
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

// How far back a piece of THIS turn can sit. The browser's final lands 0.7-3 s
// after the provider's last piece and 10-20 s after its first (03aef2a8); 90 s
// is the same "after" window fragmentLink.ts uses for the user role.
const BACK_LINK_LOOKBACK_S = 90;

async function backLinkProviderPieces(args: {
  url: string;
  serviceRoleKey: string;
  sessionId: string;
  utteranceId: string;
  message: string;
}): Promise<number> {
  const { url, serviceRoleKey, sessionId, utteranceId, message } = args;
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
  const nowMs = Date.now();
  const sinceLa = Math.floor(nowMs / 1000) - BACK_LINK_LOOKBACK_S;
  const res = await fetch(
    `${url}/rest/v1/conversation_messages?session_id=eq.${encodeURIComponent(sessionId)}` +
      `&role=eq.user&source=eq.${FRAGMENT_SOURCE}&utterance_id=is.null` +
      `&la_absolute_timestamp=gte.${sinceLa}` +
      `&select=id,message,la_absolute_timestamp&order=la_absolute_timestamp.asc&limit=100`,
    { method: "GET", headers },
  );
  if (!res.ok) return 0;
  const pieces = (await res.json()) as Array<{
    id: string;
    message: string | null;
    la_absolute_timestamp: number;
  }>;
  if (!Array.isArray(pieces) || pieces.length === 0) return 0;
  const links = linkPiecesToTurns(
    pieces
      .filter((p) => typeof p.id === "string" && typeof p.la_absolute_timestamp === "number")
      .map((p) => ({
        key: p.id,
        role: "user" as const,
        message: p.message ?? "",
        la_absolute_timestamp: p.la_absolute_timestamp,
      })),
    [
      {
        role: "user",
        message,
        utterance_id: utteranceId,
        created_at: new Date(nowMs).toISOString(),
      },
    ],
  );
  if (links.length === 0) return 0;
  const ids = links.map((l) => l.key);
  // utterance_id=is.null in the filter makes this race-safe against a sync
  // that linked the same piece a moment ago: a filled id is never overwritten.
  const patch = await fetch(
    `${url}/rest/v1/conversation_messages?id=in.(${ids.map(encodeURIComponent).join(",")})&utterance_id=is.null`,
    {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ utterance_id: utteranceId }),
    },
  );
  if (!patch.ok) {
    console.error(
      "[voice-mode:log-turn] back-link patch failed",
      patch.status,
      (await patch.text()).slice(0, 200),
    );
    return 0;
  }
  console.log(
    `[transcript-link] session ${sessionId}: back-linked ${ids.length} piece(s) to ${utteranceId}`,
  );
  return ids.length;
}
