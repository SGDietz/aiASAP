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
import {
  shouldAskForNameNow,
  NAME_ASK_WHISPER,
} from "../../../src/lib/nameAskWhisper";
import { buildConversationMessages } from "../../../src/lib/brain/conversationMessages";

// THE INTERVIEW LEDGER (wired 2026-08-21). It records what somebody has
// already told us across the nine parts of the $5,000 build interview, and
// whispers the next unanswered part into 6's context. 6 is free to ignore the
// whisper - the machine marks, 6 decides. Nothing here may break the voice:
// every call is wrapped, and a failure just means no whisper this turn.
import { newLedger, nextHint, hintLine, isComplete } from "../../../src/lib/interview/ledger";
import type { Ledger } from "../../../src/lib/interview/ledger";
import { loadLedger, saveLedger } from "../../../src/lib/interview/ledgerStore";
import { extractInterviewSlots } from "../../../src/lib/interview/extractSlots";
import { applySlots } from "../../../src/lib/interview/applySlots";
import { hasVoiceConsent, recordVoiceConsent } from "../../../src/lib/interview/consent";
import { generateBuildCard } from "../../../src/lib/interview/buildCardFromLedger";
import { notifyTeam } from "../../../src/lib/teamNotify";
import {
  hasDirectContactFollowUpRequest,
  hasExplicitPersonalConnectionRequest,
} from "../../../src/lib/buildInterestFlow";

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
      buildGateSatisfied: rawBuildGateSatisfied,
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

    // Load the interview ledger for the whisper. Signed-in only: an interview
    // has to survive a closed tab and a week away, and there is nowhere to
    // keep it for somebody we cannot name again.
    let interviewLedger: Ledger | null = null;
    if (userId) {
      interviewLedger = await loadLedger(userId, Date.now());
    }
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
    // THE WHISPER. One line, never spoken, never shown, never a question -
    // it tells 6 which part is still unanswered so he stops re-asking things
    // they already covered and stops missing things they never did.
    if (interviewLedger) {
      // Consent may have been given before this ledger row existed, so the
      // table is the truth and the flag is only a cache of it. Without this
      // top-up the whisper would say "notice not accepted" to somebody who
      // accepted it last week, and the interview would never start.
      if (!interviewLedger.noticeAccepted && signedInEmail) {
        interviewLedger.noticeAccepted = await hasVoiceConsent(signedInEmail);
      }
      const line = hintLine(nextHint(interviewLedger));
      if (line) systemSections.push(line);
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

    // Conversion hard gate. Only an explicit prospect request to personally
    // connect with G may enter the existing consent-gated contact flow. Build
    // talk, sales coaching, and handoff rehearsal remain ordinary brain turns.
    const buildInterestSeen = [
      ...history.filter((turn) => turn.role === "user").map((turn) => turn.content),
      message,
    ].some(
      (turn) =>
        hasExplicitPersonalConnectionRequest(turn) ||
        hasDirectContactFollowUpRequest(turn),
    );
    const buildGateSatisfied = Boolean(signedInEmail) || rawBuildGateSatisfied === true;
    // MEASURED 2026-09-04. `buildInterestSeen` scans the ENTIRE history, so once
    // any past turn tripped the contact detector this gate short-circuited
    // EVERY later turn - returning the identical canned line and never calling
    // the brain at all. In the recorded conversations it is the third most
    // repeated thing 6 says (+6 beyond the first).
    //
    // It compounded with the "call me 6" bug fixed the same day: G saying his
    // own name tripped the detector, and from that moment every single thing he
    // said came back as this demand.
    //
    // The gate still holds - it is what stops the interview advancing without a
    // contact - but a question asked twice and ignored has stopped being a
    // question. Counted from the history itself, so the route stays stateless.
    // (This count only became reliable today: assistant lines used to be
    // dropped from history during a capture, which is part of why it repeated.)
    const alreadyAskedForContact = history.filter(
      (turn) =>
        turn.role === "assistant" &&
        typeof turn.content === "string" &&
        turn.content.includes("so the team can follow up"),
    ).length;
    if (buildInterestSeen && !buildGateSatisfied && alreadyAskedForContact < 2) {
      // G, ride 2026-09-03 19:42, word for word: "don't mention the account...
      // yet. That'll be later on or a different time." The gate still holds -
      // the interview does not advance without a confirmed contact - but the
      // WORDS never name the account or "Part 1"; 6 just asks for the contact.
      return Response.json({
        response: "Real quick so the team can follow up - what's your name, and what's your email address?",
        conversionGate: "required",
      });
    }

    // THE NAME WHISPER (G, 2026-09-04: "fix the call you name thing").
    //
    // The prompt already said to ask once a real passion answer lands, "at the
    // next natural pause". That has no edge, and it drifted: on his ride he
    // said "I love building things" at 17:07:12 and "I build stone walls with
    // boulders" at 17:08:48, and the ask did not go out until 17:11:07 -
    // roughly twenty turns later, mid-way through scoping his website, glued
    // to the single word "so". Asked that late it reads as never having
    // listened, which is the complaint he has repeated most on this project.
    //
    // Prompt wording alone has already failed this rule twice, so the route
    // enforces it the way it enforces the opposite case above: a one-line
    // whisper, counted from history, stateless. Note the symmetry - when a
    // name IS known we push "NEVER ask for their name"; this is that rule's
    // missing other half.
    // Decision lives in src/lib/nameAskWhisper.ts so it can be tested against
    // G's real 2026-09-04 transcript instead of only grepped for.
    if (
      shouldAskForNameNow({
        history,
        message,
        knownName: resolvedUserName.name,
        signedInEmail,
        listMode: listMode === true,
      })
    ) {
      systemSections.push(NAME_ASK_WHISPER);
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

    // Ledger writer. Deliberately a SEPARATE fire-and-forget block from the
    // memory writer above: if one extractor fails the other must still run,
    // and neither may delay the reply that is already on its way out.
    if (userId) {
      void (async () => {
        try {
          const turn = await extractInterviewSlots({
            userMessage: message,
            assistantReply: response,
          });
          const now = Date.now();
          const base = interviewLedger ?? newLedger(now);
          let noticeChanged = false;

          // THE RECORD NOTICE. Writing this down is what lets the interview
          // start at all, and a decline is worth keeping as much as an
          // agreement - it is what stops us publishing somebody by mistake.
          if (turn.notice !== "none" && signedInEmail) {
            const granted = turn.notice === "granted";
            const stored = await recordVoiceConsent({
              email: signedInEmail,
              granted,
              spokenText: message,
            });
            // The one silent failure in this path with a real cost. Say so.
            if (!stored) {
              console.error("[interview:consent] NOT recorded", { granted });
            }
            if (granted) {
              base.noticeAccepted = true;
              noticeChanged = true;
            } else {
              await notifyTeam({
                kind: "consent_declined",
                who: signedInEmail,
                email: signedInEmail,
                facts: [["What they said", message.slice(0, 300)]],
                nextStep:
                  "Do not record, quote or publish anything from this person until they say otherwise.",
                dedupeKey: `consent-declined:${signedInEmail}:${new Date().toISOString().slice(0, 10)}`,
              });
            }
          }

          if (turn.slots.length === 0 && !noticeChanged) return;
          const { ledger, changed } = applySlots(base, turn.slots, now);

          // THE MOMENT IT BECOMES BUILDABLE. status is the latch and it is set
          // BEFORE the card is written, so a slow summariser cannot let the
          // next turn fire a second one.
          const justFinished = isComplete(ledger) && ledger.status !== "complete";
          if (justFinished) ledger.status = "complete";

          // No change means the turn repeated what we already had. Writing
          // anyway would bump lastActivityAt and hide a stalled interview.
          if (changed > 0 || noticeChanged || justFinished) {
            await saveLedger(userId, ledger);
          }

          if (justFinished) {
            // The summary that replaces the transcript. 6 promises nobody
            // reads it line by line - this is what makes that true.
            const built = await generateBuildCard(ledger);
            const facts: Array<[string, string | null | undefined]> = built
              ? [["Build card", built.card]]
              : [["Build card", "Could not be written this time - read the ledger."]];
            // A card that ran over its caps still goes out, because Scott needs
            // the lead either way - but it goes out with the problem named. A
            // memo quietly calling itself a summary is the failure to avoid.
            if (built && !built.check.ok) {
              facts.push(["Card ran over", built.check.problems.join("; ")]);
            }
            await notifyTeam({
              kind: "interview_complete",
              who: ledger.parts[1].slots.name?.value || signedInEmail || "someone",
              email: signedInEmail || null,
              facts,
              nextStep:
                "There is enough here to build from. Read the card, then talk to them before taking any money.",
              // Stable per person, so a retry can never send this twice.
              dedupeKey: `interview-complete:${userId}`,
            });
          }
        } catch (e) {
          console.error("[interview:ledger] failed", e);
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
