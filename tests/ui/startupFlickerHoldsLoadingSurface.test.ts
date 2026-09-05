import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/LiveAvatarSession.tsx"),
  "utf8",
);

/**
 * G, 2026-09-04, describing a restart: "loading six ... came up, and then it
 * flashed on. Then six, the avatar flashed, then ... the six flashed on again,
 * loading six, and then the avatar came on."
 *
 * Cause, found by reading rather than by riding. When ensureAudioOutputReady()
 * fails, voiceStart schedules a 250ms retry and RETURNS - and the `finally` on
 * the way out set voiceStartAwaitingReady(false). In CUSTOM mode that flag IS
 * voiceIsLoading, and it is the only one of the five loading-surface inputs
 * that can go back to true on desktop. So the surface dropped, 6 was painted
 * for a quarter second, and the retry covered him again.
 *
 * The session is not ready during that gap. Holding the surface is honest;
 * flashing him on is not.
 */
describe("start-up does not flash the avatar during the retry gap", () => {
  it("marks a retry as pending before returning", () => {
    expect(source).toContain("voiceStartRetryPendingRef");
    const retry = source.slice(
      source.indexOf("const ok = await ensureAudioOutputReady();"),
    );
    const guard = retry.indexOf("voiceStartRetryPendingRef.current = true;");
    const schedule = retry.indexOf("window.setTimeout(");
    expect(guard).toBeGreaterThan(-1);
    // The flag must be set BEFORE the timeout, so the synchronous `finally`
    // that runs on the way out already sees it.
    expect(guard).toBeLessThan(schedule);
  });

  it("does not drop the loading surface while a retry is pending", () => {
    expect(source).toContain(
      "if (!voiceStartRetryPendingRef.current) {\n        setVoiceStartAwaitingReady(false);",
    );
  });

  it("always brings the surface back down, even if the retry bails early", () => {
    // handleVoiceStartStop has early returns ABOVE its own try/finally. If the
    // retry hits one, nothing else would ever lower the surface - a permanent
    // loading screen, which is far worse than the flicker being fixed.
    const retry = source.slice(source.indexOf("voiceStartRetryPendingRef.current = false;"));
    expect(retry).toContain("if (!voiceStartInProgressRef.current) {");
    expect(retry.slice(0, 900)).toContain("setVoiceStartAwaitingReady(false)");
  });

  it("records the retry so a ride can confirm this path fired", () => {
    expect(source).toContain('logAppEvent("voice_start_retry_scheduled"');
    expect(source).toContain('reason: "audio_output_not_ready"');
  });

  it("keeps voiceIsLoading as the CUSTOM-mode awaiting-ready flag", () => {
    // If this mapping changes, the reasoning above stops holding.
    expect(source).toContain(
      'mode === "CUSTOM" ? voiceStartAwaitingReady : isLoading',
    );
  });
});
