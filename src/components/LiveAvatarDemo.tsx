"use client";

import { useState, useCallback, useEffect, useRef } from "react";
// import Image from "next/image";
import { LiveAvatarSession } from "./LiveAvatarSession";
import Link from "next/link";

type LiveAvatarMode = "FULL" | "CUSTOM";

function getRequestedLiveAvatarMode(): LiveAvatarMode {
  // CUSTOM is the DEFAULT again (G, 2026-06-14): CUSTOM keeps OUR brain
  // (/api/openai-chat-complete) in control — no interrupting, remembers the user,
  // shows the account, never double-greets. Pure FULL was tried but ran the
  // LiveAvatar server brain, which brought all those problems back. For 6's MOUTH
  // to move we no longer switch the component to FULL; instead the CUSTOM mint
  // (/api/start-custom-session) now mints a room-based session WITH a voice but NO
  // context_id, so repeat() lip-syncs in 6's voice while our brain still drives.
  // ?mode=full is the escape hatch to the old LiveAvatar-everything (server-brain) path.
  if (typeof window === "undefined") {
    return "CUSTOM";
  }
  const params = new URLSearchParams(window.location.search);
  const value =
    params.get("mode") ??
    params.get("avatarMode") ??
    params.get("liveavatarMode") ??
    "";
  return value.toLowerCase() === "full" ? "FULL" : "CUSTOM";
}

// Post-click magic-link return arrives at "/?account=verified". Detect it
// synchronously (before first render) so the auto-start bootstrap never fires —
// we want the user to TAP before session 2 spins up. (G 2026-06-03)
function isPostClickReturn(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("account") === "verified";
}

export const LiveAvatarDemo = () => {
  const [sessionToken, setSessionToken] = useState("");
  const [mode] = useState<LiveAvatarMode>(getRequestedLiveAvatarMode);
  // DISABLED (G 2026-06-03): the separate static tap-screen was redundant — the
  // live view's own "Tap/Click ANYWHERE To Talk To 6" begin-surface IS the tap-
  // gate AND is identical (it's the real view) AND unlocks audio so the greeting
  // is heard. So the click-through now auto-starts straight into the live view,
  // exactly like a first session. (isPostClickReturn kept dormant for reference.)
  void isPostClickReturn;
  const [awaitReturnTap, setAwaitReturnTap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExited, setIsExited] = useState(false);
  const sessionBootstrapRef = useRef(false);
  // Set true the moment the user explicitly closes/ends the session. Guards the
  // bootstrap effect below so that onSessionStopped clearing the token can never
  // race the auto-start back into a fresh session before isExited flips to true.
  // Cleared only when the user taps Restart. Inactivity-stop never sets this.
  const explicitExitRef = useRef(false);

  const startSession = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Languages switchboard (2026-06-10): carry ?lang=es (etc.) from the URL
      // into session start so 6 speaks it from the first word. Read at call
      // time so a restart keeps the same language.
      const requestedLang =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("lang")
          : null;
      // Device timezone (2026-06-11): rung 1 of the timezone ladder — sent
      // automatically so 6 always knows the user's local clock, nobody asked.
      let deviceTz: string | null = null;
      try {
        deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
      } catch {
        // Very old browsers — 6 just won't know the local time.
      }
      const res = await fetch(
        mode === "CUSTOM" ? "/api/start-custom-session" : "/api/start-session",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang: requestedLang, tz: deviceTz }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Failed to start session");
        setIsLoading(false);
        return;
      }
      const { session_token } = await res.json();
      setSessionToken(session_token);
      setIsLoading(false);
    } catch (err: unknown) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (isExited || sessionToken) {
      return;
    }
    // Explicit close in flight: do NOT auto-start. onSessionStopped may have
    // cleared the token a tick before isExited flips, and without this guard the
    // app would immediately bootstrap a brand-new session ("reopen") instead of
    // landing on the Restart screen.
    if (explicitExitRef.current) {
      return;
    }
    // Post-click magic-link return: wait for the user to tap-to-start before
    // spinning up session 2. Credits + the welcome-back greeting fire on tap.
    if (awaitReturnTap) {
      return;
    }
    if (sessionBootstrapRef.current) {
      return;
    }
    sessionBootstrapRef.current = true;
    void startSession();
  }, [isExited, sessionToken, startSession, awaitReturnTap]);

  const onSessionStopped = (opts?: { reason?: "inactivity" }) => {
    void opts;
    sessionBootstrapRef.current = false;
    // G 2026-06-01 (FIRST ORDER — CREDITS / MONEY): NEVER auto-restart on a
    // session stop. The old non-inactivity branch cleared the token WITHOUT
    // setting isExited, so the bootstrap effect immediately started a BRAND-NEW
    // LiveAvatar session (= burning credits) every time a session dropped or 6
    // closed it ("took a long time to close and it restarted"). Now ANY stop —
    // inactivity, brain-driven close, or a drop — lands on the "Session Ended" /
    // Restart screen, so a new session only ever starts on an explicit user tap.
    setIsExited(true);
    setSessionToken("");
  };

  // Helper function to try closing the tab with multiple methods
  const tryCloseTab = () => {
    if (typeof window === "undefined") return;

    // Try window.close() multiple times with different approaches
    try {
      window.close();
    } catch (e) {
      // Ignore
    }

    // Try self.close() (some browsers support this)
    try {
      (window as any).self?.close();
    } catch (e) {
      // Ignore
    }

    // Try top.close() if in iframe
    try {
      if (window.top && window.top !== window) {
        (window.top as any).close();
      }
    } catch (e) {
      // Ignore
    }
  };

  const handleExit = (completeExit: boolean = false) => {
    if (completeExit) {
      // Aggressively try to exit/close the tab on mobile
      if (typeof window !== "undefined") {
        // Detect if we're on mobile
        const isMobile =
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent,
          );

        // For mobile: Try multiple aggressive exit strategies
        if (isMobile) {
          // Strategy 1: Try window.close() immediately (works if opened by script)
          try {
            if (window.opener || window.history.length === 1) {
              window.close();
              // Give it a moment to close
              setTimeout(() => {
                // If still open, try other methods
                tryCloseTab();
              }, 100);
              return;
            }
          } catch (e) {
            // Fall through to other methods
          }

          // Strategy 2: Navigate to about:blank to minimize the page
          // This creates a blank page that's easy to close
          try {
            window.location.replace("about:blank");
            // Also try to close after navigation
            setTimeout(() => {
              try {
                window.close();
              } catch (e) {
                // Ignore - already on blank page
              }
            }, 100);
            return;
          } catch (e) {
            console.warn("Failed to navigate to about:blank:", e);
          }

          // Strategy 3: Try history.back() if available
          if (window.history.length > 1) {
            try {
              window.history.back();
              return;
            } catch (e) {
              // Continue to next strategy
            }
          }

          // Strategy 4: Navigate to referrer if available
          const referrer = document.referrer;
          if (
            referrer &&
            referrer !== window.location.href &&
            referrer !== ""
          ) {
            try {
              window.location.replace(referrer);
              return;
            } catch (e) {
              // Continue to final strategy
            }
          }

          // Strategy 5: Final fallback - Navigate to about:blank
          // This at least minimizes the page content
          try {
            window.location.replace("about:blank");
          } catch (e) {
            // Last resort: Show exit message
            setIsExited(true);
            setSessionToken("");
          }
        } else {
          // For desktop: Use standard navigation
          if (window.history.length > 1) {
            try {
              window.history.back();
              return;
            } catch (e) {
              // Fall through
            }
          }

          const referrer = document.referrer;
          if (
            referrer &&
            referrer !== window.location.href &&
            referrer !== ""
          ) {
            try {
              window.location.href = referrer;
              return;
            } catch (e) {
              // Fall through
            }
          }

          try {
            window.location.href = "/";
          } catch (e) {
            setIsExited(true);
            setSessionToken("");
          }
        }
      }
      return;
    }
    // Regular exit - show "Session Ended" message. Mark the explicit close so
    // the bootstrap effect can't auto-restart in the gap before isExited applies.
    explicitExitRef.current = true;
    setIsExited(true);
    setSessionToken("");
  };

  if (awaitReturnTap && !sessionToken) {
    // Post-click return: mirror the NORMAL entry look (static 6 + wordmark), with
    // a tap-to-start. No email box, no auto-session. On tap, session 2 starts and
    // 6 opens with the hard-coded welcome-back greeting. (G 2026-06-03)
    return (
      <div className="relative w-full h-full min-h-screen flex flex-col overflow-hidden bg-[radial-gradient(135%_110%_at_50%_32%,#5a360f_0%,#3a220c_38%,#241608_70%,#190f05_100%)] [--stage-width:100vw] [--stage-height:100svh] [--stage-top:0px] [--stage-bottom:0px] md:[--stage-width:calc(94vh*9/16)] md:[--stage-height:94vh] md:[--stage-top:3vh] md:[--stage-bottom:3vh]">
        {/* Wordmark — VERBATIM from the live LiveAvatarSession view so it's identical */}
        <div className="absolute left-0 right-0 z-10 flex flex-col items-center pb-1 pt-1 sm:pt-2 md:pt-0" style={{ top: "calc(var(--stage-top) + 0.25rem)" }}>
          <div className="text-center px-4">
            <div className="flex items-start justify-center">
              <h1 className="aiasap-logo-mark relative top-[0.45rem] inline-block overflow-visible px-5 pt-1 pb-1 bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-[calc(var(--stage-width)*0.10)] font-bold italic leading-[1.12] tracking-normal text-transparent drop-shadow-[0_1px_6px_rgba(25,15,5,0.4)]">
                aiASAP
              </h1>
            </div>
            <p className="mt-0 text-[calc(var(--stage-width)*0.032)] font-semibold tracking-[0.39em] md:tracking-[0.26em] xl:tracking-[0.55em] uppercase bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent drop-shadow-[0_1px_6px_rgba(25,15,5,0.4)]">
              Take the Leap
            </p>
          </div>
        </div>
        {/* Static 6 framed EXACTLY like the live avatar <video> (9:16 portrait
            centered + gold border on desktop, full-cover on mobile). */}
        <div className="relative w-full flex-1 flex items-center justify-center pb-[8svh] md:pb-0 md:px-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* G 2026-06-14: same black-bar fix as Session Ended — object-cover
              fills the gold frame (no object-contain letterbox, no black bg). */}
          <img
            src="/startscreen.png"
            alt=""
            className="h-full w-full object-cover object-top md:object-cover md:object-top md:h-[94vh] md:max-h-[80rem] md:w-auto md:aspect-[9/16] md:rounded-[2.25rem] md:border md:border-[#d7a05a]/40 md:shadow-[0_0_0_1px_rgba(215,160,90,0.45),0_30px_90px_rgba(0,0,0,0.72)]"
          />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[14svh] md:bottom-[16%] z-20 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setAwaitReturnTap(false);
                sessionBootstrapRef.current = true;
                void startSession();
              }}
              disabled={isLoading}
              aria-label="Tap to talk to 6"
              aria-busy={isLoading}
              className="btn-inset rounded-2xl px-10 py-4 text-xl font-black"
            >
              {isLoading ? "Starting…" : "Tap to talk to 6"}
            </button>
          </div>
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
          <Link
            href="/terms"
            className="text-[11px] bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent"
          >
            © 2026 aiASAP All Rights Reserved · Terms
          </Link>
        </div>
      </div>
    );
  }

  if (isExited) {
    return (
      <div className="relative w-full h-full min-h-screen flex flex-col overflow-hidden bg-[radial-gradient(135%_110%_at_50%_32%,#5a360f_0%,#3a220c_38%,#241608_70%,#190f05_100%)] [--stage-width:100vw] [--stage-height:100svh] [--stage-top:0px] [--stage-bottom:0px] md:[--stage-width:calc(94vh*9/16)] md:[--stage-height:94vh] md:[--stage-top:3vh] md:[--stage-bottom:3vh]">
        {/* Wordmark — VERBATIM from the start/live view so it's identical */}
        <div className="absolute left-0 right-0 z-10 flex flex-col items-center pb-1 pt-1 sm:pt-2 md:pt-0" style={{ top: "calc(var(--stage-top) + 0.25rem)" }}>
          <div className="text-center px-4">
            <div className="flex items-start justify-center">
              <h1 className="aiasap-logo-mark relative top-[0.45rem] inline-block overflow-visible px-5 pt-1 pb-1 bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-[calc(var(--stage-width)*0.10)] font-bold italic leading-[1.12] tracking-normal text-transparent drop-shadow-[0_1px_6px_rgba(25,15,5,0.4)]">
                aiASAP
              </h1>
            </div>
          </div>
        </div>
        {/* Static 6 framed EXACTLY like the start screen + live avatar (9:16
            portrait centered, gold border on desktop, full-cover on mobile). */}
        <div className="relative w-full flex-1 flex items-center justify-center pb-[8svh] md:pb-0 md:px-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* G 2026-06-14: startscreen.png is 385x830 (0.46), NARROWER than the
              9:16 frame, so object-contain letterboxed it and md:bg-black/35
              painted the gaps BLACK ("the black bars shouldn't be there"). Use
              object-cover so 6 FILLS the gold frame edge-to-edge (object-top keeps
              his face; the cropped bottom is where the Session-Ended card sits),
              and drop the black bg. No bars, all 6. */}
          <img
            src="/startscreen.png"
            alt="6, your a-i-buddy"
            className="h-full w-full object-cover object-top md:object-cover md:object-top md:h-[94vh] md:max-h-[80rem] md:w-auto md:aspect-[9/16] md:rounded-[2.25rem] md:border md:border-[#d7a05a]/40 md:shadow-[0_0_0_1px_rgba(215,160,90,0.45),0_30px_90px_rgba(0,0,0,0.72)]"
          />
          {/* Session-ended message + Restart, overlaid where the tap button sits
              on the start screen. Branded brown scrim (no raw black) for legibility. */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[11svh] md:bottom-[14%] z-20 flex flex-col items-center gap-2.5 rounded-2xl border border-[#d7a05a]/35 bg-[#190f05]/60 px-8 py-5 backdrop-blur-sm shadow-[0_0_0_1px_rgba(215,160,90,0.3),0_18px_50px_rgba(0,0,0,0.6)]">
            <div className="text-2xl font-black bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent">Session Ended</div>
            <div className="text-center text-base bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent">
              Thank you for using <span style={{ display: 'inline-block', transform: 'skewX(-10deg)', background: 'linear-gradient(to bottom, #ffe9c2, #d7a05a, #3a2108)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>aiASAP</span>
            </div>
            <button
              type="button"
              onClick={() => {
                explicitExitRef.current = false;
                setIsExited(false);
                sessionBootstrapRef.current = true;
                void startSession();
              }}
              className="btn-inset rounded-lg px-7 py-2.5 text-base font-black"
            >
              Restart
            </button>
          </div>
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
          <Link
            href="/terms"
            className="text-[11px] bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent"
          >
            © 2026 aiASAP All Rights Reserved · Terms
          </Link>
        </div>
      </div>
    );
  }

  /*
  // Start screen (disabled — app bootstraps session automatically; restore this block to show landing UI)
  if (!sessionToken) {
    return (
      <div className="relative w-full h-full min-h-screen flex flex-col items-center justify-end overflow-hidden bg-black">
        <Image
          src="/startscreen.png"
          alt="Start screen"
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />
        <div className="absolute top-0 left-0 right-0 z-10 flex flex-col items-center pt-4 pb-2">
          <h1 className="text-[#d7a05a] text-[1.35rem] sm:text-2xl font-bold tracking-tight">
            aiASAP
          </h1>
          <p className="text-[#d7a05a] text-xs sm:text-[0.8125rem] font-medium mt-1">
            Life Made Easy
          </p>
        </div>
        <div className="fixed bottom-40 left-1/2 -translate-x-1/2 w-[95%] max-w-7xl z-20 px-4">
          {error && (
            <div className="mb-3 max-w-xl mx-auto rounded-xl bg-black/55 px-5 py-4 backdrop-blur-sm border border-white/10">
              <p className="text-center text-white text-xl sm:text-2xl font-semibold leading-snug [text-shadow:0_2px_16px_rgba(0,0,0,0.9)]">
                {error}
              </p>
            </div>
          )}
          <div className="flex justify-center mb-4">
            <button
              type="button"
              onClick={startSession}
              disabled={isLoading}
              aria-label="To talk to this guy, tap this button"
              aria-busy={isLoading}
              className="btn-inset py-3 px-6 sm:px-8 rounded-lg flex flex-col items-center justify-center gap-1 max-w-[min(100%,20rem)] text-center"
            >
              {isLoading ? (
                <span className="text-xl font-medium">Starting…</span>
              ) : (
                <>
                  <span className="text-[11px] sm:text-xs font-normal text-white/75 leading-tight">
                    (Tap this button)
                  </span>
                  <span className="text-xl sm:text-2xl font-semibold leading-snug">
                    To talk to this guy
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-7xl z-20 px-4">
          <Link
            href="/terms"
            className="block text-center text-[11px] sm:text-xs text-[#d7a05a]/70 hover:text-[#d7a05a] transition-colors py-2"
          >
            © 2026 aiASAP All Rights Reserved · Terms
          </Link>
        </div>
      </div>
    );
  }
  */

  if (!sessionToken) {
    return (
      <div
        className="w-full min-h-screen flex flex-col items-center justify-center gap-4 px-4"
        style={{
          background:
            "radial-gradient(135% 110% at 50% 32%, #5a360f 0%, #3a220c 38%, #241608 70%, #190f05 100%)",
        }}
      >
        {error && (
          <div className="max-w-xl rounded-xl bg-black/55 px-5 py-4 backdrop-blur-sm border border-white/10">
            <p className="text-center text-white text-lg font-semibold leading-snug">
              {error}
            </p>
            <button
              type="button"
              onClick={() => {
                void startSession();
              }}
              className="mt-4 w-full btn-inset py-2 rounded-md text-sm font-medium"
            >
              Retry
            </button>
          </div>
        )}
        {!error && (
          // G 2026-06-01: the early (pre-session-token) loader must be the EXACT
          // avatar-stage visual with 6 simply not there yet — not a separate
          // card. So render an empty copy of the avatar's 9:16 stage frame plus
          // the SAME wordmark overlay + LOADING surface the live stage uses, all
          // anchored to the global --stage-* CSS vars. The wordmark keeps
          // overflow-visible + px-5 so the skewed "P" never clips.
          <div
            className="fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
            style={{
              // G 2026-06-09: loading screen was raw black on open - brand it.
              // Warm gold-amber-into-deep-brown glow so the gold wordmark +
              // LOADING still pop. "Nice brand colors all the way through."
              background:
                "radial-gradient(135% 110% at 50% 32%, #5a360f 0%, #3a220c 38%, #241608 70%, #190f05 100%)",
            }}
          >
            {/* Empty avatar stage frame — identical styling to the <video>, no avatar yet */}
            <div className="h-full w-full md:h-[94vh] md:max-h-[80rem] md:w-auto md:aspect-[9/16] md:rounded-[2.25rem] md:border md:border-[#d7a05a]/40 md:shadow-[0_0_0_1px_rgba(215,160,90,0.45)]" />
            {/* Wordmark + tagline — verbatim from the live stage */}
            <div className="absolute left-0 right-0 z-10 flex flex-col items-center pb-1 pt-1 sm:pt-2 md:pt-0" style={{ top: "calc(var(--stage-top) + 0.25rem)" }}>
              <div className="text-center px-4">
                <div className="flex items-start justify-center">
                  <h1 className="aiasap-logo-mark relative top-[0.45rem] inline-block overflow-visible px-5 pt-1 pb-1 bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-[calc(var(--stage-width)*0.10)] font-bold italic leading-[1.12] tracking-normal text-transparent drop-shadow-[0_1px_6px_rgba(25,15,5,0.4)]">
                    aiASAP
                  </h1>
                </div>
                <p className="mt-0 text-[calc(var(--stage-width)*0.032)] font-semibold tracking-[0.39em] md:tracking-[0.26em] xl:tracking-[0.55em] uppercase bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent drop-shadow-[0_1px_6px_rgba(25,15,5,0.4)]">
                  Take the Leap
                </p>
              </div>
            </div>
            {/* LOADING surface — verbatim from the live stage, anchored to --stage 55% */}
            <div className="fixed inset-x-0 z-30 flex -translate-y-1/2 justify-center px-4 pointer-events-none top-[calc(var(--stage-top)+var(--stage-height)*0.55)]">
              <div className="text-center text-[#e0aa62] drop-shadow-[0_10px_28px_rgba(0,0,0,0.72)]">
                <p className="text-[1.35rem] sm:text-[1.6rem] font-black uppercase tracking-[0.16em] bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent drop-shadow-[0_1px_6px_rgba(25,15,5,0.4)]">
                  Loading
                </p>
                <div className="mx-auto mt-3 h-1.5 w-36 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full w-1/2 animate-[loading-sweep_2.15s_ease-in-out_infinite] rounded-full bg-[#e0aa62]" />
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] left-1/2 -translate-x-1/2 z-40 flex items-center justify-center gap-1 pointer-events-auto">
          <Link
            href="/terms"
            target="_blank"
            className="text-[10px] sm:text-[11px] whitespace-nowrap bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent hover:opacity-90 transition-opacity"
          >
            Terms
          </Link>
          <span className="text-[10px] sm:text-[11px] bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent">·</span>
          <span className="text-center text-[10px] sm:text-[11px] whitespace-nowrap bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent">
            © 2026 aiASAP All Rights Reserved
          </span>
          <span className="text-[10px] sm:text-[11px] bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent">·</span>
          <Link
            href="/privacy"
            target="_blank"
            className="text-[10px] sm:text-[11px] whitespace-nowrap bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent hover:opacity-90 transition-opacity"
          >
            Privacy
          </Link>
        </div>
      </div>
    );
  }

  return (
    <LiveAvatarSession
      mode={mode}
      sessionAccessToken={sessionToken}
      onSessionStopped={onSessionStopped}
      onExit={handleExit}
    />
  );
};
