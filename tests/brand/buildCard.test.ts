import { describe, expect, it } from "vitest";
import {
  BUILD_CARD_BANNED,
  BUILD_CARD_MAX_QUOTES,
  BUILD_CARD_MAX_WORDS,
  BUILD_CARD_SECTIONS,
  buildCardPrompt,
  checkBuildCard,
} from "../../src/lib/buildCard";

/**
 * These caps are not style. They are what makes a promise true.
 *
 * 6 tells people a human will not read their words, only a short summary. That
 * only holds if the summary is genuinely usable on its own — Ara's point was
 * that a card which grew into a memo sends G back to the raw transcript, and
 * then the promise is a lie that looks kept. So a card over the cap has to FAIL
 * loudly rather than quietly become a memo.
 */

const good = BUILD_CARD_SECTIONS.map((s) => `${s}: something short. SAID`).join("\n");

describe("build card caps", () => {
  it("accepts a card that has every section and stays small", () => {
    const r = checkBuildCard(good);
    expect(r.ok).toBe(true);
    expect(r.problems).toEqual([]);
  });

  it("fails a card that quietly became a memo", () => {
    const memo = `${good}\n${"filler ".repeat(BUILD_CARD_MAX_WORDS + 50)}`;
    const r = checkBuildCard(memo);
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("over the");
  });

  it("fails when somebody is quoting the transcript instead of summarising", () => {
    const many = `${good}\n` + Array.from({ length: BUILD_CARD_MAX_QUOTES + 3 }, (_, i) => `"quote number ${i}"`).join(" ");
    const r = checkBuildCard(many);
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("quotes");
  });

  it("fails one over-long quote even when the count is fine", () => {
    const long = `${good}\n"${"word ".repeat(40)}"`;
    const r = checkBuildCard(long);
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("quote runs");
  });

  it("does not charge quoted words against the prose budget twice", () => {
    // A card doing exactly what we asked - real quotes in their own words -
    // must not be punished for it and pushed over the cap.
    const withQuotes = `${good}\n` + Array.from({ length: BUILD_CARD_MAX_QUOTES }, () => `"I mow the rich folks ditches"`).join(" ");
    const r = checkBuildCard(withQuotes);
    expect(r.quotes).toBe(BUILD_CARD_MAX_QUOTES);
    expect(r.ok).toBe(true);
  });

  it("notices a missing section rather than accepting a half card", () => {
    const short = "WHO: Dana. SAID\nLOVE: fixing old mowers. SAID";
    const r = checkBuildCard(short);
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("missing section");
  });
});

describe("build card prompt", () => {
  const p = buildCardPrompt();

  it("names every section in order", () => {
    let last = -1;
    for (const s of BUILD_CARD_SECTIONS) {
      const at = p.indexOf(s);
      expect(at).toBeGreaterThan(last);
      last = at;
    }
  });

  it("bans the car-vent categories by name", () => {
    // These leak precisely because somebody says them in the same breath as the
    // real work. A general "be tactful" does not hold; naming them does.
    for (const b of BUILD_CARD_BANNED) {
      expect(p).toContain(b);
    }
  });

  it("demands SAID / GUESSED / MISSING so a guess cannot read as a fact", () => {
    // A hallucinated fact that reads like a quote is how somebody's real
    // business ends up described wrongly on their own public page.
    expect(p).toContain("SAID");
    expect(p).toContain("GUESSED");
    expect(p).toContain("MISSING");
    expect(p).toContain("Never let a guess read like a fact");
  });

  it("tells the model to obey a do-not-publish instruction", () => {
    expect(p.toLowerCase()).toContain("do not put that on the site");
  });

  it("carries the numeric caps rather than vague advice", () => {
    expect(p).toContain(String(BUILD_CARD_MAX_WORDS));
    expect(p).toContain(String(BUILD_CARD_MAX_QUOTES));
  });
});
