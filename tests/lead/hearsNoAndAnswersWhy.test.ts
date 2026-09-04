import { describe, expect, it } from "vitest";
import { stepBuildInterest, type BuildInterestState } from "../../src/lib/buildInterestFlow";

/**
 * G's ride, 2026-09-04 12:42-12:44. 6 had hijacked himself into asking for an
 * email (see tests/lead/callMeNamingNotCapture.test.ts for that trigger). What
 * made it unforgivable was everything after:
 *
 *   G: "Why'd you ask for my email address?"      -> "What's your email address?"
 *   G: "Why are you asking for it?"               -> "What's your email address?"
 *   G: "I don't need you to have my email."       -> "I need a complete email."
 *
 * Two holes. NO_RE was ^-anchored so a refusal opening with "I" never matched,
 * and the refusal check only ran when method === null - so once 6 was
 * collecting an email there was no refusal path in the branch at all. And there
 * was no branch for a question, so "why?" got the demand back, four times.
 */
const capturing: BuildInterestState = {
  stage: "contact_capture",
  method: "email",
  value: null,
  sendConsent: false,
};

describe("6 hears a refusal the first time, at any stage", () => {
  it("stops on G's exact words while already collecting an email", () => {
    const step = stepBuildInterest(capturing, "I don't need you to have my email.");
    expect(step.state.stage).toBe("declined");
    expect(step.spoken).toMatch(/nothing has been submitted/i);
  });

  it("stops on the ordinary ways a person says no", () => {
    for (const line of [
      "I don't need you to have my email.",
      "I don't want to give you my email",
      "I'd rather not",
      "no thanks",
      "never mind",
      "forget it",
      "I'm not comfortable with that",
      "stop asking",
    ]) {
      const step = stepBuildInterest(capturing, line);
      expect(step.state.stage, line).toBe("declined");
    }
  });

  it("does not mistake an ordinary sentence for a refusal", () => {
    for (const line of [
      "I don't know",
      "example at pm dot me",
      "it's a strange voice you have there",
    ]) {
      expect(stepBuildInterest(capturing, line).state.stage, line).not.toBe("declined");
    }
  });
});

describe("6 answers WHY once, instead of repeating the demand", () => {
  it("answers G's exact question rather than re-asking", () => {
    const step = stepBuildInterest(capturing, "Why'd you ask for my email address?");
    expect(step.spoken).toBe(
      "So G's team can get back to you - that's all it's for. If you'd rather not, just say so.",
    );
    expect(step.spoken).not.toMatch(/what'?s your email/i);
    expect(step.state.whyAnswered).toBe(true);
  });

  it("answers each phrasing G actually used", () => {
    for (const line of [
      "Why'd you ask for my email address?",
      "Why are you asking for it?",
      "What are you asking for my email address for?",
      "why?",
    ]) {
      const step = stepBuildInterest(capturing, line);
      expect(step.spoken, line).toMatch(/that'?s all it'?s for/i);
    }
  });

  it("never explains twice", () => {
    const first = stepBuildInterest(capturing, "why are you asking for it?");
    expect(first.state.whyAnswered).toBe(true);
    const second = stepBuildInterest(first.state, "why are you asking for it?");
    expect(second.spoken).not.toMatch(/that'?s all it'?s for/i);
  });

  it("a refusal still wins over a why in the same breath", () => {
    const step = stepBuildInterest(capturing, "why? I don't need you to have my email");
    expect(step.state.stage).toBe("declined");
  });
});

/**
 * Same ride, 12:43:46-12:44:32. The send-permission question fired SIX times.
 * G asked what would happen to the address and got the identical question back.
 */
const awaitingSendPermission: BuildInterestState = {
  stage: "permission",
  method: "email",
  value: "example@pm.me",
  sendConsent: false,
};

describe("the send-permission question stops nagging", () => {
  it("answers what happens to the address instead of re-asking", () => {
    const step = stepBuildInterest(awaitingSendPermission, "So what are you going to do with that email?");
    expect(step.spoken).toBe(
      "It goes to G's team so they can follow up with you - nothing else. Is that okay?",
    );
    expect(step.state.whyAnswered).toBe(true);
  });

  it("asks at most twice, then hands the turn to the brain", () => {
    let state = awaitingSendPermission;
    const spoken: (string | null)[] = [];
    for (let i = 0; i < 4; i += 1) {
      const step = stepBuildInterest(state, "hmm");
      spoken.push(step.spoken);
      state = step.state;
    }
    // two asks, then silence from the flow so 6 can talk like a person
    expect(spoken.filter((s) => s !== null)).toHaveLength(2);
    expect(spoken[2]).toBeNull();
    expect(spoken[3]).toBeNull();
  });

  it("a yes after the cap still sends - the value is never thrown away", () => {
    let state = awaitingSendPermission;
    for (let i = 0; i < 4; i += 1) state = stepBuildInterest(state, "hmm").state;
    const yes = stepBuildInterest(state, "Yes, you can send that to the team at AI ASAP.");
    expect(yes.effect).toEqual({ kind: "save_contact", method: "email", value: "example@pm.me" });
    expect(yes.spoken).toMatch(/sending it now/i);
  });

  it("still stops dead on a no", () => {
    const step = stepBuildInterest(awaitingSendPermission, "no");
    expect(step.state.stage).toBe("declined");
    expect(step.spoken).toMatch(/nothing has been sent/i);
  });
});

/**
 * MEASURED 2026-09-04 across every recorded conversation since 08-25: eight of
 * fifty-five sessions contain a repeated assistant line, and every top offender
 * is a capture prompt.
 *
 *   +10  "I need a complete email. Say it again slowly."   <- most repeated ever
 *    +7  "Did I get that right, yes or no?"
 *    +5  "I need a complete phone number. Say the digits again."
 *
 * G's rule is that 6 never says a line twice. Two tries is a person asking
 * again; a third is a machine.
 */
describe("no capture prompt nags past twice", () => {
  it("stops re-asking for the email, and a real address after the cap still lands", () => {
    let state = capturing;
    const spoken: (string | null)[] = [];
    for (let i = 0; i < 4; i += 1) {
      const step = stepBuildInterest(state, "hmm");
      spoken.push(step.spoken);
      state = step.state;
    }
    expect(spoken.filter((s) => s !== null)).toHaveLength(2);
    expect(spoken[0]).toMatch(/complete email/i);

    // The value was never thrown away, so the flow still completes.
    const heard = stepBuildInterest(state, "example at pm dot me");
    expect(heard.state.value).toBe("example@pm.me");
  });

  it("stops re-asking the read-back, and a yes after the cap still confirms", () => {
    let state = {
      stage: "confirming" as const,
      method: "email" as const,
      value: "example@pm.me",
      sendConsent: false,
    };
    const spoken: (string | null)[] = [];
    for (let i = 0; i < 4; i += 1) {
      const step = stepBuildInterest(state, "hmm");
      spoken.push(step.spoken);
      state = step.state as typeof state;
    }
    expect(spoken.filter((s) => s !== null)).toHaveLength(2);
    expect(spoken[0]).toMatch(/did i get that right/i);

    const yes = stepBuildInterest(state, "yes, that's correct");
    expect(yes.state.stage).toBe("permission");
  });

  it("the phone wording is capped too", () => {
    let state = { ...capturing, method: "phone" as const };
    const spoken: (string | null)[] = [];
    for (let i = 0; i < 4; i += 1) {
      const step = stepBuildInterest(state, "hmm");
      spoken.push(step.spoken);
      state = step.state as typeof state;
    }
    expect(spoken[0]).toMatch(/complete phone number/i);
    expect(spoken.filter((s) => s !== null)).toHaveLength(2);
  });
});
