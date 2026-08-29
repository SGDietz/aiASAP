import { describe, expect, it } from "vitest";
import { allowsTranscriptSignupSideEffects } from "../../src/lib/signup/transcriptSideEffects";

describe("LiveAvatar transcript signup side effects", () => {
  it.each([true, false])(
    "stays observational regardless of clientManagedSignup=%s",
    (clientManagedSignup) => {
      expect(allowsTranscriptSignupSideEffects(clientManagedSignup)).toBe(false);
    },
  );
});
