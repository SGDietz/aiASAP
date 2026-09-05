import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("tagline horizontal-only compression", () => {
  it("compresses the shared ink to 90% without changing its height authority", () => {
    const tagline = source("src/components/TaglineText.tsx");
    const lockup = source("src/components/StageBrandLockup.tsx");
    expect(tagline).toContain('data-stage-tagline-ink="1"');
    // G, 2026-09-04: "squeeze that line in ten percent from left to right ...
    // don't make the text smaller." A second 10% on top of the original
    // 0.9, so 0.81 - horizontal only, the type size is untouched.
        // G, 2026-09-04: he asked for the letters CLOSER, and scale-x made them
    // THINNER instead - "harder to read, harder to see". The approved 0.9
    // scale stays; the squeeze is letter-spacing plus operator margins,
    // which close gaps without touching stroke weight. Measured: natural
    // 315px natural. A flat 10% read as too condensed, so the letters sit
    // almost natural and the squeeze lives in the operator gaps: 299px.
    expect(tagline).toContain("origin-center scale-x-[0.9]");
    expect(tagline).toContain("tracking-[-0.005em]");
    expect(tagline).toContain("bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text");
    expect(tagline).toContain("text-transparent");
    expect(tagline).toContain("text-[1.6632em]");
    expect(tagline).toContain("md:text-[1.32em]");
    expect(tagline).not.toMatch(/scale-y|text-\[1\.49688em\]|leading-/);
    expect(lockup).toContain("aiasap-tablet-idle-tagline -mt-1");
    expect(lockup).toContain("text-[calc(var(--stage-width)*0.025)]");
  });

  it("keeps exact visual and accessibility copy on one line", () => {
    const tagline = source("src/components/TaglineText.tsx");
    // G, 2026-09-04, SEVENTH revision and the current one, typed word for
    // word: "Beautiful Brilliant Cheap > Autopilot". The arrow is back in the
    // connector's slot. (TaglineText.tsx carries the history of the six
    // before it.)
    expect(tagline).toContain('<span className="sr-only">Beautiful Brilliant Cheap &gt; Autopilot</span>');
    // Four initials render at the shared Initial size: B, B, C, A — one for
    // every capital in the exact tagline spelling. It was five while the line
    // read "... Cheap. On Autopilot."; G's equation drops the "On".
    expect(tagline.match(/<Initial>[BCA]<\/Initial>/g)).toHaveLength(4);
    // One operator: the arrow, in its own span. No plus, no ampersand.
    expect(tagline.match(/<Op>&gt;<\/Op>/g)).toHaveLength(1);
    expect(tagline).not.toContain("<Op>+</Op>");
    expect(tagline).not.toContain("&amp;");
    // LOCKED, and rolled back to exactly this on 2026-09-04 after two changes
    // in one evening both made it worse: raising it (measurement said it sat a
    // pixel below the capitals' centre) read too high, and shifting it toward
    // Autopilot crowded that word. G's verdict was to put it back. The
    // measurement was right and the result was still wrong - this glyph is
    // judged by eye. Do not "improve" these four values.
    expect(tagline).toContain("-top-[0.14em]");
    expect(tagline).toContain("font-black");
    expect(tagline).toContain("mx-[0.11em]");
    expect(tagline).toContain("text-[0.95em]");
    expect(tagline).not.toContain("ml-[0.2em]");
    expect(tagline).not.toContain("-top-[0.205em]");
    // The line's own paint is untouched too - it stays inline on the span.
    expect(tagline).toContain("bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text");
    expect(tagline).not.toContain("<br");
  });
});
