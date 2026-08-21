import {
  MAX_VIDEO_FRAMES,
  RequestBodyTooLargeError,
  assertAllowedOrigin,
  isReasonableBase64Frame,
  readRequestBodyWithLimit,
} from "../../../src/lib/apiRouteSecurity";
import {
  buildVideoVisionRequest,
  callOpenAIVision,
} from "../../../src/lib/vision/openaiVision";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { OPENAI_API_KEY } from "../secrets";

const OPENAI_VISION_MODEL =
  process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_VIDEO_TOTAL_BASE64_CHARS = 12_000_000;
const MAX_VIDEO_REQUEST_BYTES = MAX_VIDEO_TOTAL_BASE64_CHARS + 100_000;

function hasOversizedContentLength(request: Request, maxBytes: number): boolean {
  const value = request.headers.get("content-length");
  if (!value || !/^\d+$/.test(value)) return false;
  const bytes = Number(value);
  return Number.isSafeInteger(bytes) && bytes > maxBytes;
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;

  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  if (hasOversizedContentLength(request, MAX_VIDEO_REQUEST_BYTES)) {
    return jsonError("Video request is too large", 413);
  }

  if (!OPENAI_API_KEY) {
    return jsonError("Video analysis is not configured", 503);
  }

  try {
    let requestBody: ArrayBuffer;
    try {
      requestBody = await readRequestBodyWithLimit(request, MAX_VIDEO_REQUEST_BYTES);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return jsonError("Video request is too large", 413);
      }
      throw error;
    }

    const boundedRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: requestBody,
    });
    const body = (await boundedRequest.json().catch(() => null)) as {
      frames?: unknown;
    } | null;
    if (!body || !Array.isArray(body.frames)) {
      return jsonError("Video frames are required", 400);
    }
    if (body.frames.length === 0 || body.frames.length > MAX_VIDEO_FRAMES) {
      return jsonError("Invalid number of video frames", 400);
    }
    if (!body.frames.every(isReasonableBase64Frame)) {
      return jsonError("Invalid video frame data", 400);
    }

    const frames = body.frames as string[];
    const totalChars = frames.reduce((sum, frame) => sum + frame.length, 0);
    if (totalChars > MAX_VIDEO_TOTAL_BASE64_CHARS) {
      return jsonError("Video frames are too large", 413);
    }

    const analysis = await callOpenAIVision({
      apiKey: OPENAI_API_KEY,
      model: OPENAI_VISION_MODEL,
      request: buildVideoVisionRequest(frames),
    });

    return Response.json({ analysis });
  } catch (error) {
    console.error(
      "Video analysis failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return jsonError("Failed to analyze video", 502);
  }
}
