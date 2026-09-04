import { describe, expect, it } from "vitest";
import {
  collapseTranscriptRows,
  type TranscriptRowLike,
} from "../../src/lib/transcript/collapseTranscriptRows";
import { FRAGMENT_SOURCE, PARTIAL_SOURCE } from "../../src/lib/transcript/fragmentLink";

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

// Session 03aef2a8 as it sits in the table AFTER linking. Pieces from one sync
// batch share created_at to the millisecond (the batch time); 804 came in an
// earlier batch, before its app row existed, and was back-linked later.
const BATCH_1 = iso(1787360805.296);
const BATCH_2 = iso(1787360825.07);
const BATCH_3 = iso(1787360845.0);

function app(
  id: string,
  role: string,
  message: string,
  utterance: string,
  createdS: number,
  source = "app",
  la: number | null = null,
): TranscriptRowLike {
  return { id, role, message, source, utterance_id: utterance, la_absolute_timestamp: la, created_at: iso(createdS) };
}
function frag(
  id: string,
  message: string,
  la: number,
  utterance: string | null,
  createdAt: string,
  source: string = FRAGMENT_SOURCE,
  role = "user",
): TranscriptRowLike {
  return { id, role, message, source, utterance_id: utterance, la_absolute_timestamp: la, created_at: createdAt };
}

const EVENING: TranscriptRowLike[] = [
  frag("f804", "Okay, we're definitely going to need to work on that opening line.", 1787360804, UTT_E1, BATCH_1),
  app("e1", "user", E1_TEXT, UTT_E1, 1787360813.085),
  frag("f805", "Um, the mute", 1787360805, UTT_E1, BATCH_2),
  frag("f811", "didn't work the first time. Maybe it's because this is the first time ever this site's been up with all these changes.", 1787360811, UTT_E1, BATCH_2),
  frag("f812", "Um,", 1787360812, null, BATCH_2),
  frag("f815", "All the buttons, I think they need a cool", 1787360815, UTT_E2, BATCH_2),
  frag("f816", "design.", 1787360816, UTT_E2, BATCH_2),
  frag("f818", "And a big red", 1787360818, UTT_E2, BATCH_2),
  frag("f823", "square stop. They look great. They're laid out nice.", 1787360823, UTT_E2, BATCH_2),
  app("e2", "user", E2_TEXT, UTT_E2, 1787360825.186),
  app("a1", "assistant", REPLY_TEXT, UTT_E2, 1787360826.66),
  app("a2", "assistant", GREETING_TEXT, UTT_E2, 1787360830.437),
  frag("p829", "So: a cool design for", 1787360829, UTT_E2, BATCH_3, PARTIAL_SOURCE, "assistant"),
  frag("p832", "Hi, I'm 6, your", 1787360832, UTT_E2, BATCH_3, PARTIAL_SOURCE, "assistant"),
];

describe("collapseTranscriptRows — readers fold pieces under the app's turn", () => {
  it("prints the evening session as five turns in spoken order, nothing dropped", () => {
    const turns = collapseTranscriptRows(EVENING);
    expect(turns.map((t) => [t.role, t.text])).toEqual([
      ["user", E1_TEXT],
      ["user", "Um,"],
      ["user", E2_TEXT],
      ["assistant", REPLY_TEXT],
      ["assistant", GREETING_TEXT],
    ]);
    expect(turns[0].rows.map((r) => r.id)).toEqual(["f804", "f805", "f811", "e1"]);
    expect(turns[0].piecesOnly).toBe(false);
    expect(turns[1].piecesOnly).toBe(true);
    expect(turns[1].utteranceId).toBeNull();
    expect(turns[2].rows).toHaveLength(5);
    // Both stubs fold under the FIRST app line of the group; the greeting
    // stays its own turn with its own text.
    expect(turns[3].rows.map((r) => r.id)).toEqual(["a1", "p829", "p832"]);
    expect(turns[4].rows.map((r) => r.id)).toEqual(["a2"]);
    // Every input row is in exactly one turn.
    const ids = turns.flatMap((t) => t.rows.map((r) => r.id)).sort();
    expect(ids).toEqual(EVENING.map((r) => r.id).sort());
  });

  it("keeps every app-born line under one utterance id, in order, never overwriting", () => {
    const turns = collapseTranscriptRows([
      app("a1", "assistant", "First thing 6 said.", "utt-x", 1000),
      app("a2", "assistant", "Second thing 6 said.", "utt-x", 1004),
      app("a3", "assistant", "Third thing 6 said.", "utt-x", 1009),
    ]);
    expect(turns.map((t) => t.text)).toEqual([
      "First thing 6 said.",
      "Second thing 6 said.",
      "Third thing 6 said.",
    ]);
  });

  it("a row claimed by the equality merge (source flipped) still anchors its partials", () => {
    const turns = collapseTranscriptRows([
      app("a1", "assistant", "Well howdy, Scott. What are we building today?", "utt-y", 1000, "liveavatar_api", 1016),
      frag("p1", "Well howdy, Scott. What are", 1010, "utt-y", iso(1020), PARTIAL_SOURCE, "assistant"),
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0].text).toBe("Well howdy, Scott. What are we building today?");
    expect(turns[0].piecesOnly).toBe(false);
    expect(turns[0].rows).toHaveLength(2);
  });

  it("FULL mode: pieces with no app row at all join into breaths in spoken order", () => {
    const batch = iso(2050);
    const turns = collapseTranscriptRows([
      frag("u3", "piece three", 2005, null, batch),
      frag("u1", "piece one", 2000, null, batch),
      frag("u2", "piece two", 2003, null, batch),
      { id: "old", role: "assistant", message: "A reply.", source: "liveavatar_api", utterance_id: null, la_absolute_timestamp: 2010, created_at: batch },
      frag("u4", "piece four", 2030, null, batch),
      frag("u5", "piece five", 2032, null, batch),
    ]);
    expect(turns.map((t) => [t.role, t.text, t.piecesOnly])).toEqual([
      ["user", "piece one piece two piece three", true],
      ["assistant", "A reply.", false],
      ["user", "piece four piece five", true],
    ]);
  });

  it("pieces linked to an app row that never came stay one pieces-only turn", () => {
    const turns = collapseTranscriptRows([
      frag("u1", "the app lost", 3000, "utt-lost", iso(3020)),
      frag("u2", "this whole turn", 3002, "utt-lost", iso(3020)),
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0].text).toBe("the app lost this whole turn");
    expect(turns[0].piecesOnly).toBe(true);
    expect(turns[0].utteranceId).toBe("utt-lost");
  });

  it("drops empty messages and keeps plain rows standalone", () => {
    const turns = collapseTranscriptRows([
      { role: "user", message: "   ", source: "app", utterance_id: "utt-e", created_at: iso(4000) },
      { role: "user", message: "Plain old row.", source: "app", utterance_id: null, created_at: iso(4001) },
    ]);
    expect(turns.map((t) => t.text)).toEqual(["Plain old row."]);
  });
});
