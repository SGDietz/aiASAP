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

type FetchCall = { url: string; method: string; body: unknown };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const UTT = "utt-fb700e8b-2222-4222-8222-222222222222";
const APP_TEXT =
  "All the buttons I think they need a cool design and a big red square stop they look great they're laid out nicely";

async function postTurn(
  pieces: unknown,
  calls: FetchCall[],
  piecesStatus = 200,
): Promise<Response> {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      calls.push({ url, method, body });
      if (
        method === "GET" &&
        url.includes("source=eq.liveavatar_api_fragment&utterance_id=is.null")
      ) {
        return jsonResponse(pieces, piecesStatus);
      }
      return new Response(null, { status: 201 });
    }),
  );
  const { POST } = await import("../../app/api/voice-mode/log-turn/route");
  return POST(
    new Request("https://aiasap.invalid/api/voice-mode/log-turn", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://aiasap.invalid" },
      body: JSON.stringify({
        sessionId: "03aef2a8-dc43-4b50-bb72-d87dd9cec62a",
        role: "user",
        message: APP_TEXT,
        eventId: `${UTT}:transcript:user`,
        utteranceId: UTT,
      }),
    }),
  );
}

describe("voice-mode log-turn back-links the provider's pieces of this turn", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("stamps the new utterance id onto pieces stored before the app row landed", async () => {
    // The real race: the provider's pieces were stored 116 ms BEFORE this row.
    const nowS = Math.floor(Date.now() / 1000);
    const calls: FetchCall[] = [];
    const response = await postTurn(
      [
        { id: "f815", message: "All the buttons, I think they need a cool", la_absolute_timestamp: nowS - 10 },
        { id: "f816", message: "design.", la_absolute_timestamp: nowS - 9 },
        { id: "f818", message: "And a big red", la_absolute_timestamp: nowS - 7 },
        { id: "f823", message: "square stop. They look great. They're laid out nice.", la_absolute_timestamp: nowS - 2 },
        { id: "f812", message: "Um,", la_absolute_timestamp: nowS - 13 },
      ],
      calls,
    );
    expect(response.status).toBe(200);

    const insert = calls.find((c) => c.method === "POST");
    expect(insert?.url).toContain("/rest/v1/conversation_messages?on_conflict=event_id");
    expect(insert?.body).toMatchObject({ role: "user", message: APP_TEXT, utterance_id: UTT });

    const patches = calls.filter((c) => c.method === "PATCH");
    expect(patches).toHaveLength(1);
    expect(patches[0].url).toBe(
      "https://supabase.invalid/rest/v1/conversation_messages?id=in.(f815,f816,f818,f823)&utterance_id=is.null",
    );
    expect(patches[0].body).toEqual({ utterance_id: UTT });
  });

  it("patches nothing when no piece of this turn is in the table", async () => {
    const calls: FetchCall[] = [];
    const response = await postTurn([], calls);
    expect(response.status).toBe(200);
    expect(calls.filter((c) => c.method === "PATCH")).toEqual([]);
  });

  it("a failed back-link lookup never fails the turn that was already stored", async () => {
    const calls: FetchCall[] = [];
    const response = await postTurn({ message: "boom" }, calls, 500);
    expect(response.status).toBe(200);
    expect(calls.filter((c) => c.method === "PATCH")).toEqual([]);
  });
});
