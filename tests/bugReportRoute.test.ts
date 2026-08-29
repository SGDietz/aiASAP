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
vi.mock("../src/lib/auth/getUser", () => ({
  getUserId: vi.fn(async () => "00000000-0000-4000-8000-000000000001"),
}));
vi.mock("../src/lib/supabaseAdmin", () => ({
  getSupabaseAdminConfig: () => ({
    url: "https://supabase.invalid",
    serviceRoleKey: "test-service-role",
  }),
}));
vi.mock("../src/lib/emailSenders", () => ({
  sendPurposeEmail: vi.fn(async () => ({ ok: true, error: null })),
}));
vi.mock("../src/lib/observability/serverLogger", () => ({
  captureServerError: vi.fn(async () => {}),
}));

function request(body: Record<string, unknown>): Request {
  return new Request("https://aiasap.invalid/api/bug-report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://aiasap.invalid",
    },
    body: JSON.stringify(body),
  });
}

describe("bug-report persistence honesty", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    process.env.BUG_EMAILS_ENABLED = "true";
    process.env.AIASAP_FOUNDER_REPORT_EMAIL = "founder@example.invalid";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BUG_EMAILS_ENABLED;
    delete process.env.AIASAP_FOUNDER_REPORT_EMAIL;
  });

  it("returns persisted:true and writes both legacy and current aliases", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("../app/api/bug-report/route");
    const response = await POST(
      request({
        trigger_text: "the top button does nothing",
        session_id: "session-1",
        transcript: [{ role: "user", text: "it failed" }],
        list_snapshot: ["milk"],
        device: { deviceKind: "phone" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      persisted: true,
      emailed: true,
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      summary: "the top button does nothing",
      trigger_text: "the top button does nothing",
      active_list: ["milk"],
      list_snapshot: ["milk"],
      emailed: true,
    });
    expect(body.transcript).toEqual([{ role: "user", text: "it failed" }]);
  });

  it("returns an honest generic 500 on a Supabase non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({ code: "PGRST204", detail: "private schema detail" }),
          { status: 400 },
        ),
      ),
    );

    const { POST } = await import("../app/api/bug-report/route");
    const response = await POST(
      request({ trigger_text: "does not work right" }),
    );

    expect(response.status).toBe(500);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      ok: false,
      persisted: false,
      error: "Bug report could not be saved",
    });
    expect(JSON.stringify(payload)).not.toContain("private schema detail");
  });

  it("keeps email best-effort separate from persistence", async () => {
    process.env.BUG_EMAILS_ENABLED = "false";
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(null, { status: 201 }),
      ),
    );

    const { POST } = await import("../app/api/bug-report/route");
    const response = await POST(request({ trigger_text: "speaker failed" }));

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      persisted: true,
      emailed: false,
    });
  });

  it("rejects an empty trigger before any persistence call", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("../app/api/bug-report/route");
    const response = await POST(request({ trigger_text: "" }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
