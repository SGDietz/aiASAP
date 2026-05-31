import { NextResponse, type NextRequest } from "next/server";
import { getUserId } from "../../../../src/lib/auth/getUser";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";
import {
  extractFactsFromTurn,
  storeFacts,
} from "../../../../src/lib/memory";

/**
 * Re-key anonymous rows to the authenticated user.
 *
 * Called from AuthProvider on the first SIGNED_IN transition. The browser
 * has been stashing every avatar session_id in localStorage; we send the
 * recent ones here and update all session-keyed tables in one pass.
 *
 * Idempotent: rows already owned by another user are left alone.
 */
const LINKABLE_TABLES = [
  "transcript_events",
  "conversation_messages",
  "media_events",
  "lead_sessions",
  "contact_entities",
] as const;

const MAX_IDS = 50;

function isSafeSessionId(s: unknown): s is string {
  return typeof s === "string" && s.length > 0 && s.length <= 200 && /^[A-Za-z0-9_\-:.]+$/.test(s);
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const rawIds = (body as { session_ids?: unknown })?.session_ids;
  if (!Array.isArray(rawIds)) {
    return NextResponse.json(
      { error: "session_ids must be an array" },
      { status: 400 },
    );
  }
  const ids = rawIds.filter(isSafeSessionId).slice(0, MAX_IDS);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, linked: 0, tables: {} });
  }

  let url: string;
  let serviceRoleKey: string;
  try {
    ({ url, serviceRoleKey } = getSupabaseAdminConfig());
  } catch {
    return NextResponse.json({ error: "supabase not configured" }, { status: 500 });
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  } as const;

  // Build a PostgREST `in.(...)` filter once.
  const inFilter = `in.(${ids.map((id) => `"${id.replace(/"/g, '""')}"`).join(",")})`;

  const perTable: Record<string, number | string> = {};
  let total = 0;

  for (const table of LINKABLE_TABLES) {
    try {
      // Only re-key rows that are currently un-owned. Rows already linked
      // to another user are left alone (safety).
      const res = await fetch(
        `${url}/rest/v1/${table}?session_id=${inFilter}&user_id=is.null`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ user_id: userId }),
        },
      );
      if (!res.ok) {
        // 404 here usually means the table doesn't exist yet. Skip silently.
        if (res.status === 404) {
          perTable[table] = "skip:404";
          continue;
        }
        perTable[table] = `error:${res.status}`;
        continue;
      }
      const rows = (await res.json()) as unknown[];
      perTable[table] = rows.length;
      total += rows.length;
    } catch (e) {
      console.error(`link-session: ${table} failed`, e);
      perTable[table] = "error:throw";
    }
  }

  // Retro fact extraction: fetch the just-re-keyed conversation rows and
  // run extractFactsFromTurn on each user/assistant pair. Fire-and-forget
  // so the link response returns immediately. Per G 2026-05-21 spec:
  // "persistent memory should start the moment the first session is
  // started" — i.e. when an anonymous user signs up, the pre-sign-in
  // transcripts should retroactively produce memory facts so 6 can pick
  // up where they left off.
  void (async () => {
    try {
      const messagesRes = await fetch(
        `${url}/rest/v1/conversation_messages?session_id=${inFilter}&user_id=eq.${userId}&order=la_absolute_timestamp.asc&select=session_id,role,message,la_absolute_timestamp&limit=500`,
        { method: "GET", headers },
      );
      if (!messagesRes.ok) return;
      const messages = (await messagesRes.json()) as Array<{
        session_id: string;
        role: "user" | "assistant";
        message: string;
        la_absolute_timestamp: number;
      }>;

      // Pair user → next-assistant turns
      const turns: Array<{ userMessage: string; assistantReply: string }> = [];
      for (let i = 0; i < messages.length; i++) {
        const m = messages[i];
        if (m.role !== "user") continue;
        const next = messages[i + 1];
        if (!next || next.role !== "assistant") continue;
        turns.push({
          userMessage: m.message.trim(),
          assistantReply: next.message.trim(),
        });
      }

      for (const turn of turns) {
        try {
          const facts = await extractFactsFromTurn(turn);
          if (facts.length > 0) {
            await storeFacts({ userId, facts });
          }
        } catch (err) {
          console.error("[link-session:retro-facts] turn failed", err);
        }
      }
    } catch (e) {
      console.error("[link-session:retro-facts] outer failed", e);
    }
  })();

  return NextResponse.json({ ok: true, linked: total, tables: perTable });
}
