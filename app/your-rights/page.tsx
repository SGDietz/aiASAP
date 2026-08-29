const backClass =
  "inline-flex min-h-11 items-center rounded border-2 border-black px-4 py-2 text-base font-bold text-black underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-black dark:border-white dark:text-white dark:focus-visible:outline-white";
const electronicAgreementStatement =
  "This is a legally binding electronic agreement. You have the opportunity to read it, then accept it by clicking ‘I Agree’ and submitting payment.";
const paidWorkStatement =
  "When a project or project phase is completed and paid for, you own the client-specific work we delivered for that phase—and everything you build from it. aiASAP keeps no ownership, royalties, equity, profit share, or claim on your future success.";
const unpaidWorkBoundary =
  "Work from unpaid future phases is not included. Pre-existing aiASAP tools and third-party materials remain subject to the licenses explained in the agreement.";

export default function YourRightsPage() {
  return (
    <main className="min-h-screen w-full bg-white px-4 py-6 text-black [color-scheme:light] dark:bg-black dark:text-white dark:[color-scheme:dark] sm:px-6 sm:py-10">
      <article className="mx-auto max-w-3xl">
        <a href="/" className={backClass}>← Back to aiASAP</a>

        <header className="mt-7 border-b-2 border-black pb-6 dark:border-white">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Your Work. Your Rights.</h1>
          <p className="mt-3 text-base font-bold leading-7">Everything you pay for is yours.</p>
        </header>

        <div className="space-y-10 py-8 text-base leading-7 sm:text-[17px] sm:leading-8">
          <section>
            <h2 className="text-2xl font-bold leading-tight">The Promise</h2>
            <p className="mt-4 font-bold">{paidWorkStatement}</p>
            <p className="mt-4">{unpaidWorkBoundary}</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold leading-tight">How You Agree</h2>
            <p className="mt-4">{electronicAgreementStatement}</p>
            <p className="mt-4">
              The agreement identifies the work in each project or phase. aiASAP electronically executes the written
              assignment, and the agreement keeps a reliable record of what you accepted and what we delivered.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold leading-tight">Honest Boundaries</h2>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>aiASAP transfers only rights it owns and can legally transfer.</li>
              <li>
                Pre-existing aiASAP software, platform tools, reusable systems, workflows, templates, the aiASAP brand,
                and the 6 character and brand remain with their existing owners.
              </li>
              <li>Third-party materials remain subject to their licenses and the rights of their existing owners.</li>
              <li>
                Delivery of an editable or source file is separate from copyright ownership; the electronically
                accepted agreement lists which files and formats are delivered.
              </li>
              <li>
                AI-only material may not qualify for copyright protection. aiASAP cannot transfer a right it does not
                own or that the law does not recognize.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold leading-tight">What This Does Not Promise</h2>
            <p className="mt-4">
              aiASAP wants to help create many successful companies. Your Rights does not promise revenue, customers,
              profit, valuation, investment, or any other business result. It promises a clean paid-service relationship
              and no aiASAP claim on your company or future success.
            </p>
          </section>

          <p>
            Read the operative ownership terms in the{" "}
            <a className="font-bold underline decoration-2 underline-offset-4" href="/legal#ownership">
              aiASAP Terms / Legal
            </a>.
          </p>
          <p>
            The assignment language is drafted for review by qualified U.S. intellectual-property counsel before use
            as a final client agreement. This public page is a product promise and plain-language summary, not a legal
            opinion or a substitute for the electronically accepted project agreement.
          </p>
        </div>

        <a href="/" className={`${backClass} mb-8`}>← Back to aiASAP</a>
      </article>
    </main>
  );
}
