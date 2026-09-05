import { describe, expect, it } from "vitest";
import {
  isSameUtteranceHeardTwice,
  SECOND_EAR_ECHO_WINDOW_MS,
  type AcceptedTurn,
} from "../../src/lib/voiceMode/turnIntake";

/**
 * G's smoke test, 2026-09-04 17:05-17:12. Two ears listen; the loser is held
 * 1.2s and backfilled unless the winner already produced that utterance. The
 * judge was resolveSemanticTurn, which matches a CONTIGUOUS RUN of identical
 * words - and two speech engines hearing the same audio do not agree word for
 * word. Neither transcription contained the other, so BOTH were delivered and
 * 6 answered both: 30 backfills against 46 user turns, and four assistant lines
 * inside two seconds at 17:11:07-17:11:09.
 *
 * Every "heard twice" pair below is copied verbatim from that ride.
 */
const at = (text: string, ago: number, now: number): AcceptedTurn => ({
  text,
  at: now - ago,
});

describe("the same sentence, heard by both ears", () => {
  const now = 1_000_000;

  it.each([
    [
      "no I'm 6:30 are you there buddy",
      "No, um, Six, are you there, buddy?",
    ],
    [
      "that's great I love building things",
      "That's great. Um, I love building things.",
    ],
    [
      "I love building things and yes I'm looking at 60 Avatar with his mouth moving how you doing buddy",
      "I love building things. And yes, I'm looking at 6D Avatar with his mouth moving. How you doing, buddy?",
    ],
    [
      "snap pictures you know send them to here to AIA ASAP will review",
      "You know, send them to, um, here to AI ASAP. We'll review.",
    ],
  ])("recognises a twin transcription: %s", (first, second) => {
    expect(
      isSameUtteranceHeardTwice({
        incoming: second,
        accepted: [at(first, 900, now)],
        now,
      }),
    ).toBe(true);
  });

  it("lets a genuinely different sentence through", () => {
    for (const line of [
      "I build stone walls with boulders.",
      "Well, nobody pays me to do it yet.",
      "so how do we drive traffic to the website?",
    ]) {
      expect(
        isSameUtteranceHeardTwice({
          incoming: line,
          accepted: [at("that's great I love building things", 900, now)],
          now,
        }),
        line,
      ).toBe(false);
    }
  });

  it("only looks at the last few seconds - a real repeat later still counts", () => {
    const line = "You know, send them to, um, here to AI ASAP. We'll review.";
    // twin, moments later -> dropped
    expect(
      isSameUtteranceHeardTwice({
        incoming: line,
        accepted: [at(line, 900, now)],
        now,
      }),
    ).toBe(true);
    // the same thing said again a minute on -> a real turn, delivered
    expect(
      isSameUtteranceHeardTwice({
        incoming: line,
        accepted: [at(line, SECOND_EAR_ECHO_WINDOW_MS + 1000, now)],
        now,
      }),
    ).toBe(false);
  });

  it("never judges a short turn by overlap", () => {
    // "give me ideas" repeats legitimately and shares every word.
    for (const short of ["yes", "okay", "give me ideas.", "no no no"]) {
      expect(
        isSameUtteranceHeardTwice({
          incoming: short,
          accepted: [at(short, 500, now)],
          now,
        }),
        short,
      ).toBe(false);
    }
  });

  it("is safe with no history at all", () => {
    expect(
      isSameUtteranceHeardTwice({ incoming: "anything at all here", accepted: [], now }),
    ).toBe(false);
  });
});
