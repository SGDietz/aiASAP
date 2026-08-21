import {
  API_KEY,
  API_URL,
  AVATAR_ID,
  LANGUAGE,
  VOICE_ID,
} from "../../secrets";
import { resolveLiveAvatarVoice } from "../../liveavatarVoice";
import { assertCanMintSessionToken } from "../../../../src/lib/liveavatarCredits";
import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";
import { MINT_LIMIT, checkLocalLimit } from "../../../../src/lib/localRateLimit";

type DebugTokenRequest = {
  includeContext?: boolean;
  includeVoice?: boolean;
  isSandbox?: boolean;
  language?: string;
};

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function cleanLanguage(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 12) : "";
}

export async function POST(request: Request) {
  // SHUT IN PRODUCTION (cross-site audit, 2026-08-21).
  //
  // This is a DEBUG HARNESS that mints a real, paid, 10-minute FULL-mode
  // LiveAvatar session. It had no origin check and no rate limit, so anybody
  // who knew the path could mint paid sessions on aiasap.ai forever. Worse,
  // mints made here are never tallied: recordSessionStreamStarted is only
  // called by /api/v1/sessions/start, so these did not even count against the
  // daily credit cap that is supposed to be the backstop.
  //
  // G's second standing order is "never burn 6". A debug door onto the live
  // domain is the opposite of that, so in production this route does not exist.
  // Set LIVEAVATAR_DEBUG_TOKEN_ENABLED=1 to open it deliberately for an
  // investigation; it is off unless somebody chooses otherwise.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.LIVEAVATAR_DEBUG_TOKEN_ENABLED !== "1"
  ) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  // Even with it deliberately open, it is same-origin only and rate limited.
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const mintVerdict = checkLocalLimit(request, "debug-token", 1, [MINT_LIMIT]);
  if (!mintVerdict.allowed) {
    console.warn(`[debug-token] rejected (${mintVerdict.reason})`);
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(mintVerdict.retryAfterSeconds),
      },
    });
  }

  const input = (await request.json().catch(() => ({}))) as DebugTokenRequest;
  // Defaults to FALSE since 2026-08-21 (Ara's call, and she was right): the flag
  // is inert now that no context_id is ever sent, and a flag that defaults TRUE
  // while doing nothing tells the next reader a lie about what this harness does.
  const includeContext = bool(input.includeContext, false);
  const includeVoice = bool(input.includeVoice, true);
  const language = cleanLanguage(input.language) || LANGUAGE.trim();

  const missing = [
    ["LIVEAVATAR_API_KEY", API_KEY],
    ["LIVEAVATAR_AVATAR_ID", AVATAR_ID],
    includeVoice ? ["LIVEAVATAR_VOICE_ID", VOICE_ID] : null,
    // LIVEAVATAR_CONTEXT_ID removed 2026-08-21 — aiASAP sends no context id.
  ].filter((entry): entry is [string, string] => Boolean(entry && !entry[1]));

  if (missing.length > 0) {
    return new Response(
      JSON.stringify({
        error: `LiveAvatar debug missing: ${missing.map(([name]) => name).join(", ")}`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const gate = await assertCanMintSessionToken();
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.message }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const voiceResolution = includeVoice ? await resolveLiveAvatarVoice() : null;
  const avatarPersona: Record<string, string> = {};
  if (includeVoice && voiceResolution) avatarPersona.voice_id = voiceResolution.voiceId;
  // No context_id, ever (2026-08-21). `includeContext` is kept in the request
  // shape so existing debug callers do not break, but it is now inert: this
  // harness must never be the one path that quietly reintroduces a provider
  // brain — and its 65,535-char cap — behind the app's back.
  if (language) avatarPersona.language = language;

  const requestBody = {
    mode: "FULL",
    avatar_id: AVATAR_ID,
    max_session_duration: 10 * 60,
    avatar_persona: avatarPersona,
  };

  try {
    const res = await fetch(`${API_URL}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    const rawBody = await res.text();
    let data: Record<string, any> | null = null;
    try {
      data = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error:
            data?.message ||
            data?.error ||
            rawBody ||
            `LiveAvatar token request failed with HTTP ${res.status}`,
          status: res.status,
        }),
        { status: res.status, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        session_token: data?.data?.session_token,
        session_id: data?.data?.session_id,
        payload: {
          mode: requestBody.mode,
          has_avatar_id: Boolean(AVATAR_ID),
          avatar_persona_keys: Object.keys(avatarPersona),
          voice_id_used: voiceResolution?.voiceId ?? null,
          primary_voice_id: voiceResolution?.primaryVoiceId ?? null,
          fallback_voice_id: voiceResolution?.fallbackVoiceId ?? null,
          used_fallback_voice: voiceResolution?.usedFallback ?? false,
          voice_resolution_reason: voiceResolution?.reason ?? null,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("LiveAvatar debug token failed:", error);
    return new Response(JSON.stringify({ error: "Failed to retrieve debug token" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
