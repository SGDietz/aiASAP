import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";
import { captureServerError } from "../../../../src/lib/observability/serverLogger";
import { notifyTeam } from "../../../../src/lib/teamNotify";

// ── STRIPE WEBHOOK ──────────────────────────────────────────────────────────
// Rewritten 2026-08-21. The old version mirrored SUBSCRIPTION state into a
// stripe_customers table - and that table has no migration in this repo, so
// every write it ever attempted would have failed. It never ran (dormant
// without a webhook secret), which is the only reason that never bit.
//
// aiASAP has no subscription. It has three one-time payments per build.
//
// TWO JOBS, AND THE SECOND ONE IS THE IMPORTANT ONE:
//   1. Write the payment down.
//   2. TELL SCOTT. A payment that lands in a database nobody is watching is
//      the same as a payment nobody knows about. The notify runs even if the
//      database write fails, and it runs first, because money arriving is the
//      one event in this whole system that must never be silent.
//
// Signature verification stays mandatory: an unsigned caller must never be
// able to write payment state or ring the phone.

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
  id?: string;
  type?: string;
  data?: {
    object?: {
      id?: string;
      amount?: number;
      amount_total?: number;
      currency?: string;
      customer_email?: string | null;
      customer_details?: { email?: string | null; name?: string | null };
      client_reference_id?: string | null;
      payment_status?: string;
      payment_intent?: string | null;
      charge?: string | null;
      reason?: string | null;
      metadata?: Record<string, string> | null;
    };
  };
};

function usd(cents: number | undefined): string {
  if (typeof cents !== "number") return "unknown";
  return `$${(cents / 100).toLocaleString("en-US")}`;
}

/** deposit | second | final, in words a human reads on a phone. */
const MILESTONE_WORDS: Record<string, string> = {
  deposit: "Deposit - the first $2,000. This starts the build.",
  second: "Second payment - $2,000, after the first delivery and its rounds.",
  final: "Final payment - the last $1,000. The build is paid in full.",
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
  // Stripe retries on any non-2xx, so every side effect below is keyed on the
  // event id and cannot fire twice for the same real-world event.
  const eventId = event.id ?? obj.id ?? "unknown";

  if (type === "checkout.session.completed") {
    // A completed session is not necessarily a PAID session.
    if (obj.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    const milestone = obj.metadata?.milestone ?? "unknown";
    const email = obj.customer_details?.email ?? obj.customer_email ?? null;
    const who = obj.customer_details?.name || email || "a client";
    const amount = usd(obj.amount_total);

    // TELL SCOTT FIRST. If the database is down, he still finds out.
    await notifyTeam({
      kind: "payment_received",
      who,
      email,
      facts: [
        ["Amount", amount],
        ["Which payment", MILESTONE_WORDS[milestone] ?? milestone],
        ["Stripe session", obj.id ?? null],
      ],
      nextStep:
        milestone === "deposit"
          ? "Start their build. The deposit is non-refundable and the clock is theirs now."
          : milestone === "final"
            ? "Paid in full. Deliver the final files and hand over everything."
            : "Carry on with the build - the next round of changes is theirs.",
      dedupeKey: `stripe:${eventId}`,
    });

    try {
      const { url, serviceRoleKey } = getSupabaseAdminConfig();
      await fetch(`${url}/rest/v1/build_payments?on_conflict=stripe_event_id`, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          stripe_event_id: eventId,
          stripe_session_id: obj.id ?? null,
          payment_intent_id: obj.payment_intent ?? null,
          milestone,
          amount_cents: obj.amount_total ?? null,
          currency: obj.currency ?? "usd",
          email,
          customer_name: obj.customer_details?.name ?? null,
          user_id: obj.client_reference_id ?? null,
          paid_at: new Date().toISOString(),
        }),
      });
    } catch (e) {
      await captureServerError({
        message: "build_payments insert failed (payment DID happen)",
        error: e,
        route: "/api/stripe/webhook",
      });
    }

    return NextResponse.json({ received: true });
  }

  // A chargeback on a young account is serious - Stripe can hold payouts over
  // it. This one wakes somebody up on purpose.
  if (type === "charge.dispute.created") {
    await notifyTeam({
      kind: "payment_received",
      who: "A DISPUTE was opened",
      facts: [
        ["Amount disputed", usd(obj.amount)],
        ["Reason given", obj.reason ?? "not stated"],
        ["Charge", obj.charge ?? obj.id ?? null],
      ],
      nextStep:
        "Respond in Stripe before the deadline. An unanswered dispute is lost automatically, and losses put payouts at risk.",
      dedupeKey: `stripe:${eventId}`,
    });
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
