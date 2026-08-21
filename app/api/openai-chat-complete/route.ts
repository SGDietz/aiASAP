import {
  MAX_OPENAI_IMAGE_ANALYSIS_CHARS,
  MAX_OPENAI_USER_MESSAGE_CHARS,
  assertAllowedOrigin,
  truncateUtf8String,
} from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { OPENAI_API_KEY } from "../secrets";
import { getUser } from "../../../src/lib/auth/getUser";
import {
  filterNameFactsForResolvedName,
  resolvePersonName,
} from "../../../src/lib/auth/resolveUserName";
import {
  recallFacts,
  formatRecalledFactsForPrompt,
  extractFactsFromTurn,
  storeFacts,
} from "../../../src/lib/memory";

// THE BIG MOVE (2026-06-11, G's order): 6's FULL brain — the entire 2.1
// context window — now lives in our code and powers every reply in CUSTOM
// mode. The old 8-line mini-prompt is gone; 6 is 6 everywhere, and his
// personality survives avatar stops and returns because WE hold the brain.
import { SIX_SYSTEM_PROMPT } from "../../../src/lib/brain/sixSystemPrompt";
import { buildConversationMessages } from "../../../src/lib/brain/conversationMessages";

const SYSTEM_PROMPT = SIX_SYSTEM_PROMPT;

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    // G 2026-06-13: an empty/garbled body crashed request.json() with
    // "Unexpected end of JSON input" (route.ts:34) — harden so a bad request is
    // a clean 400, never a 500 that looks like a brain failure.
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "empty or invalid request body" }, { status: 400 });
    }
    const {
      message: rawMessage,
      image_analysis: rawImageAnalysis,
      listMode,
      history: rawHistory,
      userName: rawUserName,
      signedInEmail: rawSignedInEmail,
    } = body;

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

    // M1.2 — Memory recall pass. Only signed-in users have memory.
    // Supabase Auth is the canonical identity source. Client/device identity is
    // a fallback; semantic-memory names are deliberately last.
    const authUser = await getUser();
    const userId = authUser?.id ?? null;
    const recalled =
      userId !== null ? await recallFacts({ userId, query: message }) : [];
    const resolvedUserName = resolvePersonName({
      authUser,
      clientName: rawUserName,
      memoryFacts: recalled,
    });
    const promptFacts = filterNameFactsForResolvedName(
      recalled,
      resolvedUserName,
    );
    const memoryBlock = formatRecalledFactsForPrompt(promptFacts);
    const clientSignedInEmail =
      typeof rawSignedInEmail === "string" &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawSignedInEmail.trim())
        ? truncateUtf8String(rawSignedInEmail.trim(), 254)
        : "";
    const signedInEmail = authUser?.email ?? clientSignedInEmail;

    // Assemble system prompt: 6's full brain + live session context +
    // (optional image context) + (optional memory).
    const systemSections: string[] = [SYSTEM_PROMPT];
    // The platform used to inject SESSION CONTEXT dynamic vars; now we do.
    try {
      const nowLine = new Date().toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      });
      systemSections.push(
        `SESSION CONTEXT (live, from the app): Server time (US Eastern): ${nowLine}. Internal signals from the app may carry a fresher "Local time now" stamp in the user's own zone - the freshest stamp is the truth.`,
      );
    } catch {
      // no clock, no stamp
    }
    if (image_analysis) {
      systemSections.push(
        `IMPORTANT CONTEXT: The user has shared an image with you. You can see this image clearly, and here's what you observe: ${image_analysis}\n\nWhen the user asks questions about what they're seeing or asks questions about the image, respond as if you're directly viewing it. Describe what you see naturally and confidently - you have full visibility of the image. Never say you can't see the image or that you're relying on someone else's analysis. You are directly viewing this image.`,
      );
    }
    if (memoryBlock) {
      systemSections.push(memoryBlock);
    }
    // Supabase Auth identity wins. The resolver only falls back to the client
    // profile and then semantic memory when stronger sources are absent.
    if (resolvedUserName.name) {
      systemSections.push(
        `THE USER'S NAME IS: ${resolvedUserName.name.slice(0, 100)}. Use it naturally. NEVER ask for their name and NEVER say you don't have a name from them.`,
      );
    }
    // r34 (G signed in, the brain asked "first time signing up, or do you
    // already have an account?"): signed-in users are DONE with signup.
    if (signedInEmail) {
      systemSections.push(
        `THE USER IS SIGNED IN as ${signedInEmail.slice(0, 254)}. NEVER ask if they have an account, never ask first-time-or-returning, never ask them to spell an email, never offer account setup. If they ask about their account, that email is the answer. Switching accounts = tell them to say "log me out". They are a KNOWN returning user — NEVER ask "what should I call you" or for their name; if you don't have a name to use, just greet them warmly and move on. (G 2026-06-13: signed in, you'd just called him "G", then asked his name — jarring.)`,
      );
    }
    if (listMode === true) {
      // Voice-list mode (2026-06-11): the user is looking at a full-screen
      // list and 6 is voice-only. First live session lesson — the brain read
      // a numbered food list ALOUD and gave window-resizing advice for a
      // screen the app owns.
      systemSections.push(
        "RIGHT NOW: a full-screen list is on the user's screen and you are voice-only (your face is hidden). HARD RULES: answer in ONE short sentence - it's a quick back-and-forth, never a lecture. NEVER read out a numbered or multi-item set of suggestions; if you have ideas, name at most two and ask if they want them ON the list. The app owns the screen layout - never claim to move or resize anything yourself. But you CAN open lists, close lists, and add or remove items when the user asks - the app does it the moment you're asked. If the user asks why a list opened or closed on its own, apologize briefly and offer to put it back the way they want - NEVER say you have no control over lists.",
      );
    }

    // r26 (copilot 2026-06-12, G live: 6 re-introduced himself on EVERY turn
    // — "three different voices repeated the intro"): the brain was stateless,
    // so each call looked like first contact and the CW's greeting script
    // fired again. The client now sends the running conversation; with it in
    // place the brain continues instead of restarting.
    const history: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (Array.isArray(rawHistory)) {
      for (const turn of rawHistory.slice(-24)) {
        if (
          !turn ||
          (turn.role !== "user" && turn.role !== "assistant") ||
          typeof turn.content !== "string"
        ) {
          continue;
        }
        const content = truncateUtf8String(turn.content.trim(), 500);
        if (content) history.push({ role: turn.role, content });
      }
    }
    if (history.length > 0) {
      systemSections.push(
        "CONVERSATION SO FAR: the turns below already happened in THIS session. Do NOT introduce yourself again - you already did. Continue the conversation naturally.",
      );
    }

    // Tracer: history=0 on a turn that should have context means the PAGE is
    // stale (old bundle not sending history) — check before debugging deeper.
    console.log(`[chat-complete] history=${history.length} listMode=${listMode === true}`);

    const messages = buildConversationMessages(
      systemSections.join("\n\n"),
      history,
      message,
    );

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

    // M1.2 — Memory writer pass. Extract durable facts from this turn
    // and persist them. Fire-and-forget — never block the reply on
    // the writer. Only runs for signed-in users.
    if (userId) {
      void (async () => {
        try {
          const facts = await extractFactsFromTurn({
            userMessage: message,
            assistantReply: response,
          });
          if (facts.length > 0) {
            await storeFacts({ userId, facts });
          }
        } catch (e) {
          console.error("[memory:writer] failed", e);
        }
      })();
    }

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
