import {
  MAX_TRANSCRIPTION_TEXT_CHARS,
  assertAllowedOrigin,
  isSafeTranscriptionSessionId,
  truncateUtf8String,
} from "../../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../../src/lib/rateLimit";
import { persistUserUtteranceLeadCapture } from "../../../../../src/lib/leadCaptureFromUserText";
import { getSupabaseAdminConfig } from "../../../../../src/lib/supabaseAdmin";
import { normalizeTesterLabel } from "../../../../../src/lib/testerAttribution";
import { API_KEY, API_URL } from "../../../secrets";
import { getUserId } from "../../../../../src/lib/auth/getUser";
import {
  extractFactsFromTurn,
  storeFacts,
} from "../../../../../src/lib/memory";

// Per-session in-memory de-dup for the auto-magic-link trigger. Process-
// scoped — restart clears it. Good enough for beta; the alternative is
// a DB column on lead_sessions, but signInWithOtp is also idempotent on
// Supabase's side (it will just re-send the same magic link).
const MAGIC_LINK_FIRED = new Set<string>();
const MAX_FIRED_KEYS = 1000;

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const ASSISTANT_TRIGGER_RE =
  /\b(?:sending|i'?ll send|let me send|i'?m gonna send|gonna send|sending you|i'?m sending)\b[^.?!]{0,40}(?:link|magic|email)/i;

// Spoken-email patterns the user might speak instead of writing. Voice-to-text
// often renders "@" as "at" and "." as "dot" — and adds hyphens between letters
// when read letter-by-letter (e.g., "S-G-D-I-E-T-Z at p-m dot me"). We
// normalize those forms back to a real email before matching.
function normalizeSpokenEmail(text: string): string {
  let s = text.toLowerCase();
  // collapse "s-g-d-i-e-t-z" → "sgdietz" (sequences of single letters joined by hyphens)
  s = s.replace(/\b([a-z])(?:[-\s]([a-z])){1,}\b/g, (m) =>
    m.replace(/[-\s]/g, ""),
  );
  // normalize spoken "at" and "dot"
  s = s.replace(/\s+at\s+/g, "@");
  s = s.replace(/\s+dot\s+/g, ".");
  // remove residual spaces inside what looks like an email
  s = s.replace(/(\w)\s+(\w)/g, "$1$2");
  return s;
}

function extractEmailFromText(text: string): string | null {
  // Try the raw text first.
  const direct = EMAIL_RE.exec(text);
  if (direct) return direct[0].toLowerCase();
  // Try a spoken-form normalization.
  const normalized = normalizeSpokenEmail(text);
  const m = EMAIL_RE.exec(normalized);
  return m ? m[0].toLowerCase() : null;
}

/** Detect verbal magic-link consent in current transcripts. Returns true
 *  if 6 confirmed it's sending the link in this batch.
 */
function hasMagicLinkTrigger(transcripts: TranscriptRow[]): boolean {
  for (const row of transcripts) {
    if (row.role !== "avatar") continue;
    if (ASSISTANT_TRIGGER_RE.test(row.transcript)) return true;
  }
  return false;
}

/** Find the email the user spoke during this session. Searches both the
 *  current batch AND the full DB history for the session (since the email
 *  may have been spoken in a prior sync batch, before the trigger phrase).
 */
async function findEmailInSession(
  sessionId: string,
  currentBatch: TranscriptRow[],
  url: string,
  serviceRoleKey: string,
): Promise<string | null> {
  // Try current batch first.
  for (const row of currentBatch) {
    if (row.role !== "user") continue;
    const e = extractEmailFromText(row.transcript);
    if (e) return e;
  }
  // Fall back to full session history from DB.
  try {
    const res = await fetch(
      `${url}/rest/v1/conversation_messages?session_id=eq.${encodeURIComponent(sessionId)}&role=eq.user&order=la_absolute_timestamp.asc&select=message&limit=200`,
      {
        method: "GET",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ message: string }>;
    for (const r of rows) {
      const e = extractEmailFromText(r.message);
      if (e) return e;
    }
  } catch {
    // ignore
  }
  return null;
}

const SESSION_CLOSE_TRIGGER_RE =
  /\b(?:see you on the other side|see you on the flip|i'?ll see you|close this out|closing this out|go ahead and check your email|i'?ll close)\b/i;
const USER_GOING_TO_EMAIL_RE =
  /\b(?:go check (?:my |the )?email|check my email|going to (?:my |the )?email|i'?ll go (?:to |check )(?:my |the )?email|let me check (?:my )?email)\b/i;

function detectSessionCloseIntent(transcripts: TranscriptRow[]): boolean {
  for (const row of transcripts) {
    if (row.role === "avatar" && SESSION_CLOSE_TRIGGER_RE.test(row.transcript)) {
      return true;
    }
    if (row.role === "user" && USER_GOING_TO_EMAIL_RE.test(row.transcript)) {
      return true;
    }
  }
  return false;
}

async function stopLiveAvatarSession(
  sessionId: string,
  apiKey: string,
  baseUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${baseUrl}/v1/sessions/stop`, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, error: `liveavatar ${res.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function sendMagicLinkServerSide(
  email: string,
  redirectTo: string,
): Promise<{ ok: boolean; error?: string }> {
  const supaUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supaUrl || !anonKey) {
    return { ok: false, error: "supabase not configured" };
  }
  try {
    const res = await fetch(`${supaUrl}/auth/v1/otp`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        create_user: true,
        options: { emailRedirectTo: redirectTo },
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, error: `supabase ${res.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

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

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const body = await request.json();
    const { liveAvatarSessionId: rawSessionId, startTimestamp } = body;
    const testerLabel = normalizeTesterLabel(body.testerLabel);

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

    // Resolve current user (if signed in) so inserts attach to them and
    // memory writes can fire. Anonymous sessions: userId is null, no
    // memory writes happen — only links via /api/auth/link-session later.
    const userId = await getUserId();

    const rows = parsed.transcriptData.map((row) => ({
      session_id: liveAvatarSessionId,
      role: row.role === "avatar" ? "assistant" : "user",
      message: truncateUtf8String(row.transcript.trim(), MAX_TRANSCRIPTION_TEXT_CHARS),
      la_absolute_timestamp: Math.floor(row.absolute_timestamp),
      source: "liveavatar_api",
      user_id: userId,
      ...(testerLabel ? { tester_label: testerLabel } : {}),
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
        await persistUserUtteranceLeadCapture(liveAvatarSessionId, line, testerLabel);
      } catch (err) {
        leadCaptureErrors++;
        console.error("Lead capture from transcript sync failed:", err);
      }
    }

    // Detect "6 verbally agreed to send a magic link to user's email"
    // pattern in the transcripts. Pattern: assistant said "sending the
    // link/magic/email" somewhere in this batch, AND the user's email
    // appears anywhere in the session history (current batch OR prior
    // batches). Only runs for anonymous users — signed-in don't need it.
    if (!userId && hasMagicLinkTrigger(parsed.transcriptData)) {
      const triggerEmail = await findEmailInSession(
        liveAvatarSessionId,
        parsed.transcriptData,
        url,
        serviceRoleKey,
      );
      if (triggerEmail) {
        const firedKey = `${liveAvatarSessionId}:${triggerEmail}`;
        if (!MAGIC_LINK_FIRED.has(firedKey)) {
          if (MAGIC_LINK_FIRED.size >= MAX_FIRED_KEYS) {
            MAGIC_LINK_FIRED.clear();
          }
          MAGIC_LINK_FIRED.add(firedKey);
          const origin =
            request.headers.get("origin") ??
            process.env.NEXT_PUBLIC_SITE_URL ??
            "https://aiasap.ai";
          // v2.1 resume-bug fix (part c): carry ?account=verified through the
          // magic link so the post-sign-in return triggers 6's welcome-back +
          // resume path. Was `next=/` (no signal), which is why returning
          // users looked brand-new.
          const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/?account=verified")}`;
          void sendMagicLinkServerSide(triggerEmail, redirectTo).then(
            (result) => {
              if (!result.ok) {
                console.error(
                  "[magic-link:auto-trigger] send failed:",
                  result.error,
                );
                MAGIC_LINK_FIRED.delete(firedKey);
              } else {
                console.log(
                  `[magic-link:auto-trigger] sent to ${triggerEmail} for session ${liveAvatarSessionId}`,
                );
              }
            },
          );
        }
      } else {
        console.warn(
          `[magic-link:auto-trigger] trigger phrase detected but no email found in session ${liveAvatarSessionId}`,
        );
      }
    }

    // Detect "user is going to check email — close the session" intent.
    // When the user has confirmed they're going to their email to click
    // the link (and 6 has said see-you-on-the-other-side), STOP the
    // LiveAvatar session server-side so the avatar freezes and credit
    // burn stops. Only runs for anonymous sessions in the post-magic-link
    // phase — signed-in users don't follow this flow.
    if (!userId && detectSessionCloseIntent(parsed.transcriptData)) {
      const stopBaseUrl = (API_URL ?? "https://api.liveavatar.com").replace(/\/$/, "");
      const stopApiKey = API_KEY ?? "";
      if (stopApiKey) {
        void stopLiveAvatarSession(liveAvatarSessionId, stopApiKey, stopBaseUrl).then(
          (result) => {
            if (!result.ok) {
              console.error(
                "[session:auto-stop] stop failed:",
                result.error,
              );
            } else {
              console.log(
                `[session:auto-stop] stopped LiveAvatar session ${liveAvatarSessionId} (user going to email)`,
              );
            }
          },
        );
      }
    }

    // M1.2 — Memory writer pass. Only fires for signed-in users (anonymous
    // sessions accumulate transcripts but NO memory facts until they sign in
    // and link-session re-keys their rows). Pair each user utterance with
    // the next avatar utterance and extract durable facts. Fire-and-forget
    // — never block the response on writes.
    if (userId) {
      const turns: Array<{ userMessage: string; assistantReply: string }> = [];
      for (let i = 0; i < parsed.transcriptData.length; i++) {
        const row = parsed.transcriptData[i];
        if (row.role !== "user") continue;
        const next = parsed.transcriptData[i + 1];
        if (!next || next.role !== "avatar") continue;
        turns.push({
          userMessage: row.transcript.trim(),
          assistantReply: next.transcript.trim(),
        });
      }
      if (turns.length > 0) {
        void (async () => {
          for (const turn of turns) {
            try {
              const facts = await extractFactsFromTurn(turn);
              if (facts.length > 0) {
                await storeFacts({ userId, facts });
              }
            } catch (err) {
              console.error("[memory:writer] transcript-sync failed", err);
            }
          }
        })();
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
