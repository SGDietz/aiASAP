export const OPENAI_VISION_ENDPOINT =
  "https://api.openai.com/v1/chat/completions";
export const DEFAULT_OPENAI_VISION_MODEL = "gpt-4o-mini";

const SILENT_TOKEN = "[SILENT]";

type VisionTextPart = { type: "text"; text: string };
type VisionImagePart = {
  type: "image_url";
  image_url: { url: string };
};
export type VisionContentPart = VisionTextPart | VisionImagePart;

export type OpenAIVisionRequest = {
  systemPrompt: string;
  userContent: VisionContentPart[];
  maxTokens: number;
};

const SNAPSHOT_SYSTEM_PROMPT =
  "You are 6, a warm home-and-garden troubleshooter with light dry humor. Keep answers practical and accurate. Be direct. Never be mean, offensive, or unsafe. Avoid mentioning policies or that you are an AI. The user has already shared an image with you, so answer only from what is visible. Never claim that you will look later; you already have the view.";

const STREAMING_SYSTEM_PROMPT =
  "You are 6, a digital home-and-garden contractor helping the user fix ONE specific problem they described. You are looking at a live camera frame. Discuss only that object and problem. Stay focused on the fix. Be silent by default: when nothing relevant changed, output exactly [SILENT] and nothing else. Speak in one or two short sentences only for a direct question, a visible attempted-fix result, a meaningful state change, or when the named object is not visible. Never narrate unrelated parts of the scene or claim you will look later.";

const VIDEO_SYSTEM_PROMPT =
  "You are 6, a warm home-and-garden troubleshooter. The user has already shared video frames with you. Describe only what is visible across those frames, stay practical and accurate, and use at most one light dry observation. Never claim that you will look later; you already have the footage.";

export function buildImageVisionRequest(args: {
  mimeType: string;
  base64Image: string;
  question?: string;
  problem?: string;
  lastAnalysis?: string;
  mode: "snapshot" | "streaming";
}): OpenAIVisionRequest {
  const question = args.question?.trim() ?? "";
  let promptText: string;

  if (args.mode === "streaming") {
    const problem = args.problem?.trim() ?? "";
    const lastAnalysis = args.lastAnalysis?.trim() ?? "";
    const parts = [
      problem
        ? `The user's problem is: "${problem}". This is the only problem to analyze.`
        : "The user has not named a specific problem. Focus only on the object they are holding or pointing toward.",
      lastAnalysis && lastAnalysis !== SILENT_TOKEN
        ? `Previous observation: "${lastAnalysis}". Compare the current frame with it.`
        : null,
      question
        ? `The user just asked: "${question}". Answer only if it concerns the named problem.`
        : "There is no new question.",
      `If nothing meaningful to the fix changed, output exactly ${SILENT_TOKEN}.`,
    ].filter((part): part is string => Boolean(part));
    promptText = parts.join(" ");
  } else if (question) {
    promptText =
      `Look at this image and answer: "${question}". ` +
      "Use two or three short sentences. Include at least one concrete observation or practical tip tied to what is visible.";
  } else {
    promptText =
      "Describe what is visible in two short sentences. Be useful and direct, and include a practical observation when possible.";
  }

  return {
    systemPrompt:
      args.mode === "streaming"
        ? STREAMING_SYSTEM_PROMPT
        : SNAPSHOT_SYSTEM_PROMPT,
    userContent: [
      { type: "text", text: promptText },
      {
        type: "image_url",
        image_url: {
          url: `data:${args.mimeType};base64,${args.base64Image}`,
        },
      },
    ],
    maxTokens: 180,
  };
}

export function buildVideoVisionRequest(
  frames: string[],
): OpenAIVisionRequest {
  return {
    systemPrompt: VIDEO_SYSTEM_PROMPT,
    userContent: [
      {
        type: "text",
        text: "Describe what is happening across these video frames in two or three short sentences. Include at least one practical observation that could help solve a real problem.",
      },
      ...frames.map(
        (frame): VisionImagePart => ({
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${frame}` },
        }),
      ),
    ],
    maxTokens: 220,
  };
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function callOpenAIVision(args: {
  apiKey: string;
  model?: string;
  request: OpenAIVisionRequest;
  fetchImpl?: FetchLike;
}): Promise<string> {
  if (!args.apiKey) throw new Error("OpenAI API key not configured");
  const fetchImpl = args.fetchImpl ?? fetch;
  const response = await fetchImpl(OPENAI_VISION_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model || DEFAULT_OPENAI_VISION_MODEL,
      messages: [
        { role: "system", content: args.request.systemPrompt },
        { role: "user", content: args.request.userContent },
      ],
      max_tokens: args.request.maxTokens,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI vision request failed (${response.status})`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const analysis = data.choices?.[0]?.message?.content;
  if (typeof analysis !== "string" || !analysis.trim()) {
    throw new Error("OpenAI vision returned no analysis");
  }
  return analysis.trim();
}
