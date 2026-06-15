// G 2026-06-14 ("when are the prompts going to be things people NEED on their
// lists?"): context-aware list pillboxes (Herm TASK_013). When a list is on
// screen, the 4 pills suggest things people actually need on THAT list — a
// Walmart/grocery list -> "Add Toothpaste / Milk / Eggs", "Find Deals" — NOT
// the generic life-goals. Pure + tested; the route calls this BEFORE any OpenAI
// call so list pills never depend on the LLM being up, and always returns >=4
// list-relevant labels so the route never pads with life-goals.

export type PromptBrainListContext = { title: string; items: string[] };

const MAX_PROMPT_BRAIN_LIST_ITEMS = 80;

const SHOPPING_LIST_RE =
  /\b(?:walmart|grocery|groceries|shopping|store|market|costco|target|aldi|trader joe|food|supplies)\b/i;
const TODO_LIST_RE = /\b(?:todo|to-do|task|tasks|errand|errands)\b/i;
const GIFT_LIST_RE = /\b(?:gift|birthday|christmas|holiday|present|presents)\b/i;
const TRAVEL_LIST_RE = /\b(?:travel|trip|vacation|pack|packing|beach|flight|hotel)\b/i;

function compact(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > maxChars ? cleaned.slice(0, maxChars).trim() : cleaned;
}

export function normalizeListContext(
  value: unknown,
): PromptBrainListContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as { title?: unknown; items?: unknown };
  const title = compact(raw.title, 80) || "List";
  const items = Array.isArray(raw.items)
    ? raw.items
        .map((item) => compact(item, 60))
        .filter((item): item is string => Boolean(item))
        .slice(0, MAX_PROMPT_BRAIN_LIST_ITEMS)
    : [];
  if (!title && items.length === 0) return null;
  return { title, items };
}

function listIncludes(items: string[], candidate: string): boolean {
  const wanted = candidate.toLowerCase();
  return items.some((item) => item.toLowerCase().includes(wanted));
}

// "Add X" for each suggested item NOT already on the list.
function addMissing(items: string[], candidates: string[]): string[] {
  return candidates
    .filter((c) => !listIncludes(items, c))
    .map((c) => `Add ${c}`);
}

function dedupe(prompts: string[]): string[] {
  const seen = new Set<string>();
  return prompts.filter((p) => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function getListContextPrompts(
  context: PromptBrainListContext,
): string[] {
  const haystack = `${context.title} ${context.items.join(" ")}`;
  let prompts: string[];
  if (SHOPPING_LIST_RE.test(haystack)) {
    prompts = [
      // up to 3 item suggestions (what G wants on the list) + a shopping action,
      // so "Find Deals" always survives the route's 4-pill cap.
      ...addMissing(context.items, [
        "Toothpaste",
        "Milk",
        "Eggs",
        "Bread",
        "Coffee",
        "Bananas",
        "Paper Towels",
      ]).slice(0, 3),
      "Find Deals",
    ];
  } else if (TODO_LIST_RE.test(haystack)) {
    prompts = ["Next Task", "Set Priority", "Add Deadline"];
  } else if (GIFT_LIST_RE.test(haystack)) {
    prompts = ["Gift Ideas", "Set Budget", "Add a Card"];
  } else if (TRAVEL_LIST_RE.test(haystack)) {
    prompts = ["Pack Shoes", "Add Sunscreen", "Check Tickets"];
  } else {
    prompts = ["Add Item", "Name List"];
  }
  // Always guarantee >=4 LIST-relevant labels so the route never pads with the
  // life-goal fallback (even when the list is already full of suggestions).
  return dedupe([
    ...prompts,
    "Check List",
    "Add Item",
    "Name List",
    "Read It Back",
  ]).slice(0, 6);
}
