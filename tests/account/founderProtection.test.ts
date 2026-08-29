import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/supabaseAdmin", () => ({
  getSupabaseAdminConfig: () => ({
    url: "https://example.supabase.co",
    serviceRoleKey: "test-service-role-key",
  }),
}));

import {
  assertDestructiveActionAllowed,
  checkDestructiveActionAllowed,
  getAccountProtection,
} from "../../src/lib/accountProtection";

const FOUNDER_UUID = "11111111-1111-4111-8111-111111111111";
const OTHER_UUID = "22222222-2222-4222-8222-222222222222";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("UUID-bound account protection", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks the exact protected auth UUID without consulting email or session identity", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain(`user_id=eq.${FOUNDER_UUID}`);
      expect(url).not.toContain("email=");
      expect(url).not.toContain("session");
      return jsonResponse([
        {
          user_id: FOUNDER_UUID,
          protection_class: "founder_permanent",
          canonical_email: "founder@example.test",
        },
      ]);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      checkDestructiveActionAllowed(FOUNDER_UUID, "memory_wipe"),
    ).resolves.toMatchObject({
      allowed: false,
      code: "protected_account",
      protectionClass: "founder_permanent",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not grant founder authority to a different UUID", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain(`user_id=eq.${OTHER_UUID}`);
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      checkDestructiveActionAllowed(OTHER_UUID, "account_delete"),
    ).resolves.toEqual({ allowed: true });
  });

  it.each([
    ["network failure", () => Promise.reject(new Error("offline"))],
    ["registry 500", () => Promise.resolve(jsonResponse({}, 500))],
    ["malformed response", () => Promise.resolve(jsonResponse({ protected: true }))],
    [
      "ambiguous duplicate rows",
      () =>
        Promise.resolve(
          jsonResponse([
            { user_id: FOUNDER_UUID, protection_class: "founder_permanent" },
            { user_id: FOUNDER_UUID, protection_class: "founder_permanent" },
          ]),
        ),
    ],
  ])("fails closed on %s", async (_label, implementation) => {
    vi.stubGlobal("fetch", vi.fn(implementation));
    await expect(
      checkDestructiveActionAllowed(FOUNDER_UUID, "account_delete"),
    ).resolves.toMatchObject({
      allowed: false,
      code: "protection_lookup_failed",
    });
  });

  it("treats invalid auth UUID input as a fail-closed lookup error", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      checkDestructiveActionAllowed("session-id-not-an-auth-uuid", "cron_purge"),
    ).resolves.toMatchObject({
      allowed: false,
      code: "protection_lookup_failed",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a registry row whose UUID does not match the requested auth UUID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse([
          { user_id: OTHER_UUID, protection_class: "founder_permanent" },
        ]),
      ),
    );
    await expect(getAccountProtection(FOUNDER_UUID)).rejects.toThrow(
      /ambiguous|invalid/i,
    );
  });

  it("throws a stable machine-readable block before a destructive primitive runs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse([
          { user_id: FOUNDER_UUID, protection_class: "founder_permanent" },
        ]),
      ),
    );
    await expect(
      assertDestructiveActionAllowed(FOUNDER_UUID, "direct_purge"),
    ).rejects.toMatchObject({
      name: "AccountProtectionBlockedError",
      code: "protected_account",
    });
  });
});