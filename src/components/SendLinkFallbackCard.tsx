"use client";

import type { SendLinkFallbackStatus } from "../lib/signup/sendLinkFallback";

const CARD_POSITION =
  "pointer-events-none fixed left-1/2 z-[61] w-[min(88vw,22rem)] -translate-x-1/2 rounded-2xl border border-[#e0aa62]/45 bg-black/72 px-4 py-3 text-center shadow-[0_14px_35px_rgba(0,0,0,0.58)] backdrop-blur-md bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.291+11.25rem)] md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203+12.75rem)]";

export function SendLinkFallbackCard({
  status,
  email,
  onSend,
}: {
  status: SendLinkFallbackStatus;
  email: string | null;
  onSend: () => void;
}) {
  if (status === "hidden" || !email) return null;

  const title = status === "pending"
    ? "Send your sign-in link?"
    : status === "sending"
      ? "Sending sign-in link…"
      : status === "sent"
        ? "Sign-in link sent"
        : "Link not sent — try again";

  return (
    <div data-send-link-fallback="1" className={CARD_POSITION}>
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#e0aa62]">
        {title}
      </p>
      <p className="mt-1 break-all text-sm font-semibold tracking-wide text-[#ffe9c2]">
        {email}
      </p>
      {(status === "pending" || status === "failed") && (
        <button
          type="button"
          onClick={onSend}
          className="pointer-events-auto mt-2 rounded-full border border-[#e0aa62]/70 bg-[#241406]/95 px-4 py-1.5 text-xs font-semibold text-[#f1c477]"
        >
          {status === "failed" ? "Try sending again" : "Send link"}
        </button>
      )}
    </div>
  );
}
