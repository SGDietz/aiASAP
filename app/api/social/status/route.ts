import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";
import {
  getAccountCookieName,
  getStorageAccountFromSessionToken,
  parseCookie,
} from "../../../../src/lib/accountPersistence";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { loadSocialConnectionStatuses } from "../../../../src/lib/socialPosting";

export async function GET(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const token = parseCookie(request, getAccountCookieName());
    const user = await getStorageAccountFromSessionToken(token);
    const platforms = await loadSocialConnectionStatuses(user?.id ?? null);
    return new Response(
      JSON.stringify({
        authenticated: Boolean(user),
        user: user ? { id: user.id, email: user.email, fullName: user.full_name } : null,
        platforms,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("social status failed:", error);
    return new Response(JSON.stringify({ error: "Failed to load social status" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
