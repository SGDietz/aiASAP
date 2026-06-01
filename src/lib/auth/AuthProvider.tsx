"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowser, getSupabaseBrowserOrNull } from "./supabaseBrowser";
import { installClientLogger, setClientLoggerUser } from "../observability/clientLogger";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Track previous user id so we only fire the anonymous-link call once
  // per sign-in transition.
  const lastLinkedRef = useRef<string | null>(null);

  useEffect(() => {
    // Install global error handlers exactly once for the app's lifetime.
    installClientLogger();

    // Graceful when Supabase env vars aren't configured (e.g. fresh local
    // dev or a Vercel preview before envs are added). Renders in anonymous
    // mode rather than crashing the whole app.
    const supabase = getSupabaseBrowserOrNull();
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Initial fetch
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      setClientLoggerUser(data.session?.user?.id ?? null);
    });

    // Subscribe to changes
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setUser(next?.user ?? null);

      // SIGNED_IN fires on both sign-in and token refresh; only act on
      // the first transition for a given user id.
      if (
        event === "SIGNED_IN" &&
        next?.user?.id &&
        lastLinkedRef.current !== next.user.id
      ) {
        lastLinkedRef.current = next.user.id;
        setClientLoggerUser(next.user.id);
        void linkAnonymousSessions();
      }
      if (event === "SIGNED_OUT") {
        lastLinkedRef.current = null;
        setClientLoggerUser(null);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    // Tell any active LiveAvatar session to stop BEFORE we clear auth
    // state. LiveAvatarSession listens for this window event and calls
    // its stopSession() — kills credit burn on sign-out.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("aiasap.auth.signing-out"));
    }
    const supabase = getSupabaseBrowserOrNull();
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ user, session, loading, signOut }),
    [user, session, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useUser() {
  return useContext(AuthContext);
}

/**
 * Drains any anonymous session ids stashed in localStorage and posts them
 * to /api/auth/link-session so server-side rows get re-keyed to the now-
 * authenticated user. Safe to call on every sign-in; the route is idempotent.
 */
async function linkAnonymousSessions() {
  if (typeof window === "undefined") return;
  const KEY = "isolve.anonymous.session_ids";
  let ids: string[] = [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) ids = JSON.parse(raw) as string[];
  } catch {
    // localStorage unreadable — still call the server below with no ids so
    // the email-based fallback can link by the user's email.
    ids = [];
  }
  if (!Array.isArray(ids)) ids = [];

  // ALWAYS call link-session on sign-in, even when localStorage carries zero
  // ids. The magic-link round-trip frequently lands in a fresh tab/browser
  // that never saw the anonymous session_ids, so the browser list is often
  // empty exactly when linking matters most. The server route unions these
  // ids with every session_id recorded against the user's email at magic-
  // link-send time and links + retro-extracts memory by email — but only if
  // the client actually calls it. (Was early-returning on empty ids, so the
  // server fallback never ran. 2026-06-01 turnaround-recall fix.)
  try {
    const res = await fetch("/api/auth/link-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_ids: ids }),
    });
    // Only drop the local ids once the server has accepted them, so a failed
    // call doesn't lose un-linked ids. Idempotent on the server side.
    if (res.ok && ids.length > 0) {
      window.localStorage.removeItem(KEY);
    }
  } catch (e) {
    console.error("link-session failed", e);
  }
}

/**
 * Helper for the LiveAvatar session flow to record a new anonymous
 * session id in localStorage, so it can later be re-keyed on sign-in.
 */
export function rememberAnonymousSessionId(sessionId: string) {
  if (typeof window === "undefined" || !sessionId) return;
  const KEY = "isolve.anonymous.session_ids";
  try {
    const raw = window.localStorage.getItem(KEY);
    const ids: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!ids.includes(sessionId)) {
      ids.push(sessionId);
      // Cap to last 20 to keep localStorage small.
      const trimmed = ids.slice(-20);
      window.localStorage.setItem(KEY, JSON.stringify(trimmed));
    }
  } catch {
    // ignore localStorage failures
  }
}
