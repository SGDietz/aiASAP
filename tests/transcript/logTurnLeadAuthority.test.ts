import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// COMMIT 3eb5e4ca (2026-08-21) removed persistUserUtteranceLeadCapture from the
// transcript SYNC route and said accepted app turns were now the sole lead and
// profile authority. Nobody added the call to the accepted-app-turn route, so
// from 2026-08-21 nothing wrote leads at all. Physical Android session
// 79317698 on 2026-08-31 is the proof: zero contact_entities, zero
// lead_sessions, while visitor_opportunities kept writing normally.

vi.mock("../../src/lib/apiRouteSecurity", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../src/lib/apiRouteSecurity")
  >();
  return { ...actual, assertAllowedOrigin: () => null };
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

type FetchCall = {
  url: string;
  method: string;
  body: unknown;
  headers?: HeadersInit;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SESSION = "79317698-60bb-43e0-96f5-cccc5699595d";
const UTT = "utt-aaaaaaaa-1111-4111-8111-111111111111";

/**
 * @param insertedRows what PostgREST answers the transcript insert with.
 *   `[{...}]` = a genuine insert. `[]` = on_conflict ignored a duplicate.
 */
function stubSupabase(calls: FetchCall[], insertedRows: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      calls.push({ url, method, body, headers: init?.headers });

      if (url.includes("/rest/v1/conversation_messages") && method === "POST") {
        return jsonResponse(insertedRows, 201);
      }
      // no stored provider pieces, no existing lead, no existing contact rows
      if (method === "GET") return jsonResponse([]);
      return jsonResponse([], 201);
    }),
  );
}

async function postTurn(message: string, calls: FetchCall[], insertedRows: unknown[]) {
  stubSupabase(calls, insertedRows);
  const { POST } = await import("../../app/api/voice-mode/log-turn/route");
  return POST(
    new Request("https://aiasap.invalid/api/voice-mode/log-turn", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://aiasap.invalid",
      },
      body: JSON.stringify({
        sessionId: SESSION,
        role: "user",
        message,
        eventId: `${UTT}:transcript:user`,
        utteranceId: UTT,
      }),
    }),
  );
}

const leadWrites = (calls: FetchCall[]) =>
  calls.filter(
    (c) =>
      c.method !== "GET" &&
      (c.url.includes("/rest/v1/lead_sessions") ||
        c.url.includes("/rest/v1/contact_entities") ||
        c.url.includes("/rest/v1/transcript_events")),
  );

describe("accepted app turns are the lead/profile authority again", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("asks PostgREST for the representation that proves a real insert", async () => {
    const calls: FetchCall[] = [];
    await postTurn("My name is Pat and my number is 410 555 0123.", calls, [
      { id: "row-1" },
    ]);
    const insert = calls.find(
      (c) => c.method === "POST" && c.url.includes("conversation_messages"),
    );
    expect(insert?.url).toContain("on_conflict=event_id");
    expect(new Headers(insert?.headers).get("Prefer")).toBe(
      "resolution=ignore-duplicates,return=representation",
    );
  });

  it("writes the lead once for a genuinely new accepted turn", async () => {
    const calls: FetchCall[] = [];
    const response = await postTurn(
      "My name is Pat and my number is 410 555 0123.",
      calls,
      [{ id: "row-1" }],
    );
    expect(response.status).toBe(200);

    // the audit row, and the canonical merge-upserts
    expect(
      calls.filter(
        (c) => c.url.includes("/rest/v1/transcript_events") && c.method === "POST",
      ),
    ).toHaveLength(1);
    expect(
      calls.filter(
        (c) => c.url.includes("/rest/v1/lead_sessions") && c.method === "POST",
      ),
    ).toHaveLength(1);
    expect(
      calls.filter(
        (c) => c.url.includes("/rest/v1/contact_entities") && c.method === "POST",
      ),
    ).toHaveLength(1);
    // never a second opportunity record: submit_opportunity_contact stays the
    // one confirmed-contact authority and is not called from here
    expect(
      calls.filter((c) => c.url.includes("visitor_opportunities")),
    ).toHaveLength(0);
    expect(
      calls.filter((c) => c.url.includes("submit_opportunity_contact")),
    ).toHaveLength(0);
  });

  it("a retry of the same event writes nothing at all", async () => {
    const calls: FetchCall[] = [];
    // PostgREST ignored the duplicate: empty representation.
    const response = await postTurn(
      "My name is Pat and my number is 410 555 0123.",
      calls,
      [],
    );
    expect(response.status).toBe(200);
    expect(leadWrites(calls)).toEqual([]);
  });

  it("fails lead capture closed when legacy columns cannot prove a first insert", async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
        calls.push({ url, method, body, headers: init?.headers });
        if (url.includes("conversation_messages?on_conflict=event_id")) {
          return jsonResponse(
            {
              code: "PGRST204",
              message: "Could not find the 'event_id' column of 'conversation_messages'",
            },
            400,
          );
        }
        if (url.endsWith("/rest/v1/conversation_messages") && method === "POST") {
          return new Response(null, { status: 201 });
        }
        if (method === "GET") return jsonResponse([]);
        return jsonResponse([], 201);
      }),
    );
    const { POST } = await import("../../app/api/voice-mode/log-turn/route");
    const response = await POST(
      new Request("https://aiasap.invalid/api/voice-mode/log-turn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://aiasap.invalid",
        },
        body: JSON.stringify({
          sessionId: SESSION,
          role: "user",
          message: "My name is Pat and my number is 410 555 0123.",
          eventId: `${UTT}:transcript:user`,
          utteranceId: UTT,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(leadWrites(calls)).toEqual([]);
  });

  it("skips a long mis-tagged context line and the vision preamble", async () => {
    for (const message of [
      "x".repeat(600),
      "You are directly viewing an image the user shared with you right now.",
    ]) {
      const calls: FetchCall[] = [];
      const response = await postTurn(message, calls, [{ id: "row-1" }]);
      expect(response.status).toBe(200);
      expect(leadWrites(calls)).toEqual([]);
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });

  it("never fails the turn that already landed when lead capture blows up", async () => {
    const calls: FetchCall[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        calls.push({ url, method, body: null, headers: init?.headers });
        if (url.includes("/rest/v1/conversation_messages") && method === "POST") {
          return jsonResponse([{ id: "row-1" }], 201);
        }
        if (url.includes("/rest/v1/lead_sessions")) {
          return new Response("boom", { status: 500 });
        }
        return jsonResponse([]);
      }),
    );
    const { POST } = await import("../../app/api/voice-mode/log-turn/route");
    const response = await POST(
      new Request("https://aiasap.invalid/api/voice-mode/log-turn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://aiasap.invalid",
        },
        body: JSON.stringify({
          sessionId: SESSION,
          role: "user",
          message: "My name is Pat.",
          eventId: `${UTT}:transcript:user`,
          utteranceId: UTT,
        }),
      }),
    );
    expect(response.status).toBe(200);
  });

  it("does not run lead capture for assistant turns", async () => {
    const calls: FetchCall[] = [];
    stubSupabase(calls, [{ id: "row-1" }]);
    const { POST } = await import("../../app/api/voice-mode/log-turn/route");
    const response = await POST(
      new Request("https://aiasap.invalid/api/voice-mode/log-turn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://aiasap.invalid",
        },
        body: JSON.stringify({
          sessionId: SESSION,
          role: "assistant",
          message: "My name is 6 and my number is 410 555 0123.",
          eventId: `${UTT}:transcript:assistant`,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(leadWrites(calls)).toEqual([]);
  });
});

describe("provider fragment replay still writes no leads", () => {
  it("the transcript sync route does not import or call lead capture", () => {
    const sync = readFileSync(
      resolve(process.cwd(), "app/api/liveavatar/session-transcript/sync/route.ts"),
      "utf8",
    );
    expect(sync).not.toContain("persistUserUtteranceLeadCapture");
    expect(sync).not.toContain("leadCaptureFromUserText");
    // and it still preserves every row and the provider-fragment linking
    expect(sync).toContain("FRAGMENT_SOURCE");
    expect(sync).toContain("linkStoredPieces");
    expect(sync).toContain(
      "message: truncateUtf8String(row.transcript.trim(), MAX_TRANSCRIPTION_TEXT_CHARS)",
    );
    expect(sync).toContain(
      'source: (row.role === "avatar" ? "liveavatar_api" : FRAGMENT_SOURCE)',
    );
    expect(sync).toContain("const rows = parsed.transcriptData.map");
  });

  it("the accepted-turn route is the only API route that calls it", () => {
    const logTurn = readFileSync(
      resolve(process.cwd(), "app/api/voice-mode/log-turn/route.ts"),
      "utf8",
    );
    const legacyCapture = readFileSync(
      resolve(process.cwd(), "app/api/transcription/capture/route.ts"),
      "utf8",
    );
    const session = readFileSync(
      resolve(process.cwd(), "src/components/LiveAvatarSession.tsx"),
      "utf8",
    );
    expect(logTurn).toContain("persistUserUtteranceLeadCapture(sessionId, message, testerLabel)");
    expect(legacyCapture).not.toContain("persistUserUtteranceLeadCapture");
    expect(legacyCapture).not.toContain("leadCaptureFromUserText");
    expect(session).not.toContain('fetch("/api/transcription/capture"');
    expect(logTurn).toMatch(
      /Prefer:\s*eventId\s*\?\s*"resolution=ignore-duplicates,return=representation"/,
    );
    expect(logTurn).toContain("Array.isArray(insertedRows) && insertedRows.length > 0");
    // still back-links the provider's pieces of this turn, deleting nothing
    expect(logTurn).toContain("backLinkProviderPieces");
    expect(logTurn).toContain("utterance_id=is.null");
  });
});
