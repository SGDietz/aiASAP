import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(__dirname, "..", path), "utf8");

describe("contact capture and four-control state matrix", () => {
  it("keeps the contact surface above the unchanged control layer", () => {
    const card = source("src/components/ContactStatusCard.tsx");
    const controls = source("src/components/StageControls.tsx");
    expect(controls).toContain("var(--stage-height)*0.225");
    expect(controls).toContain("md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203)]");
    expect(card).toContain('z-[61]');
    expect(controls).toContain('z-[60]');
  });

  it("puts the capture box over the top two chest buttons and leaves the bottom two", () => {
    // G, ride cb2dde76 2026-09-03: "your email box should cover the top two
    // boxes... stop start button and gallery so we just don't see them, but we
    // leave mute and quiet on the screen."
    const card = source("src/components/ContactStatusCard.tsx");
    const css = source("app/globals.css");
    // anchored from the BOTTOM against the cluster's own expression
    expect(card).toContain("bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.225-4px+44px)]");
    // The live anchor on every breakpoint is the CHEST ANCHOR block at the end
    // of globals.css: the card rides the same hands-line expression as the
    // cluster, plus the measured bottom-row offset (62px phone, 66px md).
    expect(card).toContain('data-contact-card-anchor="1"');
    const chest = css.slice(css.indexOf("GOLD GLYPHS + CHEST ANCHOR"));
    expect(chest).toContain('[data-contact-card-anchor="1"]');
    expect(chest).toContain("var(--six-chest-gap) + 62px) !important");
    expect(chest).toContain("* 0.1696 + 16px + 66px) !important");
    expect(card).not.toMatch(/\stop-\[calc\(var\(--stage-top\)/);
    expect(card).toContain('data-aiasap-capture-card');
    // only the top two hide, and by visibility so the grid never reflows
    const rule = css.slice(css.indexOf('html[data-aiasap-capture-card="1"]'));
    expect(rule).toContain('[data-stage-control="start"]');
    expect(rule).toContain('[data-stage-control="gallery"]');
    expect(rule.slice(0, 400)).toContain("visibility: hidden");
    expect(rule.slice(0, 400)).not.toContain("display: none");
    expect(rule.slice(0, 400)).not.toContain('[data-stage-control="mute"]');
    expect(rule.slice(0, 400)).not.toContain('[data-stage-control="quiet"]');
  });

  it("keeps the interactive send-link fallback separate from verbal contact status", () => {
    const card = source("src/components/ContactStatusCard.tsx");
    const fallback = source("src/components/SendLinkFallbackCard.tsx");
    const avatar = source("src/components/LiveAvatarSession.tsx");
    expect(card).not.toContain("sendLink");
    expect(fallback).toContain('data-send-link-fallback="1"');
    expect(fallback).toContain("pointer-events-auto");
    expect(avatar).toContain("resolveSendLinkFallbackStatus");
    expect(avatar).toContain("data?.emailSent === true");
  });

  it("anchors the selected text-only public links between the rim and footer", () => {
    const links = source("src/components/PublicContactCard.tsx");
    expect(links).toContain('width: "var(--public-contact-width, calc(var(--stage-width) * 0.9))"');
    expect(links).toContain('bottom: "var(--public-contact-bottom, calc(var(--stage-bottom) + 2.75rem))"');
    expect(links).toContain("grid-cols-[auto_auto] justify-center gap-2");
    expect((links.match(/min-h-\[44px\]/g) ?? []).length).toBe(2);
    expect((links.match(/data-public-contact-action="1"/g) ?? []).length).toBe(2);
    expect((links.match(/data-public-contact-ink="1"/g) ?? []).length).toBe(2);
    expect(links).toContain("AIASAP_PUBLIC_WEBSITE_DISPLAY");
    expect(links).toContain("AIASAP_PUBLIC_PHONE_DISPLAY");
    expect(source("app/globals.css")).toContain("font-size: 21px !important");
    expect(links).not.toMatch(/icon|mailto:|rounded-|\bborder\b|text-lg|font-black/i);
  });

  it("shows the interactive shared surface before StageControls in avatar and voice-only", () => {
    const avatar = source("src/components/LiveAvatarSession.tsx");
    const voice = source("src/components/VoiceOnlyStage.tsx");
    const card = source("src/components/ContactStatusCard.tsx");
    expect(avatar).toMatch(/<ContactStatusCard[\s\S]*<StageControls/);
    expect(voice).toMatch(/<ContactStatusCard[\s\S]*<StageControls/);
    expect(card).toContain("state.value");
    expect(card).toContain('"confirming"');
    // G, ride 2026-09-03 19:41: "the email box just came up way too early...
    // it should not have come up yet either." The box may no longer show at
    // contact_method, and at contact_capture only once heard characters exist.
    expect(card).not.toContain('"contact_method"');
    expect(card).toContain('"contact_capture"');
    expect(card).toMatch(/contact_capture[\s\S]{0,120}state\.value/);
    // G, 2026-09-03: "Everything is audio only... None of those yes send it
    // boxes... It's gotta be almost exactly like the iScott." The box shows
    // what 6 heard and nothing else - every question is spoken.
    expect(card).toContain('data-contact-value="1"');
    expect(card).toContain('data-contact-label="1"');
    expect(card).toContain("pointer-events-none");
    expect(card).not.toMatch(/<button|<input|onClick/);
  });

  it("uses inert controls during loading and active controls through stop, exit, return, and voice states", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    expect((demo.match(/<StageControls/g) ?? []).length).toBeGreaterThanOrEqual(3);
    const loadingStart = demo.indexOf("if (!sessionToken && hasTappedToStart");
    const loadingEnd = demo.indexOf("// One literal idle render", loadingStart);
    const loadingSurface = demo.slice(loadingStart, loadingEnd);
    expect(loadingSurface).toContain("<SixLoadingIndicator />");
    expect(loadingSurface).not.toContain("<StageControls");
    expect(demo).toContain("{!isLoading && (");
    expect(demo).toContain("pausedOnStage");
    expect(demo).toContain('mode === "VOICE"');
    const controls = source("src/components/StageControls.tsx");
    for (const label of ["Stop", "Start", "Mute", "Quiet", "Gallery"]) {
      expect(controls).toContain(`"${label}"`);
    }
    expect(controls).not.toContain('"Voice"');
  });
});
