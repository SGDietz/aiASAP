import { describe, expect, it } from "vitest";
import { newLedger, putBeats, BEAT_SEPARATOR } from "../../src/lib/interview/ledger";
import type { Ledger } from "../../src/lib/interview/ledger";
import { applySlots } from "../../src/lib/interview/applySlots";
import { rehydrate } from "../../src/lib/interview/ledgerStore";
import { sanitize } from "../../src/lib/interview/extractSlots";

/**
 * The ledger itself is covered in ledger.test.ts. This file covers the WIRING
 * added 2026-08-21 - the join between the extractor, the ledger and the
 * database - which is where the quiet, expensive failures live.
 *
 * Every test here is written so that removing the behaviour it guards makes it
 * FAIL. A previous round of my own tests included two that could not fail, so
 * each assertion below is on an observable difference, never on a value the
 * function returns before it does the thing being tested.
 */

const beats = (l: Ledger, part: 2 | 3, key: string) =>
  (l.parts[part].slots[key]?.value ?? "").split(BEAT_SEPARATOR).filter(Boolean);

describe("applySlots - list merging", () => {
  it("ADDS to the beats already recorded instead of replacing them", () => {
    // This is the whole reason applySlots exists. People remember things four
    // turns later. A plain write would drop three beats for one, part 2 would
    // never complete, and the whisper would pin on yesterday forever.
    const l = newLedger(1000);
    const first = applySlots(
      l,
      [{ part: 2, key: "yesterday_beats", values: ["fed the horses", "fixed the gate"] }],
      1000,
    );
    expect(beats(first.ledger, 2, "yesterday_beats")).toHaveLength(2);

    const second = applySlots(
      first.ledger,
      [{ part: 2, key: "yesterday_beats", values: ["drove to Hagerstown"] }],
      2000,
    );
    const got = beats(second.ledger, 2, "yesterday_beats");
    expect(got).toEqual(["fed the horses", "fixed the gate", "drove to Hagerstown"]);
    expect(second.changed).toBe(1);
  });

  it("does not count the same beat twice, whatever the casing", () => {
    const l = newLedger(1000);
    const a = applySlots(l, [{ part: 2, key: "yesterday_beats", values: ["Fed the horses"] }], 1000);
    const b = applySlots(
      a.ledger,
      [{ part: 2, key: "yesterday_beats", values: ["fed the HORSES"] }],
      2000,
    );
    expect(beats(b.ledger, 2, "yesterday_beats")).toEqual(["Fed the horses"]);
    // Nothing new was learned, so nothing was written - otherwise a person
    // repeating themselves looks like a live interview that is actually stuck.
    expect(b.changed).toBe(0);
  });

  it("keeps the two list slots on their own parts", () => {
    const l = newLedger(1000);
    const r = applySlots(
      l,
      [
        { part: 2, key: "yesterday_beats", values: ["mowed"] },
        { part: 3, key: "typical_blocks", values: ["Mondays are quotes"] },
      ],
      1000,
    );
    expect(beats(r.ledger, 2, "yesterday_beats")).toEqual(["mowed"]);
    expect(beats(r.ledger, 3, "typical_blocks")).toEqual(["Mondays are quotes"]);
  });
});

describe("applySlots - single values", () => {
  it("a corrected answer replaces the old one", () => {
    const l = newLedger(1000);
    const a = applySlots(l, [{ part: 5, key: "last_pay", values: ["400"] }], 1000);
    const b = applySlots(a.ledger, [{ part: 5, key: "last_pay", values: ["450"] }], 2000);
    expect(b.ledger.parts[5].slots.last_pay?.value).toBe("450");
    expect(b.changed).toBe(1);
  });

  it("repeating the same answer is not activity", () => {
    const l = newLedger(1000);
    const a = applySlots(l, [{ part: 5, key: "last_pay", values: ["400"] }], 1000);
    const stamped = a.ledger.lastActivityAt;
    const b = applySlots(a.ledger, [{ part: 5, key: "last_pay", values: ["400"] }], 9999);
    expect(b.changed).toBe(0);
    // The clock must NOT move, or an interview that has stalled for a week
    // keeps looking alive and never reads as abandoned.
    expect(b.ledger.lastActivityAt).toBe(stamped);
  });

  it("only an explicit no revokes permission to publish their contact", () => {
    const fresh = newLedger(1000);
    expect(fresh.publishOk).toBe(true);

    const no = applySlots(newLedger(1000), [{ part: 6, key: "reach_publish", values: ["false"] }], 1000);
    expect(no.ledger.publishOk).toBe(false);

    const yes = applySlots(newLedger(1000), [{ part: 6, key: "reach_publish", values: ["true"] }], 1000);
    expect(yes.ledger.publishOk).toBe(true);

    // Never asked is not the same as said no.
    const silent = applySlots(newLedger(1000), [{ part: 5, key: "offer", values: ["mowing"] }], 1000);
    expect(silent.ledger.publishOk).toBe(true);
  });

  it("a slot for a part that does not exist is dropped, not crashed on", () => {
    const l = newLedger(1000);
    const r = applySlots(l, [{ part: 42, key: "offer", values: ["nope"] }], 1000);
    expect(r.changed).toBe(0);
  });

  it("someone coming back after abandoning is running again", () => {
    const l = newLedger(1000);
    l.status = "abandoned";
    const r = applySlots(l, [{ part: 5, key: "offer", values: ["I fix mowers"] }], 5000);
    expect(r.ledger.status).toBe("running");
  });
});

describe("rehydrate - reading a row written by an older build", () => {
  it("rebuilds every part so the whisper cannot crash on a short row", () => {
    // A row saved before a shape change may hold only some parts. nextHint
    // walks all nine; a missing one would throw inside the voice path.
    const short = {
      status: "running",
      noticeAccepted: true,
      parts: { 1: { state: "satisfied", slots: {} } },
    };
    const l = rehydrate(short, 1000);
    expect(l).not.toBeNull();
    for (const p of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
      expect(l!.parts[p]).toBeDefined();
      expect(l!.parts[p].slots).toBeDefined();
    }
  });

  it("a missing publishOk means yes, not no", () => {
    // Reading absence as "no" would silently revoke a permission the person
    // actually gave, and their contact would vanish off their own page.
    const l = rehydrate({ parts: {}, noticeAccepted: true }, 1000);
    expect(l!.publishOk).toBe(true);
  });

  it("an explicit false survives the round trip", () => {
    const l = rehydrate({ parts: {}, publishOk: false }, 1000);
    expect(l!.publishOk).toBe(false);
  });

  it("keeps the slots that were saved", () => {
    const src = newLedger(1000);
    putBeats(src, 5, "offer", ["I fix small engines"], 1000);
    const l = rehydrate(JSON.parse(JSON.stringify(src)), 2000);
    expect(l!.parts[5].slots.offer?.value).toBe("I fix small engines");
  });

  it("returns null on junk rather than a blank ledger", () => {
    // A blank ledger would read as a brand new interview and re-ask
    // everything the person already answered.
    expect(rehydrate(null, 1)).toBeNull();
    expect(rehydrate("nope", 1)).toBeNull();
    expect(rehydrate({ noParts: true }, 1)).toBeNull();
  });
});

describe("extractor output is never trusted", () => {
  it("drops a slot name the ledger does not read", () => {
    const out = sanitize(
      JSON.stringify({ slots: [{ part: 5, key: "made_up_key", values: ["x"] }] }),
    );
    expect(out.slots).toHaveLength(0);
  });

  it("drops a boolean slot that is not exactly true or false", () => {
    // "yes probably" would be read as false by the strict flag reader, which
    // is worse than not recording it at all.
    const out = sanitize(
      JSON.stringify({ slots: [{ part: 1, key: "love_flag", values: ["yes probably"] }] }),
    );
    expect(out.slots).toHaveLength(0);
  });

  it("survives output that is not JSON at all", () => {
    const out = sanitize("I am sorry, I cannot help with that.");
    expect(out.slots).toEqual([]);
    expect(out.notice).toBe("none");
  });
});

describe("consent is never manufactured", () => {
  // This is the one field in the extractor with a legal cost if it is loose.
  // Everything that is not exactly the right word must read as "not asked".

  it("only the exact word granted counts as consent", () => {
    expect(sanitize(JSON.stringify({ notice: "granted", slots: [] })).notice).toBe("granted");
  });

  it("anything else at all is none", () => {
    for (const junk of [
      "yes",
      "true",
      "GRANTED",
      "granted ",
      "probably",
      1,
      true,
      null,
      { granted: true },
    ]) {
      expect(sanitize(JSON.stringify({ notice: junk, slots: [] })).notice).toBe("none");
    }
  });

  it("a missing notice field is none, not consent", () => {
    expect(sanitize(JSON.stringify({ slots: [] })).notice).toBe("none");
  });

  it("a decline is kept, not thrown away", () => {
    // A recorded no is what stops us publishing somebody by mistake later.
    expect(sanitize(JSON.stringify({ notice: "declined", slots: [] })).notice).toBe("declined");
  });

  it("notice survives alongside real slots in the same turn", () => {
    const out = sanitize(
      JSON.stringify({
        notice: "granted",
        slots: [{ part: 5, key: "offer", values: ["I fix mowers"] }],
      }),
    );
    expect(out.notice).toBe("granted");
    expect(out.slots).toHaveLength(1);
  });
});
