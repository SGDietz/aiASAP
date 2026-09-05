import { assertAllowedOrigin, truncateUtf8String } from "../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { buildMagicLinkEmailHtml } from "../../../../src/lib/magicLinkEmail";
import {
  createHttpAccountNotifyOutbox,
  createResendAccountNotifyTransport,
  deliverAccountCreatedNotification,
} from "../../../../src/lib/accountCreatedNotify";

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/**
 * Voice-driven account setup endpoint.
 *
 * Called by LiveAvatarSession.startAccountSetup() after 6 walks the user
 * through email collection + read-back confirmation. Fires Supabase's OTP
 * magic-link email (Supabase handles delivery via its configured SMTP/Resend).
 *
 * Also saves the user's lists + conversation resume state to
 * account_email_links.captured_lists (as a JSON object `{ lists, resumeState }`)
 * so when the user clicks the magic link and returns signed in, the app can
 * restore exactly where we left off.
 *
 * The /api/liveavatar/session-transcript/sync endpoint also independently
 * fires the magic link when 6's transcript matches the trigger phrase —
 * Supabase de-dupes server-side, so the redundancy is safe.
 *
 * G 2026-05-22: Rebuilt during voice-only auth flow finalization.
 */
export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  const supaUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  if (!supaUrl || !anonKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        emailSent: false,
        error: "Supabase not configured",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let email = "";
  let fullName: string | null = null;
  let sessionId: string | null = null;
  let lists: unknown[] = [];
  let resumeState: unknown = null;

  try {
    const body = await request.json();
    email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    fullName =
      typeof body.fullName === "string"
        ? truncateUtf8String(body.fullName.trim(), 200)
        : null;
    sessionId =
      typeof body.sessionId === "string"
        ? truncateUtf8String(body.sessionId.trim(), 100)
        : null;
    lists = Array.isArray(body.lists) ? body.lists.slice(0, 50) : [];
    resumeState =
      body.resumeState && typeof body.resumeState === "object"
        ? body.resumeState
        : null;
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        emailSent: false,
        error: "Invalid request body",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!EMAIL_RE.test(email)) {
    return new Response(
      JSON.stringify({
        ok: false,
        emailSent: false,
        error: "Invalid email address",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // RECALL FIX (2026-06-03 — token_hash flow): the implicit OTP magic link never
  // delivered a usable session to the page on return (DB-confirmed: authCookies=0,
  // NO tokens in the return URL — the link verified server-side but the session
  // never reached the browser, so 6 greeted returning users as strangers). Switch
  // to token_hash: generate the link server-side and point it at OUR /auth/callback
  // with ?token_hash=...&type=magiclink, so the callback verifies it and writes the
  // SERVER auth cookie deterministically (the same proven path as ?code= OAuth).
  // We send the email ourselves via Resend so the link format is fully ours.
  // Detail: reference_aiasap_recall_and_session_2026-06-01.
  const origin = (() => {
    try { return new URL(request.url).origin; } catch { return siteUrl.replace(/\/$/, ""); }
  })();
  const callbackBase = `${origin}/auth/callback`;
  const nextParam = encodeURIComponent("/?account=verified");
  const redirectTo = `${callbackBase}?next=${nextParam}`;

  let emailSent = false;
  // Supabase's OWN hashed_token for this magic link. It is generated deep
  // inside the send block below but needed by the insert further down, and
  // it is THE key that lets a returning click find its row. Before this, the
  // row stored a locally invented hash instead and could never be matched.
  let magicTokenHash: string | null = null;
  let supabaseError: string | null = null;
  const resendKey = process.env.RESEND_API_KEY;

  if (!serviceRoleKey) {
    supabaseError = "service role key required";
  } else if (!resendKey) {
    supabaseError = "RESEND_API_KEY not configured";
  } else {
    const adminHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    };
    try {
      // 1) Ensure the user exists (passwordless, pre-confirmed so the magic-link
      //    verify reliably signs them in). Idempotent: 422 = already registered.
      await fetch(`${supaUrl}/auth/v1/admin/users`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          email,
          email_confirm: true,
          user_metadata: { full_name: fullName, session_id: sessionId },
        }),
      });

      // 2) Generate a magic-link token_hash for this user.
      const genRes = await fetch(`${supaUrl}/auth/v1/admin/generate_link`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          type: "magiclink",
          email,
          options: { redirect_to: redirectTo },
        }),
      });
      if (!genRes.ok) {
        const detail = await genRes.text();
        supabaseError = `generate_link failed (${genRes.status})`;
        console.error("generate_link failed:", genRes.status, detail.slice(0, 200));
      } else {
        const gen = await genRes.json();
        const hashedToken =
          (gen && (gen.hashed_token || (gen.properties && gen.properties.hashed_token))) ||
          null;
        magicTokenHash = hashedToken;
        if (!hashedToken) {
          supabaseError = "generate_link returned no token_hash";
        } else {
          // 3) Build OUR token_hash link → /auth/callback writes the server cookie.
          const magicLink = `${callbackBase}?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink&next=${nextParam}`;
          const fromEmail =
            process.env.ACCOUNT_LINK_FROM_EMAIL || "aiASAP <accounts@aiasap.ai>";
          const html = buildMagicLinkEmailHtml(magicLink);
          const sendRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
              // DEDUP (2026-06-03): the sync auto-trigger sends for the SAME
              // signup too. Same key (session+email) => Resend sends ONCE; the
              // 2nd request conflicts.
              "Idempotency-Key": `magiclink:${(sessionId ?? "").trim()}:${email.trim().toLowerCase()}`,
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [email],
              subject: "Your aiASAP magic link",
              html,
            }),
          });
          // 409 is Resend's idempotency conflict: the sync trigger already sent
          // this signup's link, so the dedup worked and it really is sent.
          // 422 was ALSO counted here, and that was wrong (fixed 2026-08-21):
          // 422 is a VALIDATION failure - a bad address or an unverified sending
          // domain. Nothing was delivered. Counting it as sent told people to go
          // and check an inbox that had received nothing.
          if (sendRes.ok || sendRes.status === 409) {
            emailSent = true;
          } else {
            const detail = await sendRes.text();
            supabaseError = `Resend send failed (${sendRes.status})`;
            console.error("Resend send failed:", sendRes.status, detail.slice(0, 200));
          }
        }
      }
    } catch (error) {
      supabaseError = "token_hash send threw";
      console.error("/api/account/start token_hash threw:", error);
    }
  }

  // Save lists + resumeState to account_email_links for post-tap recovery.
  // Use service role to bypass RLS. Failures here don't block the response —
  // the magic link is the critical path.
  // Always record the email -> session_id link (even with no lists), so
  // link-session can re-key + extract memory by EMAIL on sign-in without
  // depending on the browser handing over its localStorage session_ids
  // (2026-05-31 memory fix). captured_lists may be empty.
  let pendingStateToken: string | null = null;
  if (serviceRoleKey && sessionId) {
    try {
      pendingStateToken = crypto.randomUUID();
      const tokenHash = await hashToken(pendingStateToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      // Also stash the spoken name here. Supabase only applies OTP
      // options.data to user_metadata when the user is first CREATED, so on
      // the magic-link turnaround full_name was ending up absent on the
      // account. Persisting it in this jsonb lets link-session recover and
      // write it to user_metadata.full_name regardless of which tab/browser
      // the user returns in (2026-06-01 name-recall fix). Extra key is
      // backward-compatible: account/me only reads lists + resumeState.
      const captured = { lists, resumeState, fullName };
      const insertRes = await fetch(
        `${supaUrl}/rest/v1/account_email_links`,
        {
          method: "POST",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            email,
            session_id: sessionId,
            // Supabase's hashed_token, so /auth/callback can find THIS row from
            // the link the user actually clicked. Falls back to the local hash
            // only so the row still inserts (the column is NOT NULL) - a row that
            // cannot be matched is still better than no row at all, because
            // account/me and link-session both find it by email.
            token_hash: magicTokenHash ?? tokenHash,
            captured_lists: captured,
            expires_at: expiresAt,
          }),
        },
      );
      if (!insertRes.ok) {
        const detail = await insertRes.text();
        console.error(
          "account_email_links insert failed:",
          insertRes.status,
          detail.slice(0, 200),
        );
        pendingStateToken = null;
      }
    } catch (error) {
      console.error("account_email_links insert threw:", error);
      pendingStateToken = null;
    }
  }

  if (!emailSent) {
    return new Response(
      JSON.stringify({
        ok: false,
        emailSent: false,
        error: supabaseError || "Failed to send magic link",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // TELL THE TEAM — durable + awaited (2026-09-03 audit). The old
  // fire-and-forget team notification dropped the note on any Resend failure
  // and left nothing to retry. Now: an outbox row is inserted and the send
  // is awaited.
  // A transport failure keeps a durable row in `failed`/`sending` for the
  // /api/cron/lead-follow-ups drainer. The dedupe key is
  // `account_created:<email>` — a distinct namespace from the verbal
  // `submit_contact` follow-up (`follow_up_requested:<sha256(...)>`) and the
  // visitor receipt (`visitor_confirmation:<sha256(...)>`), so this event
  // cannot duplicate against either. A notification failure still never
  // breaks the sign-in: we log and continue.
  if (serviceRoleKey) {
    try {
      await deliverAccountCreatedNotification({
        store: createHttpAccountNotifyOutbox(supaUrl, serviceRoleKey),
        transport: createResendAccountNotifyTransport(),
        email,
        fullName,
        sessionId,
        lists: lists.map((l) => String(l)),
      });
    } catch (notifyError) {
      console.error("account_created_notification threw:", notifyError);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, emailSent: true, pendingStateToken }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
