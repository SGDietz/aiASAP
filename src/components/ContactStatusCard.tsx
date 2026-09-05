"use client";

import { useEffect, useRef, useState } from "react";
import type { BuildInterestState, BuildInterestStep } from "../lib/buildInterestFlow";
import { playTypewriterClick, typewriterDelayMs } from "../lib/typewriterClick";

// ---------------------------------------------------------------------------
// EVERYTHING IS VOICE (G, 2026-09-03):
//   "Everything is voice audio. None of those yes send it boxes, not yet.
//    You know, got it, may I send that to your aiASAP... No. None of that.
//    It's gotta be almost exactly like the iScott."
//
// So this box does ONE job: show what 6 heard. It has no buttons, no typing,
// and it never carries a question - 6 asks every question out loud. The read
// back, the permission to send, the retry: all spoken, all in
// buildInterestFlow.
//
// SHAPE COPIED FROM THE iSCOTT GOLD LOCK (2026-09-03 09:06 + 10:5x ET):
//   "Your email should not move. Those words should not move. Nothing should
//    move. The only thing that can change is like if it's a long email."
// The label is pinned under the rim, the value sits in a FIXED-height slot,
// and a long address shrinks INSIDE that slot. Every state paints the same
// box in the same place.
//
// COLOURS ARE aiASAP'S OWN. The iScott lock is a shape, not a palette - the
// WildWorks orange has been mis-applied to this site before. This keeps the
// brown/amber G already accepted here on 2026-09-01.
// ---------------------------------------------------------------------------

type Props = {
  state: BuildInterestState;
  onStep: (step: BuildInterestStep) => void | Promise<void>;
};

// G, ride 2026-09-03 19:41: "the email box just came up way too early...
// it should not have come up yet either." The box exists to SHOW what 6
// heard, so it appears only once there is something heard to show - never
// during the method question, never over an empty capture.
const VISIBLE_STAGES = new Set<BuildInterestState["stage"]>([
  "confirming",
  "permission",
  "saving",
  "failed",
  "submitted",
]);

/**
 * The fixed slot is 2.5rem. A long value shrinks inside it; nothing moves.
 *
 * Ceiling is 1.85rem, the size G accepted on the iScott box. His 22:05 ride
 * here read the old 1.5rem and said "I can't really see it, it's a little
 * small" - his own address is short, so short must be the BIG end.
 */
function fitFontSize(value: string): string {
  const n = value.length;
  // Re-tuned for the 18rem box (G, 19:42: "it's too wide... more narrow").
  // Inner width is about 256px; a monospace glyph is roughly 0.6em wide, so
  // the longest safe size is 256 / (0.6 * n). The top of the ladder is
  // unchanged so G's own short address still paints at the 1.85rem he
  // approved - only the long end had to come down, and a long address must
  // SHRINK, never clip ("the only thing that can change is like if it's a
  // long email"). Verified by card_probe.py, which measures real clipping.
  if (n <= 13) return "1.85rem";
  if (n <= 16) return "1.6rem";
  if (n <= 20) return "1.3rem";
  if (n <= 24) return "1.05rem";
  if (n <= 28) return "0.9rem";
  if (n <= 34) return "0.75rem";
  if (n <= 42) return "0.62rem";
  return "0.55rem";
}

export function ContactStatusCard({ state }: Props) {
  // Mid-capture the box joins in as soon as the first heard characters exist
  // (the iScott shrinking-address behaviour) - but not a moment before.
  const capturing =
    state.stage === "contact_capture" && Boolean(state.value && state.value.length > 0);
  // G, ride 19:44: "that screen should disappear. That sent to the AI ASAP
  // team should disappear." Same rhythm he locked on iScott: show the sent
  // tick for a long 2-count (2.8s), then the box leaves on its own.
  const [sentDismissed, setSentDismissed] = useState(false);
  useEffect(() => {
    if (state.stage !== "submitted") {
      setSentDismissed(false);
      return;
    }
    const timer = window.setTimeout(() => setSentDismissed(true), 2800);
    return () => window.clearTimeout(timer);
  }, [state.stage]);
  const showing = (VISIBLE_STAGES.has(state.stage) || capturing) &&
    !(state.stage === "submitted" && sentDismissed);

  // TYPEWRITER (G, ride 2026-09-04 12:43:57): "where are the typewriter
  // sounds? ... the letters should come up one at a time with a clicking of a
  // typewriter sound. Just like on the WildWorks avatar in iScott."
  //
  // The reveal and the click already existed but were wired only to the OLDER
  // on-chest email box; THIS card - the one he sees now - painted the whole
  // address at once. Same timing constants as the chest reveal so the two feel
  // identical. The font still sizes off what is SHOWN, so the address shrinks
  // as it grows, which is the iScott behaviour he locked.
  const target = state.value ?? "";
  const [revealed, setRevealed] = useState("");
  const revealTimerRef = useRef<number | null>(null);
  // How much is on screen, tracked in a REF. The first version of this read the
  // next character from inside a setState updater, which React does not run
  // synchronously - so the loop lost its character and froze after two letters
  // ("wi"). The fixture probe caught it. The ref is the single source of truth
  // for the animation; state only exists to paint.
  const shownRef = useRef("");
  useEffect(() => {
    const clear = () => {
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
    clear();
    const snap = (text: string) => {
      shownRef.current = text;
      setRevealed(text);
    };
    // A correction, a reset, or a value that no longer extends what is on
    // screen snaps into place - only forward growth is typed.
    if (target === "" || !target.startsWith(shownRef.current)) {
      snap(target);
      if (target === "") return clear;
    }
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      snap(target);
      return clear;
    }
    const step = () => {
      revealTimerRef.current = null;
      if (shownRef.current.length >= target.length) return;
      const nextChar = target.charAt(shownRef.current.length);
      snap(target.slice(0, shownRef.current.length + 1));
      playTypewriterClick(nextChar.charCodeAt(0) + shownRef.current.length);
      revealTimerRef.current = window.setTimeout(step, typewriterDelayMs(nextChar));
    };
    revealTimerRef.current = window.setTimeout(step, 0);
    return clear;
  }, [target]);

  // G, ride cb2dde76: "your email box should cover the top two boxes... stop
  // start button and gallery, so we just don't see them, but we leave mute and
  // quiet on the screen." The flag drives one rule in globals.css. It hides
  // with visibility, never display, so the grid does not reflow and Mute and
  // Quiet stay exactly where they were.
  useEffect(() => {
    const root = document.documentElement;
    if (showing) root.setAttribute("data-aiasap-capture-card", "1");
    else root.removeAttribute("data-aiasap-capture-card");
    return () => root.removeAttribute("data-aiasap-capture-card");
  }, [showing]);

  const label = state.method === "phone" ? "YOUR PHONE" : "YOUR EMAIL";
  const value = state.value ?? "";
  const sent = state.stage === "submitted";
  const shown = revealed;

  if (!showing) return null;

  return (
    <div
      data-contact-status-card="1"
      data-box-view={state.stage}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      // Anchored from the BOTTOM against the same expression the control
      // cluster uses, so the box lands on the top row of buttons and cannot
      // drift. Offsets are measured, not guessed: the bottom row plus its gap
      // is 44px below 768px wide and 56px at md (card_probe.py measured it against
      // the real cluster, 2026-09-03,
      // phone 390x710 / iPad 768x1024 / desktop 1366x768).
      // Phone re-anchors this in globals.css: the frame there is pinned to
      // Six's body rather than to --stage-height, so the cluster moved and the
      // box has to travel with it. This hook is how that rule finds it.
      data-contact-card-anchor="1"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.225-4px+44px)] z-[61] flex justify-center px-4 md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.203+94px)]"
    >
      {/* G, ride 2026-09-03 19:42: "it's too wide left to right... it should
          be more narrow." 22rem -> 18rem, the iScott gold width.

          2026-09-04: G took 10% off the sides of the four chest buttons, and
          this box has to follow them - his rule from ride 48c99dfa is "the box
          should be, you know, basically as wide as like the quiet and mute."
          So 18rem/20rem (288/320) became 259.7px/288px, which are the MEASURED
          cluster widths after the trim, not a remembered pair of numbers.
          card_probe.py asserts |card - cluster| <= 3 in every state at every
          size; it caught this drift the moment the buttons narrowed. */}
      {/* G, ride 48c99dfa 2026-09-04: "the box is too small. The box should
          be, you know, basically as wide as like the quiet and mute." He rode
          desktop, where the button row is 320px and this box was 288. Widths
          are MEASURED against the real cluster (controls_probe.py): phone
          288.6, iPad and desktop 320. card_probe.py fails if they drift. */}
      <div className="w-full max-w-[259.7px] md:max-w-[288px] min-h-[93.4px] md:min-h-[94px] flex flex-col justify-center rounded-2xl border border-[#d7a05a]/70 bg-[#2b1608]/95 px-4 pb-3 pt-[0.52rem] text-center shadow-[0_12px_38px_rgba(43,22,8,0.55)] backdrop-blur-sm">
        {sent ? (
          // G asked for this nine times on the other site before it appeared:
          // the words AND a check mark, on the ordinary success path.
          // G, 19:44: "The check should— checkmark should be on the right
          // side, not on the left side." Text first, tick after.
          <div
            data-contact-sent="1"
            className="flex min-h-[3.4rem] items-center justify-center gap-2"
          >
            <p className="text-base font-bold text-[#ffe9c2]">Sent to the aiASAP team</p>
            <span aria-hidden="true" className="text-xl font-black leading-none text-[#d7a05a]">
              ✓
            </span>
          </div>
        ) : (
          <>
            {/* G, 2026-09-03: "double the size of the text for YOUR EMAIL.
                The words of your email are significantly larger." 0.72 -> 1.44rem. */}
            <p
              data-contact-label="1"
              className="text-[1.44rem] font-bold uppercase leading-none tracking-[0.06em] text-[#d7a05a]"
            >
              {label}
            </p>
            {/* G on the iScott box: "The G is cut off at the bottom. The P is
                cut off at the bottom." leading-none gives descenders no room
                and overflow:hidden then shears them. 1.25 line-height inside
                the fixed 2.25rem slot leaves the tails whole at every size. */}
            <div className="mt-[0.5rem] flex h-[2.5rem] items-center justify-center">
              <span
                data-contact-value="1"
                style={{ fontSize: fitFontSize(shown), lineHeight: 1.25 }}
                className="block max-w-full truncate font-mono font-bold text-[#ffe9c2]"
              >
                {shown}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
