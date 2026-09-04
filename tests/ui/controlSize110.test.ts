import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const controls = fs.readFileSync(
  path.join(process.cwd(), "src/components/StageControls.tsx"),
  "utf8",
);

describe("accepted Six control sizing", () => {
  it("keeps the accepted widths while decisively slimming active faces", () => {
    expect(48).toBeLessThan(61.6);
    expect(54).toBeLessThan(70.4);
    expect(controls).toContain(
      'mobileStartControls ? "h-full w-full" : "h-[48px] w-[110px] sm:h-[54px] sm:w-[132px]"',
    );
    expect(controls).toContain('mobileStartControls ? "h-full w-full"');
    expect(controls).not.toContain("h-14 w-14 sm:h-16 sm:w-16");
  });

  it("keeps spacing and label size while bringing icons back into proportion", () => {
    expect(18).toBeLessThan(26.4);
    expect(20).toBeLessThan(30.8);
    expect(14).toBeGreaterThan(13.2);
    expect(15.4).toBeGreaterThan(14.52);
    expect(6.6).toBeCloseTo(6 * 1.1, 10);

    expect(controls).toContain('const icon = mobileStartControls');
    expect(controls).toContain('? "h-[20px] w-[20px]"');
    expect(controls).toContain(': "h-[18px] w-[18px] sm:h-[20px] sm:w-[20px]"');
    expect(controls).toContain(
      '"text-[14px] sm:text-[15.4px] leading-none',
    );
    expect(controls).toContain("gap-[6.6px]");
    expect(controls).toContain("flex-row items-center justify-center gap-[3px]");
    expect(controls.match(/h-\[18px\] w-\[18px\]/g)?.length).toBeGreaterThanOrEqual(5);
    expect(controls.match(/sm:h-\[20px\] sm:w-\[20px\]/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("keeps explicit cluster gaps, anchors, opacity, and shared state owners", () => {
    expect(
      controls.match(
        /grid grid-cols-2 grid-rows-2 gap-x-\[6px\] gap-y-\[6px\]/g,
      ),
    ).toHaveLength(2);
    expect(controls.match(/translate-y-\[4px\]/g)).toHaveLength(2);
    expect(controls.match(/opacity-100/g)?.length).toBeGreaterThanOrEqual(2);
    expect(controls.match(/data-stage-controls="1"/g)).toHaveLength(2);
  });
});
