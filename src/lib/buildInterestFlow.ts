import { parseSpelledEmailChunk } from "./signup/helpers";

export type ContactMethod = "email" | "phone";
export type BuildInterestStage =
  | "exploring"
  | "account_offer"
  | "account_setup"
  | "contact_offer"
  | "contact_method"
  | "contact_capture"
  | "confirming"
  | "saving"
  | "failed"
  | "submitted"
  | "declined";

export type BuildInterestState = {
  stage: BuildInterestStage;
  method: ContactMethod | null;
  value: string | null;
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
};

const YES_RE = /^(?:yes|yeah|yep|sure|okay|ok|please|i do|let'?s do it|go ahead)\b/i;
const NO_RE = /^(?:no|nope|nah|not now|later|don'?t|do not|i decline|skip)\b/i;
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
    const speak = (chunk: string) => [...chunk].join("-");
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
    const flush = () => { if (run) spoken.push([...run].join("-")); run = ""; };
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

function confirmation(contact: { method: ContactMethod; value: string }): string {
  const readback = formatContactForSpeech(contact.method, contact.value);
  return contact.method === "email"
    ? `I heard ${readback}. Is that email correct?`
    : `I heard ${readback}. Is that phone number correct?`;
}

function capturedStep(contact: { method: ContactMethod; value: string }): BuildInterestStep {
  return {
    handled: true,
    state: { stage: "confirming", ...contact },
    spoken: confirmation(contact),
    effect: { kind: "none" },
  };
}

export function stepBuildInterest(
  current: BuildInterestState,
  userText: string,
): BuildInterestStep {
  const text = userText.trim();
  const none: BuildInterestEffect = { kind: "none" };

  if (current.stage === "exploring") {
    if (!hasExplicitPersonalConnectionRequest(text)) {
      return { handled: false, state: current, spoken: null, effect: none };
    }
    return {
      handled: true,
      state: { ...current, stage: "account_offer" },
      spoken: "Let’s get you set up so nothing gets lost — what’s your email? I’ll send a one-click magic link, and this conversation waits for you right where we left it.",
      effect: none,
    };
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
    if (direct) return capturedStep(direct);
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
        state: { stage: "contact_method", method: null, value: null },
        spoken: "Would you rather use email or phone?",
        effect: none,
      };
    }
    return { handled: true, state: current, spoken: "Would you like a personal follow-up, yes or no?", effect: none };
  }

  if (current.stage === "contact_method") {
    const direct = extractVerifiedContact(text);
    if (direct) return capturedStep(direct);
    if (NO_RE.test(text)) {
      return {
        handled: true,
        state: { stage: "declined", method: null, value: null },
        spoken: "That’s okay. Nothing has been submitted.",
        effect: none,
      };
    }
    if (EMAIL_WORD_RE.test(text)) {
      return {
        handled: true,
        state: { stage: "contact_capture", method: "email", value: null },
        spoken: "Tell me the email slowly.",
        effect: none,
      };
    }
    if (PHONE_WORD_RE.test(text)) {
      return {
        handled: true,
        state: { stage: "contact_capture", method: "phone", value: null },
        spoken: "Tell me the phone number one digit at a time.",
        effect: none,
      };
    }
    return { handled: true, state: current, spoken: "Email or phone?", effect: none };
  }

  if (current.stage === "contact_capture" || current.stage === "failed") {
    const direct = extractVerifiedContact(text, current.method);
    if (direct) return capturedStep(direct);
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
        if (complete) return capturedStep({ method: "email", value: complete });
        return {
          handled: true,
          state: { stage: "contact_capture", method: "email", value: candidate },
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
        if (complete) return capturedStep({ method: "phone", value: complete });
        return {
          handled: true,
          state: { stage: "contact_capture", method: "phone", value: candidate },
          spoken: "Got it. Keep going.",
          effect: none,
        };
      }
    }
    return {
      handled: true,
      state: current,
      spoken: current.method === "phone" ? "I need a complete phone number. Say the digits again." : "I need a complete email. Say it again slowly.",
      effect: none,
    };
  }

  if (current.stage === "confirming") {
    const correction = extractVerifiedContact(text, current.method);
    if (correction && correction.value !== current.value) return capturedStep(correction);
    if (NO_RE.test(text) || /\b(?:wrong|correct(?:ion)?|change|instead)\b/i.test(text)) {
      return {
        handled: true,
        state: { stage: "contact_capture", method: current.method, value: null },
        spoken: current.method === "phone" ? "Okay. Say the corrected phone number digit by digit." : "Okay. Say the corrected email slowly.",
        effect: none,
      };
    }
    if (YES_RE.test(text) && current.method && current.value) {
      return {
        handled: true,
        state: { ...current, stage: "saving" },
        spoken: "Thanks. I’m saving your follow-up request now.",
        effect: { kind: "save_contact", method: current.method, value: current.value },
      };
    }
    return { handled: true, state: current, spoken: "Is that correct, yes or no?", effect: none };
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
    spoken: "I couldn’t save that yet. Nothing was submitted. Please say the contact again, or create the free account instead.",
  };
}

/** Part 1 is a hard gate: only verified account return or API-confirmed fallback passes. */
export function canAdvanceBuildInterview(
  state: BuildInterestState,
  accountVerified: boolean,
): boolean {
  return accountVerified || state.stage === "submitted";
}
