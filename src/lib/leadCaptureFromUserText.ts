import {
  MAX_TRANSCRIPTION_TEXT_CHARS,
  truncateUtf8String,
} from "./apiRouteSecurity";
import {
  detectFollowUpIntent,
  extractContactDetails,
  isGarbageNameCandidate,
} from "./contactExtraction";
import { getSupabaseAdminConfig } from "./supabaseAdmin";
import { normalizeTesterLabel } from "./testerAttribution";

export type LeadSessionRow = {
  session_id: string;
  consent_status: "unknown" | "accepted" | "declined";
  full_name: string | null;
  email: string | null;
  phone: string | null;
  last_prompted_field: string | null;
  last_prompted_at: string | null;
};

export type LeadCaptureResult = {
  extracted: {
    email: string | null;
    phone: string | null;
    full_name: string | null;
    consent_status: LeadSessionRow["consent_status"];
  };
  assistantPrompt: string | null;
  shouldSkipVision: boolean;
};

function supabaseHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function getLeadSession(
  url: string,
  serviceRoleKey: string,
  sessionId: string,
): Promise<LeadSessionRow | null> {
  const endpoint = `${url}/rest/v1/lead_sessions?session_id=eq.${encodeURIComponent(
    sessionId,
  )}&select=session_id,consent_status,full_name,email,phone,last_prompted_field,last_prompted_at&limit=1`;
  const res = await fetch(endpoint, {
    method: "GET",
    headers: supabaseHeaders(serviceRoleKey),
  });
  if (!res.ok) {
    throw new Error(`lead_sessions read failed (${res.status})`);
  }
  const data = (await res.json()) as LeadSessionRow[];
  return data[0] ?? null;
}

async function insertTranscriptEvent(
  url: string,
  serviceRoleKey: string,
  payload: Record<string, unknown>,
) {
  const res = await fetch(`${url}/rest/v1/transcript_events`, {
    method: "POST",
    headers: supabaseHeaders(serviceRoleKey),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`transcript_events insert failed (${res.status})`);
  }
}

type ContactEntityRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  source_text: string | null;
  created_at?: string;
};

function appendSourceText(prev: string | null, next: string): string {
  const n = next.trim();
  if (!n) return prev?.trim() ?? "";
  if (!prev?.trim()) return n;
  if (prev.includes(n)) return prev.trim();
  return `${prev.trim()}\n---\n${n}`;
}

function pickScalar(prev: string | null, next: string | null): string | null {
  const t = next?.trim();
  if (t) return t;
  return prev?.trim() ?? null;
}

/**
 * Observational transcripts never choose a canonical email. Preserve an
 * already-authoritative value, if one exists, and ignore every incoming
 * provider/browser transcript candidate. The signup machine plus account/start
 * owns confirmation and deliberate correction.
 */
export function chooseStableLeadEmail(
  previous: string | null,
  incoming: string | null,
): string | null {
  const current = previous?.trim().toLowerCase() ?? "";
  if (current) return current;
  void incoming;
  return null;
}

function pickBetterFullName(prev: string | null, next: string | null): string | null {
  const n = next?.trim() ?? "";
  if (!n || isGarbageNameCandidate(n)) return prev?.trim() ?? null;
  const p = prev?.trim() ?? "";
  if (!p || isGarbageNameCandidate(p)) return n;
  if (n.length > p.length && n.split(/\s+/).length >= p.split(/\s+/).length) {
    return n;
  }
  return p;
}

/**
 * One consolidated row per session: merge new extraction with any existing row(s).
 */
async function upsertMergedContactEntity(
  url: string,
  serviceRoleKey: string,
  sessionId: string,
  partial: {
    full_name: string | null;
    phone: string | null;
    source_text: string;
    tester_label: string | null;
  },
) {
  const listRes = await fetch(
    `${url}/rest/v1/contact_entities?session_id=eq.${encodeURIComponent(sessionId)}&select=id,full_name,email,phone,source_text,created_at&order=created_at.asc`,
    {
      method: "GET",
      headers: supabaseHeaders(serviceRoleKey),
    },
  );
  if (!listRes.ok) {
    throw new Error(`contact_entities list failed (${listRes.status})`);
  }
  const rows = (await listRes.json()) as ContactEntityRow[];

  let fullName: string | null = null;
  let phone: string | null = null;
  let sourceText: string | null = null;

  for (const r of rows) {
    fullName = pickBetterFullName(fullName, r.full_name);
    phone = pickScalar(phone, r.phone);
    sourceText = appendSourceText(sourceText, r.source_text ?? "");
  }

  fullName = pickBetterFullName(fullName, partial.full_name);
  if (partial.phone?.trim()) phone = partial.phone.trim();
  sourceText = appendSourceText(sourceText, partial.source_text);

  const headersPatch = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };

  if (rows.length === 0) {
    const res = await fetch(`${url}/rest/v1/contact_entities`, {
      method: "POST",
      headers: supabaseHeaders(serviceRoleKey),
      body: JSON.stringify({
        session_id: sessionId,
        full_name: fullName,
        phone,
        source_text: sourceText || null,
        ...(partial.tester_label ? { tester_label: partial.tester_label } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`contact_entities insert failed (${res.status})`);
    }
    return;
  }

  // Never delete or overwrite a row carrying an existing canonical email.
  // Observational capture owns only name/phone/source fields.
  const keepRow = rows.find((row) => Boolean(row.email)) ?? rows[0];
  const keepId = keepRow.id;
  const patchRes = await fetch(
    `${url}/rest/v1/contact_entities?id=eq.${encodeURIComponent(keepId)}`,
    {
      method: "PATCH",
      headers: headersPatch,
      body: JSON.stringify({
        full_name: fullName,
        phone,
        source_text: sourceText || null,
        ...(partial.tester_label ? { tester_label: partial.tester_label } : {}),
      }),
    },
  );
  if (!patchRes.ok) {
    throw new Error(`contact_entities patch failed (${patchRes.status})`);
  }

  for (const row of rows) {
    if (row.id === keepId || row.email) continue;
    const delRes = await fetch(
      `${url}/rest/v1/contact_entities?id=eq.${encodeURIComponent(row.id)}`,
      {
        method: "DELETE",
        headers: headersPatch,
      },
    );
    if (!delRes.ok) {
      throw new Error(`contact_entities delete failed (${delRes.status})`);
    }
  }
}

async function upsertLeadSession(
  url: string,
  serviceRoleKey: string,
  payload: Record<string, unknown>,
) {
  const res = await fetch(
    `${url}/rest/v1/lead_sessions?on_conflict=session_id`,
    {
      method: "POST",
      headers: {
        ...supabaseHeaders(serviceRoleKey),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([payload]),
    },
  );
  if (!res.ok) {
    throw new Error(`lead_sessions upsert failed (${res.status})`);
  }
}

function chooseNextPrompt(
  lead: LeadSessionRow,
  latest: { email: string | null; phone: string | null; fullName: string | null },
): {
  prompt: string | null;
  promptField: string | null;
  shouldSkipVision: boolean;
} {
  const now = Date.now();
  const lastPromptMs = lead.last_prompted_at
    ? new Date(lead.last_prompted_at).getTime()
    : 0;
  const promptCooldownMs = 45_000;
  const inPromptCooldown = lastPromptMs > 0 && now - lastPromptMs < promptCooldownMs;
  if (inPromptCooldown) {
    return { prompt: null, promptField: null, shouldSkipVision: false };
  }

  if (lead.consent_status === "declined") {
    return { prompt: null, promptField: null, shouldSkipVision: false };
  }

  // Deterministic acknowledgement when user just shared contact details.
  // This avoids model replies like "I can't store personal information."
  if (latest.phone || latest.email) {
    const hasName = Boolean(lead.full_name && lead.full_name.trim().length >= 2);
    if (latest.phone && latest.email) {
      return {
        prompt: hasName
          ? "Perfect, I saved your phone number and email."
          : "Perfect, I saved your phone number and email. Could you also share your full name?",
        promptField: hasName ? null : "full_name",
        shouldSkipVision: true,
      };
    }
    if (latest.phone) {
      return {
        prompt: hasName
          ? "Perfect, I saved your phone number."
          : "Perfect, I saved your phone number. Could you also share your full name?",
        promptField: hasName ? null : "full_name",
        shouldSkipVision: true,
      };
    }
    return {
      prompt: hasName
        ? "Perfect, I saved your email."
        : "Perfect, I saved your email. Could you also share your full name?",
      promptField: hasName ? null : "full_name",
      shouldSkipVision: true,
    };
  }

  if (lead.consent_status === "accepted" && !lead.email && !lead.phone) {
    return {
      prompt:
        "What is the best way to reach you, email or phone? You can share whichever you prefer.",
      promptField: "contact_method",
      shouldSkipVision: true,
    };
  }

  if (lead.consent_status === "accepted" && (!lead.full_name || lead.full_name.length < 2)) {
    return {
      prompt: "Thanks. Could you also share your full name?",
      promptField: "full_name",
      shouldSkipVision: true,
    };
  }

  return { prompt: null, promptField: null, shouldSkipVision: false };
}

/**
 * Persist observational lead extraction for one accepted user utterance.
 * Extracted emails are audit evidence only; they never write canonical
 * lead/contact email fields or trigger signup delivery.
 */
export async function persistUserUtteranceLeadCapture(
  sessionId: string,
  rawText: string,
  testerLabelInput?: string | null,
): Promise<LeadCaptureResult> {
  const text = truncateUtf8String(rawText.trim(), MAX_TRANSCRIPTION_TEXT_CHARS);
  const { email, phone, fullName } = extractContactDetails(text);
  const intent = detectFollowUpIntent(text);
  const testerLabel = normalizeTesterLabel(testerLabelInput);
  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  let existingLead: LeadSessionRow | null = null;
  existingLead = await getLeadSession(url, serviceRoleKey, sessionId);

  const currentLead: LeadSessionRow = existingLead ?? {
    session_id: sessionId,
    consent_status: "unknown",
    full_name: null,
    email: null,
    phone: null,
    last_prompted_field: null,
    last_prompted_at: null,
  };

  let consentStatus = currentLead.consent_status;
  if (intent.declined) consentStatus = "declined";
  else if (intent.interested) consentStatus = "accepted";
  if (phone || fullName) consentStatus = "accepted";

  const mergedLead: LeadSessionRow = {
    ...currentLead,
    consent_status: consentStatus,
    full_name: pickBetterFullName(currentLead.full_name, fullName),
    email: chooseStableLeadEmail(currentLead.email, email),
    phone: pickScalar(currentLead.phone, phone),
    last_prompted_field: currentLead.last_prompted_field,
    last_prompted_at: currentLead.last_prompted_at,
  };

  const next = chooseNextPrompt(mergedLead, {
    email: null,
    phone,
    fullName,
  });
  const nowIso = new Date().toISOString();
  if (next.promptField) {
    mergedLead.last_prompted_field = next.promptField;
    mergedLead.last_prompted_at = nowIso;
  }

  await insertTranscriptEvent(url, serviceRoleKey, {
    session_id: sessionId,
    transcript: text,
    extracted_email: email,
    extracted_phone: phone,
    extracted_name: fullName,
    follow_up_intent: intent.interested
      ? "interested"
      : intent.declined
        ? "declined"
        : "neutral",
    ...(testerLabel ? { tester_label: testerLabel } : {}),
  });

  // A transcript-only email candidate has no canonical lead mutation to make.
  // Returning after the append-only audit write also removes the old
  // read-then-upsert race between competing browser/provider interpretations.
  if (!phone && !fullName && !intent.interested && !intent.declined) {
    return {
      extracted: {
        email: mergedLead.email,
        phone: mergedLead.phone,
        full_name: mergedLead.full_name,
        consent_status: mergedLead.consent_status,
      },
      assistantPrompt: null,
      shouldSkipVision: false,
    };
  }

  if (phone || fullName) {
    await upsertMergedContactEntity(url, serviceRoleKey, sessionId, {
      phone,
      full_name: fullName,
      source_text: text,
      tester_label: testerLabel,
    });
  }

  await upsertLeadSession(url, serviceRoleKey, {
    session_id: mergedLead.session_id,
    consent_status: mergedLead.consent_status,
    ...(fullName ? { full_name: mergedLead.full_name } : {}),
    ...(phone ? { phone: mergedLead.phone } : {}),
    ...(next.promptField
      ? {
          last_prompted_field: mergedLead.last_prompted_field,
          last_prompted_at: mergedLead.last_prompted_at,
        }
      : {}),
    updated_at: nowIso,
    ...(testerLabel ? { tester_label: testerLabel } : {}),
  });

  return {
    extracted: {
      email: mergedLead.email,
      phone: mergedLead.phone,
      full_name: mergedLead.full_name,
      consent_status: mergedLead.consent_status,
    },
    assistantPrompt: next.prompt,
    shouldSkipVision: next.shouldSkipVision,
  };
}
