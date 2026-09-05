import {
  assertAllowedOrigin,
  isSafeTranscriptionSessionId,
} from "../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../src/lib/rateLimit";

// Compatibility endpoint only. Accepted application turns are persisted by
// /api/voice-mode/log-turn, whose event-id insert representation is the proof
// that lead extraction may run exactly once. This endpoint cannot supply that
// proof, so it must never write transcript, lead, contact, or prompt state.

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const body = await request.json();
    const { sessionId: rawSessionId, text: rawText } = body;

    if (!isSafeTranscriptionSessionId(rawSessionId)) {
      return new Response(
        JSON.stringify({ error: "Invalid sessionId" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (typeof rawText !== "string" || !rawText.trim()) {
      return new Response(
        JSON.stringify({ error: "text is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    void rawSessionId;
    void rawText;

    return new Response(
      JSON.stringify({
        extracted: {
          email: null,
          phone: null,
          full_name: null,
          consent_status: "unknown",
        },
        assistantPrompt: null,
        shouldSkipVision: false,
        deprecated: true,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error capturing transcription:", error);
    return new Response(
      JSON.stringify({ error: "Failed to capture transcription" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
