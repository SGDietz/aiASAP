/**
 * BEAUTIFUL BRILLIANT CHEAP > AUTOPILOT — G's exact aiASAP tagline, typed by
 * him word for word. It moved seven times on 2026-09-04 evening: "+" between
 * each word, a period-separated form, an arrow before Autopilot, four bare
 * words, ampersands, "remove ampersands" leaving a lowercase "on", and then
 * back to the arrow — THIS. Three words, then the arrow, then Autopilot.
 *
 * Taglines are sacred (CLAUDE.md): never reword or re-punctuate this without
 * G saying so.
 *
 * Taglines are sacred (CLAUDE.md): never reword, re-punctuate or "tidy" this
 * without G saying so. The visible and screen-reader owners carry identical
 * copy; every capital in the source spelling renders at the shared Initial
 * size, and the rest sits at the body size so the words still lead.
 *
 * The words are separated by real spaces now that every operator is gone.
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
      <span className="sr-only">Beautiful Brilliant Cheap &gt; Autopilot</span>
      <span aria-hidden>
        <Initial>B</Initial><Small>eautiful</Small>{" "}
        <Initial>B</Initial><Small>rilliant</Small>{" "}
        <Initial>C</Initial><Small>heap</Small>
        <Op>&gt;</Op>
        <Initial>A</Initial><Small>utopilot</Small>
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
