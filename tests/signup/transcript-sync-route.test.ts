import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/apiRouteSecurity", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../src/lib/apiRouteSecurity")
  >();
  return {
    ...actual,
    assertAllowedOrigin: () => null,
  };
});
vi.mock("../../src/lib/rateLimit", () => ({
  checkRateLimit: vi.fn(async () => null),
}));
vi.mock("../../src/lib/supabaseAdmin", () => ({
  getSupabaseAdminConfig: () => ({
    url: "https://supabase.invalid",
    serviceRoleKey: "test-service-role",
  }),
}));
vi.mock("../../src/lib/auth/getUser", () => ({
  getUserId: vi.fn(async () => null),
}));

type FetchCall = { url: string; method: string; body: unknown };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("official transcript sync is observational for signup", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("stores transcript evidence but cannot create users, links, or email sends", async () => {
    vi.stubEnv("LIVEAVATAR_API_KEY", "test-liveavatar-key");
    vi.stubEnv("LIVEAVATAR_API_URL", "https://liveavatar.invalid");
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    vi.stubEnv("SUPABASE_URL", "https://supabase.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");

    const calls: FetchCall[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        const body =
          typeof init?.body === "string" ? JSON.parse(init.body) : null;
        calls.push({ url, method, body });

        if (url.startsWith("https://liveavatar.invalid/v1/sessions/")) {
          return jsonResponse({
            code: 100,
            data: {
              session_active: true,
              next_timestamp: 40,
              transcript_data: [
                {
                  role: "avatar",
                  transcript: "Want me to send the sign-in link?",
                  absolute_timestamp: 10,
                },
                {
                  role: "user",
                  transcript: "Yes, send it.",
                  absolute_timestamp: 20,
                },
                {
                  role: "user",
                  transcript: "provider-wrong@example.com",
                  absolute_timestamp: 30,
                },
                {
                  role: "avatar",
                  transcript: "I'm sending the link to your email.",
                  absolute_timestamp: 40,
                },
              ],
            },
          });
        }
        if (url.includes("/auth/v1/admin/generate_link")) {
          return jsonResponse({ hashed_token: "test-hash" });
        }
        return jsonResponse([]);
      }),
    );

    const { POST } = await import(
      "../../app/api/liveavatar/session-transcript/sync/route"
    );
    const response = await POST(
      new Request("https://aiasap.invalid/api/liveavatar/session-transcript/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://aiasap.invalid",
        },
        body: JSON.stringify({
          liveAvatarSessionId: "session-observational",
          clientManagedSignup: false,
        }),
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(response.status).toBe(200);
    expect(
      calls.some(
        (call) =>
          call.method === "POST" &&
          call.url.includes("/rest/v1/conversation_messages"),
      ),
    ).toBe(true);

    const forbidden = calls.filter(
      (call) =>
        call.url.includes("/auth/v1/admin/users") ||
        call.url.includes("/auth/v1/admin/generate_link") ||
        call.url.includes("api.resend.com") ||
        call.url.includes("/rest/v1/lead_sessions") ||
        call.url.includes("/rest/v1/contact_entities") ||
        call.url.includes("/rest/v1/transcript_events"),
    );
    expect(forbidden).toEqual([]);
  });
});
