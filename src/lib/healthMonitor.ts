import { readCodexOperationsHealth } from "./codexOperationsHealth";
import { runHealthNotice } from "./healthNotice";

type Settings = {
  company: "aiasap" | "isolve"; expectedBot: string;
  database: () => { url: string; serviceRoleKey: string };
  provider: { url: string; key: string; ids: Array<[string, string]> };
  telegram: () => { token: string; chat: string; enabled: boolean };
};
const VERSION = "2026-09-05-errors-only";

/** Cloud checks never create avatar sessions or send emails. Healthy runs only stamp state. */
export async function checkProjectHealth(request: Request, settings: Settings) {
  const auth = request.headers.get("authorization");
  if (![process.env.CRON_SECRET, process.env.HEALTH_VERIFY_SECRET].some(s => s && s.length >= 32 && auth === `Bearer ${s}`)) {
    return Response.json({ error: "not authorized" }, { status: 401 });
  }
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const findings: Array<{ code: string; detail: string }> = [];
  const add = (code: string, detail: string) => { if (!findings.some(f => f.code === code)) findings.push({ code, detail }); };
  let database: { url: string; serviceRoleKey: string } | null = null;
  try { const d = settings.database(); database = { url: d.url.trim().replace(/\/$/, ""), serviceRoleKey: d.serviceRoleKey.trim() }; }
  catch { add("database_configuration_missing", "The monitor cannot access its database configuration."); }
  const since = new Date(Date.now() - 20 * 60_000).toISOString();
  async function query(path: string): Promise<Array<Record<string, unknown>>> {
    if (!database) return [];
    try {
      const r = await fetch(`${database.url}/rest/v1/${path}`, {
        headers: { apikey: database.serviceRoleKey, Authorization: `Bearer ${database.serviceRoleKey}` },
        cache: "no-store", signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) throw new Error("Database check failed");
      const rows = await r.json(); if (!Array.isArray(rows)) throw new Error("Invalid database response");
      return rows;
    } catch { add("database_unreadable", "The monitor cannot read required health records in Supabase."); return []; }
  }
  const probes: Promise<void>[] = [];
  probes.push((async () => {
    const rows = await query(`error_logs?select=route&created_at=gt.${since}&level=in.(error,fatal)&or=(env.in.(production,prod),env.is.null)&limit=100`);
    // Route keys remain stable as counts change between overlapping checks.
    const routes = new Map<string, number>();
    for (const row of rows) { const route = typeof row.route === "string" ? row.route.split("?")[0].slice(0,120) : "unknown"; routes.set(route, (routes.get(route) || 0) + 1); }
    for (const [route, count] of routes) add(`application_errors:${route}`, `${count}${rows.length === 100 ? "+" : ""} recent production errors at ${route}.`);
  })());
  if (settings.company === "aiasap") {
    probes.push((async () => {
      const rows = await query(`app_events?select=event_type&surface=eq.aiasap&or=(payload->>env.eq.production,payload->>env.is.null)&severity=in.(high,critical)&created_at=gt.${since}&limit=100`);
      const types = new Set(rows.map(row => String(row.event_type)));
      for (const type of types) add(`serious_event:${type}`, `Recent serious event: ${type}.`);
      const mute = await query(`app_events?select=id&surface=eq.aiasap&or=(payload->>env.eq.production,payload->>env.is.null)&event_type=eq.voice_avatar_repeat_failed&created_at=gt.${since}&limit=3`);
      if (mute.length >= 3) add("avatar_speech_failed", "The avatar failed to speak at least three times in 20 minutes.");
    })());
  }
  for (const [collection, id] of settings.provider.ids) probes.push((async () => {
    if (!id.trim() || !settings.provider.key.trim()) { add(`provider_configuration:${collection}`, `LiveAvatar ${collection} configuration is missing.`); return; }
    try {
      const r = await fetch(`${settings.provider.url.trim().replace(/\/$/, "")}/v1/${collection}/${encodeURIComponent(id.trim())}`, {
        headers: { "x-api-key": settings.provider.key.trim(), Accept: "application/json", "User-Agent": "Mozilla/5.0 Chrome/152.0.0.0 Safari/537.36" },
        cache: "no-store", signal: AbortSignal.timeout(6000),
      });
      if (r.status === 404) add(`provider_missing:${collection}`, `The configured LiveAvatar ${collection} entry no longer exists.`);
      else if (!r.ok) add(`provider_unverified:${collection}`, `LiveAvatar ${collection} lookup failed (HTTP ${r.status}); session readiness could not be verified.`);
    } catch { add(`provider_unverified:${collection}`, `LiveAvatar ${collection} lookup timed out or could not connect.`); }
  })());
  const tg = settings.telegram();
  let bot: string | null = null;
  let telegramReady = false;
  probes.push((async () => {
    if (!tg.enabled || !tg.token || !tg.chat) { add("telegram_unconfigured", "The operational alert channel is not configured."); return; }
    try {
      const r = await fetch(`https://api.telegram.org/bot${tg.token}/getMe`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
      const data = await r.json();
      bot = r.ok && data.ok ? data.result?.username ?? null : null;
      telegramReady = bot?.toLowerCase() === settings.expectedBot.toLowerCase();
      if (!telegramReady) add("telegram_identity_invalid", "The operational alert bot could not be authenticated as the requested bot.");
    } catch { add("telegram_unreachable", "Telegram could not be reached to verify the alert channel."); }
  })());
  if (database) probes.push((async () => {
    for (const issue of await readCodexOperationsHealth(settings.company, database!.url, database!.serviceRoleKey)) add(issue.code, issue.detail);
  })());
  await Promise.all(probes);
  const detail = `${settings.company === "aiasap" ? "aiASAP" : "iSolve"}: operational attention needed\n\n${findings.map(f => f.detail).join("\n")}`;
  const notice = await runHealthNotice({ company: settings.company, url: database?.url || "", key: database?.serviceRoleKey || "", findings: findings.map(f => f.code), detail, dryRun,
    send: async text => {
      if (!telegramReady) return { sent: false };
      try {
        const r = await fetch(`https://api.telegram.org/bot${tg.token}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: tg.chat, text: text.slice(0,3900), disable_web_page_preview: true }), signal: AbortSignal.timeout(6000),
        });
        const receipt = await r.json(); return { sent: r.ok && receipt.ok === true && Number.isInteger(receipt.result?.message_id) };
      } catch { return { sent: false }; }
    },
  });
  return Response.json({ ok: true, clean: findings.length === 0, dryRun, findings, monitorVersion: VERSION, bot, telegramReady, notice, checkedAt: new Date().toISOString() });
}
