import {
  API_KEY,
  API_URL,
  AVATAR_ID,
  CONTEXT_ID,
  LANGUAGE,
  VOICE_ID,
} from "../../secrets";
import { assertCanMintSessionToken } from "../../../../src/lib/liveavatarCredits";

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
  const input = (await request.json().catch(() => ({}))) as DebugTokenRequest;
  const includeContext = bool(input.includeContext, true);
  const includeVoice = bool(input.includeVoice, true);
  const isSandbox = bool(input.isSandbox, false);
  const language = cleanLanguage(input.language) || LANGUAGE.trim();

  const missing = [
    ["LIVEAVATAR_API_KEY", API_KEY],
    ["LIVEAVATAR_AVATAR_ID", AVATAR_ID],
    includeVoice ? ["LIVEAVATAR_VOICE_ID", VOICE_ID] : null,
    includeContext ? ["LIVEAVATAR_CONTEXT_ID", CONTEXT_ID] : null,
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

  const avatarPersona: Record<string, string> = {};
  if (includeVoice) avatarPersona.voice_id = VOICE_ID;
  if (includeContext) avatarPersona.context_id = CONTEXT_ID;
  if (language) avatarPersona.language = language;

  const requestBody = {
    mode: "FULL",
    avatar_id: AVATAR_ID,
    max_session_duration: 10 * 60,
    avatar_persona: avatarPersona,
    is_sandbox: isSandbox,
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
          is_sandbox: isSandbox,
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
