import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

/**
 * Two faults found in aiASAP's own error log on 2026-09-04.
 *
 * 1. THE LOGGER ATE THE CAUSE. A promise rejected with anything that is not an
 *    Error or a string became `new Error("unhandledrejection")`. The real
 *    reason was discarded and the stack pointed at clientLogger.ts itself.
 *    Three faults (2026-08-29, 09-03, 09-04) were recorded as the literal word
 *    "unhandledrejection" - unreadable and unactionable. Providers reject with
 *    plain objects and Responses routinely.
 *
 * 2. DOUBLE-CLOSED AUDIO CONTEXTS. `AudioContext.close()` returns a PROMISE and
 *    REJECTS on an already-closed context; it does not throw synchronously. So
 *    four `try { void ctx.close(); } catch {}` sites caught nothing and the
 *    rejection escaped to the global handler as "Cannot close a closed
 *    AudioContext." (logged 2026-09-04T00:35:33).
 */
describe("a rejection keeps its cause", () => {
  const logger = source("src/lib/observability/clientLogger.ts");

  it("describes non-Error rejection reasons instead of discarding them", () => {
    expect(logger).toContain("function describeRejection");
    expect(logger).toContain("reason: described.detail");
    // The exact shape that threw the cause away must not come back.
    expect(logger).not.toContain('new Error(typeof reason === "string" ? reason : "unhandledrejection")');
  });

  it("never lets the error handler become the error", () => {
    const fn = logger.slice(logger.indexOf("function describeRejection"));
    // JSON.stringify throws on circular structures; that must be caught.
    expect(fn).toContain("JSON.stringify");
    expect(fn).toMatch(/catch\s*\{/);
    expect(fn).toContain("undescribable");
  });
});

describe("AudioContext.close() rejections are handled, not caught", () => {
  const files = [
    "src/components/LiveAvatarSession.tsx",
    "src/lib/typewriterClick.ts",
    "src/liveavatar/avatarAudioPresentation.ts",
  ];

  it("every AudioContext close() attaches a .catch - try/catch cannot catch a rejection", () => {
    // Only audio contexts. A BroadcastChannel/MessageChannel close() is
    // synchronous and returns void, so it needs no handler.
    const audioClose = /\b[A-Za-z0-9_.?]*(?:ctx|context|audio)[A-Za-z0-9_.?]*\.close\(\)(\s*\.catch)?/gi;
    let checked = 0;
    for (const rel of files) {
      for (const hit of source(rel).match(audioClose) ?? []) {
        checked += 1;
        expect(hit, `${rel}: bare audio close() without .catch`).toContain(".catch");
      }
    }
    // Guard the guard: if the pattern ever stops matching, this test would pass
    // by finding nothing.
    expect(checked).toBeGreaterThanOrEqual(5);
  });
});
