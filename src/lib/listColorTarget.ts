// Which surface does a color command mean — the list TEXT or the BOX? (G
// 2026-06-14: "change the colors of the lists AND the text ... just by talking
// to 6.") Pure + tested. Default is "box" so every existing color command keeps
// its exact current behavior; only an explicit text/word reference flips it to
// "text". The actual color + brighter/darker shade math is reused from the
// existing detectListAccentUpdate engine — this only picks the target.

export type ColorTarget = "text" | "box";

const TEXT_TARGET_RE =
  /\b(?:text|words?|writing|written|letters?|lettering|font|wording|type|print|numbers?)\b/i;
const BOX_TARGET_RE =
  /\b(?:box(?:es)?|background|backdrop|fill|pill|pillbox(?:es)?|border|card|panel)\b/i;

export function detectColorTarget(text: string): ColorTarget {
  const t = text ?? "";
  if (TEXT_TARGET_RE.test(t) && !BOX_TARGET_RE.test(t)) return "text";
  return "box";
}
