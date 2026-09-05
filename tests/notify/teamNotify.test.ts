import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTeamNotifyText } from "../../src/lib/teamNotify";
import {
  __resetTelegramThrottle,
  sendTelegramAlert,
} from "../../src/lib/telegramAlert";

/**
 * G, 2026-08-21: an auto-email when something new comes in that the team needs
 * to know about, and a Telegram watch for system failures.
 *
 * The rule these tests protect: the email must be ACTIONABLE ON ITS OWN. G
 * reads it on a phone. "New interview, go look in Supabase" is a failure — it
 * makes him stop, find a laptop, and dig.
 */

describe("team notification text", () => {
  const base = {
    kind: "interview_complete" as const,
    who: "Dana",
    email: "dana@example.com",
    dedupeKey: "k1",
  };

  it("leads with who it was and what they did", () => {
    const text = buildTeamNotifyText(base);
    expect(text.split("\n")[0]).toBe("Dana finished their interview.");
  });

  it("carries the contact details, so nobody has to go looking", () => {
    const text = buildTeamNotifyText({ ...base, phone: "555-0100" });
    expect(text).toContain("dana@example.com");
    expect(text).toContain("555-0100");
  });

  it("drops empty facts instead of printing blank labels", () => {
    const text = buildTeamNotifyText({
      ...base,
      facts: [
        ["Trade", "landscaper"],
        ["Website", null],
        ["Phone", "   "],
      ],
    });
    expect(text).toContain("Trade: landscaper");
    expect(text).not.toContain("Website:");
    expect(text).not.toContain("Phone:");
  });

  it("states the next step plainly", () => {
    const text = buildTeamNotifyText({ ...base, nextStep: "Build the page." });
    expect(text).toContain("NEXT: Build the page.");
  });

  it("caps any one value so a runaway field cannot bloat the email", () => {
    const text = buildTeamNotifyText({ ...base, who: "x".repeat(5000) });
    expect(text.length).toBeLessThan(3000);
  });
});

describe("telegram alerts", () => {
  const OLD = { ...process.env };
  beforeEach(() => {
    __resetTelegramThrottle();
    process.env = { ...OLD };
    vi.restoreAllMocks();
  });

  it("stays silent unless deliberately switched on", async () => {
    process.env.TELEGRAM_ALERTS_ENABLED = "";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await sendTelegramAlert("k", "boom");
    expect(r).toEqual({ sent: false, reason: "disabled" });
    // The real assertion: it did not even try. An alerter that is "off" but
    // still calls out is not off.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports unconfigured rather than pretending to have sent", async () => {
    process.env.TELEGRAM_ALERTS_ENABLED = "true";
    process.env.TELEGRAM_ALERT_BOT_TOKEN = "";
    process.env.TELEGRAM_BOT_TOKEN = "";
    process.env.TELEGRAM_ALLOWED_USER_IDS = "123";
    const r = await sendTelegramAlert("k", "boom");
    expect(r).toEqual({ sent: false, reason: "unconfigured" });
  });

  it("sends once, then throttles the same key", async () => {
    process.env.TELEGRAM_ALERTS_ENABLED = "true";
    process.env.TELEGRAM_ALERT_BOT_TOKEN = "tok";
    process.env.TELEGRAM_ALLOWED_USER_IDS = "123,456";
    // The 2026-09-05 alerter believes a send only when Telegram returns a real
    // receipt (ok + message_id) and READS the body - so the mock must hand out a
    // fresh Response per call; one shared Response is consumed by the first send
    // and the third read as "failed".
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 }));

    expect(await sendTelegramAlert("route-a", "one")).toEqual({ sent: true });
    // An error storm must not become a phone storm.
    expect(await sendTelegramAlert("route-a", "two")).toEqual({
      sent: false,
      reason: "throttled",
    });
    // A DIFFERENT failure is still worth knowing about.
    expect(await sendTelegramAlert("route-b", "three")).toEqual({ sent: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("truncates rather than letting Telegram reject the message", async () => {
    process.env.TELEGRAM_ALERTS_ENABLED = "true";
    process.env.TELEGRAM_ALERT_BOT_TOKEN = "tok";
    process.env.TELEGRAM_ALLOWED_USER_IDS = "123";
    let body: unknown = null;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_u, init) => {
      body = JSON.parse(String((init as RequestInit).body));
      return new Response("{}", { status: 200 });
    });
    await sendTelegramAlert("k", "y".repeat(9000));
    // Telegram rejects anything over 4096 outright, so a long alert would be
    // lost entirely rather than shortened.
    const sent = (body as { text: string }).text;
    expect(sent.length).toBeLessThanOrEqual(3920);
    expect(sent).toContain("truncated");
  });

  it("never throws when the network fails", async () => {
    process.env.TELEGRAM_ALERTS_ENABLED = "true";
    process.env.TELEGRAM_ALERT_BOT_TOKEN = "tok";
    process.env.TELEGRAM_ALLOWED_USER_IDS = "123";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network"));
    // An alerter that can break the code path it is watching is worse than none.
    await expect(sendTelegramAlert("k", "boom")).resolves.toEqual({
      sent: false,
      reason: "failed",
    });
  });
});
