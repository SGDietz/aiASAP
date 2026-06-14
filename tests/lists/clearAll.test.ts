import { describe, it, expect } from "vitest";
import { isClearAllCommand } from "../../src/lib/listClear";

// G's 2026-06-14 transcript: he asked to clear the Walmart list ~26 times in a
// row, 6 said "done, all 26 gone," and the items stayed. These are his verbatim
// phrasings — they MUST register as clear-all so the list actually empties.
describe("isClearAllCommand — G's 'nothing clears' rage (2026-06-14)", () => {
  it("matches every clear-all phrasing G actually said", () => {
    for (const t of [
      "clear the list",
      "clear everything",
      "remove everything",
      "remove everything from the list",
      "6, you should just remove everything from the list.",
      "get rid of everything",
      "just clear the list, get rid of everything",
      "wipe everything off",
      "they should just clear the list, get rid of everything",
      "empty the list",
      "Okay, so I want you to wipe everything off the list.",
      "Can you do that now? Just get rid of everything on the list.",
    ]) {
      expect(isClearAllCommand(t), t).toBe(true);
    }
  });

  it("never fires on a real item, a single remove, or a readback", () => {
    for (const t of [
      "everything bagels",
      "add everything bagels",
      "remove milk",
      "take off number one",
      "remove both 1 and 2",
      "add eggs and bread",
      "what's on the list",
      "read me the list",
    ]) {
      expect(isClearAllCommand(t), t).toBe(false);
    }
  });
});
