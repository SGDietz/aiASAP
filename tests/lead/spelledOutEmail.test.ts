import { describe, expect, it } from "vitest";
import {
  extractFollowUpEmail,
  collapseSpelledRuns,
} from "../../src/lib/buildInterestFlow";

/**
 * 6's setup script says, word for word: "What's your email? Spell it slowly,
 * one letter at a time."
 *
 * When the visitor did exactly that, the transcript arrived as single
 * characters and `extractFollowUpEmail` returned NULL. The one format 6 asks
 * for was the one format the app could not read.
 *
 * Found 2026-09-04 while checking whether aiASAP shares the truncated-address
 * problem seen in WildWorks' iscott_leads (etz@pm.me, sgd@pm.me - G's address
 * with the front chewed off). Related:
 * tests/lead/nameAskTiming.test.ts, and CLAUDE.md #1.9 "fix it in the other
 * sites too" is what prompted the check.
 */
describe("an email spelled out loud is still an email", () => {
  it("reads letters separated by spaces", () => {
    expect(extractFollowUpEmail("s g d i e t z at p m dot m e")).toBe(
      "sgdietz@pm.me",
    );
  });

  it("reads G's locked dashed style", () => {
    // "a-i-ASAP", "S-G-D-I-E-T-Z" - dashes are how he spells things aloud.
    expect(extractFollowUpEmail("s-g-d-i-e-t-z at p-m dot m-e")).toBe(
      "sgdietz@pm.me",
    );
  });

  it("does NOT wreck a genuinely hyphenated address", () => {
    // The guard: only runs where EVERY segment is one character collapse.
    expect(extractFollowUpEmail("mary-jane@example.com")).toBe(
      "mary-jane@example.com",
    );
    expect(extractFollowUpEmail("reach me at mary-jane at example dot com")).toBe(
      "mary-jane@example.com",
    );
  });

  it("leaves an address typed normally exactly as it is", () => {
    expect(extractFollowUpEmail("sgdietz@pm.me")).toBe("sgdietz@pm.me");
    expect(extractFollowUpEmail("my email is sgdietz at pm dot me")).toBe(
      "sgdietz@pm.me",
    );
  });

  it("still trims a sentence that runs past the address", () => {
    expect(extractFollowUpEmail("sgdietz at pm dot me so we can talk")).toBe(
      "sgdietz@pm.me",
    );
  });

  it("collapses only runs of two or more single characters", () => {
    expect(collapseSpelledRuns("s g d")).toBe("sgd");
    expect(collapseSpelledRuns("a b")).toBe("ab");
    // a lone character is not a run and must not glue onto the next word
    expect(collapseSpelledRuns("i love building")).toBe("i love building");
    expect(collapseSpelledRuns("mary-jane")).toBe("mary-jane");
  });

  it("cannot invent letters the transcript never had", () => {
    // A genuinely truncated capture stays truncated - that is honest. The
    // defence against it is the confirmation step, not guesswork here.
    expect(extractFollowUpEmail("etz at pm dot me")).toBe("etz@pm.me");
  });
});
