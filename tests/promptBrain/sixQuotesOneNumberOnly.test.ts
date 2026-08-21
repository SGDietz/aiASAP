import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SIX_SYSTEM_PROMPT } from "../../src/lib/brain/sixSystemPrompt";

/**
 * G'S ONE-NUMBER RULE. 6 says five thousand for the build and prices nothing
 * else - no figure, no percentage, no range, no example, for anything.
 *
 * On 2026-08-21 the brain still quoted "around $10/month" for the assistant and
 * a tier ladder of "$10-$20-$50-$100-$200+". G's call: kill the figures. What
 * stays is the honest part - it is free now, later there is a small monthly
 * fee, and Scott names it.
 *
 * This is a guard, not a style check. The brain is REGENERATED from
 * tools/cw_6af8624c_prompt.txt, so a price can walk back in through a text
 * edit with nothing in the type system to stop it - and it would be invisible
 * until a real person heard 6 quote a price Scott never agreed to.
 */

const SOURCE = resolve(__dirname, "../../tools/cw_6af8624c_prompt.txt");

/**
 * Dollar amounts 6 is allowed to say, in every form the brain writes them.
 * The build is $5,000 in three payments; those four numbers and nothing else.
 */
const ALLOWED = new Set(["$5,000", "$5000", "$2,000", "$2000", "$1,000", "$1000"]);

function dollarFigures(text: string): string[] {
  // Commas and decimals only count when digits follow, so a figure that ends a
  // clause ("...costs $5,000, plus...") is not read as some other number.
  const re = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?|\$\s?\d+(?:\.\d+)?/g;
  return (text.match(re) ?? []).map((m) => m.replace(/\s/g, ""));
}

describe("6 quotes one number and only one number", () => {
  it("names no dollar figure outside the build price and its three payments", () => {
    const found = dollarFigures(SIX_SYSTEM_PROMPT).filter((f) => !ALLOWED.has(f));
    expect(found).toEqual([]);
  });

  it("has no monthly subscription price at all", () => {
    // The two exact shapes that were there, plus the tier ladder they lived in.
    for (const banned of [
      "$10/month",
      "ten dollars a month",
      "$10-$20",
      "$20-$50",
      "$50-$100",
      "$100-$200",
    ]) {
      expect(SIX_SYSTEM_PROMPT).not.toContain(banned);
    }
  });

  it("still tells people the running costs EXIST", () => {
    // Removing the figures must never turn into hiding the costs. A person who
    // finds out later feels tricked, and they would be right.
    expect(SIX_SYSTEM_PROMPT).toContain("running costs");
    expect(SIX_SYSTEM_PROMPT.toLowerCase()).toContain("monthly fee");
  });

  it("still says the assistant is free right now", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("FREE beta");
  });

  it("the shipped brain matches its source file", () => {
    // sixSystemPrompt.ts is generated. If somebody hand-edits the .ts, the next
    // regeneration silently throws their change away - so drift between the two
    // is a real defect, not tidiness.
    const source = readFileSync(SOURCE, "utf8").replace(/\r\n/g, "\n");
    expect(SIX_SYSTEM_PROMPT).toBe(source);
  });
});
