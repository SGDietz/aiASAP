import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(__dirname, "../../src/components/LiveAvatarSession.tsx"),
  "utf8",
);

describe("exact one-line opener contract", () => {
  it("keeps the exact opener behind the one-per-session claim", () => {
    const exact =
      "6 here. Tell me what you feel passionate about, and what you're good at. Together, we're gonna build a money-making machine that's gonna set you free to live the life you want to live. First, tell me what you love doing most in this world.";
    expect(source).toContain(exact);
    expect(source).toContain("claimSessionGreeting(anonymousGreetingSpokenRef)");
    expect(source).toContain("greeting = claimedGreeting ? VOICE_START_GREETING : null");
  });

  it("finishes the opener instead of letting noise cut it", () => {
    // G, 2026-09-03 after ride cf79a533 ("the avatar jumps in, jumps back out,
    // and then jumps in"): "always finish the intro line just like iScott. You
    // can pause if people interrupt him or if there's a noise, but then he
    // should just keep going."
    expect(source).toContain("openerInFlightRef");
    expect(source).toContain('suppressed: "opener_in_flight"');
    // the latch is armed before the line and released the moment it lands
    expect(source).toMatch(/openerInFlightRef\.current = true;[\s\S]{0,1200}await repeat\(greeting, null\)/);
    expect(source).toMatch(/await repeat\(greeting, null\)[\s\S]{0,600}openerInFlightRef\.current = false;/);
    // and it is bounded, so a stuck opener cannot mute barge-in for the ride
    expect(source).toContain("Math.min(16000,");
  });

  it("does not inject a second greeting or question after interruption", () => {
    expect(source).not.toContain("GREETING_COMPLETION_POOL");
    expect(source).not.toContain("pickGreetingCompletion");
    expect(source).not.toContain("Greeting completion injection failed");
    expect(source).not.toContain("greetingCompletionPendingRef");
  });
});
