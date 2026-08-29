/**
 * GUCCI LOOK. WALMART PRICE. — a short, balanced value line.
 *
 * The four capitals carry the hierarchy while the understated remaining letters
 * preserve the elegant, wide-tracked stage treatment. The period is attached
 * to each clause so the contrast reads as two confident promises, not one long
 * run-on line. All sizing remains relative to the stage width at every viewport.
 */

const Small = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[0.8em]">{children}</span>
);

// One step above the initials' existing inherited size. The outer 1.2em and
// Small's 0.8em remain untouched, so every non-initial character keeps its
// exact computed size and responsive ratio.
const Initial = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[1.167em]">{children}</span>
);

export function TaglineText() {
  return (
    <span className="inline-block text-[1.6632em] md:text-[1.32em]">
      <span className="sr-only">Gucci Look. Walmart Price.</span>
      <span aria-hidden>
        <Initial>G</Initial><Small>ucci</Small><Small> </Small><Initial>L</Initial><Small>ook.</Small>
        <Small> </Small>
        <Initial>W</Initial><Small>almart</Small><Small> </Small><Initial>P</Initial><Small>rice.</Small>
      </span>
    </span>
  );
}

/* Loading has its own exact hierarchy: G requires L to be 1.20x OADING.
   Keeping L at the accepted 1.167em makes OADING 0.9725em exactly, while the
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
