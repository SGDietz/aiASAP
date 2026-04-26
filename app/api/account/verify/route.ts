import { NextResponse } from "next/server";
import {
  accountCookieHeader,
  consumePendingAccountLink,
  createStorageAccountSession,
  saveStorageUserLists,
  saveStorageUserResume,
} from "../../../../src/lib/accountPersistence";

function redirectHome(request: Request, status: "verified" | "expired" | "error") {
  const url = new URL(request.url);
  url.pathname = "/";
  url.search = `?account=${status}`;
  return url;
}

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (token.length < 20) {
      return NextResponse.redirect(redirectHome(request, "error"));
    }

    const link = await consumePendingAccountLink(token);
    if (!link) return NextResponse.redirect(redirectHome(request, "expired"));

    const { user, sessionToken } = await createStorageAccountSession(link.email);
    if (link.lists.length > 0) await saveStorageUserLists(user.id, link.lists);
    await saveStorageUserResume(user.id, link.resumeState);

    const response = NextResponse.redirect(redirectHome(request, "verified"));
    response.headers.append("Set-Cookie", accountCookieHeader(sessionToken));
    return response;
  } catch (error) {
    console.error("account verify failed:", error);
    return NextResponse.redirect(redirectHome(request, "error"));
  }
}
