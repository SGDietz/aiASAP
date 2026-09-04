import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// FILL THE GAP, DON'T SHORTEN THE WAIT.
//
// 8.9% of 6's lines are accepted by the provider and never spoken. The
// watchdog cannot decide that before 5 s without cutting off a genuinely slow
// start - a real 4.005 s start is on record. Those 5 seconds read to G as 6
// freezing.
//
// Given the choice between shortening the wait, filling it, and leaving it,
// G picked filling it (2026-09-04). At 1.4 s of nothing 6 takes one quiet
// breath; the 5 s recovery is untouched.
// ---------------------------------------------------------------------------

const delivery = readFileSync(
  resolve(process.cwd(), "src/liveavatar/customVoiceDelivery.ts"),
  "utf8",
);
const session = readFileSync(
  resolve(process.cwd(), "src/components/LiveAvatarSession.tsx"),
  "utf8",
);

describe("the speech gap is filled, not shortened", () => {
  it("hints early without judging the line a failure", () => {
    expect(delivery).toContain("const SPEECH_GAP_HINT_MS = 1400;");
    expect(delivery).toContain("export function subscribeAvatarSpeechGap");
    // the hint fires only while nothing has been spoken and nothing settled
    expect(delivery).toContain(
      "if (!providerStarted && !settled) reportAvatarSpeechGap({ session, where });",
    );
  });

  it("leaves the real recovery watchdog alone", () => {
    // The 5 s decision is what protects a slow-but-working start. Filling the
    // gap must never become an excuse to shorten it.
    expect(delivery).toContain("const REPEAT_WATCHDOG_MS = 5000;");
    expect(delivery).toContain('rescue("repeat_silent")');
  });

  it("cancels the hint the moment he actually speaks", () => {
    // disarm() runs from both finish() and handleStarted().
    expect(delivery).toMatch(
      /const disarm = \(\) => \{[\s\S]{0,400}gapHintTimer !== null[\s\S]{0,120}clearTimeout\(gapHintTimer\)/,
    );
  });

  it("makes a breath, never a beep, and stays almost inaudible", () => {
    expect(session).toContain("playThinkingBreath");
    expect(session).toContain("filter.type = \"lowpass\"");
    // slides down like an exhale rather than sitting on one tone
    expect(session).toMatch(/frequency\.setValueAtTime\(900,[\s\S]{0,80}exponentialRampToValueAtTime\(420,/);
    // quiet: peak gain well under a tenth
    const peak = session.match(/exponentialRampToValueAtTime\(([0-9.]+), t0 \+ 0\.09\)/);
    expect(peak).not.toBeNull();
    expect(Number(peak?.[1])).toBeLessThan(0.1);
    // no oscillator anywhere in it - a tone would read as a machine
    const start = session.indexOf("playThinkingBreath");
    expect(session.slice(start, start + 2200)).not.toContain("createOscillator");
  });

  it("stays silent when the speaker is muted, and never doubles up", () => {
    expect(session).toContain("if (isCustomVoiceMuted()) return;");
    expect(session).toMatch(/now - lastBreathAtRef\.current < 3000/);
  });

  it("is recorded so its usefulness can be judged from data", () => {
    expect(session).toContain('"avatar_speech_gap_filled"');
  });
});
