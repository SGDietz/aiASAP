import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("smoke-stage presentation contract", () => {
  it("renders the four MVP controls after STOP with Gallery visible and disabled", () => {
    const controls = source("src/components/StageControls.tsx");
    expect(controls).toContain('label={running ? "Stop" : "Start"}');
    for (const label of ["Mute", "Quiet", "Gallery"]) {
      expect(controls).toContain(`label="${label}"`);
    }
    expect(controls).not.toContain('controlId="voice"');
    expect(controls).not.toContain('label="Voice"');
    expect(controls).not.toContain("onVoiceOnly");
    expect(controls).toContain('label="Gallery"');
    expect(controls).toContain("onClick={onGallery ?? (() => {})}");
    expect(controls).toContain("disabled={dormant || !onGallery}");
    const demo = source("src/components/LiveAvatarDemo.tsx");
    expect(demo).toContain("? handleStartFromStopped");
    expect(demo).toContain(": () => void beginSessionFromStart()");
  });

  it("uses brand-colored STOP/START glyphs without moving the control row", () => {
    const controls = source("src/components/StageControls.tsx");
    // G's four sheet glyphs, 2026-09-04: compass / flourish / mic / feather.
    expect(controls).toMatch(/label=\{running \? "Stop" : "Start"\}[\s\S]*?<CompassRoseIcon \/>/);
    expect(controls).toContain("<FlourishIcon />");
    expect(controls).toContain("<VintageMicIcon />");
    expect(controls).toContain("<FeatherWaveIcon />");
    expect(controls).not.toContain("<Square");
    expect(controls).not.toContain("<Play");
    expect(controls).toContain("var(--stage-height)*0.225");
    expect(controls).toContain("var(--stage-height)*0.203");
    expect(controls).toContain(
      "grid grid-cols-2 grid-rows-2 gap-x-[6px] gap-y-[6px]",
    );
  });

  it("restores the prior tagline-era brand geometry with the exact new copy", () => {
    const loadingCopy = source("src/components/TaglineText.tsx");
    const lockup = source("src/components/StageBrandLockup.tsx");
    expect(loadingCopy).toContain("Beautiful Brilliant Cheap Autopilot");
    expect(loadingCopy).toContain('className="text-[1.167em]"');
    expect(loadingCopy).toContain('<Initial>L</Initial><LoadingRest>OADING<span data-six-loading-phone-dots="1">...</span></LoadingRest>');
    expect(lockup).toContain("<TaglineText />");
    expect(lockup).toContain("aiasap-tablet-idle-tagline");
    expect(lockup).toContain("text-[calc(var(--stage-width)*0.10)]");
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    const css = source("app/globals.css");
    expect(css).toContain("font-size: calc(var(--stage-width) * 0.1045)");
    expect(lockup).toContain("top-3 z-10");
    expect(demo).not.toContain("top-5 z-10");
    expect(demo).not.toContain("top-4 z-10");
    expect(demo).not.toContain("top-[-0.25rem]");
    expect(demo.match(/<StageBrandLockup \/>/g)).toHaveLength(4);
    expect(demo).not.toContain("TaglineText");
    expect(demo).not.toContain("top-[calc(var(--stage-top)+var(--stage-height)*0.620)]");
    expect(demo).not.toContain("var(--stage-height)*0.78");
    expect(demo).toContain("aiasap-tablet-idle-stage relative w-full h-[100svh]");
    expect(demo).toContain("[--stage-height:100svh]");
    expect(demo).toContain("six-primary-scene absolute inset-0 h-full w-full object-cover object-top");
    expect(demo).not.toContain('data-phone-media-edge-extension="5"');
    expect(demo).toContain("<StageLegalFooter phoneFlow");
    expect(demo).toContain("md:relative md:inset-auto md:h-full md:min-h-screen");
    expect(demo).not.toContain("md:top-[calc(var(--stage-top)+var(--stage-height)*0.66)]");
    expect(session).toContain("var(--stage-height)*0.08");
    expect(session).toContain("var(--stage-height)*0.14");
  });

  it("restores the prior centered iPad composition without leaking into phone or desktop", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const css = source("app/globals.css");
    expect(demo).toContain("aiasap-tablet-idle-stage relative w-full h-[100svh]");
    expect(demo).toContain("aiasap-tablet-idle-media relative w-full flex-1");
    expect(demo).toContain("aiasap-tablet-idle-legal md:absolute md:bottom-2");
    expect(css).toContain("@media (min-width: 768px) and (max-width: 1366px) and (pointer: coarse)");
    expect(css).toContain(".aiasap-tablet-idle-media");
    expect(css).toContain("--stage-height: min(94svh, calc(100svw * 16 / 9)) !important");
    expect(css).toContain("--stage-width: calc(var(--stage-height) * 9 / 16) !important");
    expect(css).toContain("--stage-top: calc((100svh - var(--stage-height)) / 2) !important");
    expect(css).toContain("height: var(--stage-height) !important");
    expect(source("src/components/StageBrandLockup.tsx")).toContain("TaglineText");
    expect(css).toContain("top: calc(var(--stage-top) + 0.25rem) !important");
    expect(css).toContain("display: flex");
    expect(css).toContain("align-items: center");
    expect(css).toContain("justify-content: center");
    expect(css).toContain(".stage-legal-footer");
    expect(css).toContain("top: calc(var(--stage-top) + var(--stage-height) + 6px) !important");
    expect(css).toContain("bottom: auto !important");
    expect(source("src/components/StageBrandLockup.tsx")).toContain("top-3 z-10");
  });

  it("restores the prior centered desktop idle-stage authority at md+ only", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const css = source("app/globals.css");
    expect(demo).toContain(
      "aiasap-tablet-idle-media relative w-full flex-1 overflow-hidden md:flex md:items-center md:justify-center md:overflow-visible md:px-8",
    );
    expect(css).toContain("@media (min-width: 768px) and (pointer: fine)");
    expect(css).toMatch(
      /@media \(min-width: 768px\) and \(pointer: fine\)[\s\S]*?\.aiasap-tablet-idle-tagline\s*\{[\s\S]*?top: -0\.625rem;/,
    );
    expect(source("src/components/StageBrandLockup.tsx")).toContain("TaglineText");
    expect(source("src/components/StageBrandLockup.tsx")).toContain("top-3 z-10");
  });

  it("uses only explicit Start to advance idle into dormant loading", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const loadingStart = demo.indexOf("if (!sessionToken && hasTappedToStart");
    const loadingEnd = demo.indexOf("// One literal idle render", loadingStart);
    const loadingBranch = demo.slice(loadingStart, loadingEnd);
    const frontStart = demo.indexOf("if (showsSharedIdle)");
    const frontEnd = demo.indexOf('// VOICE ONLY (2026-08-21)', frontStart);
    const frontDoorBranch = demo.slice(frontStart, frontEnd);

    expect(frontDoorBranch).toContain('data-six-initial-idle="1"');
    expect(frontDoorBranch).toContain("<StageControls");
    expect(frontDoorBranch).toContain('running={false}');
    expect(frontDoorBranch).toContain("? handleStartFromStopped");
    expect(frontDoorBranch).toContain(": () => void beginSessionFromStart()");
    expect(frontDoorBranch).not.toContain("Tap/Click ANYWHERE");
    expect(frontDoorBranch).not.toContain('role="button"');
    expect(frontDoorBranch).not.toContain("onKeyDown=");
    expect(loadingBranch).toContain("<SixLoadingIndicator />");
    expect(loadingBranch).not.toContain("<StageControls");
    expect(loadingBranch).not.toContain("Tap/Click ANYWHERE");
    expect(demo).toContain("if (!hasTappedToStart) {");
    expect(demo).not.toMatch(/<LiveAvatarSession[\s\S]*\bautoStartVoice\b/);
  });

  it("renders Start, Gallery, Mute, Quiet in the required 2x2 order", () => {
    const controls = source("src/components/StageControls.tsx");
    const active = controls.slice(
      controls.indexOf("export function StageControls("),
      controls.indexOf("export function DormantStageControls()"),
    );
    expect(active).toMatch(/controlId="start"[\s\S]*?className="order-1"/);
    expect(active).toMatch(/controlId="gallery"[\s\S]*?className="order-2"/);
    expect(active).toMatch(/controlId="mute"[\s\S]*?className="order-3"/);
    expect(active).toMatch(/controlId="quiet"[\s\S]*?className="order-4"/);
    expect(controls).toContain("var(--stage-height)*0.225");
    expect(controls).toContain("var(--stage-height)*0.203");
  });

  it("locks phone and desktop/iPad control rect authorities across lifecycle states", () => {
    const controls = source("src/components/StageControls.tsx");
    const css = source("app/globals.css");
    const phoneAnchor = "bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.225-4px)]";
    const desktopAnchor = "md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203)]";
    expect(controls.match(new RegExp(phoneAnchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))).toHaveLength(2);
    expect(controls.match(new RegExp(desktopAnchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))).toHaveLength(2);
    expect(controls.match(/grid-cols-2 grid-rows-2 gap-x-\[6px\] gap-y-\[6px\]/g)).toHaveLength(2);
    expect(css).toContain("--stage-height: 100dvh");
    expect(css).toContain("--stage-bottom: 0px");
    expect(css).toContain("--stage-height: min(94vh, 80rem)");
    expect(source("src/components/LiveAvatarDemo.tsx")).toContain("[--stage-height:100svh]");
    expect(css).toContain("--stage-height: min(94svh, calc(100svw * 16 / 9)) !important");
  });

  it("centers the mobile stage, preserves the md+ media rim, and avoids media glow everywhere", () => {
    const session = source("src/components/LiveAvatarSession.tsx");
    expect(session).toContain(
      "six-primary-scene",
    );
    expect(session).not.toContain("top-[calc(var(--stage-height)*-0.05)]");
    expect(session).toContain("rounded-none border-0");
    expect(session).toContain("md:rounded-[2.25rem] md:border md:border-[#d7a05a]/40");
    expect(session).toContain("md:object-cover md:object-top");
    for (const glowAuthority of [
      "six-ring-idle",
      "six-ring-six",
      "six-ring-user",
      "six-ring-idle-breathe",
      "six-ring-pulse",
      "six-ring-pulse-user",
    ]) {
      expect(session).not.toContain(glowAuthority);
    }
    expect(session).not.toContain("shadow-[0_0_0_1px_rgba(215,160,90,0.45)]");
  });

  it("commits the mic-ready tap before awaiting the greeting", () => {
    const session = source("src/components/LiveAvatarSession.tsx");
    const start = session.indexOf("await start();", session.indexOf("const handleVoiceStartStop"));
    const ready = session.indexOf("setHasUserPressedVoiceStart(true);", start);
    const greeting = session.indexOf("await repeat(greeting, null);", start);
    expect(start).toBeGreaterThan(-1);
    expect(ready).toBeGreaterThan(start);
    expect(ready).toBeLessThan(greeting);
  });

  it("waits for an active live-stage gesture before requesting microphone permission", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    expect(demo).not.toContain("autoStartVoice");
    expect(session).not.toContain("carriedTap");
    expect(session).toContain("onClick={() => void handleVoiceStartStop({ retryMicrophone: true })}");
    const handler = session.slice(session.indexOf("const handleVoiceStartStop"));
    expect(handler.indexOf("requestMicrophonePermission(navigator)")).toBeGreaterThan(-1);
    expect(handler.indexOf("requestMicrophonePermission(navigator)")).toBeLessThan(
      handler.indexOf("await start();"),
    );
  });

  it("keeps enabled lower-row controls as opaque as Start and Voice", () => {
    const css = source("app/globals.css");
    const controls = source("src/components/StageControls.tsx");
    expect(css).toContain(".btn-stage:not(:disabled)");
    expect(css).toMatch(/\.btn-stage:not\(:disabled\)\s*\{\s*opacity:\s*1;/);
    expect(css).toMatch(/\.btn-inset:disabled\s*\{\s*opacity:\s*0\.7;/);
    expect(css).toMatch(/\.btn-stage:disabled\s*\{\s*opacity:\s*1;/);
    expect(css).toMatch(/\.btn-stage \.stage-control-icon\s*\{\s*opacity:\s*1;/);
    expect(controls).toContain('className="stage-control-icon inline-flex opacity-100"');
    expect(controls).not.toContain("disabled:opacity-40");
  });

  it("uses the current slightly enlarged shared stage-control labels", () => {
    const controls = source("src/components/StageControls.tsx");
    expect(controls).toContain('"text-[12px] sm:text-[14px] leading-none');
    expect(controls).not.toContain('"text-[10px] sm:text-[11px] leading-none');
    for (const label of ["Stop", "Start", "Mute", "Quiet", "Gallery"]) {
      expect(controls).toContain(label);
    }
    expect(controls).not.toContain('label="Voice"');
  });

  it("uses brand gold/orange for every normal and off control", () => {
    const controls = source("src/components/StageControls.tsx");
    expect(controls).not.toContain('tone === "white"');
    expect(controls).toContain('"text-[#d77a2f]"');
    expect(controls).toContain('"text-[#e0aa62]"');
    expect(controls).not.toContain("text-red-400");
    expect(controls).toContain('tone={micOff ? "off" : "brand"}');
    expect(controls).toContain('tone={quiet ? "off" : "brand"}');
  });

  it("keeps dormant voice-only source without exposing a return/voice control", () => {
    const voice = source("src/components/VoiceOnlyStage.tsx");
    const demo = source("src/components/LiveAvatarDemo.tsx");
    expect(voice).toContain("<StageControls");
    expect(voice).toContain("onStopStart={handleStopStart}");
    expect(voice).toContain("if (!runningRef.current) return;");
    expect(voice).not.toContain('voiceLabel="Avatar"');
    expect(voice).not.toContain("onVoiceOnly={onReturnAvatar}");
    expect(voice).toContain("setLocalMicOff((value) => !value)");
    expect(voice).toContain("setLocalSpeakerMuted((value) => !value)");
    expect(voice).toContain("var(--stage-height) * 0.43");
    expect(demo).toContain('if (mode !== "CUSTOM" || !avatarReturnPendingRef.current) return;');
    const returnStart = demo.indexOf("const handleReturnToAvatar");
    const returnHandler = demo.slice(
      returnStart,
      demo.indexOf("if (awaitReturnTap", returnStart),
    );
    expect(returnHandler).toContain('setMode("CUSTOM")');
    expect(returnHandler).not.toContain("startSession(");
  });

  it("keeps LOADING independent after restoring the stage tagline", () => {
    const loader = source("src/components/SixLoadingIndicator.tsx");
    const tagline = source("src/components/TaglineText.tsx");
    expect(loader).toContain("<LoadingText />");
    expect(loader).not.toContain("italic tracking-[0.01em]");
    expect(tagline).not.toContain("Gucci Look, Walmart Price.");
    expect(tagline).toContain("<Initial>L</Initial>");
    expect(tagline).toContain("OADING<span data-six-loading-phone-dots=\"1\">...</span>");
  });

  it("reports a silent avatar once without changing modes automatically", () => {
    const delivery = source("src/liveavatar/customVoiceDelivery.ts");
    const session = source("src/components/LiveAvatarSession.tsx");
    expect(delivery).toContain("failedRepeatSessions.has(failure.session)");
    // textLength added 2026-09-04 so stalls can be correlated with line
    // length from stored data instead of another ride.
    expect(delivery).toContain(
      "reportAvatarSpeechFailure({ session, where, reason, textLength: text.length })",
    );
    expect(delivery).not.toContain("void elevenLabsRescue");
    expect(session).toContain("subscribeAvatarSpeechFailure");
    expect(session).toContain('"avatar_speech_stalled"');
    const subscriberStart = session.indexOf(
      "subscribeAvatarSpeechFailure((failure)",
    );
    const failureSubscriber = session.slice(
      subscriberStart,
      session.indexOf("// FIX #2", subscriberStart),
    );
    expect(failureSubscriber).not.toContain("handleEndSessionRef.current");
    expect(failureSubscriber).not.toContain("toVoice: true");
    const interruptHandler = session.slice(
      session.indexOf("const interrupt = useCallback"),
      session.indexOf("const stopRecognition", session.indexOf("const interrupt = useCallback")),
    );
    expect(interruptHandler).toContain("cutCustomVoiceFallback();");
  });

  it("keeps the accepted phone footer flow and top branding authority across active modes", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    const voice = source("src/components/VoiceOnlyStage.tsx");
    const lockup = source("src/components/StageBrandLockup.tsx");
    expect(lockup).toContain(
      'left-0 right-0 top-3 z-10 flex flex-col items-center',
    );
    expect(session).not.toContain("top-[-0.25rem]");
    expect(session.match(/<StageLegalFooter\s+phoneFlow/g)?.length).toBe(2);
    expect(voice).toMatch(/<StageLegalFooter\s+phoneFlow/);
    expect(demo.match(/<StageLegalFooter phoneFlow/g)?.length).toBeGreaterThanOrEqual(4);
    expect(lockup).toContain(
      "top-3 z-10 flex flex-col items-center pb-1 pt-1 sm:pt-2 md:top-[calc(var(--stage-top)+0.25rem)]",
    );
  });

  it("preserves the verified STOP and loading authorities", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    expect(session).toContain(
      "void handleEndSessionRef.current?.({ pause: true });",
    );
    expect(demo).toContain("? handleStartFromStopped");
    expect(session.match(/<SixLoadingIndicator\s*\/>/g)).toHaveLength(2);
    expect(source("src/components/SixLoadingIndicator.tsx")).toContain("<LoadingText />");
    expect(session).toContain("!shouldShowLoadingSurface &&");
  });

  it("locks the exact four-control 2-by-2 grid across phone and desktop/iPad", () => {
    const controls = source("src/components/StageControls.tsx");
    const css = source("app/globals.css");
    expect(controls).toContain("grid grid-cols-2 grid-rows-2 gap-x-[6px] gap-y-[6px]");
    // G, 2026-09-04 (second pass): "take ten percent off the sides, just the
    // left right on all four boxes, all devices, just the visuals ... they're
    // just a little too big." The boxes are two equal columns of the cluster,
    // so the cluster width carries the 10% and every HEIGHT stays as approved.
    // Measured after: phone 127->114, desktop 141->127.
    expect(css).toContain("width: min(76.5vw, max(calc(var(--stage-width) * 0.549), 288px));");
    expect(controls).toContain('className={`stage-controls-cluster fixed');
    expect(controls).toContain('dormant ? "pointer-events-none" : "pointer-events-auto"');
    for (const control of ["start", "mute", "quiet", "gallery"]) {
      expect(controls).toContain(`controlId="${control}"`);
    }
    expect(controls).not.toContain('controlId="voice"');
    const activeControls = controls.slice(
      controls.indexOf("export function StageControls("),
      controls.indexOf("export function DormantStageControls()"),
    );
    expect(activeControls.match(/controlId="/g)).toHaveLength(4);
    expect(css).not.toContain('[data-stage-control="voice"]');
    expect(css).not.toContain(
      "@media (min-width: 768px) and (max-width: 1024px) and (orientation: portrait) and (pointer: coarse)",
    );
    expect(controls).toContain(
      "md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203)]",
    );
    expect(css).toContain("[data-stage-controls=\"1\"].stage-controls-cluster {");
    // G, 2026-09-04, ink on the screenshot: "move all four of the buttons
    // up ... where the mute and quiet are, move them up to where the start
    // and gallery is." One MEASURED button row: 38px phone / 54px tablet+,
    // row-gap 10px, so G then judged that too high: the move is now HALF a row on
    // tablet+ (+32) and a light nudge on phone (+16). Bottom-anchored, so
    // the whole 2x2 moves and the gap to 6's hands grows by one row.
    expect(css).toContain("bottom: calc(var(--stage-bottom) + var(--stage-height) * 0.203 + 28px) !important;");
    expect(css).not.toContain("(pointer: fine) {\n  .stage-controls-cluster");
  });
});
