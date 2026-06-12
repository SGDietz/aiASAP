// Voice-list mode intents (2026-06-11, G's voice/avatar separation order):
// while the full-screen list is up the avatar is STOPPED (zero credits) and
// these patterns decide when to bring him back. G: "any and all ways that can
// be construed as close the list" — cast wide, log what we miss via tracer,
// tighten with every real session. Only ever tested INSIDE voice-list mode,
// so loose phrases like "I'm done" can't hijack normal conversation.

/** The user asks for 6 himself to come back.
 * r19 additions from G's FIRST live voice-mode session (2026-06-11 21:06):
 * "See 6 again" and "are you there, six?" both missed the old pattern. */
export const AVATAR_RETURN_RE =
  /\b(?:bring (?:him|6|six|you|the avatar|your face) back|come back|come on back|show (?:me )?(?:your face|yourself|6|six|the avatar)|i (?:want|wanna|need) to see you|where(?:'d| did) (?:he|you|6|six) go|where(?:'s| is) (?:6|six)\b|go back to (?:6|six|you|the avatar)|back to (?:the )?(?:avatar|video|face)|talk to (?:6|six) again|let me see you|see (?:you|6|six) again|miss your face)\b/i;

/** The user is finished with the list / the screen that's up.
 * r19: G's verbatim "Take the list off." closed the list through the OLD
 * close path and 6 never came back — every off/down/away form counts now. */
export const LIST_DONE_RE =
  /\b(?:close (?:the |this |my |that )?list|close (?:it|this|that)(?: out)?(?: down)?|(?:i'?m|i am|we'?re|we are) (?:done|finished|good|all set)\b|that'?s (?:it|all|everything|enough|good|perfect)\b|all done\b|done with (?:the |this |my |that )?list|done with (?:that|this|it)\b|finish(?:ed)? (?:the |this |my )?list|get rid of (?:the|this|that) list|hide (?:the|this|that) list|put (?:the|this|that) list away|save (?:the|this|my|that) list(?: and close)?|we'?re good\b|looks good\b|wrap (?:it|this) up|exit (?:the )?list|leave (?:the )?list|take (?:the |this |that |my )?list (?:off|down|away)|list off\b|remove (?:the|this|that) list|take (?:it|that) (?:off|down)(?: the screen)?|off the screen)\b/i;

/** Anything that should END voice-list mode and bring the avatar back. */
export function wantsAvatarBack(text: string): boolean {
  return AVATAR_RETURN_RE.test(text) || LIST_DONE_RE.test(text);
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
