// ANTI-REPEAT, GUARANTEED IN CODE.
//
// Ride 755f063f, 2026-09-05 08:34-08:38: 6 said "Take your time" three times
// and "whenever you're ready" four times inside four minutes. The brain prose
// already said "never repeat the same question, interrogate them, or loop",
// and a stronger sentence was added the same morning - but a timing or
// wording rule that lives only in prose has failed on this app before (the
// name ask drifted twice; the opener replayed with three prohibitions in
// place). So the guarantee lives here: a reply that leans on a run of words
// 6 used in one of his last three lines is sent back ONCE for a fresh
// phrasing. Never a third call, never a blocked reply.

/** A shared run of this many consecutive words counts as reuse. */
export const REUSE_MIN_WORDS = 5;

/** How many of 6's previous lines are compared against. */
export const REUSE_LOOKBACK_LINES = 3;

/**
 * Runs 6 is ALLOWED to say again: the brand, and the discovery questions the
 * guide doctrine tells him to stay on until they are answered. Matching is on
 * normalized words, so punctuation and case do not matter.
 */
const ALLOWED_RUNS: readonly string[] = [
  "the team here at aiasap",
  "a i asap",
  "turbo charge your life",
  "money making machine",
  // RIDE c25f52ab 2026-09-05: the discovery questions used to be allowed here
  // and 6 asked "what do you love doing most" FIVE times in four minutes. The
  // doctrine says stay on the topic until it is answered - it never said use
  // the same words. A repeat of the exact question now goes back for a fresh
  // phrasing like any other line; the brand runs above stay free.
];

/**
 * Stock filler lines. These are 2-4 words, too short for the run detector,
 * and they are exactly what G heard: "Take your time" three times,
 * "whenever you're ready" four. One of these inside the lookback window is
 * reuse on its own, whatever the words around it.
 */
const STOCK_PHRASES: readonly string[] = [
  "take your time",
  "whenever youre ready",
  "when youre ready",
  "no rush",
  "im here to listen",
  "im here for it",
  "thats a good start",
  "sounds like youre",
  "great question",
  "no worries",
  // RIDE f225a5c7 2026-09-05: "what part of" nine times, "lights you up" and
  // "excites you most" on repeat. Three words is under the run detector.
  "what part of",
  "lights you up",
  "light up on",
  "excites you most",
  "excite you most",
];

export function normalizeWords(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

function isAllowed(run: string): boolean {
  // Whole-word containment either way: the run sits inside an allowed phrase
  // ("do you love doing most" inside the doctrine question), or an allowed
  // phrase sits inside the run.
  return ALLOWED_RUNS.some(
    (ok) => ` ${run} `.includes(` ${ok} `) || ` ${ok} `.includes(` ${run} `),
  );
}

/**
 * The first run of `minWords` consecutive words in `reply` that also appears,
 * in the same order, in any of `priors`. Returns the run as plain words, or
 * null when the reply is fresh. Allowed runs never count.
 */
export function findReusedRun(
  reply: string,
  priors: readonly string[],
  minWords = REUSE_MIN_WORDS,
): string | null {
  const words = normalizeWords(reply);
  if (words.length === 0 || priors.length === 0) return null;
  const replyText = ` ${words.join(" ")} `;
  const priorTexts = priors.map((p) => ` ${normalizeWords(p).join(" ")} `);
  for (const stock of STOCK_PHRASES) {
    const needle = ` ${stock} `;
    if (replyText.includes(needle) && priorTexts.some((t) => t.includes(needle))) {
      return stock;
    }
  }
  if (words.length < minWords) return null;
  const priorRuns = new Set<string>();
  for (const prior of priors) {
    const pw = normalizeWords(prior);
    for (let i = 0; i + minWords <= pw.length; i += 1) {
      priorRuns.add(pw.slice(i, i + minWords).join(" "));
    }
  }
  if (priorRuns.size === 0) return null;
  for (let i = 0; i + minWords <= words.length; i += 1) {
    const run = words.slice(i, i + minWords).join(" ");
    if (priorRuns.has(run) && !isAllowed(run)) return run;
  }
  return null;
}

/** The one-line system nudge sent with the single retry. */
export function antiRepeatNudge(run: string): string {
  return (
    `Your draft reply reused the words "${run}", which you already said in one of your last three replies. ` +
    "Say the same thing in a fresh way: different words, no stock filler like \"take your time\" or \"whenever you're ready\", " +
    "and do not ask the same question in the same words. Keep everything else about your reply the same."
  );
}

/** 6's last few lines from the history the client sent, oldest first. */
export function recentAssistantLines(
  history: ReadonlyArray<{ role: string; content: string }>,
  lookback = REUSE_LOOKBACK_LINES,
): string[] {
  return history
    .filter((turn) => turn.role === "assistant")
    .slice(-lookback)
    .map((turn) => turn.content);
}
