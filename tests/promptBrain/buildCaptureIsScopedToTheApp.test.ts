import { describe, expect, it } from "vitest";
import { SIX_SYSTEM_PROMPT } from "../../src/lib/brain/sixSystemPrompt";

/**
 * G's ride, 2026-09-04 17:10-17:12. BUILD REQUEST CAPTURE fired EIGHT times and
 * seven of them were ordinary sales conversation about his stone-wall business:
 *
 *   "So: you want a great, strong name for your stone wall company..."
 *   "So: after the brand and name, the team here at aiASAP will build you a
 *    website..."
 *   "So: the team here at aiASAP will start building the systems you need..."
 *
 * He stopped getting a conversation and started getting a receipt for every
 * sentence. The rule said "DO IT EVERY TIME" and triggered on "pitches an idea"
 * - and this product builds things FOR people who build things, so nearly every
 * sentence in a real sales call looks like a build request.
 */
describe("build-request capture is scoped to the app itself", () => {
  it("triggers on a change to THIS APP, not on the word build", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("BUILD REQUEST CAPTURE - THIS IS THE RECORD");
    expect(SIX_SYSTEM_PROMPT).toContain("a change to THIS APP");
    expect(SIX_SYSTEM_PROMPT).toContain("SCOPE IT, OR IT EATS THE CONVERSATION");
  });

  it("drops the unconditional 'DO IT EVERY TIME'", () => {
    // That phrase is what made it fire relentlessly on ordinary talk.
    expect(SIX_SYSTEM_PROMPT).not.toContain(
      "BUILD REQUEST CAPTURE - THIS IS THE RECORD, DO IT EVERY TIME",
    );
  });

  it("names the three things that are NOT build requests", () => {
    // the visitor's own trade
    expect(SIX_SYSTEM_PROMPT).toContain("their OWN trade or work");
    // the paid work being scoped
    expect(SIX_SYSTEM_PROMPT).toContain("what aiASAP will do FOR them as the paid job");
    // coaching 6 on what to say
    expect(SIX_SYSTEM_PROMPT).toContain("coaching you, rehearsing, or telling you what to SAY");
  });

  it("says plainly that the word 'build' is not the trigger", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("The word is not the trigger");
    expect(SIX_SYSTEM_PROMPT).toContain("When in doubt, it is NOT a build request");
  });

  it("keeps the recording behaviour itself intact for real app requests", () => {
    // The say-it-back record is still the mechanism - only its scope changed.
    expect(SIX_SYSTEM_PROMPT).toContain('"So: a mute button and a mic toggle on the main screen."');
    expect(SIX_SYSTEM_PROMPT).toContain("NEVER ask permission to note something");
  });
});
