import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const controls = fs.readFileSync(
  path.join(process.cwd(), "src/components/StageControls.tsx"),
  "utf8",
);

describe("additional all-device control delta", () => {
  it("moves interactive and dormant rendered rects exactly 4px lower once", () => {
    expect(controls.match(/stage-controls-cluster[^"`]*translate-y-\[4px\]/g)).toHaveLength(2);
    expect(controls.match(/translate-y-\[4px\]/g)).toHaveLength(2);
    expect(controls).not.toContain("md:translate-y-");
    expect(controls).not.toContain("sm:translate-y-");
  });

  it("preserves the accepted phone and md anchors beneath the shared delta", () => {
    expect(
      controls.match(
        /bottom-\[calc\(var\(--stage-bottom\)\+var\(--stage-height\)\*0\.225-4px\)\]/g,
      ),
    ).toHaveLength(2);
    expect(
      controls.match(
        /md:bottom-\[calc\(var\(--stage-bottom\)\+var\(--stage-height\)\*0\.203\)\]/g,
      ),
    ).toHaveLength(2);
  });

  it("does not alter order, compact gaps, opacity, or per-control positioning", () => {
    expect(controls.match(/grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4 sm:gap-y-4/g)).toHaveLength(2);
    expect(controls.match(/opacity-\[0\.9\]/g)).toHaveLength(2);
    for (const order of ["order-1", "order-2", "order-3", "order-4"]) {
      expect(controls).toContain(order);
    }
  });
});
