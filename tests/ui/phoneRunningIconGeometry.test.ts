import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

/**
 * G, 2026-09-04 late, holding his reference sheet: "the start gallery mute
 * quiet buttons, they're not on the same latitude. They gotta be level side
 * to side. And, basically, just take that and put it on six's chest ... his
 * stomach is just above his hands. Make it beautiful."
 *
 * LEVEL BY CONSTRUCTION. Every glyph paints y = 1.0..23.0 of its own viewBox
 * and every <svg> renders at ONE shared height with width following its own
 * aspect. That is the whole guarantee: no per-icon scale, no nudges. The
 * painted proof is chest_probe.py (ink top/bottom per pair at ten viewports,
 * within 1px). This guard keeps the construction from being undone in code.
 */
describe("open-control glyph geometry (level by construction)", () => {
  const controls = source("src/components/StageControls.tsx");
  const css = source("app/globals.css");
  const chest = css.slice(css.indexOf("GOLD GLYPHS + CHEST ANCHOR"));

  it("renders all four sheet glyphs through one shared-height svg owner", () => {
    for (const glyph of ["CompassRoseIcon", "FlourishIcon", "VintageMicIcon", "FeatherWaveIcon"]) {
      expect(controls).toContain(`export function ${glyph}()`);
      expect(controls.match(new RegExp(`<${glyph} />`, "g"))).toHaveLength(2);
    }
    expect(controls).toContain('data-stage-glyph="1"');
    // each glyph's own aspect; heights are all 24 so the ink rule is shared
    expect(controls).toContain('viewBox="0 0 44 24"'); // flourish, wide
    expect(controls).toContain('viewBox="0 0 26 24"'); // feather
    expect(controls.match(/viewBox="0 0 24 24"/g)).toHaveLength(2); // compass, mic
    expect(controls).not.toMatch(/viewBox="0 0 \d+ (?!24")/);
  });

  it("carries no per-icon scale or transform nudge in the component", () => {
    expect(controls).not.toContain("scale={");
    expect(controls).not.toMatch(/transform: `scale/);
    expect(controls).not.toContain("translate(0 1.3)");
  });

  it("lets CSS own one shared glyph height with width following the aspect", () => {
    expect(chest).toContain("width: auto !important;");
    expect(chest).toContain("height: var(--stage-open-icon-size) !important;");
    expect(chest).toContain("stroke: none !important;");
    expect(css).toContain("--stage-open-icon-size: calc(var(--stage-control-label-size, 16.5px) * 2.06) !important");
  });

  it("anchors the cluster and the capture box to the hands line on every breakpoint", () => {
    // hands top = 573/690 of the frame, skin-scanned on startscreen-noband.png
    expect(chest).toContain("--six-hands-top: calc(var(--six-frame-h) * 0.8304 - var(--six-lift));");
    expect(chest).toContain("--six-chest-gap: 12px;");
    expect(chest).toContain("bottom: calc(100svh - var(--six-hands-top) + var(--six-chest-gap)) !important;");
    expect(chest).toContain("bottom: calc(var(--stage-bottom) + var(--stage-height) * 0.1696 + 16px) !important;");
    expect(chest).toContain("var(--six-chest-gap) + 62px) !important;");
    expect(chest).toContain("* 0.1696 + 16px + 66px) !important;");
    expect((1 - 0.8304).toFixed(4)).toBe("0.1696");
  });

  it("stays the last block so it beats every earlier anchor", () => {
    const at = css.indexOf("GOLD GLYPHS + CHEST ANCHOR");
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeGreaterThan(css.lastIndexOf("OPEN-CONTROL SIZING"));
    expect(at).toBeGreaterThan(css.lastIndexOf("PHONE FRAMING"));
    expect(at).toBeGreaterThan(css.lastIndexOf("* 0.203 + 28px) !important"));
    expect(at).toBeGreaterThan(css.lastIndexOf("* 0.75 - var(--six-lift))"));
  });
});
