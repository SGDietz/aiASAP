/**
 * PROOF THAT SOMEBODY SAID YES TO BEING RECORDED.
 *
 * The ledger refuses to start work questions until the record notice has been
 * accepted - that is deliberate and it is the right default. But nothing in
 * the app was writing consent down, so `noticeAccepted` could never become
 * true and the whisper would have told 6 "do not start a work question"
 * forever. The interview would have been permanently stuck one step before it
 * began. This is the missing half.
 *
 * NOTICE VERSION MATTERS. When the wording of the spoken notice changes, what
 * somebody agreed to changes with it. "They consented" means nothing unless we
 * know WHICH notice they heard, so every row carries it.
 *
 * A RECORDED NO IS AS IMPORTANT AS A YES. Declines are stored too - that is
 * what stops us putting somebody on a public page by mistake later.
 */

import { getSupabaseAdminConfig } from "../supabaseAdmin";

/** The wording of the spoken notice these rows refer to. Bump when it changes. */
export const NOTICE_VERSION = "voice-notice-v1";

/**
 * Has this person accepted the record notice?
 *
 * Reads the NEWEST row, not any row: somebody who agreed and later withdrew
 * has withdrawn, and an "any granted row" check would quietly keep recording
 * them after they said stop.
 */
export async function hasVoiceConsent(email: string): Promise<boolean> {
  if (!email) return false;
  let url: string;
  let serviceRoleKey: string;
  try {
    ({ url, serviceRoleKey } = getSupabaseAdminConfig());
  } catch {
    return false;
  }

  try {
    const res = await fetch(
      `${url}/rest/v1/voice_consents?account_email=eq.${encodeURIComponent(email)}` +
        `&select=granted,said_at&order=said_at.desc&limit=1`,
      {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      },
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as Array<{ granted?: boolean }>;
    return Array.isArray(rows) && rows.length > 0 && rows[0]?.granted === true;
  } catch {
    // Unreachable means unknown, and unknown must read as "not yet". Failing
    // open here would start recording somebody on a database hiccup.
    return false;
  }
}

/**
 * Write down what they said. Best-effort, never throws - but note this is the
 * one write in the interview path where a silent failure has a real cost, so
 * it returns whether it landed and the caller logs it.
 */
export async function recordVoiceConsent(args: {
  email: string;
  granted: boolean;
  spokenText?: string | null;
  sessionId?: string | null;
  utteranceId?: string | null;
}): Promise<boolean> {
  if (!args.email) return false;
  let url: string;
  let serviceRoleKey: string;
  try {
    ({ url, serviceRoleKey } = getSupabaseAdminConfig());
  } catch {
    return false;
  }

  try {
    const res = await fetch(`${url}/rest/v1/voice_consents`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        account_email: args.email,
        granted: args.granted,
        notice_version: NOTICE_VERSION,
        // Their actual words, so a later dispute is settled by what they said
        // and not by our summary of it.
        spoken_text: args.spokenText ? args.spokenText.slice(0, 2000) : null,
        session_id: args.sessionId ?? null,
        utterance_id: args.utteranceId ?? null,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
