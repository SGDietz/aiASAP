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

        if (error) {
          return NextResponse.redirect(
            new URL(
              `/auth/sign-in?error=${encodeURIComponent(error.message)}`,
              request.url,
            ),
          );
        }
      } catch (e) {
        console.error("auth/callback exchange failed", e);
        return NextResponse.redirect(
          new URL("/auth/sign-in?error=callback_failed", request.url),
        );
      }
    }
  }

  return response;
}
