import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";
import { getAccountCookieName } from "../../../../src/lib/accountPersistence";
import { checkRateLimit } from "../../../../src/lib/rateLimit";

function clearAccountCookieHeader() {
  return [
    `${getAccountCookieName()}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Secure",
  ].join("; ");
}

export async function GET(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  return new Response(
    JSON.stringify({ authenticated: false, beta: true }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": clearAccountCookieHeader(),
      },
    },
  );
}
