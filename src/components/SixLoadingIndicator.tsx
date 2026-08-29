"use client";

import { useLayoutEffect, useRef } from "react";
import { LoadingText } from "./TaglineText";

type SixLoadingIndicatorProps = {
  className?: string;
};

// Loading-only paint remap for the byte-identical production PNG. The low
// source range (the baked tile) flattens to #1f1005, while the exact source 6
// pixels move from warm #f0b344 at the top through #cc7d2d to #90531f at the
// bottom. Geometry, antialiasing, and the upright production silhouette remain
// owned by /aiasap-app-icon.png; these tables never move or redraw a pixel.
const LOADING_SIX_RED_TABLE =
  "0.1216 0.1216 0.1216 0.1216 0.1216 0.1216 0.1216 0.28 0.40 0.50 0.5725 0.64 0.70 0.75 0.85 0.90 0.9412";
const LOADING_SIX_GREEN_TABLE =
  "0.0627 0.0627 0.0627 0.0627 0.0627 0.16 0.26 0.36 0.40 0.45 0.49 0.55 0.60 0.65 0.69 0.7098 0.7098";
const LOADING_SIX_BLUE_TABLE =
  "0.0196 0.0196 0.06 0.10 0.16 0.17 0.18 0.19 0.20 0.21 0.22 0.23 0.2667 0.2667 0.2667 0.2667 0.2667";

function LoadingLabel() {
  const labelRef = useRef<HTMLSpanElement>(null);
  const inkRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const label = labelRef.current;
    const ink = inkRef.current;
    if (!label || !ink) return;

    const fit = () => {
      ink.style.transform = "none";
      const naturalWidth = ink.getBoundingClientRect().width;
      const targetWidth = label.getBoundingClientRect().width;
      if (naturalWidth > 0 && targetWidth > 0) {
        ink.style.transform = `scaleX(${targetWidth / naturalWidth})`;
      }
    };

    fit();
    document.fonts?.ready.then(fit).catch(() => {});
    const observer = new ResizeObserver(fit);
    observer.observe(label);
    observer.observe(ink);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <span
      ref={labelRef}
      data-six-loading-label="1"
      aria-hidden="true"
      className="flex justify-center overflow-visible whitespace-nowrap text-center"
    >
      <span
        ref={inkRef}
        suppressHydrationWarning
        data-six-loading-ink="1"
        className="inline-block origin-center overflow-visible bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#8c5f30] bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
      >
        <LoadingText />
      </span>
    </span>
  );
}

/** One visible loading authority for every real aiASAP foreground wait. */
export function SixLoadingIndicator({ className = "" }: SixLoadingIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      data-six-loading-indicator="1"
      className={`flex items-center justify-center text-[#e0aa62] ${className}`}
    >
      <LoadingLabel />
      {/* Keep the canonical upright Six byte-for-byte and scale the complete
          loading badge only through its responsive CSS viewport. The source PNG
          already contains the old 492px rounded-square stroke, so the interior
          clip starts just inside that stroke on every edge. That removes every
          baked rim remnant before the one approved 80%-width rim is drawn. */}
      <svg
        aria-hidden="true"
        data-six-loading-mark="1"
        viewBox="0 0 512 512"
        style={{
          width: "var(--six-loading-mark-size, 249.6px)",
          height: "var(--six-loading-mark-size, 249.6px)",
        }}
        className="h-52 w-52 shrink-0 drop-shadow-[0_0_18px_rgba(215,160,90,0.24)] sm:h-56 sm:w-56 md:h-60 md:w-60"
      >
        <defs>
          <clipPath id="six-loading-rim-interior-80">
            <rect x="78.42" y="12.5" width="355.16" height="487" rx="68" />
          </clipPath>
          <filter
            id="six-loading-normal-paint"
            x="0"
            y="0"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feComponentTransfer>
              <feFuncR type="table" tableValues={LOADING_SIX_RED_TABLE} />
              <feFuncG type="table" tableValues={LOADING_SIX_GREEN_TABLE} />
              <feFuncB type="table" tableValues={LOADING_SIX_BLUE_TABLE} />
            </feComponentTransfer>
          </filter>
        </defs>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <image
          href="/aiasap-app-icon.png"
          width="512"
          height="512"
          clipPath="url(#six-loading-rim-interior-80)"
          filter="url(#six-loading-normal-paint)"
        />
        <rect
          data-six-loading-rim="1"
          x="76.42"
          y="10"
          width="359.16"
          height="492"
          rx="72"
          fill="none"
          stroke="#e8ad59"
          strokeWidth="4"
        />
      </svg>
    </div>
  );
}
