import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// G's own front door, 2026-09-03, screenshotted:
//
//   Unexpected token '<', "<!DOCTYPE "... is not valid JSON      [ Retry ]
//
// That is `res.json()` meeting an HTML page. The start call had two unguarded
// `await res.json()` calls, so ANY html response - a Next error page, a proxy
// or tunnel interstitial, a gateway timeout - threw a raw parser message onto
// the stage, and the real status and body were never recorded anywhere.
// He rides through a Tailscale tunnel, exactly the sort of hop that answers
// with HTML instead of JSON.
// ---------------------------------------------------------------------------

const demo = readFileSync(
  resolve(process.cwd(), "src/components/LiveAvatarDemo.tsx"),
  "utf8",
);

/** The file WITHOUT line comments - the note above mentions the old call by
 *  name, and a naive substring search reads its own explanation as the bug. */
const demoCode = demo
  .split(/\r?\n/)
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

describe("the start call never shows a parser error", () => {
  it("has no unguarded res.json() left in the start path", () => {
    expect(demoCode).not.toContain("await res.json()");
  });

  it("reads the body as text and only parses what looks like JSON", () => {
    expect(demo).toContain("async function readStartResponse");
    expect(demo).toContain("await res.text()");
    expect(demo).toMatch(/looksJson[\s\S]{0,120}startsWith\("\{"\)/);
    // a non-JSON body returns null rather than throwing
    expect(demo).toMatch(/if \(!looksJson\) return \{ json: null, snippet \}/);
  });

  it("shows plain English and says nothing was charged", () => {
    expect(demo).toContain("6 couldn't be reached just now. Tap Retry");
    expect(demo).toContain("nothing was charged");
  });

  it("records the real status and the first bytes so the next one is diagnosable", () => {
    expect(demo).toContain("function reportStartFailure");
    expect(demo).toContain("[start-session] non-JSON response status=");
    expect(demo).toContain("/api/observability/log");
    // both the failure branch and a 200-that-is-not-JSON must report
    expect((demo.match(/reportStartFailure\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("still surfaces a real server error message when the server sends one", () => {
    // A proper JSON { error } from our own route is preferred over the
    // generic line - that is how a real cause still reaches the screen.
    expect(demo).toMatch(/json\?\.error \?\?/);
  });
});
