import {
  MAX_ANALYZE_IMAGE_BYTES,
  MAX_ANALYZE_IMAGE_QUESTION_CHARS,
  RequestBodyTooLargeError,
  assertAllowedOrigin,
  isAllowedImageMime,
  readRequestBodyWithLimit,
  truncateUtf8String,
} from "../../../src/lib/apiRouteSecurity";
import {
  buildImageVisionRequest,
  callOpenAIVision,
} from "../../../src/lib/vision/openaiVision";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { OPENAI_API_KEY } from "../secrets";

const OPENAI_VISION_MODEL =
  process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_ANALYZE_IMAGE_REQUEST_BYTES = MAX_ANALYZE_IMAGE_BYTES + 1_000_000;

function hasOversizedContentLength(request: Request, maxBytes: number): boolean {
  const value = request.headers.get("content-length");
  if (!value || !/^\d+$/.test(value)) return false;
  const bytes = Number(value);
  return Number.isSafeInteger(bytes) && bytes > maxBytes;
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function formText(
  formData: FormData,
  key: string,
  maxChars: number,
): string {
  const value = formData.get(key);
  return typeof value === "string"
    ? truncateUtf8String(value.trim(), maxChars)
    : "";
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;

  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  if (hasOversizedContentLength(request, MAX_ANALYZE_IMAGE_REQUEST_BYTES)) {
    return jsonError("Image request is too large", 413);
  }

  if (!OPENAI_API_KEY) {
    return jsonError("Image analysis is not configured", 503);
  }

  try {
    let body: ArrayBuffer;
    try {
      body = await readRequestBodyWithLimit(
        request,
        MAX_ANALYZE_IMAGE_REQUEST_BYTES,
      );
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return jsonError("Image request is too large", 413);
      }
      throw error;
    }

    const boundedRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body,
    });
    const formData = await boundedRequest.formData().catch(() => null);
    if (!formData) return jsonError("Invalid multipart form data", 400);

    const image = formData.get("image");
    if (!(image instanceof Blob)) {
      return jsonError("Image is required", 400);
    }
    if (!image.size || image.size > MAX_ANALYZE_IMAGE_BYTES) {
      return jsonError("Image is empty or too large", 413);
    }

    const mimeType = image.type.split(";")[0]?.trim().toLowerCase() || "";
    if (!isAllowedImageMime(mimeType)) {
      return jsonError("Unsupported image type", 415);
    }

    const question = formText(
      formData,
      "question",
      MAX_ANALYZE_IMAGE_QUESTION_CHARS,
    );
    const problem = formText(
      formData,
      "problem",
      MAX_ANALYZE_IMAGE_QUESTION_CHARS,
    );
    const lastAnalysis = formText(formData, "lastAnalysis", 4_000);
    const mode = formData.get("mode") === "streaming" ? "streaming" : "snapshot";
    const base64Image = Buffer.from(await image.arrayBuffer()).toString("base64");

    const analysis = await callOpenAIVision({
      apiKey: OPENAI_API_KEY,
      model: OPENAI_VISION_MODEL,
      request: buildImageVisionRequest({
        mimeType,
        base64Image,
        question,
        problem,
        lastAnalysis,
        mode,
      }),
    });

    return Response.json({ analysis });
  } catch (error) {
    console.error(
      "Image analysis failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return jsonError("Failed to analyze image", 502);
  }
}
