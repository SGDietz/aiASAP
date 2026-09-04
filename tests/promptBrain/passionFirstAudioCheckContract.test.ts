import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SIX_SYSTEM_PROMPT } from "../../src/lib/brain/sixSystemPrompt";

const plain = fs
  .readFileSync(
    path.join(process.cwd(), "tools/cw_6af8624c_prompt.txt"),
    "utf8",
  )
  .replace(/\r\n/g, "\n");

describe("Six passion-first and audio-check prompt contract", () => {
  it("keeps the plain and runtime prompt authorities synchronized", () => {
    expect(SIX_SYSTEM_PROMPT).toBe(plain);
  });

  it("removes the forced second-reply name ask and waits for a real passion answer", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("Passion comes first:");
    expect(SIX_SYSTEM_PROMPT).toContain(
      "do not ask for it on a fixed turn count either",
    );
    expect(SIX_SYSTEM_PROMPT).toContain(
      'weave in "And what should I call you?" at the next natural pause',
    );
    expect(SIX_SYSTEM_PROMPT).not.toContain(
      "By your SECOND generated response after the opening",
    );
    expect(SIX_SYSTEM_PROMPT).not.toContain(
      '"Before we go further, what should I call you?"',
    );
  });

  it("answers audio checks briefly before resuming discovery", () => {
    expect(SIX_SYSTEM_PROMPT).toContain(
      "## AUDIO-CHECK QUESTIONS GET A DIRECT ANSWER FIRST",
    );
    expect(SIX_SYSTEM_PROMPT).toContain('"can you hear me,"');
    expect(SIX_SYSTEM_PROMPT).toContain(
      "answer that directly and briefly first",
    );
    expect(SIX_SYSTEM_PROMPT).toContain(
      "THEN smoothly pick back up whatever discovery thread was already in progress",
    );
  });

  it("preserves the opening, send-link truth, and starting-price anchors", () => {
    expect(SIX_SYSTEM_PROMPT).toContain(
      "6 here. Tell me what you feel passionate about, and what you're good at. Together, we're gonna build a money-making machine that's gonna set you free to live the life you want to live. First, tell me what you love doing most in this world.",
    );
    expect(SIX_SYSTEM_PROMPT).not.toContain(
      "6 here, ready to Turbo Charge Your Life.",
    );
    expect(SIX_SYSTEM_PROMPT).toContain(
      "Want me to send the sign-in link now?",
    );
    expect(SIX_SYSTEM_PROMPT).toContain(
      "NEVER claim the link was sent",
    );
    expect(SIX_SYSTEM_PROMPT).toContain("custom avatar salesperson starts at $3,000");
    expect(SIX_SYSTEM_PROMPT).toContain("full website starts at $5,000");
    expect(SIX_SYSTEM_PROMPT).toContain("starting points, never rigid guaranteed totals");
    expect(SIX_SYSTEM_PROMPT).toContain("cost-plus-10% policy");
  });
});
