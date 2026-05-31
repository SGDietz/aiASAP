import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";
import { getAccountCookieName } from "../../../../src/lib/accountPersistence";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { getSupabaseServer } from "../../../../src/lib/auth/supabaseServer";

function clearAccountCookieHeader() {
  return [
    `${getAccountCookieName()}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Secure",
  ].join("; ");
}

/**
 * Returns the current Supabase auth state plus any saved lists + resume
 * state for the signed-in user.
 *
 * Anonymous → { authenticated: false }
 * Signed-in → { authenticated: true, user: {email, fullName}, lists, resumeState }
 *
 * G 2026-05-22 IMPORTANT: this route MUST return fast even on Supabase
 * slowness/hang — the page-load voice flow waits for accountAuthChecked
 * before firing 6's greeting. A previous version of this route hung on
 * cold-start Supabase calls and blocked 6 entirely. Every external call
 * is now wrapped in a hard 1500ms timeout that falls back to anonymous.
 */
export async function GET(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  // Race the Supabase auth check against a 1500ms timeout. If Supabase
  // is slow or hangs, we fall back to anonymous so 6 can still fire.
  const TIMEOUT_MS = 1500;
  let userEmail: string | null = null;
  let userFullName: string | null = null;

  try {
    const authResult = await Promise.race([
      (async () => {
        const supabase = await getSupabaseServer();
        const { data, error } = await supabase.auth.getUser();
        return { data, error };
      })(),
      new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(
          () => resolve({ data: null, error: { message: "timeout" } }),
          TIMEOUT_MS,
        ),
      ),
    ]);

    if (authResult.data && !authResult.error) {
      const user = (authResult.data as { user?: { email?: string; user_metadata?: Record<string, unknown> } }).user;
      if (user?.email) {
        userEmail = user.email;
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        userFullName =
          typeof meta.full_name === "string"
            ? meta.full_name
            : typeof meta.fullName === "string"
              ? (meta.fullName as string)
              : null;
      }
    }
  } catch (error) {
    console.error("/api/account/me auth check threw:", error);
  }

  if (!userEmail) {
    return new Response(
      JSON.stringify({ authenticated: false, beta: true }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": clearAccountCookieHeader(),
        },
      },
    );
  }

  // Fetch saved lists + resume state. Also timeout-bounded to prevent hang.
  let lists: unknown[] = [];
  let resumeState: unknown = null;

  const supaUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supaUrl && serviceRoleKey) {
    try {
      const nowIso = new Date().toISOString();
      const url = `${supaUrl}/rest/v1/account_email_links?email=eq.${encodeURIComponent(userEmail)}&expires_at=gte.${encodeURIComponent(nowIso)}&order=created_at.desc&limit=1&select=captured_lists`;
      const fetchResult = await Promise.race([
        fetch(url, {
          method: "GET",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        }),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 1000),
        ),
      ]);
      if (fetchResult.ok) {
        const rows = (await fetchResult.json()) as Array<{ captured_lists: unknown }>;
        const captured = rows[0]?.captured_lists;
        if (captured && typeof captured === "object" && !Array.isArray(captured)) {
          const obj = captured as Record<string, unknown>;
          if (Array.isArray(obj.lists)) lists = obj.lists;
          if (obj.resumeState && typeof obj.resumeState === "object") {
            resumeState = obj.resumeState;
          }
        } else if (Array.isArray(captured)) {
          lists = captured;
        }
      }
    } catch (error) {
      console.error("/api/account/me lists fetch threw:", error);
    }
  }

  return new Response(
    JSON.stringify({
      authenticated: true,
      user: { email: userEmail, fullName: userFullName },
      lists,
      resumeState,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
