import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("exact phone-only stage offsets", () => {
  it("lowers every active and dormant control cluster by exactly 4px", () => {
    const controls = source("src/components/StageControls.tsx");
    const phone = "bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.225-4px)]";
    const desktop = "md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203)]";

    expect(controls.split(phone)).toHaveLength(3);
    expect(controls.split(desktop)).toHaveLength(3);
    expect(controls).not.toContain(
      "bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.225)]",
    );
    expect(controls.match(/opacity-100/g)).toHaveLength(3);
    expect(controls.match(/translate-y-\[4px\]/g)).toHaveLength(2);
  });

  it("keeps the shared phone lockup clear of Six's hair", () => {
    const css = source("app/globals.css");
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    const lockup = source("src/components/StageBrandLockup.tsx");
    expect(css).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.aiasap-brand-lockup\s*\{\s*transform: translateY\(-14px\);\s*\}/,
    );
    expect(demo.match(/<StageBrandLockup \/>/g)).toHaveLength(4);
    expect(lockup).toContain("aiasap-brand-lockup absolute");
    expect(session).toContain("<StageBrandLockup>");
    expect(css).toMatch(
      /\[data-six-initial-idle="1"\] \.aiasap-brand-lockup,\s*\[data-six-active-stage="1"\] \.aiasap-brand-lockup\s*\{\s*transform: translateY\(-18px\);\s*\}/,
    );
    expect(css.match(/\.aiasap-brand-lockup/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("lifts only the complete phone legal line by exactly 4px", () => {
    const footer = source("src/components/StageLegalFooter.tsx");

    expect(footer).toContain("stage-legal-footer");
    expect(footer).toContain("flex h-[29px] w-full");
    expect(footer).toContain("md:h-auto md:w-auto");
    expect(footer).toContain('phoneFlow ? "relative mt-auto" : "fixed inset-x-0 bottom-0"');
    expect(footer).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(footer.match(/opacity-100/g)).toHaveLength(2);
    expect(footer.match(/-translate-y-\[4px\]/g)).toHaveLength(1);
    expect(footer.match(/md:translate-y-0/g)).toHaveLength(1);
  });

  it("keeps the initial-idle controls authority and centers the legal line", () => {
    const css = source("app/globals.css");

    expect(css).toMatch(
      /\[data-six-initial-idle="1"\] \[data-stage-controls="1"\]\.stage-controls-cluster,\s*\[data-six-active-stage="1"\] \[data-stage-controls="1"\]\.stage-controls-cluster\s*\{\s*transform: translateX\(-50%\);\s*\}/,
    );
    expect(css).toMatch(
      /\[data-phone-bottom-stack="1"\]\[data-phone-flow="1"\] \[data-stage-legal-line="1"\]\s*\{\s*transform: none;\s*opacity: 1;\s*\}/,
    );
  });
});
