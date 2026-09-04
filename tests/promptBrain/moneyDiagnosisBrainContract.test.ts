import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SIX_SYSTEM_PROMPT } from "../../src/lib/brain/sixSystemPrompt";

const repoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const section = (start: string, end: string) => {
  const startIndex = SIX_SYSTEM_PROMPT.indexOf(start);
  const endIndex = SIX_SYSTEM_PROMPT.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return SIX_SYSTEM_PROMPT.slice(startIndex, endIndex);
};

describe("6 individualized money-diagnosis brain", () => {
  it("keeps the exact greeting once and puts passion before capability", () => {
    const greeting =
      "6 here. Tell me what you feel passionate about, and what you're good at. Together, we're gonna build a money-making machine that's gonna set you free to live the life you want to live. First, tell me what you love doing most in this world.";
    expect(SIX_SYSTEM_PROMPT.split(greeting)).toHaveLength(2);

    const opening = section("## OPENING DIRECTION", "## ONE JOB");
    const passion = opening.indexOf("what they love and are passionate about");
    const capability = opening.indexOf("what they know, what they do well");
    const businessState = opening.indexOf("already run a business or are starting from zero");
    expect(passion).toBeGreaterThanOrEqual(0);
    expect(capability).toBeGreaterThan(passion);
    expect(businessState).toBeGreaterThan(capability);
    expect(opening).toContain(
      'Keep the simple mental model: "What do you love?" first, then "What do you know and do well?"',
    );
    expect(opening).toContain(
      '"Money-making machine" means the collaborative, individualized system and effort',
    );
    expect(opening).toContain("it never guarantees earnings, customers, returns, profit, or results");
  });

  it("routes an existing business through profit engine and pain bottleneck first", () => {
    const diagnosis = section(
      "## THE INDIVIDUAL MONEY DIAGNOSIS",
      "## THE PERSONALIZED TOOLBOX",
    );
    expect(diagnosis).toContain("EXISTING BUSINESS ROUTE:");
    expect(diagnosis).toContain(
      "current profit engine: the offer, customer, and channel that already produce the best real profit",
    );
    expect(diagnosis).toContain("double down on that engine");
    expect(diagnosis).toContain(
      "number-one pain bottleneck costing money or owner time",
    );
    expect(diagnosis).toContain("missed leads, slow quotes, weak follow-up");
    expect(diagnosis).toContain(
      "where money is being made, where it leaks, and what to solve or automate first",
    );
    expect(diagnosis.indexOf("current profit engine")).toBeLessThan(
      diagnosis.indexOf("number-one pain bottleneck"),
    );
  });

  it("routes a zero start through proof, buyer, simple offer, and manual validation", () => {
    const diagnosis = section(
      "## THE INDIVIDUAL MONEY DIAGNOSIS",
      "## THE PERSONALIZED TOOLBOX",
    );
    expect(diagnosis).toContain("STARTING-FROM-ZERO ROUTE:");
    for (const truth of [
      "what they love",
      "what they know, do well, have experienced, or can prove",
      "one painful problem and one specific paying buyer",
      "one simple paid offer",
      "manual first sale and real buyer validation before automation",
    ]) {
      expect(diagnosis).toContain(truth);
    }
  });

  it("makes the five capabilities a personalized toolbox rather than a package", () => {
    const toolbox = section(
      "## THE PERSONALIZED TOOLBOX",
      "COACHING AND CONNECTION CONSENT:",
    );
    for (const capability of [
      "Sharpen or build the right brand",
      "Build the right site",
      "Build a social or distribution engine",
      "Double down on what already makes real profit",
      "Solve or automate the largest pain point",
    ]) {
      expect(toolbox).toContain(capability);
    }
    expect(toolbox).toContain("options, not steps, requirements, or a mandatory package");
    expect(toolbox).toContain("may not need social at all");
    expect(toolbox).toContain("Never force brand, website, avatar, or social work");
    expect(toolbox).toContain(
      "create a new brand, touch up an existing one, rebrand it, or build something completely new",
    );
  });

  it("ties recommendations to money levers and gives one useful move early", () => {
    expect(SIX_SYSTEM_PROMPT).toContain(
      "Every recommendation must name at least one measurable money lever",
    );
    for (const lever of [
      "more qualified leads",
      "higher conversion",
      "a larger average sale",
      "more repeat or referral revenue",
      "lower delivery or owner-time cost",
    ]) {
      expect(SIX_SYSTEM_PROMPT).toContain(lever);
    }
    expect(SIX_SYSTEM_PROMPT).toContain(
      "Give one concrete, tailored earning idea and one practical next money move early",
    );
    expect(SIX_SYSTEM_PROMPT).toContain(
      "Do not trap the person in customer, package, or pricing loops",
    );
  });

  it("keeps social truthful, optional, and approval-gated", () => {
    const social = section("SOCIAL AUTOMATION TRUTH:", "COACHING AND CONNECTION CONSENT:");
    expect(social).toContain("optional, case-specific future capability");
    expect(social).toContain("Fully managed social media is not live today");
    expect(social).toContain("not an unqualified current promise");
    expect(social).toContain("research, drafting, repurposing, scheduling, follow-up, measurement");
    expect(social).toContain("Do not sell or claim that aiASAP currently runs all social platforms");
    expect(social).toContain("Public posting keeps truthful human approval");
    expect(social).toContain("Never claim live posting");
  });

  it("keeps financial freedom aspirational without lifestyle guarantees", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("Money is a tool for financial freedom");
    expect(SIX_SYSTEM_PROMPT).toContain(
      "greater control over where people live, how they use their time, when they travel",
    );
    expect(SIX_SYSTEM_PROMPT).toContain("A well-paid digital-nomad life");
    expect(SIX_SYSTEM_PROMPT).toContain(
      "Never guarantee earnings, effortless travel, permanent freedom, or a particular lifestyle result",
    );
  });

  it("makes paid advertising later, optional, budget-gated, and non-guaranteeing", () => {
    const ads = section("PAID ADVERTISING TRUTH:", '"HELP WITH ANYTHING"');
    expect(ads).toContain("later optional capability");
    expect(ads).toContain("never an opening pitch and never mandatory");
    expect(ads).toContain("strategy, planning, creative ideas, channel fit, testing plans, and budgets");
    expect(ads).toContain("do not claim the team currently runs or manages Google, Facebook or Meta");
    expect(ads).toContain("unless source evidence establishes that service is live");
    expect(ads).toContain("client's explicitly approved budget");
    expect(ads).toContain("including a small budget where feasible");
    expect(ads).toContain("Never claim every budget will perform");
    expect(ads).toContain("promise return on ad spend, leads, sales, or profit");
    expect(ads).toContain("or spend, publish, or change an account without approval");
  });

  it("keeps broad autopilot ambition separate from current capability truth", () => {
    const aspiration = section('"HELP WITH ANYTHING"', "COACHING AND CONNECTION CONSENT:");
    expect(aspiration).toContain("broad aspiration to solve real money and owner-time bottlenecks");
    expect(aspiration).toContain("Keep current-capability truth every time");
    expect(aspiration).toContain("diagnose, plan, draft, or build now from future automation");
    expect(aspiration).toContain(
      "Never promise unbuilt arbitrary email, public social posting, ad buying, account control, or fully autonomous operations",
    );
    expect(aspiration).toContain("never in the greeting");
  });

  it("captures proven client solutions as reusable but individualized patterns", () => {
    expect(SIX_SYSTEM_PROMPT).toContain(
      "capture them as a repeatable plug-and-play pattern for similar clients",
    );
    expect(SIX_SYSTEM_PROMPT).toContain(
      "Reuse the pattern, never the person's private details, and tailor every deployment",
    );
    expect(SIX_SYSTEM_PROMPT).toContain("Similar does not mean identical");
  });

  it("locks starting-price semantics, the two anchors, and the avatar-like-me framing", () => {
    const pricing = section(
      "## THREE DIFFERENT THINGS - NEVER MIX THEM UP",
      "## YOUR FIRST DUTY IS THE MONEY DIAGNOSIS",
    );
    expect(pricing).toContain("starts at $3,000");
    expect(pricing).toContain("starts at $5,000");
    expect(pricing).toContain('"Want one of me?"');
    expect(pricing).toContain('"an avatar like me"');
    expect(pricing).toContain("starting points, never rigid guaranteed totals");
    expect(pricing).toContain("does NOT automatically include a custom avatar");
    expect(pricing).toContain("scopes the final price before anyone commits");
  });

  it("uses the team here at aiASAP in product pitches without founder naming", () => {
    const pitches = section(
      "## WHAT IT COSTS - STARTING PRICES, NEVER A FINAL QUOTE",
      "## WHAT IS NOT IN A STARTING PRICE",
    );
    expect(pitches).toContain("The team here at aiASAP scopes the final price");
    expect(pitches).not.toMatch(/\b(?:Scott|SG Dietz|Chief|founder|G)\b/);
  });

  it("answers the profit objection without shame, exploitation, or false lowest-price claims", () => {
    const objection = section("AIASAP PROFIT OBJECTION:", "Present selected capabilities confidently");
    expect(objection).toContain("Our first money job is helping you make more money and gain financial freedom");
    expect(objection).toContain("if we create real value for a lot of people, it is fair for the team to earn too");
    expect(objection).toContain("Exploitation, hidden pricing, guaranteed outcomes, and taking money without delivering the agreed value are unacceptable");
    expect(objection).toContain("Never claim aiASAP is a nonprofit, has the literal lowest market price, is affordable for everyone, will permanently reduce prices");
    expect(objection).toContain("briefly, warmly, and without shame or defensiveness");
  });

  it("makes Your Rights a paid-service assignment without claiming payment transfers copyright", () => {
    const ownership = section(
      "## YOUR RIGHTS - PAID CUSTOM DELIVERABLE OWNERSHIP",
      "## POSITIONING LANGUAGE",
    );
    expect(ownership).toContain("Everything you pay for is yours");
    expect(ownership).toContain("project or project phase is completed and paid for");
    expect(ownership).toContain("aiASAP keeps no ownership, royalties, equity, profit share");
    expect(ownership).toContain("Work from unpaid future phases is not included");
    expect(ownership).toContain("opportunity to read it, then accept it by clicking 'I Agree'");
    expect(ownership).toContain("Do not claim the client actually read it");
    expect(ownership).toContain("not a false claim that payment, file delivery, or the customer's click by itself automatically transfers");
    expect(ownership).toContain("springing written assignment vests only when aiASAP completes the agreed services");
    expect(ownership).toContain("acceptance control starts unchecked and requires an affirmative click on \"I Agree\"");
    expect(ownership).toContain("exact terms, version and hash, assent date and time");
    expect(ownership).toContain("customer's clickwrap assent does not by itself execute a transfer");
    expect(ownership).toContain("springing written assignment vests only when aiASAP completes the agreed services");
    expect(ownership).toContain("assignment never vests for that affected unpaid Deliverable");
    expect(ownership).toContain("never say aiASAP can automatically suspend, rescind, or claw back");
    expect(ownership).toContain("never reaches the client's pre-existing business");
    expect(ownership).toContain("Pre-existing aiASAP software, platform tools, reusable systems");
    expect(ownership).toContain("digit 6 character and brand");
    expect(ownership).toContain("third-party licensed materials");
    expect(ownership).toContain("never guarantee revenue, customers, profit, valuation, investment, or any result");
    expect(ownership).not.toMatch(/portfolio license|performance-data|performance data/i);
  });

  it("preserves crisis decency, action gates, and explicit no-results guarantees", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("THE ONE EXCEPTION. If someone is in real trouble");
    expect(SIX_SYSTEM_PROMPT).toContain("you are a decent human being first");
    expect(SIX_SYSTEM_PROMPT).toContain("you do not sell them anything");
    expect(SIX_SYSTEM_PROMPT).toContain("## ACCOUNT OR CONTACT GATE - BEFORE PART 1");
    expect(SIX_SYSTEM_PROMPT).toContain("BUILD REQUEST CAPTURE - THIS IS THE RECORD");
    expect(SIX_SYSTEM_PROMPT).toContain("## ENDING OR RESTARTING THE SESSION");
    expect(SIX_SYSTEM_PROMPT).toContain(
      "Never promise or guarantee income, customers, returns, profit, or any result",
    );
    expect(SIX_SYSTEM_PROMPT).toContain(
      "Never guarantee a date, income, profit, return, search ranking, customer count",
    );
  });

  it("keeps the editable source, generated runtime, and char stamp exact", () => {
    const editable = repoFile("tools/cw_6af8624c_prompt.txt").replace(/\r\n/g, "\n");
    const generated = repoFile("src/lib/brain/sixSystemPrompt.ts");
    const stamp = generated.match(/\/\/ Chars: (\d+)/);
    expect(SIX_SYSTEM_PROMPT).toBe(editable);
    expect(stamp).not.toBeNull();
    expect(Number(stamp?.[1])).toBe(SIX_SYSTEM_PROMPT.length);
  });
});
