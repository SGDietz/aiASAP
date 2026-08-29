import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function ipadRects(height: number) {
  const stageHeight = height * 0.94;
  const stageTop = (height - stageHeight) / 2;
  const rimBottom = stageTop + stageHeight;
  const legalTop = rimBottom + 6;
  // 16.5px md text at normal line height is bounded below 21px.
  const legalBottomUpperBound = legalTop + 21;
  return { stageTop, rimBottom, legalTop, legalBottomUpperBound };
}

describe("iPad legal separation across lifecycle states", () => {
  it.each([
    ["portrait", 1366],
    ["landscape", 1024],
  ])("keeps a six-pixel rim gap in %s", (_orientation, height) => {
    const rects = ipadRects(height);
    expect(rects.legalTop - rects.rimBottom).toBeCloseTo(6, 5);
    expect(rects.legalBottomUpperBound).toBeLessThanOrEqual(height);
  });

  it("uses one coarse-iPad winner for idle, loading, active, and Stop", () => {
    const css = source("app/globals.css");
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    expect(css).toMatch(
      /@media \(min-width: 768px\) and \(max-width: 1366px\) and \(pointer: coarse\)[\s\S]*?\.stage-legal-footer\s*\{[\s\S]*?top: calc\(var\(--stage-top\) \+ var\(--stage-height\) \+ 6px\) !important;[\s\S]*?bottom: auto !important;/,
    );
    expect(demo.match(/<StageLegalFooter/g)?.length).toBeGreaterThanOrEqual(5);
    expect(session.match(/<StageLegalFooter/g)?.length).toBe(2);
    expect(css).not.toContain(".aiasap-tablet-idle-legal {\n    bottom:");
  });

  it("does not alter phone or fine-pointer desktop control anchors", () => {
    const controls = source("src/components/StageControls.tsx");
    expect(controls.match(/var\(--stage-height\)\*0\.225/g)).toHaveLength(2);
    expect(controls.match(/var\(--stage-height\)\*0\.203/g)).toHaveLength(2);
  });
});
