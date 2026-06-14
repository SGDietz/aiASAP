// List-index ("list of lists") intents + pick resolver (ITEM 5, 2026-06-14).
// Pure + exported so the replay harness can test it without the component.
// G asked for this twice: a spoken menu of saved list NAMES on 6's chest,
// then a voice pick (ordinal / name / fuzzy) that OPENS the chosen list.

export type ListIndexEntry = { id: string; title: string };

/** User asks for the MENU/INDEX of their lists. Plural "lists" on purpose so it
 * never collides with the singular "show me the list" opener. */
export const LIST_INDEX_RE =
  /\b(?:list of lists|what(?:'?s| are| do you have| do i have)?\s+(?:my\s+)?lists|which lists(?: do i have)?|show me (?:my |all my |the )?lists|see (?:my |all my )?lists|(?:all )?my lists|how many lists|read me (?:my |the )?lists|name (?:my |the )?lists)\b/i;

export const LIST_PICK_ORDINAL: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
  "1st": 1, "2nd": 2, "3rd": 3, "4th": 4, "5th": 5,
  last: -1,
};

/** Oxford-comma spoken list of titles, capped (lines past the cap are summarized). */
function speakTitles(titles: string[], max = 8): string {
  const t = titles.filter(Boolean);
  if (t.length === 0) return "";
  if (t.length === 1) return t[0];
  if (t.length === 2) return `${t[0]} and ${t[1]}`;
  if (t.length <= max) {
    return `${t.slice(0, -1).join(", ")}, and ${t[t.length - 1]}`;
  }
  const shown = t.slice(0, max).join(", ");
  return `${shown}, and ${t.length - max} more`;
}

/** Spoken reply for the index. Empty-state coaches a concrete first step. */
export function buildListIndexReply(titles: string[]): string {
  const t = titles.filter(Boolean);
  if (t.length === 0) {
    return "You don't have any saved lists yet. Just say make a grocery list to start one.";
  }
  const noun = t.length === 1 ? "list" : "lists";
  return `You have ${t.length} ${noun}: ${speakTitles(t)}. Which one?`;
}

/** Significant words of a title for fuzzy matching (drop list/the/a/one/etc). */
function titleKeywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !/^(?:list|lists|the|one|todo|to|do)$/.test(w));
}

/** Resolve a spoken PICK against the index entries. ordinal -> name -> fuzzy.
 * Returns the chosen entry, or null when nothing clearly matches (so normal
 * conversation is never hijacked into opening a list). */
export function resolveListPick(
  text: string,
  entries: ListIndexEntry[],
): ListIndexEntry | null {
  if (entries.length === 0) return null;
  const lower = text.toLowerCase();

  // 1) Ordinal: "the first one", "second", "the last one".
  const ord = lower.match(
    /\b(?:the\s+)?(first|second|third|fourth|fifth|sixth|last|1st|2nd|3rd|4th|5th)\b(?:\s+(?:one|list|option))?/i,
  );
  if (ord) {
    const pos = LIST_PICK_ORDINAL[ord[1].toLowerCase()] ?? 0;
    if (pos === -1) return entries[entries.length - 1];
    if (pos >= 1 && pos <= entries.length) return entries[pos - 1];
  }

  // 2) Exact / substring title match ("open the grocery list", "Walmart").
  let best: { entry: ListIndexEntry; score: number } | null = null;
  for (const e of entries) {
    const titleLower = e.title.toLowerCase();
    if (lower.includes(titleLower)) {
      return e; // full title spoken — strongest signal
    }
    // 3) Fuzzy: any significant keyword of the title appears in the speech
    // ("the grocery one" -> Grocery List). Score = longest keyword matched.
    for (const kw of titleKeywords(e.title)) {
      if (new RegExp(`\\b${kw}\\b`, "i").test(lower)) {
        const score = kw.length;
        if (!best || score > best.score) best = { entry: e, score };
      }
    }
  }
  return best?.entry ?? null;
}
