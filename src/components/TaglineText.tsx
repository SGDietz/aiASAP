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
 * THE ARROW. G, 2026-09-04: "get the > correct visually first try", then
 * "lower the > a little it is too high", then "move the > a little away from
 * cheap and toward autopilot".
 *
 *   -top-[0.14em]  He asked for the operators "raised up to kind of the middle
 *                  of the capital words height middle." At the baseline they
 *                  sat at the capitals' FEET. 0.26em put them at the cap TOP
 *                  ("the boldness is perfect, but they're too high"). 0.14em
 *                  was accepted. I later MEASURED 0.14em as 1px low - the
 *                  arrow's painted ink centres on row 47.0, the capitals on
 *                  46.0 - and moved it to land dead centre. G looked at that
 *                  and said it was too high, so this is OPTICAL, not
 *                  geometric: a ">" wedge carries its mass low and wide, so
 *                  true centre reads high. His eye wins here. Do NOT
 *                  re-correct this with a ruler.
 *   font-black     "make them significantly more bold" -> weight 900, and it
 *                  is real, not synthesised: this line resolves to the system
 *                  sans, which carries heavy weights.
 *   text-[0.95em]  Slightly under the body size so a heavy glyph does not
 *                  out-weigh the words it sits between.
 *   ml / mr        MARGINS, not space characters, so each side tunes on its
 *                  own. They were symmetric at 0.11em until he asked for the
 *                  arrow moved off Cheap and toward Autopilot, so the left gap
 *                  opened and the right closed. The pair still sums to about
 *                  the old total, so the line keeps its width and only the
 *                  arrow moves inside it.
 */
const Op = ({ children }: { children: React.ReactNode }) => (
  <span className="relative -top-[0.14em] ml-[0.2em] mr-[0.04em] inline-block text-[0.95em] font-black">
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
