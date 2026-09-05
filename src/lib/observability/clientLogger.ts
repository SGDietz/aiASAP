"use client";

import type { ClientLogPayload } from "./types";

const INGEST_URL = "/api/observability/log";

let installed = false;
let currentUserId: string | null = null;

/** Called by AuthProvider after sign-in / sign-out. */
export function setClientLoggerUser(id: string | null) {
  currentUserId = id;
}

function currentRoute(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname + window.location.search;
}

/** Best-effort POST; never throws. Uses keepalive so flushes survive unload. */
async function flush(payload: ClientLogPayload) {
  if (typeof window === "undefined") return;
  // warn-level reports use console.warn so the Next.js dev overlay's red
  // error badge only counts REAL errors (G saw diag lines as "errors").
  // eslint-disable-next-line no-console
  (payload.level === "warn" ? console.warn : console.error)(
    `[obs:${payload.level ?? "error"}] ${payload.message}`,
  );
  try {
    await fetch(INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        route: payload.route ?? currentRoute(),
        context: {
          ...(payload.context ?? {}),
          ...(currentUserId ? { client_user_id: currentUserId } : {}),
        },
      }),
      keepalive: true,
    });
  } catch {
    // Best-effort; nothing else we can do.
  }
}

/**
 * Explicit capture from app code (error boundaries, try/catch sites).
 * Returns a promise so callers can `void captureClientError(e)`.
 */
export function captureClientError(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : "unknown error");
  return flush({
    level: "error",
    message: err.message || "unknown error",
    stack: err.stack,
    context,
  });
}

/**
 * r32 (G live 2026-06-12 20:46: "Red box at the bottom... it says one
 * issue, it's red" — lifecycle breadcrumbs logged at error level lit the
 * Next dev overlay's red badge): tracers and diagnostics report at WARN so
 * only real failures count as errors.
 */
export function captureClientWarn(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : "unknown warn");
  return flush({
    level: "warn",
    message: err.message || "unknown warn",
    stack: err.stack,
    context,
  });
}

/**
 * Install global handlers exactly once. Safe to call multiple times.
 * Idempotent. Mounted from AuthProvider so it runs on every page load.
 */
export function installClientLogger(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event: ErrorEvent) => {
    void flush({
      level: "error",
      message: event.message || "window.onerror",
      stack: event.error?.stack,
      context: {
        type: "window.onerror",
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason instanceof Error) {
        void flush({
          level: "error",
          message: reason.message || "unhandledrejection",
          stack: reason.stack,
          context: { type: "unhandledrejection" },
        });
        return;
      }
      // A rejection that is NOT an Error used to become
      // `new Error("unhandledrejection")`, which threw the real reason away and
      // left a stack pointing at THIS file. Three faults between 2026-08-29 and
      // 2026-09-04 were recorded as the literal word "unhandledrejection" with
      // clientLogger.ts in the stack - unreadable, and unactionable. Providers
      // reject with plain objects and Responses all the time. Describe whatever
      // actually arrived, and keep it.
      const described = describeRejection(reason);
      void flush({
        level: "error",
        message: described.message,
        stack: described.stack,
        context: { type: "unhandledrejection", reason: described.detail },
      });
    },
  );
}

/**
 * Turn any non-Error rejection reason into something a person can read, without
 * ever throwing from inside an error handler.
 */
function describeRejection(reason: unknown): {
  message: string;
  stack?: string;
  detail: string;
} {
  const cap = (s: string) => (s.length > 800 ? `${s.slice(0, 800)}…` : s);
  try {
    if (reason === undefined) return { message: "unhandledrejection: undefined", detail: "undefined" };
    if (reason === null) return { message: "unhandledrejection: null", detail: "null" };
    if (typeof reason === "string") return { message: cap(reason), detail: cap(reason) };
    if (typeof reason !== "object") {
      const s = String(reason);
      return { message: `unhandledrejection: ${cap(s)}`, detail: cap(s) };
    }
    const obj = reason as Record<string, unknown>;
    // Error-shaped without being an Error (structured-cloned, cross-realm, or a
    // provider's own error object).
    const msg =
      typeof obj.message === "string" && obj.message
        ? obj.message
        : typeof obj.error === "string" && obj.error
          ? obj.error
          : typeof obj.statusText === "string" && obj.statusText
            ? obj.statusText
            : null;
    const name = typeof obj.name === "string" ? obj.name : null;
    const code = obj.code ?? obj.status ?? null;
    let detail: string;
    try {
      detail = cap(JSON.stringify(obj));
    } catch {
      detail = cap(Object.prototype.toString.call(obj));
    }
    const head =
      msg ?? (name ? `${name}` : null) ?? (code !== null ? `code ${String(code)}` : null);
    return {
      message: cap(head ? `unhandledrejection: ${head}` : `unhandledrejection: ${detail}`),
      stack: typeof obj.stack === "string" ? cap(obj.stack) : undefined,
      detail,
    };
  } catch {
    // Never let the error handler become the error.
    return { message: "unhandledrejection: undescribable", detail: "undescribable" };
  }
}
