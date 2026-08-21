import { getSupabaseAdminConfig } from "../supabaseAdmin";
import { sendPurposeEmail } from "../emailSenders";
import { sendTelegramAlert } from "../telegramAlert";
import type { ErrorLogRow, LogLevel, LogRuntime } from "./types";

// r30 (G 2026-06-12, email system): real errors also email G from
// CrashReport@ — but hard-capped at ONE email per 10 minutes so an error
// storm can never flood his inbox. Off unless CRASH_EMAILS_ENABLED=true.
let lastCrashEmailAt = 0;
const CRASH_EMAIL_MIN_GAP_MS = 10 * 60 * 1000;

// Diagnostic breadcrumbs logged AT error level (voice-mode lifecycle tracers,
// signup tracers) are not crashes — never email those.
const TRACER_MESSAGE_RE = /^(?:voice-mode$|signup-tracer)/;

function maybeSendCrashEmail(payload: ErrorLogRow): void {
  if (process.env.CRASH_EMAILS_ENABLED !== "true") return;
  if (payload.level !== "error") return;
  if (TRACER_MESSAGE_RE.test(payload.message)) return;
  const to = process.env.AIASAP_FOUNDER_REPORT_EMAIL;
  if (!to) return;
  const now = Date.now();
  if (now - lastCrashEmailAt < CRASH_EMAIL_MIN_GAP_MS) return;
  lastCrashEmailAt = now;
  const text = [
    "aiASAP Watchdog here - the system hit an error.",
    "",
    `When: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} (Eastern)`,
    `Where: ${payload.route ?? "unknown route"} (${payload.runtime})`,
    `What: ${payload.message}`,
    `Session: ${payload.session_id ?? "unknown"}`,
    "",
    "Full row (with stack) is in Supabase table error_logs.",
    "Note: crash emails are capped at one per 10 minutes - check error_logs",
    "for anything that happened since this one.",
  ].join("\n");
  void sendPurposeEmail({
    purpose: "crash",
    to,
    subject: `Watchdog: error in ${payload.route ?? payload.runtime}`,
    text,
  });
}

/**
 * G, 2026-08-21: "a telegram watch for system failures needs to be built."
 *
 * Same trigger as the crash email, different urgency: email is a record, this
 * is a tap on the shoulder. Throttled per route inside sendTelegramAlert, so a
 * route failing a thousand times sends one message and not a thousand.
 *
 * Keyed by route rather than by message so that a single broken endpoint
 * producing many different error strings still counts as ONE thing to be told
 * about.
 */
function maybeSendTelegramAlert(payload: ErrorLogRow): void {
  if (payload.level !== "error") return;
  if (TRACER_MESSAGE_RE.test(payload.message)) return;
  const where = payload.route ?? payload.runtime;
  const when = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  void sendTelegramAlert(
    `err:${where}`,
    [
      "aiASAP is broken.",
      "",
      `What: ${payload.message}`,
      `Where: ${where}`,
      `When: ${when} Eastern`,
      payload.session_id ? `Session: ${payload.session_id}` : null,
      `Env: ${payload.env}`,
      "",
      "Full row with the stack is in Supabase error_logs.",
      "Repeats of this same route are muted for 10 minutes.",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

const MAX_MESSAGE_LEN = 4000;
const MAX_STACK_LEN = 16000;
const MAX_CONTEXT_BYTES = 32000;

function truncate(s: string | undefined | null, max: number): string | undefined {
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max) : s;
}

function safeContext(
  context: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!context) return undefined;
  try {
    const json = JSON.stringify(context);
    if (json.length > MAX_CONTEXT_BYTES) {
      return { _truncated: true, _bytes: json.length };
    }
    return context;
  } catch {
    return { _unserializable: true };
  }
}

function detectEnv(): string {
  return (
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development"
  );
}

function detectRelease(): string | undefined {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.VERCEL_DEPLOYMENT_ID ??
    undefined
  );
}

/**
 * Write a row to public.error_logs via the Supabase service-role REST
 * endpoint. Never throws — the logger swallows all internal errors and
 * falls back to console so we never break the calling code path.
 */
export async function captureServerError(row: {
  message: string;
  error?: unknown;
  level?: LogLevel;
  user_id?: string | null;
  session_id?: string | null;
  request_id?: string | null;
  route?: string | null;
  user_agent?: string | null;
  context?: Record<string, unknown>;
  runtime?: LogRuntime;
}): Promise<void> {
  const err =
    row.error instanceof Error
      ? row.error
      : row.error != null
        ? new Error(String(row.error))
        : undefined;

  const payload: ErrorLogRow = {
    level: row.level ?? "error",
    runtime: row.runtime ?? "server",
    user_id: row.user_id ?? null,
    session_id: row.session_id ?? null,
    request_id: row.request_id ?? null,
    message: truncate(err?.message ?? row.message, MAX_MESSAGE_LEN) ?? row.message,
    stack: truncate(err?.stack, MAX_STACK_LEN) ?? null,
    route: row.route ?? null,
    user_agent: row.user_agent ?? null,
    env: detectEnv(),
    release: detectRelease(),
    context: safeContext(row.context),
  };

  // Always echo to console too — so dev/Vercel logs still surface this
  // even if the Supabase write fails.
  // eslint-disable-next-line no-console
  console.error(`[obs:${payload.level}] ${payload.message}`, {
    runtime: payload.runtime,
    user_id: payload.user_id,
    session_id: payload.session_id,
    route: payload.route,
  });

  maybeSendCrashEmail(payload);
  maybeSendTelegramAlert(payload);

  let url: string;
  let serviceRoleKey: string;
  try {
    ({ url, serviceRoleKey } = getSupabaseAdminConfig());
  } catch {
    // Supabase not configured — console echo above is all we get.
    return;
  }

  try {
    await fetch(`${url}/rest/v1/error_logs`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
      // Avoid hanging the parent response on a slow log write.
      // We don't await beyond fetch's normal lifecycle here, but
      // do not retry; logs are best-effort.
    });
  } catch (e) {
    // Swallow — logging must not throw into caller's path.
    // eslint-disable-next-line no-console
    console.error("[obs] failed to write error_logs", e);
  }
}

/** Convenience wrappers. */
export const captureServerWarn = (
  args: Parameters<typeof captureServerError>[0],
) => captureServerError({ ...args, level: "warn" });

export const captureServerInfo = (
  args: Parameters<typeof captureServerError>[0],
) => captureServerError({ ...args, level: "info" });
