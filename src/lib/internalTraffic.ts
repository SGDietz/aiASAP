/**
 * IS THIS VISIT G, OR A REAL STRANGER?
 *
 * Built 2026-09-04 because 100 alert rows had piled up unsent
 * (91 `new_visitor`, 9 `unfinished_opportunity`, every one with
 * attempt_count 0) and G's instruction before draining them was blunt: the
 * filter has to work, or turning the drain on is the bug-email flood again.
 *
 * WHY THE EXISTING CHECK IS NOT ENOUGH. `isOperatorTraffic` catches an id
 * allowlist, an email allowlist, a signed cookie, localhost, and RFC-1918
 * private IPs. But `AIASAP_OPERATOR_USER_IDS`, `AIASAP_OPERATOR_EMAILS` and
 * `AIASAP_OPERATOR_MARKER_SECRET` have never been set, nothing in the codebase
 * ever issues that cookie, and G tests SIGNED OUT ON THE PUBLIC DOMAIN. He has
 * passed every one of those tests as a stranger since the day it was written -
 * 56 of 110 "real customers" turned out to be him doing UI QA.
 *
 * So this module adds the signals that match how he ACTUALLY tests, and needs
 * no configuration to work:
 *
 *   1. TAILSCALE HOSTNAMES. His phone reaches the site through
 *      `mission-control.tail<id>.ts.net`. Any `.ts.net` host is a tailnet
 *      address - there is no such thing as a public visitor arriving on one.
 *   2. TAILSCALE IPs. The tailnet uses the CGNAT block 100.64.0.0/10, which
 *      the existing private-IP regex does not cover at all.
 *   3. THE FOUNDER'S OWN ADDRESS. `AIASAP_FOUNDER_REPORT_EMAIL` is already set
 *      in every environment, so a session carrying that address is him without
 *      anyone configuring a second variable.
 *   4. HEADLESS AGENTS. My own verification loads the front door dozens of
 *      times a day. A headless user agent is never a customer.
 *
 * FAIL OPEN, DELIBERATELY. Unknown means "treat as a real visitor". A missed
 * internal visit costs G one email he can ignore; a wrongly suppressed real
 * one costs him a customer he never hears about. Related:
 * feedback-filter-agent-traffic-before-any-metric.
 */

export type InternalTrafficSignal =
  | "tailnet_host"
  | "tailnet_ip"
  | "localhost"
  | "private_ip"
  | "founder_email"
  | "headless_agent"
  | "operator_flag";

export type InternalTrafficInput = {
  /** Host the visitor's browser addressed, e.g. "mission-control.tailabc.ts.net". */
  hostname?: string | null;
  /** X-Forwarded-For, first entry wins. */
  forwardedFor?: string | null;
  /** Any email already known for the session. */
  email?: string | null;
  userAgent?: string | null;
  /** Whatever the watchdog already decided, carried through. */
  operatorExcluded?: boolean | null;
  /** Defaults to AIASAP_FOUNDER_REPORT_EMAIL; comma-separated is fine. */
  founderEmails?: string | null;
};

const TAILNET_HOST = /(^|\.)ts\.net$/i;
const LOCAL_HOST = new Set(["localhost", "127.0.0.1", "::1"]);
const PRIVATE_IP = /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|::1$|fc|fd)/i;
const HEADLESS_AGENT = /headless|playwright|puppeteer|phantomjs|selenium|curl\/|wget\/|python-requests|node-fetch|axios\//i;

/** Tailscale hands out 100.64.0.0/10 - the CGNAT block, not RFC 1918. */
export function isTailnetIp(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\./.exec(ip.trim());
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 100 && b >= 64 && b <= 127;
}

/**
 * Every reason this visit looks like ours. Returns [] for a real visitor, so
 * the caller can log WHY something was suppressed instead of just that it was.
 */
export function internalTrafficSignals(
  input: InternalTrafficInput,
): InternalTrafficSignal[] {
  const hit: InternalTrafficSignal[] = [];

  if (input.operatorExcluded === true) hit.push("operator_flag");

  const host = (input.hostname ?? "").split(":")[0].trim().toLowerCase();
  if (host) {
    if (LOCAL_HOST.has(host)) hit.push("localhost");
    else if (TAILNET_HOST.test(host)) hit.push("tailnet_host");
  }

  const ip = (input.forwardedFor ?? "").split(",")[0].trim();
  if (ip) {
    if (isTailnetIp(ip)) hit.push("tailnet_ip");
    else if (PRIVATE_IP.test(ip)) hit.push("private_ip");
  }

  const founders = (input.founderEmails ?? process.env.AIASAP_FOUNDER_REPORT_EMAIL ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  const email = (input.email ?? "").trim().toLowerCase();
  if (email && founders.includes(email)) hit.push("founder_email");

  const ua = input.userAgent ?? "";
  if (ua && HEADLESS_AGENT.test(ua)) hit.push("headless_agent");

  return hit;
}

export function isInternalTraffic(input: InternalTrafficInput): boolean {
  return internalTrafficSignals(input).length > 0;
}
