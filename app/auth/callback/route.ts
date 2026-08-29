import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * OAuth + magic-link callback handler.
 *
 * Three return shapes can land here, depending on how Supabase issued the link:
 *
 *   1. `?code=...`               — PKCE / OAuth. Exchange via exchangeCodeForSession.
 *   2. `?token_hash=...&type=...`— PKCE-less email OTP (when the email template uses
 *                                  {{ .TokenHash }}). Verify via verifyOtp.
 *   3. `#access_token=...`       — IMPLICIT flow (Supabase's default {{ .ConfirmationURL }}
 *                                  with no PKCE challenge — this is what aiASAP's
 *                                  /api/account/start OTP send produces today). The token
 *                                  rides in the URL *fragment*, which a server route can
 *                                  NEVER read. We forward to `next` and let the BROWSER
 *                                  Supabase client (detectSessionInUrl) parse the hash on
 *                                  the landing page.
 *
 * For cases 1 & 2 we establish the session HERE and write the auth cookies straight
 * onto the redirect response. There is no Next.js middleware in this app, so cookies
 * MUST be written on this response or the session would never stick (the old code
 * relied on a "middleware refresh path" that does not exist — that's why returning
 * users looked brand-new). v2.1 magic-link recall fix, 2026-06-01.
 */

const AIASAP_SUPABASE_REF = "wqszxsqzkaatghyrqviv";
const ISOLVE_SUPABASE_REF = "dphxcqjkzhvsdejtxdcj";

/**
 * Flip account_email_links.used_at on the EXACT row carrying this link's token.
 * Ported from iSolve 2026-08-21.
 *
 * This is what makes cross-device sign-in work: the magic link is opened on a
 * phone, this stamps the row, and the laptop running 6 sees it on its next poll
 * of /api/account/session-status.
 *
 * Matching on email AND token_hash AND used_at IS NULL is not fussiness. Match
 * on email alone and a person with two sessions open gets the wrong one greeted.
 *
 * Depends on account/start storing Supabase's real hashed_token, fixed the same
 * day. If that ever regresses this matches zero rows, so the row count is logged
 * loudly rather than failing in silence.
 */
async function markDeviceLinkUsed(email: string, tokenHash: string): Promise<void> {
  const supaUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceRoleKey || !tokenHash || !email) return;
  // Wrong-project guard: never touch iSolve's database from aiASAP.
  if (supaUrl.includes(ISOLVE_SUPABASE_REF) || !supaUrl.includes(AIASAP_SUPABASE_REF)) return;

  try {
    const q =
      `${supaUrl}/rest/v1/account_email_links?email=eq.${encodeURIComponent(email.toLowerCase())}` +
      `&token_hash=eq.${encodeURIComponent(tokenHash)}&used_at=is.null`;
    const res = await fetch(q, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        // Ask for the row back so a real flip can be told apart from a silent
        // zero-row PATCH. Never log the row itself - it carries the token.
        Prefer: "return=representation",
      },
      body: JSON.stringify({ used_at: new Date().toISOString() }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        "auth/callback: used_at patch failed",
        res.status,
        detail.slice(0, 200),
      );
      return;
    }
    const rows = await res.json().catch(() => null);
    const rowCount = Array.isArray(rows) ? rows.length : -1;
    // Count only, never the row. Anything but 1 means the link and the stored
    // token have drifted apart and cross-device greeting is broken.
    console.error("[auth/callback] deviceLinkFlip rowCount=" + rowCount);
  } catch (e) {
    console.error("auth/callback: used_at patch threw", e);
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  // Preserve the post-sign-in destination (incl. any ?account=verified signal
  // the magic link carries — v2.1 resume-bug fix part c). Only accept a
  // relative path to avoid an open redirect; anything else falls back to "/".
  const rawNext = url.searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") ? rawNext : "/";

  // RECALL FIX v3 (2026-06-01): IMPLICIT magic-link flow — no server-readable
  // ?code= or ?token_hash=. The session token rides in the URL #hash, which a
  // server route can't read AND a server 3xx redirect would DROP. So instead of
  // redirecting server-side (which silently lost #access_token across 3 failed
  // turnarounds), serve a tiny page that CLIENT-redirects to `next` carrying the
  // hash forward. The landing page then setSession()s from the preserved hash.
  if (!code && !tokenHash) {
    // `next` is validated to start with "/"; JSON-encode + escape "<" so it can't
    // break out of the inline <script>.
    const safeNext = JSON.stringify(next).replace(/</g, "\\u003c");
    const html =
      `<!doctype html><html><head><meta charset="utf-8">` +
      `<meta name="robots" content="noindex"></head><body>` +
      `<script>location.replace(${safeNext} + (window.location.hash || ""));</script>` +
      `</body></html>`;
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Build the redirect response up front so the Supabase server client can write
  // session cookies directly onto it (belt-and-suspenders: no middleware exists).
  const response = NextResponse.redirect(new URL(next, request.url));

  // Only do server-side establishment when we actually have a server-readable
  // token. The implicit (#access_token) case has neither `code` nor `token_hash`
  // — we just forward and the browser client handles the fragment.
  if (code || (tokenHash && type)) {
    const supaUrl =
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey =
      process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supaUrl && anonKey) {
      try {
        const supabase = createServerClient(supaUrl, anonKey, {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(
              cookiesToSet: {
                name: string;
                value: string;
                options: CookieOptions;
              }[],
            ) {
              // Write session cookies onto the redirect response so the session
              // persists across the round-trip back to the app.
              for (const { name, value, options } of cookiesToSet) {
                response.cookies.set(name, value, options);
              }
            },
          },
        });

        const { error } = code
          ? await supabase.auth.exchangeCodeForSession(code)
          : await supabase.auth.verifyOtp({
              token_hash: tokenHash as string,
              type: (type as EmailOtpType) ?? "email",
            });

        if (!error && tokenHash) {
          // Cross-device: stamp the row so the laptop running 6 finds out this
          // person just signed in on their phone. Best-effort and awaited, so
          // the poll cannot beat the write and report "not signed in".
          try {
            const { data: userData } = await supabase.auth.getUser();
            const signedInEmail = userData?.user?.email ?? null;
            if (signedInEmail) {
              await markDeviceLinkUsed(signedInEmail, String(tokenHash));
            }
          } catch (e) {
            // Never let this break the sign-in itself.
            console.error("auth/callback: device-link stamp skipped", e);
          }
        }

        if (error) {
          // There is NO /auth/sign-in page (voice-only app) — redirecting there
          // 404'd the click-through. Land on HOME with an error flag so the user
          // can just keep talking to 6 / retry, never a dead 404. (2026-06-03)
          return NextResponse.redirect(
            new URL(
              `/?auth_error=${encodeURIComponent(error.message.slice(0, 80))}`,
              request.url,
            ),
          );
        }
      } catch (e) {
        console.error("auth/callback exchange failed", e);
        return NextResponse.redirect(
          new URL("/?auth_error=callback_failed", request.url),
        );
      }
    }
  }

  return response;
}
