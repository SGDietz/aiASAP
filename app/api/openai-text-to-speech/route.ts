import {
  MAX_ELEVENLABS_TEXT_CHARS,
  assertAllowedOrigin,
  truncateUtf8String,
} from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { OPENAI_API_KEY } from "../secrets";

const OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_VOICE = "cedar";
const ALLOWED_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "marin",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "cedar",
]);

function safeVoice(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_VOICE;
  const voice = value.trim().toLowerCase();
  return ALLOWED_VOICES.has(voice) ? voice : DEFAULT_VOICE;
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const body = await request.json();
    const rawText = body?.text;
    const voice = safeVoice(body?.voice);

    if (typeof rawText !== "string" || !rawText.trim()) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const text = truncateUtf8String(rawText, MAX_ELEVENLABS_TEXT_CHARS);
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_TTS_MODEL,
        voice,
        input: text,
        instructions:
          "Speak as 6 from aiASAP: friendly, direct, warm, confident, and not wordy.",
        response_format: "pcm",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI TTS error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to generate speech" }), {
        status: response.status <= 599 ? response.status : 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const audio = Buffer.from(await response.arrayBuffer()).toString("base64");
    return new Response(JSON.stringify({ audio, format: "pcm_24000" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating OpenAI speech:", error);
    return new Response(JSON.stringify({ error: "Failed to generate speech" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
