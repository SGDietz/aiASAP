import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = () => readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

function rule(source: string, selector: string) {
  const start = source.indexOf(selector);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("}", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end + 1);
}

describe("shared stage-control gold blend", () => {
  it("paints every control label with the contact-link four-stop gold blend", () => {
    const source = css();
    const shared = rule(source, ':where(\n  [data-stage-controls="1"] [data-stage-control-inline-label="1"],');

    expect(shared).toContain("var(--aiasap-contact-gold-1) 0%");
    expect(shared).toContain("var(--aiasap-contact-gold-2) 34%");
    expect(shared).toContain("var(--aiasap-contact-gold-3) 70%");
    expect(shared).toContain("var(--aiasap-contact-gold-4) 100%");
    expect(shared).toContain("-webkit-background-clip: text");
    expect(shared).toContain("-webkit-text-fill-color: transparent");
  });

  it("shares that paint with contact ink and the complete Legal line", () => {
    const source = css();
    const shared = rule(
      source,
      ':where(\n  [data-stage-controls="1"] [data-stage-control-inline-label="1"],',
    );

    expect(shared).toContain('[data-public-contact-ink="1"]');
    expect(shared).toContain('[data-stage-legal-line="1"] .aiasap-legal-ink');
    expect(shared).toContain('[data-stage-legal-line="1"] .aiasap-legal-separator');
    expect(source).not.toContain("color: #c8893d");
  });

  it("carries the one-poster stage lock without a width breakpoint", () => {
    const source = css();
    const lockStart = source.indexOf("STAGE LOCK (G 2026-08-31)");
    const lock = source.slice(lockStart, source.indexOf("\n}", lockStart) + 2);

    expect(lock).toContain("--stage-height: min(94svh, calc(100svw * 16 / 9))");
    expect(lock).toContain("--stage-width: calc(var(--stage-height) * 9 / 16)");
    expect(lock).not.toContain("@media");
    // G, 2026-09-04, ink on the screenshot: "move all four of the buttons
    // up ... where the mute and quiet are, move them up to where the start
    // and gallery is." One MEASURED button row: 38px phone / 54px tablet+,
    // row-gap 10px, so G then judged that too high: the move is now HALF a row on
    // tablet+ (+32) and a light nudge on phone (+16). Bottom-anchored, so
    // the whole 2x2 moves and the gap to 6's hands grows by one row.
    expect(source).toContain("bottom: calc(var(--stage-bottom) + var(--stage-height) * 0.203 + 28px)");
  });

  it("keeps the poster's physical geometry stable when browser zoom rescales both viewport axes", () => {
    const physicalPoster = (width: number, height: number, zoom: number) => {
      const cssWidth = width / zoom;
      const cssHeight = height / zoom;
      const stageHeight = Math.min(cssHeight * 0.94, (cssWidth * 16) / 9);
      return { height: stageHeight * zoom, width: stageHeight * zoom * (9 / 16) };
    };
    const expected = physicalPoster(1440, 900, 1);

    for (const zoom of [0.33, 0.5, 0.8, 1, 1.1, 1.25]) {
      const actual = physicalPoster(1440, 900, zoom);
      expect(actual.height).toBeCloseTo(expected.height, 10);
      expect(actual.width).toBeCloseTo(expected.width, 10);
    }
    expect(expected.width / expected.height).toBeCloseTo(9 / 16, 12);
  });
});
