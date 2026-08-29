import { describe, expect, it } from "vitest";
import {
  ABANDONED_AFTER_MS,
  type Hint,
  type Ledger,
  type PartId,
  hintLine,
  isAbandoned,
  isComplete,
  isPartDone,
  newLedger,
  nextHint,
  putBeats,
  reconcile,
} from "../../src/lib/interview/ledger";

/**
 * The ledger is what makes the $5,000 interview as real as email capture.
 * Most of what is guarded here came from an adversarial review that found 12
 * genuine defects in the first version - including two tests below that could
 * not fail. A test that cannot fail is worse than no test, because it reports
 * safety that was never checked.
 */

const T0 = 1_700_000_000_000;

function put(l: Ledger, part: PartId, key: string, value: string, conf: "SAID" | "GUESSED" = "SAID") {
  l.parts[part].slots[key] = { value, confidence: conf, at: T0 };
  return l;
}

/** The smallest ledger that should count as buildable. */
function buildable(): Ledger {
  const l = newLedger(T0);
  l.noticeAccepted = true;
  put(l, 1, "name", "Dana");
  put(l, 1, "barbecue_do", "I fix old mowers");
  putBeats(l, 2, "yesterday_beats", ["loaded truck", "drove to Hale place", "cut two acres"], T0);
  put(l, 5, "offer", "mowing");
  put(l, 5, "pay_band", "hundred");
  put(l, 6, "reach_path", "phone");
  put(l, 6, "yes_looks_like", "they call and I go out");
  put(l, 6, "reach_publish", "yes");
  put(l, 4, "must_do", "get the website up");
  // Yesterday gave a real hour-by-hour day, so part 3 compresses rather than
  // being asked in full - which is the normal path, not a special case.
  l.parts[3].compressedFromPart2 = true;
  return reconcile(l);
}

describe("done tests", () => {
  it("part 1 needs a real thing they do, not just a name", () => {
    const l = newLedger(T0);
    put(l, 1, "name", "Dana");
    expect(isPartDone(l, 1)).toBe(false);
    put(l, 1, "barbecue_do", "I fix old mowers");
    expect(isPartDone(l, 1)).toBe(true);
  });

  it("part 2 needs three beats from one real day", () => {
    const l = newLedger(T0);
    putBeats(l, 2, "yesterday_beats", ["loaded truck", "drove out"], T0);
    expect(isPartDone(l, 2)).toBe(false);
    putBeats(l, 2, "yesterday_beats", ["loaded truck", "drove out", "cut two acres"], T0);
    expect(isPartDone(l, 2)).toBe(true);
  });

  it("a GUESS never satisfies a part", () => {
    const l = newLedger(T0);
    put(l, 4, "must_do", "probably wants a logo", "GUESSED");
    expect(isPartDone(l, 4)).toBe(false);
    put(l, 4, "must_do", "get the website up", "SAID");
    expect(isPartDone(l, 4)).toBe(true);
  });

  it("part 3's free pass has to be earned by a real part 2", () => {
    // The compressed pass used to be a bare boolean that satisfied part 3 on a
    // completely empty part 2 - the only free pass in the file.
    const l = newLedger(T0);
    l.parts[3].compressedFromPart2 = true;
    expect(isPartDone(l, 3)).toBe(false);
    putBeats(l, 2, "yesterday_beats", ["loaded truck"], T0);
    expect(isPartDone(l, 3)).toBe(true);
  });

  it("part 7 empty proof still needs the name that makes it buildable", () => {
    const l = newLedger(T0);
    put(l, 7, "empty_ok", "true");
    expect(isPartDone(l, 7)).toBe(false);
    put(l, 7, "free_or_future_name", "the Hale family");
    expect(isPartDone(l, 7)).toBe(true);
  });

  it("part 6 will not publish a private number without permission", () => {
    // A personal mobile must never land on a public page on the strength of
    // the recording notice.
    const l = newLedger(T0);
    put(l, 6, "reach_path", "phone");
    put(l, 6, "yes_looks_like", "they call me");
    expect(isPartDone(l, 6)).toBe(false);
    put(l, 6, "reach_publish", "no");
    // An explicit NO satisfies too - otherwise anybody who declines could
    // never finish the interview.
    expect(isPartDone(l, 6)).toBe(true);
  });

  it("money is MISSING rather than satisfied when they never said it", () => {
    const l = newLedger(T0);
    put(l, 5, "offer", "mowing");
    expect(isPartDone(l, 5)).toBe(false);
  });

  it("somebody never paid yet can finish without being filed as evasive", () => {
    // "I have never been paid for this" and "I would rather not say" must never
    // share a slot. Filing an honest beginner as refusing is a slander.
    const l = newLedger(T0);
    put(l, 5, "no_money_yet", "true");
    expect(isPartDone(l, 5)).toBe(true);
  });
});

describe("the string 'false' problem", () => {
  it('does not read the string "false" as yes', () => {
    // String(false) is exactly what an extractor emits into a string field.
    const l = newLedger(T0);
    put(l, 7, "empty_ok", "false");
    put(l, 7, "free_or_future_name", "somebody");
    expect(isPartDone(l, 7)).toBe(false);
  });

  it('does not let money_refused:"false" flip an interview to buildable', () => {
    const l = buildable();
    delete l.parts[5].slots.pay_band;
    put(l, 5, "money_refused", "false");
    expect(isComplete(l)).toBe(false);
    put(l, 5, "money_refused", "true");
    expect(isComplete(l)).toBe(true);
  });
});

describe("complete", () => {
  it("does not need all nine parts", () => {
    const l = buildable();
    expect(isPartDone(l, 7)).toBe(false);
    expect(isPartDone(l, 9)).toBe(false);
    expect(isComplete(l)).toBe(true);
  });

  it("is never complete before the record notice is accepted", () => {
    const l = buildable();
    l.noticeAccepted = false;
    expect(isComplete(l)).toBe(false);
  });

  it("accepts a thin yesterday if 6 moved on with at least one beat", () => {
    const l = buildable();
    putBeats(l, 2, "yesterday_beats", ["loaded truck"], T0);
    l.parts[2].state = "moved_on_thin";
    expect(isComplete(l)).toBe(true);
  });

  it("silence about money is not the same as refusing to say", () => {
    const l = buildable();
    delete l.parts[5].slots.pay_band;
    reconcile(l);
    expect(isComplete(l)).toBe(false);
  });
});

describe("corrections", () => {
  it("un-satisfies a part when the answer behind it is taken back", () => {
    // The original only ever set "satisfied". When somebody corrected an
    // answer the part stayed done to the whisper while isComplete read false,
    // so 6 was steered away from the very hole blocking completion.
    const l = buildable();
    expect(l.parts[5].state).toBe("satisfied");
    delete l.parts[5].slots.pay_band;
    reconcile(l);
    expect(l.parts[5].state).not.toBe("satisfied");
  });

  it("still points the whisper at a part that was corrected away", () => {
    const l = buildable();
    delete l.parts[5].slots.pay_band;
    reconcile(l);
    const h = nextHint(l);
    expect(h.kind).toBe("next_hole");
    if (h.kind === "next_hole") expect(h.part).toBe(5);
  });

  it("never gives an empty whisper while the interview is unfinished", () => {
    const l = buildable();
    delete l.parts[5].slots.pay_band;
    reconcile(l);
    expect(isComplete(l)).toBe(false);
    expect(hintLine(nextHint(l))).not.toBe("");
  });
});

describe("the whisper", () => {
  it("blocks every work part until the notice is accepted", () => {
    const l = newLedger(T0);
    expect(nextHint(l)).toEqual({ kind: "notice_first" });
    expect(hintLine(nextHint(l))).toContain("Do not start a work question");
  });

  it("tells 6 to skip the opener when they already answered out of order", () => {
    const l = newLedger(T0);
    l.noticeAccepted = true;
    put(l, 1, "name", "Dana");
    const h = nextHint(l);
    expect(h.kind).toBe("next_hole");
    if (h.kind === "next_hole") expect(h.askShort).toBe(true);
    expect(hintLine(h)).toContain("Do NOT run the opener");
  });

  it("does not call a blank answer 'already said some of it'", () => {
    // A trailed-off "   " recorded as SAID used to make the whisper tell 6 not
    // to run the opener at somebody who had said nothing at all.
    const l = newLedger(T0);
    l.noticeAccepted = true;
    put(l, 1, "name", "   ");
    const h = nextHint(l);
    if (h.kind === "next_hole") expect(h.askShort).toBe(false);
  });

  it("tells 6 to STOP asking a part already reprompted", () => {
    // The never-twice rule. Without this the whisper's default answer to a
    // fumbled part was byte-identical to one never reached: run the opener.
    const l = newLedger(T0);
    l.noticeAccepted = true;
    put(l, 1, "name", "Dana");
    put(l, 1, "barbecue_do", "mowers");
    l.parts[2].repromptUsed = true;
    const h = nextHint(l);
    expect(h.kind).toBe("still_open");
    if (h.kind === "still_open") expect(h.repromptLeft).toBe(false);
    expect(hintLine(h)).toContain("Do NOT ask it again");
  });

  it("stops nagging once there is enough to build from", () => {
    const l = buildable();
    expect(nextHint(l)).toEqual({ kind: "complete" });
    expect(hintLine(nextHint(l))).toContain("do not reopen");
  });

  it("never re-opens a part 6 deliberately left", () => {
    const l = buildable();
    l.parts[7].state = "moved_on_thin";
    reconcile(l);
    expect(l.parts[7].state).toBe("moved_on_thin");
    const h = nextHint(l);
    if (h.kind === "next_hole") expect(h.part).not.toBe(7);
  });

  it("never renders a user-facing question, for ANY hint kind", () => {
    // The old version of this test discarded its loop variable and only ever
    // checked one string. Every kind is built for real here.
    const notice = newLedger(T0);

    const nextHole = newLedger(T0);
    nextHole.noticeAccepted = true;

    const stillOpen = newLedger(T0);
    stillOpen.noticeAccepted = true;
    stillOpen.parts[1].repromptUsed = true;

    const hints: Hint[] = [
      nextHint(notice),
      nextHint(nextHole),
      nextHint(stillOpen),
      nextHint(buildable()),
    ];
    expect(hints.map((h) => h.kind).sort()).toEqual(
      ["complete", "next_hole", "notice_first", "still_open"].sort(),
    );
    for (const h of hints) {
      const line = hintLine(h);
      expect(line.startsWith("INTERVIEW:")).toBe(true);
      // Not just the final character - a question anywhere would be words for
      // the person rather than context for 6.
      expect(line).not.toContain("?");
    }
  });
});

describe("abandoned", () => {
  it("is not triggered by somebody making a cup of tea", () => {
    const l = newLedger(T0);
    put(l, 1, "name", "Dana");
    putBeats(l, 2, "yesterday_beats", ["loaded truck"], T0);
    put(l, 4, "must_do", "website");
    expect(isAbandoned(l, T0 + 20 * 60 * 1000)).toBe(false);
  });

  it("is not triggered by a name and nothing else, ever", () => {
    const l = newLedger(T0);
    put(l, 1, "name", "Dana");
    expect(isAbandoned(l, T0 + ABANDONED_AFTER_MS * 3)).toBe(false);
  });

  it("does not count blank slots as material worth pinging G about", () => {
    const l = newLedger(T0);
    put(l, 1, "name", "Dana");
    put(l, 2, "yesterday_beats", "  ");
    put(l, 4, "must_do", "   ");
    expect(isAbandoned(l, T0 + ABANDONED_AFTER_MS * 2)).toBe(false);
  });

  it("fires after a week when there is real material sitting there", () => {
    const l = newLedger(T0);
    put(l, 1, "name", "Dana");
    putBeats(l, 2, "yesterday_beats", ["loaded truck"], T0);
    put(l, 4, "must_do", "website");
    expect(isAbandoned(l, T0 + ABANDONED_AFTER_MS + 1000)).toBe(true);
  });

  it("never calls a finished interview abandoned", () => {
    const l = buildable();
    expect(isAbandoned(l, T0 + ABANDONED_AFTER_MS * 5)).toBe(false);
  });
});

describe("the thing Ara warned about", () => {
  it("cannot change ANY state from the clock, on an unfinished interview", () => {
    // The old version of this test used a COMPLETE ledger, so isAbandoned and
    // nextHint both returned before they ever read the clock - the assertion
    // never reached the code it claimed to guard. This one uses an unfinished
    // ledger with parts mid-flight, snapshots the WHOLE ledger rather than
    // just parts, and checks after the abandoned threshold has passed.
    const l = newLedger(T0);
    l.noticeAccepted = true;
    put(l, 1, "name", "Dana");
    putBeats(l, 2, "yesterday_beats", ["loaded truck"], T0);
    put(l, 4, "must_do", "website");
    l.parts[2].state = "waiting";
    l.parts[3].state = "asking";

    const before = JSON.stringify(l);
    // Everything that READS a clock, called past the abandoned threshold.
    expect(isAbandoned(l, T0 + ABANDONED_AFTER_MS * 2)).toBe(true);
    nextHint(l);
    isComplete(l);
    expect(JSON.stringify(l)).toBe(before);
  });

  it("has no clock to be driven by: reconcile is the only mutator and takes none", () => {
    // reconcile DOES mutate - that is its job - but it accepts no timestamp, so
    // no amount of elapsed time can reach it. That is a stronger guarantee than
    // snapshotting: the wiring for a timeout does not exist.
    expect(reconcile.length).toBe(1);
    const l = newLedger(T0);
    l.noticeAccepted = true;
    put(l, 4, "must_do", "website");
    const a = JSON.stringify(reconcile(structuredClone(l)));
    const b = JSON.stringify(reconcile(structuredClone(l)));
    // Same input, same output, regardless of when it is called.
    expect(a).toBe(b);
  });
});

describe("beat encoding", () => {
  it("counts beats written through the writer, not a hand-rolled string", () => {
    const l = newLedger(T0);
    putBeats(l, 2, "yesterday_beats", ["a", "b", "c"], T0);
    expect(isPartDone(l, 2)).toBe(true);
  });

  it("does not let a beat containing the separator inflate the count", () => {
    const l = newLedger(T0);
    putBeats(l, 2, "yesterday_beats", ["mowed the Hale place | and the ditch"], T0);
    expect(isPartDone(l, 2)).toBe(false);
  });

  it("ignores empty beats rather than counting them", () => {
    const l = newLedger(T0);
    putBeats(l, 2, "yesterday_beats", ["a", "", "  ", "b"], T0);
    expect(isPartDone(l, 2)).toBe(false);
  });
});
