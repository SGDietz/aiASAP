import { describe, expect, it } from "vitest";
import {
  formatContactForSpeech,
  resolveContactSave,
  stepBuildInterest,
  type BuildInterestState,
} from "../../src/lib/buildInterestFlow";

const confirming: BuildInterestState = {
  stage: "confirming",
  method: "phone",
  value: "4105550123",
};

describe("confirming-stage contact consent", () => {
  it.each([
    "yes",
    "yes that's correct",
    "that's correct",
    "you got it",
    "you said it correctly",
  ])("moves to the send question on the explicit confirmation %s", (text) => {
    // Two beats since 2026-09-03: confirming what 6 heard asks permission to
    // send, it does not send. Only a yes to THAT question saves.
    const step = stepBuildInterest(confirming, text);
    expect(step.effect).toEqual({ kind: "none" });
    expect(step.state.stage).toBe("permission");
    const sending = stepBuildInterest(step.state, "yes");
    expect(sending.effect).toEqual({
      kind: "save_contact",
      method: "phone",
      value: "4105550123",
    });
    expect(sending.state.stage).toBe("saving");
    expect(sending.state.packageConsent).toBe(true);
  });

  it.each([
    "that's not right",
    "that's not correct",
    "wrong",
    "change it",
    "yes but that's not right",
  ])(
    "clears the disowned candidate on %s",
    (text) => {
      const step = stepBuildInterest(confirming, text);
      expect(step.effect).toEqual({ kind: "none" });
      expect(step.state).toMatchObject({
        stage: "contact_capture",
        method: "phone",
        value: null,
      });
    },
  );

  it.each([
    "okay",
    "sure",
    "is that correct?",
    "yes that's correct?",
    "okay, where is the contact box?",
  ])("keeps ambiguous, questioning, or corrective speech fail-closed: %s", (text) => {
    const step = stepBuildInterest(confirming, text);
    expect(step.effect).toEqual({ kind: "none" });
    // What must hold: nothing is sent, and the flow does not advance. The
    // read-back re-ask now carries a counter (capped at 2 - it was the second
    // most-repeated line 6 says, 7 extra repeats in the measured record), so
    // the meaningful state is compared rather than the whole object.
    expect(step.state).toMatchObject({
      stage: confirming.stage,
      method: confirming.method,
      value: confirming.value,
    });
    expect(step.state.sendConsent).toBe(confirming.sendConsent);
    expect(step.state.packageConsent).toBeFalsy();
  });

  it("retains the candidate after a failed save and retries only on explicit confirmation", () => {
    const asked = stepBuildInterest(confirming, "yes");
    const saving = stepBuildInterest(asked.state, "yes");
    expect(saving.state.stage).toBe("saving");
    const failed = resolveContactSave(saving.state, false);
    expect(failed.state).toMatchObject({
      stage: "failed",
      method: "phone",
      value: "4105550123",
    });
    expect(stepBuildInterest(failed.state, "okay").effect).toEqual({ kind: "none" });
    expect(stepBuildInterest(failed.state, "you said it correctly").effect).toEqual({
      kind: "save_contact",
      method: "phone",
      value: "4105550123",
    });
  });

  it("preserves comma-paced contact readback", () => {
    expect(formatContactForSpeech("phone", "4105550123")).toBe(
      "4, 1, 0, 5, 5, 5, 0, 1, 2, 3",
    );
  });
});
