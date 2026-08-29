import { describe, it, expect } from "vitest";
import { parseReorderCommand } from "../../src/lib/listReorder";

// G's 2026-06-14 copilot ride: he asked to move list items ~6 ways and 6 said
// "I can't reorder yet" every time. These are his verbatim phrasings.
describe("parseReorderCommand — G's reorder asks (2026-06-14)", () => {
  it("position -> position / top", () => {
    expect(parseReorderCommand("make number 2 number 1")).toEqual({ from: 2, to: 1 });
    expect(parseReorderCommand("make number two number one")).toEqual({ from: 2, to: 1 });
    expect(
      parseReorderCommand("change number 3, comb, to be number 1"),
    ).toEqual({ from: 3, to: 1 });
    expect(
      parseReorderCommand("put number 4 hair dryer as number 2"),
    ).toEqual({ from: 4, to: 2 });
    expect(parseReorderCommand("move number 3 to the top")).toEqual({
      from: 3,
      to: "top",
    });
  });

  it("name -> top / bottom / position", () => {
    expect(parseReorderCommand("put comb at the top of the list")).toEqual({
      from: "comb",
      to: "top",
    });
    expect(parseReorderCommand("move hair dryer to the bottom")).toEqual({
      from: "hair dryer",
      to: "bottom",
    });
    expect(parseReorderCommand("put milk as number 2")).toEqual({
      from: "milk",
      to: 2,
    });
  });

  it("returns null for plain adds, removes, and chatter (no false reorders)", () => {
    for (const t of [
      "add milk and eggs",
      "put milk and eggs on the list",
      "remove number one",
      "what's on the list",
      "Claude, change them now",
      "milk, eggs, bread",
      "put bread at the store",
    ]) {
      expect(parseReorderCommand(t), t).toBeNull();
    }
  });
});
