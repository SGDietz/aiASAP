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
