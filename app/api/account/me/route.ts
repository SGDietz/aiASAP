import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";
import {
  getAccountCookieName,
  getStorageAccountFromSessionToken,
  loadStorageUserLists,
  parseCookie,
} from "../../../../src/lib/accountPersistence";
import { checkRateLimit } from "../../../../src/lib/rateLimit";

export async function GET(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const token = parseCookie(request, getAccountCookieName());
    const user = await getStorageAccountFromSessionToken(token);
    if (!user) {
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const lists = await loadStorageUserLists(user.id);
    return new Response(
      JSON.stringify({
        authenticated: true,
        user: { email: user.email, fullName: user.full_name },
        lists,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("account me failed:", error);
    return new Response(JSON.stringify({ error: "Failed to load account" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
