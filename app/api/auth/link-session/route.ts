import { NextResponse, after, type NextRequest } from "next/server";
import { getUser } from "../../../../src/lib/auth/getUser";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";
import {
  extractFactsFromTurn,
  storeFacts,
} from "../../../../src/lib/memory";
import {
  collapseTranscriptRows,
  type TranscriptRowLike,
} from "../../../../src/lib/transcript/collapseTranscriptRows";

// Retro fact-extraction runs in after() once the response is flushed; Vercel
// keeps the lambda alive until the after() promise resolves. Give it room for
// the sequential OpenAI extract+embed calls (a bare fire-and-forget was being
// frozen the instant the response returned — see the after() block below).
export const maxDuration = 60;

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
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const userId = user.id;
  const userEmail = user.email ?? null;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const rawIds = (body as { session_ids?: unknown })?.session_ids;
  const browserIds = Array.isArray(rawIds) ? rawIds.filter(isSafeSessionId) : [];

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

  // Robust linking (2026-05-31 memory fix): the browser's localStorage list of
  // session_ids often doesn't survive the magic-link round-trip (different tab/
  // browser), so linking + memory silently produced nothing. We ALSO pull every
  // session_id recorded server-side against this user's email at magic-link-send
  // time, and union the two — so linking + retro fact extraction work regardless
  // of the browser handoff.
  const emailIds: string[] = [];
  let recoveredName: string | null = null;
  if (userEmail) {
    try {
      const linkRes = await fetch(
        `${url}/rest/v1/account_email_links?email=eq.${encodeURIComponent(userEmail)}&select=session_id,captured_lists&order=created_at.desc&limit=${MAX_IDS}`,
        { method: "GET", headers },
      );
      if (linkRes.ok) {
        const rows = (await linkRes.json()) as Array<{
          session_id: unknown;
          captured_lists: unknown;
        }>;
        for (const r of rows) {
          if (isSafeSessionId(r.session_id)) emailIds.push(r.session_id);
          // Recover the spoken name from the most recent row that carried one
          // (rows are ordered created_at.desc). account/start stashes it in
          // captured_lists.fullName.
          if (
            !recoveredName &&
            r.captured_lists &&
            typeof r.captured_lists === "object" &&
            !Array.isArray(r.captured_lists)
          ) {
            const fn = (r.captured_lists as Record<string, unknown>).fullName;
            if (typeof fn === "string" && fn.trim().length > 0) {
              recoveredName = fn.trim().slice(0, 200);
            }
          }
        }
      }
    } catch (e) {
      console.error("link-session: email-link lookup failed", e);
    }
  }

  // Name recall (2026-06-01): Supabase only writes OTP options.data to
  // user_metadata when the user is first CREATED, so the spoken full_name was
  // ending up absent on the account after the magic-link turnaround — 6 then
  // greeted a returning user like a stranger. If full_name is missing/empty,
  // write the name we recovered from account_email_links to user_metadata via
  // the service-role Admin API. account/me reads meta.full_name back.
  const existingName = (() => {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    if (typeof meta.full_name === "string" && meta.full_name.trim().length > 0) {
      return meta.full_name.trim();
    }
    if (typeof meta.fullName === "string" && meta.fullName.trim().length > 0) {
      return meta.fullName.trim();
    }
    return null;
  })();
  if (!existingName && recoveredName) {
    try {
      const updRes = await fetch(
        `${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ user_metadata: { full_name: recoveredName } }),
        },
      );
      if (!updRes.ok) {
        console.error(
          "link-session: full_name write failed",
          updRes.status,
          (await updRes.text()).slice(0, 200),
        );
      }
    } catch (e) {
      console.error("link-session: full_name write threw", e);
    }
  }

  const ids = Array.from(new Set([...browserIds, ...emailIds])).slice(0, MAX_IDS);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, linked: 0, tables: {} });
  }

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

  // Conversion/watchdog merge: a visitor may explore anonymously, then create
  // the free account from the same conversation. Close that canonical draft in
  // place; never create a second opportunity. This is intentionally best-effort
  // until the local watchdog migration receives separate remote authorization.
  try {
    const opportunityRes = await fetch(
      `${url}/rest/v1/visitor_opportunities?conversation_session_id=${inFilter}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          user_id: userId,
          visitor_state: "completed",
          opportunity_state: "account_created",
          account_state: "created",
          discovery_stage: "account_created",
          terminal_at: null,
          grace_until: null,
          end_reason: null,
        }),
      },
    );
    if (opportunityRes.ok) {
      const rows = (await opportunityRes.json()) as Array<{ id?: string }>;
      perTable.visitor_opportunities = rows.length;
      total += rows.length;
      const opportunityIds = rows.map((row) => row.id).filter((id): id is string => typeof id === "string");
      if (opportunityIds.length > 0) {
        const opportunityFilter = `in.(${opportunityIds.map((id) => `"${id}"`).join(",")})`;
        await fetch(
          `${url}/rest/v1/opportunity_notification_outbox?opportunity_id=${opportunityFilter}&event_kind=eq.unfinished_opportunity&status=in.(detected,queued,failed)`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({ status: "acknowledged", acknowledged_at: new Date().toISOString() }),
          },
        );
      }
    } else if (opportunityRes.status !== 404) {
      console.warn("link-session: visitor opportunity merge skipped", opportunityRes.status);
    }
  } catch (error) {
    console.warn("link-session: visitor opportunity merge unavailable", error);
  }

  // Retro fact extraction: fetch the just-re-keyed conversation rows and run
  // extractFactsFromTurn on each user/assistant pair. Runs in after() so it
  // executes AFTER the response is flushed but is still awaited by Vercel to
  // completion. This WAS a bare `void (async () => {})()` — which Vercel froze
  // the instant the response returned, so the signup conversation never
  // produced any user_memory_facts on sign-in (2026-06-07: confirmed in the DB
  // — only the warm-session sync path ever wrote facts; this path wrote 0).
  // Per G 2026-05-21 spec: persistent memory should start the moment the first
  // session is started — the pre-sign-in transcripts should retroactively
  // produce facts so 6 picks up exactly where the user left off.
  after(async () => {
    let turnsFound = 0;
    let factsExtracted = 0;
    let factsStored = 0;
    // A8 (G 2026-06-14 "you know my name" -> 6 re-asks): the LLM extractor is told
    // to IGNORE signup turns, so the captured name never became a user_memory_facts
    // row and recall came back empty. Write the known name as a deterministic fact
    // here; storeFacts dedupes, so it is idempotent and never piles copies.
    const knownName = existingName ?? recoveredName;
    if (knownName && knownName.trim()) {
      try {
        await storeFacts({
          userId,
          facts: [{ kind: "name", content: knownName.trim() }],
        });
      } catch (err) {
        console.error("[link-session:retro-facts] name fact failed", err);
      }
    }
    try {
      // Ordered by created_at, not la_absolute_timestamp (2026-08-21): the
      // app's own user rows (CUSTOM mode, /api/voice-mode/log-turn) carry NO
      // la_absolute_timestamp, so under la order every one of them sorted
      // LAST, behind every provider row, and never once formed a user ->
      // assistant pair. la stays as the tiebreak so provider rows from one
      // sync batch (same created_at to the ms) keep their spoken order.
      const messagesRes = await fetch(
        `${url}/rest/v1/conversation_messages?session_id=${inFilter}&user_id=eq.${userId}&order=created_at.asc,la_absolute_timestamp.asc&select=session_id,role,message,source,utterance_id,la_absolute_timestamp,created_at&limit=500`,
        { method: "GET", headers },
      );
      if (!messagesRes.ok) {
        console.error(
          `[link-session:retro-facts] messages fetch failed ${messagesRes.status}`,
        );
        return;
      }
      const messages = (await messagesRes.json()) as TranscriptRowLike[];

      // Fold the provider's pieces under the app's whole turn before pairing
      // (2026-08-21, see src/lib/transcript/fragmentLink.ts), so the extractor
      // sees "everything the user said -> 6's reply", never "Um," -> 6's reply.
      // Then pair user → next-assistant turns, as before.
      const folded = collapseTranscriptRows(messages);
      const turns: Array<{ userMessage: string; assistantReply: string }> = [];
      for (let i = 0; i < folded.length; i++) {
        const m = folded[i];
        if (m.role !== "user") continue;
        const next = folded[i + 1];
        if (!next || next.role !== "assistant") continue;
        turns.push({
          userMessage: m.text.trim(),
          assistantReply: next.text.trim(),
        });
      }
      // Most-recent turns carry the freshest topic; cap to bound the OpenAI
      // cost and keep the after() work comfortably inside maxDuration.
      const recentTurns = turns.slice(-40);
      turnsFound = recentTurns.length;

      for (const turn of recentTurns) {
        try {
          const facts = await extractFactsFromTurn(turn);
          factsExtracted += facts.length;
          if (facts.length > 0) {
            const { inserted } = await storeFacts({ userId, facts });
            factsStored += inserted;
          }
        } catch (err) {
          console.error("[link-session:retro-facts] turn failed", err);
        }
      }
    } catch (e) {
      console.error("[link-session:retro-facts] outer failed", e);
    } finally {
      console.log(
        `[link-session DIAG] user=${userId} ids=${ids.length} turns=${turnsFound} factsExtracted=${factsExtracted} factsStored=${factsStored}`,
      );
    }
  });

  return NextResponse.json({ ok: true, linked: total, tables: perTable });
}
