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

  // Herm TASK_012: natural whole-list slang that doesn't say "everything".
  it("catches whole-list slang without requiring the word everything", () => {
    for (const t of [
      "nuke the whole thing",
      "nuke the list",
      "start the list over",
      "start over with this list",
      "scrap all of it",
      "scrap the whole list",
      "delete it all",
      "delete all of it",
      "drop everything from the list",
      "take all of it off",
      "take all of them off the list",
      "clear all items",
      "empty all items from the list",
      "reset the whole thing",
      "wipe the whole list",
      "erase every item",
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

  // Herm TASK_012: real item names that happen to contain clear/reset/wipe/all.
  it("does not clear on item names containing clear/reset/wipe/nuke/all", () => {
    for (const t of [
      "clear gel",
      "add clear gel",
      "reset spray",
      "buy reset spray",
      "wipe",
      "wipe cloths",
      "delete cookies",
      "remove allspice",
      "all purpose flour",
      "clear eyes eye drops",
      "nuke hot sauce",
      "clear goals",
      "set clear goals",
    ]) {
      expect(isClearAllCommand(t), t).toBe(false);
    }
  });
});
