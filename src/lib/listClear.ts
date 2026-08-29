// Clear-all detection for lists (G 2026-06-14: he said "remove everything" /
// "clear the list" ~26 times and NOTHING cleared, but 6 still said "done" — the
// word "everything" was on the item-junk filter, so the remove batch came back
// empty and the brain faked the confirmation). Pure + tested so the replay
// harness drives the exact code the component runs (same carve pattern as
// src/lib/listAddOffer.ts). Broadened 2026-06-14 (Herm TASK_012) to catch
// natural slang — nuke/scrap/start over/delete it all — with no false fires on
// real items (clear gel, reset spray, all-purpose flour, delete cookies...).

// "everything bagel(s)" is a real grocery item — never let it trip a clear.
const EVERYTHING_BAGEL_RE = /\beverything\s+bagels?\b/i;

// clear / empty / wipe / reset / erase / nuke / scrap the (whole) list — or all/everything.
const CLEAR_LIST_RE =
  /\b(?:clear|empty|wipe|reset|erase|nuke|scrap)\b(?:\s+\w+){0,4}?\s+(?:the\s+)?(?:(?:whole\s+)?list|whole\s+thing|everything|all\s+(?:items?|of\s+(?:it|them))|it\s+all|every\s+item)\b/i;

// remove / delete / get rid of / drop ... everything / all / the whole list.
const REMOVE_EVERYTHING_RE =
  /\b(?:remove|delete|get rid of|take|drop|clear|wipe|erase|nuke|scrap)\b(?:\s+\w+){0,4}?\s+(?:everything|all\s+(?:items?|of\s+(?:it|them))|it\s+all|every\s+item|whole\s+(?:list|thing))\b/i;

// "start the list over" / "start over with this list".
const START_OVER_RE =
  /\b(?:start|begin)\b(?:\s+\w+){0,4}?\s+(?:list\s+over|over\s+with\s+(?:this|the|my)?\s*list)\b/i;

// True when the user wants the WHOLE active list emptied in one go.
export function isClearAllCommand(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  if (EVERYTHING_BAGEL_RE.test(t)) return false;
  return (
    CLEAR_LIST_RE.test(t) ||
    REMOVE_EVERYTHING_RE.test(t) ||
    START_OVER_RE.test(t)
  );
}
