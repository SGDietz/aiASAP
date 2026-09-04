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

  it("keeps the accepted compact initial grid and responsive active/dormant gaps", () => {
    expect(controls).toContain('mobileStartControls ? "h-full w-full gap-0"');
    expect(controls.match(/grid grid-cols-2 grid-rows-2 gap-x-\[6px\] gap-y-\[6px\] opacity-100/g)).toHaveLength(2);
    expect(controls.match(/opacity-100/g)?.length).toBeGreaterThanOrEqual(2);
    for (const order of ["order-1", "order-2", "order-3", "order-4"]) {
      expect(controls).toContain(order);
    }
  });
});
