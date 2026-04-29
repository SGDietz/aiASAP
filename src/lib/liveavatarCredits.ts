import { createHash } from "node:crypto";
import { getSupabaseAdminConfig } from "./supabaseAdmin";

const SUCCESS_CODE = 1000;
const DEFAULT_DAILY_CREDIT_LIMIT = 5_000;
const DEFAULT_CREDITS_PER_MINUTE = 2;
const DEFAULT_MAX_SESSION_MINUTES = 20;
const ACCOUNT_BUCKET = process.env.AIASAP_ACCOUNT_BUCKET || "aiasap-accounts";
const CREDIT_STORAGE_PREFIX = "system/liveavatar-credits";

type UpstashOk = { result: unknown };
type UpstashErr = { error: string };
type PipelineRow = UpstashOk | UpstashErr;
type CreditDayRecord = { credits?: unknown; updatedAt?: string };
type CreditSessionRecord = { t?: unknown; countedAt?: string };
type CreditStorageListItem = { name?: unknown };

function assertUpstashRow(row: PipelineRow): unknown {
  if ("error" in row && row.error) throw new Error(row.error);
  return (row as UpstashOk).result;
}

/** Single command: POST base URL with body `["CMD", ...args]`. */
async function redisCmd(command: (string | number)[]): Promise<unknown> {
  const base = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) throw new Error("Upstash Redis env not configured");
  const res = await fetch(base, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Upstash ${res.status}: ${t}`);
  }
  const json = (await res.json()) as PipelineRow;
  return assertUpstashRow(json);
}

/** Pipeline: POST `{base}/pipeline` with 2D command array. */
async function upstashPipeline(
  commands: (string | number)[][],
): Promise<unknown[]> {
  const base = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) throw new Error("Upstash Redis env not configured");
  const res = await fetch(`${base}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(commands),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Upstash ${res.status}: ${t}`);
  }
  const json = (await res.json()) as PipelineRow[];
  return json.map((row) => assertUpstashRow(row));
}

let redisConfigured: boolean | undefined;
let supabaseConfigured: boolean | undefined;

function isRedisConfigured(): boolean {
  if (redisConfigured !== undefined) return redisConfigured;
  const base = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  redisConfigured = Boolean(base && token);
  return redisConfigured;
}

function isSupabaseConfigured(): boolean {
  if (supabaseConfigured !== undefined) return supabaseConfigured;
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  supabaseConfigured = Boolean(url && serviceRoleKey);
  return supabaseConfigured;
}

function supabaseHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

function storageObjectPath(path: string): string {
  return `${ACCOUNT_BUCKET}/${encodeURI(`${CREDIT_STORAGE_PREFIX}/${path}`)}`;
}

async function getCreditJson<T>(path: string): Promise<T | null> {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const res = await fetch(`${url}/storage/v1/object/${storageObjectPath(path)}`, {
    headers: supabaseHeaders(serviceRoleKey),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 400 && text.includes('"statusCode":"404"')) return null;
    throw new Error(`credit storage read failed (${res.status})`);
  }
  return (await res.json()) as T;
}

async function putCreditJson(path: string, value: unknown): Promise<void> {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const res = await fetch(`${url}/storage/v1/object/${storageObjectPath(path)}`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(serviceRoleKey),
      "x-upsert": "true",
    },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`credit storage write failed (${res.status})`);
}

async function deleteCreditJson(path: string): Promise<void> {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const res = await fetch(`${url}/storage/v1/object/${ACCOUNT_BUCKET}`, {
    method: "DELETE",
    headers: supabaseHeaders(serviceRoleKey),
    body: JSON.stringify({ prefixes: [`${CREDIT_STORAGE_PREFIX}/${path}`] }),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`credit storage delete failed (${res.status})`);
  }
}

async function listCreditJson(prefix: string): Promise<CreditStorageListItem[]> {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  const res = await fetch(`${url}/storage/v1/object/list/${ACCOUNT_BUCKET}`, {
    method: "POST",
    headers: supabaseHeaders(serviceRoleKey),
    body: JSON.stringify({
      prefix: `${CREDIT_STORAGE_PREFIX}/${prefix}`,
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    }),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`credit storage list failed (${res.status})`);
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as CreditStorageListItem[]) : [];
}

export function isLiveAvatarCreditLimitEnabled(): boolean {
  if (process.env.LIVEAVATAR_CREDIT_LIMIT_DISABLED === "1") return false;
  return isRedisConfigured() || isSupabaseConfigured();
}

export function getDailyCreditLimit(): number {
  const v = process.env.LIVEAVATAR_DAILY_CREDIT_LIMIT;
  if (v === undefined || v === "") return DEFAULT_DAILY_CREDIT_LIMIT;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_DAILY_CREDIT_LIMIT;
}

export function getCreditsPerMinute(): number {
  const v = process.env.LIVEAVATAR_CREDITS_PER_MINUTE;
  if (v === undefined || v === "") return DEFAULT_CREDITS_PER_MINUTE;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CREDITS_PER_MINUTE;
}

export function getMaxSessionMinutes(): number {
  const v = process.env.LIVEAVATAR_MAX_SESSION_MINUTES;
  if (v === undefined || v === "") return DEFAULT_MAX_SESSION_MINUTES;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : DEFAULT_MAX_SESSION_MINUTES;
}

export const OUT_OF_CREDITS_MESSAGE =
  "Today's usage limit has been reached. Please try again tomorrow.";

export function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sessionTokenFromAuthHeader(
  auth: string | null,
): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  const t = auth.slice(7).trim();
  return t || null;
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function utcDayKeyFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function creditsForSession(started: number, now = Date.now()): number {
  const maxMs = getMaxSessionMinutes() * 60_000;
  const elapsedMs = Math.max(0, Math.min(now - started, maxMs));
  const minutes = Math.max(1, Math.ceil(elapsedMs / 60_000));
  return minutes * getCreditsPerMinute();
}

export function isLiveAvatarSuccessPayload(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { code?: number }).code === SUCCESS_CODE
  );
}

async function addSupabaseCredits(dayKey: string, credits: number): Promise<void> {
  if (credits <= 0) return;
  const dayPath = `days/${dayKey}.json`;
  const day = await getCreditJson<CreditDayRecord>(dayPath);
  const used = Number(day?.credits ?? 0);
  await putCreditJson(dayPath, {
    credits: (Number.isFinite(used) ? used : 0) + credits,
    updatedAt: new Date().toISOString(),
  });
}

async function listSupabaseSessionRecords(): Promise<
  { name: string; record: CreditSessionRecord }[]
> {
  const items = await listCreditJson("sessions");
  const records: { name: string; record: CreditSessionRecord }[] = [];
  for (const item of items) {
    if (typeof item.name !== "string" || !item.name) continue;
    const record = await getCreditJson<CreditSessionRecord>(
      `sessions/${item.name}`,
    );
    if (record) records.push({ name: item.name, record });
  }
  return records;
}

async function sweepExpiredSupabaseSessions(): Promise<void> {
  if (isRedisConfigured() || !isSupabaseConfigured()) return;
  const now = Date.now();
  const maxMs = getMaxSessionMinutes() * 60_000;
  const sessions = await listSupabaseSessionRecords();
  for (const { name, record } of sessions) {
    if (record.countedAt) continue;
    const started = Number(record.t);
    if (!Number.isFinite(started) || now - started < maxMs) continue;
    const credits = creditsForSession(started, now);
    await addSupabaseCredits(utcDayKeyFromMs(started), credits);
    await putCreditJson(`sessions/${name}`, {
      ...record,
      countedAt: new Date().toISOString(),
      credits,
    });
    await deleteCreditJson(`sessions/${name}`).catch(() => {});
  }
}

async function getOpenSupabaseCreditsToday(): Promise<number> {
  if (isRedisConfigured() || !isSupabaseConfigured()) return 0;
  const today = utcDayKey();
  const now = Date.now();
  const sessions = await listSupabaseSessionRecords();
  return sessions.reduce((total, { record }) => {
    if (record.countedAt) return total;
    const started = Number(record.t);
    if (!Number.isFinite(started) || utcDayKeyFromMs(started) !== today) {
      return total;
    }
    return total + creditsForSession(started, now);
  }, 0);
}

export async function getCreditsUsedToday(): Promise<number> {
  if (isRedisConfigured()) {
    const key = `la:credits:${utcDayKey()}`;
    const v = await redisCmd(["GET", key]);
    if (v === null || v === undefined) return 0;
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    return Number.isFinite(n) ? n : 0;
  }
  if (!isSupabaseConfigured()) return 0;
  await sweepExpiredSupabaseSessions();
  const day = await getCreditJson<CreditDayRecord>(`days/${utcDayKey()}.json`);
  const n = Number(day?.credits ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function assertCanMintSessionToken(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  if (!isLiveAvatarCreditLimitEnabled()) return { ok: true };
  try {
    const used = await getCreditsUsedToday();
    const open = await getOpenSupabaseCreditsToday();
    const limit = getDailyCreditLimit();
    if (used + open >= limit)
      return { ok: false, message: OUT_OF_CREDITS_MESSAGE };
    return { ok: true };
  } catch {
    return {
      ok: false,
      message:
        "Usage limit could not be verified. Please try again in a few minutes.",
    };
  }
}

export async function recordSessionStreamStarted(
  sessionToken: string,
): Promise<void> {
  try {
    if (!isLiveAvatarCreditLimitEnabled())
      return;
    const key = `la:ses:${hashSessionToken(sessionToken)}`;
    const payload = { t: Date.now() };
    if (isRedisConfigured()) {
      await redisCmd(["SET", key, JSON.stringify(payload), "EX", 172800]);
      return;
    }
    await putCreditJson(`sessions/${key}.json`, payload);
  } catch (e) {
    console.error("liveavatarCredits: recordSessionStreamStarted", e);
  }
}

export async function recordSessionStreamStopped(
  sessionToken: string,
): Promise<void> {
  try {
    if (!isLiveAvatarCreditLimitEnabled())
      return;
    const key = `la:ses:${hashSessionToken(sessionToken)}`;
    const raw = isRedisConfigured()
      ? await redisCmd(["GET", key])
      : await getCreditJson<CreditSessionRecord>(`sessions/${key}.json`);
    if (isRedisConfigured()) await redisCmd(["DEL", key]);
    if (raw == null || (typeof raw === "object" && "countedAt" in raw && raw.countedAt))
      return;
    const parsed =
      typeof raw === "string" ? (JSON.parse(raw) as CreditSessionRecord) : raw;
    const started = Number((parsed as CreditSessionRecord).t);
    if (!Number.isFinite(started)) return;
    const credits = creditsForSession(started);
    if (isRedisConfigured()) {
      const dayKey = `la:credits:${utcDayKey()}`;
      await upstashPipeline([
        ["INCRBY", dayKey, credits],
        ["EXPIRE", dayKey, 4 * 86_400],
      ]);
      return;
    }
    await addSupabaseCredits(utcDayKeyFromMs(started), credits);
    await putCreditJson(`sessions/${key}.json`, {
      ...(parsed as CreditSessionRecord),
      countedAt: new Date().toISOString(),
      credits,
    });
    await deleteCreditJson(`sessions/${key}.json`).catch(() => {});
  } catch (e) {
    console.error("liveavatarCredits: recordSessionStreamStopped", e);
  }
}
