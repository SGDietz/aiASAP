"use client";

/**
 * THE FOUR MVP BUTTONS — open, floating, icon above word.
 *
 *      START            GALLERY
 *      MUTE             QUIET
 *
 * G, 2026-09-04 late: "Change these back to what they were yesterday. The same
 * start stop. Gallery, mute, quiet, whatever. With the old icons, the old
 * spacing ... go back, like, twenty four hours, to the second screenshot, and
 * we gotta figure out from there what we can do to make this more attractive."
 *
 * So this is the BASELINE we iterate from: the plain outline icons the app has
 * always used (Play/Square, Images, Mic, Volume2), floating openly on 6's
 * chest with the word underneath, at the modest size and roomy spacing of his
 * second screenshot. The ornate gold sheet glyphs — compass rose, fleur
 * flourish, vintage mic, quill feather — are NOT deleted, they are one commit
 * back (efeffb05) and can be brought back whole or in pieces.
 *
 * State still recolors via the `off` tone: MUTE swaps to MicOff, QUIET to
 * VolumeX, both in the warmer off amber.
 */

import type { ReactNode } from "react";
import { Mic, MicOff, Square, Play, Volume2, VolumeX, Images } from "lucide-react";

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

/**
 * ONE shared icon class for all four, so the boxes are identical and the row
 * partners cannot sit at different latitudes. Every lucide glyph is drawn to
 * the same 24-unit square, so one box size IS level by construction — the
 * thing G asked for earlier tonight, kept.
 */
const ICON = "stage-open-glyph";

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
  /** Kept as a hook; all four outline glyphs share one soft shadow now. */
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
  // stays constant across the phone/tablet button-height step.
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
          {/* NAME IS HISTORICAL, STOPS ARE THE WORDMARK'S. G, 2026-09-04 late:
              "Make this start gallery mute quiet all that also the same color
              blends and the icons as aiASAP." These are the three stops off
              wordmark, sliced the way the wordmark's own box shows them - an
              icon fills nearly its whole box, so on the raw 0-100% ramp its
              bottom third went to near-black (G: "looks like there's some
              black"). See the --aiasap-blend-small note in globals.css. The id
              is left alone because these four icons are its only users and
              renaming it buys nothing but risk mid-iteration. */}
          <linearGradient id="aiasap-contact-gold-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--aiasap-blend-small-1)" />
            <stop offset="40%" stopColor="var(--aiasap-blend-small-2)" />
            <stop offset="72%" stopColor="var(--aiasap-blend-small-3)" />
            <stop offset="100%" stopColor="var(--aiasap-blend-small-4)" />
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
      >
        {running ? <Square className={ICON} aria-hidden /> : <Play className={ICON} aria-hidden />}
      </Btn>

      <Btn
        controlId="gallery"
        label="Gallery"
        onClick={onGallery ?? (() => {})}
        disabled={dormant || !onGallery}
        className="order-2"
        mobileStartControls={mobileStartControls}
      >
        <Images className={ICON} aria-hidden />
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
        {micOff ? <MicOff className={ICON} aria-hidden /> : <Mic className={ICON} aria-hidden />}
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
        {quiet ? <VolumeX className={ICON} aria-hidden /> : <Volume2 className={ICON} aria-hidden />}
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
          {/* NAME IS HISTORICAL, STOPS ARE THE WORDMARK'S. G, 2026-09-04 late:
              "Make this start gallery mute quiet all that also the same color
              blends and the icons as aiASAP." These are the three stops off
              wordmark, sliced the way the wordmark's own box shows them - an
              icon fills nearly its whole box, so on the raw 0-100% ramp its
              bottom third went to near-black (G: "looks like there's some
              black"). See the --aiasap-blend-small note in globals.css. The id
              is left alone because these four icons are its only users and
              renaming it buys nothing but risk mid-iteration. */}
          <linearGradient id="aiasap-contact-gold-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--aiasap-blend-small-1)" />
            <stop offset="40%" stopColor="var(--aiasap-blend-small-2)" />
            <stop offset="72%" stopColor="var(--aiasap-blend-small-3)" />
            <stop offset="100%" stopColor="var(--aiasap-blend-small-4)" />
          </linearGradient>
        </defs>
      </svg>
      <Btn controlId="start" label="Start" onClick={() => {}} disabled className="order-1">
        <Play className={ICON} aria-hidden />
      </Btn>
      <Btn controlId="gallery" label="Gallery" onClick={() => {}} disabled className="order-2">
        <Images className={ICON} aria-hidden />
      </Btn>
      <Btn controlId="mute" label="Mute" onClick={() => {}} disabled tone="off" className="order-3">
        <MicOff className={ICON} aria-hidden />
      </Btn>
      <Btn controlId="quiet" label="Quiet" onClick={() => {}} disabled className="order-4">
        <Volume2 className={ICON} aria-hidden />
      </Btn>
    </div>
  );
}
