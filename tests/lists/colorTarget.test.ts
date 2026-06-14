import { describe, it, expect } from "vitest";
import { detectColorTarget } from "../../src/lib/listColorTarget";

// G 2026-06-14: people must be able to color the LIST and the TEXT separately,
// just by talking to 6. This decides which one a command means.
describe("detectColorTarget — text vs box", () => {
  it("targets the TEXT when text/words/writing/font is named", () => {
    for (const t of [
      "make the text blue",
      "make the words darker",
      "make the writing a lighter green",
      "turn the letters white",
      "make the font brighter",
      "the text should be brown",
      "make the list text a darker blue",
    ]) {
      expect(detectColorTarget(t), t).toBe("text");
    }
  });

  it("targets the BOX (default) otherwise", () => {
    for (const t of [
      "make it blue",
      "make the list green",
      "make the box darker",
      "turn the background purple",
      "make the pill boxes amber",
      "darker",
      "brighter",
    ]) {
      expect(detectColorTarget(t), t).toBe("box");
    }
  });
});
