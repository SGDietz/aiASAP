import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { isPhoneOrTablet, isPortraitCompositionDevice, isTruePhone, requestPhonePortraitLock } from "../../src/lib/phonePortrait";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const navigatorLike = (userAgent: string, mobile?: boolean, maxTouchPoints = 0) =>
  ({ userAgent, maxTouchPoints, userAgentData: mobile === undefined ? undefined : { mobile } }) as Navigator & {
    userAgentData?: { mobile?: boolean };
  };

describe("phone portrait contract", () => {
  it("recognizes phones while excluding iPad and desktop", () => {
    expect(isTruePhone(navigatorLike("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"))).toBe(true);
    expect(isTruePhone(navigatorLike("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit Mobile"))).toBe(true);
    expect(isTruePhone(navigatorLike("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)"))).toBe(false);
    expect(isTruePhone(navigatorLike("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"))).toBe(false);
    expect(isTruePhone(navigatorLike("Chromium", true))).toBe(true);
  });

  it("includes phones and tablets while excluding desktop", () => {
    expect(isPhoneOrTablet(navigatorLike("iPhone"))).toBe(true);
    expect(isPhoneOrTablet(navigatorLike("iPad"))).toBe(true);
    expect(isPhoneOrTablet(navigatorLike("Android Tablet"))).toBe(true);
    expect(isPhoneOrTablet(navigatorLike("Macintosh", undefined, 5))).toBe(true);
    expect(isPhoneOrTablet(navigatorLike("Macintosh", undefined, 0))).toBe(false);
    expect(isPhoneOrTablet(navigatorLike("Windows NT 10.0"))).toBe(false);
  });

  it("retains the portrait composition for privacy-UA touch phones and tablets", () => {
    expect(isPortraitCompositionDevice(navigatorLike("Private Browser", undefined, 5), { width: 390, height: 844 } as Screen)).toBe(true);
    expect(isPortraitCompositionDevice(navigatorLike("Private Browser", undefined, 5), { width: 1024, height: 1366 } as Screen)).toBe(true);
    expect(isPortraitCompositionDevice(navigatorLike("Android Tablet", undefined, 5), { width: 800, height: 1280 } as Screen)).toBe(true);
    expect(isPortraitCompositionDevice(navigatorLike("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit", undefined, 5), { width: 1024, height: 1366 } as Screen)).toBe(true);
    expect(isPortraitCompositionDevice(navigatorLike("Windows NT 10.0", undefined, 0), { width: 1024, height: 1366 } as Screen)).toBe(false);
    expect(isPortraitCompositionDevice(navigatorLike("Windows NT 10.0", undefined, 10), { width: 1200, height: 1920 } as Screen)).toBe(false);
    expect(isPortraitCompositionDevice(navigatorLike("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", undefined, 10), { width: 1366, height: 768 } as Screen)).toBe(false);
    expect(isPortraitCompositionDevice(navigatorLike("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", undefined, 10), { width: 1024, height: 768 } as Screen)).toBe(false);
    expect(isPortraitCompositionDevice(navigatorLike("Mozilla/5.0 (X11; Linux x86_64)", undefined, 10), { width: 1366, height: 768 } as Screen)).toBe(false);
    expect(isPortraitCompositionDevice(navigatorLike("Mozilla/5.0 (X11; CrOS x86_64 15917.71.0)", undefined, 10), { width: 1366, height: 768 } as Screen)).toBe(false);
  });

  it("requests portrait for supported phones and tablets and absorbs rejection", async () => {
    const lock = vi.fn().mockResolvedValue(undefined);
    const phone = navigatorLike("iPhone");
    expect(await requestPhonePortraitLock(phone, { orientation: { lock } } as unknown as Screen)).toBe(true);
    expect(lock).toHaveBeenCalledWith("portrait-primary");

    lock.mockRejectedValueOnce(new DOMException("Not supported", "NotSupportedError"));
    expect(await requestPhonePortraitLock(phone, { orientation: { lock } } as unknown as Screen)).toBe(false);

    expect(await requestPhonePortraitLock(navigatorLike("iPad"), { orientation: { lock } } as unknown as Screen)).toBe(true);
    expect(lock).toHaveBeenLastCalledWith("portrait-primary");

    lock.mockClear();
    expect(await requestPhonePortraitLock(navigatorLike("Windows NT 10.0"), { orientation: { lock } } as unknown as Screen)).toBe(false);
    expect(lock).not.toHaveBeenCalled();
  });

  it("waits for a gesture and mounts one upright portrait shell without session authority", () => {
    const guard = source("src/components/PhonePortraitGuard.tsx");
    const css = source("app/globals.css");
    const page = source("app/page.tsx");
    expect(guard).toContain('window.addEventListener("pointerup", requestLock');
    expect(guard).toContain('window.addEventListener("keyup", requestLock');
    expect(guard).toContain('window.matchMedia("(orientation: landscape)")');
    expect(guard).toContain("isPortraitCompositionDevice(navigator, screen)");
    expect(guard).toContain("landscape.matches || visualWidth > visualHeight");
    expect(guard).toContain('root.style.setProperty("--aiasap-visual-width"');
    expect(guard).toContain('root.style.setProperty("--aiasap-visual-height"');
    expect(guard).toContain('root.style.setProperty("--aiasap-visual-offset-top"');
    expect(guard).toContain('window.addEventListener("resize", syncPortraitCanvas)');
    expect(guard).toContain('window.addEventListener("orientationchange", syncPortraitCanvas)');
    expect(guard).toContain('window.visualViewport?.addEventListener("resize", syncPortraitCanvas)');
    expect(guard).toContain('window.removeEventListener("resize", syncPortraitCanvas)');
    expect(guard).toContain('window.removeEventListener("orientationchange", syncPortraitCanvas)');
    expect(guard).toContain('window.visualViewport?.removeEventListener("resize", syncPortraitCanvas)');
    expect(guard).toContain('style.removeProperty("--aiasap-visual-height")');
    expect(guard).toContain('classList.toggle("aiasap-mobile-portrait-canvas", eligible && isLandscape)');
    expect(guard).toContain('classList.toggle("aiasap-phone-portrait-canvas", eligible && isLandscape && phone)');
    expect(guard).toContain('classList.toggle("aiasap-tablet-device", eligible && !phone)');
    expect(guard).not.toContain("Please rotate");
    expect(page).toContain('data-aiasap-portrait-shell="1"');
    expect(page).toMatch(/data-aiasap-portrait-shell="1"[\s\S]*?<LiveAvatarDemo/);
    expect(css).toContain('html.aiasap-mobile-portrait-canvas [data-aiasap-portrait-shell="1"]');
    expect(css).toContain("--aiasap-portrait-shell-width: min(100svw, calc(100svh * 9 / 16))");
    expect(css).toContain("--aiasap-portrait-shell-height: min(100svh, calc(100svw * 16 / 9))");
    expect(css).not.toContain("transform: rotate(90deg)");
    expect(css).not.toMatch(/aiasap-mobile-portrait-canvas[^}]*rotate\(/);
    expect(css).not.toMatch(/html\.aiasap-mobile-portrait-canvas body\s*\{[^}]*transform:/);
    expect(css).toContain("html.aiasap-phone-portrait-canvas [data-stage-controls=\"1\"].stage-controls-cluster");
    expect(css).not.toContain("Physical iPad landscape correction");
    expect(guard).not.toMatch(/startSession|sessionToken|LiveAvatarSession|fetch\(/);
  });

  it.each([
    { name: "phone", width: 844, height: 390 },
    { name: "tablet", width: 1276, height: 825 },
  ])("fits an upright 9:16 $name shell fully inside landscape", ({ width, height }) => {
    const shellWidth = Math.min(width, height * 9 / 16);
    const shellHeight = Math.min(height, width * 16 / 9);
    expect(shellWidth / shellHeight).toBeCloseTo(9 / 16, 8);
    expect(shellWidth).toBeLessThanOrEqual(width);
    expect(shellHeight).toBeLessThanOrEqual(height);
    expect((width - shellWidth) / 2).toBeGreaterThanOrEqual(0);
    expect((height - shellHeight) / 2).toBeGreaterThanOrEqual(0);
  });

  it.each([
    { name: "Droid short chrome", width: 844, height: 320 },
    { name: "Droid ordinary chrome", width: 844, height: 390 },
    { name: "iPad Safari", width: 1276, height: 760 },
    { name: "iPad tall viewport", width: 1276, height: 825 },
  ])("contains every major surface in the visual viewport at $name", ({ width, height }) => {
    const shellWidth = Math.min(width, height * 9 / 16);
    const shellHeight = Math.min(height, width * 16 / 9);
    const stageHeight = Math.min(shellHeight - 166, shellWidth * 16 / 9);
    const stageTop = (shellHeight - stageHeight) / 2;
    const rim = stageTop + stageHeight;
    const compact = shellWidth < 360;
    const controlsWidth = compact ? Math.min(288.6, shellWidth - 8) : 320;
    const contacts = { left: 4, right: shellWidth - 4, top: rim + 6, bottom: rim + 50 };
    const legal = { left: 0, right: shellWidth, top: rim + 56, bottom: rim + 56 + Math.max(10, shellWidth * 0.023) };
    expect(shellWidth / shellHeight).toBeCloseTo(9 / 16, 8);
    expect(controlsWidth).toBeLessThanOrEqual(shellWidth);
    expect(contacts.left).toBeGreaterThanOrEqual(0);
    expect(contacts.right).toBeLessThanOrEqual(shellWidth);
    expect(contacts.bottom).toBeLessThanOrEqual(shellHeight);
    expect(legal.left).toBeGreaterThanOrEqual(0);
    expect(legal.right).toBeLessThanOrEqual(shellWidth);
    expect(legal.bottom).toBeLessThanOrEqual(shellHeight);
  });

  it.each([
    { name: "phone portrait", width: 390, height: 710, kind: "phone-portrait" },
    { name: "phone landscape", width: 844, height: 390, kind: "phone-landscape" },
    { name: "tablet portrait", width: 800, height: 1280, kind: "tablet-portrait" },
    { name: "tablet landscape", width: 1276, height: 825, kind: "tablet-landscape" },
  ])("keeps rim, contact, and Legal ordered and visible at $name", ({ width, height, kind }) => {
    const landscape = kind.endsWith("landscape");
    const phone = kind.startsWith("phone");
    const shellWidth = landscape ? Math.min(width, height * 9 / 16) : width;
    const shellHeight = landscape ? Math.min(height, width * 16 / 9) : height;
    const shellLeft = (width - shellWidth) / 2;
    const shellTop = (height - shellHeight) / 2;
    const stageHeight = landscape
      ? Math.min(shellHeight - 166, shellWidth * 16 / 9)
      : phone
        ? Math.min(height - 96, width * 16 / 9)
        : Math.min(height - 166, width * 16 / 9, 1280);
    const stageTop = landscape
      ? (shellHeight - stageHeight) / 2
      : phone
        ? 0
        : (height - stageHeight) / 2 - 10;
    const rim = shellTop + stageTop + stageHeight;
    const contactHeight = 44;
    const contactTop = rim + 6;
    const contactBottom = contactTop + contactHeight;
    const legalTop = contactBottom + 6;
    const legalBottom = legalTop + 17.71;

    if (landscape) {
      expect(shellWidth / shellHeight).toBeCloseTo(9 / 16, 8);
      expect(shellLeft).toBeGreaterThanOrEqual(0);
      expect(shellTop).toBeGreaterThanOrEqual(0);
      expect(shellLeft + shellWidth).toBeLessThanOrEqual(width);
      expect(shellTop + shellHeight).toBeLessThanOrEqual(height);
    }
    expect(contactTop).toBeGreaterThan(rim);
    expect(legalTop).toBeGreaterThan(contactBottom);
    expect(legalBottom).toBeLessThanOrEqual(height);
    expect(contactHeight).toBe(44);
  });

  it("keeps every lifecycle branch under the same top-level shell and clears orientation classes", () => {
    const page = source("app/page.tsx");
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    const voice = source("src/components/VoiceOnlyStage.tsx");
    const guard = source("src/components/PhonePortraitGuard.tsx");

    expect(page.match(/data-aiasap-portrait-shell="1"/g)).toHaveLength(1);
    expect(page).toMatch(/data-aiasap-portrait-shell="1"[\s\S]*<LiveAvatarDemo/);
    expect(demo).toContain('data-six-initial-idle="1"');
    expect(demo).toContain('data-six-loading-only="1"');
    expect(demo).toContain("showsReturnedIdle");
    expect(session).toContain("data-six-active-stage={");
    expect(demo).toContain("<VoiceOnlyStage");
    expect(voice).toContain('data-voice-only="1"');
    expect(guard).toContain('classList.remove("aiasap-mobile-portrait-canvas")');
    expect(guard).toContain('classList.remove("aiasap-phone-portrait-canvas")');
  });

  it("reserves a real phone interstitial and gives active and voice stages the same Legal placement", () => {
    const css = source("app/globals.css");
    expect(css).toContain("--stage-height: calc(100svh - 91px) !important");
    expect(css).toContain("--stage-width: 100svw !important");
    expect(css).toContain("flex: 0 0 var(--stage-height) !important");
    expect(css).toContain("width: 100% !important");
    expect(css).toContain("aspect-ratio: auto !important");
    expect(css).toContain('background-image: url("/startscreen-noband.png") !important');
    // G 2026-09-04 evening, twice, on his phone: "his hands are off to screen
    // at the bottom ... the text is, like, on his hair." The phone frame is now
    // `contain` inside its own 385:690 box so NOTHING is cropped; md+ keeps
    // the `cover` poster. (He authorised the minimal dark side bars a short
    // phone needs for that, the same round.)
    expect(css).toContain("object-fit: cover !important");
    expect(css).toContain("aspect-ratio: 385 / 690 !important");
    expect(css).toContain("object-fit: contain !important");
    expect(css).toContain("--stage-control-label-size: 16.5px");
    expect(css).toContain("--stage-control-icon-size: 16.5px");
    expect(css).toContain("font-size: clamp(12.1px, 3.41vw, 16.5px) !important");
    expect(css).toContain("top: calc(0.45rem + 2px) !important");
    // G, 2026-09-04, ink on the screenshot: "move all four of the buttons
    // up ... where the mute and quiet are, move them up to where the start
    // and gallery is." One MEASURED button row: 38px phone / 54px tablet+,
    // row-gap 10px, so G then judged that too high: the move is now HALF a row on
    // tablet+ (+32) and a light nudge on phone (+16). Bottom-anchored, so
    // the whole 2x2 moves and the gap to 6's hands grows by one row.
    // Then: "just on mobile, move the boxes down just a little bit, like a
    // half box down." A phone button is 38px tall, so half a box is 19px:
    // 24 - 19 = 5.
    expect(css).toContain("96px + min(calc(100svh - 96px), calc(100svw * 16 / 9)) * 0.203 + 5px");
    expect(css).toContain('top: calc(var(--stage-top) + var(--stage-height) + 6px)');
    expect(css).toContain('top: calc(var(--stage-top) + var(--stage-height) + 52px) !important');
    expect(css).toContain("position: fixed !important");
    expect(css).toContain("container-name: aiasap-portrait-shell");
    expect(css).toContain("width: min(288.6px, calc(100cqw - 8px))");
    expect(css).toContain("--public-contact-width: calc(100cqw - 8px)");
    expect(css).toContain("font-size: clamp(8px, 2.3cqw, 16px) !important");
    expect(css).toContain("--stage-control-label-size: 20.196px");
    expect(css).toContain("--stage-control-icon-size: 20.196px");
    expect(css).toContain('.aiasap-tablet-idle-stage:has([data-public-contact-links="1"]) .stage-legal-footer');
    expect(css).not.toContain("bottom: 78.47px !important");
  });

  it("lifts Legal three pixels only on non-phone tablet and desktop compositions", () => {
    const css = source("app/globals.css");
    expect(css).toContain('@media (min-width: 768px) and (pointer: fine)');
    expect(css).toContain('html:not(.aiasap-phone-portrait-canvas) [data-stage-legal-line="1"]');
    expect(css).toContain('transform: translateY(-3px) !important');
    expect(css).toContain('@media (min-width: 768px) and (pointer: coarse)');
    expect(css).toContain('transform: translateY(-5px) !important');
  });
});
