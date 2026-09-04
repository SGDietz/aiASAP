import { collectClientDevice } from "./telemetry";
import { getTesterLabel } from "./testerAttribution";

const STORAGE_KEY = "aiasap.opportunitySession.v1";
const PENDING_ACCOUNT_KEY = "aiasap.pendingBuildAccount.v1";

export function markPendingBuildAccountSetup(): void {
  try { window.sessionStorage.setItem(PENDING_ACCOUNT_KEY, "1"); } catch {}
}

export function consumePendingBuildAccountSetup(): boolean {
  try {
    const pending = window.sessionStorage.getItem(PENDING_ACCOUNT_KEY) === "1";
    if (pending) window.sessionStorage.removeItem(PENDING_ACCOUNT_KEY);
    return pending;
  } catch {
    return false;
  }
}

export function getOpportunitySessionId(): string {
  if (typeof window === "undefined") return "opportunity-server-unavailable";
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing && /^[A-Za-z0-9_.:-]{1,200}$/.test(existing)) return existing;
    const id = `opp-${globalThis.crypto.randomUUID()}`;
    window.sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return `opp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export async function postOpportunitySignal(
  action: string,
  fields: Record<string, unknown> = {},
): Promise<{ ok: boolean; state: string; submitted: boolean }> {
  const device = collectClientDevice();
  try {
    const response = await fetch("/api/opportunity-watchdog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: action === "terminal",
      body: JSON.stringify({
        action,
        session_id: getOpportunitySessionId(),
        tester_label: getTesterLabel(),
        device_class: device.deviceKind ?? null,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
        ...fields,
      }),
    });
    const data = (await response.json().catch(() => null)) as { ok?: boolean; state?: string; submitted?: boolean } | null;
    return { ok: response.ok && data?.ok === true, state: data?.state ?? "failed", submitted: data?.submitted === true };
  } catch {
    return { ok: false, state: "failed", submitted: false };
  }
}
