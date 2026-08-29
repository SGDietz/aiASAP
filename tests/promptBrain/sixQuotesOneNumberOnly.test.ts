import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SIX_SYSTEM_PROMPT } from "../../src/lib/brain/sixSystemPrompt";

/**
 * G'S LOCKED PRODUCT-PRICE RULE. 6 may quote the custom avatar and the full
 * build, but only with their approved payment splits.
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
 */
const ALLOWED = new Set([
  "$5,000", "$5000", "$2,000", "$2000", "$1,000", "$1000",
  "$3,000", "$3000", "$1,200", "$1200", "$600",
]);

function dollarFigures(text: string): string[] {
  // Commas and decimals only count when digits follow, so a figure that ends a
  // clause ("...costs $5,000, plus...") is not read as some other number.
  const re = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?|\$\s?\d+(?:\.\d+)?/g;
  return (text.match(re) ?? []).map((m) => m.replace(/\s/g, ""));
}

describe("6 quotes only locked product prices", () => {
  it("names no dollar figure outside the two products and their payment splits", () => {
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
    expect(SIX_SYSTEM_PROMPT.toLowerCase()).toContain("avatar usage");
  });

  it("still says talking to 6 is free", () => {
    // Wording changed when the future monthly fee came out; the SUBSTANCE is
    // what this guards, so it asserts the promise, not a phrase that moved.
    expect(SIX_SYSTEM_PROMPT).toContain("Talking to you costs nothing");
  });

  it("the shipped brain matches its source file", () => {
    // sixSystemPrompt.ts is generated. If somebody hand-edits the .ts, the next
    // regeneration silently throws their change away - so drift between the two
    // is a real defect, not tidiness.
    const source = readFileSync(SOURCE, "utf8").replace(/\r\n/g, "\n");
    expect(SIX_SYSTEM_PROMPT).toBe(source);
  });
});

describe("there is no subscription, anywhere, in anything 6 says", () => {
  /**
   * G, 2026-08-21: "There is no more subscription. Anywhere on the site,
   * anywhere in six's lingo, anything he says, anything... A hundred percent of
   * everything that he says or is written about it needs to come out. That's
   * for the future now, with this scoped rebuild, this true MVP."
   *
   * It was worse than untidy. The ownership guarantee read "if you pay at least
   * the minimum subscription, anything you build here is yours" - which made
   * owning your own work conditional on a product that does not exist.
   */

  it("never says aiASAP charges a subscription", () => {
    // G drew the line 2026-08-21, and it is not the WORD:
    //
    //   "The old lingo for a subscription needs to be removed. But whatever
    //    subscription is a part of doing their own business, that's a
    //    distinction."
    //
    // A client pays for hosting, email, the avatar. Those are real monthly
    // bills of running THEIR business and 6 must be able to say so in plain
    // words. Banning the word outright would gag him on a cost he is
    // REQUIRED to disclose - the opposite of what this file protects.
    //
    // So this bans aiASAP billing THEM, and nothing else.
    for (const dead of [
      "minimum subscription",
      "subscription fee",
      "paid subscriber",
      "subscribe to aiasap",
      "your subscription",
    ]) {
      expect(SIX_SYSTEM_PROMPT.toLowerCase()).not.toContain(dead);
    }
  });

  it("never describes the SHAPE of one either", () => {
    // Removing the word while keeping tiers and upgrades would still be
    // promising a product nobody can buy.
    // "billing ladder" is deliberately NOT in this list. The brain uses that
    // exact phrase to FORBID one - "never mention a fee, a plan, a tier, an
    // upgrade, a billing ladder" - and a substring check cannot tell a ban from
    // an offer. Banning the word would force the instruction to be vaguer,
    // which is worse than the thing this test protects against.
    for (const shape of [
      "free tier",
      "paid tier",
      "paid user",
      "usage tier",
      "minimum fee",
    ]) {
      expect(SIX_SYSTEM_PROMPT.toLowerCase()).not.toContain(shape);
    }
  });

  it("gives paid-project Your Rights through a written assignment", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("## YOUR RIGHTS - PAID CUSTOM DELIVERABLE OWNERSHIP");
    expect(SIX_SYSTEM_PROMPT).toContain("Everything you pay for is yours");
    expect(SIX_SYSTEM_PROMPT).toContain("project or project phase is completed and paid for");
    expect(SIX_SYSTEM_PROMPT).toContain("springing written assignment vests only when aiASAP completes the agreed services");
    expect(SIX_SYSTEM_PROMPT).toContain("keeps no ownership, royalties, equity, profit share");
    expect(SIX_SYSTEM_PROMPT).toContain("payment, file delivery, or the customer's click by itself automatically transfers");
    expect(SIX_SYSTEM_PROMPT).not.toContain("Never attach a payment condition to this");
  });

  it("STILL discloses the build's running costs", () => {
    // The one thing that must NOT be swept away with it. Hosting and avatar
    // time are real bills a client pays, and a person who finds out later feels
    // tricked. Deleting a price is fine; hiding a cost is not.
    expect(SIX_SYSTEM_PROMPT).toContain("running costs");
    expect(SIX_SYSTEM_PROMPT).toContain("avatar usage, website hosting");
  });
});
