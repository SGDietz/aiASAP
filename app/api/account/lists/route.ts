import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../src/lib/rateLimit";

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  return new Response(
    JSON.stringify({
      ok: false,
      disabled: true,
      error: "Account list saving is disabled for this beta.",
    }),
    {
      status: 410,
      headers: { "Content-Type": "application/json" },
    },
  );
}
