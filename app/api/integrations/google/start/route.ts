import { NextResponse } from "next/server";
import { assertAllowedOrigin } from "../../../../../src/lib/apiRouteSecurity";
import {
  getAccountCookieName,
  getStorageAccountFromSessionToken,
  parseCookie,
} from "../../../../../src/lib/accountPersistence";
import { checkRateLimit } from "../../../../../src/lib/rateLimit";
import {
  buildGoogleAuthorizationUrl,
  createGoogleOAuthState,
  getGoogleOAuthConfig,
  googleIntegrationMissingConfig,
} from "../../../../../src/lib/googleIntegration";

function redirectHome(request: Request, status: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("google", status);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const originErr = assertAllowedOrigin(request, { allowDirectNavigation: true });
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const token = parseCookie(request, getAccountCookieName());
    const user = await getStorageAccountFromSessionToken(token);
    if (!user) return redirectHome(request, "account_required");

    const config = getGoogleOAuthConfig(request);
    if (!config) {
      console.error("Google OAuth missing config:", googleIntegrationMissingConfig());
      return redirectHome(request, "setup_required");
    }

    const returnTo = new URL(request.url).searchParams.get("returnTo") ?? "/";
    const state = createGoogleOAuthState(config, user.id, returnTo);
    return NextResponse.redirect(buildGoogleAuthorizationUrl(config, state));
  } catch (error) {
    console.error("google integration start failed:", error);
    return redirectHome(request, "error");
  }
}
