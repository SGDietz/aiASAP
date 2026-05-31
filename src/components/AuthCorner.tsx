"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "../lib/auth/AuthProvider";

// v2.1: this component is NOT mounted (voice-only direction — kept dormant
// per the dormant-default pattern, same as feat where it was commented out).
// De-i18n'd for v2.1: gold is flat (no next-intl / no app/[locale] tree), so
// the next-intl `useTranslations` + i18n `Link` imports were swapped for plain
// labels + next/link so the file still compiles if someone re-mounts it.

/**
 * Tiny auth indicator pinned in the top-right corner.
 *
 * Anonymous → "Sign in" link.
 * Signed-in  → email + "Sign out" button.
 *
 * G 2026-05-21: LocalePicker removed — auto language detection only.
 */
export function AuthCorner() {
  const { user, loading, signOut } = useUser();
  const [busy, setBusy] = useState(false);

  /* G 2026-05-22 /goal "M1 preview is one-tap-real": Sign in REACTIVATED.
     Surface is unobtrusive (top-right corner indicator); voice-first stays
     intact. Anonymous → "Sign in" link to /auth/sign-in. Signed-in → email
     + Sign out. AuthProvider wraps from root layout. */
  if (loading) {
    return (
      <div className="fixed top-3 right-3 z-50 flex items-center gap-2 text-xs text-zinc-500">
        <span>…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed top-3 right-3 z-50 flex items-center gap-2">
        <Link
          href="/auth/sign-in"
          className="rounded-md bg-zinc-800/80 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 backdrop-blur"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const label = user.email ?? user.phone ?? user.id.slice(0, 8);

  return (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-2 rounded-md bg-zinc-800/80 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur">
      <span className="max-w-[160px] truncate">{label}</span>
      <button
        type="button"
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          try {
            await signOut();
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="text-zinc-400 hover:text-white disabled:opacity-50"
      >
        {busy ? "…" : "Sign out"}
      </button>
    </div>
  );
}
