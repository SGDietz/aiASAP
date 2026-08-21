import { describe, expect, it, vi } from "vitest";
import {
  buildImageVisionRequest,
  buildVideoVisionRequest,
  callOpenAIVision,
} from "../../src/lib/vision/openaiVision";

describe("OpenAI vision request building", () => {
  it("builds a real snapshot request containing the submitted image", () => {
    const request = buildImageVisionRequest({
      mimeType: "image/png",
      base64Image: "aGVsbG8=",
      question: "What is broken?",
      mode: "snapshot",
    });

    expect(request.userContent).toContainEqual({
      type: "image_url",
      image_url: { url: "data:image/png;base64,aGVsbG8=" },
    });
    expect(request.userContent[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("What is broken?"),
    });
  });

  it("keeps live vision problem-locked and silent-first", () => {
    const request = buildImageVisionRequest({
      mimeType: "image/jpeg",
      base64Image: "aGVsbG8=",
      question: "Did that move?",
      problem: "stuck hose fitting",
      lastAnalysis: "The fitting is still seated.",
      mode: "streaming",
    });

    expect(request.systemPrompt).toContain("ONE specific problem");
    expect(request.userContent[0]).toMatchObject({
      type: "text",
      text: expect.stringMatching(/stuck hose fitting[\s\S]*\[SILENT\]/i),
    });
    expect(request.systemPrompt).toContain("[SILENT]");
    expect(JSON.stringify(request)).not.toContain("***");
  });

  it("builds video analysis from every validated frame", () => {
    const request = buildVideoVisionRequest(["Zmlyc3Q=", "c2Vjb25k"]);
    const imageParts = request.userContent.filter(
      (part) => part.type === "image_url",
    );

    expect(imageParts).toHaveLength(2);
    expect(imageParts[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,c2Vjb25k" },
    });
  });
});

describe("callOpenAIVision", () => {
  it("calls OpenAI Chat Completions and returns the visible analysis", async () => {
    const fetchImpl = vi.fn<
      (input: string, init?: RequestInit) => Promise<Response>
    >(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: "The valve is cracked." } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const request = buildImageVisionRequest({
      mimeType: "image/jpeg",
      base64Image: "aGVsbG8=",
      mode: "snapshot",
    });

    await expect(
      callOpenAIVision({
        apiKey: "test-token",
        model: "gpt-4o-mini",
        request,
        fetchImpl,
      }),
    ).resolves.toBe("The valve is cracked.");

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    });
  });

  it("rejects empty or malformed provider responses", async () => {
    const fetchImpl = vi.fn<
      (input: string, init?: RequestInit) => Promise<Response>
    >(async () =>
      new Response(JSON.stringify({ choices: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const request = buildVideoVisionRequest(["Zmlyc3Q="]);

    await expect(
      callOpenAIVision({
        apiKey: "test-token",
        model: "gpt-4o-mini",
        request,
        fetchImpl,
      }),
    ).rejects.toThrow("no analysis");
  });
});
