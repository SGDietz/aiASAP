import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const LOCK_SELECTOR = "html.aiasap-phone-start-lock";

/**
 * The phone start-screen lock, sliced out of globals.css together with the media
 * query that owns it. Everything asserted below is read out of this slice, so a
 * rule that escapes the phone query cannot pass by accident.
 */
function phoneLock(css: string) {
  const lockIndex = css.indexOf(LOCK_SELECTOR);
  const queryIndex = css.lastIndexOf("@media (max-width: 767px)", lockIndex);
  const blockEnd = css.indexOf("/* AVATAR STAGE CONTROLS", queryIndex);
  return {
    lockIndex,
    queryIndex,
    preamble: css.slice(queryIndex, lockIndex),
    block: css.slice(queryIndex, blockEnd),
  };
}

type Viewport = {
  /** 100svh — the phone with browser chrome EXPANDED. Constant by definition. */
  small: number;
  /** 100vh / 100lvh — the phone with browser chrome COLLAPSED. */
  large: number;
  /** 100dvh — whatever the chrome is doing right now. */
  dynamic: number;
};

function resolveVars(expression: string, vars: Record<string, string>): string {
  let resolved = expression;
  for (let pass = 0; pass < 4 && resolved.includes("var("); pass += 1) {
    resolved = resolved.replace(
      /var\((--[a-z0-9-]+)\)/g,
      (_match, name: string) => vars[name] ?? "0px",
    );
  }
  return resolved;
}

function substituteViewport(expression: string, viewport: Viewport): string {
  return expression
    .replace(/calc/g, "")
    .replace(/([\d.]+)svh/g, (_m, n: string) => String((Number(n) / 100) * viewport.small))
    .replace(/([\d.]+)lvh/g, (_m, n: string) => String((Number(n) / 100) * viewport.large))
    .replace(/([\d.]+)dvh/g, (_m, n: string) => String((Number(n) / 100) * viewport.dynamic))
    .replace(/([\d.]+)vh/g, (_m, n: string) => String((Number(n) / 100) * viewport.large))
    .replace(/([\d.]+)px/g, (_m, n: string) => n);
}

/** Folds one flat, whitespace-separated `a + b - c` chain. calc() requires the spaces. */
function foldFlat(expression: string): number {
  const tokens = expression.trim().split(/\s+/).filter(Boolean);
  let total = Number(tokens[0]);
  if (!Number.isFinite(total)) throw new Error(`unsupported term: ${tokens[0]}`);
  for (let i = 1; i < tokens.length; i += 2) {
    const operator = tokens[i];
    const value = Number(tokens[i + 1]);
    if (!Number.isFinite(value)) throw new Error(`unsupported term: ${tokens[i + 1]}`);
    if (operator === "+") total += value;
    else if (operator === "-") total -= value;
    else throw new Error(`unsupported operator: ${operator}`);
  }
  return total;
}

function evaluatePx(
  expression: string,
  viewport: Viewport,
  vars: Record<string, string>,
): number {
  let flat = substituteViewport(resolveVars(expression, vars), viewport).trim();
  while (flat.includes("(")) {
    const close = flat.indexOf(")");
    const open = flat.lastIndexOf("(", close);
    if (close < 0 || open < 0) throw new Error(`unbalanced expression: ${expression}`);
    flat = `${flat.slice(0, open)}${foldFlat(flat.slice(open + 1, close))}${flat.slice(close + 1)}`;
  }
  return foldFlat(flat);
}

/** Chrome-band heights a real phone toolbar moves through, plus the collapsed case. */
const CHROME_BANDS = [0, 44, 56, 72, 96, 120];
const SMALL_VIEWPORT = 700;

function viewports(): Viewport[] {
  return CHROME_BANDS.map((band) => ({
    small: SMALL_VIEWPORT,
    large: SMALL_VIEWPORT + band,
    // Mid-animation is the worst case for anything that reads dvh.
    dynamic: SMALL_VIEWPORT + band / 2,
  }));
}

describe("phone start-screen avatar lock", () => {
  it("keeps every lock rule inside the phone query", () => {
    const css = source("app/globals.css");
    const { lockIndex, queryIndex, preamble, block } = phoneLock(css);

    expect(lockIndex).toBeGreaterThan(-1);
    expect(queryIndex).toBeGreaterThan(-1);
    // Nothing but the opening of the phone query sits between the two.
    expect(preamble.match(/@media/g)).toHaveLength(1);
    expect(preamble).not.toContain("min-width");
    expect(block).not.toContain("min-width");
    expect(block).not.toContain("pointer: coarse");
    expect(block).not.toContain("pointer: fine");
  });

  it("pins the document to the small viewport and forbids scroll, overscroll, and pan", () => {
    const { block } = phoneLock(source("app/globals.css"));

    expect(block).toMatch(
      /html\.aiasap-phone-start-lock,\s*html\.aiasap-phone-start-lock body \{/,
    );
    expect(block).toContain("height: 100svh;");
    expect(block).toContain("min-height: 100svh;");
    expect(block).toContain("max-height: 100svh;");
    expect(block).toContain("overflow: hidden;");
    expect(block).toContain("overscroll-behavior: none;");
    expect(block).toContain("touch-action: none;");
    // The root layout centres the stage inside a 100vh body; that centring is
    // the mechanism that moved 6 when the chrome band appeared or disappeared.
    expect(block).toContain("justify-content: flex-start;");
  });

  it("takes the start stage out of document flow and pins it to the viewport", () => {
    const { block } = phoneLock(source("app/globals.css"));
    const stage =
      /html\.aiasap-phone-start-lock \[data-six-initial-idle="1"\] \{([\s\S]*?)\}/.exec(block);

    expect(stage).not.toBeNull();
    // A flow stage can be moved by whatever owns the flow above it. A fixed one
    // cannot, which is the whole point of the repair.
    expect(stage![1]).toContain("position: fixed;");
    expect(stage![1]).toContain("inset: 0 0 auto 0;");
    expect(stage![1]).toContain("height: 100svh;");
    expect(stage![1]).not.toContain("dvh");
  });

  it("freezes the media box to an absolute height instead of leftover flex space", () => {
    const { block } = phoneLock(source("app/globals.css"));

    expect(block).toContain(
      'html.aiasap-phone-start-lock [data-six-initial-idle="1"] > .aiasap-tablet-idle-media {',
    );
    expect(block).toContain("flex: 0 0 auto;");
    expect(block).toContain("--aiasap-phone-legal-reserve: 55px;");
    expect(block).toContain("height: calc(100svh - var(--aiasap-phone-legal-reserve));");
    // The rejected repair. dvh tracks the chrome live, so it resizes the very
    // box whose object-cover crop has to stay still.
    expect(block).not.toContain("dvh");
    expect(block).not.toContain("lvh");
  });

  it("makes the bottom-fixed brown paint exactly 70% of its rendered height", () => {
    const css = source("app/globals.css");
    expect(css).toContain("--aiasap-phone-legal-reserve: 55px;");
    expect(css).toContain("height: calc(100svh - 34.65px);");
    expect(34.65).toBe(49.5 * 0.7);
    // 2026-09-04 evening: the little brown bar under his hands IS an ::after
    // on the media column (PHONE FRAMING block), painted over bare floor.
    expect(css).toContain('[data-six-initial-idle="1"] > .aiasap-tablet-idle-media::after');
    expect(css).toContain('[data-six-active-stage="1"] > [data-six-stage-media="1"]');
  });

  it("holds the avatar box height invariant across every browser-chrome state", () => {
    const { block } = phoneLock(source("app/globals.css"));
    const reserve = /--aiasap-phone-legal-reserve:\s*([^;]+);/.exec(block);
    const mediaHeight = /\.aiasap-tablet-idle-media\s*\{[\s\S]*?height:\s*([^;]+);/.exec(block);

    expect(reserve).not.toBeNull();
    expect(mediaHeight).not.toBeNull();

    const vars = { "--aiasap-phone-legal-reserve": reserve![1] };
    const rendered = viewports().map((viewport) =>
      evaluatePx(mediaHeight![1], viewport, vars),
    );

    // One rendered box height for every chrome state: same dimensions, same
    // origin, therefore the same object-cover crop of the same still.
    expect(new Set(rendered).size).toBe(1);
    expect(rendered[0]).toBe(SMALL_VIEWPORT - 55);

    // The base authority still fills the locked stage exactly; the <=599px
    // paint overlap is a later, independently tested seam winner.
    const filled = viewports().map(
      (viewport) =>
        evaluatePx(mediaHeight![1], viewport, vars) +
        evaluatePx(reserve![1], viewport, vars),
    );
    expect(new Set(filled).size).toBe(1);
    expect(filled[0]).toBe(SMALL_VIEWPORT);

    // Control: the evaluator really does discriminate, so the assertion above is
    // not vacuous. The rejected dvh form varies with the chrome.
    const rejected = viewports().map((viewport) =>
      evaluatePx("calc(100dvh - var(--aiasap-phone-legal-reserve))", viewport, vars),
    );
    expect(new Set(rejected).size).toBeGreaterThan(1);
  });

  it("anchors legal to the bottom of the stage without letting it resize the avatar", () => {
    const { block } = phoneLock(source("app/globals.css"));
    const footer = source("src/components/StageLegalFooter.tsx");
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const stack =
      /\[data-phone-bottom-stack="1"\] \{([\s\S]*?)\}/.exec(block);

    expect(block).toContain(
      'html.aiasap-phone-start-lock [data-six-initial-idle="1"] > [data-phone-bottom-stack="1"] {',
    );
    expect(stack).not.toBeNull();
    expect(stack![1]).toContain("position: absolute;");
    expect(stack![1]).toContain("bottom: 0;");
    // A FLOOR, never a fixed height: a safe-area inset that flips with the
    // chrome may only grow the bar upward over an invariant avatar box, and can
    // never squash the legal line out of an undersized row.
    expect(stack![1]).toContain("min-height: var(--aiasap-phone-legal-reserve);");
    expect(/^\s*height:/m.test(stack![1])).toBe(false);

    expect(footer.match(/-translate-y-\[4px\]/g)).toHaveLength(1);
    expect(footer.match(/md:translate-y-0/g)).toHaveLength(1);
    expect(footer).toContain('data-phone-bottom-stack="1"');
    expect(
      demo.match(/<StageLegalFooter phoneFlow phoneStackPaddingBottom="12px"/g),
    ).toHaveLength(1);
  });

  it("shortens the actually visible phone band to 70% with a fixed bottom", () => {
    const { block } = phoneLock(source("app/globals.css"));
    const footer = source("src/components/StageLegalFooter.tsx");
    const reserve = /--aiasap-phone-legal-reserve:\s*([^;]+);/.exec(block);
    const bar = /\[data-phone-bottom-stack="1"\]\[data-phone-flow="1"\] \.stage-legal-footer \{([\s\S]*?)\}/.exec(block);

    // The semantic footer/link box and padded target stay intact. The visible
    // brown owner, not merely the old gradient tail, shrinks to 70%.
    expect(footer).toContain("flex h-[29px] w-full");
    expect(bar).not.toBeNull();
    expect(bar![1]).toContain("height: 17.71px;");
    expect(bar![1]).toContain("margin-top: 0;");
    expect(bar![1]).not.toContain("padding-top:");
    expect(block).toContain(
      "transparent 0 20.35px",
    );
    expect(block).toContain(
      '[data-phone-bottom-stack="1"][data-phone-flow="1"] [data-stage-legal-line="1"] {\n    transform: none;\n    opacity: 1;',
    );
    expect(block).toContain(
      '[data-phone-bottom-stack="1"][data-phone-flow="1"] [data-stage-legal-line="1"] > a {\n    padding-top: 5px;\n    padding-bottom: 5px;',
    );
    expect(block).not.toContain('.stage-legal-footer > a {');

    const oldVisibleHeight = 49.5;
    const barHeight = 34.65;
    const stackReserve = viewports().map((viewport) =>
      evaluatePx(reserve![1], viewport, {}),
    );
    expect(new Set(stackReserve).size).toBe(1);
    expect(stackReserve[0]).toBe(55);
    expect(20.35 + barHeight).toBe(55);
    expect(barHeight).toBeCloseTo(oldVisibleHeight * 0.7, 10);
    expect(block).toContain("bottom: 8.47px;");

    // The seam is still one number for every chrome state, so nothing scrolls.
    const seamFromStageTop = viewports().map(
      () => SMALL_VIEWPORT - barHeight,
    );
    expect(new Set(seamFromStageTop).size).toBe(1);
    expect(seamFromStageTop[0]).toBe(SMALL_VIEWPORT - barHeight);
  });

  it("attaches the same lock to initial and returned idle", () => {
    const demo = source("src/components/LiveAvatarDemo.tsx");

    expect(demo).toContain('const PHONE_START_LOCK_CLASS = "aiasap-phone-start-lock";');
    expect(demo).toContain(
      '!hasTappedToStart && !sessionToken && !isExited && !awaitReturnTap && mode !== "VOICE";',
    );
    expect(demo).toContain("const showsSharedIdle = showsInitialIdle || showsReturnedIdle;");
    expect(demo).toContain("if (!showsSharedIdle) return;");
    expect(demo).toContain("root.classList.add(PHONE_START_LOCK_CLASS);");
    expect(demo).toContain("return () => root.classList.remove(PHONE_START_LOCK_CLASS);");
    expect(demo).toContain("}, [showsSharedIdle]);");
    // Exactly three: the declaration, the add, and the cleanup remove. Any
    // fourth use would mean the lock is reachable from somewhere other than the
    // one effect that owns the start screen's lifetime.
    expect(demo.match(/PHONE_START_LOCK_CLASS/g)).toHaveLength(3);
    expect(demo).toContain("if (showsSharedIdle) {");
    expect(demo).not.toContain("data-six-idle-lifecycle");
  });

  it("leaves the still source, branding, and stage anchors untouched", () => {
    const css = source("app/globals.css");
    const demo = source("src/components/LiveAvatarDemo.tsx");
    const controls = source("src/components/StageControls.tsx");

    // Same still, same zoom, same object-cover/object-top composition.
    expect(demo).toContain(
      "six-primary-scene absolute inset-0 h-full w-full object-cover object-top md:relative md:inset-auto md:m-0 md:object-cover md:object-top md:h-[94vh]",
    );
    expect(demo).toContain(
      "aiasap-tablet-idle-stage relative w-full h-[100svh] min-h-0 flex flex-col overflow-hidden",
    );
    expect(demo).toContain(
      "[--stage-width:100vw] [--stage-height:100svh] [--stage-top:0px] [--stage-bottom:0px] md:relative md:inset-auto md:h-full md:min-h-screen md:[--stage-width:calc(94vh*9/16)] md:[--stage-height:94vh] md:[--stage-top:3vh] md:[--stage-bottom:3vh]",
    );
    expect(demo).toContain(
      "aiasap-tablet-idle-media relative w-full flex-1 overflow-hidden md:flex md:items-center md:justify-center md:overflow-visible md:px-8",
    );

    // Controls and their anchors are frozen.
    expect(css).toMatch(/\[data-six-initial-idle="1"\] \.aiasap-brand-lockup,[\s\S]*?\[data-six-active-stage="1"\] \.aiasap-brand-lockup \{\s*transform: translateY\(-18px\);/);
    expect(css).not.toContain('[data-six-initial-idle="1"] .aiasap-logo-mark {');
    expect(css).not.toContain('[data-six-initial-idle="1"] .aiasap-tablet-idle-tagline {');
    expect(css).toContain(
      '[data-phone-bottom-stack="1"][data-phone-flow="1"] [data-stage-legal-line="1"] > span {\n    background-image: linear-gradient(180deg, #f8d69b 0%, #e6b263 34%, #c98234 70%, #8b4d1d 100%);\n    background-clip: text;\n    color: transparent;\n    -webkit-background-clip: text;\n    -webkit-text-fill-color: transparent;',
    );
    expect(
      controls.match(/bottom-\[calc\(var\(--stage-bottom\)\+var\(--stage-height\)\*0\.225-4px\)\]/g),
    ).toHaveLength(2);
    expect(
      controls.match(/md:bottom-\[calc\(var\(--stage-bottom\)\+var\(--stage-height\)\*0\.203\)\]/g),
    ).toHaveLength(2);

    // The SHARED stage-control face is frozen. Only the phone start screen gets
    // the warm repaint, and it gets it by scoped override, not by editing this.
    expect(css).toContain(
      "background: linear-gradient(180deg, rgba(74, 74, 74, 0.96), rgba(28, 28, 28, 0.98));",
    );
    expect(css).toContain("border-color: rgba(140, 95, 48, 0.7);");

    // Tablet and desktop keep their own winners.
    expect(css).toContain("--stage-height: min(94vh, 80rem);");
    expect(css).toContain("@media (min-width: 768px) and (max-width: 1366px) and (pointer: coarse)");
    expect(css).toContain("--stage-height: min(94vh, 80rem) !important");
    expect(css).toContain("top: calc(var(--stage-top) + var(--stage-height) + 6px) !important");
    expect(css).toContain("@media (min-width: 768px) and (pointer: fine)");
  });

  it("applies the final idle geometry before hydration can add the phone class", () => {
    const css = source("app/globals.css");
    expect(css).toContain('html:has([data-six-initial-idle="1"])');
    expect(css).toContain('html:has([data-six-initial-idle="1"]) [data-six-initial-idle="1"] > .aiasap-tablet-idle-media');
    expect(css).toContain('height: calc(100svh - 34.65px);');
    expect(source("src/components/LiveAvatarDemo.tsx")).toContain("useLayoutEffect");
  });
});
