/**
 * BEAUTIFUL & BRILLIANT & CHEAP ON AUTOPILOT — G's exact aiASAP tagline.
 * He revised it FIVE times on 2026-09-04 evening: the "+" equation form, a
 * period-separated form, an arrow before Autopilot, four bare words, and then
 * this one (typed word for word at 21:05). THIS is the current wording —
 * ampersands between the first three, lowercase "on" before Autopilot.
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
 * The & operators. G tuned this treatment on the "+" version and never took it
 * back, so the ampersands inherit it exactly: raised to the middle of the
 * capitals' height rather than sitting on the baseline at their feet, weight
 * 900, and a MARGIN either side rather than a space character so the gap is
 * tunable without touching the glyph.
 *
 * G, on the earlier operators: "the plus signs and the arrow to the right are
 * all low and not nearly bold enough. So raise them up to kind of the middle
 * of the capital words height middle and make them significantly more bold."
 * Then: "the boldness is perfect, but they're too high" — 0.26em overshot to
 * the cap TOP, so 0.14em is the middle.
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
      <span className="sr-only">Beautiful &amp; Brilliant &amp; Cheap on Autopilot</span>
      <span aria-hidden>
        <Initial>B</Initial><Small>eautiful</Small>
        <Op>&amp;</Op>
        <Initial>B</Initial><Small>rilliant</Small>
        <Op>&amp;</Op>
        <Initial>C</Initial><Small>heap</Small>{" "}
        <Small>on</Small>{" "}
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
