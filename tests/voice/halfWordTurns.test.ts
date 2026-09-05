import { describe, expect, it } from "vitest";
import {
  flushPendingSpeechFragment,
  resolveTurnIntake,
} from "../../src/lib/voiceMode/turnIntake";

// ---------------------------------------------------------------------------
// RIDE cf79a533, 2026-09-03 22:59:24 - 23:00:42. Seventy-eight seconds, and 6
// gave a full spoken reply to "uit", to "with", to "you", and to "?" - ten
// replies in that time. G: "This is all talking over me."
//
// The damage is not only rudeness. While 6 talks the app's mic is gated, so
// the sentence G was in the MIDDLE of never became a turn at all. Four of his
// sentences that ride exist only in the provider's transcript, including
// "That's not the intro line, Claude." and "This is all talking over me."
// One cause, three symptoms.
// ---------------------------------------------------------------------------

const NOW = 10_000;

function intake(incoming: string, pending: { text: string; at: number } | null = null) {
  return resolveTurnIntake({ incoming, pending, now: NOW });
}

describe("a half-word is not a turn", () => {
  it.each(["uit", "with", "you", "?", "...", "um", "and"])(
    "holds %j instead of answering it",
    (word) => {
      const decision = intake(word);
      expect(decision.kind).toBe("hold");
    },
  );

  it("answers the whole thought once the rest of the sentence arrives", () => {
    const first = intake("with");
    expect(first.kind).toBe("hold");
    if (first.kind !== "hold") return;
    const second = intake("insurance claims all day", first.pending);
    expect(second.kind).toBe("dispatch");
    if (second.kind !== "dispatch") return;
    expect(second.text).toContain("with");
    expect(second.text).toContain("insurance claims all day");
  });

  it("still answers a real one-word reply the instant it lands", () => {
    // The send beat depends on this: a bare "Yes." must never wait.
    for (const word of ["Yes.", "No.", "Correct.", "Stop."]) {
      const decision = intake(word);
      expect(decision.kind, word).toBe("dispatch");
    }
  });

  it("delivers a held single word if nothing follows it", () => {
    // Holding must never swallow speech - after the hold window the ordinary
    // flush still hands it over. It just stops landing on top of the speaker.
    const held = { text: "insurance", at: NOW - 2_000 };
    expect(flushPendingSpeechFragment(held, NOW)).toBe("insurance");
  });

  it("never turns pure noise into a turn, even on flush", () => {
    for (const noise of ["?", "...", "  "]) {
      expect(flushPendingSpeechFragment({ text: noise, at: NOW - 2_000 }, NOW), noise).toBeNull();
    }
  });

  // RIDE 755f063f, 2026-09-05 08:34-08:38: every one of these was flushed as a
  // turn and answered ("Take your time, Scott" x3, "whenever you're ready" x4).
  it("drops a filler-only shard on flush instead of answering it", () => {
    for (const shard of ["Um,", "So, um,", "But, um, I'm gonna", "that, uh, I'm", "you know", "I mean"]) {
      expect(flushPendingSpeechFragment({ text: shard, at: NOW - 2_000 }, NOW), shard).toBeNull();
    }
  });

  it("still delivers a held shard that carries one real word", () => {
    for (const shard of ["What?", "Dropping.", "In the middle.", "insurance", "No, um", "Yes, so", "Okay, so", "I guess it could be."]) {
      expect(flushPendingSpeechFragment({ text: shard, at: NOW - 2_000 }, NOW), shard).not.toBeNull();
    }
  });

  it("leaves ordinary sentences alone", () => {
    for (const sentence of [
      "that's not the intro line",
      "have Scott reach out to me",
      "my email is example@pm.me",
      "this is all talking over me",
    ]) {
      expect(intake(sentence).kind, sentence).toBe("dispatch");
    }
  });
});

import {
  DANGLING_DROP_MAX_WORDS,
  INCOMPLETE_FRAGMENT_HOLD_MS,
  isHardDanglingShard,
  isLikelyIncompleteSpeechFragment as danglingCheck,
  shardDropReason,
} from "../../src/lib/voiceMode/turnIntake";

describe("ride f225a5c7 2026-09-05 - 6 spoke into every breath G took", () => {
  it("hears the half-thoughts from the ride as dangling (held 3.5s, not 1.4s)", () => {
    for (const shard of ["So the bottom line is", "We get", "Help you", "This is, you know, we no one at aiASAP looks", "readouts. We get, um,"]) {
      expect(danglingCheck(shard), shard).toBe(true);
    }
  });
  it("still lets whole sentences, questions and real answers through", () => {
    for (const line of ["I do stand-up comedy.", "Yes.", "Stop.", "How are you", "What do you mean by that?", "I'd love to build digital companies for people."]) {
      expect(danglingCheck(line), line).toBe(false);
    }
  });
  it("drops a short shard that is still dangling when the long hold expires, never answers it", () => {
    const at = 1_000;
    for (const shard of ["So the bottom line is", "We get", "Help you", "and then the"]) {
      expect(isHardDanglingShard(shard), shard).toBe(true);
      expect(flushPendingSpeechFragment({ text: shard, at }, at + INCOMPLETE_FRAGMENT_HOLD_MS, INCOMPLETE_FRAGMENT_HOLD_MS), shard).toBeNull();
    }
    expect(shardDropReason("So the bottom line is")).toBe("dangling_fragment");
    expect(shardDropReason("um,")).toBe("filler_only_shard");
  });
  it("keeps every shard the cf79a533 contract protects, and any long thought", () => {
    for (const shard of ["No, um", "Yes, so", "Okay, so", "I guess it could be.", "What?", "In the middle."]) {
      expect(isHardDanglingShard(shard), shard).toBe(false);
    }
    const words = "I really want to build something big for my family and then we can".split(" ");
    expect(words.length).toBeGreaterThan(DANGLING_DROP_MAX_WORDS);
    expect(flushPendingSpeechFragment({ text: words.join(" "), at: 0 }, INCOMPLETE_FRAGMENT_HOLD_MS, INCOMPLETE_FRAGMENT_HOLD_MS)).toBe(words.join(" "));
  });
});
