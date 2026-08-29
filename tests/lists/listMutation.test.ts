import { describe, expect, it } from "vitest";
import {
  applyAddItems,
  buildAddItemsAcknowledgment,
} from "../../src/lib/lists/listMutation";

type TestList = {
  id: string;
  title: string;
  items: string[];
  updatedAt: number;
};

const list = (items: string[] = []): TestList => ({
  id: "grocery-list",
  title: "Grocery List",
  items,
  updatedAt: 100,
});

const format = (items: readonly string[]) => items.join(", ");

describe("applyAddItems — authoritative list receipts", () => {
  it("persists the exact latest-ride four-fruit batch", () => {
    const receipt = applyAddItems(
      [list()],
      "grocery-list",
      ["blueberries", "blackberries", "strawberries", "bananas"],
      { now: 200, revisionBefore: 7, utteranceId: "turn-123" },
    );

    expect(receipt.status).toBe("changed");
    expect(receipt.added).toEqual([
      "Blueberries",
      "Blackberries",
      "Strawberries",
      "Bananas",
    ]);
    expect(receipt.alreadyPresent).toEqual([]);
    expect(receipt.rejectedByLimit).toEqual([]);
    expect(receipt.resultingItems).toEqual(receipt.added);
    expect(receipt.itemsBefore).toEqual([]);
    expect(receipt.nextLists[0].items).toEqual(receipt.added);
    expect(receipt.nextLists[0].updatedAt).toBe(200);
    expect(receipt.revisionBefore).toBe(7);
    expect(receipt.revisionAfter).toBe(8);
    expect(receipt.utteranceId).toBe("turn-123");
    expect(receipt.idempotencyKey).toBe(
      "turn-123:list:add:grocery-list",
    );
  });

  it("feeds rapid mutations from returned authoritative state without loss", () => {
    const first = applyAddItems(
      [list()],
      "grocery-list",
      ["Blueberries", "Blackberries", "Strawberries", "Bananas"],
      { now: 200, revisionBefore: 0 },
    );
    const second = applyAddItems(
      first.nextLists,
      "grocery-list",
      ["Coffee"],
      { now: 201, revisionBefore: first.revisionAfter },
    );

    expect(second.resultingItems).toEqual([
      "Blueberries",
      "Blackberries",
      "Strawberries",
      "Bananas",
      "Coffee",
    ]);
    expect(second.revisionAfter).toBe(2);
  });

  it("does not collapse different no-utterance commands at one revision", () => {
    const milk = applyAddItems([list()], "grocery-list", ["Milk"], {
      now: 200,
      revisionBefore: 4,
    });
    const eggs = applyAddItems([list()], "grocery-list", ["Eggs"], {
      now: 200,
      revisionBefore: 4,
    });

    expect(milk.idempotencyKey).not.toBe(eggs.idempotencyKey);
    expect(milk.idempotencyKey).toContain("revision:4:items:");
  });

  it("reports mixed duplicates and additions truthfully", () => {
    const receipt = applyAddItems(
      [list(["Blackberries"])],
      "grocery-list",
      ["blackberries", "blueberries"],
      { now: 200 },
    );

    expect(receipt.status).toBe("changed");
    expect(receipt.added).toEqual(["Blueberries"]);
    expect(receipt.alreadyPresent).toEqual(["Blackberries"]);
    expect(receipt.resultingItems).toEqual(["Blackberries", "Blueberries"]);
    expect(buildAddItemsAcknowledgment(receipt, format)).toBe(
      "Added Blueberries. Blackberries was already on the list.",
    );
  });

  it("never reports a duplicate request as added", () => {
    const original = [list(["Toothpaste"])];
    const receipt = applyAddItems(original, "grocery-list", ["toothpaste"], {
      now: 200,
      revisionBefore: 4,
    });

    expect(receipt.status).toBe("unchanged");
    expect(receipt.added).toEqual([]);
    expect(receipt.alreadyPresent).toEqual(["Toothpaste"]);
    expect(receipt.nextLists).toBe(original);
    expect(receipt.revisionAfter).toBe(4);
    expect(buildAddItemsAcknowledgment(receipt, format)).toBe(
      "Toothpaste was already on the list.",
    );
  });

  it("reports capacity rejects instead of acknowledging dropped items", () => {
    const receipt = applyAddItems(
      [list(["Milk", "Eggs"])],
      "grocery-list",
      ["Bread", "Coffee", "Rice"],
      { maxItems: 3, now: 200 },
    );

    expect(receipt.added).toEqual(["Bread"]);
    expect(receipt.rejectedByLimit).toEqual(["Coffee", "Rice"]);
    expect(receipt.resultingItems).toEqual(["Milk", "Eggs", "Bread"]);
    expect(buildAddItemsAcknowledgment(receipt, format)).toBe(
      "Added Bread. The list is full, so I couldn't add Coffee, Rice.",
    );
  });

  it("returns a missing receipt and cannot claim success", () => {
    const original = [list()];
    const receipt = applyAddItems(original, "missing-list", ["Milk"], {
      now: 200,
      revisionBefore: 2,
    });

    expect(receipt.status).toBe("missing");
    expect(receipt.added).toEqual([]);
    expect(receipt.resultingItems).toEqual([]);
    expect(receipt.nextLists).toBe(original);
    expect(receipt.revisionAfter).toBe(2);
    expect(buildAddItemsAcknowledgment(receipt, format)).toBe(
      "I couldn't find that list, so I didn't add anything.",
    );
  });

  it("deduplicates repeated requested items before producing a receipt", () => {
    const receipt = applyAddItems(
      [list()],
      "grocery-list",
      ["milk", "Milk", "  milk  ", ""],
      { now: 200 },
    );

    expect(receipt.requested).toEqual(["Milk"]);
    expect(receipt.added).toEqual(["Milk"]);
    expect(receipt.resultingItems).toEqual(["Milk"]);
  });
});
