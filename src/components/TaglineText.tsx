/**
 * BEAUTIFUL BRILLIANT CHEAP > AUTOPILOT — G's exact aiASAP tagline. He revised
 * it three times on 2026-09-04 evening: the "+" equation form, then a
 * period-separated form, then this one. THIS is the current wording — no
 * plus signs, no periods, a spaced arrow before Autopilot.
 *
 * Taglines are sacred (CLAUDE.md): never reword, re-punctuate or "tidy" this
 * without G saying so. The visible and screen-reader owners carry identical
 * copy; every capital in the source spelling renders at the shared Initial
 * size, and the rest sits at the body size so the words still lead.
 *
 * The words are separated by real spaces now that the operators between them
 * are gone; only the arrow keeps the tuned margin gap.
 */
const Small = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[0.8em]">{children}</span>
);

const Initial = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[1.167em]">{children}</span>
);

/**
 * The + and > operators. G, 2026-09-04: "the plus signs and the arrow to the
 * right are all low and not nearly bold enough. So raise them up to kind of
 * the middle of the capital words height middle and make them significantly
 * more bold."
 *
 * At the body size they sat on the baseline - at the FEET of the capitals. My
 * first correction over-shot to 0.26em and put them near the cap TOP instead
 * (G: "the boldness is perfect, but they're too high"). 0.14em is the middle:
 * a capital's centre sits about 0.41em above the baseline, and the + glyph
 * already centres about 0.25em above its own, so the lift needed is the
 * difference, not the whole distance.
 *
 * Weight 900 is real, not synthesised: the tagline resolves to the system sans
 * (measured on the page - weight 540, not Lato), which carries heavy weights.
 *
 * The gap either side is a MARGIN, not a space character, so it can be tuned
 * without touching the glyph (G: "a little bit too much space before and after
 * the plus signs and the arrow").
 *
 * HOW THE 10% WAS SET, 2026-09-04. G asked for the line squeezed 10% and I
 * first did it with `scale-x`, which does not close gaps - it SQUASHES the
 * glyphs, so the letters went thin and harder to read. Wrong tool. The scale
 * is back at its approved 0.9 and the squeeze is letter-spacing plus these
 * margins, which move letters closer without touching their weight.
 * Measured, not guessed: natural width is 315px. A flat 10% (284px) read as
 * too condensed to G, so the tightening is no longer spread evenly - the
 * LETTERS sit almost at their natural spacing and nearly all of the squeeze
 * comes from the operator gaps instead: "you can do a little less space around
 * the plus signs and the arrow, but ... make a little bit more space between
 * the letters."
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
