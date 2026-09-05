/**
 * TELEGRAM ALERTS — G, 2026-08-21: "a telegram watch for system failures needs
 * to be built."
 *
 * This is the INSIDE half. It fires from within the running app the moment
 * something breaks, so a failure reaches G's phone in seconds rather than
 * whenever somebody next looks at a dashboard.
 *
 * It cannot be the only half, and that is the important part: an alerter living
 * inside the app is silent in exactly the case that matters most — the app
 * being down, the deploy being broken, the process never starting. That is what
 * the OUTSIDE watcher is for (Scheduled\aiasap_failure_watch.ps1), which polls
 * Supabase from this machine and notices both real failures AND the app going
 * quiet. Inside catches detail; outside catches death.
 *
 * CREDENTIALS — read this before switching it on.
 * `TELEGRAM_BOT_TOKEN` in aiASAP's .env is DEAD. Verified 2026-08-21 with a
 * getMe call (which sends no message): it returns 401 Unauthorized. The live
 * bot is @ClaudeLaptop1bot, whose token lives in the Windows USER environment
 * as CLAUDE_TG_BOT_TOKEN — fine for the local watcher script, useless to this
 * app, which runs on Vercel and cannot see a Windows variable.
 *
 * So this reads TELEGRAM_ALERT_BOT_TOKEN first. Until a WORKING token is set
 * under that name in the app's environment, app-side alerts cannot send — which
 * is exactly why TELEGRAM_ALERTS_ENABLED defaults to off rather than pretending
 * to be armed. The outside watcher covers the gap in the meantime.
 * The chat id in TELEGRAM_ALLOWED_USER_IDS is good.
 */

/** One alert per key per this long. An error storm must not become a phone storm. */
const ALERT_MIN_GAP_MS = 60 * 60 * 1000;

/** Bound the map so a high-cardinality key can never grow it without limit. */
const MAX_TRACKED_KEYS = 500;

const lastAlertAt = new Map<string, number>();

export type TelegramAlertResult =
  | { sent: true }
  | { sent: false; reason: "disabled" | "unconfigured" | "throttled" | "failed" };

function chatId(): string | null {
  const ids = process.env.TELEGRAM_ALLOWED_USER_IDS?.trim();
  if (!ids) return null;
  const first = ids.split(",")[0]?.trim();
  return first || null;
}

/**
 * Send one alert. Never throws — an alerter that can break the code path it is
 * watching is worse than no alerter.
 *
 * `key` groups messages for throttling: pass something stable and coarse, like
 * the route name, so a hundred failures of the same thing send one message.
 */
export async function sendTelegramAlert(
  key: string,
  text: string,
): Promise<TelegramAlertResult> {
  // Off unless deliberately switched on, matching CRASH_EMAILS_ENABLED. G has
  // been flooded before; a new alarm should be armed on purpose, not by
  // surprise on the next deploy.
  if (process.env.TELEGRAM_ALERTS_ENABLED !== "true") {
    return { sent: false, reason: "disabled" };
  }

  // TELEGRAM_ALERT_BOT_TOKEN first — the older TELEGRAM_BOT_TOKEN in .env is a
  // dead credential (401 on getMe) and is kept only as a fallback in case it is
  // ever repaired. See the header note.
  const token =
    process.env.TELEGRAM_ALERT_BOT_TOKEN?.trim() ||
    process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chat = chatId();
  if (!token || !chat) return { sent: false, reason: "unconfigured" };

  const now = Date.now();
  const last = lastAlertAt.get(key) ?? 0;
  if (now - last < ALERT_MIN_GAP_MS) return { sent: false, reason: "throttled" };

  if (lastAlertAt.size >= MAX_TRACKED_KEYS) {
    // Drop the oldest half rather than refusing to track anything new, which
    // would silently disable throttling and let a storm through.
    const entries = [...lastAlertAt.entries()].sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < Math.floor(entries.length / 2); i++) {
      lastAlertAt.delete(entries[i][0]);
    }
  }
  lastAlertAt.set(key, now);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        // Telegram rejects messages over 4096 characters outright — a truncated
        // alert is infinitely better than a rejected one.
        text: text.length > 3900 ? `${text.slice(0, 3900)}\n…(truncated)` : text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(6000),
    });
    const receipt = await res.json();
    if (!res.ok || receipt.ok !== true || !Number.isInteger(receipt.result?.message_id)) {
      lastAlertAt.delete(key);
      // Deliberately console.error and not captureServerError: routing a failed
      // alert back through the logger that triggers alerts is a loop.
      console.error(`[telegram-alert] send failed HTTP ${res.status}`);
      return { sent: false, reason: "failed" };
    }
    return { sent: true };
  } catch {
    lastAlertAt.delete(key);
    console.error("[telegram-alert] send failed");
    return { sent: false, reason: "failed" };
  }
}

/** Test seam only. */
export function __resetTelegramThrottle(): void {
  lastAlertAt.clear();
}
