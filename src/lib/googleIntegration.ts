import crypto from "node:crypto";
import { getSupabaseAdminConfig } from "./supabaseAdmin";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const ACCOUNT_BUCKET = process.env.AIASAP_ACCOUNT_BUCKET || "aiasap-accounts";

export const GOOGLE_INTEGRATION_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.send",
] as const;

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

type StoredGoogleIntegration = {
  provider: "google";
  encryptedTokens: string;
  scopes: string[];
  tokenType: string | null;
  expiresAt: string | null;
  connectedAt: string;
  updatedAt: string;
};

type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionSecret: string;
  stateSecret: string;
};

type GoogleOAuthState = {
  userId: string;
  returnTo: string;
  nonce: string;
  exp: number;
};

function siteOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const origin = request.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function getGoogleOAuthConfig(request: Request): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const encryptionSecret = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  if (!clientId || !clientSecret || !encryptionSecret) return null;

  return {
    clientId,
    clientSecret,
    redirectUri:
      process.env.GOOGLE_OAUTH_REDIRECT_URI ||
      `${siteOrigin(request)}/api/integrations/google/callback`,
    encryptionSecret,
    stateSecret:
      process.env.INTEGRATION_STATE_SECRET ||
      encryptionSecret ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      clientSecret,
  };
}

export function googleIntegrationMissingConfig() {
  return {
    googleClientId: !process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: !process.env.GOOGLE_CLIENT_SECRET,
    integrationTokenEncryptionKey: !process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY,
  };
}

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="), "base64");
}

function signState(payload: string, secret: string): string {
  return base64UrlEncode(
    crypto.createHmac("sha256", secret).update(payload).digest(),
  );
}

export function createGoogleOAuthState(
  config: GoogleOAuthConfig,
  userId: string,
  returnTo = "/",
): string {
  const state: GoogleOAuthState = {
    userId,
    returnTo: returnTo.startsWith("/") ? returnTo : "/",
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + 10 * 60 * 1000,
  };
  const payload = base64UrlEncode(JSON.stringify(state));
  return `${payload}.${signState(payload, config.stateSecret)}`;
}

export function parseGoogleOAuthState(
  config: GoogleOAuthConfig,
  rawState: string | null,
): GoogleOAuthState | null {
  if (!rawState) return null;
  const [payload, signature] = rawState.split(".");
  if (!payload || !signature) return null;
  const expected = signState(payload, config.stateSecret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return null;
  }
  try {
    const state = JSON.parse(base64UrlDecode(payload).toString("utf8")) as Partial<GoogleOAuthState>;
    if (
      typeof state.userId !== "string" ||
      typeof state.returnTo !== "string" ||
      typeof state.exp !== "number" ||
      state.exp < Date.now()
    ) {
      return null;
    }
    return {
      userId: state.userId,
      returnTo: state.returnTo.startsWith("/") ? state.returnTo : "/",
      nonce: typeof state.nonce === "string" ? state.nonce : "",
      exp: state.exp,
    };
  } catch {
    return null;
  }
}

export function buildGoogleAuthorizationUrl(
  config: GoogleOAuthConfig,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_INTEGRATION_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

function encryptionKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptJson(secret: string, value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    base64UrlEncode(iv),
    base64UrlEncode(tag),
    base64UrlEncode(ciphertext),
  ].join(".");
}

function integrationStoragePath(userId: string): string {
  return `${ACCOUNT_BUCKET}/${encodeURI(`users/${userId}/integrations/google.json`)}`;
}

async function putIntegrationJson(userId: string, value: StoredGoogleIntegration) {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const res = await fetch(
    `${url}/storage/v1/object/${integrationStoragePath(userId)}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        "x-upsert": "true",
      },
      body: JSON.stringify(value),
    },
  );
  if (!res.ok) {
    throw new Error(`google integration storage write failed (${res.status})`);
  }
}

export async function loadGoogleIntegrationStatus(userId: string): Promise<{
  connected: boolean;
  scopes: string[];
  expiresAt: string | null;
  updatedAt: string | null;
}> {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const res = await fetch(
    `${url}/storage/v1/object/${integrationStoragePath(userId)}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );
  if (res.status === 404) {
    return { connected: false, scopes: [], expiresAt: null, updatedAt: null };
  }
  if (!res.ok) throw new Error(`google integration storage read failed (${res.status})`);
  const stored = (await res.json()) as Partial<StoredGoogleIntegration>;
  return {
    connected: Boolean(stored.encryptedTokens),
    scopes: Array.isArray(stored.scopes)
      ? stored.scopes.filter((scope): scope is string => typeof scope === "string")
      : [],
    expiresAt: typeof stored.expiresAt === "string" ? stored.expiresAt : null,
    updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : null,
  };
}

export async function exchangeGoogleAuthorizationCode(
  config: GoogleOAuthConfig,
  code: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await response.json().catch(() => null)) as GoogleTokenResponse | null;
  if (!response.ok || !data?.access_token) {
    throw new Error(`google token exchange failed (${response.status})`);
  }
  return data;
}

export async function saveGoogleTokenResponse(
  config: GoogleOAuthConfig,
  userId: string,
  tokenResponse: GoogleTokenResponse,
) {
  const now = new Date().toISOString();
  const expiresAt =
    typeof tokenResponse.expires_in === "number"
      ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
      : null;
  const scopes =
    typeof tokenResponse.scope === "string" && tokenResponse.scope.trim()
      ? tokenResponse.scope.split(/\s+/)
      : [...GOOGLE_INTEGRATION_SCOPES];

  await putIntegrationJson(userId, {
    provider: "google",
    encryptedTokens: encryptJson(config.encryptionSecret, tokenResponse),
    scopes,
    tokenType: tokenResponse.token_type ?? null,
    expiresAt,
    connectedAt: now,
    updatedAt: now,
  });
}
