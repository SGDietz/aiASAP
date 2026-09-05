/**
 * GORGEOUS BRILLIANT FAST CHEAP — G's exact aiASAP tagline, 2026-09-05, by
 * voice, holding a screenshot of the front door (13:10 "Gorgeous Brilliant
 * Cheap Fast"; 13:50 "reverse the words ... make it fast cheap"). Four words,
 * a plain space between each, nothing else. No comma, no
 * ampersand, no arrow, no plus, no "on". It replaces the 2026-09-04 line
 * "Beautiful Brilliant Cheap on Autopilot" (typed 22:05, de-punctuated 22:14,
 * moved eight times that evening; the operator span below is kept for the
 * history and for the next time an operator comes back).
 *
 * Taglines are sacred (CLAUDE.md): never reword, re-punctuate or "tidy" this
 * without G saying so. The visible and screen-reader owners carry identical
 * copy; every capital in the source spelling renders at the shared Initial
 * size, and the rest sits at the body size so the words still lead.
 */
const Small = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[0.8em]">{children}</span>
);


const Initial = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[1.167em]">{children}</span>
);

/**
 * THE OPERATOR SPAN. These four values are LOCKED and are not to be "improved".
 *
 *   -top-[0.14em]  raised to the middle of the capitals. G asked for that
 *                  ("raised up to kind of the middle of the capital words
 *                  height middle") and rejected a bigger lift as too high.
 *   font-black     "make them significantly more bold" -> weight 900.
 *   text-[0.95em]  just under the body size so a heavy glyph does not
 *                  out-weigh the words either side of it.
 *   mx-[0.11em]    an equal margin each side, tuned after "a little bit too
 *                  much space before and after."
 *
 * 2026-09-04, WHY THIS IS LOCKED. I moved it twice in one evening: up, because
 * measuring said the arrow sat a pixel below the capitals' centre, and then
 * sideways, on a request to shift it toward Autopilot. Both looked worse - the
 * first read too high, the second crowded Autopilot - and the verdict was to
 * roll the whole thing back to exactly this. The measurement was right and the
 * result was still wrong, which is the point: this glyph is judged by eye, not
 * by ruler. Leave it alone.
 */
const Op = ({ children }: { children: React.ReactNode }) => (
  <span className="relative -top-[0.14em] mx-[0.11em] inline-block text-[0.95em] font-black">
    {children}
  </span>
);


export function TaglineText() {
  return (
    <span
      data-stage-tagline-ink="1"
      className="inline-block origin-center scale-x-[0.9] tracking-[-0.005em] bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-[1.6632em] text-transparent md:text-[1.32em]"
    >
      <span className="sr-only">Gorgeous Brilliant Fast Cheap</span>
      <span aria-hidden>
        <Initial>G</Initial><Small>orgeous</Small>{" "}
        <Initial>B</Initial><Small>rilliant</Small>{" "}
        <Initial>F</Initial><Small>ast</Small>{" "}
        <Initial>C</Initial><Small>heap</Small>
      </span>
    </span>
  );
}

/* Keeping L at the accepted 1.167em makes OADING
   0.9725em exactly, while the
   outer loading fitter preserves the accepted total ink width at every seam. */
const LoadingRest = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[0.9725em]">{children}</span>
);

export function LoadingText() {
  return (
    <span className="inline-block text-[1.512em]">
      <Initial>L</Initial><LoadingRest>OADING<span data-six-loading-phone-dots="1">...</span></LoadingRest>
    </span>
  );
}
