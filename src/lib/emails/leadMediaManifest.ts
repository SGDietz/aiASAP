/**
 * Media manifest builder shared by the two lead emails.
 *
 * Contract:
 *   - Owner (aiASAP team) email gets LINKS ONLY: signed, time-bounded URLs
 *     generated server-side against the aiASAP media bucket. Never inline
 *     images, never attachments, never raw storage paths.
 *   - Visitor confirmation gets ONLY a reliable count/type summary. Never
 *     raw storage paths, never signed URLs, never internal storage hosts.
 *   - Signing failure is safe: we degrade to an internal review reference
 *     for the owner email and keep the count/type summary for the visitor.
 *
 * The bucket name mirrors app/api/media/capture/route.ts.
 */

export type MediaEventRow = {
  id: string;
  session_id: string | null;
  source:
    | "camera_snapshot"
    | "video_recording"
    | "gallery_image"
    | "gallery_video"
    | "gallery_document"
    | "go_live_frame";
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export type MediaLink = {
  label: string;
  href: string;
  mime: string;
  sizeBytes: number;
  expiresAt: string;
  /** What 6 saw in the file (the capture route's vision text), when known. */
  caption?: string | null;
};

export type OwnerMediaManifest = {
  links: MediaLink[];
  signingFailed: boolean;
  reviewRef: string;
};

export type VisitorMediaSummary = {
  totalCount: number;
  imageCount: number;
  videoCount: number;
  documentCount: number;
};

const MEDIA_BUCKET = process.env.AIASAP_MEDIA_BUCKET || "aiasap-media";
const OWNER_LINK_TTL_SECONDS = 60 * 60 * 24 * 7;

function labelForSource(source: MediaEventRow["source"]): string {
  switch (source) {
    case "camera_snapshot": return "Camera photo";
    case "video_recording": return "Recorded video";
    case "gallery_image": return "Uploaded photo";
    case "gallery_video": return "Uploaded video";
    case "gallery_document": return "Uploaded document";
    case "go_live_frame": return "Go-Live frame";
  }
}

function isVideo(row: MediaEventRow): boolean {
  return row.source === "video_recording" || row.source === "gallery_video";
}

function isDocument(row: MediaEventRow): boolean {
  if (row.source === "gallery_document") return true;
  const mime = typeof row.mime_type === "string" ? row.mime_type : "";
  return !mime.startsWith("image/") && !mime.startsWith("video/");
}

export function buildVisitorMediaSummary(
  rows: ReadonlyArray<MediaEventRow>,
): VisitorMediaSummary {
  let images = 0;
  let videos = 0;
  let documents = 0;
  for (const row of rows) {
    if (isDocument(row)) documents += 1;
    else if (isVideo(row)) videos += 1;
    else images += 1;
  }
  return {
    totalCount: images + videos + documents,
    imageCount: images,
    videoCount: videos,
    documentCount: documents,
  };
}

export type SignedUrlSigner = (args: {
  bucket: string;
  path: string;
  expiresInSeconds: number;
}) => Promise<{ signedUrl: string; expiresAt: string } | null>;

/**
 * Real Supabase Storage signer via `POST /storage/v1/object/sign/<bucket>/<path>`.
 * Best-effort: returns null on any failure so the caller can degrade to the
 * internal review reference rather than leak a raw storage path.
 */
export function createHttpSignedUrlSigner(url: string, key: string): SignedUrlSigner {
  return async ({ bucket, path, expiresInSeconds }) => {
    try {
      const res = await fetch(
        `${url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodeURI(path)}`,
        {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expiresIn: expiresInSeconds }),
        },
      );
      if (!res.ok) return null;
      const body = (await res.json().catch(() => null)) as { signedURL?: unknown; signedUrl?: unknown } | null;
      const raw = typeof body?.signedURL === "string"
        ? body.signedURL
        : typeof body?.signedUrl === "string"
          ? body.signedUrl
          : null;
      if (!raw) return null;
      const absolute = raw.startsWith("http") ? raw : `${url}${raw.startsWith("/") ? "" : "/"}${raw}`;
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
      return { signedUrl: absolute, expiresAt };
    } catch {
      return null;
    }
  };
}

export async function buildOwnerMediaManifest(args: {
  rows: ReadonlyArray<MediaEventRow>;
  signer: SignedUrlSigner;
  reviewRef: string;
  bucket?: string;
  ttlSeconds?: number;
  /** Optional: 6's caption for a file, so G reads what was in it before he clicks. */
  captionFor?: (row: MediaEventRow) => Promise<string | null>;
}): Promise<OwnerMediaManifest> {
  const bucket = args.bucket ?? MEDIA_BUCKET;
  const ttl = args.ttlSeconds ?? OWNER_LINK_TTL_SECONDS;
  const links: MediaLink[] = [];
  let anyFailed = false;
  for (const row of args.rows) {
    if (!row.storage_path) continue;
    const signed = await args.signer({ bucket, path: row.storage_path, expiresInSeconds: ttl });
    if (!signed) {
      anyFailed = true;
      continue;
    }
    let caption: string | null = null;
    if (args.captionFor) {
      try {
        caption = await args.captionFor(row);
      } catch {
        caption = null;
      }
    }
    links.push({
      label: labelForSource(row.source),
      href: signed.signedUrl,
      mime: row.mime_type,
      sizeBytes: row.size_bytes,
      expiresAt: signed.expiresAt,
      ...(caption ? { caption } : {}),
    });
  }
  return {
    links,
    signingFailed: anyFailed && links.length < args.rows.length,
    reviewRef: args.reviewRef,
  };
}

export async function loadSessionMediaEvents(
  url: string,
  key: string,
  sessionId: string,
  limit = 20,
): Promise<MediaEventRow[]> {
  // Best-effort: a transport/network failure here means we do not know about
  // any media, which is indistinguishable from "no media" for downstream
  // rendering. Swallowing keeps a legitimate no-media send from being
  // mislabeled as `mediaSigningFailed` when the read itself never happened.
  //
  // 2026-09-05: the `media_events` table has NEVER existed in the live
  // database (`relation does not exist`), so this returned [] for every lead
  // and no owner email ever carried a link. Every capture DOES land in the
  // bucket with a JSON sidecar, so the bucket is the record of truth: try the
  // table (it may exist one day), then read the bucket.
  try {
    const res = await fetch(
      `${url}/rest/v1/media_events?session_id=eq.${encodeURIComponent(sessionId)}&select=id,session_id,source,storage_path,mime_type,size_bytes,created_at&order=created_at.desc&limit=${limit}`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      },
    );
    if (res.ok) {
      const rows = (await res.json().catch(() => [])) as MediaEventRow[];
      if (Array.isArray(rows) && rows.length > 0) return rows;
    }
  } catch {
    // fall through to the bucket
  }
  try {
    const fromBucket = await listSessionMediaFromStorage(url, key, sessionId);
    return fromBucket.slice(0, limit);
  } catch {
    return [];
  }
}

const MEDIA_SOURCE_RE =
  /^(camera_snapshot|video_recording|gallery_image|gallery_video|gallery_document|go_live_frame)-/;

type StorageEntry = {
  name: string;
  id: string | null;
  created_at?: string | null;
  metadata?: { size?: number; mimetype?: string } | null;
};

async function listStoragePrefix(
  url: string,
  key: string,
  bucket: string,
  prefix: string,
): Promise<StorageEntry[]> {
  const res = await fetch(`${url}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 200, offset: 0, sortBy: { column: "name", order: "asc" } }),
  });
  if (!res.ok) return [];
  const body = (await res.json().catch(() => [])) as StorageEntry[];
  return Array.isArray(body) ? body : [];
}

/** Turn one bucket object name into the row shape the emails already render. */
export function mediaRowFromStorageName(
  sessionId: string,
  folder: string,
  entry: StorageEntry,
): MediaEventRow | null {
  const name = entry.name;
  if (!name || name.endsWith(".json") || name.startsWith("_")) return null;
  const m = MEDIA_SOURCE_RE.exec(name);
  if (!m) return null;
  const mime = entry.metadata?.mimetype || "application/octet-stream";
  return {
    id: `${folder}/${name}`,
    session_id: sessionId,
    source: m[1] as MediaEventRow["source"],
    storage_path: `${sessionId}/${folder}/${name}`,
    mime_type: mime,
    size_bytes: typeof entry.metadata?.size === "number" ? entry.metadata.size : 0,
    created_at: entry.created_at || new Date(0).toISOString(),
  };
}

/**
 * Every file the capture route stored for this conversation, oldest first,
 * read from the bucket: `<session>/<YYYY-MM>/<source>-<iso>-<rand>.<ext>`.
 * Sidecar JSON and the `_notify` marker folder are skipped.
 */
export async function listSessionMediaFromStorage(
  url: string,
  key: string,
  sessionId: string,
  bucket: string = MEDIA_BUCKET,
): Promise<MediaEventRow[]> {
  const folders = await listStoragePrefix(url, key, bucket, `${sessionId}/`);
  const rows: MediaEventRow[] = [];
  for (const folder of folders) {
    if (!folder.name || folder.name.startsWith("_")) continue;
    if (folder.id) {
      // A file directly under the session (older layout) - keep it too.
      const row = mediaRowFromStorageName(sessionId, "", folder);
      if (row) rows.push({ ...row, storage_path: `${sessionId}/${folder.name}` });
      continue;
    }
    const files = await listStoragePrefix(url, key, bucket, `${sessionId}/${folder.name}/`);
    for (const f of files) {
      const row = mediaRowFromStorageName(sessionId, folder.name, f);
      if (row) rows.push(row);
    }
  }
  rows.sort((a, b) => a.storage_path.localeCompare(b.storage_path));
  return rows;
}

/** The vision caption the capture route wrote beside the file, if any. */
export async function readMediaCaption(
  url: string,
  key: string,
  row: MediaEventRow,
  bucket: string = MEDIA_BUCKET,
): Promise<string | null> {
  const sidecar = row.storage_path.replace(/\.[a-z0-9]+$/i, ".json");
  if (sidecar === row.storage_path) return null;
  try {
    const res = await fetch(
      `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeURI(sidecar)}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as { gemini_analysis?: unknown } | null;
    const text = typeof body?.gemini_analysis === "string" ? body.gemini_analysis.trim() : "";
    return text ? text.slice(0, 500) : null;
  } catch {
    return null;
  }
}
