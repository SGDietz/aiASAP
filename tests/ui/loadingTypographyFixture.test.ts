import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("actual shared Loading render fixture", () => {
  it("renders the canonical live component instead of a lookalike", () => {
    const fixture = source("app/codex-responsive-loading/page.tsx");
    const live = source("src/components/SixLoadingIndicator.tsx");

    expect(fixture).toContain('import { SixLoadingIndicator }');
    expect(fixture).toContain("<SixLoadingIndicator />");
    expect(fixture).not.toContain("Loading...");
    expect(live).toContain("<LoadingText />");
    expect(live).toContain("const labelRef = useRef<HTMLSpanElement>(null)");
    expect(live).toContain("const targetWidth = label.getBoundingClientRect().width");
    expect(live).toContain("targetWidth / naturalWidth");
  });
});
