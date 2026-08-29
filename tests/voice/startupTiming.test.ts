import { describe, expect, it } from "vitest";
import {
  beginStartupTiming,
  captureStartupResourceTiming,
  getStartupTimingSnapshot,
  installStartupResourceTimingObserver,
  markStartupTiming,
} from "../../src/lib/voice/startupTiming";

const scope = () => ({
  performance: { timeOrigin: 1_000 },
  __AIASAP_STARTUP_TIMING__: undefined,
}) as any;

const resource = (name: string, startTime: number, responseEnd: number) => ({
  name,
  entryType: "resource",
  startTime,
  responseEnd,
  duration: responseEnd - startTime,
  transferSize: 123,
  encodedBodySize: 100,
  decodedBodySize: 200,
}) as PerformanceResourceTiming;

describe("startup timing ledger", () => {
  it("keeps the first milestone and computes elapsed time from tap", () => {
    const target = scope();
    beginStartupTiming(target);
    target.__AIASAP_STARTUP_TIMING__.marks.tap = { epochMs: 2_000, sinceTapMs: 0 };
    markStartupTiming("microphone_granted", target, 2_250);
    markStartupTiming("microphone_granted", target, 9_999);
    expect(getStartupTimingSnapshot(target).marks.microphone_granted).toEqual({
      epochMs: 2_250,
      sinceTapMs: 250,
    });
  });

  it("maps resource timing onto chunk, mint, and provider boundaries", () => {
    const target = scope();
    beginStartupTiming(target);
    target.__AIASAP_STARTUP_TIMING__.marks.tap = { epochMs: 1_050, sinceTapMs: 0 };
    captureStartupResourceTiming(resource("https://local/_next/static/chunks/LiveAvatarSession_tsx.js", 100, 300), target);
    captureStartupResourceTiming(resource("https://local/api/start-custom-session", 120, 420), target);
    captureStartupResourceTiming(resource("https://local/api/v1/sessions/start", 500, 900), target);
    const timing = getStartupTimingSnapshot(target);
    expect(timing.marks.session_chunk_complete?.epochMs).toBe(1_300);
    expect(timing.marks.mint_complete?.epochMs).toBe(1_420);
    expect(timing.marks.provider_start?.epochMs).toBe(1_500);
    expect(timing.marks.provider_end?.epochMs).toBe(1_900);
    expect(timing.resources.provider?.durationMs).toBe(400);
  });

  it("preserves initial-graph owner readiness and React adoption when a hydrated START begins", () => {
    const target = scope();
    markStartupTiming("session_chunk_complete", target, 1_050);
    markStartupTiming("react_adopted", target, 1_100);
    beginStartupTiming(target);
    expect(getStartupTimingSnapshot(target).marks.session_chunk_complete?.epochMs).toBe(1_050);
    expect(getStartupTimingSnapshot(target).marks.react_adopted?.epochMs).toBe(1_100);
  });

  it("repairs a frozen ledger without throwing into the real startup path", () => {
    const target = {
      performance: { timeOrigin: 1_000, getEntriesByType: () => [] },
      __AIASAP_STARTUP_TIMING__: Object.freeze({
        version: 1,
        marks: Object.freeze({}),
        resources: Object.freeze({}),
      }),
    } as any;

    expect(() => beginStartupTiming(target)).not.toThrow();
    expect(() => markStartupTiming("microphone_granted", target, 2_000)).not.toThrow();
    expect(getStartupTimingSnapshot(target).marks.microphone_granted?.epochMs).toBe(2_000);
  });

  it("ignores hostile ledger and resource getters", () => {
    const target = { performance: { timeOrigin: 1_000, getEntriesByType: () => [] } } as any;
    Object.defineProperty(target, "__AIASAP_STARTUP_TIMING__", {
      configurable: false,
      get: () => {
        throw new Error("blocked ledger");
      },
    });
    const badEntry = { entryType: "resource" } as PerformanceResourceTiming;
    Object.defineProperty(badEntry, "name", {
      get: () => {
        throw new Error("blocked entry");
      },
    });

    expect(() => beginStartupTiming(target)).not.toThrow();
    expect(() => captureStartupResourceTiming(badEntry, target)).not.toThrow();
    expect(() => getStartupTimingSnapshot(target)).not.toThrow();
  });

  it("fails open when buffered scanning or PerformanceObserver setup throws", () => {
    class RejectingObserver {
      constructor(_callback: PerformanceObserverCallback) {}
      observe(): void {
        throw new Error("unsupported buffered observer");
      }
      disconnect(): void {}
    }
    const rejectingScope = {
      performance: {
        timeOrigin: 1_000,
        getEntriesByType: () => {
          throw new Error("resource timing unavailable");
        },
      },
      PerformanceObserver: RejectingObserver,
    } as any;

    let cleanup: () => void = () => {};
    expect(() => {
      cleanup = installStartupResourceTimingObserver(rejectingScope);
    }).not.toThrow();
    expect(cleanup).toBeTypeOf("function");
    expect(() => cleanup()).not.toThrow();

    let observes = 0;
    class WorkingObserver {
      constructor(_callback: PerformanceObserverCallback) {}
      observe(): void {
        observes += 1;
      }
      disconnect(): void {}
    }
    const workingScope = {
      performance: { timeOrigin: 1_000, getEntriesByType: () => [] },
      PerformanceObserver: WorkingObserver,
    } as any;
    const remove = installStartupResourceTimingObserver(workingScope);
    expect(observes).toBe(1);
    remove();
  });
});
