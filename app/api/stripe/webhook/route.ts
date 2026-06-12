import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";
import { captureServerError } from "../../../../src/lib/observability/serverLogger";

// ── STRIPE WEBHOOK (scaffold, born 2026-06-12) ──────────────────────────────
// Receives Stripe events and mirrors subscription state into
// public.stripe_customers (user_id, email, customer id, status, price).
// DORMANT-SAFE: without STRIPE_WEBHOOK_SECRET it answers 503 and stores
// nothing. Signature verification is mandatory once enabled — an unsigned
// caller can never write payment state.
// Activation steps live in app/api/stripe/checkout/route.ts.

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

function verifyStripeSignature(
  payload: string,
  sigHeader: string | null,
): boolean {
  if (!sigHeader) return false;
  const parts = new Map(
    sigHeader.split(",").map((p) => {
      const [k, v] = p.split("=", 2);
      return [k, v] as const;
    }),
  );
  const t = parts.get("t");
  const v1 = parts.get("v1");
  if (!t || !v1) return false;
  // Reject stale events (Stripe recommends a tolerance window).
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = createHmac("sha256", STRIPE_WEBHOOK_SECRET)
    .update(`${t}.${payload}`)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

type StripeEvent = {
  type?: string;
  data?: {
    object?: {
      id?: string;
      customer?: string;
      customer_email?: string | null;
      client_reference_id?: string | null;
      subscription?: string | null;
      status?: string;
      current_period_end?: number;
      items?: { data?: Array<{ price?: { id?: string } }> };
    };
  };
};

export async function POST(request: Request) {
  if (!STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { disabled: true, error: "Stripe webhook is not configured yet." },
      { status: 503 },
    );
  }

  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const type = event.type ?? "";
  const obj = event.data?.object ?? {};

  // Only the events that move subscription state matter here.
  const relevant =
    type === "checkout.session.completed" ||
    type === "customer.subscription.updated" ||
    type === "customer.subscription.deleted";
  if (!relevant) return NextResponse.json({ received: true });

  const customerId =
    typeof obj.customer === "string" ? obj.customer : null;
  if (!customerId) return NextResponse.json({ received: true });

  const row: Record<string, unknown> = {
    stripe_customer_id: customerId,
    updated_at: new Date().toISOString(),
  };
  if (type === "checkout.session.completed") {
    if (obj.customer_email) row.email = obj.customer_email;
    if (obj.client_reference_id) row.user_id = obj.client_reference_id;
    if (typeof obj.subscription === "string")
      row.subscription_id = obj.subscription;
    row.subscription_status = "active";
  } else {
    row.subscription_status =
      type === "customer.subscription.deleted"
        ? "canceled"
        : (obj.status ?? "unknown");
    if (typeof obj.id === "string") row.subscription_id = obj.id;
    const priceId = obj.items?.data?.[0]?.price?.id;
    if (priceId) row.price_id = priceId;
    if (typeof obj.current_period_end === "number") {
      row.current_period_end = new Date(
        obj.current_period_end * 1000,
      ).toISOString();
    }
  }

  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    // Upsert on the unique stripe_customer_id.
    await fetch(
      `${url}/rest/v1/stripe_customers?on_conflict=stripe_customer_id`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(row),
      },
    );
  } catch (e) {
    await captureServerError({
      message: "stripe_customers upsert failed",
      error: e,
      route: "/api/stripe/webhook",
    });
  }

  return NextResponse.json({ received: true });
}
