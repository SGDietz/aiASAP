"use client";

import { WILDWORKS_LIVE_URL } from "../lib/wildWorksLinkIntent";

/** Appears only after a live visitor explicitly asks to see WildWorks. */
export function WildWorksLinkButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <aside
      data-wildworks-link-card="1"
      aria-label="WildWorks website link"
      onClick={(event) => event.stopPropagation()}
      className="pointer-events-auto fixed bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.291+11.25rem)] left-1/2 z-[63] w-[min(88vw,22rem)] -translate-x-1/2 rounded-2xl border border-[#d7a05a]/45 bg-black/72 px-4 py-3 text-center shadow-[0_14px_35px_rgba(0,0,0,0.58)] backdrop-blur-md md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203+12.75rem)]"
    >
      <button
        type="button"
        aria-label="Dismiss WildWorks link"
        onClick={onDismiss}
        className="absolute right-2 top-1 min-h-9 min-w-9 text-lg text-[#d7a05a]/80 hover:text-[#d7a05a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe9c2]"
      >
        ×
      </button>
      <a
        href={WILDWORKS_LIVE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="www.WildWorks.Live (opens in a new tab)"
        data-wildworks-link-button="1"
        className="inline-flex min-h-11 max-w-full items-center justify-center whitespace-nowrap px-2 py-1 text-[1.6875rem] leading-none font-bold tracking-[0.02em] text-[#d7a05a]/80 transition-colors hover:text-[#d7a05a] focus-visible:text-[#d7a05a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe9c2] md:text-[clamp(1.44rem,calc(var(--stage-width)*0.05184),1.728rem)] md:leading-normal"
      >
        www.WildWorks.Live
      </a>
      <p className="mt-1 text-xs text-[#ffe9c2]/80">Opens in a new tab — return here to continue.</p>
    </aside>
  );
}
