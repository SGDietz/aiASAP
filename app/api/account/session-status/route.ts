import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";

const NO_STORE = { "Content-Type": "application/json", "Cache-Control": "no-store" };

/** aiASAP's own Supabase project. iSolve's, which must never be read from here. */
const AIASAP_SUPABASE_REF = "wqszxsqzkaatghyrqviv";
const ISOLVE_SUPABASE_REF = "dphxcqjkzhvsdejtxdcj";

/**
 * THE SESSION-ID GATE, and why it is local rather than the shared helper.
 *
 * `isSafeTranscriptionSessionId` in apiRouteSecurity.ts is /^[a-zA-Z0-9_-]{8,128}$/
 * — no colons, no dots. iSolve deliberately widened ITS copy to
 * /^[a-zA-Z0-9_\-:.]{8,200}$/ because this exact endpoint was rejecting real
 * LiveAvatar session ids and answering "not signed in" forever. That is the
 * worst kind of failure: a 200 response that quietly means nothing works.
 *
 * Widening the SHARED helper would loosen the gate on the transcription routes
 * too, which is not a trade worth making for this. So the wider shape lives
 * here, scoped to the one endpoint that needs it. Still tight: an unguessable
 * id, no wildcards, hard length bound.
 */
const SAFE_POLL_SESSION_ID = /^[a-zA-Z0-9_\-:.]{8,200}$/;

/**
 * Cross-device sign-in poll. Ported from iSolve 2026-08-21 on G's order
 * ("the magic link is completely built and mostly working on iSolve just import
 * this system"), adapted for aiASAP.
 *
 * THE PROBLEM IT SOLVES. A magic link signs in whatever browser OPENS it —
 * which is almost always the user's PHONE, while they are talking to 6 on a
 * laptop. The laptop never sees that cookie, so 6 has no idea they just signed
 * in and cannot greet them or pick up where they stopped. Until now aiASAP had
 * this gap with nothing covering it; iSolve's own copy of this file says so in
 * as many words: "Same gap aiASAP has."
 *
 * HOW. /auth/callback stamps `used_at` on the exact account_email_links row
 * carrying the clicked token — which only works now that account/start stores
 * Supabase's real hashed_token rather than a locally invented one. The live 6
 * session polls here with its OWN session id, and the moment its row flips to
 * used, it gets the name and the resume state back and 6 greets them.
 *
 * DELIBERATELY NOT RATE LIMITED. The client polls this every few seconds; a 429
 * would drop the one event this whole mechanism exists to catch. The protection
 * is the origin check plus an unguessable session id, and the fact that it is
 * read-only and returns nothing at all until a link has actually been clicked.
 */
export async function GET(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;

  const url = new URL(request.url);
  const sessionId = (url.searchParams.get("sessionId") || "").trim();

  // One shape of answer for every failure. A caller must not be able to tell a
  // bad session id from an unclicked link from a database that is down.
  const notSignedIn = () =>
    new Response(JSON.stringify({ signedIn: false }), {
      status: 200,
      headers: NO_STORE,
    });

  if (!SAFE_POLL_SESSION_ID.test(sessionId)) return notSignedIn();

  const supaUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Guard inverted from iSolve's: assert aiASAP's project and refuse iSolve's.
  // The two apps share a repo lineage and it would be entirely possible to point
  // one at the other's database by copying an env file.
  const dbOk =
    !!supaUrl &&
    supaUrl.includes(AIASAP_SUPABASE_REF) &&
    !supaUrl.includes(ISOLVE_SUPABASE_REF);
  if (!dbOk || !serviceRoleKey) return notSignedIn();

  try {
    const q =
      `${supaUrl}/rest/v1/account_email_links?session_id=eq.${encodeURIComponent(sessionId)}` +
      `&used_at=not.is.null&order=created_at.desc&limit=1&select=email,used_at,captured_lists`;
    // A slow database must not hold the poll open; the next tick will retry.
    const res = await Promise.race([
      fetch(q, {
        method: "GET",
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      }),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 2500),
      ),
    ]);
    if (!res.ok) return notSignedIn();

    const rows = (await res.json()) as Array<{
      email: string;
      used_at: string | null;
      captured_lists: unknown;
    }>;
    const row = rows[0];
    if (!row || !row.used_at) return notSignedIn();

    let fullName: string | null = null;
    let lists: unknown[] = [];
    let resumeState: unknown = null;
    const cap = row.captured_lists;
    if (cap && typeof cap === "object" && !Array.isArray(cap)) {
      const obj = cap as Record<string, unknown>;
      if (typeof obj.fullName === "string" && obj.fullName.trim()) {
        fullName = obj.fullName.trim();
      }
      if (Array.isArray(obj.lists)) lists = obj.lists;
      if (obj.resumeState && typeof obj.resumeState === "object") {
        resumeState = obj.resumeState;
      }
    }

    return new Response(
      JSON.stringify({ signedIn: true, email: row.email, fullName, lists, resumeState }),
      { status: 200, headers: NO_STORE },
    );
  } catch {
    return notSignedIn();
  }
}
