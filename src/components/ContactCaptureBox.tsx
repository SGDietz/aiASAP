"use client";

import type { BuildInterestStage, ContactMethod } from "../lib/buildInterestFlow";
import type { SendLinkFallbackStatus } from "../lib/signup/sendLinkFallback";

export function ContactCaptureBox({
  stage,
  method,
  value,
  sendLink,
}: {
  stage: BuildInterestStage;
  method: ContactMethod | null;
  value: string | null;
  sendLink?: {
    status: SendLinkFallbackStatus;
    email: string | null;
    onSend: () => void;
  };
}) {
  const sendLinkVisible = Boolean(
    sendLink && sendLink.status !== "hidden" && sendLink.email,
  );
  const visible = sendLinkVisible || ["contact_method", "contact_capture", "confirming", "saving", "failed", "submitted"].includes(stage);
  if (!visible) return null;
  if (sendLinkVisible && sendLink) {
    const title = sendLink.status === "pending"
      ? "Send your sign-in link?"
      : sendLink.status === "sending"
        ? "Sending sign-in link…"
        : sendLink.status === "sent"
          ? "Sign-in link sent"
          : "Link not sent — try again";
    return (
      <div
        data-send-link-fallback="1"
        className="pointer-events-none fixed left-1/2 z-[61] w-[min(88vw,22rem)] -translate-x-1/2 rounded-2xl border border-[#e0aa62]/45 bg-black/72 px-4 py-3 text-center shadow-[0_14px_35px_rgba(0,0,0,0.58)] backdrop-blur-md bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.291+11.25rem)] md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203+12.75rem)]"
      >
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#e0aa62]">{title}</p>
        <p className="mt-1 break-all text-sm font-semibold tracking-wide text-[#ffe9c2]">{sendLink.email}</p>
        {(sendLink.status === "pending" || sendLink.status === "failed") && (
          <button
            type="button"
            onClick={sendLink.onSend}
            className="pointer-events-auto mt-2 rounded-full border border-[#e0aa62]/70 bg-[#241406]/95 px-4 py-1.5 text-xs font-semibold text-[#f1c477]"
          >
            {sendLink.status === "failed" ? "Try sending again" : "Send link"}
          </button>
        )}
      </div>
    );
  }
  const showValue = stage === "confirming" || stage === "saving" || stage === "submitted";
  const title = stage === "submitted"
    ? "Follow-up saved"
    : stage === "saving"
      ? "Saving follow-up…"
      : stage === "failed"
        ? "Not saved — try again"
        : method === "phone"
          ? "Phone follow-up"
          : method === "email"
            ? "Email follow-up"
            : "Choose email or phone";
  return (
    <div
      data-contact-capture-box="1"
      className="pointer-events-none fixed left-1/2 z-[61] w-[min(88vw,22rem)] -translate-x-1/2 rounded-2xl border border-[#e0aa62]/45 bg-black/72 px-4 py-3 text-center shadow-[0_14px_35px_rgba(0,0,0,0.58)] backdrop-blur-md bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.291+11.25rem)] md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203+12.75rem)]"
    >
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#e0aa62]">{title}</p>
      {showValue && value ? (
        <p className="mt-1 break-all text-sm font-semibold tracking-wide text-[#ffe9c2]">{value}</p>
      ) : (
        <p className="mt-1 text-xs text-white/80">6 will read it back before anything is saved.</p>
      )}
    </div>
  );
}
