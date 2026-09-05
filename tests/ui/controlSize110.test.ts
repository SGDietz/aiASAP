import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const controls = fs.readFileSync(
  path.join(process.cwd(), "src/components/StageControls.tsx"),
  "utf8",
);
const css = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

describe("accepted Six control sizing", () => {
  it("lets the open controls fill their grid cell instead of fixed boxes", () => {
    // G, 2026-09-04: no more rectangular boxes - the cell is the hit area and
    // the cluster rules own its size.
    expect(controls).toContain('mobileStartControls ? "h-full w-full" : "h-full w-full"');
    expect(controls).not.toContain("h-[48px] w-[110px]");
    expect(controls).not.toContain("h-14 w-14 sm:h-16 sm:w-16");
  });

  it("keeps spacing and label size while CSS owns the glyph height", () => {
    expect(6.6).toBeCloseTo(6 * 1.1, 10);
    expect(controls).toContain('"text-[12px] sm:text-[14px] leading-none');
    expect(controls).toContain("gap-[6.6px]");
    expect(controls).toContain("flex-col items-center justify-center gap-[3px]");
    // no per-icon pixel boxes and no per-icon scale nudges in the TSX - one
    // shared square box is what keeps the row partners level
    expect(controls).not.toMatch(/h-\[18px\] w-\[18px\]/);
    expect(controls).not.toContain("scale={");
    expect(controls).toContain('const ICON = "stage-open-glyph"');
    expect(css).toContain("--stage-open-icon-size: calc(var(--stage-control-label-size, 16.5px) * 1.35) !important");
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
