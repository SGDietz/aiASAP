import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  antiRepeatNudge,
  findReusedRun,
  recentAssistantLines,
} from "../../src/lib/brain/antiRepeat";

// Ride 755f063f, 2026-09-05 08:36-08:38 - 6's actual lines.
const PRIORS = [
  "Take your time, Scott—whenever you’re ready, just tell me what you love doing.",
  "I’m here to listen whenever you’re ready to say more about what you love and what you do well.",
  "Take your time, Scott—no rush. When you’re ready, tell me what part of this really lights you up.",
];

describe("anti-repeat, in code", () => {
  it("catches the stock filler 6 leaned on all ride", () => {
    expect(findReusedRun("Take your time. Tell me about what’s catching your interest.", PRIORS)).toBe(
      "take your time",
    );
    expect(
      findReusedRun("Whenever you’re ready, just tell me what you love doing, Scott.", PRIORS),
    ).toBe("whenever youre ready");
    expect(findReusedRun("Take your time, Scott—no rush at all today.", PRIORS)).toBe(
      "take your time",
    );
    // A stock line is reuse on its own, even with different words around it.
    expect(findReusedRun("No rush, Scott. Which part of the website matters most?", PRIORS)).toBe(
      "no rush",
    );
    // Longer shared runs are still caught without any stock phrase.
    // "what part of" is a stock phrase since ride f225a5c7 (nine times in one
    // ride), so it is caught before the five-word run detector even looks.
    expect(
      findReusedRun("Right - what part of this really lights you up, Scott?", PRIORS),
    ).toBe("what part of");
  });

  it("lets the brand repeat, but not the discovery question in the same words", () => {
    // RIDE c25f52ab 2026-09-05: "what do you love doing most" five times in four
    // minutes, after the person had already answered. The doctrine exemption is
    // gone - a repeat goes back for a fresh phrasing like any other line.
    const doctrine = ["So, what do you love doing most in this world?"];
    expect(findReusedRun("Right. What do you love doing most, Scott?", doctrine)).toBe(
      "what do you love doing",
    );
    const brand = ["The team here at aiASAP builds the system around it."];
    expect(findReusedRun("And the team here at aiASAP shapes the offer.", brand)).toBeNull();
  });

  it("does not flag a fresh reply or a short one", () => {
    expect(findReusedRun("Good. Are you running a business today, or starting from zero?", PRIORS)).toBeNull();
    expect(findReusedRun("Take your time.", [])).toBeNull();
    expect(findReusedRun("anything", [])).toBeNull();
  });

  it("names the run in the nudge and looks back three lines only", () => {
    expect(antiRepeatNudge("take your time scott no")).toContain('"take your time scott no"');
    const history = [
      { role: "assistant", content: "one" },
      { role: "user", content: "x" },
      { role: "assistant", content: "two" },
      { role: "assistant", content: "three" },
      { role: "assistant", content: "four" },
    ];
    expect(recentAssistantLines(history)).toEqual(["two", "three", "four"]);
  });

  it("is wired into the brain route as one bounded retry", () => {
    const route = readFileSync(
      resolve(process.cwd(), "app/api/openai-chat-complete/route.ts"),
      "utf8",
    );
    expect(route).toContain("await freshenIfRepeated(draftResponse, messages, recentAssistantLines(history))");
    expect(route).toContain("if (findReusedRun(retryText, recentSixLines)) {");
    expect(route.match(/anti-repeat retry/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
