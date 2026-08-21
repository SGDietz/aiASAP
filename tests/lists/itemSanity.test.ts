import { describe, it, expect } from "vitest";
import { isPlausibleListItem } from "../../src/lib/listItemSanity";

// G 2026-06-14: "why do non-walmart-list things keep coming up on the lists?"
// Every junk item he ever hit must be rejected; every real grocery/list item
// must pass. This is the chokepoint that makes the answer provable.
describe("isPlausibleListItem — rejects all the junk G hit", () => {
  it("rejects agent names, fillers, fragments, app terms, meta", () => {
    for (const junk of [
      "Herm", "Claude", "Six", "Buddy", "Buddies", "Perm", "Adam",
      "Wow", "Great", "That's great", "Again", "More", "Look", "Same",
      "Vision", "Obsession", "Caught", "Going", "Gave",
      "Put", "Add", "Figure that out", "Investigate",
      "Him up and Running", "Full page when I", "They to be the normal",
      "People get", "Up people", "2 second", "Page 1A", "Search results",
      "Zip", "Been silent", "Changes here", "Through", "Except for",
      "problems", "Fucking problems", "What do people buy", "2",
      "Added a", "I added a", "And added a", "Need to do",
    ]) {
      expect(isPlausibleListItem(junk), junk).toBe(false);
    }
  });

  it("accepts real grocery / list items", () => {
    for (const good of [
      "Milk", "Eggs", "Bread", "Bananas", "Paper towels", "2% milk",
      "Everything bagels", "Blackberries", "Blueberries", "Strawberries",
      "Toothpaste", "Toothbrush", "Shampoo", "Comb", "Blow dryer",
      "Hair dryer", "Rice", "Ground beef", "Half and half", "Toilet paper",
      "Dish soap", "Orange juice", "Coffee",
    ]) {
      expect(isPlausibleListItem(good), good).toBe(true);
    }
  });
});
