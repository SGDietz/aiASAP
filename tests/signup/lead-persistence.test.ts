import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/supabaseAdmin", () => ({
  getSupabaseAdminConfig: () => ({
    url: "https://supabase.invalid",
    serviceRoleKey: "test-service-role",
  }),
}));

import { persistUserUtteranceLeadCapture } from "../../src/lib/leadCaptureFromUserText";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("observational lead persistence email authority", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("two concurrent first transcript emails remain evidence and never become canonical writes", async () => {
    const requests: Array<{
      url: string;
      method: string;
      body: unknown;
    }> = [];
    let leadReads = 0;
    const waitingLeadReads: Array<() => void> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        const body =
          typeof init?.body === "string" ? JSON.parse(init.body) : null;
        requests.push({ url, method, body });

        if (url.includes("/rest/v1/lead_sessions?") && method === "GET") {
          leadReads += 1;
          if (leadReads < 2) {
            await new Promise<void>((resolve) => waitingLeadReads.push(resolve));
          } else {
            waitingLeadReads.splice(0).forEach((resolve) => resolve());
          }
          return jsonResponse([]);
        }
        if (url.includes("/rest/v1/contact_entities?") && method === "GET") {
          return jsonResponse([]);
        }
        return jsonResponse([]);
      }),
    );

    const [first, second] = await Promise.all([
      persistUserUtteranceLeadCapture(
        "session-race",
        "first-wrong@example.com",
      ),
      persistUserUtteranceLeadCapture(
        "session-race",
        "second-wrong@example.com",
      ),
    ]);

    const transcriptWrites = requests.filter(
      (request) =>
        request.method === "POST" &&
        request.url.endsWith("/rest/v1/transcript_events"),
    );
    expect(
      transcriptWrites.map(
        (request) =>
          (request.body as { extracted_email: string }).extracted_email,
      ),
    ).toEqual(
      expect.arrayContaining([
        "first-wrong@example.com",
        "second-wrong@example.com",
      ]),
    );

    const canonicalWrites = requests.filter(
      (request) =>
        request.url.includes("/rest/v1/lead_sessions") ||
        request.url.includes("/rest/v1/contact_entities"),
    );
    for (const request of canonicalWrites) {
      const rows = Array.isArray(request.body) ? request.body : [request.body];
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        expect(row).not.toHaveProperty("email");
      }
    }
    expect(
      canonicalWrites.filter((request) => request.method !== "GET"),
    ).toHaveLength(0);

    expect(first.extracted.email).toBe(null);
    expect(second.extracted.email).toBe(null);
    expect(
      requests.some(
        (request) =>
          request.method !== "GET" &&
          request.url.includes("/rest/v1/contact_entities"),
      ),
    ).toBe(false);
  });
});
