import { API_KEY, API_URL, AVATAR_ID, VOICE_ID } from "../secrets";
import { assertCanMintSessionToken } from "../../../src/lib/liveavatarCredits";
import { assertAllowedOrigin } from "../../../src/lib/apiRouteSecurity";
import {
  MINT_HOURLY_LIMIT,
  MINT_LIMIT,
  checkLocalLimit,
} from "../../../src/lib/localRateLimit";

export async function POST(request: Request) {
  // Gate added 2026-08-21. Minting is the most expensive thing this app does —
  // a block for the first 30 seconds, then a block every 6 seconds, billing
  // whether or not anyone is speaking. This route had no origin check and no
  // rate limit; the credit cap below fails open when its storage is missing, so
  // it cannot be the only thing standing here.
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const mintVerdict = checkLocalLimit(request, "mint", 1, [
    MINT_LIMIT,
    MINT_HOURLY_LIMIT,
  ]);
  if (!mintVerdict.allowed) {
    console.warn(`[mint-limit] rejected (${mintVerdict.reason})`);
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(mintVerdict.retryAfterSeconds),
      },
    });
  }

  const gate = await assertCanMintSessionToken();
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.message }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const mintAt = `${API_URL}/v1/sessions/token`;
  const mintHeaders = {
    "X-API-KEY": API_KEY,
    "Content-Type": "application/json",
  };
  const base = {
    avatar_id: AVATAR_ID,
    max_session_duration: 20 * 60, // 20 minutes (LiveAvatar API: seconds)
  };

  let session_token = "";
  let session_id = "";
  try {
    // LIP-SYNC (G 2026-06-14: "fix fucking everything"): mint mode FULL WITH a
    // voice_id but NO context_id. FULL sessions are room-based (no ws_url), so
    // repeat()/AVATAR_SPEAK_TEXT reaches the LiveKit room and the avatar does
    // native TTS WITH lip-sync — 6's MOUTH moves. NO context_id keeps the
    // LiveAvatar SERVER brain OFF, so our /api/openai-chat-complete brain
    // (memory, no-interrupt, no-double-greet, account/email) keeps full control;
    // the component still runs the CUSTOM wiring. turn_eagerness "patient" matches
    // the FULL route. If this shape is rejected we fall back to the original
    // face-only CUSTOM mint so the session ALWAYS starts (frozen-mouth fallback,
    // never a broken start).
    let res = await fetch(mintAt, {
      method: "POST",
      headers: mintHeaders,
      body: JSON.stringify({
        ...base,
        mode: "FULL",
        avatar_persona: { voice_id: VOICE_ID },
        turn_eagerness: "patient",
      }),
    });
    if (!res.ok) {
      console.warn(
        "start-custom-session: FULL+voice mint rejected, falling back to face-only CUSTOM:",
        res.status,
      );
      res = await fetch(mintAt, {
        method: "POST",
        headers: mintHeaders,
        body: JSON.stringify({ ...base, mode: "CUSTOM" }),
      });
    }
    if (!res.ok) {
      const resp = await res.json();
      let errorMessage = "Failed to retrieve session token";

      // Handle different error response formats
      if (resp?.data && Array.isArray(resp.data) && resp.data.length > 0) {
        errorMessage = resp.data[0].message || errorMessage;
      } else if (resp?.data?.message) {
        errorMessage = resp.data.message;
      } else if (resp?.message) {
        errorMessage = resp.message;
      } else if (resp?.error) {
        errorMessage = resp.error;
      }

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: res.status,
      });
    }
    const data = await res.json();

    session_token = data.data.session_token;
    session_id = data.data.session_id;
  } catch (error: unknown) {
    console.error("start-custom-session:", error);
    return new Response(
      JSON.stringify({ error: "Failed to retrieve session token" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (!session_token) {
    return new Response(
      JSON.stringify({ error: "Failed to retrieve session token" }),
      {
        status: 500,
      },
    );
  }
  return new Response(JSON.stringify({ session_token, session_id }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
