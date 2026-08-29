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

  // KEEP EVERYTHING, MAKE IT HONEST (2026-08-21): the real rows of session
  // 03aef2a8. The provider returns one breath as seven pieces plus 6's cut-off
  // reply; the app had already logged both sentences (and 6's full reply)
  // with utterance ids. Every provider row is still stored - labelled as a
  // piece and stamped with the app turn it belongs to. A piece the earlier
  // poll stored before its app row existed is re-linked on this poll.
  it("stores user pieces labelled and linked to the app's turn, never dropped", async () => {
    vi.stubEnv("LIVEAVATAR_API_KEY", "test-liveavatar-key");
    vi.stubEnv("LIVEAVATAR_API_URL", "https://liveavatar.invalid");
    vi.stubEnv("SUPABASE_URL", "https://supabase.invalid");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");

    const iso = (seconds: number) => new Date(seconds * 1000).toISOString();
    const UTT_E1 = "utt-f9283c3a-1111-4111-8111-111111111111";
    const UTT_E2 = "utt-fb700e8b-2222-4222-8222-222222222222";
    const appBorn = [
      {
        id: "a2",
        role: "assistant",
        message: "Hi, I'm 6, your a-i-buddy. What should I call you?",
        source: "app",
        created_at: iso(1787360830.437),
        la_absolute_timestamp: null,
        utterance_id: UTT_E2,
      },
      {
        id: "a1",
        role: "assistant",
        message:
          "So: a cool design for all the buttons and a big red square stop button, keeping the current nice layout.",
        source: "app",
        created_at: iso(1787360826.66),
        la_absolute_timestamp: null,
        utterance_id: UTT_E2,
      },
      {
        id: "e2",
        role: "user",
        message:
          "All the buttons I think they need a cool design and a big red square stop they look great they're laid out nicely",
        source: "app",
        created_at: iso(1787360825.186),
        la_absolute_timestamp: null,
        utterance_id: UTT_E2,
      },
      {
        id: "e1",
        role: "user",
        message:
          "OK we're definitely gonna need to work on that opening line the mute didn't work the first time maybe it's cause this is the first time ever this site's been up with all these changes",
        source: "app",
        created_at: iso(1787360813.085),
        la_absolute_timestamp: null,
        utterance_id: UTT_E1,
      },
    ];
    const storedOrphan = [
      {
        id: "f804",
        message: "Okay, we're definitely going to need to work on that opening line.",
        la_absolute_timestamp: 1787360804,
      },
    ];

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
            code: 1000,
            data: {
              session_active: false,
              next_timestamp: null,
              transcript_data: [
                { role: "user", transcript: "Um, the mute", absolute_timestamp: 1787360805 },
                {
                  role: "user",
                  transcript:
                    "didn't work the first time. Maybe it's because this is the first time ever this site's been up with all these changes.",
                  absolute_timestamp: 1787360811,
                },
                { role: "user", transcript: "Um,", absolute_timestamp: 1787360812 },
                { role: "user", transcript: "All the buttons, I think they need a cool", absolute_timestamp: 1787360815 },
                { role: "user", transcript: "design.", absolute_timestamp: 1787360816 },
                { role: "user", transcript: "And a big red", absolute_timestamp: 1787360818 },
                {
                  role: "user",
                  transcript: "square stop. They look great. They're laid out nice.",
                  absolute_timestamp: 1787360823,
                },
                { role: "avatar", transcript: "So: a cool design for", absolute_timestamp: 1787360829 },
              ],
            },
          });
        }
        if (method === "GET" && url.includes("or=(source.eq.app,event_id.not.is.null)")) {
          return jsonResponse(appBorn);
        }
        if (method === "GET" && url.includes("utterance_id=is.null")) {
          return jsonResponse(storedOrphan);
        }
        if (method === "PATCH" || method === "POST") {
          return new Response(null, { status: 201 });
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
          liveAvatarSessionId: "03aef2a8-dc43-4b50-bb72-d87dd9cec62a",
          startTimestamp: 1787360790,
          clientManagedSignup: false,
        }),
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(response.status).toBe(200);

    // The piece stored by the earlier poll, before its app row existed, is
    // re-linked now - only if still NULL, never overwriting.
    const relink = calls.filter(
      (c) => c.method === "PATCH" && c.url.includes("id=in.(f804)&utterance_id=is.null"),
    );
    expect(relink).toHaveLength(1);
    expect(relink[0].body).toEqual({ utterance_id: UTT_E1 });

    // No exact-text claim happened (different recognizers never equal), so
    // no app row was PATCHed with a timestamp.
    expect(calls.filter((c) => c.method === "PATCH" && c.url.includes("id=eq."))).toEqual([]);

    // Every provider row is inserted: eight in, eight stored.
    const insert = calls.find(
      (c) => c.method === "POST" && c.url.includes("/rest/v1/conversation_messages"),
    );
    expect(insert?.url).toContain("on_conflict=session_id,role,la_absolute_timestamp");
    const stored = insert?.body as Array<Record<string, unknown>>;
    expect(stored).toHaveLength(8);
    const byLa = new Map(stored.map((r) => [r.la_absolute_timestamp as number, r]));

    for (const row of stored) {
      expect(row).not.toHaveProperty("key");
      expect(row).toHaveProperty("utterance_id");
      if (row.role === "user") expect(row.source).toBe("liveavatar_api_fragment");
    }
    expect(byLa.get(1787360805)?.utterance_id).toBe(UTT_E1);
    expect(byLa.get(1787360811)?.utterance_id).toBe(UTT_E1);
    expect(byLa.get(1787360812)?.utterance_id).toBeNull();
    expect(byLa.get(1787360815)?.utterance_id).toBe(UTT_E2);
    expect(byLa.get(1787360816)?.utterance_id).toBe(UTT_E2);
    expect(byLa.get(1787360818)?.utterance_id).toBe(UTT_E2);
    expect(byLa.get(1787360823)?.utterance_id).toBe(UTT_E2);
    // 6 was cut off: the stub is kept as a PARTIAL of the line the app logged.
    expect(byLa.get(1787360829)).toMatchObject({
      role: "assistant",
      source: "liveavatar_api_partial",
      utterance_id: UTT_E2,
      message: "So: a cool design for",
    });
  });
});
