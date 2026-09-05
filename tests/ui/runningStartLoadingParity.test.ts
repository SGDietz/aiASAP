import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("START/RUNNING literal visual reuse and universal Loading", () => {
  it("routes RUNNING through the accepted START controls without changing callbacks", () => {
    const session = source("src/components/LiveAvatarSession.tsx");
    const active = session.slice(session.indexOf("<StageControls", session.indexOf("data-six-active-stage")));
    expect(active).toContain("mobileStartControls");
    expect(active).toContain('control: "stop"');
    expect(active).toContain("handleEndSessionRef.current?.({ pause: true })");
    expect(active).toContain("disabledStopStart={sessionState !== SessionState.CONNECTED || !isStreamReady}");
    expect(active).toContain("onToggleMic");
    expect(active).toContain("onToggleQuiet");
    expect(active).toContain("onGallery");
  });

  it("reuses the restored tagline-era brand lockup in RUNNING", () => {
    const session = source("src/components/LiveAvatarSession.tsx");
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const lockup = source("src/components/StageBrandLockup.tsx");
    const loadingCopy = source("src/components/TaglineText.tsx");
    const css = source("app/globals.css");
    expect(session).not.toContain("aiasap-tablet-live-tagline");
    expect(session).toContain("<StageBrandLockup>");
    expect(demo.match(/<StageBrandLockup \/>/g)).toHaveLength(4);
    expect(demo).not.toContain("TaglineText");
    expect(lockup).toContain("TaglineText");
    expect(lockup).toContain("aiasap-tablet-idle-tagline");
    expect(lockup).toContain("text-[calc(var(--stage-width)*0.10)]");
    expect(lockup).toContain("drop-shadow-[0_1px_6px_rgba(25,15,5,0.4)]");
    // G, 2026-09-04, SEVENTH revision and the current one, typed word for
    // word: "Beautiful Brilliant Cheap > Autopilot". The arrow is back in the
    // connector's slot. (TaglineText.tsx carries the history of the six
    // before it.)
    expect(loadingCopy).toContain("Beautiful Brilliant Cheap &gt; Autopilot");
    expect(loadingCopy).toContain("export function LoadingText");
    expect(css).toContain("font-size: calc(var(--stage-width) * 0.1045)");
    expect(css).toContain("transform: skewX(-8deg) scaleX(0.94);");
    const activeBrand = session.slice(
      session.indexOf("{/* Text overlays"),
      session.indexOf("{/* Full screen video */"),
    );
    expect(activeBrand).not.toContain("drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)]");
    expect(session).toContain('phoneStackPaddingBottom="12px"');
    expect(session).toContain('placementClassName="aiasap-tablet-idle-legal md:absolute md:bottom-2 md:left-1/2 md:-translate-x-1/2"');
    expect(css).toContain('[data-six-active-stage="1"] .aiasap-brand-lockup');
    const activeBrandCss = css.slice(
      css.indexOf('[data-six-initial-idle="1"] .aiasap-brand-lockup'),
      css.indexOf('[data-six-initial-idle="1"] [data-stage-controls="1"]'),
    );
    expect(activeBrandCss).not.toContain("translateY(-2px)");
  });

  it("installs the selected C2 treatment once while preserving badge responsiveness", () => {
    const loader = source("src/components/SixLoadingIndicator.tsx");
    const css = source("app/globals.css");
    expect(css).toContain("--six-loading-mark-size: min(102.64vw, 49.894svh);");
    expect(css).toMatch(/data-six-loading-label="1"[\s\S]*?width: 146\.25px;[\s\S]*?text-transform: uppercase;/);
    expect(css).not.toContain("480px");
    expect(loader).toContain('aria-label="Loading"');
    expect(loader).toContain('data-six-loading-label="1"');
    expect(loader).not.toContain('className="hidden w-[146.25px]');
    expect(loader).not.toContain("md:tracking-");
    expect(loader).not.toContain("xl:tracking-");
    expect(loader).not.toContain("font-bold leading-none");
    expect(loader).toContain('aria-hidden="true"');
    expect(loader).toContain("<LoadingText />");
    expect(loader).toContain('width: "var(--six-loading-mark-size, 249.6px)"');
    expect(loader).toContain('data-six-loading-rim="1"');
    expect(loader).toContain('x="76.42"');
    expect(loader).toContain('width="359.16"');
    expect(loader).toContain('height="492"');
    expect(loader).toContain('href="/aiasap-app-icon.png"');
  });

  it("fits complete selected ink to the responsive C2 widths", () => {
    const loader = source("src/components/SixLoadingIndicator.tsx");
    expect(loader).toContain("const labelRef = useRef<HTMLSpanElement>(null)");
    expect(loader).toContain("const targetWidth = label.getBoundingClientRect().width");
    expect(loader).toContain("observer.observe(label)");
    expect(loader).toContain("targetWidth / naturalWidth");
    expect(loader).toContain('data-six-loading-ink="1"');
  });

  it("matches C2 typography, paint, ratio, and rim gap", () => {
    const css = source("app/globals.css");
    const loader = source("src/components/SixLoadingIndicator.tsx");
    expect(loader).toContain("<LoadingText />");
    expect(loader).toContain("from-[#ffe9c2] via-[#d7a05a] to-[#8c5f30]");
    expect(source("src/components/TaglineText.tsx")).toContain('text-[0.9725em]');
    expect(css).toMatch(/data-six-loading-ink="1"[\s\S]*?font-family: "Archivo Black", "Arial Black", Impact, sans-serif;[\s\S]*?font-weight: 900;[\s\S]*?letter-spacing: 0\.1em;[\s\S]*?line-height: 1;[\s\S]*?overflow: visible;/);
    expect(css).toMatch(/data-six-loading-indicator="1"[\s\S]*?gap: 1\.75svh;/);
    expect(css).toContain("width: 292.5px;");
  });

  it("has no responsive utility competitor on the shared START/RUNNING branch", () => {
    const controls = source("src/components/StageControls.tsx");
    expect(controls).not.toContain("md:h-auto md:w-auto");
    expect(controls).not.toContain("md:grid-rows-none");
    expect(controls).not.toContain("md:flex-row");
    expect(controls).not.toContain("md:hidden");
    expect(controls).not.toContain("sm:h-[33px]");
    expect(controls.match(/grid grid-cols-2 grid-rows-2 gap-x-\[6px\] gap-y-\[6px\]/g)).toHaveLength(2);
  });

  it("keeps one visible inline label owner and exact top/bottom row latitude pairing", () => {
    const controls = source("src/components/StageControls.tsx");
    const css = source("app/globals.css");
    const btnOwner = controls.slice(
      controls.indexOf("function Btn("),
      controls.indexOf("export function StageControls"),
    );
    expect(btnOwner.match(/data-stage-control-inline-label="1"/g)).toHaveLength(1);
    expect(btnOwner.match(/data-stage-control-label="1"/g)).toHaveLength(1);
    expect(btnOwner).toContain("className={INLINE_LABEL}");
    expect(controls).toMatch(/controlId="start"[\s\S]*?className="order-1"/);
    expect(controls).toMatch(/controlId="gallery"[\s\S]*?className="order-2"/);
    expect(controls).toMatch(/controlId="mute"[\s\S]*?className="order-3"/);
    expect(controls).toMatch(/controlId="quiet"[\s\S]*?className="order-4"/);
    expect(css).not.toContain(':not([data-mobile-start-controls="1"]) [data-stage-control="start"] [data-stage-control-label="1"]');
    expect(css).not.toContain(':not([data-mobile-start-controls="1"]) [data-stage-control="mute"] [data-stage-control-label="1"]');
  });

  it("overlays the phone RUNNING footer so START owns its exact visible paint", () => {
    const css = source("app/globals.css");
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    expect(demo).toContain('data-six-stage-media="1"');
    expect(session).toContain('data-six-stage-media="1"');
    expect(session).toContain("h-[100svh]");
    expect(session).toContain('className="aiasap-tablet-idle-stage fixed inset-0');
    expect(session).toContain("[--stage-height:100svh]");
    expect(session).toContain("md:[--stage-height:94vh]");
    expect(session).toContain("md:object-top");
    expect(session).toContain("md:shadow-[0_0_0_1px_rgba(215,160,90,0.45),0_30px_90px_rgba(0,0,0,0.72)]");
    expect(session).not.toContain("object-position:center_72%");
    expect(css).toMatch(
      /\[data-six-active-stage="1"\] > \[data-six-stage-media="1"\] \{[\s\S]*?flex: 0 0 auto;[\s\S]*?height: calc\(100svh - 34\.65px\);/,
    );
    expect(css).toMatch(
      /@media \(max-width: 599px\)[\s\S]*?\[data-six-active-stage="1"\] > \[data-phone-bottom-stack="1"\]\[data-phone-flow="1"\] \{[\s\S]*?position: absolute;[\s\S]*?left: 0;[\s\S]*?right: 0;[\s\S]*?bottom: 0;/,
    );
    expect(css).toContain("transparent 0 20.35px");
    expect(css).toContain("#241608 20.35px");
    expect(css).toContain("bottom: 8.47px;");
  });

  it("keeps the accepted cluster fixed while matching RUNNING's phone anchor", () => {
    const css = source("app/globals.css");
    expect(css).toMatch(
      /\[data-six-initial-idle="1"\] \[data-stage-controls="1"\]\.stage-controls-cluster,\s*\[data-six-active-stage="1"\] \[data-stage-controls="1"\]\.stage-controls-cluster \{\s*transform: translateX\(-50%\);/,
    );
  });
});
