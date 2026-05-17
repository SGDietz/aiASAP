import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";
import {
  getAccountCookieName,
  getStorageAccountFromSessionToken,
  parseCookie,
} from "../../../../src/lib/accountPersistence";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { createSocialDraft, loadSocialDrafts } from "../../../../src/lib/socialPosting";

async function authenticatedUser(request: Request) {
  const token = parseCookie(request, getAccountCookieName());
  return getStorageAccountFromSessionToken(token);
}

export async function GET(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const user = await authenticatedUser(request);
    if (!user) {
      return new Response(JSON.stringify({ authenticated: false, drafts: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const drafts = await loadSocialDrafts(user.id);
    return new Response(JSON.stringify({ authenticated: true, drafts }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("social drafts read failed:", error);
    return new Response(JSON.stringify({ error: "Failed to load social drafts" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const user = await authenticatedUser(request);
    if (!user) {
      return new Response(JSON.stringify({ error: "Account required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const input = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    if (!input) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const draft = await createSocialDraft(user.id, input);
    return new Response(JSON.stringify({ draft }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("social draft create failed:", error);
    return new Response(JSON.stringify({ error: "Failed to create social draft" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
