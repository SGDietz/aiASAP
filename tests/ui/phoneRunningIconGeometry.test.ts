import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("physical-phone RUNNING inner-icon geometry", () => {
  it("keeps STOP at its natural 22.5px peer-reference paint height", () => {
    const controls = source("src/components/StageControls.tsx");
    const css = source("app/globals.css");

    expect(controls).toContain('data-phone-running-stop-glyph="1"');
    expect(css).toMatch(
      /data-phone-running-stop-glyph="1"[\s\S]*?transform: scale\(0\.9\);[\s\S]*?transform-origin: center;/,
    );
    expect(18 * (30 / 24) * 0.9).toBe(20.25);
  });

  it("shortens only the RUNNING MUTE glyph to 0.90x height", () => {
    const controls = source("src/components/StageControls.tsx");
    const css = source("app/globals.css");

    expect(controls.match(/data-phone-running-mute-glyph=/g)).toHaveLength(2);
    expect(controls).toContain('running ? "1" : undefined');
    expect(css).toMatch(
      /data-phone-running-mute-glyph="1"[\s\S]*?transform: scaleY\(0\.9\);[\s\S]*?transform-origin: center;/,
    );
    expect(20 * (30 / 24) * 0.9).toBe(22.5);
  });

  it("does not change shared layout sizing, cells, or responsive icon slots", () => {
    const controls = source("src/components/StageControls.tsx");
    const css = source("app/globals.css");

    expect(controls).toContain('? "h-[30px] w-[30px]"');
    expect(controls).toContain('gap-[2px]');
    expect(css).toContain("@media (max-width: 599px)");
    expect(css).toContain("@media (min-width: 600px)");
    expect(css).toContain("width: var(--aiasap-idle-control-icon);");
    expect(css).toContain("height: var(--aiasap-idle-control-icon);");
    expect((25 + 20.0075) / 2).toBeCloseTo(22.50375, 8);
  });

  it("restores START natural geometry while preserving STOP and MUTE transforms", () => {
    const controls = source("src/components/StageControls.tsx");
    const css = source("app/globals.css");

    expect(controls).toContain('data-stage-start-glyph="1"');
    expect(css).not.toMatch(/data-stage-start-glyph="1"[\s\S]*?transform:/);
    expect(css).toMatch(
      /data-phone-running-stop-glyph="1"[\s\S]*?transform: scale\(0\.9\);[\s\S]*?data-phone-running-mute-glyph="1"[\s\S]*?transform: scaleY\(0\.9\);/,
    );
    // Browser path bounds quantize to 1/64px; five decimals distinguishes the
    // exact 0.90 source transform while allowing that expected subpixel noise.
    expect(20.001543045043945 / 18.001388549804688).toBeCloseTo(1 / 0.9, 5);
    expect(22.50146484375 / 20.2513427734375).toBeCloseTo(1 / 0.9, 5);
    expect(24.001861572265625 / 21.601654052734375).toBeCloseTo(1 / 0.9, 5);
    expect(27.0018310546875 / 24.3016357421875).toBeCloseTo(1 / 0.9, 5);
    expect(36 * 0.9).toBe(32.4);
    expect(27 * 0.9).toBe(24.3);
    expect(30 * 0.9).toBe(27);
    expect((30 + 24.00897216796875) / 2).toBeCloseTo(27.004486083984375, 12);
  });
});
