import { describe, expect, it } from "vitest";
import {
  EMPTY_BUILD_INTEREST_STATE,
  SEND_PERMISSION_QUESTION,
  canAdvanceBuildInterview,
  extractFollowUpEmail,
  formatContactForSpeech,
  hasExplicitPersonalConnectionRequest,
  isChoppedCopyOfConfirmed,
  isScreenTalk,
  isSendPermissionGranted,
  resolveContactSave,
  stepBuildInterest,
  type BuildInterestState,
} from "../src/lib/buildInterestFlow";

/**
 * The read-back and the permission to send are two beats as of 2026-09-03.
 * Confirming what 6 heard moves to `permission`; only a yes to the send
 * question itself produces `save_contact`.
 */
function grantPermission(state: BuildInterestState, words = "yes") {
  const step = stepBuildInterest(state, words);
  expect(step.state.stage, `permission beat for "${words}"`).toBe("saving");
  return step;
}

const interest = "I want to connect with G personally about my brand and website.";

const accountOfferState: BuildInterestState = {
  stage: "account_offer",
  method: null,
  value: null,
};

function accountDeclined(): BuildInterestState {
  return stepBuildInterest(accountOfferState, "No, I don't want an account").state;
}

describe("first-request contact gate and account fallback", () => {
  it("does not treat sales coaching or build talk as contact consent", () => {
    for (const coaching of [
      "G should talk personally with the prospect about their future.",
      "Scott should say he can help shape a website.",
      "I want G's team to build my brand and website.",
    ]) {
      expect(hasExplicitPersonalConnectionRequest(coaching)).toBe(false);
      expect(stepBuildInterest(EMPTY_BUILD_INTEREST_STATE, coaching)).toMatchObject({
        handled: false,
        state: EMPTY_BUILD_INTEREST_STATE,
        effect: { kind: "none" },
      });
    }
  });

  it("starts direct contact capture for an express personal connection", () => {
    expect(
      hasExplicitPersonalConnectionRequest(
        "I would like to speak with Scott personally about my landscape work.",
      ),
    ).toBe(true);
    expect(stepBuildInterest(EMPTY_BUILD_INTEREST_STATE, interest)).toMatchObject({
      handled: true,
      state: { stage: "contact_method" },
    });
  });

  it("leaves normal non-sales account wording to the ordinary account flow", () => {
    expect(hasExplicitPersonalConnectionRequest("I want a free account.")).toBe(false);
    expect(stepBuildInterest(EMPTY_BUILD_INTEREST_STATE, "I want a free account.")).toMatchObject({
      handled: false,
      effect: { kind: "none" },
    });
  });

  it("does not trigger on a generic greeting", () => {
    expect(stepBuildInterest(EMPTY_BUILD_INTEREST_STATE, "Hello, can you hear me?").handled).toBe(false);
  });

  it("reads back a contact volunteered during exploration before saving", () => {
    const step = stepBuildInterest(
      EMPTY_BUILD_INTEREST_STATE,
      "Uh, email address is pat@example.com.",
    );
    expect(step).toMatchObject({
      handled: true,
      state: { stage: "confirming", method: "email", value: "pat@example.com" },
      effect: { kind: "none" },
    });
    expect(step.spoken).toMatch(/did i get that email right/i);
    expect(step.spoken).not.toMatch(/screen|box|type it/i);
  });

  it("does not mistake reported speech for the visitor's contact consent", () => {
    for (const text of [
      "the transcript said have G reach out to me",
      "She said have G reach out to me",
    ]) {
      expect(stepBuildInterest(EMPTY_BUILD_INTEREST_STATE, text)).toMatchObject({
        handled: false,
        state: EMPTY_BUILD_INTEREST_STATE,
        effect: { kind: "none" },
      });
    }
  });

  it("keeps the existing account-offer branch available without forcing it on a hand raise", () => {
    const offered = { handled: true, state: accountOfferState };
    expect(canAdvanceBuildInterview(offered.state, false)).toBe(false);
    const accepted = stepBuildInterest(offered.state, "me@example.com");
    expect(accepted.effect).toEqual({ kind: "start_account", email: "me@example.com" });
    expect(canAdvanceBuildInterview(accepted.state, false)).toBe(false);
    expect(canAdvanceBuildInterview(accepted.state, true)).toBe(true);
  });

  it("answers the free-account value question and lets continued discovery reach the brain", () => {
    const offered = { state: accountOfferState };
    const why = stepBuildInterest(offered.state, "Why would I want a free account?");
    expect(why.handled).toBe(true);
    expect(why.spoken).toContain("come back and keep building without starting over");
    expect(why.spoken).toContain("Talking to me is free");
    expect(why.spoken).toContain("Want me to set that up so we can keep going?");
    expect(why.spoken).not.toMatch(/yes or no/i);

    const acceptedAfterValue = stepBuildInterest(why.state, "Yes, let's do it");
    expect(acceptedAfterValue).toMatchObject({
      handled: true,
      effect: { kind: "start_account" },
    });

    const continuation = stepBuildInterest(
      offered.state,
      "Let's go through ideas and build the brand and website.",
    );
    expect(continuation).toMatchObject({ handled: false, state: offered.state, spoken: null });
  });

  it("does not mistake product-review coaching for a visitor build conversion", () => {
    expect(
      stepBuildInterest(
        EMPTY_BUILD_INTEREST_STATE,
        "We can build you a website so you can make money from your passion.",
      ).handled,
    ).toBe(false);
  });

  it("uses the final email-or-phone fallback and email-only success passes", () => {
    const fallback = accountDeclined();
    expect(fallback.stage).toBe("contact_capture");
    const line = stepBuildInterest(accountOfferState, "no").spoken;
    expect(line).toBe("No problem, no account needed — just give me your email or phone number so I know how to reach you, and we’ll keep going right now.");
    const captured = stepBuildInterest(fallback, "alex at example dot com");
    expect(captured.state.stage).toBe("confirming");
    expect(captured.spoken).toContain("A-L-E-X at E-X-A-M-P-L-E dot C-O-M");
    const asked = stepBuildInterest(captured.state, "yes");
    expect(asked.state.stage).toBe("permission");
    expect(asked.effect).toEqual({ kind: "none" });
    expect(asked.spoken).toBe(SEND_PERMISSION_QUESTION);
    const saving = grantPermission(asked.state, "yes please");
    expect(saving.effect).toEqual({ kind: "save_contact", method: "email", value: "alex@example.com" });
    expect(canAdvanceBuildInterview(saving.state, false)).toBe(false);
    const saved = resolveContactSave(saving.state, true);
    expect(canAdvanceBuildInterview(saved.state, false)).toBe(true);
    expect(saved.spoken).not.toMatch(/phone.*too|second/i);
  });

  it("phone-only success passes and reads digits in groups", () => {
    const captured = stepBuildInterest(accountDeclined(), "my number is 410 555 0123");
    expect(captured.state).toMatchObject({ stage: "confirming", method: "phone", value: "4105550123" });
    expect(formatContactForSpeech("phone", "4105550123")).toBe("4, 1, 0, 5, 5, 5, 0, 1, 2, 3");
    const asked = stepBuildInterest(captured.state, "yes that's right");
    expect(asked.state.stage).toBe("permission");
    const saving = grantPermission(asked.state, "go ahead");
    expect(resolveContactSave(saving.state, true).state.stage).toBe("submitted");
  });

  it("supports incremental email capture without passing or displaying it early", () => {
    let state = stepBuildInterest(accountDeclined(), "email").state;
    state = stepBuildInterest(state, "a l e x at").state;
    expect(state.stage).toBe("contact_capture");
    expect(canAdvanceBuildInterview(state, false)).toBe(false);
    const done = stepBuildInterest(state, "example dot com");
    expect(done.state.stage).toBe("confirming");
  });

  it("correction replaces the candidate before confirmation", () => {
    const first = stepBuildInterest(accountDeclined(), "wrong@example.com");
    const corrected = stepBuildInterest(first.state, "No, use right@example.com instead");
    expect(corrected.state).toMatchObject({ stage: "confirming", value: "right@example.com" });
  });

  it("requires an explicit contact confirmation and never saves a complaint that begins okay", () => {
    const confirming: BuildInterestState = {
      stage: "confirming",
      method: "email",
      value: "example@pm.me",
    };
    const complaint = stepBuildInterest(
      confirming,
      "Okay, so, um, What's going on? There's no email box up or anything.",
    );
    expect(complaint).toMatchObject({
      state: confirming,
      effect: { kind: "none" },
    });
    const asked = stepBuildInterest(confirming, "yes that's correct");
    expect(asked.state).toMatchObject({ stage: "permission", value: "example@pm.me" });
    expect(asked.effect).toEqual({ kind: "none" });
    expect(grantPermission(asked.state).effect).toEqual({
      kind: "save_contact",
      method: "email",
      value: "example@pm.me",
    });
    expect(stepBuildInterest(confirming, "no that's not correct")).toMatchObject({
      state: { stage: "contact_capture", method: "email", value: null },
      effect: { kind: "none" },
    });
  });

  it("keeps ambiguous, negative, and conversational confirmation variants fail-closed", () => {
    const confirming: BuildInterestState = {
      stage: "confirming",
      method: "email",
      value: "example@pm.me",
    };
    const accepted = [
      "yes",
      "yes that's correct",
      "that is right",
      "go ahead",
      "save it",
      "please save it",
      "confirm it",
    ];
    const rejected = [
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
    ];

    for (const text of accepted) {
      // Beat one only. Nothing is saved until the send question is answered.
      const step = stepBuildInterest(confirming, text);
      expect(step.state.stage, text).toBe("permission");
      expect(step.effect, text).toEqual({ kind: "none" });
      expect(grantPermission(step.state).effect, text).toEqual({
        kind: "save_contact",
        method: "email",
        value: "example@pm.me",
      });
    }
    for (const text of rejected) {
      expect(stepBuildInterest(confirming, text).effect, text).toEqual({ kind: "none" });
    }
  });

  it("API failure stays closed and a retry can submit", () => {
    const captured = stepBuildInterest(accountDeclined(), "4105550123");
    const saving = stepBuildInterest(captured.state, "yes");
    const failed = resolveContactSave(saving.state, false);
    expect(failed.state.stage).toBe("failed");
    expect(failed.spoken).toMatch(/Nothing was submitted/i);
    expect(canAdvanceBuildInterview(failed.state, false)).toBe(false);
    const retrySaving = stepBuildInterest(failed.state, "yes");
    expect(retrySaving.effect).toEqual({
      kind: "save_contact",
      method: "phone",
      value: "4105550123",
    });
    expect(canAdvanceBuildInterview(resolveContactSave(retrySaving.state, true).state, false)).toBe(true);
  });

  it("both paths declined stays friendly and never passes", () => {
    const declined = stepBuildInterest(accountDeclined(), "no follow-up");
    expect(declined.state.stage).toBe("declined");
    expect(declined.spoken).toMatch(/Nothing has been submitted/i);
    expect(canAdvanceBuildInterview(declined.state, false)).toBe(false);
  });

  it("rejects the prose-gluing email bug from the iScott ride", () => {
    expect(extractFollowUpEmail("instead of @bm.me. So it should be")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// THE SEND BEAT. Every case below is a lead that died on a real WildWorks ride
// before this split existed; the aiASAP flow had the same shape and the same
// holes. Ride ids are in reference-iscott-proof-transcript-ghost-rows and
// reference-aiasap-capture-stack-baseline-20260903.
// ---------------------------------------------------------------------------
describe("read-back, permission, send", () => {
  const confirmed: BuildInterestState = {
    stage: "permission",
    method: "email",
    value: "example@pm.me",
  };

  it("never sends on the read-back alone", () => {
    const readBack: BuildInterestState = {
      stage: "confirming",
      method: "email",
      value: "example@pm.me",
    };
    const step = stepBuildInterest(readBack, "yes");
    expect(step.state.stage).toBe("permission");
    expect(step.effect).toEqual({ kind: "none" });
    expect(step.spoken).toBe(SEND_PERMISSION_QUESTION);
  });

  it("accepts a plain yes to the send question and only then saves", () => {
    for (const words of [
      "yes",
      "yes please",
      "sure",
      "okay",
      "go ahead",
      "absolutely",
      "send it",
      "yes, go ahead",
      "of course",
      "you can",
    ]) {
      expect(isSendPermissionGranted(words), words).toBe(true);
      expect(stepBuildInterest(confirmed, words).effect, words).toEqual({
        kind: "save_contact",
        method: "email",
        value: "example@pm.me",
      });
    }
  });

  it("stays fail-closed on anything that is not a yes to sending", () => {
    for (const words of [
      "yes but no",
      "yes?",
      "okay, where is the email box?",
      "not yet",
      "don't send it",
      "hold on",
      "maybe later",
      "I didn't give you permission",
      "what does it do with it?",
      "hmm",
    ]) {
      expect(isSendPermissionGranted(words), words).toBe(false);
      expect(stepBuildInterest(confirmed, words).effect, words).toEqual({ kind: "none" });
    }
  });

  it("silence-shaped small talk re-asks the send question instead of sending", () => {
    const step = stepBuildInterest(confirmed, "So how long has aiASAP been around");
    expect(step.state.stage).toBe("permission");
    expect(step.spoken).toBe(SEND_PERMISSION_QUESTION);
    expect(step.effect).toEqual({ kind: "none" });
  });

  it("a decline keeps the captured value instead of destroying it", () => {
    const step = stepBuildInterest(confirmed, "no, not yet");
    expect(step.state).toMatchObject({
      stage: "declined",
      value: "example@pm.me",
      packageConsent: false,
    });
    expect(canAdvanceBuildInterview(step.state, false)).toBe(false);
  });

  // ---- ride cea22329: G read the card aloud and lost his own address -------
  it("reading the box out loud never overwrites the confirmed address", () => {
    expect(isScreenTalk("It just says your email, SGD at pm.me")).toBe(true);
    for (const state of [confirmed, { ...confirmed, stage: "confirming" as const }]) {
      const step = stepBuildInterest(state, "It just says your email, SGD at pm.me");
      expect(step.state.value).toBe("example@pm.me");
      expect(step.effect).toEqual({ kind: "none" });
    }
  });

  it("a chopped copy of the confirmed value is a mishearing, not a correction", () => {
    expect(isChoppedCopyOfConfirmed("email", "exa@pm.me", "example@pm.me")).toBe(true);
    expect(isChoppedCopyOfConfirmed("email", "scott@pm.me", "example@pm.me")).toBe(false);
    expect(isChoppedCopyOfConfirmed("email", "sgd@gmail.com", "example@pm.me")).toBe(false);
    expect(isChoppedCopyOfConfirmed("phone", "4105550", "14105550123")).toBe(true);
    const step = stepBuildInterest(confirmed, "exa@pm.me");
    expect(step.state.value).toBe("example@pm.me");
    expect(step.state.stage).toBe("permission");
  });

  it("a genuinely different address at the send question goes back to the read-back", () => {
    const step = stepBuildInterest(confirmed, "actually use scott@example.com");
    expect(step.state).toMatchObject({ stage: "confirming", value: "scott@example.com" });
    expect(step.effect).toEqual({ kind: "none" });
  });

  // ---- ride 1cc18a84: "can I call you Scott?" opened the phone box ---------
  it("a name question is not a phone choice", () => {
    const choosing: BuildInterestState = { stage: "contact_method", method: null, value: null };
    for (const words of ["Can I call you Scott?", "What's the number one thing you do?"]) {
      const step = stepBuildInterest(choosing, words);
      expect(step.state, words).toMatchObject({ stage: "contact_method", method: null });
    }
    expect(stepBuildInterest(choosing, "email").state).toMatchObject({
      stage: "contact_capture",
      method: "email",
    });
  });
});
