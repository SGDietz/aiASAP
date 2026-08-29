import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";

/**
 * Write a SERVER-readable Supabase auth cookie from implicit-flow tokens the
 * browser parsed out of the magic-link #hash.
 *
 * Why this exists (DB-confirmed 2026-06-02, same browser): aiASAP's OTP magic
 * link is IMPLICIT flow — the session token returns in the URL #fragment. The
 * landing page calls supabase.auth.setSession() in the browser, but that did
 * NOT reliably land a SERVER-readable cookie: /api/account/me kept reading
 * `authCookies=0` on the return, so 6 greeted returning users as brand-new.
 *
 * Fix: the client hands us the tokens, and we setSession() on a server client
 * whose cookie adapter writes the auth cookies onto THIS response — the exact
 * pattern /auth/callback already uses for ?code= / ?token_hash= logins. After
 * this resolves, /api/account/me (server, cookie-based) sees the signed-in user
 * on the same page load.
 */
export async function POST(request: NextRequest) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;

  let body: { access_token?: unknown; refresh_token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const accessToken =
    typeof body.access_token === "string" ? body.access_token : "";
  const refreshToken =
    typeof body.refresh_token === "string" ? body.refresh_token : "";
  if (!accessToken || !refreshToken) {
    return NextResponse.json(
      { ok: false, error: "missing tokens" },
      { status: 400 },
    );
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json(
      { ok: false, error: "supabase not configured" },
      { status: 500 },
    );
  }

  // Write cookies onto THIS response (route-handler context — set works here).
  const response = NextResponse.json({ ok: true });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // setSession validates the tokens with Supabase and triggers the cookie write.
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 401 },
    );
  }
  return response;
}
