import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

/**
 * G's ride, 2026-09-04 12:41-12:42.
 *
 *   6: "Good to meet you. I'm 6 - the number. 'Cuz I got your back."   (12:41:51)
 *   6: "Good to meet you, Scott. I'm 6 - the number."                  (12:42:02)
 *   G: "Yeah, you said you were 6, the number."
 *   G: "Twice now, and you shouldn't do that."
 *
 * and "what kind of things do you love building" five times in ninety seconds.
 *
 * Cause: rememberConversationLine dropped EVERY line, 6's own included, for the
 * whole of a contact capture. The brain history froze when the email ask began,
 * so each following call re-read the same stale window and 6 could not see what
 * he had just said. He was obeying his never-repeat rules against a history
 * that contained no repeats.
 *
 * The flood that guard was written for (2026-06-07) was the VISITOR spelling an
 * address out. That is user-side. 6's own lines must always land.
 */
describe("6 can see his own lines while a capture is running", () => {
  const file = source("src/components/LiveAvatarSession.tsx");

  it("skips only USER turns during account/contact capture", () => {
    const guard = file.slice(
      file.indexOf("const rememberConversationLine"),
      file.indexOf("recentConversationRef.current = ["),
    );
    expect(guard).toContain("accountSetupAwaitingEmailRef.current");
    // The role check is the whole fix: without it, assistant lines vanish too.
    expect(guard).toMatch(/role === "user"\s*&&/);
  });

  it("never reinstates a blanket drop that hides 6's own lines", () => {
    // The exact pre-fix shape: the capture refs gating a return with no role
    // test in front of them.
    expect(file).not.toMatch(
      /if \(\s*\n?\s*accountSetupAwaitingEmailRef\.current \|\|/,
    );
  });

  it("still records assistant lines through the shared recorder", () => {
    expect(file).toContain("rememberLine: rememberConversationLine");
    expect(file).toContain("assistantLogRef.current");
  });
});
