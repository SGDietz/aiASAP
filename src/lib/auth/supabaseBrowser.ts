"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Browser-side Supabase client. Reads NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY (inlined into the client bundle at build
 * time). Cached as a singleton so we don't churn auth state listeners.
 *
 * Throws if env vars are missing. Use getSupabaseBrowserOrNull() at
 * surfaces that need to render gracefully when auth isn't configured.
 */
export function getSupabaseBrowser(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set",
    );
  }
  // detectSessionInUrl MUST be on so the magic-link round-trip lands a session.
  // aiASAP's OTP send (/api/account/start) issues an IMPLICIT-flow link, so the
  // token comes back in the URL hash (#access_token=...). The server callback
  // route can't read a fragment, so it forwards us here with the hash intact and
  // this client parses it, persists the session to cookies, and fires SIGNED_IN
  // (AuthProvider then links memory). flowType stays "pkce" so social-login OAuth
  // (?code=) still works — implicit-hash detection runs regardless of flowType.
  // (Both are the @supabase/ssr defaults; set explicitly to lock the behavior.)
  cached = createBrowserClient(url, anonKey, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return cached;
}

/**
 * Same as getSupabaseBrowser but returns null instead of throwing when
 * env vars aren't configured. Used by AuthProvider so the app still
 * renders in anonymous mode when Supabase env isn't wired up (e.g.
 * fresh local dev or a preview before envs are added in Vercel).
 */
export function getSupabaseBrowserOrNull(): SupabaseClient | null {
  try {
    return getSupabaseBrowser();
  } catch {
    return null;
  }
}
