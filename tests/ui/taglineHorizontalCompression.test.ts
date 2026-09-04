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
    expect(tagline).toContain("origin-center scale-x-[0.9]");
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
    expect(tagline).toContain('<span className="sr-only">Cheap. Fast. Gorgeous. Brilliant.</span>');
    expect(tagline.match(/<Initial>[GBFC]<\/Initial>/g)).toHaveLength(4);
    expect(tagline).not.toContain("<br");
  });
});
