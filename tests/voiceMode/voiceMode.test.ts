// Voice-list mode regressions (2026-06-11, the voice/avatar separation).
import { describe, it, expect } from "vitest";
import {
  AVATAR_RETURN_RE,
  LIST_DONE_RE,
  wantsAvatarBack,
  voiceListEnterLine,
  isGarbledListOpen,
} from "../../src/lib/voiceMode/intents";
import { pcm16BytesToFloat32 } from "../../src/lib/voiceMode/pcm";

describe("avatar return intents (G: any and all reasonable ways)", () => {
  it("come-back phrases match", () => {
    for (const t of [
      "Bring him back.",
      "Okay, come back.",
      "Show me your face.",
      "Where did he go?",
      "I want to see you.",
      "Go back to the avatar.",
      "Let me see you.",
      "bring 6 back",
    ]) {
      expect(AVATAR_RETURN_RE.test(t), t).toBe(true);
    }
  });
  it("close-the-list phrases match", () => {
    for (const t of [
      "Close the list.",
      "Okay, I'm done.",
      "That's it.",
      "That's everything.",
      "We're done here.",
      "All done!",
      "Done with the list.",
      "Get rid of this list.",
      "Save the list.",
      "We're good.",
      "Looks good.",
      "Wrap it up.",
      // r19 — G's first live session, verbatim:
      "See 6 again. Take the list off.",
      "Take the list down.",
      "Take it off the screen.",
      "Remove the list.",
    ]) {
      expect(LIST_DONE_RE.test(t), t).toBe(true);
    }
  });
  it("r19 verbatim come-back forms match", () => {
    expect(AVATAR_RETURN_RE.test("See 6 again.")).toBe(true);
    expect(AVATAR_RETURN_RE.test("Where is 6?")).toBe(true);
  });
  it("normal list chatter does NOT end the mode", () => {
    for (const t of [
      "Add milk and eggs.",
      "Take the bread off.",
      "What's on the list so far?",
      "Make it bigger.",
      "Add done... I mean, add donuts.",
      "My back hurts.",
      "Remind me to call Bob tomorrow at 9.",
      // 2026-06-13 dogfood: G TALKING ABOUT a close phrase, not commanding it.
      "Okay, great. Now, I know you very well, so at some point, you don't have to say, you know, to remove the list, just say, take it off, because I already know that. You know what I mean?",
      // a close-ish phrase that also adds an item is list work, not a close:
      "looks good, let's add bananas",
      "we're good, now add eggs",
      "that's perfect, add milk too",
    ]) {
      expect(wantsAvatarBack(t), t).toBe(false);
    }
  });
  it("legit return phrases still end the mode via wantsAvatarBack", () => {
    for (const t of [
      "I want to see you",
      "come back",
      "bring 6 back",
      "Okay, six, come on back.",
    ]) {
      expect(wantsAvatarBack(t), t).toBe(true);
    }
  });
  it("enter lines stay short", () => {
    expect(voiceListEnterLine("Walmart List", true)).toContain("Walmart List");
    expect(voiceListEnterLine("Walmart List", false)).toBe("Here's your Walmart List.");
  });
});

describe("PCM16 -> Float32", () => {
  it("converts little-endian samples to [-1, 1]", () => {
    // 0, +16384 (0.5), -16384 (-0.5), -32768 (-1)
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x40, 0x00, 0xc0, 0x00, 0x80]);
    const out = pcm16BytesToFloat32(bytes);
    expect(out.length).toBe(4);
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[1]).toBeCloseTo(0.5, 5);
    expect(out[2]).toBeCloseTo(-0.5, 5);
    expect(out[3]).toBeCloseTo(-1, 5);
  });
  it("ignores a trailing odd byte", () => {
    expect(pcm16BytesToFloat32(new Uint8Array([0, 0, 7])).length).toBe(1);
  });
});

describe("isGarbledListOpen — a chopped 'I'll show me' mashup must not open a list (G 2026-06-14)", () => {
  it("flags the garbled self-show mashup, not real opens", () => {
    for (const t of [
      "I'll show me the list",
      "I will show me the list",
      "Ill show me the list",
      "I'm gonna show me a list",
      "I am gonna show me a list",
      "I am going to show me the grocery list",
      "let me show me the list",
      "I will show me the",
    ]) {
      expect(isGarbledListOpen(t), t).toBe(true);
    }
    for (const t of [
      "show me the list",
      "show me the to-do list",
      "open my grocery list",
      "pull up my Walmart list",
      "show me the grocery list",
      "can you show me my todo list",
      "I want to see my grocery list",
      "let me see the list",
    ]) {
      expect(isGarbledListOpen(t), t).toBe(false);
    }
  });
});
