import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/apiRouteSecurity", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../src/lib/apiRouteSecurity")
  >();
  return {
    ...actual,
    assertAllowedOrigin: () => null,
  };
});
vi.mock("../src/lib/rateLimit", () => ({
  checkRateLimit: vi.fn(async () => null),
}));
vi.mock("../src/lib/auth/getUser", () => ({
  getUserId: vi.fn(async () => "founder-private-uuid"),
}));
vi.mock("../src/lib/supabaseAdmin", () => ({
  getSupabaseAdminConfig: () => ({
    url: "https://supabase.invalid",
    serviceRoleKey: "test-service-role",
  }),
}));
vi.mock("../src/lib/testerAttribution", () => ({
  normalizeTesterLabel: () => "founder",
}));

describe("app-events route legacy-schema fallback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries a missing-column response with only live columns and correlation in payload", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: "PGRST204",
            message:
              "Could not find the 'user_id' column of 'app_events' in the schema cache",
          }),
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("../app/api/app-events/log/route");
    const response = await POST(
      new Request("https://aiasap.invalid/api/app-events/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://aiasap.invalid",
          "User-Agent": "private-test-agent",
        },
        body: JSON.stringify({
          session_id: "synthetic-session-1",
          event_type: "voice_avatar_speak_started",
          route: "/synthetic",
          severity: "low",
          provider: "heygen",
          event_id: "synthetic-event-1",
          utterance_id: "synthetic-utterance-1",
          outcome: "started",
          duration_ms: 321,
          payload: {
            stage: "sdk_speak_started",
            transcript: "must-not-be-added-by-fallback",
          },
        }),
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(
      String((fetchMock.mock.calls[0]?.[1] as RequestInit).body),
    ) as Record<string, unknown>;
    expect(firstBody).toMatchObject({
      user_id: "founder-private-uuid",
      tester_label: "founder",
      event_id: "synthetic-event-1",
      utterance_id: "synthetic-utterance-1",
    });

    const secondBody = JSON.parse(
      String((fetchMock.mock.calls[1]?.[1] as RequestInit).body),
    ) as Record<string, unknown>;
    expect(Object.keys(secondBody).sort()).toEqual(
      ["event_type", "payload", "route", "session_id"].sort(),
    );
    expect(secondBody).toMatchObject({
      session_id: "synthetic-session-1",
      event_type: "voice_avatar_speak_started",
      route: "/synthetic",
      payload: {
        stage: "sdk_speak_started",
        event_id: "synthetic-event-1",
        utterance_id: "synthetic-utterance-1",
        outcome: "started",
        duration_ms: 321,
        provider: "heygen",
      },
    });
    expect(JSON.stringify(secondBody)).not.toContain("founder-private-uuid");
    expect(JSON.stringify(secondBody)).not.toContain("private-test-agent");
  });
});
