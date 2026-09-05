import { after } from "next/server";
import { API_URL } from "../../../secrets";
import {
  authorizationBearerHeader,
  sessionTokenFromRequestAuthHeader,
} from "../../../../../src/lib/apiRouteSecurity";
import {
  isLiveAvatarSuccessPayload,
  recordSessionStreamStarted,
} from "../../../../../src/lib/liveavatarCredits";

export async function POST(request: Request) {
  const token = sessionTokenFromRequestAuthHeader(
    request.headers.get("Authorization"),
  );
  if (!token) {
    return new Response(
      JSON.stringify({
        code: 403,
        data: { message: "Authorization required" },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }
  if (!API_URL) {
    return new Response(
      JSON.stringify({
        code: 500,
        data: { message: "LIVEAVATAR_API_URL is not configured" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  try {
    const res = await fetch(`${API_URL}/v1/sessions/start`, {
      method: "POST",
      headers: {
        Authorization: authorizationBearerHeader(token),
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    if (res.ok && isLiveAvatarSuccessPayload(data)) {
      // SPEED (2026-09-04): this is credit BOOKKEEPING, and it was awaited on
      // the critical path of the slowest call in the whole startup. Measured on
      // G's ride: /api/v1/sessions/start took 6,575 ms for a 1 KB response, and
      // every millisecond of it is a visitor staring at a still picture.
      //
      // With no Upstash configured this writes to Supabase Storage, so it is a
      // real network round trip, not a memory poke. The client does not need it
      // to render 6.
      //
      // `after()` (Next 15) is the right tool, not a bare floating promise:
      // Vercel keeps the function alive until after-work finishes, so the
      // credit record is still written. Dropping the await without it would
      // risk the function freezing mid-write and LOSING credit accounting -
      // which is money, and must not be traded for speed.
      after(async () => {
        try {
          await recordSessionStreamStarted(token);
        } catch {
          // recordSessionStreamStarted already swallows and logs its own
          // errors; this is belt and braces so after-work can never reject.
        }
      });
    }
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Session start proxy error:", err);
    return new Response(
      JSON.stringify({
        code: 500,
        data: { message: "Session start failed" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
