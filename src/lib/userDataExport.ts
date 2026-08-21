import { getSupabaseAdminConfig } from "./supabaseAdmin";

/**
 * Shared user-data gather (G 2026-06-07). One source of truth for "everything we
 * hold on this user," used by the in-app export, the emailed download link, and
 * (conceptually) mirrored by the delete wipe. Read-only.
 */

// Every table keyed by user_id that holds this user's data — MIRRORS the delete
// route's list, so a download is a complete copy of exactly what delete erases.
export const USER_DATA_TABLES = [
  "user_memory_facts",
  "conversation_messages",
  "transcript_events",
  "media_events",
  "lead_sessions",
  "contact_entities",
] as const;

export type UserExport = {
  export_format: string;
  exported_at: string;
  account: { user_id: string; email: string | null };
  data: Record<string, unknown>;
};

export async function gatherUserExport(
  userId: string,
  email: string | null,
): Promise<UserExport> {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Accept: "application/json",
  } as const;

  const data: Record<string, unknown> = {};
  for (const table of USER_DATA_TABLES) {
    try {
      const res = await fetch(
        `${url}/rest/v1/${table}?user_id=eq.${encodeURIComponent(userId)}`,
        { headers },
      );
      data[table] = res.ok ? await res.json() : [];
    } catch {
      data[table] = [];
    }
  }

  if (email) {
    try {
      const res = await fetch(
        // EXPLICIT COLUMNS, and token_hash is deliberately not among them.
        // Without a select= this pulled every column, and this payload is
        // handed to the user as a downloadable file by app/api/account/export.
        // token_hash is now Supabase's real magic-link token - a live sign-in
        // credential - so exporting it would put a working key to the account
        // inside a file the user can forward to anyone.
        `${url}/rest/v1/account_email_links?email=eq.${encodeURIComponent(email)}` +
          `&select=id,email,session_id,captured_lists,expires_at,used_at,created_at`,
        { headers },
      );
      data.account_email_links = res.ok ? await res.json() : [];
    } catch {
      data.account_email_links = [];
    }
  }

  return {
    export_format: "aiASAP-user-data-v1",
    exported_at: new Date().toISOString(),
    account: { user_id: userId, email },
    data,
  };
}

// ---------------------------------------------------------------------------
// PLAIN-ENGLISH export (G 2026-06-09): a normal user can't read raw JSON full of
// embeddings/UUIDs. The emailed download link now renders a branded, readable
// page (no blank tab) AND fires a download of a clean plain-text copy. These two
// renderers turn the raw gather payload into something a person understands.
// ---------------------------------------------------------------------------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDay(iso: unknown): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}
function asRows(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}
function cleanMsg(m: Record<string, unknown>): string {
  const t = typeof m.message === "string" ? m.message.trim() : "";
  if (!t) return "";
  if (m.role === "assistant" && t.startsWith("{")) return ""; // internal signal JSON
  if (/^\[USER (?:HAS BEEN )?SILENT/i.test(t)) return ""; // silence markers
  return t;
}
function escHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function sortedMessages(d: Record<string, unknown>): Record<string, unknown>[] {
  return asRows(d.conversation_messages)
    .filter((m) => cleanMsg(m))
    .sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
}
// The facts/contacts tables hold many near-duplicate rows (every mention re-saved).
// A user export must read CLEAN, so collapse case-insensitive repeats and drop the
// bare account-email rows (already shown in the header). (G 2026-06-09: "organized.")
const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SINGLE_NAME = /^[A-Z][a-z'’.-]*$/; // one capitalized word = a name/topic capture, not a "fact about you"
function uniqueFacts(facts: Record<string, unknown>[], email: string | null): string[] {
  const seen = new Set<string>();
  const em = String(email ?? "").toLowerCase();
  const out: string[] = [];
  for (const f of facts) {
    const c = typeof f.content === "string" ? f.content.trim() : "";
    if (!c) continue;
    const k = c.toLowerCase();
    if (k === em || seen.has(k)) continue;
    // Drop name/email CAPTURES - those belong on the account, not in "what 6
    // remembers." (G 2026-06-09: export showed "Greg / Kevin / Scott / an email"
    // mixed in - one account = one user; the profile name/email isn't a fact.)
    if (EMAIL_LIKE.test(c) || SINGLE_NAME.test(c)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}
function uniqueContacts(
  rows: Record<string, unknown>[],
  accountEmail: string | null,
): { name: string; email: string }[] {
  const seen = new Set<string>();
  const em = String(accountEmail ?? "").toLowerCase();
  const out: { name: string; email: string }[] = [];
  for (const c of rows) {
    const name = String(c.name ?? c.full_name ?? "Someone");
    const email = c.email ? String(c.email) : "";
    // Skip self-references (the user's own account email saved as a "contact").
    if (email.toLowerCase() === em) continue;
    const k = `${name}|${email}`.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ name, email });
  }
  return out;
}

/** Clean plain-text copy of everything we hold - the downloaded file. */
export function renderUserExportText(payload: UserExport): string {
  const d = payload.data as Record<string, unknown>;
  const facts = asRows(d.user_memory_facts);
  const contacts = asRows(d.contact_entities);
  const out: string[] = [];
  out.push("YOUR aiASAP DATA");
  out.push(`Downloaded ${fmtDay(payload.exported_at)} for ${payload.account.email ?? "your account"}`);
  out.push("This is what 6 remembers about you - your durable profile. You can tell 6 to delete any of it anytime.");
  out.push("");
  out.push("WHAT 6 REMEMBERS ABOUT YOU");
  const factLines = uniqueFacts(facts, payload.account.email);
  if (factLines.length) factLines.forEach((c) => out.push(`  - ${c}`));
  else out.push("  (nothing saved yet)");
  const contactList = uniqueContacts(contacts, payload.account.email);
  if (contactList.length) {
    out.push("");
    out.push("PEOPLE YOU TOLD 6 ABOUT");
    for (const c of contactList) {
      out.push(`  - ${c.name}${c.email ? ` (${c.email})` : ""}`);
    }
  }
  // G 2026-06-09: do NOT bundle the full chat transcript - it can be an enormous
  // amount of data over many sessions, and it isn't what "what do you know about
  // me" means. Mirrors Google/Meta: the export is your PROFILE/memory, and raw
  // history is a separate, opt-in thing (not the default dump).
  out.push("");
  out.push("Note: this is the memory 6 actually uses to help you - not a copy of every word you've said. Your full chat history is not bundled here.");
  out.push("");
  out.push("That's everything aiASAP keeps about you. - 6");
  return out.join("\n");
}

/** The OPT-IN "Conversation history" category (G 2026-06-09, Google/Meta-style):
 *  the full readable transcript. This is the heavy data a user only gets if they
 *  ASK for it - never bundled into the default profile export. */
export function renderConversationHistoryText(payload: UserExport): string {
  const d = payload.data as Record<string, unknown>;
  const msgs = sortedMessages(d);
  const out: string[] = [];
  out.push("YOUR CONVERSATION HISTORY WITH 6");
  out.push(`For ${payload.account.email ?? "your account"}`);
  out.push("");
  if (!msgs.length) {
    out.push("(no saved conversation yet)");
    return out.join("\n");
  }
  let lastDay = "";
  for (const m of msgs) {
    const day = fmtDay(m.created_at);
    if (day && day !== lastDay) {
      out.push("");
      out.push(`[${day}]`);
      lastDay = day;
    }
    out.push(`  ${m.role === "assistant" ? "6 " : "You"}: ${cleanMsg(m)}`);
  }
  return out.join("\n");
}

/** Build the downloaded file from the chosen categories - the Google/Meta
 *  "select what to download" core. Profile is the default; history is opt-in. */
export function buildExportFile(
  payload: UserExport,
  include: { profile: boolean; history: boolean },
): string {
  const parts: string[] = [];
  if (include.profile) parts.push(renderUserExportText(payload));
  if (include.history) parts.push(renderConversationHistoryText(payload));
  if (!parts.length) parts.push("Nothing was selected to download.");
  return parts.join(`\n\n${"=".repeat(56)}\n\n`);
}

/** Branded "Your data & privacy" chooser for the emailed link (G 2026-06-09,
 *  Google/Meta minimalist core): pick categories, then download a file. NO data is
 *  rendered on the page (private) - the button fetches the chosen categories from
 *  this same token-gated route and saves the file. Profile is checked by default;
 *  conversation history is opt-in. Deletion stays VOICE-driven (a no-login link
 *  page must never be able to delete), so we point them to 6. */
export function renderUserExportHtml(payload: UserExport): string {
  const email = payload.account.email ?? "your account";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Your aiASAP data &amp; privacy</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:radial-gradient(135% 110% at 50% 14%,#5a360f 0%,#3a220c 40%,#241608 72%,#190f05 100%);color:#f4e7d2;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px 16px}
.card{max-width:540px;width:100%;background:rgba(20,12,4,.6);border:1px solid rgba(215,160,90,.4);border-radius:18px;padding:32px 28px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
h1{font-size:1.7rem;margin:0;text-align:center;background:linear-gradient(to bottom,#ffe9c2,#d7a05a,#3a2108);-webkit-background-clip:text;background-clip:text;color:transparent;font-style:italic;font-weight:800}
.sub{color:#e7c98f;margin:.5rem 0 1.4rem;font-size:1.02rem;text-align:center}
.opt{display:flex;align-items:flex-start;gap:11px;background:rgba(215,160,90,.08);border:1px solid rgba(215,160,90,.25);border-radius:12px;padding:14px 16px;margin:10px 0;cursor:pointer}
.opt input{margin-top:3px;width:18px;height:18px;accent-color:#d7a05a;flex:none}
.opt .t{font-weight:700;color:#f4e7d2}
.opt .d{color:#c7a572;font-size:.88rem;margin-top:2px}
.dl{display:block;width:100%;margin-top:18px;background:linear-gradient(to bottom,#f0c987,#d7a05a);color:#2a1808;font-weight:800;padding:14px;border-radius:12px;border:none;cursor:pointer;font-size:1.08rem}
.dl:disabled{opacity:.6;cursor:default}
.foot{color:#9c7d52;margin-top:1.4rem;font-size:.85rem;line-height:1.55;text-align:center}
</style></head>
<body><div class="card">
<h1>aiASAP</h1>
<div class="sub">Your data &amp; privacy &mdash; ${escHtml(email)}</div>
<label class="opt"><input type="checkbox" id="profile" checked><span><span class="t">What 6 remembers about you</span><div class="d">Your profile - your name, interests, and what you're working on.</div></span></label>
<label class="opt"><input type="checkbox" id="history"><span><span class="t">Your full conversation history</span><div class="d">Every message you and 6 have exchanged. This can be a lot.</div></span></label>
<button class="dl" id="dl">Download my data</button>
<p class="foot">We never sell your data. To delete any of it, just ask 6 &mdash; he'll walk you through it.</p>
</div>
<script>
(function(){
var token=new URLSearchParams(location.search).get("token")||"";
var btn=document.getElementById("dl");
function dl(){
  var inc=[];
  if(document.getElementById("profile").checked)inc.push("profile");
  if(document.getElementById("history").checked)inc.push("history");
  if(!inc.length){btn.textContent="Pick at least one above";return;}
  btn.disabled=true;btn.textContent="Preparing your file...";
  fetch("/api/account/download?token="+encodeURIComponent(token)+"&format=file&include="+inc.join(","))
    .then(function(r){return r.text();})
    .then(function(t){
      var blob=new Blob([t],{type:"text/plain;charset=utf-8"});
      var url=URL.createObjectURL(blob);
      var a=document.createElement("a");a.href=url;a.download="aiASAP-my-data.txt";document.body.appendChild(a);a.click();a.remove();
      btn.disabled=false;btn.textContent="Download my data";
    })
    .catch(function(){btn.disabled=false;btn.textContent="Hmm - try again";});
}
btn.addEventListener("click",dl);
})();
</script>
</body></html>`;
}
