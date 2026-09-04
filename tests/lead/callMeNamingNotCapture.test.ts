import { describe, expect, it } from "vitest";
import { hasDirectContactFollowUpRequest } from "../../src/lib/buildInterestFlow";

/**
 * G's ride, 2026-09-04 12:42:20. He was correcting 6 on his own name:
 *
 *   G:  "They call me 6."
 *   6:  "Absolutely - I'll get you to G. What's your name, and what's your
 *        email address?"
 *
 * 6 then asked for the email seven times, ignored four "why?"s and one flat
 * refusal ("I don't need you to have my email"). The trigger was this guard:
 * the name token was [A-Z][a-z]+, a capitalised WORD, and 6's own name is a
 * DIGIT. "call me 6" missed the naming guard, matched the bare "call me"
 * contact pattern, and fired a lead capture off the product's own avatar name.
 * The missing /i flag broke it for lowercase transcription too.
 */
describe("'call me <name>' is naming, never a contact request", () => {
  it("does not capture the exact line from G's 2026-09-04 ride", () => {
    expect(hasDirectContactFollowUpRequest("They call me 6.")).toBe(false);
  });

  it("does not capture digit, single-letter or uncapitalised names", () => {
    for (const line of [
      "They call me 6.",
      "they call me 6",
      "call me 6",
      "Call me Scott",
      "call me scott",
      "Call me J",
      "call me J.R.",
      "everyone calls me Six, call me 6",
      "you can call me 007",
      "my friends call me Sixer",
    ]) {
      expect(hasDirectContactFollowUpRequest(line), line).toBe(false);
    }
  });

  it("STILL captures a genuine request to be contacted", () => {
    for (const line of [
      "Please call me back",
      "call me back",
      "call me tomorrow",
      "call me later",
      "Can somebody call me?",
      "I'd like someone to reach out",
      "have someone reach out",
      "contact me",
      "email me",
      "follow up with me",
      "take my information",
      "write down my email",
    ]) {
      expect(hasDirectContactFollowUpRequest(line), line).toBe(true);
    }
  });

  it("still ignores coaching and rehearsal framing", () => {
    for (const line of [
      "you're supposed to say what's your name and tell me your email address",
      "you should ask me for my email",
    ]) {
      expect(hasDirectContactFollowUpRequest(line), line).toBe(false);
    }
  });
});
