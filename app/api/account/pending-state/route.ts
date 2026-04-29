import {
  assertAllowedOrigin,
  isSafeTranscriptionSessionId,
} from "../../../../src/lib/apiRouteSecurity";
import {
  sanitizeAccountResumeState,
  sanitizeAssistantLists,
  updatePendingAccountLinkState,
} from "../../../../src/lib/accountPersistence";
import { checkRateLimit } from "../../../../src/lib/rateLimit";

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const body = await request.json();
    const stateToken =
      typeof body.stateToken === "string" ? body.stateToken.trim() : "";
    const sessionId =
      typeof body.sessionId === "string" &&
      isSafeTranscriptionSessionId(body.sessionId)
        ? body.sessionId.trim()
        : null;
    const lists = sanitizeAssistantLists(body.lists);
    const resumeState = sanitizeAccountResumeState(body.resumeState);

    const updated = await updatePendingAccountLinkState({
      stateToken,
      sessionId,
      lists,
      resumeState,
    });

    return new Response(JSON.stringify({ ok: updated }), {
      status: updated ? 200 : 404,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("pending account state update failed:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update pending account state" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
