import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("Six control opacity", () => {
  it("reduces the shared active and dormant clusters to 90%", () => {
    const controls = source("src/components/StageControls.tsx");

    expect(controls.match(/stage-controls-cluster[^"`]*opacity-\[0\.9\]/g)).toHaveLength(1);
    expect(controls.match(/opacity-\[0\.9\]/g)).toHaveLength(2);

    const btnOwner = controls.slice(controls.indexOf("function Btn("), controls.indexOf("export function StageControls"));
    expect(btnOwner).not.toContain("opacity-[0.9]");
    expect(btnOwner).not.toContain("opacity-90");
    expect(btnOwner).toContain("stage-control-icon inline-flex opacity-100");
  });

  it("routes idle, loading, active, and post-Stop through the shared owners", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");

    expect((demo.match(/<StageControls/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(demo).toContain("<StageControls");
    expect(session).toContain("<StageControls");
  });

  it("keeps phone and desktop/tablet geometry anchors unchanged", () => {
    const controls = source("src/components/StageControls.tsx");

    expect(controls.match(/var\(--stage-height\)\*0\.225/g)).toHaveLength(2);
    expect(controls.match(/var\(--stage-height\)\*0\.203/g)).toHaveLength(2);
    expect(controls.match(/grid-cols-2/g)).toHaveLength(2);
    expect(controls.match(/translate-y-\[4px\]/g)).toHaveLength(2);
  });

  it("keeps the complete legal text row at its accepted opacity without touching geometry or navigation", () => {
    const footer = source("src/components/StageLegalFooter.tsx");

    expect(footer.match(/opacity-\[0\.6\]/g)).toHaveLength(1);
    expect(footer).toContain(
      'className="flex -translate-y-[4px] items-center justify-center gap-[clamp(2px,0.8vw,6px)] text-[clamp(10px,2.8vw,14px)] opacity-[0.6] hover:opacity-60 md:translate-y-0 md:text-[16.5px]"',
    );
    expect(footer).toContain("stage-legal-footer ${placementClassName}");
    expect(footer).toContain('href="/your-rights"');
    expect(footer).toContain('href="/legal"');
    expect(footer).toContain("handleLegalNavigation");
    expect(footer).toContain("hover:opacity-60");
  });
});
