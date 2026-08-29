// Replay harness, layer 1 (2026-06-10): the pure helpers that decide what 6
// does during verbal signup. Every case below is a REAL transcript shape from
// G's bug reports (dates in the comments match the fix notes in helpers.ts).
import { describe, expect, it } from "vitest";
import { extractContactDetails } from "../../src/lib/contactExtraction";
import {
  buildAccountMemoryOffer,
  confirmsEndSession,
  extractDeviceNameCandidate,
  extractSpokenEmailCandidate,
  hasEmailCorrectionIntent,
  hasEndSessionIntent,
  isDirectAvatarStopCommand,
  hasExplicitAccountSendOnCloseIntent,
  isAccountConsentYes,
  isInternalSignal,
  isStitchedSessionClose,
  isJunkPersonName,
  mergeEmailDomainCorrection,
  parseEmailFromAvatarReadback,
  parseSpelledEmailChunk,
  ACCOUNT_MEMORY_VALUE_LINES,
} from "../../src/lib/signup/helpers";

describe("isAccountConsentYes — the send/confirm gates (G 2026-06-09 misfires)", () => {
  it("accepts a real yes with a send tail", () => {
    expect(isAccountConsentYes("Yes. Send the sign-in link")).toBe(true);
  });
  it("accepts go-ahead phrasings", () => {
    expect(isAccountConsentYes("go ahead and send it")).toBe(true);
    expect(isAccountConsentYes("sure")).toBe(true);
    expect(isAccountConsentYes("perfect")).toBe(true);
  });
  it("rejects a complaint that buries an okay (the box-says misfire)", () => {
    expect(isAccountConsentYes("Okay, so the box says SGDeets@email.it")).toBe(
      false,
    );
  });
  it("rejects doubt even when it contains 'right'", () => {
    expect(isAccountConsentYes("yeah, I don't think that's right")).toBe(false);
  });
  it("rejects a plain no / hold off", () => {
    expect(isAccountConsentYes("no, don't send it")).toBe(false);
    expect(isAccountConsentYes("wait, hold on")).toBe(false);
  });
  it("rejects screen descriptions that open affirmatively", () => {
    expect(isAccountConsentYes("Okay so your email is on the screen")).toBe(
      false,
    );
  });
  it("SWEEP 2026-06-10: filler commas and salty openers still consent", () => {
    expect(isAccountConsentYes("um, yes")).toBe(true);
    expect(isAccountConsentYes("well, um, okay")).toBe(true);
    expect(isAccountConsentYes("fuck yes, send it")).toBe(true);
    // and the complaint guard still wins over any opener:
    expect(isAccountConsentYes("um, yes but the box says sgd@email.it")).toBe(
      false,
    );
  });
});

describe("hasEndSessionIntent — close must escape the email fast-path (G 2026-06-03)", () => {
  it("a clear close is a close, mid-signup or not", () => {
    expect(hasEndSessionIntent("close the session")).toBe(true);
    expect(hasEndSessionIntent("close this site out")).toBe(true);
    expect(hasEndSessionIntent("stop the conversation")).toBe(true);
  });
  it("a QUESTION about closing never closes (the if-I-close bug)", () => {
    expect(
      hasEndSessionIntent(
        "let me ask you, if I close this site out, would you remember me next time",
      ),
    ).toBe(false);
    expect(hasEndSessionIntent("how do I close the session")).toBe(false);
  });
  it("closing a LIST or a MODE is not closing the session", () => {
    expect(hasEndSessionIntent("close the list")).toBe(false);
    expect(hasEndSessionIntent("close shopping mode")).toBe(false);
  });
  it("internal silence signals never close", () => {
    expect(hasEndSessionIntent("[USER HAS BEEN SILENT for 30 seconds]")).toBe(
      false,
    );
    expect(isInternalSignal("[SILENT]")).toBe(true);
  });
});

describe("direct spoken stop for Six — Android CUSTOM regression (G 2026-08-25)", () => {
  it("accepts only a standalone imperative and not embedded commentary", () => {
    expect(isDirectAvatarStopCommand("Stop, Six")).toBe(true);
    expect(isDirectAvatarStopCommand("Six, stop")).toBe(true);
    expect(isDirectAvatarStopCommand("please stop 6 now")).toBe(true);
    expect(isDirectAvatarStopCommand("That should not stop Six")).toBe(false);
    expect(
      isDirectAvatarStopCommand(
        "I just cleared my throat. That should not stop Six. He should just continue on.",
      ),
    ).toBe(false);
  });

  it("does not classify embedded stop-Six commentary as an end-session request", () => {
    expect(hasEndSessionIntent("Stop, Six")).toBe(true);
    expect(hasEndSessionIntent("Six, stop")).toBe(true);
    expect(hasEndSessionIntent("That should not stop Six")).toBe(false);
    expect(
      hasEndSessionIntent(
        "I just cleared my throat. That should not stop Six. He should just continue on.",
      ),
    ).toBe(false);
  });
});

describe("hasExplicitAccountSendOnCloseIntent — close is never implicit send consent", () => {
  it("accepts an explicit same-turn send-and-close command", () => {
    expect(
      hasExplicitAccountSendOnCloseIntent(
        "Yes, send the sign-in link and close the session.",
      ),
    ).toBe(true);
    expect(
      hasExplicitAccountSendOnCloseIntent("Send it, then close this site out."),
    ).toBe(true);
  });

  it("rejects generic affirmation, ambiguity, and negation", () => {
    expect(hasExplicitAccountSendOnCloseIntent("Okay, close the session.")).toBe(
      false,
    );
    expect(hasExplicitAccountSendOnCloseIntent("Yes, close the session.")).toBe(
      false,
    );
    expect(
      hasExplicitAccountSendOnCloseIntent(
        "Don't send anything; close the session.",
      ),
    ).toBe(false);
  });
});

describe("confirmsEndSession — confirm prompt hardening (closed G's session twice)", () => {
  it("whole-utterance yes / bare command confirms", () => {
    expect(confirmsEndSession("yes")).toBe(true);
    expect(confirmsEndSession("yeah ok")).toBe(true);
    expect(confirmsEndSession("stop.")).toBe(true);
    expect(confirmsEndSession("close it")).toBe(true);
    expect(confirmsEndSession("shut it down")).toBe(true);
  });
  it("a cancel always wins", () => {
    expect(confirmsEndSession("no, keep going")).toBe(false);
    expect(confirmsEndSession("don't")).toBe(false);
  });
  it("a long sentence that merely contains ok/right/close never confirms", () => {
    expect(
      confirmsEndSession("ok so anyway the system closed it automatically right"),
    ).toBe(false);
    expect(confirmsEndSession("I think that's right about the weather")).toBe(
      false,
    );
  });
});

describe("isStitchedSessionClose — bare 'session' shard finishes a split close (G 2026-06-14)", () => {
  it("stitches a dangling verb head + bare object tail into a close", () => {
    expect(isStitchedSessionClose("close the", "session")).toBe(true);
    expect(isStitchedSessionClose("close the", "the session")).toBe(true);
    expect(isStitchedSessionClose("end the", "conversation")).toBe(true);
    expect(isStitchedSessionClose("shut down", "the app")).toBe(true);
    expect(isStitchedSessionClose("close this", "chat")).toBe(true);
  });
  it("a standalone bare object never closes (no close-verb predecessor)", () => {
    expect(isStitchedSessionClose("tell me about this", "session")).toBe(false);
    expect(isStitchedSessionClose("how was your", "session")).toBe(false);
    expect(isStitchedSessionClose("", "session")).toBe(false);
    expect(isStitchedSessionClose("add eggs to the", "list")).toBe(false);
  });
  it("a stitched QUESTION/negation still never closes", () => {
    expect(isStitchedSessionClose("how do I close the", "session")).toBe(false);
    expect(isStitchedSessionClose("don't close the", "session")).toBe(false);
    expect(isStitchedSessionClose("if I close this", "site")).toBe(false);
  });
  it("a non-object tail after a close head does not over-trigger", () => {
    expect(isStitchedSessionClose("close the", "grocery list")).toBe(false);
    expect(isStitchedSessionClose("close the", "window please")).toBe(false);
  });
});

describe("parseSpelledEmailChunk — letters land on 6's chest (G 2026-06-01)", () => {
  it("single spoken letters become a clean run", () => {
    expect(parseSpelledEmailChunk("s g d i e t z")).toEqual({
      chars: "sgdietz",
      looksSpelled: true,
    });
  });
  it("symbol and number words map to characters", () => {
    expect(parseSpelledEmailChunk("at pm dot me")).toEqual({
      chars: "@pm.me",
      looksSpelled: true,
    });
    expect(parseSpelledEmailChunk("seven seven seven")).toEqual({
      chars: "777",
      looksSpelled: true,
    });
  });
  it("leading filler is stripped, spell kept", () => {
    const out = parseSpelledEmailChunk("okay it's s g d");
    expect(out.chars).toBe("sgd");
    expect(out.looksSpelled).toBe(true);
  });
  it("case markers are dropped silently", () => {
    const out = parseSpelledEmailChunk("capital g lowercase d");
    expect(out.chars).toBe("gd");
    expect(out.looksSpelled).toBe(true);
  });
  it("an inline address is taken verbatim", () => {
    const out = parseSpelledEmailChunk("sgdietz@pm.me");
    expect(out.chars).toBe("sgdietz@pm.me");
    expect(out.looksSpelled).toBe(true);
  });
  it("SWEEP 2026-06-10: hyphen-chained letters are a spell, not a word", () => {
    const out = parseSpelledEmailChunk("s-g-d-i-e-t-z at pm dot me");
    expect(out.chars).toBe("sgdietz@pm.me");
    expect(out.looksSpelled).toBe(true);
  });
  it("ordinary conversation does NOT look spelled", () => {
    const out = parseSpelledEmailChunk("I was wondering about the weather");
    expect(out.looksSpelled).toBe(false);
  });
});

describe("extractSpokenEmailCandidate — never save a guess", () => {
  it("parses a fully spoken address", () => {
    expect(extractSpokenEmailCandidate("my email is sgdietz at pm dot me")).toBe(
      "sgdietz@pm.me",
    );
  });
  it("a clean inline address wins outright", () => {
    expect(extractSpokenEmailCandidate("sgdietz@pm.me")).toBe("sgdietz@pm.me");
  });
  it("bails to null on the dropped-local-part shape (SGD IETZ@pm.me)", () => {
    expect(extractSpokenEmailCandidate("Okay, it's SGD IETZ@pm.me")).toBe(null);
  });
  it("BUGFIX 2026-06-10: the spelled letter E survives a one-breath spell", () => {
    // Old noise filter ate "e" (the 'e' of 'e mail') → saved sgditz@pm.me.
    expect(extractSpokenEmailCandidate("s g d i e t z at pm dot me")).toBe(
      "sgdietz@pm.me",
    );
  });
  it("BUGFIX 2026-06-10: long spelled locals keep their head (no 6-token cap)", () => {
    // Old .slice(-6) beheaded 7+ letter locals → "ttditz@pm.me".
    expect(
      extractSpokenEmailCandidate("s c o t t d i e t z at pm dot me"),
    ).toBe("scottdietz@pm.me");
  });
  it("leading chatter still never glues onto the local part", () => {
    expect(
      extractSpokenEmailCandidate("okay so it's s g d i e t z at pm dot me"),
    ).toBe("sgdietz@pm.me");
    expect(
      extractSpokenEmailCandidate("send the link to sgdietz at pm dot me"),
    ).toBe("sgdietz@pm.me");
  });
  it("plain talk yields null", () => {
    expect(extractSpokenEmailCandidate("I want you to remember me")).toBe(null);
  });
});

describe("mergeEmailDomainCorrection — fix just the domain, keep the local", () => {
  it("swaps in the corrected domain", () => {
    expect(
      mergeEmailDomainCorrection("no, it's pm dot me", "sgdietz@gmail.com"),
    ).toBe("sgdietz@pm.me");
  });
  it("returns null without a prior email", () => {
    expect(mergeEmailDomainCorrection("pm dot me", null)).toBe(null);
  });
});

describe("parseEmailFromAvatarReadback — observational readback parser", () => {
  it("parses the canonical spelled readback", () => {
    expect(
      parseEmailFromAvatarReadback(
        "Got it! That's S-G-D-I-E-T-Z at P-M dot M-E. Did I get that right?",
      ),
    ).toBe("sgdietz@pm.me");
  });
  it("trailing chatter never lands in the domain", () => {
    expect(
      parseEmailFromAvatarReadback(
        "G-D-I-E-T-Z at gmail dot com, did I get that right?",
      ),
    ).toBe("gdietz@gmail.com");
  });
  it("an inline address spoken verbatim wins", () => {
    expect(parseEmailFromAvatarReadback("That's sgdietz@pm.me, right?")).toBe(
      "sgdietz@pm.me",
    );
  });
  it("a question with no address yields null", () => {
    expect(parseEmailFromAvatarReadback("Is the email on screen correct?")).toBe(
      null,
    );
  });
});

describe("extractDeviceNameCandidate — junk never becomes a name (G 2026-06-07/08)", () => {
  it("explicit forms work without the plain-answer flag", () => {
    expect(extractDeviceNameCandidate("my name is George", false)).toBe(
      "George",
    );
    expect(extractDeviceNameCandidate("call me G", false)).toBe("G");
  });
  it("BUGFIX 2026-06-10 (Kevin session): fillers and commas never kill the capture", () => {
    expect(
      extractDeviceNameCandidate("All right, um, my name is, um, Kevin.", false),
    ).toBe("Kevin");
    expect(extractDeviceNameCandidate("my name's Kevin", false)).toBe("Kevin");
    expect(extractDeviceNameCandidate("my name is, like, Dana", false)).toBe(
      "Dana",
    );
    // The filler-eater must never bite the front off a real name.
    expect(extractDeviceNameCandidate("my name is Umberto", false)).toBe(
      "Umberto",
    );
  });
  it("SWEEP 2026-06-10: i'm + filler captures, i'm + ordinary clause never does", () => {
    expect(extractDeviceNameCandidate("I'm, um, Alice", false)).toBe("Alice");
    expect(
      extractDeviceNameCandidate("I am, however, not sure about this", false),
    ).toBe(null);
  });
  it("SUP 56-59: emotional self-talk never becomes identity data", () => {
    const transcript =
      "I think the place is, it's like in my personal life, I'm such a loser. I don't have any friends.";

    expect(extractDeviceNameCandidate(transcript, false)).toBe(null);
    expect(extractContactDetails(transcript).fullName).toBe(null);
  });
  it("a bare answer works only when 6 just asked", () => {
    expect(extractDeviceNameCandidate("G", true)).toBe("G");
    expect(extractDeviceNameCandidate("G", false)).toBe(null);
  });
  it("bare lead-ins are never names (the Call Me bug)", () => {
    expect(extractDeviceNameCandidate("Call me", true)).toBe(null);
  });
  it("apologies / confirmations / fillers are never names", () => {
    expect(extractDeviceNameCandidate("Sorry about that", true)).toBe(null);
    expect(extractDeviceNameCandidate("It is", true)).toBe(null);
    expect(extractDeviceNameCandidate("first time", true)).toBe(null);
    expect(extractDeviceNameCandidate("I'm talking", true)).toBe(null);
  });
  it("explicit identity answers preserve valid names while rejecting setup residue", () => {
    expect(extractDeviceNameCandidate("my name is George Good", false)).toBe(
      "George Good",
    );
    expect(extractDeviceNameCandidate("call me Fine", false)).toBe("Fine");
    expect(extractDeviceNameCandidate("my name is an account", false)).toBe(null);
    expect(extractDeviceNameCandidate("an account", true)).toBe(null);
    expect(extractDeviceNameCandidate("account", true)).toBe(null);
    expect(extractDeviceNameCandidate("set up", true)).toBe(null);
    expect(extractDeviceNameCandidate("create", true)).toBe(null);
    expect(extractDeviceNameCandidate("create account please", true)).toBe(null);
    expect(extractDeviceNameCandidate("create an G", true)).toBe(null);
    expect(extractDeviceNameCandidate("set up an account", true)).toBe(null);
    expect(extractDeviceNameCandidate("create an account", true)).toBe(null);
    expect(extractDeviceNameCandidate("start an account", true)).toBe(null);
    expect(extractDeviceNameCandidate("open an account", true)).toBe(null);
    expect(extractDeviceNameCandidate("my name is create an account", false)).toBe(
      null,
    );
  });
  it("preserves legitimate short names that resemble ordinary words", () => {
    expect(extractDeviceNameCandidate("So Young", true)).toBe("So Young");
    expect(extractDeviceNameCandidate("My Anh", true)).toBe("My Anh");
  });
  it("isJunkPersonName flags stored lead-ins for repair", () => {
    expect(isJunkPersonName("Call Me")).toBe(true);
    expect(isJunkPersonName("First Time")).toBe(true);
    expect(isJunkPersonName("George")).toBe(false);
  });
});

describe("voice sizing — the coached words must always match (the 23:15 bug)", () => {
  it("6's own coached phrases pass, both directions", async () => {
    const { UI_SIZE_BIGGER_RE, UI_SIZE_SMALLER_RE } = await import(
      "../../src/lib/uiSize"
    );
    // The exact words from G's session that FAILED before:
    expect(UI_SIZE_BIGGER_RE.test("Make it bigger.")).toBe(true);
    expect(
      UI_SIZE_BIGGER_RE.test("The writing on your chest, can you make them bigger?"),
    ).toBe(true);
    expect(UI_SIZE_BIGGER_RE.test("make the boxes bigger")).toBe(true);
    // G: "I shouldn't have to say something" — a plain can't-see complaint
    // resizes DIRECTLY, no magic words needed.
    expect(UI_SIZE_BIGGER_RE.test("I can't see what's in the")).toBe(true);
    expect(UI_SIZE_SMALLER_RE.test("can you make them smaller?")).toBe(true);
    expect(UI_SIZE_SMALLER_RE.test("make it smaller")).toBe(true);
    // Ordinary talk never resizes:
    expect(UI_SIZE_BIGGER_RE.test("my dreams are bigger than that")).toBe(false);
    expect(UI_SIZE_SMALLER_RE.test("the world feels smaller these days")).toBe(false);
  });
});

describe("email correction intent — positive confirmation never reopens entry", () => {
  it.each([
    "correct",
    "Correct.",
    "Yes, that's correct. Send the sign-in link.",
    "Okay, it came up correct the first time.",
    "That's incorrect about the weather.",
  ])("does not treat %j as a correction outside an active email gate", (text) => {
    expect(hasEmailCorrectionIntent(text, false)).toBe(false);
  });

  it.each([
    "wrong",
    "incorrect",
    "But now it's not written correct.",
    "No, that's not right.",
    "You didn't spell it correct.",
  ])("accepts %j only while an email gate is active", (text) => {
    expect(hasEmailCorrectionIntent(text, true)).toBe(true);
    expect(hasEmailCorrectionIntent(text, false)).toBe(false);
  });

  it.each([
    "fix my email",
    "fix it",
    "correct the email",
    "change my address",
    "take my email again",
  ])("accepts explicit email correction %j in any signup context", (text) => {
    expect(hasEmailCorrectionIntent(text, false)).toBe(true);
  });
});

describe("buildAccountMemoryOffer — rotating value line, always ends with the ask", () => {
  it("uses the seeded value line and closes with You ready?", () => {
    const out = buildAccountMemoryOffer(undefined, 0);
    expect(out).toContain(ACCOUNT_MEMORY_VALUE_LINES[0]);
    expect(out.endsWith("You ready?")).toBe(true);
  });
});
