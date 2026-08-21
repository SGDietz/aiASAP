import {
  MAX_ELEVENLABS_TEXT_CHARS,
  assertAllowedOrigin,
  isSafeElevenLabsVoiceId,
  truncateUtf8String,
} from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import {
  TTS_HOURLY_LIMIT,
  TTS_LIMIT,
  checkLocalLimit,
} from "../../../src/lib/localRateLimit";
import { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } from "../secrets";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  // Upstash-backed limiter. Shared across instances when it is configured — and
  // it is NOT configured on any environment today, in which case it returns
  // null and lets everything through. See the local limiter below, which is
  // what actually holds the line.
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

    // THE LOCK (audit 2026-08-21). This route spends real ElevenLabs money on
    // every call and had nothing bounding it: the Origin check is a header any
    // non-browser client can set itself, and checkRateLimit above is inert
    // without Upstash keys that have never been set. So an outsider who found
    // the URL could burn the account 5,000 characters at a time.
    //
    // Charged AFTER the text is read so the budget is measured in characters —
    // the thing ElevenLabs actually bills for — rather than in request count.
    // A "30 requests a minute" cap still permits 150,000 characters a minute.
    const verdict = checkLocalLimit(request, "tts", rawText.length, [
      TTS_LIMIT,
      TTS_HOURLY_LIMIT,
    ]);
    if (!verdict.allowed) {
      // Loud on purpose: this is the only signal that somebody is trying.
      console.warn(
        `[tts-limit] rejected (${verdict.reason}) chars=${rawText.length}`,
      );
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(verdict.retryAfterSeconds),
        },
      });
    }

    // A missing or malformed ELEVENLABS_VOICE_ID silently falls through to a
    // stock ElevenLabs demo voice and still returns 200 — so 6 would speak in a
    // stranger's voice and nothing anywhere would say why. A missing API key
    // gets a loud error; this deserves one too.
    const configuredVoiceId = isSafeElevenLabsVoiceId(ELEVENLABS_VOICE_ID)
      ? ELEVENLABS_VOICE_ID
      : DEFAULT_VOICE_ID;
    if (configuredVoiceId === DEFAULT_VOICE_ID) {
      console.warn(
        "[tts] ELEVENLABS_VOICE_ID missing or invalid — falling back to the stock demo voice. 6 will not sound like himself.",
      );
    }
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
