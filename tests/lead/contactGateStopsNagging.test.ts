import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasDirectContactFollowUpRequest } from "../../src/lib/buildInterestFlow";

const routeSource = () =>
  readFileSync(resolve(process.cwd(), "app/api/openai-chat-complete/route.ts"), "utf8");

/**
 * MEASURED 2026-09-04 across every recorded conversation since 08-25:
 * "Real quick so the team can follow up - what's your name, and what's your
 * email address?" is the third most repeated thing 6 says (+6 beyond the
 * first).
 *
 * Cause: `buildInterestSeen` scans the ENTIRE history, so once ANY past turn
 * tripped the contact detector the gate short-circuited EVERY later turn -
 * returning the identical canned line and never calling the brain at all.
 *
 * It compounded with the "call me 6" bug fixed the same day (G's own name
 * tripped the detector), so from that moment everything he said came back as
 * this demand. See tests/lead/callMeNamingNotCapture.test.ts.
 */
describe("the contact gate asks, it does not nag", () => {
  it("counts how many times it already asked, from the history", () => {
    const src = routeSource();
    expect(src).toContain("alreadyAskedForContact");
    expect(src).toContain('turn.content.includes("so the team can follow up")');
    expect(src).toContain("alreadyAskedForContact < 2");
  });

  it("still gates - the scan of history is intentional and stays", () => {
    const src = routeSource();
    expect(src).toContain("buildInterestSeen");
    expect(src).toContain("buildGateSatisfied");
    // A signed-in visitor is never asked at all.
    expect(src).toContain("Boolean(signedInEmail)");
  });

  it("counts only 6's OWN asks, never the visitor's words", () => {
    const src = routeSource();
    const counter = src.slice(
      src.indexOf("const alreadyAskedForContact"),
      src.indexOf("if (buildInterestSeen"),
    );
    expect(counter).toContain('turn.role === "assistant"');
  });

  it("the name that started it is no longer a contact request", () => {
    // The compounding cause, pinned here too so the pair cannot regress apart.
    expect(hasDirectContactFollowUpRequest("They call me 6.")).toBe(false);
    expect(hasDirectContactFollowUpRequest("please call me back")).toBe(true);
  });
});
