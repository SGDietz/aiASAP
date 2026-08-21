"use client";

/**
 * THE FOUR BUTTONS — G's layout, 2026-08-21, drawn on a screenshot.
 *
 *      STOP / START            VOICE
 *         MUTE                 QUIET
 *
 * G: "when someone taps on it, four buttons come up. Top left — if six is
 * already in motion, it'll just say stop. Top right — voice, because that button
 * means the avatar disappears, the site goes voice only, and six can just sit
 * there like the restart screen. Bottom left is mute. Bottom right is whatever
 * it is to stop hearing him talk."
 *
 * The words, and why:
 *   STOP / START  one button, two states. G: "if someone hits stop he stops
 *                 completely, everything stops, but then the word start comes
 *                 up in that stop button." So the buttons STAY on screen when
 *                 he is stopped — this is not a different screen.
 *   VOICE         drops the avatar and keeps talking. This is the money button:
 *                 no avatar means no LiveAvatar session, which is what bills.
 *   MUTE          your microphone. 6 stops hearing you. Same sense as every
 *                 phone and video call — mute is what YOU do to yourself.
 *   QUIET         6's voice. You stop hearing him. Chosen over "silence" and
 *                 "sound" because it is the word a person would actually use:
 *                 "make him quiet".
 *
 * Placed over 6's chest, in his brand colours, because that is where G drew
 * them and because it is the one part of the frame with no face and no hands.
 */

import { Mic, MicOff, Square, Play, Radio, Volume2, VolumeX, Images } from "lucide-react";

export type StageControlsProps = {
  /** false when 6 is stopped — the top-left button becomes START. */
  running: boolean;
  /** true when the mic is off (6 cannot hear them). */
  micOff: boolean;
  /** true when 6's voice is silenced. */
  quiet: boolean;
  onStopStart: () => void;
  onVoiceOnly: () => void;
  onToggleMic: () => void;
  onToggleQuiet: () => void;
  /**
   * Bottom-right (G, 2026-08-21). Opens the camera roll and uploads — the
   * gallery path already existed in this app, it just had no button on the
   * stage. Omit it and the button is not rendered at all rather than sitting
   * there dead.
   */
  onGallery?: () => void;
  /** Voice-only mode already dropped the avatar; hide that button there. */
  hideVoice?: boolean;
};

const LABEL =
  "text-[10px] sm:text-[11px] leading-none uppercase tracking-[0.14em] bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent";

function Btn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={`btn-inset btn-stage flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full disabled:opacity-40 ${
          danger ? "text-red-400" : "text-[#ffe9c2]"
        }`}
      >
        {children}
      </button>
      <span className={LABEL}>{label}</span>
    </div>
  );
}

export function StageControls({
  running,
  micOff,
  quiet,
  onStopStart,
  onVoiceOnly,
  onToggleMic,
  onToggleQuiet,
  onGallery,
  hideVoice = false,
}: StageControlsProps) {
  const icon = "h-6 w-6 sm:h-7 sm:w-7";
  // These sat at 0.46 down from the top until G looked at the screenshot:
  // "just lower them so that the four buttons are just above his hands, but do
  // not touch his skin."
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
  // Leaves ~32px of clearance on desktop, ~22px on a phone.
  return (
    // TWO on top, THREE underneath (G, 2026-08-21: "make the top two buttons
    // the same, bottom line make it three buttons and the third is gallery, the
    // one on the right"). Two flex rows rather than a grid, because a 2-col
    // grid cannot make a 3-wide bottom row stay centred under a 2-wide top one.
    // Row height is unchanged, so the clearance above 6's hands still holds.
    <div
      data-stage-controls="1"
      className="pointer-events-auto fixed left-1/2 z-[60] -translate-x-1/2 flex flex-col items-center gap-y-5 sm:gap-y-6 bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.291)] md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203)]"
    >
      <div className="flex items-start justify-center gap-x-10 sm:gap-x-14">
        {/* TOP LEFT — one button, two words */}
        <Btn label={running ? "Stop" : "Start"} onClick={onStopStart} danger={running}>
          {running ? <Square className={`${icon} fill-current`} aria-hidden /> : <Play className={`${icon} fill-current`} aria-hidden />}
        </Btn>

        {/* TOP RIGHT — drop the avatar, keep talking */}
        {hideVoice ? null : (
          <Btn label="Voice" onClick={onVoiceOnly}>
            <Radio className={icon} aria-hidden />
          </Btn>
        )}
      </div>

      {/* Tighter gaps than the top row: three buttons at the top row's spacing
          would run past 6's shoulders on a 360px phone. */}
      <div className="flex items-start justify-center gap-x-6 sm:gap-x-9">
        {/* BOTTOM LEFT — your microphone */}
        <Btn label="Mute" onClick={onToggleMic} disabled={!running} danger={micOff}>
          {micOff ? <MicOff className={icon} aria-hidden /> : <Mic className={icon} aria-hidden />}
        </Btn>

        {/* BOTTOM MIDDLE — his voice */}
        <Btn label="Quiet" onClick={onToggleQuiet} disabled={!running} danger={quiet}>
          {quiet ? <VolumeX className={icon} aria-hidden /> : <Volume2 className={icon} aria-hidden />}
        </Btn>

        {/* BOTTOM RIGHT — the camera roll. Not rendered without a handler, so
            it can never be a button that does nothing. */}
        {onGallery && (
          <Btn label="Gallery" onClick={onGallery}>
            <Images className={icon} aria-hidden />
          </Btn>
        )}
      </div>
    </div>
  );
}
