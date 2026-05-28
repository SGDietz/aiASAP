// Tester-link attribution helper.
//
// Lets G drop clean tester links like https://aiasap.ai/?tester=john-tn,
// captures the slug on first page load, persists it for the visit, and
// threads it through to active write paths so tester sessions are
// distinguishable in the data without exposing PII.
//
// Data-use intent (G 2026-05-25): collect product-use data as a moat to
// improve aiASAP/iSolve/UX. Never sell, never spam, never misuse tester info.

export const TESTER_LABEL_STORAGE_KEY = "aiasap.testerLabel.v1";
export const TESTER_LABEL_QUERY_PARAM = "tester";
export const TESTER_LABEL_MAX_LENGTH = 64;

const TESTER_LABEL_RE = /^[a-z0-9_-]+$/;

/**
 * Normalize a raw tester label value into a safe slug, or null if invalid.
 * Server-safe: no DOM access. Accepts lowercase a-z, 0-9, hyphen, underscore.
 */
export function normalizeTesterLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.length > TESTER_LABEL_MAX_LENGTH) return null;
  if (!TESTER_LABEL_RE.test(trimmed)) return null;
  return trimmed;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    // Prefer sessionStorage so the slug survives reloads in the same tab
    // but doesn't follow the user across long-lived browser sessions.
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Read the tester label currently persisted for this visit, if any.
 * Reads sessionStorage first, falls back to localStorage. Returns null
 * on the server or if no valid label is stored.
 */
export function getTesterLabel(): string | null {
  const ss = safeStorage();
  if (ss) {
    try {
      const v = normalizeTesterLabel(ss.getItem(TESTER_LABEL_STORAGE_KEY));
      if (v) return v;
    } catch {
      // ignore
    }
  }
  const ls = safeLocalStorage();
  if (ls) {
    try {
      const v = normalizeTesterLabel(ls.getItem(TESTER_LABEL_STORAGE_KEY));
      if (v) return v;
    } catch {
      // ignore
    }
  }
  return null;
}

function persistTesterLabel(label: string): void {
  const ss = safeStorage();
  if (ss) {
    try {
      ss.setItem(TESTER_LABEL_STORAGE_KEY, label);
    } catch {
      // ignore
    }
  }
  const ls = safeLocalStorage();
  if (ls) {
    try {
      ls.setItem(TESTER_LABEL_STORAGE_KEY, label);
    } catch {
      // ignore
    }
  }
}

/**
 * If the current URL carries ?tester=<slug>, normalize and persist it.
 * Returns the active tester label (newly captured or previously persisted),
 * or null if none is in effect. Safe to call multiple times.
 */
export function captureTesterLabelFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(TESTER_LABEL_QUERY_PARAM);
    if (raw !== null) {
      const normalized = normalizeTesterLabel(raw);
      if (normalized) {
        persistTesterLabel(normalized);
        return normalized;
      }
    }
  } catch {
    // ignore parse errors
  }
  return getTesterLabel();
}
