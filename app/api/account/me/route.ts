import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";
import { getAccountCookieName } from "../../../../src/lib/accountPersistence";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { getSupabaseServer } from "../../../../src/lib/auth/supabaseServer";
import { getSupabaseAuthName } from "../../../../src/lib/auth/resolveUserName";

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

  // DIAG (2026-06-02 recall): did an auth cookie actually reach the server?
  // authCookies>0 + anonymous result = token present but getUser timed out/failed
  // (timing bug). authCookies=0 = no cookie reached us (cross-browser / setSession
  // didn't persist). Read via `vercel logs` after a test to settle which.
  const cookieHeader = request.headers.get("cookie") || "";
  const authCookieCount = (cookieHeader.match(/sb-[A-Za-z0-9_-]+-auth-token/g) || []).length;

  // Race the Supabase auth check against a timeout. If Supabase is slow or hangs,
  // we fall back to anonymous so 6 can still fire. Bumped 1500→2500ms (2026-06-02):
  // the magic-link return's first getUser() on a cold function was timing out at
  // 1500ms → returning user read as anonymous → 6 greeted them as brand-new.
  const TIMEOUT_MS = 2500;
  let userEmail: string | null = null;
  let userFullName: string | null = null;
  let visitCount = 1;
  let longGap = false;
  let uiSizeLevel: number | null = null;
  let timezone: string | null = null;
  let zip: string | null = null;
  let savedListsMeta: unknown[] | null = null;
  let savedResumeMeta: unknown = null;

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
        userFullName = getSupabaseAuthName(user);
        // Voice sizing follows the ACCOUNT for returning users (G 2026-06-10:
        // "the pill boxes stay the size of when last used... if they have an
        // account and are returning").
        if (
          typeof meta.ui_size_level === "number" &&
          meta.ui_size_level >= 0 &&
          meta.ui_size_level <= 4
        ) {
          uiSizeLevel = meta.ui_size_level;
        }
        // Voice-set timezone (2026-06-11) — follows the account everywhere.
        if (typeof meta.timezone === "string" && meta.timezone) {
          timezone = meta.timezone;
        }
        // Durable ZIP (2026-06-13): surfaced into 6's memory snapshot so a
        // returning user is never asked for it again.
        if (typeof meta.zip === "string" && /^\d{5}$/.test(meta.zip)) {
          zip = meta.zip;
        }
        // Durable saved lists (2026-06-13): the ongoing list-save writes here.
        // Takes precedence over the start-time captured_lists snapshot below, so
        // a returning user's lists come back EXACTLY as they left them.
        if (
          meta.assistant_lists &&
          typeof meta.assistant_lists === "object" &&
          !Array.isArray(meta.assistant_lists)
        ) {
          const al = meta.assistant_lists as Record<string, unknown>;
          if (Array.isArray(al.lists)) savedListsMeta = al.lists;
          if (al.resumeState && typeof al.resumeState === "object") {
            savedResumeMeta = al.resumeState;
          }
        }
        // Per-account visit counter (drives 6's tiered returning intros).
        // De-duped by a 30-min window so page refreshes don't inflate the count.
        const prevVisits =
          typeof meta.visit_count === "number" ? meta.visit_count : 0;
        const lastVisitMs =
          typeof meta.last_visit_at === "string"
            ? Date.parse(meta.last_visit_at)
            : NaN;
        const nowMs = Date.now();
        const isNewVisit =
          Number.isNaN(lastVisitMs) || nowMs - lastVisitMs > 30 * 60 * 1000;
        visitCount = isNewVisit ? prevVisits + 1 : Math.max(prevVisits, 1);
        longGap =
          !Number.isNaN(lastVisitMs) &&
          nowMs - lastVisitMs > 14 * 24 * 60 * 60 * 1000;
        if (isNewVisit) {
          // Fire-and-forget: never block 6's greeting on the counter write.
          void (async () => {
            try {
              const sb = await getSupabaseServer();
              await sb.auth.updateUser({
                data: {
                  visit_count: visitCount,
                  last_visit_at: new Date(nowMs).toISOString(),
                },
              });
            } catch {
              // best-effort only
            }
          })();
        }
      }
    }
  } catch (error) {
    console.error("/api/account/me auth check threw:", error);
  }

  console.log(
    `[account/me DIAG] authCookies=${authCookieCount} result=${userEmail ? "AUTH:" + userEmail : "anonymous"}`,
  );

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
  // Bumped 1000→2500ms (2026-06-03): on a cold magic-link RETURN this second
  // Supabase call timed out at 1000ms → resumeState=null → the client built an
  // EMPTY memory snapshot → 6 had nothing to recall ("I can't recall the exact
  // details", "pleasure to meet you"). The auth call above hit the same cold-
  // start wall and was already bumped to 2500ms; match it here.
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
          setTimeout(() => reject(new Error("timeout")), 2500),
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
          // Name fallback: signup writes the name to captured_lists.fullName,
          // which is often set even when user_metadata.full_name isn't. Without
          // this the returning user's name never reached 6, so he asked for it
          // again and ran the first-meet greeting (G 2026-06-03). The client
          // still runs cleanDeviceName on this, so a junk value is dropped.
          if (
            !userFullName &&
            typeof obj.fullName === "string" &&
            obj.fullName.trim()
          ) {
            userFullName = obj.fullName.trim();
          }
        } else if (Array.isArray(captured)) {
          lists = captured;
        }
      }
    } catch (error) {
      console.error("/api/account/me lists fetch threw:", error);
    }
  }

  // Durable user_metadata lists win over the start-time captured_lists snapshot.
  if (savedListsMeta) lists = savedListsMeta;
  if (savedResumeMeta !== null) resumeState = savedResumeMeta;

  return new Response(
    JSON.stringify({
      authenticated: true,
      user: { email: userEmail, fullName: userFullName },
      lists,
      resumeState,
      visitCount,
      longGap,
      uiSizeLevel,
      timezone,
      zip,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
