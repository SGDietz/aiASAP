import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const bytes = (path: string) => readFileSync(join(process.cwd(), path));
const source = (path: string) => bytes(path).toString("utf8");

describe("shared visible loading treatment", () => {
  it("uses the canonical splash mark with one visible universal Loading label", () => {
    const loader = source("src/components/SixLoadingIndicator.tsx");
    const css = source("app/globals.css");
    const loadingMotion = css.slice(
      css.indexOf("/* Continuous light chase"),
      css.indexOf('[data-six-loading-mark="1"]'),
    );
    const iconAt = loader.indexOf('data-six-loading-mark="1"');
    expect(iconAt).toBeGreaterThan(-1);
    expect(loader).toContain("<LoadingText />");
    expect(loader).not.toContain("Loading Six");
    expect(source("src/components/TaglineText.tsx")).toContain("OADING<span data-six-loading-phone-dots=\"1\">...</span>");
    expect(loader).toContain('role="status"');
    expect(loader).toContain('aria-live="polite"');
    expect(loader).toContain('aria-label="Loading"');
    expect(loader).toContain('aria-hidden="true"');
    expect(loader).toContain('href="/aiasap-app-icon.png"');
    expect(loader).toContain('viewBox="0 0 512 512"');
    expect(loader).toContain("h-52 w-52 shrink-0");
    expect(css).toContain('font-family: "Archivo Black", "Arial Black", Impact, sans-serif;');
    expect(loader).not.toContain("scale(1.3)");
    expect(css).toMatch(/data-six-loading-mark="1"[\s\S]*?width: var\(--six-loading-mark-size\);[\s\S]*?height: var\(--six-loading-mark-size\);/);
    expect(css).toMatch(/data-six-loading-mark="1"[\s\S]*?transform: none;/);
    expect(css).toMatch(
      /data-six-loading-mark="1"[\s\S]*?drop-shadow\(0 0 8px rgba\(244, 190, 86, 0\.78\)\)[\s\S]*?drop-shadow\(0 0 24px rgba\(207, 121, 34, 0\.56\)\);/,
    );
    expect(loadingMotion).toContain('six-loading-light-chase 3.2s ease-in-out infinite alternate');
    expect(loadingMotion).toContain('six-loading-focus-pulse 1.8s ease-in-out infinite');
    expect(css).toContain('linear-gradient(100deg, #bd7d35 15%, #ffe0a4 45%, #bd7d35 75%)');
    expect(css).toContain('background-size: 220% 100%;');
    expect(css).toMatch(/@keyframes six-loading-light-chase[\s\S]*?0% \{ background-position: 110% 50%; \}[\s\S]*?100% \{ background-position: -110% 50%; \}/);
    expect(css).not.toMatch(/@keyframes six-loading-light-chase[\s\S]{0,300}?(?:0%, 10%|68%, 100%)/);
    expect(css).toMatch(/@keyframes six-loading-focus-pulse[\s\S]*?opacity: 0\.9;[\s\S]*?opacity: 1;/);
    expect(css).not.toMatch(/data-six-loading-ink="1"\] \{[\s\S]*?background-image:\s*\n/);
    expect(loadingMotion).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\[data-six-loading-ink="1"\] \{[\s\S]*?animation: none;[\s\S]*?background-image: linear-gradient\(to bottom, #ffe9c2, #d7a05a, #8c5f30\);[\s\S]*?will-change: auto;/);
    expect(css).not.toMatch(/@keyframes six-loading-(?:light-chase|focus-pulse)[\s\S]{0,600}?transform:/);
    expect(loadingMotion).not.toContain('data-six-loading-mark="1"');
    expect(loader).toContain(
      "drop-shadow-[0_0_18px_rgba(215,160,90,0.24)]",
    );
    expect(css).not.toContain("width: 480px;");
    expect(css).toContain("--six-loading-mark-size: min(102.64vw, 49.894svh);");
    expect(loader).toContain('data-six-loading-rim="1"');
    expect(loader).toContain('id="six-loading-rim-interior-80"');
    expect(loader).toContain('x="78.42" y="12.5" width="355.16" height="487" rx="68"');
    expect(loader).toContain('clipPath="url(#six-loading-rim-interior-80)"');
    expect(loader).toContain('x="76.42"');
    expect(loader).toContain('width="359.16"');
    expect(loader).toContain('height="492"');
    expect(loader).toContain('stroke="#e8ad59"');
    expect(loader).toContain('strokeWidth="4"');

    const icon = bytes("app/icon.png");
    expect(icon.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(icon.readUInt32BE(16)).toBe(512);
    expect(icon.readUInt32BE(20)).toBe(512);
  });

  it("uses the audited fluid badge while preserving the exact production glyph geometry", () => {
    const loader = source("src/components/SixLoadingIndicator.tsx");
    const phoneWidth = 390;
    const phoneHeight = 844;
    const rimWidth = Math.min(phoneWidth * 0.72, phoneHeight * 0.35);
    const rimSourceWidth = 359.16;
    const rimHeight = 492;
    const phoneMark = (rimWidth * 512) / rimSourceWidth;
    const assetHash = createHash("sha256")
      .update(bytes("public/aiasap-app-icon.png"))
      .digest("hex");
    expect(rimWidth).toBeCloseTo(280.8, 10);
    expect(rimSourceWidth / rimHeight).toBeCloseTo(0.73, 10);
    expect((rimHeight / 512) * phoneMark).toBeCloseTo(384.6575, 4);
    expect(233 / rimSourceWidth).toBeCloseTo(0.6487, 4);
    expect(assetHash).toBe("093746def0cec1957602b3df7431e81675d8d18d4248ca043ddc08601587d80c");
    expect(loader).toContain('href="/aiasap-app-icon.png"');
    expect(loader).toContain('width="512"');
    expect(loader).toContain('height="512"');
    expect(loader).toContain('filter="url(#six-loading-normal-paint)"');
    expect(loader).not.toMatch(/<image[\s\S]*?transform=/);
    // The baked source stroke is centred on the old x/y=10 frame. Cropping
    // inside its 4px stroke removes every old edge before the replacement rim.
    expect(loader).toContain('y="12.5"');
    expect(loader).not.toContain('y="0" width="397.6"');
    // The exact source image stays 512x512; only the containing SVG viewport
    // changes. No slant, skew, path, font, or image-viewport transform exists.
    expect(loader).not.toMatch(/skew|rotate|font-family|<text|<path/);
    expect(loader.match(/data-six-loading-rim="1"/g)).toHaveLength(1);
    expect(loader).not.toMatch(/lightning|ray|comic|superhero/i);
  });

  it("centres the audited Pixel, 599/600 seam, and desktop geometry without clipping", () => {
    const geometry = (width: number, height: number) => {
      const badgeWidth = Math.min(width * 0.72, height * 0.35);
      const markSize = (badgeWidth * 512) / 359.16;
      const badgeHeight = (badgeWidth * 492) / 359.16;
      const labelHeight = 59.875;
      const gap = height * 0.0175;
      const rimTop =
        height / 2 - (labelHeight + gap + markSize) / 2 +
        labelHeight + gap + (10 / 512) * markSize;
      return { badgeWidth, badgeHeight, center: width / 2, rimTop, rimBottom: rimTop + badgeHeight };
    };
    const phone = geometry(390, 844);
    const seam599 = geometry(599, 844);
    const seam600 = geometry(600, 844);
    const desktop = geometry(1280, 720);
    expect(phone).toMatchObject({ badgeWidth: 280.8, center: 195 });
    expect(phone.badgeHeight).toBeCloseTo(384.6575, 4);
    expect(phone.rimTop).toBeCloseTo(266.9937, 4);
    expect(phone.rimBottom).toBeLessThan(844);
    expect(seam600.badgeWidth).toBe(seam599.badgeWidth);
    expect(seam600.rimTop).toBe(seam599.rimTop);
    expect(seam600.center - seam599.center).toBe(0.5);
    expect(desktop.badgeWidth).toBeCloseTo(252, 10);
    expect(desktop.rimTop).toBeGreaterThan(0);
    expect(desktop.rimBottom).toBeLessThan(720);

    const css = source("app/globals.css");
    expect(css).toContain("--six-loading-mark-size: min(102.64vw, 49.894svh);");
    expect(css).toContain("gap: 1.75svh;");
    expect(css).toContain("transform: none;");
    const loader = source("src/components/SixLoadingIndicator.tsx");
    expect(loader).toContain("h-52 w-52");
    expect(loader).toContain("const labelRef = useRef<HTMLSpanElement>(null)");
    expect(loader).toContain("const targetWidth = label.getBoundingClientRect().width");
    expect(loader).toContain("observer.observe(label)");
    expect(css).toContain("transform: scaleX(1.4);");
    expect(css).toContain("transform: scaleX(0.7);");
    expect(146.25 * 1.4).toBe(292.5 * 0.7);
    expect((146.25 * 1.4) / phone.badgeWidth).toBeCloseTo(0.7292, 4);
  });

  it("pins exact LOADING copy hierarchy and the approved normal paint remap", () => {
    const loader = source("src/components/SixLoadingIndicator.tsx");
    const tagline = source("src/components/TaglineText.tsx");
    const css = source("app/globals.css");
    const table = (name: string) => {
      const match = loader.match(new RegExp(`${name} =\\s*\\n?\\s*"([^"]+)"`));
      expect(match).not.toBeNull();
      return match![1].split(" ").map(Number);
    };
    const remap = (value: number, values: number[]) => {
      const position = (value / 255) * (values.length - 1);
      const lower = Math.floor(position);
      const upper = Math.min(values.length - 1, lower + 1);
      const fraction = position - lower;
      return Math.round((values[lower] + (values[upper] - values[lower]) * fraction) * 255);
    };
    const red = table("LOADING_SIX_RED_TABLE");
    const green = table("LOADING_SIX_GREEN_TABLE");
    const blue = table("LOADING_SIX_BLUE_TABLE");
    const paint = ([r, g, b]: [number, number, number]) => [
      remap(r, red), remap(g, green), remap(b, blue),
    ];

    expect(1.167 / 0.9725).toBe(1.2);
    expect(tagline).toContain('<Initial>L</Initial><LoadingRest>OADING<span data-six-loading-phone-dots="1">...</span></LoadingRest>');
    expect(paint([80, 48, 14])).toEqual([31, 16, 5]);
    expect(paint([37, 19, 6])).toEqual([31, 16, 5]);
    expect(paint([255, 233, 194])).toEqual([240, 179, 68]);
    expect(paint([158, 106, 53])).toEqual([144, 83, 30]);
    expect(css).toMatch(/\[data-six-loading-only="1"\],[\s\S]*?\[data-six-early-start-loader\],[\s\S]*?background: #1f1005;/);
    expect(loader.match(/data-six-loading-rim="1"/g)).toHaveLength(1);
    expect(loader).not.toMatch(/lightning|ray|comic|superhero/i);
  });

  it("covers every genuine rendered loader once without changing background operations", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    // One post-tap owner plus the server-rendered, CSS-hidden twin used until
    // React adopts a handled early START. The session runtime is now in the
    // initial graph, so it needs no third dynamic-import fallback loader.
    expect(demo.match(/<SixLoadingIndicator\s*\/>/g)).toHaveLength(2);
    expect(demo).toContain('data-six-early-start-loader="1"');
    expect(demo).toContain('data-six-startup-readiness={isClientReady ? "ready" : "pending"}');
    expect(demo).not.toContain('data-six-session-runtime-loading="1"');
    expect(session.match(/<SixLoadingIndicator\s*\/>/g)).toHaveLength(2);
    expect(demo).not.toContain("Loading...");
    expect(session).not.toContain("Loading...");
    expect(session).toContain("Looking online for ${topic}");
    expect(session).toContain("Analyzing");
    const fixture = source("app/codex-responsive-loading/page.tsx");
    expect(fixture).toContain('data-six-loading-surface="1"');
    expect(fixture).not.toContain('src="/startscreen-noband.png"');
    expect(fixture).not.toContain("bg-transparent");
  });

  it("keeps the loading stack isolated until the video paints a real frame", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    const loadingStart = session.indexOf("const shouldShowLoadingSurface =");
    const loadingEnd = session.indexOf("useEffect(() =>", loadingStart);
    const readinessGate = session.slice(loadingStart, loadingEnd);
    expect(readinessGate).toContain("sessionState !== SessionState.CONNECTED");
    expect(readinessGate).toContain("!isStreamReady");
    expect(readinessGate).toContain("!accountAuthChecked");
    expect(readinessGate).toContain("!isPhoneLifecycleViewport && voiceIsLoading");
    expect(readinessGate).toContain("isPhoneLifecycleViewport && !hasRenderableAvatarFrame");
    expect(readinessGate).toContain("!sessionStartError &&");
    expect(readinessGate).not.toContain("!voiceIsActive");
    expect(readinessGate).not.toContain("!isAvatarTalking");
    expect(session).toMatch(
      /\{!shouldShowLoadingSurface\s*&&[\s\S]*?<StageControls/,
    );
    const preTokenLoading = demo.slice(
      demo.indexOf('if (!sessionToken && hasTappedToStart'),
      demo.indexOf("// One literal idle render"),
    );
    expect(preTokenLoading).toContain("<SixLoadingIndicator />");
    expect(preTokenLoading).not.toContain("<DormantStageControls />");
    expect(preTokenLoading).not.toContain("Tap/Click ANYWHERE");

    const isolatedOverlay = session.slice(
      session.indexOf("{shouldShowLoadingSurface && ("),
      session.indexOf("{/* Session start error"),
    );
    expect(isolatedOverlay).toContain('data-six-loading-only="1"');
    expect(isolatedOverlay).toContain("<SixLoadingIndicator />");
    expect(isolatedOverlay).not.toMatch(/StageControls|StageLegalFooter|TaglineText|video/);
    expect(session).toContain("video.requestVideoFrameCallback");
    expect(session).toContain("metadata.presentedFrames > 0");
    expect(session).toMatch(
      /if \(typeof video\.requestVideoFrameCallback !== "function"\) \{\s*return;/,
    );
    expect(session).not.toContain("getVideoPlaybackQuality().totalVideoFrames");
    expect(session).toContain("video.videoWidth >= 2");
    expect(session).toContain("video.videoHeight >= 2");
    expect(session).toContain('track.readyState === "live" && track.enabled');
    expect(session).toContain('window.matchMedia("(max-width: 599px)").matches');
    expect(session).not.toContain('data-six-loading-frame-probe="1"');
    expect(session).not.toContain("setHasRenderableAvatarFrame(true)}");
  });

  it("retains one status announcement while exposing no loading controls", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    const loader = source("src/components/SixLoadingIndicator.tsx");
    expect(demo).not.toContain("<DormantStageControls />");
    expect(session).not.toContain("<DormantStageControls />");
    expect(loader).toContain('role="status"');
    expect(loader).toContain('aria-label="Loading"');
    expect(loader).toContain("<LoadingText />");
    expect(session).toContain("{shouldShowLoadingSurface && (");
  });

  it("keeps the branded stage header, warm surround, and legal footer around site and Six startup", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    const preTokenLoading = demo.slice(
      demo.indexOf('if (!sessionToken && hasTappedToStart'),
      demo.indexOf("// One literal idle render"),
    );
    expect(preTokenLoading).toContain('data-six-loading-continuity-scene="1"');
    expect(preTokenLoading).toContain('src="/startscreen-noband.png"');
    expect(preTokenLoading).toContain("bg-transparent");
    expect(source("app/globals.css")).toMatch(/\[data-six-loading-only="1"\],[\s\S]*?background: #1f1005;/);
    expect(preTokenLoading).not.toContain("aiASAP");
    expect(preTokenLoading).not.toContain("<TaglineText />");
    expect(preTokenLoading).toContain(
      "{error && <StageLegalFooter phoneFlow onBeforeNavigate={stopPendingStartForLegal} />}",
    );
    const badgeOnly = preTokenLoading.slice(
      preTokenLoading.indexOf("{!error && ("),
      preTokenLoading.indexOf("{error && <StageLegalFooter"),
    );
    expect(badgeOnly).not.toContain("<StageLegalFooter");
    expect(session).toContain("#5a360f_0%,#3a220c_38%,#241608_70%,#190f05_100%");
    expect(session).toContain("<StageBrandLockup>");
    expect(source("src/components/StageBrandLockup.tsx")).toContain("<TaglineText />");
    expect(session).toContain("<StageLegalFooter");
    expect(session).toContain('data-six-loading-only="1"');
    expect(session).toContain('poster="/startscreen-noband.png"');
    expect(session).not.toContain("max-h-[calc(100vh-8rem)] bg-gray-900");
  });

  it("keeps the accepted still-image phone/avatar authorities intact", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    const idle = demo.slice(demo.indexOf("if (showsSharedIdle)"), demo.indexOf("// VOICE ONLY"));
    expect(idle).not.toContain("Tap/Click ANYWHERE");
    expect(demo).toContain("six-primary-scene absolute inset-0 h-full w-full object-cover object-top");
    expect(session).toContain("six-primary-scene");
    expect(demo).not.toContain("top-[calc(var(--stage-height)*-0.05)]");
    expect(session).not.toContain("top-[calc(var(--stage-height)*-0.05)]");
    expect(demo).toContain("<StageLegalFooter phoneFlow");
    expect(session).toContain("phoneFlow");
    expect(session).toContain("md:object-top");
    expect(session).not.toContain("md:[object-position:center_72%]");
    expect(source("next.config.js")).toContain("devIndicators: false");
  });
});
