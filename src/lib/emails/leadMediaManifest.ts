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
    links.push({
      label: labelForSource(row.source),
      href: signed.signedUrl,
      mime: row.mime_type,
      sizeBytes: row.size_bytes,
      expiresAt: signed.expiresAt,
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
    if (!res.ok) return [];
    const rows = (await res.json().catch(() => [])) as MediaEventRow[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}
