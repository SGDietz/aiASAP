import { NextResponse } from "next/server";
import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import { getUserId } from "../../../../src/lib/auth/getUser";

// ── STRIPE CHECKOUT (scaffold, born 2026-06-12) ─────────────────────────────
// G's order: "let's get stripe hooked up" — account created + tested on his
// side; keys not in the vault yet. This route is DORMANT-SAFE: without
// STRIPE_SECRET_KEY it answers 503 {disabled:true} and touches nothing.
//
// ACTIVATION STEPS (when G delivers keys):
// 1. .env: STRIPE_SECRET_KEY=sk_... (+ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...)
// 2. .env: STRIPE_PRICE_ID=price_... (create a Product + recurring Price in
//    the Stripe dashboard; that price id goes here)
// 3. .env: STRIPE_WEBHOOK_SECRET=whsec_... (Dashboard → Webhooks → add
//    endpoint <site>/api/stripe/webhook, events: checkout.session.completed,
//    customer.subscription.updated, customer.subscription.deleted)
// 4. Same three vars into Vercel env for preview/prod when we ship.
// No Stripe SDK on purpose — raw REST keeps node_modules clean.

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || "";

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
    return NextResponse.json(
      { disabled: true, error: "Stripe is not configured yet." },
      { status: 503 },
    );
  }

  let body: { email?: unknown; success_path?: unknown; cancel_path?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const email = typeof body.email === "string" ? body.email.slice(0, 320) : "";
  const userId = await getUserId();
  const site =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const successPath =
    typeof body.success_path === "string" ? body.success_path : "/?paid=1";
  const cancelPath =
    typeof body.cancel_path === "string" ? body.cancel_path : "/?paid=0";

  // Stripe's REST API takes form-encoded bodies.
  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("line_items[0][price]", STRIPE_PRICE_ID);
  form.set("line_items[0][quantity]", "1");
  form.set("success_url", `${site}${successPath}`);
  form.set("cancel_url", `${site}${cancelPath}`);
  if (email) form.set("customer_email", email);
  if (userId) form.set("client_reference_id", userId);
  form.set("allow_promotion_codes", "true");

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const data = (await res.json()) as { url?: string; error?: { message?: string } };
    if (!res.ok || !data.url) {
      return NextResponse.json(
        { error: data.error?.message ?? `stripe ${res.status}` },
        { status: 502 },
      );
    }
    // The client redirects the user to data.url — Stripe hosts the page.
    return NextResponse.json({ ok: true, url: data.url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "stripe request failed" },
      { status: 502 },
    );
  }
}
