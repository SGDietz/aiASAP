import { describe, expect, it, vi } from "vitest";
import {
  bindSessionListener,
  flushPendingSpeechFragment,
  isLikelyIncompleteSpeechFragment,
  mergeSpeechFragments,
  resolveTurnIntake,
} from "../../src/lib/voiceMode/turnIntake";

describe("voice turn intake — latest aiASAP SUP fragments", () => {
  it.each([
    "I think okay so we need",
    "And I think",
    "think I think the place is like",
    "my personal life I'm such a",
    "I added a",
    "I added a.",
    "add a",
    "open the",
    "Can you?",
    "What do you",
    "take the",
    "I love to, um,",
    "build your",
    "You know, people don't",
    "they need to be",
  ])("holds incomplete fragment: %s", (text) => {
    expect(isLikelyIncompleteSpeechFragment(text)).toBe(true);
  });

  it.each([
    "Define one thing",
    "Wait a minute.",
    "you there",
    "How are you",
    "What do you think",
    "What does she think?",
    "What do we need?",
    "Tell me what you think",
    "Add toothpaste",
    "close the list",
    "I need milk",
    "I think trust matters",
    "people don't like me",
    "turn it on",
    "tell me what you need",
    "what is this",
    "What do you mean by that?",
    "What do you mean by that",
    "What do you mean by that...",
    "Why is that?",
  ])("dispatches complete turn: %s", (text) => {
    expect(isLikelyIncompleteSpeechFragment(text)).toBe(false);
  });

  it("stitches a held lead-in to its completing fragment", () => {
    const first = resolveTurnIntake({
      incoming: "I think okay so we need",
      pending: null,
      now: 1_000,
    });
    expect(first).toEqual({
      kind: "hold",
      pending: { text: "I think okay so we need", at: 1_000 },
    });

    const second = resolveTurnIntake({
      incoming: "Define one thing",
      pending: first.pending,
      now: 2_000,
    });
    expect(second).toEqual({
      kind: "dispatch",
      text: "I think okay so we need Define one thing",
      pending: null,
      stitched: true,
    });
  });

  it("stitches the exact Added-a split without creating a junk turn", () => {
    const first = resolveTurnIntake({
      incoming: "I added a",
      pending: null,
      now: 1_000,
    });
    const second = resolveTurnIntake({
      incoming: "blow dryer.",
      pending: first.pending,
      now: 1_700,
    });

    expect(second.kind).toBe("dispatch");
    if (second.kind === "dispatch") {
      expect(second.text).toBe("I added a blow dryer.");
    }
  });

  it("prefers a later full final over a partial duplicate", () => {
    expect(
      mergeSpeechFragments(
        "think I think the place is like my personal life I'm such a",
        "I think the place is, it's like in my personal life, I'm such a loser. I don't have any friends.",
      ),
    ).toBe(
      "I think the place is, it's like in my personal life, I'm such a loser. I don't have any friends.",
    );
  });

  it("does not stitch a stale fragment into a new turn", () => {
    const result = resolveTurnIntake({
      incoming: "Add toothpaste",
      pending: { text: "And I think", at: 1_000 },
      now: 10_001,
      maxPendingAgeMs: 8_000,
    });

    expect(result).toEqual({
      kind: "dispatch",
      text: "Add toothpaste",
      pending: null,
      stitched: false,
    });
  });

  it("flushes a lone provider final instead of silently losing it", () => {
    const pending = { text: "email is fine", at: 1_000 };

    expect(flushPendingSpeechFragment(pending, 2_399)).toBeNull();
    expect(flushPendingSpeechFragment(pending, 2_400)).toBe("email is fine");
    expect(flushPendingSpeechFragment(null, 2_400)).toBeNull();
  });

  it("does not stitch a fresh conversational shard into a direct command", () => {
    const result = resolveTurnIntake({
      incoming: "Add toothpaste",
      pending: { text: "And I think", at: 1_000 },
      now: 2_000,
    });

    expect(result).toEqual({
      kind: "dispatch",
      text: "Add toothpaste",
      pending: null,
      stitched: false,
    });
  });

  it("cleans up the exact session source that registered the listener", () => {
    const oldSession = { on: vi.fn(), off: vi.fn() };
    const replacementSession = { on: vi.fn(), off: vi.fn() };
    const handler = vi.fn();
    let currentSession = oldSession;

    const cleanup = bindSessionListener(
      currentSession,
      "USER_TRANSCRIPTION",
      handler,
    );
    currentSession = replacementSession;
    cleanup();
    cleanup();

    expect(oldSession.on).toHaveBeenCalledWith("USER_TRANSCRIPTION", handler);
    expect(oldSession.off).toHaveBeenCalledWith("USER_TRANSCRIPTION", handler);
    expect(oldSession.off).toHaveBeenCalledTimes(1);
    expect(replacementSession.off).not.toHaveBeenCalled();
    expect(currentSession).toBe(replacementSession);
  });

  it("uses removeListener when the session has no off method", () => {
    const source = { on: vi.fn(), removeListener: vi.fn() };
    const handler = vi.fn();
    const cleanup = bindSessionListener(source, "USER_SPEAK_STARTED", handler);

    cleanup();

    expect(source.removeListener).toHaveBeenCalledWith(
      "USER_SPEAK_STARTED",
      handler,
    );
  });
});
