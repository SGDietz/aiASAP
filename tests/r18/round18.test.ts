// Round 18 regressions (2026-06-11, G's 8:45 AM session — "lots to learn").
// Every case is his verbatim line or the exact failure it produced.
import { describe, it, expect } from "vitest";
import {
  accountSetupSpeechFlow,
  takesEmailFastPath,
  type SignupFlags,
} from "../../src/lib/signup/machine";
import { extractDeviceNameCandidate } from "../../src/lib/signup/helpers";
import { makeFakeWorld } from "../signup/fakePorts";
import { UI_SIZE_BIGGER_RE, UI_SIZE_SMALLER_RE } from "../../src/lib/uiSize";
import { parseReminder } from "../../src/lib/reminders/parse";
import { TIME_ASK_RE, spokenTimeNow } from "../../src/lib/timeAsk";

const FLAGS: SignupFlags = {
  accountBetaDisabled: false,
  emailTypedFallbackEnabled: false,
};

async function replayTurn(ports: any, userText: string): Promise<string> {
  if (takesEmailFastPath(ports, FLAGS, userText)) {
    if (await accountSetupSpeechFlow(ports, FLAGS, userText)) return "fastpath";
  }
  if (await accountSetupSpeechFlow(ports, FLAGS, userText)) return "handled";
  return "unhandled";
}

describe("ready gate: unsure answers advance (G 12:49, the dark chest box)", () => {
  it("\"I'm not sure. You tell me.\" moves to the spell step instead of stalling", async () => {
    const w = makeFakeWorld({ userName: "G" });
    await replayTurn(w.ports, "set up an account");
    expect(w.ports.awaitingReady).toBe(true);

    const result = await replayTurn(w.ports, "I'm not sure. You tell me.");
    expect(result).toBe("handled");
    expect(w.ports.awaitingReady).toBe(false);
    expect(w.ports.awaitingEmail).toBe(true);
    expect(w.said[w.said.length - 1]).toMatch(/spell your email slowly and I'll check/i);
    expect(w.effects).toContain("showChest");
  });

  it("unsure with no name yet asks the name first", async () => {
    const w = makeFakeWorld();
    await replayTurn(w.ports, "set up an account");
    // no-name trigger path asks the name immediately; answer it, then land
    // at the ready gate and go unsure.
    await replayTurn(w.ports, "my name is G");
    await replayTurn(w.ports, "I don't remember");
    expect(w.ports.awaitingEmail).toBe(true);
  });

  it("spelled letters pop on the chest live once the gate advances", async () => {
    const w = makeFakeWorld({ userName: "G" });
    await replayTurn(w.ports, "set up an account");
    await replayTurn(w.ports, "I'm not sure. You tell me.");
    await replayTurn(w.ports, "s g d");
    expect(w.effects.some((e) => e.startsWith("reveal:"))).toBe(true);
    expect(w.ports.chestText.toLowerCase()).toContain("sgd");
  });
});

describe("name catch: mid-clause \"I am\" never names the user (the \"Now\" bug)", () => {
  it("G verbatim: \"you're not gonna remember who I am now?\" captures nothing", () => {
    expect(
      extractDeviceNameCandidate(
        "Oh, so you mean you don't… you're not gonna remember who I am now?",
        false,
      ),
    ).toBeNull();
  });
  it("\"who I am\" inside any sentence captures nothing", () => {
    expect(extractDeviceNameCandidate("That's just who I am Kevin", false)).toBeNull();
  });
  it("clause-start intros still work", () => {
    expect(extractDeviceNameCandidate("Hi, I'm Kevin.", false)).toBe("Kevin");
    expect(extractDeviceNameCandidate("And I'm, um, Alice", false)).toBe("Alice");
    expect(extractDeviceNameCandidate("my name is, um, Kevin", false)).toBe("Kevin");
  });
});

describe("sizing: the coached follow-up matches (G said \"Bigger.\" and nothing moved)", () => {
  it("bare repeats match", () => {
    expect(UI_SIZE_BIGGER_RE.test("Bigger.")).toBe(true);
    expect(UI_SIZE_BIGGER_RE.test("bigger")).toBe(true);
    expect(UI_SIZE_BIGGER_RE.test("Even bigger!")).toBe(true);
    expect(UI_SIZE_BIGGER_RE.test("go bigger")).toBe(true);
    expect(UI_SIZE_SMALLER_RE.test("Smaller.")).toBe(true);
  });
  it("sentences that merely contain the word do not fire", () => {
    expect(UI_SIZE_BIGGER_RE.test("my dreams are bigger than ever")).toBe(false);
    expect(UI_SIZE_SMALLER_RE.test("the world feels smaller these days")).toBe(false);
  });
  it("regressions hold", () => {
    expect(UI_SIZE_BIGGER_RE.test("make it bigger")).toBe(true);
    expect(UI_SIZE_BIGGER_RE.test("I can't read the text. Can you make it larger?")).toBe(true);
  });
});

describe("reminder title: the saying-clause is the message (G's mangled 4th of July row)", () => {
  const now = new Date(2026, 5, 11, 8, 48, 0);
  it("G verbatim saves a clean title, right time, email channel flagged", () => {
    const parsed = parseReminder(
      "I need the reminder at 9 o'clock this morning. I need you to send me an email saying don't forget about 4th of July.",
      now,
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe("4th of July");
    expect(parsed!.dueAt?.getHours()).toBe(9);
    expect(parsed!.askedChannel).toBe("email");
  });
  it("plain reminders are untouched and carry no channel", () => {
    const parsed = parseReminder("remind me to call Bob tomorrow at 9", now);
    expect(parsed!.title).toBe("call Bob");
    expect(parsed!.askedChannel).toBeNull();
  });
  it("\"text me\" flags sms", () => {
    const parsed = parseReminder("text me at 5 to grab the kids", now);
    expect(parsed!.askedChannel).toBe("sms");
  });
});

describe("time ask: the app answers the clock (G: \"You should have the real time\")", () => {
  it("matches his verbatim asks", () => {
    expect(TIME_ASK_RE.test("Okay, can you, uh, what time is it? 6?")).toBe(true);
    expect(TIME_ASK_RE.test("Do you, do you know the real time?")).toBe(true);
  });
  it("leaves statements and scheduling to the brain", () => {
    expect(TIME_ASK_RE.test("You should have the real time.")).toBe(false);
    expect(TIME_ASK_RE.test("what time should I come over?")).toBe(false);
    expect(TIME_ASK_RE.test("remind me at 9 to take out the trash")).toBe(false);
  });
  it("speaks the exact clock in the user's zone", () => {
    expect(spokenTimeNow(new Date("2026-06-11T13:47:00Z"), "America/New_York")).toBe("It's 9:47 AM.");
    expect(spokenTimeNow(new Date("2026-06-11T13:47:00Z"), "not-a-zone")).toMatch(/^It's \d/);
  });
});
