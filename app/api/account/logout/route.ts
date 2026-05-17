import { NextResponse } from "next/server";
import { getAccountCookieName } from "../../../../src/lib/accountPersistence";

export async function GET(request: Request) {
  const url = new URL(request.url);
  url.pathname = "/";
  url.search = "";

  const response = NextResponse.redirect(url);
  response.headers.append(
    "Set-Cookie",
    [
      `${getAccountCookieName()}=`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=0",
      "Secure",
    ].join("; "),
  );
  return response;
}
