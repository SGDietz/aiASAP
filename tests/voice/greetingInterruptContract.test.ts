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
      "6 here. Tell me what you love doing and what you know. Together, we're gonna build a money-making machine.";
    expect(source).toContain(exact);
    expect(source).toContain("claimSessionGreeting(anonymousGreetingSpokenRef)");
    expect(source).toContain("greeting = claimedGreeting ? VOICE_START_GREETING : null");
  });

  it("does not inject a second greeting or question after interruption", () => {
    expect(source).not.toContain("GREETING_COMPLETION_POOL");
    expect(source).not.toContain("pickGreetingCompletion");
    expect(source).not.toContain("Greeting completion injection failed");
    expect(source).not.toContain("greetingCompletionPendingRef");
  });
});
