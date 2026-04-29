import { NextResponse } from "next/server";
import { getAccountCookieName } from "../../../../src/lib/accountPersistence";

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
  const url = new URL(request.url);
  url.pathname = "/";
  url.search = "";

  const response = NextResponse.redirect(url);
  response.headers.append("Set-Cookie", clearAccountCookieHeader());
  return response;
}
