import { describe, it, expect } from "vitest";
import {
  ADD_OFFER_RE,
  ADD_OFFER_NEGATE_RE,
  isAddOfferAffirmative,
  parseOfferedAddItems,
} from "../../src/lib/listAddOffer";

describe("ADD_OFFER_RE: 6's offer lines", () => {
  it("matches the offer shapes 6 actually speaks", () => {
    for (const t of [
      "Want me to add milk?",
      "Want me to add milk to your grocery list?",
      "Shall I add eggs and bread?",
      "Should I put that on the list?",
      "I can add toothpaste for you.",
    ]) {
      expect(ADD_OFFER_RE.test(t), t).toBe(true);
    }
  });
  it("does NOT match non-offers / other confirms", () => {
    for (const t of [
      "Do you want me to delete the grocery list? Say yes to delete it.",
      "Before I delete that list, say yes to delete it or no to keep it.",
      "I only have three for you. Want me to read them all?",
      "I closed the list.",
      "Added milk.",
    ]) {
      expect(ADD_OFFER_RE.test(t), t).toBe(false);
    }
  });
});

describe("parseOfferedAddItems", () => {
  it("single item, with and without a list tail", () => {
    expect(parseOfferedAddItems("Want me to add milk?")).toEqual(["milk"]);
    expect(
      parseOfferedAddItems("Want me to add milk to your grocery list?"),
    ).toEqual(["milk"]);
    expect(parseOfferedAddItems("I can add toothpaste for you.")).toEqual([
      "toothpaste",
    ]);
  });
  it("multiple items split on comma + and, articles stripped", () => {
    expect(parseOfferedAddItems("Shall I add eggs and bread?")).toEqual([
      "eggs",
      "bread",
    ]);
    expect(
      parseOfferedAddItems("Want me to add apples, bananas and some grapes?"),
    ).toEqual(["apples", "bananas", "grapes"]);
  });
  it("returns [] when there is no parseable item", () => {
    expect(parseOfferedAddItems("Want me to add it to the list?").length).toBe(0);
    expect(parseOfferedAddItems("I closed the list.")).toEqual([]);
  });
});

describe("isAddOfferAffirmative: the next user turn", () => {
  it("accepts whole-utterance yeses", () => {
    for (const t of [
      "yes",
      "Yeah",
      "yep",
      "sure",
      "do it",
      "go ahead",
      "okay",
      "Yeah, do it.",
      "add it",
      "sounds good",
    ]) {
      expect(isAddOfferAffirmative(t), t).toBe(true);
    }
  });
  it("rejects negatives and long sentences that merely contain 'yeah'", () => {
    for (const t of [
      "no",
      "nope",
      "not now",
      "don't",
      "never mind",
      "yeah but actually take milk off instead",
      "yeah, what's the weather tomorrow?",
    ]) {
      expect(isAddOfferAffirmative(t), t).toBe(false);
    }
  });
  it("ADD_OFFER_NEGATE_RE flags clears", () => {
    expect(ADD_OFFER_NEGATE_RE.test("no thanks")).toBe(true);
    expect(ADD_OFFER_NEGATE_RE.test("yes please")).toBe(false);
  });
});
