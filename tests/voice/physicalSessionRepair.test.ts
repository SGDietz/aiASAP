import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EMPTY_BUILD_INTEREST_STATE,
  chooseContactMethod,
  confirmCapturedContact,
  confirmTypedContact,
  editCapturedContact,
  formatContactForSpeech,
  grantSendPermission,
  hasDirectContactFollowUpRequest,
  hasExplicitPersonalConnectionRequest,
  resolveContactSave,
  stepBuildInterest,
  submitTypedContact,
  type BuildInterestState,
} from "../../src/lib/buildInterestFlow";
import { formatSixSpeechForTts } from "../../src/lib/voice/speechBrand";
import { isPublicContactRequest } from "../../src/lib/publicContact";
import { resolveSemanticTurn, resolveTurnIntake } from "../../src/lib/voiceMode/turnIntake";
import { SIX_SYSTEM_PROMPT } from "../../src/lib/brain/sixSystemPrompt";

// Every case here comes from ONE real ride: physical Android session
// 79317698-60bb-43e0-96f5-cccc5699595d, 2026-08-31 14:00-14:03Z. Twelve
// accepted turns, twelve brain replies, ten of them logged `repeat_silent`,
// the same hand raise asked five times, the brand mispronounced throughout,
// an email claimed to be on screen that was not, and zero contact_entities.

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("the ordinary hand raise reaches contact capture on the first ask", () => {
  const handRaises = [
    "have Scott reach out to me",
    "Okay, great. Yeah, have Scott reach out to me.",
    "have someone reach out",
    "Can you have somebody reach out to me?",
    "take my information",
    "just take my info",
    "please contact me",
    "I'd like someone to reach out",
    "get in touch with me",
    "email me",
    "write down my phone number",
  ];

  it.each(handRaises)("recognizes %s as a hand raise", (text) => {
    expect(hasDirectContactFollowUpRequest(text)).toBe(true);
  });

  it("goes straight to email-or-phone, with no discovery or account detour", () => {
    const step = stepBuildInterest(
      EMPTY_BUILD_INTEREST_STATE,
      "Okay, great. Yeah, have Scott reach out to me.",
    );
    expect(step.handled).toBe(true);
    expect(step.state.stage).toBe("contact_method");
    // the exact failure of the ride: an account offer instead of "how do I
    // reach you", which is why the visitor had to ask five times
    expect(step.state.stage).not.toBe("account_offer");
    // G, ride 48c99dfa 2026-09-04: "you said don't do the email or phone
    // anymore. It's just what's your name, what's your email address."
    expect(step.spoken).toMatch(/what's your name/i);
    expect(step.spoken).toMatch(/email address/i);
    expect(step.spoken).not.toMatch(/email or phone/i);
    expect(step.spoken).not.toMatch(/magic link|free account/i);
  });

  it("does not trap the hand raise behind a pending account offer either", () => {
    const pendingAccountOffer: BuildInterestState = {
      stage: "account_offer",
      method: null,
      value: null,
    };
    const raised = stepBuildInterest(
      pendingAccountOffer,
      "just have Scott reach out to me",
    );
    expect(raised.state.stage).toBe("contact_method");
  });

  it("takes a contact the visitor volunteers in the same breath", () => {
    const step = stepBuildInterest(
      EMPTY_BUILD_INTEREST_STATE,
      "have Scott reach out to me at pat@example.com",
    );
    expect(step.state).toMatchObject({
      stage: "confirming",
      method: "email",
      value: "pat@example.com",
    });
  });

  const notHandRaises = [
    // coaching / rehearsal — the packet's negative cases
    "You should say the team will reach out to them.",
    "G should talk personally with the prospect about their future.",
    "Scott should say he can help shape a website.",
    "Tell prospects you will reach out after the call.",
    "When someone asks, get in touch with them quickly.",
    "I want G's team to build my brand and website.",
    "We can build you a website and reach out to customers.",
    // quoted / reported speech is evidence about another utterance, not this
    // visitor authorizing contact
    "The visitor said, 'contact me.'",
    "She asked me to have Scott reach out to her.",
    "I said have someone reach out to me during the demo.",
    // a name request, not a phone request
    "You can call me Scott.",
    "Just call me by my first name.",
  ];

  it.each(notHandRaises)("treats %s as ordinary talk, not consent", (text) => {
    expect(hasDirectContactFollowUpRequest(text)).toBe(false);
    expect(stepBuildInterest(EMPTY_BUILD_INTEREST_STATE, text).state.stage).not.toBe(
      "contact_method",
    );
  });

  it("routes explicit personal-connection requests straight to contact capture", () => {
    expect(
      hasExplicitPersonalConnectionRequest(
        "I would like to speak with Scott personally about my landscape work.",
      ),
    ).toBe(true);
    expect(
      stepBuildInterest(
        EMPTY_BUILD_INTEREST_STATE,
        "I want to connect with G personally about my brand and website.",
      ).state.stage,
    ).toBe("contact_method");
  });
});

describe("public contact intent stays separate from visitor follow-up capture", () => {
  it.each([
    "How can I contact G?",
    "What is G's phone number?",
    "Show me Scott's contact number",
  ])("recognizes a request for G's public details: %s", (text) => {
    expect(isPublicContactRequest(text)).toBe(true);
  });

  it.each([
    "Have G reach out to me",
    "Please email me",
    "Can someone call us?",
  ])("does not steal a visitor follow-up request: %s", (text) => {
    expect(isPublicContactRequest(text)).toBe(false);
  });
});

describe("readback is spelled out and confirmed verbally", () => {
  it("spells an email letter by letter with explicit at and dot", () => {
    expect(formatContactForSpeech("email", "pat.g@example.com")).toBe(
      "P-A-T dot G at E-X-A-M-P-L-E dot C-O-M",
    );
  });

  it("reads a phone number as clear digit groups", () => {
    expect(formatContactForSpeech("phone", "4105550123")).toBe(
      "4, 1, 0, 5, 5, 5, 0, 1, 2, 3",
    );
  });

  it("reads the value back without pointing at a form", () => {
    const captured = stepBuildInterest(
      { stage: "contact_capture", method: "email", value: null },
      "pat@example.com",
    );
    expect(captured.spoken).toContain("P-A-T at E-X-A-M-P-L-E dot C-O-M");
    expect(captured.spoken).not.toMatch(/screen|box|type it/i);
  });

  it("a failed save keeps the value and never asks them to spell it again", () => {
    const failed = resolveContactSave(
      { stage: "saving", method: "email", value: "pat@example.com" },
      false,
    );
    expect(failed.state.stage).toBe("failed");
    expect(failed.state.value).toBe("pat@example.com");
    expect(failed.spoken).toMatch(/Nothing was submitted/i);
    expect(failed.spoken).not.toMatch(/screen|box/i);
    expect(failed.spoken).not.toMatch(/say (it|the contact) again/i);
    expect(failed.spoken).not.toMatch(/spell/i);
  });
});

describe("the typed control drives the same machine and the same RPC", () => {
  const atMethod: BuildInterestState = {
    stage: "contact_method",
    method: null,
    value: null,
  };

  it("choosing a method opens capture for that method", () => {
    const step = chooseContactMethod(atMethod, "email");
    expect(step.state).toMatchObject({ stage: "contact_capture", method: "email" });
    expect(step.spoken).toMatch(/type|say/i);
  });

  it("a typed email is confirmed with a spoken readback before anything saves", () => {
    const result = submitTypedContact(
      { stage: "contact_capture", method: "email", value: null },
      "email",
      "  Pat@Example.com ",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.step.state).toMatchObject({
      stage: "confirming",
      method: "email",
      value: "pat@example.com",
    });
    expect(result.step.effect).toEqual({ kind: "none" });
  });

  it("a typed phone normalizes to digits", () => {
    const result = submitTypedContact(
      { stage: "contact_capture", method: "phone", value: null },
      "phone",
      "(410) 555-0123",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.step.state.value).toBe("4105550123");
  });

  it("an unusable value reports inline and never regresses the state", () => {
    for (const bad of ["", "   ", "pat@", "not an email", "12345"]) {
      const result = submitTypedContact(
        { stage: "contact_capture", method: "email", value: null },
        "email",
        bad,
      );
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error).toBeTruthy();
      // The failure message must not send them back to spelling out loud.
      expect(result.error).not.toMatch(/say it again/i);
    }
  });

  it("confirming from the box asks to send, then produces the one save_contact effect", () => {
    // The tap path walks the same two beats as the spoken one.
    const asked = confirmCapturedContact({
      stage: "confirming",
      method: "email",
      value: "pat@example.com",
    });
    expect(asked.state.stage).toBe("permission");
    expect(asked.effect).toEqual({ kind: "none" });
    const step = grantSendPermission(asked.state);
    expect(step.state.stage).toBe("saving");
    expect(step.state.packageConsent).toBe(true);
    expect(step.effect).toEqual({
      kind: "save_contact",
      method: "email",
      value: "pat@example.com",
    });
  });

  it("a failed save retries straight away without re-asking permission", () => {
    const retry = confirmCapturedContact({
      stage: "failed",
      method: "email",
      value: "pat@example.com",
      packageConsent: true,
    });
    expect(retry.state.stage).toBe("saving");
    expect(retry.effect).toMatchObject({ kind: "save_contact" });
  });

  it("confirming from the box saves the visible edited value", () => {
    const result = confirmTypedContact(
      { stage: "confirming", method: "email", value: "pat@example.com" },
      "email",
      "pat2@example.com",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The edited value is what the send question is asked about, and what the
    // yes then saves - never the value it replaced.
    expect(result.step.state).toMatchObject({
      stage: "permission",
      method: "email",
      value: "pat2@example.com",
    });
    const sending = grantSendPermission(result.step.state);
    expect(sending.effect).toEqual({
      kind: "save_contact",
      method: "email",
      value: "pat2@example.com",
    });
  });

  it("confirming with nothing captured cannot save", () => {
    const step = confirmCapturedContact(EMPTY_BUILD_INTEREST_STATE);
    expect(step.effect).toEqual({ kind: "none" });
  });

  it("edit returns to capture without discarding what they already gave", () => {
    const step = editCapturedContact({
      stage: "confirming",
      method: "phone",
      value: "4105550123",
    });
    expect(step.state).toMatchObject({
      stage: "contact_capture",
      method: "phone",
      value: "4105550123",
    });
  });

  it("both live surfaces route the typed contact card through the same persistence machine", () => {
    for (const path of [
      "src/components/LiveAvatarSession.tsx",
      "src/components/VoiceOnlyStage.tsx",
    ]) {
      const surface = source(path);
      expect(surface).toContain("ContactStatusCard");
      expect(surface).toContain("handleContactCardStep");
      expect(surface).toContain("applyBuildInterestStep");
      expect(surface).toContain('postOpportunitySignal("submit_contact"');
    }
    // G, 2026-09-03: "Everything is audio only... None of those yes send it
    // boxes... It's gotta be almost exactly like the iScott." The card is a
    // display: it shows what 6 heard. Every question is spoken, and the only
    // way into the persistence machine is stepBuildInterest on a voice turn.
    const card = source("src/components/ContactStatusCard.tsx");
    expect(card).toContain('data-contact-status-card="1"');
    expect(card).toContain('data-contact-label="1"');
    expect(card).toContain('data-contact-value="1"');
    expect(card).not.toMatch(/<button|<input|<textarea|<form|<select|onClick|onChange|onSubmit/);
    // The card must NEVER regrow any of the typed-control identifiers or
    // hooks that lived here before the 2026-09-03 voice-only rewrite - if
    // any of these come back the "everything is voice" contract is broken.
    expect(card).not.toContain("submitTypedContact");
    expect(card).not.toContain("chooseContactMethod");
    expect(card).not.toContain("confirmTypedContact");
    expect(card).not.toContain("editCapturedContact");
    expect(card).not.toContain("data-contact-capture-input");
    expect(card).not.toContain("data-contact-method-toggle");
    expect(card).not.toContain("data-contact-submit");
  });

  it("keeps the two public links in the exact approved order and format", () => {
    const card = source("src/components/PublicContactCard.tsx");
    const contact = source("src/lib/publicContact.ts");
    expect(card.indexOf("data-public-wildworks-link")).toBeLessThan(
      card.indexOf("data-public-phone-link"),
    );
    expect(contact).toContain('AIASAP_PUBLIC_PHONE_DISPLAY = "1+443-797-2166"');
    expect(contact).toContain('AIASAP_PUBLIC_PHONE_HREF = "tel:+14437972166"');
    expect(card).toContain("WILDWORKS_LIVE_URL");
    expect(card).not.toContain("mailto:");
  });

  it("keeps the sign-in-link recovery card separate from contact capture", () => {
    const live = source("src/components/LiveAvatarSession.tsx");
    const fallback = source("src/components/SendLinkFallbackCard.tsx");
    expect(live).toContain("<SendLinkFallbackCard");
    expect(live).toContain("onSend={handleSendLinkFallbackClick}");
    expect(fallback).toContain('data-send-link-fallback="1"');
    expect(fallback).toContain("Send link");
    expect(fallback).not.toContain("<input");
  });
});

describe("cumulative provider finals become one semantic turn", () => {
  // The exact three rows the provider produced for one sentence.
  const shard1 = "Yeah, we need to work on the, um,";
  const shard2 = "Okay, um,";
  const cumulative =
    "Yeah, we need to work on the, um, Okay, um, Okay, great. Yeah, have Scott reach out to me.";

  it("wires a lone held final back through the serialized avatar dispatcher", () => {
    const session = source("src/components/LiveAvatarSession.tsx");
    expect(session).toContain("flushPendingSpeechFragment(pending, Date.now(), holdMs)"); // holdMs: 3.5s for a dangling shard (ride f225a5c7)
    expect(session).toContain('void handleUserTranscription({ text, flushHeld: true })');
    expect(session).toContain('"user_turn_flushed"');
    expect(session).toContain("pending.at !== heldAt");
  });

  it("holds the incomplete shards and dispatches the sentence exactly once", () => {
    const now = 1_000;
    const first = resolveTurnIntake({ incoming: shard1, pending: null, now });
    expect(first.kind).toBe("hold");
    const second = resolveTurnIntake({
      incoming: shard2,
      pending: first.kind === "hold" ? first.pending : null,
      now: now + 400,
    });
    expect(second.kind).toBe("hold");
    const third = resolveTurnIntake({
      incoming: cumulative,
      pending: second.kind === "hold" ? second.pending : null,
      now: now + 900,
    });
    expect(third.kind).toBe("dispatch");
    if (third.kind !== "dispatch") return;
    expect(third.text).toBe(cumulative);
    expect(hasDirectContactFollowUpRequest(third.text)).toBe(true);
  });

  it("hands only the new words onward when the earlier shards were accepted", () => {
    // Same rows, but the shards already reached the brain (a longer pause than
    // the hold TTL, or a transport that finalized them as complete turns).
    const accepted = [
      { text: shard1, at: 1_000 },
      { text: shard2, at: 1_400 },
    ];
    const decision = resolveSemanticTurn({
      incoming: cumulative,
      accepted,
      now: 1_900,
    });
    expect(decision.kind).toBe("deliver");
    if (decision.kind !== "deliver") return;
    expect(decision.reason).toBe("cumulative_remainder");
    expect(decision.text).toBe("Okay, great. Yeah, have Scott reach out to me.");
    // and the hand raise inside it is acted on exactly once
    expect(hasDirectContactFollowUpRequest(decision.text)).toBe(true);
  });

  it("drops a verbatim restatement of a turn already handled", () => {
    const accepted = [{ text: cumulative, at: 1_000 }];
    const decision = resolveSemanticTurn({
      incoming: cumulative,
      accepted,
      now: 20_000,
    });
    expect(decision).toMatchObject({ kind: "drop", reason: "repeat_of_accepted" });
  });

  it("drops a later fragment of a turn already handled", () => {
    const accepted = [{ text: cumulative, at: 1_000 }];
    const decision = resolveSemanticTurn({
      incoming: "have Scott reach out to me",
      accepted,
      now: 2_000,
    });
    expect(decision).toMatchObject({
      kind: "drop",
      reason: "fragment_of_accepted",
    });
  });

  it("never trims against a one-word turn that people repeat honestly", () => {
    const accepted = [
      { text: "Yes.", at: 1_000 },
      { text: "Okay", at: 1_100 },
    ];
    const decision = resolveSemanticTurn({
      incoming: "Yes, that's my email.",
      accepted,
      now: 1_500,
    });
    expect(decision).toMatchObject({ kind: "deliver", reason: "new" });
    if (decision.kind !== "deliver") return;
    expect(decision.text).toBe("Yes, that's my email.");
  });

  it("forgets accepted turns once they age out, so a later repeat is real", () => {
    const accepted = [{ text: cumulative, at: 1_000 }];
    const decision = resolveSemanticTurn({
      incoming: cumulative,
      accepted,
      now: 1_000 + 120_000,
    });
    expect(decision.kind).toBe("deliver");
  });

  it("delivers an unrelated turn untouched", () => {
    const accepted = [{ text: shard1, at: 1_000 }];
    const decision = resolveSemanticTurn({
      incoming: "What does the website build cost?",
      accepted,
      now: 1_500,
    });
    expect(decision).toMatchObject({
      kind: "deliver",
      reason: "new",
      text: "What does the website build cost?",
    });
  });

  it("both accept paths run the guard and keep the raw text for the ring", () => {
    const session = source("src/components/LiveAvatarSession.tsx");
    expect((session.match(/resolveSemanticTurn\(\{/g) ?? []).length).toBe(2);
    expect(session).toContain("rememberAcceptedTurn(acceptedText, speechNow)");
    expect(session).toContain("rememberAcceptedTurn(heard, listSemanticNow)");
  });
});

// G locked the spoken form on 2026-09-04 as a standing order: "when he says
// aiASAP lock this in, needs a-i-ASAP and everything else such as this, the
// dashes. all sites... no deviation." He had already rejected the six-letter
// spelling mid-ride on 09-03. His brain prompt forbade it; the formatter still
// forced it, overriding the brain at the last boundary.
describe("the spoken brand is a-i-ASAP at every CUSTOM speech boundary", () => {
  it("converts the written brand and is idempotent", () => {
    expect(formatSixSpeechForTts("Welcome to aiASAP.")).toBe(
      "Welcome to a-i-ASAP.",
    );
    expect(formatSixSpeechForTts("the team at aiasap")).toBe(
      "the team at a-i-ASAP",
    );
    // the retired spelling is corrected, not preserved
    expect(formatSixSpeechForTts("A-I-A-S-A-P")).toBe("a-i-ASAP");
    // and the locked form is idempotent
    expect(formatSixSpeechForTts("a-i-ASAP")).toBe("a-i-ASAP");
    expect(formatSixSpeechForTts(formatSixSpeechForTts("aiASAP"))).toBe(
      "a-i-ASAP",
    );
  });

  it("leaves unrelated words alone", () => {
    expect(formatSixSpeechForTts("as soon as possible")).toBe(
      "as soon as possible",
    );
    expect(formatSixSpeechForTts("")).toBe("");
  });

  it("covers the brain reply path, not just scripted repeat", () => {
    // The scripted path has run through the formatter since June. The brain
    // reply — most of what 6 actually says — did not, which is why correcting
    // him never took.
    const textChat = source("src/liveavatar/useTextChat.ts");
    expect(textChat).toContain("formatSixSpeechForTts(chatResponseText)");
    expect(textChat).toMatch(
      /speakThroughAvatar\(\s*sessionRef\.current,\s*spokenResponseText,/,
    );
    // the transcript keeps the written form
    expect(textChat).toContain("onAssistantText?.(chatResponseText,");

    const session = source("src/components/LiveAvatarSession.tsx");
    // 2026-09-04: the CUSTOM gate is GONE. G's standing order is that the
    // spoken brand is a-i-ASAP on all sites with "no deviation", and the gate
    // meant every SCRIPTED line - the opener included - went out unformatted in
    // FULL mode (reachable at ?mode=full). The brain-reply path below has
    // always formatted unconditionally; this was the last inconsistent
    // boundary. The formatter is idempotent, so every mode is safe.
    expect(session).toContain("const spokenText = formatSixSpeechForTts(text);");
    expect(session).not.toContain('mode === "CUSTOM" ? formatSixSpeechForTts(text) : text');

    const voiceOnly = source("src/components/VoiceOnlyStage.tsx");
    expect(voiceOnly).toContain("text: formatSixSpeechForTts(text)");
  });
});

describe("silent-speech recovery keeps its bounds", () => {
  // Behavioural coverage lives in avatarSpeechRecovery.test.ts. These are the
  // structural invariants, so the bounds cannot be quietly loosened later.
  const delivery = source("src/liveavatar/customVoiceDelivery.ts");

  it("recovers only a proven-silent, rejected, or thrown dispatch", () => {
    expect(delivery).toContain("const AUDIBLE_RECOVERY_REASONS = new Set([");
    expect(delivery).toMatch(
      /AUDIBLE_RECOVERY_REASONS = new Set\(\[\s*"repeat_silent",\s*"repeat_rejected",\s*"repeat_threw",\s*\]\)/,
    );
    expect(delivery).toContain(
      "if (!AUDIBLE_RECOVERY_REASONS.has(reason) || audibleRecoveryStarted) return;",
    );
  });

  it("uses the existing TTS route and the existing WebAudio armor, never a second session", () => {
    expect(delivery).toContain('fetch("/api/elevenlabs-text-to-speech"');
    expect(delivery).toContain("enqueueFallback(session, audioBase64)");
    // the removed-in-August failure mode: pushing audio into the avatar pipe
    expect(delivery).not.toContain("repeatAudio(");
    expect(delivery).not.toContain("startSession");
  });

  it("cancels the late original and honours supersession, cuts, and unmount", () => {
    expect(delivery).toContain("session.interrupt();");
    expect(delivery).toContain('if (replyEpoch !== replyEpochAtArm) return "superseded";');
    expect(delivery).toContain('if (cutEpoch !== cutEpochAtArm) return "interrupted";');
    expect(delivery).toContain("activeAvatarSpeechCancels.set(cancelRecovery, session)");
  });

  it("keeps the provider media-presentation probe and its one reattach recovery", () => {
    expect(delivery).toContain("media_recovery_started");
    expect(delivery).toContain("await probe.recover(presentationAbort.signal)");
    expect(delivery).toContain("if (recoveryAttempted) return;");
  });

  it("logs the original failure and the recovery outcome separately", () => {
    // textLength added 2026-09-04 so stalls can be correlated with line
    // length from stored data instead of another ride.
    expect(delivery).toContain(
      "reportAvatarSpeechFailure({ session, where, reason, textLength: text.length })",
    );
    expect(delivery).toContain('emitPresentation("audio_recovery_started", reason)');
    expect(delivery).toContain('emitPresentation("audio_recovery_finished", outcome)');
  });
});

describe("the canonical prompt and its generated copy agree", () => {
  it("is byte-identical to its editable source", () => {
    const src = source("tools/cw_6af8624c_prompt.txt").replace(/\r\n/g, "\n");
    expect(SIX_SYSTEM_PROMPT).toBe(src);
  });

  it("tells 6 to yield the first clear follow-up request to app contact capture", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("FIRST CLEAR FOLLOW-UP REQUEST WINS:");
    expect(SIX_SYSTEM_PROMPT).toContain("have Scott reach out to me");
    expect(SIX_SYSTEM_PROMPT).toContain("Never ask a person to raise their hand twice");
    expect(SIX_SYSTEM_PROMPT).toContain(
      "Do not claim anything was saved, sent, or shown unless the app said so",
    );
  });

  it("states the spoken brand as a-i-ASAP and keeps the written form", () => {
    // REVERSED by G, live ride 2026-09-03 19:40, hearing the six-letter
    // version: "you don't say A-I-A-S-A-P so well... unless you have the
    // dashes, A dash I dash ASAP." The letters A and I, then ASAP as the
    // familiar word. Every rule paragraph must teach the SAME pronunciation -
    // dueling finals are how the last wrong version survived.
    expect(SIX_SYSTEM_PROMPT).toContain("SPOKEN BRAND:");
    expect(SIX_SYSTEM_PROMPT).toContain(
      'say it as "a-i-ASAP": the letter A, the letter I, then ASAP as the familiar word',
    );
    expect(SIX_SYSTEM_PROMPT).toContain("Written, the brand is always aiASAP");
    expect(SIX_SYSTEM_PROMPT).toContain(
      'the existing speech formatter pronounces it as "a-i-ASAP"',
    );
    expect(SIX_SYSTEM_PROMPT).toContain('Say the company name as "a-i-ASAP"');
    expect(SIX_SYSTEM_PROMPT).not.toContain("say it one letter at a time: A-I-A-S-A-P");
    expect(SIX_SYSTEM_PROMPT).not.toContain(
      'Say the company name as six separate letters: "A-I-A-S-A-P."',
    );
    expect(SIX_SYSTEM_PROMPT).not.toContain("never offer a callback");
  });

  it("keeps the existing service, pricing, and consent truth intact", () => {
    expect(SIX_SYSTEM_PROMPT).toContain(
      "starting prices: custom avatar salesperson starts at $3,000; full website starts at $5,000",
    );
    expect(SIX_SYSTEM_PROMPT).toContain("COACHING AND CONNECTION CONSENT:");
    expect(SIX_SYSTEM_PROMPT).toContain("not consent to contact");
    expect(SIX_SYSTEM_PROMPT).toContain(
      "Never invent or guarantee a price, customer, income, return, result",
    );
  });
});
