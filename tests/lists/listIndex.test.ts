import { describe, it, expect } from "vitest";
import {
  LIST_INDEX_RE,
  buildListIndexReply,
  resolveListPick,
  type ListIndexEntry,
} from "../../src/lib/lists/listIndex";

const ENTRIES: ListIndexEntry[] = [
  { id: "grocery-list", title: "Grocery List" },
  { id: "walmart-list", title: "Walmart List" },
  { id: "to-do-list", title: "To Do List" },
  { id: "packing-list", title: "Packing List" },
];

describe("LIST_INDEX_RE — asking for the menu of lists", () => {
  it("matches the plural index asks", () => {
    for (const t of [
      "what lists do I have",
      "show me my lists",
      "list of lists",
      "which lists do I have",
      "my lists",
      "all my lists",
      "how many lists do I have",
      "read me my lists",
    ]) {
      expect(LIST_INDEX_RE.test(t), t).toBe(true);
    }
  });
  it("does NOT match the singular 'show me the list' opener", () => {
    for (const t of [
      "show me the list",
      "show me my grocery list",
      "open the walmart list",
      "add milk to the list",
      "add eggs to my lists",
      "put bread on my lists",
      "these are all my lists now",
    ]) {
      expect(LIST_INDEX_RE.test(t), t).toBe(false);
    }
  });
});

describe("buildListIndexReply", () => {
  it("empty state coaches a first step", () => {
    expect(buildListIndexReply([])).toMatch(/don't have any saved lists yet/i);
    expect(buildListIndexReply([])).toMatch(/make a grocery list/i);
  });
  it("names all lists with an Oxford comma and asks which one", () => {
    const r = buildListIndexReply([
      "Grocery List",
      "Walmart List",
      "To Do List",
      "Packing List",
    ]);
    expect(r).toBe(
      "You have 4 lists: Grocery List, Walmart List, To Do List, and Packing List. Which one?",
    );
  });
  it("singular grammar for one list", () => {
    expect(buildListIndexReply(["Grocery List"])).toBe(
      "You have 1 list: Grocery List. Which one?",
    );
  });
});

describe("resolveListPick", () => {
  it("picks by ordinal", () => {
    expect(resolveListPick("the first one", ENTRIES)?.id).toBe("grocery-list");
    expect(resolveListPick("second", ENTRIES)?.id).toBe("walmart-list");
    expect(resolveListPick("the last one", ENTRIES)?.id).toBe("packing-list");
  });
  it("picks by full title and by single brand word", () => {
    expect(resolveListPick("open the walmart list", ENTRIES)?.id).toBe(
      "walmart-list",
    );
    expect(resolveListPick("Walmart", ENTRIES)?.id).toBe("walmart-list");
  });
  it("picks by fuzzy keyword (incl. the to-do alias)", () => {
    expect(resolveListPick("the grocery one", ENTRIES)?.id).toBe("grocery-list");
    expect(resolveListPick("packing", ENTRIES)?.id).toBe("packing-list");
    expect(resolveListPick("the to do one", ENTRIES)?.id).toBe("to-do-list");
  });
  it("returns null when nothing clearly matches (no hijack of normal speech)", () => {
    expect(resolveListPick("how's the weather today", ENTRIES)).toBeNull();
    expect(resolveListPick("thanks that's great", ENTRIES)).toBeNull();
  });
  it("a bare ordinal buried in a sentence does NOT pick (review 2026-06-14)", () => {
    expect(resolveListPick("the first thing I need is milk", ENTRIES)).toBeNull();
    expect(resolveListPick("first, let me grab my keys", ENTRIES)).toBeNull();
    expect(resolveListPick("what's the last time we talked", ENTRIES)).toBeNull();
    expect(resolveListPick("the second I get home", ENTRIES)).toBeNull();
  });
  it("returns null for an empty index", () => {
    expect(resolveListPick("the first one", [])).toBeNull();
  });
});
