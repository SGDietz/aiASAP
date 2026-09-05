import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/observability/clientLogger", () => ({
  captureClientWarn: vi.fn(() => Promise.resolve()),
}));

import { settleStopCommand, NOT_CONNECTED } from "../../src/liveavatar/stopCommand";
import { captureClientWarn } from "../../src/lib/observability/clientLogger";

/**
 * G's rides, 2026-09-04 17:12:45 and 00:08:11, and 2026-08-24: an
 * `unhandledrejection` ERROR row reading "Session needs to be connected to
 * send command event", thrown from LiveAvatarSession.interrupt.
 *
 * Cause: `interrupt` returned the SDK promise raw, and most call sites are
 * `void interrupt()` - which cannot catch anything by construction. On
 * 2026-09-04 it also surfaced as `turn_error` and took the turn with it.
 *
 * Interrupting a session that is already gone is the outcome we wanted: 6 is
 * not talking. It is not a failure and must never reject.
 */
describe("stop commands never leak a rejection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("swallows a disconnected session silently", async () => {
    await expect(
      settleStopCommand(() => {
        throw new Error("Session needs to be connected to send command event");
      }, "interrupt"),
    ).resolves.toBeUndefined();
    expect(captureClientWarn).not.toHaveBeenCalled();
  });

  it("swallows it when the SDK REJECTS rather than throws", async () => {
    // The real failure is asynchronous - a throw-only guard would miss it.
    await expect(
      settleStopCommand(
        () => Promise.reject(new Error("Session needs to be connected to send command event")),
        "interrupt",
      ),
    ).resolves.toBeUndefined();
    expect(captureClientWarn).not.toHaveBeenCalled();
  });

  it("still reports anything that is NOT a teardown race, and still resolves", async () => {
    await expect(
      settleStopCommand(() => Promise.reject(new Error("boom")), "interrupt"),
    ).resolves.toBeUndefined();
    expect(captureClientWarn).toHaveBeenCalledTimes(1);
  });

  it("survives a non-Error rejection reason", async () => {
    await expect(
      settleStopCommand(() => Promise.reject("just a string"), "stopListening"),
    ).resolves.toBeUndefined();
    expect(captureClientWarn).toHaveBeenCalledTimes(1);
  });

  it("recognises the disconnected-session wordings", () => {
    expect(NOT_CONNECTED.test("Session needs to be connected to send command event")).toBe(true);
    expect(NOT_CONNECTED.test("socket not connected")).toBe(true);
    expect(NOT_CONNECTED.test("Failed to fetch")).toBe(false);
  });

  it("cuts the local fallback voice BEFORE touching the provider", () => {
    // If the provider call went first, a dead socket would skip the local cut
    // and 6 would keep talking through WebAudio after a barge-in.
    const src = readFileSync(
      resolve(process.cwd(), "src/liveavatar/useAvatarActions.ts"),
      "utf8",
    );
    const body = src.slice(src.indexOf("const interrupt = useCallback"));
    expect(body.indexOf("cutCustomVoiceFallback()")).toBeLessThan(
      body.indexOf("sessionRef.current.interrupt()"),
    );
  });
});
