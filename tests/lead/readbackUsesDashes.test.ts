import { describe, expect, it } from "vitest";
import { formatContactForSpeech } from "../../src/lib/buildInterestFlow";

/**
 * G, 2026-08-31, hearing his own address read back to him:
 *   "there's no email on the screen, and he said it in the most fucked up way.
 *    I've - there's, you know, it needs to have dashes in it."
 *
 * and 2026-09-01:
 *   "You didn't pronounce it either. You said these like D-E-E."
 *
 * The letters were joined with COMMAS, so a TTS voice read each one as a
 * separate item and slurred runs like D, I, E into a word. A dashed run reads
 * as spelling. It is also the house style for every spoken form in this
 * product - "a-i-ASAP", "a-i-buddy" - which is sacred and never stripped.
 *
 * The read-back G actually accepted on his 2026-09-04 ride was the dashed one.
 */
describe("6 spells an address with dashes, never commas", () => {
  // The address here was G's own until 2026-09-04; it is a placeholder now
  // because this repo is public. The SHAPE is unchanged - seven letters, then
  // pm.me - so this still asserts exactly the read-back he accepted.
  it("spells an address the way G accepted it on the ride", () => {
    expect(formatContactForSpeech("email", "example@pm.me")).toBe(
      "E-X-A-M-P-L-E at P-M dot M-E",
    );
  });

  it("keeps at, dot and the other separators as spoken words", () => {
    expect(formatContactForSpeech("email", "pat.g@example.com")).toBe(
      "P-A-T dot G at E-X-A-M-P-L-E dot C-O-M",
    );
    expect(formatContactForSpeech("email", "a-b_c@x.co")).toBe(
      "A dash B underscore C at X dot C-O",
    );
  });

  it("never emits a comma-joined letter run again", () => {
    for (const address of ["example@pm.me", "pat.g@example.com", "die@x.co"]) {
      expect(formatContactForSpeech("email", address)).not.toMatch(/[A-Z], [A-Z]/);
    }
  });

  it("leaves the PHONE reading alone - only the email spelling changed", () => {
    expect(formatContactForSpeech("phone", "4105550123")).toBe(
      "4, 1, 0, 5, 5, 5, 0, 1, 2, 3",
    );
  });
});
