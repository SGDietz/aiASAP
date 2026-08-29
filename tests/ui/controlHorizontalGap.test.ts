import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const controls = fs.readFileSync(
  path.join(process.cwd(), "src/components/StageControls.tsx"),
  "utf8",
);

describe("halved all-device control column gap", () => {
  it("uses 12px on phones and 16px from sm through tablet/desktop", () => {
    expect(controls.match(/gap-x-3/g)).toHaveLength(2);
    expect(controls.match(/sm:gap-x-4/g)).toHaveLength(2);
    expect(controls).not.toContain("gap-x-6");
    expect(controls).not.toContain("sm:gap-x-8");
  });

  it("keeps vertical gaps at 12px phone and 16px sm+", () => {
    expect(controls.match(/gap-y-3/g)).toHaveLength(2);
    expect(controls.match(/sm:gap-y-4/g)).toHaveLength(2);
  });

  it("keeps active and dormant responsive geometry identical", () => {
    const geometry =
      "grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4 sm:gap-y-4";
    expect(controls.split(geometry)).toHaveLength(3);
    expect(controls.match(/translate-y-\[4px\]/g)).toHaveLength(2);
    expect(controls.match(/opacity-\[0\.9\]/g)).toHaveLength(2);
  });
});
