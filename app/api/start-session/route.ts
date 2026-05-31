import {
  API_KEY,
  API_URL,
  AVATAR_ID,
  VOICE_ID,
  CONTEXT_ID,
  LANGUAGE,
} from "../secrets";
import { resolveLiveAvatarVoice } from "../liveavatarVoice";
import { assertCanMintSessionToken } from "../../../src/lib/liveavatarCredits";
import { getUser } from "../../../src/lib/auth/getUser";
import { recallFacts, formatRecalledFactsForPrompt } from "../../../src/lib/memory";

/** Build per-session dynamic_variables for the LiveAvatar cw template.
 *  - Signed-in: greet by name + inject recent memory facts so 6 picks up
 *    exactly where the user left off.
 *  - Anonymous: blank placeholders + a marker so 6 knows to behave as
 *    first-meet.
 */
async function buildDynamicVariables(): Promise<Record<string, string>> {
  const vars: Record<string, string> = {
    user_signed_in: "false",
    user_name: "",
    user_memory_summary: "",
  };
  try {
    const user = await getUser();
    if (!user) return vars;

    vars.user_signed_in = "true";
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const name =
      typeof meta.full_name === "string" && meta.full_name.trim()
        ? meta.full_name.trim()
        : typeof meta.name === "string" && meta.name.trim()
          ? meta.name.trim()
          : user.email
            ? user.email.split("@")[0]
            : "";
    if (name) vars.user_name = name.slice(0, 64);

    // Pull top facts via cosine similarity to a generic "what do I know about this user" query.
    const facts = await recallFacts({ userId: user.id, query: "what I know about this user" });
    const block = formatRecalledFactsForPrompt(facts);
    if (block) {
      // Cap at 950 chars (LiveAvatar limit is 1000) to be safe.
      vars.user_memory_summary = block.slice(0, 950);
    }
  } catch (e) {
    console.error("buildDynamicVariables failed:", e);
  }
  return vars;
}

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
    const voiceResolution = await resolveLiveAvatarVoice();
    if (voiceResolution.usedFallback) {
      console.warn(
        `LiveAvatar primary voice ${voiceResolution.primaryVoiceId} has no preview audio; using fallback voice ${voiceResolution.voiceId}`,
      );
    }
    const avatarPersona: Record<string, string> = {
      voice_id: voiceResolution.voiceId,
      context_id: CONTEXT_ID,
    };
    if (LANGUAGE.trim()) {
      avatarPersona.language = LANGUAGE.trim();
    }

    const dynamicVariables = await buildDynamicVariables();

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
        turn_eagerness: "patient",
        // Per-session cw template values. The cw has ${user_name},
        // ${user_memory_summary}, and ${user_signed_in} placeholders;
        // these get rendered at session start so 6 sees the right
        // greeting context for THIS user.
        dynamic_variables: dynamicVariables,
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
