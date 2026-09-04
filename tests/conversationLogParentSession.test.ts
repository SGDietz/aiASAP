import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/apiRouteSecurity", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../src/lib/apiRouteSecurity")
  >();
  return { ...actual, assertAllowedOrigin: () => null };
});
vi.mock("../src/lib/rateLimit", () => ({
  checkRateLimit: vi.fn(async () => null),
}));
vi.mock("../src/lib/supabaseAdmin", () => ({
  getSupabaseAdminConfig: () => ({
    url: "https://supabase.invalid",
    serviceRoleKey: "test-service-role",
  }),
}));
vi.mock("../src/lib/testerAttribution", () => ({
  normalizeTesterLabel: () => null,
}));

type Call = { url: string; body: unknown; prefer?: string };

function request(body: Record<string, unknown>): Request {
  return new Request("https://aiasap.invalid/api/conversation/log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://aiasap.invalid",
    },
    body: JSON.stringify(body),
  });
}

describe("conversation parent-session lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("attempts an idempotent parent insert before the child message", async () => {
    const calls: Call[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string> | undefined;
        calls.push({
          url: String(input),
          body: JSON.parse(String(init?.body)),
          prefer: headers?.Prefer,
        });
        return new Response(null, { status: 201 });
      }),
    );

    const { POST } = await import("../app/api/conversation/log/route");
    const response = await POST(
      request({ sessionId: "session-parent", role: "user", text: "hello" }),
    );

    expect(response.status).toBe(200);
    expect(calls[0]?.url).toContain(
      "/conversation_sessions?on_conflict=session_id",
    );
    expect(calls[0]?.prefer).toContain("resolution=ignore-duplicates");
    expect(calls[0]?.body).toEqual({
      session_id: "session-parent",
      source: "liveavatar",
    });
    expect(calls[1]?.url).toContain("/conversation_messages");
  });

  it("preserves message capture and reports parentPersisted:false", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.includes("conversation_sessions")) {
          return new Response("parent unavailable", { status: 409 });
        }
        return new Response(null, { status: 201 });
      }),
    );

    const { POST } = await import("../app/api/conversation/log/route");
    const response = await POST(
      request({ sessionId: "session-orphan", role: "user", text: "keep me" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      parentPersisted: false,
    });
    expect(calls.some((url) => url.includes("conversation_messages"))).toBe(
      true,
    );
  });

  it("fails honestly when the child message insert fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes("conversation_sessions")
          ? new Response(null, { status: 201 })
          : new Response("child failed", { status: 400 }),
      ),
    );

    const { POST } = await import("../app/api/conversation/log/route");
    const response = await POST(
      request({ sessionId: "session-child", role: "assistant", text: "reply" }),
    );

    expect(response.status).toBe(500);
  });
});
