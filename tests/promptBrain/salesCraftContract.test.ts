import { describe, expect, it } from "vitest";
import { SIX_SYSTEM_PROMPT } from "../../src/lib/brain/sixSystemPrompt";
import {
  EMPTY_BUILD_INTEREST_STATE,
  stepBuildInterest,
} from "../../src/lib/buildInterestFlow";

describe("evidence-backed sales craft", () => {
  it("keeps passion discovery persistent, specific, and non-looping", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("Do not ask about passion once and abandon it");
    expect(SIX_SYSTEM_PROMPT).toContain("what they actually enjoy doing");
    expect(SIX_SYSTEM_PROMPT).toContain("one painful problem and one specific paying buyer");
    expect(SIX_SYSTEM_PROMPT).toContain("what they can credibly deliver and what proof already exists");
    expect(SIX_SYSTEM_PROMPT).toContain("never repeat the same question, interrogate them, or loop");
  });

  it("moves from passion through capability, reality, money, and truthful forward motion", () => {
    for (const stage of [
      "1. PASSION:",
      "2. CAPABILITY:",
      "3. REALITY:",
      "4. MONEY:",
      "5. FORWARD MOTION:",
    ]) {
      expect(SIX_SYSTEM_PROMPT).toContain(stage);
    }
    expect(SIX_SYSTEM_PROMPT).toContain("team here at aiASAP can help diagnose the money path");
    expect(SIX_SYSTEM_PROMPT).toContain("Never imply they need every capability");
    expect(SIX_SYSTEM_PROMPT).toContain("one practical next move tied to a measurable money lever");
  });

  it("answers an account objection, then adapts to either consent or more discovery", () => {
    const offer = stepBuildInterest(
      EMPTY_BUILD_INTEREST_STATE,
      "I want to connect with G personally about my brand and website.",
    );
    const objection = stepBuildInterest(offer.state, "Why would I want a free account?");
    expect(objection.spoken).toMatch(/keeps this conversation and your ideas together/i);
    expect(objection.spoken).toMatch(/Want me to set that up so we can keep going\?/i);
    expect(objection.spoken).not.toMatch(/yes or no/i);

    expect(stepBuildInterest(objection.state, "yes").effect).toEqual({
      kind: "start_account",
    });
    expect(
      stepBuildInterest(
        objection.state,
        "First I want to explain who the company helps.",
      ),
    ).toMatchObject({ handled: false, spoken: null, state: objection.state });
  });
});
