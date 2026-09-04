import type { StartupTimingRecord } from "./startupTiming";

export type EarlyStartPermissionState =
  | "granted"
  | "denied"
  | "dismissed"
  | "unavailable"
  | "insecure";

export type EarlyStartPermissionResult = {
  state: EarlyStartPermissionState;
  stream?: MediaStream;
};

export type EarlyStartMintResult = {
  sessionToken: string | null;
  error: string | null;
  aborted: boolean;
};

export type EarlyStartRecord = {
  version: 1;
  started: boolean;
  claimed: boolean;
  reactReady: boolean;
  startedAt: number | null;
  settled: boolean;
  adopted: boolean;
  permissionStreamStopped: boolean;
  cancelReason: "timeout" | "pagehide" | null;
  cancelPromise: Promise<"timeout" | "pagehide"> | null;
  cancelResolve: ((reason: "timeout" | "pagehide") => void) | null;
  permissionPromise: Promise<EarlyStartPermissionResult> | null;
  mintPromise: Promise<EarlyStartMintResult> | null;
  abortController: AbortController | null;
  timeoutId: number | null;
  pageHideHandler: (() => void) | null;
  clearLoader: (() => void) | null;
  cleanupStarted: boolean;
  cleanupPromise: Promise<void> | null;
};

declare global {
  interface Window {
    __AIASAP_EARLY_START__?: EarlyStartRecord;
    __AIASAP_STARTUP_TIMING__?: StartupTimingRecord;
  }
}

type EarlyStartScope = Window & typeof globalThis;

/**
 * This function is serialized into the initial document. Keep it self-contained:
 * it intentionally has no module-scope dependencies.
 */
export function installEarlyStartBridge(
  scope: EarlyStartScope,
  doc: Document,
): void {
  const stateAttribute = "data-aiasap-early-start-state";
  const startSelector = '[data-aiasap-early-start="1"]';
  const timeoutMs = 45_000;
  let timing: StartupTimingRecord = { version: 1, marks: {}, resources: {} };
  try {
    const existing = scope.__AIASAP_STARTUP_TIMING__;
    if (
      existing?.version === 1 &&
      existing.marks &&
      existing.resources &&
      Object.isExtensible(existing) &&
      Object.isExtensible(existing.marks) &&
      Object.isExtensible(existing.resources) &&
      !Object.isFrozen(existing) &&
      !Object.isFrozen(existing.marks) &&
      !Object.isFrozen(existing.resources)
    ) {
      timing = existing;
    } else {
      scope.__AIASAP_STARTUP_TIMING__ = timing;
    }
  } catch {
    // Parser-time timing is optional. Keep the local writable ledger only.
  }
  const markTiming = (
    point: "tap" | "microphone_granted" | "mint_complete",
  ): void => {
    try {
      if (timing.marks[point]) return;
      const epochMs = Date.now();
      const tapEpoch = timing.marks.tap?.epochMs;
      timing.marks[point] = {
        epochMs,
        sinceTapMs: tapEpoch == null ? null : Math.max(0, epochMs - tapEpoch),
      };
    } catch {
      // Timing can never interrupt first-tap ownership.
    }
  };

  const record: EarlyStartRecord =
    scope.__AIASAP_EARLY_START__ ?? {
      version: 1,
      started: false,
      claimed: false,
      reactReady: false,
      startedAt: null,
      settled: false,
      adopted: false,
      permissionStreamStopped: false,
      cancelReason: null,
      cancelPromise: null,
      cancelResolve: null,
      permissionPromise: null,
      mintPromise: null,
      abortController: null,
      timeoutId: null,
      pageHideHandler: null,
      clearLoader: null,
      cleanupStarted: false,
      cleanupPromise: null,
    };

  scope.__AIASAP_EARLY_START__ = record;

  const stopStream = (result: EarlyStartPermissionResult): void => {
    if (record.permissionStreamStopped) return;
    record.permissionStreamStopped = true;
    result.stream?.getTracks().forEach((track) => track.stop());
  };

  const clearLoader = (): void => {
    doc.documentElement.removeAttribute(stateAttribute);
  };
  record.clearLoader = clearLoader;

  const cleanupAbandonedMint = async (): Promise<void> => {
    if (record.cleanupStarted || record.adopted) return;
    const minted = await record.mintPromise;
    if (!minted?.sessionToken || record.adopted || record.cleanupStarted) return;
    record.cleanupStarted = true;
    try {
      await scope.fetch("/api/stop-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token: minted.sessionToken }),
        keepalive: true,
      });
    } catch {
      // Best-effort unload compensation. The endpoint is idempotent and the
      // session token remains short-lived if the browser cannot finish unload.
    }
  };

  const abortPending = (reason: "timeout" | "pagehide"): void => {
    if (record.settled) return;
    record.cancelReason = reason;
    if (record.timeoutId !== null) {
      scope.clearTimeout(record.timeoutId);
      record.timeoutId = null;
    }
    if (record.pageHideHandler) {
      scope.removeEventListener("pagehide", record.pageHideHandler);
      record.pageHideHandler = null;
    }
    record.abortController?.abort();
    void record.permissionPromise?.then(stopStream);
    record.cancelResolve?.(reason);
    record.cleanupPromise = cleanupAbandonedMint();
    clearLoader();
  };

  const fitLoadingInk = (): void => {
    const label = doc.querySelector<HTMLElement>(
      "[data-six-early-start-loader] [data-six-loading-label]",
    );
    const ink = doc.querySelector<HTMLElement>(
      "[data-six-early-start-loader] [data-six-loading-ink]",
    );
    if (!label || !ink) return;
    ink.style.transform = "none";
    const naturalWidth = ink.getBoundingClientRect().width;
    const targetWidth = label.getBoundingClientRect().width;
    if (naturalWidth <= 0 || targetWidth <= 0) return;
    ink.style.transform = `scaleX(${targetWidth / naturalWidth})`;
  };

  const revealLoader = (): void => {
    doc.documentElement.setAttribute(stateAttribute, "loading");
    fitLoadingInk();
    void doc.fonts?.ready.then(fitLoadingInk);
  };

  const inspectPermission = async (): Promise<"denied" | "dismissed"> => {
    try {
      const status = await scope.navigator.permissions?.query({
        name: "microphone" as PermissionName,
      });
      return status?.state === "denied" ? "denied" : "dismissed";
    } catch {
      return "dismissed";
    }
  };

  const requestMicrophone = async (): Promise<EarlyStartPermissionResult> => {
    if (!scope.navigator.mediaDevices?.getUserMedia) {
      return { state: "unavailable" };
    }
    try {
      const stream = await scope.navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      return { state: "granted", stream };
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (
        name === "NotFoundError" ||
        name === "OverconstrainedError" ||
        name === "NotReadableError" ||
        name === "AbortError"
      ) {
        return { state: "unavailable" };
      }
      return { state: await inspectPermission() };
    }
  };

  const mintSession = async (
    controller: AbortController,
  ): Promise<EarlyStartMintResult> => {
    try {
      const params = new URLSearchParams(scope.location.search);
      const mode = params.get("mode")?.toLowerCase() === "full" ? "full" : "custom";
      const endpoint =
        mode === "full" ? "/api/start-session" : "/api/start-custom-session";
      const response = await scope.fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang: params.get("lang"),
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as {
        session_token?: string;
        error?: string;
      };
      if (!response.ok || !payload.session_token) {
        return {
          sessionToken: null,
          error: payload.error || "Unable to start session",
          aborted: false,
        };
      }
      return { sessionToken: payload.session_token, error: null, aborted: false };
    } catch (error) {
      const aborted = controller.signal.aborted;
      return {
        sessionToken: null,
        error: aborted
          ? null
          : error instanceof Error
            ? error.message
            : "Unable to start session",
        aborted,
      };
    }
  };

  doc.addEventListener(
    "click",
    (event) => {
      const target = event.target as { closest?: (selector: string) => Element | null } | null;
      if (!target?.closest?.(startSelector)) return;

      // Once an early gesture starts, capture every seam tap synchronously.
      if (record.started) {
        if (record.settled && record.reactReady) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      // With no early work to adopt, the hydrated React owner handles START.
      if (record.reactReady) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      record.started = true;
      record.startedAt = Date.now();
      record.cancelPromise = new Promise((resolve) => {
        record.cancelResolve = resolve;
      });
      revealLoader();

      // Preserve gesture ownership: microphone request is the first async action.
      record.permissionPromise = scope.isSecureContext
        ? requestMicrophone()
        : Promise.resolve({ state: "insecure" });
      try {
        timing.marks = {};
        timing.resources = {};
        markTiming("tap");
      } catch {
        // The real gesture-owned request above always wins over measurement.
      }
      void record.permissionPromise.then((permission) => {
        if (permission.state === "granted") markTiming("microphone_granted");
      });
      record.pageHideHandler = () => abortPending("pagehide");
      scope.addEventListener("pagehide", record.pageHideHandler, { once: true });
      record.timeoutId = scope.setTimeout(
        () => abortPending("timeout"),
        timeoutMs,
      );
      void record.permissionPromise.then((permission) => {
        if (permission.state === "granted" || record.claimed) return;
        clearLoader();
      });
      if (!scope.isSecureContext) {
        record.mintPromise = Promise.resolve({
          sessionToken: null,
          error: null,
          aborted: true,
        });
        return;
      }
      const controller = new AbortController();
      record.abortController = controller;
      void record.permissionPromise.then((permission) => {
        if (permission.state === "granted" || record.claimed) return;
        controller.abort();
        clearLoader();
      });
      // The chain is created by the first gesture, but the paid mint cannot
      // begin until that exact microphone request grants. This makes denial,
      // dismissal, timeout, and pagehide incapable of orphaning a token.
      record.mintPromise = record.permissionPromise.then((permission) =>
        permission.state === "granted" && !controller.signal.aborted
          ? mintSession(controller)
          : { sessionToken: null, error: null, aborted: true },
      );
      void record.mintPromise.then((minted) => {
        if (minted.sessionToken) markTiming("mint_complete");
      });

    },
    true,
  );
}

export function getEarlyStartBridgeSource(): string {
  return `(${installEarlyStartBridge.toString()})(window,document);`;
}

export function claimEarlyStartRecord(
  _scope: Window,
  record: EarlyStartRecord,
): boolean {
  if (!record.started || record.claimed) return false;
  record.claimed = true;
  return true;
}

export function settleEarlyStartRecord(
  scope: Window,
  record: EarlyStartRecord,
): void {
  record.settled = true;
  if (record.timeoutId !== null) {
    scope.clearTimeout(record.timeoutId);
    record.timeoutId = null;
  }
  if (record.pageHideHandler) {
    scope.removeEventListener("pagehide", record.pageHideHandler);
    record.pageHideHandler = null;
  }
  record.cancelResolve = null;
  record.clearLoader?.();
}

export type EarlyStartAdoptionHandlers = {
  onClaim: (controller: AbortController | null) => void;
  onBlocked: (state: EarlyStartPermissionState) => void;
  onGranted: (sessionToken: string) => void;
  onFailure: (error: string | null, aborted: boolean) => void;
};

export async function adoptEarlyStartRecord(
  scope: Window,
  record: EarlyStartRecord,
  handlers: EarlyStartAdoptionHandlers,
): Promise<boolean> {
  if (!claimEarlyStartRecord(scope, record)) return false;
  handlers.onClaim(record.abortController);

  if (record.cancelReason) {
    handlers.onBlocked("dismissed");
    settleEarlyStartRecord(scope, record);
    return true;
  }

  const cancelled = record.cancelPromise?.then(() => null) ?? new Promise<null>(() => {});
  const permission = await Promise.race([record.permissionPromise, cancelled]);
  if (!permission || permission.state !== "granted") {
    record.abortController?.abort();
    handlers.onBlocked(record.cancelReason ? "dismissed" : permission?.state ?? "dismissed");
    settleEarlyStartRecord(scope, record);
    return true;
  }

  const minted = await Promise.race([record.mintPromise, cancelled]);
  if (!record.permissionStreamStopped) {
    record.permissionStreamStopped = true;
    permission.stream?.getTracks().forEach((track) => track.stop());
  }
  if (record.cancelReason) {
    handlers.onFailure(null, true);
    settleEarlyStartRecord(scope, record);
    return true;
  }
  if (!minted?.sessionToken) {
    handlers.onFailure(
      minted?.error ?? "Failed to start session",
      record.cancelReason ? true : minted?.aborted ?? false,
    );
    settleEarlyStartRecord(scope, record);
    return true;
  }

  record.adopted = true;
  handlers.onGranted(minted.sessionToken);
  settleEarlyStartRecord(scope, record);
  return true;
}
