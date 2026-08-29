import { assertAllowedOrigin } from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { OPENAI_API_KEY } from "../secrets";

// Voice-list mode ears (2026-06-11, voice/avatar separation): while the
// LiveAvatar session is STOPPED (zero credits), the client records one
// utterance at a time (webm/opus) and posts it here. OpenAI transcribe runs
// ~$0.003/min — pennies next to the $0.20/min avatar this mode replaces.

const MAX_AUDIO_BYTES = 2_500_000; // ~2.5 MB ≈ well over a minute of opus
const TRANSCRIBE_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "transcribe not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) {
      return new Response(JSON.stringify({ error: "audio is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return new Response(JSON.stringify({ error: "audio too large" }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      });
    }

    const upstream = new FormData();
    upstream.append("model", TRANSCRIBE_MODEL);
    upstream.append(
      "file",
      audio,
      audio instanceof File && audio.name ? audio.name : "utterance.webm",
    );

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: upstream,
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("[voice-transcribe] upstream error", res.status, detail.slice(0, 300));
      return new Response(JSON.stringify({ error: "transcription failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    const data = (await res.json()) as { text?: string };
    const text = typeof data.text === "string" ? data.text.trim() : "";
    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[voice-transcribe] failed", e);
    return new Response(JSON.stringify({ error: "transcription failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
