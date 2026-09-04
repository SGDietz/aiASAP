import { describe, expect, it } from "vitest";
import {
  EMPTY_BUILD_INTEREST_STATE,
  extractSpokenName,
  isSendPermissionGranted,
  stepBuildInterest,
  type BuildInterestState,
} from "../../src/lib/buildInterestFlow";
import { resolveSemanticTurn } from "../../src/lib/voiceMode/turnIntake";
import { isPublicContactRequest } from "../../src/lib/publicContact";

// ---------------------------------------------------------------------------
// G's second smoke test, 2026-09-03 22:19:25 - 22:22:29 UTC, session cb2dde76.
// The read-back beat worked this time. The SEND beat did not: 6 asked
// "Can I send that to Scott so he can follow up with you?" FOUR times.
// G ended it with "this is so stupid" and closed the session.
//
// Verbatim turns are from conversation_messages (source=app) and the
// user_turn_dropped rows in app_events.
// ---------------------------------------------------------------------------

const EMAIL = "example@pm.me";
const NAME_AND_EMAIL = "so my name is Scott my name is Scott and my email is example@pm.me";
const GRANT =
  "so then ask me for my permission to send it to the team at AIA ASAP and yes I give you my permission go ahead and send it";

describe("ride 2026-09-03 22:21 - the send that would not fire", () => {
  it("takes the permission grant even though the sentence does not start with yes", () => {
    expect(isSendPermissionGranted(GRANT)).toBe(true);
  });

  it("walks his exact ride from hand raise to save", () => {
    let state: BuildInterestState = stepBuildInterest(
      EMPTY_BUILD_INTEREST_STATE,
      "Yeah, great. Have Scott reach out to me.",
    ).state;
    expect(state.stage).toBe("contact_method");

    const captured = stepBuildInterest(state, NAME_AND_EMAIL);
    expect(captured.state).toMatchObject({ stage: "confirming", value: EMAIL });
    // the name he said, not a device guess
    expect(captured.state.fullName).toBe("Scott");
    state = captured.state;

    const asked = stepBuildInterest(state, "yes that's correct on the screen");
    expect(asked.state.stage).toBe("permission");
    state = asked.state;

    const sending = stepBuildInterest(state, GRANT);
    expect(sending.effect).toEqual({
      kind: "save_contact",
      method: "email",
      value: EMAIL,
    });
    expect(sending.state.packageConsent).toBe(true);
    expect(sending.state.fullName).toBe("Scott");
  });

  it("never drops his bare Yes as a fragment of the sentence before it", () => {
    // 22:21:27 app_events: user_turn_dropped, reason fragment_of_accepted,
    // length 3 - the word "yes" had appeared inside the longer grant.
    const decision = resolveSemanticTurn({
      incoming: "Yes.",
      accepted: [{ text: GRANT, at: 1_000 }],
      now: 2_000,
    });
    expect(decision.kind).toBe("deliver");
  });

  it("keeps dropping a real repeated fragment of a long turn", () => {
    const decision = resolveSemanticTurn({
      incoming: "to the team at AIA ASAP",
      accepted: [{ text: GRANT, at: 1_000 }],
      now: 2_000,
    });
    expect(decision.kind).toBe("drop");
  });

  it("hears the name he said and refuses the things that are not names", () => {
    expect(extractSpokenName("so my name is Scott my name is Scott")).toBe("Scott");
    expect(extractSpokenName("my name is Scott Dietz")).toBe("Scott Dietz");
    expect(extractSpokenName("call me Scott")).toBe("Scott");
    expect(extractSpokenName("my name is the thing I forgot")).toBeNull();
    expect(extractSpokenName("I want a website")).toBeNull();
    expect(extractSpokenName("this is going to be great")).toBeNull();
  });

  it("does not answer with G's public phone number while being coached", () => {
    // 22:20:16, mid-capture: 6 read out the public phone number instead.
    expect(
      isPublicContactRequest(
        "so I'm you're supposed to say great what's your name and and tell me your email address",
      ),
    ).toBe(false);
    // a genuine ask still works
    expect(isPublicContactRequest("What is G's phone number?")).toBe(true);
    expect(isPublicContactRequest("How can I contact Scott?")).toBe(true);
  });

  it("lets 6 answer instead of scolding when the visitor is talking, not spelling", () => {
    // 22:19:37 - 22:20:00: "I need a complete email. Say it again slowly."
    // three times while G described where he wanted the box.
    const capturing: BuildInterestState = {
      stage: "contact_capture",
      method: "email",
      value: null,
    };
    for (const words of [
      "I think that your email box should cover the top two boxes it should just literally cover",
      "stop start stop button and gallery so we just don't see them but we leave mute and quiet on the screen",
    ]) {
      const step = stepBuildInterest(capturing, words);
      expect(step.handled, words).toBe(false);
      expect(step.spoken, words).toBeNull();
      expect(step.state.stage, words).toBe("contact_capture");
    }
    // a short muddled attempt still gets the nudge
    const nudged = stepBuildInterest(capturing, "uh example at");
    expect(nudged.handled).toBe(true);
  });

  it("asks for the name and the contact together, the way G asked for it", () => {
    const opened = stepBuildInterest(
      EMPTY_BUILD_INTEREST_STATE,
      "Have Scott reach out to me",
    );
    expect(opened.spoken).toMatch(/what's your name/i);
    expect(opened.spoken).toMatch(/email address/i);
  });
});
