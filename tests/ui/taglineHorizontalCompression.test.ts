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
    // OPTICAL, not geometric. 0.205em centres the arrow's painted ink exactly
    // on the capitals' centre (measured, offset 0.00px) and G said "lower the
    // > a little it is too high." A ">" wedge carries its mass low and wide,
    // so geometric centre reads high. 0.14em is his value; do not re-correct
    // it with a ruler.
    expect(tagline).toContain("-top-[0.14em]");
    expect(tagline).toContain("font-black");
    // G: "move the > a little away from cheap and toward autopilot." The
    // margins were symmetric at 0.11em; the left opened and the right closed,
    // and the pair still sums to about the old total so the line keeps its
    // width. ONLY the arrow moved - the words, sizes, copy and colour of this
    // line are untouched.
    expect(tagline).toContain("ml-[0.2em] mr-[0.04em]");
    expect(tagline).not.toContain("mx-[0.11em]");
    // The line's own paint stays exactly where it was, inline on the span.
    expect(tagline).toContain("bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text");
    expect(tagline).not.toContain("<br");
  });
});
