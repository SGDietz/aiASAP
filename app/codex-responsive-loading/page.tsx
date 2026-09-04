import { SixLoadingIndicator } from "../../src/components/SixLoadingIndicator";

export default function ResponsiveLoadingFixturePage() {
  return (
    <main
      data-six-loading-surface="1"
      className="fixed inset-0 overflow-hidden [--stage-width:100vw] [--stage-height:100svh] [--stage-top:0px] [--stage-bottom:0px]"
    >
      {/* No-cost visual fixture for the exact post-START loading paint. */}
      <div className="fixed inset-0 z-10 flex items-center justify-center">
        <SixLoadingIndicator />
      </div>
    </main>
  );
}
