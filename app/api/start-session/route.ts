import {
  API_KEY,
  API_URL,
  AVATAR_ID,
  VOICE_ID,
  CONTEXT_ID,
  LANGUAGE,
} from "../secrets";
import { assertCanMintSessionToken } from "../../../src/lib/liveavatarCredits";

const AIASAP_ONLY_CONTEXT_ID = "33a7aeb4-cd4a-4ae3-a2ed-39abf8db2930";

export async function POST() {
  const missing = [
    ["LIVEAVATAR_API_KEY", API_KEY],
    ["LIVEAVATAR_AVATAR_ID", AVATAR_ID],
    ["LIVEAVATAR_VOICE_ID", VOICE_ID],
    ["LIVEAVATAR_CONTEXT_ID", CONTEXT_ID],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    return new Response(
      JSON.stringify({
        error: `LiveAvatar is missing: ${missing.map(([name]) => name).join(", ")}`,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (CONTEXT_ID !== AIASAP_ONLY_CONTEXT_ID) {
    return new Response(
      JSON.stringify({
        error: "aiASAP LiveAvatar context mismatch",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const gate = await assertCanMintSessionToken();
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.message }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  let session_token = "";
  let session_id = "";
  try {
    const avatarPersona: Record<string, string> = {
      voice_id: VOICE_ID,
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

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: res.status,
      });
    }
    const data = await res.json();

    session_token = data.data.session_token;
    session_id = data.data.session_id;
  } catch (error) {
    console.error("Error retrieving session token:", error);
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
