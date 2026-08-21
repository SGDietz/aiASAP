import { describe, expect, it } from "vitest";
import {
  isDestinationListDictation,
  isSpokenListQuestion,
  listItemKeysMatch,
  shouldAllowDetectedListIntent,
  shouldLookupListItem,
  shouldTreatAsListMutation,
  stripDestinationListContext,
} from "../../src/lib/lists/turnIntent";

describe("list turn intent", () => {
  it("rejects every false list opening from the latest ride", () => {
    for (const text of [
      "It's very hard my whole life to do this.",
      "to do this",
      "I think that's the number one thing we need you to do.",
      "need to do",
      "The fuck is this to-do list? Me to-do list? What the fuck is that?",
      "fuck is this to-do list need to do list what the fuck is that",
      "What list? Why did this list come up?",
      "I didn't say list.",
      "I think Walmart has milk",
    ]) {
      expect(shouldAllowDetectedListIntent(text), text).toBe(false);
    }
  });

  it("preserves explicit list creation, opening, and routing", () => {
    for (const text of [
      "make a grocery list",
      "Okay, put that list to the side. Let's make a Walmart list.",
      "bring the grocery list back up",
      "Oh, let me see the Walmart list.",
      "open my weekend list",
      "switch to my grocery list",
      "I need a shopping list",
      "Walmart list",
      "grocery list",
      "to-do list",
    ]) {
      expect(shouldAllowDetectedListIntent(text), text).toBe(true);
    }
  });

  it("rejects explicitly negated list actions", () => {
    for (const text of [
      "Don't open my grocery list.",
      "Do not show the shopping list.",
      "No need to pull up a list right now.",
      "Please avoid creating a list for that.",
      "Never add that to my list.",
    ]) {
      expect(shouldAllowDetectedListIntent(text), text).toBe(false);
      expect(isSpokenListQuestion(text), text).toBe(false);
    }
  });

  it("recognizes STT questions even without question marks", () => {
    for (const text of [
      "where is BlackBerry strawberries and bananas",
      "what list is this",
      "why did this list come up",
      "why did you add toothpaste",
      "is milk already on the list",
      "do I have bananas on there",
    ]) {
      expect(isSpokenListQuestion(text), text).toBe(true);
    }
    expect(isSpokenListQuestion("add bananas to the list")).toBe(false);
    expect(isSpokenListQuestion("can you add milk")).toBe(false);
  });

  it("accepts natural destination dictation and strips only its destination", () => {
    expect(isDestinationListDictation("Eggs and milk for Walmart.")).toBe(true);
    expect(stripDestinationListContext("Eggs and milk for Walmart.")).toBe(
      "Eggs and milk",
    );
    expect(isDestinationListDictation("toothpaste for the grocery list")).toBe(
      true,
    );
    expect(stripDestinationListContext("toothpaste for the grocery list")).toBe(
      "toothpaste",
    );
    expect(isDestinationListDictation("I work for Walmart")).toBe(false);
  });

  it("separates mutations from conversation while a list is active", () => {
    for (const text of [
      "Add toothpaste",
      "I need a comb",
      "eggs, add milk",
      "Blueberries, blackberries, strawberries, and bananas",
      "Eggs and milk for Walmart.",
      "Okay, so I like the pillboxes below. Add toothpaste.",
      "so I like the pill boxes below add toothpaste",
    ]) {
      expect(
        shouldTreatAsListMutation(text, { hasActiveList: true }),
        text,
      ).toBe(true);
    }

    for (const text of [
      "It's very hard my whole life to do this.",
      "I think that's the number one thing we need you to do.",
      "need to do",
      "where is BlackBerry strawberries and bananas",
      "Why did you add toothpaste?",
      "I didn't ask you to add toothpaste.",
      "Yes.",
      "Okay.",
      "I didn't say list.",
      "let's just sit here and talk and see if anything gets added accidentally",
    ]) {
      expect(
        shouldTreatAsListMutation(text, { hasActiveList: true }),
        text,
      ).toBe(false);
    }
  });

  it("requires explicit lookup intent instead of any item mention", () => {
    for (const text of [
      "where is the blow dryer",
      "find bananas on the list",
      "do I have milk on there",
      "is toothpaste already on the list",
      "what number is shampoo",
    ]) {
      expect(shouldLookupListItem(text), text).toBe(true);
    }
    for (const text of [
      "Yes.",
      "Okay.",
      "So number 4 says added a.",
      "Number 4 should just say blow dryer.",
      "I like bananas",
      "blow dryer",
    ]) {
      expect(shouldLookupListItem(text), text).toBe(false);
    }
  });

  it("matches item keys without tiny substring collisions", () => {
    expect(listItemKeysMatch("Blow dryer", "Yes")).toBe(false);
    expect(listItemKeysMatch("Bananas", "an")).toBe(false);
    expect(listItemKeysMatch("Blackberries", "blackberry")).toBe(true);
    expect(listItemKeysMatch("Paper towels", "paper towel")).toBe(true);
    expect(listItemKeysMatch("2% milk", "2 milk")).toBe(true);
    expect(listItemKeysMatch("Le lait", "lait")).toBe(true);
    expect(listItemKeysMatch("Los plátanos", "plátano")).toBe(true);
    expect(listItemKeysMatch("Die Eier", "Eier")).toBe(true);
    expect(listItemKeysMatch("Milk", "milk")).toBe(true);
  });
});
