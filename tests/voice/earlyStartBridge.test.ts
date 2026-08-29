import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {
  adoptEarlyStartRecord,
  getEarlyStartBridgeSource,
  installEarlyStartBridge,
  type EarlyStartRecord,
} from "../../src/lib/voice/earlyStartBridge";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

type Harness = ReturnType<typeof createHarness>;

function createHarness(options?: {
  permission?: "grant" | "deny";
  holdMint?: boolean;
  secure?: boolean;
  timingLedger?: "frozen" | "throwing";
}) {
  const documentListeners = new Map<string, (event: any) => void>();
  const windowListeners = new Map<string, () => void>();
  const attributes = new Map<string, string>();
  const stop = vi.fn();
  const getUserMedia =
    options?.permission === "deny"
      ? vi.fn().mockRejectedValue(new DOMException("blocked", "NotAllowedError"))
      : vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
  let releaseMint!: (response: any) => void;
  const heldMint = new Promise((resolve) => {
    releaseMint = resolve;
  });
  const fetch = vi.fn().mockImplementation(() =>
    heldMint,
  );
  fetch.mockImplementation((url: string) => {
    if (url === "/api/stop-session") {
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    }
    return options?.holdMint === false
      ? Promise.resolve({
          ok: true,
          json: async () => ({ session_token: "intercepted-token" }),
        })
      : heldMint;
  });
  const ink = {
    style: { transform: "" },
    getBoundingClientRect: () => ({ width: 100 }),
  };
  const doc = {
    documentElement: {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => attributes.delete(name),
    },
    fonts: { ready: Promise.resolve() },
    querySelector: vi.fn().mockReturnValue(ink),
    addEventListener: (name: string, listener: (event: any) => void) =>
      documentListeners.set(name, listener),
  };
  const scope: any = {
    __AIASAP_EARLY_START__: undefined,
    isSecureContext: options?.secure !== false,
    location: { search: "" },
    navigator: {
      mediaDevices: { getUserMedia },
      permissions: {
        query: vi.fn().mockResolvedValue({
          state: options?.permission === "deny" ? "denied" : "prompt",
        }),
      },
    },
    fetch,
    matchMedia: vi.fn().mockReturnValue({ matches: false }),
    addEventListener: (name: string, listener: () => void) =>
      windowListeners.set(name, listener),
    removeEventListener: (name: string) => windowListeners.delete(name),
    setTimeout,
    clearTimeout,
  };
  if (options?.timingLedger === "frozen") {
    scope.__AIASAP_STARTUP_TIMING__ = Object.freeze({
      version: 1,
      marks: Object.freeze({}),
      resources: Object.freeze({}),
    });
  } else if (options?.timingLedger === "throwing") {
    Object.defineProperty(scope, "__AIASAP_STARTUP_TIMING__", {
      configurable: false,
      get: () => {
        throw new Error("blocked timing ledger");
      },
    });
  }
  installEarlyStartBridge(scope as any, doc as any);

  const tap = () => {
    const event = {
      target: { closest: vi.fn().mockReturnValue({}) },
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    };
    documentListeners.get("click")?.(event);
    return event;
  };

  return {
    scope,
    attributes,
    getUserMedia,
    fetch,
    stop,
    tap,
    releaseMint,
    pageHide: () => windowListeners.get("pagehide")?.(),
    record: () => scope.__AIASAP_EARLY_START__ as unknown as EarlyStartRecord,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("pre-React START bridge", () => {
  it.each(["throwing", "frozen"] as const)(
    "keeps first-tap mic and mint ownership with a %s timing ledger",
    async (timingLedger) => {
      const harness = createHarness({ holdMint: false, timingLedger });
      const event = harness.tap();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(event.preventDefault).toHaveBeenCalledOnce();
      expect(harness.getUserMedia).toHaveBeenCalledOnce();
      expect(
        harness.fetch.mock.calls.filter(([url]) => url === "/api/start-custom-session"),
      ).toHaveLength(1);
      harness.pageHide();
    },
  );

  it.each([200, 1_000, 5_000, 30_000])(
    "owns one first tap at %dms with one microphone and one intercepted mint",
    async (delay) => {
      vi.useFakeTimers();
      const harness = createHarness();
      await vi.advanceTimersByTimeAsync(delay);
      const event = harness.tap();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(event.preventDefault).toHaveBeenCalledOnce();
      expect(harness.getUserMedia).toHaveBeenCalledOnce();
      expect(harness.fetch).toHaveBeenCalledOnce();
      expect(harness.attributes.get("data-aiasap-early-start-state")).toBe(
        "loading",
      );
    },
  );

  it("guards pre-hydration double taps and the pre/post hydration seam", async () => {
    const harness = createHarness();
    harness.tap();
    harness.tap();
    harness.record().reactReady = true;
    harness.tap();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.getUserMedia).toHaveBeenCalledOnce();
    expect(harness.fetch).toHaveBeenCalledOnce();
    harness.pageHide();
  });

  it("lets a settled recovery re-tap fall through to hydrated React without reminting early", async () => {
    const harness = createHarness({ permission: "deny" });
    const first = harness.tap();
    await adoptEarlyStartRecord(harness.scope as any, harness.record(), {
      onClaim: vi.fn(),
      onGranted: vi.fn(),
      onBlocked: vi.fn(),
      onFailure: vi.fn(),
    });
    harness.record().reactReady = true;
    const second = harness.tap();
    expect(harness.record().settled).toBe(true);
    expect(first.preventDefault).toHaveBeenCalledOnce();
    expect(second.preventDefault).not.toHaveBeenCalled();
    expect(second.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(harness.getUserMedia).toHaveBeenCalledOnce();
    expect(
      harness.fetch.mock.calls.filter(([url]) => url === "/api/start-custom-session"),
    ).toHaveLength(0);
  });

  it("lets React atomically adopt one granted stream and one mint", async () => {
    const harness = createHarness({ holdMint: false });
    harness.tap();
    harness.record().reactReady = true;
    const onClaim = vi.fn();
    const onGranted = vi.fn();
    const result = await adoptEarlyStartRecord(
      harness.scope as any,
      harness.record(),
      {
        onClaim,
        onGranted,
        onBlocked: vi.fn(),
        onFailure: vi.fn(),
      },
    );
    expect(result).toBe(true);
    expect(onClaim).toHaveBeenCalledOnce();
    expect(onGranted).toHaveBeenCalledOnce();
    expect(harness.getUserMedia).toHaveBeenCalledOnce();
    expect(harness.fetch).toHaveBeenCalledOnce();
    expect((harness.scope as any).__AIASAP_STARTUP_TIMING__.marks.tap).toBeTruthy();
    expect(
      (harness.scope as any).__AIASAP_STARTUP_TIMING__.marks.microphone_granted,
    ).toBeTruthy();
    expect(
      (harness.scope as any).__AIASAP_STARTUP_TIMING__.marks.mint_complete,
    ).toBeTruthy();
    expect(harness.stop).toHaveBeenCalledOnce();
    expect(harness.attributes.has("data-aiasap-early-start-state")).toBe(false);
    harness.pageHide();
    expect(
      harness.fetch.mock.calls.filter(([url]) => url === "/api/stop-session"),
    ).toHaveLength(0);
    expect(
      await adoptEarlyStartRecord(harness.scope as any, harness.record(), {
        onClaim,
        onGranted,
        onBlocked: vi.fn(),
        onFailure: vi.fn(),
      }),
    ).toBe(false);
  });

  it("never begins a mint on denial and exposes the identical denied recovery", async () => {
    const harness = createHarness({ permission: "deny" });
    harness.tap();
    await vi.waitFor(() =>
      expect(harness.attributes.has("data-aiasap-early-start-state")).toBe(false),
    );
    expect(harness.record().abortController?.signal.aborted).toBe(true);
    const onBlocked = vi.fn();
    await adoptEarlyStartRecord(harness.scope as any, harness.record(), {
      onClaim: vi.fn(),
      onGranted: vi.fn(),
      onBlocked,
      onFailure: vi.fn(),
    });
    expect(onBlocked).toHaveBeenCalledWith("denied");
    expect(harness.record().abortController?.signal.aborted).toBe(true);
    expect(harness.getUserMedia).toHaveBeenCalledOnce();
    expect(harness.fetch).not.toHaveBeenCalled();
  });

  it("aborts unclaimed work and clears the early loader on pagehide", async () => {
    const harness = createHarness();
    harness.tap();
    harness.pageHide();
    expect(harness.record().cancelReason).toBe("pagehide");
    expect(harness.record().abortController?.signal.aborted).toBe(true);
    expect(harness.attributes.has("data-aiasap-early-start-state")).toBe(false);
  });

  it("keeps pagehide cancellation active after React claims held work", async () => {
    const harness = createHarness();
    harness.tap();
    const onFailure = vi.fn();
    const adoption = adoptEarlyStartRecord(harness.scope as any, harness.record(), {
      onClaim: vi.fn(),
      onGranted: vi.fn(),
      onBlocked: vi.fn(),
      onFailure,
    });
    await Promise.resolve();
    harness.pageHide();
    await adoption;
    expect(harness.record().abortController?.signal.aborted).toBe(true);
    expect(harness.record().settled).toBe(true);
    expect(onFailure).toHaveBeenCalledWith(null, true);
    expect(harness.stop).toHaveBeenCalledOnce();
  });

  it("keeps the hard timeout active after React claims held work", async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    harness.tap();
    const adoption = adoptEarlyStartRecord(harness.scope as any, harness.record(), {
      onClaim: vi.fn(),
      onGranted: vi.fn(),
      onBlocked: vi.fn(),
      onFailure: vi.fn(),
    });
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(45_000);
    await adoption;
    expect(harness.record().cancelReason).toBe("timeout");
    expect(harness.record().abortController?.signal.aborted).toBe(true);
    expect(harness.record().settled).toBe(true);
  });

  it("clears an insecure early loader and retains bounded pagehide cleanup", async () => {
    const harness = createHarness({ secure: false });
    harness.tap();
    await vi.waitFor(() =>
      expect(harness.attributes.has("data-aiasap-early-start-state")).toBe(false),
    );
    expect(harness.getUserMedia).not.toHaveBeenCalled();
    expect(harness.fetch).not.toHaveBeenCalled();
    harness.pageHide();
    expect(harness.record().cancelReason).toBe("pagehide");
  });

  it("never grants a token when pagehide wins the mint-settlement seam", async () => {
    const harness = createHarness();
    harness.tap();
    const onGranted = vi.fn();
    const onFailure = vi.fn();
    const adoption = adoptEarlyStartRecord(harness.scope as any, harness.record(), {
      onClaim: vi.fn(),
      onGranted,
      onBlocked: vi.fn(),
      onFailure,
    });
    await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledOnce());
    harness.releaseMint({
      ok: true,
      json: async () => ({ session_token: "intercepted-token" }),
    });
    harness.pageHide();
    await adoption;
    expect(onGranted).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith(null, true);
    expect(harness.attributes.has("data-aiasap-early-start-state")).toBe(false);
  });

  it("stops exactly once when a minted session is abandoned before React adopts it", async () => {
    const harness = createHarness({ holdMint: false });
    harness.tap();
    await vi.waitFor(() =>
      expect(
        harness.fetch.mock.calls.filter(([url]) => url === "/api/start-custom-session"),
      ).toHaveLength(1),
    );
    await harness.record().mintPromise;
    harness.pageHide();
    await vi.waitFor(() =>
      expect(
        harness.fetch.mock.calls.filter(([url]) => url === "/api/stop-session"),
      ).toHaveLength(1),
    );
    const stopCall = harness.fetch.mock.calls.find(
      ([url]) => url === "/api/stop-session",
    );
    expect(JSON.parse((stopCall?.[1] as RequestInit).body as string)).toEqual({
      session_token: "intercepted-token",
    });
    expect((stopCall?.[1] as RequestInit).keepalive).toBe(true);
    harness.pageHide();
    expect(
      harness.fetch.mock.calls.filter(([url]) => url === "/api/stop-session"),
    ).toHaveLength(1);
  });

  it("stops exactly once when a minted unclaimed session reaches the hard timeout", async () => {
    vi.useFakeTimers();
    const harness = createHarness({ holdMint: false });
    harness.tap();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await harness.record().mintPromise;
    await vi.advanceTimersByTimeAsync(45_000);
    await harness.record().cleanupPromise;
    expect(harness.record().cancelReason).toBe("timeout");
    expect(
      harness.fetch.mock.calls.filter(([url]) => url === "/api/stop-session"),
    ).toHaveLength(1);
  });

  it("evaluates the serialized bridge in an isolated scope with no module dependencies", () => {
    const harness = createHarness();
    const source = getEarlyStartBridgeSource();
    const isolatedWindow = { ...harness.scope, __AIASAP_EARLY_START__: undefined };
    const isolatedDocument = {
      documentElement: { setAttribute: vi.fn(), removeAttribute: vi.fn() },
      fonts: { ready: Promise.resolve() },
      querySelector: vi.fn().mockReturnValue(null),
      addEventListener: vi.fn(),
    };
    expect(() =>
      vm.runInNewContext(source, {
        window: isolatedWindow,
        document: isolatedDocument,
        URLSearchParams,
        Intl,
        AbortController,
        DOMException,
        Promise,
        Date,
      }),
    ).not.toThrow();
    expect(isolatedDocument.addEventListener).toHaveBeenCalledWith(
      "click",
      expect.any(Function),
      true,
    );
  });

  it("keeps first-frame START visible and enabled while the loader stays hidden", () => {
    const controls = read("src/components/StageControls.tsx");
    const demo = read("src/components/LiveAvatarDemo.tsx");
    const layout = read("app/layout.tsx");
    const css = read("app/globals.css");
    expect(controls).toContain('data-aiasap-early-start={earlyStartBridge ? "1" : undefined}');
    expect(controls).not.toContain("disabled={dormant || disabledStopStart || !startupStartReady}");
    expect(demo).toContain("earlyStartBridge={showsInitialIdle}");
    expect(demo).toContain('data-six-early-start-loader="1"');
    expect(layout).toMatch(/\[data-six-early-start-loader\] \{[\s\S]*?display: flex;[\s\S]*?visibility: hidden;[\s\S]*?opacity: 0;[\s\S]*?pointer-events: none;/);
    expect(layout).toContain('data-six-initial-idle] > :not([data-six-stage-media="1"])');
    expect(layout).toMatch(/data-six-stage-media="1"\]\) \{[\s\S]*?visibility: hidden;/);
    expect(layout).toMatch(/data-aiasap-early-start-state="loading"\] \[data-six-early-start-loader\] \{[\s\S]*?visibility: visible;[\s\S]*?opacity: 1;/);
    expect(layout).not.toMatch(/data-six-(?:initial-idle|early-start-loader)[^}]*display: none/);
    expect(demo).toContain('data-six-early-start-loader="1"');
    expect(demo).toMatch(/data-six-early-start-loader="1"[\s\S]*?bg-transparent/);
    expect(layout).toMatch(/\[data-six-early-start-loader\] \{[\s\S]*?background: #1f1005;/);
    expect(css).toMatch(/\[data-six-loading-only="1"\],[\s\S]*?\[data-six-early-start-loader\],[\s\S]*?background: #1f1005;/);
    expect(layout).toContain('id="aiasap-early-start-bridge"');
    expect(layout).toContain("dangerouslySetInnerHTML");
    expect(layout).not.toContain('strategy="beforeInteractive"');
  });

  it("pins the pre-React loader fitter to the rendered shared label width", () => {
    const indicator = read("src/components/SixLoadingIndicator.tsx");
    const bridge = read("src/lib/voice/earlyStartBridge.ts");
    expect(indicator).toContain("const targetWidth = label.getBoundingClientRect().width");
    expect(bridge).toContain("[data-six-early-start-loader] [data-six-loading-label]");
    expect(bridge).toContain("const targetWidth = label.getBoundingClientRect().width");
    expect(bridge).not.toContain("? 292.5");
    expect(bridge).not.toContain(": 146.25");
    expect(bridge).toContain("targetWidth / naturalWidth");
  });

  it("keeps returned and await-return START owners post-hydration only", () => {
    const demo = read("src/components/LiveAvatarDemo.tsx");
    const initialPredicate = demo.slice(
      demo.indexOf("const showsInitialIdle"),
      demo.indexOf("const showsReturnedIdle"),
    );
    expect(initialPredicate).toContain("!awaitReturnTap");
    expect(initialPredicate).not.toContain("pausedOnStage");
    expect(demo).toContain("earlyStartBridge={showsInitialIdle}");
    expect(demo).not.toContain("earlyStartBridge={showsReturnedIdle}");
  });
});
