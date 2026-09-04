import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("horizontal stage-control contents", () => {
  it("places every icon before its visible label in one centered row", () => {
    const controls = source("src/components/StageControls.tsx");
    const button = controls.slice(controls.indexOf("<button"), controls.indexOf("</button>") + 9);
    expect(button).toContain("flex-row items-center justify-center gap-[3px]");
    expect(button.indexOf("stage-control-icon")).toBeLessThan(
      button.indexOf("data-stage-control-inline-label"),
    );
    expect(button).not.toContain("flex-col");
    expect(controls).toContain('label={running ? "Stop" : "Start"}');
  });

  it("adds space to Start, Quiet, and Gallery without changing Mute's accepted gap", () => {
    const controls = source("src/components/StageControls.tsx");
    const css = source("app/globals.css");
    expect(css).toMatch(/\[data-stage-control="start"\][\s\S]*?\[data-stage-control="quiet"\][\s\S]*?\[data-stage-control="gallery"\][\s\S]*?column-gap: 6px !important;/);
    expect(css).not.toContain('[data-stage-control="mute"] > .btn-stage');
    expect(controls).toContain("gap-[3px]");
  });

  it("uses the shared wide-face CSS authority and keeps Gallery on one line", () => {
    const controls = source("src/components/StageControls.tsx");
    const css = source("app/globals.css");
    expect(css).toContain("width: min(85vw, max(calc(var(--stage-width) * 0.61), 320px));");
    expect(css).toContain("grid-template-columns: repeat(2, calc(45% - 2.7px))");
    expect(css).toContain("column-gap: calc(5% + 2.7px)");
    expect(css).toContain("justify-content: center");
    expect(css).toContain("row-gap: 10px");
    expect(css).toContain("grid-template-rows: repeat(2, 48px)");
    expect(css).toContain("grid-template-rows: repeat(2, 54px)");
    expect(css).toContain("width: 288.6px");
    expect(css).toContain("grid-template-rows: repeat(2, 38.4px)");
    expect(css.match(/row-gap: 10px !important/g)?.length).toBeGreaterThanOrEqual(2);
    expect(css).toContain("var(--stage-height) * 0.203 + 8px");
    expect(controls).toContain('text-[15px] sm:text-[16.5px] leading-none');
    expect(controls).toContain("tracking-[0.1em]");
    expect(controls).not.toContain("whitespace-normal");
  });

  it("reduces only phone portrait control faces to 90% width and 80% height", () => {
    const beforeWidth = (320 - 6) / 2;
    const afterWidth = (288.6 - 6) / 2;
    expect(afterWidth / beforeWidth).toBeCloseTo(0.9, 8);
    expect(38.4 / 48).toBeCloseTo(0.8, 8);
  });

  it.each([288.6, 320, 389.09375])("halves only the center gap at a prior %dpx cluster", (priorWidth) => {
    const face = priorWidth * 0.45 - 2.7;
    const priorGap = priorWidth * 0.1 + 5.4;
    const nextFace = face;
    const nextGap = priorWidth * 0.05 + 2.7;
    const visibleGridWidth = nextFace * 2 + nextGap;
    expect(nextFace).toBeCloseTo(face, 8);
    expect(nextGap).toBeCloseTo(priorGap / 2, 8);
    expect(visibleGridWidth).toBeCloseTo(priorWidth - priorGap / 2, 8);
  });

  it("copies the contact gradient authority into labels, Legal, and SVG icons", () => {
    const controls = source("src/components/StageControls.tsx");
    const css = source("app/globals.css");
    expect(css).toContain("var(--aiasap-contact-gold-1) 0%");
    expect(css).toContain("var(--aiasap-contact-gold-4) 100%");
    expect(css).toContain('[data-stage-legal-line="1"] .aiasap-legal-separator');
    expect(css).not.toContain("color: #c8893d");
    expect(css).toContain("stroke: url(#aiasap-contact-gold-gradient)");
    expect(css).toContain("color: transparent !important");
    expect(css).toContain("-webkit-text-fill-color: transparent !important");
    expect(css).toContain("text-shadow: none !important");
    expect(css).toContain("filter: drop-shadow(0 1px 1px rgba(37, 18, 5, 0.78)) !important");
    expect(css).toContain("stroke-opacity: 1");
    expect(controls).toContain('id="aiasap-contact-gold-gradient"');
    expect(controls).toContain('stopColor="var(--aiasap-contact-gold-1)"');
    expect(controls).toContain('stopColor="var(--aiasap-contact-gold-4)"');
  });

  it("sizes every rendered glyph to 110 percent of the visible label", () => {
    const css = source("app/globals.css");
    expect(css).toContain("--stage-control-icon-size: calc(var(--stage-control-label-size) * 1.1)");
    expect(css).toContain("width: var(--stage-control-icon-size)");
    expect(css).toContain("height: var(--stage-control-icon-size)");
  });

  it("preserves the 2x2 semantic order and handlers", () => {
    const controls = source("src/components/StageControls.tsx");
    for (const [id, order] of [["start", 1], ["gallery", 2], ["mute", 3], ["quiet", 4]] as const) {
      expect(controls).toMatch(new RegExp(`controlId="${id}"[\\s\\S]*?className="order-${order}"`));
    }
    for (const handler of ["onStopStart", "onToggleMic", "onToggleQuiet", "onGallery"]) {
      expect(controls).toContain(handler);
    }
  });
});
