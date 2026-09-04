import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const bytes = (path: string) => readFileSync(join(process.cwd(), path));
const source = (path: string) => bytes(path).toString("utf8");

describe("single-6 icon and consolidated legal contracts", () => {
  it("uses one digit 6 as the deterministic source for every active icon asset", () => {
    const svg = source("tools/assets/aiasap-app-icon.svg");
    const generator = source("tools/generate_app_icons.mjs");
    expect(svg).toContain('aria-label="6"');
    expect(svg).toContain('>6</text>');
    expect(svg).not.toMatch(/aiA|aiASAP|wordmark/i);
    expect(svg.match(/<text\b/g)).toHaveLength(1);
    expect(svg).toContain('x="256" y="399"');
    expect(svg).toContain('font-size="396"');
    expect(svg).not.toContain('font-size="330"');
    expect(generator).toContain('join(root, "app", "icon.png")');
    expect(generator).toContain('join(root, "app", "apple-icon.png")');
    expect(generator).toContain('join(root, "app", "favicon.ico")');
    expect(generator).toContain('join(root, "public", "aiasap-app-icon.png")');
    expect(generator).toContain('join(root, "public", "aiasap-app-icon.svg")');

    for (const [path, size] of [
      ["app/icon.png", 512],
      ["app/apple-icon.png", 180],
    ] as const) {
      const png = bytes(path);
      expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
    }

    const ico = bytes("app/favicon.ico");
    expect(ico.readUInt16LE(0)).toBe(0);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);
    expect([0, 1, 2].map((index) => ico.readUInt8(6 + index * 16))).toEqual([
      16, 32, 48,
    ]);
    for (let index = 0; index < 3; index += 1) {
      const offset = ico.readUInt32LE(6 + index * 16 + 12);
      expect(ico.subarray(offset + 1, offset + 4).toString("ascii")).toBe("PNG");
    }
    expect(bytes("public/aiasap-app-icon.png")).toEqual(bytes("app/icon.png"));
    expect(source("public/aiasap-app-icon.svg")).toBe(svg);
    const layout = source("app/layout.tsx");
    expect(layout).toContain('shortcut: "/favicon.ico"');
    expect(layout).toContain('apple: [{ url: "/apple-icon.png"');
  });

  it("stays a normal website with no installable web-app manifest", () => {
    const layout = source("app/layout.tsx");
    expect(existsSync(join(process.cwd(), "app/manifest.ts"))).toBe(false);
    expect(layout).not.toMatch(/\bmanifest\s*:/);
    expect(layout).not.toContain("/manifest.webmanifest");
    expect(layout).toContain('shortcut: "/favicon.ico"');
    expect(layout).toContain('icon: [{ url: "/icon.png"');
    expect(layout).toContain('apple: [{ url: "/apple-icon.png"');
  });

  it("renders one compact You Own control beside copyright and Terms without changing footer geometry", () => {
    const footer = source("src/components/StageLegalFooter.tsx");
    expect(footer).toContain("©2026 aiASAP All Rights Reserved");
    expect(footer).not.toContain("© 2026");
    expect(footer).toContain('href="/your-rights"');
    expect(footer).toContain("You Own");
    expect(footer).toContain('href="/legal"');
    expect(footer).toContain("Terms/Legal");
    expect(footer).not.toContain("Terms / Legal");
    expect(footer).toContain("aiasap-legal-separator inline-block origin-center scale-[1.25]");
    expect(footer).toContain('const ink = "aiasap-legal-ink"');
    expect(footer.match(/<span aria-hidden/g)).toHaveLength(2);
    expect(footer).toContain("text-[clamp(11px,3.1vw,15px)]");
    expect(footer).toContain("bg-[#241608] pb-[env(safe-area-inset-bottom)] md:contents");
    expect(footer).toContain("-translate-y-[4px]");
    expect(footer).toContain("md:translate-y-0");
    expect(footer).not.toContain("phoneOpticalLift");
    expect(footer).toContain("h-[29px]");
    expect(footer).toContain("md:h-auto md:w-auto md:bg-transparent");
    expect(footer).toContain("items-center justify-center");
    expect(footer).toContain("inline-flex items-center justify-center px-1 py-2");
    expect(footer).not.toContain("h-full w-full");
    expect(footer).toContain('aria-label="Open You Own"');
    expect(footer).toContain('aria-label="Open aiASAP Terms and Legal"');
    expect(footer).toContain("gap-[clamp(2px,0.8vw,6px)]");
    expect(footer).toContain("whitespace-nowrap");
    expect(footer).toContain("fixed inset-x-0 bottom-0");
    expect(footer).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(footer).toContain("h-[29px]");
    expect(footer).not.toContain('href="/privacy"');
    expect(footer).not.toContain('href="/terms"');
  });

  it("uses high-contrast system-themed Legal and Your Rights pages with readable phone type", () => {
    const legal = source("app/legal/page.tsx");
    const rights = source("app/your-rights/page.tsx");
    expect(legal.match(/Back to aiASAP/g)).toHaveLength(2);
    expect(rights.match(/Back to aiASAP/g)).toHaveLength(2);
    expect(legal).not.toContain("Back to 6");
    expect(rights).not.toContain("Back to 6");
    for (const page of [legal, rights]) {
      expect(page).toContain("bg-white");
      expect(page).toContain("text-black");
      expect(page).toContain("dark:bg-black");
      expect(page).toContain("dark:text-white");
      expect(page).toContain("[color-scheme:light]");
      expect(page).toContain("dark:[color-scheme:dark]");
      expect(page).toContain("text-base leading-7");
      expect(page).toContain("max-w-3xl");
      expect(page).not.toMatch(/#ffe9c2|#d7a05a|#3a2108|gradient|drop-shadow/i);
    }
  });

  it("puts the existing important disclosures first with keyboard anchors", () => {
    const legal = source("app/legal/page.tsx");
    const ordered = [
      'id: "recording-transcripts-data-use"',
      'id: "privacy-consent"',
      'id: "ownership"',
      'id: "terms"',
      'id: "professional-advice"',
    ].map((needle) => legal.indexOf(needle));
    expect(ordered.every((index) => index >= 0)).toBe(true);
    expect([...ordered].sort((a, b) => a - b)).toEqual(ordered);
    expect(legal).toContain('href={`#${id}`}');
    expect(legal).toContain("tabIndex={-1}");
    expect(legal).toContain('aria-label="Legal page sections"');
  });

  it("preserves representative operative Terms and Privacy material without draft agreement text", () => {
    const legal = source("app/legal/page.tsx");
    for (const material of [
      "Conversations and interactions with aiASAP may be recorded, transcribed, stored, analyzed",
      "Requesting follow-up about a build is not blanket consent to unrelated marketing.",
      "aiASAP is a trademark of DietzX.",
      "Effective automatically only when aiASAP has completed the agreed services and received the full agreed price for that specific Deliverable in settled, cleared funds, aiASAP hereby assigns to Client all right, title, and interest that aiASAP owns in the Client-Specific Material identified for that Deliverable",
      "Payment or file delivery by itself does not automatically transfer every possible copyright",
      "keeps no ownership stake, royalty, profit share, equity, revenue share, or claim",
      "digit 6 character and brand",
      "each human employee, contractor, or subcontractor in the contribution chain must have assigned the relevant rights",
      "Work-made-for-hire status is not the sole transfer mechanism",
      "Delivery of editable or source files is separate from copyright ownership",
      "By using aiASAP, you agree to these terms.",
      "aiASAP provides general information and assistance only.",
      "These terms are governed by the laws of the State of Wyoming, except where non-waivable federal law or other mandatory law applies.",
      "aiASAP is not intended for use by children under 13.",
    ]) {
      expect(legal).toContain(material);
    }
    expect(legal).not.toMatch(/revision overage|spending cap|e-sign/i);
    expect(legal).not.toMatch(/governed by the laws of the State of Maryland/i);
    expect(legal).not.toContain("lease-like right");
  });

  it("makes Your Rights proud, paid-project specific, and legally bounded", () => {
    const rights = source("app/your-rights/page.tsx");
    const legal = source("app/legal/page.tsx");
    expect(rights).toContain("Your Work. Your Rights.");
    expect(rights).toContain("Everything you pay for is yours.");
    expect(rights).toContain("Once you have paid for the client-specific work we deliver, you own 100% of it and everything you build from it.");
    expect(rights).toContain("one billion-dollar company—or several");
    expect(rights).toContain("aiASAP waives any and all rights to your future success.");
    expect(rights).toContain("We will never come after you for royalties, equity, profit share, or any other money based on that success.");
    expect(rights).not.toContain("Plain English:");
    expect(rights).toContain("If the Contract Is Broken");
    expect(rights).toContain("If you break the contract before ownership transfers—such as by not paying in full—you do not own the rights to that work.");
    expect(rights).toContain("Work from unpaid future phases is not included.");
    expect(rights).toContain("You have the opportunity to read it, then accept it by clicking ‘I Agree’ and submitting payment.");
    expect(rights).toContain("aiASAP electronically executes the written");
    expect(rights).not.toMatch(/\bsigned agreement\b/i);
    expect(rights).not.toMatch(/17 U\.S\.C\.|work made for hire|work-made-for-hire|§204|§106/i);
    expect(rights).toContain("aiASAP transfers only rights it owns and can legally transfer");
    expect(rights).toContain("6 character and brand remain with their existing owners");
    expect(rights).toContain("Third-party materials remain subject to their licenses");
    expect(rights).toContain("AI-only material may not qualify for copyright protection");
    expect(rights).toContain("does not promise revenue");
    expect(rights).toContain('href="/legal#ownership"');
  });

  it("uses a springing assignment without post-vesting clawback", () => {
    const legal = source("app/legal/page.tsx");
    expect(legal).toContain("springing written assignment");
    expect(legal).toContain("full agreed price for that specific Deliverable in settled, cleared funds");
    expect(legal).toContain("assignment never vests for that affected unpaid Deliverable");
    expect(legal).toContain("limited, nonexclusive, nontransferable license to review and evaluate");
    expect(legal).toContain("does not automatically suspend, rescind, or claw back");
    expect(legal).toContain("nonwaivable consumer dispute rights");
    expect(legal).toContain("does not reach the client's pre-existing business");
    expect(legal).toContain("client-supplied materials, unrelated work");
    expect(legal).toContain("other Deliverable whose assignment has vested");
    expect(legal).not.toMatch(/portfolio license|performance-data|performance data/i);
  });

  it("keeps old legal URLs compatible with anchored canonical destinations", () => {
    expect(source("app/terms/page.tsx")).toContain('redirect("/legal#terms")');
    expect(source("app/privacy/page.tsx")).toContain(
      'redirect("/legal#privacy-consent")',
    );
    expect(source("app/disclaimer/page.tsx")).toContain(
      'redirect("/legal#professional-advice")',
    );
    expect(source("app/ai-guarantee/page.tsx")).toContain(
      'redirect("/your-rights")',
    );
  });

  it("returns to a fresh untapped 6 without any session-start authority on Legal", () => {
    const legal = source("app/legal/page.tsx");
    const rights = source("app/your-rights/page.tsx");
    expect(legal.match(/href="\/"/g)).toHaveLength(2);
    expect(rights.match(/href="\/"/g)).toHaveLength(2);
    expect(legal.match(/Back to aiASAP/g)).toHaveLength(2);
    expect(rights.match(/Back to aiASAP/g)).toHaveLength(2);
    expect(legal).not.toMatch(/startSession|session_token|router\.back|router\.push/);
    expect(rights).not.toMatch(/startSession|session_token|router\.back|router\.push/);
    expect(source("src/components/LiveAvatarDemo.tsx")).toContain(
      "if (!hasTappedToStart) {",
    );
  });

  it("awaits full avatar teardown before legal navigation in every live control state", () => {
    const footer = source("src/components/StageLegalFooter.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    expect(footer.indexOf("await onBeforeNavigate()")).toBeLessThan(
      footer.indexOf("window.location.assign(destination)"),
    );
    expect(footer).toContain('type LegalDestination = "/your-rights" | "/legal"');
    expect(footer).toContain("handleLegalNavigation(event, \"/your-rights\")");
    expect(footer).toContain("handleLegalNavigation(event, \"/legal\")");
    expect(session).toContain(
      "handleEndSession({ pause: true, awaitProviderStop: true })",
    );
    for (const teardown of [
      "stopListening();",
      "stop();",
      "await interrupt();",
      "videoRef.current.pause();",
      "videoRef.current.srcObject = null;",
      "await providerStop;",
    ]) {
      expect(session).toContain(teardown);
    }
    expect(session).toContain("onBeforeNavigate={stopAvatarForLegal}");
    expect(session).toContain("void providerStop.catch(() => {});");
    expect(session.indexOf("await providerStop;")).toBeLessThan(
      session.indexOf("void providerStop.catch(() => {});"),
    );
    expect(session).not.toMatch(/(?:isMuted|voiceMuted|micOff)[\s\S]{0,120}stopAvatarForLegal/);
  });

  it("stops voice-only audio/listening and cancels loading before Legal", () => {
    const voice = source("src/components/VoiceOnlyStage.tsx");
    const demo = source("src/components/LiveAvatarDemo.tsx");
    for (const teardown of [
      "runningRef.current = false;",
      "turnIdRef.current += 1;",
      "cutVoiceOnlyAudio();",
      "rec.abort?.();",
      "rec.stop();",
      "onBeforeNavigate={stopVoiceOnlyForLegal}",
    ]) {
      expect(voice).toContain(teardown);
    }
    expect(demo).toContain("startAbortRef.current?.abort();");
    expect(demo).toContain("onBeforeNavigate={stopPendingStartForLegal}");
    expect(demo).not.toMatch(/<StageLegalFooter[^>]*onBeforeNavigate[^>]*>[\s\S]*startSession/);
  });

  it("uses the same phone footer component for START, running, and returned STOP", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const session = source("src/components/LiveAvatarSession.tsx");
    const sharedIdle = demo.slice(
      demo.indexOf("if (showsSharedIdle)"),
      demo.indexOf("// VOICE ONLY"),
    );

    expect(sharedIdle).toContain("<StageLegalFooter phoneFlow");
    expect(sharedIdle).toContain("showsReturnedIdle");
    expect(sharedIdle).toContain("handleStartFromStopped");
    expect(sharedIdle.match(/src="\/startscreen-noband\.png"/g)).toHaveLength(1);
    expect(session.match(/<StageLegalFooter\s+phoneFlow/g)).toHaveLength(2);
  });
});
