// Add-offer slot helpers for 6 (ITEM 4, 2026-06-14). Pure string logic so the
// replay harness (tests/) drives the exact code the component runs — same carve
// pattern as src/lib/signup/helpers.ts. When 6 OFFERS to add an item ("Want me
// to add milk?") the component arms a pending slot from his spoken line; the
// next bare "yes" resolves it into a real add BEFORE the brain sees the yes.

// 6's spoken line is an add-OFFER ("want me to add X", "shall I put X on").
export const ADD_OFFER_RE =
  /\b(?:want me to|do you want me to|shall i|should i|i can|i could|want (?:me )?to)\s+(?:add|put|throw|toss|drop|stick)\b/i;

// Whole-utterance affirmative ONLY (a long sentence that merely contains
// "yeah" must not fire — mirrors END_SESSION_AFFIRM_ONLY_RE in signup/helpers).
// A sequence of fillers + affirmative tokens, whole-utterance ("Yeah, do it.").
// Repeatable so a filler-then-affirmative ("Yeah, do it") still matches, while a
// sentence that veers off ("yeah but take milk off") cannot ("but" ends it).
export const ADD_OFFER_AFFIRM_RE =
  /^[\s,.!'-]*(?:(?:well|um|uh|so|okay then|alright|all right|yes|yeah|yea|yep|yup|sure|ok|okay|please|do it|go ahead|go for it|add (?:it|them|that)|put (?:it|them|that) on|sounds good|why not|let'?s do it|absolutely|definitely)[\s,.!'-]*)+$/i;

// G 2026-06-14 (Herm TASK_012; Supabase caught "so" -> Added there): a bare
// filler ("so", "um", "uh", "well") must NOT count as a yes. Require at least
// one REAL affirmative token alongside the whole-utterance shape above.
export const ADD_OFFER_REAL_AFFIRM_RE =
  /\b(?:yes|yeah|yea|yep|yup|sure|ok|okay|alright|all right|please|do it|go ahead|go for it|add (?:it|them|that)|put (?:it|them|that) on|sounds good|why not|let'?s do it|absolutely|definitely)\b/i;

// Any clear negative clears the slot.
export const ADD_OFFER_NEGATE_RE =
  /\b(?:no|nope|nah|not now|don'?t|do not|never mind|nevermind|cancel|wait|hold on|stop|leave it|skip it)\b/i;

export function isAddOfferAffirmative(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (ADD_OFFER_NEGATE_RE.test(t)) return false;
  return ADD_OFFER_AFFIRM_RE.test(t) && ADD_OFFER_REAL_AFFIRM_RE.test(t);
}

// G 2026-06-14 (Herm TASK_012): the brain sometimes OFFERS junk ("Want me to
// add Herm?"). Drop agent/app/chatter words while keeping clean nouns ("milk").
const OFFERED_ADD_JUNK_RE =
  /^(?:there|going|caught|we|herm|claude|six|6|buddy|buddies|fix this|look|again|more|vision|been silent|obsession|people get|up people|through|except(?: for)?|same|problems?|changes?(?: here)?|clear goals|set clear goals)$/i;

export function isSafeOfferedAddItem(item: string): boolean {
  const t = item.replace(/\s+/g, " ").trim();
  if (t.length < 2 || t.length > 40) return false;
  if (OFFERED_ADD_JUNK_RE.test(t)) return false;
  if (
    /\b(?:you|your|i|me|my|we|they|them|screen|avatar|claude|herm|problem|issue)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  return true;
}

// Pull the offered item(s) from 6's offer line. Cuts at the question mark / end
// and at trailing "to your list" / "to it" / "for you" / "as well" / "too",
// splits on commas + "and", strips spoken articles, caps at 5.
export function parseOfferedAddItems(spoken: string): string[] {
  const m = spoken.match(ADD_OFFER_RE);
  if (!m || m.index === undefined) return [];
  let tail = spoken.slice(m.index + m[0].length);
  tail = tail.split(/[?!.]/)[0] ?? tail;
  tail = tail.replace(
    /\s+(?:to|on)\s+(?:the|your|my|this|that)?\s*(?:grocery|shopping|walmart|to[-\s]?do)?\s*list\b.*$/i,
    "",
  );
  tail = tail.replace(/\s+(?:to it|for you|as well|too|then|now)\b.*$/i, "");
  return tail
    // Consume an Oxford "and" right after a comma so "bread, butter, and jam"
    // splits to [bread, butter, jam], never [..., "and jam"] (review 2026-06-14).
    .split(/\s*,\s*(?:and\s+)?|\s+and\s+/i)
    .map((s) =>
      s
        .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "")
        .replace(/^(?:and|or)\s+/i, "")
        .replace(/^(?:a|an|the|some|of)\s+/i, "")
        .trim(),
    )
    // Drop bare pronouns ("Want me to add it to the list?" has no real item).
    .filter((s) => !/^(?:it|them|that|those|these|this)$/i.test(s))
    .filter(isSafeOfferedAddItem)
    .filter((s) => s.length >= 2 && s.length <= 40)
    .slice(0, 5);
}
