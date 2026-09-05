"use client";

import { useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
// import Image from "next/image";
import { VoiceOnlyStage } from "./VoiceOnlyStage";
import { StageControls } from "./StageControls";
import { StageLegalFooter } from "./StageLegalFooter";
import { StageBrandLockup } from "./StageBrandLockup";
import { PublicContactCard } from "./PublicContactCard";
import { SixLoadingIndicator } from "./SixLoadingIndicator";
import { LiveAvatarSession } from "./LiveAvatarSession";
import {
  MicrophoneRecoveryCard,
  type MicrophoneRecoveryState,
} from "./MicrophoneRecoveryCard";
import { postOpportunitySignal } from "../lib/opportunityClient";

import {
  inspectMicrophonePermission,
  requestMicrophonePermission,
  type MicrophonePermissionState,
} from "../lib/voice/microphonePermission";
import {
  adoptEarlyStartRecord,
  type EarlyStartRecord,
} from "../lib/voice/earlyStartBridge";
import {
  beginStartupTiming,
  installStartupResourceTimingObserver,
  markStartupTiming,
} from "../lib/voice/startupTiming";

// LiveAvatarSession is intentionally part of the initial client graph. The
// physical production ride proved that requesting its owner only after React
// adoption created a separate 8.7s post-mint waterfall. Static availability
// removes that network seam while the existing `sessionToken` render gate below
// still prevents mount, provider start, media capture, or billing on page load
// and on every denied/cancelled START.
if (typeof window !== "undefined") {
  markStartupTiming("session_chunk_complete", window);
}

/**
 * Map a non-granted request outcome onto the surface the visitor sees.
 *
 * Every branch here used to collapse to null except "denied", so START reset
 * itself with no message and no card. On Android that is the common case, not
 * the rare one: when the browser APP lacks the OS microphone permission,
 * getUserMedia rejects while Permissions.query still answers "prompt", which
 * requestMicrophonePermission reports as "dismissed".
 *
 * "granted" never reaches this function; it is handled on the success path.
 * "prompt" is not a documented return of requestMicrophonePermission, but it
 * is folded into "dismissed" so a future change can never reintroduce a
 * silent, unexplained START.
 */
function blockedRecoveryState(
  permission: MicrophonePermissionState,
): MicrophoneRecoveryState {
  switch (permission) {
    case "denied":
      return "denied";
    case "unavailable":
      return "unavailable";
    default:
      return "dismissed";
  }
}

// VOICE added 2026-08-21 (G: "we need to have a system built where it can be
// voice only"). VOICE mints NO LiveAvatar session at all — that is the whole
// point. The avatar is what bills by the block; a voice conversation should cost
// tokens and nothing else. Architecture by Ara, installed and completed here.
type LiveAvatarMode = "FULL" | "CUSTOM" | "VOICE";

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
  const wanted = value.toLowerCase();
  if (wanted === "voice") return "VOICE";
  return wanted === "full" ? "FULL" : "CUSTOM";
}

// Phone start-screen viewport lock. Paired with the `aiasap-phone-start-lock`
// block in app/globals.css, which is the whole explanation: the root <body> is
// `min-h-screen` (100vh, chrome collapsed) while the start stage is 100svh
// (chrome expanded), so the document was permanently one chrome-band taller
// than the phone shows and the stage was centred inside it. That is what let the
// page pan and what moved and re-cropped the still 6.
const PHONE_START_LOCK_CLASS = "aiasap-phone-start-lock";

// Post-click magic-link return arrives at "/?account=verified". Detect it
// synchronously (before first render) so the auto-start bootstrap never fires —
// we want the user to TAP before session 2 spins up. (G 2026-06-03)
function isPostClickReturn(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("account") === "verified";
}

// ---------------------------------------------------------------------------
// NEVER SHOW A VISITOR A PARSER ERROR.
//
// G, 2026-09-03, screenshot of his own front door:
//   Unexpected token '<', "<!DOCTYPE "... is not valid JSON     [ Retry ]
//
// That is `res.json()` meeting an HTML page. The start call had two unguarded
// `await res.json()` calls, so any HTML response - a Next error page, a proxy
// or tunnel interstitial, a gateway timeout - threw a raw parser message
// straight onto the stage, and the ACTUAL status and body were lost. He rides
// through a Tailscale tunnel, which is exactly the sort of hop that answers
// with HTML.
//
// So: read the body as text, parse only if it looks like JSON, show plain
// English, and post the real status plus the first bytes to the log so the
// next one of these is diagnosable instead of a mystery.
// ---------------------------------------------------------------------------
type StartResponseBody = { session_token?: string; error?: string };

async function readStartResponse(
  res: Response,
): Promise<{ json: StartResponseBody | null; snippet: string }> {
  const raw = await res.text().catch(() => "");
  const snippet = raw.slice(0, 200);
  const looksJson = raw.trimStart().startsWith("{") || raw.trimStart().startsWith("[");
  if (!looksJson) return { json: null, snippet };
  try {
    return { json: JSON.parse(raw) as StartResponseBody, snippet };
  } catch {
    return { json: null, snippet };
  }
}

function reportStartFailure(status: number, snippet: string): void {
  try {
    void fetch("/api/observability/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: "error",
        route: "/",
        message: `[start-session] non-JSON response status=${status} body=${snippet.replace(/\s+/g, " ")}`,
      }),
    });
  } catch {
    // diagnostics must never break the start path
  }
}


export const LiveAvatarDemo = () => {
  // Server HTML renders the accepted still-Six start scene and visible START.
  // Attention waits for React, while the initial document bridge owns an early
  // gesture and hands the exact same permission/mint work into this component.
  const [isClientReady, setIsClientReady] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [mode, setMode] = useState<LiveAvatarMode>(getRequestedLiveAvatarMode);
  // STOP pressed on the stage. The session is genuinely torn down (the meter
  // stops) but the four buttons STAY on screen with START in the top-left.
  // Distinct from awaitReturnTap, which is the magic-link return screen.
  const [pausedOnStage, setPausedOnStage] = useState(false);
  // Legacy post-click return detection remains dormant; initial entry now uses
  // the explicit Start control and never a full-surface click gate.
  void isPostClickReturn;
  const [awaitReturnTap, setAwaitReturnTap] = useState(false);
  // Nothing mints until this is true. See the bootstrap effect below.
  const [hasTappedToStart, setHasTappedToStart] = useState(false);
  const [startMicGranted, setStartMicGranted] = useState(false);
  // This state is intentionally mount-local. A browser query, a prior STOP, or
  // a previous attempt may never pre-populate a blocked surface on fresh START.
  const [startMicPermissionState, setStartMicPermissionState] =
    useState<MicrophoneRecoveryState | null>(null);
  // A true origin-level deny cannot prompt again on the same address. These
  // drive the free query-only confirmation after the visitor changes Chrome's
  // site control; neither can start a session.
  const [startMicRechecking, setStartMicRechecking] = useState(false);
  const [startMicStillBlocked, setStartMicStillBlocked] = useState(false);
  // True only while the browser's own microphone sheet is up and unanswered.
  //
  // This exists because of how G's phone got into this mess (2026-08-28, his
  // words): "I had to hit permission for my mic on my phone, then I tap
  // somewhere else on the screen, and the mic permission went away. And then
  // we've had problems ever since." Tapping the page dismisses the sheet, and a
  // browser auto-blocks an origin after a few dismissals - which is why he was
  // certain he never blocked anything. Returned STOP keeps that defensive held
  // surface. Initial START instead enters its existing loading state after the
  // gesture-owned request begins: on G's phone the held idle acknowledgement
  // did not paint, so a real handled tap looked dead even though its mint ran.
  const [startMicAwaitingAnswer, setStartMicAwaitingAnswer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExited, setIsExited] = useState(false);
  const sessionBootstrapRef = useRef(false);
  // Returning from VOICE must render CUSTOM first. Calling startSession in the
  // same handler would use the stale VOICE callback and either no-op or race a
  // second bootstrap. This ref hands the mint to the post-render effect below.
  const avatarReturnPendingRef = useRef(false);
  // Set true the moment the user explicitly closes/ends the session. Guards the
  // bootstrap effect below so that onSessionStopped clearing the token can never
  // race the auto-start back into a fresh session before isExited flips to true.
  // Cleared only when the user taps Restart. Inactivity-stop never sets this.
  const explicitExitRef = useRef(false);
  const startAbortRef = useRef<AbortController | null>(null);
  // Double-tap guard for the microphone sheet (Chief's review, 2026-08-28).
  // Two fast taps land in the same tick, so a state flag is still false for
  // both and each would fire its own getUserMedia AND its own mint -- paying
  // twice for one gesture. startAbortRef only ever owns the latest request, so
  // it cannot undo the first. A ref updates synchronously and can.
  const micPromptPendingRef = useRef(false);
  // True only after a current gesture-owned request rejects and the Permissions
  // API confirms this exact origin is denied. App telemetry on 2026-08-31
  // confirmed retries in this state mint nothing; Chrome also will not show a
  // new prompt until its site control changes. Dismissed/prompt outcomes never
  // set this ref and therefore retain the real fresh-request path.
  const micBlockedRef = useRef(false);

  useLayoutEffect(() => {
    markStartupTiming("react_adopted");
    const removeResourceObserver = installStartupResourceTimingObserver();
    if (window.__AIASAP_EARLY_START__) {
      window.__AIASAP_EARLY_START__.reactReady = true;
    }
    setIsClientReady(true);
    return removeResourceObserver;
  }, []);

  useEffect(() => {
    if (!hasTappedToStart) return;
    void postOpportunitySignal("session_started");
  }, [hasTappedToStart]);

  useEffect(() => {
    const onPageHide = () => {
      startAbortRef.current?.abort();
      void postOpportunitySignal("terminal", { reason: "disconnect" });
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  // START and returned STOP are one rendered idle authority. Lifecycle state
  // still decides which START handler runs, but it cannot select a second
  // approximation of the same screen.
  const showsInitialIdle =
    !hasTappedToStart && !sessionToken && !isExited && !awaitReturnTap && mode !== "VOICE";
  const showsReturnedIdle =
    pausedOnStage && !sessionToken && !isExited && mode !== "VOICE";
  const showsSharedIdle = showsInitialIdle || showsReturnedIdle;

  useLayoutEffect(() => {
    if (!showsSharedIdle) return;
    const root = document.documentElement;
    root.classList.add(PHONE_START_LOCK_CLASS);
    // Leaving for Legal, tapping Start, or unmounting must all hand normal
    // scrolling back — the class is only ever true while this screen is up.
    return () => root.classList.remove(PHONE_START_LOCK_CLASS);
  }, [showsSharedIdle]);

  const startSession = useCallback(async (options?: {
    deferSessionToken?: boolean;
    abortController?: AbortController;
  }) => {
    const abortController = options?.abortController ?? new AbortController();
    startAbortRef.current = abortController;
    try {
      // VOICE never mints. Guarded here as well as in the bootstrap effect so
      // that no future caller can start a paid session from voice-only mode by
      // calling startSession directly.
      if (mode === "VOICE") {
        setIsLoading(false);
        return;
      }
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
          signal: abortController.signal,
        },
      );
      if (!res.ok) {
        const { json, snippet } = await readStartResponse(res);
        if (!json) reportStartFailure(res.status, snippet);
        setError(
          json?.error ??
            "6 couldn't be reached just now. Tap Retry — nothing was charged.",
        );
        setIsLoading(false);
        return;
      }
      const { json: started, snippet } = await readStartResponse(res);
      if (!started?.session_token) {
        // A 200 that is not JSON: a tunnel or proxy answered instead of us.
        reportStartFailure(res.status, snippet);
        setError("6 couldn't be reached just now. Tap Retry — nothing was charged.");
        setIsLoading(false);
        return null;
      }
      const session_token = started.session_token;
        markStartupTiming("mint_complete");
        // START owns the microphone preflight. The normal React path creates
        // this mint only after that exact gesture grants capture; the early
        // bridge passes the already-owned token through its adoption path.
        if (!options?.deferSessionToken) {
          setSessionToken(session_token);
        }
        setIsLoading(false);
        return session_token as string;
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        setIsLoading(false);
        return null;
      }
      setError((err as Error).message);
      setIsLoading(false);
      return null;
    } finally {
      if (startAbortRef.current === abortController) {
        startAbortRef.current = null;
      }
    }
  }, [mode]);

  const beginSessionFromStart = useCallback(async (fromStopped = false) => {
    if (micPromptPendingRef.current) return;
    // START owns the request before any provider/session work can consume the
    // Android gesture that is required to show the legitimate permission prompt.
    if (!window.isSecureContext) {
      setStartMicGranted(false);
      setStartMicPermissionState("insecure");
      return;
    }
    // A known true site deny is not promptable on this origin. Re-read only;
    // if Chrome now reports prompt/granted, the same tap continues into the
    // current getUserMedia request below. No provider work is reachable here.
    if (micBlockedRef.current) {
      setStartMicRechecking(true);
      setStartMicStillBlocked(false);
      const [observed] = await Promise.all([
        inspectMicrophonePermission(navigator),
        new Promise((resolve) => setTimeout(resolve, 450)),
      ]);
      setStartMicRechecking(false);
      if (observed === "denied" || observed === "unavailable") {
        setStartMicGranted(false);
        setStartMicPermissionState(observed);
        setStartMicStillBlocked(observed === "denied");
        return;
      }
      micBlockedRef.current = false;
    }
    beginStartupTiming();
    // Every promptable START/recovery tap owns one current browser request.
    // Provider work remains grant-first below, so dismissal/refusal costs
    // nothing and cannot leave a stale session.
    setStartMicGranted(false);
    setStartMicPermissionState(null);
    setStartMicStillBlocked(false);
    micPromptPendingRef.current = true;
    setStartMicAwaitingAnswer(true);
    const permissionRequest = requestMicrophonePermission(navigator);
    // Reserve this attempt synchronously before the loading-state render can
    // wake the bootstrap effect. The controller owns cancellation while the
    // browser permission sheet is open; no mint exists until grant.
    const attemptController = new AbortController();
    startAbortRef.current = attemptController;
    sessionBootstrapRef.current = true;
    // The microphone request above must remain the first browser operation in
    // this gesture. Once it owns the gesture, initial START can truthfully show
    // the existing post-START loading surface immediately. Do not await and do
    // not replay the tap: Android may keep the permission promise pending while
    // the sheet is open, and withholding this flip made a handled first tap
    // look completely inert. Returned STOP deliberately keeps its stage still.
    if (!fromStopped) setHasTappedToStart(true);
    explicitExitRef.current = false;
    if (fromStopped) {
      // The returned-idle pixels stay put until the sheet is answered. Clearing
      // pausedOnStage here swapped the page out from under the open sheet, the
      // same defect as the initial path below. Moved to the granted branch.
      setError(null);
      const permission = await permissionRequest;
      micPromptPendingRef.current = false;
      setStartMicAwaitingAnswer(false);
      if (permission !== "granted") {
        attemptController.abort();
        if (startAbortRef.current === attemptController) startAbortRef.current = null;
        sessionBootstrapRef.current = false;
        setPausedOnStage(true);
        setStartMicGranted(false);
        micBlockedRef.current = permission === "denied";
        setStartMicPermissionState(blockedRecoveryState(permission));
        return;
      }
      if (attemptController.signal.aborted || explicitExitRef.current) {
        sessionBootstrapRef.current = false;
        return;
      }
      markStartupTiming("microphone_granted");
      // Answered, and answered Allow. Only now may the surface change.
      setPausedOnStage(false);
      const sessionRequest = startSession({
        deferSessionToken: true,
        abortController: attemptController,
      });
      const sessionToken = await sessionRequest;
      if (sessionToken) setSessionToken(sessionToken);
      setStartMicPermissionState(null);
      micBlockedRef.current = false;
      setStartMicGranted(true);
      return;
    }
    // Initial START keeps the accepted immediate LOADING acknowledgement, but
    // the paid mint is grant-first just like the pre-React bridge.
    const permission = await permissionRequest;
    micPromptPendingRef.current = false;
    setStartMicAwaitingAnswer(false);
    if (permission !== "granted") {
      attemptController.abort();
      if (startAbortRef.current === attemptController) startAbortRef.current = null;
      sessionBootstrapRef.current = false;
      setHasTappedToStart(false);
      if (fromStopped) setPausedOnStage(true);
      setStartMicGranted(false);
      micBlockedRef.current = permission === "denied";
      setStartMicPermissionState(blockedRecoveryState(permission));
      return;
    }
    if (attemptController.signal.aborted || explicitExitRef.current) {
      sessionBootstrapRef.current = false;
      setHasTappedToStart(false);
      return;
    }
    markStartupTiming("microphone_granted");
    // Answered, and answered Allow. The bootstrap effect cannot double-mint:
    // sessionBootstrapRef is already true, so it returns before startSession.
    const sessionToken = await startSession({
      deferSessionToken: true,
      abortController: attemptController,
    });
    if (sessionToken) setSessionToken(sessionToken);
    setStartMicPermissionState(null);
    setStartMicGranted(true);
  }, [startSession]);

  const adoptEarlyStart = useCallback(async (record: EarlyStartRecord) => {
    await adoptEarlyStartRecord(window, record, {
      onClaim: (controller) => {
        micPromptPendingRef.current = true;
        setStartMicAwaitingAnswer(true);
        setStartMicGranted(false);
        setStartMicPermissionState(null);
        setStartMicStillBlocked(false);
        setError(null);
        setIsLoading(true);
        setHasTappedToStart(true);
        explicitExitRef.current = false;
        sessionBootstrapRef.current = true;
        startAbortRef.current = controller;
      },
      onBlocked: (state) => {
        micPromptPendingRef.current = false;
        sessionBootstrapRef.current = false;
        startAbortRef.current = null;
        setStartMicAwaitingAnswer(false);
        setHasTappedToStart(false);
        setIsLoading(false);
        setStartMicGranted(false);
        micBlockedRef.current = state === "denied";
        setStartMicPermissionState(
          state === "insecure" ? "insecure" : blockedRecoveryState(state),
        );
      },
      onGranted: (sessionToken) => {
        markStartupTiming("mint_complete");
        micPromptPendingRef.current = false;
        startAbortRef.current = null;
        setStartMicAwaitingAnswer(false);
        setIsLoading(false);
        setSessionToken(sessionToken);
        setStartMicPermissionState(null);
        micBlockedRef.current = false;
        setStartMicGranted(true);
      },
      onFailure: (message, aborted) => {
        micPromptPendingRef.current = false;
        sessionBootstrapRef.current = false;
        startAbortRef.current = null;
        setStartMicAwaitingAnswer(false);
        setHasTappedToStart(false);
        setIsLoading(false);
        if (!aborted) setError(message ?? "Failed to start session");
      },
    });
  }, []);

  useLayoutEffect(() => {
    const record = window.__AIASAP_EARLY_START__;
    if (!record?.started) return;
    void adoptEarlyStart(record);
  }, [adoptEarlyStart]);

  useLayoutEffect(() => {
    if (!hasTappedToStart) return;
    // The React-owned existing loader is committed before the bridge attribute
    // is removed, so the transition cannot flash the idle scene.
    document.documentElement.removeAttribute("data-aiasap-early-start-state");
  }, [hasTappedToStart]);

  /**
   * A confirmed site-level deny cannot show a fresh Chrome prompt on the same
   * origin. This button therefore re-reads permission for free. Once Chrome's
   * site control changes to prompt/granted, this same gesture hands off to the
   * ordinary current-request START path. Dismissed/prompt recovery bypasses
   * this function and requests immediately.
   */
  const recheckBlockedMicrophone = useCallback(async () => {
    if (startMicRechecking) return;
    setStartMicRechecking(true);
    setStartMicStillBlocked(false);
    try {
      const observed = await inspectMicrophonePermission(navigator);
      if (observed === "denied" || observed === "unavailable") {
        setStartMicPermissionState(observed === "denied" ? "denied" : "unavailable");
        setStartMicStillBlocked(observed === "denied");
        return;
      }
      setStartMicPermissionState(null);
      setStartMicStillBlocked(false);
      await beginSessionFromStart(showsReturnedIdle);
    } finally {
      setStartMicRechecking(false);
    }
  }, [startMicRechecking, beginSessionFromStart, showsReturnedIdle]);

  const stopPendingStartForLegal = useCallback(() => {
    // Legal is a hard no-session boundary. This covers the narrow loading gap
    // before LiveAvatarSession owns the real provider teardown.
    explicitExitRef.current = true;
    sessionBootstrapRef.current = false;
    startAbortRef.current?.abort();
    startAbortRef.current = null;
    setIsLoading(false);
    setSessionToken("");
    setPausedOnStage(false);
    setIsExited(false);
    setHasTappedToStart(false);
    setStartMicGranted(false);
    setStartMicPermissionState(null);
  }, []);

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
    // Stopped on stage: only the START button may mint again.
    if (pausedOnStage) {
      return;
    }
    if (sessionBootstrapRef.current) {
      return;
    }
    // VOICE: no auto-start, no mint, ever.
    if (mode === "VOICE") {
      return;
    }
    // Initial idle never auto-starts: Six remains visibly still until the
    // explicit Start control sets hasTappedToStart.
    //
    // This is the single biggest money fix in the product. Until now, LOADING
    // THE PAGE minted a LiveAvatar session — every visit, every refresh, every
    // crawler, whether or not a word was ever spoken, billed at a block for the
    // first 30s and a block every 6s after. Now nothing starts until a human
    // deliberately taps. The still picture costs nothing to look at.
    if (!hasTappedToStart) {
      return;
    }
    sessionBootstrapRef.current = true;
    void startSession();
  }, [isExited, sessionToken, startSession, awaitReturnTap, mode, hasTappedToStart, pausedOnStage]);

  useEffect(() => {
    if (mode !== "CUSTOM" || !avatarReturnPendingRef.current) return;
    avatarReturnPendingRef.current = false;
    void startSession();
  }, [mode, startSession]);

  const onSessionStopped = (opts?: { reason?: "inactivity" }) => {
    if (!explicitExitRef.current || opts?.reason === "inactivity") {
      void postOpportunitySignal("terminal", {
        reason: opts?.reason === "inactivity" ? "idle_timeout" : "disconnect",
      });
    }
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
    void postOpportunitySignal("terminal", { reason: "clean_end" });
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

  // STOP (G, 2026-08-21: "people be able to stop the avatar and start the
  // avatar"). Same real teardown as an exit — the session is genuinely gone, so
  // the meter stops — but we land on the tap-to-return screen: 6's still picture
  // with "Tap to talk to 6". That screen already existed and was dormant; this is
  // its proper job. explicitExitRef is set for the same reason as above: without
  // it, clearing the token can race the auto-start effect and mint a NEW session
  // (real money) in the instant before awaitReturnTap applies.
  const handlePause = () => {
    void postOpportunitySignal("terminal", { reason: "explicit_stop" });
    explicitExitRef.current = true;
    // NOT awaitReturnTap and NOT hasTappedToStart=false. G, 2026-08-21: "if
    // someone hits stop he stops completely, everything stops, but then the word
    // start comes up in that stop button" - the buttons stay put. Sending them
    // back to the first-load gate would also be wrong: that gate exists to stop
    // a page LOAD from billing, and they are long past it.
    setPausedOnStage(true);
    setStartMicGranted(false);
    setStartMicPermissionState(null);
    setSessionToken("");
  };

  // START, from the stopped stage. A dead token cannot be revived, so this is a
  // brand-new paid session - the same mint the first tap makes.
  const handleStartFromStopped = () => void beginSessionFromStart(true);

  // VOICE. Drops the avatar and keeps the conversation. Mints nothing - this is
  // the only control on the stage that SAVES money. If a session is up we tear
  // it down first so the meter actually stops.
  const handleVoiceOnly = () => {
    explicitExitRef.current = true;
    setPausedOnStage(false);
    setAwaitReturnTap(false);
    setSessionToken("");
    setMode("VOICE");
  };

  const handleReturnToAvatar = () => {
    explicitExitRef.current = false;
    sessionBootstrapRef.current = true;
    avatarReturnPendingRef.current = true;
    setPausedOnStage(false);
    setAwaitReturnTap(false);
    setHasTappedToStart(true);
    setError(null);
    setMode("CUSTOM");
  };

  if (awaitReturnTap && !sessionToken) {
    // Post-click return: mirror the NORMAL entry look (static 6 + wordmark), with
    // a tap-to-start. No email box, no auto-session. On tap, session 2 starts and
    // 6 opens with the hard-coded welcome-back greeting. (G 2026-06-03)
    return (
      <div className="relative w-full h-full min-h-screen flex flex-col overflow-hidden bg-[radial-gradient(135%_110%_at_50%_32%,#5a360f_0%,#3a220c_38%,#241608_70%,#190f05_100%)] [--stage-width:100vw] [--stage-height:100dvh] [--stage-top:0px] [--stage-bottom:0px] md:[--stage-width:calc(94vh*9/16)] md:[--stage-height:94vh] md:[--stage-top:3vh] md:[--stage-bottom:3vh]">
        <StageBrandLockup />
        {/* Static 6 framed EXACTLY like the live avatar <video> (9:16 portrait
            centered + gold border on desktop, full-cover on mobile). */}
        <div className="relative w-full flex-1 flex items-center justify-center pb-[8svh] md:pb-0 md:px-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* G 2026-06-14: same black-bar fix as Session Ended — object-cover
              fills the gold frame (no object-contain letterbox, no black bg). */}
          <img
            src="/startscreen-noband.png"
            alt=""
            className="six-primary-scene h-full w-full object-cover object-top md:object-cover md:object-top md:h-[94vh] md:max-h-[80rem] md:w-auto md:aspect-[9/16] md:rounded-[2.25rem] md:border md:border-[#d7a05a]/40 md:shadow-[0_0_0_1px_rgba(215,160,90,0.45),0_30px_90px_rgba(0,0,0,0.72)]"
          />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[14svh] md:bottom-[16%] z-20 flex justify-center">
            <button
              type="button"
              onClick={() => {
                // START. Clear the explicit-exit latch the STOP button set, or a
                // later drop would be unable to auto-recover. Mirrors what the
                // Restart button on the Session Ended screen already does.
                explicitExitRef.current = false;
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
        {!isLoading && (
         <StageControls
            running={false}
            micOff
            quiet={false}
            onStopStart={() => {
              explicitExitRef.current = false;
              setAwaitReturnTap(false);
              sessionBootstrapRef.current = true;
              void startSession();
            }}
            onToggleMic={() => {}}
            onToggleQuiet={() => {}}
          />
        )}
        <StageLegalFooter phoneFlow placementClassName="md:absolute md:bottom-2 md:left-1/2 md:-translate-x-1/2" />
      </div>
    );
  }

  if (isExited) {
    return (
      <div className="relative w-full h-full min-h-screen flex flex-col overflow-hidden bg-[radial-gradient(135%_110%_at_50%_32%,#5a360f_0%,#3a220c_38%,#241608_70%,#190f05_100%)] [--stage-width:100vw] [--stage-height:100dvh] [--stage-top:0px] [--stage-bottom:0px] md:[--stage-width:calc(94vh*9/16)] md:[--stage-height:94vh] md:[--stage-top:3vh] md:[--stage-bottom:3vh]">
        <StageBrandLockup />
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
          {/* G 2026-08-21 ride: "on the restart screen 6 is low ... no black
              rectangle at the top." startscreen.png carries the same baked-in
              black header band as the live stream (rows 0-~80 of 830). The live
              <video> hides it with a 72% crop bias; this still uses the SAME
              source with the band cut off (startscreen-noband.png, original
              file untouched), so 6 rises to where he sits live and no band can
              show at any viewport, including full-cover phones. */}
          <img
            src="/startscreen-noband.png"
            alt="6, your a-i-buddy"
            className="six-primary-scene h-full w-full object-cover object-top md:object-cover md:object-top md:h-[94vh] md:max-h-[80rem] md:w-auto md:aspect-[9/16] md:rounded-[2.25rem] md:border md:border-[#d7a05a]/40 md:shadow-[0_0_0_1px_rgba(215,160,90,0.45),0_30px_90px_rgba(0,0,0,0.72)]"
          />
          {/* G 2026-09-05 15:10, desktop, after a session ended: "for a restart,
              it should just go back to the start screen." The "Session Ended /
              Thank you for using aiASAP / Restart" card that used to float here
              is gone; this screen IS the start screen again - same still, same
              four chest buttons, START begins a new session (see onStopStart
              below). No auto-restart: a new session still needs the tap
              (G 2026-06-01, credits). */}
        </div>
        <StageControls
          running={false}
          micOff
          quiet={false}
          onStopStart={() => {
            explicitExitRef.current = false;
            setIsExited(false);
            sessionBootstrapRef.current = true;
            void startSession();
          }}
          onToggleMic={() => {}}
          onToggleQuiet={() => {}}
        />
        <StageLegalFooter phoneFlow placementClassName="md:absolute md:bottom-2 md:left-1/2 md:-translate-x-1/2" />
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
        <StageLegalFooter placementClassName="md:fixed md:bottom-6 md:left-1/2 md:-translate-x-1/2" />
      </div>
    );
  }
  */

  // "Loading" now means "your session is starting", not "nothing has happened
  // yet". Before 2026-08-21 the page auto-minted on load, so no-token and
  // starting-up were the same moment. Now they are different: idle shows Six
  // stopped with an explicit Start control, and this screen appears after Start.
  if (!sessionToken && hasTappedToStart && !pausedOnStage && mode !== "VOICE") {
    return (
      <div
        className="w-full min-h-screen flex flex-col items-center justify-center gap-4 px-4"
        style={{
          background:
            "radial-gradient(135% 110% at 50% 32%, #5a360f 0%, #3a220c 38%, #241608 70%, #190f05 100%)",
        }}
      >
        {!error && (
          <div
            data-six-loading-continuity-scene="1"
            aria-hidden="true"
            className="fixed inset-0 z-[69] flex items-center justify-center overflow-hidden bg-[radial-gradient(135%_110%_at_50%_32%,#5a360f_0%,#3a220c_38%,#241608_70%,#190f05_100%)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/startscreen-noband.png"
              alt=""
              className="six-primary-scene absolute inset-0 h-full w-full object-cover object-top md:relative md:inset-auto md:h-[94vh] md:max-h-[80rem] md:w-auto md:aspect-[9/16] md:rounded-[2.25rem] md:border md:border-[#d7a05a]/40 md:shadow-[0_0_0_1px_rgba(215,160,90,0.45),0_30px_90px_rgba(0,0,0,0.72)]"
            />
          </div>
        )}
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
          <div
            data-six-loading-only="1"
            className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-transparent"
          >
            <SixLoadingIndicator />
          </div>
        )}
        {error && <StageLegalFooter phoneFlow onBeforeNavigate={stopPendingStartForLegal} />}
      </div>
    );
  }

  // One literal idle render for both initial START and returned STOP. Loading
  // the link never mints; after STOP the same pixels remain and only this
  // START handler is swapped to authorize a fresh paid session.
  if (showsSharedIdle) {
    return (
      <>
        <div
          data-six-initial-idle="1"
          data-six-startup-readiness={isClientReady ? "ready" : "pending"}
          className="aiasap-tablet-idle-stage relative w-full h-[100svh] min-h-0 flex flex-col overflow-hidden bg-[radial-gradient(135%_110%_at_50%_32%,#5a360f_0%,#3a220c_38%,#241608_70%,#190f05_100%)] [--stage-width:100vw] [--stage-height:100svh] [--stage-top:0px] [--stage-bottom:0px] md:relative md:inset-auto md:h-full md:min-h-screen md:[--stage-width:calc(94vh*9/16)] md:[--stage-height:94vh] md:[--stage-top:3vh] md:[--stage-bottom:3vh]"
        >
        <StageBrandLockup />
        <div data-six-stage-media="1" className="aiasap-tablet-idle-media relative w-full flex-1 overflow-hidden md:flex md:items-center md:justify-center md:overflow-visible md:px-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/startscreen-noband.png"
            alt="6, your a-i-buddy"
            className="six-primary-scene absolute inset-0 h-full w-full object-cover object-top md:relative md:inset-auto md:m-0 md:object-cover md:object-top md:h-[94vh] md:max-h-[80rem] md:w-auto md:aspect-[9/16] md:rounded-[2.25rem] md:border md:border-[#d7a05a]/40 md:shadow-[0_0_0_1px_rgba(215,160,90,0.45),0_30px_90px_rgba(0,0,0,0.72)]"
          />
        </div>
        <StageControls
          running={false}
          micOff={false}
          quiet={false}
          mobileStartControls
          startupStartReady={showsInitialIdle || isClientReady}
          earlyStartBridge={showsInitialIdle}
          onStopStart={
            showsReturnedIdle
              ? handleStartFromStopped
              : () => void beginSessionFromStart()
          }
          onToggleMic={() => {}}
           onToggleQuiet={() => {}}
         />
         {/* The footer itself reserves the phone safe area. This 12px initial-idle
            seam is the prior 8px seam plus the requested 4px upward bar move.
            The bar's own extra height is phone/start-screen CSS in globals.css
            (43px instead of 29px), never a prop, so every other stage that
            shares this footer keeps the 29px bar it already has. */}
        <StageLegalFooter phoneFlow phoneStackPaddingBottom="12px" placementClassName="aiasap-tablet-idle-legal md:absolute md:bottom-2 md:left-1/2 md:-translate-x-1/2" />
        {/* Returned STOP holds these pixels while the browser's microphone
            sheet is open. Initial START uses the existing loading surface as
            its immediate acknowledgement; both paths keep this guidance state
            for the idle/recovery render. Same anchor and z as the recovery card
            below; they never co-exist. */}
        {startMicAwaitingAnswer && startMicPermissionState === null && (
          <section
            data-microphone-awaiting-answer="1"
            role="status"
            className="fixed left-1/2 z-[70] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-[#e0aa62]/70 bg-[#1d1108]/95 px-4 py-3 text-center shadow-[0_14px_36px_rgba(0,0,0,0.58)] bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.43)]"
          >
            <p className="text-sm font-black text-[#ffe9c2]">
              Answer the microphone question
            </p>
            <p className="mt-1 text-xs leading-snug text-[#f1c477]">
              Your browser is asking to use the microphone. Tap Allow. Do not tap
              anywhere else on the screen — that cancels the question, and doing
              it a few times makes the browser block this site on its own.
            </p>
          </section>
        )}
        {startMicPermissionState !== null && (
          <MicrophoneRecoveryCard
            state={startMicPermissionState}
            busy={startMicRechecking}
            stillBlocked={startMicStillBlocked}
            onCheckAgain={
              startMicPermissionState === "denied"
                ? () => void recheckBlockedMicrophone()
                : () => void beginSessionFromStart(showsReturnedIdle)
            }
          />
         )}
         {/* A dismissed START returns directly to this clean, retryable control.
             Only the immediately preceding gesture-owned deny can render the
             single card above; stale permission prose never overlays controls. */}
         </div>
         <PublicContactCard />
         {showsInitialIdle && (
          <div
            data-six-early-start-loader="1"
            aria-busy="true"
            className="fixed inset-0 z-[70] items-center justify-center overflow-hidden bg-transparent"
          >
            <SixLoadingIndicator />
          </div>
        )}
      </>
    );
  }

  // VOICE ONLY (2026-08-21). Reuses the still-6 screen exactly as it already
  // looks, and mounts the voice loop over it. LiveAvatarSession is deliberately
  // NOT mounted: no avatar, no session token, nothing that bills by the block.
  if (mode === "VOICE") {
    return (
      <div className="relative w-full h-full min-h-screen flex flex-col overflow-hidden bg-[radial-gradient(135%_110%_at_50%_32%,#5a360f_0%,#3a220c_38%,#241608_70%,#190f05_100%)] [--stage-width:100vw] [--stage-height:100dvh] [--stage-top:0px] [--stage-bottom:0px] md:[--stage-width:calc(94vh*9/16)] md:[--stage-height:94vh] md:[--stage-top:3vh] md:[--stage-bottom:3vh]">
        <StageBrandLockup />
        <div className="relative w-full flex-1 flex items-center justify-center pb-[8svh] md:pb-0 md:px-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/startscreen-noband.png"
            alt="6, your a-i-buddy"
            className="six-primary-scene h-full w-full object-cover object-top md:object-cover md:object-top md:h-[94vh] md:max-h-[80rem] md:w-auto md:aspect-[9/16] md:rounded-[2.25rem] md:border md:border-[#d7a05a]/40 md:shadow-[0_0_0_1px_rgba(215,160,90,0.45),0_30px_90px_rgba(0,0,0,0.72)]"
          />
        </div>
        <VoiceOnlyStage onReturnAvatar={handleReturnToAvatar} />
      </div>
    );
  }

  return (
    <LiveAvatarSession
      mode={mode}
      microphonePreflightGranted={startMicGranted}
      sessionAccessToken={sessionToken}
      onSessionStopped={onSessionStopped}
      onExit={handleExit}
      onPause={handlePause}
      onVoiceOnly={handleVoiceOnly}
    />
  );
};
