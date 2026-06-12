import {
  MAX_ELEVENLABS_TEXT_CHARS,
  assertAllowedOrigin,
  isSafeElevenLabsVoiceId,
  truncateUtf8String,
} from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } from "../secrets";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const body = await request.json();
    const { text: rawText, voice_id: rawVoiceId } = body;

    if (typeof rawText !== "string" || !rawText.trim()) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    const configuredVoiceId = isSafeElevenLabsVoiceId(ELEVENLABS_VOICE_ID)
      ? ELEVENLABS_VOICE_ID
      : DEFAULT_VOICE_ID;
    const voice_id = isSafeElevenLabsVoiceId(rawVoiceId)
      ? rawVoiceId
      : configuredVoiceId;
    const text = truncateUtf8String(rawText, MAX_ELEVENLABS_TEXT_CHARS);

    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ElevenLabs API key not configured" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Call ElevenLabs API
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}/with-timestamps?output_format=pcm_24000`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          // r19 (G live 21:04: "the voice sounds a little different. Is it
          // definitely the same voice?"): the endpoint used ElevenLabs'
          // legacy default model with no settings while the avatar's
          // connector runs a tuned profile. Pin a modern model + standard
          // settings so voice-mode 6 sounds like avatar-mode 6.
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      },
    );

    if (!res.ok) {
      const errorData = await res.text();
      console.error("ElevenLabs API error:", errorData);
      return new Response(
        JSON.stringify({
          error: "Failed to generate speech",
        }),
        {
          status: res.status <= 599 ? res.status : 502,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Convert audio to base64
    const data = await res.json();
    const audio = data.audio_base64;

    return new Response(JSON.stringify({ audio }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error generating speech:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate speech" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}
