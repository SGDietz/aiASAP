import {
  MAX_TRANSCRIPTION_TEXT_CHARS,
  assertAllowedOrigin,
  isSafeTranscriptionSessionId,
  truncateUtf8String,
} from "../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";

type SpeakerRole = "user" | "assistant";
type ConversationLogEntry = {
  sessionId: string;
  text: string;
  role: SpeakerRole;
  source?: string | null;
};

const MAX_BATCH_ENTRIES = 60;

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

function cleanLogSource(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const source = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_:-]{0,40}$/.test(source)) return null;
  return source;
}

function normalizeEntry(value: unknown): ConversationLogEntry | { error: string } {
  if (!value || typeof value !== "object") {
    return { error: "Invalid entry" };
  }
  const body = value as Record<string, unknown>;
  const { sessionId: rawSessionId, text: rawText, role } = body;
  const source = cleanLogSource(body?.source);

  if (!isSafeTranscriptionSessionId(rawSessionId)) {
    return { error: "Invalid sessionId" };
  }
  if (!isSpeakerRole(role)) {
    return { error: "Invalid role" };
  }
  if (typeof rawText !== "string" || !rawText.trim()) {
    return { error: "text is required" };
  }

  return {
    sessionId: rawSessionId.trim(),
    role,
    text: truncateUtf8String(rawText.trim(), MAX_TRANSCRIPTION_TEXT_CHARS),
    source,
  };
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const body = await request.json();
    const rawEntries = Array.isArray(body?.entries)
      ? body.entries.slice(0, MAX_BATCH_ENTRIES)
      : [body];
    const entries: ConversationLogEntry[] = [];

    for (const rawEntry of rawEntries) {
      const entry = normalizeEntry(rawEntry);
      if ("error" in entry) {
        return new Response(JSON.stringify({ error: entry.error }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      entries.push(entry);
    }

    const { url, serviceRoleKey } = getSupabaseAdminConfig();

    const res = await fetch(`${url}/rest/v1/conversation_messages`, {
      method: "POST",
      headers: supabaseHeaders(serviceRoleKey),
      body: JSON.stringify(
        entries.map((entry) => ({
          session_id: entry.sessionId,
          role: entry.role,
          message: entry.text,
          ...(entry.source ? { source: entry.source } : {}),
        })),
      ),
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

    return new Response(JSON.stringify({ ok: true, stored: entries.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
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
