import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

/**
 * G, 2026-09-04 late, after seeing the ornate gold set on his chest: "Change
 * these back to what they were yesterday. The same start stop. Gallery, mute,
 * quiet, whatever. With the old icons, the old spacing ... go back, like,
 * twenty four hours, to the second screenshot, and we gotta figure out from
 * there what we can do to make this more attractive."
 *
 * So the BASELINE is the plain outline set again - Play/Square, Images,
 * Mic/MicOff, Volume2/VolumeX - floating openly on Six's chest, icon above
 * word, at the modest size and roomy spacing of that screenshot. The ornate
 * sheet glyphs (compass rose, fleur flourish, vintage mic, quill feather) and
 * their solid-gold paint are NOT lost: commit efeffb05 carries them whole.
 *
 * LEVEL STILL HOLDS, and now for free: every lucide glyph is drawn to the same
 * 24-unit square and they all render at one shared box size, so row partners
 * cannot sit at different latitudes. Measured with chest_probe.py - the icon
 * box tops and the label baselines match exactly across both rows at ten
 * viewports. The ink inside each box differs by design (a mic is narrow, a
 * speaker is wide), which is how the old set always looked.
 */
describe("open-control glyph baseline (G's second screenshot)", () => {
  const controls = source("src/components/StageControls.tsx");
  const css = source("app/globals.css");

  it("renders the plain outline set through one shared icon class", () => {
    expect(controls).toContain(
      'import { Mic, MicOff, Square, Play, Volume2, VolumeX, Images } from "lucide-react";',
    );
    expect(controls).toContain('const ICON = "stage-open-glyph"');
    expect(controls.match(/className=\{ICON\}/g)?.length).toBeGreaterThanOrEqual(8);
    for (const glyph of ["CompassRoseIcon", "FlourishIcon", "VintageMicIcon", "FeatherWaveIcon"]) {
      expect(controls).not.toContain(glyph);
    }
  });

  it("keeps the state swaps on Start, Mute, and Quiet", () => {
    expect(controls).toMatch(/running \? <Square[\s\S]*?<Play /);
    expect(controls).toMatch(/micOff \? <MicOff[\s\S]*?<Mic /);
    expect(controls).toMatch(/quiet \? <VolumeX[\s\S]*?<Volume2 /);
    expect(controls).toContain('label={running ? "Stop" : "Start"}');
  });

  it("carries no per-icon scale, box, or transform nudge", () => {
    expect(controls).not.toContain("scale={");
    expect(controls).not.toMatch(/transform: `scale/);
    expect(controls).not.toMatch(/h-\[\d+px\] w-\[\d+px\]/);
  });

  it("sizes every glyph from one CSS box keyed to the label", () => {
    expect(css).toContain(
      "--stage-open-icon-size: calc(var(--stage-control-label-size, 16.5px) * 1.35) !important",
    );
    expect(css).toContain("width: var(--stage-open-icon-size) !important;");
    expect(css).toContain("height: var(--stage-open-icon-size) !important;");
    expect(css).toContain("stroke: url(#aiasap-contact-gold-gradient) !important;");
  });

  it("restores the roomy spacing of the second screenshot", () => {
    // the sheet's tight 33% columns and 1px icon-to-word gap are gone
    expect(css).not.toContain("grid-template-columns: repeat(2, 33%) !important");
    expect(css).toContain("grid-template-columns: repeat(2, calc(45% - 2.7px)) !important");
    expect(css).toContain("column-gap: calc(5% + 2.7px) !important");
    expect(css).toContain("row-gap: 15px !important");
    expect(controls).toContain("gap-[3px]");
  });

  it("puts the cluster back on its pre-sheet anchors", () => {
    // phone rides Six's own pinned frame; md+ rides --stage-height
    expect(css).toContain("* 0.75 - var(--six-lift)");
    expect(css).toContain("* 0.75 - var(--six-lift)) + 49px");
    expect(css).toContain("var(--stage-height) * 0.203 + 28px");
    // and the tight 12px-above-the-hands block is gone
    expect(css).not.toContain("GOLD GLYPHS + CHEST ANCHOR");
    expect(css).not.toContain("--six-chest-gap");
  });
});
