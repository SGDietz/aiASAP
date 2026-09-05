export const DEFAULT_SPEECH_FRAGMENT_TTL_MS = 8_000;

export type PendingSpeechFragment = {
  text: string;
  at: number;
};

export type SpeechIntakeResult =
  | {
      action: "hold";
      pending: PendingSpeechFragment;
      text: null;
    }
  | {
      action: "dispatch";
      pending: null;
      text: string;
    };

export type TurnIntakeDecision =
  | {
      kind: "hold";
      pending: PendingSpeechFragment;
    }
  | {
      kind: "dispatch";
      pending: null;
      text: string;
      stitched: boolean;
    };

/**
 * Preserve a provider "final" that never receives a continuation. WildWorks'
 * lead intake keeps consecutive user fragments until the assistant boundary;
 * the browser stream has no explicit boundary event, so this bounded flush is
 * the equivalent. The timestamp check makes stale timers harmless after a
 * newer fragment replaces the pending value.
 */
export function flushPendingSpeechFragment(
  pending: PendingSpeechFragment | null,
  now: number,
  minimumHoldMs = 1_400,
): string | null {
  if (!pending || now < pending.at || now - pending.at < minimumHoldMs) {
    return null;
  }
  // A held fragment with no words in it at all - "?", "...", a stray click -
  // is not speech. Deliver anything real, drop that.
  if (wordsForComparison(pending.text).length === 0) return null;
  return normalizeSpeech(pending.text) || null;
}

function normalizeSpeech(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function wordsForComparison(value: string): string[] {
  return normalizeSpeech(value)
    .toLowerCase()
    .replace(/[.,!?;:"()[\]{}…—-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// A HALF-WORD IS NOT A TURN.
//
// Ride cf79a533, 2026-09-03, 78 seconds long: 6 gave a full spoken reply to
// "uit", to "with", to "you", and to "?" - ten replies in that minute and a
// bit. G: "This is all talking over me."
//
// It is worse than rude, it LOSES HIM. While 6 is talking the app's mic is
// gated, so the sentence G was actually in the middle of never becomes a turn
// at all. Four of his sentences that ride exist only in the provider's
// transcript, including "That's not the intro line, Claude" and "This is all
// talking over me" - measured, not guessed (scratchpad/lost_words.py).
//
// So a candidate with no substance is HELD instead of answered. If the rest of
// the sentence arrives it merges and 6 answers the whole thought. If nothing
// follows, the ordinary flush still delivers it, so a genuine one-word answer
// is never swallowed - it just stops landing on top of the speaker.
// ---------------------------------------------------------------------------
function hasSpeechSubstance(text: string): boolean {
  const words = wordsForComparison(text);
  // "?" , "...", stray punctuation: never worth a reply, at any point.
  if (words.length === 0) return false;
  if (words.length >= 2) return true;
  // One word only passes straight through when it is a real answer ("Yes.")
  // or a real command ("stop"). Everything else waits a beat.
  return isStandaloneAnswer(words) || isStandaloneActionableCommand(text);
}

function isStandaloneActionableCommand(value: string): boolean {
  const normalized = normalizeSpeech(value).replace(/[.?!]+$/g, "");
  if (
    /^(?:please\s+)?(?:add|remove|delete|clear|close|open|show|make|create|start|switch|rename|move|read|reorder)\s+(?:a|an|the|my|our|this|that)$/i.test(
      normalized,
    )
  ) {
    return false;
  }
  return /^(?:please\s+)?(?:add|remove|delete|clear|close|open|show|make|create|start|switch|rename|move|read|reorder)\s+(?:(?:the|my|our|a|an|this|that)\s+)?\S+/i.test(
    normalized,
  );
}

/**
 * Conservative final-transcript guard for STT shards that clearly stop before
 * their object or clause arrives. It intentionally does not try to determine
 * whether every utterance is grammatically complete: explicit, usable commands
 * such as "add milk" and "close the list" keep their low-latency path.
 */
export function isLikelyIncompleteSpeechFragment(text: string): boolean {
  const normalized = normalizeSpeech(text);
  if (!normalized) return false;

  // Clear command + real object shapes are actionable even without punctuation.
  // An article alone ("add a", "open the") is still an STT shard.
  if (isStandaloneActionableCommand(normalized)) {
    return false;
  }

  // Explicit invitations and complete direct "What do you think?" shapes
  // legitimately end in think/need/want. Questions are not blanket-exempt:
  // providers often finalize shards such as "Can you?" and "What do you".
  if (
    /^(?:tell|show) me what (?:you )?(?:think|need|want)$/i.test(normalized) ||
    /^(?:let me know) what (?:you )?(?:think|need|want)$/i.test(normalized) ||
    /^what\s+(?:do|does|did)\s+(?:i|you|we|they|he|she|people)\s+(?:think|need|want)[?]?$/i.test(
      normalized,
    )
  ) {
    return false;
  }

  // A complete interrogative may legitimately end in "that". The dangling
  // word guard below used to hold the exact normal question "What do you mean
  // by that?" because it stripped the punctuation first, so the turn never
  // reached the brain. Preserve fragment protection for statements such as
  // "I think that"; this exception is intentionally question-shaped only and
  // accepts STT punctuation variants (missing ?, ?..., or an ellipsis).
  if (/^(?:what|why|how|where|when)\b.*\bthat(?:[?.…]+)?$/i.test(normalized)) {
    return false;
  }

  const clause = normalized.replace(/[, .?!…]+["')\]]*$/g, "");

  const wordCount = wordsForComparison(normalized).length;

  // Function words, auxiliaries, and unfinished command verbs need a following
  // object/clause. These include the observed "And added a" and "take the".
  if (
    /\b(?:and|but|so|because|if|when|while|although|though|that|which|who|whose|where|the|a|an|my|your|our|his|her|their|its|to|of|with|for|from|into|onto|about|as|is|are|was|were|be|been|being|am|do|does|did|have|has|had|can|could|will|would|shall|should|may|might|must|gonna|wanna|add|added|remove|removed|make|made|create|created|open|opened|close|closed|switch|switched|rename|renamed|move|moved|um|uh|er|don'?t|doesn'?t|didn'?t|can'?t|won'?t)\s*$/i.test(
      clause,
    )
  ) {
    if (
      /^(?:yes|yeah|yep|no|nope)[,\s]+i (?:do|don'?t|can|can'?t|will|won'?t|would|wouldn'?t)$/i.test(
        clause,
      )
    ) {
      return false;
    }
    return true;
  }

  if (
    !/^(?:who|how)\s+are\s+you$/i.test(clause) &&
    /^(?:what|why|how|where|when|which|can|could|would|will|do|does|did|is|are|was|were)(?:\s+\S+){0,2}\s+(?:i|you|we|they|he|she)$/i.test(
      clause,
    )
  ) {
    return true;
  }

  // Exact latest-SUP class: STT finalized these thought lead-ins 579-629 ms
  // before their continuations, causing 6 to say "Go ahead" over G.
  return (
    wordCount <= 12 &&
    /\b(?:(?:i|we|you|they|people|it|this|that)\s+(?:think|need|want)|(?:i|we|you|they|people)\s+(?:don'?t|doesn'?t|didn'?t|can'?t|won'?t)|(?:is|was|feels|looks|sounds|seems)\s+like)\s*$/i.test(
      clause,
    )
  );
}

export function longestCommonSubsequenceLength(
  left: readonly string[],
  right: readonly string[],
): number {
  const previous = new Array<number>(right.length + 1).fill(0);
  const current = new Array<number>(right.length + 1).fill(0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current.fill(0);
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] =
        left[leftIndex - 1] === right[rightIndex - 1]
          ? previous[rightIndex - 1] + 1
          : Math.max(previous[rightIndex], current[rightIndex - 1]);
    }
    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

export function mergeSpeechFragments(head: string, tail: string): string {
  const first = normalizeSpeech(head);
  const second = normalizeSpeech(tail);
  if (!first) return second;
  if (!second) return first;

  const firstWords = wordsForComparison(first);
  const secondWords = wordsForComparison(second);
  const firstComparable = firstWords.join(" ");
  const secondComparable = secondWords.join(" ");

  if (secondComparable.includes(firstComparable)) return second;
  if (firstComparable.includes(secondComparable)) return first;

  // Later provider finals often revise and contain the earlier shard. Prefer the
  // fuller final instead of storing/responding to two versions of one turn.
  if (secondWords.length >= firstWords.length && firstWords.length >= 3) {
    const overlap = longestCommonSubsequenceLength(firstWords, secondWords);
    if (overlap / firstWords.length >= 0.55) return second;
  }

  const maximumOverlap = Math.min(firstWords.length, secondWords.length);
  for (let overlap = maximumOverlap; overlap >= 1; overlap -= 1) {
    if (
      firstWords.slice(-overlap).join(" ") ===
      secondWords.slice(0, overlap).join(" ")
    ) {
      const remainder = second.split(/\s+/).slice(overlap).join(" ");
      return normalizeSpeech(`${first} ${remainder}`);
    }
  }

  return `${first} ${second}`;
}

/**
 * Holds only clearly incomplete shards. A fresh continuation is merged and
 * re-evaluated; a stale shard is discarded rather than contaminating a new
 * turn. The caller owns the pending ref, so avatar and list transports share
 * the same deterministic intake contract without timers or parallel queues.
 */
export function acceptSpeechFragment(
  pending: PendingSpeechFragment | null,
  incomingText: string,
  now: number,
  ttlMs = DEFAULT_SPEECH_FRAGMENT_TTL_MS,
): SpeechIntakeResult {
  const incoming = normalizeSpeech(incomingText);
  const hasFreshPending =
    pending !== null &&
    now >= pending.at &&
    now - pending.at <= ttlMs;
  const shouldDropFreshPending =
    hasFreshPending && isStandaloneActionableCommand(incoming);
  const candidate =
    hasFreshPending && !shouldDropFreshPending
      ? mergeSpeechFragments(pending.text, incoming)
      : incoming;

  if (!hasSpeechSubstance(candidate) || isLikelyIncompleteSpeechFragment(candidate)) {
    return {
      action: "hold",
      pending: { text: candidate, at: now },
      text: null,
    };
  }

  return { action: "dispatch", pending: null, text: candidate };
}

export function resolveTurnIntake({
  incoming,
  pending,
  now,
  maxPendingAgeMs = DEFAULT_SPEECH_FRAGMENT_TTL_MS,
}: {
  incoming: string;
  pending: PendingSpeechFragment | null;
  now: number;
  maxPendingAgeMs?: number;
}): TurnIntakeDecision {
  const freshPending =
    pending !== null &&
    now >= pending.at &&
    now - pending.at <= maxPendingAgeMs;
  const result = acceptSpeechFragment(
    pending,
    incoming,
    now,
    maxPendingAgeMs,
  );

  return result.action === "hold"
    ? { kind: "hold", pending: result.pending }
    : {
        kind: "dispatch",
        pending: null,
        text: result.text,
        stitched:
          freshPending && !isStandaloneActionableCommand(normalizeSpeech(incoming)),
      };
}

// ---------------------------------------------------------------------------
// CUMULATIVE PROVIDER FINALS (physical Android session 79317698, 2026-08-31).
//
// The provider ships partial fragments AND, later, a cumulative final that
// re-states everything it already sent plus the new words:
//
//   1. "Yeah, we need to work on the, um,"
//   2. "Okay, um,"
//   3. "Yeah, we need to work on the, um, Okay, um, Okay, great. Yeah, have
//       Scott reach out to me."
//
// Every one of those rows must stay in conversation_messages — that is the raw
// history and it is never edited here. But the CONSUMER (brain + contact state
// machine) must see ONE coherent semantic turn, or 6 answers the same hand
// raise five times, which is exactly what he did.
//
// The existing accepted-turn guard is exact equality inside 2.5 s, so it never
// catches a cumulative restatement. This adds containment handling, and only
// containment: a turn is dropped or trimmed strictly when the already-accepted
// words appear as a CONTIGUOUS run. Anything ambiguous is delivered whole,
// which is the pre-existing behaviour.
// ---------------------------------------------------------------------------

export const DEFAULT_ACCEPTED_TURN_MEMORY_MS = 60_000;

export type AcceptedTurn = {
  text: string;
  at: number;
};

export type SemanticTurnDecision =
  | {
      kind: "deliver";
      text: string;
      reason: "new" | "cumulative_remainder";
    }
  | {
      kind: "drop";
      text: null;
      reason: "repeat_of_accepted" | "fragment_of_accepted";
    };

type WordSpans = {
  /** Raw whitespace-separated tokens, punctuation intact. */
  tokens: string[];
  /** Comparison words, in order. */
  words: string[];
  /** words[i] came from tokens[wordToken[i]]. */
  wordToken: number[];
};

function tokenizeWithWordSpans(text: string): WordSpans {
  const tokens = normalizeSpeech(text).split(" ").filter(Boolean);
  const words: string[] = [];
  const wordToken: number[] = [];
  tokens.forEach((token, index) => {
    for (const word of wordsForComparison(token)) {
      words.push(word);
      wordToken.push(index);
    }
  });
  return { tokens, words, wordToken };
}

/** Index of the first contiguous occurrence of `needle` in `haystack`, or -1. */
function indexOfRun(haystack: readonly string[], needle: readonly string[]): number {
  if (needle.length === 0 || needle.length > haystack.length) return -1;
  outer: for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) continue outer;
    }
    return start;
  }
  return -1;
}

/**
 * Words the caller has already handled, oldest first, filtered to the memory
 * window. Exported so the caller can keep one plain ring buffer.
 */
export function freshAcceptedTurns(
  accepted: readonly AcceptedTurn[],
  now: number,
  memoryMs = DEFAULT_ACCEPTED_TURN_MEMORY_MS,
): AcceptedTurn[] {
  return accepted.filter(
    (entry) => now >= entry.at && now - entry.at <= memoryMs,
  );
}

// ---------------------------------------------------------------------------
// THE SAME SENTENCE, HEARD BY BOTH EARS (G's ride, 2026-09-04 17:05-17:12).
//
// Two ears listen: the authoritative one, and the second ear that is held
// SECOND_EAR_HOLD_MS and backfilled only if the winner never produced that
// utterance. The judge for "never produced" was resolveSemanticTurn, which
// matches a CONTIGUOUS RUN of identical words - and two speech-to-text engines
// hearing the same audio do not produce identical words:
//
//   ear A: "no I'm 6:30 are you there buddy"
//   ear B: "No, um, Six, are you there, buddy?"
//
// Neither contains the other, so both were delivered, and 6 answered BOTH.
// Across that ride: 30 backfills, 46 user turns, and four assistant lines
// inside two seconds at 17:11:07-17:11:09. It is the main reason he talks over
// himself, and it also manufactures the truncated ghost rows - each new reply
// cuts the previous one mid-word.
//
// So the second ear needs a fuzzy judge, not an exact one: same speech, heard
// twice, spelled differently. Word-set overlap against the shorter side catches
// that, and is deliberately NOT used anywhere else - ordinary turns keep the
// strict contiguous-run rule.
//
// TIME-BOUNDED ON PURPOSE. A second-ear twin lands within a second or two of
// its sibling. Genuine repetition minutes later ("give me ideas" again) must
// still get through, so only turns inside SECOND_EAR_ECHO_WINDOW_MS are
// considered.
// ---------------------------------------------------------------------------

/** How recently a turn must have been accepted to count as this one's twin. */
export const SECOND_EAR_ECHO_WINDOW_MS = 4_000;
/** Share of the SHORTER side's words that must match to call it the same. */
export const SECOND_EAR_ECHO_OVERLAP = 0.6;
/**
 * Below this many words a turn is too short to judge by overlap - "yes",
 * "okay", "give me ideas" repeat legitimately and share every word.
 */
export const SECOND_EAR_ECHO_MIN_WORDS = 4;

/**
 * True when `incoming` looks like the same spoken sentence as one already
 * accepted moments ago, allowing for two engines transcribing it differently.
 */
export function isSameUtteranceHeardTwice({
  incoming,
  accepted,
  now,
  windowMs = SECOND_EAR_ECHO_WINDOW_MS,
  minOverlap = SECOND_EAR_ECHO_OVERLAP,
  minWords = SECOND_EAR_ECHO_MIN_WORDS,
}: {
  incoming: string;
  accepted: readonly AcceptedTurn[];
  now: number;
  windowMs?: number;
  minOverlap?: number;
  minWords?: number;
}): boolean {
  const words = wordsForComparison(incoming);
  if (words.length < minWords) return false;
  const incomingSet = new Set(words);

  for (const entry of freshAcceptedTurns(accepted, now, windowMs)) {
    const priorWords = wordsForComparison(entry.text);
    if (priorWords.length < minWords) continue;
    const priorSet = new Set(priorWords);
    let shared = 0;
    for (const w of incomingSet) if (priorSet.has(w)) shared += 1;
    const smaller = Math.min(incomingSet.size, priorSet.size);
    if (smaller === 0) continue;
    if (shared / smaller >= minOverlap) return true;
  }
  return false;
}

/**
 * Decide what ONE accepted turn should hand to the brain / contact machine.
 *
 * - identical to something already handled -> drop
 * - a fragment of something already handled -> drop
 * - a cumulative restatement that ENDS with new words -> deliver only the new
 *   words, so the hand raise inside it is acted on exactly once
 * - anything else -> deliver unchanged
 *
 * Never mutates or consults persisted rows. `incoming` is still the thing the
 * caller writes to the transcript; only what is dispatched onward changes.
 */
const ANSWER_WORDS_RE =
  /^(?:yes|yeah|yep|yup|no|nope|nah|correct|right|wrong|okay|ok|sure|please|absolutely|exactly|perfect|definitely|stop|wait|send|it|that|go|ahead|do|i|you|my|me|is|do|not|thanks|thank|email|phone|again)$/i;

// A supporting word can ride along in a short answer ("yes you can", "send it
// now"), but it can never BE the answer. G's ride cf79a533 answered a bare
// "you" as if it were a turn, because the list below was checked with every()
// alone - a single pronoun passed. An answer has to carry an actual yes, no,
// or instruction in it.
const CORE_ANSWER_RE =
  /^(?:yes|yeah|yep|yup|no|nope|nah|correct|right|wrong|okay|ok|sure|please|absolutely|exactly|perfect|definitely|stop|wait|send|go|do|thanks|thank)$/i;

/**
 * A short, self-contained reply: at most four words, all of them answer words,
 * and at least one of them an actual answer rather than a supporting word.
 */
function isStandaloneAnswer(words: readonly string[]): boolean {
  if (words.length === 0 || words.length > 4) return false;
  if (!words.every((w) => ANSWER_WORDS_RE.test(w))) return false;
  return words.some((w) => CORE_ANSWER_RE.test(w));
}

export function resolveSemanticTurn({
  incoming,
  accepted,
  now,
  memoryMs = DEFAULT_ACCEPTED_TURN_MEMORY_MS,
}: {
  incoming: string;
  accepted: readonly AcceptedTurn[];
  now: number;
  memoryMs?: number;
}): SemanticTurnDecision {
  const spans = tokenizeWithWordSpans(incoming);
  if (spans.words.length === 0) {
    return { kind: "deliver", text: normalizeSpeech(incoming), reason: "new" };
  }

  let tokens = spans.tokens;
  let words = spans.words;
  let wordToken = spans.wordToken;
  let trimmed = false;

  // RIDE cb2dde76, 2026-09-03 22:21:27 ET: G answered the send question with a
  // bare "Yes." and it was dropped as `fragment_of_accepted`, because he had
  // said the word "yes" inside a longer sentence moments earlier. The lead
  // never sent. A standalone answer is the single most important turn in the
  // whole flow and is never a leftover piece of an earlier one - the trimming
  // below exists for STT re-sending chunks of a long utterance, not for this.
  if (isStandaloneAnswer(words)) {
    return { kind: "deliver", text: normalizeSpeech(incoming), reason: "new" };
  }

  for (const entry of freshAcceptedTurns(accepted, now, memoryMs)) {
    const priorWords = wordsForComparison(entry.text);
    // One-word turns ("yes", "okay") repeat legitimately and must never be
    // used to trim or drop a later turn.
    if (priorWords.length < 2) continue;
    if (words.length === 0) break;

    if (
      priorWords.length === words.length &&
      indexOfRun(words, priorWords) === 0
    ) {
      return { kind: "drop", text: null, reason: "repeat_of_accepted" };
    }

    if (indexOfRun(priorWords, words) >= 0) {
      // Everything in this turn was already handled inside a longer one.
      return { kind: "drop", text: null, reason: "fragment_of_accepted" };
    }

    const start = indexOfRun(words, priorWords);
    if (start < 0) continue;
    const end = start + priorWords.length;
    if (end >= words.length) continue; // nothing new after the restatement

    // Only trim on an exact token boundary. If the prior turn ended in the
    // MIDDLE of a raw token, slicing tokens would duplicate or lose text, so
    // deliver the whole turn instead — the conservative choice.
    const boundaryToken = wordToken[end];
    if (boundaryToken === wordToken[end - 1]) continue;

    tokens = tokens.slice(boundaryToken);
    const rest = tokenizeWithWordSpans(tokens.join(" "));
    tokens = rest.tokens;
    words = rest.words;
    wordToken = rest.wordToken;
    trimmed = true;
  }

  const text = tokens.join(" ").trim();
  if (!text) return { kind: "drop", text: null, reason: "repeat_of_accepted" };
  return {
    kind: "deliver",
    text,
    reason: trimmed ? "cumulative_remainder" : "new",
  };
}

export type SessionEventSource<Event = unknown> = {
  on(eventName: string, handler: (event: Event) => void): unknown;
  off?: (eventName: string, handler: (event: Event) => void) => unknown;
  removeListener?: (eventName: string, handler: (event: Event) => void) => unknown;
};

/**
 * Attach once and return cleanup bound to the exact source that was attached.
 * Never consult a mutable session ref during cleanup: by then it may point at a
 * replacement session, which would leak the listener on the retired session.
 */
export function bindSessionListener<Event>(
  source: SessionEventSource<Event>,
  eventName: string,
  handler: (event: Event) => void,
): () => void {
  source.on(eventName, handler);
  let detached = false;
  return () => {
    if (detached) return;
    detached = true;
    if (typeof source.off === "function") {
      source.off(eventName, handler);
    } else if (typeof source.removeListener === "function") {
      source.removeListener(eventName, handler);
    }
  };
}
