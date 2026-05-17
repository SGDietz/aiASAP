import {
  assertAllowedOrigin,
  isSafeTranscriptionSessionId,
  truncateUtf8String,
} from "../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";

type Severity = "critical" | "high" | "medium" | "low";
type Sentiment = "negative" | "positive";

const MAX_TEXT_CHARS = 1000;
const MAX_ROUTE_CHARS = 180;
const MAX_PAYLOAD_CHARS = 9000;
const SAFE_ID = /^[a-zA-Z0-9:_-]{4,160}$/;
const SEVERITIES = new Set(["critical", "high", "medium", "low"]);
const SENTIMENTS = new Set(["negative", "positive"]);

function supabaseHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

function cleanString(value: unknown, maxChars = MAX_TEXT_CHARS): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? truncateUtf8String(cleaned, maxChars) : null;
}

function cleanId(value: unknown): string | null {
  const cleaned = cleanString(value, 160);
  return cleaned && SAFE_ID.test(cleaned) ? cleaned : null;
}

function cleanSessionId(value: unknown): string | null {
  if (value == null || value === "") return null;
  return isSafeTranscriptionSessionId(value) ? value.trim() : null;
}

function cleanSeverity(value: unknown, fallback: Severity): Severity {
  const cleaned = cleanString(value, 16);
  return cleaned && SEVERITIES.has(cleaned) ? (cleaned as Severity) : fallback;
}

function cleanSentiment(value: unknown): Sentiment {
  const cleaned = cleanString(value, 16);
  return cleaned && SENTIMENTS.has(cleaned)
    ? (cleaned as Sentiment)
    : "negative";
}

function cleanStatusCode(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= 100 && value <= 599 ? value : null;
}

function cleanJsonPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length <= MAX_PAYLOAD_CHARS) {
      return value as Record<string, unknown>;
    }
    return {
      truncated: true,
      preview: truncateUtf8String(serialized, MAX_PAYLOAD_CHARS),
    };
  } catch {
    return {};
  }
}

function cleanStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item, 220))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

async function insertRow(
  table: string,
  row: Record<string, unknown>,
): Promise<Response | null> {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: supabaseHeaders(serviceRoleKey),
    body: JSON.stringify(row),
  });

  if (res.ok) return null;
  const detail = await res.text();
  console.error(`${table} insert failed:`, detail);
  return new Response(JSON.stringify({ error: "Failed to store app event" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}

async function insertConversationFallback(
  sessionId: string | null,
  source: string,
  value: Record<string, unknown>,
): Promise<boolean> {
  if (!sessionId) return false;
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const res = await fetch(`${url}/rest/v1/conversation_messages`, {
      method: "POST",
      headers: supabaseHeaders(serviceRoleKey),
      body: JSON.stringify({
        session_id: sessionId,
        role: "user",
        source,
        message: truncateUtf8String(JSON.stringify(value), 3900),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const body = await request.json();
    const category = cleanString(body?.category, 32) ?? "app";
    const sessionId = cleanSessionId(body?.sessionId);
    const anonymousVisitorId = cleanId(body?.anonymousVisitorId);
    const route = cleanString(body?.route, MAX_ROUTE_CHARS);
    const viewport = cleanString(body?.viewport, 40);
    const payload = cleanJsonPayload(body?.payload);

    if (category === "feedback") {
      const phrase = cleanString(body?.phrase, MAX_TEXT_CHARS);
      if (!phrase) {
        return new Response(JSON.stringify({ error: "phrase is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const err = await insertRow("feedback_events", {
        session_id: sessionId,
        anonymous_visitor_id: anonymousVisitorId,
        sentiment: cleanSentiment(body?.sentiment),
        severity: cleanSeverity(body?.severity, "medium"),
        phrase,
        route,
        viewport,
        active_sticky_note: cleanString(body?.activeStickyNote, 160),
        visible_items: cleanStringArray(body?.visibleItems, 40),
        sticky_note_index:
          typeof body?.stickyNoteIndex === "number" ? body.stickyNoteIndex : null,
        sticky_note_count:
          typeof body?.stickyNoteCount === "number" ? body.stickyNoteCount : null,
        recent_actions: cleanStringArray(body?.recentActions, 20),
        mode: cleanString(body?.mode, 80) ?? "full-liveavatar",
        payload,
      });
      if (err) {
        const fallbackOk = await insertConversationFallback(
          sessionId,
          "product_feedback",
          {
            category: "feedback",
            phrase,
            sentiment: cleanSentiment(body?.sentiment),
            severity: cleanSeverity(body?.severity, "medium"),
            payload,
          },
        );
        if (!fallbackOk) return err;
      }
      return Response.json({ ok: true });
    }

    if (category === "preference") {
      const signal = cleanString(body?.signal, MAX_TEXT_CHARS);
      if (!signal) {
        return new Response(JSON.stringify({ error: "signal is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const err = await insertRow("preference_candidates", {
        session_id: sessionId,
        anonymous_visitor_id: anonymousVisitorId,
        category: cleanString(body?.preferenceCategory, 80) ?? "preference",
        signal,
        source_text: cleanString(body?.sourceText, MAX_TEXT_CHARS),
        confidence:
          typeof body?.confidence === "number" &&
          Number.isFinite(body.confidence)
            ? body.confidence
          : null,
        payload,
      });
      if (err) {
        const fallbackOk = await insertConversationFallback(
          sessionId,
          "preference_candidate",
          {
            category: "preference",
            signal,
            sourceText: cleanString(body?.sourceText, MAX_TEXT_CHARS),
            payload,
          },
        );
        if (!fallbackOk) return err;
      }
      return Response.json({ ok: true });
    }

    const err = await insertRow("app_events", {
      session_id: sessionId,
      anonymous_visitor_id: anonymousVisitorId,
      event_type: cleanString(body?.eventType, 120) ?? "app_event",
      severity: cleanSeverity(body?.severity, "low"),
      provider: cleanString(body?.provider, 80),
      route,
      status_code: cleanStatusCode(body?.statusCode),
      user_visible_state: cleanString(body?.userVisibleState, 240),
      payload,
    });
    if (err) {
      const fallbackOk = await insertConversationFallback(
        sessionId,
        "app_event",
        {
          category: "app",
          eventType: cleanString(body?.eventType, 120) ?? "app_event",
          severity: cleanSeverity(body?.severity, "low"),
          provider: cleanString(body?.provider, 80),
          route,
          statusCode: cleanStatusCode(body?.statusCode),
          userVisibleState: cleanString(body?.userVisibleState, 240),
          payload,
        },
      );
      if (!fallbackOk) return err;
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error storing app event:", error);
    return new Response(JSON.stringify({ error: "Failed to store app event" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
