import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  arbitrateAvatarSpeechSource,
  selectAvatarSpeechSource,
} from "../../src/lib/speech/sourceAuthority";
import { resolveSemanticTurn } from "../../src/lib/voiceMode/turnIntake";

// ---------------------------------------------------------------------------
// TWO EARS, ONE TURN. Ride 48c99dfa, 2026-09-04 00:33-00:35.
//
// 6 read the email back correctly and asked to send it. G answered twice -
// "yeah you may send that email off" and "Yes." - and NEITHER reached the
// flow. Both existed only in the provider's transcript, because CUSTOM elects
// the browser recognizer and every SDK final was discarded.
//
// Measured across five of his rides, the browser recognizer produced only
// 14-39% of his turns. The authority is still the browser recognizer; the
// difference is that the other ear is now held for a moment and delivered if
// the authority never produced that utterance.
// ---------------------------------------------------------------------------

const source = readFileSync(
  resolve(process.cwd(), "src/components/LiveAvatarSession.tsx"),
  "utf8",
);

const YES = "yeah you may send that email off";

describe("the second ear", () => {
  it("keeps the losing transport instead of discarding it", () => {
    const authority = selectAvatarSpeechSource("CUSTOM", true);
    expect(authority).toBe("app_browser");
    const loser = arbitrateAvatarSpeechSource(authority, "liveavatar_sdk");
    expect(loser.accepted).toBe(false);
    expect(loser.backfillCandidate).toBe(true);
    // and it never steals the authority
    expect(loser.authoritativeSource).toBe("app_browser");
  });

  it("delivers the answer the authority never heard", () => {
    // Nothing in the accepted ring covers it: this is G's lost "yes".
    const decision = resolveSemanticTurn({
      incoming: YES,
      accepted: [{ text: "did I get that email right", at: 1_000 }],
      now: 2_400,
    });
    expect(decision.kind).toBe("deliver");
  });

  it("drops it as a duplicate when the authority DID hear it", () => {
    // Both ears heard the same words; the authority landed first and is in the
    // ring, so the held copy must not produce a second turn.
    const decision = resolveSemanticTurn({
      incoming: YES,
      accepted: [{ text: YES, at: 1_000 }],
      now: 2_200,
    });
    expect(decision.kind).toBe("drop");
  });

  it("drops a held copy that is only a piece of what the authority heard", () => {
    const decision = resolveSemanticTurn({
      incoming: "send that email off",
      accepted: [{ text: YES, at: 1_000 }],
      now: 2_200,
    });
    expect(decision.kind).toBe("drop");
  });

  it("is wired up in the session, held, and mute-safe", () => {
    expect(source).toContain("SECOND_EAR_HOLD_MS");
    expect(source).toContain("backfillTimersRef");
    expect(source).toContain("decision.backfillCandidate");
    expect(source).toContain('"user_turn_backfilled"');
    // the hold must run the SAME dispatch the authority uses, so the held copy
    // goes through resolveSemanticTurn exactly like any other turn
    expect(source).toMatch(
      /backfillTimersRef\.current\.delete\(timer\);[\s\S]{0,2000}sdkUserTranscriptionDispatchRef\.current\(\{ text \}\)/,
    );
    // G's ride 2026-09-04: resolveSemanticTurn alone was NOT enough here. It
    // matches contiguous runs, and two engines hearing the same audio spell it
    // differently ("no I'm 6:30 are you there buddy" vs "No, um, Six, are you
    // there, buddy?"), so both were delivered and 6 answered both. The held
    // copy now gets a fuzzy same-utterance check FIRST, and only this path.
    expect(source).toContain("isSameUtteranceHeardTwice");
    expect(source).toContain('reason: "second_ear_echo"');
    expect(source).toMatch(
      /isSameUtteranceHeardTwice\([\s\S]{0,600}sdkUserTranscriptionDispatchRef\.current\(\{ text \}\)/,
    );
    // a muted mic must not be re-opened by a timer that fired later
    expect(source).toMatch(
      /backfillTimersRef\.current\.delete\(timer\);\s*\n\s*if \(micMutedRef\.current\) return;/,
    );
  });
});
