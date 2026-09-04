import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../src/lib/apiRouteSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/apiRouteSecurity")>();
  return { ...actual, assertAllowedOrigin: () => null };
});
vi.mock("../src/lib/rateLimit", () => ({ checkRateLimit: vi.fn(async () => null) }));
vi.mock("../src/lib/auth/getUser", () => ({ getUser: vi.fn(async () => null) }));
vi.mock("../src/lib/supabaseAdmin", () => ({
  getSupabaseAdminConfig: () => ({ url: "https://supabase.invalid", serviceRoleKey: "test-key" }),
}));
vi.mock("../src/lib/testerAttribution", () => ({ normalizeTesterLabel: () => null }));

const opportunity = {
  id: "11111111-1111-4111-8111-111111111111",
  session_id: "opp-public-1",
  visitor_state: "detected",
  opportunity_state: "none",
  contact_state: "absent",
  account_state: "anonymous",
  discovery_stage: "arrival",
  terminal_at: null,
  grace_until: null,
  end_reason: null,
  summary: { meaningfulTurns: 0 },
  operator_excluded: false,
};

function req(body: Record<string, unknown>) {
  return new NextRequest("https://aiasap.invalid/api/opportunity-watchdog", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://aiasap.invalid", "x-forwarded-for": "203.0.113.10" },
    body: JSON.stringify(body),
  });
}

describe("opportunity watchdog route idempotency", () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.resetModules(); });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("queues one first-visitor alert and a refresh/reconnect does not queue another", async () => {
    let exists = false;
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("visitor_opportunities?session_id")) {
        return Response.json(exists ? [opportunity] : []);
      }
      if (url.includes("visitor_opportunities?on_conflict")) {
        exists = true;
        return Response.json([opportunity], { status: 201 });
      }
      if (url.includes("opportunity_notification_outbox")) return new Response(null, { status: 201 });
      if (url.includes("visitor_opportunities?id")) return Response.json([opportunity]);
      throw new Error(`unexpected ${url}`);
    }));
    const { POST } = await import("../app/api/opportunity-watchdog/route");
    expect((await POST(req({ action: "session_started", session_id: "opp-public-1" }))).status).toBe(200);
    expect((await POST(req({ action: "session_started", session_id: "opp-public-1" }))).status).toBe(200);
    expect(calls.filter((url) => url.includes("opportunity_notification_outbox"))).toHaveLength(1);
  });

  it("duplicate confirmed-contact retries return the same submitted opportunity", async () => {
    const rpcBodies: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("visitor_opportunities?session_id")) return Response.json([opportunity]);
      if (url.includes("rpc/submit_opportunity_contact")) {
        rpcBodies.push(JSON.parse(String(init?.body)));
        return Response.json({ ok: true, state: "submitted", opportunity_id: opportunity.id });
      }
      throw new Error(`unexpected ${url}`);
    }));
    const { POST } = await import("../app/api/opportunity-watchdog/route");
    const body = { action: "submit_contact", session_id: "opp-public-1", method: "email", value: "redacted@example.invalid", exact_package_consent: true, contact_readback_confirmed: true, readback_confirmed_at: "2026-09-03T20:00:00Z", follow_up_authorized_at: "2026-09-03T20:00:01Z" };
    const first = await POST(req(body));
    const second = await POST(req(body));
    await expect(first.json()).resolves.toMatchObject({ submitted: true, opportunity_id: opportunity.id });
    await expect(second.json()).resolves.toMatchObject({ submitted: true, opportunity_id: opportunity.id });
    expect(rpcBodies).toHaveLength(2);
    expect(rpcBodies[0]).toEqual(rpcBodies[1]);
  });

  it("persists and reports the awaited founder-email receipt after confirmed contact", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    vi.stubEnv("AIASAP_FOUNDER_REPORT_EMAIL", "founder@example.invalid");
    vi.stubEnv("TEAM_EMAILS_ENABLED", "true");
    const outbox = {
      id: "22222222-2222-4222-8222-222222222222",
      opportunity_id: opportunity.id,
      event_kind: "follow_up_requested",
      dedupe_key: `follow_up_requested:${opportunity.id}`,
      payload: {
        sessionReviewRef: "/admin/sessions/opp-public-1",
        contactMethod: "email",
        contactValue: "redacted@example.invalid",
        fullName: "Pat",
        sessionId: "opp-public-1",
      },
      status: "queued",
      attempt_count: 0,
      provider_id: null as string | null,
      error: null as string | null,
      next_attempt_at: null as string | null,
      sent_at: null as string | null,
    };
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("visitor_opportunities?session_id")) return Response.json([opportunity]);
      if (url.includes("rpc/submit_opportunity_contact")) {
        return Response.json({ ok: true, state: "submitted", opportunity_id: opportunity.id });
      }
      if (url.includes("rpc/claim_opportunity_follow_up")) {
        const claim = JSON.parse(String(init?.body)) as Record<string, unknown>;
        Object.assign(outbox, {
          status: "sending",
          attempt_count: 1,
          lease_token: claim.p_lease_token,
          lease_expires_at: claim.p_lease_expires_at,
        });
        return Response.json([outbox]);
      }
      if (url.includes("opportunity_notification_outbox")) {
        const method = init?.method ?? "GET";
        if (method === "POST") return Response.json([outbox], { status: 201 });
        if (method === "GET" && url.includes("dedupe_key=eq.")) return Response.json([outbox]);
        if (method === "GET") return Response.json([]);
        if (method === "PATCH") {
          const patch = JSON.parse(String(init?.body)) as Record<string, unknown>;
          Object.assign(outbox, patch);
          return Response.json([outbox]);
        }
      }
      if (url === "https://api.resend.com/emails") {
        return Response.json({ id: "re_local_receipt" });
      }
      throw new Error(`unexpected ${url}`);
    }));
    const { POST } = await import("../app/api/opportunity-watchdog/route");
    const response = await POST(req({
      action: "submit_contact",
      session_id: "opp-public-1",
      method: "email",
      value: "redacted@example.invalid",
      full_name: "Pat",
      exact_package_consent: true,
      contact_readback_confirmed: true,
      readback_confirmed_at: "2026-09-03T20:00:00Z",
      follow_up_authorized_at: "2026-09-03T20:00:01Z",
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      submitted: true,
      notified: true,
      notify_status: "sent",
      provider_id: "re_local_receipt",
      notify_error: null,
    });
    expect(outbox.status).toBe("sent");
    expect(outbox.provider_id).toBe("re_local_receipt");
    expect(calls.filter((call) => call.url === "https://api.resend.com/emails")).toHaveLength(1);
  });

  it("fails closed without claiming submission when the migration is absent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("relation visitor_opportunities does not exist", { status: 404 })));
    const { POST } = await import("../app/api/opportunity-watchdog/route");
    const response = await POST(req({ action: "submit_contact", session_id: "opp-public-1", method: "phone", value: "4105550123", exact_package_consent: true, contact_readback_confirmed: true, readback_confirmed_at: "2026-09-03T20:00:00Z", follow_up_authorized_at: "2026-09-03T20:00:01Z" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ state: "schema_not_applied", submitted: false });
  });
});
