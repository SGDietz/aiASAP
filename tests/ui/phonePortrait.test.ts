import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { isTruePhone, requestPhonePortraitLock } from "../../src/lib/phonePortrait";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const navigatorLike = (userAgent: string, mobile?: boolean) =>
  ({ userAgent, userAgentData: mobile === undefined ? undefined : { mobile } }) as Navigator & {
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

  it("requests portrait only for a supported phone and absorbs rejection", async () => {
    const lock = vi.fn().mockResolvedValue(undefined);
    const phone = navigatorLike("iPhone");
    expect(await requestPhonePortraitLock(phone, { orientation: { lock } } as unknown as Screen)).toBe(true);
    expect(lock).toHaveBeenCalledWith("portrait-primary");

    lock.mockRejectedValueOnce(new DOMException("Not supported", "NotSupportedError"));
    expect(await requestPhonePortraitLock(phone, { orientation: { lock } } as unknown as Screen)).toBe(false);

    lock.mockClear();
    expect(await requestPhonePortraitLock(navigatorLike("iPad"), { orientation: { lock } } as unknown as Screen)).toBe(false);
    expect(lock).not.toHaveBeenCalled();
  });

  it("waits for a gesture, shows an iPhone fallback, and has no session authority", () => {
    const guard = source("src/components/PhonePortraitGuard.tsx");
    expect(guard).toContain('window.addEventListener("pointerup", requestLock');
    expect(guard).toContain('window.addEventListener("keyup", requestLock');
    expect(guard).toContain('window.matchMedia("(orientation: landscape)")');
    expect(guard).toContain("Please rotate your phone to portrait.");
    expect(guard).toContain("if (!isTruePhone(navigator)) return;");
    expect(guard).not.toContain("md:hidden");
    expect(guard).not.toMatch(/startSession|sessionToken|LiveAvatarSession|fetch\(/);
  });
});
