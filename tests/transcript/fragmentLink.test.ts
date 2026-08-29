import { describe, expect, it } from "vitest";
import {
  LINK_MIN_CONTAINMENT,
  containmentScore,
  isWholeLine,
  linkPiecesToTurns,
  type LinkablePiece,
  type LinkableTurn,
} from "../../src/lib/transcript/fragmentLink";

// Fixture = the real rows of session 03aef2a8 (2026-08-22T01:06-01:07Z).
// Provider pieces carry their end-of-speech epoch seconds; app rows carry the
// created_at they were stored with. Texts verbatim.
const iso = (seconds: number) => new Date(seconds * 1000).toISOString();

const UTT_E1 = "utt-f9283c3a-1111-4111-8111-111111111111";
const UTT_E2 = "utt-fb700e8b-2222-4222-8222-222222222222";

const E1_TEXT =
  "OK we're definitely gonna need to work on that opening line the mute didn't work the first time maybe it's cause this is the first time ever this site's been up with all these changes";
const E2_TEXT =
  "All the buttons I think they need a cool design and a big red square stop they look great they're laid out nicely";
const REPLY_TEXT =
  "So: a cool design for all the buttons and a big red square stop button, keeping the current nice layout.";
const GREETING_TEXT = "Hi, I'm 6, your a-i-buddy. What should I call you?";

const TURNS: LinkableTurn[] = [
  { role: "user", message: E1_TEXT, utterance_id: UTT_E1, created_at: iso(1787360813.085) },
  { role: "user", message: E2_TEXT, utterance_id: UTT_E2, created_at: iso(1787360825.186) },
  { role: "assistant", message: REPLY_TEXT, utterance_id: UTT_E2, created_at: iso(1787360826.66) },
  { role: "assistant", message: GREETING_TEXT, utterance_id: UTT_E2, created_at: iso(1787360830.437) },
];

function piece(
  key: string,
  role: "user" | "assistant",
  message: string,
  la: number,
): LinkablePiece {
  return { key, role, message, la_absolute_timestamp: la };
}

const EVENING: LinkablePiece[] = [
  piece("804", "user", "Okay, we're definitely going to need to work on that opening line.", 1787360804),
  piece("805", "user", "Um, the mute", 1787360805),
  piece(
    "811",
    "user",
    "didn't work the first time. Maybe it's because this is the first time ever this site's been up with all these changes.",
    1787360811,
  ),
  piece("812", "user", "Um,", 1787360812),
  piece("815", "user", "All the buttons, I think they need a cool", 1787360815),
  piece("816", "user", "design.", 1787360816),
  piece("818", "user", "And a big red", 1787360818),
  piece("823", "user", "square stop. They look great. They're laid out nice.", 1787360823),
  piece("829", "assistant", "So: a cool design for", 1787360829),
  piece("832", "assistant", "Hi, I'm 6, your", 1787360832),
];

describe("fragmentLink — provider pieces find the app turn they belong to", () => {
  it("homes every real evening piece on the sentence the app logged for it", () => {
    const links = new Map(
      linkPiecesToTurns(EVENING, TURNS).map((l) => [l.key, l.utteranceId]),
    );
    // The breath split: 804/805/811 are the first sentence, 815-823 the second,
    // even though 804..823 are all within 6 s of each other.
    expect(links.get("804")).toBe(UTT_E1);
    expect(links.get("805")).toBe(UTT_E1);
    expect(links.get("811")).toBe(UTT_E1);
    expect(links.get("815")).toBe(UTT_E2);
    expect(links.get("816")).toBe(UTT_E2);
    expect(links.get("818")).toBe(UTT_E2);
    expect(links.get("823")).toBe(UTT_E2);
    // "Um," was dropped by the browser recognizer: honest orphan, never attached.
    expect(links.has("812")).toBe(false);
    // 6 was cut off twice; both stubs belong under the turn they answered.
    expect(links.get("829")).toBe(UTT_E2);
    expect(links.get("832")).toBe(UTT_E2);
  });

  it("one- and two-word pieces must be found whole", () => {
    expect(containmentScore("Um,", E1_TEXT)).toBe(0);
    expect(containmentScore("design.", E2_TEXT)).toBe(1);
    expect(containmentScore("the mute", E1_TEXT)).toBe(1);
    expect(containmentScore("the mute", E2_TEXT)).toBe(0);
  });

  it("keeps function-word shards and reordered phrases as honest orphans", () => {
    expect(containmentScore("the", E2_TEXT)).toBe(0);
    expect(containmentScore("and a", E2_TEXT)).toBe(0);
    expect(containmentScore("stop red square", E2_TEXT)).toBe(0);
  });

  it("tolerates one recognizer-drift content word on a short piece, refuses two foreign ones", () => {
    // didn't / did not, because / cause, gonna / going: the drift this exists for.
    expect(
      containmentScore("didn't work the first time", "did not work the first time"),
    ).toBeGreaterThanOrEqual(LINK_MIN_CONTAINMENT);
    expect(
      containmentScore("Maybe it's because this is the first time", "maybe it's cause this is the first time"),
    ).toBeGreaterThanOrEqual(LINK_MIN_CONTAINMENT);
    // A different sentence that happens to share its small words.
    expect(containmentScore("send my brother the photos", "send my sister the files")).toBe(0);
    expect(containmentScore("send it to my brother", "send it to my sister")).toBe(0);
    // A 3-word piece gets no allowance at all.
    expect(containmentScore("brother coming over", "sister coming over")).toBe(0);
  });

  it("never links a whole assistant line as a partial", () => {
    const line = "Hey! What's on your mind?";
    expect(isWholeLine(line, "Hey, what's on your mind")).toBe(true);
    const same: LinkableTurn[] = [
      { role: "assistant", message: line, utterance_id: "utt-a", created_at: iso(1000) },
    ];
    expect(linkPiecesToTurns([piece("p", "assistant", line, 1002)], same)).toEqual([]);
    const longer: LinkableTurn[] = [
      { role: "assistant", message: `${line} Tell me everything.`, utterance_id: "utt-b", created_at: iso(1000) },
    ];
    expect(linkPiecesToTurns([piece("p", "assistant", line, 1002)], longer)).toEqual([
      { key: "p", utteranceId: "utt-b", score: 1 },
    ]);
  });

  it("user window: app row up to 90 s after the piece ends, at most 10 s before", () => {
    const text = "all the buttons need a cool design";
    const at = (offsetS: number): LinkableTurn[] => [
      { role: "user", message: text, utterance_id: "utt-w", created_at: iso(1000 + offsetS) },
    ];
    const p = [piece("p", "user", text, 1000)];
    expect(linkPiecesToTurns(p, at(89))).toHaveLength(1);
    expect(linkPiecesToTurns(p, at(91))).toHaveLength(0);
    expect(linkPiecesToTurns(p, at(-9))).toHaveLength(1);
    expect(linkPiecesToTurns(p, at(-11))).toHaveLength(0);
  });

  it("assistant window: app row up to 120 s before the provider's end stamp, at most 15 s after", () => {
    const text = "Got your list noted, what else is on it?";
    const at = (offsetS: number): LinkableTurn[] => [
      { role: "assistant", message: `${text} And more.`, utterance_id: "utt-w", created_at: iso(1000 + offsetS) },
    ];
    const p = [piece("p", "assistant", text, 1000)];
    expect(linkPiecesToTurns(p, at(-119))).toHaveLength(1);
    expect(linkPiecesToTurns(p, at(-121))).toHaveLength(0);
    expect(linkPiecesToTurns(p, at(14))).toHaveLength(1);
    expect(linkPiecesToTurns(p, at(16))).toHaveLength(0);
  });

  it("a tie on score goes to the nearest turn in time", () => {
    const turns: LinkableTurn[] = [
      { role: "user", message: "Yes", utterance_id: "utt-far", created_at: iso(1008) },
      { role: "user", message: "Yes", utterance_id: "utt-near", created_at: iso(1002) },
    ];
    expect(linkPiecesToTurns([piece("p", "user", "Yes.", 1000)], turns)).toEqual([
      { key: "p", utteranceId: "utt-near", score: 1 },
    ]);
  });

  it("is deterministic when provider pieces and app turns arrive out of order", () => {
    const forward = linkPiecesToTurns(EVENING, TURNS)
      .map((link) => [link.key, link.utteranceId])
      .sort();
    const reversed = linkPiecesToTurns([...EVENING].reverse(), [...TURNS].reverse())
      .map((link) => [link.key, link.utteranceId])
      .sort();
    expect(reversed).toEqual(forward);
  });

  it("ignores turns of the other role and turns without an utterance id", () => {
    const turns: LinkableTurn[] = [
      { role: "assistant", message: "all the buttons", utterance_id: "utt-x", created_at: iso(1001) },
      { role: "user", message: "all the buttons", utterance_id: null, created_at: iso(1001) },
    ];
    expect(linkPiecesToTurns([piece("p", "user", "all the buttons", 1000)], turns)).toEqual([]);
  });
});
