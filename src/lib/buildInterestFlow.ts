import { parseSpelledEmailChunk } from "./signup/helpers";

export type ContactMethod = "email" | "phone";
export type BuildInterestStage =
  | "exploring"
  | "account_offer"
  | "account_setup"
  | "contact_offer"
  | "contact_method"
  | "name_capture"
  | "contact_capture"
  | "confirming"
  | "permission"
  | "saving"
  | "failed"
  | "submitted"
  | "declined";

export type BuildInterestState = {
  stage: BuildInterestStage;
  method: ContactMethod | null;
  value: string | null;
  /** Name the visitor SAID, e.g. "my name is Scott". Never a device guess. */
  fullName?: string | null;
  sendConsent?: boolean;
  /** True only after the visitor affirms the normalized contact readback/package question. */
  packageConsent?: boolean;
  readbackConfirmedAt?: number;
  followUpAuthorizedAt?: number;
  /** Set once 6 has explained WHY he wants the address. He never explains twice. */
  whyAnswered?: boolean;
  /** How many times the send-permission question has been put. Capped at 2. */
  permissionAsks?: number;
  /** How many times "I need a complete ..." has been put. Capped at 2. */
  captureAsks?: number;
  /** How many times the read-back question has been put. Capped at 2. */
  confirmAsks?: number;
};

export type BuildInterestEffect =
  | { kind: "none" }
  | { kind: "start_account"; email?: string }
  | { kind: "save_contact"; method: ContactMethod; value: string };

export type BuildInterestStep = {
  handled: boolean;
  state: BuildInterestState;
  spoken: string | null;
  effect: BuildInterestEffect;
};

export const EMPTY_BUILD_INTEREST_STATE: BuildInterestState = {
  stage: "exploring",
  method: null,
  value: null,
  sendConsent: false,
};

const YES_RE = /^(?:yes|yeah|yep|sure|okay|ok|please|i do|let'?s do it|go ahead)\b/i;
const NO_RE = /^(?:no|nope|nah|not now|later|don'?t|do not|i decline|skip)\b/i;
const CONTACT_CONFIRMATION_RE =
  /^(?:yes|yeah|yep|yup|correct|right|that'?s correct|that is correct|that'?s right|that is right|you (?:got it|said it correctly)|go ahead|save it|please save it|confirm(?: it)?|sounds good)(?:[.!\s]*)$/i;
const CONTACT_CONFIRMATION_WITH_ACTION_RE =
  /^(?:yes|yeah|yep|yup)\b[\s,]*(?:please\s+)?(?:that'?s\s+(?:correct|right)|that\s+is\s+(?:correct|right)|go\s+ahead(?:\s+and)?\s+save\s+it|save\s+(?:it|that(?:\s+(?:email|phone(?:\s+number)?))?)|confirm\s+it)[.!\s]*$/i;
const CONTACT_CORRECTION_RE =
  /\b(?:not\s+(?:correct|right)|that'?s\s+not\s+(?:correct|right)|that\s+is\s+not\s+(?:correct|right)|wrong|incorrect|correction|change\s+(?:it|that|the\s+(?:email|phone(?:\s+number)?))|instead\s+of|actually\s+it'?s)\b/i;
// ---------------------------------------------------------------------------
// SCREEN TALK IS NOT AN ANSWER (ported from the iScott ride cea22329,
// 2026-09-03). G read the card out loud - "It just says your email, SGD at
// pm.me" - the STT heard a SHORTER address, the flow read it as a correction,
// overwrote the address he had already confirmed, and the send died with no
// tick. Talking ABOUT the box never supplies a value, never counts as a
// correction, and never counts as a yes. It just gets the question again.
// ---------------------------------------------------------------------------
const SCREEN_TALK_RE =
  /(?:\bit\s+(?:just\s+)?(?:says|shows|reads)\b|\bon\s+(?:the|my)\s+screen\b|\bthe\s+(?:box|card|screen|panel|field)\b|\bshow(?:s|ing)\b|\bpopulat\w+|\bconfirmation\b|\bcheck\s?mark\b|\bcheckmark\b|\bi\s+see\s+(?:the|a|no|nothing)\b|\bthere'?s\s+(?:no|nothing)\b|\bwhere(?:\s+is|'?s)\s+the\b)/i;

/** True when the visitor is describing what is on screen rather than answering. */
export function isScreenTalk(text: string): boolean {
  return SCREEN_TALK_RE.test(text ?? "");
}

/**
 * A candidate that is a chopped copy of the value we already hold is a
 * mishearing of that value, not a new one: the same domain with a local part
 * that is a strict prefix ("nam@example.com" heard against a confirmed
 * "namewhole@example.com"), or a phone whose digits sit inside the confirmed
 * digits. Example addresses are deliberately generic: this repo is public and
 * git history is permanent, so a real address written here could never be
 * taken back.
 */
export function isChoppedCopyOfConfirmed(
  method: ContactMethod,
  candidate: string,
  confirmed: string | null,
): boolean {
  if (!candidate || !confirmed || candidate === confirmed) return false;
  if (method === "phone") {
    const heard = candidate.replace(/\D/g, "");
    const held = confirmed.replace(/\D/g, "");
    return heard.length > 0 && heard.length < held.length && held.includes(heard);
  }
  const at = candidate.lastIndexOf("@");
  const heldAt = confirmed.lastIndexOf("@");
  if (at < 1 || heldAt < 1) return false;
  if (candidate.slice(at + 1) !== confirmed.slice(heldAt + 1)) return false;
  const heardLocal = candidate.slice(0, at);
  const heldLocal = confirmed.slice(0, heldAt);
  return heardLocal.length < heldLocal.length && heldLocal.startsWith(heardLocal);
}

/** The heard value is the one we already hold, or a chopped copy of it. */
function isSameOrMisheardValue(
  state: BuildInterestState,
  candidate: { method: ContactMethod; value: string },
): boolean {
  if (!state.method || !state.value) return false;
  if (candidate.method !== state.method) return false;
  if (candidate.value === state.value) return true;
  return isChoppedCopyOfConfirmed(state.method, candidate.value, state.value);
}

// ---------------------------------------------------------------------------
// THE PERMISSION BEAT (2026-09-03, G: bring 6 up to what iScott proves).
// The read-back and the permission to send used to be ONE compound question -
// "Is that correct, and should I send it?" - so a yes proved neither half and
// a no was unreadable. They are two beats now: confirm what I heard, THEN ask
// to send. Nothing leaves this machine without a yes to the send question
// itself. A visitor agreeing that we heard them right has NOT agreed to have
// their details forwarded - G drew that line himself on 2026-09-02.
// ---------------------------------------------------------------------------
const SEND_DECLINE_RE =
  /\b(?:not\s+(?:yet|now)|don'?t\s+send|do\s+not\s+send|hold\s+(?:on|off)|maybe\s+later|no\s+permission|didn'?t\s+give|did\s+not\s+give|don'?t\s+want|do\s+not\s+want)\b/i;
const SEND_PERMISSION_YES_RE =
  /^(?:yes|yeah|yep|yup|sure|okay|ok|please|absolutely|of\s+course|for\s+sure|definitely|correct|affirmative|go\s+ahead|do\s+it|send\s+(?:it|that|them)|sounds\s+good|you\s+(?:can|may)|that'?s\s+fine|fine)\b/i;

/**
 * A yes to the send question, and only that. The question is standalone, so a
 * plain "okay" is a real answer here - unlike at the read-back, where "okay"
 * opens complaints ("Okay, so, um, what's going on?") and stays fail-closed.
 * Questions, hedges carrying "but", declines and screen talk never pass.
 */
// RIDE cb2dde76, 2026-09-03 22:21 ET. G said:
//   "so then ask me for my permission to send it to the team at aiASAP and
//    YES I GIVE YOU MY PERMISSION go ahead and send it"
// and 6 asked the same question four times, because the affirmation had to be
// the FIRST word. People do not talk like that. An unmistakable grant counts
// wherever it appears in the sentence. Merely NAMING the act ("ask me for my
// permission to send it") is not a grant and is deliberately absent here.
const SEND_PERMISSION_ANYWHERE_RE =
  /\b(?:i\s+give\s+you\s+(?:my\s+)?permission|you\s+(?:have|got)\s+my\s+permission|go\s+ahead\s+and\s+send|yes[,\s]+(?:go\s+ahead|send|please)|you\s+(?:can|may)\s+send|please\s+send\s+it|send\s+it\s+(?:to|over|now)\b)/i;

export function isSendPermissionGranted(text: string): boolean {
  const value = (text ?? "").trim();
  if (!value || value.includes("?")) return false;
  if (NO_RE.test(value) || SEND_DECLINE_RE.test(value)) return false;
  if (/\bbut\b/i.test(value)) return false;
  return SEND_PERMISSION_YES_RE.test(value) || SEND_PERMISSION_ANYWHERE_RE.test(value);
}

// Spoken, never printed. Short because it is heard, not read - G, 2026-09-03:
// "Everything is audio only... it's gotta be almost exactly like the iScott."
// G told 6 the words he wants, mid-ride (22:20:16): "you're supposed to say
// great, what's your name and tell me your email address." He then said "my
// name is Scott" twice and it was thrown away - the flow never read a spoken
// name at all, and the owner email fell back to a device guess.
const SPOKEN_NAME_RE =
  /\b(?:my\s+name(?:'?s|\s+is)|call\s+me|this\s+is)\s+([A-Za-z][A-Za-z'\u2019-]{1,20})(?:\s+([A-Za-z][A-Za-z'\u2019-]{1,20}))?/i;
const NOT_A_NAME_RE =
  /^(?:a|an|the|my|me|it|is|was|not|no|yes|yeah|yep|uh+|um+|erm|hmm+|well|ok|okay|sure|going|gonna|about|just|really|very|so|and|but|because|that|this|there|here|what|who|why|how|when|where|good|great|fine|help|looking|trying|working|talking|calling|sorry|thanks?)$/i;

/** The name the visitor actually said, or null. Never guesses. */
export function extractSpokenName(text: string): string | null {
  const m = SPOKEN_NAME_RE.exec(text ?? "");
  if (!m) return null;
  const first = (m[1] || "").trim();
  if (!first || NOT_A_NAME_RE.test(first)) return null;
  const second = (m[2] || "").trim();
  const parts = second && !NOT_A_NAME_RE.test(second) ? [first, second] : [first];
  const name = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
  return name.length > 1 ? name.slice(0, 80) : null;
}

const INCOMPLETE_NAME_CUE_RE = /\b(?:my\s+name(?:'?s|\s+is)|call\s+me|this\s+is)\s*[.,!?-]*$/i;

/** A bounded answer to a just-asked name question; filler is never a name. */
export function extractStandaloneSpokenName(text: string): string | null {
  const cleaned = (text ?? "").trim().replace(/^[,.;:!?-]+|[,.;:!?-]+$/g, "");
  if (!cleaned || cleaned.length > 80 || /\d|@|\?|\b(?:email|phone|address)\b/i.test(cleaned)) return null;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 3) return null;
  if (words.some((word) => NOT_A_NAME_RE.test(word))) return null;
  if (!words.every((word) => /^[A-Za-z][A-Za-z'\u2019-]{1,30}$/.test(word))) return null;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

// G, ride 2026-09-03 19:43, word for word: "can you say, can you send that to
// the team at AI ASAP?... And I will say, yes, send it to the team at AI
// ASAP." Dashed form for the voice, per the sacred TTS spellings.
export const SEND_PERMISSION_QUESTION =
  "Can I send that to the team at a-i-ASAP so they can follow up with you?";

// G's ride, 2026-09-04 12:42-12:44. Two separate failures, one minute apart.
//
// REFUSAL. G said, flatly: "I don't need you to have my email." 6's very next
// line was "I need a complete email. Say it again slowly." Two holes: NO_RE is
// ^-anchored, so a refusal that opens with "I" never matched at all; and the
// refusal check only ran when `method === null`, so once 6 was collecting an
// email there was NO refusal path in the branch whatsoever. A person saying no
// must be heard on the FIRST no, at any stage, with or without a method set.
const CONTACT_REFUSAL_RE =
  /\b(?:i\s+(?:really\s+)?(?:do\s*n[o']?t|don'?t)\s+(?:need|want)\b[\s\S]{0,40}\b(?:email|e-mail|phone|number|contact|address|it|that)\b|i'?d\s+rather\s+not\b|no\s+thank\s*s?\b|never\s*mind\b|forget\s+it\b|not\s+(?:comfortable|interested)\b|i\s+don'?t\s+want\s+to\s+(?:give|share|provide)\b|don'?t\s+(?:need|want)\s+(?:my|your)\s+(?:email|e-mail|phone|number)\b|stop\s+asking\b|quit\s+asking\b)/i;

// WHY. G asked, four separate times: "Why'd you ask for my email address?",
// "Why are you asking for it?", "why? What are you asking for my email address
// for?" Every one got the same demand back, because there was no branch for a
// question at all. Answering a question with the same demand is what made the
// whole stretch feel like a machine. Answer it ONCE, plainly, then carry on.
const CONTACT_WHY_RE =
  /\b(?:why|what)\b[\s\S]{0,50}\b(?:asking|ask|need|want|doing|do)\b[\s\S]{0,40}\b(?:email|e-mail|phone|number|address|it|that|for)\b|^\s*why\b[\s\S]{0,20}$/i;

// Said once, never repeated. Answers the question AND hands back the exit, so a
// visitor who only wanted a reason is not cornered into repeating themselves.
// Same ride, 12:43:46-12:44:32. The send-permission question fired SIX times:
// G asked "So what are you going to do with that email?" and "Are you gonna
// send me something?" and got the identical question back every time, because
// the fallback re-asked on anything that was not a yes or a no. A person who
// asks what happens to their address deserves an answer, once, then the ask.
const SEND_PURPOSE_ANSWER =
  "It goes to G's team so they can follow up with you - nothing else. Is that okay?";

const CONTACT_WHY_ANSWER =
  "So G's team can get back to you - that's all it's for. If you'd rather not, just say so.";

const EMAIL_WORD_RE = /\b(?:email|e-mail)\b/i;
const PHONE_WORD_RE = /\b(?:phone|cell|mobile|text|number)\b/i;
const FREE_ACCOUNT_VALUE_RE =
  /^(?:why|what|how)\b[\s\S]{0,80}\bfree account\b|\bwhat(?:'s| is) (?:the )?(?:point|benefit|value)\b[\s\S]{0,40}\baccount\b/i;
const PRODUCT_REVIEW_BUILD_RE =
  /\b(?:we can build you|we can build your|you should say|the team at ai\s*asap|g|scott)\s+(?:should|needs? to|has to)\s+(?:talk|speak|connect)\b/i;

/**
 * The sales handoff may open the existing consent-gated contact flow only when
 * the prospect themselves expressly asks for a personal connection with G.
 * A request to build, a coaching note, or a generic account request is not
 * consent to capture contact details.
 */
export function hasExplicitPersonalConnectionRequest(text: string): boolean {
  return (
    !PRODUCT_REVIEW_BUILD_RE.test(text) &&
    /\b(?:i want|i'?d like|i would like|can you|could you|please|let'?s|i'?m ready to)\b[\s\S]{0,70}\b(?:talk|speak|connect|meet|work)\b[\s\S]{0,45}\b(?:with\s+)?(?:g|scott|g\s+personally|scott\s+personally|g'?s\s+help)\b/i.test(text)
  );
}

// ---------------------------------------------------------------------------
// THE ORDINARY HAND RAISE (physical Android session 79317698, 2026-08-31).
//
// The visitor said "have Scott reach out to me" FIVE times. Every one of them
// missed `hasExplicitPersonalConnectionRequest` — that pattern needs an "I
// want / can you" opener AND a talk/speak/connect verb AND G's name, and this
// sentence has none of the three in the required shape. So the flow stayed in
// `exploring`, the brain answered, and 6 kept asking discovery questions at
// somebody who had already raised their hand. Zero contact_entities, zero
// lead_sessions, one logged frustration.
//
// A plain first-person follow-up request is consent enough to ASK how to reach
// them. It is not consent to skip confirmation: the answer still walks the same
// contact_method -> contact_capture -> confirming -> saving states and the same
// RPC. What it does skip is passion/discovery/account, which is what made him
// repeat himself.
// ---------------------------------------------------------------------------

/** Prescriptive/rehearsal framing: they are coaching the flow, not raising a hand. */
const CONTACT_COACHING_RE =
  /\b(?:you should|you could|you might|you'?d better|you need to|you have to|maybe say|say something like|instead of saying|the team (?:at ai\s*asap\s+)?should|(?:scott|g)\s+should|tell (?:them|him|her|people|prospects|customers|visitors)|when (?:someone|somebody|they|a (?:visitor|prospect|customer|user)))\b/i;

/** A quoted/reported request describes another utterance; it is not this visitor's consent. */
const CONTACT_REPORTED_SPEECH_RE =
  /\b(?:i|he|she|they|it|someone|somebody|the (?:visitor|prospect|customer|user|transcript|message|text|note|quote|recording|utterance|log|row|chat|email))\s+(?:said|asked|told|wrote|texted|quoted)\b/i;

/** "call me Scott" is a name, not a phone request. */
// G's ride, 2026-09-04 12:42:20. He said "They call me 6." and 6 replied
// "Absolutely - I'll get you to G. What's your name, and what's your email
// address?", then locked into the email ask seven times and ignored four
// "why?"s and one refusal. Two holes in THIS guard let it through:
//   1. The name token was [A-Z][a-z]+ - a capitalised WORD. 6's own name is
//      a DIGIT, so "call me 6" failed the naming guard, fell through to the
//      bare "call me" contact pattern, and fired a lead capture off the
//      product's own avatar name. Single letters ("call me J") failed too.
//   2. No /i flag. Speech transcripts are not reliably capitalised, so a
//      lowercase "call me scott" fell through the same way.
// The name token now accepts letters OR digits in any case. The negative
// lookahead keeps genuine requests ("call me back", "call me tomorrow")
// OUT of the guard, so those still capture as before.
const CALL_ME_NAMING_RE =
  /\bcall\s+me\s+(?:by\b|what\b|whatever\b|anything\b|(?!back\b|later\b|tomorrow\b|today\b|tonight\b|now\b|soon\b|again\b|asap\b|when\b|if\b|at\b|on\b|in\b|after\b|before\b|about\b|please\b|first\b|right\b|this\b|next\b|the\b|any\s*time\b|some\s*time\b)[\p{L}\p{N}][\p{L}\p{N}'’.-]*)/iu;

const DIRECT_CONTACT_PATTERNS: RegExp[] = [
  // "have Scott reach out to me", "have someone reach out", "get him to call me"
  /\b(?:have|get|let|send)\s+(?:[\w'’]+\s+){0,3}?(?:to\s+)?(?:reach\s+out|call|contact|text|email|e-mail|get\s+in\s+touch|follow\s+up)\b/i,
  // "I want someone to reach out", "can somebody call me", "please follow up with me"
  /\b(?:i\s+want|i'?d\s+like|i\s+would\s+like|i'?m\s+ready\s+(?:to|for)|can|could|please|just)\s+(?:[\w'’]+\s+){0,4}?(?:reach\s+out|call\s+me|contact\s+me|text\s+me|email\s+me|e-mail\s+me|get\s+in\s+touch|follow\s+up)\b/i,
  // bare request aimed at the speaker
  /\b(?:reach\s+out\s+to\s+me|contact\s+me|call\s+me|text\s+me|email\s+me|e-mail\s+me|follow\s+up\s+with\s+me|get\s+in\s+touch\s+with\s+me)\b/i,
  // "take my information", "get my number", "write down my email"
  /\b(?:take|get|grab|save|keep|write\s+down|put\s+down)\s+(?:down\s+)?my\s+(?:info|information|contact(?:\s+info(?:rmation)?)?|details|number|phone(?:\s+number)?|email|e-mail)\b/i,
];

const CONTACT_SELF_REFERENCE_RE = /\b(?:me|my|mine|us|our)\b/i;
// "have someone reach out" / "I'd like someone to reach out" name no pronoun
// but are plainly about the speaker. Coaching framing is already excluded
// above, so an unqualified third person here is still a hand raise.
const CONTACT_ANY_PERSON_RE =
  /\b(?:someone|somebody|anyone|anybody|a\s+person|the\s+team)\b/i;

/**
 * True for a plain first-person request to be followed up with. Rehearsal,
 * coaching, and product-review talk about the handoff stay false, so a person
 * describing the flow is never captured as a lead.
 */
export function hasDirectContactFollowUpRequest(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (PRODUCT_REVIEW_BUILD_RE.test(t)) return false;
  if (CONTACT_COACHING_RE.test(t)) return false;
  if (CONTACT_REPORTED_SPEECH_RE.test(t)) return false;
  if (CALL_ME_NAMING_RE.test(t)) return false;
  if (!DIRECT_CONTACT_PATTERNS.some((pattern) => pattern.test(t))) return false;
  // "have someone reach out" is a hand raise with no pronoun in it. Everything
  // else has to point back at the speaker.
  return CONTACT_SELF_REFERENCE_RE.test(t) || CONTACT_ANY_PERSON_RE.test(t);
}

// G, ride 48c99dfa 2026-09-04, correcting 6 mid-flow: "you said don't do the
// email or phone anymore. It's just what's your name, what's your email
// address." A phone number is still ACCEPTED wherever it turns up - only the
// asking changed.
const DIRECT_CONTACT_OPENING =
  "Absolutely — I'll get you to G. What's your name, and what's your email address?";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+?\d{1,3}[\s().-]*)?(?:\d[\s().-]*){9,15}\d/g;
const SPOKEN_AT = "\u0001";
const SPOKEN_DOT = "\u0002";
const SPOKEN_UNDERSCORE = "\u0003";
const SPOKEN_DASH = "\u0004";
const SENTENCE_TAIL_TLD = /\.(?:so|and|but|then|now|because|however|also|though|instead|which|that)$/i;

export function normalizeSpokenEmail(text: string): string {
  const marked = text.toLowerCase()
    .replace(/\b(?:at sign|at)\b/g, SPOKEN_AT)
    .replace(/\b(?:dot|period)\b/g, SPOKEN_DOT)
    .replace(/\bunderscore\b/g, SPOKEN_UNDERSCORE)
    .replace(/\b(?:dash|hyphen)\b/g, SPOKEN_DASH);
  return marked
    .replace(new RegExp(`\\s*${SPOKEN_AT}\\s*`, "g"), "@")
    .replace(new RegExp(`\\s*${SPOKEN_DOT}\\s*`, "g"), ".")
    .replace(new RegExp(`\\s*${SPOKEN_UNDERSCORE}\\s*`, "g"), "_")
    .replace(new RegExp(`\\s*${SPOKEN_DASH}\\s*`, "g"), "-");
}

export function extractFollowUpEmail(text: string): string | null {
  const direct = text.match(EMAIL_PATTERN)?.[0];
  const spoken = normalizeSpokenEmail(text).match(EMAIL_PATTERN)?.[0];
  let email = (direct ?? spoken)?.toLowerCase().slice(0, 254) ?? null;
  if (email && SENTENCE_TAIL_TLD.test(email)) {
    const trimmed = email.replace(SENTENCE_TAIL_TLD, "");
    email = EMAIL_PATTERN.test(trimmed) ? trimmed : null;
  }
  return email;
}

export function normalizeFollowUpPhone(value: string | null): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function extractFollowUpPhone(text: string): string | null {
  for (const match of text.match(PHONE_PATTERN) ?? []) {
    const phone = normalizeFollowUpPhone(match);
    if (phone) return phone;
  }
  const digitWords: Record<string, string> = {
    zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4",
    five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  };
  const spoken = (text.toLowerCase().match(/\b(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g) ?? [])
    .map((word) => digitWords[word]).join("");
  return normalizeFollowUpPhone(spoken);
}

export function extractVerifiedContact(
  text: string,
  preferred: ContactMethod | null = null,
): { method: ContactMethod; value: string } | null {
  const email = extractFollowUpEmail(text);
  const phone = extractFollowUpPhone(text);
  if (preferred === "email" && email) return { method: "email", value: email };
  if (preferred === "phone" && phone) return { method: "phone", value: phone };
  if (email) return { method: "email", value: email };
  if (phone) return { method: "phone", value: phone };
  return null;
}

export function formatContactForSpeech(method: ContactMethod, value: string): string {
  if (method === "phone") {
    const digits = value.replace(/\D/g, "");
    const national = digits.length > 10 ? digits.slice(-10) : digits;
    const country = digits.slice(0, digits.length - national.length);
    const speak = (chunk: string) => [...chunk].join(", ");
    const groups = national.length === 10
      ? [national.slice(0, 3), national.slice(3, 6), national.slice(6)]
      : [national];
    return [...(country ? [speak(country)] : []), ...groups.map(speak)].join(", ");
  }
  const email = extractFollowUpEmail(value);
  if (!email) return "";
  const spellToken = (token: string) => {
    const spoken: string[] = [];
    let run = "";
    // DASHES, NOT COMMAS. G, 2026-08-31, hearing his own address read back:
    // "he said it in the most fucked up way ... it needs to have dashes in it."
    // And 2026-09-01: "You didn't pronounce it either. You said these like
    // D-E-E." Commas make a TTS voice treat each letter as a separate item and
    // slur runs like D, I, E into a word; a dashed run reads as spelling.
    // It is also the house style for every spoken form in this product
    // ("a-i-ASAP", "a-i-buddy"), which is sacred and never stripped. On his
    // 2026-09-04 ride the read-back he actually accepted was the dashed one:
    // "S-G-D-I-E-T-Z at P-M dot M-E".
    const flush = () => { if (run) spoken.push([...run.toUpperCase()].join("-")); run = ""; };
    for (const char of token) {
      if (/[a-z0-9]/i.test(char)) run += char.toLowerCase();
      else { flush(); if (char === ".") spoken.push("dot"); else if (char === "-") spoken.push("dash"); else if (char === "_") spoken.push("underscore"); else if (char === "+") spoken.push("plus"); }
    }
    flush();
    return spoken.join(" ");
  };
  const at = email.indexOf("@");
  return `${spellToken(email.slice(0, at))} at ${spellToken(email.slice(at + 1))}`;
}

// ---------------------------------------------------------------------------
// RIDE 2026-09-03 22:05 ET - THE VICIOUS CIRCLE, REPRODUCED HERE.
// G said "yes that's correct on the screen", then "Yes, you got it right." and
// the flow re-asked "Did I get that right, yes or no?" three times and never
// moved. Both were real yeses. The old test demanded a SHORT exact phrase
// because the read-back and the send used to be ONE question, so a loose yes
// could have sent his details. They are two beats now: a yes here only walks
// him to the send question and mails nothing, so it can afford to sound like
// a person. Beat two stays strict.
//
// A question, a "but", a correction or a no still stops it dead.
// ---------------------------------------------------------------------------
// RIDE 2026-09-03 19:43 ET: G answered the read-back with "You did." and got
// "Did I get that right, yes or no?" again - twice - until he said "Yes, you
// did." "You did" is the natural answer to "Did I get that right?" and it
// carries no other meaning there.
const CONFIRM_HEAD_RE =
  /^(?:please\s+|ok(?:ay)?[,\s]+|alright[,\s]+|well[,\s]+)?(?:yes|yeah|yep|yup|correct|right|absolutely|exactly|perfect|that'?s\s+(?:correct|right)|that\s+is\s+(?:correct|right)|you\s+did(?:\s+it)?\b|you\s+(?:got\s+it|nailed\s+it|said\s+it\s+correctly)|go\s+ahead|save\s+it|confirm(?:\s+it)?|sounds\s+good)\b/i;
const CONFIRM_ANYWHERE_RE =
  /\b(?:you\s+got\s+(?:it|that)\s+right|that'?s\s+correct|that\s+is\s+correct|that'?s\s+right|that\s+is\s+right|you\s+nailed\s+it|yes[,\s]+you\s+did)\b/i;

export function isExplicitContactConfirmation(text: string): boolean {
  const value = text.trim();
  if (!value || value.includes("?")) return false;
  if (CONTACT_CORRECTION_RE.test(value)) return false;
  if (NO_RE.test(value)) return false;
  if (/\bbut\b/i.test(value)) return false;
  return CONFIRM_HEAD_RE.test(value) || CONFIRM_ANYWHERE_RE.test(value);
}

// "Read it back to me", "what's my email", "I can't see it" - G asked for this
// out loud on the same ride and got the yes-or-no question again instead.
const READ_IT_BACK_RE =
  /(?:read\s+(?:it|that|my\s+\w+)\s+(?:back|out|aloud|again)|read\s+it\s+out\s+loud|say\s+(?:it|that)\s+again|tell\s+me\s+(?:what\s+)?my\s+(?:email|e-mail|phone|number|address)|what(?:'?s| is)\s+my\s+(?:email|e-mail|phone|number|address)|can'?t\s+(?:really\s+)?(?:see|read)\s+it|too\s+small)/i;

export function wantsTheValueReadBack(text: string): boolean {
  return READ_IT_BACK_RE.test(text ?? "");
}

function confirmation(contact: { method: ContactMethod; value: string }): string {
  const readback = formatContactForSpeech(contact.method, contact.value);
  // Contact capture is verbal. Beat one: read the normalized value back and
  // get an explicit yes that we HEARD it right. Permission to send is a
  // separate question that only comes after this one is answered.
  return contact.method === "email"
    ? `I heard ${readback}. Did I get that email right?`
    : `I heard ${readback}. Did I get that number right?`;
}

function capturedStep(contact: { method: ContactMethod; value: string }, sendConsent = false): BuildInterestStep {
  return {
    handled: true,
    state: { stage: "confirming", ...contact, sendConsent },
    spoken: confirmation(contact),
    effect: { kind: "none" },
  };
}

/**
 * A name the visitor gave survives every transition. `capturedStep` builds a
 * fresh state from the contact alone, so without this the name he said one
 * breath earlier would vanish on the way to the read-back.
 */
export function stepBuildInterest(
  currentIn: BuildInterestState,
  userText: string,
): BuildInterestStep {
  const heard = extractSpokenName(userText);
  const known = heard ?? currentIn.fullName ?? null;
  const step = stepBuildInterestInner(currentIn, userText);
  return known && !step.state.fullName
    ? { ...step, state: { ...step.state, fullName: known } }
    : step;
}

function stepBuildInterestInner(
  currentIn: BuildInterestState,
  userText: string,
): BuildInterestStep {
  const text = userText.trim();
  const none: BuildInterestEffect = { kind: "none" };
  // A name can arrive in the same breath as the address ("my name is Scott and
  // my email is..."), or a turn earlier. Hold on to it either way.
  const heardName = extractSpokenName(text);
  const current: BuildInterestState = heardName
    ? { ...currentIn, fullName: heardName }
    : currentIn;

  // A plain hand raise outranks every discovery/account detour, at any stage
  // where nothing has been captured yet. This is the fix for the visitor who
  // had to ask five times.
  if (
    (current.stage === "exploring" || current.stage === "account_offer") &&
    (hasDirectContactFollowUpRequest(text) ||
      hasExplicitPersonalConnectionRequest(text))
  ) {
    const alreadySaid = extractVerifiedContact(text);
    if (alreadySaid) return capturedStep(alreadySaid, true);
    return {
      handled: true,
      state: { stage: "contact_method", method: null, value: null, sendConsent: true },
      spoken: DIRECT_CONTACT_OPENING,
      effect: none,
    };
  }

  if (current.stage === "exploring") {
    // A visitor may volunteer contact information before 6 asks for it. Move
    // into the same readback-and-confirm state; never persist the raw hearing.
    const volunteered = extractVerifiedContact(text);
    if (volunteered) return capturedStep(volunteered);
    return { handled: false, state: current, spoken: null, effect: none };
  }

  if (current.stage === "account_offer") {
    const accountEmail = extractFollowUpEmail(text);
    if (accountEmail) {
      return {
        handled: true,
        state: { stage: "account_setup", method: "email", value: accountEmail },
        spoken: null,
        effect: { kind: "start_account", email: accountEmail },
      };
    }
    if (YES_RE.test(text)) {
      return {
        handled: true,
        state: { ...current, stage: "account_setup" },
        spoken: null,
        effect: { kind: "start_account" },
      };
    }
    if (NO_RE.test(text)) {
      return {
        handled: true,
        state: { stage: "contact_capture", method: null, value: null },
        spoken: "No problem, no account needed — just give me your email or phone number so I know how to reach you, and we’ll keep going right now.",
        effect: none,
      };
    }
    if (FREE_ACCOUNT_VALUE_RE.test(text)) {
      return {
        handled: true,
        state: current,
        spoken: "The free account keeps this conversation and your ideas together, so you can come back and keep building without starting over. Talking to me is free. Want me to set that up so we can keep going?",
        effect: none,
      };
    }
    // A person may keep explaining the business after the offer. Do not trap
    // every non-yes/no sentence in a scripted account loop; let the code brain
    // answer while the offer remains pending for a later clear choice.
    return { handled: false, state: current, spoken: null, effect: none };
  }

  if (current.stage === "contact_offer") {
    const direct = extractVerifiedContact(text);
    if (direct) return capturedStep(direct, current.sendConsent === true);
    if (NO_RE.test(text)) {
      return {
        handled: true,
        state: { stage: "declined", method: null, value: null },
        spoken: "That’s okay. We can keep exploring, and nothing has been submitted.",
        effect: none,
      };
    }
    if (YES_RE.test(text)) {
      return {
        handled: true,
        state: { stage: "contact_method", method: null, value: null, sendConsent: true },
        spoken: "What's your name, and what's your email address?",
        effect: none,
      };
    }
    return { handled: true, state: current, spoken: "Would you like a personal follow-up, yes or no?", effect: none };
  }

  if (current.stage === "contact_method") {
    const direct = extractVerifiedContact(text);
    if (direct) return capturedStep(direct, current.sendConsent === true);
    if (INCOMPLETE_NAME_CUE_RE.test(text)) {
      return {
        handled: true,
        state: { ...current, stage: "name_capture" },
        spoken: "What’s your name?",
        effect: none,
      };
    }
    // "Can I call you Scott?" is a name, not a phone choice, and a question
    // about something else is not a choice either. On iScott that exact line
    // opened the phone box mid-conversation (ride 1cc18a84, 2026-09-03).
    const choosing = !CALL_ME_NAMING_RE.test(text) && !text.includes("?");
    if (CONTACT_WHY_RE.test(text) && !current.whyAnswered) {
      return {
        handled: true,
        state: { ...current, whyAnswered: true },
        spoken: CONTACT_WHY_ANSWER,
        effect: none,
      };
    }
    if (NO_RE.test(text) || CONTACT_REFUSAL_RE.test(text)) {
      return {
        handled: true,
        state: { stage: "declined", method: null, value: null },
        spoken: "That’s okay. Nothing has been submitted.",
        effect: none,
      };
    }
    if (choosing && EMAIL_WORD_RE.test(text)) {
      return {
        handled: true,
        state: { stage: "contact_capture", method: "email", value: null, sendConsent: current.sendConsent },
        spoken: "Tell me the email slowly.",
        effect: none,
      };
    }
    if (choosing && PHONE_WORD_RE.test(text)) {
      return {
        handled: true,
        state: { stage: "contact_capture", method: "phone", value: null, sendConsent: current.sendConsent },
        spoken: "Tell me the phone number one digit at a time.",
        effect: none,
      };
    }
    // Still nothing usable: ask for the email again rather than offering a
    // menu. A phone number said out loud is still picked up above.
    return { handled: true, state: current, spoken: "What's your email address?", effect: none };
  }

  if (current.stage === "name_capture") {
    const heard = extractSpokenName(text) ?? extractStandaloneSpokenName(text);
    if (!heard) {
      return { handled: true, state: current, spoken: "I didn’t catch a name. What’s your name?", effect: none };
    }
    if (current.method && current.value) {
      const captured = capturedStep({ method: current.method, value: current.value }, current.sendConsent === true);
      return { ...captured, state: { ...captured.state, fullName: heard } };
    }
    return {
      handled: true,
      state: { ...current, stage: "contact_method", fullName: heard },
      spoken: "Thanks. What’s your email address?",
      effect: none,
    };
  }

  if (
    current.stage === "failed" &&
    current.method &&
    current.value &&
    isExplicitContactConfirmation(text)
  ) {
    return {
      handled: true,
      state: { ...current, stage: "saving" },
      spoken: "Thanks. I’m trying your follow-up request again now.",
      effect: { kind: "save_contact", method: current.method, value: current.value },
    };
  }

  if (current.stage === "contact_capture" || current.stage === "failed") {
    const direct = extractVerifiedContact(text, current.method);
    if (direct) return capturedStep(direct, current.sendConsent === true);
    // A refusal is heard at ANY method, on the first try. See CONTACT_REFUSAL_RE.
    if (CONTACT_REFUSAL_RE.test(text)) {
      return {
        handled: true,
        state: { stage: "declined", method: null, value: null },
        spoken: "That\u2019s okay. Nothing has been submitted.",
        effect: none,
      };
    }
    // "Why are you asking for it?" gets an answer, once, not the demand again.
    if (CONTACT_WHY_RE.test(text) && !current.whyAnswered) {
      return {
        handled: true,
        state: { ...current, whyAnswered: true },
        spoken: CONTACT_WHY_ANSWER,
        effect: none,
      };
    }
    if (current.method === null && NO_RE.test(text)) {
      return {
        handled: true,
        state: { stage: "declined", method: null, value: null },
        spoken: "That’s okay. Nothing has been submitted.",
        effect: none,
      };
    }
    if (current.method === null && EMAIL_WORD_RE.test(text)) {
      return {
        handled: true,
        state: { stage: "contact_capture", method: "email", value: null },
        spoken: "Tell me the email slowly.",
        effect: none,
      };
    }
    if (current.method === null && PHONE_WORD_RE.test(text)) {
      return {
        handled: true,
        state: { stage: "contact_capture", method: "phone", value: null },
        spoken: "Tell me the phone number one digit at a time.",
        effect: none,
      };
    }
    if (current.method === "email") {
      const parsed = parseSpelledEmailChunk(text);
      // Once the visitor has already supplied the @ boundary, ordinary domain
      // chunks such as "example dot com" are credible continuation even though
      // the shared spell parser conservatively counts "example" as a word.
      const chars = parsed.looksSpelled || current.value?.includes("@")
        ? parsed.chars.replace(/[^a-z0-9._%+@-]/gi, "")
        : "";
      if (chars) {
        const candidate = `${current.value ?? ""}${chars}`.toLowerCase();
        const complete = extractFollowUpEmail(candidate);
        if (complete) return capturedStep({ method: "email", value: complete }, current.sendConsent === true);
        return {
          handled: true,
          state: { stage: "contact_capture", method: "email", value: candidate, sendConsent: current.sendConsent },
          spoken: "Got it. Keep going.",
          effect: none,
        };
      }
    }
    if (current.method === "phone") {
      const digits = (text.match(/\d/g) ?? []).join("") ||
        (text.toLowerCase().match(/\b(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g) ?? [])
          .map((word) => ({ zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9" }[word] ?? ""))
          .join("");
      if (digits) {
        const candidate = `${current.value ?? ""}${digits}`;
        const complete = normalizeFollowUpPhone(candidate);
        if (complete) return capturedStep({ method: "phone", value: complete }, current.sendConsent === true);
        return {
          handled: true,
          state: { stage: "contact_capture", method: "phone", value: candidate, sendConsent: current.sendConsent },
          spoken: "Got it. Keep going.",
          effect: none,
        };
      }
    }
    // RIDE cb2dde76 22:19-22:20: G was telling me where to put the box and got
    // "I need a complete email. Say it again slowly." THREE TIMES. A sentence
    // with no address in it is usually a person talking, not a failed
    // spelling. Let the brain answer and leave the box up; only nudge on
    // something short enough to have been an attempt.
    // RIDE 2026-09-03 19:42: "And it's too wide left to right." / "it should
    // be more narrow." are 7-8 words, so they passed the short-attempt test and
    // each one got "I need a complete email. Say it again slowly." - six times
    // in one minute. Screen talk and coaching are never a spelling attempt, at
    // any length: hand the turn to the brain so 6 answers like a person (the
    // 22:21 replay contract requires handled:false here, not silence).
    if (isScreenTalk(text) || CONTACT_COACHING_RE.test(text)) {
      return { handled: false, state: current, spoken: null, effect: none };
    }
    const looksLikeAnAttempt =
      text.split(/\s+/).filter(Boolean).length <= 8 ||
      /[@0-9]/.test(text) ||
      /\b(?:dot|at sign|underscore|dash|hyphen)\b/i.test(text);
    if (!looksLikeAnAttempt) {
      return { handled: false, state: current, spoken: null, effect: none };
    }
    // MEASURED 2026-09-04 across every recorded conversation since 08-25:
    // "I need a complete email. Say it again slowly." is the most-repeated line
    // 6 has ever said - 10 extra times beyond the first. "I need a complete
    // phone number" adds 5 more. Eight of fifty-five sessions contain a
    // repeated assistant line and EVERY top offender is a capture prompt.
    //
    // G's rule is that 6 never says a line twice. Two tries is a person asking
    // again; a third is a machine. Past the cap, hand the turn to the brain so
    // he can say something human - the state and the captured value are
    // untouched, so a later attempt still lands exactly as before.
    const captureAsks = (current.captureAsks ?? 0) + 1;
    if (captureAsks > 2) {
      return { handled: false, state: current, spoken: null, effect: none };
    }
    return {
      handled: true,
      state: { ...current, captureAsks },
      spoken: current.method === "phone" ? "I need a complete phone number. Say the digits again." : "I need a complete email. Say it again slowly.",
      effect: none,
    };
  }

  if (current.stage === "confirming") {
    // A yes is a yes even when it mentions the screen. This check comes FIRST
    // or the screen-talk guard eats "yes that's correct on the screen".
    if (isExplicitContactConfirmation(text) && current.method && current.value) {
      return {
        handled: true,
        state: { ...current, stage: "permission", readbackConfirmedAt: Date.now() },
        spoken: SEND_PERMISSION_QUESTION,
        effect: none,
      };
    }
    if (current.method && current.value && wantsTheValueReadBack(text)) {
      return { handled: true, state: current, spoken: confirmation({ method: current.method, value: current.value }), effect: none };
    }
    // Describing the box is not an answer to it - but it is also not a cue to
    // nag. RIDE 2026-09-03 19:42-19:43: G was giving layout feedback and got
    // "Did I get that right, yes or no?" back at nearly every sentence -
    // robotic. A LONG screen/coaching remark gets silence (listen); only a
    // short unclear turn earns one gentle re-ask.
    if (isScreenTalk(text) || CONTACT_COACHING_RE.test(text)) {
      const longRemark = text.split(/\s+/).filter(Boolean).length > 8;
      return { handled: true, state: current, spoken: longRemark ? null : "Did I get that right, yes or no?", effect: none };
    }
    const correction = extractVerifiedContact(text, current.method);
    if (correction && !isSameOrMisheardValue(current, correction)) {
      return capturedStep(correction, current.sendConsent === true);
    }
    if (NO_RE.test(text) || CONTACT_CORRECTION_RE.test(text)) {
      return {
        handled: true,
        state: { stage: "contact_capture", method: current.method, value: null, sendConsent: current.sendConsent },
        spoken: current.method === "phone" ? "Okay. Say the corrected phone number digit by digit." : "Okay. Say the corrected email slowly.",
        effect: none,
      };
    }
    // Same cap, same reason: "Did I get that right, yes or no?" is 7 extra
    // repeats in the measured record - the second worst line 6 says. The
    // captured value is kept, so a yes after the cap still confirms normally.
    const confirmAsks = (current.confirmAsks ?? 0) + 1;
    if (confirmAsks > 2) {
      return { handled: false, state: current, spoken: null, effect: none };
    }
    return {
      handled: true,
      state: { ...current, confirmAsks },
      spoken: "Did I get that right, yes or no?",
      effect: none,
    };
  }

  if (current.stage === "permission") {
    // Same rule as beat one: answer first, screen talk second.
    if (isSendPermissionGranted(text) && current.method && current.value) {
      return {
        handled: true,
        state: { ...current, stage: "saving", sendConsent: true, packageConsent: true, followUpAuthorizedAt: Date.now() },
        spoken: "Thank you. Sending it now.",
        effect: { kind: "save_contact", method: current.method, value: current.value },
      };
    }
    if (current.method && current.value && wantsTheValueReadBack(text)) {
      return { handled: true, state: current, spoken: confirmation({ method: current.method, value: current.value }), effect: none };
    }
    if (isScreenTalk(text) || CONTACT_COACHING_RE.test(text)) {
      // Same listen-first rule as the read-back beat (G's 19:42 ride): long
      // feedback gets silence, a short unclear turn gets the question once.
      const longRemark = text.split(/\s+/).filter(Boolean).length > 8;
      return { handled: true, state: current, spoken: longRemark ? null : SEND_PERMISSION_QUESTION, effect: none };
    }
    // A different address here is them fixing it, not answering. Go back to
    // the read-back with the new value; never send the old one behind a yes
    // that was aimed at something else.
    const revised = extractVerifiedContact(text, current.method);
    if (revised && !isSameOrMisheardValue(current, revised)) {
      return capturedStep(revised, current.sendConsent === true);
    }
    if (NO_RE.test(text) || SEND_DECLINE_RE.test(text)) {
      return {
        handled: true,
        // Keep what they told us. Declining to send is not a reason to throw
        // away the value - they may say yes a minute later.
        state: { ...current, stage: "declined", sendConsent: false, packageConsent: false },
        spoken: "That’s okay — nothing has been sent. We can keep going.",
        effect: none,
      };
    }
    // "What are you going to do with that email?" gets an answer, once.
    if (CONTACT_WHY_RE.test(text) && !current.whyAnswered) {
      return {
        handled: true,
        state: { ...current, whyAnswered: true },
        spoken: SEND_PURPOSE_ANSWER,
        effect: none,
      };
    }
    // Silence, small talk and hedges are not a yes. Ask again - but never more
    // than twice. Past that the question has stopped being a question and has
    // become nagging (six times on G's 2026-09-04 ride). Hand the turn to the
    // brain so 6 talks like a person; the box stays up and a later yes still
    // lands, because the state and the captured value are untouched.
    const asks = (current.permissionAsks ?? 0) + 1;
    if (asks > 2) {
      return { handled: false, state: current, spoken: null, effect: none };
    }
    return {
      handled: true,
      state: { ...current, permissionAsks: asks },
      spoken: SEND_PERMISSION_QUESTION,
      effect: none,
    };
  }

  return {
    handled: current.stage === "saving",
    state: current,
    spoken: null,
    effect: none,
  };
}

export function resolveContactSave(
  state: BuildInterestState,
  ok: boolean,
): { state: BuildInterestState; spoken: string } {
  if (ok) {
    return {
      state: { ...state, stage: "submitted" },
      spoken: "Done. Your follow-up request is saved for G’s team, along with this conversation.",
    };
  }
  return {
    state: { ...state, stage: "failed" },
    // The save failed, not their spelling. Keep the confirmed candidate in the
    // state machine so they can retry without repeating the address or number.
    spoken:
      "I couldn’t save that yet. Nothing was submitted. Say yes when you want me to try again — I still have what you told me.",
  };
}

// ---------------------------------------------------------------------------
// Programmatic entry helpers kept for non-visual callers and unit coverage.
// They return the ordinary BuildInterestStep, and the only save authority is
// still `save_contact` -> submit_opportunity_contact.
// ---------------------------------------------------------------------------

/** Visitor tapped Email or Phone in the box. */
export function chooseContactMethod(
  current: BuildInterestState,
  method: ContactMethod,
): BuildInterestStep {
  return {
    handled: true,
    state: { stage: "contact_capture", method, value: null },
    spoken:
      method === "email"
        ? "Say your email slowly and I’ll read it back."
        : "Say the digits of your phone number and I’ll read them back.",
    effect: { kind: "none" },
  };
}

export type TypedContactResult =
  | { ok: true; step: BuildInterestStep }
  | { ok: false; error: string };

/**
 * Visitor typed a value and submitted it. An unusable value is reported back
 * for the box to show inline — the state never regresses and the text they
 * typed is never thrown away.
 */
export function submitTypedContact(
  current: BuildInterestState,
  method: ContactMethod,
  rawValue: string,
): TypedContactResult {
  const raw = (rawValue ?? "").trim();
  if (!raw) {
    return {
      ok: false,
      error: method === "email" ? "Enter an email address." : "Enter a phone number.",
    };
  }
  const value =
    method === "email" ? extractFollowUpEmail(raw) : normalizeFollowUpPhone(raw);
  if (!value) {
    return {
      ok: false,
      error:
        method === "email"
          ? "That doesn’t look like a full email yet — it needs an @ and a dot."
          : "That needs to be a full phone number, 10 digits or more.",
    };
  }
  void current;
  return { ok: true, step: capturedStep({ method, value }) };
}

/**
 * Visitor tapped the confirm control. Same two beats the spoken path walks:
 * confirming the read-back asks for permission, it does not send. A retry
 * after a failed save already has permission and goes straight back to saving.
 */
export function confirmCapturedContact(
  current: BuildInterestState,
): BuildInterestStep {
  if (!current.method || !current.value) {
    return { handled: true, state: current, spoken: null, effect: { kind: "none" } };
  }
  if (current.stage === "failed" || current.packageConsent === true) {
    return {
      handled: true,
      state: { ...current, stage: "saving", packageConsent: true },
      spoken: "Thanks. I’m sending your follow-up request now.",
      effect: {
        kind: "save_contact",
        method: current.method,
        value: current.value,
      },
    };
  }
  return {
    handled: true,
    state: { ...current, stage: "permission" },
    spoken: SEND_PERMISSION_QUESTION,
    effect: { kind: "none" },
  };
}

/** Visitor tapped yes on the send question. */
export function grantSendPermission(
  current: BuildInterestState,
): BuildInterestStep {
  if (!current.method || !current.value) {
    return { handled: true, state: current, spoken: null, effect: { kind: "none" } };
  }
  return {
    handled: true,
    state: { ...current, stage: "saving", sendConsent: true, packageConsent: true },
    spoken: "Thank you. Sending it now.",
    effect: {
      kind: "save_contact",
      method: current.method,
      value: current.value,
    },
  };
}

/** Visitor tapped no on the send question. The value is kept, not destroyed. */
export function declineSendPermission(
  current: BuildInterestState,
): BuildInterestStep {
  return {
    handled: true,
    state: { ...current, stage: "declined", sendConsent: false, packageConsent: false },
    spoken: "That’s okay — nothing has been sent. We can keep going.",
    effect: { kind: "none" },
  };
}

/**
 * Visitor confirmed from the editable box. Validate and normalize the value
 * that is visibly in the input, then save that exact value through the same
 * `save_contact` effect as spoken confirmation.
 */
export function confirmTypedContact(
  current: BuildInterestState,
  method: ContactMethod,
  rawValue: string,
): TypedContactResult {
  const typed = submitTypedContact(current, method, rawValue);
  if (!typed.ok) return typed;
  return { ok: true, step: confirmCapturedContact(typed.step.state) };
}

/** Visitor tapped edit. Keeps the value so they correct it instead of retyping. */
export function editCapturedContact(
  current: BuildInterestState,
): BuildInterestStep {
  return {
    handled: true,
    state: { ...current, stage: "contact_capture" },
    spoken: null,
    effect: { kind: "none" },
  };
}

/** Part 1 is a hard gate: only verified account return or API-confirmed fallback passes. */
export function canAdvanceBuildInterview(
  state: BuildInterestState,
  accountVerified: boolean,
): boolean {
  return accountVerified || state.stage === "submitted";
}
