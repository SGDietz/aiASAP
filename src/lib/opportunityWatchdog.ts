import { createHmac, timingSafeEqual } from "node:crypto";

export type OpportunityEndReason = "explicit_stop" | "clean_end" | "disconnect" | "idle_timeout";
export type OpportunitySignal =
  | { kind: "session_started"; at: number }
  | { kind: "turn"; at: number; text: string }
  | { kind: "contact_captured"; at: number; method: "email" | "phone" }
  | { kind: "account_created"; at: number }
  | { kind: "build_submitted"; at: number }
  | { kind: "declined"; at: number }
  | { kind: "terminal"; at: number; reason: OpportunityEndReason }
  | { kind: "reconnect"; at: number };

export type OpportunityState = {
  visitorState: "detected" | "exploring" | "engaged" | "stopped" | "idle_timeout" | "disconnected" | "completed";
  opportunityState: "none" | "draft" | "build_interest" | "contact_captured" | "account_created" | "submitted" | "declined" | "abandoned";
  contactState: "absent" | "captured" | "submitted";
  accountState: "anonymous" | "created";
  discoveryStage: string;
  terminalAt: number | null;
  graceUntil: number | null;
  endReason: OpportunityEndReason | null;
  summary: { build?: string; passion?: string; outcome?: string; meaningfulTurns: number };
};

export const EMPTY_OPPORTUNITY_STATE: OpportunityState = {
  visitorState: "detected",
  opportunityState: "none",
  contactState: "absent",
  accountState: "anonymous",
  discoveryStage: "arrival",
  terminalAt: null,
  graceUntil: null,
  endReason: null,
  summary: { meaningfulTurns: 0 },
};

const BUILD_RE = /\b(?:build|create|design|launch|make)\b[\s\S]{0,60}\b(?:brand|website|site|landing page|business|store|portfolio|app)\b/i;
const PASSION_RE = /\b(?:i love|my passion|passionate about|i enjoy|i care about|i'?m into)\b/i;
const OUTCOME_RE = /\b(?:i want|my goal|so that|help me|make money|income|customers|clients|audience|freedom|quit my job)\b/i;
const GENERIC_RE = /^(?:hi|hello|hey|okay|ok|yes|no|thanks|thank you|test|can you hear me)[.!?\s]*$/i;

export function isSubstantiveDiscovery(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return !GENERIC_RE.test(text.trim()) && words.length >= 6 && (BUILD_RE.test(text) || PASSION_RE.test(text) || OUTCOME_RE.test(text));
}

export function redactPrivateSummary(text: string): string {
  return text
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[email redacted]")
    .replace(/(?<!\w)(?:\+?\d[\s().-]*){10,15}(?!\w)/g, "[phone redacted]");
}

function concise(text: string): string {
  return redactPrivateSummary(text.replace(/\s+/g, " ").trim()).slice(0, 240);
}

export function reduceOpportunity(
  state: OpportunityState,
  signal: OpportunitySignal,
  disconnectGraceMs = 120_000,
): OpportunityState {
  if (signal.kind === "session_started") {
    return { ...state, visitorState: "exploring" };
  }
  if (signal.kind === "reconnect") {
    if (state.graceUntil !== null && signal.at <= state.graceUntil) {
      return { ...state, visitorState: "engaged", terminalAt: null, graceUntil: null, endReason: null };
    }
    return state;
  }
  if (signal.kind === "turn") {
    if (!isSubstantiveDiscovery(signal.text)) return state;
    const summary = { ...state.summary, meaningfulTurns: state.summary.meaningfulTurns + 1 };
    if (BUILD_RE.test(signal.text)) summary.build = concise(signal.text);
    else if (PASSION_RE.test(signal.text)) summary.passion = concise(signal.text);
    else if (OUTCOME_RE.test(signal.text)) summary.outcome = concise(signal.text);
    return {
      ...state,
      visitorState: "engaged",
      opportunityState: BUILD_RE.test(signal.text) ? "build_interest" : state.opportunityState === "none" ? "draft" : state.opportunityState,
      discoveryStage: BUILD_RE.test(signal.text) ? "build_interest" : PASSION_RE.test(signal.text) ? "passion" : "desired_outcome",
      terminalAt: null,
      graceUntil: null,
      endReason: null,
      summary,
    };
  }
  if (signal.kind === "contact_captured") {
    return { ...state, visitorState: "engaged", opportunityState: "contact_captured", contactState: "captured", discoveryStage: "contact_captured" };
  }
  if (signal.kind === "account_created") {
    return { ...state, visitorState: "completed", opportunityState: "account_created", accountState: "created", discoveryStage: "account_created", terminalAt: null, graceUntil: null, endReason: null };
  }
  if (signal.kind === "build_submitted") {
    return { ...state, visitorState: "completed", opportunityState: "submitted", contactState: state.contactState === "captured" ? "submitted" : state.contactState, discoveryStage: "build_submitted", terminalAt: null, graceUntil: null, endReason: null };
  }
  if (signal.kind === "declined") {
    return { ...state, opportunityState: "declined", discoveryStage: "declined" };
  }
  const grace = signal.reason === "disconnect" ? disconnectGraceMs : 0;
  return {
    ...state,
    visitorState: signal.reason === "idle_timeout" ? "idle_timeout" : signal.reason === "disconnect" ? "disconnected" : "stopped",
    terminalAt: signal.at,
    graceUntil: signal.at + grace,
    endReason: signal.reason,
  };
}

export function shouldQueueUnfinished(state: OpportunityState, now: number): boolean {
  return (
    state.terminalAt !== null &&
    state.graceUntil !== null &&
    now >= state.graceUntil &&
    ["draft", "build_interest", "contact_captured"].includes(state.opportunityState)
  );
}

export type WatchdogAlertPayload = {
  opportunityId: string;
  sessionReviewRef: string;
  reason: string;
  valueSummary: string;
  buildSummary: string | null;
  discoveryStage: string;
  contactStatus: "absent" | "captured" | "submitted";
  accountExists: boolean;
  nextAction: string;
};

export function buildMinimalAlertPayload(
  opportunityId: string,
  sessionId: string,
  state: OpportunityState,
): WatchdogAlertPayload {
  const valueSummary = state.summary.build
    ? "Explicit build interest with discovery context"
    : "Substantive discovery conversation left incomplete";
  return {
    opportunityId,
    sessionReviewRef: `/admin/sessions/${encodeURIComponent(sessionId)}`,
    reason: state.endReason ?? "unknown",
    valueSummary,
    buildSummary: redactPrivateSummary(state.summary.build ?? state.summary.passion ?? state.summary.outcome ?? "") || null,
    discoveryStage: state.discoveryStage,
    contactStatus: state.contactState,
    accountExists: state.accountState === "created",
    nextAction: state.contactState === "absent" ? "Review the secured session before deciding whether any follow-up is possible." : "Review the secured session and the confirmed follow-up request.",
  };
}

export function alertPayloadContainsPrivateRawData(payload: unknown): boolean {
  const json = JSON.stringify(payload).toLowerCase();
  return /(?:\b(?:email|phone|transcript|raw_ip|ip_address)\b\s*":\s*"[^"{])/i.test(json) || /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(json);
}

export function verifySignedOperatorMarker(marker: string | null, secret: string | undefined, now = Date.now()): boolean {
  if (!marker || !secret) return false;
  const [payload, signature] = marker.split(".");
  if (!payload || !signature) return false;
  const [kind, expiresRaw] = payload.split(":");
  const expires = Number(expiresRaw);
  if (kind !== "operator" || !Number.isFinite(expires) || expires < now) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isOperatorTraffic(args: {
  authenticatedUserId?: string | null;
  authenticatedEmail?: string | null;
  operatorUserIds?: string;
  operatorEmails?: string;
  signedMarker?: string | null;
  markerSecret?: string;
  hostname?: string | null;
  forwardedFor?: string | null;
}): boolean {
  const ids = new Set((args.operatorUserIds ?? "").split(",").map((v) => v.trim()).filter(Boolean));
  const emails = new Set((args.operatorEmails ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean));
  if (args.authenticatedUserId && ids.has(args.authenticatedUserId)) return true;
  if (args.authenticatedEmail && emails.has(args.authenticatedEmail.toLowerCase())) return true;
  if (verifySignedOperatorMarker(args.signedMarker ?? null, args.markerSecret)) return true;
  const host = (args.hostname ?? "").split(":")[0].toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  const ip = (args.forwardedFor ?? "").split(",")[0].trim();
  return /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|::1$|fc|fd)/i.test(ip);
}
