import { NextResponse } from "next/server";
import { assertAllowedOrigin } from "../../../../../src/lib/apiRouteSecurity";
import {
  getAccountCookieName,
  getStorageAccountFromSessionToken,
  parseCookie,
} from "../../../../../src/lib/accountPersistence";
import { checkRateLimit } from "../../../../../src/lib/rateLimit";
import {
  createSocialOAuthStart,
  getSocialOAuthConfig,
  socialProviderFromPath,
} from "../../../../../src/lib/socialPosting";

function redirectSocial(request: Request, status: string) {
  const url = new URL("/social", request.url);
  url.searchParams.set("social", status);
  return NextResponse.redirect(url);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const { provider: rawProvider } = await context.params;
    const provider = socialProviderFromPath(rawProvider);
    if (!provider) return redirectSocial(request, "unknown_provider");

    const token = parseCookie(request, getAccountCookieName());
    const user = await getStorageAccountFromSessionToken(token);
    if (!user) return redirectSocial(request, "account_required");

    const config = getSocialOAuthConfig(request, provider);
    if (!config) return redirectSocial(request, "setup_required");

    const returnTo = new URL(request.url).searchParams.get("returnTo") ?? "/social";
    const start = createSocialOAuthStart(config, user.id, returnTo);
    const response = NextResponse.redirect(start.authorizationUrl);
    response.headers.append("Set-Cookie", start.cookieHeader);
    return response;
  } catch (error) {
    console.error("social oauth start failed:", error);
    return redirectSocial(request, "error");
  }
}
