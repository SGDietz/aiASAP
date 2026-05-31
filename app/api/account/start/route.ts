import { assertAllowedOrigin, truncateUtf8String } from "../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../src/lib/rateLimit";

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/**
 * Voice-driven account setup endpoint.
 *
 * Called by LiveAvatarSession.startAccountSetup() after 6 walks the user
 * through email collection + read-back confirmation. Fires Supabase's OTP
 * magic-link email (Supabase handles delivery via its configured SMTP/Resend).
 *
 * Also saves the user's lists + conversation resume state to
 * account_email_links.captured_lists (as a JSON object `{ lists, resumeState }`)
 * so when the user clicks the magic link and returns signed in, the app can
 * restore exactly where we left off.
 *
 * The /api/liveavatar/session-transcript/sync endpoint also independently
 * fires the magic link when 6's transcript matches the trigger phrase —
 * Supabase de-dupes server-side, so the redundancy is safe.
 *
 * G 2026-05-22: Rebuilt during voice-only auth flow finalization.
 */
export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  const supaUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  if (!supaUrl || !anonKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        emailSent: false,
        error: "Supabase not configured",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let email = "";
  let fullName: string | null = null;
  let sessionId: string | null = null;
  let lists: unknown[] = [];
  let resumeState: unknown = null;

  try {
    const body = await request.json();
    email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    fullName =
      typeof body.fullName === "string"
        ? truncateUtf8String(body.fullName.trim(), 200)
        : null;
    sessionId =
      typeof body.sessionId === "string"
        ? truncateUtf8String(body.sessionId.trim(), 100)
        : null;
    lists = Array.isArray(body.lists) ? body.lists.slice(0, 50) : [];
    resumeState =
      body.resumeState && typeof body.resumeState === "object"
        ? body.resumeState
        : null;
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        emailSent: false,
        error: "Invalid request body",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!EMAIL_RE.test(email)) {
    return new Response(
      JSON.stringify({
        ok: false,
        emailSent: false,
        error: "Invalid email address",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // v2.1 resume-bug fix (part c): carry ?account=verified through the magic
  // link so the post-sign-in return fires 6's welcome-back + resume path.
  // Was `next=/` (no signal) — that's why returning users looked brand-new.
  const redirectTo = `${siteUrl.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent("/?account=verified")}`;

  // Fire Supabase OTP magic-link send.
  let emailSent = false;
  let supabaseError: string | null = null;

  try {
    const otpRes = await fetch(`${supaUrl}/auth/v1/otp`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        create_user: true,
        options: {
          emailRedirectTo: redirectTo,
          data: { full_name: fullName, session_id: sessionId },
        },
      }),
    });

    if (otpRes.ok) {
      emailSent = true;
    } else {
      const detail = await otpRes.text();
      supabaseError = `Magic link send failed (${otpRes.status})`;
      console.error("Supabase OTP failed:", otpRes.status, detail.slice(0, 200));
    }
  } catch (error) {
    supabaseError = "Magic link send threw";
    console.error("/api/account/start OTP threw:", error);
  }

  // Save lists + resumeState to account_email_links for post-tap recovery.
  // Use service role to bypass RLS. Failures here don't block the response —
  // the magic link is the critical path.
  let pendingStateToken: string | null = null;
  if (serviceRoleKey && (lists.length > 0 || resumeState)) {
    try {
      pendingStateToken = crypto.randomUUID();
      const tokenHash = await hashToken(pendingStateToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const captured = { lists, resumeState };
      const insertRes = await fetch(
        `${supaUrl}/rest/v1/account_email_links`,
        {
          method: "POST",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            email,
            session_id: sessionId,
            token_hash: tokenHash,
            captured_lists: captured,
            expires_at: expiresAt,
          }),
        },
      );
      if (!insertRes.ok) {
        const detail = await insertRes.text();
        console.error(
          "account_email_links insert failed:",
          insertRes.status,
          detail.slice(0, 200),
        );
        pendingStateToken = null;
      }
    } catch (error) {
      console.error("account_email_links insert threw:", error);
      pendingStateToken = null;
    }
  }

  if (!emailSent) {
    return new Response(
      JSON.stringify({
        ok: false,
        emailSent: false,
        error: supabaseError || "Failed to send magic link",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, emailSent: true, pendingStateToken }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
