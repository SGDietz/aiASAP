import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";
import {
  getAccountCookieName,
  getStorageAccountFromSessionToken,
  parseCookie,
  sanitizeAccountResumeState,
  sanitizeAssistantLists,
  saveStorageUserLists,
  saveStorageUserResume,
} from "../../../../src/lib/accountPersistence";
import { checkRateLimit } from "../../../../src/lib/rateLimit";

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const token = parseCookie(request, getAccountCookieName());
    const user = await getStorageAccountFromSessionToken(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Not signed in" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const lists = sanitizeAssistantLists(body.lists);
    const resumeState = sanitizeAccountResumeState(body.resumeState);
    await saveStorageUserLists(user.id, lists);
    await saveStorageUserResume(user.id, resumeState);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("account lists save failed:", error);
    return new Response(JSON.stringify({ error: "Failed to save lists" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
