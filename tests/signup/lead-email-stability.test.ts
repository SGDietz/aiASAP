import { describe, expect, it } from "vitest";
import { chooseStableLeadEmail } from "../../src/lib/leadCaptureFromUserText";

describe("observational transcript email authority", () => {
  it("never promotes the first extracted transcript address", () => {
    expect(chooseStableLeadEmail(null, "example@pm.me")).toBe(null);
  });

  it("preserves an existing authoritative address against every provider candidate", () => {
    expect(chooseStableLeadEmail("example@pm.me", "EXAMPLE@PM.ME")).toBe(
      "example@pm.me",
    );
    expect(chooseStableLeadEmail("example@pm.me", "examppv@pm.me")).toBe(
      "example@pm.me",
    );
  });
});
