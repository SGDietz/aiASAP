import { captureClientWarn } from "../lib/observability/clientLogger";

/**
 * The SDK rejects any command sent to a session that has already gone away:
 * "Session needs to be connected to send command event".
 *
 * For a command whose whole purpose is to STOP something, that rejection is
 * noise - if the session is gone, 6 is already not talking, so the goal is
 * met. But most of our call sites are `void interrupt()`, which cannot catch
 * anything by construction, so each one became an `unhandledrejection` ERROR
 * row. Seen on real rides: 2026-09-04 17:12:45 and 00:08:11, and 2026-08-24,
 * where it also surfaced as `turn_error` and took the turn with it.
 *
 * It lives in its own module so it can be imported by a test without dragging
 * in the LiveAvatar context and the whole voice-delivery chain.
 */
export const NOT_CONNECTED = /needs to be connected|not connected|session .*closed/i;

/**
 * Run a stop-style command and ALWAYS resolve.
 *
 * A disconnected session is silent - that is the outcome we wanted. Anything
 * else is reported at warn (never error, so a dev-overlay badge does not light
 * for an expected teardown race) and still resolves, so no caller can leak a
 * rejection. Rejections are awaited, not just caught: the real failure is
 * asynchronous and a throw-only guard misses it entirely.
 */
export async function settleStopCommand(
  run: () => unknown,
  where: string,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (NOT_CONNECTED.test(message)) return;
    void captureClientWarn(error, { where, expected: "stop-command race" });
  }
}
