import {
  longestCommonSubsequenceLength,
  wordsForComparison,
} from "../voiceMode/turnIntake";

// ---------------------------------------------------------------------------
// KEEP EVERYTHING, MAKE IT HONEST (2026-08-21). The claim-and-merge installed
// earlier today stopped 6's lines being stored twice, but only the ASSISTANT
// side: it matches by exact normalized text, and the provider's transcript
// hands back a USER turn as one row per STT final - a PIECE of the turn, never
// the turn. Session 03aef2a8: "Um, the mute" / "didn't work the first time..."
// / "Um," / "All the buttons, I think they need a cool" / "design." / "And a
// big red" / "square stop. They look great. They're laid out nice." = seven
// rows for a breath the app logged once, from a DIFFERENT recognizer, as one
// sentence with an utterance_id. A piece can never equal the whole, so every
// user breath was stored 1 + N times.
//
// Both copies are true and both are KEPT: a transcript row is never deleted,
// on any path, and the provider's copy is often the better transcription
// ("on ChatGPT right now" vs the browser's "when I Chacha BT right now"). This
// module only decides which app turn a piece BELONGS to, so the piece can carry
// that turn's utterance_id and readers can fold pieces under their turn instead
// of printing them twice. Text never matches exactly across recognizers ("laid
// out nice" vs "laid out nicely"), so the test is containment: how much of the
// piece's words appear, in order, inside the whole turn. A wrong answer here
// is a wrong LABEL, fixable with one PATCH - never a lost row.
// ---------------------------------------------------------------------------

/** A provider STT piece of a USER turn. utterance_id set = folded under that app turn; NULL = honest orphan. */
export const FRAGMENT_SOURCE = "liveavatar_api_fragment";
/** A provider ASSISTANT row that is part of an app line but not the whole line (6 was cut off mid-sentence). */
export const PARTIAL_SOURCE = "liveavatar_api_partial";

/** Share of a piece's words that must appear, in order, in the whole turn. */
export const LINK_MIN_CONTAINMENT = 0.6;

/**
 * Allowed gap (ms) between the app row's created_at and the piece's end time
 * (la_absolute_timestamp, seconds). before = the app row landed this long
 * BEFORE the piece ended; after = AFTER.
 * User: the browser final comes last, so the app row lands after the pieces
 * (03aef2a8: pieces end 805-823, app row at 825.186 = 2-20 s after). 10 s of
 * "before" covers the provider end-pointing late on the last piece.
 * Assistant: the app logs 6's line at EMIT time and the provider stamps the END
 * of speech, so the app row lands before the pieces - up to two minutes before
 * on a long reply. 15 s the other way: a cold function + clock skew measured
 * 1.3-2.5 s on real rows, and 5 s was too close to regress today's fix.
 */
export const LINK_WINDOW_MS: Record<
  "user" | "assistant",
  { before: number; after: number }
> = {
  user: { before: 10_000, after: 90_000 },
  assistant: { before: 120_000, after: 15_000 },
};

export type LinkablePiece = {
  key: string;
  role: "user" | "assistant";
  message: string;
  la_absolute_timestamp: number;
};

export type LinkableTurn = {
  role: string;
  message: string | null;
  utterance_id: string | null;
  created_at: string;
};

export type PieceLink = { key: string; utteranceId: string; score: number };

function comparableWords(text: string): string[] {
  // Curly apostrophes come from one recognizer and straight ones from the
  // other; the client's word splitter keeps apostrophes, so fold them first.
  return wordsForComparison(
    text.replace(/’/g, "'").replace(/\bdidn't\b/gi, "did not"),
  );
}

const SHORT_ORPHAN_WORDS = new Set([
  "a",
  "an",
  "and",
  "but",
  "er",
  "it",
  "of",
  "or",
  "so",
  "that",
  "the",
  "this",
  "to",
  "uh",
  "um",
]);

/**
 * A content word (5+ letters) the piece says that the turn does not even begin
 * to say ("brother" vs "sister"). Prefix match so recognizer spelling drift
 * ("nice"/"nicely") is not an unshared word. Allowance is one unshared word per
 * eight words of piece, rounded down: 1-7 words get none, 8-15 get one.
 * Common "didn't"/"did not" drift is normalized before this check, while the
 * longer observed "because"/"cause" phrase has enough context for one drift
 * allowance. Short semantic substitutions therefore stay honest orphans.
 */
function tooManyUnsharedContentWords(
  pieceWords: readonly string[],
  wholeWords: readonly string[],
): boolean {
  let unshared = 0;
  for (const w of pieceWords) {
    if (w.length < 5) continue;
    const stem = w.slice(0, 4);
    if (!wholeWords.some((x) => x.startsWith(stem))) unshared += 1;
  }
  return unshared > Math.floor(pieceWords.length / 8);
}

/**
 * 0..1: share of `piece`'s words found, in order, inside `whole`. One- and
 * two-word pieces must be found whole or score 0: "Um," is noise the app never
 * accepted and must stay an honest orphan rather than attach to whichever turn
 * happens to contain "the".
 */
export function containmentScore(piece: string, whole: string): number {
  const pieceWords = comparableWords(piece);
  const wholeWords = comparableWords(whole);
  if (pieceWords.length === 0 || wholeWords.length === 0) return 0;
  if (
    pieceWords.length <= 2 &&
    pieceWords.every((word) => SHORT_ORPHAN_WORDS.has(word))
  ) {
    return 0;
  }
  const overlap = longestCommonSubsequenceLength(pieceWords, wholeWords);
  if (pieceWords.length <= 2) return overlap === pieceWords.length ? 1 : 0;
  // When every word exists but the recognizer produced a conflicting order,
  // do not let the 60% threshold turn that inversion into a false label.
  if (
    overlap < pieceWords.length &&
    pieceWords.every((word) => wholeWords.includes(word))
  ) {
    return 0;
  }
  if (tooManyUnsharedContentWords(pieceWords, wholeWords)) return 0;
  return overlap / pieceWords.length;
}

/** Same words in the same order: the provider's row IS the app's line, not a piece of it. */
export function isWholeLine(piece: string, whole: string): boolean {
  return comparableWords(piece).join(" ") === comparableWords(whole).join(" ");
}

/**
 * For each piece, the best app turn of the same role inside the time window:
 * highest containment, then nearest in time. Pieces with no turn above the
 * floor are absent from the result and stay exactly as they are.
 *
 * Assistant pieces that are the WHOLE line are never linked here: an identical
 * line is the equality merge's job, and when that merge refused it (6 really
 * said the same line twice - claimedIds) it must stay a visible full row, not
 * be folded away as a "partial" of the first.
 */
export function linkPiecesToTurns(
  pieces: readonly LinkablePiece[],
  turns: readonly LinkableTurn[],
): PieceLink[] {
  const links: PieceLink[] = [];
  for (const piece of pieces) {
    const pieceMs = piece.la_absolute_timestamp * 1000;
    const window = LINK_WINDOW_MS[piece.role];
    let best: { utteranceId: string; score: number; distanceMs: number } | null =
      null;
    for (const turn of turns) {
      if (turn.role !== piece.role || !turn.utterance_id) continue;
      const text = (turn.message ?? "").trim();
      if (!text) continue;
      const turnMs = Date.parse(turn.created_at);
      if (!Number.isFinite(turnMs)) continue;
      const delta = turnMs - pieceMs;
      if (delta < -window.before || delta > window.after) continue;
      if (piece.role === "assistant" && isWholeLine(piece.message, text)) continue;
      const score = containmentScore(piece.message, text);
      if (score < LINK_MIN_CONTAINMENT) continue;
      const distanceMs = Math.abs(delta);
      if (
        !best ||
        score > best.score ||
        (score === best.score && distanceMs < best.distanceMs)
      ) {
        best = { utteranceId: turn.utterance_id, score, distanceMs };
      }
    }
    if (best) {
      links.push({ key: piece.key, utteranceId: best.utteranceId, score: best.score });
    }
  }
  return links;
}
