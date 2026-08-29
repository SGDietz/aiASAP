// STT echo guard (2026-06-11). G's wildworks signup, 01:44Z: his single
// "Perfect." was delivered TWICE by the speech pipeline. The first confirmed
// the email was correct and armed the send gate; the duplicate one beat later
// hit the armed gate as send consent — the link was mailed BEFORE 6 even
// finished asking ("You sent it without me giving you permission"). The exact
// utterance that arms the gate must never also fire it inside the echo window.
import { describe, expect, it } from "vitest";
import {
  accountSetupSpeechFlow,
  takesEmailFastPath,
  type SignupFlags,
  type SignupPorts,
} from "../../src/lib/signup/machine";
import { hasEndSessionIntent } from "../../src/lib/signup/helpers";
import { makeFakeWorld } from "./fakePorts";
import {
  isDuplicateUtterance,
  normalizeUtterance,
} from "../../src/lib/speech/dedupe";

const FLAGS: SignupFlags = {
  accountBetaDisabled: false,
  emailTypedFallbackEnabled: false,
};

async function replayTurn(ports: SignupPorts, userText: string) {
  if (takesEmailFastPath(ports, FLAGS, userText)) {
    if (await accountSetupSpeechFlow(ports, FLAGS, userText)) return "fastpath";
  }
  if (hasEndSessionIntent(userText)) return "close";
  if (await accountSetupSpeechFlow(ports, FLAGS, userText)) return "handled";
  return "unhandled";
}

describe("G's verbatim wildworks transcript — duplicated 'Perfect.'", () => {
  it("the echo cannot fire the send gate; a real consent later can", async () => {
    const w = makeFakeWorld();

    await replayTurn(w.ports, "So yeah, okay, set up an account.");
    await replayTurn(w.ports, "First time signing up.");
    await replayTurn(w.ports, "Scott.");
    expect(w.ctx.userName).toBe("Scott");

    await replayTurn(w.ports, "w i l d w o r k s");
    await replayTurn(w.ports, "at pm dot me");
    expect(w.ports.pendingEmail).toBe("wildworks@pm.me");

    // G rambles, then confirms correctness: "Perfect."
    await replayTurn(
      w.ports,
      "Okay, so you said that really in a fucked up way. Like, I could never understand that. Um, but what's written on the screen is",
    );
    await replayTurn(w.ports, "Perfect.");
    expect(w.ports.awaitingSend).toBe(true);
    expect(w.sentTo).toEqual([]);

    // THE BUG: the STT echo of the same "Perfect." one beat later. Clock is
    // frozen → inside the echo window. Must NOT send.
    await replayTurn(w.ports, "Perfect.");
    expect(w.sentTo).toEqual([]);
    expect(w.ports.awaitingSend).toBe(true);

    // A real consent — different words, after 6's ask — sends exactly once.
    w.clock.ms += 6000;
    await replayTurn(w.ports, "Yes, send it.");
    expect(w.sentTo).toEqual(["wildworks@pm.me"]);
    expect(w.ports.awaitingSend).toBe(false);
  });

  it("the arming words never send, even when a provider echo is delayed", async () => {
    const w = makeFakeWorld();
    await replayTurn(w.ports, "set up an account");
    await replayTurn(w.ports, "first time");
    await replayTurn(w.ports, "Scott");
    await replayTurn(w.ports, "w i l d w o r k s at pm dot me");
    expect(w.ports.pendingEmail).toBe("wildworks@pm.me");
    await replayTurn(w.ports, "Perfect.");
    expect(w.ports.awaitingSend).toBe(true);
    expect(w.ports.sendEmail).toBe("wildworks@pm.me");
    expect(w.ports.confirmedEmail).toBe("wildworks@pm.me");

    // Provider echoes can arrive well after a short timer. Identical arming
    // words still cannot become send consent; a distinct utterance is required.
    w.clock.ms += 6000;
    await replayTurn(w.ports, "Perfect.");
    expect(w.ports.awaitingSend).toBe(true);
    expect(w.sentTo).toEqual([]);

    await replayTurn(w.ports, "Yes, send it.");
    expect(w.ports.awaitingSend).toBe(false);
    expect(w.sentTo).toEqual(["wildworks@pm.me"]);
  });
});

describe("dispatcher-level STT dedupe", () => {
  it("normalized-identical inside the window = echo", () => {
    expect(isDuplicateUtterance("Perfect.", 1000, "Perfect.", 2000)).toBe(true);
    expect(isDuplicateUtterance("Make it bigger.", 1000, "make it bigger", 2500)).toBe(true);
  });
  it("never treats provider trailing shards as duplicate turns", () => {
    expect(
      isDuplicateUtterance(
        "I want to set up an account.",
        1000,
        "an account.",
        1700,
      ),
    ).toBe(false);
    expect(
      isDuplicateUtterance(
        "Please read me back my email.",
        1000,
        "my email.",
        1700,
      ),
    ).toBe(false);
  });
  it("outside the window or different text = not an echo", () => {
    expect(isDuplicateUtterance("Perfect.", 1000, "Perfect.", 4500)).toBe(false);
    expect(isDuplicateUtterance("Perfect.", 1000, "Yes.", 1500)).toBe(false);
    expect(isDuplicateUtterance("Open my account.", 1000, "Account settings.", 1500)).toBe(false);
    expect(isDuplicateUtterance(null, 0, "Perfect.", 1000)).toBe(false);
  });
  it("normalization strips case, punctuation, and spacing without erasing Unicode", () => {
    expect(normalizeUtterance("  Make it BIGGER!! ")).toBe("makeitbigger");
    expect(normalizeUtterance("perfect")).toBe(normalizeUtterance("Perfect."));
    expect(normalizeUtterance("你好，朋友！")).toBe("你好朋友");
    expect(isDuplicateUtterance("你好，朋友！", 1000, "你好朋友", 1500)).toBe(
      true,
    );
    expect(isDuplicateUtterance("你好", 1000, "再见", 1500)).toBe(false);
  });
});
