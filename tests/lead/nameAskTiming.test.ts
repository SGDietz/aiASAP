import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  shouldAskForNameNow,
  isSubstantialTurn,
  NAME_ASK_RE,
} from "../../src/lib/nameAskWhisper";

type Turn = { role: "user" | "assistant"; content: string };

const base = {
  knownName: null,
  signedInEmail: null,
  listMode: false,
};

/**
 * G's real ride, 2026-09-04, from Supabase conversation_messages. He answered
 * the passion question at 17:07:12 and again, concretely, at 17:08:48 - and
 * "What should I call you?" did not arrive until 17:11:07, about twenty turns
 * later, attached to the single word "so".
 *
 * G, same day: "fix the call you name thing."
 */
const RIDE: Turn[] = [
  { role: "assistant", content: "6 here. Tell me what you love doing, and what you're good at, what you know." },
  { role: "user", content: "that's great I love building things" },
  { role: "assistant", content: "Building things lights you up - that's a great start. What kind of things?" },
  { role: "user", content: "I build stone walls with boulders." },
];

describe("6 asks for the name promptly, on a whole turn", () => {
  it("does NOT ask before they have said anything real", () => {
    expect(
      shouldAskForNameNow({
        ...base,
        history: [{ role: "assistant", content: "6 here. Tell me what you love doing." }],
        message: "hi",
      }),
    ).toBe(false);
  });

  it("asks once a real answer has landed - not twenty turns later", () => {
    expect(
      shouldAskForNameNow({ ...base, history: RIDE, message: "Well, nobody pays me to do it yet." }),
    ).toBe(true);
  });

  it("never lands the ask on a scrap - the exact 17:11 failure", () => {
    // The turn that actually triggered it on his ride was the word "so".
    for (const scrap of ["so", "um", "and", "well", "so after the brand"]) {
      expect(
        shouldAskForNameNow({ ...base, history: RIDE, message: scrap }),
      ).toBe(false);
    }
  });

  it("does not ask twice", () => {
    const asked: Turn[] = [
      ...RIDE,
      { role: "assistant", content: "Good. What should I call you?" },
      { role: "user", content: "I do not want to give my name right now" },
    ];
    expect(
      shouldAskForNameNow({ ...base, history: asked, message: "let us keep going with the walls" }),
    ).toBe(false);
  });

  it("never asks a visitor we can already name", () => {
    const args = { ...base, history: RIDE, message: "Well, nobody pays me to do it yet." };
    expect(shouldAskForNameNow({ ...args, knownName: "Scott" })).toBe(false);
    expect(shouldAskForNameNow({ ...args, signedInEmail: "g@example.com" })).toBe(false);
    // Voice-only over a full-screen list: 6 stays on the list, one short line.
    expect(shouldAskForNameNow({ ...args, listMode: true })).toBe(false);
  });

  it("recognises 6's own ask in every shape he writes it", () => {
    for (const line of [
      "Good. What should I call you?",
      "And what should I call you?",
      "Real quick - what's your name?",
      "what do i call you",
    ]) {
      expect(NAME_ASK_RE.test(line)).toBe(true);
    }
    // The visitor saying a name is not 6 asking for one.
    expect(NAME_ASK_RE.test("I build stone walls with boulders.")).toBe(false);
  });

  it("counts a real answer at five words, the transcript's own floor", () => {
    expect(isSubstantialTurn("I build stone walls with boulders")).toBe(true);
    expect(isSubstantialTurn("so")).toBe(false);
    expect(isSubstantialTurn("   ")).toBe(false);
  });

  it("is wired into the chat route, not just defined", () => {
    const src = readFileSync(
      resolve(process.cwd(), "app/api/openai-chat-complete/route.ts"),
      "utf8",
    );
    expect(src).toContain("shouldAskForNameNow({");
    expect(src).toContain("systemSections.push(NAME_ASK_WHISPER)");
    // The opposite half of the rule must survive alongside it.
    expect(src).toContain("NEVER ask for their name");
  });
});
