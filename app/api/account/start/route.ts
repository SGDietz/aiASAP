import {
  assertAllowedOrigin,
  isSafeTranscriptionSessionId,
} from "../../../../src/lib/apiRouteSecurity";
import {
  hashToken,
  createPendingAccountLink,
  newToken,
  normalizeEmail,
  sanitizeAccountResumeState,
  sanitizeAssistantLists,
  sendAccountEmail,
} from "../../../../src/lib/accountPersistence";
import { checkRateLimit } from "../../../../src/lib/rateLimit";

function siteOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "https://ai-asap.vercel.app";
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);
    if (!email) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sessionId =
      typeof body.sessionId === "string" &&
      isSafeTranscriptionSessionId(body.sessionId)
        ? body.sessionId.trim()
        : null;
    const lists = sanitizeAssistantLists(body.lists);
    const resumeState = sanitizeAccountResumeState(body.resumeState);
    const token = newToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    const verificationUrl = `${siteOrigin(
      request,
    )}/api/account/verify?token=${encodeURIComponent(token)}`;

    await createPendingAccountLink({
      email,
      sessionId,
      tokenHash,
      lists,
      resumeState,
      expiresAt,
    });

    const emailSent = await sendAccountEmail({ to: email, verificationUrl });
    return new Response(
      JSON.stringify({
        ok: true,
        email,
        emailSent,
        expiresAt,
        verificationUrl:
          emailSent || process.env.NODE_ENV === "production"
            ? null
            : verificationUrl,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("account start failed:", error);
    return new Response(JSON.stringify({ error: "Failed to start account setup" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
