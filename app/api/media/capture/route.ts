import {
  assertAllowedOrigin,
  isAllowedImageMime,
  truncateUtf8String,
} from "../../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../../src/lib/rateLimit";
import {
  getAccountCookieName,
  getStorageAccountFromSessionToken,
  parseCookie,
} from "../../../../src/lib/accountPersistence";
import { getSupabaseAdminConfig } from "../../../../src/lib/supabaseAdmin";

const BUCKET = process.env.AIASAP_MEDIA_BUCKET || "aiasap-media";
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const MAX_TEXT_FIELD = 1000;

const VALID_SOURCES = new Set([
  "camera_snapshot",
  "video_recording",
  "gallery_image",
  "gallery_video",
  "go_live_frame",
]);

const VIDEO_MIMES = new Set([
  "video/webm",
  "video/mp4",
  "video/quicktime",
  "video/ogg",
]);

function extForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("quicktime")) return "mov";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function supabaseHeaders(serviceRoleKey: string, contentType: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": contentType,
  };
}

async function uploadObject(args: {
  url: string;
  serviceRoleKey: string;
  path: string;
  contentType: string;
  body: BodyInit;
}) {
  return fetch(`${args.url}/storage/v1/object/${BUCKET}/${encodeURI(args.path)}`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(args.serviceRoleKey, args.contentType),
      "x-upsert": "false",
    },
    body: args.body,
  });
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  let url: string;
  let serviceRoleKey: string;
  try {
    ({ url, serviceRoleKey } = getSupabaseAdminConfig());
  } catch {
    return jsonError("Supabase not configured", 500);
  }

  const accountToken = parseCookie(request, getAccountCookieName());
  const accountUser = await getStorageAccountFromSessionToken(accountToken);
  const requireAccount =
    process.env.AIASAP_REQUIRE_ACCOUNT_FOR_MEDIA === "true" ||
    process.env.AIASAP_ALLOW_ANON_MEDIA_CAPTURE === "false";
  if (!accountUser && requireAccount) {
    return jsonError("Account required", 401);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Invalid form data", 400);
  }

  const fileOrBlob = form.get("file");
  const source = (form.get("source") as string | null)?.trim() ?? "";
  const sessionId = (form.get("session_id") as string | null)?.trim() ?? "";
  const geminiAnalysisRaw = (form.get("gemini_analysis") as string | null) ?? "";
  const problemRaw = (form.get("problem") as string | null) ?? "";
  const errorRaw = (form.get("error") as string | null) ?? "";

  if (!fileOrBlob) return jsonError("file is required", 400);
  if (!VALID_SOURCES.has(source)) return jsonError("invalid source", 400);

  const value = fileOrBlob as unknown;
  const file: File | null =
    fileOrBlob instanceof File
      ? fileOrBlob
      : value instanceof Blob
        ? new File([value], "media.bin", { type: value.type })
        : null;
  if (!file) return jsonError("file is required", 400);
  if (file.size === 0) return jsonError("file is empty", 400);
  if (file.size > MAX_MEDIA_BYTES) return jsonError("file too large", 400);

  const mime = (file.type || "application/octet-stream").split(";")[0].trim();
  const isImage = isAllowedImageMime(mime);
  const isVideo = VIDEO_MIMES.has(mime);
  if (!isImage && !isVideo) return jsonError("unsupported mime", 400);

  const imageSource =
    source === "camera_snapshot" ||
    source === "gallery_image" ||
    source === "go_live_frame";
  const videoSource = source === "video_recording" || source === "gallery_video";
  if (imageSource && !isImage) return jsonError("source/mime mismatch", 400);
  if (videoSource && !isVideo) return jsonError("source/mime mismatch", 400);

  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const iso = now.toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 10);
  const ext = extForMime(mime);
  const sidPart = sessionId || "no-session";
  const basePath = `${sidPart}/${yyyy}-${mm}/${source}-${iso}-${rand}`;
  const storagePath = `${basePath}.${ext}`;
  const metadataPath = `${basePath}.json`;

  const bytes = await file.arrayBuffer();
  const uploadRes = await uploadObject({
    url,
    serviceRoleKey,
    path: storagePath,
    contentType: mime,
    body: bytes,
  });
  if (!uploadRes.ok) {
    const body = await uploadRes.text().catch(() => "");
    console.error("media/capture upload failed", uploadRes.status, body);
    return jsonError("upload failed", 502);
  }

  const geminiAnalysis = truncateUtf8String(
    geminiAnalysisRaw.trim(),
    MAX_TEXT_FIELD,
  );
  const problem = truncateUtf8String(problemRaw.trim(), MAX_TEXT_FIELD);
  const errText = truncateUtf8String(errorRaw.trim(), MAX_TEXT_FIELD);

  const metadata = {
    session_id: sessionId || null,
    source,
    storage_path: storagePath,
    metadata_path: metadataPath,
    mime_type: mime,
    size_bytes: file.size,
    gemini_analysis: geminiAnalysis || null,
    problem_at_time: problem || null,
    error: errText || null,
    created_at: now.toISOString(),
  };

  const metadataRes = await uploadObject({
    url,
    serviceRoleKey,
    path: metadataPath,
    contentType: "application/json",
    body: JSON.stringify(metadata),
  });
  if (!metadataRes.ok) {
    const body = await metadataRes.text().catch(() => "");
    console.error("media/capture metadata upload failed", metadataRes.status, body);
  }

  const insertRes = await fetch(`${url}/rest/v1/media_events`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(serviceRoleKey, "application/json"),
      Prefer: "return=minimal",
    },
    body: JSON.stringify(metadata),
  });
  if (!insertRes.ok) {
    const body = await insertRes.text().catch(() => "");
    console.error("media/capture insert failed", insertRes.status, body);
    return new Response(
      JSON.stringify({
        ok: true,
        storage_path: storagePath,
        metadata_path: metadataRes.ok ? metadataPath : null,
        warning: "file stored but media_events insert failed",
      }),
      { status: 202, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, storage_path: storagePath, metadata_path: metadataPath }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
