// Voice-list mode intents (2026-06-11, G's voice/avatar separation order):
// while the full-screen list is up the avatar is STOPPED (zero credits) and
// these patterns decide when to bring him back. G: "any and all ways that can
// be construed as close the list" — cast wide, log what we miss via tracer,
// tighten with every real session. Only ever tested INSIDE voice-list mode,
// so loose phrases like "I'm done" can't hijack normal conversation.

/** The user asks for 6 himself to come back.
 * r19 additions from G's FIRST live voice-mode session (2026-06-11 21:06):
 * "See 6 again" and "are you there, six?" both missed the old pattern.
 * r31 (G live 2026-06-12 09:02: "Okay, so six, bring yourself back" missed
 * this and became a GROCERY ITEM): "yourself" counts now. */
export const AVATAR_RETURN_RE =
  /\b(?:bring (?:him|6|six|you|yourself|the avatar|your face) back|come back|come on back|show (?:me )?(?:your face|yourself|6|six|the avatar)|i (?:want|wanna|need) to see you|where(?:'d| did) (?:he|you|6|six) go|where(?:'s| is) (?:6|six)\b|go back to (?:6|six|you|the avatar)|back to (?:the )?(?:avatar|video|face)|talk to (?:6|six) again|let me see you|see (?:you|6|six) again|miss your face)\b/i;

/** The user is finished with the list / the screen that's up.
 * r19: G's verbatim "Take the list off." closed the list through the OLD
 * close path and 6 never came back — every off/down/away form counts now. */
export const LIST_DONE_RE =
  /\b(?:close (?:the |this |my |that )?list|close (?:it|this|that)(?: out)?(?: down)?|(?:i'?m|i am|we'?re|we are) (?:done|finished|good|all set)\b|that'?s (?:it|all|everything|enough|good|perfect)\b|all done\b|done with (?:the |this |my |that )?list|done with (?:that|this|it)\b|finish(?:ed)? (?:the |this |my )?list|get rid of (?:the|this|that) list|hide (?:the|this|that) list|put (?:the|this|that) list away|save (?:the|this|my|that) list(?: and close)?|we'?re good\b|looks good\b|wrap (?:it|this) up|exit (?:the )?list|leave (?:the )?list|take (?:the |this |that |my )?list (?:off|down|away)|list off\b|remove (?:the|this|that) list|take (?:it|that) (?:off|down)(?: the screen)?|off the screen)\b/i;

/** Discussion / teaching / hypothetical markers. When the user is TALKING ABOUT
 * a close-or-return phrase (not commanding it) these fire and we do NOT leave list
 * mode. Born from the 2026-06-13 dogfood (session 535b9d29): G said "...you don't
 * have to say...to remove the list, just say, take it off..." and 6 wrongly walked
 * back in. NOTE: deliberately NO "i want my/the/a/to" clause here -- that would kill
 * the legit returns "I want to see you" and "I want to close the list". */
const RETURN_SUPPRESS_RE =
  /\b(?:i (?:didn'?t|did not|never) (?:ask|want|wanna|say|tell|mean)|don'?t (?:have to|need to) say|just say|you know what i mean|if you (?:say|said) (?:that|it)|instead of saying|rather than|next time(?: you)?|(?:was|were) supposed to|by the way)\b/i;

/** If the SAME utterance also asks to add/put an item, it's list work, not a close
 * ("looks good, let's add bananas" must NOT bring the avatar back). */
const ADD_ITEM_INLINE_RE = /\b(?:add|put|throw in|toss in|include)\b/i;

/** A bare close phrase is short; a long sentence that merely CONTAINS one is
 * almost always discussion. Cap protects the close path; explicit AVATAR_RETURN
 * phrases stay length-immune. */
const CLOSE_WORD_CAP = 12;

/** Anything that should END voice-list mode and bring the avatar back. */
export function wantsAvatarBack(text: string): boolean {
  // Talking ABOUT a command (teaching / negating / hypothetical) never triggers it.
  if (RETURN_SUPPRESS_RE.test(text)) return false;
  // Explicit "come back / show your face / see 6 again" -- always honored.
  if (AVATAR_RETURN_RE.test(text)) return true;
  // A close phrase counts only when it's short AND carries no add/put item.
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (LIST_DONE_RE.test(text) && !ADD_ITEM_INLINE_RE.test(text) && wordCount <= CLOSE_WORD_CAP) {
    return true;
  }
  return false;
}

/** A GARBLED list-OPEN fragment, not a real command. STT chops a turn and glues
 * a first-person FUTURE/INTENT clause onto the reflexive imperative "show me":
 * "I'll show me the list", "I'm gonna show me a list", "let me show me the list".
 * A person telling 6 to open a list says "show me the list", never "I'll show me
 * the list" -- that mashup is an ASR artifact of an incomplete utterance and must
 * NOT open a list. Real opens ("show me the to-do list", "open my grocery list",
 * "pull up my Walmart list") return false and pass through. (G 2026-06-14 item 3.) */
export function isGarbledListOpen(text: string): boolean {
  const t = String(text).trim();
  if (!t) return false;
  return /\b(?:i(?:'?ll| will)|i(?:'?m| am)\s+(?:gonna|going\s+to)|let\s+me)\s+show\s+me\b/i.test(
    t,
  );
}

/** Spoken lines for entering list mode — short, the list is the star. */
export function voiceListEnterLine(listTitle: string, isNew: boolean): string {
  return isNew
    ? `Here's your ${listTitle}. Just tell me what to add.`
    : `Here's your ${listTitle}.`;
}

/** Spoken comeback lines once the avatar's face is live again. */
export const AVATAR_BACK_LINES = [
  "Alright - I'm back! Where were we?",
  "Back! Good to see you again.",
  "There we go - I'm back. What's next?",
];
