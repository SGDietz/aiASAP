import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fetchBrainWithRetry } from "../../src/lib/brainFetch";

const ok = () => new Response("{}", { status: 200 });
const noSleep = () => Promise.resolve();

/**
 * G's ride, 2026-09-04 17:07:23: a single `Failed to fetch` on the way to the
 * brain cost him the turn - 6 said "Hmm, I hit a snag there. Say that again?"
 * and he repeated himself in the middle of a sales conversation.
 */
describe("the brain call survives one network blip", () => {
  it("retries a thrown fetch once and returns the second response", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(ok());
    const onRetry = vi.fn();
    const res = await fetchBrainWithRetry("/api/openai-chat-complete", {}, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
      onRetry,
    });
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("gives up after ONE retry - a real outage fails fast", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(
      fetchBrainWithRetry("/api/openai-chat-complete", {}, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: noSleep,
      }),
    ).rejects.toThrow("Failed to fetch");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("NEVER retries an HTTP error - the route already ran", async () => {
    // A 500 means the request arrived. It may have written rows or paid for a
    // provider call; sending it again could double that.
    const fetchImpl = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    const res = await fetchBrainWithRetry("/api/openai-chat-complete", {}, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
    });
    expect(res.status).toBe(500);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("NEVER retries an abort - the visitor barged in", async () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    const fetchImpl = vi.fn().mockRejectedValue(err);
    await expect(
      fetchBrainWithRetry("/api/openai-chat-complete", {}, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: noSleep,
      }),
    ).rejects.toThrow("aborted");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry into an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(
      fetchBrainWithRetry("/api/openai-chat-complete", { signal: controller.signal }, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: noSleep,
      }),
    ).rejects.toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("is wired into BOTH brain call sites", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/LiveAvatarSession.tsx"),
      "utf8",
    );
    expect(src.match(/fetchBrainWithRetry\("\/api\/openai-chat-complete"/g)).toHaveLength(2);
    expect(src).not.toContain('await fetch("/api/openai-chat-complete"');
    expect(src.match(/brain_fetch_retried/g)).toHaveLength(2);
  });
});
