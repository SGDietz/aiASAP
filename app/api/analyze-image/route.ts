import { assertAllowedOrigin } from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";

function disabledVisionResponse() {
  return new Response(
    JSON.stringify({ error: "Image analysis is currently disabled" }),
    {
      status: 410,
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;

  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  return disabledVisionResponse();
}
