/**
 * WHEN 6 ASKS FOR THEIR NAME.
 *
 * G, 2026-09-04: "fix the call you name thing."
 *
 * The brain prompt has always owned this rule, and the rule has drifted twice
 * in opposite directions:
 *
 *   2026-08-23 - a forced ask by turn two cut off passion discovery before it
 *     started. Fix: stop asking on a turn count, wait for a real answer.
 *   2026-09-04 - the replacement wording was "at the next natural pause",
 *     which has no edge. On G's ride he said "I love building things" at
 *     17:07:12 and "I build stone walls with boulders" at 17:08:48, and the
 *     ask did not go out until 17:11:07 - roughly twenty turns later, in the
 *     middle of scoping his website, attached to the single word "so".
 *
 * Asked that late it reads as never having listened, which is the complaint
 * G has repeated most on this project. Prompt wording alone has now failed it
 * twice, so the decision lives here, in code, and the route pushes a one-line
 * whisper when it returns true.
 *
 * It is the missing other half of a rule the route already enforces: when a
 * name IS known it pushes "NEVER ask for their name".
 */

/** 6's own asks, in the shapes he actually writes them. */
export const NAME_ASK_RE =
  /what should i call you|what'?s your name|what do i call you/i;

/**
 * A real answer - not a hello, not a filler, not half a sentence.
 *
 * Five words is the floor the transcript supports: "I build stone walls with
 * boulders" is six, while the turn that wrongly triggered the ask last time
 * was the single word "so".
 */
export function isSubstantialTurn(text: string): boolean {
  return text.trim().split(/\s+/).filter(Boolean).length >= 5;
}

export const NAME_ASK_WHISPER =
  'ASK THEIR NAME IN THIS REPLY, as its own short beat. They have already told ' +
  'you something real about themselves and you still have no name for them. ' +
  'Answer what they just said in one line, then ask "And what should I call ' +
  'you?" Do NOT stack it onto a "So: ..." record line, an idea burst, or a ' +
  "numbered list.";

export function shouldAskForNameNow(args: {
  /** Running conversation for THIS session, oldest first. */
  history: ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
  /** The turn being answered right now. */
  message: string;
  /** A resolved name from auth, profile, or memory. */
  knownName: string | null | undefined;
  signedInEmail: string | null | undefined;
  /** Full-screen list mode: 6 is voice-only and must stay on the list. */
  listMode: boolean;
}): boolean {
  if (args.knownName || args.signedInEmail || args.listMode) return false;

  // Already asked once. Asking again is the nagging failure, not this one.
  if (
    args.history.some(
      (turn) => turn.role === "assistant" && NAME_ASK_RE.test(turn.content),
    )
  ) {
    return false;
  }

  // Never land it on "so" / "um" / a half sentence - that is exactly how it
  // went out last time. A fragment is not a pause; wait for a whole turn.
  if (!isSubstantialTurn(args.message)) return false;

  // Passion first: they must have actually told us something before we ask.
  const substantial =
    args.history.filter(
      (turn) => turn.role === "user" && isSubstantialTurn(turn.content),
    ).length + 1;
  return substantial >= 2;
}
