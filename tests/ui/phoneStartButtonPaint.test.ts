import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("cross-device avatar control paint", () => {
  const css = source("app/globals.css");
  const controls = source("src/components/StageControls.tsx");
  const marker = "/* AVATAR STAGE CONTROLS — shared floating icon/label visual language.";
  const rules = css.slice(css.indexOf(marker));

  it("owns every StageControls state and breakpoint without a decorative face", () => {
    expect(css.indexOf(marker)).toBeGreaterThan(-1);
    expect(rules).toContain('[data-stage-controls="1"].stage-controls-cluster');
    expect(rules).toContain(':where([data-stage-controls="1"]) .btn-stage,');
    expect(rules).toContain(':where([data-stage-controls="1"]) .btn-stage:disabled,');
    expect(rules).toContain(':where([data-stage-controls="1"]) .btn-stage:hover:not(:disabled)');
    expect(rules).toContain("background: transparent;");
    expect(rules).toContain("border: 0;");
    expect(rules).toContain("border-radius: 0 !important;");
    expect(rules).toContain("box-shadow: none;");
    expect(rules).not.toMatch(/linear-gradient|radial-gradient|glow|inset/);
  });

  it("uses outlined warm icons and one solid bronze label authority", () => {
    expect(rules).toContain("filter: drop-shadow(0 1px 1.5px rgba(58, 33, 8, 0.55));");
    expect(rules).toContain('[data-stage-control-label="1"]');
    expect(rules).toContain("color: rgb(215, 160, 90);");
    expect(rules).toContain("-webkit-text-fill-color: rgb(215, 160, 90);");
    expect(controls).not.toContain("bg-gradient-to-b");
    expect(controls).not.toContain("bg-clip-text");
    expect(controls).toContain('fill-none sm:h-[30.8px]');
  });

  it("keeps initial START enabled while preserving true dormant disabled states", () => {
    expect(rules).toMatch(/\.btn-stage:disabled\s*\{\s*opacity: 1;/);
    expect(controls).toContain("disabled={disabled}");
    expect(controls).toContain("disabled={dormant || disabledStopStart}");
    expect(controls).not.toContain("disabled={dormant || disabledStopStart || !startupStartReady}");
    expect(controls).toContain("disabled={dormant || !running}");
    expect(controls).toContain("disabled={dormant || !onGallery}");
  });

  it("preserves the accepted phone-idle field and carries its four-pixel shift", () => {
    expect(controls).toContain('"h-[150px] w-[220px] grid-rows-2 gap-0');
    expect(controls).toContain('mobileStartControls ? "h-full w-full gap-0"');
    expect(rules).toMatch(/data-mobile-start-controls[\s\S]*?gallery[\s\S]*?quiet[\s\S]*?translateX\(4px\)/);
    expect(rules.match(/translateX\(4px\)/g)).toHaveLength(1);
    expect(controls).toContain('data-mobile-start-controls={mobileStartControls ? "1" : undefined}');
    expect(css).toContain('[data-stage-controls="1"]:not([data-mobile-start-controls="1"]) [data-stage-control="gallery"]');
    expect(css).toContain("transform: translateY(-20.390625px);");
  });

  it("renders solid labels both inside the phone cells and outside at md+", () => {
    expect(controls).toMatch(/data-stage-control-label="1"\s*className=\{MOBILE_START_LABEL\}/);
    expect(controls).toContain('className={`${LABEL} ${mobileStartControls ? "hidden" : ""}`}');
    expect(controls.match(/data-stage-control-label="1"/g)).toHaveLength(2);
  });

  it("routes all known lifecycle surfaces through the shared owner", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    const voice = source("src/components/VoiceOnlyStage.tsx");
    expect((demo.match(/<StageControls/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(demo).not.toContain("<DormantStageControls />");
    expect(session).not.toContain("<DormantStageControls />");
    expect(session).toContain("<StageControls");
    expect(session).toContain("data-six-active-stage={");
    expect(voice).toContain("<StageControls");
  });

  it("keeps the avatar reserve fixed while shortening and centering legal", () => {
    const footer = source("src/components/StageLegalFooter.tsx");
    expect(css).toContain("--aiasap-phone-legal-reserve: 55px;");
    expect(css).toContain("transparent 0 20.35px");
    expect(css).toContain("#241608 20.35px");
    expect(css).toContain("@media (max-width: 599px)");
    expect(css).toContain("--six-loading-mark-size: min(102.64vw, 49.894svh);");
    expect(css).toContain("width: var(--six-loading-mark-size);");
    expect(css).toContain("height: var(--six-loading-mark-size);");
    expect(css).toContain("height: 17.71px;");
    expect(css).toContain("bottom: 8.47px;");
    expect(css).toContain("margin-top: 0;");
    expect(css).toContain("flex: 0 0 55px;");
    expect(css).toContain("padding-bottom: 12px;");
    expect(css).toContain('[data-stage-legal-line="1"] {');
    expect(css).toContain("opacity: 0.6;");
    expect(footer).toContain("opacity-[0.6] hover:opacity-60");
    expect(footer).toContain('data-phone-flow={phoneFlow ? "1" : undefined}');
    expect(footer).toContain('const ink = "text-[#d7a05a]"');
    expect(footer).not.toContain("bg-clip-text");
    expect(footer).toContain('href="/legal"');
  });

  it("uses a badge-only accessible loading transition", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    const loading = source("src/components/SixLoadingIndicator.tsx");
    const loadingBranch = demo.slice(
      demo.indexOf("if (!sessionToken && hasTappedToStart"),
      demo.indexOf("// One literal idle render"),
    );
    expect(demo).toContain('data-six-loading-only="1"');
    expect(session).toContain('data-six-loading-only="1"');
    expect(loadingBranch).not.toContain("<DormantStageControls");
    expect(loadingBranch).not.toContain("aiasap-brand-lockup");
    expect(loading).toContain('role="status"');
    expect(loading).toContain('aria-label="Loading"');
    expect(loading).toContain('href="/aiasap-app-icon.png"');
    expect(loading).not.toContain(">\n        Loading\n");
    expect(session).toContain("isPhoneLifecycleViewport && !hasRenderableAvatarFrame");
    expect(session).toContain('window.matchMedia("(max-width: 599px)")');
    expect(session).toContain("onLoadedData={(event) => attemptAvatarVideoPlayback(event.currentTarget)}");
    expect(session).toContain("onCanPlay={(event) => attemptAvatarVideoPlayback(event.currentTarget)}");
    expect(session).toContain("onPlaying={(event) => requestRenderableAvatarFrame(event.currentTarget)}");
    expect(session).toContain("metadata.presentedFrames > 0");
  });
});
