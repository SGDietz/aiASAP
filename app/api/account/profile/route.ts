import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";
import {
  getAccountCookieName,
  getStorageAccountFromSessionToken,
  parseCookie,
  sanitizeAccountFullName,
  saveStorageUserProfile,
} from "../../../../src/lib/accountPersistence";
import { checkRateLimit } from "../../../../src/lib/rateLimit";

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const token = parseCookie(request, getAccountCookieName());
    const user = await getStorageAccountFromSessionToken(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Not signed in" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const fullName = sanitizeAccountFullName(body.fullName);
    if (!fullName) {
      return new Response(JSON.stringify({ error: "Valid name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const updated = await saveStorageUserProfile({
      userId: user.id,
      email: user.email,
      fullName,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        user: { email: updated.email, fullName: updated.full_name },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("account profile save failed:", error);
    return new Response(JSON.stringify({ error: "Failed to save profile" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
