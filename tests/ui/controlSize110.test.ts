import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const controls = fs.readFileSync(
  path.join(process.cwd(), "src/components/StageControls.tsx"),
  "utf8",
);

describe("110% Six control sizing", () => {
  it("enlarges button diameter exactly 10% on phone and sm+", () => {
    expect(61.6).toBeCloseTo(56 * 1.1, 10);
    expect(70.4).toBeCloseTo(64 * 1.1, 10);
    expect(controls).toContain(
      "h-[61.6px] w-[61.6px] sm:h-[70.4px] sm:w-[70.4px]",
    );
    expect(controls).not.toContain("h-14 w-14 sm:h-16 sm:w-16");
  });

  it("enlarges icons, labels, and internal spacing exactly 10%", () => {
    expect(26.4).toBeCloseTo(24 * 1.1, 10);
    expect(30.8).toBeCloseTo(28 * 1.1, 10);
    expect(13.2).toBeCloseTo(12 * 1.1, 10);
    expect(14.52).toBeCloseTo(13.2 * 1.1, 10);
    expect(6.6).toBeCloseTo(6 * 1.1, 10);

    expect(controls).toContain(
      'const icon = "h-[26.4px] w-[26.4px] sm:h-[30.8px] sm:w-[30.8px]"',
    );
    expect(controls).toContain(
      '"text-[13.2px] sm:text-[14.52px] leading-none',
    );
    expect(controls).toContain("gap-[6.6px]");
    expect(controls.match(/h-\[26\.4px\] w-\[26\.4px\]/g)).toHaveLength(5);
    expect(controls.match(/sm:h-\[30\.8px\] sm:w-\[30\.8px\]/g)).toHaveLength(5);
  });

  it("keeps explicit cluster gaps, anchors, opacity, and shared state owners", () => {
    expect(
      controls.match(
        /grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4 sm:gap-y-4/g,
      ),
    ).toHaveLength(2);
    expect(controls.match(/translate-y-\[4px\]/g)).toHaveLength(2);
    expect(controls.match(/opacity-\[0\.9\]/g)).toHaveLength(2);
    expect(controls.match(/data-stage-controls="1"/g)).toHaveLength(2);
  });
});
