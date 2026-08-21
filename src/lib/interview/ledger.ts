/**
 * THE INTERVIEW LEDGER.
 *
 * An audit found the largest hole in the product: there was no interview
 * program at all. The nine parts of the $5,000 conversation existed only as
 * instructions in 6's prompt. Nothing tracked which part somebody was on,
 * nothing stored an answer AS an answer, and nothing knew when an interview was
 * finished. Email capture has a 27,000-byte state machine with tests; the
 * interview that sells the work had prose.
 *
 * Spec is Ara's (Job 17). Her framing decided the shape of this file:
 *
 *   "A checklist JSON that 6 fills by magic is the wrong answer - nothing gets
 *    stored. A conductor-bot is also wrong. A LEDGER PLUS A WHISPER is the
 *    smallest thing that makes the $5,000 talk as real as email capture."
 *
 * So this is a ledger, not a conductor. It records what is known, works out
 * what is still missing, and hands 6 a SILENT hint. It never speaks, never
 * interrupts, and never overrules him.
 *
 * WHAT THE MACHINE CONTROLS: storage, which slots are full, skip-vs-full-ask,
 * the never-twice rule, the notice gate, complete/abandoned flags, and the
 * silent next-hole hint.
 *
 * WHAT IT MUST NEVER CONTROL: the words 6 says, whether he jokes, whether he
 * follows a tear, whether he sells, whether he stays on a good story, or
 * whether he skips a part because the human is plainly finished.
 *
 * THE MISTAKE ARA WARNED ABOUT:
 *   "Silence of 8 seconds is thought, not 'I dunno'. ONLY AN UTTERANCE CAN BE
 *    THIN. If you encode silence as thin, you will wreck the interview."
 * Nothing here may change state from the passage of time. isAbandoned READS a
 * clock and never writes.
 */

export type PartId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const PART_NAMES: Record<PartId, string> = {
  1: "who you are",
  2: "yesterday",
  3: "your week",
  4: "what you must get done",
  5: "where the money comes in",
  6: "the way in",
  7: "proof",
  8: "more money, more efficiently",
  9: "say it back",
};

export type PartState =
  | "unreached"
  | "asking"
  | "waiting"
  | "reprompt"
  | "satisfied"
  /** 6 chose to move on while it was still thin. Sticky - never re-asked. */
  | "moved_on_thin";

export type InterviewStatus =
  | "idle"
  | "notice_pending"
  | "running"
  | "complete"
  | "abandoned";

export type Slot = { value: string; confidence: "SAID" | "GUESSED"; at: number };

export type PartRecord = {
  state: PartState;
  slots: Record<string, Slot>;
  /** One reprompt per PART, not per interview. */
  repromptUsed: boolean;
  compressedFromPart2?: boolean;
};

export type Ledger = {
  status: InterviewStatus;
  noticeAccepted: boolean;
  publishOk: boolean;
  parts: Record<PartId, PartRecord>;
  quotes: Array<{ text: string; part: PartId; at: number }>;
  lastActivityAt: number;
  startedAt: number;
};

export const ALL_PARTS: PartId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * How a multi-item answer is encoded inside one slot value.
 *
 * Exported deliberately. Review found this pipe living only inside countList
 * and the test fixtures: any writer using a different encoding would silently
 * count 1, part 2 would never complete, and because the whisper points at the
 * first unfinished part it would pin on part 2 forever and never surface parts
 * 3-9. Use putBeats rather than formatting this by hand.
 */
export const BEAT_SEPARATOR = "|";

export function newLedger(now: number): Ledger {
  const parts = {} as Record<PartId, PartRecord>;
  for (const p of ALL_PARTS) {
    parts[p] = { state: "unreached", slots: {}, repromptUsed: false };
  }
  return {
    status: "idle",
    noticeAccepted: false,
    publishOk: true,
    parts,
    quotes: [],
    lastActivityAt: now,
    startedAt: now,
  };
}

/** Record a list answer without any caller needing to know the encoding. */
export function putBeats(
  ledger: Ledger,
  part: PartId,
  key: string,
  beats: string[],
  now: number,
  confidence: "SAID" | "GUESSED" = "SAID",
): void {
  const clean = beats.map((b) => b.replace(/\|/g, "/").trim()).filter(Boolean);
  ledger.parts[part].slots[key] = {
    value: clean.join(BEAT_SEPARATOR),
    confidence,
    at: now,
  };
}

function said(rec: PartRecord, key: string): string | null {
  const s = rec.slots[key];
  // GUESSED never fills a done test. A guess that satisfies a part is how an
  // interview gets marked finished on something nobody actually said.
  if (!s || s.confidence !== "SAID") return null;
  const v = s.value.trim();
  return v ? v : null;
}

/**
 * Strict boolean read.
 *
 * Review found a genuine hole: `said()` returns any non-empty string, so a slot
 * written as the STRING "false" - exactly what String(false) produces from an
 * extractor - read as YES. `empty_ok: "false"` marked proof done with no payer,
 * and `money_refused: "false"` flipped a whole interview to buildable with no
 * income data at all.
 */
const AFFIRMATIVE = new Set(["true", "yes", "y", "1", "confirmed", "ok"]);
function flag(rec: PartRecord, key: string): boolean {
  const v = said(rec, key);
  return v ? AFFIRMATIVE.has(v.toLowerCase()) : false;
}

/** True when this part holds anything the person actually said. */
function hasAnySaid(rec: PartRecord): boolean {
  return Object.keys(rec.slots).some((k) => said(rec, k) !== null);
}

function countList(rec: PartRecord, key: string): number {
  const v = said(rec, key);
  if (!v) return 0;
  return v.split(BEAT_SEPARATOR).map((x) => x.trim()).filter(Boolean).length;
}

/** Does this contact route put something publishable on a page? */
function reachNeedsConsent(rec: PartRecord): boolean {
  const path = (said(rec, "reach_path") ?? "").toLowerCase();
  return path.includes("phone") || path.includes("email") || path.includes("dm");
}

/** Ara's done tests, formalised. SAID material only. */
export function isPartDone(ledger: Ledger, part: PartId): boolean {
  const rec = ledger.parts[part];
  switch (part) {
    case 1:
      return Boolean(said(rec, "name") && said(rec, "barbecue_do"));
    case 2:
      return countList(rec, "yesterday_beats") >= 3;
    case 3:
      // The compressed pass must be EARNED. Review found it was a bare boolean
      // that satisfied part 3 on a completely empty part 2 - the only free pass
      // in the file, and the comment claimed the opposite.
      if (rec.compressedFromPart2) {
        return countList(ledger.parts[2], "yesterday_beats") >= 1;
      }
      return (
        countList(rec, "typical_blocks") >= 2 &&
        Boolean(said(rec, "last_week_event")) &&
        Boolean(said(rec, "next_week"))
      );
    case 4:
      return Boolean(said(rec, "must_do"));
    case 5:
      // "I have never been paid for this yet" is an HONEST answer and must not
      // require being filed as refusing to discuss money. Review: the only
      // escape used to be money_refused, which mislabels somebody starting out.
      if (flag(rec, "no_money_yet")) return true;
      return Boolean(
        said(rec, "offer") && (said(rec, "last_pay") || said(rec, "pay_band")),
      );
    case 6: {
      if (!said(rec, "reach_path") || !said(rec, "yes_looks_like")) return false;
      // A personal mobile must never reach a public page on the strength of the
      // recording notice. An explicit "keep it private" satisfies this too -
      // otherwise anybody who declines could never finish the interview.
      if (reachNeedsConsent(rec)) return Boolean(said(rec, "reach_publish"));
      return true;
    }
    case 7:
      // Empty proof is valid, but only WITH the free/future name that makes it
      // buildable. Without it the card ships a completed-but-empty section.
      if (flag(rec, "empty_ok")) return Boolean(said(rec, "free_or_future_name"));
      return Boolean(said(rec, "payer") && said(rec, "what_they_said"));
    case 8:
      return Boolean(said(rec, "feel_good_number") || said(rec, "should_run_itself"));
    case 9:
      return Boolean(said(rec, "recap_confirmed"));
    default:
      return false;
  }
}

/**
 * Recompute every part's flag from the material.
 *
 * It DOWNGRADES as well as upgrades. Review found the original only ever set
 * "satisfied": when somebody took an answer back, the part stayed done to the
 * whisper while isComplete correctly read false - so 6 was steered away from
 * the very hole that was blocking completion.
 *
 * moved_on_thin stays sticky. That one is 6's decision, not the machine's.
 */
export function reconcile(ledger: Ledger): Ledger {
  for (const p of ALL_PARTS) {
    const rec = ledger.parts[p];
    if (rec.state === "moved_on_thin") continue;
    if (isPartDone(ledger, p)) {
      rec.state = "satisfied";
    } else if (rec.state === "satisfied") {
      rec.state = hasAnySaid(rec) ? "waiting" : "unreached";
    }
  }
  return ledger;
}

/** COMPLETE means "enough to build from", not "all nine perfect". */
export function isComplete(ledger: Ledger): boolean {
  // Evaluate the MATERIAL, never a cached flag: completeness must not stay true
  // because a flag was set once and the answer behind it later changed.
  const done = (p: PartId) => isPartDone(ledger, p);
  const p2ok =
    done(2) ||
    (ledger.parts[2].state === "moved_on_thin" &&
      countList(ledger.parts[2], "yesterday_beats") >= 1);
  // Money may be absent only when they said so - either they refused, or they
  // have not earned any yet. Silence is neither.
  const p5ok =
    done(5) ||
    flag(ledger.parts[5], "money_refused") ||
    flag(ledger.parts[5], "no_money_yet");
  const anyDepth =
    flag(ledger.parts[1], "love_flag") ||
    Boolean(said(ledger.parts[4], "must_do")) ||
    Boolean(said(ledger.parts[8], "feel_good_number"));

  return ledger.noticeAccepted && done(1) && p2ok && p5ok && done(6) && anyDepth;
}

/**
 * Worth telling G about even though it never finished.
 * Ara: "Do not ping G at 3 parts and 20 minutes. That is a coffee break."
 */
export const ABANDONED_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function isAbandoned(ledger: Ledger, now: number): boolean {
  if (isComplete(ledger)) return false;
  if (!said(ledger.parts[1], "name")) return false;
  // hasAnySaid, not a loose key check: a trailed-off "   " recorded as SAID
  // must not count as material and ping G with an empty lead.
  const touched = ALL_PARTS.filter((p) => hasAnySaid(ledger.parts[p])).length;
  if (touched < 3) return false;
  return now - ledger.lastActivityAt > ABANDONED_AFTER_MS;
}

export type Hint =
  | { kind: "notice_first" }
  | { kind: "next_hole"; part: PartId; partName: string; askShort: boolean }
  | { kind: "still_open"; part: PartId; partName: string; repromptLeft: boolean }
  | { kind: "complete" }
  | { kind: "nothing" };

/**
 * THE WHISPER. Never shown to a user, never spoken, never a question.
 * 6 is free to ignore it entirely. The machine marks; 6 decides.
 */
export function nextHint(ledger: Ledger): Hint {
  if (!ledger.noticeAccepted) return { kind: "notice_first" };
  if (isComplete(ledger)) return { kind: "complete" };

  for (const p of ALL_PARTS) {
    const rec = ledger.parts[p];
    // Skip on SUBSTANCE, not on the cached flag - a stale "satisfied" used to
    // make the whisper walk straight past an unfinished part.
    if (isPartDone(ledger, p) || rec.state === "moved_on_thin") continue;

    // A part already reprompted is NOT re-opened. This is the never-twice rule,
    // and it is the only memory 6 has of it across a resumed session.
    if (rec.repromptUsed) {
      return {
        kind: "still_open",
        part: p,
        partName: PART_NAMES[p],
        repromptLeft: false,
      };
    }
    return {
      kind: "next_hole",
      part: p,
      partName: PART_NAMES[p],
      // Already partly answered out of order: 6 must NOT run the opener at them.
      askShort: hasAnySaid(rec),
    };
  }
  // Unreachable while isComplete is false: the loop above returns for any part
  // that is not done. Kept so the type stays total.
  return { kind: "nothing" };
}

/** Render the whisper as the one line 6's context receives. Never user-facing. */
export function hintLine(hint: Hint): string {
  switch (hint.kind) {
    case "notice_first":
      return "INTERVIEW: record notice not accepted yet. Do not start a work question.";
    case "next_hole":
      return hint.askShort
        ? `INTERVIEW: next hole is part ${hint.part} (${hint.partName}) and they have already said some of it. Do NOT run the opener - ask once if there is anything to add, then move on.`
        : `INTERVIEW: next hole is part ${hint.part} (${hint.partName}).`;
    case "still_open":
      return hint.repromptLeft
        ? `INTERVIEW: part ${hint.part} (${hint.partName}) still open, one reprompt left.`
        : `INTERVIEW: part ${hint.part} (${hint.partName}) came out thin and has already been asked twice. Do NOT ask it again - work it in only if they raise it.`;
    case "complete":
      return "INTERVIEW: enough to build from. Keep talking if they want - do not reopen unless they ask to change something.";
    case "nothing":
      return "";
  }
}
