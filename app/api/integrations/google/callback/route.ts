import { NextResponse } from "next/server";
import { checkRateLimit } from "../../../../../src/lib/rateLimit";
import {
  exchangeGoogleAuthorizationCode,
  getGoogleOAuthConfig,
  parseGoogleOAuthState,
  saveGoogleTokenResponse,
} from "../../../../../src/lib/googleIntegration";

function redirectHome(request: Request, status: string, returnTo = "/") {
  const url = new URL(returnTo.startsWith("/") ? returnTo : "/", request.url);
  url.searchParams.set("google", status);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const params = new URL(request.url).searchParams;
    if (params.get("error")) return redirectHome(request, "declined");

    const config = getGoogleOAuthConfig(request);
    if (!config) return redirectHome(request, "setup_required");

    const state = parseGoogleOAuthState(config, params.get("state"));
    if (!state) return redirectHome(request, "invalid_state");

    const code = params.get("code");
    if (!code) return redirectHome(request, "missing_code", state.returnTo);

    const tokenResponse = await exchangeGoogleAuthorizationCode(config, code);
    await saveGoogleTokenResponse(config, state.userId, tokenResponse);
    return redirectHome(request, "connected", state.returnTo);
  } catch (error) {
    console.error("google integration callback failed:", error);
    return redirectHome(request, "error");
  }
}
