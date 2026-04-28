import { NextResponse } from "next/server";
import { parseCookie } from "../../../../../src/lib/accountPersistence";
import { checkRateLimit } from "../../../../../src/lib/rateLimit";
import {
  clearSocialOAuthCookieHeader,
  exchangeSocialAuthorizationCode,
  getSocialOAuthConfig,
  getSocialOAuthCookieName,
  parseSocialOAuthState,
  saveSocialTokenResponse,
  socialProviderFromPath,
} from "../../../../../src/lib/socialPosting";

function redirectSocial(request: Request, status: string, returnTo = "/social") {
  const url = new URL(returnTo.startsWith("/") ? returnTo : "/social", request.url);
  url.searchParams.set("social", status);
  const response = NextResponse.redirect(url);
  response.headers.append("Set-Cookie", clearSocialOAuthCookieHeader());
  return response;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const { provider: rawProvider } = await context.params;
    const provider = socialProviderFromPath(rawProvider);
    if (!provider) return redirectSocial(request, "unknown_provider");

    const params = new URL(request.url).searchParams;
    if (params.get("error")) return redirectSocial(request, "declined");

    const config = getSocialOAuthConfig(request, provider);
    if (!config) return redirectSocial(request, "setup_required");

    const cookie = parseCookie(request, getSocialOAuthCookieName());
    const state = parseSocialOAuthState(config, params.get("state"), cookie);
    if (!state) return redirectSocial(request, "invalid_state");

    const code = params.get("code");
    if (!code) return redirectSocial(request, "missing_code", state.returnTo);

    const tokenResponse = await exchangeSocialAuthorizationCode(
      config,
      code,
      state.codeVerifier,
    );
    await saveSocialTokenResponse(config, state.userId, tokenResponse);
    return redirectSocial(request, "connected", state.returnTo);
  } catch (error) {
    console.error("social oauth callback failed:", error);
    return redirectSocial(request, "error");
  }
}
