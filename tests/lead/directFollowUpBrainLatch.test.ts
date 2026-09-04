import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasDirectContactFollowUpRequest,
  hasExplicitPersonalConnectionRequest,
} from "../../src/lib/buildInterestFlow";

const routeSource = () =>
  readFileSync(resolve(process.cwd(), "app/api/openai-chat-complete/route.ts"), "utf8");

describe("brain latch matches the client hand-raise", () => {
  it("recognizes the physical-session direct follow-up request", () => {
    const text = "have Scott reach out to me";
    expect(hasExplicitPersonalConnectionRequest(text)).toBe(false);
    expect(hasDirectContactFollowUpRequest(text)).toBe(true);
  });

  it.each([
    "the transcript said have Scott reach out to me",
    "She asked me to have Scott reach out to her",
    "you should have Scott reach out to me",
  ])("rejects reported speech or coaching: %s", (text) => {
    expect(hasDirectContactFollowUpRequest(text)).toBe(false);
  });

  it("uses both helpers on the user-history conversion latch", () => {
    const source = routeSource();
    expect(source).toMatch(
      /history\.filter\(\(turn\) => turn\.role === "user"\)/,
    );
    expect(source).toMatch(
      /hasExplicitPersonalConnectionRequest\(turn\)[\s\S]*\|\|[\s\S]*hasDirectContactFollowUpRequest\(turn\)/,
    );
  });
});
