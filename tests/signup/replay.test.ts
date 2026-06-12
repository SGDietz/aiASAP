// Replay harness, layer 2 (2026-06-10): scripted TRANSCRIPTS through the real
// signup machine. Each scenario is a conversation G actually had with 6 (or a
// bug he reported), replayed turn-by-turn with the same dispatch priority the
// component uses. No browser, no avatar, zero LiveAvatar credits.
import { describe, expect, it } from "vitest";
import {
  accountSetupSpeechFlow,
  takesEmailFastPath,
  type SignupFlags,
  type SignupPorts,
} from "../../src/lib/signup/machine";
import { hasEndSessionIntent } from "../../src/lib/signup/helpers";
import { makeFakeWorld } from "./fakePorts";

const FLAGS: SignupFlags = {
  accountBetaDisabled: false,
  emailTypedFallbackEnabled: false,
};

// Mirrors handleUserTranscription's signup-relevant routing order:
// email fast-path (with close-escape) → eager close → account flow.
type TurnResult = "fastpath" | "close" | "handled" | "unhandled";
async function replayTurn(
  ports: SignupPorts,
  userText: string,
): Promise<TurnResult> {
  if (takesEmailFastPath(ports, FLAGS, userText)) {
    if (await accountSetupSpeechFlow(ports, FLAGS, userText)) return "fastpath";
  }
  if (hasEndSessionIntent(userText)) return "close";
  if (await accountSetupSpeechFlow(ports, FLAGS, userText)) return "handled";
  return "unhandled";
}

describe("happy path — trigger → name → spell → confirm → consent → send", () => {
  it("walks the whole flow and sends exactly one link", async () => {
    const w = makeFakeWorld();

    await replayTurn(w.ports, "can you set up an account for me");
    expect(w.ports.awaitingName).toBe(true);
    expect(w.said.at(-1)).toBe("Love it. First - what should I call you?");

    await replayTurn(w.ports, "G");
    expect(w.ctx.userName).toBe("G");
    expect(w.ports.awaitingName).toBe(false);
    expect(w.ports.awaitingEmail).toBe(true);
    expect(w.said.at(-1)).toContain("Thanks, G.");

    await replayTurn(w.ports, "s g d i e t z");
    expect(w.ports.chestText).toBe("sgdietz");
    expect(w.said.at(-1)).toBe("Got it. Keep going.");

    await replayTurn(w.ports, "at pm dot me");
    expect(w.ports.chestText).toBe("sgdietz@pm.me");
    expect(w.ports.pendingEmail).toBe("sgdietz@pm.me");
    expect(w.said.at(-1)).toBe("Is the email on screen correct?");

    await replayTurn(w.ports, "yes");
    expect(w.ports.pendingEmail).toBe(null);
    expect(w.ports.awaitingSend).toBe(true);
    expect(w.ports.sendEmail).toBe("sgdietz@pm.me");
    expect(w.sentTo).toEqual([]); // confirmed ≠ sent — the send gate is separate
    expect(w.said.at(-1)).toBe(
      "Perfect. Want me to send the sign-in link to that email now?",
    );

    await replayTurn(w.ports, "Yes. Send the sign-in link");
    expect(w.sentTo).toEqual(["sgdietz@pm.me"]);
    expect(w.ports.awaitingSend).toBe(false);
  });
});

describe("name re-ask bug (G 2026-06-07) — a known name is never asked again", () => {
  it("goes offer → spell with no name question", async () => {
    const w = makeFakeWorld({ userName: "George" });

    await replayTurn(w.ports, "I want you to remember me next time");
    expect(w.ports.awaitingReady).toBe(true);
    expect(w.said.join(" ")).not.toMatch(/name/i);

    await replayTurn(w.ports, "yes, let's do it");
    expect(w.ports.awaitingName).toBe(false);
    expect(w.ports.awaitingEmail).toBe(true);
    expect(w.said.join(" ")).not.toMatch(/what should I call you|your name/i);
    expect(w.said.at(-1)).toContain("Spell your email slowly");
  });
});

describe("close-swallow (G 2026-06-03) — a real close escapes the email fast-path", () => {
  it("mid-spell 'close the session' routes to close, not to the email parser", async () => {
    const w = makeFakeWorld({ userName: "G" });
    await replayTurn(w.ports, "set up an account");
    await replayTurn(w.ports, "yes");
    await replayTurn(w.ports, "s g d"); // mid-spell
    expect(w.ports.awaitingEmail).toBe(true);

    const result = await replayTurn(w.ports, "close the session");
    expect(result).toBe("close");
    // The email machine never saw the close as letters:
    expect(w.ports.chestText).toBe("sgd");
  });

  it("a QUESTION about closing mid-spell neither closes nor derails signup", async () => {
    const w = makeFakeWorld({ userName: "G" });
    await replayTurn(w.ports, "set up an account");
    await replayTurn(w.ports, "yes");
    await replayTurn(w.ports, "s g d");

    const result = await replayTurn(
      w.ports,
      "let me ask you, if I close this site out, would you remember me next time",
    );
    expect(result).not.toBe("close");
    expect(w.ports.awaitingEmail).toBe(true); // still collecting the email
    expect(w.ports.chestText).toBe("sgd"); // question words never land in the box
  });
});

describe("'go ahead and send it' misfire — consent only counts at the gates", () => {
  it("does nothing when no signup is in flight", async () => {
    const w = makeFakeWorld();
    const result = await replayTurn(w.ports, "go ahead and send it");
    expect(result).toBe("unhandled");
    expect(w.sentTo).toEqual([]);
    expect(w.ports.awaitingSend).toBe(false);
    expect(w.ports.awaitingEmail).toBe(false);
  });

  it("a complaint that buries an okay never fires the send", async () => {
    const w = makeFakeWorld({ userName: "G" });
    await replayTurn(w.ports, "set up an account");
    await replayTurn(w.ports, "yes");
    await replayTurn(w.ports, "s g d i e t z at pm dot me");
    expect(w.ports.pendingEmail).toBe("sgdietz@pm.me");

    await replayTurn(w.ports, "Okay, so the box says SGDeets@email.it");
    expect(w.sentTo).toEqual([]);
    expect(w.ports.awaitingSend).toBe(false);
  });
});

describe("signed-in user (G 2026-06-03) — signup machine is fully inert", () => {
  it("ignores account-setup speech after sign-in", async () => {
    const w = makeFakeWorld({ signedIn: true, userName: "G" });
    const result = await replayTurn(w.ports, "set up an account");
    expect(result).toBe("unhandled");
    expect(w.ports.awaitingName).toBe(false);
    expect(w.ports.awaitingReady).toBe(false);
    expect(w.said).toEqual([]);
  });
});

describe("rejected email — clean re-spell, never carried forward", () => {
  it("'no' clears the box and a fresh spell confirms the new address", async () => {
    const w = makeFakeWorld({ userName: "G" });
    await replayTurn(w.ports, "set up an account");
    await replayTurn(w.ports, "yes");
    await replayTurn(w.ports, "s g d i e t z at pm dot me");
    expect(w.ports.pendingEmail).toBe("sgdietz@pm.me");

    await replayTurn(w.ports, "no, that's wrong");
    expect(w.ports.pendingEmail).toBe(null);
    expect(w.ports.rejectedEmail).toBe("sgdietz@pm.me");
    expect(w.ports.awaitingEmail).toBe(true);
    expect(w.ports.chestText).toBe("");
    expect(w.said.at(-1)).toBe("Okay, let's try again. Please spell it slowly.");

    await replayTurn(w.ports, "g d i e t z at gmail dot com");
    expect(w.ports.pendingEmail).toBe("gdietz@gmail.com");
    expect(w.said.at(-1)).toBe("Is the email on screen correct?");
  });

  it("domain-only correction keeps the local part (typed/clean path)", async () => {
    const w = makeFakeWorld({ userName: "G" });
    await replayTurn(w.ports, "set up an account");
    await replayTurn(w.ports, "yes");
    await replayTurn(w.ports, "sgdietz@gmail.com");
    expect(w.ports.pendingEmail).toBe("sgdietz@gmail.com");

    await replayTurn(w.ports, "wrong domain, it's pm dot me");
    expect(w.ports.pendingEmail).toBe("sgdietz@pm.me");
  });
});

describe("send gate — no means no, silence rules while 6 talks", () => {
  it("'no, don't send it' holds off and nothing ever sends", async () => {
    const w = makeFakeWorld({ userName: "G" });
    await replayTurn(w.ports, "set up an account");
    await replayTurn(w.ports, "yes");
    await replayTurn(w.ports, "s g d i e t z at pm dot me");
    await replayTurn(w.ports, "yes");
    expect(w.ports.awaitingSend).toBe(true);

    await replayTurn(w.ports, "no, don't send it");
    expect(w.ports.awaitingSend).toBe(false);
    expect(w.ports.sendEmail).toBe(null);
    expect(w.sentTo).toEqual([]);
    expect(w.said.at(-1)).toContain("I'll hold off");
  });

  it("while 6 is talking the machine moves state but stays silent", async () => {
    const w = makeFakeWorld({ userName: "G" });
    await replayTurn(w.ports, "set up an account");
    await replayTurn(w.ports, "yes");
    await replayTurn(w.ports, "s g d i e t z at pm dot me");

    w.ctx.avatarTalking = true;
    const saidBefore = w.said.length;
    await replayTurn(w.ports, "yes");
    expect(w.ports.awaitingSend).toBe(true); // state advanced
    expect(w.said.length).toBe(saidBefore); // no competing voice over 6
  });
});

describe("G's real smoke transcript, 2026-06-10 12:01 — inline email at the ready gate", () => {
  // This is the verbatim flow that broke: the email went out via the silent
  // server fallback and nothing announced the send. With the ready-gate fix
  // the scripted path handles it end-to-end — announcement included.
  it("replays G's turns and the CLIENT path sends with an announcement", async () => {
    const w = makeFakeWorld({ userName: "G" }); // "My name is G" was caught pre-trigger

    await replayTurn(w.ports, "Set up an account.");
    expect(w.ports.awaitingReady).toBe(true);

    // 2026-06-10 (later the same day): "First time signing up." used to stall
    // the gate (neither yes nor no) — now it ADVANCES to the email step.
    const r = await replayTurn(w.ports, "First time signing up.");
    expect(r).toBe("handled");
    expect(w.ports.awaitingEmail).toBe(true);

    // The inline email still lands cleanly at the email step.
    await replayTurn(w.ports, "wildworks@pm.me.");
    expect(w.ports.pendingEmail).toBe("wildworks@pm.me");
    expect(w.said.at(-1)).toBe("Is the email on screen correct?");

    await replayTurn(w.ports, "Yes, it is.");
    expect(w.ports.awaitingSend).toBe(true);
    expect(w.said.at(-1)).toBe(
      "Perfect. Want me to send the sign-in link to that email now?",
    );

    await replayTurn(w.ports, "Yes, send the sign-in link.");
    expect(w.sentTo).toEqual(["wildworks@pm.me"]); // client path = announced path
  });
});

describe("G's 13:11 session (tracer find) — first-time answer must move the gate", () => {
  // The brain asked "first time signing up, or already have an account?" while
  // the machine sat at the ready gate. "Uh, first time signing up." matched
  // neither yes nor no → machine stalled ARMED → brain freelanced everything.
  it("'first time signing up' at the ready gate advances to the email step", async () => {
    const w = makeFakeWorld({ userName: "G" });

    await replayTurn(w.ports, "I, I want to create an account.");
    expect(w.ports.awaitingReady).toBe(true);

    const r = await replayTurn(w.ports, "Uh, first time signing up.");
    expect(r).not.toBe("unhandled"); // THE stall — must be handled now
    expect(w.ports.awaitingReady).toBe(false);
    expect(w.ports.awaitingEmail).toBe(true);
    expect(w.said.at(-1)).toContain("Spell your email slowly");

    await replayTurn(w.ports, "sgdietz@pm.me.");
    expect(w.ports.pendingEmail).toBe("sgdietz@pm.me");

    await replayTurn(w.ports, "Yes, it is.");
    expect(w.ports.awaitingSend).toBe(true);

    await replayTurn(w.ports, "Go ahead.");
    expect(w.sentTo).toEqual(["sgdietz@pm.me"]);
  });

  it("'I already have an account' also advances (returning = same link flow)", async () => {
    const w = makeFakeWorld({ userName: "G" });
    await replayTurn(w.ports, "set up an account");
    await replayTurn(w.ports, "I already have an account");
    expect(w.ports.awaitingEmail).toBe(true);
  });

  it("changing the email mid-flow lands the LAST address (G's triple change)", async () => {
    const w = makeFakeWorld({ userName: "G" });
    await replayTurn(w.ports, "create an account");
    await replayTurn(w.ports, "first time signing up");
    await replayTurn(w.ports, "sgdietz@pm.me");
    expect(w.ports.pendingEmail).toBe("sgdietz@pm.me");
    // User changes their mind before confirming — typed/clean path may swap.
    await replayTurn(w.ports, "Actually, it'll be wildworks@pm.me.");
    expect(w.ports.pendingEmail).toBe("wildworks@pm.me");
    await replayTurn(w.ports, "Yes, it is.");
    await replayTurn(w.ports, "go ahead and send it");
    expect(w.sentTo).toEqual(["wildworks@pm.me"]);
  });
});

describe("Kevin's 14:07 session — the name trap is gone", () => {
  it("a chatty sentence at the name step passes to the brain, gate stays armed", async () => {
    const w = makeFakeWorld(); // no name known
    await replayTurn(w.ports, "set up an account");
    expect(w.ports.awaitingName).toBe(true);

    const r = await replayTurn(
      w.ports,
      "Go ahead, what were you saying, Six? I'm not mad at you, buddy.",
    );
    expect(r).toBe("unhandled"); // brain answers; no "didn't catch your name" loop
    expect(w.ports.awaitingName).toBe(true);
  });

  it("an email given at the NAME step is taken as the email — never trapped", async () => {
    const w = makeFakeWorld();
    await replayTurn(w.ports, "set up an account");
    expect(w.ports.awaitingName).toBe(true);

    await replayTurn(w.ports, "sgdietz@pm.me.");
    expect(w.ports.awaitingName).toBe(false);
    expect(w.ports.pendingEmail).toBe("sgdietz@pm.me");
    // Inline address gets the typewriter reveal too (G: "those typewriter sounds")
    expect(w.effects.some((e) => e.startsWith("reveal:+sgdietz@pm.me") || e === "reveal:+sgdietz@pm.me" || e.includes("reveal:"))).toBe(true);

    await replayTurn(w.ports, "Yes.");
    expect(w.ports.awaitingSend).toBe(true);

    await replayTurn(w.ports, "Send the email.");
    expect(w.sentTo).toEqual(["sgdietz@pm.me"]);
  });
});

describe("decline — every exit leaves the machine fully disarmed", () => {
  it("'not now' at the offer cleans up", async () => {
    const w = makeFakeWorld({ userName: "G" });
    await replayTurn(w.ports, "set up an account");
    expect(w.ports.awaitingReady).toBe(true);

    await replayTurn(w.ports, "not now");
    expect(w.ports.awaitingReady).toBe(false);
    expect(w.ports.awaitingEmail).toBe(false);
    expect(w.ports.declinedAt).toBeGreaterThan(0);
    expect(w.said.at(-1)).toContain("No problem.");
  });

  it("a cancel at the NAME step never traps the user (G 2026-06-01 FIX C)", async () => {
    const w = makeFakeWorld();
    await replayTurn(w.ports, "set up an account");
    expect(w.ports.awaitingName).toBe(true);

    await replayTurn(w.ports, "never mind, not now");
    expect(w.ports.awaitingName).toBe(false);
    expect(w.ports.awaitingEmail).toBe(false);
    expect(w.said.at(-1)).toContain("No problem.");
  });
});

describe("Julius's 18:47 session (ghost email #3) — 'my email is X.' must capture", () => {
  it("an inline address after lead-in chatter, with the sentence period, lands", async () => {
    const w = makeFakeWorld({ userName: "Julius" });
    await replayTurn(w.ports, "Okay, can I, can I create an account?");
    await replayTurn(w.ports, "First time signing up.");
    expect(w.ports.awaitingEmail).toBe(true);

    // The verbatim rant that ghosted: lead-in "is " + trailing period.
    await replayTurn(
      w.ports,
      "Okay, Claude, I'm talking to you, Claude. I'm not talking to you, Six. Okay, my email is sgdietz@pm.me.",
    );
    expect(w.ports.pendingEmail).toBe("sgdietz@pm.me");

    // "It is correct." — G's natural confirm — must advance to the send gate.
    await replayTurn(w.ports, "It is correct.");
    expect(w.ports.awaitingSend).toBe(true);

    await replayTurn(w.ports, "Send the email.");
    expect(w.sentTo).toEqual(["sgdietz@pm.me"]);
  });

  it("the never-guess guard still bails on a real glued spell prefix", async () => {
    const { extractSpokenEmailCandidate } = await import(
      "../../src/lib/signup/helpers"
    );
    expect(extractSpokenEmailCandidate("Okay, it's SGD IETZ@pm.me")).toBe(null);
    expect(
      extractSpokenEmailCandidate("my email is sgdietz@pm.me."),
    ).toBe("sgdietz@pm.me");
  });
});

describe("CONSENT_COMPLAINT_RE — the 'at' trap (2026-06-10)", () => {
  it("rejects 'yes at pm dot me' at the confirm gate (email-description trap)", async () => {
    const w = makeFakeWorld({ userName: "G" });

    // Setup: arrive at the email-confirm gate with a pending email
    w.ports.awaitingEmail = false;
    w.ports.awaitingReady = false;
    w.ports.pendingEmail = "sgdietz@pm.me";
    w.ports.setChestDisplay("sgdietz@pm.me");

    // User says "yes at pm dot me" — describing their email address, not confirming
    const result = await replayTurn(w.ports, "yes at pm dot me");

    // EXPECTED: should reject the 'at' as a complaint/screen description
    // and NOT move to the send gate. Should ask for clarification.
    // (With a pendingEmail armed, the turn legitimately routes via the email
    // fast-path — both labels mean "the machine took the turn".)
    expect(["handled", "fastpath"]).toContain(result);
    expect(w.ports.awaitingSend).toBe(false);
    expect(w.ports.pendingEmail).toBe("sgdietz@pm.me"); // still pending, not confirmed
    expect(w.said.at(-1)).toContain("yes or no");
  });
});
