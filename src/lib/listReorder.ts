// Parse a "move / reorder list item" command (G 2026-06-14 copilot ride: he
// asked ~6 different ways to move items and 6 kept saying "I can't reorder yet").
// Pure + tested so the replay harness drives the exact code the component runs.
// Returns the FROM (a 1-based position, or an item NAME to resolve against the
// live list) and the TO (1-based position, or "top"/"bottom"). The component
// resolves names -> indices against the current items.

const ORD: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function toPos(token: string): number | "top" | "bottom" | null {
  const t = token.trim().toLowerCase();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  if (t in ORD) return ORD[t];
  if (/^(?:the\s+)?(?:top|first|beginning|front)$/.test(t)) return "top";
  if (/^(?:the\s+)?(?:bottom|last|end)$/.test(t)) return "bottom";
  return null;
}

export type ReorderCommand = {
  from: number | string; // 1-based position, or an item name to resolve
  to: number | "top" | "bottom";
};

export function parseReorderCommand(text: string): ReorderCommand | null {
  const t = (text ?? "").trim();
  if (!t) return null;

  // A) position -> position: "make number 2 number 1", "change number 3, comb,
  //    to be number 1", "put number 4 hair dryer as number 2", "move number 3
  //    to the top". The .*? lets an item name sit between the from-number and
  //    the connector.
  const a = t.match(
    /\b(?:make|change|move|put|reorder|switch|swap)\s+(?:number|item|position)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b.*?\b(?:to\s+be|to|as|be|into|number|position)\s+(?:number\s+|position\s+|the\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|top|bottom|first|last|beginning|end)\b/i,
  );
  if (a) {
    const from = toPos(a[1]);
    const to = toPos(a[2]);
    if (typeof from === "number" && to !== null && to !== from) {
      return { from, to };
    }
  }

  // B) name -> top/bottom/position: "put comb at the top", "move hair dryer to
  //    the bottom", "put milk as number 2". Connector is at/to/as/into so plain
  //    adds ("put milk and eggs on the list") never match.
  const b = t.match(
    /\b(?:put|move|bring|push|send)\s+(.+?)\s+(?:at|to|as|into)\s+(?:the\s+)?(?:number\s+|position\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten|top|bottom|first|last|beginning|end)\b/i,
  );
  if (b) {
    const to = toPos(b[2]);
    const name = b[1].trim().replace(/^(?:the|that|my)\s+/i, "");
    // A leading "number N" name is really position->position (handled by A).
    const isPositionName =
      /^(?:number|item|position)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)$/i.test(
        name,
      );
    if (name && !isPositionName && to !== null) {
      return { from: name, to };
    }
  }

  return null;
}
