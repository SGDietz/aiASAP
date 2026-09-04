import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertAllowedOrigin } from "../../src/lib/apiRouteSecurity";

const PRIVATE_ORIGINS = [
  "https://mission-control.tail00dfe0.ts.net:9444",
  "https://mission-control.tail00dfe0.ts.net:9446",
] as const;
const INTERNAL_ROUTE = "http://127.0.0.1:1301/api/account/me";

function gatedRequest(
  headers: Record<string, string>,
  url = INTERNAL_ROUTE,
): Request {
  return new Request(url, { headers });
}

describe("production request Origin gate", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(PRIVATE_ORIGINS)(
    "accepts the exact private Tailnet origin %s through the local proxy",
    (privateOrigin) => {
      expect(
        assertAllowedOrigin(gatedRequest({ origin: privateOrigin })),
      ).toBeNull();
      expect(
        assertAllowedOrigin(
          gatedRequest({ referer: `${privateOrigin}/?smoke=private` }),
        ),
      ).toBeNull();
    },
  );

  it.each([
    ["wrong port", "https://mission-control.tail00dfe0.ts.net:9443"],
    ["development-lane port", "https://mission-control.tail00dfe0.ts.net:9445"],
    ["neighbor port", "https://mission-control.tail00dfe0.ts.net:9447"],
    ["deceptive suffix", "https://mission-control.tail00dfe0.ts.net.evil:9444"],
    ["deceptive subdomain", "https://evil.mission-control.tail00dfe0.ts.net:9444"],
    ["scheme mismatch", "http://mission-control.tail00dfe0.ts.net:9444"],
    ["isolated-lane scheme mismatch", "http://mission-control.tail00dfe0.ts.net:9446"],
  ])("rejects the %s Origin", async (_case, origin) => {
    const result = assertAllowedOrigin(gatedRequest({ origin }));
    expect(result?.status).toBe(403);
    await expect(result?.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("rejects a Referer that merely starts with the exact private origin text", async () => {
    const result = assertAllowedOrigin(
      gatedRequest({ referer: `${PRIVATE_ORIGINS[1]}.evil.example/` }),
    );
    expect(result?.status).toBe(403);
    await expect(result?.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it.each(["origin", "referer"] as const)(
    "rejects same-host port 9445 through the %s header",
    async (header) => {
      const rejectedOrigin = "https://mission-control.tail00dfe0.ts.net:9445";
      const value = header === "referer" ? `${rejectedOrigin}/` : rejectedOrigin;
      const result = assertAllowedOrigin(
        gatedRequest(
          { [header]: value },
          `${rejectedOrigin}/api/start-custom-session`,
        ),
      );
      expect(result?.status).toBe(403);
      await expect(result?.json()).resolves.toEqual({ error: "Forbidden" });
    },
  );
});
