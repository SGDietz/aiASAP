import { describe, expect, it } from "vitest";
import {
  EMPTY_BUILD_INTEREST_STATE,
  extractStandaloneSpokenName,
  stepBuildInterest,
} from "../../src/lib/buildInterestFlow";
import { mergeObservedConsentStatus } from "../../src/lib/leadCaptureFromUserText";

describe("aiASAP complete lead capture", () => {
  it("reassembles a fragmented name before confirming a fragmented email", () => {
    const opened = stepBuildInterest(EMPTY_BUILD_INTEREST_STATE, "Have the team reach out to me");
    const cue = stepBuildInterest(opened.state, "My name is");
    expect(cue.state.stage).toBe("name_capture");
    const named = stepBuildInterest(cue.state, "jamie rivera");
    expect(named.state).toMatchObject({ stage: "contact_method", fullName: "Jamie Rivera" });
    const emailStart = stepBuildInterest(named.state, "email");
    const local = stepBuildInterest(emailStart.state, "jamie dot rivera at");
    const complete = stepBuildInterest(local.state, "example dot com");
    expect(complete.state).toMatchObject({
      stage: "confirming",
      fullName: "Jamie Rivera",
      value: "jamie.rivera@example.com",
    });
  });

  it("rejects filler/interjections as names and re-asks", () => {
    for (const filler of ["um", "uh", "erm", "hmm", "well", "okay", "ok", "yeah", "yes"]) {
      expect(extractStandaloneSpokenName(filler), filler).toBeNull();
    }
    const waiting = { stage: "name_capture" as const, method: "email" as const, value: "j@example.com" };
    const result = stepBuildInterest(waiting, "well");
    expect(result.state.stage).toBe("name_capture");
    expect(result.spoken).toMatch(/didn.t catch a name/i);
  });

  it("keeps accepted email consent when a later unrelated answer is no", () => {
    expect(mergeObservedConsentStatus("accepted", { interested: false, declined: true }, false)).toBe("accepted");
    expect(mergeObservedConsentStatus("unknown", { interested: false, declined: true }, false)).toBe("declined");
  });
});
