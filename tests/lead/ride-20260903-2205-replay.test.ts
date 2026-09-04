import { describe, expect, it } from "vitest";
import {
  EMPTY_BUILD_INTEREST_STATE,
  isExplicitContactConfirmation,
  isSendPermissionGranted,
  stepBuildInterest,
  wantsTheValueReadBack,
  type BuildInterestState,
} from "../../src/lib/buildInterestFlow";

// ---------------------------------------------------------------------------
// G's smoke test, 2026-09-03 22:04:57 - 22:06:17 UTC, session 0dadb36a.
// Read back off conversation_messages, in order, verbatim.
//
// What happened: the read-back worked, then 6 asked "Did I get that right,
// yes or no?" THREE times and never moved. G answered it three ways, asked to
// have the address read out loud, and finally gave send permission outright -
// none of it landed. lead_sessions row stopped at last_prompted_field =
// contact_method with no email saved. Nothing was ever sent.
//
// Two causes, both in this file's logic:
//   1. the screen-talk guard ate "yes that's correct on the screen"
//   2. the confirmation regex demanded a short exact phrase, so
//      "Yes, you got it right." was not a yes either
// ---------------------------------------------------------------------------

const HAND_RAISE = "Yeah, great. Have Scott reach out to me. I want him to";
const SPOKEN_EMAIL = "okay my email is example@pm.me";
const EMAIL = "example@pm.me";

function throughReadBack(): BuildInterestState {
  const raised = stepBuildInterest(EMPTY_BUILD_INTEREST_STATE, HAND_RAISE);
  expect(raised.state.stage).toBe("contact_method");
  const captured = stepBuildInterest(raised.state, SPOKEN_EMAIL);
  expect(captured.state).toMatchObject({ stage: "confirming", value: EMAIL });
  expect(captured.spoken).toContain("E-X-A-M-P-L-E at P-M dot M-E");
  return captured.state;
}

describe("ride 2026-09-03 22:05 - the read-back that would not accept a yes", () => {
  it("accepts the exact yes G gave, screen mention and all", () => {
    const step = stepBuildInterest(throughReadBack(), "yes that's correct on the screen");
    expect(isExplicitContactConfirmation("yes that's correct on the screen")).toBe(true);
    expect(step.state.stage).toBe("permission");
    expect(step.state.value).toBe(EMAIL);
  });

  it("accepts the second way he said it", () => {
    for (const words of [
      "Yes, you got it right.",
      "Yes, you got it right, buddy.",
      "yes that's correct",
      "yeah that's right",
      "correct",
      "you got it",
    ]) {
      expect(isExplicitContactConfirmation(words), words).toBe(true);
      expect(stepBuildInterest(throughReadBack(), words).state.stage, words).toBe("permission");
    }
  });

  it("reads the address out loud when he asks for it, instead of re-asking", () => {
    for (const words of [
      "Uh, read it out loud.",
      "tell me what my email address is",
      "I can't really see it, it's a little small",
      "say it again",
      "what's my email",
    ]) {
      expect(wantsTheValueReadBack(words), words).toBe(true);
      const step = stepBuildInterest(throughReadBack(), words);
      expect(step.spoken, words).toContain("E-X-A-M-P-L-E at P-M dot M-E");
      expect(step.state.stage, words).toBe("confirming");
      expect(step.effect, words).toEqual({ kind: "none" });
    }
  });

  it("takes his outright permission sentence as the send yes", () => {
    const confirmed = stepBuildInterest(throughReadBack(), "yes that's correct on the screen");
    const words = "yes you have my permission to send that email to Scott";
    expect(isSendPermissionGranted(words)).toBe(true);
    const sending = stepBuildInterest(confirmed.state, words);
    expect(sending.effect).toEqual({
      kind: "save_contact",
      method: "email",
      value: EMAIL,
    });
    expect(sending.state.packageConsent).toBe(true);
  });

  it("walks the whole ride end to end and reaches a save", () => {
    let state = throughReadBack();
    const turns = [
      "yes that's correct on the screen",
      "Uh, read it out loud.",
      "Yes, you got it right.",
      "yes you have my permission to send that email to Scott",
    ];
    let saved = false;
    for (const turn of turns) {
      const step = stepBuildInterest(state, turn);
      state = step.state;
      if (step.effect.kind === "save_contact") saved = true;
    }
    expect(saved).toBe(true);
    expect(state.stage).toBe("saving");
    expect(state.value).toBe(EMAIL);
  });

  // The loosening above must not open the send door.
  it("still refuses everything that is not a yes", () => {
    const confirming: BuildInterestState = {
      stage: "confirming",
      method: "email",
      value: EMAIL,
    };
    for (const words of [
      "okay",
      "sure",
      "yes?",
      "yes but no",
      "yes that's correct?",
      "okay, where is the email box?",
      "no",
      "not correct",
      "wrong",
      "change the email",
      "Okay, so, um, What's going on? There's no email box up or anything.",
    ]) {
      expect(isExplicitContactConfirmation(words), words).toBe(false);
      expect(stepBuildInterest(confirming, words).effect, words).toEqual({ kind: "none" });
    }
  });

  it("still refuses a send on anything that is not a yes to sending", () => {
    const permission: BuildInterestState = {
      stage: "permission",
      method: "email",
      value: EMAIL,
    };
    for (const words of [
      "not yet",
      "don't send it",
      "hold on",
      "maybe later",
      "I didn't give you permission",
      "yes but not yet",
      "what happens to it?",
      "hmm",
      "So how long has aiASAP been around",
    ]) {
      expect(isSendPermissionGranted(words), words).toBe(false);
      expect(stepBuildInterest(permission, words).effect, words).toEqual({ kind: "none" });
    }
  });
});
