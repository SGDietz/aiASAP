import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// G, 2026-09-05, phone screenshot of a "Trying To Do List" card over 6's chest
// during a smoke test: "this pop up does not belong ... that's code that needs
// to be made dormant that may come back in the future."
describe("chest lists are dormant", () => {
  const session = readFileSync(
    resolve(process.cwd(), "src/components/LiveAvatarSession.tsx"),
    "utf8",
  );

  it("the flag is on", () => {
    expect(session).toContain("const LISTS_DORMANT = true;");
  });

  it("every way a list could open, be created, or be mutated is behind the flag", () => {
    // spoken intent (avatar turn) and the thought-prompt path
    expect(session.match(/!LISTS_DORMANT && shouldAllowDetectedListIntent\(/g)?.length).toBe(2);
    // the list index card
    expect(session).toContain("if (!LISTS_DORMANT && LIST_INDEX_RE.test(userText)");
    // entering / creating a list from a turn
    expect(session).toContain("const inferredListIntentRaw = LISTS_DORMANT\n        ? null");
    expect(session).toContain("if (!LISTS_DORMANT && targetListId && (LIST_TRIGGER_RE.test(userText) || activeListId))");
    // item mutations
    expect(session).toContain("const _mutationAllowed =\n          !LISTS_DORMANT &&");
    // the reminders card is a chest list too
    expect(session).toContain("if (LISTS_DORMANT) return false; // the reminders card is a chest list too");
  });

  it("the list code itself is still in the repo, dormant, not deleted", () => {
    expect(session).toContain("detectListIntent(userText)");
    expect(session).toContain("ensureAssistantList(");
    expect(session).toContain("shouldTreatAsListMutation(userText, {");
  });
});
