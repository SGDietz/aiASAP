"use client";

import { useEffect, useState } from "react";

// ── /paid ───────────────────────────────────────────────────────────────────
// Where Stripe sends someone after a milestone payment, paid or bailed.
//
// This page deliberately has NO avatar and NO link back to "/". Loading the
// home page starts a live session the moment it renders, which costs real
// money - so a payment page must never bounce anybody there, least of all
// somebody who just backed out of paying. The previous /subscribe page got
// this right and the comment there said so; keeping the rule.
//
// There is no button here either. Nobody buys from aiASAP without talking to
// Scott first, so there is nothing to click.
//
// Brand rule: EVERY "aiASAP" is italic.
//
// w-full on the root div is LOAD-BEARING. app/layout.tsx makes <body> a column
// flex with items-center, so a child shrinks to its content width instead of
// stretching - which left this page's gradient stranded in a ~420px column with
// flat dark either side. Caught by looking at it; HTTP 200 and tsc both passed.

const Mark = ({ className = "" }: { className?: string }) => (
  <span className={`italic font-semibold ${className}`}>aiASAP</span>
);

export default function PaidPage() {
  const [status, setStatus] = useState<"paid" | "canceled" | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setStatus(p.get("ok") === "1" ? "paid" : "canceled");
  }, []);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-b from-[#3a2108] via-[#2a1806] to-[#1a0f04] px-5 py-14">
      <article className="w-full max-w-md text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-[#d7a05a]">
          <Mark className="text-[#f4d9a8]" />
        </p>

        <div className="mx-auto mt-6 h-px w-2/3 bg-gradient-to-r from-transparent via-[#e8b46b]/40 to-transparent" />

        {status === "paid" && (
          <div className="mt-8">
            <p className="text-3xl font-black text-[#ffe9c2] sm:text-4xl">
              Payment received
            </p>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-[#e9dcc6] sm:text-base">
              Thank you. Scott has been told, and he&apos;ll be in touch
              shortly to get started.
            </p>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-[#e9dcc6]/80">
              Your receipt is on its way to your email from Stripe. It will
              show up as <span className="font-semibold text-[#f4d9a8]">AIASAP</span>{" "}
              on your card.
            </p>
          </div>
        )}

        {status === "canceled" && (
          <div className="mt-8">
            <p className="text-3xl font-black text-[#ffe9c2] sm:text-4xl">
              No charge was made
            </p>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-[#e9dcc6] sm:text-base">
              You closed the payment page before finishing, and nothing came
              off your card. Your place is still held.
            </p>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-[#e9dcc6]/80">
              If something went wrong, or you&apos;d rather talk it through
              first, just reply to Scott on the same thread he sent you the
              link.
            </p>
          </div>
        )}

        {/* Until the query string is read, show nothing rather than the wrong
            one of the two - a flash of "no charge was made" to somebody who
            just paid $2,000 is its own small heart attack. */}
        {status === null && <div className="mt-8 h-24" />}

        <p className="mt-10 text-xs leading-relaxed text-[#e9dcc6]/60">
          Payments are handled by Stripe. <Mark /> never sees your card.
        </p>
      </article>
    </div>
  );
}
