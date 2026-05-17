import crypto from "node:crypto";
import { getSupabaseAdminConfig } from "./supabaseAdmin";

export type SocialPlatform =
  | "x"
  | "youtube"
  | "tiktok"
  | "facebook"
  | "instagram"
  | "threads";
export type SocialOAuthProvider = "x" | "tiktok" | "meta" | "threads" | "youtube";

export type SocialPlatformConfig = {
  id: SocialPlatform;
  label: string;
  handle: string;
  publicUrl: string | null;
  requiredEnv: string[];
  setupNotes: string[];
};

export type SocialConnectionStatus = SocialPlatformConfig & {
  configured: boolean;
  connected: boolean;
  missingEnv: string[];
  updatedAt: string | null;
};

export type SocialDraft = {
  id: string;
  title: string;
  body: string;
  platforms: SocialPlatform[];
  status: "draft" | "queued" | "posted";
  createdAt: string;
  updatedAt: string;
};

const ACCOUNT_BUCKET = process.env.AIASAP_ACCOUNT_BUCKET || "aiasap-accounts";

export const SOCIAL_PLATFORMS: SocialPlatformConfig[] = [
  {
    id: "x",
    label: "X",
    handle: "@aiASAPai",
    publicUrl: "https://x.com/aiASAPai",
    requiredEnv: ["X_CLIENT_ID", "X_CLIENT_SECRET", "INTEGRATION_TOKEN_ENCRYPTION_KEY"],
    setupNotes: [
      "Create an X Developer app with OAuth 2.0 write permissions.",
      "Add this app's callback URL before connecting.",
    ],
  },
  {
    id: "youtube",
    label: "YouTube",
    handle: "aiASAP",
    publicUrl: "https://www.youtube.com/@aiASAP-1",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "INTEGRATION_TOKEN_ENCRYPTION_KEY"],
    setupNotes: [
      "Create an aiASAP Brand Channel under an existing Google account.",
      "Public channel URL: https://www.youtube.com/@aiASAP-1",
      "Studio profile URL: https://studio.youtube.com/channel/UCdYcVn1eBVvRIH4xfbdLAsw/editing/profile",
      "Enable YouTube Data API and OAuth in the Google Cloud project.",
    ],
  },
  {
    id: "tiktok",
    label: "TikTok",
    handle: "@aiasap.ai",
    publicUrl: "https://www.tiktok.com/@aiasap.ai",
    requiredEnv: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "INTEGRATION_TOKEN_ENCRYPTION_KEY"],
    setupNotes: [
      "Create a TikTok Developer app with Content Posting API access.",
      "TikTok may keep posts private until the app is reviewed.",
    ],
  },
  {
    id: "facebook",
    label: "Facebook",
    handle: "aiasapai",
    publicUrl: "https://www.facebook.com/aiasapai",
    requiredEnv: ["META_APP_ID", "META_APP_SECRET", "INTEGRATION_TOKEN_ENCRYPTION_KEY"],
    setupNotes: [
      "Use the aiASAP Facebook Page, not a personal profile.",
      "The same Meta app can cover Facebook and Instagram.",
    ],
  },
  {
    id: "instagram",
    label: "Instagram",
    handle: "@aiasap.ai",
    publicUrl: "https://www.instagram.com/aiasap.ai/",
    requiredEnv: ["META_APP_ID", "META_APP_SECRET", "INTEGRATION_TOKEN_ENCRYPTION_KEY"],
    setupNotes: [
      "Use a Professional/Business Instagram account connected to the Facebook Page.",
      "Meta app review is usually required for real public publishing.",
    ],
  },
  {
    id: "threads",
    label: "Threads",
    handle: "@aiasap.ai",
    publicUrl: "https://www.threads.com/@aiasap.ai",
    requiredEnv: ["THREADS_CLIENT_ID", "THREADS_CLIENT_SECRET", "INTEGRATION_TOKEN_ENCRYPTION_KEY"],
    setupNotes: [
      "Create or update a Meta app with the Threads use case.",
      "Threads uses separate publishing scopes from Instagram/Facebook.",
    ],
  },
];
const SOCIAL_PLATFORM_ORDER_INDEX = new Map(
  SOCIAL_PLATFORMS.map((platform, index) => [platform.id, index]),
);

type SocialTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  scopes?: string;
  token_type?: string;
  open_id?: string;
  [key: string]: unknown;
};

type SocialOAuthConfig = {
  provider: SocialOAuthProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  scopeSeparator: " " | ",";
  encryptionSecret: string;
  stateSecret: string;
};

type SocialOAuthState = {
  provider: SocialOAuthProvider;
  userId: string;
  returnTo: string;
  nonce: string;
  exp: number;
};

type SocialOAuthCookie = SocialOAuthState & {
  codeVerifier: string | null;
};

const SOCIAL_OAUTH_COOKIE = "aiasap_social_oauth";
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

const OAUTH_PROVIDER_PLATFORMS: Record<SocialOAuthProvider, SocialPlatform[]> = {
  x: ["x"],
  youtube: ["youtube"],
  tiktok: ["tiktok"],
  meta: ["facebook", "instagram"],
  threads: ["threads"],
};

function siteOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const origin = request.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function oauthRedirectUri(request: Request, provider: SocialOAuthProvider): string {
  const origin = siteOrigin(request);
  if (provider === "x") return process.env.X_REDIRECT_URI || `${origin}/api/social/x/callback`;
  if (provider === "tiktok") {
    return process.env.TIKTOK_REDIRECT_URI || `${origin}/api/social/tiktok/callback`;
  }
  if (provider === "meta") return process.env.META_REDIRECT_URI || `${origin}/api/social/meta/callback`;
  if (provider === "threads") {
    return process.env.THREADS_REDIRECT_URI || `${origin}/api/social/threads/callback`;
  }
  return process.env.SOCIAL_YOUTUBE_REDIRECT_URI || `${origin}/api/social/youtube/callback`;
}

export function getSocialOAuthCookieName(): string {
  return SOCIAL_OAUTH_COOKIE;
}

export function socialProviderFromPath(value: string): SocialOAuthProvider | null {
  return value === "x" ||
    value === "tiktok" ||
    value === "meta" ||
    value === "threads" ||
    value === "youtube"
    ? value
    : null;
}

export function getSocialOAuthConfig(
  request: Request,
  provider: SocialOAuthProvider,
): SocialOAuthConfig | null {
  const encryptionSecret = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  if (!encryptionSecret) return null;
  const stateSecret =
    process.env.INTEGRATION_STATE_SECRET ||
    encryptionSecret ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!stateSecret) return null;

  if (provider === "x") {
    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return {
      provider,
      clientId,
      clientSecret,
      redirectUri: oauthRedirectUri(request, provider),
      authUrl: "https://twitter.com/i/oauth2/authorize",
      tokenUrl: "https://api.twitter.com/2/oauth2/token",
      scopes: [
        "tweet.read",
        "tweet.write",
        "users.read",
        "dm.read",
        "dm.write",
        "offline.access",
      ],
      scopeSeparator: " ",
      encryptionSecret,
      stateSecret,
    };
  }

  if (provider === "tiktok") {
    const clientId = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;
    return {
      provider,
      clientId,
      clientSecret,
      redirectUri: oauthRedirectUri(request, provider),
      authUrl: "https://www.tiktok.com/v2/auth/authorize/",
      tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
      scopes: ["user.info.basic", "video.list"],
      scopeSeparator: ",",
      encryptionSecret,
      stateSecret,
    };
  }

  if (provider === "meta") {
    const clientId = process.env.META_APP_ID;
    const clientSecret = process.env.META_APP_SECRET;
    if (!clientId || !clientSecret) return null;
    return {
      provider,
      clientId,
      clientSecret,
      redirectUri: oauthRedirectUri(request, provider),
      authUrl: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`,
      tokenUrl: `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
      scopes: [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
        "instagram_basic",
        "instagram_content_publish",
      ],
      scopeSeparator: ",",
      encryptionSecret,
      stateSecret,
    };
  }

  if (provider === "threads") {
    const clientId = process.env.THREADS_CLIENT_ID || process.env.META_APP_ID;
    const clientSecret = process.env.THREADS_CLIENT_SECRET || process.env.META_APP_SECRET;
    if (!clientId || !clientSecret) return null;
    return {
      provider,
      clientId,
      clientSecret,
      redirectUri: oauthRedirectUri(request, provider),
      authUrl: "https://threads.net/oauth/authorize",
      tokenUrl: "https://graph.threads.net/oauth/access_token",
      scopes: ["threads_basic", "threads_content_publish"],
      scopeSeparator: ",",
      encryptionSecret,
      stateSecret,
    };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    provider,
    clientId,
    clientSecret,
    redirectUri: oauthRedirectUri(request, provider),
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    scopeSeparator: " ",
    encryptionSecret,
    stateSecret,
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

function signValue(payload: string, secret: string): string {
  return base64UrlEncode(crypto.createHmac("sha256", secret).update(payload).digest());
}

function signedEncode(value: unknown, secret: string): string {
  const payload = base64UrlEncode(JSON.stringify(value));
  return `${payload}.${signValue(payload, secret)}`;
}

function signedDecode<T>(value: string | null, secret: string): T | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = signValue(payload, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    return JSON.parse(base64UrlDecode(payload).toString("utf8")) as T;
  } catch {
    return null;
  }
}

function sha256Base64Url(value: string): string {
  return base64UrlEncode(crypto.createHash("sha256").update(value).digest());
}

function newPkceVerifier(): string {
  return crypto.randomBytes(48).toString("base64url");
}

function oauthNeedsPkce(provider: SocialOAuthProvider): boolean {
  return provider === "x" || provider === "youtube";
}

export function createSocialOAuthStart(
  config: SocialOAuthConfig,
  userId: string,
  returnTo = "/social",
): { authorizationUrl: string; cookieHeader: string } {
  const codeVerifier = oauthNeedsPkce(config.provider) ? newPkceVerifier() : null;
  const state: SocialOAuthState = {
    provider: config.provider,
    userId,
    returnTo: returnTo.startsWith("/") ? returnTo : "/social",
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + 10 * 60 * 1000,
  };
  const encodedState = signedEncode(state, config.stateSecret);
  const params = new URLSearchParams({
    response_type: "code",
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(config.scopeSeparator),
    state: encodedState,
  });
  if (config.provider === "tiktok") params.set("client_key", config.clientId);
  else params.set("client_id", config.clientId);
  if (codeVerifier) {
    params.set("code_challenge", sha256Base64Url(codeVerifier));
    params.set("code_challenge_method", "S256");
  }
  if (config.provider === "youtube") {
    params.set("access_type", "offline");
    params.set("include_granted_scopes", "true");
    params.set("prompt", "consent");
  }
  const cookieValue = signedEncode({ ...state, codeVerifier }, config.stateSecret);
  return {
    authorizationUrl: `${config.authUrl}?${params.toString()}`,
    cookieHeader: socialOAuthCookieHeader(cookieValue),
  };
}

function socialOAuthCookieHeader(value: string): string {
  const parts = [
    `${SOCIAL_OAUTH_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "Max-Age=900",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearSocialOAuthCookieHeader(): string {
  return `${SOCIAL_OAUTH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
}

export function parseSocialOAuthState(
  config: SocialOAuthConfig,
  rawState: string | null,
  rawCookie: string | null,
): (SocialOAuthState & { codeVerifier: string | null }) | null {
  const state = signedDecode<SocialOAuthState>(rawState, config.stateSecret);
  const cookie = signedDecode<SocialOAuthCookie>(rawCookie, config.stateSecret);
  if (!state || !cookie) return null;
  if (state.provider !== config.provider || cookie.provider !== config.provider) return null;
  if (state.userId !== cookie.userId || state.nonce !== cookie.nonce) return null;
  if (state.exp < Date.now() || cookie.exp < Date.now()) return null;
  return { ...state, codeVerifier: cookie.codeVerifier ?? null };
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
  return [base64UrlEncode(iv), base64UrlEncode(tag), base64UrlEncode(ciphertext)].join(".");
}

export async function exchangeSocialAuthorizationCode(
  config: SocialOAuthConfig,
  code: string,
  codeVerifier: string | null,
): Promise<SocialTokenResponse> {
  const body = new URLSearchParams({
    code,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (config.provider === "x") {
    body.set("client_id", config.clientId);
    if (codeVerifier) body.set("code_verifier", codeVerifier);
    headers.Authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`;
  } else if (config.provider === "tiktok") {
    body.set("client_key", config.clientId);
    body.set("client_secret", config.clientSecret);
  } else {
    body.set("client_id", config.clientId);
    body.set("client_secret", config.clientSecret);
    if (codeVerifier) body.set("code_verifier", codeVerifier);
  }
  const response = await fetch(config.tokenUrl, { method: "POST", headers, body });
  const data = (await response.json().catch(() => null)) as SocialTokenResponse | null;
  if (!response.ok || !data?.access_token) {
    throw new Error(`social token exchange failed for ${config.provider} (${response.status})`);
  }
  return data;
}

export async function saveSocialTokenResponse(
  config: SocialOAuthConfig,
  userId: string,
  tokenResponse: SocialTokenResponse,
) {
  const now = new Date().toISOString();
  const expiresAt =
    typeof tokenResponse.expires_in === "number"
      ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
      : null;
  const scopeValue =
    typeof tokenResponse.scope === "string"
      ? tokenResponse.scope
      : typeof tokenResponse.scopes === "string"
        ? tokenResponse.scopes
        : config.scopes.join(config.scopeSeparator);
  const scopes = scopeValue.split(/[,\s]+/).filter(Boolean);

  await Promise.all(
    OAUTH_PROVIDER_PLATFORMS[config.provider].map((platform) =>
      putJson(integrationPath(userId, platform), {
        provider: config.provider,
        platform,
        encryptedTokens: encryptJson(config.encryptionSecret, tokenResponse),
        scopes,
        tokenType: tokenResponse.token_type ?? null,
        expiresAt,
        connectedAt: now,
        updatedAt: now,
      }),
    ),
  );
}

function supabaseStorageHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

function storagePath(path: string): string {
  return `${ACCOUNT_BUCKET}/${encodeURI(path)}`;
}

async function putJson(path: string, value: unknown) {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const res = await fetch(`${url}/storage/v1/object/${storagePath(path)}`, {
    method: "POST",
    headers: {
      ...supabaseStorageHeaders(serviceRoleKey),
      "x-upsert": "true",
    },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`social storage write failed (${res.status})`);
}

async function getJson<T>(path: string): Promise<T | null> {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const res = await fetch(`${url}/storage/v1/object/${storagePath(path)}`, {
    headers: supabaseStorageHeaders(serviceRoleKey),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`social storage read failed (${res.status})`);
  return (await res.json()) as T;
}

function integrationPath(userId: string, platform: SocialPlatform) {
  return `users/${userId}/social/${platform}.json`;
}

function draftsPath(userId: string) {
  return `users/${userId}/social/drafts.json`;
}

function missingEnv(requiredEnv: string[]) {
  return requiredEnv.filter((key) => !process.env[key]);
}

export async function loadSocialConnectionStatuses(
  userId: string | null,
): Promise<SocialConnectionStatus[]> {
  return Promise.all(
    SOCIAL_PLATFORMS.map(async (platform) => {
      const missing = missingEnv(platform.requiredEnv);
      const stored = userId
        ? await getJson<{ connectedAt?: string; updatedAt?: string; encryptedTokens?: string }>(
            integrationPath(userId, platform.id),
          ).catch(() => null)
        : null;
      return {
        ...platform,
        configured: missing.length === 0,
        connected: Boolean(stored?.encryptedTokens || stored?.connectedAt),
        missingEnv: missing,
        updatedAt: stored?.updatedAt ?? stored?.connectedAt ?? null,
      };
    }),
  );
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function parsePlatforms(value: unknown): SocialPlatform[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set(SOCIAL_PLATFORMS.map((platform) => platform.id));
  return value
    .filter((item): item is SocialPlatform => typeof item === "string" && valid.has(item as SocialPlatform))
    .sort(
      (a, b) =>
        (SOCIAL_PLATFORM_ORDER_INDEX.get(a) ?? 999) -
        (SOCIAL_PLATFORM_ORDER_INDEX.get(b) ?? 999),
    );
}

function sanitizeDraft(raw: unknown): SocialDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = cleanText(value.id, 80);
  const title = cleanText(value.title, 160);
  const body = cleanText(value.body, 2200);
  const platforms = parsePlatforms(value.platforms);
  if (!id || !title || !body || platforms.length === 0) return null;
  const now = new Date().toISOString();
  return {
    id,
    title,
    body,
    platforms,
    status: value.status === "queued" || value.status === "posted" ? value.status : "draft",
    createdAt: cleanText(value.createdAt, 40) || now,
    updatedAt: cleanText(value.updatedAt, 40) || now,
  };
}

export async function loadSocialDrafts(userId: string): Promise<SocialDraft[]> {
  const data = await getJson<{ drafts?: unknown }>(draftsPath(userId));
  return Array.isArray(data?.drafts)
    ? data.drafts.flatMap((draft) => {
        const cleaned = sanitizeDraft(draft);
        return cleaned ? [cleaned] : [];
      })
    : [];
}

export async function createSocialDraft(
  userId: string,
  input: { title?: unknown; body?: unknown; platforms?: unknown },
): Promise<SocialDraft> {
  const title = cleanText(input.title, 160);
  const body = cleanText(input.body, 2200);
  const platforms = parsePlatforms(input.platforms);
  if (!title || !body || platforms.length === 0) {
    throw new Error("title, body, and at least one platform are required");
  }
  const now = new Date().toISOString();
  const draft: SocialDraft = {
    id: crypto.randomUUID(),
    title,
    body,
    platforms,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
  const drafts = await loadSocialDrafts(userId).catch(() => []);
  await putJson(draftsPath(userId), {
    drafts: [draft, ...drafts].slice(0, 100),
    updatedAt: now,
  });
  return draft;
}
