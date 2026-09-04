"use client";

import {
  AIASAP_PUBLIC_PHONE_DISPLAY,
  AIASAP_PUBLIC_PHONE_HREF,
  AIASAP_PUBLIC_WEBSITE_DISPLAY,
} from "../lib/publicContact";
import { WILDWORKS_LIVE_URL } from "../lib/wildWorksLinkIntent";

export function PublicContactCard() {
  return (
    <nav
      data-public-contact-links="1"
      aria-label="Public contact options"
      onClick={(event) => event.stopPropagation()}
      className="pointer-events-auto fixed left-1/2 z-[62] -translate-x-1/2"
      style={{
        bottom: "var(--public-contact-bottom, calc(var(--stage-bottom) + 2.75rem))",
        width: "var(--public-contact-width, calc(var(--stage-width) * 0.9))",
      }}
    >
      <div className="grid w-full grid-cols-[auto_auto] justify-center gap-2 text-center">
        <a
          href={WILDWORKS_LIVE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${AIASAP_PUBLIC_WEBSITE_DISPLAY} in a new tab`}
          data-public-wildworks-link="1"
          data-public-contact-action="1"
          className="inline-flex min-h-[44px] items-center justify-center px-2 text-[clamp(1.25rem,calc(var(--stage-width)*0.04),1.625rem)] font-semibold tracking-[0.01em] no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f1c477]"
        >
          <span data-public-contact-ink="1">{AIASAP_PUBLIC_WEBSITE_DISPLAY}</span>
        </a>
        <a
          href={AIASAP_PUBLIC_PHONE_HREF}
          aria-label={`Call G at ${AIASAP_PUBLIC_PHONE_DISPLAY}`}
          data-public-phone-link="1"
          data-public-contact-action="1"
          className="inline-flex min-h-[44px] items-center justify-center px-2 text-[clamp(1.25rem,calc(var(--stage-width)*0.04),1.625rem)] font-semibold tracking-[0.01em] no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f1c477]"
        >
          <span data-public-contact-ink="1">{AIASAP_PUBLIC_PHONE_DISPLAY}</span>
        </a>
      </div>
    </nav>
  );
}
