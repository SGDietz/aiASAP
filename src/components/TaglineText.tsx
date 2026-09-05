/**
 * BEAUTIFUL BRILLIANT CHEAP AUTOPILOT — G's exact aiASAP tagline. He revised
 * it four times on 2026-09-04 evening: the "+" equation form, then a
 * period-separated form, then an arrow before Autopilot, then this one
 * (typed by G at 20:50, word for word). THIS is the current wording — four
 * words, no plus signs, no periods, no arrow.
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

/* The operators (+ and >) came and went with the earlier revisions. The 0.9
   scale-x and the letter-spacing on the ink span are G's approved squeeze;
   the squeeze once lived partly in operator margins, and those are gone with
   the operators, so the line simply sits a little narrower. */

export function TaglineText() {
  return (
    <span
      data-stage-tagline-ink="1"
      className="inline-block origin-center scale-x-[0.9] tracking-[-0.005em] bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-[1.6632em] text-transparent md:text-[1.32em]"
    >
      <span className="sr-only">Beautiful Brilliant Cheap Autopilot</span>
      <span aria-hidden>
        <Initial>B</Initial><Small>eautiful</Small>{" "}
        <Initial>B</Initial><Small>rilliant</Small>{" "}
        <Initial>C</Initial><Small>heap</Small>{" "}
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
