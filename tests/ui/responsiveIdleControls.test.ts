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
    expect(css).toContain("--aiasap-idle-controls-height: 180px;");
    expect(css).toContain("--aiasap-idle-control-width: 132px;");
    expect(css).toContain("--aiasap-idle-control-height: 90px;");
    expect(css).toContain("--aiasap-idle-control-icon: 36px;");
    expect(css).toContain("--aiasap-idle-control-label: 19.1664px;");
    expect(132).toBeCloseTo(110 * 1.2, 10);
    expect(90).toBeCloseTo(75 * 1.2, 10);
    expect(36).toBeCloseTo(30 * 1.2, 10);
    expect(19.1664).toBeCloseTo(15.972 * 1.2, 10);
    expect(css).not.toContain("width: 39.6px;");
    expect(css).not.toContain("font-size: 21.08304px;");
    expect(css).not.toContain("width: 36.96px;");
    expect(css).not.toContain("font-size: 17.424px;");
  });

  it("uses the phone relationship and gold face on the shared START/RUNNING owner", () => {
    expect(css).toMatch(/\[data-stage-controls="1"\]\[data-mobile-start-controls="1"\][\s\S]*?flex-direction: column;[\s\S]*?gap: var\(--aiasap-idle-control-gap\);/);
    expect(css).toMatch(/\[data-stage-controls="1"\]\[data-mobile-start-controls="1"\][\s\S]*?gallery[\s\S]*?quiet[\s\S]*?translateX\(4px\)/);
    expect(css).toContain(":where([data-stage-controls=\"1\"]) .btn-stage");
    expect(css).toContain("background: transparent;");
    expect(css).toContain("color: rgb(215, 160, 90);");
    expect(css).toContain("drop-shadow(0 1px 1.5px rgba(58, 33, 8, 0.55))");
  });
});
