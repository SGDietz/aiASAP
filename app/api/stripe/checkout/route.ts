import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { assertAllowedOrigin } from "../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../src/lib/rateLimit";

// ── MILESTONE CHECKOUT ──────────────────────────────────────────────────────
// Replaces the $9.95/month subscription scaffold (born 2026-06-12, killed
// 2026-08-21). aiASAP does not sell a subscription. It sells one build for
// $5,000, collected in three one-time payments.
//
// G'S RULE, AND IT IS THE WHOLE DESIGN: **NOBODY PAYS WITHOUT TALKING TO
// SCOTT FIRST.** He does every build himself, so the limit is his capacity,
// not a sales tactic. There is no buy button anywhere on the site and there
// must never be one. This route cannot be reached by a visitor: it demands an
// admin token that only Scott holds. He mints a link, then he sends it.
//
// That is why the amounts live HERE and not in the request. A caller can pick
// WHICH milestone, never WHAT it costs. If the price ever came off the wire,
// somebody could buy a $5,000 build for a dollar.
//
// No stored Stripe Price objects on purpose. price_data is inline, so there is
// nothing sitting in the dashboard that can be charged by accident later -
// which is exactly how the dead $9.95 price survived long enough to matter.

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_ADMIN_TOKEN = process.env.STRIPE_ADMIN_TOKEN || "";

/**
 * The deal, in cents. Changing a number here changes what a client is charged,
 * so it changes nowhere else.
 *
 *   deposit  $2,000  non-refundable, starts the work
 *   second   $2,000  after the first delivery, one full round and one small round
 *   final    $1,000  after the second full round and small round
 */
const MILESTONES = {
  deposit: {
    amount: 200000,
    name: "aiASAP build - deposit",
    blurb:
      "Starts your build. Non-refundable. Covers the brand and the first version of your site.",
  },
  second: {
    amount: 200000,
    name: "aiASAP build - second payment",
    blurb:
      "Due after your first delivery, one full round of changes and one small round.",
  },
  final: {
    amount: 100000,
    name: "aiASAP build - final payment",
    blurb:
      "Due after the second full round of changes and the second small round.",
  },
} as const;

export type MilestoneKey = keyof typeof MILESTONES;

function isMilestone(v: unknown): v is MilestoneKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(MILESTONES, v);
}

/**
 * Constant-time compare over hashes, so the token length never leaks and a
 * timing probe cannot walk the secret out one character at a time.
 */
function tokenOk(supplied: string | null): boolean {
  if (!supplied || !STRIPE_ADMIN_TOKEN) return false;
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(STRIPE_ADMIN_TOKEN).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  if (!STRIPE_SECRET_KEY || !STRIPE_ADMIN_TOKEN) {
    return NextResponse.json(
      { disabled: true, error: "Checkout is not configured." },
      { status: 503 },
    );
  }

  // Deliberately identical to the 503 above in shape but 401 in status: an
  // outsider learns only "not for you", never which milestones exist.
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!tokenOk(bearer)) {
    return NextResponse.json({ error: "not authorized" }, { status: 401 });
  }

  let body: { milestone?: unknown; email?: unknown; client_ref?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (!isMilestone(body.milestone)) {
    return NextResponse.json(
      { error: "milestone must be deposit, second or final" },
      { status: 400 },
    );
  }
  const milestone = MILESTONES[body.milestone];
  const email = typeof body.email === "string" ? body.email.slice(0, 320) : "";
  const clientRef =
    typeof body.client_ref === "string" ? body.client_ref.slice(0, 200) : "";

  const site =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][unit_amount]", String(milestone.amount));
  form.set("line_items[0][price_data][product_data][name]", milestone.name);
  form.set(
    "line_items[0][price_data][product_data][description]",
    milestone.blurb,
  );
  form.set("line_items[0][quantity]", "1");
  form.set("success_url", `${site}/paid?ok=1`);
  form.set("cancel_url", `${site}/`);
  // Which milestone this was survives into the webhook and the receipt.
  form.set("metadata[milestone]", body.milestone);
  form.set("payment_intent_data[metadata][milestone]", body.milestone);
  if (email) form.set("customer_email", email);
  if (clientRef) form.set("client_reference_id", clientRef);
  // No promo codes. There is one price and Scott sets it in conversation.

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const data = (await res.json()) as {
      url?: string;
      id?: string;
      error?: { message?: string };
    };
    if (!res.ok || !data.url) {
      return NextResponse.json(
        { error: data.error?.message ?? `stripe ${res.status}` },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      url: data.url,
      session_id: data.id,
      milestone: body.milestone,
      amount_usd: milestone.amount / 100,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "stripe request failed" },
      { status: 502 },
    );
  }
}
