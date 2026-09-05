import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const ruleFor = (css: string, marker: string) => {
  const markerIndex = css.indexOf(marker);
  expect(markerIndex).toBeGreaterThanOrEqual(0);
  const ruleStart = css.lastIndexOf("\n\n", markerIndex) + 2;
  const ruleEnd = css.indexOf("\n}", markerIndex);
  expect(ruleEnd).toBeGreaterThan(markerIndex);
  return css.slice(ruleStart, ruleEnd + 2);
};

describe("full Six framing inside the locked 9:16 poster", () => {
  it("keeps the STAGE LOCK poster formula", () => {
    const css = source("app/globals.css");
    const lock = ruleFor(css, "STAGE LOCK (G 2026-08-31)");
    expect(lock).toContain("--stage-height: min(94svh, calc(100svw * 16 / 9))");
    expect(lock).toContain("--stage-width: calc(var(--stage-height) * 9 / 16)");
    expect(lock).toContain("--stage-bottom: var(--stage-top)");
    expect(lock).not.toMatch(/@media/);
  });

  it("does not lower or shorten still and ordinary live media", () => {
    const css = source("app/globals.css");
    const rule = ruleFor(css, "PHYSICAL PHONE CORRECTION (G 2026-09-01)");

    expect(rule).toContain(".aiasap-tablet-idle-media > img.six-primary-scene");
    expect(rule).toContain(
      '[data-six-stage-media="1"] > video.six-primary-scene:not(.object-contain)',
    );
    expect(rule).toContain("height: var(--stage-height) !important");
    expect(rule).toContain("aspect-ratio: 9 / 16 !important");
    // G, 2026-09-04 on his phone: "his hands are cut off ... he needs to be
    // centered, but no brown lines on the sides." MEASURED at a 450x709
    // stage: the 385x690 still covers to 450x806 and the top anchor threw
    // all 97px of overflow off the BOTTOM, taking his hands with it.
    // Centring splits it; cover still means no side bars.
    expect(rule).toContain("object-position: center 50% !important");
    expect(rule).toContain("box-sizing: border-box !important");
    expect(rule).toContain("padding-top: 0 !important");
    expect(rule).toContain("background-color: #241608 !important");
    expect(rule).not.toContain("var(--stage-height) * 0.09");
  });

  it("north-pins the locked scene on phones without changing md+ centering", () => {
    const css = source("app/globals.css");
    const correction = ruleFor(css, "PHONE COMPOSITION (G 2026-09-03)");

    expect(correction).toContain("@media (max-width: 767px)");
    expect(correction).toContain(".aiasap-tablet-idle-media");
    expect(correction).toContain("align-items: flex-start !important");
    expect(css).toMatch(
      /\.aiasap-tablet-idle-media \{[\s\S]*?align-items: center !important[\s\S]*?@media \(max-width: 767px\)/,
    );
  });

  it("keeps the duplicate footer anchor out of every phone-width layout", () => {
    const css = source("app/globals.css");
    const lock = css.slice(css.indexOf("STAGE LOCK (G 2026-08-31)"));

    expect(lock).toMatch(
      /@media \(min-width: 768px\) \{[\s\S]*?\[data-six-initial-idle="1"\] \.stage-legal-footer/,
    );
    const sixHundredBlock = lock.match(/@media \(min-width: 600px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(sixHundredBlock).not.toContain('[data-six-initial-idle="1"] .stage-legal-footer');
  });

  it("excludes the camera thumbnail from the stage framing override", () => {
    const css = source("app/globals.css");
    const session = source("src/components/LiveAvatarSession.tsx");
    const rule = ruleFor(css, "PHYSICAL PHONE CORRECTION (G 2026-09-01)");

    expect(rule).not.toContain(
      '[data-six-stage-media="1"] > .six-primary-scene',
    );
    expect(session).toContain(
      '"absolute top-24 left-4 w-24 h-44 object-contain z-20 rounded-lg border-2 border-white shadow-2xl"',
    );
    expect(session).toContain(
      '"absolute inset-0 h-full w-full object-cover object-top rounded-none border-0 md:relative',
    );
  });
});
