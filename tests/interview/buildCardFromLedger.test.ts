import { describe, expect, it } from "vitest";
import { newLedger, putBeats } from "../../src/lib/interview/ledger";
import { renderLedgerForCard } from "../../src/lib/interview/buildCardFromLedger";
import { checkBuildCard, BUILD_CARD_SECTIONS } from "../../src/lib/buildCard";

/**
 * What the summariser is shown decides what ends up on somebody's public page.
 * These guard the two ways that goes wrong quietly: a guess arriving without
 * its label, and a gap arriving as a blank the model feels invited to fill.
 */

describe("renderLedgerForCard", () => {
  it("carries the confidence label on every answer", () => {
    // A guess that reads like a fact is how a business gets described wrongly
    // on its own website. The tag is the only thing standing in the way.
    const l = newLedger(1000);
    putBeats(l, 5, "offer", ["I fix small engines"], 1000, "SAID");
    putBeats(l, 8, "feel_good_number", ["about six grand"], 1000, "GUESSED");

    const out = renderLedgerForCard(l);
    expect(out).toContain("offer [SAID]");
    expect(out).toContain("feel_good_number [GUESSED]");
  });

  it("says MISSING out loud instead of leaving a blank", () => {
    // A blank section invites the model to invent one. The word does not.
    const l = newLedger(1000);
    putBeats(l, 1, "name", ["Dale"], 1000);
    const out = renderLedgerForCard(l);
    expect(out).toContain("MISSING - they never answered this.");
  });

  it("breaks a list answer back into separate items", () => {
    const l = newLedger(1000);
    putBeats(l, 2, "yesterday_beats", ["fed the horses", "fixed the gate"], 1000);
    const out = renderLedgerForCard(l);
    expect(out).toContain("- fed the horses");
    expect(out).toContain("- fixed the gate");
    // The storage separator must never leak into what the model reads.
    expect(out).not.toContain("fed the horses|fixed the gate");
  });

  it("states a refusal to be published as an instruction, not a silence", () => {
    const l = newLedger(1000);
    l.publishOk = false;
    const out = renderLedgerForCard(l);
    expect(out).toContain("did NOT agree");
    expect(out).toContain("DO-NOT-CALL");
  });

  it("says so plainly when they DID agree", () => {
    const out = renderLedgerForCard(newLedger(1000));
    expect(out).toContain("they agreed");
    expect(out).not.toContain("did NOT agree");
  });
});

describe("the card tripwire actually catches a memo", () => {
  it("fails a card that is over the word cap", () => {
    const bloated =
      BUILD_CARD_SECTIONS.join("\n") + "\n" + "word ".repeat(400);
    const check = checkBuildCard(bloated);
    expect(check.ok).toBe(false);
    expect(check.problems.join(" ")).toContain("over the 350");
  });

  it("fails a card that dropped a section", () => {
    const missing = BUILD_CARD_SECTIONS.slice(0, -1).join("\n");
    const check = checkBuildCard(missing);
    expect(check.ok).toBe(false);
    expect(check.problems.join(" ")).toContain("BUILD NOTES");
  });

  it("passes a card that keeps to the shape", () => {
    const good = BUILD_CARD_SECTIONS.map((s) => `${s}: short line here.`).join("\n");
    expect(checkBuildCard(good).ok).toBe(true);
  });
});
