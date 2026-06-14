// Clear-all detection for lists (G 2026-06-14: he said "remove everything" /
// "clear the list" ~26 times and NOTHING cleared, but 6 still said "done" — the
// word "everything" was on the item-junk filter, so the remove batch came back
// empty and the brain faked the confirmation). Pure + tested so the replay
// harness drives the exact code the component runs (same carve pattern as
// src/lib/listAddOffer.ts).

// "everything bagel(s)" is a real grocery item — never let it trip a clear.
const EVERYTHING_BAGEL_RE = /everything\s+bagels?\b/i;

// clear / empty / wipe / reset / erase the (whole) list — or "...everything".
const CLEAR_LIST_RE =
  /\b(?:clear|empty|wipe|reset|erase)\b(?:\s+\w+){0,3}?\s+(?:list|everything|it all|all of (?:it|them))\b/i;

// remove / delete / get rid of ... everything (off / from the list).
const REMOVE_EVERYTHING_RE =
  /\b(?:remove|delete|get rid of|take|clear|wipe|erase)\b(?:\s+\w+){0,4}?\s+everything\b/i;

// True when the user wants the WHOLE active list emptied in one go.
export function isClearAllCommand(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  if (EVERYTHING_BAGEL_RE.test(t)) return false;
  return CLEAR_LIST_RE.test(t) || REMOVE_EVERYTHING_RE.test(t);
}
