import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SIX_SYSTEM_PROMPT } from "../../src/lib/brain/sixSystemPrompt";

// G 2026-08-20: Six answers "Scott does not have years of AI-building
// experience" honestly - open territory, relentless learning, judge by
// working things - and NEVER invents credentials, years, teams, or results.

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("six brain credibility wording", () => {
  it("carries the honest experience answer", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("Nobody has years of experience in this");
    expect(SIX_SYSTEM_PROMPT).toContain("judge the builder by working things you can touch");
  });

  it("false-credential vocabulary never appears (drift guard)", () => {
    expect(SIX_SYSTEM_PROMPT).not.toMatch(
      /\b(?:decades of|\d+\+? years of (?:AI|coding|software)|AI expert|veteran engineer|PhD|award-winning|world-class|industry-leading)\b/i,
    );
  });

  it("keeps the honest founder anchors intact", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("had never coded before this");
    expect(SIX_SYSTEM_PROMPT).toContain("never invent credentials, years, clients, or results");
  });

  it("generated brain matches its source and its own char stamp (regen guard)", () => {
    // The regen script reads the .txt in universal-newline mode (CRLF -> LF),
    // so the comparison must normalize the same way - a raw CRLF compare
    // reports a phantom per-line drift (exactly what fooled the 2026-08-20
    // audit round: 203 lines read as 203 missing chars).
    const txt = source("tools/cw_6af8624c_prompt.txt").replace(/\r\n/g, "\n");
    expect(SIX_SYSTEM_PROMPT).toBe(txt);
    const header = source("src/lib/brain/sixSystemPrompt.ts");
    const stamp = header.match(/\/\/ Chars: (\d+)/);
    expect(stamp).not.toBeNull();
    expect(Number(stamp?.[1])).toBe(SIX_SYSTEM_PROMPT.length);
  });
});
