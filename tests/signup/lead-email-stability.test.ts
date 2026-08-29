import { describe, expect, it } from "vitest";
import { chooseStableLeadEmail } from "../../src/lib/leadCaptureFromUserText";

describe("observational transcript email authority", () => {
  it("never promotes the first extracted transcript address", () => {
    expect(chooseStableLeadEmail(null, "sgdietz@pm.me")).toBe(null);
  });

  it("preserves an existing authoritative address against every provider candidate", () => {
    expect(chooseStableLeadEmail("sgdietz@pm.me", "SGDIETZ@PM.ME")).toBe(
      "sgdietz@pm.me",
    );
    expect(chooseStableLeadEmail("sgdietz@pm.me", "sgdiepv@pm.me")).toBe(
      "sgdietz@pm.me",
    );
  });
});
