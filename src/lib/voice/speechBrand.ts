/**
 * Converts the written brand to the spoken form G has locked.
 *
 * THE SPOKEN FORM IS `a-i-ASAP` — the letter A, the letter I, then ASAP as the
 * familiar word. Written UI, product copy and transcripts stay `aiASAP`; only
 * what reaches the TTS changes.
 *
 * HISTORY, so nobody flips this a third time:
 *   2026-08-31 — after a ride where 6 mispronounced the brand, this was changed
 *     to spell every letter, `A-I-A-S-A-P`.
 *   2026-09-03 — G, mid-ride, rejected exactly that: "you don't say
 *     A-I-A-S-A-P so well... you have the dashes, A dash I dash ASAP." 6's brain
 *     prompt was updated to forbid the six-letter spelling. The formatter was
 *     not, so it kept overriding the brain at the last boundary.
 *   2026-09-04 — G, as a standing order: "when he says aiASAP lock this in,
 *     needs a-i-ASAP and everything else such as this, the dashes. all sites...
 *     no deviation."
 *
 * His ears are the authority here, and this is now his third statement of it.
 * Do not revert on telemetry or on a single bad-sounding ride; raise it with him.
 *
 * Idempotent on purpose. The formatter runs at more than one speech boundary
 * (scripted repeat AND brain replies), and `a-i-ASAP` does not re-match the
 * `aiasap` word pattern, so formatting an already-formatted line is a no-op.
 */
export const SPOKEN_BRAND = "a-i-ASAP";

export function formatSixSpeechForTts(text: string): string {
  if (!text) return text;
  return (
    text
      // The retired six-letter spelling, in case it is sitting in a stored line
      // or a model reply. Longest pattern first so it cannot be half-matched.
      .replace(/\bA-I-A-S-A-P\b/gi, SPOKEN_BRAND)
      // 6 WRITES THE DASHED FORM HIMSELF (G's ride 2026-09-04: the transcript
      // is full of "a-i-ASAP" in his own replies). His prompt uses that form in
      // its own example copy, so he emits it whatever the rule says. Without
      // this line the formatter is a no-op on those replies and the brain's
      // spelling reaches the voice engine unchanged - which is precisely how
      // "AIA CP" got out. Normalise it to whatever SPOKEN_BRAND is; when they
      // are identical this is a harmless no-op.
      .replace(/\ba-i-ASAP\b/gi, SPOKEN_BRAND)
      // case-insensitive: the brain writes `aiASAP`, but a stored or model line
      // can carry `aiasap` or `AIASAP`, and all three sound the same out loud.
      .replace(/\baiasap\b/gi, SPOKEN_BRAND)
  );
}
