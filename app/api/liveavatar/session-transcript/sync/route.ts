import {
  MAX_TRANSCRIPTION_TEXT_CHARS,
  assertAllowedOrigin,
  isSafeTranscriptionSessionId,
  truncateUtf8String,
} from "../../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../../src/lib/rateLimit";
import { persistUserUtteranceLeadCapture } from "../../../../../src/lib/leadCaptureFromUserText";
import { getSupabaseAdminConfig } from "../../../../../src/lib/supabaseAdmin";
import { API_KEY, API_URL } from "../../../secrets";

/** Skip lead extraction for long context lines mis-tagged as user or internal prompts. */
function shouldRunLeadCaptureOnUserTranscript(text: string): boolean {
  const t = text.trim();
  if (t.length > 500) return false;
  if (/^you are directly viewing (an image|a video)/i.test(t)) return false;
  return true;
}

type TranscriptRow = {
  role: "user" | "avatar";
  transcript: string;
  absolute_timestamp: number;
  relative_timestamp?: number;
};

function supabaseHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "resolution=ignore-duplicates,return=minimal",
  };
}

function isTranscriptRow(value: unknown): value is TranscriptRow {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (o.role !== "user" && o.role !== "avatar") return false;
  if (typeof o.transcript !== "string" || !o.transcript.trim()) return false;
  if (typeof o.absolute_timestamp !== "number" || !Number.isFinite(o.absolute_timestamp)) {
    return false;
  }
  return true;
}

function parseTranscriptPayload(json: unknown): {
  sessionActive: boolean;
  nextTimestamp: number | null;
  transcriptData: TranscriptRow[];
} | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;

  const rawList = data.transcript_data;
  if (!Array.isArray(rawList)) return null;

  const transcriptData = rawList.filter(isTranscriptRow);
  const sessionActive = Boolean(data.session_active);
  const nextTimestamp =
    typeof data.next_timestamp === "number" && Number.isFinite(data.next_timestamp)
      ? data.next_timestamp
      : null;

  return { sessionActive, nextTimestamp, transcriptData };
}

function isLiveAvatarResponseSuccess(json: unknown, httpOk: boolean): boolean {
  if (!httpOk) return false;
  if (!json || typeof json !== "object") return false;
  const code = (json as Record<string, unknown>).code;
  if (code === undefined) return true;
  return code === 100 || code === 1000;
}

function shouldSkipNativeAssistantTranscriptRow(row: TranscriptRow): boolean {
  if (row.role !== "avatar") return false;
  const text = row.transcript.replace(/\s+/g, " ").trim();
  if (!text) return true;
  if (
    /^(?:all|i|the|what else|what do|what should|looks like|go on)[.!?]?$/i.test(text) ||
    /^got it!?\s+your\s+to\b/i.test(text) ||
    /^got it!?\s+your\b.{0,20}$/i.test(text)
  ) {
    return true;
  }
  return (
    /^(?:got|got it!?|just|should|take|i'?m|i[’']?ve added|oh,?\s*by)$/i.test(text) ||
    /^(?:added|i added)(?:\s|$)/i.test(text) ||
    /^got it[.!]?\s+i[’']?ve added(?:\s|$)/i.test(text) ||
    /^hi,?\s+i(?:['\u2019]?m| am)\s+6\b/i.test(text) ||
    /^oh,?\s+by\s+the\s+way,?\s+what\s+should\s+i\s+call\s+you\??$/i.test(text) ||
    /^i\s+think[.!?]?$/i.test(text) ||
    /^(?:i(?:['\u2019]?ve)?\s+added|i\s+added|added)\s+.+\bto\s+your\b.+\blist\b/i.test(text) ||
    /^i\s+opened\s+.+\blist\b/i.test(text) ||
    /^sure thing[!.]?\s+what kind of lists do you want to (?:make|create)\?/i.test(text) ||
    /^what would you like for me to put on your .+ list\??$/i.test(text) ||
    /^i'?m here,?\s+\w+!? it sounds like there might have been a little hiccup\b/i.test(text) ||
    /\bwhat kind of lists do you want to create\?\s*a shopping list,\s*a to-?do list\b/i.test(text)
  );
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const body = await request.json();
    const { liveAvatarSessionId: rawSessionId, startTimestamp } = body;

    if (!isSafeTranscriptionSessionId(rawSessionId)) {
      return new Response(JSON.stringify({ error: "Invalid liveAvatarSessionId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (
      startTimestamp !== undefined &&
      startTimestamp !== null &&
      (typeof startTimestamp !== "number" || !Number.isFinite(startTimestamp))
    ) {
      return new Response(JSON.stringify({ error: "Invalid startTimestamp" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!API_KEY || !API_URL) {
      return new Response(
        JSON.stringify({ error: "LiveAvatar API is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const liveAvatarSessionId = rawSessionId.trim();
    const params = new URLSearchParams();
    if (typeof startTimestamp === "number" && Number.isFinite(startTimestamp)) {
      params.set("start_timestamp", String(Math.floor(startTimestamp)));
    }

    const baseUrl = API_URL.replace(/\/$/, "");
    const transcriptUrl = `${baseUrl}/v1/sessions/${encodeURIComponent(liveAvatarSessionId)}/transcript${params.toString() ? `?${params}` : ""}`;

    const laRes = await fetch(transcriptUrl, {
      method: "GET",
      headers: {
        "X-API-KEY": API_KEY,
      },
    });

    const laJson: unknown = await laRes.json().catch(() => null);

    if (!isLiveAvatarResponseSuccess(laJson, laRes.ok)) {
      console.error("LiveAvatar transcript API error:", laRes.status, laJson);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch LiveAvatar transcript",
          status: laRes.status,
        }),
        {
          status: laRes.status <= 599 ? laRes.status : 502,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const parsed = parseTranscriptPayload(laJson);
    if (!parsed) {
      return new Response(
        JSON.stringify({ error: "Unexpected transcript response shape" }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const { url, serviceRoleKey } = getSupabaseAdminConfig();

    const rows = parsed.transcriptData
      .filter((row) => !shouldSkipNativeAssistantTranscriptRow(row))
      .map((row) => ({
        session_id: liveAvatarSessionId,
        role: row.role === "avatar" ? "assistant" : "user",
        message: truncateUtf8String(row.transcript.trim(), MAX_TRANSCRIPTION_TEXT_CHARS),
        la_absolute_timestamp: Math.floor(row.absolute_timestamp),
        source: "liveavatar_api",
      }));

    if (rows.length > 0) {
      const insertRes = await fetch(
        `${url}/rest/v1/conversation_messages?on_conflict=session_id,role,la_absolute_timestamp`,
        {
          method: "POST",
          headers: supabaseHeaders(serviceRoleKey),
          body: JSON.stringify(rows),
        },
      );

      if (!insertRes.ok) {
        const detail = await insertRes.text();
        console.error("Supabase conversation_messages insert failed:", detail);
        return new Response(
          JSON.stringify({ error: "Failed to store transcript lines" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    let leadCaptureErrors = 0;
    for (const row of parsed.transcriptData) {
      if (row.role !== "user") continue;
      const line = row.transcript.trim();
      if (!line || !shouldRunLeadCaptureOnUserTranscript(line)) continue;
      try {
        await persistUserUtteranceLeadCapture(liveAvatarSessionId, line);
      } catch (err) {
        leadCaptureErrors++;
        console.error("Lead capture from transcript sync failed:", err);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sessionActive: parsed.sessionActive,
        nextTimestamp: parsed.nextTimestamp,
        received: parsed.transcriptData.length,
        leadCaptureErrors,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("session-transcript sync error:", error);
    return new Response(JSON.stringify({ error: "Transcript sync failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
