import { checkProjectHealth } from "../../../../src/lib/healthMonitor";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";
import { API_KEY, API_URL, AVATAR_ID, VOICE_ID } from "../../secrets";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
 return checkProjectHealth(request, {
  company: "aiasap", expectedBot: "aiASAP_Alert_bot", database: getSupabaseAdminConfig,
  provider: { key: API_KEY, url: API_URL, ids: [["avatars", AVATAR_ID], ["voices", VOICE_ID]] },
  telegram: () => ({ token: process.env.TELEGRAM_ALERT_BOT_TOKEN?.trim() || "", chat: process.env.TELEGRAM_ALLOWED_USER_IDS?.split(",")[0]?.trim() || "", enabled: process.env.TELEGRAM_ALERTS_ENABLED === "true" }),
 });
}
