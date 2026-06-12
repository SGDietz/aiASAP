// Spoken phone-number capture (2026-06-10, SMS reminders). PURE + conservative
// — same never-guess principle as the email capture: a number only counts when
// the digits cleanly form a US number. Number-words supported because STT
// writes "four ten" as often as "410".
const PHONE_NUM_WORDS: Record<string, string> = {
  zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4",
  five: "5", six: "6", seven: "7", eight: "8", nine: "9",
};

export const SMS_OPT_IN_RE =
  /\b(?:text me|by text|via text|over text|text message|send (?:me )?(?:a )?texts?|sms)\b/i;

/** "my number is..." — the coached follow-up sentence stands on its own
 *  (lesson from the signup gates: a coached reply must never need the
 *  original trigger word to be heard). Only ACTS when a clean number parses. */
export const PHONE_GIVE_RE = /\bmy (?:phone |cell )?number(?:'s| is)\b/i;

/**
 * Pull a US phone number out of one utterance. Accepts digits, dashes,
 * parens, dots, spaces, and spelled digit-words. Returns E.164 (+1...) or
 * null when no clean 10/11-digit number is present.
 */
export function parseSpokenPhone(text: string): string | null {
  const tokens = text
    .toLowerCase()
    .replace(/[']/g, "")
    .split(/[\s,]+/g)
    .map((t) => (t in PHONE_NUM_WORDS ? PHONE_NUM_WORDS[t] : t));
  const digits = tokens
    .join(" ")
    .replace(/[^0-9]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function fmtPhoneSpoken(e164: string): string {
  const d = e164.replace(/^\+1/, "");
  if (d.length !== 10) return e164;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}
