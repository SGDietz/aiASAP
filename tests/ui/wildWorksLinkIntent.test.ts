import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AVATAR_SITE_RESPONSE,
  resolveAvatarSiteIntent,
  resolveWildWorksLinkTurn,
  WILDWORKS_LINK_DECLINED_RESPONSE,
  WILDWORKS_LINK_OFFER_RESPONSE,
  WILDWORKS_LINK_SHOWN_RESPONSE,
  WILDWORKS_LIVE_URL,
} from "../../src/lib/wildWorksLinkIntent";
import { SIX_SYSTEM_PROMPT } from "../../src/lib/brain/sixSystemPrompt";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("WildWorks two-step consent intent", () => {
  it.each([
    "show me WildWorks",
    "Can I see the WildWorks site?",
    "Could you show me wildworks.live?",
    "I want to see the Wild Works website",
    "Can I see G's website?",
    "Show me Scott's site",
    "Can I see G's portfolio?",
    "Do you have a portfolio?",
  ])("offers but does not show the link from genuine interest: %s", (utterance) => {
    expect(resolveWildWorksLinkTurn(utterance, "idle")).toEqual({
      nextState: "pending",
      handled: true,
      spoken: WILDWORKS_LINK_OFFER_RESPONSE,
    });
  });

  it.each([
    "WildWorks is our landscaping project",
    "Tell me about WildWorks",
    "What does WildWorks do?",
    "I like the WildWorks name",
    "Don't show me WildWorks",
    "Show me what WildWorks does",
    "Make the WildWorks link bigger",
    "Show me wildlife websites",
    "yes",
    "okay",
  ])("does not create an offer or link from discussion, UI feedback, or an unrelated affirmation: %s", (utterance) => {
    expect(resolveWildWorksLinkTurn(utterance, "idle")).toBeNull();
  });

  it.each(["yes", "Sure", "okay", "please do", "go ahead", "put it on the screen"])(
    "shows only from a context-bound pending affirmation: %s",
    (utterance) => {
      expect(resolveWildWorksLinkTurn(utterance, "pending")).toEqual({
        nextState: "shown",
        handled: true,
        spoken: WILDWORKS_LINK_SHOWN_RESPONSE,
      });
    },
  );

  it("expires a pending offer on an unrelated response so a later yes cannot show it", () => {
    expect(resolveWildWorksLinkTurn("I was talking about my truck", "pending")).toEqual({
      nextState: "idle",
      handled: false,
      spoken: null,
    });
    expect(resolveWildWorksLinkTurn("yes", "idle")).toBeNull();
  });

  it.each(["no", "not now", "never mind"])("declines without showing: %s", (utterance) => {
    expect(resolveWildWorksLinkTurn(utterance, "pending")).toEqual({
      nextState: "idle",
      handled: true,
      spoken: WILDWORKS_LINK_DECLINED_RESPONSE,
    });
  });

  it("uses exact safe destination and truthful ask-then-show speech", () => {
    expect(WILDWORKS_LIVE_URL).toBe("https://wildworks.live/");
    expect(WILDWORKS_LINK_OFFER_RESPONSE).toBe(
      "Would you like me to put the WildWorks link on the screen so you can see the site?",
    );
    expect(WILDWORKS_LINK_SHOWN_RESPONSE).toBe(
      "The WildWorks.Live link is on the screen. Tap it to see his website.",
    );
    expect(`${WILDWORKS_LINK_OFFER_RESPONSE} ${WILDWORKS_LINK_SHOWN_RESPONSE}`).not.toMatch(
      /opened|sent you|emailed|texted|point|gesture|navigated/i,
    );
  });
});

describe("conditional active-session link UI", () => {
  it("is absent from the idle front door and legal footer", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const footer = source("src/components/StageLegalFooter.tsx");
    expect(demo).not.toContain("WildWorksLinkButton");
    expect(footer).not.toContain("WildWorksLinkButton");
    expect(footer).not.toContain("WildWorks.Live");
    expect(footer).not.toContain("gap-1");
    expect(footer).toContain("h-[29px]");
    expect(footer).toContain("pb-[env(safe-area-inset-bottom)]");
  });

  it("renders only after shown state in both active conversation paths", () => {
    const avatar = source("src/components/LiveAvatarSession.tsx");
    const voiceOnly = source("src/components/VoiceOnlyStage.tsx");
    for (const runtime of [avatar, voiceOnly]) {
      expect(runtime).toContain('useState<WildWorksOfferState>("idle")');
      expect(runtime).toContain('wildWorksOfferState === "shown"');
      expect(runtime).toContain("<WildWorksLinkButton");
      expect(runtime).toContain('wildWorksOfferStateRef.current = "idle"');
      expect(runtime).toContain('setWildWorksOfferState("idle")');
    }
    expect(avatar.match(/resolveWildWorksLinkTurn\(/g)).toHaveLength(2);
    expect(voiceOnly.match(/resolveWildWorksLinkTurn\(/g)).toHaveLength(1);
  });

  it("sits immediately above the four-control group and is dismissible/click-safe", () => {
    const card = source("src/components/WildWorksLinkButton.tsx");
    const controls = source("src/components/StageControls.tsx");
    expect(card).toContain("bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.291+11.25rem)]");
    expect(card).toContain("md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203+12.75rem)]");
    expect(controls).toContain("bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.225-4px)]");
    expect(controls).toContain("md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203)]");
    expect(controls).toContain('data-stage-controls="1"');
    expect(card).toContain('aria-label="Dismiss WildWorks link"');
    expect(card).toContain("onDismiss");
    expect(card).toContain("event.stopPropagation()");
  });

  it("uses exact accessible label, destination, and new-tab security", () => {
    const card = source("src/components/WildWorksLinkButton.tsx");
    expect(card).toContain("WildWorks.Live");
    expect(card).not.toContain("www.");
    expect(card).not.toContain("Wildworks.Live");
    expect(card).toContain('href={WILDWORKS_LIVE_URL}');
    expect(card).toContain('target="_blank"');
    expect(card).toContain('rel="noopener noreferrer"');
    expect(card).toContain('aria-label="WildWorks.Live (opens in a new tab)"');
    expect(card).not.toContain("startSession");
  });
});

describe("phone framing and frozen authorities", () => {
  it("pulls back the phone still/live media without a translation and preserves md framing", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    expect(demo).toContain("six-primary-scene absolute inset-0 h-full w-full object-cover object-top");
    expect(session).toContain("six-primary-scene");
    expect(demo).not.toContain("top-[calc(var(--stage-height)*-0.05)]");
    expect(session).not.toContain("top-[calc(var(--stage-height)*-0.05)]");
    expect(demo).toContain("md:object-cover md:object-top md:h-[94vh]");
    expect(session).toContain("md:object-cover md:object-top md:h-[94vh]");
    expect(demo).not.toContain("data-phone-media-edge-extension");
  });
});

describe("actual Six runtime prompt authority", () => {
  it("matches the conditional consent UI and forbids permanent/pre-consent claims", () => {
    expect(SIX_SYSTEM_PROMPT).toContain("There is no WildWorks link on the idle front door");
    expect(SIX_SYSTEM_PROMPT).toContain(WILDWORKS_LINK_OFFER_RESPONSE);
    expect(SIX_SYSTEM_PROMPT).toContain(WILDWORKS_LINK_SHOWN_RESPONSE);
    expect(SIX_SYSTEM_PROMPT).toContain("Only a clear affirmative reply to that pending offer");
    expect(SIX_SYSTEM_PROMPT).toContain("An unrelated yes or okay must never show it");
    expect(SIX_SYSTEM_PROMPT).toContain("reset on teardown, session end, restart, or a fresh idle session");
    expect(SIX_SYSTEM_PROMPT).not.toContain("always has one persistent link");
    expect(SIX_SYSTEM_PROMPT).not.toContain("www.Wildworks.Live");
  });

  it("preserves the money-focused avatar-site positioning", () => {
    expect(resolveAvatarSiteIntent("Can aiASAP build an avatar site?")).toBe(AVATAR_SITE_RESPONSE);
    expect(SIX_SYSTEM_PROMPT).toContain("purpose-built to sell and make money");
    expect(SIX_SYSTEM_PROMPT).toContain("not a promise or guarantee of revenue");
  });
});
