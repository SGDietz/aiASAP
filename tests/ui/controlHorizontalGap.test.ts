import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const controls = fs.readFileSync(
  path.join(process.cwd(), "src/components/StageControls.tsx"),
  "utf8",
);

describe("wide separated all-device control grid", () => {
  it("uses one small six-pixel horizontal gutter", () => {
    expect(controls.match(/gap-x-\[6px\]/g)).toHaveLength(2);
    expect(controls).not.toContain("gap-x-3");
    expect(controls).not.toContain("sm:gap-x-4");
  });

  it("uses one small six-pixel vertical gutter", () => {
    expect(controls.match(/gap-y-\[6px\]/g)).toHaveLength(2);
  });

  it("keeps the active external-label and dormant responsive geometry aligned", () => {
    const geometry =
      "grid grid-cols-2 grid-rows-2 gap-x-[6px] gap-y-[6px]";
    expect(controls.match(new RegExp(geometry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))).toHaveLength(2);
    expect(controls.match(/translate-y-\[4px\]/g)).toHaveLength(2);
    expect(controls.match(/opacity-100/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
