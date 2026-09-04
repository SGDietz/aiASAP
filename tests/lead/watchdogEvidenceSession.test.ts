/**
 * Regression for the LiveAvatar session-key defect (independent audit,
 * 2026-09-03): the watchdog's `submit_contact` path must load conversation
 * turns AND media events by `conversation_session_id ?? session_id`, matching
 * the write-side persistence. Loading by the opportunity's own `session_id`
 * when a distinct conversation id exists yields empty evidence, so the
 * founder subject/topic falls back to the neutral string even though the
 * visitor DID have a substantive project conversation.
 *
 * This test inspects actual outbound fetch calls the route makes — not just
 * source substrings — and proves that opportunity-session evidence cannot
 * contaminate a different conversation-session lead.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../../src/lib/apiRouteSecurity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/apiRouteSecurity")>();
  return { ...actual, assertAllowedOrigin: () => null };
});
vi.mock("../../src/lib/rateLimit", () => ({ checkRateLimit: vi.fn(async () => null) }));
vi.mock("../../src/lib/auth/getUser", () => ({ getUser: vi.fn(async () => null) }));
vi.mock("../../src/lib/supabaseAdmin", () => ({
  getSupabaseAdminConfig: () => ({ url: "https://supabase.invalid", serviceRoleKey: "test-key" }),
}));
vi.mock("../../src/lib/testerAttribution", () => ({ normalizeTesterLabel: () => null }));

const OPP = {
  id: "44444444-4444-4444-8444-444444444444",
  session_id: "opp-key-A",
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
    headers: {
      "Content-Type": "application/json",
      Origin: "https://aiasap.invalid",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify(body),
  });
}

describe("watchdog evidence loads by conversation_session_id, not session_id", () => {
  const OLD = { ...process.env };
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    process.env = { ...OLD };
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    process.env = OLD;
  });

  it("loads conversation_messages and media_events by conversation_session_id when it differs from session_id", async () => {
    vi.stubEnv("TEAM_EMAILS_ENABLED", "false");
    vi.stubEnv("VISITOR_EMAILS_ENABLED", "false");
    const conversationSessionId = "conv-session-B";
    const oppSessionId = "opp-key-A";
    const convMessageCalls: string[] = [];
    const mediaCalls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("visitor_opportunities?session_id")) {
          return Response.json([OPP]);
        }
        if (url.includes("rpc/submit_opportunity_contact")) {
          return Response.json({ ok: true, opportunity_id: OPP.id });
        }
        if (url.includes("/rest/v1/conversation_messages")) {
          convMessageCalls.push(url);
          // Only respond with substantive project talk when the CORRECT
          // conversation session id was queried. If the route mistakenly
          // queried the opportunity's own session id, return empty rows.
          if (url.includes(`session_id=eq.${encodeURIComponent(conversationSessionId)}`)) {
            return Response.json([
              { role: "user", message: "we want a front porch flagstone landing and matching beds" },
              { role: "assistant", message: "great, tell me more" },
            ]);
          }
          return Response.json([
            { role: "user", message: "leaked opportunity-only chatter that must not appear anywhere" },
          ]);
        }
        if (url.includes("/rest/v1/media_events")) {
          mediaCalls.push(url);
          return Response.json([]);
        }
        if (url.includes("opportunity_notification_outbox")) {
          const method = init?.method ?? "GET";
          if (method === "GET") return Response.json([]);
          if (method === "POST") return Response.json([], { status: 201 });
          if (method === "PATCH") return Response.json([]);
        }
        if (url.includes("rpc/claim_opportunity_follow_up")) return Response.json([]);
        if (url.includes("visitor_opportunities?id")) return Response.json([OPP]);
        return new Response(null, { status: 200 });
      }),
    );
    const { POST } = await import("../../app/api/opportunity-watchdog/route");
    const res = await POST(
      req({
        action: "submit_contact",
        session_id: oppSessionId,
        conversation_session_id: conversationSessionId,
        method: "email",
        value: "sam@example.invalid",
        exact_package_consent: true,
        contact_readback_confirmed: true,
        readback_confirmed_at: "2026-09-03T20:00:00Z",
        follow_up_authorized_at: "2026-09-03T20:00:01Z",
        full_name: "Sam Sample",
      }),
    );
    expect(res.status).toBe(200);

    // conversation_messages was queried by the CONVERSATION id, never by the
    // opportunity id — otherwise opportunity-only chatter could leak into a
    // different conversation-session lead.
    expect(convMessageCalls.length).toBeGreaterThanOrEqual(1);
    for (const url of convMessageCalls) {
      expect(url).toContain(`session_id=eq.${encodeURIComponent(conversationSessionId)}`);
      expect(url).not.toContain(`session_id=eq.${encodeURIComponent(oppSessionId)}`);
    }
    // media_events queried by the CONVERSATION id as well.
    expect(mediaCalls.length).toBeGreaterThanOrEqual(1);
    for (const url of mediaCalls) {
      expect(url).toContain(`session_id=eq.${encodeURIComponent(conversationSessionId)}`);
      expect(url).not.toContain(`session_id=eq.${encodeURIComponent(oppSessionId)}`);
    }
  });

  it("falls back to opportunity session_id when no conversation_session_id was provided", async () => {
    vi.stubEnv("TEAM_EMAILS_ENABLED", "false");
    vi.stubEnv("VISITOR_EMAILS_ENABLED", "false");
    const oppSessionId = "opp-key-A";
    const convMessageCalls: string[] = [];
    const mediaCalls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("visitor_opportunities?session_id")) return Response.json([OPP]);
        if (url.includes("rpc/submit_opportunity_contact")) {
          return Response.json({ ok: true, opportunity_id: OPP.id });
        }
        if (url.includes("/rest/v1/conversation_messages")) {
          convMessageCalls.push(url);
          return Response.json([]);
        }
        if (url.includes("/rest/v1/media_events")) {
          mediaCalls.push(url);
          return Response.json([]);
        }
        if (url.includes("opportunity_notification_outbox")) {
          const method = init?.method ?? "GET";
          if (method === "GET") return Response.json([]);
          if (method === "POST") return Response.json([], { status: 201 });
          if (method === "PATCH") return Response.json([]);
        }
        if (url.includes("rpc/claim_opportunity_follow_up")) return Response.json([]);
        if (url.includes("visitor_opportunities?id")) return Response.json([OPP]);
        return new Response(null, { status: 200 });
      }),
    );
    const { POST } = await import("../../app/api/opportunity-watchdog/route");
    const res = await POST(
      req({
        action: "submit_contact",
        session_id: oppSessionId,
        method: "email",
        value: "sam@example.invalid",
        exact_package_consent: true,
        contact_readback_confirmed: true,
        readback_confirmed_at: "2026-09-03T20:00:00Z",
        follow_up_authorized_at: "2026-09-03T20:00:01Z",
        full_name: "Sam Sample",
      }),
    );
    expect(res.status).toBe(200);
    for (const url of convMessageCalls) {
      expect(url).toContain(`session_id=eq.${encodeURIComponent(oppSessionId)}`);
    }
    for (const url of mediaCalls) {
      expect(url).toContain(`session_id=eq.${encodeURIComponent(oppSessionId)}`);
    }
  });
});
