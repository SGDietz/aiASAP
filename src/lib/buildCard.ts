/**
 * THE BUILD CARD — the summary that replaces the transcript.
 *
 * G told people, through 6: "no person on the team reads it line by line, they
 * only get a short summary." There was no summary and no summariser, so that
 * sentence was not true — and it is the exact sentence that buys somebody's
 * honesty, the reason they relax and say the real thing. 6's spoken line has
 * been walked back to an honest version until this is live and in use.
 *
 * Design is Ara's (Job 16) and the constraint she insisted on is the whole
 * point: ONE SCREEN. Her words — "A summary can replace the transcript if it is
 * one screen. If it is a memo, G will read the raw talk." A summary nobody
 * reads is worse than none, because it makes the promise a lie while looking
 * like it kept it.
 *
 * So the caps here are not stylistic. They are what makes the promise true.
 */

/** Ara's hard cap. Past this it scrolls on a phone and gets skipped. */
export const BUILD_CARD_MAX_WORDS = 350;
/** Past eight quotes you are not summarising, you are reading the transcript. */
export const BUILD_CARD_MAX_QUOTES = 8;
export const BUILD_CARD_MAX_QUOTE_WORDS = 20;

/**
 * Categories that must never reach the card.
 *
 * Somebody brain-dumping in their car says these in the same breath as the real
 * work — that is exactly why they leak. Ara: "the car-vent — marriage, money
 * panic, a kid, a diagnosis — because it sits next to the real work in the same
 * breath. Ban those categories by name."
 */
export const BUILD_CARD_BANNED = [
  "health, medication, bodies, surgery, diagnoses, weight, age-as-illness",
  "money trouble: debt, broke, bankruptcy, cannot make rent",
  "family pain: divorce, fights, a child's problems, a dying relative",
  "other people's full names, except a customer they offered as proof",
  "politics, religion, anything said as a private aside",
] as const;

/** The twelve sections, in order. The order is the build order for a reason. */
export const BUILD_CARD_SECTIONS = [
  "WHO",
  "LOVE",
  "DRIVE",
  "YESTERDAY",
  "WHAT THEY SELL / LAST PAY",
  "MUST-GET-DONE",
  "WAY IN",
  "PROOF",
  "THE NUMBER",
  "DO-NOT-CALL",
  "QUOTES",
  "BUILD NOTES",
] as const;

/**
 * The instruction sent to the model. Ara's Part B, near verbatim.
 *
 * SAID / GUESSED / MISSING tagging is the part that stops a brand being built
 * on a hallucination. A guess that reads like a fact is how somebody's business
 * ends up described wrongly on their own public page.
 */
export function buildCardPrompt(): string {
  return [
    "You write a BUILD CARD for Scott, not a story.",
    "",
    `Output exactly these ${BUILD_CARD_SECTIONS.length} headings, in this order, plain text, no preamble:`,
    BUILD_CARD_SECTIONS.map((s, i) => `${i + 1}. ${s}`).join("\n"),
    "",
    `HARD CAPS: ${BUILD_CARD_MAX_WORDS} words total, plus at most ${BUILD_CARD_MAX_QUOTES} quotes of ${BUILD_CARD_MAX_QUOTE_WORDS} words or fewer.`,
    "If it would scroll on a phone it is too long. Shorter is better than complete.",
    "",
    "Tag every fact SAID, GUESSED or MISSING. Never let a guess read like a fact.",
    "Use THEIR words for LOVE, the barbecue line, and the quotes. Do not polish them into marketing.",
    "",
    "NEVER include any of the following, even as a hint:",
    BUILD_CARD_BANNED.map((b) => `- ${b}`).join("\n"),
    "",
    "If the transcript rambles: ignore the side stories. Keep work, money, love, and the way in.",
    "If it is very short: fill what exists and mark the rest MISSING. Do not invent a business.",
    "If they never answered the money question: that section is MISSING. Never guess a price from the feel of it.",
    "If the talk spans several visits: treat it as one pile. Prefer a later correction over an earlier answer, and note 'corrected on a later visit' in BUILD NOTES. Do not write a diary of visits.",
    "If they said do not put that on the site: obey it. Nothing from that part goes in a quote or on the page.",
    "Never quote 6 - only the person - except to show they refused something.",
    "",
    "QUOTES: choose them because they sound like THAT person, not because they are dramatic. Keep the odd word they used. Never a paragraph.",
    "BUILD NOTES: at most 4 bullets - what the site should sell, what to keep off the page, the first picture needed, the first risk.",
  ].join("\n");
}

export type BuildCardCheck = {
  ok: boolean;
  words: number;
  quotes: number;
  problems: string[];
};

/**
 * Check a produced card against the caps before anybody relies on it.
 *
 * A model told "350 words" will drift past it, and a card that quietly grew
 * into a memo is how the promise breaks without anyone noticing. This is the
 * tripwire — it does not rewrite anything, it just refuses to call a memo a
 * summary.
 */
export function checkBuildCard(card: string): BuildCardCheck {
  const problems: string[] = [];
  const text = String(card ?? "");

  const quoted = text.match(/"[^"]{1,400}"/g) ?? [];
  // Words outside the quotes — quotes have their own allowance, so counting
  // them twice would punish a card for doing the thing we asked for.
  const withoutQuotes = text.replace(/"[^"]{1,400}"/g, " ");
  const words = withoutQuotes.split(/\s+/).filter(Boolean).length;

  if (words > BUILD_CARD_MAX_WORDS) {
    problems.push(`${words} words, over the ${BUILD_CARD_MAX_WORDS} cap`);
  }
  if (quoted.length > BUILD_CARD_MAX_QUOTES) {
    problems.push(`${quoted.length} quotes, over the ${BUILD_CARD_MAX_QUOTES} cap`);
  }
  for (const q of quoted) {
    const qw = q.replace(/"/g, "").split(/\s+/).filter(Boolean).length;
    if (qw > BUILD_CARD_MAX_QUOTE_WORDS) {
      problems.push(`a quote runs ${qw} words, over ${BUILD_CARD_MAX_QUOTE_WORDS}`);
      break;
    }
  }
  const missingSections = BUILD_CARD_SECTIONS.filter(
    (s) => !text.toUpperCase().includes(s),
  );
  if (missingSections.length) {
    problems.push(`missing section(s): ${missingSections.join(", ")}`);
  }

  return { ok: problems.length === 0, words, quotes: quoted.length, problems };
}
