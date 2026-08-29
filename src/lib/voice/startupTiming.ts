export const STARTUP_TIMING_POINTS = [
  "tap",
  "microphone_granted",
  "react_adopted",
  "session_chunk_complete",
  "mint_complete",
  "provider_start",
  "provider_end",
  "connected",
  "live_track",
  "first_presented_frame",
  "greeting_dispatch",
  "greeting_speak",
] as const;

export type StartupTimingPoint = (typeof STARTUP_TIMING_POINTS)[number];
export type StartupTimingMark = { epochMs: number; sinceTapMs: number | null };
export type StartupTimingResource = {
  name: string;
  durationMs: number;
  transferSize: number | null;
  encodedBodySize: number | null;
  decodedBodySize: number | null;
};
export type StartupTimingRecord = {
  version: 1;
  marks: Partial<Record<StartupTimingPoint, StartupTimingMark>>;
  resources: Partial<Record<"session_chunk" | "mint" | "provider", StartupTimingResource>>;
};

declare global {
  interface Window {
    __AIASAP_STARTUP_TIMING__?: StartupTimingRecord;
  }
}

type TimingScope = {
  performance?: Pick<Performance, "timeOrigin" | "getEntriesByType">;
  __AIASAP_STARTUP_TIMING__?: StartupTimingRecord;
};
type TimingWindow = TimingScope & {
  PerformanceObserver?: typeof PerformanceObserver;
};

const fallbackRecords = new WeakMap<object, StartupTimingRecord>();

function createRecord(): StartupTimingRecord {
  return { version: 1, marks: {}, resources: {} };
}

function isWritableRecord(value: unknown): value is StartupTimingRecord {
  try {
    if (!value || typeof value !== "object") return false;
    const record = value as Partial<StartupTimingRecord>;
    return (
      record.version === 1 &&
      !!record.marks &&
      typeof record.marks === "object" &&
      !!record.resources &&
      typeof record.resources === "object" &&
      Object.isExtensible(record) &&
      Object.isExtensible(record.marks) &&
      Object.isExtensible(record.resources) &&
      !Object.isFrozen(record) &&
      !Object.isFrozen(record.marks) &&
      !Object.isFrozen(record.resources)
    );
  } catch {
    return false;
  }
}

function storeRecord(scope: TimingScope, record: StartupTimingRecord): StartupTimingRecord {
  try {
    scope.__AIASAP_STARTUP_TIMING__ = record;
    if (scope.__AIASAP_STARTUP_TIMING__ === record) return record;
  } catch {
    // A frozen/hostile global ledger must not affect the real startup path.
  }
  try {
    fallbackRecords.set(scope as object, record);
  } catch {
    // Timing is optional. Returning the local record is still fail-open.
  }
  return record;
}

function getRecord(scope: TimingScope): StartupTimingRecord {
  try {
    const fallback = fallbackRecords.get(scope as object);
    if (fallback) return fallback;
    const existing = scope.__AIASAP_STARTUP_TIMING__;
    if (isWritableRecord(existing)) return existing;
  } catch {
    // Repair below with a fresh in-memory record.
  }
  const record = createRecord();
  return storeRecord(scope, record);
}

function epochFromPerformance(scope: TimingScope, relativeMs: number): number {
  try {
    const origin = Number(scope.performance?.timeOrigin);
    return (Number.isFinite(origin) ? origin : Date.now()) + relativeMs;
  } catch {
    return Date.now() + (Number.isFinite(relativeMs) ? relativeMs : 0);
  }
}

export function beginStartupTiming(scope: TimingScope = window): StartupTimingRecord {
  try {
    const priorMarks = getRecord(scope).marks;
    const record = storeRecord(scope, createRecord());
    // These owners can become ready before a hydrated START. Carry them into
    // the fresh attempt so timing proves the session runtime was already in the
    // initial graph instead of inventing a post-tap chunk gap.
    if (priorMarks.session_chunk_complete) {
      record.marks.session_chunk_complete = priorMarks.session_chunk_complete;
    }
    if (priorMarks.react_adopted) {
      record.marks.react_adopted = priorMarks.react_adopted;
    }
    return markStartupTiming("tap", scope);
  } catch {
    return createRecord();
  }
}

export function markStartupTiming(
  point: StartupTimingPoint,
  scope: TimingScope = window,
  epochMs?: number,
): StartupTimingRecord {
  try {
    const record = getRecord(scope);
    if (!record.marks[point]) {
      const measuredEpoch = Number.isFinite(epochMs) ? (epochMs as number) : Date.now();
      const tapEpoch = record.marks.tap?.epochMs;
      record.marks[point] = {
        epochMs: measuredEpoch,
        sinceTapMs: tapEpoch == null ? null : Math.max(0, measuredEpoch - tapEpoch),
      };
    }
    return record;
  } catch {
    return createRecord();
  }
}

function recordResource(
  key: "session_chunk" | "mint" | "provider",
  entry: PerformanceResourceTiming,
  scope: TimingScope,
): void {
  try {
    getRecord(scope).resources[key] = {
      name: new URL(entry.name, "https://local.invalid").pathname,
      durationMs: Math.max(0, entry.duration),
      transferSize: Number.isFinite(entry.transferSize) ? entry.transferSize : null,
      encodedBodySize: Number.isFinite(entry.encodedBodySize) ? entry.encodedBodySize : null,
      decodedBodySize: Number.isFinite(entry.decodedBodySize) ? entry.decodedBodySize : null,
    };
  } catch {
    // Resource metadata is optional and can never affect startup.
  }
}

export function captureSessionChunkResourceTiming(
  entry: PerformanceResourceTiming,
  scope: TimingScope = window,
): void {
  try {
    markStartupTiming(
      "session_chunk_complete",
      scope,
      epochFromPerformance(scope, entry.responseEnd),
    );
    recordResource("session_chunk", entry, scope);
  } catch {
    // Timing is strictly observational.
  }
}

export function captureStartupResourceTiming(
  entry: PerformanceResourceTiming,
  scope: TimingScope = window,
): void {
  try {
    const path = new URL(entry.name, "https://local.invalid").pathname;
    if (path.includes("LiveAvatarSession") && path.endsWith(".js")) {
      captureSessionChunkResourceTiming(entry, scope);
    } else if (path === "/api/start-custom-session" || path === "/api/start-session") {
      markStartupTiming("mint_complete", scope, epochFromPerformance(scope, entry.responseEnd));
      recordResource("mint", entry, scope);
    } else if (path === "/api/v1/sessions/start") {
      markStartupTiming("provider_start", scope, epochFromPerformance(scope, entry.startTime));
      markStartupTiming("provider_end", scope, epochFromPerformance(scope, entry.responseEnd));
      recordResource("provider", entry, scope);
    }
  } catch {
    // Malformed entries are ignored; startup continues unchanged.
  }
}

let resourceObserverInstalled = false;

export function installStartupResourceTimingObserver(scope: TimingWindow = window): () => void {
  try {
    for (const entry of scope.performance?.getEntriesByType("resource") ?? []) {
      captureStartupResourceTiming(entry as PerformanceResourceTiming, scope);
    }
  } catch {
    // Buffered scanning is optional.
  }
  try {
    const Observer = scope.PerformanceObserver ?? globalThis.PerformanceObserver;
    if (resourceObserverInstalled || typeof Observer !== "function") {
      return () => {};
    }
    resourceObserverInstalled = true;
    const observer = new Observer((list: PerformanceObserverEntryList) => {
      try {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "resource") {
            captureStartupResourceTiming(entry as PerformanceResourceTiming, scope);
          }
        }
      } catch {
        // Observer callbacks are telemetry-only.
      }
    });
    try {
      observer.observe({ type: "resource", buffered: true });
    } catch {
      resourceObserverInstalled = false;
      try {
        observer.disconnect();
      } catch {
        // No cleanup is required when observer setup failed.
      }
      return () => {};
    }
    return () => {
      try {
        observer.disconnect();
      } catch {
        // Cleanup is best-effort and cannot affect the app lifecycle.
      }
      resourceObserverInstalled = false;
    };
  } catch {
    resourceObserverInstalled = false;
    return () => {};
  }
}

export function getStartupTimingSnapshot(scope: TimingScope = window): StartupTimingRecord {
  try {
    const record = getRecord(scope);
    return { version: 1, marks: { ...record.marks }, resources: { ...record.resources } };
  } catch {
    return createRecord();
  }
}
