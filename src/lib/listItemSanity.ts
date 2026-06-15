// G 2026-06-14 (recurring rage: "why do non-walmart-list things keep coming up
// on the lists"): ONE tested sanity gate at the add chokepoint. A real list item
// is a short, noun-ish thing (milk, paper towels, everything bagels, 2% milk) —
// never a name, a pronoun, a meta/command word, an app term, a number+time
// fragment, or a sentence. Pure so the corpus in tests/lists/itemSanity proves
// it. This is the belt-and-suspenders final filter; the upstream intent gate
// still runs first.

// Standalone junk words (exact, whole-string match, lowercased): fillers,
// agent names, bare command verbs, app terms.
const EXACT_JUNK = new Set([
  // agent / people names that kept leaking
  "herm", "claude", "six", "6", "buddy", "buddies", "pal", "perm", "adam",
  // acknowledgments / fillers
  "wow", "great", "okay", "ok", "yeah", "yes", "no", "nope", "sure", "well",
  "hmm", "again", "more", "look", "same", "vision", "obsession", "caught",
  "going", "gave", "stuff", "thing", "things", "here",
  // bare command verbs
  "put", "add", "list", "get", "grab", "buy", "throw", "need", "want", "have",
  "had", "move", "change", "changes",
  // app / mechanic terms + stray fragments
  "zip", "results", "through", "then", "also", "problem", "problems", "silent",
  "two", "people", "second", "seconds", "minute", "minutes",
]);

// Sentence / meta markers — if an "item" contains these it's talk, not a thing
// you put on a list. (Whole-word matches so "herbal"/"cheese" stay safe.)
const META_CONTAINS_RE =
  /\b(?:i|i'?m|you|your|we|they|them|he|she|him|her|me|my|gonna|wanna|figure|investigate|that'?s|to be|when i|full ?page|search ?results?|zip ?code|second list|another list|new list|people get|up people|been silent|up and running|talking|reality|issue|changes here)\b/i;

// True when `item` reads like a real thing someone would put on a list.
export function isPlausibleListItem(item: string): boolean {
  const t = (item ?? "").trim();
  if (t.length < 2 || t.length > 40) return false;
  if (t.split(/\s+/).length > 4) return false; // real items are short
  if (EXACT_JUNK.has(t.toLowerCase())) return false;
  if (META_CONTAINS_RE.test(t)) return false;
  // leading connective / preposition (an interrupted scrap, not an item)
  if (
    /^(?:and|or|but|so|to|for|up|down|over|under|with|without|of|at|in|on|except|page|number|item)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  // bare number, or number + time unit ("2", "2 second", "3rd")
  if (/^\d+$/.test(t)) return false;
  if (/^\d+\s*(?:st|nd|rd|th|secs?|seconds?|mins?|minutes?|hours?)\b/i.test(t)) {
    return false;
  }
  // profanity / question words = chatter, never an item
  if (
    /\b(?:fuck|fucking|fucked|shit|goddamn|damn|hell|what|why|how|where|when|who|which)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  return true;
}
