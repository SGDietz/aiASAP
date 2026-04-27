import { assertAllowedOrigin } from "../../../../../src/lib/apiRouteSecurity";
import {
  getAccountCookieName,
  getStorageAccountFromSessionToken,
  parseCookie,
} from "../../../../../src/lib/accountPersistence";
import { checkRateLimit } from "../../../../../src/lib/rateLimit";
import {
  getGoogleOAuthConfig,
  googleIntegrationMissingConfig,
  loadGoogleIntegrationStatus,
} from "../../../../../src/lib/googleIntegration";

export async function GET(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const token = parseCookie(request, getAccountCookieName());
    const user = await getStorageAccountFromSessionToken(token);
    if (!user) {
      return new Response(
        JSON.stringify({
          authenticated: false,
          configured: Boolean(getGoogleOAuthConfig(request)),
          connected: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const configured = Boolean(getGoogleOAuthConfig(request));
    const status = await loadGoogleIntegrationStatus(user.id);
    return new Response(
      JSON.stringify({
        authenticated: true,
        configured,
        missingConfig: configured ? null : googleIntegrationMissingConfig(),
        ...status,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("google integration status failed:", error);
    return new Response(JSON.stringify({ error: "Failed to load Google status" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
