import { describe, it, expect } from "vitest";
import {
  getListContextPrompts,
  normalizeListContext,
} from "../../src/lib/promptBrain/listContextPrompts";

// G 2026-06-14: when a list is open, the pills must be things people NEED on
// that list (Walmart -> Add Toothpaste/Milk...), never the life-goals.
describe("prompt-brain list-context pills", () => {
  it("Walmart/grocery -> item-add pills, not life goals", () => {
    const ctx = normalizeListContext({ title: "Walmart", items: ["toothbrush"] });
    expect(ctx).not.toBeNull();
    const prompts = getListContextPrompts(ctx!);
    expect(prompts).toContain("Add Toothpaste");
    expect(prompts).toContain("Find Deals");
    expect(prompts).not.toContain("Financial Freedom");
    expect(prompts).not.toContain("Build Relationships");
  });

  it("does not suggest adding an item already on the list", () => {
    const ctx = normalizeListContext({
      title: "Grocery List",
      items: ["toothpaste", "milk"],
    });
    const prompts = getListContextPrompts(ctx!);
    expect(prompts).not.toContain("Add Toothpaste");
    expect(prompts).not.toContain("Add Milk");
  });

  it("always returns at least 4 list-relevant labels (never short)", () => {
    const full = normalizeListContext({
      title: "Walmart",
      items: ["toothpaste", "milk", "eggs", "bread", "coffee", "bananas", "paper towels"],
    });
    const prompts = getListContextPrompts(full!);
    expect(prompts.length).toBeGreaterThanOrEqual(4);
    expect(prompts).toContain("Check List");
  });

  it("returns null for non-objects (no list context)", () => {
    expect(normalizeListContext(null)).toBeNull();
    expect(normalizeListContext(undefined)).toBeNull();
    expect(normalizeListContext("nope")).toBeNull();
  });
});
