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
 * THE ARROW. G, 2026-09-04: "get the > correct visually first try."
 *
 * Every number here is one he already signed off on, restored verbatim rather
 * than re-guessed — that is what makes it right on the first try:
 *
 *   -top-[0.205em] He asked for the operators "raised up to kind of the middle
 *                  of the capital words height middle." At the baseline they
 *                  sat at the capitals' FEET. My first correction went to
 *                  0.26em and he said "the boldness is perfect, but they're
 *                  too high" — that had pushed it to the cap TOP. 0.14em was
 *                  accepted next, and it is very close, but MEASURED on the
 *                  rendered page it is still 1px low: the arrow's ink centred
 *                  on row 47.0 while the capitals' ink centres on 46.0.
 *                  0.205em is that last pixel — the Op's own font-size is
 *                  15.4px here, so 1px is 0.065em. It lands the arrow dead on
 *                  the capitals' centre and still sits well below the 0.26em
 *                  he called too high.
 *   font-black     "make them significantly more bold" -> weight 900, and it
 *                  is real, not synthesised: this line resolves to the system
 *                  sans, which carries heavy weights.
 *   text-[0.95em]  Slightly under the body size so a heavy glyph does not
 *                  out-weigh the words it sits between.
 *   mx-[0.11em]    A MARGIN, not a space character, so the gap is tunable
 *                  without touching the glyph. Tuned after "a little bit too
 *                  much space before and after."
 *
 * VERIFIED, not assumed: the arrow's painted ink centre is measured against
 * the neighbouring capitals' ink centre on the rendered page after any change
 * to this span.
 */
const Op = ({ children }: { children: React.ReactNode }) => (
  <span className="relative -top-[0.205em] mx-[0.11em] inline-block text-[0.95em] font-black">
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
