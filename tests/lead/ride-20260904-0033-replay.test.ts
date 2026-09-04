import { describe, expect, it } from "vitest";
import {
  EMPTY_BUILD_INTEREST_STATE,
  isSendPermissionGranted,
  stepBuildInterest,
  type BuildInterestState,
} from "../../src/lib/buildInterestFlow";

// ---------------------------------------------------------------------------
// G's ride 48c99dfa, 2026-09-04 00:33:23 - 00:35:33.
//
// The flow did everything right: hand raise, name, email, a correct spelled
// read-back, then the permission question. G answered it TWICE - "yeah you may
// send that email off" and "Yes." - and nothing sent, because both answers
// arrived on the provider transport and CUSTOM was discarding that ear
// entirely (see reference-aiasap-second-ear-backfill).
//
// Every line below is verbatim from conversation_messages for that session.
// The point of this test is that the FLOW was never the problem: give it the
// words he actually said, in the order he said them, and it completes. What
// changed on 2026-09-04 is that those words now reach it.
// ---------------------------------------------------------------------------

const EMAIL = "example@pm.me";

// [source in conversation_messages, what he said]
const RIDE: Array<[string, string]> = [
  ["app", "you have Scott reach out to me I wanted to help me build my company"],
  ["liveavatar_api_fragment", "Okay, my name is Scott and it's, uh,"],
  ["liveavatar_api", "example@pm.me"],
  // he was still spelling out loud; this is not an answer to anything
  ["app", "period"],
  // ANSWER ONE - provider only, thrown away before the fix
  ["liveavatar_api", "yeah you may send that email off"],
  // ANSWER TWO - provider only, thrown away before the fix
  ["liveavatar_api_fragment", "Yes."],
];

describe("ride 2026-09-04 00:33 - the answers that only the second ear heard", () => {
  it("both of his answers read as permission to send", () => {
    expect(isSendPermissionGranted("yeah you may send that email off")).toBe(true);
    expect(isSendPermissionGranted("Yes.")).toBe(true);
  });

  it("completes the send when the words he said actually reach the flow", () => {
    let state: BuildInterestState = EMPTY_BUILD_INTEREST_STATE;
    let saved: { method: string; value: string } | null = null;
    const spoken: string[] = [];

    for (const [, words] of RIDE) {
      const step = stepBuildInterest(state, words);
      state = step.state;
      if (step.spoken) spoken.push(step.spoken);
      if (step.effect.kind === "save_contact") {
        saved = { method: step.effect.method, value: step.effect.value };
      }
    }

    // the email he spelled, and the name he gave
    expect(state.value).toBe(EMAIL);
    expect(state.fullName).toBe("Scott");
    // it asked before sending, and only sent after a yes to that question
    expect(spoken.some((s) => /did i get that email right/i.test(s))).toBe(true);
    expect(spoken.some((s) => /can i send that/i.test(s))).toBe(true);
    expect(saved).toEqual({ method: "email", value: EMAIL });
    expect(state.packageConsent).toBe(true);
  });

  it("does NOT send if only the app-heard turns arrive - the ride as it happened", () => {
    // Same ride with the provider-only lines removed: this is what the flow
    // was actually handed that night, and it correctly refuses to send.
    let state: BuildInterestState = EMPTY_BUILD_INTEREST_STATE;
    let saved = false;
    for (const [source, words] of RIDE) {
      if (source !== "app") continue;
      const step = stepBuildInterest(state, words);
      state = step.state;
      if (step.effect.kind === "save_contact") saved = true;
    }
    expect(saved).toBe(false);
    // nothing was sent, and nothing was invented
    expect(state.packageConsent).not.toBe(true);
  });

  it("treats spelling filler as filler, not as an answer", () => {
    // "period" arrived while he was still reading the address out. It must
    // neither confirm nor cancel anything.
    const confirming: BuildInterestState = {
      stage: "confirming",
      method: "email",
      value: EMAIL,
    };
    const step = stepBuildInterest(confirming, "period");
    expect(step.effect).toEqual({ kind: "none" });
    expect(step.state.stage).toBe("confirming");
    expect(step.state.value).toBe(EMAIL);
  });
});
