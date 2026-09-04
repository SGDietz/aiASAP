"use client";

import type { CSSProperties, MouseEvent } from "react";
import { useRef } from "react";

type StageLegalFooterProps = {
  placementClassName?: string;
  phoneStackClassName?: string;
  /** Mobile flow-only reserve beneath Legal; changes the scene/legal seam, not footer paint. */
  phoneStackPaddingBottom?: CSSProperties["paddingBottom"];
  phoneFlow?: boolean;
  /**
   * Active voice/avatar surfaces use this to finish their real teardown before
   * the browser leaves the stage. Idle/stopped surfaces have nothing to stop.
   */
  onBeforeNavigate?: () => void | Promise<void>;
};

const ink = "aiasap-legal-ink";
type LegalDestination = "/your-rights" | "/legal";

export function StageLegalFooter({
  placementClassName =
    "md:absolute md:bottom-2 md:left-1/2 md:-translate-x-1/2",
  phoneStackClassName = "",
  phoneStackPaddingBottom,
  onBeforeNavigate,
  phoneFlow = false,
}: StageLegalFooterProps) {
  const navigatingRef = useRef(false);

  const handleLegalNavigation = async (
    event: MouseEvent<HTMLAnchorElement>,
    destination: LegalDestination,
  ) => {
    // The untouched front door is one large click target. A legal click must
    // remain legal navigation, never bubble into the paid-session start gate.
    event.stopPropagation();
    if (!onBeforeNavigate) return;

    event.preventDefault();
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    try {
      await onBeforeNavigate();
      window.location.assign(destination);
    } catch {
      // Fail closed: if teardown cannot be confirmed, stay on the stage instead
      // of opening Legal over a potentially live provider/audio session.
      navigatingRef.current = false;
    }
  };

  return (
    <div
      data-phone-bottom-stack="1"
      data-phone-flow={phoneFlow ? "1" : undefined}
      style={phoneStackPaddingBottom ? { paddingBottom: phoneStackPaddingBottom } : undefined}
      className={`pointer-events-auto z-[62] flex w-full shrink-0 flex-col items-center bg-[#241608] pb-[env(safe-area-inset-bottom)] md:contents ${phoneFlow ? "relative mt-auto" : "fixed inset-x-0 bottom-0"} ${phoneStackClassName}`}
    >
      <footer
        aria-label="Site legal"
        className={`stage-legal-footer ${placementClassName} z-40 flex h-[29px] w-full max-w-full items-center justify-center whitespace-nowrap bg-[#241608] leading-none md:h-auto md:w-auto md:bg-transparent md:leading-normal`}
      >
        <nav
          aria-label="aiASAP legal links"
          data-stage-legal-line="1"
          className="flex -translate-y-[4px] items-center justify-center gap-[clamp(2px,0.8vw,6px)] text-[clamp(11px,3.1vw,15px)] opacity-100 hover:opacity-100 md:translate-y-0 md:text-[18px]"
        >
          <a
            href="/your-rights"
            aria-label="Open You Own"
            onClick={(event) => void handleLegalNavigation(event, "/your-rights")}
            className={`inline-flex items-center justify-center px-1 py-2 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ffe9c2] md:p-0 md:focus-visible:outline-offset-2 ${ink}`}
          >
            You Own
          </a>
          <span aria-hidden className="aiasap-legal-separator inline-block origin-center scale-[1.25]">
            |
          </span>
          <span className={`shrink-0 ${ink}`}>©2026 aiASAP All Rights Reserved</span>
          <span aria-hidden className="aiasap-legal-separator inline-block origin-center scale-[1.25]">
            |
          </span>
          <a
            href="/legal"
            aria-label="Open aiASAP Terms and Legal"
            onClick={(event) => void handleLegalNavigation(event, "/legal")}
            className={`inline-flex items-center justify-center px-1 py-2 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#ffe9c2] md:p-0 md:focus-visible:outline-offset-2 ${ink}`}
          >
            Terms/Legal
          </a>
        </nav>
      </footer>
    </div>
  );
}
