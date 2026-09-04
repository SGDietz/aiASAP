import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

type Viewport = { width: number; height: number };

function geometry(viewport: Viewport) {
  const framed = viewport.width >= 768;
  const desktopFine = viewport.width >= 1367;
  const stageHeight = framed
    ? Math.min(viewport.height - 146, viewport.width * (16 / 9), 1280)
    : Math.min(viewport.height * 0.94, viewport.width * (16 / 9));
  const stageTop = framed ? (viewport.height - stageHeight) / 2 : 0;
  const portraitTabletLift = framed && viewport.width <= 1024 && viewport.height > viewport.width ? 10 : 0;
  const rim = stageTop - portraitTabletLift + stageHeight;
  const buttonHeight = 44;
  const buttonTop = rim + (desktopFine ? -3 : 6);
  const buttonBottom = buttonTop + buttonHeight;
  const footerTop = desktopFine ? rim + 42 : buttonBottom + (portraitTabletLift ? 16 : 6);
  return { rim, buttonHeight, buttonTop, buttonBottom, footerTop };
}

describe("selected public contact links", () => {
  it.each<Viewport>([
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 825, height: 1276 },
    { width: 1276, height: 825 },
    { width: 1440, height: 900 },
  ])("sit below the rim and above Legal at $width x $height", (viewport) => {
    const g = geometry(viewport);
    expect(g.buttonTop - g.rim).toBe(viewport.width >= 1367 ? -3 : 6);
    expect(g.footerTop - g.buttonBottom).toBeGreaterThanOrEqual(
      viewport.width >= 1367 ? 1 : 6,
    );
    expect(g.buttonHeight).toBe(44);
  });

  it("renders only the two selected text links with accessible hit rows", () => {
    const card = source("src/components/PublicContactCard.tsx");
    const contact = source("src/lib/publicContact.ts");
    const css = source("app/globals.css");
    expect(card.match(/data-public-contact-action="1"/g)).toHaveLength(2);
    expect(card.match(/data-public-contact-ink="1"/g)).toHaveLength(2);
    expect(card.match(/min-h-\[44px\]/g)).toHaveLength(2);
    expect(card).not.toMatch(/rounded-\[|\bborder\b|transition-\[border/);
    expect(css).toMatch(/\[data-public-contact-action="1"\] \{[\s\S]*?background: none;[\s\S]*?border: 0;[\s\S]*?border-radius: 0;[\s\S]*?box-shadow: none;/);
    expect(card).toContain('width: "var(--public-contact-width, calc(var(--stage-width) * 0.9))"');
    expect(css).toContain("--public-contact-width: min(calc(100svw - 8px), calc(var(--stage-width) + 36px))");
    expect(css).toContain("column-gap: 8px");
    expect(css).toContain("font-size: 23.1px !important");
    expect(css).toContain("transform: translateY(2px) scaleX(0.909091)");
    expect(css).toContain("grid-template-columns: auto auto;");
    expect(css).toContain("height: 44px");
    expect(css).toContain('top: calc(var(--stage-top) + var(--stage-height) + 6px)');
    expect(css).toContain('top: calc(var(--stage-top) + var(--stage-height) - 3px)');
    expect(css).toContain('top: calc(var(--stage-top) + var(--stage-height) + 42px) !important');
    expect(css).toContain('--public-contact-height: 44px');
    expect(css).toContain('--public-contact-width: min(calc(100svw - 8px), max(calc(var(--stage-width) * 0.9), 412px))');
    expect(css).toContain('height: var(--public-contact-height) !important');
    expect(css).toContain("--public-contact-bottom: calc(var(--stage-bottom) + 2.4rem)");
    expect(card.match(/text-\[clamp\(1\.25rem,calc\(var\(--stage-width\)\*0\.04\),1\.625rem\)\]/g)).toHaveLength(2);
    expect(card.match(/font-semibold/g)).toHaveLength(2);
    expect(card).not.toMatch(/animate-|blur-[2-9]|shadow-2xl|rounded-2xl/);
    expect(contact).toContain('AIASAP_PUBLIC_WEBSITE_DISPLAY = "WildWorks.Live"');
    expect(contact).toContain("The phone and WildWorks.Live links are at the bottom of the screen.");
    expect(card).toContain("AIASAP_PUBLIC_WEBSITE_DISPLAY");
    expect(css).toContain("--aiasap-contact-gold-1: #f8d69b");
    expect(css).toContain("--aiasap-contact-gold-4: #8b4d1d");
    expect(css).toContain("font-size: 18px !important");
  });

  it("renders the same approved links on true idle and active stage owners", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const voice = source("src/components/VoiceOnlyStage.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    const idle = demo.slice(demo.indexOf("if (showsSharedIdle)"), demo.indexOf("// VOICE ONLY"));
    expect(idle).toContain("<PublicContactCard />");
    expect(voice).toContain("<PublicContactCard />");
    expect(session).toContain("<PublicContactCard />");
  });

  it("uses one brighter Legal ink authority across every shared stage owner", () => {
    const css = source("app/globals.css");
    const footer = source("src/components/StageLegalFooter.tsx");
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    const voice = source("src/components/VoiceOnlyStage.tsx");
    expect(css).toContain('[data-stage-legal-line="1"] .aiasap-legal-ink');
    expect(css).toContain('[data-stage-legal-line="1"] .aiasap-legal-separator');
    expect(css).toContain("var(--aiasap-contact-gold-1) 0%");
    expect(css).toContain("color: transparent !important");
    expect(css).toContain("-webkit-text-fill-color: transparent !important");
    expect(css).toContain("text-shadow: none !important");
    expect(css).not.toContain("color: #c8893d");
    expect(css).not.toContain('[data-stage-legal-line="1"] > a:first-child');
    expect(footer).toContain('data-stage-legal-line="1"');
    expect(demo).toContain("<StageLegalFooter");
    expect(session).toContain("<StageLegalFooter");
    expect(voice).toContain("<StageLegalFooter");
  });
});
