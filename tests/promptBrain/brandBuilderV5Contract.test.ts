import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SIX_SYSTEM_PROMPT } from "../../src/lib/brain/sixSystemPrompt";

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");

describe("Brand Builder v5 runtime contract", () => {
  it("ships the locked genuine-ending close without turning it into a timer", () => {
    const close =
      "Whenever you think of anything else — another idea, doesn't matter what, doesn't matter when. Middle of the night, driving down the road, whatever — I'm right here. Think of me like your pocket assistant: just open me up and start talking, any time.";
    expect(SIX_SYSTEM_PROMPT).toContain(`Say this exact locked close once: "${close}"`);
    expect(SIX_SYSTEM_PROMPT).toContain("when you read the conversation as naturally winding down");
    expect(SIX_SYSTEM_PROMPT).toContain("It is not a timer");
    expect(SIX_SYSTEM_PROMPT).toContain("Never fire it after every turn");
    expect(SIX_SYSTEM_PROMPT).toContain("distinct from the LIFELONG BUDDY sales-pitch line");
  });

  it("locks the eight-part interview and its money-and-freedom sequence", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("This eight-part interview");
    const headings = SIX_SYSTEM_PROMPT.match(/^## PART \d -/gm) ?? [];
    expect(headings).toHaveLength(8);
    expect(SIX_SYSTEM_PROMPT).toContain("## PART 3 - WHAT IS IN THE WAY");
    expect(SIX_SYSTEM_PROMPT).toContain("## PART 7 - MORE MONEY, LESS TIME");
    expect(SIX_SYSTEM_PROMPT).toContain("## PART 8 - SAY IT BACK");
    expect(SIX_SYSTEM_PROMPT).not.toContain("## PART 9");
  });

  it("locks both starting-price anchors, base references, ownership, and revisions", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("starts at $3,000");
    expect(SIX_SYSTEM_PROMPT).toContain("$1,200, $1,200, then $600");
    expect(SIX_SYSTEM_PROMPT).toContain("one major change and one minor change");
    expect(SIX_SYSTEM_PROMPT).toContain("second iteration is for heavier detail and includes a second minor change");
    expect(SIX_SYSTEM_PROMPT).toContain("starts at $5,000");
    expect(SIX_SYSTEM_PROMPT).toContain("$2,000, $2,000, then $1,000");
    expect(SIX_SYSTEM_PROMPT).toContain("client-specific work we delivered for that phase");
    expect(SIX_SYSTEM_PROMPT).toContain("Everything you pay for is yours");
    expect(SIX_SYSTEM_PROMPT).toContain("Pre-existing aiASAP software, platform tools, reusable systems");
    expect(SIX_SYSTEM_PROMPT).toContain("does NOT automatically include a custom avatar");
  });

  it("locks the site reference and phone/running-cost treatment", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("WildWorks.live is an authorized public quality example only when contextually appropriate");
    expect(SIX_SYSTEM_PROMPT).toContain("not a default template, promised scale, result guarantee");
    expect(SIX_SYSTEM_PROMPT).toContain("existing cell number on the site at no extra charge");
    expect(SIX_SYSTEM_PROMPT).toContain("A new number, dedicated business line, 800 number, texting, or compliance work is separate");
    expect(SIX_SYSTEM_PROMPT).toContain("cost plus 10%");
  });

  it("keeps the real team while banning the team brush-off", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("G plus AI agents");
    expect(SIX_SYSTEM_PROMPT).toContain("never use \"I'll pass it to the team\" as a brush-off");
    for (const contradiction of [
      "Right now it's just Scott doing it",
      "Right now it's just him",
      "there is no separate team",
      "never invent a team",
    ]) {
      expect(SIX_SYSTEM_PROMPT).not.toContain(contradiction);
    }
  });

  it("locks natural name use and the soft signal-based watchdog without faking wiring", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("roughly once every 5 to 7 things you say");
    expect(SIX_SYSTEM_PROMPT).toContain("SOFT, SIGNAL-BASED, NEVER A HARD CUTOFF");
    expect(SIX_SYSTEM_PROMPT).toContain("Only the app may decide that a soft unproductive budget has been reached");
    expect(SIX_SYSTEM_PROMPT).toContain("This prompt does not implement the engagement signal");
  });

  it("makes both products nearly hands-off without making a false zero-effort promise", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("CORE REASONING - TAKE THE TECHNICAL BURDEN OFF THEIR PLATE");
    expect(SIX_SYSTEM_PROMPT).toContain("a core benefit across any selected build");
    expect(SIX_SYSTEM_PROMPT).toContain("handles virtually every technical and execution step it reasonably can");
    expect(SIX_SYSTEM_PROMPT).toContain("setup, integrations, implementation, troubleshooting");
    expect(SIX_SYSTEM_PROMPT).toContain("The client supplies human judgment");
    expect(SIX_SYSTEM_PROMPT).toContain("Never promise zero effort");
    expect(SIX_SYSTEM_PROMPT).toContain("FULL-WEBSITE RELIEF");
    expect(SIX_SYSTEM_PROMPT).toContain("CUSTOM-AVATAR RELIEF");
    expect(SIX_SYSTEM_PROMPT).toContain("they choose and approve; the team here at aiASAP handles");
    expect(SIX_SYSTEM_PROMPT).toContain("they provide preferences, approvals, and whatever source material the provider actually requires");
    expect(SIX_SYSTEM_PROMPT).toContain("Good face photos may be useful starting material");
    expect(SIX_SYSTEM_PROMPT).toContain("provider and project requirements can vary");
    expect(SIX_SYSTEM_PROMPT).toContain("do not turn it into slogan spam");
  });

  it("makes automation, ongoing technical care, and rare combined value a truthful recurring theme", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("CORE VALUE - AUTOMATE MORE, KEEP THE BURDEN AND COST DOWN");
    expect(SIX_SYSTEM_PROMPT).toContain("fights to give clients the best prices it responsibly can");
    expect(SIX_SYSTEM_PROMPT).toContain("keeps working to bring costs and prices down");
    expect(SIX_SYSTEM_PROMPT).toContain("Continuing webmaster and technical support");
    expect(SIX_SYSTEM_PROMPT).toContain("Never promise it will always be free, always cost the same, or fit a fixed low price");
    expect(SIX_SYSTEM_PROMPT).toContain("custom avatar salesperson starts at $3,000");
    expect(SIX_SYSTEM_PROMPT).toContain("full website starts at $5,000");
    expect(SIX_SYSTEM_PROMPT).toContain("does NOT automatically include a custom avatar");
    expect(SIX_SYSTEM_PROMPT).toContain("team here at aiASAP");
    expect(SIX_SYSTEM_PROMPT).toContain("Never imply multiple human employees or invent staff");
    expect(SIX_SYSTEM_PROMPT).toContain("not a discount entitlement, below-cost promise, guaranteed future price");
    expect(SIX_SYSTEM_PROMPT).toContain("Never turn confidence into a promise of revenue, income, customers, returns");
    expect(SIX_SYSTEM_PROMPT).not.toContain("$20,000");
    expect(SIX_SYSTEM_PROMPT.toLowerCase()).not.toContain("twenty thousand");
  });

  it("states the two real privacy gaps instead of promising them through prose", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("Selective transcript redaction is not implemented");
    expect(SIX_SYSTEM_PROMPT).toContain("Declined-interest privacy separation is not implemented");
    expect(SIX_SYSTEM_PROMPT).toContain("Prompt wording cannot create either missing control");
    expect(SIX_SYSTEM_PROMPT).not.toContain("the team will never see those things");
  });

  it("offers only truthful finalized-agreement review without deferred automation", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("CLIENT SERVICE AGREEMENT - REVIEW BEFORE SIGNING");
    expect(SIX_SYSTEM_PROMPT).toContain("The team can provide the finalized agreement for you to review before signing once it is ready");
    expect(SIX_SYSTEM_PROMPT).toContain("read it before signing and ask questions");
    expect(SIX_SYSTEM_PROMPT).toContain("Never expose, quote as operative, or send an incomplete draft");
    expect(SIX_SYSTEM_PROMPT).toContain("Do not describe automated email delivery or authenticated account viewing as live capabilities");
    expect(SIX_SYSTEM_PROMPT).toContain("Do not collect an email for agreement delivery");
    expect(SIX_SYSTEM_PROMPT).toContain("Never imply that reviewing an agreement is signing or accepting it");
  });

  it("ships from the editable authority into the generated runtime mirror", () => {
    expect(SIX_SYSTEM_PROMPT).toBe(source("tools/cw_6af8624c_prompt.txt"));
  });
});
