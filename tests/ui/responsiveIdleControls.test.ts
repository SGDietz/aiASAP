import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("shared idle responsive controls", () => {
  const css = source("app/globals.css");

  it("freezes phone <=599 and uses one 1.20x phone authority at every 600+ width", () => {
    expect(css).toContain("@media (min-width: 600px)");
    expect(css).toContain("--aiasap-idle-controls-width: 264px;");
    expect(css).toContain("--aiasap-idle-controls-height: 120px;");
    expect(css).toContain("--aiasap-idle-control-width: 132px;");
    expect(css).toContain("--aiasap-idle-control-height: 60px;");
    expect(css).toContain("--aiasap-idle-control-icon: 24px;");
    expect(css).toContain("--aiasap-idle-control-label: 20.4px;");
    expect(132).toBeCloseTo(110 * 1.2, 10);
    expect(60).toBeCloseTo(50 * 1.2, 10);
    expect(24).toBeCloseTo(20 * 1.2, 10);
    expect(20.4).toBeCloseTo(17 * 1.2, 10);
    expect(css).not.toContain("width: 39.6px;");
    expect(css).not.toContain("font-size: 21.08304px;");
    expect(css).not.toContain("width: 36.96px;");
    expect(css).not.toContain("font-size: 17.424px;");
  });

  it("uses the phone relationship and bronze face on the shared START/RUNNING owner", () => {
    expect(css).toMatch(/\[data-stage-controls="1"\]\.stage-controls-cluster[\s\S]*?grid-template-columns: repeat\(2, calc\(45% - 2\.7px\)\);[\s\S]*?grid-template-rows: repeat\(2, 48px\);/);
    expect(css).toMatch(/:not\(\[data-mobile-start-controls="1"\]\)[\s\S]*?gallery[\s\S]*?quiet[\s\S]*?translateX\(4px\)/);
    expect(css).toContain(":where([data-stage-controls=\"1\"]) .btn-stage");
    expect(css).toContain("linear-gradient(180deg, rgba(55, 29, 10, 0.82), rgba(25, 13, 5, 0.9))");
    expect(css).toContain("border-radius: 0.625rem !important;");
    expect(css).toContain("color: rgb(215, 160, 90);");
    expect(css).toContain("drop-shadow(0 1px 1.5px rgba(58, 33, 8, 0.55))");
  });
});
