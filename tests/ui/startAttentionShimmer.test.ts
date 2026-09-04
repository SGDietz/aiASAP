import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("START-only attention shimmer", () => {
  it("marks only the normal non-running, non-dormant compact START control", () => {
    const controls = source("src/components/StageControls.tsx");
    expect(controls).toContain('data-start-cta-attention={mobileStartControls && startupStartReady && !running && !dormant ? "1" : undefined}');
    expect(controls).toContain("disabled={dormant || disabledStopStart}");
    expect(controls).not.toContain("disabled={dormant || disabledStopStart || !startupStartReady}");
    expect(controls).not.toContain('data-stage-control-placeholder="start"');
    expect(controls).toContain('label={running ? "Stop" : "Start"}');
    expect(controls).toContain('data-mobile-start-controls={mobileStartControls ? "1" : undefined}');
  });

  it("uses the one shared idle render for initial START and returned START after either stop path", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    expect(demo).toContain("const showsSharedIdle = showsInitialIdle || showsReturnedIdle;");
    expect(demo).toContain("if (showsSharedIdle) {");
    const idle = demo.slice(demo.indexOf("if (showsSharedIdle)"), demo.indexOf("// VOICE ONLY"));
    expect(idle).toContain("mobileStartControls");
    expect(idle).toContain("showsReturnedIdle");
    expect(idle).toContain("startupStartReady={showsInitialIdle || isClientReady}");
    expect(demo).toContain("const handlePause = () => {");
    expect(demo).toContain("setPausedOnStage(true);");
    // The physical STOP control and the genuine spoken-stop callback both use
    // handlePause, which sets pausedOnStage and therefore returns to this one
    // shared idle render (and restarts its animation instance).
    expect(demo).toContain("onPause={handlePause}");
  });

  it("keeps the transparent START face while animating only its bounded icon and word ink", () => {
    const css = source("app/globals.css");
    const startRuleIndex = css.indexOf('/* Initial and returned START share one explicit marker.');
    const startRule = css.slice(
      startRuleIndex,
      css.indexOf('[data-six-loading-mark="1"] {', startRuleIndex),
    );
    expect(startRule).toContain('[data-stage-controls="1"][data-start-cta-attention="1"] [data-stage-control="start"]');
    expect(startRule).toContain('animation: six-start-icon-invite 4s linear infinite;');
    expect(startRule).toContain('animation: six-start-word-invite 4s linear infinite;');
    expect(startRule).toContain('@keyframes six-start-icon-invite');
    expect(startRule).toContain('transform: translate3d(2px, -0.75px, 0) scale(1.14);');
    expect(startRule).toContain('@keyframes six-start-word-invite');
    expect(startRule).toContain('transform: translate3d(0, -1px, 0) scale(1.09);');
    expect(startRule.match(/animation-timing-function: cubic-bezier\(0\.42, 0, 1, 1\);/g)).toHaveLength(2);
    expect(startRule.match(/animation-timing-function: cubic-bezier\(0, 0, 0\.58, 1\);/g)).toHaveLength(2);
    expect(startRule).toMatch(/@keyframes six-start-icon-invite[\s\S]*?0% \{[\s\S]*?cubic-bezier\(0\.42, 0, 1, 1\)[\s\S]*?50% \{[\s\S]*?cubic-bezier\(0, 0, 0\.58, 1\)/);
    expect(startRule).toMatch(/@keyframes six-start-word-invite[\s\S]*?0% \{[\s\S]*?cubic-bezier\(0\.42, 0, 1, 1\)[\s\S]*?50% \{[\s\S]*?cubic-bezier\(0, 0, 0\.58, 1\)/);
    expect(startRule).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?data-start-cta-attention="1"[\s\S]*?data-stage-control="start"[\s\S]*?animation: none;[\s\S]*?will-change: auto;/);
    expect(startRule).toContain("filter: drop-shadow(0 1px 1.5px rgba(58, 33, 8, 0.55));");
    expect(startRule).toContain("text-shadow: 0 1px 1.5px rgba(58, 33, 8, 0.55);");
    expect(startRule).not.toMatch(/background(?:-image)?:|box-shadow:|::before|::after|content:/);
    expect(startRule).not.toMatch(/(?:^|\s)(?:color|-webkit-text-fill-color|border-color):/m);
    expect(startRule).not.toMatch(/rotate|width|height|margin|padding|top:|left:|right:|bottom:/);
    expect(startRule).not.toMatch(/\.btn-stage\s*\{[\s\S]*?(?:transform|animation):/);
    expect(startRule).not.toContain('data-stage-control="mute"');
    expect(startRule).not.toContain('data-stage-control="quiet"');
    expect(startRule).not.toContain('data-stage-control="gallery"');
  });
});
