import {
  MAX_OPENAI_IMAGE_ANALYSIS_CHARS,
  MAX_OPENAI_USER_MESSAGE_CHARS,
  assertAllowedOrigin,
  truncateUtf8String,
} from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { OPENAI_API_KEY } from "../secrets";

const SYSTEM_PROMPT =
  "You are 6, aiASAP's personal assistant and buddy. Speak naturally in short, useful responses for a live voice conversation. You help with lists, reminders, planning, practical ideas, making money honestly, and building toward financial independence when appropriate. Do not over-explain. Do not claim you completed an external action unless the app tool already did it. Brand name is pronounced A. I. A-S-A-P.";

const OPENAI_MODEL = "gpt-4o-mini";

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const body = await request.json();
    const { message: rawMessage, image_analysis: rawImageAnalysis } = body;

    if (typeof rawMessage !== "string" || !rawMessage.trim()) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    const message = truncateUtf8String(
      rawMessage,
      MAX_OPENAI_USER_MESSAGE_CHARS,
    );
    const image_analysis =
      typeof rawImageAnalysis === "string"
        ? truncateUtf8String(
            rawImageAnalysis,
            MAX_OPENAI_IMAGE_ANALYSIS_CHARS,
          )
        : undefined;

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Build messages array
    const messages: Array<{ role: string; content: string }> = [
      {
        role: "system",
        content: image_analysis
          ? `${SYSTEM_PROMPT}\n\nIMPORTANT CONTEXT: The user has shared an image with you. You can see this image clearly, and here's what you observe: ${image_analysis}\n\nWhen the user asks questions about what they're seeing or asks questions about the image, respond as if you're directly viewing it. Describe what you see naturally and confidently - you have full visibility of the image. Never say you can't see the image or that you're relying on someone else's analysis. You are directly viewing this image.`
          : SYSTEM_PROMPT,
      },
      { role: "user", content: message },
    ];

    // Call OpenAI API
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
      }),
    });

    if (!res.ok) {
      const errorData = await res.text();
      console.error("OpenAI API error:", errorData);
      return new Response(
        JSON.stringify({
          error: "Failed to generate response",
        }),
        {
          status: res.status <= 599 ? res.status : 502,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const data = await res.json();
    const response = data.choices[0].message.content;

    return new Response(JSON.stringify({ response }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error generating response:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate response" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}
