"use client";

/**
 * THE FOUR MVP BUTTONS — open, floating, icon above word.
 *
 * G, 2026-09-04: replace the four rectangular boxes with icon+word controls
 * that float openly on 6's chest. Same 2x2 order, same handlers, same aria,
 * same disabled/toned state — only the paint and the glyphs change.
 *
 *      START            GALLERY
 *      MUTE             QUIET
 *
 * G, 2026-09-04 late, with his reference sheet (aiasap-approved-four-controls
 * .png — solid gold glyphs on a warm glow): "the start gallery mute quiet
 * buttons, they're not on the same latitude. They gotta be level side to side.
 * And, basically, just take that and put it on six's chest ... his stomach is
 * just above his hands. Make it beautiful."
 *
 * LEVEL BY CONSTRUCTION — the only way the pairs stay level at every size:
 *   Every glyph is drawn so its INK spans exactly y = 1.0 .. 23.0 of its own
 *   viewBox, and every <svg> is rendered at ONE shared height with its width
 *   following its own aspect (wide flourish, narrow mic). So the painted top
 *   edge and the painted bottom edge of START and GALLERY are the same pixel,
 *   and likewise MUTE and QUIET — no per-icon transforms, no nudges, nothing
 *   that can drift when the label size or the breakpoint changes. The label
 *   line boxes below are shared already. The measured proof lives in
 *   chest_probe.py (ink top/bottom per pair, at ten viewports).
 *
 * The four glyphs follow his sheet, not a stock icon set:
 *   START    — eight-point compass rose inside two thin rings, bevelled points
 *              (light/dark halves), hub with a dot.
 *   GALLERY  — fleur-de-lis crown over a symmetrical antique scroll flourish.
 *   MUTE     — vintage microphone: grilled capsule in a cradle, stem, base.
 *              NO slash — state recolors via the `off` tone.
 *   QUIET    — quill feather floating over a gentle curved wave.
 *
 * All fills use the shared amber-gold gradient defined in the cluster, with a
 * hairline dark-bronze outline so the gold reads as metal against the denim.
 */

import type { ReactNode } from "react";

export type StageControlsProps = {
  /** false when 6 is stopped — the top-left button becomes START. */
  running: boolean;
  /** true when the mic is off (6 cannot hear them). */
  micOff: boolean;
  /** true when 6's voice is silenced. */
  quiet: boolean;
  onStopStart: () => void;
  onToggleMic: () => void;
  onToggleQuiet: () => void;
  /**
   * Bottom-right (G, 2026-08-21). Opens the camera roll and uploads — the
   * gallery path already existed in this app, it just had no button on the
   * stage. Without a live handler the control stays visible but disabled, so
   * the post-STOP state retains the complete four-button layout.
   */
  onGallery?: () => void;
  disabledStopStart?: boolean;
  /** Loading-only presentation: visible in the familiar layout, but inert. */
  dormant?: boolean;
  /** Initial Start page only: compact rounded controls below the desktop breakpoint. */
  mobileStartControls?: boolean;
  /**
   * Initial navigation only. Controls the accepted attention animation after
   * React is ready; the pre-React bridge owns the already-visible first tap.
   */
  startupStartReady?: boolean;
  /** Initial START only: stable delegated target for the pre-React bridge. */
  earlyStartBridge?: boolean;
};

const LABEL =
  "text-[12px] sm:text-[14px] leading-none uppercase tracking-[0.14em] text-[#d7a05a]";
const INLINE_LABEL =
  "text-[12px] sm:text-[14px] leading-none uppercase tracking-[0.1em] text-[#d7a05a]";

function Btn({
  controlId,
  label,
  onClick,
  disabled,
  tone = "brand",
  className = "",
  mobileStartControls = false,
  earlyStartBridge = false,
  glowTone = "full",
  children,
}: {
  controlId: "start" | "mute" | "quiet" | "gallery";
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "brand" | "off";
  className?: string;
  mobileStartControls?: boolean;
  earlyStartBridge?: boolean;
  /** Kept as a hook; all four glyphs are solid gold now and share one glow. */
  glowTone?: "full" | "muted";
  children: ReactNode;
}) {
  return (
    <div
      data-stage-control={controlId}
      className={`relative flex flex-col items-center ${mobileStartControls ? "h-full w-full gap-0" : "gap-[6.6px]"} ${className}`}
    >
      <button
        type="button"
        data-aiasap-early-start={earlyStartBridge ? "1" : undefined}
        data-stage-open-control="1"
        data-stage-control-glow={glowTone}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={`stage-open-control flex ${mobileStartControls ? "h-full w-full" : "h-full w-full"} flex-col items-center justify-center gap-[3px] bg-transparent px-1 py-0 ${
          tone === "off" ? "text-[#d77a2f]" : "text-[#e0aa62]"
        }`}
      >
        <span className="stage-control-icon inline-flex opacity-100">{children}</span>
        <span data-stage-control-inline-label="1" className={INLINE_LABEL}>
          {label}
        </span>
      </button>
      <span
        data-stage-control-label="1"
        aria-hidden="true"
        className={`${LABEL} invisible ${mobileStartControls ? "hidden" : ""}`}
      >
        {label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/*  ICONS — solid gold, drawn inline so they carry the shared gradient.       */
/*  INK RULE: every glyph's painted extent is y = 1.0 .. 23.0 in its viewBox. */
/*  Change a path and re-run chest_probe.py; the pairs must stay level.        */
/* ------------------------------------------------------------------------- */

const GOLD = "url(#aiasap-contact-gold-gradient)";
const BRONZE = "var(--aiasap-contact-gold-4)";

function IconSvg({
  viewBox,
  children,
}: {
  /** The glyph's own aspect; height is shared by CSS, width follows. */
  viewBox: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      stroke="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-stage-glyph="1"
    >
      {children}
    </svg>
  );
}

/** One bevelled compass point: light half + shaded half, tip at (12, tipY).
    The shaded half is the mid gold, not the bronze edge tone - on his sheet
    the points read as one bright metal with a facet, never as brown. */
function CompassPoint({ rot, tipY, halfW, soft }: { rot: number; tipY: number; halfW: number; soft?: boolean }) {
  const shoulderY = 10.6;
  return (
    <g transform={`rotate(${rot} 12 12)`}>
      <path d={`M12 ${tipY} L${12 + halfW} ${shoulderY} L12 12 Z`} fill={GOLD} stroke={BRONZE} strokeWidth="0.28" opacity={soft ? 0.94 : 1} />
      <path d={`M12 ${tipY} L${12 - halfW} ${shoulderY} L12 12 Z`} fill="var(--aiasap-contact-gold-3)" stroke={BRONZE} strokeWidth="0.28" opacity={soft ? 0.88 : 1} />
    </g>
  );
}

/** START — eight-point compass rose; the long cardinal points reach well past
    two small rings, the way the sheet draws it. Ink y 1.0..23.0. */
export function CompassRoseIcon() {
  return (
    <IconSvg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="6.7" stroke={GOLD} strokeWidth="0.9" />
      <circle cx="12" cy="12" r="5.45" stroke={GOLD} strokeWidth="0.45" opacity="0.8" />
      <CompassPoint rot={45} tipY={3.4} halfW={1.15} soft />
      <CompassPoint rot={135} tipY={3.4} halfW={1.15} soft />
      <CompassPoint rot={225} tipY={3.4} halfW={1.15} soft />
      <CompassPoint rot={315} tipY={3.4} halfW={1.15} soft />
      <CompassPoint rot={0} tipY={1.0} halfW={1.55} />
      <CompassPoint rot={90} tipY={1.0} halfW={1.55} />
      <CompassPoint rot={180} tipY={1.0} halfW={1.55} />
      <CompassPoint rot={270} tipY={1.0} halfW={1.55} />
      <circle cx="12" cy="12" r="2.0" fill={GOLD} stroke={BRONZE} strokeWidth="0.4" />
      <circle cx="12" cy="12" r="0.7" fill={BRONZE} />
    </IconSvg>
  );
}

/** One side of the flourish; the other is a mirror. Ink y 8.4..22.0, x 2.0..22. */
function FlourishHalf() {
  return (
    <>
      <path d="M22 10.5 C17.2 9.2 12.2 9.7 8.2 12.5 C4.7 15 2.5 17.8 3.4 20.5 C4 22.2 6.3 22.3 6.9 20.7 C7.3 19.4 5.9 18.5 5.1 19.5" stroke={GOLD} strokeWidth="1.55" />
      <path d="M22 12.7 C18.3 12.5 15.3 13.7 13.3 15.7 C11.7 17.3 12.5 19.5 14.3 19.3 C15.7 19.1 15.8 17.5 14.6 17.4" stroke={GOLD} strokeWidth="1.1" />
      <path d="M22 14.9 C19 15.3 16.8 17.4 16.8 20.1 C16.8 21.6 18.2 22.3 19.1 21.4 C19.8 20.7 19.1 19.6 18.3 20" stroke={GOLD} strokeWidth="0.9" opacity="0.9" />
      <circle cx="4.6" cy="20.2" r="0.55" fill={GOLD} />
      <circle cx="13.9" cy="18.1" r="0.45" fill={GOLD} />
    </>
  );
}

/** GALLERY — fleur-de-lis crown over a symmetrical scroll flourish. Ink y 1.0..23.0. */
export function FlourishIcon() {
  return (
    <IconSvg viewBox="0 0 44 24">
      {/* crown: centre petal, two side petals, band */}
      <path d="M22 1 C23.7 3.5 23.7 6.4 22 8.7 C20.3 6.4 20.3 3.5 22 1 Z" fill={GOLD} stroke={BRONZE} strokeWidth="0.3" />
      <path d="M21.7 8.4 C19.9 7.9 18.2 6.2 18.3 3.9 C20.2 4.6 21.4 6.4 21.7 8.4 Z" fill={GOLD} stroke={BRONZE} strokeWidth="0.3" />
      <path d="M22.3 8.4 C24.1 7.9 25.8 6.2 25.7 3.9 C23.8 4.6 22.6 6.4 22.3 8.4 Z" fill={GOLD} stroke={BRONZE} strokeWidth="0.3" />
      <path d="M19.4 9.1 H24.6" stroke={GOLD} strokeWidth="1.0" />
      {/* scrolls, left then mirrored right */}
      <FlourishHalf />
      <g transform="matrix(-1 0 0 1 44 0)">
        <FlourishHalf />
      </g>
      {/* centre drop */}
      <path d="M22 18.2 L23.2 20.6 L22 23 L20.8 20.6 Z" fill={GOLD} stroke={BRONZE} strokeWidth="0.3" />
    </IconSvg>
  );
}

/** MUTE — vintage microphone, no slash: grilled capsule, cradle, stem, base. Ink y 1.0..23.0. */
export function VintageMicIcon() {
  return (
    <IconSvg viewBox="0 0 24 24">
      <rect x="8.4" y="1.2" width="7.2" height="12.6" rx="3.6" fill={GOLD} stroke={BRONZE} strokeWidth="0.35" />
      <path d="M9.9 4.4 H14.1 M9.9 6.6 H14.1 M9.9 8.8 H14.1 M9.9 11 H14.1" stroke={BRONZE} strokeWidth="0.55" opacity="0.72" />
      <path d="M12 3.1 V12.3" stroke={BRONZE} strokeWidth="0.45" opacity="0.45" />
      <path d="M6.3 9.9 V12.2 A5.7 5.7 0 0 0 17.7 12.2 V9.9" stroke={GOLD} strokeWidth="1.7" />
      <path d="M12 17.9 V21.4" stroke={GOLD} strokeWidth="1.7" />
      <path d="M8.6 22.2 H15.4" stroke={GOLD} strokeWidth="1.6" />
    </IconSvg>
  );
}

/** QUIET — quill feather floating over one gentle curved wave. Ink y 1.0..23.0. */
export function FeatherWaveIcon() {
  return (
    <IconSvg viewBox="0 0 26 24">
      {/* vane */}
      <path d="M24.4 1.2 C24.1 6.3 22.4 10.4 19.3 13.2 C16.5 15.7 13.1 17 9.3 17.2 C10.2 12.9 12.6 9.1 16.2 6 C18.7 3.9 21.4 2.3 24.4 1.2 Z" fill={GOLD} stroke={BRONZE} strokeWidth="0.35" />
      {/* barbs */}
      <path d="M21.2 4.6 L19.4 8.1 M18.9 6.7 L17.1 10.2 M16.6 8.9 L14.9 12.3 M14.4 11.2 L12.9 14.2" stroke={BRONZE} strokeWidth="0.45" opacity="0.62" />
      {/* spine + shaft down to the nib */}
      <path d="M24.1 1.6 L5.3 19.2" stroke={GOLD} strokeWidth="1.15" />
      <path d="M24.1 1.6 L9.6 15.3" stroke={BRONZE} strokeWidth="0.4" opacity="0.55" />
      {/* wave */}
      <path d="M1.4 21.2 C5.4 18.6 9.4 18.6 13 20.8 C16.6 23 20.6 22.8 24.6 20" stroke={GOLD} strokeWidth="1.6" />
      <path d="M3.2 22.7 C6.8 21.1 10 21.1 12.8 22.4" stroke={GOLD} strokeWidth="0.75" opacity="0.6" />
    </IconSvg>
  );
}

export function StageControls({
  running,
  micOff,
  quiet,
  onStopStart,
  onToggleMic,
  onToggleQuiet,
  onGallery,
  disabledStopStart = false,
  dormant = false,
  mobileStartControls = false,
  startupStartReady = true,
  earlyStartBridge = false,
}: StageControlsProps) {
  // Anchored from the BOTTOM edge rather than the top so the gap to 6's hands
  // stays constant across the phone/tablet button-height step. The live anchor
  // (cluster bottom = hands top - a small gap, both breakpoints) is the
  // CHEST ANCHOR block at the end of app/globals.css.
  // There are exactly four rendered controls and no reserved voice-only slot.
  return (
    <div
      data-stage-controls="1"
      data-stage-controls-open="1"
      data-mobile-start-controls={mobileStartControls ? "1" : undefined}
      data-start-cta-attention={mobileStartControls && startupStartReady && !running && !dormant ? "1" : undefined}
      data-loading-dormant-controls={dormant ? "1" : undefined}
      aria-hidden={dormant || undefined}
      className={`stage-controls-cluster fixed left-1/2 z-[60] -translate-x-1/2 translate-y-[4px] grid grid-cols-2 grid-rows-2 gap-x-[6px] gap-y-[6px] opacity-100 bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.225-4px)] md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203)] ${dormant ? "pointer-events-none" : "pointer-events-auto"}`}
    >
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="aiasap-contact-gold-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--aiasap-contact-gold-1)" />
            <stop offset="34%" stopColor="var(--aiasap-contact-gold-2)" />
            <stop offset="70%" stopColor="var(--aiasap-contact-gold-3)" />
            <stop offset="100%" stopColor="var(--aiasap-contact-gold-4)" />
          </linearGradient>
        </defs>
      </svg>

      <Btn
        controlId="start"
        label={running ? "Stop" : "Start"}
        onClick={onStopStart}
        disabled={dormant || disabledStopStart}
        className="order-1"
        mobileStartControls={mobileStartControls}
        earlyStartBridge={earlyStartBridge}
        glowTone="muted"
      >
        <CompassRoseIcon />
      </Btn>

      <Btn
        controlId="gallery"
        label="Gallery"
        onClick={onGallery ?? (() => {})}
        disabled={dormant || !onGallery}
        className="order-2"
        mobileStartControls={mobileStartControls}
      >
        <FlourishIcon />
      </Btn>

      <Btn
        controlId="mute"
        label="Mute"
        onClick={onToggleMic}
        disabled={dormant || !running}
        className="order-3"
        tone={micOff ? "off" : "brand"}
        mobileStartControls={mobileStartControls}
      >
        <VintageMicIcon />
      </Btn>

      <Btn
        controlId="quiet"
        label="Quiet"
        onClick={onToggleQuiet}
        disabled={dormant || !running}
        className="order-4"
        tone={quiet ? "off" : "brand"}
        mobileStartControls={mobileStartControls}
      >
        <FeatherWaveIcon />
      </Btn>
    </div>
  );
}

/** Familiar four-button loading silhouette with no reachable action or focus. */
export function DormantStageControls() {
  return (
    <div
      data-stage-controls="1"
      data-stage-controls-open="1"
      data-loading-dormant-controls="1"
      aria-hidden="true"
      className="stage-controls-cluster pointer-events-none fixed left-1/2 z-[60] -translate-x-1/2 translate-y-[4px] grid grid-cols-2 grid-rows-2 gap-x-[6px] gap-y-[6px] opacity-100 bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.225-4px)] md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203)]"
    >
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="aiasap-contact-gold-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--aiasap-contact-gold-1)" />
            <stop offset="34%" stopColor="var(--aiasap-contact-gold-2)" />
            <stop offset="70%" stopColor="var(--aiasap-contact-gold-3)" />
            <stop offset="100%" stopColor="var(--aiasap-contact-gold-4)" />
          </linearGradient>
        </defs>
      </svg>
      <Btn controlId="start" label="Start" onClick={() => {}} disabled className="order-1" glowTone="muted">
        <CompassRoseIcon />
      </Btn>
      <Btn controlId="gallery" label="Gallery" onClick={() => {}} disabled className="order-2">
        <FlourishIcon />
      </Btn>
      <Btn controlId="mute" label="Mute" onClick={() => {}} disabled tone="off" className="order-3">
        <VintageMicIcon />
      </Btn>
      <Btn controlId="quiet" label="Quiet" onClick={() => {}} disabled className="order-4">
        <FeatherWaveIcon />
      </Btn>
    </div>
  );
}
