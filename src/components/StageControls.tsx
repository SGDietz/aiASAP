"use client";

/**
 * THE FOUR MVP BUTTONS — restored to the original 2-by-2 composition.
 *
 *      STOP / START            MUTE
 *         QUIET               GALLERY
 *
 * The words, and why:
 *   STOP / START  one button, two states. G: "if someone hits stop he stops
 *                 completely, everything stops, but then the word start comes
 *                 up in that stop button." So the buttons STAY on screen when
 *                 he is stopped — this is not a different screen.
 *   MUTE          your microphone. 6 stops hearing you. Same sense as every
 *                 phone and video call — mute is what YOU do to yourself.
 *   QUIET         6's voice. You stop hearing him. Chosen over "silence" and
 *                 "sound" because it is the word a person would actually use:
 *                 "make him quiet".
 *
 * Placed over 6's chest, in his brand colours, because that is where G drew
 * them and because it is the one part of the frame with no face and no hands.
 */

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
  "text-[13.2px] sm:text-[14.52px] leading-none uppercase tracking-[0.14em] text-[#d7a05a]";
const MOBILE_START_LABEL =
  "text-[15.972px] leading-none uppercase tracking-[0.14em] text-[#d7a05a]";

function Btn({
  controlId,
  label,
  onClick,
  disabled,
  tone = "brand",
  className = "",
  mobileStartControls = false,
  earlyStartBridge = false,
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
  children: React.ReactNode;
}) {
  return (
    <div
      data-stage-control={controlId}
      className={`relative flex flex-col items-center ${mobileStartControls ? "h-full w-full gap-0" : "gap-[6.6px]"} ${className}`}
    >
      <button
        type="button"
        data-aiasap-early-start={earlyStartBridge ? "1" : undefined}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={`btn-inset btn-stage flex ${mobileStartControls ? "h-full w-full flex-col gap-[2px] rounded-none" : "h-[61.6px] w-[67.76px] rounded-full sm:h-[70.4px] sm:w-[77.44px]"} items-center justify-center ${
          tone === "off" ? "text-[#d77a2f]" : "text-[#e0aa62]"
        }`}
      >
        <span className="stage-control-icon inline-flex opacity-100">{children}</span>
        {mobileStartControls && (
          <span
            data-stage-control-label="1"
            className={MOBILE_START_LABEL}
          >
            {label}
          </span>
        )}
      </button>
      <span
        data-stage-control-label="1"
        className={`${LABEL} ${mobileStartControls ? "hidden" : ""}`}
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
  const icon = mobileStartControls
    ? "h-[30px] w-[30px]"
    : "h-[26.4px] w-[26.4px] sm:h-[30.8px] sm:w-[30.8px]";
  // Physical-phone correction (1080x2404 screenshot ~= 432x962 CSS): tighten
  // the two rows by 8px and lower the cluster by ~24px from the former .275
  // anchor. This keeps a visible gap above Six's hands without spreading the
  // four controls across his torso. md+ remains frozen.
  //
  // Measured off the real rendered screens, not guessed. His clasped hands
  // start at y=733 on a 1440x900 desktop and y=683 on a 430x932 phone. The
  // still behind him is object-cover object-top, so the crop is full-bleed on a
  // phone and a 9/16 letterbox from md up — the two genuinely need different
  // numbers, and one value cannot land right on both.
  //
  // Anchored from the BOTTOM edge rather than the top. The block is 186px tall
  // on desktop and 166px on a phone (the buttons step up at sm:), so a top
  // anchor would let the gap to his hands drift by 20px purely from a
  // button-size change. From the bottom, the gap IS the number.
  // Restore the original two-column/two-row block at the accepted current
  // stage anchor, preserving the proven link/hand clearance around it.
  // There are exactly four rendered controls and no reserved voice-only slot.
  return (
    <div
      data-stage-controls="1"
      data-mobile-start-controls={mobileStartControls ? "1" : undefined}
      data-start-cta-attention={mobileStartControls && startupStartReady && !running && !dormant ? "1" : undefined}
      data-loading-dormant-controls={dormant ? "1" : undefined}
      aria-hidden={dormant || undefined}
      className={`stage-controls-cluster fixed left-1/2 z-[60] -translate-x-1/2 translate-y-[4px] grid grid-cols-2 ${mobileStartControls ? "h-[150px] w-[220px] grid-rows-2 gap-0" : "gap-x-3 gap-y-3 sm:gap-x-4 sm:gap-y-4"} opacity-[0.9] bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.225-4px)] md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203)] ${dormant ? "pointer-events-none" : "pointer-events-auto"}`}
    >
      <Btn
        controlId="start"
        label={running ? "Stop" : "Start"}
        onClick={onStopStart}
        disabled={dormant || disabledStopStart}
        className="order-1"
        mobileStartControls={mobileStartControls}
        earlyStartBridge={earlyStartBridge}
      >
        {running ? (
          <Square data-phone-running-stop-glyph="1" className={icon} aria-hidden />
        ) : (
          <Play data-stage-start-glyph="1" className={icon} aria-hidden />
        )}
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
        {micOff ? (
          <MicOff
            data-phone-running-mute-glyph={running ? "1" : undefined}
            className={icon}
            aria-hidden
          />
        ) : (
          <Mic
            data-phone-running-mute-glyph={running ? "1" : undefined}
            className={icon}
            aria-hidden
          />
        )}
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
        {quiet ? <VolumeX className={icon} aria-hidden /> : <Volume2 className={icon} aria-hidden />}
      </Btn>

      <Btn
        controlId="gallery"
        label="Gallery"
        onClick={onGallery ?? (() => {})}
        disabled={dormant || !onGallery}
        className="order-2"
        mobileStartControls={mobileStartControls}
      >
        <Images className={icon} aria-hidden />
      </Btn>
    </div>
  );
}

/** Familiar four-button loading silhouette with no reachable action or focus. */
export function DormantStageControls() {
  return (
    <div
      data-stage-controls="1"
      data-loading-dormant-controls="1"
      aria-hidden="true"
      className="stage-controls-cluster pointer-events-none fixed left-1/2 z-[60] -translate-x-1/2 translate-y-[4px] grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4 sm:gap-y-4 opacity-[0.9] bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.225-4px)] md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203)]"
    >
      <Btn controlId="start" label="Start" onClick={() => {}} disabled>
        <Play className="h-[26.4px] w-[26.4px] fill-none sm:h-[30.8px] sm:w-[30.8px]" aria-hidden />
      </Btn>
      <Btn controlId="gallery" label="Gallery" onClick={() => {}} disabled>
        <Images className="h-[26.4px] w-[26.4px] sm:h-[30.8px] sm:w-[30.8px]" aria-hidden />
      </Btn>
      <Btn controlId="mute" label="Mute" onClick={() => {}} disabled tone="off">
        <MicOff className="h-[26.4px] w-[26.4px] sm:h-[30.8px] sm:w-[30.8px]" aria-hidden />
      </Btn>
      <Btn controlId="quiet" label="Quiet" onClick={() => {}} disabled>
        <Volume2 className="h-[26.4px] w-[26.4px] sm:h-[30.8px] sm:w-[30.8px]" aria-hidden />
      </Btn>
    </div>
  );
}
