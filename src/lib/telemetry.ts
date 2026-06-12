// Product telemetry + voice-triggered bug reports.
// Born 2026-06-12, G's order: "go ahead and make sup record all these things,
// everyting possible that is ethical and legal, for us to learn" + "when a
// user says, that doesn't work right... 6 should auto launch a bug report
// that gets emailed to me automatically."
//
// Everything here is fire-and-forget: a telemetry failure may NEVER break or
// slow the conversation path. Writes land in public.app_events (existing
// table, severity check = critical|high|medium|low) and public.bug_reports.

type Jsonish = Record<string, unknown>;

export type AppEventSeverity = "critical" | "high" | "medium" | "low";

let cachedDevice: Jsonish | null = null;

/** Light device fingerprint for diagnostics — no tracking IDs, no cookies. */
export function collectClientDevice(): Jsonish {
  if (cachedDevice) return cachedDevice;
  if (typeof window === "undefined") return {};
  const nav = window.navigator;
  let timezone: string | null = null;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    timezone = null;
  }
  cachedDevice = {
    userAgent: nav.userAgent,
    language: nav.language,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screen: `${window.screen.width}x${window.screen.height}`,
    devicePixelRatio: window.devicePixelRatio,
    touchSupport: nav.maxTouchPoints > 0,
    timezone,
    deviceKind:
      nav.maxTouchPoints > 0 &&
      Math.min(window.screen.width, window.screen.height) < 768
        ? "phone"
        : "computer",
  };
  return cachedDevice;
}

let telemetrySessionId: string | null = null;

/** The component sets this once the conversation session id exists. */
export function setTelemetrySessionId(id: string | null): void {
  telemetrySessionId = id;
}

/**
 * Append one row to app_events. Never throws, never awaited by callers.
 * eventType examples: list_action, face_return, voice_list_enter,
 * pillboxes_visibility, brain_latency, session_live, echo_dropped,
 * user_frustration, bug_reported.
 */
export function logAppEvent(
  eventType: string,
  payload?: Jsonish,
  severity: AppEventSeverity = "low",
): void {
  try {
    void fetch("/api/app-events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        severity,
        session_id: telemetrySessionId,
        route:
          typeof window !== "undefined" ? window.location.pathname : null,
        payload: payload ?? {},
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Telemetry never breaks the caller.
  }
}

// ── Bug reports ─────────────────────────────────────────────────────────────

/**
 * Phrases that mean "the site is misbehaving" — 6's cue to file a bug.
 * Conversational complaints only; ordinary chat must not trip this.
 */
export const BUG_PHRASE_RE =
  /(?:doesn'?t|don'?t|didn'?t|isn'?t|ain'?t|won'?t|wont|not)\s+work|not working|something(?:'s| is)? (?:wrong|broken|off|messed)|that'?s (?:wrong|broken|a bug|not right)|(?:there'?s|theres|that'?s|this is|i found) (?:a )?(?:bug|glitch)|no pill\s?box|pill\s?box(?:es)? (?:are |is )?(?:gone|missing|not (?:there|showing))|screen (?:is |went )?(?:black|blank|frozen|stuck)|can'?t (?:hear|see) you|you (?:can'?t|cannot|don'?t) hear me|(?:it|site|page|this) (?:froze|crashed|broke)|not right/i;

let lastBugReportAt = 0;

/**
 * If the text sounds like a problem report, ship a bug report (rate-limited
 * to one per 2 minutes per page). Returns true when the text matched, so the
 * caller can have 6 acknowledge it out loud.
 */
export function maybeSubmitBugReport(args: {
  triggerText: string;
  transcript: Array<{ role: string; text: string }>;
  listSnapshot?: unknown;
  mode?: string | null;
}): boolean {
  if (!BUG_PHRASE_RE.test(args.triggerText)) return false;
  const now = Date.now();
  if (now - lastBugReportAt < 120_000) return true;
  lastBugReportAt = now;
  try {
    void fetch("/api/bug-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger_text: args.triggerText.slice(0, 1000),
        session_id: telemetrySessionId,
        transcript: args.transcript.slice(-16),
        list_snapshot: args.listSnapshot ?? null,
        device: { ...collectClientDevice(), mode: args.mode ?? null },
      }),
      keepalive: true,
    }).catch(() => {});
    logAppEvent(
      "bug_reported",
      { trigger: args.triggerText.slice(0, 300) },
      "high",
    );
  } catch {
    // Never break the conversation.
  }
  return true;
}

// ── User feedback catcher ───────────────────────────────────────────────────

/**
 * Praise and ideas — the other half of listening. "I love this", "you should
 * add X", "I wish you could Y" → user_feedback row + email from UserFeedback@.
 */
export const FEEDBACK_PHRASE_RE =
  /\bi (?:love|really like) (?:this|it|you|him)\b|\b(?:this|that) is (?:so |really )?(?:awesome|amazing|incredible|fantastic|wonderful|cool)\b|\bgreat idea\b|\byou should (?:add|make|let|have)\b|\bi wish (?:you|it|he) (?:could|would|had)\b|\bit would be (?:great|nice|cool|awesome) if\b|\bcan you guys add\b|\bfeature request\b/i;

let lastFeedbackAt = 0;

/** Same contract as maybeSubmitBugReport: true = matched (already filed). */
export function maybeSubmitUserFeedback(args: {
  triggerText: string;
  transcript: Array<{ role: string; text: string }>;
  mode?: string | null;
}): boolean {
  if (!FEEDBACK_PHRASE_RE.test(args.triggerText)) return false;
  const now = Date.now();
  if (now - lastFeedbackAt < 120_000) return true;
  lastFeedbackAt = now;
  try {
    void fetch("/api/user-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trigger_text: args.triggerText.slice(0, 1000),
        session_id: telemetrySessionId,
        transcript: args.transcript.slice(-16),
        device: { ...collectClientDevice(), mode: args.mode ?? null },
      }),
      keepalive: true,
    }).catch(() => {});
    logAppEvent(
      "feedback_captured",
      { trigger: args.triggerText.slice(0, 300) },
      "medium",
    );
  } catch {
    // Never break the conversation.
  }
  return true;
}

// ── Frustration counter ─────────────────────────────────────────────────────

const CORRECTION_RE =
  /\b(?:no|not|wrong|nope|doesn'?t|isn'?t|didn'?t|still|again|stop)\b/i;
let correctionStreak = 0;
let lastCorrectionAt = 0;
const recentCorrections: string[] = [];

/**
 * Feed every user turn through this. Three correction-flavored turns inside
 * 90s = the user is fighting the site; log it so we find the friction.
 */
export function noteUserTurnForFrustration(text: string): void {
  const now = Date.now();
  if (now - lastCorrectionAt > 90_000) {
    correctionStreak = 0;
    recentCorrections.length = 0;
  }
  if (!CORRECTION_RE.test(text)) return;
  lastCorrectionAt = now;
  correctionStreak += 1;
  recentCorrections.push(text.slice(0, 200));
  if (recentCorrections.length > 4) recentCorrections.shift();
  if (correctionStreak === 3) {
    logAppEvent(
      "user_frustration",
      { turns: [...recentCorrections] },
      "medium",
    );
    correctionStreak = 0;
  }
}
