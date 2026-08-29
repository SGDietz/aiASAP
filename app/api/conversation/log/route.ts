import {
  MAX_TRANSCRIPTION_TEXT_CHARS,
  assertAllowedOrigin,
  isSafeTranscriptionSessionId,
  truncateUtf8String,
} from "../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";
import { normalizeTesterLabel } from "../../../../src/lib/testerAttribution";

type SpeakerRole = "user" | "assistant";

function supabaseHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

function isSpeakerRole(value: unknown): value is SpeakerRole {
  return value === "user" || value === "assistant";
}

async function ensureParentSession(
  url: string,
  serviceRoleKey: string,
  sessionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(
      `${url}/rest/v1/conversation_sessions?on_conflict=session_id`,
      {
        method: "POST",
        headers: {
          ...supabaseHeaders(serviceRoleKey),
          Prefer: "resolution=ignore-duplicates,return=minimal",
        },
        body: JSON.stringify({
          session_id: sessionId,
          source: "liveavatar",
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: detail.slice(0, 400) };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const body = await request.json();
    const { sessionId: rawSessionId, text: rawText, role } = body;

    if (!isSafeTranscriptionSessionId(rawSessionId)) {
      return new Response(JSON.stringify({ error: "Invalid sessionId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!isSpeakerRole(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (typeof rawText !== "string" || !rawText.trim()) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sessionId = rawSessionId.trim();
    const text = truncateUtf8String(rawText.trim(), MAX_TRANSCRIPTION_TEXT_CHARS);
    const testerLabel = normalizeTesterLabel(body.testerLabel);
    const { url, serviceRoleKey } = getSupabaseAdminConfig();

    // Parent persistence is idempotent and precedes the child attempt. A
    // parent failure is surfaced without throwing away the transcript line.
    const parentOutcome = await ensureParentSession(
      url,
      serviceRoleKey,
      sessionId,
    );
    if (!parentOutcome.ok) {
      console.error(
        "conversation_sessions parent upsert failed:",
        parentOutcome.error,
      );
    }

    const res = await fetch(`${url}/rest/v1/conversation_messages`, {
      method: "POST",
      headers: supabaseHeaders(serviceRoleKey),
      body: JSON.stringify({
        session_id: sessionId,
        role,
        message: text,
        ...(testerLabel ? { tester_label: testerLabel } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Failed storing conversation message:", detail);
      return new Response(
        JSON.stringify({ error: "Failed to store conversation message" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, parentPersisted: parentOutcome.ok }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error storing conversation message:", error);
    return new Response(
      JSON.stringify({ error: "Failed to store conversation message" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
