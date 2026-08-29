import { describe, expect, it } from "vitest";
import {
  EMPTY_BUILD_INTEREST_STATE,
  canAdvanceBuildInterview,
  extractFollowUpEmail,
  formatContactForSpeech,
  hasExplicitPersonalConnectionRequest,
  resolveContactSave,
  stepBuildInterest,
  type BuildInterestState,
} from "../src/lib/buildInterestFlow";

const interest = "I want to connect with G personally about my brand and website.";

function accountDeclined(): BuildInterestState {
  const offered = stepBuildInterest(EMPTY_BUILD_INTEREST_STATE, interest);
  return stepBuildInterest(offered.state, "No, I don't want an account").state;
}

describe("account-first build-interest gate", () => {
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

  it("starts the existing consent flow only for an express personal connection", () => {
    expect(
      hasExplicitPersonalConnectionRequest(
        "I would like to speak with Scott personally about my landscape work.",
      ),
    ).toBe(true);
    expect(stepBuildInterest(EMPTY_BUILD_INTEREST_STATE, interest)).toMatchObject({
      handled: true,
      state: { stage: "account_offer" },
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

  it("places the locked account line before Part 1 and accepts a direct email", () => {
    const offered = stepBuildInterest(EMPTY_BUILD_INTEREST_STATE, interest);
    expect(offered.state.stage).toBe("account_offer");
    expect(offered.spoken).toBe("Let’s get you set up so nothing gets lost — what’s your email? I’ll send a one-click magic link, and this conversation waits for you right where we left it.");
    expect(canAdvanceBuildInterview(offered.state, false)).toBe(false);
    const accepted = stepBuildInterest(offered.state, "me@example.com");
    expect(accepted.effect).toEqual({ kind: "start_account", email: "me@example.com" });
    expect(canAdvanceBuildInterview(accepted.state, false)).toBe(false);
    expect(canAdvanceBuildInterview(accepted.state, true)).toBe(true);
  });

  it("answers the free-account value question and lets continued discovery reach the brain", () => {
    const offered = stepBuildInterest(EMPTY_BUILD_INTEREST_STATE, interest);
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
    const line = stepBuildInterest(stepBuildInterest(EMPTY_BUILD_INTEREST_STATE, interest).state, "no").spoken;
    expect(line).toBe("No problem, no account needed — just give me your email or phone number so I know how to reach you, and we’ll keep going right now.");
    const captured = stepBuildInterest(fallback, "alex at example dot com");
    expect(captured.state.stage).toBe("confirming");
    expect(captured.spoken).toContain("a-l-e-x at e-x-a-m-p-l-e dot c-o-m");
    const saving = stepBuildInterest(captured.state, "yes");
    expect(saving.effect).toEqual({ kind: "save_contact", method: "email", value: "alex@example.com" });
    expect(canAdvanceBuildInterview(saving.state, false)).toBe(false);
    const saved = resolveContactSave(saving.state, true);
    expect(canAdvanceBuildInterview(saved.state, false)).toBe(true);
    expect(saved.spoken).not.toMatch(/phone.*too|second/i);
  });

  it("phone-only success passes and reads digits in groups", () => {
    const captured = stepBuildInterest(accountDeclined(), "my number is 410 555 0123");
    expect(captured.state).toMatchObject({ stage: "confirming", method: "phone", value: "4105550123" });
    expect(formatContactForSpeech("phone", "4105550123")).toBe("4-1-0, 5-5-5, 0-1-2-3");
    const saving = stepBuildInterest(captured.state, "yes that's right");
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

  it("API failure stays closed and a retry can submit", () => {
    const captured = stepBuildInterest(accountDeclined(), "4105550123");
    const saving = stepBuildInterest(captured.state, "yes");
    const failed = resolveContactSave(saving.state, false);
    expect(failed.state.stage).toBe("failed");
    expect(failed.spoken).toMatch(/Nothing was submitted/i);
    expect(canAdvanceBuildInterview(failed.state, false)).toBe(false);
    const retryCapture = stepBuildInterest(failed.state, "4105550123");
    const retrySaving = stepBuildInterest(retryCapture.state, "yes");
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
