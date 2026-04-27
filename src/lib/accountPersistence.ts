import crypto from "node:crypto";
import { getSupabaseAdminConfig } from "./supabaseAdmin";

export type StoredAssistantList = {
  id: string;
  title: string;
  kind: string;
  items: string[];
  displayStyle: string;
  accentColor: string;
  accentHex?: string;
  accentLabel?: string;
  createdAt: number;
  updatedAt: number;
};

export type AccountUser = {
  id: string;
  email: string;
  full_name: string | null;
};

export type AccountResumeState = {
  activeListId: string | null;
  activeListTitle: string | null;
  isShoppingMode: boolean;
  lastUserText: string | null;
  lastAssistantText: string | null;
  updatedAt: string;
};

type StoredUserProfile = {
  id?: string;
  email?: string;
  full_name?: unknown;
  email_verified_at?: string;
  created_at?: string;
  updated_at?: string;
};

const ACCOUNT_COOKIE = "aiasap_session";
const ACCOUNT_BUCKET = process.env.AIASAP_ACCOUNT_BUCKET || "aiasap-accounts";
const MAX_LISTS = 30;
const MAX_ITEMS_PER_LIST = 100;
const MAX_ITEM_CHARS = 80;
const VALID_LIST_KIND = new Set(["grocery", "shopping", "todo", "custom"]);
const VALID_LIST_STYLE = new Set(["numbered", "bulleted"]);
const VALID_LIST_COLOR = new Set(["amber", "blue", "green", "rose", "purple", "white"]);
const LIST_ITEM_CHATTER_RE =
  /\b(?:i mean|all those|all kinds of|did you|do you|am i|are they|they'?re|they are|what do you mean|ready to check out|check out|not on|put them on|you mean|what are you|what is|what's)\b/i;
const LIST_ITEM_FILLER_RE =
  /^(?:no|nothing|that's all|that is all|anything else|yeah|yep|yes|ok|okay|sure|go ahead|i mean|i guess|all those|it|that|this|them|they|those|these|god|got)$/i;
const LIST_ITEM_VAGUE_RE = /\b(?:stuff|things|thing|whatever|all kinds)\b/i;

function supabaseHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

function cleanStoredListItem(value: unknown): string | null {
  const cleaned = cleanText(value, MAX_ITEM_CHARS)
    ?.replace(
      /^(?:and\s+)?(?:i\s+)?(?:need|want|would like|like|have to get|gotta get|should get|add|put|grab|buy|pick up)\s+/i,
      "",
    )
    .trim();
  if (!cleaned) return null;
  if (/[?]/.test(cleaned)) return null;
  if (LIST_ITEM_CHATTER_RE.test(cleaned)) return null;
  if (LIST_ITEM_FILLER_RE.test(cleaned)) return null;
  if (LIST_ITEM_VAGUE_RE.test(cleaned)) return null;
  if (
    /\b(?:am|are|is|was|were|did|do|does|mean|ready|checkout|check out)\b/i.test(
      cleaned,
    )
  ) {
    return null;
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function normalizeEmail(value: unknown): string | null {
  const email = cleanText(value, 254)?.toLowerCase() ?? null;
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

export function sanitizeAccountFullName(value: unknown): string | null {
  const cleaned = cleanText(value, 80)
    ?.replace(/\b(?:the\s+letter|letter)\s+([a-z])\b/i, "$1")
    .replace(/[.,!?;:]+$/g, "")
    .trim();
  if (!cleaned || /[@\d?]/.test(cleaned)) return null;

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return null;
  if (!words.every((word) => /^[a-z][a-z'.-]*$/i.test(word))) return null;

  return words
    .map((word) =>
      word.length === 1
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

export function newToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getAccountCookieName(): string {
  return ACCOUNT_COOKIE;
}

function accountStoragePath(path: string): string {
  return `${ACCOUNT_BUCKET}/${encodeURI(path)}`;
}

async function putAccountJson(path: string, value: unknown) {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const res = await fetch(`${url}/storage/v1/object/${accountStoragePath(path)}`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(serviceRoleKey),
      "x-upsert": "true",
    },
    body: JSON.stringify(value),
  });
  if (!res.ok) {
    throw new Error(`account storage write failed (${res.status})`);
  }
}

async function getAccountJson<T>(path: string): Promise<T | null> {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const res = await fetch(`${url}/storage/v1/object/${accountStoragePath(path)}`, {
    headers: supabaseHeaders(serviceRoleKey),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`account storage read failed (${res.status})`);
  return (await res.json()) as T;
}

function emailHash(email: string): string {
  return crypto.createHash("sha256").update(email.toLowerCase()).digest("hex");
}

export function parseCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
  }
  return null;
}

export function sanitizeAssistantLists(value: unknown): StoredAssistantList[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_LISTS).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const list = raw as Record<string, unknown>;
    const id = cleanText(list.id, 80);
    const title = cleanText(list.title, 120);
    if (!id || !title) return [];
    const kind = cleanText(list.kind, 20) ?? "custom";
    const displayStyle = cleanText(list.displayStyle, 20) ?? "numbered";
    const accentColor = cleanText(list.accentColor, 20) ?? "amber";
    const accentHex = cleanText(list.accentHex, 20);
    const accentLabel = cleanText(list.accentLabel, 40);
    const createdAt =
      typeof list.createdAt === "number" && Number.isFinite(list.createdAt)
        ? list.createdAt
        : Date.now();
    const updatedAt =
      typeof list.updatedAt === "number" && Number.isFinite(list.updatedAt)
        ? list.updatedAt
        : Date.now();
    const rawItems = Array.isArray(list.items) ? list.items : [];
    const seenItems = new Set<string>();
    const items = rawItems
      .map(cleanStoredListItem)
      .filter((item): item is string => Boolean(item))
      .filter((item) => {
        const key = item.toLowerCase();
        if (seenItems.has(key)) return false;
        seenItems.add(key);
        return true;
      })
      .slice(0, MAX_ITEMS_PER_LIST);
    return [
      {
        id,
        title,
        kind: VALID_LIST_KIND.has(kind) ? kind : "custom",
        items,
        displayStyle: VALID_LIST_STYLE.has(displayStyle)
          ? displayStyle
          : "numbered",
        accentColor: VALID_LIST_COLOR.has(accentColor) ? accentColor : "amber",
        accentHex: accentHex && /^#[0-9a-f]{6}$/i.test(accentHex) ? accentHex : undefined,
        accentLabel: accentLabel ?? undefined,
        createdAt,
        updatedAt,
      },
    ];
  });
}

export function sanitizeAccountResumeState(value: unknown): AccountResumeState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const updatedAt = cleanText(raw.updatedAt, 40) ?? new Date().toISOString();
  return {
    activeListId: cleanText(raw.activeListId, 80),
    activeListTitle: cleanText(raw.activeListTitle, 120),
    isShoppingMode: raw.isShoppingMode === true,
    lastUserText: cleanText(raw.lastUserText, 280),
    lastAssistantText: cleanText(raw.lastAssistantText, 280),
    updatedAt,
  };
}

export async function sendAccountEmail(args: {
  to: string;
  verificationUrl: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from =
    process.env.ACCOUNT_LINK_FROM_EMAIL ||
    process.env.BUG_REPORT_FROM_EMAIL ||
    "aiASAP <accounts@aiasap.ai>";
  const text = [
    "Click this link to finish setting up your aiASAP account:",
    "",
    args.verificationUrl,
    "",
    "After that, 6 can remember your lists and pick up the same task where you left off.",
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; color: #171717; line-height: 1.5; max-width: 560px;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">Finish setting up your aiASAP account</h1>
      <p style="margin: 0 0 18px;">Tap the button below to finish setting up your account with 6.</p>
      <p style="margin: 0 0 22px;">
        <a href="${args.verificationUrl}" style="display: inline-block; background: #171717; color: #ffffff; text-decoration: none; font-weight: 700; padding: 12px 18px; border-radius: 8px;">
          Finish Account Setup
        </a>
      </p>
      <p style="margin: 0 0 10px;">After that, 6 can remember your lists and pick up the same task where you left off.</p>
      <p style="font-size: 13px; color: #666666; margin: 18px 0 0;">
        If the button does not open, copy and paste this link:<br />
        <a href="${args.verificationUrl}" style="color: #8a5a1f;">${args.verificationUrl}</a>
      </p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "aiASAP/1.0",
      },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: "Finish setting up your aiASAP account",
        text,
        html,
      }),
    });
    if (!res.ok) {
      console.error("account email failed:", await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("account email unavailable:", error);
    return false;
  }
}

export async function createPendingAccountLink(args: {
  email: string;
  fullName: string | null;
  tokenHash: string;
  sessionId: string | null;
  lists: StoredAssistantList[];
  resumeState: AccountResumeState | null;
  expiresAt: string;
}) {
  await putAccountJson(`pending/${args.tokenHash}.json`, {
    email: args.email,
    full_name: args.fullName,
    token_hash: args.tokenHash,
    session_id: args.sessionId,
    captured_lists: args.lists,
    resume_state: args.resumeState,
    expires_at: args.expiresAt,
    created_at: new Date().toISOString(),
  });
}

export async function consumePendingAccountLink(token: string): Promise<{
  email: string;
  fullName: string | null;
  lists: StoredAssistantList[];
  resumeState: AccountResumeState | null;
} | null> {
  const tokenHash = hashToken(token);
  const pending = await getAccountJson<{
    email?: string;
    full_name?: unknown;
    captured_lists?: unknown;
    resume_state?: unknown;
    expires_at?: string;
    used_at?: string | null;
  }>(`pending/${tokenHash}.json`);
  if (!pending?.email || pending.used_at) return null;
  if (!pending.expires_at || Date.parse(pending.expires_at) < Date.now()) {
    return null;
  }
  const lists = sanitizeAssistantLists(pending.captured_lists);
  const resumeState = sanitizeAccountResumeState(pending.resume_state);
  const fullName = sanitizeAccountFullName(pending.full_name);
  await putAccountJson(`pending/${tokenHash}.json`, {
    ...pending,
    used_at: new Date().toISOString(),
  });
  return { email: pending.email.toLowerCase(), fullName, lists, resumeState };
}

export async function loadStorageUserProfile(
  userId: string,
  fallbackEmail: string,
): Promise<AccountUser> {
  const profile = await getAccountJson<StoredUserProfile>(
    `users/${userId}/profile.json`,
  );
  const email =
    normalizeEmail(profile?.email) ?? normalizeEmail(fallbackEmail) ?? fallbackEmail;
  return {
    id: userId,
    email,
    full_name: sanitizeAccountFullName(profile?.full_name),
  };
}

export async function saveStorageUserProfile(args: {
  userId: string;
  email: string;
  fullName: unknown;
}): Promise<AccountUser> {
  const now = new Date().toISOString();
  const path = `users/${args.userId}/profile.json`;
  const existing = await getAccountJson<StoredUserProfile>(path);
  const email =
    normalizeEmail(existing?.email) ?? normalizeEmail(args.email) ?? args.email;
  const fullName =
    sanitizeAccountFullName(args.fullName) ??
    sanitizeAccountFullName(existing?.full_name);

  const profile: StoredUserProfile = {
    ...(existing ?? {}),
    id: args.userId,
    email,
    full_name: fullName,
    email_verified_at: existing?.email_verified_at ?? now,
    updated_at: now,
  };
  await putAccountJson(path, profile);
  return { id: args.userId, email, full_name: fullName };
}

export async function createStorageAccountSession(
  email: string,
  fullName?: unknown,
): Promise<{
  user: AccountUser;
  sessionToken: string;
}> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error("Invalid email");
  const id = emailHash(normalizedEmail);
  const sessionToken = newToken();
  const sessionHash = hashToken(sessionToken);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString();
  const existing = await getAccountJson<StoredUserProfile>(
    `users/${id}/profile.json`,
  );
  const user = {
    id,
    email: normalizedEmail,
    full_name:
      sanitizeAccountFullName(fullName) ??
      sanitizeAccountFullName(existing?.full_name),
  };
  await putAccountJson(`users/${id}/profile.json`, {
    ...(existing ?? {}),
    ...user,
    email_verified_at: existing?.email_verified_at ?? now,
    updated_at: now,
  });
  await putAccountJson(`sessions/${sessionHash}.json`, {
    user_id: id,
    email: normalizedEmail,
    expires_at: expiresAt,
    created_at: now,
    last_seen_at: now,
  });
  return { user, sessionToken };
}

export async function getStorageAccountFromSessionToken(
  sessionToken: string | null,
): Promise<AccountUser | null> {
  if (!sessionToken) return null;
  const sessionHash = hashToken(sessionToken);
  const session = await getAccountJson<{
    user_id?: string;
    email?: string;
    expires_at?: string;
  }>(`sessions/${sessionHash}.json`);
  if (!session?.user_id || !session.email || !session.expires_at) return null;
  if (Date.parse(session.expires_at) < Date.now()) return null;
  await putAccountJson(`sessions/${sessionHash}.json`, {
    ...session,
    last_seen_at: new Date().toISOString(),
  });
  return loadStorageUserProfile(session.user_id, session.email);
}

export async function saveStorageUserLists(
  userId: string,
  lists: StoredAssistantList[],
) {
  await putAccountJson(`users/${userId}/lists.json`, {
    lists,
    updated_at: new Date().toISOString(),
  });
}

export async function loadStorageUserLists(
  userId: string,
): Promise<StoredAssistantList[]> {
  const data = await getAccountJson<{ lists?: unknown }>(
    `users/${userId}/lists.json`,
  );
  return sanitizeAssistantLists(data?.lists);
}

export async function saveStorageUserResume(
  userId: string,
  resumeState: AccountResumeState | null,
) {
  if (!resumeState) return;
  await putAccountJson(`users/${userId}/resume.json`, {
    resumeState,
    updated_at: new Date().toISOString(),
  });
}

export async function loadStorageUserResume(
  userId: string,
): Promise<AccountResumeState | null> {
  const data = await getAccountJson<{ resumeState?: unknown }>(
    `users/${userId}/resume.json`,
  );
  return sanitizeAccountResumeState(data?.resumeState);
}

export async function findOrCreateUser(email: string): Promise<AccountUser> {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const headers = supabaseHeaders(serviceRoleKey);
  const readRes = await fetch(
    `${url}/rest/v1/ai_users?email=eq.${encodeURIComponent(email)}&select=id,email,full_name&limit=1`,
    { headers },
  );
  if (!readRes.ok) {
    throw new Error(`ai_users lookup failed (${readRes.status})`);
  }
  const existing = (await readRes.json()) as AccountUser[];
  if (existing[0]) return existing[0];

  const insertRes = await fetch(`${url}/rest/v1/ai_users?select=id,email,full_name`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({
      email,
      email_verified_at: new Date().toISOString(),
    }),
  });
  if (!insertRes.ok) {
    throw new Error(`ai_users insert failed (${insertRes.status})`);
  }
  const inserted = (await insertRes.json()) as AccountUser[];
  if (!inserted[0]) throw new Error("ai_users insert returned no row");
  return inserted[0];
}

export async function saveUserLists(userId: string, lists: StoredAssistantList[]) {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const headers = supabaseHeaders(serviceRoleKey);
  for (const list of lists) {
    const res = await fetch(
      `${url}/rest/v1/assistant_lists?on_conflict=user_id,client_list_id`,
      {
        method: "POST",
        headers: {
          ...headers,
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          user_id: userId,
          client_list_id: list.id,
          title: list.title,
          kind: list.kind,
          items: list.items,
          display_style: list.displayStyle,
          accent_color: list.accentColor,
          created_at_client: new Date(list.createdAt).toISOString(),
          updated_at_client: new Date(list.updatedAt).toISOString(),
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`assistant_lists upsert failed (${res.status})`);
    }
  }
}

export async function loadUserLists(userId: string): Promise<StoredAssistantList[]> {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const res = await fetch(
    `${url}/rest/v1/assistant_lists?user_id=eq.${encodeURIComponent(
      userId,
    )}&select=client_list_id,title,kind,items,display_style,accent_color,created_at_client,updated_at_client&order=updated_at_client.desc`,
    { headers: supabaseHeaders(serviceRoleKey) },
  );
  if (!res.ok) throw new Error(`assistant_lists read failed (${res.status})`);
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.client_list_id ?? ""),
    title: String(row.title ?? "List"),
    kind: String(row.kind ?? "custom"),
    items: Array.isArray(row.items)
      ? row.items.filter((item): item is string => typeof item === "string")
      : [],
    displayStyle: String(row.display_style ?? "numbered"),
    accentColor: String(row.accent_color ?? "amber"),
    createdAt: Date.parse(String(row.created_at_client ?? "")) || Date.now(),
    updatedAt: Date.parse(String(row.updated_at_client ?? "")) || Date.now(),
  }));
}

export async function getUserFromSessionToken(
  sessionToken: string | null,
): Promise<AccountUser | null> {
  if (!sessionToken) return null;
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const headers = supabaseHeaders(serviceRoleKey);
  const tokenHash = hashToken(sessionToken);
  const sessionRes = await fetch(
    `${url}/rest/v1/account_sessions?session_token_hash=eq.${tokenHash}&expires_at=gte.${encodeURIComponent(
      new Date().toISOString(),
    )}&select=id,user_id&limit=1`,
    { headers },
  );
  if (!sessionRes.ok) throw new Error(`account session lookup failed (${sessionRes.status})`);
  const sessions = (await sessionRes.json()) as Array<{ id: string; user_id: string }>;
  const session = sessions[0];
  if (!session) return null;

  await fetch(`${url}/rest/v1/account_sessions?id=eq.${session.id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
  }).catch(() => null);

  const userRes = await fetch(
    `${url}/rest/v1/ai_users?id=eq.${session.user_id}&select=id,email,full_name&limit=1`,
    { headers },
  );
  if (!userRes.ok) throw new Error(`ai_users session user read failed (${userRes.status})`);
  const users = (await userRes.json()) as AccountUser[];
  return users[0] ?? null;
}

export function accountCookieHeader(token: string): string {
  const parts = [
    `${ACCOUNT_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "Max-Age=15552000",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}
