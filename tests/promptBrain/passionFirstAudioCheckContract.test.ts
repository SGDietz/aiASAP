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
    // "At the next natural pause" was the 08-23 replacement wording and it
    // drifted the other way: G's ride 2026-09-04, passion answer at 17:07,
    // ask at 17:11 - twenty turns on, glued to the word "so". The rule now
    // carries an edge you can count, and the route enforces it in code
    // (src/lib/nameAskWhisper.ts, tests/lead/nameAskTiming.test.ts).
    expect(SIX_SYSTEM_PROMPT).not.toContain("at the next natural pause");
    expect(SIX_SYSTEM_PROMPT).toContain(
      "WITHIN YOUR NEXT TWO REPLIES AFTER THAT ANSWER - NOT LATER",
    );
    expect(SIX_SYSTEM_PROMPT).toContain(
      'weave in "And what should I call you?" inside your next two replies',
    );
    // And never on a scrap - that is how it went out last time.
    expect(SIX_SYSTEM_PROMPT).toContain("ASK IT ON A WHOLE TURN, NEVER ON A SCRAP");
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
    // 2026-09-04: the opener text is DELIBERATELY NOT in the prompt any more.
    // It was, and 6 copied it - twice as a "demo" on 09-03, then the whole
    // line six minutes into a conversation on 09-04 (the transcript row carries
    // an utterance_id, so it was a REPLY, not the app). Three prohibitions did
    // not stop him while the words sat there to copy. A line he cannot see is a
    // line he cannot repeat. The greeting is locked in the COMPONENT, which is
    // where it is actually spoken from.
    expect(SIX_SYSTEM_PROMPT).not.toContain(
      "6 here. Tell me what you love doing",
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
