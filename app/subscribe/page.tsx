"use client";

import { useEffect, useState } from "react";
import { BackToPreviousButton } from "../../src/components/BackToPreviousButton";

// ── /subscribe ──────────────────────────────────────────────────────────────
// Isolated membership / checkout page (born 2026-06-13). Does NOT touch the
// voice pipeline. One button → POSTs the existing /api/stripe/checkout route →
// redirects to Stripe's hosted page where the user enters their card.
// success/cancel return to THIS page (never the avatar home — avoids credit burn).
// Brand rule: EVERY "aiASAP" is italic.

const Mark = ({ className = "" }: { className?: string }) => (
  <span className={`italic font-semibold ${className}`}>aiASAP</span>
);

export default function SubscribePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "paid" | "canceled">("idle");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("paid") === "1") setStatus("paid");
    else if (p.get("canceled") === "1") setStatus("canceled");
  }, []);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success_path: "/subscribe?paid=1",
          cancel_path: "/subscribe?canceled=1",
        }),
      });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        disabled?: boolean;
      };
      if (data.disabled) {
        setError("Payments aren't switched on yet. Try again in a minute.");
        setLoading(false);
        return;
      }
      if (!res.ok || !data.url) {
        setError(data.error || "Could not start checkout. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
      <BackToPreviousButton />
      <article
        className="mx-auto w-full max-w-lg overflow-visible rounded-2xl border border-[#e8b46b]/30 px-6 py-8 text-center shadow-2xl backdrop-blur sm:px-10 sm:py-10"
        style={{
          background:
            "radial-gradient(circle at 18% 0%, rgba(232,180,107,0.18), transparent 38%), linear-gradient(180deg, rgba(62,39,21,0.92), rgba(23,17,14,0.94) 55%, rgba(8,5,4,0.94))",
        }}
      >
        {/* Brand wordmark */}
        <h1 className="flex flex-col items-center leading-none">
          <span className="aiasap-logo-mark inline-block overflow-visible bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text px-3 text-4xl font-bold italic text-transparent drop-shadow-[0_2px_14px_rgba(0,0,0,0.8)] sm:text-5xl">
            aiASAP
          </span>
          <span className="mt-2 inline-block bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#b3793a] bg-clip-text px-[0.35em] text-xs font-semibold uppercase tracking-[0.3em] text-transparent sm:text-sm">
            Membership
          </span>
        </h1>

        {/* Ironclad ownership guarantee — the hero */}
        <div className="mt-8">
          <h2 className="bg-gradient-to-b from-[#ffe9c2] via-[#f0c07a] to-[#d7a05a] bg-clip-text text-4xl font-black leading-[1.05] text-transparent drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] sm:text-5xl">
            Our Ironclad Guarantee
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg font-bold leading-snug text-[#ffe9c2] sm:text-xl">
            You Own Your Ideas and Your Builds 100%. Forever.
          </p>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-[#e9dcc6] sm:text-base">
            When you pay the minimum subscription fee, <Mark className="text-[#f4d9a8]" />{" "}
            considers this a simple fee for service — nothing more. Everything
            you make here is 100% yours: every idea, every build, every dollar it
            earns. It stays yours forever. Build a tiny tool or a billion-dollar
            company — you own all of it, yourself.{" "}
            <Mark className="text-[#f4d9a8]" /> takes no piece, no claim, no cut.
            Not now. Not ever. We&apos;re just here to help you build it.
          </p>
        </div>

        {/* Divider */}
        <div className="mx-auto mt-8 h-px w-2/3 bg-gradient-to-r from-transparent via-[#e8b46b]/40 to-transparent" />

        {status === "paid" ? (
          <div className="mt-7">
            <p className="text-3xl font-black text-[#ffe9c2] sm:text-4xl">
              🎉 You&apos;re a member!
            </p>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[#e9dcc6] sm:text-base">
              Payment received. Everything you build with <Mark className="text-[#f4d9a8]" />{" "}
              is 100% yours — now and forever.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6">
              <span className="text-4xl font-extrabold text-[#ffe9c2]">$9.95</span>
              <span className="text-lg text-[#e9dcc6]/80"> / month</span>
            </div>

            <button
              onClick={startCheckout}
              disabled={loading}
              className="mt-6 w-full rounded-full bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#7a4a16] px-6 py-4 text-lg font-bold text-[#3a2108] shadow-lg transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Opening secure checkout…" : "Subscribe — $9.95/mo"}
            </button>

            {status === "canceled" && (
              <p className="mt-4 text-sm text-[#e9dcc6]/80">
                Checkout canceled — no charge was made.
              </p>
            )}
            {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

            <p className="mt-6 text-xs leading-relaxed text-[#e9dcc6]/60">
              Secure payment by Stripe. You enter your card on Stripe&apos;s page
              — <Mark /> never sees it. Cancel anytime.
            </p>
          </>
        )}
      </article>
    </div>
  );
}
