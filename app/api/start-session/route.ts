import {
  API_KEY,
  API_URL,
  AVATAR_ID,
  VOICE_ID,
  CONTEXT_ID,
  LANGUAGE,
} from "../secrets";
import { resolveLiveAvatarVoice } from "../liveavatarVoice";
import { assertCanMintSessionToken } from "../../../src/lib/liveavatarCredits";
import { getUser } from "../../../src/lib/auth/getUser";
import { recallFacts, formatRecalledFactsForPrompt } from "../../../src/lib/memory";
import { getSupabaseAdminConfig } from "../../../src/lib/supabaseAdmin";
import {
  localeLanguageName,
  mapLocaleToAvatarLanguage,
  parseRequestedLocale,
  pickFromAcceptLanguage,
  type SupportedLocale,
} from "../../../src/lib/i18n/avatarLanguage";
import {
  formatLocalTime,
  isValidTimezone,
} from "../../../src/lib/timezone/userTimezone";

/** Remember an explicit ?lang choice on the account so a shared per-language
 *  link only needs the param once. GoTrue merges user_metadata keys, so this
 *  never clobbers full_name. Fire-and-forget — session start never blocks. */
async function persistPreferredLocale(
  userId: string,
  locale: SupportedLocale,
): Promise<void> {
  try {
    const { url, serviceRoleKey } = getSupabaseAdminConfig();
    const res = await fetch(
      `${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      {
        method: "PUT",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_metadata: { preferred_locale: locale } }),
      },
    );
    if (!res.ok) {
      console.error("persistPreferredLocale failed", res.status);
    }
  } catch (e) {
    console.error("persistPreferredLocale threw", e);
  }
}

/** Resume memory saved at SIGNUP. The pre-sign-in conversation + the captured
 *  name live in account_email_links.captured_lists (written by /api/account/start).
 *  This is the source that actually held the user's data on RETURN when the
 *  vector-facts pipeline produced nothing — G's "no memory of me" on 2026-06-03
 *  (authCookies=1 but mem=0; data sat in captured_lists, 6 read the empty
 *  user_memory_facts table). Best-effort: never throws into session start.
 */
async function loadResumeMemoryFromLinks(
  email: string,
): Promise<{ name: string; summary: string }> {
  const empty = { name: "", summary: "" };
  if (!email) return empty;
  let url: string;
  let serviceRoleKey: string;
  try {
    ({ url, serviceRoleKey } = getSupabaseAdminConfig());
  } catch {
    return empty;
  }
  try {
    const res = await fetch(
      `${url}/rest/v1/account_email_links?email=eq.${encodeURIComponent(
        email,
      )}&order=created_at.desc&limit=1&select=captured_lists`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );
    if (!res.ok) return empty;
    const rows = (await res.json()) as Array<{
      captured_lists?: {
        fullName?: unknown;
        resumeState?: { recentConversation?: unknown };
      } | null;
    }>;
    const cap = rows?.[0]?.captured_lists;
    if (!cap) return empty;

    const name = typeof cap.fullName === "string" ? cap.fullName.trim() : "";

    const convo = cap.resumeState?.recentConversation;
    const lines: string[] = [];
    if (Array.isArray(convo)) {
      let prev = "";
      for (const turn of convo) {
        const t = turn as { role?: unknown; text?: unknown };
        const text = typeof t.text === "string" ? t.text.trim() : "";
        if (!text) continue;
        const who = t.role === "assistant" ? "6" : "User";
        const line = `${who}: ${text}`;
        if (line === prev) continue; // drop the STT double-fires
        prev = line;
        lines.push(line);
      }
    }

    if (!name && lines.length === 0) return empty;

    const parts: string[] = [
      "You've talked with this user before — use what you know naturally, don't recite it or announce that you remember.",
    ];
    if (name) parts.push(`Their name is ${name}.`);
    if (lines.length > 0) {
      // Last 20 lines (was 12) so the user's real TOPIC survives a long signup
      // tail in the recalled context (the 950-char cap in buildDynamicVariables
      // still bounds what reaches 6). 2026-06-03.
      const tail = lines.slice(-20);
      parts.push(
        `Recent conversation before they left (oldest first, newest last):\n${tail.join(
          "\n",
        )}`,
      );
    }
    return { name, summary: parts.join("\n") };
  } catch {
    return empty;
  }
}

/** Build per-session dynamic_variables for the LiveAvatar cw template.
 *  - Signed-in: greet by name + inject recent memory so 6 picks up exactly
 *    where the user left off.
 *  - Anonymous: blank placeholders + a marker so 6 knows to behave as
 *    first-meet.
 */
async function buildDynamicVariables(): Promise<Record<string, string>> {
  const vars: Record<string, string> = {
    user_signed_in: "false",
    user_name: "",
    user_memory_summary: "",
  };
  try {
    const user = await getUser();
    if (!user) return vars;

    vars.user_signed_in = "true";

    // Resume blob saved at signup — the reliable source for the name + the
    // conversation thread when the vector-facts store is empty (2026-06-03).
    const resume = await loadResumeMemoryFromLinks(user.email ?? "");

    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const name =
      typeof meta.full_name === "string" && meta.full_name.trim()
        ? meta.full_name.trim()
        : typeof meta.name === "string" && meta.name.trim()
          ? meta.name.trim()
          : resume.name
            ? resume.name
            : user.email
              ? user.email.split("@")[0]
              : "";
    if (name) vars.user_name = name.slice(0, 64);

    // Long-term memory = vector facts (when populated) + the resume blob (always
    // present after a signup). Combine both so 6 picks up the actual thread even
    // when fact extraction produced nothing — that empty path was the bug.
    const facts = await recallFacts({
      userId: user.id,
      query: "what I know about this user",
    });
    const factBlock = formatRecalledFactsForPrompt(facts);
    console.log(
      `[start-session DIAG] recalledFacts=${facts.length} resumeName=${resume.name ? "yes" : "no"} resumeLines=${resume.summary ? "yes" : "no"}`,
    );
    const memParts = [factBlock, resume.summary].filter((s) => s && s.trim());
    if (memParts.length > 0) {
      // Cap at 950 chars (LiveAvatar limit is 1000) to be safe.
      vars.user_memory_summary = memParts.join("\n\n").slice(0, 950);
    }
  } catch (e) {
    console.error("buildDynamicVariables failed:", e);
  }
  return vars;
}

export async function POST(request: Request) {
  const missing = [
    ["LIVEAVATAR_API_KEY", API_KEY],
    ["LIVEAVATAR_AVATAR_ID", AVATAR_ID],
    ["LIVEAVATAR_VOICE_ID", VOICE_ID],
    ["LIVEAVATAR_CONTEXT_ID", CONTEXT_ID],
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    return new Response(
      JSON.stringify({
        error: `LiveAvatar is missing: ${missing.map(([name]) => name).join(", ")}`,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const gate = await assertCanMintSessionToken();
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.message }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  // M1.6 parity — languages switchboard (2026-06-10): explicit ?lang from the
  // URL beats the signed-in user's saved choice beats the browser's
  // Accept-Language beats the LIVEAVATAR_LANGUAGE env (legacy behavior).
  // aiASAP is URL/verbal-driven — there is NO language button (2.1 lock).
  let requestedLang: string | null = null;
  let deviceTz: string | null = null;
  try {
    const body = (await request.json().catch(() => null)) as {
      lang?: unknown;
      tz?: unknown;
    } | null;
    if (body && typeof body.lang === "string") requestedLang = body.lang;
    // Device clock (2026-06-11, G: "6 should always be on the time zone of
    // the user") — the browser's IANA zone, sent automatically. Rung 1 of the
    // timezone ladder; a zone the user SET BY VOICE on the account beats it.
    if (body && isValidTimezone(body.tz)) deviceTz = body.tz;
  } catch {
    // No/invalid body — the legacy callers send none.
  }
  const explicitLocale = parseRequestedLocale(requestedLang);
  const localeUser = await getUser();
  const savedLocale = parseRequestedLocale(
    typeof (localeUser?.user_metadata as Record<string, unknown> | undefined)
      ?.preferred_locale === "string"
      ? ((localeUser?.user_metadata as Record<string, unknown>)
          .preferred_locale as string)
      : null,
  );
  const locale: SupportedLocale | null =
    explicitLocale ??
    savedLocale ??
    pickFromAcceptLanguage(request.headers.get("accept-language"));
  if (explicitLocale && localeUser && savedLocale !== explicitLocale) {
    void persistPreferredLocale(localeUser.id, explicitLocale);
  }

  let session_token = "";
  let session_id = "";
  try {
    const voiceResolution = await resolveLiveAvatarVoice();
    if (voiceResolution.usedFallback) {
      console.warn(
        `LiveAvatar primary voice ${voiceResolution.primaryVoiceId} has no preview audio; using fallback voice ${voiceResolution.voiceId}`,
      );
    }
    const avatarPersona: Record<string, string> = {
      voice_id: voiceResolution.voiceId,
      context_id: CONTEXT_ID,
    };
    const avatarLanguage = mapLocaleToAvatarLanguage(locale, LANGUAGE);
    if (avatarLanguage) {
      avatarPersona.language = avatarLanguage;
    }

    const dynamicVariables = await buildDynamicVariables();
    // The cw's RESPONSE LANGUAGE line renders from this — always set, English
    // by default so the template never shows a raw placeholder.
    dynamicVariables.response_language = localeLanguageName(locale);
    // Timezone ladder: account voice-set zone > device clock. Always set both
    // vars (possibly empty) so the cw template never shows raw placeholders.
    const accountTzRaw = (
      localeUser?.user_metadata as Record<string, unknown> | undefined
    )?.timezone;
    const accountTz = isValidTimezone(accountTzRaw) ? accountTzRaw : null;
    const userTz = accountTz ?? deviceTz;
    dynamicVariables.user_timezone = userTz ?? "";
    dynamicVariables.user_local_time = userTz ? formatLocalTime(userTz) : "";
    console.log(
      `[start-session DIAG] signed_in=${dynamicVariables.user_signed_in} name=${dynamicVariables.user_name ? "yes" : "no"} mem=${dynamicVariables.user_memory_summary.length} lang=${locale ?? "env-default"} tz=${userTz ?? "none"}${accountTz ? "(account)" : deviceTz ? "(device)" : ""}`,
    );

    const res = await fetch(`${API_URL}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "X-API-KEY": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "FULL",
        avatar_id: AVATAR_ID,
        max_session_duration: 20 * 60, // 20 minutes (LiveAvatar API: seconds)
        avatar_persona: avatarPersona,
        turn_eagerness: "patient",
        // Per-session cw template values. The cw has ${user_name},
        // ${user_memory_summary}, and ${user_signed_in} placeholders;
        // these get rendered at session start so 6 sees the right
        // greeting context for THIS user.
        dynamic_variables: dynamicVariables,
      }),
    });
    if (!res.ok) {
      const resp = await res.json();
      let errorMessage = "Failed to retrieve session token";

      // Handle different error response formats
      if (resp?.data && Array.isArray(resp.data) && resp.data.length > 0) {
        errorMessage = resp.data[0].message || errorMessage;
      } else if (resp?.data?.message) {
        errorMessage = resp.data.message;
      } else if (resp?.message) {
        errorMessage = resp.message;
      } else if (resp?.error) {
        errorMessage = resp.error;
      }

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: res.status,
      });
    }
    const data = await res.json();

    session_token = data.data.session_token;
    session_id = data.data.session_id;
  } catch (error) {
    console.error("Error retrieving session token:", error);
    return new Response(
      JSON.stringify({ error: "Failed to retrieve session token" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (!session_token) {
    return new Response(
      JSON.stringify({ error: "Failed to retrieve session token" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  return new Response(JSON.stringify({ session_token, session_id }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
