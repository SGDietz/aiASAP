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

function normalizeSpeech(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function wordsForComparison(value: string): string[] {
  return normalizeSpeech(value)
    .toLowerCase()
    .replace(/[.,!?;:"()[\]{}…—-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
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

  const clause = normalized.replace(/[.?!…]+["')\]]*$/g, "");

  const wordCount = wordsForComparison(normalized).length;

  // Function words, auxiliaries, and unfinished command verbs need a following
  // object/clause. These include the observed "And added a" and "take the".
  if (
    /\b(?:and|but|so|because|if|when|while|although|though|that|which|who|whose|where|the|a|an|to|of|with|for|from|into|onto|about|as|is|are|was|were|be|been|being|am|do|does|did|have|has|had|can|could|will|would|shall|should|may|might|must|gonna|wanna|add|added|remove|removed|make|made|create|created|open|opened|close|closed|switch|switched|rename|renamed|move|moved|um|uh|er|don'?t|doesn'?t|didn'?t|can'?t|won'?t)\s*$/i.test(
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

function longestCommonSubsequenceLength(
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

  if (isLikelyIncompleteSpeechFragment(candidate)) {
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
