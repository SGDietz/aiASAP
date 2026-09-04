import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("truthful START readiness", () => {
  it("server-renders still Six with visible enabled START owned by the parser-time bridge", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const controls = source("src/components/StageControls.tsx");
    const layout = source("app/layout.tsx");
    expect(demo).toContain("const [isClientReady, setIsClientReady] = useState(false);");
    expect(demo).toContain("window.__AIASAP_EARLY_START__.reactReady = true;");
    expect(demo).not.toContain("if (!isClientReady) {");
    expect(demo).toContain('<StageBrandLockup />');
    expect(demo).toContain('src="/startscreen-noband.png"');
    expect(demo).toContain('<StageLegalFooter phoneFlow phoneStackPaddingBottom="12px"');
    expect(demo).toContain('data-six-startup-readiness={isClientReady ? "ready" : "pending"}');
    expect(demo).toContain("startupStartReady={showsInitialIdle || isClientReady}");
    expect(controls).not.toContain('data-stage-control-placeholder="start"');
    expect(controls).toContain('label={running ? "Stop" : "Start"}');
    expect(controls).toContain("disabled={dormant || disabledStopStart}");
    expect(controls).toContain('data-aiasap-early-start={earlyStartBridge ? "1" : undefined}');
    expect(layout).toContain('id="aiasap-early-start-bridge"');
    expect(layout).toContain("dangerouslySetInnerHTML");
  });

  it("paints initial attention with the parser-owned START and never replays an early tap", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const controls = source("src/components/StageControls.tsx");
    const readinessEffect = demo.slice(
      demo.indexOf("useLayoutEffect(() => {\n    if (window.__AIASAP_EARLY_START__)"),
      demo.indexOf("useEffect(() => {\n    if (!hasTappedToStart)"),
    );
    expect(readinessEffect).not.toMatch(/beginSessionFromStart|click|pointer/);
    expect(demo).toContain("startupStartReady={showsInitialIdle || isClientReady}");
    expect(controls).toContain('data-start-cta-attention={mobileStartControls && startupStartReady && !running && !dormant ? "1" : undefined}');
    expect(controls).toContain("startupStartReady = true");
    expect(controls).not.toMatch(/startupStartReady\s*\?\s*\(/);
    expect(source("src/lib/voice/earlyStartBridge.ts")).not.toMatch(/dispatchEvent|\.click\(/);
  });

  it("keeps LOADING exclusively after START begins the session", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const afterStart = demo.slice(
      demo.indexOf("if (!sessionToken && hasTappedToStart"),
      demo.indexOf("// One literal idle render"),
    );
    expect(afterStart).toContain("<SixLoadingIndicator />");
    expect(afterStart).toContain('data-six-loading-only="1"');
    expect(afterStart).not.toContain("startupStartReady");
  });

  it("prelays the parser loader with the final opaque loading field and no intermediate flash", () => {
    const layout = source("app/layout.tsx");
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    const css = source("app/globals.css");
    expect(layout).toMatch(/\[data-six-early-start-loader\] \{[\s\S]*?display: flex;[\s\S]*?visibility: hidden;[\s\S]*?opacity: 0;/);
    expect(layout).toContain('data-six-initial-idle] > :not([data-six-stage-media="1"])');
    expect(layout).toMatch(/data-six-stage-media="1"\]\) \{[\s\S]*?visibility: hidden;/);
    expect(layout).toMatch(/data-aiasap-early-start-state="loading"\] \[data-six-early-start-loader\] \{[\s\S]*?visibility: visible;[\s\S]*?opacity: 1;/);
    expect(layout).not.toMatch(/data-six-(?:initial-idle|early-start-loader)[^}]*display: none/);
    expect(layout).not.toMatch(/data-six-early-start-loader[^}]*transition:/);
    expect(layout).toMatch(/\[data-six-early-start-loader\] \{[\s\S]*?background: #1f1005;/);
    expect(css).toMatch(/\[data-six-loading-only="1"\],[\s\S]*?\[data-six-early-start-loader\],[\s\S]*?background: #1f1005;/);
    expect(demo).toContain('data-six-loading-continuity-scene="1"');
    expect(demo).toContain('src="/startscreen-noband.png"');
    expect(demo).toMatch(/data-six-loading-only="1"[\s\S]*?bg-transparent/);
    expect(demo).toMatch(/data-six-early-start-loader="1"[\s\S]*?bg-transparent/);
    expect(session).toMatch(/data-six-loading-only="1"[\s\S]*?bg-transparent/);
    expect(session).toContain('poster="/startscreen-noband.png"');
  });

  it("ships the session owner in the initial graph without mounting it before a token", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    expect(demo).toContain('import { LiveAvatarSession } from "./LiveAvatarSession";');
    expect(demo).not.toContain('import dynamic from "next/dynamic";');
    expect(demo).not.toContain('import("./LiveAvatarSession")');
    expect(demo).not.toContain("loadLiveAvatarSessionRuntime");
    expect(demo).not.toContain("preloadLiveAvatarSessionRuntime");
    expect(demo).toMatch(/return \(\s*<LiveAvatarSession[\s\S]*?mode=\{mode\}[\s\S]*?sessionAccessToken=\{sessionToken\}/);
    expect(demo).toMatch(/if \(!sessionToken\)[\s\S]*return \(\s*<LiveAvatarSession/);
  });

  it("marks the statically available owner before React adoption and carries both into a later tap", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const timing = source("src/lib/voice/startupTiming.ts");
    const ownerReady = demo.indexOf('markStartupTiming("session_chunk_complete", window)');
    const component = demo.indexOf("export const LiveAvatarDemo");
    const adoption = demo.indexOf('markStartupTiming("react_adopted")');

    expect(ownerReady).toBeGreaterThan(-1);
    expect(ownerReady).toBeLessThan(component);
    expect(ownerReady).toBeLessThan(adoption);
    expect(timing).toContain("const priorMarks = getRecord(scope).marks;");
    expect(timing).toContain("if (priorMarks.session_chunk_complete)");
    expect(timing).toContain("record.marks.session_chunk_complete = priorMarks.session_chunk_complete;");
    expect(timing).toContain("if (priorMarks.react_adopted)");
  });

  it("does not create a startup attempt for a still-blocked recovery re-tap", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const start = demo.slice(
      demo.indexOf("const beginSessionFromStart"),
      demo.indexOf("const adoptEarlyStart"),
    );

    expect(start.indexOf("beginStartupTiming();")).toBeGreaterThan(
      start.indexOf("if (micBlockedRef.current)"),
    );
    expect(start.indexOf("beginStartupTiming();")).toBeLessThan(
      start.indexOf("requestMicrophonePermission(navigator)"),
    );
  });

  it("keeps page load, denial, and cancellation free of session mount/provider work", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const start = demo.slice(
      demo.indexOf("const beginSessionFromStart"),
      demo.indexOf("const adoptEarlyStart"),
    );
    const returnedStart = start.slice(
      start.indexOf("if (fromStopped) {"),
      start.indexOf("// Initial START keeps"),
    );
    const initialStart = start.slice(
      start.indexOf("// Initial START keeps"),
    );
    // Static module availability executes no component effects. The existing
    // token branch remains the only route to mounting LiveAvatarSession, while
    // the normal START branches still reject denial before mint/token commit.
    expect(demo).not.toContain('import("./LiveAvatarSession")');
    expect(demo).not.toContain("preloadLiveAvatarSessionRuntime");
    expect(demo).toMatch(/if \(!sessionToken\)[\s\S]*return \(\s*<LiveAvatarSession/);

    expect(start.match(/permission !== "granted"/g)).toHaveLength(2);
    for (const branch of [returnedStart, initialStart]) {
      expect(branch).toMatch(/if \(permission !== "granted"\) \{[\s\S]*?return;/);
      expect(branch.indexOf('if (permission !== "granted")')).toBeLessThan(
        branch.indexOf("startSession({"),
      );
    }
  });

  it("records every latency boundary without weakening first-frame truth", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    const timing = source("src/lib/voice/startupTiming.ts");
    for (const point of [
      "tap",
      "microphone_granted",
      "react_adopted",
      "session_chunk_complete",
      "mint_complete",
      "provider_start",
      "provider_end",
      "connected",
      "live_track",
      "first_presented_frame",
      "greeting_dispatch",
      "greeting_speak",
    ]) {
      expect(timing).toContain(`"${point}"`);
    }
    expect(demo).toContain("installStartupResourceTimingObserver()");
    expect(session).toContain('markStartupTiming("first_presented_frame")');
    expect(session.indexOf('markStartupTiming("live_track")')).toBeLessThan(
      session.indexOf("requestVideoFrameCallback((_now, metadata)"),
    );
    expect(session.indexOf('markStartupTiming("first_presented_frame")')).toBeGreaterThan(
      session.indexOf("metadata.presentedFrames > 0"),
    );
    const presentedCallback = session.slice(
      session.indexOf("requestVideoFrameCallback((_now, metadata)"),
      session.indexOf("const attemptAvatarVideoPlayback"),
    );
    expect(presentedCallback).toContain('markStartupTiming("live_track")');
    expect(presentedCallback.indexOf('markStartupTiming("live_track")')).toBeLessThan(
      presentedCallback.indexOf('markStartupTiming("first_presented_frame")'),
    );
    expect(presentedCallback.indexOf('markStartupTiming("live_track")')).toBeLessThan(
      presentedCallback.indexOf("metadata.presentedFrames > 0"),
    );
  });
});
