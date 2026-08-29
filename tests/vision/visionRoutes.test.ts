import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/rateLimit", () => ({
  checkRateLimit: vi.fn(async () => null),
}));

vi.mock("../../app/api/secrets", () => ({
  OPENAI_API_KEY: "test-key",
}));

vi.mock("../../src/lib/vision/openaiVision", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/lib/vision/openaiVision")>();
  return {
    ...actual,
    callOpenAIVision: vi.fn(async () => "A visible cracked fitting."),
  };
});

import { POST as analyzeImage } from "../../app/api/analyze-image/route";
import { POST as analyzeVideo } from "../../app/api/analyze-video/route";
import { callOpenAIVision } from "../../src/lib/vision/openaiVision";

const mockedVisionCall = vi.mocked(callOpenAIVision);

function oversizedStream(byteLength: number): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(byteLength));
      controller.close();
    },
  });
}

function streamingRequest(
  url: string,
  contentType: string,
  byteLength: number,
): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: oversizedStream(byteLength),
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("vision API routes", () => {
  beforeEach(() => {
    mockedVisionCall.mockClear();
  });

  it("sends uploaded images to the configured non-Grok vision provider", async () => {
    const formData = new FormData();
    formData.append(
      "image",
      new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
      "fitting.jpg",
    );
    formData.append("question", "What is wrong?");

    const response = await analyzeImage(
      new Request("http://localhost/api/analyze-image", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      analysis: "A visible cracked fitting.",
    });
    expect(mockedVisionCall).toHaveBeenCalledOnce();
    expect(mockedVisionCall.mock.calls[0]?.[0]).toMatchObject({
      apiKey: "test-key",
      model: "gpt-4o-mini",
    });
  });

  it("sends validated video frames to the same real vision path", async () => {
    const response = await analyzeVideo(
      new Request("http://localhost/api/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames: ["AQIDBA==", "BQYHCA=="] }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      analysis: "A visible cracked fitting.",
    });
    expect(mockedVisionCall).toHaveBeenCalledOnce();
  });

  it("rejects malformed video frames before a provider call", async () => {
    const response = await analyzeVideo(
      new Request("http://localhost/api/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames: ["not base64!"] }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mockedVisionCall).not.toHaveBeenCalled();
  });

  it("rejects declared oversized bodies before parsing or provider work", async () => {
    const response = await analyzeVideo(
      new Request("http://localhost/api/analyze-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "13000000",
        },
        body: "not parsed",
      }),
    );

    expect(response.status).toBe(413);
    expect(mockedVisionCall).not.toHaveBeenCalled();
  });

  it("rejects oversized image streams without Content-Length before parsing", async () => {
    const response = await analyzeImage(
      streamingRequest(
        "http://localhost/api/analyze-image",
        "application/octet-stream",
        10 * 1024 * 1024 + 1_000_001,
      ),
    );

    expect(response.status).toBe(413);
    expect(mockedVisionCall).not.toHaveBeenCalled();
  });

  it("rejects oversized video streams without Content-Length before parsing", async () => {
    const response = await analyzeVideo(
      streamingRequest(
        "http://localhost/api/analyze-video",
        "application/json",
        12_100_001,
      ),
    );

    expect(response.status).toBe(413);
    expect(mockedVisionCall).not.toHaveBeenCalled();
  });
});
