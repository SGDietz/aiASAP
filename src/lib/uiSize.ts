// Voice sizing patterns + scale (2026-06-10) — carved out of the component so
// the harness can pin them. G's 23:15 session: 6 coached "just say: make it
// bigger" and the old in-component regex rejected those exact words. THE
// COACHED SENTENCE MUST ALWAYS BE THE EASIEST SENTENCE TO MATCH — that's now
// a tested invariant, not a hope.
export const UI_SIZE_BIGGER_RE =
  /\b(?:make|turn|blow)\b[^.?!]{0,30}\b(?:boxes?|prompts?|text|writing|words?|cards?|letters?|font|everything|it|them|this|that)\b[^.?!]{0,24}\b(?:bigger|larger|huge)\b|\b(?:bigger|larger)\s+(?:boxes?|prompts?|text|cards?|font|letters?|words?)\b|\bcan'?t (?:read|see)\b[^.?!]{0,24}\b(?:it|that|them|the|this|what)\b|\breading glasses\b|\btoo small to read\b|\b(?:text|boxes?|words?|letters?|writing) (?:is|are) too small\b|\beasier to read\b|^\W*(?:even\s+|much\s+|way\s+|a\s+lot\s+|still\s+)?(?:bigger|larger)[.!\s]*$|^\W*go\s+bigger[.!\s]*$/i;

export const UI_SIZE_SMALLER_RE =
  /\b(?:make|turn)\b[^.?!]{0,30}\b(?:boxes?|prompts?|text|writing|words?|cards?|letters?|font|everything|it|them|this|that)\b[^.?!]{0,24}\b(?:smaller|tinier)\b|\b(?:smaller|tinier)\s+(?:boxes?|prompts?|text|cards?|font|letters?|words?)\b|\b(?:text|boxes?|words?|letters?|writing) (?:is|are) too big\b|^\W*(?:even\s+|much\s+|way\s+|a\s+lot\s+|still\s+)?(?:smaller|tinier)[.!\s]*$|^\W*go\s+smaller[.!\s]*$/i;

export const UI_SIZE_STORAGE_KEY = "aiasap.uiSizeLevel.v1";

/**
 * Size multiplier per level — index 2 is exactly 1 (today's default look).
 * G 23:36 ("total fail"): the old steps were ~6% — invisible — and there was
 * only ONE level above default. Now: two real steps up (+25%, +55%) and two
 * down. Applies to pillboxes (box AND text), cards, and chest writing.
 */
export const UI_CARD_SCALE = [0.8, 0.9, 1, 1.25, 1.55] as const;
export const UI_SIZE_MAX_LEVEL = 4;

export function loadUiSizeLevel(): number {
  if (typeof window === "undefined") return 2;
  try {
    const raw = window.localStorage.getItem(UI_SIZE_STORAGE_KEY);
    const n = raw === null ? 2 : parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 && n <= UI_SIZE_MAX_LEVEL ? n : 2;
  } catch {
    return 2;
  }
}
