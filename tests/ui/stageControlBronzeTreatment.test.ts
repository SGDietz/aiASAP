import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("selected smoky-bronze four-control treatment", () => {
  const css = source("app/globals.css");
  const controls = source("src/components/StageControls.tsx");

  it("uses one restrained stage-only face without changing the cluster geometry", () => {
    expect(css).toContain(':where([data-stage-controls="1"]) .btn-stage');
    expect(css).toContain("radial-gradient(125% 190% at 18% 10%");
    expect(css).toContain("rgba(55, 29, 10, 0.82)");
    expect(css).toContain("rgba(205, 145, 65, 0.58)");
    expect(css).toContain('font-family: "Lato", "Segoe UI", Arial, sans-serif;');
    expect(css).toContain("border-radius: 0.625rem !important;");
    expect(css).not.toMatch(/\.btn-stage[^}]*backdrop-filter/);
    expect(controls.match(/var\(--stage-height\)\*0\.225/g)).toHaveLength(2);
    expect(controls.match(/var\(--stage-height\)\*0\.203/g)).toHaveLength(2);
    expect(controls.match(/grid-cols-2/g)).toHaveLength(2);
  });

  it("keeps all four semantic controls and their state handlers unchanged", () => {
    expect(controls).toContain('label={running ? "Stop" : "Start"}');
    expect(controls).toContain("onClick={onStopStart}");
    expect(controls).toContain("onClick={onToggleMic}");
    expect(controls).toContain("onClick={onToggleQuiet}");
    expect(controls).toContain("onClick={onGallery ?? (() => {})}");
    for (const id of ["start", "gallery", "mute", "quiet"]) {
      expect(controls).toContain(`controlId="${id}"`);
    }
  });

  it("keeps both label owners on the shared base and the CSS size authority", () => {
    // The Tailwind base is the fallback only; --stage-control-label-size owns
    // the painted size (16.5px phone, 22.44px tablet/desktop, measured).
    expect(controls).toContain('"text-[12px] sm:text-[14px] leading-none uppercase tracking-[0.14em]');
    expect(controls).toContain('"text-[12px] sm:text-[14px] leading-none uppercase tracking-[0.1em]');
    expect(css).toContain("font-size: var(--stage-control-label-size);");
    expect(css).toContain("--aiasap-idle-control-label: 20.4px;");
  });
});
