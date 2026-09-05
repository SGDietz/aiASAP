/**
 * One retry for the brain call, and only for a genuine network blip.
 *
 * G's ride 2026-09-04 17:07:23: a single `Failed to fetch` on the way to
 * /api/openai-chat-complete cost him the whole turn. 6 answered "Hmm, I hit a
 * snag there. Say that again?" and he had to repeat himself mid-conversation.
 * One dropped packet on wifi should not make a visitor repeat themselves in
 * what is meant to be a sales call.
 *
 * DELIBERATELY NARROW - this retries only what is safe to retry:
 *
 *   - A THROWN fetch is a transport failure. The request never reached the
 *     route, so nothing happened server-side and sending it again is safe.
 *   - An HTTP response of ANY status is NOT retried. The route ran; it may
 *     have already written rows, logged events or charged a provider call.
 *   - An abort is NEVER retried. The caller (or the visitor barging in) asked
 *     for this to stop, and retrying would talk over them - see the aborted-
 *     500s lesson, where "errors" were just the browser hanging up.
 *
 * One attempt, one short pause, then give up and let the existing fallback
 * line speak. A real outage still fails fast instead of stacking timeouts.
 */
export const BRAIN_RETRY_DELAY_MS = 250;

function isAbort(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export async function fetchBrainWithRetry(
  input: string,
  init: RequestInit,
  deps: {
    fetchImpl?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
    onRetry?: (error: unknown) => void;
  } = {},
): Promise<Response> {
  const doFetch = deps.fetchImpl ?? fetch;
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  try {
    return await doFetch(input, init);
  } catch (error) {
    // The visitor interrupted, or we cancelled it. Retrying would talk over
    // them; hand the abort straight back.
    if (isAbort(error) || init.signal?.aborted) throw error;
    deps.onRetry?.(error);
    await sleep(BRAIN_RETRY_DELAY_MS);
    if (init.signal?.aborted) throw error;
    return await doFetch(input, init);
  }
}
