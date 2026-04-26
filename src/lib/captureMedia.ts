// Fire-and-forget uploader for every image/video frame 6 is shown.
// Failure here must never block the user-visible app flow.

export type MediaSource =
  | "camera_snapshot"
  | "video_recording"
  | "gallery_image"
  | "gallery_video"
  | "go_live_frame";

export interface CaptureMediaArgs {
  file: File | Blob;
  source: MediaSource;
  sessionId?: string | null;
  geminiAnalysis?: string | null;
  problem?: string | null;
  error?: string | null;
}

export async function captureMedia(args: CaptureMediaArgs): Promise<void> {
  try {
    const form = new FormData();
    const filename =
      args.file instanceof File ? args.file.name : `${args.source}.bin`;
    form.append("file", args.file, filename);
    form.append("source", args.source);
    if (args.sessionId) form.append("session_id", args.sessionId);
    if (args.geminiAnalysis) form.append("gemini_analysis", args.geminiAnalysis);
    if (args.problem) form.append("problem", args.problem);
    if (args.error) form.append("error", args.error);

    const res = await fetch("/api/media/capture", {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      console.warn("captureMedia: non-OK response", res.status);
    }
  } catch (err) {
    console.warn("captureMedia: request failed", err);
  }
}
