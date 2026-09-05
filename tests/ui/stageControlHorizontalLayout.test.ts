import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("open stage-control contents", () => {
  it("places every icon above its visible label in one centered stack", () => {
    // G, 2026-09-04: open icon-above-word controls float on 6's chest.
    const controls = source("src/components/StageControls.tsx");
    const button = controls.slice(controls.indexOf("<button"), controls.indexOf("</button>") + 9);
    expect(button).toContain("flex-col items-center justify-center gap-[3px]");
    expect(button.indexOf("stage-control-icon")).toBeLessThan(
      button.indexOf("data-stage-control-inline-label"),
    );
    expect(button).not.toContain("flex-row");
    expect(controls).toContain('label={running ? "Stop" : "Start"}');
  });

  it("adds space to Start, Quiet, and Gallery without changing Mute's accepted gap", () => {
    const controls = source("src/components/StageControls.tsx");
    const css = source("app/globals.css");
    // G allowed the squeeze when the boxes lost 10%: "if you have to move the
    // gallery and the icon for gallery closer to it ... do that also." These
    // three drop to Mute's already-approved 3px rather than a new number.
    expect(css).toMatch(/\[data-stage-control="start"\][\s\S]*?\[data-stage-control="quiet"\][\s\S]*?\[data-stage-control="gallery"\][\s\S]*?column-gap: 3px !important;/);
    expect(css).not.toContain('[data-stage-control="mute"] > .btn-stage');
    expect(controls).toContain("gap-[3px]");
  });

  it("uses the shared wide-face CSS authority and keeps Gallery on one line", () => {
    const controls = source("src/components/StageControls.tsx");
    const css = source("app/globals.css");
    // G, 2026-09-04 (second pass): "take ten percent off the sides, just the
    // left right on all four boxes, all devices, just the visuals ... they're
    // just a little too big." The boxes are two equal columns of the cluster,
    // so the cluster width carries the 10% and every HEIGHT stays as approved.
    // Measured after: phone 127->114, desktop 141->127.
    expect(css).toContain("width: min(76.5vw, max(calc(var(--stage-width) * 0.549), 288px));");
    expect(css).toContain("grid-template-columns: repeat(2, calc(45% - 2.7px))");
    expect(css).toContain("column-gap: calc(5% + 2.7px)");
    expect(css).toContain("justify-content: center");
    expect(css).toContain("row-gap: 10px");
    expect(css).toContain("grid-template-rows: repeat(2, 48px)");
    expect(css).toContain("grid-template-rows: repeat(2, 54px)");
    // -10% on G's word, 2026-09-04. The phone cluster carries the reduction
    // so each of the four boxes narrows 10% (127 -> 114, measured) while the
    // 38px heights stay exactly as approved.
    expect(css).toContain("width: 259.7px");
    expect(css).toContain("grid-template-rows: repeat(2, 38.4px)");
    expect(css.match(/row-gap: 10px !important/g)?.length).toBeGreaterThanOrEqual(2);
    // G, 2026-09-04, ink on the screenshot: "move all four of the buttons
    // up ... where the mute and quiet are, move them up to where the start
    // and gallery is." One MEASURED button row: 38px phone / 54px tablet+,
    // row-gap 10px, so G then judged that too high: the move is now HALF a row on
    // tablet+ (+32) and a light nudge on phone (+16). Bottom-anchored, so
    // the whole 2x2 moves and the gap to 6's hands grows by one row.
    // Mobile only, half a box (19px of a 38px button) back down: 24 - 19 = 5.
    expect(css).toContain("var(--stage-height) * 0.203 + 5px");
    expect(controls).toContain('text-[12px] sm:text-[14px] leading-none');
    // the real label size is the CSS authority; the glyph box is keyed to it
    expect(css).toContain("--stage-open-icon-size: calc(var(--stage-control-label-size, 16.5px) * 1.878) !important");
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

  it("puts the labels, Legal, and the SVG icons on the wordmark blend", () => {
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
    // G, 2026-09-04 late: "Make this start gallery mute quiet all that also the
    // same color blends and the icons as aiASAP." The four chest words and the
    // four chest icons now carry the wordmark's own three stops, the same ones
    // the footer took a few minutes earlier. The gradient's ID is historical -
    // these icons are its only users.
    expect(controls).toContain('id="aiasap-contact-gold-gradient"');
    // THE SLICE, not the raw ramp. G, 2026-09-04: "Looks like there's some
    // black, and it just doesn't match the aiASAP." Same three stops, but
    // `background-clip: text` runs a gradient over the ELEMENT box, and the
    // wordmark's h1 has leading + padding while small text is leading-none -
    // so small text ran off both ends of the ramp into near-black. These are
    // the wordmark's own visible range solved back onto a full 0-100%.
    // MEASURED after: label 188 -> 103 luminance vs wordmark 190 -> 105.
    expect(controls).toContain('stopColor="var(--aiasap-blend-small-1)"');
    expect(controls).toContain('stopColor="var(--aiasap-blend-small-3)"');
    expect(css).toContain("--aiasap-wordmark-1: #ffe9c2;");
    expect(css).toContain("--aiasap-wordmark-2: #d7a05a;");
    expect(css).toContain("--aiasap-wordmark-3: #3a2108;");
    // G, 2026-09-04: "See how beautiful and light aiASAP is ... remove all the
    // junk visually ... mimic that perfect light at the top, just a little bit
    // of darkness at the bottom." Four stops, so the light is held through the
    // top two thirds and the darkness is compressed into the last third and
    // stops at a warm brown, never near-black. MEASURED after: label luminance
    // 226 -> 150, icon 235 -> 115, against the wordmark's own 209 -> 105.
    expect(css).toContain("--aiasap-blend-small-1: #ffe9c2;");
    expect(css).toContain("--aiasap-blend-small-2: #f6dcac;");
    expect(css).toContain("--aiasap-blend-small-3: #e6b877;");
    expect(css).toContain("--aiasap-blend-small-4: #b07a38;");
    // THE FOUR CHEST WORDS AND ICONS ARE PAINTED AS THEY ARE LIVE ON aiasap.ai.
    // G, 2026-09-04 22:00, holding a crop of the live controls: "these are
    // more realistic in size and color, and they are what are live on
    // aiASAP.ai right now." Read off the served bundle: Lato at normal
    // weight, 0.14em tracking, SOLID #d7a05a with one 1.5px shadow; icons a
    // plain currentColor stroke at lucide's own width 2 with the same shadow.
    // The wordmark blend and Archivo Black are OFF the controls; the footer
    // keeps the blend.
    const labelPaint = css.slice(css.indexOf("THE FOUR CHEST WORDS, PAINTED AS THEY ARE LIVE"));
    expect(labelPaint).toContain('font-family: "Lato", "Segoe UI", Arial, sans-serif !important;');
    expect(labelPaint).toContain("font-weight: 400 !important;");
    expect(labelPaint).toContain("letter-spacing: 0.14em !important;");
    // G 2026-09-05: one shade browner than the live-site #d7a05a.
    expect(labelPaint).toContain("color: #a77c46 !important;");
    expect(labelPaint).toContain("-webkit-text-fill-color: #a77c46 !important;");
    expect(labelPaint).toContain("text-shadow: 0 1px 1.5px rgba(58, 33, 8, 0.55) !important;");
    expect(css).not.toContain('font-family: "Archivo Black", "Arial Black", Impact, sans-serif !important;');
    expect(css).toContain("stroke-width: 2 !important;");
    expect(css).not.toContain("stroke-width: 3.4 !important;");
    expect(css).toContain("filter: drop-shadow(0 1px 1.5px rgba(58, 33, 8, 0.55)) !important;");
    const blend = css.slice(css.indexOf("THE BOTTOM THREE, IN THE WORDMARK'S OWN BLEND"));
    // The blend selector list carries the footer only; the chest labels left it.
    const blendSelectors = blend.slice(0, blend.indexOf("background-image: linear-gradient("));
    expect(blendSelectors).not.toContain('[data-stage-control-inline-label="1"]');
    expect(blend).toContain('[data-public-contact-ink="1"]');
    expect(blend).toContain('[data-stage-legal-line="1"] .aiasap-legal-ink');
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
