/**
 * TURBOCHARGING YOUR LIFE — the initials carry the weight.
 *
 * G, 2026-08-21: "Make it T C Y L as in the first letter of TurboCharging Your
 * Life make them all full size. The other letters, make them 80% of the size
 * they are now. All caps, just change the font size."
 *
 * So T, C, Y and L render at the parent's full size and every other letter at
 * 80% of it — which spells the initials out of the line itself without changing
 * a single word.
 *
 * The 80% is `0.8em`, deliberately relative: every screen sizes this line off
 * `--stage-width`, so an em keeps the proportion identical on a phone and on a
 * desktop. A fixed pixel size would break the effect at one end or the other.
 *
 * Renders inline only — the caller keeps its own <p> and its own classes, so
 * the five places this appears stay byte-identical apart from the letters.
 * The parent already applies `uppercase`; nothing here needs to shout.
 */

const Small = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[0.8em]">{children}</span>
);

export function TaglineText() {
  return (
    <>
      T<Small>urbo</Small>C<Small>harging</Small>
      <Small> </Small>
      Y<Small>our</Small>
      <Small> </Small>
      L<Small>ife</Small>
    </>
  );
}
