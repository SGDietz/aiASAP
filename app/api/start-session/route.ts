import {
  API_KEY,
  API_URL,
  AVATAR_ID,
  VOICE_ID,
  CONTEXT_ID,
  LANGUAGE,
  VERIFY_LIVEAVATAR_VOICE_PREVIEW,
} from "../secrets";
import { resolveLiveAvatarVoice } from "../liveavatarVoice";
import { assertCanMintSessionToken } from "../../../src/lib/liveavatarCredits";
import { getSupabaseAdminConfig } from "../../../src/lib/supabaseAdmin";

function supabaseHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

async function logStartSessionFailure(args: {
  provider: string;
  statusCode: number;
  error: string;
  userVisibleState: string;
}) {
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    await fetch(`${url}/rest/v1/app_events`, {
      method: "POST",
      headers: supabaseHeaders(serviceRoleKey),
      body: JSON.stringify({
        event_type: "service_failure",
        severity: args.statusCode === 429 ? "critical" : "high",
        provider: args.provider,
        route: "/api/start-session",
        status_code: args.statusCode,
        user_visible_state: args.userVisibleState,
        payload: { error: args.error },
      }),
    });
  } catch (error) {
    console.warn("start-session failure event not stored:", error);
  }
}

export async function POST() {
  const missing = [
    ["LIVEAVATAR_API_KEY", API_KEY],
    ["LIVEAVATAR_AVATAR_ID", AVATAR_ID],
    ["LIVEAVATAR_VOICE_ID", VOICE_ID],
    ["LIVEAVATAR_CONTEXT_ID", CONTEXT_ID],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    const error = `LiveAvatar is missing: ${missing.map(([name]) => name).join(", ")}`;
    await logStartSessionFailure({
      provider: "liveavatar",
      statusCode: 500,
      error,
      userVisibleState: "6 is having trouble connecting. Tap to try again.",
    });
    return new Response(
      JSON.stringify({
        error,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const gate = await assertCanMintSessionToken();
  if (!gate.ok) {
    await logStartSessionFailure({
      provider: "liveavatar_credit_gate",
      statusCode: 429,
      error: gate.message,
      userVisibleState: gate.message,
    });
    return new Response(JSON.stringify({ error: gate.message }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  let session_token = "";
  let session_id = "";
  try {
    let voiceId = VOICE_ID;
    if (VERIFY_LIVEAVATAR_VOICE_PREVIEW) {
      const voiceResolution = await resolveLiveAvatarVoice();
      voiceId = voiceResolution.voiceId;
      if (voiceResolution.usedFallback) {
        console.warn(
          `LiveAvatar primary voice ${voiceResolution.primaryVoiceId} has no preview audio; using fallback voice ${voiceResolution.voiceId}`,
        );
      }
    }
    const avatarPersona: Record<string, string> = {
      voice_id: voiceId,
      context_id: CONTEXT_ID,
    };
    if (LANGUAGE.trim()) {
      avatarPersona.language = LANGUAGE.trim();
    }

    const res = await fetch(`${API_URL}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "FULL",
        avatar_id: AVATAR_ID,
        max_session_duration: 20 * 60, // 20 minutes (LiveAvatar API: seconds)
        avatar_persona: avatarPersona,
      }),
    });
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

      await logStartSessionFailure({
        provider: "liveavatar",
        statusCode: res.status,
        error: errorMessage,
        userVisibleState: "6 is having trouble connecting. Tap to try again.",
      });
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: res.status,
      });
    }
    const data = await res.json();

    session_token = data.data.session_token;
    session_id = data.data.session_id;
  } catch (error) {
    console.error("Error retrieving session token:", error);
    await logStartSessionFailure({
      provider: "liveavatar",
      statusCode: 500,
      error: error instanceof Error ? error.message : "Failed to retrieve session token",
      userVisibleState: "6 is having trouble connecting. Tap to try again.",
    });
    return new Response(
      JSON.stringify({ error: "Failed to retrieve session token" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (!session_token) {
    await logStartSessionFailure({
      provider: "liveavatar",
      statusCode: 500,
      error: "LiveAvatar returned no session token",
      userVisibleState: "6 is having trouble connecting. Tap to try again.",
    });
    return new Response(
      JSON.stringify({ error: "Failed to retrieve session token" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
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
