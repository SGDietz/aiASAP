"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  LiveAvatarContextProvider,
  useSession,
  useTextChat,
  useVoiceChat,
  useLiveAvatarContext,
} from "../liveavatar";
import Link from "next/link";
import { SessionState, AgentEventsEnum } from "@heygen/liveavatar-web-sdk";
import { useAvatarActions } from "../liveavatar/useAvatarActions";
import {
  registerSixSpokenLine,
  reportCustomVoiceDiag,
  wasRecentlySpokenBySix,
} from "../liveavatar/customVoiceDelivery";
import { captureMedia } from "../lib/captureMedia";
import { captureTesterLabelFromUrl } from "../lib/testerAttribution";
import { rememberAnonymousSessionId } from "../lib/auth/AuthProvider";
import { getSupabaseBrowserOrNull } from "../lib/auth/supabaseBrowser";
import {
  accountSetupSpeechFlow,
  confirmEmailCandidateFlow,
  takesEmailFastPath,
  type SignupFlags,
  type SignupPorts,
} from "../lib/signup/machine";
import {
  captureClientError,
  captureClientWarn,
} from "../lib/observability/clientLogger";
import {
  logAppEvent,
  maybeSubmitBugReport,
  maybeSubmitUserFeedback,
  noteUserTurnForFrustration,
  setTelemetrySessionId,
} from "../lib/telemetry";

// r30 (G 2026-06-12: "how do we know when I am on my account... Can I log
// out, and then log in from another account? Let's set up that system"):
// voice sign-out commands + the spoken confirm line.
const LOGOUT_COMMAND_RE =
  /\b(?:log|sign)\s*(?:me\s*)?(?:out|off)\b|\bswitch\s+(?:my\s+|the\s+)?accounts?\b/i;
const ACCOUNT_SIGNOUT_LINE =
  "You got it - signing you out now. The page will start fresh in a few seconds, and you can sign in as anyone.";

// r29/r31 (G live 2026-06-12: "The ad is not something that you buy at a
// grocery store" → "Added a store"; "I didn't say to do that" → spawned a
// "That To Do List"): talking ABOUT the system is never an order. Negation
// or reported speech anywhere in a sentence blocks BOTH item adds AND
// new-list creation from it.
const META_TALK_RE =
  /\b(?:not|don'?t|doesn'?t|didn'?t|isn'?t|wasn'?t|can'?t|never|you (?:just )?sa(?:y|id)|he said|she said|it says?|says|said|saying|talking to|i had|reality|issue|problem|wrong|mistake|supposed)\b/i;
import {
  fmtReminderDue,
  parseReminder,
  parseTimeOnly,
  REMINDER_LIST_RE,
} from "../lib/reminders/parse";
import {
  fmtPhoneSpoken,
  parseSpokenPhone,
  PHONE_GIVE_RE,
  SMS_OPT_IN_RE,
} from "../lib/reminders/phone";
import {
  loadUiSizeLevel,
  UI_CARD_SCALE,
  UI_SIZE_BIGGER_RE,
  UI_SIZE_MAX_LEVEL,
  UI_SIZE_SMALLER_RE,
  UI_SIZE_STORAGE_KEY,
} from "../lib/uiSize";
import {
  humanZoneName,
  resolveSpokenLocation,
  TZ_WRONG_RE,
} from "../lib/timezone/userTimezone";
import { TIME_ASK_RE, spokenTimeNow } from "../lib/timeAsk";
import {
  AVATAR_RETURN_RE,
  LIST_DONE_RE as VOICE_LIST_DONE_RE,
  wantsAvatarBack,
  voiceListEnterLine,
  AVATAR_BACK_LINES,
} from "../lib/voiceMode/intents";
import { pcm16Base64ToAudioBuffer } from "../lib/voiceMode/pcm";
import { isDuplicateUtterance } from "../lib/speech/dedupe";
import {
  LIST_CLOSE_RE,
  ACCOUNT_SETUP_TRIGGER_RE,
  ACCOUNT_READY_YES_RE,
  ACCOUNT_READY_NO_RE,
  END_SESSION_CONFIRM_RE,
  END_SESSION_CANCEL_RE,
  END_SESSION_BLOCK_RE,
  ONLINE_LOOKUP_CLOSE_RE,
  SHOPPING_MODE_CLOSE_RE,
  isInternalSignal,
  hasEndSessionIntent,
  confirmsEndSession,
  cleanDeviceName,
  isJunkPersonName,
  extractDeviceNameCandidate,
  isValidEmailCandidate,
  parseEmailFromAvatarReadback,
  extractAccountEmailCandidate,
} from "../lib/signup/helpers";
import {
  Radio,
  Camera,
  Images,
  Video,
  Play,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

export type SessionStoppedReason = { reason?: "inactivity" };

function getLiveAvatarSessionId(session: unknown): string | null {
  const maybeSession = session as
    | { sessionId?: unknown; _sessionInfo?: { session_id?: unknown } }
    | null
    | undefined;
  const rawSessionId =
    maybeSession?.sessionId ?? maybeSession?._sessionInfo?.session_id;
  return typeof rawSessionId === "string" && rawSessionId
    ? rawSessionId
    : null;
}

// RECALL FIX v3 (2026-06-01): snapshot the URL hash at MODULE LOAD — before the
// AuthProvider browser client (detectSessionInUrl) or anything else can consume /
// clear the magic-link #access_token. ensureSessionFromUrl reads THIS, not the
// live window.location.hash (which may already be empty by the time it runs).
const INITIAL_URL_HASH =
  typeof window !== "undefined" ? window.location.hash : "";

const VOICE_START_GREETING =
  "Hi, I'm 6, your a-i-buddy. You know why they call me 6? 'Cuz I got your back. So how can I make your life a little bit better today?";

// G spec 2026-05-27: if user interrupts the hard-coded intro before 6 finishes,
// fire one of these as 6's 2nd utterance after the interruption so the intro
// always lands. Random pick = chaos preference + variety on retest.
const GREETING_COMPLETION_POOL = [
  "They call me 6 'cuz I got your back. So how can I make your life a little bit better today?",
  "Oh and real quick — they call me 6 'cuz I got your back. So how can I make your life a little bit better today?",
  "Oh and I was saying, they call me 6 'cuz I got your back. So how can I make your life a little bit better today?",
];

const pickGreetingCompletion = (): string =>
  GREETING_COMPLETION_POOL[
    Math.floor(Math.random() * GREETING_COMPLETION_POOL.length)
  ];

// G (2026-06-01): close should say ONE short line then close — no two-step
// confirm dance, no re-prompt, no silence wait. Eager-close is fine because the
// Restart button is right there on screen. Rotate the line for a little variety.
const SESSION_CLOSE_GOODBYE_POOL = [
  "Okay, closing up. Tap Restart any time.",
  "All done. I'm closing now — Restart when you want me back.",
  "Closing this up. The Restart button brings me right back.",
  "Got it, shutting down. Hit Restart whenever you need me.",
];
const pickSessionCloseGoodbye = (): string =>
  SESSION_CLOSE_GOODBYE_POOL[
    Math.floor(Math.random() * SESSION_CLOSE_GOODBYE_POOL.length)
  ];
const LIST_CLOSE_EDUCATION =
  "If you want this list off the screen, just ask me to close the list.";
// v2.1 (2026-05-28): voice magic-link sign-in + per-user memory ENABLED.
// Was gated true on gold while the account flow was held back; flipped to
// false here so startAccountSetup / handleAccountSetupSpeech / the email
// readback UI / the /api/account/me resume path all go live.
const ACCOUNT_BETA_DISABLED = false;

// G (2026-06-01): keep the typed-email fallback box DORMANT until the email
// work is done. While false, the typed box never renders and the email flow
// stays on the spell-on-chest path only. Flip to true to restore the typed box.
const EMAIL_TYPED_FALLBACK_ENABLED = false;


// Returning-user intros, tiered by how many times the user + 6 have met
// (G 2026-05-31 "keep all + rotate"): random pick within the tier each return.
// {name} renders as ", Scott" when known and "" when not, so every line reads
// cleanly with or without a name.
const RETURNING_GREETING_TIERS: Record<string, string[]> = {
  second: [
    "Hey{name} — you came back! I was hoping you would. So what are we getting after today?",
    "Well, look who's back{name}! Good to see you again — still got your back. What's on your mind?",
    "Round two{name}! I remember you now — that's the whole point. What can I do for you today?",
  ],
  third: [
    "Three times now{name} — I'd say we're officially a team. What's the mission today?",
    "You're turning into a regular{name}, and I love it. Where do we start?",
    "Hey{name} — every time you swing by, I get a little more useful. What are we tackling?",
  ],
  regular: [
    "There you are{name}. Feels like old times. What's the move today?",
    "Back again{name}! You know the deal — I've got your back. What's up?",
    "Good to have you back{name}. We've got a rhythm now — what can I take off your plate?",
  ],
  longGap: [
    "Long time{name}! Missed you, honestly — catch me up, what's new?",
  ],
};

function pickReturningGreeting(
  name: string | null,
  visitCount: number,
  longGap: boolean,
): string {
  const tier = longGap
    ? "longGap"
    : visitCount <= 1
      ? "second"
      : visitCount === 2
        ? "third"
        : "regular";
  const pool = RETURNING_GREETING_TIERS[tier];
  const template = pool[Math.floor(Math.random() * pool.length)];
  const namePart = name ? `, ${name}` : "";
  return template.replace("{name}", namePart);
}

const DEFAULT_THOUGHT_PROMPTS = [
  "Build Friendships",
  "Financial Freedom",
  "Set & Track Goals",
  "Build Your Socials",
];

// 2026-06-11 (G: "RESTORE ALL CODE AND BUILD EVERYTHING"): lists are BACK for
// v2.1 — full-screen voice-list mode is the centerpiece of the voice/avatar
// separation. Lookup popups stay dormant (separate feature, no order yet).
const LIST_UI_DORMANT = false;
const LOOKUP_UI_DORMANT = true;

function keepExploreAiASAPLow(prompts: string[]): string[] {
  const explore = prompts.find((prompt) => /^explore\s+aiasap$/i.test(prompt));
  if (!explore) return prompts;
  return [
    ...prompts.filter((prompt) => !/^explore\s+aiasap$/i.test(prompt)),
    "Explore aiASAP",
  ];
}

type TapPromptFontVariant = "default" | "rounded" | "classic" | "condensed";

const TAP_PROMPT_FONT_OPTIONS: Record<TapPromptFontVariant, React.CSSProperties> = {
  default: {
    fontFamily:
      '"Trebuchet MS", "Avenir Next", "Segoe UI", system-ui, sans-serif',
  },
  rounded: {
    fontFamily:
      '"Arial Rounded MT Bold", "Trebuchet MS", "Avenir Next Rounded", sans-serif',
  },
  classic: {
    fontFamily: 'Georgia, "Times New Roman", serif',
  },
  condensed: {
    fontFamily: 'Impact, "Arial Black", "Arial Narrow", sans-serif',
    letterSpacing: "0.045em",
  },
};

// VOICE SIZING (2026-06-10): patterns + scale live in src/lib/uiSize.ts so
// the harness pins them (the 23:15 bug was an untested in-component regex
// rejecting 6's own coached words "make it bigger").

const getThoughtPrompts = (text: string): string[] => {
  const value = text.toLowerCase();

  // v1 keyword pool (2026-05-24): surfaces topics from G's 14-option pool
  // based on what 6 is talking about. Mechanism is keyword-driven; for truly
  // LLM-driven swaps see v2 runPromptBrain.

  if (
    value.includes("money") ||
    value.includes("income") ||
    value.includes("earn") ||
    value.includes("salary") ||
    value.includes("wage")
  ) {
    return [
      "Make More Money",
      "Build a Business",
      "Build Relationships",
      "Financial Freedom",
    ];
  }

  if (
    value.includes("business") ||
    value.includes("company") ||
    value.includes("startup") ||
    value.includes("venture") ||
    value.includes("hustle") ||
    value.includes("side gig")
  ) {
    return [
      "Build a Business",
      "Make More Money",
      "Build Relationships",
      "Market Yourself",
    ];
  }

  if (
    value.includes("partner") ||
    value.includes("dating") ||
    value.includes("spouse") ||
    value.includes("wife") ||
    value.includes("husband") ||
    value.includes("girlfriend") ||
    value.includes("boyfriend") ||
    value.includes("crush") ||
    value.includes("romance")
  ) {
    return [
      "Find Your Life Partner",
      "Build Relationships",
      "Build Friendships",
      "Set & Track Goals",
    ];
  }

  if (
    value.includes("friend") ||
    value.includes("lonely") ||
    value.includes("community") ||
    value.includes("meet people")
  ) {
    return [
      "Build Friendships",
      "Build Relationships",
      "Build Your Socials",
      "Build a Better Life",
    ];
  }

  if (
    value.includes("social media") ||
    value.includes("instagram") ||
    value.includes("tiktok") ||
    value.includes("youtube") ||
    value.includes("facebook") ||
    value.includes("brand") ||
    value.includes("content") ||
    value.includes("follower") ||
    value.includes("influencer")
  ) {
    return [
      "Build Your Socials",
      "Build Your Brand",
      "Market Yourself",
      "Make More Money",
    ];
  }

  if (
    value.includes("product") ||
    value.includes("inventory") ||
    value.includes("merchandise")
  ) {
    return [
      "Market Your Product",
      "Build a Business",
      "Build Your Brand",
      "Make More Money",
    ];
  }

  if (
    value.includes("service") ||
    value.includes("consulting") ||
    value.includes("freelance") ||
    value.includes("client") ||
    value.includes("customer")
  ) {
    return [
      "Market Your Service",
      "Build a Business",
      "Build Your Brand",
      "Make More Money",
    ];
  }

  if (
    value.includes("weekend") ||
    value.includes("saturday") ||
    value.includes("sunday")
  ) {
    return [
      "Plan Your Weekend",
      "Next Vacation Ideas",
      "Build Relationships",
      "Set & Track Goals",
    ];
  }

  if (
    value.includes("vacation") ||
    value.includes("trip") ||
    value.includes("travel") ||
    value.includes("getaway") ||
    value.includes("holiday")
  ) {
    return [
      "Next Vacation Ideas",
      "Plan Your Weekend",
      "Set & Track Goals",
      "Build a Better Life",
    ];
  }

  if (
    value.includes("goal") ||
    value.includes("achievement") ||
    value.includes("target") ||
    value.includes("milestone")
  ) {
    return [
      "Set & Track Goals",
      "Build a Better Life",
      "Financial Freedom",
      "Build Relationships",
    ];
  }

  if (
    value.includes("relationship") ||
    value.includes("argue") ||
    value.includes("fight") ||
    value.includes("apology") ||
    value.includes("family") ||
    value.includes("parent") ||
    value.includes("sibling")
  ) {
    return [
      "Build Relationships",
      "Build Friendships",
      "Set & Track Goals",
      "Build a Better Life",
    ];
  }

  if (
    value.includes("improve") ||
    value.includes("better") ||
    value.includes("change") ||
    value.includes("self-help") ||
    value.includes("self help") ||
    value.includes("grow")
  ) {
    return [
      "Build a Better Life",
      "Set & Track Goals",
      "Build Relationships",
      "Financial Freedom",
    ];
  }

  return DEFAULT_THOUGHT_PROMPTS;
};

function normalizeThoughtPrompts(prompts: string[]): string[] {
  const cleanThoughtPrompt = (prompt: string) => {
    const cleaned = prompt
      .trim()
      .replace(/\bAI\s+ASAP\b/g, "aiASAP")
      .replace(/\bai[-\s]?asap\b/gi, "aiASAP")
      .replace(/\bCreate\s+To\s+Do\s+List\b/gi, "To Do List")
      .replace(/\bactivities\b/gi, "plans")
      .replace(/\bactivity\b/gi, "plan")
      .replace(/\s+/g, " ");
    if (/^explore\s+aiasap$/i.test(cleaned)) return "Explore aiASAP";
    if (/^to\s+do\s+list$/i.test(cleaned)) return "To Do List";
    return cleaned;
  };
  const cleaned = prompts
    .map(cleanThoughtPrompt)
    .filter(Boolean)
    .filter((prompt) => !/\b(?:contact|named g|for g|call g|text g|email g)\b/i.test(prompt))
    .filter((prompt) => !/\b(?:reminder|remind|notify|notification)\b/i.test(prompt))
    .filter((prompt) => !/^add the next item$/i.test(prompt))
    .filter((prompt) => !/\b(?:reminder|remind|notify|notification)\b/i.test(prompt))
    .filter((prompt) => !/^(?:confirm understanding|review key points|check understanding|summarize conversation)$/i.test(prompt))
    .filter((prompt) => !/^share (?:my )?location$/i.test(prompt))
    .filter((prompt, index, all) => all.indexOf(prompt) === index)
    .filter((prompt) => !/^change subject$/i.test(prompt));
  return keepExploreAiASAPLow([...cleaned, ...DEFAULT_THOUGHT_PROMPTS])
    .filter((prompt, index, all) => all.indexOf(prompt) === index)
    .filter((prompt) => !/^add the next item$/i.test(prompt))
    .filter((prompt) => !/^(?:confirm understanding|review key points|check understanding|summarize conversation)$/i.test(prompt))
    .filter((prompt) => !/^share (?:my )?location$/i.test(prompt))
    .filter((prompt) => !/^change subject$/i.test(prompt))
    // r18 (G 12:46: "text got smaller... out of proportion... they changed
    // when I looked away"): the compact-pill font budgets the LONGEST visible
    // label — one rotated 19+-char brain prompt shrank every pill's text while
    // the width stayed put. The defaults max at 18; suggestions longer than
    // that get dropped (defaults backfill), so the font never jumps on rotation.
    .filter((prompt) => prompt.length <= 18)
    .slice(0, 4);
}

function isHikingLookupQuery(query: string | null | undefined): boolean {
  return Boolean(
    query &&
      /\b(?:hike|hikes|hiking|trail|trails|park|parks|walk|walking|outside|outdoor|outdoors|waterfall|waterfalls)\b/i.test(
        query,
      ),
  );
}

function isWeekendLookupQuery(query: string | null | undefined): boolean {
  return Boolean(
    query &&
      /\b(?:weekend|things to do|cool things|places to go|events?)\b/i.test(
        query,
      ),
  );
}

function getLookupLocationPrompts(query: string | null | undefined): string[] {
  if (isHikingLookupQuery(query)) {
    return normalizeThoughtPrompts([
      "Give ZIP Code",
      "Close Search",
      "Easy Local Hikes",
    ]);
  }
  if (/\b(?:weather|forecast)\b/i.test(query ?? "")) {
    return normalizeThoughtPrompts([
      "Give ZIP Code",
      "Close Search",
      "Enter City or ZIP",
    ]);
  }
  return normalizeThoughtPrompts([
    "Give ZIP Code",
    "Close Search",
    "Tell What I Like",
  ]);
}

function getLookupPreferencePrompts(
  query: string | null | undefined,
): string[] {
  if (isHikingLookupQuery(query)) {
    return normalizeThoughtPrompts([
      "Easy Hikes",
      "Hikes With Views",
      "Quiet Trails",
      "Close Search",
    ]);
  }
  return normalizeThoughtPrompts([
    "Share My Interests",
    "Find Cool Things",
    isWeekendLookupQuery(query) ? "Check Weekend Weather" : "Check the Weather",
    "Close Search",
  ]);
}

function getLookupPreferenceQuestion(query: string | null | undefined): string {
  if (isHikingLookupQuery(query)) {
    return "Got it. What are the things you really like to do?";
  }
  return "Got it. What are the things you really like to do?";
}

function isLookupPreferenceFiller(text: string): boolean {
  const cleaned = text
    .replace(/[^\p{L}0-9\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return (
    cleaned.length < 3 ||
    /^(?:i|and|um|uh|hmm|mm hmm|great|okay|ok|yeah|yes|no|they do|let me think|take your time)$/.test(
      cleaned,
    )
  );
}

type AssistantListKind = "grocery" | "shopping" | "todo" | "custom";
type ListDisplayStyle = "numbered" | "bulleted";
type ListAccentColor =
  | "amber"
  | "blue"
  | "green"
  | "rose"
  | "purple"
  | "white";

type AssistantList = {
  id: string;
  title: string;
  kind: AssistantListKind;
  items: string[];
  displayStyle: ListDisplayStyle;
  accentColor: ListAccentColor;
  accentHex?: string;
  accentLabel?: string;
  createdAt: number;
  updatedAt: number;
};

type DeviceProfile = {
  name: string | null;
  greetingCount: number;
  updatedAt: number;
};

type OnlineLookupSource = {
  title: string;
  url: string;
};

type MemoryConversationLine = {
  role: "user" | "assistant";
  text: string;
};

type AccountMemorySnapshot = {
  greetingTopic: string | null;
  contextText: string;
  name?: string | null;
  visitCount?: number;
  longGap?: boolean;
};

const ASSISTANT_LISTS_STORAGE_KEY = "aiasap.assistantLists.v1";
const ACCOUNT_PENDING_STATE_TOKEN_STORAGE_KEY =
  "aiasap.accountPendingStateToken.v1";
const DEVICE_PROFILE_STORAGE_KEY = "aiasap.deviceProfile.v1";
const MAX_LIST_ITEMS = 80;
const MAX_PROMPT_SIZE_LEVEL = UI_SIZE_MAX_LEVEL;
const LIST_TRIGGER_RE =
  /\b(grocery|groceries|shopping|store|walmart|list|todo|to-do|to do|task|lista|listas|compras|mercado|tarea|tareas|liste|courses|einkaufsliste|einkauf|aufgaben)\b/i;
const LIST_ITEM_PREFIX_RE =
  /^(?:(?:and|y|e|et|und)\s+)?(?:(?:i\s+)?(?:need|want|have to get|gotta get|should get|add|put|grab|buy|pick up)\s+|(?:necesito|quiero|agrega|agregar|anade|a\u00f1ade|poner|pon|compra|comprar)\s+|(?:j'?ai besoin de|je veux|ajoute|ajouter|achete|acheter)\s+|(?:ich brauche|ich will|fuege hinzu|f\u00fcge hinzu|hinzufuegen|hinzuf\u00fcgen|kauf|kaufen)\s+|(?:let'?s|lets)\s+(?:on\s+)?(?:(?:their|there|the|my|our)\s+)?|on\s+(?:(?:their|there|the|my|our)\s+)?|some\s+|a\s+|an\s+|the\s+)/i;
const LIST_COMMAND_ONLY_RE =
  /\b(?:make|create|start|open|show|switch to|pull up|go to|toggle|another|new|abre|abrir|muestra|mostrar|cambia|crear|crea|haz|hacer|ouvre|ouvrir|montre|affiche|wechsel|oeffne|\u00f6ffne|zeige)\b.*\b(?:list|todo|to-do|to do|lista|listas|liste|einkaufsliste)\b|\bput me on\b.*\b(?:list|walmart|grocery|shopping|todo|to-do|to do)\b/i;
const REMOVE_COMMAND_RE =
  /\b(?:remove|delete|get rid of|take off|take out|take\s+.{1,60}?(?:\s+off)?|cross off|cross out|check off|mark off|i got|got|grabbed|picked up|quita|quitar|elimina|eliminar|borra|borrar|tacha|tachar|ya tengo|j'?ai pris|retire|retirer|supprime|supprimer|enleve|enlever|loesche|l\u00f6sche|streiche|abhaken)\b/i;
const LIST_DELETE_RE =
  /\b(?:delete|get rid of|remove|trash|erase)\s+(?:the|my|this|that)?\s*(?:grocery|shopping|walmart|to[-\s]?do)?\s*(?:list|lists)\b|\b(?:delete|get rid of|remove|trash|erase)\s+(?:it|that|this)\b/i;
const LIST_NAV_NEXT_RE = /\b(?:next|another|toggle|switch)\s+list\b/i;
const LIST_NAV_PREV_RE = /\b(?:previous|prior|last|back)\s+list\b/i;
const LIST_STYLE_BULLET_RE = /\b(?:bullet|bullets|bullet points)\b/i;
const LIST_STYLE_NUMBER_RE = /\b(?:numbered|numbers|number list|numbered list)\b/i;
const LIST_DONE_RE =
  /\b(?:that'?s all|that is all|that'?s it|that is it|all done|done|finished|complete|nothing else|no more)\b/i;
// --- Data deletion / close-account (G 2026-06-07): 6 walks a SIGNED-IN user
// through erasing their data. DELETE_DATA_INTENT_RE catches the request;
// ACCOUNT_CLOSE_RE marks the heavier "close my account" scope; DELETE_CONFIRM/
// DELETE_CANCEL gate the irreversible step. ---
const DELETE_DATA_INTENT_RE = new RegExp(
  [
    "\\bforget me\\b",
    "\\bforget (?:everything|it all|all)(?: about me)?\\b",
    "\\b(?:delete|erase|wipe|remove|clear|get rid of)\\b[^.?!]{0,30}\\b(?:my )?(?:account|data|info|information|memory|memories|profile)\\b",
    "\\b(?:delete|erase|wipe|forget)\\b[^.?!]{0,30}\\beverything (?:you know|about me|i (?:told|gave) you|on me)\\b",
    "\\b(?:close|cancel|shut down|deactivate|delete)\\b[^.?!]{0,20}\\b(?:my )?account\\b",
    "\\b(?:delete|erase|wipe) (?:all )?my (?:data|info|information|stuff)\\b",
  ].join("|"),
  "i",
);
const ACCOUNT_CLOSE_RE =
  /\b(?:close|cancel|shut down|deactivate|delete|remove|get rid of)\b[^.?!]{0,20}\b(?:my )?account\b/i;
const DELETE_CONFIRM_RE =
  /\b(?:yes|yeah|yep|yup|do it|delete it|erase it|wipe it|go ahead|i'?m sure|go for it)\b/i;
const DELETE_CANCEL_RE =
  /\b(?:no|nope|nah|cancel|stop|don'?t|do not|keep it|keep everything|never mind|nevermind|wait|hold on|changed my mind|leave it|not now)\b/i;
// G 2026-06-08 false-close fix: a SIGNED-IN user COACHING 6 on wording ("you
// should say...", "they just have to confirm they want to close their account")
// must NEVER read as a real delete request OR a confirmation. This exact
// 3rd-person / instructional phrasing wrongly closed G's account - "confirm" hit
// DELETE_CONFIRM_RE and "close their account" hit DELETE_DATA_INTENT_RE.
const DELETE_COACHING_RE =
  /\b(?:you should|you could|you can say|you gotta|you'?ve got to|you have to|you need to|let them|they (?:just )?(?:have to|need to)|they do want|they want to|they don'?t|when (?:someone|somebody|a user|people|they)|for example|instead of|that'?s not well|i mean,? you|say something like|you say|their account)\b/i;
// --- Data export / download (G 2026-06-07): a signed-in user can ask for a copy
// of everything we hold on them, especially before deleting. DATA_EXPORT_INTENT_RE
// catches the request; the app does the fetch + browser download. ---
const DATA_EXPORT_INTENT_RE = new RegExp(
  [
    // Explicit DOWNLOAD/EXPORT requests only. A plain question like "what data do
    // you collect on me?" or "I'd like to SEE my data" must NOT email anything -
    // 6 answers those with info (G 2026-06-09 email flood). The send fires only
    // on a real download/copy ask, or the offered->yes path in the handler.
    "\\b(?:download|export)\\b[^.?!]{0,30}\\b(?:my )?(?:data|info|information|memory|memories|profile|stuff|everything)\\b",
    "\\b(?:get|grab|send me|give me|email me|send)\\b[^.?!]{0,24}\\b(?:a )?copy\\b",
    "\\b(?:download|export|email)\\b[^.?!]{0,16}\\b(?:link|copy)\\b",
    "\\bcan i\\b[^.?!]{0,20}\\b(?:download|export|save)\\b[^.?!]{0,20}\\b(?:my )?(?:data|info|information)\\b",
  ].join("|"),
  "i",
);
// (BACKCHANNEL_ONLY_RE removed 2026-06-04: v2.1 now yields the floor on ANY user
// speech while 6 is talking, matching the v1 domain build — see the unconditional
// `if (isAvatarTalking) void interrupt()` in handleUserTranscription.)
const ONLINE_LOOKUP_TOPIC_RE =
  /\b(?:hike|hikes|hiking|trail|trails|park|parks|walk|walking|outside|outdoor|outdoors|waterfall|waterfalls|weekend|cool things|things to do|places to go|place to go|weather|forecast|concert|concerts|show|shows|events?|restaurant|restaurants)\b/i;
const ONLINE_LOOKUP_ACTION_RE =
  /\b(?:find|look up|search|show me|where|nearby|near me|check|help me find|plan)\b/i;
const ONLINE_LOOKUP_DIRECT_RE =
  /\b(?:nearby|near me|where i am|weather|forecast|hike|hiking|trail|park|waterfall|waterfalls|weekend|cool things to do|concert|concerts|show|shows|events?|restaurants?)\b/i;
const LOCATION_HINT_RE =
  /\b(?:near|around|in|by|close to|outside of)\s+([a-z0-9][a-z0-9\s,.'-]{1,70})/i;
const LOCATION_SHARE_CHOICE_RE =
  /\b(?:share (?:my )?location|use (?:my )?location|current location|where i am|near me|around me)\b/i;
const SHOPPING_MODE_OPEN_RE =
  /\b(?:shopping mode|store mode|in the store|at the store|in the grocery store|at the grocery store|at walmart|in walmart|i'?m shopping|go shopping|shopping now|full screen list|make (?:the )?list full screen|open (?:the )?list full screen)\b/i;
const LIST_MUTATION_SIGNAL_RE =
  /\b(?:need|want|have to get|gotta get|should get|add|put|grab|buy|pick up|also|necesito|quiero|agrega|agregar|anade|a\u00f1ade|poner|pon|compra|comprar|tambien|tambi\u00e9n|j'?ai besoin de|je veux|ajoute|ajouter|achete|acheter|aussi|ich brauche|ich will|fuege|f\u00fcge|hinzufuegen|hinzuf\u00fcgen|kauf|kaufen|auch)\b/i;
const LIST_START_WITH_REFERENCED_ITEMS_RE =
  /\b(?:start|make|create)\s+(?:a\s+)?list\s+with\s+(?:those|these|them|that)\b|\badd\s+(?:those|these|them|that)\s+(?:to|on)\s+(?:a\s+|the\s+)?list\b/i;
const LIST_CONVERSATION_FRAGMENT_RE =
  /\b(?:i mean|i know|you know|all those|all kinds of|did you|do you|didn'?t|am i|are they|they'?re|they are|what do you mean|ready to check out|check out|not on|put them on|put some on there|just put|on there|that'?s what|you mean|what are you|what is|what's|so close|close to be|close to being|for the record|for the records|made it|he just|she just|they just|it just|we just|it ought|it should|it would|the system|the system automatically)\b/i;
const LIST_NAME_CAPTURE_INTENT_RE =
  /\b(?:my name (?:is|'?s)|(?:i'?m|i am) called|you can call me)\b/i;
const LIST_MID_SENTENCE_DASH_RE = /[–—]/;
const LIST_FILLER_ITEM_RE =
  /^(?:no|nothing|that's all|that is all|anything else|yeah|yep|yes|ok|okay|sure|go ahead|great|thanks|thank you|i mean|i know|you know|i guess|actually|together|let'?s|lets|let'?s make|let'?s make a|make it|make it black|even darker|darker|lighter|half|some half|a couple more|couple more|a couple more things|couple more things|a few more|few more|more things|i need|i need half|i want|i want some|just put some on there|put some on there|some on there|on there|some|screenshot|screen shot|voice|voices|voz|all those|it|that|this|them|they|those|these|the|to|and|me|me on|god|got|well|so|you|six|avatar|stop|close|end|quit|exit|letter g|grocery|groceries|shopping|walmart|list|i have a grocery|take i have a grocery|a dad|that to)$/i;
const LIST_VAGUE_BARE_ITEM_RE =
  /\b(?:stuff|things|thing|whatever|all kinds)\b/i;

const LIST_ACCENT_COLORS: Record<
  ListAccentColor,
  { label: string; foreground: string; solid: string; soft: string }
> = {
  amber: {
    label: "Amber",
    foreground: "#e8b46b",
    solid: "#e8b46b",
    soft: "rgba(232, 180, 107, 0.2)",
  },
  blue: {
    label: "Blue",
    foreground: "#8ec5ff",
    solid: "#8ec5ff",
    soft: "rgba(142, 197, 255, 0.2)",
  },
  green: {
    label: "Green",
    foreground: "#86efac",
    solid: "#86efac",
    soft: "rgba(134, 239, 172, 0.2)",
  },
  rose: {
    label: "Rose",
    foreground: "#fda4af",
    solid: "#fda4af",
    soft: "rgba(253, 164, 175, 0.2)",
  },
  purple: {
    label: "Purple",
    foreground: "#c4b5fd",
    solid: "#c4b5fd",
    soft: "rgba(196, 181, 253, 0.2)",
  },
  white: {
    label: "White",
    foreground: "#f8fafc",
    solid: "#f8fafc",
    soft: "rgba(248, 250, 252, 0.18)",
  },
};

type ListColorTheme = {
  label: string;
  foreground: string;
  solid: string;
  soft: string;
};

type ListAccentUpdate = {
  accentColor: ListAccentColor;
  accentHex?: string;
  accentLabel?: string;
};

const CUSTOM_LIST_COLOR_MAP: Record<string, string> = {
  amber: "#e8b46b",
  black: "#050505",
  blue: "#8ec5ff",
  brown: "#b8895b",
  coral: "#ff9f8c",
  cyan: "#67e8f9",
  gold: "#f5c76f",
  gray: "#d1d5db",
  green: "#86efac",
  grey: "#d1d5db",
  indigo: "#a5b4fc",
  lavender: "#c4b5fd",
  lime: "#bef264",
  mint: "#99f6e4",
  navy: "#7aa7ff",
  orange: "#fdba74",
  pink: "#f9a8d4",
  purple: "#d8b4fe",
  red: "#fca5a5",
  rose: "#fda4af",
  silver: "#e5e7eb",
  teal: "#5eead4",
  violet: "#c4b5fd",
  white: "#ffffff",
  yellow: "#fde68a",
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function adjustHexShade(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const target = amount >= 0 ? 255 : 0;
  const ratio = Math.abs(amount);
  return rgbToHex(
    rgb.r + (target - rgb.r) * ratio,
    rgb.g + (target - rgb.g) * ratio,
    rgb.b + (target - rgb.b) * ratio,
  );
}

function softFromHex(hex: string, alpha = 0.2): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "rgba(232, 180, 107, 0.2)";
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function listColorThemeFor(_list: AssistantList | null): ListColorTheme {
  return LIST_ACCENT_COLORS.amber;
}

function titleCaseWords(value: string): string {
  return value
    .replace(/\bto[-\s]?do\b/gi, "To Do")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (/^walmart$/i.test(word)) return "Walmart";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function normalizeListTitle(value: string, kind: AssistantListKind): string {
  const cleaned = value
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\b(?:the|my|a|an)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (kind === "grocery") return "Grocery List";
  if (kind === "shopping") {
    return /^walmart\b/i.test(cleaned) ? "Walmart List" : "Shopping List";
  }
  if (kind === "todo") {
    const scope = cleaned
      .replace(/\b(?:todo|to-do|to do|task|tasks|list)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return scope ? `${titleCaseWords(scope)} To Do List` : "To Do List";
  }

  const withoutList = cleaned.replace(/\blist\b/gi, " ").trim();
  return withoutList ? `${titleCaseWords(withoutList)} List` : "New List";
}

function listIdForTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "new-list";
}

function isAssistantList(value: unknown): value is AssistantList {
  if (!value || typeof value !== "object") return false;
  const maybe = value as AssistantList;
  return (
    typeof maybe.id === "string" &&
    typeof maybe.title === "string" &&
    Array.isArray(maybe.items) &&
    maybe.items.every((item) => typeof item === "string") &&
    (!maybe.accentHex || typeof maybe.accentHex === "string") &&
    (!maybe.accentLabel || typeof maybe.accentLabel === "string")
  );
}

function cleanStoredListItems(items: string[]): string[] {
  const seen = new Set<string>();
  return items
    .map((item) => cleanListItem(item))
    .filter((item): item is string => Boolean(item))
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_LIST_ITEMS);
}

function loadAssistantLists(): AssistantList[] {
  if (typeof window === "undefined") return [];
  try {
    window.localStorage.removeItem(ASSISTANT_LISTS_STORAGE_KEY);
  } catch {
    // Ignore storage failures. Anonymous sessions should still start clean.
  }
  return [];
}

function emptyDeviceProfile(): DeviceProfile {
  return { name: null, greetingCount: 0, updatedAt: Date.now() };
}

function loadDeviceProfile(): DeviceProfile {
  if (typeof window === "undefined") return emptyDeviceProfile();
  try {
    window.localStorage.removeItem(DEVICE_PROFILE_STORAGE_KEY);
  } catch {
    // Anonymous sessions should not inherit device memory.
  }
  return emptyDeviceProfile();
}

function storeDeviceProfile(profile: DeviceProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DEVICE_PROFILE_STORAGE_KEY);
  } catch {
    // Anonymous device memory is intentionally disabled.
  }
}


function isListRoutingOnlyCommand(text: string): boolean {
  const value = text.trim().toLowerCase();
  if (/\bput me on\b.*\b(?:list|walmart|grocery|shopping|todo|to-do|to do)\b/i.test(value)) {
    return true;
  }
  if (
    /\b(?:open|show|switch to|pull up|go to|abre|abrir|muestra|mostrar|cambia a|ouvre|ouvrir|montre|affiche|wechsel|oeffne|\u00f6ffne|zeige)\b.*\b(?:list|walmart|grocery|shopping|todo|to-do|to do|lista|listas|compras|mercado|liste|courses|einkaufsliste|einkauf)\b/i.test(
      value,
    )
  ) {
    return !LIST_MUTATION_SIGNAL_RE.test(value);
  }
  if (
    /\b(?:start|make|create|new|crear|crea|haz|hacer|nueva|nouvelle|neue)\b.*\b(?:list|walmart|grocery|shopping|todo|to-do|to do|lista|listas|compras|mercado|liste|courses|einkaufsliste|einkauf)\b/i.test(
      value,
    )
  ) {
    return !/\b(?:with|con|avec|mit)\b/i.test(value) && !LIST_MUTATION_SIGNAL_RE.test(value);
  }
  return false;
}

function shouldStartFreshList(text: string): boolean {
  const value = text.toLowerCase();
  if (/\b(?:open|show|pull up|continue|resume|saved|old|existing|last|abre|abrir|muestra|continua|contin\u00faa|sigue|guardada|vieja|existente|ouvre|ouvrir|montre|continue|enregistree|enregistr\u00e9e|alt|gespeichert|weiter)\b/i.test(value)) {
    return false;
  }
  return /\b(?:start|make|create|new|i need|i want|crear|crea|haz|hacer|nueva|necesito|quiero|nouvelle|creer|cr\u00e9er|neue|ich brauche)\b.*\b(?:list|walmart|grocery|shopping|todo|to-do|to do|lista|listas|compras|mercado|liste|courses|einkaufsliste|einkauf)\b/i.test(
    value,
  );
}

function correctListItem(item: string): string {
  if (/^unions$/i.test(item)) return "Onions";
  return item;
}


function cleanMemoryText(value: unknown, maxLength = 240): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function cleanMemoryConversation(
  value: unknown,
): MemoryConversationLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item): MemoryConversationLine[] => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const role = row.role === "assistant" ? "assistant" : row.role === "user" ? "user" : null;
      const text = cleanMemoryText(row.text, 220);
      return role && text ? [{ role, text }] : [];
    })
    .slice(-30);
}


function summarizeMemoryTopic(value: string | null): string | null {
  if (!value) return null;
  return summarizeOnlineLookupTopic(value)
    .replace(/^that$/i, "where we left off")
    .slice(0, 80);
}

// A returning user has ALREADY finished signup. Resume context captured
// mid-signup ("Before I send the account email…", "spell your email", "magic
// link", "is that email address correct") must NOT be replayed — doing so makes
// 6 re-offer signup + re-send the link to someone already signed in (the "not
// smooth" returning bleed, found 2026-06-03 via the start-session DIAG log).
const ACCOUNT_SETUP_RESUME_RE =
  /\b(account email|magic link|spell (?:your |the )?email|email address|first time signing up|already have an account|signing up|set(?:ting)? up (?:your |an )?account|send (?:you |the )?(?:the )?link)\b/i;
function isAccountSetupResumeLine(text: string | null | undefined): boolean {
  return Boolean(text) && ACCOUNT_SETUP_RESUME_RE.test(text as string);
}

function buildAccountMemorySnapshot(args: {
  lists: AssistantList[];
  resumeState: Record<string, unknown> | null;
  restoredList: AssistantList | null;
  onlineQuery: string | null;
  onlineLocation: string | null;
  name: string | null;
  visitCount: number;
  longGap: boolean;
}): AccountMemorySnapshot | null {
  const rawLastUserText = cleanMemoryText(args.resumeState?.lastUserText);
  const rawLastAssistantText = cleanMemoryText(
    args.resumeState?.lastAssistantText,
  );
  // Drop signup-phase lines so a returning (already signed-in) user never gets
  // 6 resuming the account-setup offer.
  const lastUserText = isAccountSetupResumeLine(rawLastUserText)
    ? null
    : rawLastUserText;
  const lastAssistantText = isAccountSetupResumeLine(rawLastAssistantText)
    ? null
    : rawLastAssistantText;
  const recentConversation = cleanMemoryConversation(
    args.resumeState?.recentConversation,
  ).filter((line) => !isAccountSetupResumeLine(line.text));
  const listSummaries = args.lists.slice(0, 5).map((list) => {
    const items = list.items.slice(0, 6).join(", ");
    return `${list.title}${items ? `: ${items}` : ""}`;
  });
  const topic =
    (args.restoredList ? `your ${args.restoredList.title}` : null) ??
    summarizeMemoryTopic(args.onlineQuery) ??
    summarizeMemoryTopic(lastUserText) ??
    (args.lists[0] ? `your ${args.lists[0].title}` : null);
  const contextParts = [
    lastUserText ? `Last user message: ${lastUserText}` : null,
    lastAssistantText ? `Last 6 response: ${lastAssistantText}` : null,
    args.onlineQuery
      ? `Recent online lookup: ${summarizeOnlineLookupTopic(args.onlineQuery)}${
          args.onlineLocation ? ` near ${args.onlineLocation}` : ""
        }`
      : null,
    recentConversation.length > 0
      ? `Recent conversation: ${recentConversation
          .map((line) => `${line.role}: ${line.text}`)
          .join(" | ")}`
      : null,
    listSummaries.length > 0
      ? `Saved lists available if the user asks: ${listSummaries.join(" | ")}`
      : null,
  ].filter(Boolean);

  if (contextParts.length === 0) return null;
  return {
    greetingTopic: topic,
    contextText: [
      // Identity rides the SAME reliable channel as the memory (the CW dynamic
      // vars ${user_name}/${user_signed_in} were NOT reaching 6 — he kept asking
      // the name and saying "pleasure to meet you" to a returning user, G
      // 2026-06-03). Put it here so 6 actually knows who he's talking to.
      args.name
        ? `IDENTITY: You are talking with ${args.name}, a returning user who is ALREADY SIGNED IN with a COMPLETE account. Greet them by name like a friend picking back up. Do NOT ask their name, do NOT say "pleasure to meet you," and do NOT ask them to sign up or for their email - that is already done.`
        : `IDENTITY: This is a returning user, ALREADY SIGNED IN with a COMPLETE account. Do NOT say "pleasure to meet you" and do NOT ask them to sign up or for their email - that is already done. Their name isn't on file; you may ask it once, warmly.`,
      "SIGNED-IN USER MEMORY. Use this quietly so the conversation feels like friends picking back up.",
      "Do not recite this memory dump. Do not reopen lists, search, location, or other UI unless the user asks.",
      ...contextParts,
    ].join("\n"),
    name: args.name,
    visitCount: args.visitCount,
    longGap: args.longGap,
  };
}

function buildReturningGreeting(
  profile: DeviceProfile,
  memory: AccountMemorySnapshot | null,
): string {
  const name = memory?.name ?? profile.name ?? null;
  const visitCount = memory?.visitCount ?? 1;
  const longGap = memory?.longGap ?? false;
  return pickReturningGreeting(name, visitCount, longGap);
}

function cleanListItem(
  value: string,
  options: { fromExplicitCommand?: boolean } = {},
): string | null {
  if (/[?]/.test(value) || LIST_CONVERSATION_FRAGMENT_RE.test(value)) {
    return null;
  }
  if (LIST_NAME_CAPTURE_INTENT_RE.test(value)) return null;
  if (LIST_MID_SENTENCE_DASH_RE.test(value)) return null;

  const item = value
    .replace(/^let'?s work on this next:\s*/i, "")
    .replace(/\b(?:i need|i want|i'd like|id like)\s+(?:a\s+)?(?:grocery|shopping|walmart|to[-\s]?do|todo)?\s*list\b/gi, " ")
    .replace(/\b(?:for when i go to the grocery store|you mentioned creating an account|take the grocery list off the screen|take grocery list off the screen)\b/gi, " ")
    .replace(/\b(?:just\s+)?put\s+some\s+on\s+there\b/gi, " ")
    .replace(/\bi\s+know\b/gi, " ")
    .replace(/^(?:let'?s|lets)\s+(?:on\s+)?(?:(?:their|there|the|my|our)\s+)?/i, "")
    .replace(/^on\s+(?:(?:their|there|the|my|our)\s+)?/i, "")
    .replace(/\bfor\s+tacos?\b/gi, (match) =>
      value.trim().toLowerCase() === match.toLowerCase() ? "Taco Stuff" : " ",
    )
    .replace(/\b(?:um|uh|like|please|por favor|s'il vous plait|s'il vous pla\u00eet|bitte)\b/gi, " ")
    .replace(/\b(?:okay|ok|the things that|things that|things|are|from|off|grocery|groceries|shopping|walmart|list|my list|the list|lista|listas|mi lista|la lista|liste|ma liste|meine liste)\b/gi, " ")
    .replace(LIST_ITEM_PREFIX_RE, "")
    .replace(/\b(?:i\s+)?(?:need|want|would like|like|have to get|gotta get|should get|add|put|grab|buy|pick up)\s+/gi, " ")
    .replace(
      /^(?:and\s+)?(?:i\s+)?(?:need|want|would like|like|have to get|gotta get|should get|add|put|grab|buy|pick up)\s+/i,
      "",
    )
    .replace(/^(?:some|a|an|the|their|there|my|our|el|la|los|las|un|una|le|la|les|des|du|der|die|das|ein|eine)\s+/i, "")
    // r32 (G live 2026-06-12 20:48: "rice and yogurt ON the list" \u2192 item
    // "Yogurt on"; "put yogurt as the next thing on the list" \u2192 the whole
    // phrase): dangling tails are never part of a grocery item.
    .replace(/\s+as the next thing(?:\s+on)?\s*$/i, "")
    .replace(/\s+(?:on|off|onto|to|from|in)\s*(?:the|this|that|my|there|here)?\s*$/i, "")
    .replace(/[.!?]+$/g, "")
    .replace(/^[\s,.;:\-\u2013\u2014]+|[\s,.;:\-\u2013\u2014]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (item.length < 2 || item.length > 42) return null;
  const normalizedItemKey = item
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (
    /^(?:cose|cos|close|stop|avatar|six|6|to|the|and|great|thanks|thankyou|iknow|together|lets|letsmake|letsmakea|makeit|makeitblack|evendarker|darker|lighter|half|ineed|ineedhalf|somehalf|iwant|iwantsome|justputsomeonthere|putsomeonthere|someonthere|onthere|some|me|meon)$/.test(
      normalizedItemKey,
    )
  ) {
    return null;
  }
  if (LIST_FILLER_ITEM_RE.test(item)) return null;
  if (!options.fromExplicitCommand && LIST_VAGUE_BARE_ITEM_RE.test(item)) {
    return null;
  }
  if (
    /\b(?:am|are|is|was|were|did|do|does|mean|ready|checkout|check out)\b/i.test(
      item,
    ) &&
    !LIST_MUTATION_SIGNAL_RE.test(value)
  ) {
    return null;
  }
  if (LIST_COMMAND_ONLY_RE.test(item)) return null;

  const corrected = correctListItem(item);
  return corrected.charAt(0).toUpperCase() + corrected.slice(1);
}

function canInferListItems(
  text: string,
  options: { allowBareItems?: boolean } = {},
): boolean {
  if (isInternalSignal(text) || LIST_COMMAND_ONLY_RE.test(text)) return false;
  if (LIST_NAME_CAPTURE_INTENT_RE.test(text)) return false;
  if (LIST_MID_SENTENCE_DASH_RE.test(text)) return false;
  if (hasEndSessionIntent(text)) return false;
  if (isListRoutingOnlyCommand(text)) return false;
  if (REMOVE_COMMAND_RE.test(text)) return false;
  if (detectListAccentUpdate(text, null)) return false;
  if (/[?]/.test(text) || LIST_CONVERSATION_FRAGMENT_RE.test(text)) return false;
  const hasExplicitMutation = LIST_MUTATION_SIGNAL_RE.test(text);
  if (LIST_TRIGGER_RE.test(text) && !hasExplicitMutation) return false;
  if (hasExplicitMutation) return true;
  if (!options.allowBareItems) return false;
  if (/[,;\n]|\band\b/i.test(text)) return true;
  const cleaned = cleanListItem(text);
  if (!cleaned) return false;
  return cleaned.split(/\s+/).length <= 3;
}

function isOnlineLookupIntent(text: string): boolean {
  if (!ONLINE_LOOKUP_TOPIC_RE.test(text)) return false;
  if (ONLINE_LOOKUP_ACTION_RE.test(text)) return true;
  if (ONLINE_LOOKUP_DIRECT_RE.test(text)) return true;
  return false;
}

function shouldAskPreferencesBeforeLookup(query: string): boolean {
  if (
    /\b(?:weather|forecast|concert|concerts|show|shows|waterfall|waterfalls|hike|hikes|hiking|trail|trails|park|parks|restaurant|restaurants)\b/i.test(
      query,
    )
  ) {
    return false;
  }
  return /\b(?:weekend|things to do|cool things|places to go|place to go|plan)\b/i.test(
    query,
  );
}

function summarizeOnlineLookupTopic(query: string): string {
  const cleaned = query
    .replace(/^let'?s work on this next:\s*/i, "")
    .replace(/\b(?:actually|you know what|um|uh|okay|ok|please)\b/gi, " ")
    .replace(/\b(?:can you|could you|help me|i want to|i need to|let'?s)\b/gi, " ")
    .replace(/\b(?:plan this weekend|this weekend)\b/gi, "this weekend")
    .replace(/\bactivities\b/gi, "plans")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 56)
    .replace(/[.?!,;:]+$/g, "");
  if (/\bweather|forecast\b/i.test(query)) return "weather";
  if (/\bweekend\b/i.test(query)) return "this weekend";
  if (/\b(?:waterfall|waterfalls)\b/i.test(query)) return "waterfalls";
  if (/\b(?:hike|hiking|trail)\b/i.test(query)) return "local hikes";
  if (/\bparks?\b/i.test(query)) return "local parks";
  if (/\b(?:concert|concerts|show|shows)\b/i.test(query)) return "concerts";
  return cleaned || "that";
}

function isListDoneSignal(userText: string, lastAssistantText: string): boolean {
  const text = userText.trim();
  if (LIST_DONE_RE.test(text)) return true;
  return (
    /^(?:no|nope|nah)$/i.test(text) &&
    /\b(?:anything else|what else|add anything|need anything else|want anything else)\b/i.test(
      lastAssistantText,
    )
  );
}

function extractLocationHint(text: string): string | null {
  const direct = text.match(/\b\d{5}(?:-\d{4})?\b/)?.[0] ?? null;
  if (direct) return direct;
  const match = text.match(LOCATION_HINT_RE);
  if (!match?.[1]) return null;
  const cleaned = match[1]
    .replace(/\b(?:for|to|that|this|please|today|tomorrow|weekend|hike|hiking|trail|trails|park|parks|place|places|activity|activities)\b.*$/i, "")
    .replace(/[^\w\s,.'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/^(?:me|here|my area|current location|where i am)$/i.test(cleaned)) {
    return null;
  }
  return cleaned.length >= 2 ? cleaned.slice(0, 80) : null;
}

function isLikelyTypedLocation(text: string): boolean {
  const value = text.trim();
  if (value.length < 2 || value.length > 80) return false;
  if (/[?]/.test(value)) return false;
  if (LOCATION_SHARE_CHOICE_RE.test(value)) return false;
  if (ACCOUNT_READY_YES_RE.test(value) || ACCOUNT_READY_NO_RE.test(value)) {
    return false;
  }
  return /\b\d{5}(?:-\d{4})?\b/.test(value) || /^[a-z][a-z\s,.'-]+$/i.test(value);
}

function soundsLikeInvalidZipCode(text: string): boolean {
  const value = text.trim();
  if (!/\d/.test(value)) return false;
  if (/\b\d{5}(?:-\d{4})?\b/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length > 0 && digits.length < 5;
}

const ZIP_LOCATION_OVERRIDES: Record<string, string> = {
  "21093": "Timonium, MD 21093",
};

function normalizeLookupLocation(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  const zip = cleaned.match(/\b\d{5}(?:-\d{4})?\b/)?.[0]?.slice(0, 5);
  if (zip && ZIP_LOCATION_OVERRIDES[zip]) return ZIP_LOCATION_OVERRIDES[zip];
  return cleaned;
}

function cleanOnlineLookupLine(value: string): string | null {
  const cleaned = value
    .replace(/^#+\s*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\*\*/g, "")
    .replace(/\bEllicott City,?\s+MD\b(?=.*\b21093\b)/gi, "Timonium, MD")
    .replace(/,\s*Low:.*$/i, "")
    .replace(/,\s*High:\s*/i, ", ")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*\([^)]*$/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,.()\-–—]+|[\s:;,.()\-–—]+$/g, "")
    .trim();
  if (!cleaned) return null;
  if (
    /^(?:here are|here is|i found|these are|some options|events? happening|weather for|current conditions)\b/i.test(
      cleaned,
    )
  ) {
    return null;
  }
  return cleaned.length > 92 ? `${cleaned.slice(0, 89).trim()}...` : cleaned;
}

function getOnlineLookupResultLines(answer: string): string[] {
  const numberedSegments = answer
    .replace(/\r/g, "")
    .split(/\n+|(?=\b\d{1,2}[.)]\s+)/)
    .map((line) =>
      line
        .replace(/^\s*(?:[-*]|\d{1,2}[.)])\s*/, "")
        .replace(/\s+/g, " "),
    )
    .map(cleanOnlineLookupLine)
    .filter((line): line is string => Boolean(line));
  return (numberedSegments.length > 1 ? numberedSegments : [answer.trim()])
    .map(cleanOnlineLookupLine)
    .filter((line): line is string => Boolean(line))
    .slice(0, 3);
}

function formatOnlineLookupSpeech(lines: string[], query: string): string {
  // v1: LOOKUP_UI_DORMANT — no on-screen popup. 6 says results verbally instead.
  if (lines.length === 0) {
    return "I found a few options. Want me to narrow them down?";
  }
  if (/\b(?:weather|forecast)\b/i.test(query)) {
    return "Here is the weekend weather. Want me to use that to pick the best day?";
  }
  return `I have got ${lines.length} ideas for you. Want me to walk through them?`;
}

function extractListItems(
  text: string,
  options: { allowBareItems?: boolean } = {},
): string[] {
  if (!canInferListItems(text, options)) return [];
  const fromExplicitCommand = LIST_MUTATION_SIGNAL_RE.test(text);

  const normalized = text
    .replace(/\b(?:and then|also|tambien|tambi\u00e9n|aussi|auch)\b/gi, ",")
    .replace(/\b(?:i need|i want|add|grab|buy|pick up|necesito|quiero|agrega|agregar|anade|a\u00f1ade|comprar|compra|j'?ai besoin de|je veux|ajoute|ajouter|acheter|achete|ich brauche|ich will|fuege|f\u00fcge|kauf|kaufen)\b/gi, ", $&")
    .replace(/\s+/g, " ");

  return normalized
    .split(/[,.;\n]|\b(?:and|y|e|et|und)\b/gi)
    .map((item) => cleanListItem(item, { fromExplicitCommand }))
    .filter((item): item is string => Boolean(item));
}

function extractReferencedAssistantListItems(text: string): string[] {
  const listText = text
    .replace(/\b(?:how does that sound|want to add|should i start|anything else)\b[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const matches = [...listText.matchAll(/\b\d+\.\s*([^0-9]+?)(?=\s+\d+\.|$)/g)];
  const items = matches
    .map((match) => cleanListItem(match[1] ?? "", { fromExplicitCommand: true }))
    .filter((item): item is string => Boolean(item));
  return [...new Set(items)].slice(0, 20);
}

function formatListItemsForSpeech(items: string[]): string {
  const cleanItems = items.filter(Boolean);
  if (cleanItems.length === 0) return "that";
  if (cleanItems.length === 1) return cleanItems[0];
  if (cleanItems.length === 2) return `${cleanItems[0]} and ${cleanItems[1]}`;
  const shown = cleanItems.slice(0, 3).join(", ");
  const remaining = cleanItems.length - 3;
  return remaining > 0 ? `${shown}, and ${remaining} more` : shown;
}

function cleanRemoveListItem(value: string): string | null {
    const item = value
    .replace(/\b(?:from|off|the|my|this|that|list|got it|i got it|de|del|la|el|mi|esta|ese|eso|lista|liste|ma|meine)\b/gi, " ")
    .replace(/\b(?:um|uh|like|please|okay|ok|por favor|s'il vous plait|s'il vous pla\u00eet|bitte)\b/gi, " ")
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "")
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (item.length < 2 || item.length > 60) return null;
  if (
    /^(?:it|that|this|them|they|those|these|nothing|anything else|add|need|want|some|half|i need|i want|i know|just put some on there|put some on there)$/i.test(
      item,
    )
  ) {
    return null;
  }
  return correctListItem(item.charAt(0).toUpperCase() + item.slice(1));
}

function extractRemoveItems(text: string): string[] {
  if (isInternalSignal(text) || !REMOVE_COMMAND_RE.test(text)) return [];

  const normalized = text
    .replace(
      /\btake\s+(.{1,60}?)\s+off(?:\s+(?:the|my|this|that)?\s*(?:grocery|shopping|walmart|to[-\s]?do)?\s*list)?\b/gi,
      ", $1 ",
    )
    .replace(/\btake\s+(.{1,60}?)(?:$|[.?!,;]|\s+please\b)/gi, ", $1 ")
    .replace(
      /\b(?:remove|delete|get rid of|take off|take out|cross off|cross out|check off|mark off|i got|got|grabbed|picked up|quita|quitar|elimina|eliminar|borra|borrar|tacha|tachar|ya tengo|j'?ai pris|retire|retirer|supprime|supprimer|enleve|enlever|loesche|l\u00f6sche|streiche|abhaken)\b/gi,
      ",",
    )
    .replace(/\b(?:from|off|the|my|this|that|list|i got it|got it|de|del|la|el|mi|esta|ese|eso|lista|liste|ma|meine)\b/gi, " ")
    .replace(/\s+/g, " ");

  return normalized
    .split(/[,.;\n]|\b(?:and|y|e|et|und)\b/gi)
    .map(cleanRemoveListItem)
    .filter((item): item is string => Boolean(item));
}

function detectListIntent(text: string): {
  title: string;
  kind: AssistantListKind;
} | null {
  if (isInternalSignal(text)) return null;
  const value = text.toLowerCase();

  if (/\bwalmart\b/.test(value)) {
    return { title: "Walmart List", kind: "shopping" };
  }

  if (/\b(?:tarea|tareas|pendientes)\b/i.test(text)) {
    return { title: "Lista de tareas", kind: "todo" };
  }

  if (/\b(?:compras|mercado|supermercado)\b/i.test(text)) {
    return { title: "Lista de compras", kind: "grocery" };
  }

  if (/\b(?:tache|taches|t\u00e2che|t\u00e2ches)\b/i.test(text)) {
    return { title: "Liste de taches", kind: "todo" };
  }

  if (/\bcourses\b/i.test(text)) {
    return { title: "Liste de courses", kind: "grocery" };
  }

  if (/\b(?:einkaufsliste|einkauf)\b/i.test(text)) {
    return { title: "Einkaufsliste", kind: "grocery" };
  }

  if (/\b(?:aufgaben|aufgabenliste)\b/i.test(text)) {
    return { title: "Aufgabenliste", kind: "todo" };
  }

  if (/\bgrocer(?:y|ies)\b/.test(value)) {
    return { title: "Grocery List", kind: "grocery" };
  }

  if (/\b(?:things to do|able to)\b/i.test(text)) {
    return null;
  }

  const articleNamedList = text.match(
    /\b(?:a|an|the|my|our)\s+([a-z][a-z0-9'-]{1,24})\s+list\b/i,
  )?.[1];
  if (
    articleNamedList &&
    !/^(?:grocery|shopping|todo|to|do|new|another|first|second|third|fourth|fifth)$/i.test(
      articleNamedList,
    )
  ) {
    return { title: `${articleNamedList} List`, kind: "custom" };
  }

  const todoScope =
    text.match(/\b(?:to[-\s]?do|todo|task)s?\s+(?:list\s+)?([a-z][a-z0-9'-]{1,24})\b/i)?.[1] ??
    text.match(/\b([a-z][a-z0-9'-]{1,24})\s+(?:to[-\s]?do|todo|tasks?)\b/i)?.[1] ??
    null;
  const cleanTodoScope =
    todoScope &&
    !/^(?:a|an|and|for|from|my|of|or|our|the|then|to|your|make|turn|green|blue|black|white|pink|purple|red|yellow|orange|lighter|darker)$/i.test(
      todoScope,
    )
      ? todoScope
      : null;

  if (/\b(?:to[-\s]?do|todo|tasks?)\b/i.test(text)) {
    return {
      title: cleanTodoScope ? `${titleCaseWords(cleanTodoScope)} To Do List` : "To Do List",
      kind: "todo",
    };
  }

  const ordinalList = text.match(
    /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+list\b/i,
  )?.[1];
  if (ordinalList) {
    return { title: `${ordinalList} List`, kind: "custom" };
  }

  const namedList = text.match(
    /\b(?:open|show|switch to|pull up|go to|create|make|start|new)\s+(?:a|an|the|my|another)?\s*([a-z][a-z0-9' -]{1,28})\s+list\b/i,
  )?.[1];
  if (namedList) {
    return { title: `${namedList} List`, kind: "custom" };
  }

  const nativeNamedList =
    text.match(
      /\b(?:abre|abrir|muestra|mostrar|cambia a|crear?|crea|haz|hacer|nueva|ouvre|ouvrir|montre|affiche|creer|cr\u00e9er|nouvelle|oeffne|\u00f6ffne|zeige|neue)\s+(?:la|mi|una|un|otra|le|ma|une|die|meine|eine)?\s*lista\s+(?:de\s+)?([\p{L}0-9' -]{1,28})\b/iu,
    )?.[1] ??
    text.match(/\blista\s+(?:de\s+)?([\p{L}0-9' -]{1,28})\b/iu)?.[1] ??
    text.match(/\bliste\s+(?:de\s+)?([\p{L}0-9' -]{1,28})\b/iu)?.[1];
  if (nativeNamedList) {
    const name = titleCaseWords(nativeNamedList.trim());
    if (/\blista\b/i.test(text)) return { title: `Lista de ${name}`, kind: "custom" };
    if (/\bliste\b/i.test(text)) return { title: `Liste de ${name}`, kind: "custom" };
  }

  if (/\banother\s+list\b/i.test(text)) {
    return { title: "New List", kind: "custom" };
  }

  if (/\bshopping\s+list\b/i.test(text)) {
    return { title: "Shopping List", kind: "shopping" };
  }

  return null;
}

function itemKeysMatch(a: string, b: string): boolean {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}0-9\s]/gu, " ")
      .replace(/\b(?:a|an|the|some|el|la|los|las|un|una|le|les|des|du|der|die|das|ein|eine)\b/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      // r23 (G: remove "BlackBerry's" missed "Blackberries"): fold ies-plurals
      // to y BEFORE the trailing-s strip so berry families match.
      .replace(/ies\b/g, "y")
      .replace(/s\b/g, "");
  const left = normalize(a);
  const right = normalize(b);
  return Boolean(
    left &&
      right &&
      (left === right || left.includes(right) || right.includes(left)),
  );
}

function findMentionedListItem(
  list: AssistantList | null,
  text: string,
): string | null {
  if (!list) return null;
  const value = text.toLowerCase();
  return (
    list.items.find((item) => {
      const escaped = item
        .toLowerCase()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`, "i").test(value)) return true;
      return itemKeysMatch(item, text);
    }) ?? null
  );
}

function detectListDisplayStyle(text: string): ListDisplayStyle | null {
  if (LIST_STYLE_BULLET_RE.test(text)) return "bulleted";
  if (LIST_STYLE_NUMBER_RE.test(text)) return "numbered";
  return null;
}

function detectListAccentColor(text: string): ListAccentColor | null {
  const value = text.toLowerCase();
  if (!/\b(?:color|colour|make|turn|change)\b/.test(value)) return null;
  if (/\b(?:gold|golden|yellow|orange|amber)\b/.test(value)) return "amber";
  if (/\bblue\b/.test(value)) return "blue";
  if (/\bgreen\b/.test(value)) return "green";
  if (/\b(?:pink|rose|red)\b/.test(value)) return "rose";
  if (/\b(?:purple|violet)\b/.test(value)) return "purple";
  if (/\b(?:white|plain|light)\b/.test(value)) return "white";
  return null;
}

function detectListAccentUpdate(
  text: string,
  currentList: AssistantList | null,
): ListAccentUpdate | null {
  const value = text.toLowerCase();
  const wantsColor =
    /\b(?:color|colour|make|turn|change|darker|lighter|brighter|deeper|shade)\b/.test(
      value,
    );
  if (!wantsColor) return null;

  const typedHex = value.match(/#[0-9a-f]{6}\b/i)?.[0];
  const mentionedColor =
    Object.keys(CUSTOM_LIST_COLOR_MAP).find((color) =>
      new RegExp(`\\b${color}\\b`, "i").test(value),
    ) ?? null;
  const isLighter = /\b(?:lighter|brighter|softer|paler)\b/i.test(value);
  const isDarker = /\b(?:darker|deeper|richer)\b/i.test(value);
  if (!typedHex && !mentionedColor && !isLighter && !isDarker) return null;

  const fallbackColor = currentList?.accentColor ?? "amber";
  const baseHex =
    typedHex ??
    (mentionedColor ? CUSTOM_LIST_COLOR_MAP[mentionedColor] : null) ??
    currentList?.accentHex ??
    LIST_ACCENT_COLORS[fallbackColor].solid;
  const amount = isLighter ? 0.24 : isDarker ? -0.24 : 0;
  const accentHex = amount === 0 ? baseHex : adjustHexShade(baseHex, amount);

  let accentColor: ListAccentColor = fallbackColor;
  if (mentionedColor) {
    if (mentionedColor === "blue" || mentionedColor === "navy") accentColor = "blue";
    else if (mentionedColor === "green" || mentionedColor === "mint" || mentionedColor === "lime" || mentionedColor === "teal") accentColor = "green";
    else if (mentionedColor === "pink" || mentionedColor === "rose" || mentionedColor === "red" || mentionedColor === "coral") accentColor = "rose";
    else if (mentionedColor === "purple" || mentionedColor === "violet" || mentionedColor === "lavender" || mentionedColor === "indigo") accentColor = "purple";
    else if (mentionedColor === "white" || mentionedColor === "gray" || mentionedColor === "grey" || mentionedColor === "silver" || mentionedColor === "black") accentColor = "white";
    else accentColor = "amber";
  }

  const shadeLabel = isLighter ? "Light " : isDarker ? "Dark " : "";
  const colorLabel =
    mentionedColor?.replace(/^\w/, (char) => char.toUpperCase()) ??
    currentList?.accentLabel ??
    LIST_ACCENT_COLORS[fallbackColor].label;

  return {
    accentColor,
    accentHex,
    accentLabel: `${shadeLabel}${colorLabel}`.trim(),
  };
}

function speakEmailAddress(email: string): string {
  const [local = "", domain = ""] = email.toLowerCase().split("@");
  const speakChars = (value: string) =>
    value
      .split("")
      .map((char) => {
        if (char === ".") return "dot";
        if (char === "_") return "underscore";
        if (char === "-") return "dash";
        if (char === "+") return "plus";
        return char;
      })
      .join(" ");
  const domainSpoken = domain
    .replace(/\./g, " dot ")
    .replace(/_/g, " underscore ")
    .replace(/-/g, " dash ")
    .replace(/\+/g, " plus ")
    .replace(/\s+/g, " ")
    .trim();
  if (!local || !domainSpoken) return email;
  return `${speakChars(local)} at ${domainSpoken}`;
}


const LiveAvatarSessionComponent: React.FC<{
  mode: "FULL" | "CUSTOM";
  onSessionStopped: (opts?: SessionStoppedReason) => void;
  onExit?: (completeExit?: boolean) => void;
}> = ({ mode, onSessionStopped, onExit }) => {
  const [message, setMessage] = useState("");
  const {
    sessionState,
    isStreamReady,
    startSession,
    stopSession,
    connectionQuality,
    keepAlive,
    attachElement,
  } = useSession();
  const { microphoneWarning, wasStoppedDueToInactivity } =
    useLiveAvatarContext();
  const {
    isAvatarTalking,
    isUserTalking,
    isMuted,
    isActive,
    isLoading,
    start,
    stop,
    mute,
    unmute,
  } = useVoiceChat();

  const {
    interrupt: sessionInterrupt,
    repeat: sessionRepeat,
    startListening: sessionStartListening,
    stopListening: sessionStopListening,
  } = useAvatarActions(mode);

  // r25: bridge so the brain's replies (born inside useTextChat) land in
  // conversation_messages — assigned below once voiceLogTurn exists.
  const assistantLogRef = useRef<(text: string) => void>(() => {});
  // r26: ref-bridge to rememberConversationLine (declared later — TDZ-safe).
  const rememberLineRef = useRef<(role: "user" | "assistant", text: string) => void>(
    () => {},
  );
  // r26: running conversation for the brain — without it every call looked
  // like first contact and 6 re-introduced himself on every turn.
  const getBrainHistory = useCallback(
    () =>
      recentConversationRef.current.map((l) => ({
        role: l.role,
        content: l.text,
      })),
    [],
  );
  const { sendMessage: sessionSendMessage } = useTextChat(
    mode,
    (text) => assistantLogRef.current(text),
    getBrainHistory,
    // r32: the brain always knows the captured name (ref-read at call time —
    // deviceProfileRef is declared later; closures only read when called).
    () => deviceProfileRef.current?.name ?? null,
    // r34: and the signed-in state, for the same reason.
    () => accountEmailRef.current,
  );
  const { sessionRef, sessionEpoch, renewSessionToken } = useLiveAvatarContext();

  // ═══════════ VOICE-LIST MODE (2026-06-11, G's voice/avatar separation) ═══
  // "When the lists come up... the avatar disappears, voice stays a constant."
  // While the full-screen list is up the LiveAvatar session is hard-STOPPED
  // (credits stop immediately); our own ears (mic → /api/voice-transcribe) and
  // mouth (/api/elevenlabs-text-to-speech → WebAudio) keep the SAME
  // conversation flowing through the SAME dispatcher. Tapping 6's photo or any
  // close/come-back phrase renews the session (fresh token) — and the voice
  // keeps talking right through the reconnect.
  const [voicePresence, setVoicePresence] = useState<
    "avatar" | "voice" | "returning"
  >("avatar");
  const voicePresenceRef = useRef<"avatar" | "voice" | "returning">("avatar");
  const setPresence = useCallback(
    (p: "avatar" | "voice" | "returning") => {
      voicePresenceRef.current = p;
      setVoicePresence(p);
    },
    [],
  );
  const [voiceUserTalking, setVoiceUserTalking] = useState(false);
  const [voiceSixTalking, setVoiceSixTalking] = useState(false);
  const voiceReturnKeepsListRef = useRef(false);
  const voiceSpokenCounterRef = useRef(0);
  const voiceAudioCtxRef = useRef<AudioContext | null>(null);
  // r35: sup must never go blind — when no avatar session was ever minted,
  // voice turns log under a per-page local id instead of being dropped.
  const localSessionIdRef = useRef<string | null>(null);
  const voiceTtsBusyRef = useRef(false);
  const voiceTtsQueueRef = useRef<string[]>([]);
  // r24 (G live: "tap to mute 6"): silences 6's VOICE in list mode — his ears
  // stay on, the conversation keeps logging, he just stops talking out loud.
  const [voiceMuted, setVoiceMuted] = useState(false);
  const voiceMutedRef = useRef(false);
  const voiceEarsRef = useRef<{
    stream: MediaStream;
    ctx: AudioContext;
    analyser: AnalyserNode;
    recorder: MediaRecorder | null;
    poll: ReturnType<typeof setInterval>;
    speaking: boolean;
    speechMs: number;
    silenceMs: number;
    chunks: Blob[];
  } | null>(null);
  const voiceDispatchRef = useRef<((text: string) => Promise<void>) | null>(
    null,
  );
  const voiceReturnRef = useRef<((keepList: boolean) => Promise<void>) | null>(
    null,
  );
  const voiceEnteredAtRef = useRef(0);
  const voiceCurrentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // r19: voice turns land in conversation_messages (same table, same session
  // id as the avatar leg) so sup pulls show the WHOLE conversation. Fire and
  // forget — logging never blocks the conversation.
  const voiceLogTurn = useCallback((role: "user" | "assistant", text: string) => {
    let sid = dbSessionIdRef.current;
    if (!sid) {
      // r35 (G 2026-06-12 21:55: "is anything coming into sup from me
      // currently?" — NO, every turn was silently dropped because no avatar
      // session id existed after a mid-list reload): never drop transcript.
      if (!localSessionIdRef.current) {
        localSessionIdRef.current = `local-${Math.random().toString(36).slice(2, 10)}`;
      }
      sid = localSessionIdRef.current;
    }
    void fetch("/api/voice-mode/log-turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sid, role, message: text }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  // r25: in CUSTOM mode there is NO official LiveAvatar transcript (G live
  // 00:07: he talked plenty, conversation_messages stayed empty) — the brain's
  // replies log through this bridge.
  useEffect(() => {
    assistantLogRef.current = (text: string) => {
      if (mode === "CUSTOM") voiceLogTurn("assistant", text);
    };
  }, [mode, voiceLogTurn]);

  // Mouth: sequential TTS queue. Each line fetches ElevenLabs PCM and plays it
  // through WebAudio — no LiveAvatar session involved, so it works while the
  // avatar is stopped AND while he's reconnecting (G: "keep the smooth
  // conversation flowing").
  const voicePlayNext = useCallback(async () => {
    if (voiceTtsBusyRef.current) return;
    voiceTtsBusyRef.current = true;
    try {
      for (;;) {
        const text = voiceTtsQueueRef.current.shift();
        if (!text) break;
        setVoiceSixTalking(true);
        try {
          const res = await fetch("/api/elevenlabs-text-to-speech", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });
          if (!res.ok) {
            throw new Error(
              `voice tts ${res.status}: ${(await res.text()).slice(0, 120)}`,
            );
          }
          const { audio } = (await res.json()) as { audio?: string };
          if (typeof audio !== "string" || audio.length < 50) {
            throw new Error("voice tts empty/invalid audio");
          }
          if (!voiceAudioCtxRef.current) {
            voiceAudioCtxRef.current = new AudioContext();
          }
          const ctx = voiceAudioCtxRef.current;
          // r35 (G mid-list after a reload: 6 "thinking" but mute — the
          // browser keeps audio locked until the page is touched, and a
          // gesture-less resume() can hang): try once, then SKIP the line
          // instead of damming the whole turn chain behind a locked player.
          if (ctx.state === "suspended") {
            try {
              await Promise.race([
                ctx.resume(),
                new Promise((resolve) => setTimeout(resolve, 1500)),
              ]);
            } catch {
              // needs a user gesture — the pointerdown unlock will catch it
            }
            if ((ctx.state as string) !== "running") {
              throw new Error("audio locked until the page is tapped");
            }
          }
          const buffer = pcm16Base64ToAudioBuffer(ctx, audio);
          await new Promise<void>((resolve) => {
            const src = ctx.createBufferSource();
            voiceCurrentSourceRef.current = src;
            src.buffer = buffer;
            // r23b (G: "and YOUR voice too" — the studio meter): meter 6's own
            // audio through an analyser and drive the face circle in real time.
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            src.connect(analyser);
            analyser.connect(ctx.destination);
            const meterData = new Uint8Array(analyser.fftSize);
            const meter = setInterval(() => {
              const circle = document.getElementById("six-voice-circle");
              if (!circle) return;
              analyser.getByteTimeDomainData(meterData);
              let sum = 0;
              for (let i = 0; i < meterData.length; i++) {
                const v = (meterData[i] - 128) / 128;
                sum += v * v;
              }
              const level = Math.min(1, Math.sqrt(sum / meterData.length) * 6);
              circle.style.boxShadow = `0 0 0 ${(2 + level * 6).toFixed(1)}px rgba(215,160,90,${(0.25 + level * 0.45).toFixed(2)}), 0 0 ${(8 + level * 34).toFixed(0)}px ${(2 + level * 10).toFixed(0)}px rgba(244,208,134,${(0.2 + level * 0.55).toFixed(2)})`;
              // r28 (G: "pulse in real time to the points of a voice"): the
              // face itself swells with the level. 1.7 = the class base scale.
              circle.style.transform = `scale(${(1.7 + level * 0.22).toFixed(3)})`;
            }, 60);
            src.onended = () => {
              clearInterval(meter);
              const circle = document.getElementById("six-voice-circle");
              if (circle) circle.style.transform = "";
              resolve();
            };
            src.start();
          });
          voiceCurrentSourceRef.current = null;
        } catch (e) {
          void captureClientError(e, { where: "voice-mode", what: "tts" });
        } finally {
          setVoiceSixTalking(false);
        }
      }
    } finally {
      voiceTtsBusyRef.current = false;
    }
  }, []);

  const voiceSay = useCallback(
    async (text: string) => {
      const t = (text ?? "").trim();
      if (!t) return;
      voiceSpokenCounterRef.current += 1;
      // r28: voice-mode lines must enter the echo-firewall registry too — an
      // unregistered voiceSay line echoed into the mic, dispatched as the
      // user, and re-opened the grocery list G never asked for (02:03:04).
      registerSixSpokenLine(t);
      voiceLogTurn("assistant", t);
      if (voiceMutedRef.current) return; // muted: logged, not spoken
      voiceTtsQueueRef.current.push(t);
      void voicePlayNext();
    },
    [voicePlayNext, voiceLogTurn],
  );

  // r19 barge-in support: cut 6 off mid-sentence — drop the queue AND the
  // line that's already playing (stop() fires onended, the play loop drains).
  const voiceCutSpeech = useCallback(() => {
    voiceTtsQueueRef.current = [];
    try {
      voiceCurrentSourceRef.current?.stop();
    } catch {
      // already ended
    }
  }, []);

  // ROUTED AVATAR ACTIONS: every one of the dispatcher's ~50 repeat()/
  // interrupt() call sites keeps working in voice mode — speech reroutes to
  // the ElevenLabs mouth, session-only calls become safe no-ops.
  const repeat = useCallback(
    async (text: string) => {
      if (voicePresenceRef.current !== "avatar") return voiceSay(text);
      // r25: CUSTOM avatar-mode machine lines also land in the transcript
      // (no official LiveAvatar transcript exists for these sessions).
      if (mode === "CUSTOM") voiceLogTurn("assistant", text);
      return sessionRepeat(text);
    },
    [sessionRepeat, voiceSay, mode, voiceLogTurn],
  );
  const interrupt = useCallback(async () => {
    if (voicePresenceRef.current !== "avatar") {
      voiceCutSpeech();
      return;
    }
    return sessionInterrupt();
  }, [sessionInterrupt, voiceCutSpeech]);
  const startListening = useCallback(() => {
    if (voicePresenceRef.current !== "avatar") return;
    return sessionStartListening();
  }, [sessionStartListening]);
  const stopListening = useCallback(() => {
    if (voicePresenceRef.current !== "avatar") return;
    return sessionStopListening();
  }, [sessionStopListening]);

  // r19 (G's first live session: "Session needs to be connected to send
  // command event" — every unhandled turn after the list closed THREW and 6
  // went completely silent): in voice mode, forwarding to "the brain" means
  // the chat endpoint + the ElevenLabs mouth, never the dead session socket.
  const sendMessage = useCallback(
    async (text: string) => {
      if (voicePresenceRef.current !== "avatar") {
        try {
          rememberLineRef.current("user", text);
          const r = await fetch("/api/openai-chat-complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: text,
              listMode: true,
              history: getBrainHistory(),
              userName: deviceProfileRef.current?.name ?? null,
              signedInEmail: accountEmailRef.current,
            }),
          });
          if (r.ok) {
            const data = (await r.json()) as { response?: string };
            if (data.response) {
              rememberLineRef.current("assistant", data.response);
              void voiceSay(data.response);
            }
          }
        } catch (e) {
          void captureClientError(e, {
            where: "voice-mode",
            what: "sendMessage",
          });
        }
        return;
      }
      return sessionSendMessage(text);
    },
    [sessionSendMessage, voiceSay, getBrainHistory],
  );

  const stopVoiceEars = useCallback(() => {
    const ears = voiceEarsRef.current;
    if (!ears) return;
    voiceEarsRef.current = null;
    clearInterval(ears.poll);
    try {
      if (ears.recorder && ears.recorder.state !== "inactive") {
        ears.recorder.ondataavailable = null;
        ears.recorder.onstop = null;
        ears.recorder.stop();
      }
    } catch {
      // already stopped
    }
    try {
      ears.stream.getTracks().forEach((t) => t.stop());
    } catch {
      // already released
    }
    try {
      void ears.ctx.close();
    } catch {
      // already closed
    }
    setVoiceUserTalking(false);
  }, []);

  const processVoiceUtterance = useCallback(
    async (blob: Blob) => {
      if (voicePresenceRef.current === "avatar") return;
      try {
        const form = new FormData();
        form.append("audio", blob, "utterance.webm");
        const res = await fetch("/api/voice-transcribe", {
          method: "POST",
          body: form,
        });
        if (!res.ok) throw new Error(`voice transcribe ${res.status}`);
        const { text } = (await res.json()) as { text?: string };
        const heard = (text ?? "").trim();
        if (!heard) return;
        // r33: STT sometimes ships the same utterance twice back-to-back —
        // one turn, one response (the avatar path has had this guard since
        // 2026-06-11; the list ears were open).
        if (
          isDuplicateUtterance(
            lastListHeardRef.current?.text ?? null,
            lastListHeardRef.current?.at ?? 0,
            heard,
            Date.now(),
          )
        ) {
          return;
        }
        lastListHeardRef.current = { text: heard, at: Date.now() };
        // r28: echo firewall for the voice-mode ears too (avatar-mode got it
        // in r26; this path was open and 6 answered his own speaker audio).
        if (wasRecentlySpokenBySix(heard)) {
          reportCustomVoiceDiag(`[echo-dropped:list] ${heard.slice(0, 80)}`);
          logAppEvent("echo_dropped", { where: "list", heard: heard.slice(0, 200) });
          return;
        }
        voiceLogTurn("user", heard);
        rememberLineRef.current("user", heard);
        // r29 telemetry (G 2026-06-12): complaints ARE bug reports — file
        // silently, never hijack the conversation. Frustration counter too.
        noteUserTurnForFrustration(heard);
        maybeSubmitBugReport({
          triggerText: heard,
          transcript: getBrainHistory().map((l) => ({
            role: l.role,
            text: l.content,
          })),
          listSnapshot: activeListSnapshotRef.current,
          mode,
        });
        maybeSubmitUserFeedback({
          triggerText: heard,
          transcript: getBrainHistory().map((l) => ({
            role: l.role,
            text: l.content,
          })),
          mode,
        });
        // r30: voice sign-out works from list mode too.
        if (LOGOUT_COMMAND_RE.test(heard)) {
          rememberLineRef.current("assistant", ACCOUNT_SIGNOUT_LINE);
          voiceLogTurn("assistant", ACCOUNT_SIGNOUT_LINE);
          void voiceSay(ACCOUNT_SIGNOUT_LINE);
          performSignOut();
          return;
        }
        if (wantsAvatarBack(heard)) {
          // r32 (G 20:49: "take down the Walmart list and make a grocery
          // list" — the close won and the create vanished, his berries went
          // to the brain): a new-list ask in the same breath means SWAP
          // lists in place, never leave list mode.
          if (detectListIntent(heard)) {
            await voiceDispatchRef.current?.(heard);
            return;
          }
          // r29 (G 2026-06-12 09:01: "let's go back to six" brought the
          // grocery list BACK with him): face-back = clean stage. The list
          // survives ONLY an explicit "keep".
          const keepList =
            AVATAR_RETURN_RE.test(heard) &&
            !VOICE_LIST_DONE_RE.test(heard) &&
            /\bkeep\b/i.test(heard);
          void voiceReturnRef.current?.(keepList);
          return;
        }
        const before = voiceSpokenCounterRef.current;
        await voiceDispatchRef.current?.(heard);
        // The ref can flip to "avatar" DURING the await (a handler may have
        // triggered the return) — widen past TS's narrowing before comparing.
        const presenceNow = voicePresenceRef.current as unknown as string;
        if (presenceNow !== "avatar" && voiceSpokenCounterRef.current === before) {
          // No handler spoke — same 6 brain the custom mode uses (memory
          // recall + fact writer included server-side). listMode keeps him to
          // ONE short sentence (G live 21:06: "you're not stopping talking" —
          // the brain read a whole numbered food list aloud).
          const brainT0 = Date.now();
          const r = await fetch("/api/openai-chat-complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: heard,
              listMode: true,
              history: getBrainHistory(),
              // r32 (G 20:43: "I don't have a name from you yet this
              // session" minutes after he gave it): the brain always knows
              // the captured name.
              userName: deviceProfileRef.current?.name ?? null,
              // r34: and whether they're signed in — so it never re-asks
              // first-time-or-returning at a signed-in user.
              signedInEmail: accountEmailRef.current,
            }),
          });
          if (r.ok) {
            const data = (await r.json()) as { response?: string };
            logAppEvent("brain_latency", {
              ms: Date.now() - brainT0,
              listMode: true,
            });
            if (data.response) {
              rememberLineRef.current("assistant", data.response);
              void voiceSay(data.response);
            }
          }
        }
      } catch (e) {
        void captureClientError(e, { where: "voice-mode", what: "utterance" });
      }
    },
    [voiceSay, voiceLogTurn, getBrainHistory],
  );

  // r33: list-ears turns join the SAME one-at-a-time chain as avatar turns —
  // two quick utterances answer in order, never on top of each other.
  // r35: each link races a 25s timeout so one hung turn (dead session, locked
  // audio) can never dam every turn behind it.
  const handleVoiceUtterance = useCallback(
    (blob: Blob): Promise<void> => {
      turnChainRef.current = turnChainRef.current
        .then(() =>
          Promise.race([
            processVoiceUtterance(blob),
            new Promise<void>((resolve) => setTimeout(resolve, 25_000)),
          ]),
        )
        .catch(() => {});
      return turnChainRef.current;
    },
    [processVoiceUtterance],
  );

  // Ears: RMS voice-activity detection over the raw mic; records one
  // utterance at a time and ships it to /api/voice-transcribe. Half-duplex by
  // design — frames are ignored while 6's own audio is playing so his voice
  // never transcribes itself (echoCancellation helps too).
  const startVoiceEars = useCallback(async () => {
    if (voiceEarsRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const ctx = new AudioContext();
      const srcNode = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      srcNode.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      // r19: 60ms poll (was 100) trims first-syllable clipping; barge-in lets
      // the user talk OVER 6 — a clearly-louder sustained voice cuts him off
      // (the 2.5x bar + 350ms hold keep his own speaker audio from triggering
      // it; echoCancellation does the rest).
      const POLL_MS = 60;
      const START_RMS = 0.022;
      const BARGE_RMS = START_RMS * 2.5;
      const BARGE_HOLD_MS = 350;
      const STOP_SILENCE_MS = 850;
      const MIN_SPEECH_MS = 350;
      const ears = {
        stream,
        ctx,
        analyser,
        recorder: null as MediaRecorder | null,
        poll: 0 as unknown as ReturnType<typeof setInterval>,
        speaking: false,
        speechMs: 0,
        silenceMs: 0,
        bargeMs: 0,
        chunks: [] as Blob[],
      };
      ears.poll = setInterval(() => {
        if (voicePresenceRef.current === "avatar") return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // r23 (G: "the voice should pulse with my voice... like in a music
        // studio"): drive the face circle's glow straight off the live mic
        // level — direct DOM write, no React re-render at 60ms.
        // (While 6's own audio is playing, HIS meter owns the glow.)
        if (!voiceTtsBusyRef.current) {
          const circle = document.getElementById("six-voice-circle");
          if (circle) {
            const level = Math.min(1, rms * 14);
            circle.style.boxShadow = `0 0 0 ${(2 + level * 6).toFixed(1)}px rgba(215,160,90,${(0.25 + level * 0.45).toFixed(2)}), 0 0 ${(8 + level * 34).toFixed(0)}px ${(2 + level * 10).toFixed(0)}px rgba(244,208,134,${(0.2 + level * 0.55).toFixed(2)})`;
            // r28: real-time pulse — the face swells with the user's voice too.
            circle.style.transform = `scale(${(1.7 + level * 0.22).toFixed(3)})`;
          }
        }
        if (voiceTtsBusyRef.current && !ears.speaking) {
          if (rms > BARGE_RMS) {
            ears.bargeMs += POLL_MS;
            if (ears.bargeMs < BARGE_HOLD_MS) return;
            voiceCutSpeech();
          } else {
            ears.bargeMs = 0;
            return;
          }
        }
        const loud = rms > START_RMS;
        if (loud) {
          ears.silenceMs = 0;
          ears.speechMs += POLL_MS;
          if (!ears.speaking) {
            ears.speaking = true;
            setVoiceUserTalking(true);
            ears.chunks = [];
            try {
              const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
              rec.ondataavailable = (ev) => {
                if (ev.data.size > 0) ears.chunks.push(ev.data);
              };
              rec.onstop = () => {
                const blob = new Blob(ears.chunks, { type: "audio/webm" });
                ears.chunks = [];
                if (blob.size > 1500) void handleVoiceUtterance(blob);
              };
              rec.start(250);
              ears.recorder = rec;
            } catch (e) {
              void captureClientError(e, {
                where: "voice-mode",
                what: "recorder",
              });
            }
          }
        } else if (ears.speaking) {
          ears.silenceMs += POLL_MS;
          if (ears.silenceMs >= STOP_SILENCE_MS) {
            ears.speaking = false;
            setVoiceUserTalking(false);
            const longEnough = ears.speechMs >= MIN_SPEECH_MS;
            ears.speechMs = 0;
            ears.silenceMs = 0;
            ears.bargeMs = 0;
            try {
              if (ears.recorder && ears.recorder.state !== "inactive") {
                if (!longEnough) {
                  ears.recorder.ondataavailable = null;
                  ears.recorder.onstop = null;
                }
                ears.recorder.stop();
              }
            } catch {
              // recorder already gone
            }
            ears.recorder = null;
          }
        }
      }, POLL_MS);
      voiceEarsRef.current = ears;
    } catch (e) {
      void captureClientError(e, { where: "voice-mode", what: "mic" });
      // Mic denied/broken — never strand the user deaf; bring 6 back.
      void voiceReturnRef.current?.(true);
    }
  }, [handleVoiceUtterance, voiceCutSpeech]);

  const enterVoiceListMode = useCallback(
    async (listTitle: string, wasNew: boolean) => {
      if (voicePresenceRef.current !== "avatar") return;
      setPresence("voice");
      voiceReturnKeepsListRef.current = false;
      voiceEnteredAtRef.current = Date.now();
      voiceReturnAttemptsRef.current = 0; // fresh stay, fresh comeback budget
      void captureClientWarn(new Error("voice-mode"), {
        where: "voice-mode",
        what: "enter",
        list: listTitle,
      });
      logAppEvent("voice_list_enter", { list: listTitle, wasNew });
      try {
        await sessionInterrupt();
      } catch {
        // avatar may already be silent
      }
      void startVoiceEars();
      void voiceSay(voiceListEnterLine(listTitle, wasNew));
      try {
        await stopSession();
      } catch (e) {
        void captureClientError(e, {
          where: "voice-mode",
          what: "stop-session",
        });
      }
    },
    [setPresence, sessionInterrupt, startVoiceEars, voiceSay, stopSession],
  );

  // r27 (copilot 2026-06-12, the 01:39 runaway: "bringing my face back" spoken
  // ~60x in 7 seconds): return attempts are now counted; the belt effect stops
  // auto-retrying after 3 and the spoken lines only play on the first try.
  const voiceReturnAttemptsRef = useRef(0);
  const beginAvatarReturn = useCallback(
    async (keepList: boolean) => {
      if (voicePresenceRef.current !== "voice") return;
      const attempt = ++voiceReturnAttemptsRef.current;
      setPresence("returning");
      voiceReturnKeepsListRef.current = keepList;
      // Never replay the full scripted intro on a comeback.
      greetingTriggeredRef.current = true;
      // r31 (G's explicit script order, 2026-06-12 09:02: "Don't have six
      // say, bring my face back, say, I'm bringing myself back"): SACRED
      // wording — never say "face back".
      if (attempt === 1) {
        void voiceSay("You got it - one sec, bringing myself back.");
      }
      void captureClientWarn(new Error("voice-mode"), {
        where: "voice-mode",
        what: "return",
        keepList,
      });
      logAppEvent("face_return", { phase: "attempt", attempt, keepList });
      try {
        // r27: the comeback must mint the SAME mode the page runs. This used
        // to always hit /api/start-session (FULL) — which the localhost credit
        // guard 429s — so on localhost the face could NEVER return and the
        // belt effect looped the failure line forever.
        let res: Response;
        if (mode === "CUSTOM") {
          res = await fetch("/api/start-custom-session", { method: "POST" });
        } else {
          const requestedLang =
            typeof window !== "undefined"
              ? new URLSearchParams(window.location.search).get("lang")
              : null;
          let deviceTz: string | null = null;
          try {
            deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
          } catch {
            // no clock, no zone
          }
          res = await fetch("/api/start-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lang: requestedLang, tz: deviceTz }),
          });
        }
        if (!res.ok) throw new Error(`voice renew mint ${res.status}`);
        const data = (await res.json()) as { session_token?: string };
        if (!data.session_token) throw new Error("voice renew mint empty");
        renewSessionToken(data.session_token);
        // The context resets to INACTIVE → the auto-start effect below starts
        // the fresh session → the handoff effect finishes when video is live.
      } catch (e) {
        void captureClientError(e, { where: "voice-mode", what: "renew" });
        logAppEvent(
          "face_return",
          { phase: "mint_failed", attempt },
          "high",
        );
        setPresence("voice");
        if (attempt <= 2) {
          void voiceSay(
            "Hmm - I couldn't bring myself back just now. We can keep talking, or tap my photo to try again.",
          );
        }
      }
    },
    [setPresence, voiceSay, renewSessionToken, mode],
  );

  useEffect(() => {
    voiceReturnRef.current = beginAvatarReturn;
  }, [beginAvatarReturn]);

  // Handoff: the fresh session is live → ears off, overlay down, avatar talks.
  useEffect(() => {
    if (voicePresence !== "returning") return;
    if (sessionState !== SessionState.CONNECTED || !isStreamReady) return;
    stopVoiceEars();
    setPresence("avatar");
    voiceReturnAttemptsRef.current = 0; // comeback landed — reset the budget
    logAppEvent("face_return", { phase: "landed" });
    setIsShoppingMode(false);
    if (!voiceReturnKeepsListRef.current) {
      setActiveListId(null);
    }
    // r20 (G 21:37: "the tab click was on the screen... it should not be"):
    // the user already tapped and talked this visit — the comeback must land
    // mid-conversation, never behind the tap gate. Voice chat restarts itself.
    setHasUserPressedVoiceStart(true);
    // r28 (G 2026-06-12 08:48: comeback = face moving, no voice, no pillboxes,
    // deaf): the begin-tap hold effect re-armed on the fresh session and
    // stop()ed the mic the same commit this start()ed it, and CUSTOM mode
    // never got isCustomVoiceActive back — so the pillboxes (gated on
    // voiceIsActive) stayed hidden and 6 heard nothing. Mark the tap gate as
    // already passed BEFORE that effect runs (same commit, declaration order)
    // and restore the CUSTOM-active flag.
    voiceHeldUntilUserStartRef.current = true;
    void start();
    if (mode === "CUSTOM") {
      setIsCustomVoiceActive(true);
    }
    const line =
      AVATAR_BACK_LINES[Math.floor(Date.now() / 1000) % AVATAR_BACK_LINES.length];
    void sessionRepeat(line);
  }, [voicePresence, sessionState, isStreamReady, stopVoiceEars, setPresence, sessionRepeat, start, mode]);

  // Leave nothing running if the whole component unmounts mid-voice-mode.
  useEffect(() => {
    return () => {
      stopVoiceEars();
      try {
        void voiceAudioCtxRef.current?.close();
      } catch {
        // already closed
      }
    };
  }, [stopVoiceEars]);
  // ═══════════ end voice-list mode block ═══════════
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [imageAnalysis, setImageAnalysis] = useState<string | null>(null);
  const [videoAnalysis, setVideoAnalysis] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  const [isProcessingCameraQuestion, setIsProcessingCameraQuestion] =
    useState(false);
  const [showVisionLoading, setShowVisionLoading] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [fallbackImage, setFallbackImage] = useState<File | null>(null);
  const [fallbackImagePreview, setFallbackImagePreview] = useState<
    string | null
  >(null);
  const lastProcessedQuestionRef = useRef<string>("");
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackImageInputRef = useRef<HTMLInputElement>(null);
  const isDebugProcessingRef = useRef<boolean>(false);
  const lastAvatarResponseRef = useRef<string>("");
  const lastUserTextRef = useRef<string>("");
  // The immediately-preceding user speech fragment + when it arrived. Used to
  // stitch STT chunks of the SAME utterance back together before deciding a
  // close (G 2026-06-03: a question "if I close this out, would you remember
  // me" split across chunks and the bare "close this out" fragment eager-closed).
  const prevUserSpeechRef = useRef<{ text: string; at: number }>({
    text: "",
    at: 0,
  });
  const recentConversationRef = useRef<MemoryConversationLine[]>([]);
  // r33: one turn = one memory line (kills the doubled bug-report transcripts).
  const lastRememberedLineRef = useRef<{ key: string; at: number } | null>(
    null,
  );
  // r33 (G 2026-06-12 21:15, "two voices" + doubled lines): ALL user turns —
  // avatar ears and list ears — run through ONE chain, one at a time, in
  // arrival order. Racing handlers were answering two quick utterances on
  // top of each other through two different voice pipes.
  const turnChainRef = useRef<Promise<void>>(Promise.resolve());
  // r35: any first touch unlocks the voice player (browsers keep audio
  // suspended until a gesture — 6 looked alive but mute after a reload).
  useEffect(() => {
    const unlock = () => {
      const ctx = voiceAudioCtxRef.current;
      if (ctx && ctx.state === "suspended") {
        void ctx.resume().catch(() => {});
      }
    };
    document.addEventListener("pointerdown", unlock);
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);
  const lastListHeardRef = useRef<{ text: string; at: number } | null>(null);
  const lastFullModeMessageRef = useRef<{ text: string; at: number } | null>(
    null,
  );
  const lastVisionResponseTimeRef = useRef<number>(0);
  const hasAutoAnalyzedRef = useRef<boolean>(false);
  // Tracks the specific problem the user is trying to fix (persists across vision calls so
  // Grok can stay laser-focused on the object/problem the user named at the start).
  const currentProblemRef = useRef<string>("");
  // Tracks the last non-silent vision analysis so Grok can compare frames and only break
  // silence when something meaningful has actually changed.
  const lastAnalysisRef = useRef<string>("");

  const isAttachedRef = useRef<boolean>(false);
  const greetingTriggeredRef = useRef<boolean>(false);
  // Greeting-interrupt completion (G spec 2026-05-27): force 6 to complete the
  // intro by his 2nd utterance after the interruption.
  const greetingInFlightRef = useRef<boolean>(false);
  const greetingInterruptedRef = useRef<boolean>(false);
  const greetingCompletionPendingRef = useRef<boolean>(false);
  // Latest spoken text from 6 (AVATAR_TRANSCRIPTION). Used to skip the
  // completion injection when the LLM already re-delivered the greeting on
  // its own (e.g., user said "What did you just say?" and LLM repeats it).
  const lastAvatarTranscriptionRef = useRef<string>("");
  const audioUnlockedRef = useRef<boolean>(false);
  const wasMutedBeforeRecordingRef = useRef<boolean>(false);
  /** LiveAvatar server session id — used for DB + official transcript API (set when CONNECTED). */
  const dbSessionIdRef = useRef<string | null>(null);
  /** Tester slug from ?tester=<slug>, persisted via sessionStorage. Threaded into write paths for attribution. */
  const testerLabelRef = useRef<string | null>(null);
  /** Cursor for GET /v1/sessions/{id}/transcript (LiveAvatar `next_timestamp`). */
  const transcriptCursorRef = useRef<number | null>(null);
  const lastSyncedLaSessionIdRef = useRef<string | null>(null);
  /** Mic/voice chat is held inactive until the user taps Start (SDK enables voice on connect). */
  const voiceHeldUntilUserStartRef = useRef(false);
  const [hasUserPressedVoiceStart, setHasUserPressedVoiceStart] = useState(false);
  const [voiceStartAwaitingReady, setVoiceStartAwaitingReady] = useState(false);
  const [thoughtPrompts, setThoughtPrompts] = useState(
    normalizeThoughtPrompts(DEFAULT_THOUGHT_PROMPTS),
  );
  const [dissolvingPrompt, setDissolvingPrompt] = useState<string | null>(null);
  const [assistantLists, setAssistantLists] =
    useState<AssistantList[]>(loadAssistantLists);
  const [activeListIdRaw, setActiveListId] = useState<string | null>(null);
  // v1 LIST_UI_DORMANT: force activeListId to null so even if code paths set it
  // (e.g., LIST_TRIGGER_RE matched on user text), nothing downstream sees a list,
  // 6 doesn't narrate a phantom list, and pillboxes stay in their narrow layout.
  const activeListId = LIST_UI_DORMANT ? null : activeListIdRaw;
  const [isShoppingMode, setIsShoppingMode] = useState(false);
  const [deviceProfile, setDeviceProfile] =
    useState<DeviceProfile>(loadDeviceProfile);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  // r34: ref mirror — stale-closure callbacks (signup gate, brain calls)
  // need the live signed-in state.
  const accountEmailRef = useRef<string | null>(null);
  useEffect(() => {
    accountEmailRef.current = accountEmail;
  }, [accountEmail]);
  const [accountAuthChecked, setAccountAuthChecked] = useState(true);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const [accountVerificationUrl, setAccountVerificationUrl] = useState<
    string | null
  >(null);
  const [emailEntryOpen, setEmailEntryOpen] = useState(false);
  const [typedAccountEmail, setTypedAccountEmail] = useState("");
  // FIX 1 (2026-06-01): the email the user is SPELLING, shown live on 6's chest
  // (above the top pillbox). 6 never reads this back by voice — the box on
  // screen is the source of truth. showChestEmail controls visibility.
  const [chestEmailText, setChestEmailText] = useState("");
  const [showChestEmail, setShowChestEmail] = useState(false);
  // FIX (2026-06-01): when set, the on-chest box shows this status text
  // (e.g. "Account Link Sent") in place of the email label + address, then fades.
  const [chestEmailStatus, setChestEmailStatus] = useState<string | null>(null);
  const [onlineLookupNotice, setOnlineLookupNotice] = useState<string | null>(
    null,
  );
  const [onlineLookupSources, setOnlineLookupSources] = useState<
    OnlineLookupSource[]
  >([]);
  const [onlineLookupResultLines, setOnlineLookupResultLines] = useState<
    string[]
  >([]);
  const [, setSourcePreview] = useState<OnlineLookupSource | null>(
    null,
  );
  const [isOnlineLookupLoading, setIsOnlineLookupLoading] = useState(false);
  const [postVerifyGreeting, setPostVerifyGreeting] = useState<string | null>(
    null,
  );
  // v1 2026-05-24 (G): pillbox font 2 sizes larger. Each level = +0.06rem (list mode) or +0.1rem (open mode).
  const [promptSizeLevel, setPromptSizeLevel] = useState(loadUiSizeLevel);
  // Persist the voice-chosen size so older eyes set it ONCE per device — and
  // onto the ACCOUNT for signed-in users so it follows them to any device
  // (G 2026-06-10). Debounced; fire-and-forget.
  useEffect(() => {
    try {
      window.localStorage.setItem(UI_SIZE_STORAGE_KEY, String(promptSizeLevel));
    } catch {
      // Private mode etc. — session-only sizing is fine.
    }
    if (!accountSignedInRef.current) return;
    const id = setTimeout(() => {
      void fetch("/api/account/prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uiSizeLevel: promptSizeLevel }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(id);
  }, [promptSizeLevel]);
  const tapPromptFont = useMemo<React.CSSProperties>(() => {
    if (typeof window === "undefined") return TAP_PROMPT_FONT_OPTIONS.default;
    const requested = new URLSearchParams(window.location.search).get(
      "promptFont",
    ) as TapPromptFontVariant | null;
    return requested && requested in TAP_PROMPT_FONT_OPTIONS
      ? TAP_PROMPT_FONT_OPTIONS[requested]
      : TAP_PROMPT_FONT_OPTIONS.default;
  }, []);
  const [listFocusNonce, setListFocusNonce] = useState(0);
  const promptBrainHistoryRef = useRef<string[]>([]);
  const promptBrainSeqRef = useRef(0);
  const promptBrainTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const onlineLookupLocationRef = useRef<string | null>(null);
  const onlineLookupPendingQueryRef = useRef<string | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const shoppingListScrollRef = useRef<HTMLDivElement | null>(null);
  const latestListMutationRef = useRef<{
    listId: string;
    item: string | null;
    action: "add" | "remove" | "mention";
  } | null>(null);
  const pendingListDeleteRef = useRef<string | null>(null);
  const lastEnsuredListRef = useRef<{
    id: string;
    title: string;
    wasNew: boolean;
  } | null>(null);
  const deviceProfileRef = useRef(deviceProfile);
  const accountMemorySnapshotRef = useRef<AccountMemorySnapshot | null>(null);
  const accountMemoryContextInjectedRef = useRef(false);
  const postVerifyGreetingSpokenRef = useRef(false);
  // Audio is muted until the user unlocks it (gesture). Greetings MUST wait for
  // this or 6 mouths them silently during the muted-load window. (G 2026-06-03)
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const accountSetupAwaitingReadyRef = useRef(false);
  const accountSetupAwaitingEmailRef = useRef(false);
  // True once a signed-in account loads. Gates account-setup OFF for returning
  // users so the email-on-chest box + email parsing never fire on the return.
  const accountSignedInRef = useRef(false);
  // True between "ask the name" and "got the name" during account setup, so the
  // next utterance is taken as the user's name even if 6's spoken line didn't
  // match the name-ask regex. Guarantees deviceProfile.name is set BEFORE the
  // email step, so startAccountSetup sends a real fullName (live bug: it was
  // NULL because 6 jumped straight to email). 2026-06-01 name-capture fix.
  const accountSetupAwaitingNameRef = useRef(false);
  const accountSetupPendingEmailRef = useRef<string | null>(null);
  const accountSetupRejectedEmailRef = useRef<string | null>(null);
  // Explicit "send the link?" consent gate AFTER the email is confirmed correct
  // (G 2026-06-03: "you need to ask permission before sending — the user says
  // yes, THEN send"). The confirmed address waits here until they say send it.
  const accountSetupAwaitingSendRef = useRef(false);
  const accountSetupSendEmailRef = useRef<string | null>(null);
  // STT echo guard (2026-06-11): the utterance + moment that armed the send
  // gate — a duplicate of it can never also fire the gate (machine enforces).
  const accountSetupSendArmedAtRef = useRef(0);
  const accountSetupSendArmedByTextRef = useRef<string | null>(null);
  // Cooldown so rapid "download my data" repeats don't blast multiple emails
  // (G 2026-06-09 flood). Holds the last export-request fire time (ms).
  const lastExportRequestAtRef = useRef(0);
  // Dedupe magic-link sends so the sign-in link isn't emailed several times in a
  // row (G 2026-06-09: repeated "sending the link now" + duplicate emails).
  const lastAccountLinkSendRef = useRef<{ email: string; at: number } | null>(null);
  const accountSetupOfferMadeRef = useRef(false);
  const accountSetupDeclinedAtRef = useRef(0);
  const accountSetupEmailMissCountRef = useRef(0);
  // Voice data-deletion (G 2026-06-07): when 6 asks "are you sure?" before
  // erasing a user's data, the next utterance is the yes/no — these track that
  // confirm gate and which scope ("memory" wipe vs "account" close) was asked.
  const accountDeleteAwaitingConfirmRef = useRef(false);
  const accountDeleteScopeRef = useRef<"memory" | "account">("memory");
  // G 2026-06-08: every destructive delete now runs the SAME 30-day grace
  // (account close). This flag exists ONLY so 6's wording matches what the user
  // asked - "closing your account" vs "deleting your data" - never to change
  // what actually happens (always grace).
  const accountDeleteSaidCloseRef = useRef(true);
  // FIX (2026-06-01): letter-by-letter on-chest email reveal + typewriter click.
  // chestRevealTimerRef holds the pending per-letter timer so a new spoken chunk
  // can cancel/continue cleanly. tickAudioCtxRef lazily holds the AudioContext
  // for the synthesized typewriter click. chestStatusTimerRef fades the box after
  // the "Account Link Sent" status shows.
  const chestRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chestRevealActiveRef = useRef(false);
  const tickAudioCtxRef = useRef<AudioContext | null>(null);
  const chestStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // CHANGE 1 (2026-06-01): the address last parsed out of 6's spoken readback
  // (AVATAR_TRANSCRIPTION). Used to dedupe so the box only re-reveals when 6
  // confirms a DIFFERENT address, never on every line he speaks.
  const lastAvatarParsedEmailRef = useRef<string | null>(null);
  // Mirror of chestEmailText so the AVATAR_TRANSCRIPTION event handler (a stable
  // closure) can read the currently shown address without stale state.
  const chestEmailTextRef = useRef<string>("");
  // CHANGE 2 (2026-06-01): live mirror of isAvatarTalking so the email handlers
  // (stable useCallbacks) can tell whether 6 is mid-sentence — and stay quiet
  // instead of talking over him — without re-creating on every talk toggle.
  const isAvatarTalkingRef = useRef(false);
  const accountPendingStateTokenRef = useRef<string | null>(null);
  const endSessionConfirmationPendingRef = useRef(false);
  const endSessionConfirmationAskedAtRef = useRef(0);
  const explicitEndSessionRef = useRef(false);
  // FIX #2 (2026-06-01, G "close the old session, only after 6 says take care"):
  // single-active-session "newest wins" baton. When a newer session starts (e.g.
  // the magic-link return opens a fresh tab), it announces a baton; OLDER
  // sessions hear it and close gracefully (6 says a quick goodbye, THEN stops) so
  // the user never has two live sessions burning credits. sessionStartedAtRef
  // stamps this session's age; the guard "incoming.startedAt > mine" means the
  // NEWEST session can never be told to stop — only strictly-older ones close.
  // Same-browser via BroadcastChannel now; cross-browser via Supabase Realtime is
  // the next step (G: critically important, but he tests same-browser until this
  // is smooth).
  const sessionStartedAtRef = useRef(Date.now());
  const supersedeStoppingRef = useRef(false);
  const sessionBatonChannelRef = useRef<BroadcastChannel | null>(null);
  const listCloseEducationSpokenRef = useRef(false);
  const pendingListCustomizationPromptRef = useRef<{
    id: string;
    title: string;
  } | null>(null);
  const accountSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const accountProfileSaveTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const pendingAccountSaveTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const accountListsLoadedRef = useRef(false);
  const activeList = useMemo(
    () => assistantLists.find((list) => list.id === activeListId) ?? null,
    [activeListId, assistantLists],
  );
  // r29 telemetry: ref mirror so fire-and-forget bug reports can snapshot the
  // on-screen list from inside stale-closure callbacks.
  const activeListSnapshotRef = useRef<string[] | null>(null);
  useEffect(() => {
    activeListSnapshotRef.current = activeList ? [...activeList.items] : null;
  }, [activeList]);

  // r34 (G's page-load crash 2026-06-12 21:44: "Not permitted in LITE mode"
  // — a direct .message() resume-inject fired for the first signed-in return
  // on localhost): context/signal injections via .message() are hosted-brain
  // commands. FULL mode only, and armored so a refusal can never crash a
  // render effect. CUSTOM brains already get this context through
  // buildMemoryAugmentedMessage + history.
  const injectFullModeContext = useCallback(
    (text: string) => {
      if (mode !== "FULL") return;
      try {
        sessionRef.current?.message(text);
      } catch (e) {
        void captureClientWarn(e, { where: "context-inject" });
      }
    },
    [mode, sessionRef],
  );

  // r30: full voice sign-out — Supabase browser session + legacy account
  // cookie both cleared, then a clean reload to anonymous so no
  // half-signed-in state lingers. The delay lets 6 finish his confirm line.
  const performSignOut = useCallback(() => {
    logAppEvent("voice_logout", {});
    void (async () => {
      try {
        await getSupabaseBrowserOrNull()?.auth.signOut();
      } catch {
        // server cookie clear + the reload below are the backstops
      }
      try {
        await fetch("/api/account/logout", { redirect: "manual" });
      } catch {
        // reload anyway
      }
    })();
    window.setTimeout(() => window.location.replace("/"), 4500);
  }, []);
  const visibleThoughtPrompts = useMemo(() => {
    const listIsVisible = Boolean(activeList || isShoppingMode);
    return normalizeThoughtPrompts(
      thoughtPrompts.filter(
        (prompt) =>
          listIsVisible ||
          !/^(?:close list|open another list)$/i.test(prompt),
      ),
    );
  }, [activeList, isShoppingMode, thoughtPrompts]);
  const activeListTheme = listColorThemeFor(activeList);
  const activeListUsesBlackTheme =
    activeListTheme.label.toLowerCase().includes("black") ||
    activeListTheme.foreground.toLowerCase() === "#050505";
  const compactListPanelStyle = useMemo<React.CSSProperties>(
    () => ({
      color: activeListTheme.foreground,
      borderColor: activeListUsesBlackTheme
        ? "rgba(255,255,255,0.42)"
        : "rgba(232,180,107,0.56)",
      background: activeListUsesBlackTheme
        ? "linear-gradient(180deg, rgba(246,241,231,0.88), rgba(210,200,184,0.76))"
        : "radial-gradient(circle at 18% 0%, rgba(232,180,107,0.28), transparent 34%), linear-gradient(180deg, rgba(62,39,21,0.9), rgba(23,17,14,0.9) 46%, rgba(8,5,4,0.9))",
      boxShadow: activeListUsesBlackTheme
        ? "inset 0 1px 20px rgba(255,255,255,0.36), 0 18px 42px rgba(0,0,0,0.42)"
        : "inset 0 1px 22px rgba(255,215,146,0.12), 0 18px 48px rgba(0,0,0,0.52), 0 0 42px rgba(232,180,107,0.18)",
    }),
    [activeListTheme, activeListUsesBlackTheme],
  );
  const compactListMutedStyle = useMemo<React.CSSProperties>(
    () => ({
      color: activeListUsesBlackTheme
        ? "rgba(5,5,5,0.68)"
        : "rgba(255,232,190,0.66)",
    }),
    [activeListUsesBlackTheme],
  );
  const compactListRowStyle = useMemo<React.CSSProperties>(
    () => ({
      background: activeListUsesBlackTheme
        ? "rgba(255,255,255,0.48)"
        : "linear-gradient(180deg, rgba(255,226,176,0.08), rgba(0,0,0,0.24))",
      borderColor: activeListUsesBlackTheme
        ? "rgba(5,5,5,0.12)"
        : "rgba(232,180,107,0.28)",
      boxShadow: activeListUsesBlackTheme
        ? "0 10px 24px rgba(0,0,0,0.12)"
        : "inset 0 1px 0 rgba(255,224,170,0.08), 0 10px 26px rgba(0,0,0,0.2)",
    }),
    [activeListUsesBlackTheme],
  );
  const compactListBadgeStyle = useMemo<React.CSSProperties>(
    () => ({
      background: activeListUsesBlackTheme
        ? "rgba(5,5,5,0.08)"
        : "linear-gradient(180deg, rgba(232,180,107,0.24), rgba(232,180,107,0.08))",
      borderColor: activeListUsesBlackTheme
        ? "rgba(5,5,5,0.14)"
        : "rgba(232,180,107,0.32)",
      color: activeListTheme.foreground,
    }),
    [activeListTheme.foreground, activeListUsesBlackTheme],
  );
  const compactListControlStyle = useMemo<React.CSSProperties>(
    () => ({
      background: activeListUsesBlackTheme
        ? "rgba(5,5,5,0.08)"
        : "rgba(12,8,6,0.46)",
      color: activeListTheme.foreground,
      borderColor: activeListUsesBlackTheme
        ? "rgba(5,5,5,0.12)"
        : "rgba(232,180,107,0.22)",
    }),
    [activeListTheme.foreground, activeListUsesBlackTheme],
  );

  const rememberConversationLine = useCallback(
    (role: MemoryConversationLine["role"], text: string) => {
      const cleaned = cleanMemoryText(text, 220);
      if (!cleaned || isInternalSignal(cleaned)) return;
      // Don't pollute conversation memory with the account-setup exchange —
      // spelling the email, name capture, the send-confirm. That signup
      // mechanics used to FLOOD the resume snapshot, so on return 6 recalled
      // "we were working on your email setup" instead of the user's real topic
      // (G 2026-06-07, hit on every return test). Skip those turns; the real
      // conversation before and after signup is what we keep. The 30-line
      // window alone didn't help — a long email-spell still buried the topic.
      if (
        accountSetupAwaitingEmailRef.current ||
        accountSetupAwaitingNameRef.current ||
        accountSetupAwaitingSendRef.current ||
        accountSetupPendingEmailRef.current !== null
      ) {
        return;
      }
      // Keep the last 30 lines (was 12): a short account-setup tail used to push
      // the user's actual TOPIC out of memory, so on return 6 only recalled the
      // signup mechanics, not what they came to build (G 2026-06-03: came in
      // about isolveyourproblems.ai, 6 only remembered "you were giving me your
      // email"). 30 lines keeps the real subject in the resume snapshot.
      // r33 (G 2026-06-12 21:15, the doubled bug-report transcript — "why is
      // so much written twice?"): same role + same text inside 5s is a
      // double-writer artifact, never a real repeat. One turn, one line.
      const dupKey = `${role}:${cleaned.toLowerCase()}`;
      if (
        lastRememberedLineRef.current &&
        lastRememberedLineRef.current.key === dupKey &&
        Date.now() - lastRememberedLineRef.current.at < 5000
      ) {
        return;
      }
      lastRememberedLineRef.current = { key: dupKey, at: Date.now() };
      recentConversationRef.current = [
        ...recentConversationRef.current,
        { role, text: cleaned },
      ].slice(-30);
    },
    [],
  );

  // r26: brain replies must also land in recentConversationRef — without them
  // the history sent to the brain is one-sided and 6 kept re-introducing
  // himself. This assignment supersedes the r25 voiceLogTurn-only bridge
  // (declared earlier; this effect runs after it, so this closure wins).
  useEffect(() => {
    rememberLineRef.current = rememberConversationLine;
    assistantLogRef.current = (text: string) => {
      if (mode === "CUSTOM") voiceLogTurn("assistant", text);
      rememberConversationLine("assistant", text);
    };
  }, [mode, voiceLogTurn, rememberConversationLine]);

  // v2.1 resume-bug fix (part b): this used to be a no-op (`return message`),
  // so a returning signed-in user's memory snapshot never reached 6's brain.
  // Now it prepends the resume context (built in the /api/account/me effect)
  // to the FIRST brain message after a return, then flips the injected flag
  // so we don't re-send the dump on every turn. Part (a)'s connect-time
  // effect is the primary delivery path; this is belt-and-suspenders for the
  // case where the user speaks before that effect fires.
  const buildMemoryAugmentedMessage = useCallback(
    (message: string) => {
      if (accountMemoryContextInjectedRef.current) return message;
      const snapshot = accountMemorySnapshotRef.current;
      const contextText = snapshot?.contextText?.trim();
      if (!contextText) return message;
      accountMemoryContextInjectedRef.current = true;
      return `${contextText}\n\nThe user just said: ${message}`;
    },
    [],
  );

  const buildAccountResumeState = useCallback(() => {
    const pendingQuery = onlineLookupPendingQueryRef.current;
    const lookupLocation = onlineLookupLocationRef.current;
    const hasOnlineLookupState = Boolean(
      pendingQuery ||
        lookupLocation ||
        onlineLookupNotice ||
        onlineLookupSources.length > 0 ||
        isOnlineLookupLoading,
    );
    const awaitingPreferences = Boolean(
      pendingQuery &&
        lookupLocation &&
        shouldAskPreferencesBeforeLookup(pendingQuery),
    );

    return {
      activeListId,
      activeListTitle: activeList?.title ?? null,
      isShoppingMode,
      lastUserText: lastUserTextRef.current || null,
      lastAssistantText: lastAvatarResponseRef.current || null,
      recentConversation: recentConversationRef.current,
      onlineLookup: hasOnlineLookupState
        ? {
            query: pendingQuery,
            location: lookupLocation,
            notice: onlineLookupNotice,
            sources: onlineLookupSources,
            needsLocation: Boolean(pendingQuery && !lookupLocation),
            awaitingPreferences,
          }
        : null,
      updatedAt: new Date().toISOString(),
    };
  }, [
    activeList,
    activeListId,
    isOnlineLookupLoading,
    isShoppingMode,
    onlineLookupNotice,
    onlineLookupSources,
  ]);

  const savePendingAccountState = useCallback(
    (options: { keepalive?: boolean } = {}) => {
      void options;
      return;
    },
    [],
  );

  useEffect(() => {
    try {
      window.localStorage.removeItem(ACCOUNT_PENDING_STATE_TOKEN_STORAGE_KEY);
    } catch {
      // Pending account state is disabled for the beta.
    }
    accountPendingStateTokenRef.current = null;
  }, []);

  useEffect(() => {
    deviceProfileRef.current = deviceProfile;
    storeDeviceProfile(deviceProfile);
  }, [deviceProfile]);

  useEffect(() => {
    if (!activeList) return;
    const container = isShoppingMode
      ? shoppingListScrollRef.current
      : listScrollRef.current;
    if (!container) return;

    const focus = latestListMutationRef.current;
    requestAnimationFrame(() => {
      if (
        focus?.listId === activeList.id &&
        focus.item &&
        (focus.action === "add" || focus.action === "mention")
      ) {
        const itemIndex = activeList.items.findIndex((item) =>
          itemKeysMatch(item, focus.item ?? ""),
        );
        const row =
          itemIndex >= 0
            ? container.querySelector<HTMLElement>(
                `[data-list-index="${itemIndex}"]`,
              )
            : null;
        if (row) {
          row.scrollIntoView({ block: "center", behavior: "smooth" });
          return;
        }
      }
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    });
  }, [activeList, isShoppingMode, listFocusNonce]);

  // Vision mode state: 'streaming' for Go Live, 'snapshot' for Camera button, null for inactive
  const [visionMode, setVisionMode] = useState<"streaming" | "snapshot" | null>(
    null,
  );

  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoBlob, setRecordedVideoBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // When session fails to start (e.g. no credits), show message and don't auto-restart
  const [sessionStartError, setSessionStartError] = useState<string | null>(
    null,
  );
  const sessionStartErrorRef = useRef<string | null>(null);
  const [isCustomVoiceActive, setIsCustomVoiceActive] = useState(false);
  const voiceIsActive = mode === "CUSTOM" ? isCustomVoiceActive : isActive;
  const voiceIsLoading =
    mode === "CUSTOM" ? voiceStartAwaitingReady : isLoading;

  const runPromptBrain = useCallback(async (text: string) => {
    const latestUserText = text.trim();
    if (latestUserText.length < 3) return;

    const pendingLookupQuery = onlineLookupPendingQueryRef.current;
    if (pendingLookupQuery && !onlineLookupLocationRef.current) {
      setThoughtPrompts(getLookupLocationPrompts(pendingLookupQuery));
      return;
    }
    if (
      pendingLookupQuery &&
      onlineLookupLocationRef.current &&
      shouldAskPreferencesBeforeLookup(pendingLookupQuery)
    ) {
      setThoughtPrompts(getLookupPreferencePrompts(pendingLookupQuery));
      return;
    }

    const fallbackPrompts = normalizeThoughtPrompts(
      getThoughtPrompts(latestUserText),
    );
    const recentUserTexts = [
      ...promptBrainHistoryRef.current,
      latestUserText,
    ].slice(-8);
    promptBrainHistoryRef.current = recentUserTexts;

    const sequence = ++promptBrainSeqRef.current;
    // Note: we used to call setThoughtPrompts(fallbackPrompts) here before the brain
    // fetch. Removed per G's "old goes out, new comes in" — current pills stay until
    // brain returns. fallbackPrompts is still passed in the request body as
    // currentPrompts context. If brain fails entirely, current pills stay (no flash).

    try {
      const response = await fetch("/api/prompt-brain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latestUserText,
          recentUserTexts,
          currentPrompts: fallbackPrompts,
          sessionId: dbSessionIdRef.current,
          testerLabel: testerLabelRef.current,
        }),
      });

      if (!response.ok || sequence !== promptBrainSeqRef.current) return;

      const data = await response.json();
      if (
        Array.isArray(data?.prompts) &&
        data.prompts.every((prompt: unknown) => typeof prompt === "string")
      ) {
        const prompts = data.prompts
          .map((prompt: string) => prompt.trim())
          .filter(Boolean);
        if (prompts.length > 0) {
          setThoughtPrompts(normalizeThoughtPrompts(prompts));
        }
      }
    } catch (error) {
      console.warn("Prompt brain unavailable, using fallback prompts", error);
    }
  }, []);

  const schedulePromptBrain = useCallback(
    (text: string) => {
      const latestUserText = text.trim();
      if (latestUserText.length < 3) return;

      const pendingLookupQuery = onlineLookupPendingQueryRef.current;
      if (pendingLookupQuery && !onlineLookupLocationRef.current) {
        setThoughtPrompts(getLookupLocationPrompts(pendingLookupQuery));
        return;
      }
      if (
        pendingLookupQuery &&
        onlineLookupLocationRef.current &&
        shouldAskPreferencesBeforeLookup(pendingLookupQuery)
      ) {
        setThoughtPrompts(getLookupPreferencePrompts(pendingLookupQuery));
        return;
      }

      // Note: we used to call setThoughtPrompts(getThoughtPrompts(text)) here as an
      // immediate keyword-match update before brain runs. That caused a flash where
      // defaults briefly appeared when no keyword matched, then real brain output
      // replaced them. Removed per G's "old goes out, new comes in" — current pills
      // stay until brain returns the next set.

      if (promptBrainTimeoutRef.current) {
        clearTimeout(promptBrainTimeoutRef.current);
      }
      promptBrainTimeoutRef.current = setTimeout(() => {
        void runPromptBrain(latestUserText);
      }, 600);
    },
    [runPromptBrain],
  );

  useEffect(() => {
    window.localStorage.removeItem(ASSISTANT_LISTS_STORAGE_KEY);
  }, [assistantLists]);

  useEffect(() => {
    if (ACCOUNT_BETA_DISABLED) {
      accountListsLoadedRef.current = true;
      accountMemorySnapshotRef.current = null;
      accountMemoryContextInjectedRef.current = false;
      accountPendingStateTokenRef.current = null;
      recentConversationRef.current = [];
      lastUserTextRef.current = "";
      lastAvatarResponseRef.current = "";
      setAccountEmail(null);
      setAccountAuthChecked(true);
      setAccountNotice(null);
      setAccountVerificationUrl(null);
      setPostVerifyGreeting(null);
      setAssistantLists([]);
      setActiveListId(null);
      setIsShoppingMode(false);
      try {
        window.localStorage.removeItem(ASSISTANT_LISTS_STORAGE_KEY);
        window.localStorage.removeItem(DEVICE_PROFILE_STORAGE_KEY);
        window.localStorage.removeItem(ACCOUNT_PENDING_STATE_TOKEN_STORAGE_KEY);
      } catch {
        // Fresh beta sessions must not depend on browser storage cleanup.
      }
      void fetch("/api/account/me", { cache: "no-store" }).catch(() => {});
      return;
    }

    let cancelled = false;

    // Magic-link return: aiASAP's OTP send issues an IMPLICIT-flow link, so the
    // session token lands in the URL hash (#access_token=...). The server
    // callback can't read a fragment, so it forwards us here with the hash
    // intact. Before asking /api/account/me "are we signed in?", give the
    // browser Supabase client a chance to parse that hash and PERSIST the
    // session to cookies — otherwise the very first account/me reads anonymous
    // (cookies not written yet) and 6 greets the returning user as brand-new
    // this session. Awaiting getSession() resolves the SDK's URL-detection
    // initialize step, which writes the cookies the server route then reads.
    // (2026-06-01 magic-link recall fix.) Best-effort + short-bounded so a
    // hung Supabase init never blocks 6's greeting.
    const hasAuthHashOrCode = () => {
      if (typeof window === "undefined") return false;
      const hash = INITIAL_URL_HASH || window.location.hash || "";
      const search = window.location.search || "";
      return (
        hash.includes("access_token") ||
        hash.includes("refresh_token") ||
        /[?&#](code|token_hash)=/.test(`${search}${hash}`)
      );
    };

    const ensureSessionFromUrl = async () => {
      if (!hasAuthHashOrCode()) return;
      const supabase = getSupabaseBrowserOrNull();
      if (!supabase) return;
      try {
        // ROOT CAUSE (2026-06-01 LIVE, DB-confirmed): the magic link is IMPLICIT
        // flow — the session token comes back in the URL *hash*
        // (#access_token=...&refresh_token=...). The browser client is configured
        // flowType:"pkce", under which detectSessionInUrl does NOT parse an
        // implicit hash. So Supabase signed the user in SERVER-side (auth.users
        // last_sign_in updated) but the BROWSER never persisted the session →
        // /api/account/me read anonymous → 6 greeted a returning user as a
        // stranger and used the first-timer intro. (My earlier "wait for the
        // session" fix had nothing to wait for.)
        //
        // FIX: parse the hash OURSELVES and setSession() explicitly. With
        // @supabase/ssr that writes the auth cookies the server route reads —
        // deterministic, and independent of flowType (so PKCE ?code= OAuth still
        // works via the SDK's own detection in the else branch).
        const liveHash = INITIAL_URL_HASH || window.location.hash || "";
        const rawHash = liveHash.startsWith("#") ? liveHash.slice(1) : liveHash;
        const hp = new URLSearchParams(rawHash);
        const accessToken = hp.get("access_token");
        const refreshToken = hp.get("refresh_token");
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          // The browser setSession above did NOT reliably land a SERVER-readable
          // cookie (DB-confirmed 2026-06-02: /api/account/me saw authCookies=0 on
          // the magic-link return, same browser → 6 greeted a returning user as
          // new). Hand the tokens to a server route that writes the auth cookies
          // onto its response, so /api/account/me sees the signed-in user on this
          // same load. Best-effort; the client session is the backstop.
          try {
            await fetch("/api/auth/set-cookie", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                access_token: accessToken,
                refresh_token: refreshToken,
              }),
            });
          } catch {
            // ignore — client session + account/me retry remain backstops
          }
        } else {
          // No implicit hash tokens (?code= PKCE, or already detected) — let the
          // SDK finish its own URL detection.
          await supabase.auth.getSession();
        }
        // Confirm a session is actually present (cookies written) before we ask
        // account/me, so the very first account/me sees the signed-in user.
        const deadline = Date.now() + 6000;
        while (Date.now() < deadline) {
          const { data } = await supabase.auth.getSession();
          if (data.session) return;
          await new Promise((r) => setTimeout(r, 150));
        }
      } catch {
        // Detection failed — fall through; account/me + the SIGNED_IN listener
        // in AuthProvider remain the backstops.
      }
    };

    // Magic-link return hardening (2026-06-02): account/me's getUser() is raced
    // against a server-side timeout, and on a cold serverless start the first
    // call can resolve "anonymous" before the session is readable → 6 greets a
    // just-returned user as brand-new. When we KNOW we just landed an auth
    // hash/code, retry account/me a few times so a slow cold-start gets a chance
    // to resolve before we accept anonymous. Normal first-visits (no hash) make
    // exactly one call, so 6's greeting speed is unchanged for new users.
    const fetchAccountMe = async () => {
      const expectSignedIn = hasAuthHashOrCode();
      const maxTries = expectSignedIn ? 4 : 1;
      for (let attempt = 1; attempt <= maxTries; attempt++) {
        try {
          const response = await fetch("/api/account/me", { cache: "no-store" });
          if (response.ok) {
            const data = await response.json();
            if (data?.authenticated || !expectSignedIn || attempt === maxTries) {
              return data;
            }
          } else if (!expectSignedIn || attempt === maxTries) {
            return null;
          }
        } catch {
          if (!expectSignedIn || attempt === maxTries) return null;
        }
        if (attempt < maxTries) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      return null;
    };

    void ensureSessionFromUrl()
      .then(() => {
        if (cancelled) return null;
        return fetchAccountMe();
      })
      .then((data) => {
        if (cancelled) return;
        if (!data?.authenticated) {
          accountSignedInRef.current = false;
          accountListsLoadedRef.current = true;
          setAccountAuthChecked(true);
          return;
        }
        if (typeof data.user?.email === "string") {
          setAccountEmail(data.user.email);
          accountSignedInRef.current = true;
          accountPendingStateTokenRef.current = null;
          try {
            window.localStorage.removeItem(
              ACCOUNT_PENDING_STATE_TOKEN_STORAGE_KEY,
            );
          } catch {
            // Ignore storage cleanup failures.
          }
          // NEW-DEVICE ALERT (2026-06-11, G's yes): every signed-in visit
          // reports its device marker; first touch from a new device emails
          // the owner. Fire-and-forget.
          try {
            const DEVICE_KEY = "aiasap.deviceId.v1";
            let deviceId = window.localStorage.getItem(DEVICE_KEY);
            if (!deviceId) {
              deviceId = window.crypto.randomUUID();
              window.localStorage.setItem(DEVICE_KEY, deviceId);
            }
            const ua = window.navigator.userAgent;
            const browser = /Edg\//.test(ua)
              ? "Edge"
              : /Chrome\//.test(ua)
                ? "Chrome"
                : /Safari\//.test(ua)
                  ? "Safari"
                  : /Firefox\//.test(ua)
                    ? "Firefox"
                    : "Browser";
            const platform = /Windows/.test(ua)
              ? "Windows"
              : /Mac/.test(ua)
                ? "Mac"
                : /Android/.test(ua)
                  ? "Android"
                  : /iPhone|iPad/.test(ua)
                    ? "iPhone/iPad"
                    : "Device";
            void fetch("/api/account/device-check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                deviceId,
                label: `${browser} on ${platform}`,
              }),
            }).catch(() => {});
          } catch {
            // device marker is best-effort
          }
          // Returning users get THEIR size back on any device (G 2026-06-10:
          // "the pill boxes stay the size of when last used... if they have
          // an account and are returning"). Account beats this device's
          // localStorage when both exist. (Bound was a stale <=3 after round
          // 14 raised the max to 4 — a saved max size was ignored on load.)
          if (
            typeof data.uiSizeLevel === "number" &&
            data.uiSizeLevel >= 0 &&
            data.uiSizeLevel <= UI_SIZE_MAX_LEVEL
          ) {
            setPromptSizeLevel(data.uiSizeLevel);
          }
          // Voice-set timezone follows the account (timezone ladder rung 2).
          if (typeof data.timezone === "string" && data.timezone) {
            sessionTimezoneRef.current = data.timezone;
          }
        }
        const rawAccountFullName =
          typeof data.user?.fullName === "string"
            ? cleanDeviceName(data.user.fullName)
            : null;
        // Drop stored JUNK names (e.g. "Call Me" / "My Name" captured from a
        // lead-in phrase) so 6 never greets "Welcome back, Call Me" - nameless
        // beats wrong (G 2026-06-08). Forward-fixed in extractDeviceNameCandidate.
        const accountFullName = isJunkPersonName(rawAccountFullName)
          ? null
          : rawAccountFullName;
        if (accountFullName) {
          setDeviceProfile((current) =>
            current.name === accountFullName
              ? current
              : {
                  ...current,
                  name: accountFullName,
                  updatedAt: Date.now(),
                },
          );
        }
        const cleanedLists: AssistantList[] = Array.isArray(data.lists)
          ? data.lists
              .filter(isAssistantList)
              .map((list: AssistantList) => ({
                ...list,
                items: cleanStoredListItems(list.items),
              }))
          : [];
        const resumeState =
          data.resumeState && typeof data.resumeState === "object"
            ? (data.resumeState as Record<string, unknown>)
            : null;
        const accountStatus = new URLSearchParams(window.location.search).get(
          "account",
        );
        const resumeListId =
          cleanedLists.length > 0 && typeof resumeState?.activeListId === "string"
            ? resumeState.activeListId
            : null;
        const resumeTitle =
          cleanedLists.length > 0 &&
          typeof resumeState?.activeListTitle === "string"
            ? resumeState.activeListTitle.trim().toLowerCase()
            : null;
        const restoredList =
          (resumeListId
            ? cleanedLists.find((list) => list.id === resumeListId)
            : null) ||
          (resumeTitle
            ? cleanedLists.find(
                (list) => list.title.trim().toLowerCase() === resumeTitle,
              )
            : null) ||
          null;

        if (typeof resumeState?.lastUserText === "string") {
          lastUserTextRef.current = resumeState.lastUserText;
        }
        if (typeof resumeState?.lastAssistantText === "string") {
          lastAvatarResponseRef.current = resumeState.lastAssistantText;
        }
        recentConversationRef.current = cleanMemoryConversation(
          resumeState?.recentConversation,
        );

        const onlineLookup =
          resumeState?.onlineLookup &&
          typeof resumeState.onlineLookup === "object"
            ? (resumeState.onlineLookup as Record<string, unknown>)
            : null;
        const restoredOnlineQuery =
          typeof onlineLookup?.query === "string" ? onlineLookup.query : null;
        const restoredOnlineLocation =
          typeof onlineLookup?.location === "string"
            ? onlineLookup.location
            : null;
        accountMemorySnapshotRef.current = buildAccountMemorySnapshot({
          lists: cleanedLists,
          resumeState,
          restoredList,
          onlineQuery: restoredOnlineQuery,
          onlineLocation: restoredOnlineLocation,
          name: accountFullName,
          visitCount: typeof data.visitCount === "number" ? data.visitCount : 1,
          longGap: data.longGap === true,
        });
        accountMemoryContextInjectedRef.current = false;

        onlineLookupPendingQueryRef.current = null;
        onlineLookupLocationRef.current = null;
        setOnlineLookupSources([]);
        setOnlineLookupResultLines([]);
        setOnlineLookupNotice(null);

        if (cleanedLists.length > 0) {
          setAssistantLists(cleanedLists);
          setActiveListId(null);
          setIsShoppingMode(false);
        } else {
          setActiveListId(null);
          setIsShoppingMode(false);
        }
        if (accountStatus === "verified") {
          // Hard-coded return greeting. Now greets BY NAME when we have a clean
          // one — the old "First Time"/"It Is" name-capture leak is fixed
          // (stop-words reject those), so a saved name here is real. The name
          // MUST ride this greeting: it's spoken INSTANTLY, while 6's memory
          // snapshot (which also carries the name) can land a beat late — so an
          // early "do you remember my name?" used to hit before memory was ready
          // and 6 asked for it again (G 2026-06-04: "you should have used my
          // name in that intro"). Falls back to name-less if we have no name.
          setPostVerifyGreeting(
            accountFullName
              ? `Welcome back, ${accountFullName}! It's 6 — still got your back. Want to pick up right where we left off, or start something new?`
              : `Welcome back! It's 6 — still got your back. Want to pick up right where we left off, or start something new?`,
          );
          window.history.replaceState(
            {},
            "",
            `${window.location.pathname}${window.location.hash}`,
          );
        }
        accountListsLoadedRef.current = true;
        setAccountAuthChecked(true);
      })
      .catch((error) => {
        console.warn("Account load failed:", error);
        if (!cancelled) {
          accountListsLoadedRef.current = true;
          setAccountAuthChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !postVerifyGreeting ||
      postVerifyGreetingSpokenRef.current ||
      sessionState !== SessionState.CONNECTED ||
      !isStreamReady ||
      !audioUnlocked // wait for audio unlock so the welcome-back is HEARD, not mouthed
    ) {
      return;
    }
    postVerifyGreetingSpokenRef.current = true;
    setAccountNotice("Account verified");
    console.log("[return-greeting DIAG] speaking hard-coded welcome-back (audio unlocked)");
    // Cut off 6's own CW opener FIRST so the hard-coded welcome-back is the
    // SOLE greeting. Without this the brain's default "What's on your mind
    // today?" played right alongside the welcome-back on return (G 2026-06-03:
    // "he just launched right into it, not the hard-coded return intro").
    void (async () => {
      try {
        await interrupt();
      } catch {
        // never block the greeting on an interrupt hiccup
      }
      await repeat(postVerifyGreeting);
      lastAvatarResponseRef.current = postVerifyGreeting;
      rememberConversationLine("assistant", postVerifyGreeting);
      lastVisionResponseTimeRef.current = Date.now();
    })();
  }, [interrupt, isStreamReady, postVerifyGreeting, rememberConversationLine, repeat, sessionState, audioUnlocked]);

  // v2.1 resume-bug fix (part a): once the LiveAvatar session is CONNECTED and
  // the resume snapshot hasn't been injected yet, feed the SIGNED-IN USER
  // MEMORY (contextText) into 6's brain via sessionRef.message() and — unless
  // the ?account=verified welcome already spoke (postVerifyGreeting) — speak a
  // buildReturningGreeting() line so 6 actually resumes instead of acting like
  // a brand-new session. Sets accountMemoryContextInjectedRef so it fires once
  // and so buildMemoryAugmentedMessage stops re-prepending the dump.
  useEffect(() => {
    if (
      ACCOUNT_BETA_DISABLED ||
      accountMemoryContextInjectedRef.current ||
      sessionState !== SessionState.CONNECTED ||
      !isStreamReady ||
      !audioUnlocked // don't inject/greet into the muted-load window
    ) {
      return;
    }
    const snapshot = accountMemorySnapshotRef.current;
    const contextText = snapshot?.contextText?.trim();
    if (!contextText) return;

    // When the hard-coded ?account=verified welcome is the opener, do NOT inject
    // the resume dump via .message() — LiveAvatar treats it as a turn, so 6
    // babbles filler ("Okay… I'm all…") OVER the greeting. Let the hard-coded
    // welcome open clean; durable memory rides the CW dynamic vars. (G 2026-06-03)
    if (postVerifyGreeting || postVerifyGreetingSpokenRef.current) {
      accountMemoryContextInjectedRef.current = true;
      return;
    }

    accountMemoryContextInjectedRef.current = true;

    // No hard-coded greeting (e.g. device-memory resume): inject the resume
    // context and speak a returning greeting. (r34: FULL-mode-only + armored
    // — this exact line crashed G's first signed-in localhost return.)
    injectFullModeContext(contextText);
    const greeting = buildReturningGreeting(deviceProfileRef.current, snapshot);
    void Promise.resolve(repeat(greeting))
      .then(() => {
        lastAvatarResponseRef.current = greeting;
        rememberConversationLine("assistant", greeting);
        lastVisionResponseTimeRef.current = Date.now();
      })
      .catch((err) => {
        console.warn("Returning greeting injection failed:", err);
      });
  }, [
    isStreamReady,
    postVerifyGreeting,
    rememberConversationLine,
    repeat,
    sessionState,
    audioUnlocked,
  ]);

  useEffect(() => {
    if (!accountEmail || !accountListsLoadedRef.current) return;
    if (accountSaveTimeoutRef.current) {
      clearTimeout(accountSaveTimeoutRef.current);
    }
    accountSaveTimeoutRef.current = setTimeout(() => {
      void fetch("/api/account/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lists: assistantLists,
          resumeState: buildAccountResumeState(),
        }),
      }).catch((error) => console.warn("Account list save failed:", error));
    }, 900);
  }, [accountEmail, assistantLists, buildAccountResumeState]);

  useEffect(() => {
    if (accountEmail || !accountPendingStateTokenRef.current) return;
    if (pendingAccountSaveTimeoutRef.current) {
      clearTimeout(pendingAccountSaveTimeoutRef.current);
    }
    pendingAccountSaveTimeoutRef.current = setTimeout(() => {
      savePendingAccountState();
    }, 900);
    return () => {
      if (pendingAccountSaveTimeoutRef.current) {
        clearTimeout(pendingAccountSaveTimeoutRef.current);
      }
    };
  }, [
    accountEmail,
    activeListId,
    assistantLists,
    buildAccountResumeState,
    isOnlineLookupLoading,
    isShoppingMode,
    onlineLookupNotice,
    onlineLookupSources,
    savePendingAccountState,
  ]);

  useEffect(() => {
    const saveBeforeLeave = () => savePendingAccountState({ keepalive: true });
    window.addEventListener("pagehide", saveBeforeLeave);
    window.addEventListener("beforeunload", saveBeforeLeave);
    return () => {
      window.removeEventListener("pagehide", saveBeforeLeave);
      window.removeEventListener("beforeunload", saveBeforeLeave);
    };
  }, [savePendingAccountState]);

  useEffect(() => {
    if (
      !accountEmail ||
      !accountListsLoadedRef.current ||
      !deviceProfile.name
    ) {
      return;
    }

    if (accountProfileSaveTimeoutRef.current) {
      clearTimeout(accountProfileSaveTimeoutRef.current);
    }

    const fullName = deviceProfile.name;
    accountProfileSaveTimeoutRef.current = setTimeout(() => {
      void fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      })
        .then(async (response) => {
          if (!response.ok) return;
          const data = await response.json().catch(() => null);
          const savedName =
            typeof data?.user?.fullName === "string"
              ? cleanDeviceName(data.user.fullName)
              : null;
          if (savedName && savedName !== deviceProfileRef.current.name) {
            setDeviceProfile((current) => ({
              ...current,
              name: savedName,
              updatedAt: Date.now(),
            }));
          }
        })
        .catch((error) => console.warn("Account profile save failed:", error));
    }, 700);

    return () => {
      if (accountProfileSaveTimeoutRef.current) {
        clearTimeout(accountProfileSaveTimeoutRef.current);
      }
    };
  }, [accountEmail, deviceProfile.name]);

  const ensureAssistantList = useCallback(
    (
      intent: { title: string; kind: AssistantListKind },
      options: { preferFresh?: boolean } = {},
    ): string => {
      const now = Date.now();
      const normalizedTitle =
        intent.title === "New List"
          ? `List ${assistantLists.length + 1}`
          : normalizeListTitle(intent.title, intent.kind);
      const existing = assistantLists.find(
        (list) => list.title.toLowerCase() === normalizedTitle.toLowerCase(),
      );

      if (existing && !options.preferFresh) {
        lastEnsuredListRef.current = {
          id: existing.id,
          title: existing.title,
          wasNew: false,
        };
        onlineLookupPendingQueryRef.current = null;
        onlineLookupLocationRef.current = null;
        setOnlineLookupNotice(null);
        setOnlineLookupSources([]);
        setOnlineLookupResultLines([]);
        setSourcePreview(null);
        setActiveListId(existing.id);
        return existing.id;
      }

      const baseId = listIdForTitle(normalizedTitle);
      let id = baseId;
      let suffix = 2;
      while (assistantLists.some((list) => list.id === id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }

      const newList: AssistantList = {
        id,
        title: normalizedTitle,
        kind: intent.kind,
        items: [],
        displayStyle: "numbered",
        accentColor: "amber",
        createdAt: now,
        updatedAt: now,
      };

      setAssistantLists((currentLists) => [...currentLists, newList]);
      lastEnsuredListRef.current = {
        id,
        title: normalizedTitle,
        wasNew: true,
      };
      onlineLookupPendingQueryRef.current = null;
      onlineLookupLocationRef.current = null;
      setOnlineLookupNotice(null);
      setOnlineLookupSources([]);
      setOnlineLookupResultLines([]);
      setSourcePreview(null);
      setActiveListId(id);
      return id;
    },
    [assistantLists],
  );

  const addItemsToList = useCallback((listId: string, items: string[]) => {
    if (items.length === 0) return false;
    // r26 (G live 2026-06-12 08:36: "toothbrush has only a small T" — three
    // rounds fighting for a capital): every item lands with a capital first letter.
    items = items.map((item) => item.charAt(0).toUpperCase() + item.slice(1));
    const list = assistantLists.find((item) => item.id === listId);
    if (!list) {
      latestListMutationRef.current = {
        listId,
        item: items[items.length - 1] ?? null,
        action: "add",
      };
      setAssistantLists((currentLists) =>
        currentLists.map((currentList) => {
          if (currentList.id !== listId) return currentList;
          const nextItems = [...currentList.items];
          for (const item of items) {
            if (
              !nextItems.some(
                (existing) => existing.toLowerCase() === item.toLowerCase(),
              )
            ) {
              nextItems.push(item);
            }
          }
          return {
            ...currentList,
            items: nextItems.slice(0, MAX_LIST_ITEMS),
            updatedAt: Date.now(),
          };
        }),
      );
      setListFocusNonce((value) => value + 1);
      return true;
    }
    const nextItems = [...list.items];
    let changed = false;
    for (const item of items) {
      if (
        !nextItems.some(
          (existing) => existing.toLowerCase() === item.toLowerCase(),
        )
      ) {
        nextItems.push(item);
        changed = true;
      }
    }
    if (!changed) return false;

    latestListMutationRef.current = {
      listId,
      item: items[items.length - 1] ?? null,
      action: "add",
    };
    setAssistantLists((currentLists) =>
      currentLists.map((currentList) => {
        if (currentList.id !== listId) return currentList;
        return {
          ...currentList,
          items: nextItems.slice(0, MAX_LIST_ITEMS),
          updatedAt: Date.now(),
        };
      }),
    );
    setListFocusNonce((value) => value + 1);
    return true;
  }, [assistantLists]);

  // r32 (G live 2026-06-12 20:48: "make number four say yogurt" had no
  // handler — three rounds of fighting, and the brain claimed fixes that
  // never happened): a real rename-by-number.
  const renameListItem = useCallback(
    (listId: string, itemIndex: number, newText: string) => {
      const list = assistantLists.find((item) => item.id === listId);
      if (!list || itemIndex < 0 || itemIndex >= list.items.length)
        return false;
      const cleaned = newText.trim();
      if (!cleaned) return false;
      const cased = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      if (list.items[itemIndex] === cased) return false;
      const nextItems = [...list.items];
      nextItems[itemIndex] = cased;
      latestListMutationRef.current = { listId, item: cased, action: "add" };
      setAssistantLists((currentLists) =>
        currentLists.map((currentList) =>
          currentList.id === listId
            ? { ...currentList, items: nextItems, updatedAt: Date.now() }
            : currentList,
        ),
      );
      setListFocusNonce((value) => value + 1);
      return true;
    },
    [assistantLists],
  );

  const capitalizeListItems = useCallback(
    (listId: string) => {
      const list = assistantLists.find((item) => item.id === listId);
      if (!list) return false;
      const nextItems = list.items.map(
        (item) => item.charAt(0).toUpperCase() + item.slice(1),
      );
      const changed = nextItems.some(
        (item, index) => item !== list.items[index],
      );
      if (!changed) return false;
      setAssistantLists((currentLists) =>
        currentLists.map((currentList) =>
          currentList.id === listId
            ? { ...currentList, items: nextItems, updatedAt: Date.now() }
            : currentList,
        ),
      );
      setListFocusNonce((value) => value + 1);
      return true;
    },
    [assistantLists],
  );

  const removeItemsFromList = useCallback((listId: string, items: string[]) => {
    if (items.length === 0) return false;
    const list = assistantLists.find((item) => item.id === listId);
    if (!list) return false;
    const wantsRemoveAddLiteral = items.some((item) => /^add$/i.test(item));
    const nextItems = list.items.filter(
      (item) =>
        wantsRemoveAddLiteral && /^add$/i.test(item)
          ? false
          : !items.some((removeItem) => itemKeysMatch(item, removeItem)),
    );
    const changed = nextItems.length !== list.items.length;
    if (!changed) return false;

    latestListMutationRef.current = {
      listId,
      item: items[0] ?? null,
      action: "remove",
    };
    setAssistantLists((currentLists) =>
      currentLists.map((currentList) =>
        currentList.id === listId
          ? {
              ...currentList,
              items: nextItems,
              updatedAt: Date.now(),
            }
          : currentList,
      ),
    );
    setListFocusNonce((value) => value + 1);
    return true;
  }, [assistantLists]);

  const deleteAssistantList = useCallback((listId: string) => {
    setAssistantLists((currentLists) =>
      currentLists.filter((currentList) => currentList.id !== listId),
    );
    setActiveListId((currentActiveId) =>
      currentActiveId === listId ? null : currentActiveId,
    );
    setIsShoppingMode(false);
    latestListMutationRef.current = null;
    pendingListDeleteRef.current = null;
  }, []);

  const removeListItemAtIndex = useCallback(
    (listId: string, itemIndex: number) => {
      setAssistantLists((currentLists) =>
        currentLists.map((list) => {
          if (list.id !== listId) return list;
          latestListMutationRef.current = {
            listId,
            item: list.items[itemIndex] ?? null,
            action: "remove",
          };
          return {
            ...list,
            items: list.items.filter((_, index) => index !== itemIndex),
            updatedAt: Date.now(),
          };
        }),
      );
      setListFocusNonce((value) => value + 1);
    },
    [],
  );

  const setListDisplayStyle = useCallback(
    (listId: string, style: ListDisplayStyle) => {
      setAssistantLists((currentLists) =>
        currentLists.map((list) =>
          list.id === listId
            ? { ...list, displayStyle: style, updatedAt: Date.now() }
            : list,
        ),
      );
    },
    [],
  );

  const setListAccentColor = useCallback(
    (listId: string, update: ListAccentUpdate) => {
      setAssistantLists((currentLists) =>
        currentLists.map((list) =>
          list.id === listId
            ? {
                ...list,
                accentColor: update.accentColor,
                accentHex: update.accentHex,
                accentLabel: update.accentLabel,
                updatedAt: Date.now(),
              }
            : list,
        ),
      );
    },
    [],
  );

  const moveActiveList = useCallback(
    (direction: 1 | -1) => {
      if (assistantLists.length === 0) return null;
      const currentIndex = Math.max(
        0,
        assistantLists.findIndex((list) => list.id === activeListId),
      );
      const nextIndex =
        (currentIndex + direction + assistantLists.length) %
        assistantLists.length;
      const nextList = assistantLists[nextIndex];
      setActiveListId(nextList.id);
      return nextList;
    },
    [activeListId, assistantLists],
  );

  const startAccountSetup = useCallback(
    async (email: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      // Dedupe: don't re-send the sign-in link if we just sent it to this same
      // address (G 2026-06-09 duplicate magic links). 90s window; a genuine
      // resend still works after that.
      const prevLinkSend = lastAccountLinkSendRef.current;
      if (
        prevLinkSend &&
        prevLinkSend.email === normalizedEmail &&
        Date.now() - prevLinkSend.at < 90000
      ) {
        const spoken =
          "I already sent that sign-in link a moment ago - check your email, it can take a minute to land.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        rememberConversationLine("assistant", spoken);
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      }
      lastAccountLinkSendRef.current = { email: normalizedEmail, at: Date.now() };
      setAccountNotice("Sending Account Link");
      // G 2026-06-10 (Roger session): the pillbox sat unchanged through the
      // send round-trip and he read the dead air as "nothing happened". Show
      // "Sending Email..." in the chest box IMMEDIATELY; it flips to
      // "Email Link Sent ✓" (or clears on failure) when the call returns.
      setChestEmailStatus("Sending Email...");
      setShowChestEmail(true);
      setAccountVerificationUrl(null);
      try {
        const response = await fetch("/api/account/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            fullName: deviceProfileRef.current.name,
            sessionId: dbSessionIdRef.current,
            lists: assistantLists,
            resumeState: buildAccountResumeState(),
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || "Failed to send account link");
        }

        const verificationUrl =
          typeof data?.verificationUrl === "string" ? data.verificationUrl : null;
        const pendingStateToken =
          typeof data?.pendingStateToken === "string"
            ? data.pendingStateToken
            : null;
        accountPendingStateTokenRef.current = pendingStateToken;
        try {
          if (pendingStateToken) {
            window.localStorage.setItem(
              ACCOUNT_PENDING_STATE_TOKEN_STORAGE_KEY,
              pendingStateToken,
            );
          } else {
            window.localStorage.removeItem(
              ACCOUNT_PENDING_STATE_TOKEN_STORAGE_KEY,
            );
          }
        } catch {
          // Pending account state is still stored server-side from the initial send.
        }
        if (pendingStateToken) savePendingAccountState();
        const spoken = data?.emailSent
          ? "Done. I sent you an email. Check for it now and click the link. When you come back, we'll pick up right where we left off."
          : verificationUrl
            ? "I saved your email, but the email did not send. I put the account link on your screen for this test."
            : "I saved your email, but the email sender is not fully connected yet. I made a note for G to finish account email before this goes live.";
        setAccountNotice(
          // G (2026-06-01): success confirmation moves INTO the chest box, so the
          // top banner is suppressed for the emailSent case. Other cases keep it.
          data?.emailSent
            ? null
            : verificationUrl
              ? "Account Link Ready for This Test"
              : "Account Email Needs Setup",
        );
        setAccountVerificationUrl(verificationUrl);
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        rememberConversationLine("assistant", spoken);
        lastVisionResponseTimeRef.current = Date.now();
        accountSetupOfferMadeRef.current = false;
        accountSetupDeclinedAtRef.current = 0;
        accountSetupEmailMissCountRef.current = 0;
        setEmailEntryOpen(false);
        setTypedAccountEmail("");
        // Cancel any in-progress letter reveal before changing the box.
        if (chestRevealTimerRef.current) {
          clearTimeout(chestRevealTimerRef.current);
          chestRevealTimerRef.current = null;
        }
        chestRevealActiveRef.current = false;
        if (data?.emailSent) {
          // FIX (2026-06-01): show the confirmation IN the chest box, not the top
          // banner. 1) clear the address, 2) show "Account Link Sent", 3) fade.
          // CHANGE 1: forget 6's last parsed readback now the address is sent.
          lastAvatarParsedEmailRef.current = null;
          chestEmailTextRef.current = "";
          setChestEmailText("");
          setChestEmailStatus("Email Link Sent");
          setShowChestEmail(true);
          if (chestStatusTimerRef.current) {
            clearTimeout(chestStatusTimerRef.current);
          }
          chestStatusTimerRef.current = setTimeout(() => {
            setShowChestEmail(false);
            setChestEmailStatus(null);
            // FIX (Item B, 2026-06-01): when the "Account Link Sent" box fades,
            // restore the FRESH default 4-pillbox slate (like first arrival on
            // aiasap.ai) with no email text. The pills may have rotated during
            // the session; this puts them back to default. Also clear the chest
            // text and cancel any stray reveal timer so nothing re-appears.
            setChestEmailText("");
            if (chestRevealTimerRef.current) {
              clearTimeout(chestRevealTimerRef.current);
              chestRevealTimerRef.current = null;
            }
            chestRevealActiveRef.current = false;
            setThoughtPrompts(normalizeThoughtPrompts(DEFAULT_THOUGHT_PROMPTS));
            chestStatusTimerRef.current = null;
          }, 2200);
        } else {
          // Non-success: the top banner carries the message; clear the box.
          setChestEmailText("");
          setChestEmailStatus(null);
          setShowChestEmail(false);
        }
        return true;
      } catch (error) {
        console.error("Account setup failed:", error);
        // Never leave "Sending Email..." stuck on the chest after a failure.
        setChestEmailStatus(null);
        setShowChestEmail(false);
        const spoken =
          "I had trouble setting up that email link. I made a note for G to fix account setup.";
        setAccountNotice("Account setup needs attention");
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        rememberConversationLine("assistant", spoken);
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      }
    },
    [
      assistantLists,
      buildAccountResumeState,
      rememberConversationLine,
      repeat,
      savePendingAccountState,
    ],
  );


  const clearAccountEmailEntry = useCallback(() => {
    // SWEEP FIX (2026-06-10 adversarial review): awaitingReady was the ONE
    // gate this cleanup missed — close a list mid-offer and the armed gate
    // survived, so an unrelated "yes" minutes later re-triggered the name-ask
    // out of nowhere. Every gate dies together.
    accountSetupAwaitingReadyRef.current = false;
    accountSetupAwaitingEmailRef.current = false;
    accountSetupAwaitingNameRef.current = false;
    accountSetupPendingEmailRef.current = null;
    accountSetupRejectedEmailRef.current = null;
    accountSetupAwaitingSendRef.current = false;
    accountSetupSendEmailRef.current = null;
    accountSetupEmailMissCountRef.current = 0;
    // CHANGE 1 (2026-06-01): forget the last address parsed from 6's readback so
    // a fresh spell (even of the same address) reveals into the box again.
    lastAvatarParsedEmailRef.current = null;
    chestEmailTextRef.current = "";
    setEmailEntryOpen(false);
    setTypedAccountEmail("");
    setChestEmailText("");
    setChestEmailStatus(null);
    setShowChestEmail(false);
    // FIX (2026-06-01): cancel any in-progress letter reveal + success-fade timer.
    if (chestRevealTimerRef.current) {
      clearTimeout(chestRevealTimerRef.current);
      chestRevealTimerRef.current = null;
    }
    chestRevealActiveRef.current = false;
    if (chestStatusTimerRef.current) {
      clearTimeout(chestStatusTimerRef.current);
      chestStatusTimerRef.current = null;
    }
  }, []);

  const offerAccountSetupForMemory = useCallback(async (customSpoken?: string) => {
    void customSpoken;
    return false;
  }, []);

  // FIX (2026-06-01): synthesized old-fashioned typewriter key click. This is an
  // independent UI sound — it is NEVER routed through 6's TTS and must never
  // block or break the reveal. `seed` (a char code + index) gives subtle
  // per-letter variety so repeated letters don't sound identical.
  const playTypewriterClick = useCallback((seed: number) => {
    if (typeof window === "undefined") return;
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      if (!tickAudioCtxRef.current) {
        tickAudioCtxRef.current = new Ctor();
      }
      const ctx = tickAudioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") {
        // Autoplay policy may suspend the context; try to resume but never block.
        void ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      // Per-call jitter derived from the seed + clock (no Math.random at module
      // scope; deriving from char/index/clock keeps it deterministic-ish).
      const jitter = ((seed % 7) - 3) / 100 + ((now * 1000) % 9) / 1000;
      const gainScale = 0.8 + ((seed % 5) / 12); // ~0.8..1.2

      // 1) Short filtered white-noise burst = the key thunk (~22ms).
      const noiseDur = 0.022;
      const frameCount = Math.max(1, Math.floor(ctx.sampleRate * noiseDur));
      const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i += 1) {
        // Cheap deterministic noise seeded by index + char seed.
        const v = Math.sin((i + seed) * 12.9898) * 43758.5453;
        data[i] = (v - Math.floor(v)) * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 2300 + (seed % 11) * 70;
      noiseFilter.Q.value = 0.9;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.5 * gainScale, now + 0.001);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseDur);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + noiseDur);

      // 2) Very short high "ping" = the typebar snap (~10ms).
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = 2600 + jitter * 1200 + (seed % 9) * 40;
      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.0001, now);
      oscGain.gain.exponentialRampToValueAtTime(0.12 * gainScale, now + 0.001);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.01);
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.012);
    } catch {
      // Audio must never break the reveal.
    }
  }, []);

  // FIX (2026-06-01): reveal `addedChars` on the chest ONE character at a time,
  // playing a typewriter click per letter. Resolves once the full accumulated
  // value (fromText + addedChars) is shown, so the existing valid-email check
  // and confirm logic still see the complete address.
  const revealEmailChars = useCallback(
    (fromText: string, addedChars: string): Promise<string> => {
      const full = `${fromText}${addedChars}`;
      // Cancel any prior pending reveal so chunks don't overlap.
      if (chestRevealTimerRef.current) {
        clearTimeout(chestRevealTimerRef.current);
        chestRevealTimerRef.current = null;
      }
      const chars = addedChars.split("");
      if (chars.length === 0) {
        setChestEmailText(full);
        chestRevealActiveRef.current = false;
        return Promise.resolve(full);
      }
      return new Promise<string>((resolve) => {
        chestRevealActiveRef.current = true;
        let shown = fromText;
        let i = 0;
        const step = () => {
          const ch = chars[i];
          shown += ch;
          i += 1;
          setChestEmailText(shown);
          playTypewriterClick(ch.charCodeAt(0) + i);
          if (i < chars.length) {
            // G 2026-06-09: SLOWER again - he wants each letter to land as he
            // SAYS it (deliberate typewriter feel), and to hear the click on
            // every key. ~40ms read as too quick to follow his voice. ~95ms/char
            // with charcode jitter = a clear, in-sync clack per letter. (Latest
            // signal wins per his iteration style.)
            const delay = 95 + (ch.charCodeAt(0) % 16);
            chestRevealTimerRef.current = setTimeout(step, delay);
          } else {
            chestRevealTimerRef.current = null;
            chestRevealActiveRef.current = false;
            // Ensure the final value is exactly the full accumulated address.
            setChestEmailText(full);
            resolve(full);
          }
        };
        // FIX (latency): paint the first added character on the very next tick so
        // letters start showing the instant the transcript lands (no 40ms gate).
        chestRevealTimerRef.current = setTimeout(step, 0);
      });
    },
    [playTypewriterClick],
  );

  // FIX (2026-06-01): on unmount, clear the on-chest email letter-reveal +
  // status-fade timers and close the synthesized typewriter-click AudioContext.
  useEffect(() => {
    return () => {
      if (chestRevealTimerRef.current) {
        clearTimeout(chestRevealTimerRef.current);
        chestRevealTimerRef.current = null;
      }
      if (chestStatusTimerRef.current) {
        clearTimeout(chestStatusTimerRef.current);
        chestStatusTimerRef.current = null;
      }
      if (tickAudioCtxRef.current) {
        try {
          void tickAudioCtxRef.current.close();
        } catch {
          // ignore audio teardown errors
        }
        tickAudioCtxRef.current = null;
      }
    };
  }, []);

  // 2026-06-10: the verbal-signup DECISION LOGIC lives in src/lib/signup/machine.ts
  // so the replay harness (tests/signup) drives the exact same code that runs
  // here. The component supplies the body via these ports: refs in, voice/box/
  // network effects out. Logic changes belong in the machine, never here.
  const signupFlags = useMemo<SignupFlags>(
    () => ({
      accountBetaDisabled: ACCOUNT_BETA_DISABLED,
      emailTypedFallbackEnabled: EMAIL_TYPED_FALLBACK_ENABLED,
    }),
    [],
  );
  const signupPorts = useMemo<SignupPorts>(
    () => ({
      get awaitingReady() { return accountSetupAwaitingReadyRef.current; },
      set awaitingReady(v: boolean) { accountSetupAwaitingReadyRef.current = v; },
      get awaitingEmail() { return accountSetupAwaitingEmailRef.current; },
      set awaitingEmail(v: boolean) { accountSetupAwaitingEmailRef.current = v; },
      get awaitingName() { return accountSetupAwaitingNameRef.current; },
      set awaitingName(v: boolean) { accountSetupAwaitingNameRef.current = v; },
      get awaitingSend() { return accountSetupAwaitingSendRef.current; },
      set awaitingSend(v: boolean) { accountSetupAwaitingSendRef.current = v; },
      get pendingEmail() { return accountSetupPendingEmailRef.current; },
      set pendingEmail(v: string | null) { accountSetupPendingEmailRef.current = v; },
      get rejectedEmail() { return accountSetupRejectedEmailRef.current; },
      set rejectedEmail(v: string | null) { accountSetupRejectedEmailRef.current = v; },
      get sendEmail() { return accountSetupSendEmailRef.current; },
      set sendEmail(v: string | null) { accountSetupSendEmailRef.current = v; },
      get emailMissCount() { return accountSetupEmailMissCountRef.current; },
      set emailMissCount(v: number) { accountSetupEmailMissCountRef.current = v; },
      get offerMade() { return accountSetupOfferMadeRef.current; },
      set offerMade(v: boolean) { accountSetupOfferMadeRef.current = v; },
      get declinedAt() { return accountSetupDeclinedAtRef.current; },
      set declinedAt(v: number) { accountSetupDeclinedAtRef.current = v; },
      get lastParsedEmail() { return lastAvatarParsedEmailRef.current; },
      set lastParsedEmail(v: string | null) { lastAvatarParsedEmailRef.current = v; },
      get sendArmedAt() { return accountSetupSendArmedAtRef.current; },
      set sendArmedAt(v: number) { accountSetupSendArmedAtRef.current = v; },
      get sendArmedByText() { return accountSetupSendArmedByTextRef.current; },
      set sendArmedByText(v: string | null) { accountSetupSendArmedByTextRef.current = v; },
      get signedIn() { return accountSignedInRef.current; },
      get avatarTalking() { return isAvatarTalkingRef.current; },
      get userName() { return deviceProfileRef.current.name; },
      get greetingCount() { return deviceProfileRef.current.greetingCount; },
      get chestText() { return chestEmailTextRef.current; },
      say: async (text: string, opts?: { remember?: boolean }) => {
        await repeat(text);
        lastAvatarResponseRef.current = text;
        if (opts?.remember) rememberConversationLine("assistant", text);
        lastVisionResponseTimeRef.current = Date.now();
      },
      saveName: (name: string) => {
        setDeviceProfile((current) => ({
          ...current,
          name,
          updatedAt: Date.now(),
        }));
        deviceProfileRef.current = {
          ...deviceProfileRef.current,
          name,
          updatedAt: Date.now(),
        };
      },
      showChest: () => setShowChestEmail(true),
      setChestDisplay: (text: string) => {
        chestEmailTextRef.current = text;
        setChestEmailText(text);
      },
      revealChars: async (fromText: string, addedChars: string) => {
        await revealEmailChars(fromText, addedChars);
      },
      clearRevealActive: () => {
        chestRevealActiveRef.current = false;
      },
      openTypedBox: () => setEmailEntryOpen(true),
      closeTypedBox: () => setEmailEntryOpen(false),
      setTypedEmail: (value: string) => setTypedAccountEmail(value),
      startAccountSetup: (email: string) => startAccountSetup(email),
      clearEntry: () => clearAccountEmailEntry(),
      now: () => Date.now(),
    }),
    [
      clearAccountEmailEntry,
      rememberConversationLine,
      repeat,
      revealEmailChars,
      startAccountSetup,
    ],
  );

  const handleTypedAccountEmailSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const candidate = extractAccountEmailCandidate(typedAccountEmail, null);
      await confirmEmailCandidateFlow(signupPorts, candidate ?? typedAccountEmail);
    },
    [signupPorts, typedAccountEmail],
  );

  const handleAccountSetupSpeech = useCallback(
    (userText: string) => {
      // r34 (G live 2026-06-12 21:45: signed in, said "okay", got "first
      // time signing up, or do you already have an account?" — and earlier
      // "you're going to remember everything here about me" tripped the
      // setup trigger and 6 demanded his email AGAIN): a signed-in user
      // NEVER re-enters signup. Switching accounts goes through "log me
      // out" (r30).
      if (accountEmailRef.current) return Promise.resolve(false);
      return accountSetupSpeechFlow(signupPorts, signupFlags, userText);
    },
    [signupPorts, signupFlags],
  );

  // Voice-driven data deletion (G 2026-06-07): 6 walks a signed-in user through
  // erasing everything he remembers — either a memory wipe (keep the account) or
  // a full account close. Two-step: detect the ask -> confirm out loud (it's
  // irreversible) -> call /api/account/delete -> report + forget locally too.
  const handleDataDeleteSpeech = useCallback(
    async (userText: string): Promise<boolean> => {
      // --- Confirm phase: we already asked "are you sure?" ---
      if (accountDeleteAwaitingConfirmRef.current) {
        if (!userText.trim()) return true; // ignore echoes, keep waiting
        // Coaching / 3rd-person talk during the confirm wait is NOT a yes
        // (G 2026-06-08): re-ask for a direct, first-person command instead of
        // firing the irreversible close on a stray word like "confirm".
        if (DELETE_COACHING_RE.test(userText)) {
          const spoken =
            "Just to be safe - I only close an account when you tell me to directly. Say 'Yes, delete my account' if you really want that, or 'no' to keep everything.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          return true;
        }
        if (
          DELETE_CANCEL_RE.test(userText) &&
          !DELETE_CONFIRM_RE.test(userText)
        ) {
          accountDeleteAwaitingConfirmRef.current = false;
          const spoken =
            "Okay - I won't delete anything. Everything's right where you left it.";
          await interrupt();
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          rememberConversationLine("assistant", spoken);
          lastVisionResponseTimeRef.current = Date.now();
          return true;
        }
        if (DELETE_CONFIRM_RE.test(userText)) {
          const scope = accountDeleteScopeRef.current;
          accountDeleteAwaitingConfirmRef.current = false;
          await interrupt();
          let ok = false;
          let scheduled = false;
          try {
            const res = await fetch("/api/account/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scope, confirm: true }),
            });
            if (res.ok) {
              const data = (await res.json().catch(() => null)) as
                | { ok?: boolean; accountClosed?: boolean; scheduled?: boolean }
                | null;
              ok = Boolean(data?.ok);
              scheduled = Boolean(data?.scheduled);
            }
          } catch {
            ok = false;
          }
          if (ok && scope === "account") {
            // 30-day grace STARTED (data not wiped yet). Sign out locally; they
            // can cancel via the email link or by signing back in within 30 days.
            accountSignedInRef.current = false;
            const startedAction = accountDeleteSaidCloseRef.current
              ? "closing your account"
              : "deleting everything I have on you";
            const spoken = scheduled
              ? `Okay - I've started ${startedAction}. I'll keep everything safe for 30 days in case you change your mind, or in case a bad actor hacked your account and you want to recover it - just sign back in and I'll cancel it, and I emailed you a link too. After that it's gone for good. Take care - it was good talking with you.`
              : `Okay - I've started ${startedAction}, and I'll keep everything safe for 30 days in case you change your mind. After that it's gone for good. Take care - it was good talking with you.`;
            await repeat(spoken);
            lastAvatarResponseRef.current = spoken;
            rememberConversationLine("assistant", spoken);
          } else if (ok) {
            // memory scope: immediate wipe, clean slate, the account stays.
            recentConversationRef.current = [];
            accountMemorySnapshotRef.current = null;
            accountMemoryContextInjectedRef.current = true;
            deviceProfileRef.current = {
              ...deviceProfileRef.current,
              name: "",
              updatedAt: Date.now(),
            };
            setDeviceProfile((current) => ({
              ...current,
              name: "",
              updatedAt: Date.now(),
            }));
            const spoken =
              "Done. I've erased everything I remembered about you. Clean slate - your account's still here, I just don't have any history now. What's on your mind?";
            await repeat(spoken);
            lastAvatarResponseRef.current = spoken;
            rememberConversationLine("assistant", spoken);
          } else {
            const spoken =
              "Hmm - something went wrong on my end, so nothing was changed. I made a note for G to fix it. Want to try again in a bit?";
            await repeat(spoken);
            lastAvatarResponseRef.current = spoken;
            rememberConversationLine("assistant", spoken);
          }
          lastVisionResponseTimeRef.current = Date.now();
          return true;
        }
        // Unclear answer - re-ask once, plainly.
        const spoken =
          "I need a clear yes or no - this can't be undone. Say 'yes, delete it' to erase everything, or 'no' to keep it.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      }

      // --- Intent phase: did they ask to delete their data / close account? ---
      if (!DELETE_DATA_INTENT_RE.test(userText)) return false;
      // Never treat COACHING / 3rd-person talk as a real request (G 2026-06-08
      // false-close fix). The user must be asking about THEIR OWN data directly.
      if (DELETE_COACHING_RE.test(userText)) return false;

      if (!accountSignedInRef.current) {
        const spoken =
          "You don't have an account with me yet, so there's nothing saved to delete. If you make one, you can tell me to erase it any time.";
        await interrupt();
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        rememberConversationLine("assistant", spoken);
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      }

      // G 2026-06-08: grace for ALL deletes now. "delete my data" / "wipe my
      // memory" / "close my account" ALL take the SAME 30-day grace path -
      // nothing is wiped on the spot, so a hacked or regretted account stays
      // recoverable for 30 days (this is what stops a hacker nuking you
      // instantly). We still read whether they said "close my account" vs just
      // "delete my data" - ONLY so 6's wording stays honest; the behavior is
      // identical (always grace). The old instant memory-wipe still lives in
      // /api/account/delete, dormant - no voice path reaches it now.
      const saidClose = ACCOUNT_CLOSE_RE.test(userText);
      accountDeleteSaidCloseRef.current = saidClose;
      accountDeleteScopeRef.current = "account";
      accountDeleteAwaitingConfirmRef.current = true;
      await interrupt();
      const action = saidClose
        ? "closing your account"
        : "deleting everything I have on you";
      const confirmCue = saidClose ? "Yes, delete my account" : "Yes, delete it";
      const spoken = `Okay - before we do this: ${action} starts a 30-day countdown. I'll keep everything safe for those 30 days in case you change your mind, or in case a bad actor hacked your account and you want to recover it - just sign back in and I'll cancel it, and I'll email you a link too. After 30 days it's gone for good. Want a copy of your data first? Say 'download my data.' Ready? Say '${confirmCue}' to start it, or 'no' to keep everything.`;
      await repeat(spoken);
      lastAvatarResponseRef.current = spoken;
      rememberConversationLine("assistant", spoken);
      lastVisionResponseTimeRef.current = Date.now();
      return true;
    },
    [interrupt, repeat, rememberConversationLine],
  );

  // Data export / download (G 2026-06-07): hand a signed-in user a full copy of
  // everything we hold on them - on request, and offered before any delete. The
  // APP does the fetch + the browser download; 6 only acknowledges and reports
  // the REAL result, never fakes it. No-ops for anon / no-intent.
  const handleDataExportSpeech = useCallback(
    async (userText: string): Promise<boolean> => {
      // Also fire when 6 just OFFERED to send the data/download link and the
      // user says yes - otherwise that bare "yes" falls through and 6's brain
      // fakes a send that never happened (G 2026-06-08: no download email fired).
      // Disabled while a delete-confirm is pending so a delete "yes" isn't stolen.
      // SIGNUP GUARD (2026-06-10, G's 13:11 session): while the account flow is
      // collecting/confirming an email, "send it"-style words mean the SIGN-IN
      // link, never a data download. This handler hijacked "Yeah, let's talk
      // about this side hustle" right after 6 offered the sign-in link and
      // swallowed the turn with "There's nothing saved yet".
      if (
        accountSetupAwaitingReadyRef.current ||
        accountSetupAwaitingEmailRef.current ||
        accountSetupAwaitingNameRef.current ||
        accountSetupAwaitingSendRef.current ||
        accountSetupPendingEmailRef.current !== null
      ) {
        return false;
      }
      const lastAssistantLc = lastAvatarResponseRef.current.toLowerCase();
      // Download offers are about a COPY of your data — "send the sign-in
      // link" must never count (it matched the old send...link pattern).
      const offeredDownload =
        !accountDeleteAwaitingConfirmRef.current &&
        !/\bsign-?in\b|\bmagic\b/.test(lastAssistantLc) &&
        /\b(?:download|export)\b[^.?!]{0,40}\b(?:link|data|copy)\b|\bsend\b[^.?!]{0,40}\b(?:copy|your data)\b/.test(
          lastAssistantLc,
        );
      const saidYesToOffer =
        /^\s*(?:yes|yeah|yep|yup|sure|please|ok|okay|do it|go ahead|send it|sounds good)\b/i.test(
          userText.trim(),
        );
      if (
        !DATA_EXPORT_INTENT_RE.test(userText) &&
        !(offeredDownload && saidYesToOffer)
      ) {
        return false;
      }
      // Coaching / 3rd-person wording ("that's what you should say...", "you
      // can tell them to download their data") is NEVER a real download request
      // - it wrongly emailed a link mid-coaching (G 2026-06-09 export flood,
      // same class as the false-close). Same guard the delete path uses; a bare
      // yes-to-an-offer never matches DELETE_COACHING_RE, so the legit
      // offered->yes path stays safe.
      if (DELETE_COACHING_RE.test(userText)) return false;
      await interrupt();
      if (!accountSignedInRef.current) {
        const spoken =
          "There's nothing saved yet - you don't have an account with me, so there's nothing to download. Make one and chat with me, and you can grab a copy any time.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        rememberConversationLine("assistant", spoken);
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      }
      const nowExport = Date.now();
      if (nowExport - lastExportRequestAtRef.current < 120000) {
        const spoken =
          "I just emailed that download link a moment ago - check your inbox, it can take a minute to land.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        rememberConversationLine("assistant", spoken);
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      }
      lastExportRequestAtRef.current = nowExport;
      let ok = false;
      try {
        const res = await fetch("/api/account/export-request", { method: "POST" });
        ok = res.ok;
      } catch {
        ok = false;
      }
      const spoken = ok
        ? "You got it - I just emailed a secure download link to the address on your account. Click it within 24 hours and your copy will download. Want anything else?"
        : "Hmm - something went wrong sending your download link. I made a note for G. Want to try again in a bit?";
      await repeat(spoken);
      lastAvatarResponseRef.current = spoken;
      rememberConversationLine("assistant", spoken);
      lastVisionResponseTimeRef.current = Date.now();
      return true;
    },
    [interrupt, repeat, rememberConversationLine],
  );

  // Never Forget reminders (2026-06-10, G's night order: "all you gotta do is
  // talk to six"). Stateless on purpose — no armed gates, no traps: every
  // utterance either creates/list/no-ops in one turn. Reminders display
  // through the EXISTING list-card UI as a "Reminders" card.
  const refreshRemindersCard = useCallback(
    async (speak: boolean): Promise<boolean> => {
      try {
        const sid = dbSessionIdRef.current;
        const res = await fetch(
          `/api/reminders${sid ? `?sessionId=${encodeURIComponent(sid)}` : ""}`,
        );
        if (!res.ok) return false;
        const data = (await res.json()) as {
          reminders: Array<{ title: string; due_at: string | null }>;
        };
        const items = data.reminders.map((r) =>
          r.due_at
            ? `${r.title} — ${fmtReminderDue(r.due_at)}`
            : `${r.title} — whenever`,
        );
        const listId = ensureAssistantList({ title: "Reminders", kind: "todo" });
        setAssistantLists((current) =>
          current.map((l) =>
            l.id === listId
              ? {
                  ...l,
                  items: items.length
                    ? items
                    : ["Nothing yet — say: remind me to..."],
                  updatedAt: Date.now(),
                }
              : l,
          ),
        );
        if (speak) {
          const spoken = items.length
            ? `You've got ${items.length} reminder${items.length === 1 ? "" : "s"} — they're on the card.`
            : "No reminders yet. Just say: remind me to call Bob tomorrow at 9.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
        }
        return true;
      } catch {
        return false;
      }
    },
    [ensureAssistantList, repeat],
  );

  // The one reminder (per session) still waiting for its time — set when a
  // no-time reminder is created, cleared on merge or on the next timed create.
  const pendingTimeReminderRef = useRef<{ id: string; title: string } | null>(
    null,
  );
  // Voice-set timezone for THIS session (2026-06-11). Beats the device clock
  // for reminder saves; loaded from the account on sign-in, written to the
  // account when set by voice while signed in.
  const sessionTimezoneRef = useRef<string | null>(null);

  const handleReminderSpeech = useCallback(
    async (userText: string): Promise<boolean> => {
      if (REMINDER_LIST_RE.test(userText)) {
        return refreshRemindersCard(true);
      }
      // Late time-merge (2026-06-11): after "remind me to X" with no time, the
      // bare answer ("So yeah, 9 AM tomorrow") must land on THAT reminder —
      // G's trash reminder saved with due_at null and could never fire. Not a
      // gate: parseTimeOnly only claims utterances that are NOTHING but a time
      // answer, so close/stop/everything else flows on untouched.
      const pendingTime = pendingTimeReminderRef.current;
      if (pendingTime) {
        const timeOnly = parseTimeOnly(userText, new Date());
        if (timeOnly) {
          try {
            const res = await fetch("/api/reminders", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: pendingTime.id,
                dueAtIso: timeOnly.dueAt.toISOString(),
                // Anonymous ownership proof (2026-06-11 hardening): the
                // creating session's id, not the row id alone.
                sessionId: dbSessionIdRef.current,
              }),
            });
            if (!res.ok) throw new Error(`reminders time PATCH ${res.status}`);
            pendingTimeReminderRef.current = null;
            void refreshRemindersCard(false);
            const spoken = accountSignedInRef.current
              ? `Done - ${timeOnly.whenSpoken}. You talked, I remembered.`
              : `Got it - ${timeOnly.whenSpoken}. It's on your card - make an account and I'll email you too.`;
            await repeat(spoken);
            lastAvatarResponseRef.current = spoken;
            rememberConversationLine("assistant", spoken);
            lastVisionResponseTimeRef.current = Date.now();
            return true;
          } catch (e) {
            void captureClientError(e, {
              where: "reminders",
              userText: userText.slice(0, 120),
            });
            const spoken =
              "I had trouble saving that time - tell me once more.";
            await repeat(spoken);
            lastAvatarResponseRef.current = spoken;
            lastVisionResponseTimeRef.current = Date.now();
            return true;
          }
        }
      }
      const parsed = parseReminder(userText, new Date());
      if (!parsed) return false;
      if (!parsed.title) {
        const spoken =
          "Got it - what should I remind you about? Say it like: remind me to call Bob tomorrow at 9.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      }
      try {
        const res = await fetch("/api/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: parsed.title,
            rawText: userText.slice(0, 500),
            dueAtIso: parsed.dueAt ? parsed.dueAt.toISOString() : null,
            // Voice-set zone beats the device clock (timezone ladder 2026-06-11).
            timezone:
              sessionTimezoneRef.current ??
              Intl.DateTimeFormat().resolvedOptions().timeZone,
            sessionId: dbSessionIdRef.current,
          }),
        });
        if (!res.ok) throw new Error(`reminders POST ${res.status}`);
        const data = (await res.json()) as { signedIn?: boolean; id?: string };
        void refreshRemindersCard(false);
        // No time yet → remember which reminder is waiting for one, and ask
        // like a person (G 2026-06-11: "very wordy and not like anything a
        // human being would say" — the old line parroted the whole title plus
        // a sample sentence).
        pendingTimeReminderRef.current =
          !parsed.dueAt && typeof data.id === "string" && data.id
            ? { id: data.id, title: parsed.title }
            : null;
        // G 2026-06-11 ("really awkward... not like anything a human being
        // would say"): never read the title back — it's on the card they're
        // looking at. Short, human, and the founder's favorite line where it
        // belongs ("I LOVE you talked, I remembered").
        // r18 (G's 12:48 session): he EXPLICITLY asked "send me an email" while
        // anonymous — the soft "make an account" tail got talked over and the
        // brain promised an email that could never send. When the user names a
        // channel and we can't deliver on it, that gap IS the message.
        const spoken = parsed.dueAt
          ? data.signedIn
            ? parsed.askedChannel === "sms"
              ? `Done - texts are coming soon, so I'll email you ${parsed.whenSpoken}. You talked, I remembered.`
              : `Done - I'll email you ${parsed.whenSpoken}. You talked, I remembered.`
            : parsed.askedChannel
              ? `It's on your card for ${parsed.whenSpoken}. To ${parsed.askedChannel === "sms" ? "reach" : "email"} you, I need your account - want to set it up?`
              : `Done - ${parsed.whenSpoken}, it's on your card. Make an account and I'll email you too.`
          : `Got it - it's on your card. When should I remind you?`;
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        rememberConversationLine("assistant", spoken);
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      } catch (e) {
        void captureClientError(e, {
          where: "reminders",
          userText: userText.slice(0, 120),
        });
        const spoken =
          "I had trouble saving that reminder - try me again in a second.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      }
    },
    [refreshRemindersCard, rememberConversationLine, repeat],
  );

  // SMS opt-in by voice (2026-06-10, G: "not just email reminders, but
  // text"). Stateless: the trigger sentence may carry the number; if not, 6
  // coaches ONE sentence ("my number is...") which fires on its own.
  const handleSmsOptInSpeech = useCallback(
    async (userText: string): Promise<boolean> => {
      const phone = parseSpokenPhone(userText);
      const optInAsk = SMS_OPT_IN_RE.test(userText);
      const givingNumber = PHONE_GIVE_RE.test(userText) && phone !== null;
      if (!optInAsk && !givingNumber) return false;
      if (!accountSignedInRef.current) {
        const spoken =
          "Texts ride on your account - make one first, then say: text me my reminders.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      }
      if (!phone) {
        const spoken =
          "You got it. Say it like: my number is 410 555 1234.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      }
      try {
        const res = await fetch("/api/account/phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });
        if (!res.ok) throw new Error(`phone save ${res.status}`);
        const spoken = `Done - texts are on. I've got you at ${fmtPhoneSpoken(phone)}.`;
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        rememberConversationLine("assistant", spoken);
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      } catch (e) {
        void captureClientError(e, { where: "sms-opt-in" });
        const spoken =
          "I had trouble saving that number - try me again in a second.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      }
    },
    [rememberConversationLine, repeat],
  );

  // Timezone by voice (2026-06-11, G: "6 should always be on the time zone of
  // the user"). Stateless coach pattern (the signup-gate lesson): a ZIP or a
  // time-flavored place sentence fires ON ITS OWN — no armed gate, close/stop
  // always flow through. tzAskAtRef is a relevance TIMESTAMP, not a gate: for
  // 90s after 6 asks, a bare answer ("21093", "Toronto") counts; non-matching
  // turns flow to the brain untouched the whole time. The device clock covers
  // the normal case; this is the correction path.
  const tzAskAtRef = useRef<number>(0);
  const handleTimezoneSpeech = useCallback(
    async (userText: string): Promise<boolean> => {
      const allowBare = Date.now() - tzAskAtRef.current < 90_000;
      const loc = resolveSpokenLocation(userText, { allowBare });
      if (!loc && !TZ_WRONG_RE.test(userText)) return false;
      if (!loc) {
        // "the time zone is wrong" with no place in the same breath → coach
        // the one sentence; the follow-up fires on its own.
        tzAskAtRef.current = Date.now();
        const spoken =
          "Easy fix. In the US, just tell me your zip code. Anywhere else, say the country or your nearest big city.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      }
      if (loc.kind === "multi") {
        tzAskAtRef.current = Date.now();
        const spoken = `${loc.country} runs on a few different clocks - what's your nearest big city?`;
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      }
      tzAskAtRef.current = 0;
      sessionTimezoneRef.current = loc.tz;
      // Await the save so "I'll remember that" is only ever spoken when the
      // account write actually landed (2026-06-11 review: the fire-and-forget
      // version promised memory it might not have).
      let savedToAccount = false;
      if (accountSignedInRef.current) {
        try {
          const res = await fetch("/api/account/prefs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timezone: loc.tz }),
          });
          savedToAccount = res.ok;
        } catch {
          savedToAccount = false;
        }
      }
      const spoken = savedToAccount
        ? `Done - you're on ${humanZoneName(loc.tz)} now, and I'll remember that.`
        : `Done - you're on ${humanZoneName(loc.tz)} for this visit.`;
      await repeat(spoken);
      lastAvatarResponseRef.current = spoken;
      rememberConversationLine("assistant", spoken);
      lastVisionResponseTimeRef.current = Date.now();
      return true;
    },
    [rememberConversationLine, repeat],
  );

  const sizeStepAtRef = useRef(0);
  const handlePromptSizeSpeech = useCallback(
    async (userText: string) => {
      // VOICE SIZING (2026-06-10): boxes/cards/text, bigger AND smaller.
      const wantsBigger = UI_SIZE_BIGGER_RE.test(userText);
      const wantsSmaller = !wantsBigger && UI_SIZE_SMALLER_RE.test(userText);
      if (!wantsBigger && !wantsSmaller) return false;
      // r20 (G 21:34: "they went up 2 TIMES when I only asked for once" — one
      // breath matched twice, e.g. "Bigger." + "Bigger text. There we go.").
      // One step per 2.5 seconds; the second match swallows silently.
      const nowMs = Date.now();
      if (nowMs - sizeStepAtRef.current < 2500) return true;
      sizeStepAtRef.current = nowMs;
      let hitEdge = false;
      setPromptSizeLevel((current) => {
        const next = wantsBigger ? current + 1 : current - 1;
        if (next > MAX_PROMPT_SIZE_LEVEL || next < 0) {
          hitEdge = true;
          return current;
        }
        return next;
      });
      const spoken = wantsBigger
        ? hitEdge
          ? "That's as big as I can make things without crowding my face or the Terms line."
          : "Done - boxes and text are bigger now. Say it again and I'll go bigger."
        : hitEdge
          ? "That's as small as I'll go - any smaller and nobody can read it."
          : "Done - I sized things down a notch. Say it again for smaller.";
      await repeat(spoken);
      lastAvatarResponseRef.current = spoken;
      lastVisionResponseTimeRef.current = Date.now();
      return true;
    },
    [repeat],
  );

  // r18 (2026-06-11, G: "You should have the real time"): clock questions are
  // the APP's job — exact device time in the user's resolved zone. The brain
  // only ever had the session-start stamp and said "I don't have the exact
  // current time".
  const handleTimeAskSpeech = useCallback(
    async (userText: string) => {
      if (!TIME_ASK_RE.test(userText)) return false;
      const spoken = spokenTimeNow(new Date(), sessionTimezoneRef.current);
      await repeat(spoken);
      lastAvatarResponseRef.current = spoken;
      lastVisionResponseTimeRef.current = Date.now();
      return true;
    },
    [repeat],
  );

  // Capture ?tester=<slug> on first mount and persist for the visit.
  useEffect(() => {
    testerLabelRef.current = captureTesterLabelFromUrl();
  }, []);

  useEffect(() => {
    if (sessionState === SessionState.DISCONNECTED) {
      if (voicePresenceRef.current !== "avatar") {
        // Voice-list mode owns this disconnect: the avatar was stopped on
        // purpose and the conversation is still alive on the ElevenLabs
        // voice. No "session ended" screen, no parent reset.
        return;
      }
      if (sessionStartErrorRef.current) {
        setSessionStartError(sessionStartErrorRef.current);
        sessionStartErrorRef.current = null;
        greetingTriggeredRef.current = false;
        greetingInFlightRef.current = false;
        greetingInterruptedRef.current = false;
        greetingCompletionPendingRef.current = false;
        return;
      }
      if (explicitEndSessionRef.current) {
        explicitEndSessionRef.current = false;
        onExit?.(false);
        greetingTriggeredRef.current = false;
        greetingInFlightRef.current = false;
        greetingInterruptedRef.current = false;
        greetingCompletionPendingRef.current = false;
        return;
      }
      const opts: SessionStoppedReason | undefined = wasStoppedDueToInactivity()
        ? { reason: "inactivity" }
        : undefined;
      onSessionStopped(opts);
      // Reset greeting trigger when session disconnects
      greetingTriggeredRef.current = false;
      greetingInFlightRef.current = false;
      greetingInterruptedRef.current = false;
      greetingCompletionPendingRef.current = false;
    }
  }, [sessionState, onSessionStopped, wasStoppedDueToInactivity]);

  // Greeting interrupt → completion injection (G spec 2026-05-27).
  // If user interrupts the hard-coded intro before 6 finishes, fire a random
  // pool line as 6's 2nd utterance after the interruption so the intro lands.
  useEffect(() => {
    if (isUserTalking && greetingInFlightRef.current) {
      greetingInterruptedRef.current = true;
    }
  }, [isUserTalking]);

  useEffect(() => {
    if (isAvatarTalking) return;
    if (greetingInFlightRef.current) {
      greetingInFlightRef.current = false;
      if (greetingInterruptedRef.current) {
        greetingCompletionPendingRef.current = true;
      }
      return;
    }
    if (greetingCompletionPendingRef.current) {
      greetingCompletionPendingRef.current = false;
      greetingInterruptedRef.current = false;
      // Redundancy guard: when the LLM's first response post-interrupt already
      // re-delivered the greeting on its own (common when the user said "What
      // did you just say?" style), skip our injection so 6 doesn't sound like
      // a broken record. Match against 6's latest spoken text.
      const lastSpoken = lastAvatarTranscriptionRef.current ?? "";
      const greetingMarkerRe =
        /(your back|a[-\s]?i[-\s]?buddy|make your life|call me (?:6|six)|i['']?m (?:6|six))/i;
      if (greetingMarkerRe.test(lastSpoken)) {
        return;
      }
      const line = pickGreetingCompletion();
      window.setTimeout(() => {
        void Promise.resolve(repeat(line))
          .then(() => {
            lastAvatarResponseRef.current = line;
            rememberConversationLine("assistant", line);
          })
          .catch((err) => {
            console.warn("Greeting completion injection failed:", err);
          });
      }, 600);
    }
  }, [isAvatarTalking, repeat, rememberConversationLine]);

  // CHANGE 1/2 (2026-06-01): keep refs in lockstep with state so the stable
  // AVATAR_TRANSCRIPTION handler + email callbacks read live values, not stale
  // closures. Cheap assigns; no subscriptions.
  useEffect(() => {
    chestEmailTextRef.current = chestEmailText;
  }, [chestEmailText]);
  useEffect(() => {
    isAvatarTalkingRef.current = isAvatarTalking;
  }, [isAvatarTalking]);

  // Track 6's most recent spoken text via AVATAR_TRANSCRIPTION events. Used by
  // the greeting-injection guard above to detect when the LLM already covered
  // the greeting content naturally.
  //
  // CHANGE 1 (2026-06-01): this is ALSO where the on-chest email box is now
  // populated from what 6 UNDERSTOOD. Raw user STT mangles spelled letters
  // ("tz@pm.me"), but 6's brain reads the address back cleanly
  // ("S-G-D-I-E-T-Z at P-M dot M-E"). When account-email setup is active and 6
  // speaks an email readback, we parse HIS text and drive the box to match —
  // so the box and his voice always agree, and the address we ultimately send
  // is the one he confirmed, never a raw-STT guess.
  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;
    const onAvatarTranscription = (event: { text?: string }) => {
      const text = event?.text;
      if (typeof text !== "string" || text.trim().length === 0) return;
      lastAvatarTranscriptionRef.current = text;

      // FIX (2026-06-01, box-not-showing): 6's BRAIN often runs the email
      // conversation itself (asks for the email, reads it back) and races AHEAD
      // of the scripted handler — so accountSetupAwaitingEmailRef was never armed
      // and the box never showed (G: "email not on screen"). Decouple the box
      // from the scripted refs: show + mirror on ANY spelled-email readback while
      // an account flow is plausibly in progress. The readback shape itself is
      // strong evidence (6 only spells an address back during account setup), so
      // we accept the scripted refs OR any account-flow ref OR an account trigger.
      if (ACCOUNT_BETA_DISABLED) return;

      // "Account Link Sent" confirmation (G 2026-06-07: "nothing in the pillbox
      // said account link sent — it just stayed on my email"). The send can go
      // out via the SERVER/sync path, which never paints the client status, so
      // the box was left showing the raw address. When 6 confirms the link is
      // sent AND a valid email is on the chest, swap the box to "Account Link
      // Sent ✓" and fade back to the default pills. Fires once (clears the
      // address) and only post-send (gated on a valid email being on screen).
      if (
        isValidEmailCandidate(chestEmailTextRef.current) &&
        /\b(?:on the other side|sent the sign-in link|sent you (?:an |the )?email|sent the link|i'?ve sent|i sent)\b/.test(
          text.toLowerCase(),
        )
      ) {
        lastAvatarParsedEmailRef.current = null;
        if (chestRevealTimerRef.current) {
          clearTimeout(chestRevealTimerRef.current);
          chestRevealTimerRef.current = null;
        }
        chestRevealActiveRef.current = false;
        chestEmailTextRef.current = "";
        setChestEmailText("");
        setChestEmailStatus("Email Link Sent");
        setShowChestEmail(true);
        if (chestStatusTimerRef.current) clearTimeout(chestStatusTimerRef.current);
        chestStatusTimerRef.current = setTimeout(() => {
          setShowChestEmail(false);
          setChestEmailStatus(null);
          setChestEmailText("");
          setThoughtPrompts(normalizeThoughtPrompts(DEFAULT_THOUGHT_PROMPTS));
          chestStatusTimerRef.current = null;
        }, 2600);
        return;
      }

      // FIX (2026-06-01, G "the box should be on screen earlier"): the moment 6
      // asks the user to SPELL their email — even when his brain drives the flow
      // ahead of the scripted refs, before any letters land — surface the empty
      // box (placeholder) so it's already waiting. "spell" + "email" together
      // only occur during account setup, so this is safe to act on stand-alone.
      const loweredAsk = text.toLowerCase();
      // Reveal the on-chest email box the INSTANT 6 tells the user to SPELL their
      // email. "spell" is the email-collection moment and fires even when 6's
      // brain runs ahead of the scripted refs — so the box pops right when he
      // says "spell your email," no lag (G 2026-06-07, said twice: "as soon as I
      // say yes, the box should come up"). It does NOT fire on the earlier OFFER
      // line ("...I just need your email...") — no "spell" there — so the box
      // still never pops too soon either.
      if (
        /\bspell\b/.test(loweredAsk) &&
        (/\bemail\b/.test(loweredAsk) || accountSetupAwaitingEmailRef.current) &&
        chestEmailTextRef.current === ""
      ) {
        accountSetupAwaitingEmailRef.current = true;
        setChestEmailStatus(null);
        setShowChestEmail(true);
      }

      const accountFlowPlausible =
        accountSetupAwaitingEmailRef.current ||
        accountSetupPendingEmailRef.current !== null ||
        accountSetupAwaitingReadyRef.current ||
        accountSetupAwaitingNameRef.current ||
        accountSetupOfferMadeRef.current;

      // Gate cheaply on "this line looks like an email readback" before parsing:
      // it must contain an "@" OR the word "at" together with a "dot"/"period".
      const lowered = text.toLowerCase();
      const looksLikeReadback =
        /@/.test(text) ||
        (/\bat\b/.test(lowered) && /\b(?:dot|period|point)\b/.test(lowered));
      if (!looksLikeReadback) return;

      const parsed = parseEmailFromAvatarReadback(text);
      if (!parsed) return;
      // GUARD (2026-06-07, G "the spell-email box came back up"): once the
      // address is confirmed and parked on the send gate (or already sending),
      // 6 re-speaking it must NOT re-arm the flow or re-reveal the box. Only act
      // on a readback while we're still collecting/confirming the email.
      if (
        accountSetupAwaitingSendRef.current ||
        accountSetupSendEmailRef.current !== null
      ) {
        return;
      }
      // A real spelled-email readback that parses to a valid address is itself
      // proof we're in account setup — show the box even if no ref was armed
      // (brain-driven flow). If NOTHING about an account flow is in play AND the
      // address didn't parse, the early returns above already bailed.
      if (!accountFlowPlausible) {
        // Brain drove straight to email without arming our refs — adopt the flow
        // now so the box + the eventual "yes" → send all agree.
        accountSetupAwaitingEmailRef.current = true;
      }

      // CHANGE 1 pt.3: 6's confirmed address is now AUTHORITATIVE — it is what
      // gets sent when the user says "yes". Park it as the pending candidate so
      // the box value and the send value are the SAME source (6), never a
      // raw-STT guess. Also clear awaiting-spell so the next "yes" sends.
      accountSetupPendingEmailRef.current = parsed;
      accountSetupRejectedEmailRef.current = null;
      accountSetupAwaitingEmailRef.current = false;

      // Dedupe: only re-reveal when 6 confirms a DIFFERENT address than the one
      // we already mirrored from him (avoids looping on repeated confirmations).
      if (parsed === lastAvatarParsedEmailRef.current) return;
      // If the box already shows exactly this address, just record it and stop.
      if (parsed === chestEmailTextRef.current) {
        lastAvatarParsedEmailRef.current = parsed;
        return;
      }
      lastAvatarParsedEmailRef.current = parsed;

      // 6's parsed value is authoritative — it is what gets confirmed + sent.
      // Drive the box to it via the typewriter reveal the user loves, revealing
      // from scratch so a divergent raw-STT guess is fully replaced (not just
      // appended onto). Cancel any in-flight reveal first so they don't overlap.
      if (chestRevealTimerRef.current) {
        clearTimeout(chestRevealTimerRef.current);
        chestRevealTimerRef.current = null;
      }
      chestRevealActiveRef.current = false;
      setChestEmailStatus(null);
      setShowChestEmail(true);
      // G 2026-06-01 (box "in and out"): when CORRECTING an address 6 already
      // showed (e.g. esgdietz → sgdietz), replace it IN PLACE — do NOT blank to
      // "" first. That empty frame was the flicker. Only the FIRST address types
      // in letter-by-letter; corrections swap cleanly with no flash.
      if (chestEmailTextRef.current.length > 0) {
        chestEmailTextRef.current = parsed;
        setChestEmailText(parsed);
      } else {
        void revealEmailChars("", parsed).then((shown) => {
          chestEmailTextRef.current = shown;
        });
      }
    };
    session.on(
      AgentEventsEnum.AVATAR_TRANSCRIPTION,
      onAvatarTranscription as never,
    );
    return () => {
      session.off(
        AgentEventsEnum.AVATAR_TRANSCRIPTION,
        onAvatarTranscription as never,
      );
    };
  }, [sessionRef, revealEmailChars, sessionEpoch]);

  useEffect(() => {
    if (sessionState === SessionState.INACTIVE) {
      // Voice-list mode stopped the avatar ON PURPOSE — never auto-restart
      // while the list owns the screen. (The renew path flips presence to
      // "returning" first, so the comeback start sails through here.)
      if (voicePresenceRef.current === "voice") return;
      setSessionStartError(null);
      startSession().catch((err: Error) => {
        const message = err?.message ?? "Session start failed";
        sessionStartErrorRef.current = message;
      });
    }
  }, [startSession, sessionState, voicePresence]);

  // r19 BELT-AND-SUSPENDERS (G's first live voice-mode session, 21:06: "Take
  // the list off" closed the list through the OLD close path and "6 never
  // came back"): if the list leaves the screen by ANY path while the avatar
  // is away, bring him back. No phrase list required — the missing list IS
  // the signal. The entry grace re-checks on a timer so a fast close can
  // never slip through the gap.
  const voiceActiveListRef = useRef<string | null>(null);
  useEffect(() => {
    voiceActiveListRef.current = activeListId;
  }, [activeListId]);
  useEffect(() => {
    if (voicePresence !== "voice") return;
    if (activeListId) return;
    const fire = () => {
      if (voicePresenceRef.current !== "voice") return;
      if (voiceActiveListRef.current) return;
      // r27: NEVER auto-retry forever — the 01:39 runaway spoke the failure
      // line ~60x in 7s. After 3 failed comebacks, only a tap retries.
      if (voiceReturnAttemptsRef.current >= 3) return;
      void captureClientWarn(new Error("voice-mode"), {
        where: "voice-mode",
        what: "return-list-gone",
      });
      void voiceReturnRef.current?.(false);
    };
    const since = Date.now() - voiceEnteredAtRef.current;
    if (since < 2500) {
      const t = setTimeout(fire, 2600 - since);
      return () => clearTimeout(t);
    }
    fire();
  }, [voicePresence, activeListId]);

  // Track LiveAvatar session id for lead capture + official transcript sync
  useEffect(() => {
    if (sessionState === SessionState.DISCONNECTED) {
      const sid = dbSessionIdRef.current;
      const cursor = transcriptCursorRef.current;
      // Voice-list mode (r19): the avatar leg ended ON PURPOSE — final-sync it,
      // but KEEP the session id so voice turns keep logging to the same
      // conversation in conversation_messages.
      if (voicePresenceRef.current === "avatar") {
        dbSessionIdRef.current = null;
      }
      transcriptCursorRef.current = null;
      lastSyncedLaSessionIdRef.current = null;
      if (sid) {
        void fetch("/api/liveavatar/session-transcript/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            liveAvatarSessionId: sid,
            ...(cursor != null ? { startTimestamp: cursor } : {}),
            testerLabel: testerLabelRef.current,
          }),
          keepalive: true,
        }).catch(() => {});
      }
      return;
    }
    const activeSessionId = getLiveAvatarSessionId(sessionRef.current);
    if (sessionState === SessionState.CONNECTED && activeSessionId) {
      const sid = activeSessionId;
      if (lastSyncedLaSessionIdRef.current !== sid) {
        transcriptCursorRef.current = null;
        lastSyncedLaSessionIdRef.current = sid;
      }
      dbSessionIdRef.current = sid;
      // r29 telemetry: app_events rows ride the same session id as the
      // transcript so sup can join the two stories.
      setTelemetrySessionId(sid);
      logAppEvent("session_live", { mode });
      // v2.1: stash anonymous session_id so /api/auth/link-session can re-key
      // these rows to the user's account when they sign in later. Safe to
      // call repeatedly — the helper dedupes and caps localStorage size.
      rememberAnonymousSessionId(sid);
    }
  }, [sessionState, sessionRef]);

  // Poll LiveAvatar official transcript API while connected ([Get Session Transcript](https://docs.liveavatar.com/api-reference/sessions/get-session-transcript))
  useEffect(() => {
    if (sessionState !== SessionState.CONNECTED) return;
    const sid = getLiveAvatarSessionId(sessionRef.current);
    if (!sid) return;

    const runSync = async () => {
      const body: Record<string, unknown> = { liveAvatarSessionId: sid };
      if (transcriptCursorRef.current != null) {
        body.startTimestamp = transcriptCursorRef.current;
      }
      if (testerLabelRef.current) {
        body.testerLabel = testerLabelRef.current;
      }
      try {
        const res = await fetch("/api/liveavatar/session-transcript/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.nextTimestamp === "number") {
          transcriptCursorRef.current = data.nextTimestamp;
        }
      } catch (e) {
        console.error("LiveAvatar transcript sync failed:", e);
      }
    };

    void runSync();
    const intervalMs = 20_000;
    const id = setInterval(runSync, intervalMs);
    return () => clearInterval(id);
  }, [sessionState, sessionRef]);

  // Function to reset to home screen (close camera, clear uploads, but keep session)
  const resetToHomeScreen = useCallback(() => {
    // Close camera if active
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
    setVisionMode(null);

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    setRecordedVideoBlob(null);
    recordedChunksRef.current = [];

    // Clean up preview URL if it's not the default fallback image
    if (
      fallbackImagePreview &&
      fallbackImage &&
      fallbackImage.name !== "2c44c052-e58a-4f6d-a6c8-dba901ff0e9e.jpg"
    ) {
      URL.revokeObjectURL(fallbackImagePreview);
    }
    setFallbackImage(null);
    setFallbackImagePreview(null);

    // Clear analysis states (but keep videoAnalysis so avatar can still reference it)
    setImageAnalysis(null);
    setIsAnalyzingImage(false);
    setIsAnalyzingVideo(false);
    setIsProcessingCameraQuestion(false);
    // Note: videoAnalysis is NOT cleared so avatar can still reference uploaded videos

    // Reset processing refs
    lastProcessedQuestionRef.current = "";
    hasAutoAnalyzedRef.current = false;
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
  }, [
    cameraStream,
    fallbackImage,
    fallbackImagePreview,
    isRecording,
  ]);

  // Check if we're on the home screen (no camera, no video, no uploads)
  const isOnHomeScreen = useCallback(() => {
    return (
      !isCameraActive &&
      !imageAnalysis &&
      !isAnalyzingImage &&
      !isAnalyzingVideo
    );
  }, [isCameraActive, imageAnalysis, isAnalyzingImage, isAnalyzingVideo]);

  // Wrapper for stopSession - on home screen stop session (parent shows start screen); otherwise reset to home screen
  const handleStopSession = useCallback(() => {
    if (isOnHomeScreen()) {
      // On home screen: this is an explicit user close, so end on the parent's
      // Restart screen instead of letting onSessionStopped clear the token and
      // auto-restart a fresh session. Marking explicitEndSessionRef routes the
      // DISCONNECTED handler through onExit(false) (Restart) not onSessionStopped.
      explicitEndSessionRef.current = true;
      greetingTriggeredRef.current = false; // Reset greeting trigger
      greetingInFlightRef.current = false;
      greetingInterruptedRef.current = false;
      greetingCompletionPendingRef.current = false;
      stopSession();
    } else {
      // Not on home screen: reset to home screen (keep session)
      resetToHomeScreen();
    }
  }, [isOnHomeScreen, resetToHomeScreen, stopSession]);

  // If the user confirmed their email and is closing the session before the send
  // consent fully resolved, MAKE SURE the magic link still goes out. G 2026-06-04:
  // he said "send the magic link" then "close it out" in the same breath — the
  // close tore down before the send fired, no email went, and 6's brain falsely
  // claimed it sent. Fire-and-forget the same POST /api/account/start would make.
  // Only fires when a send is still pending (the normal yes-path clears these
  // refs first), so it never double-sends; Resend's idempotency key covers the
  // rest. Best-effort: never blocks or throws into the close.
  const flushPendingAccountSend = useCallback(() => {
    if (
      !accountSetupAwaitingSendRef.current ||
      !accountSetupSendEmailRef.current
    ) {
      return;
    }
    // NEVER send the sign-in link without an explicit yes (G 2026-06-09: 6
    // emailed magic links the user never authorized). Only flush on close if the
    // user's last words actually consented (covers "send it and close out" in one
    // breath); otherwise drop it silently.
    const lastUser = lastUserTextRef.current || "";
    if (
      !(ACCOUNT_READY_YES_RE.test(lastUser) && !ACCOUNT_READY_NO_RE.test(lastUser))
    ) {
      accountSetupAwaitingSendRef.current = false;
      accountSetupSendEmailRef.current = null;
      return;
    }
    const email = accountSetupSendEmailRef.current;
    accountSetupAwaitingSendRef.current = false;
    accountSetupSendEmailRef.current = null;
    const flushEmail = (email || "").toLowerCase();
    const prevFlushSend = lastAccountLinkSendRef.current;
    if (
      prevFlushSend &&
      prevFlushSend.email === flushEmail &&
      Date.now() - prevFlushSend.at < 90000
    ) {
      return; // already sent moments ago (dedupe, G 2026-06-09)
    }
    lastAccountLinkSendRef.current = { email: flushEmail, at: Date.now() };
    try {
      void fetch("/api/account/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          fullName: deviceProfileRef.current.name,
          sessionId: dbSessionIdRef.current,
          lists: assistantLists,
          resumeState: buildAccountResumeState(),
        }),
      }).catch(() => {});
    } catch {
      // never block the close on the send
    }
  }, [assistantLists, buildAccountResumeState]);

  const handleEndSession = useCallback(async () => {
    explicitEndSessionRef.current = true;
    // Send the magic link if one was queued but not yet sent (see above).
    flushPendingAccountSend();
    endSessionConfirmationPendingRef.current = false;
    greetingTriggeredRef.current = false;
    greetingInFlightRef.current = false;
    greetingInterruptedRef.current = false;
    greetingCompletionPendingRef.current = false;
    try {
      stopListening();
    } catch {
      // Browser speech cleanup can throw if it is already stopped.
    }
    try {
      stop();
    } catch {
      // Voice chat can already be inactive.
    }
    try {
      await interrupt();
    } catch {
      // Ignore interrupt failures while shutting down.
    }
    resetToHomeScreen();
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    // INSTANT close (G 2026-06-03): flip the screen to "ended" NOW, before the
    // LiveAvatar disconnect (which can lag several seconds). The old order
    // awaited stopSession() FIRST, so a slow disconnect left 6 on screen and
    // still listening — that's "6 won't close." The disconnect now runs in the
    // background after the screen has already flipped.
    onExit?.(false);
    void Promise.resolve(stopSession()).catch(() => {});
  }, [
    flushPendingAccountSend,
    interrupt,
    onExit,
    resetToHomeScreen,
    stop,
    stopListening,
    stopSession,
  ]);

  // FIX #2 (2026-06-01): close THIS session because a NEWER one took over (the
  // magic-link return / another tab). 6 says a short goodbye FIRST, THEN stops —
  // "only after 6 says take care" per G. Guarded so it runs at most once.
  const gracefulSupersedeStop = useCallback(async () => {
    if (supersedeStoppingRef.current) return;
    supersedeStoppingRef.current = true;
    explicitEndSessionRef.current = true;
    greetingInFlightRef.current = false;
    try {
      stopListening();
    } catch {
      // speech cleanup can throw if already stopped
    }
    try {
      stop();
    } catch {
      // voice chat can already be inactive
    }
    try {
      await interrupt();
      await repeat(
        "Looks like you picked this up on another screen — I'll close out here. Take care!",
      );
    } catch {
      // Close anyway; never block teardown on a TTS hiccup.
    }
    try {
      await stopSession();
    } catch {
      // already disconnected is fine
    }
    onExit?.(false);
  }, [interrupt, onExit, repeat, stop, stopListening, stopSession]);

  // Listen for a newer session's baton. All aiASAP tabs in THIS browser share
  // one BroadcastChannel; when a strictly-newer session announces, we are the old
  // one → close gracefully. The newest session never hears a newer baton, so it
  // is never told to stop (safe by construction).
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof BroadcastChannel === "undefined"
    ) {
      return;
    }
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel("aiasap-session-baton");
    } catch {
      return;
    }
    sessionBatonChannelRef.current = ch;
    ch.onmessage = (event: MessageEvent) => {
      const m = event.data as {
        type?: string;
        sessionId?: string | null;
        startedAt?: number;
      } | null;
      if (
        m &&
        m.type === "baton" &&
        typeof m.startedAt === "number" &&
        m.startedAt > sessionStartedAtRef.current &&
        m.sessionId !== dbSessionIdRef.current
      ) {
        void gracefulSupersedeStop();
      }
    };
    return () => {
      try {
        ch?.close();
      } catch {
        // ignore close errors
      }
      sessionBatonChannelRef.current = null;
    };
  }, [gracefulSupersedeStop]);

  // Announce this session as the active one once it is live (voice started) or
  // signed-in (magic-link return). Older tabs hear it and close themselves.
  useEffect(() => {
    if (!voiceIsActive && !accountEmail) return;
    if (supersedeStoppingRef.current) return;
    try {
      sessionBatonChannelRef.current?.postMessage({
        type: "baton",
        sessionId: dbSessionIdRef.current,
        startedAt: sessionStartedAtRef.current,
        email: accountEmail ?? null,
      });
    } catch {
      // Best-effort; same-browser only for now. Cross-browser relay is next.
    }
  }, [voiceIsActive, accountEmail]);

  // Voice chat starts only after the user taps the begin surface.
  useEffect(() => {
    if (sessionState === SessionState.DISCONNECTED) {
      voiceHeldUntilUserStartRef.current = false;
      setIsCustomVoiceActive(false);
      setHasUserPressedVoiceStart(false);
      return;
    }
    if (sessionState !== SessionState.CONNECTED || !isStreamReady) {
      return;
    }
    if (voiceHeldUntilUserStartRef.current) {
      return;
    }
    voiceHeldUntilUserStartRef.current = true;
    stop();
  }, [sessionState, isStreamReady, stop]);

  // No avatar speech without audible output: interrupt if the agent starts speaking before audio is unlocked.
  useEffect(() => {
    const session = sessionRef.current;
    if (!session) {
      return;
    }
    const onAvatarSpeakStarted = () => {
      if (!audioUnlockedRef.current) {
        void interrupt();
      }
    };
    session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, onAvatarSpeakStarted);
    return () => {
      session.removeListener(
        AgentEventsEnum.AVATAR_SPEAK_STARTED,
        onAvatarSpeakStarted,
      );
    };
  }, [sessionRef, interrupt]);

  /** Ensure remote avatar audio can play (mobile autoplay policies). Call from explicit button taps only. */
  const ensureAudioOutputReady = useCallback(async (): Promise<boolean> => {
    if (!videoRef.current || !isStreamReady) {
      return false;
    }
    const video = videoRef.current;
    try {
      video.volume = 1.0;
      video.muted = false;
      if (video.srcObject && video.srcObject instanceof MediaStream) {
        video.srcObject.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
      }
      await video.play();
      audioUnlockedRef.current = true;
      setAudioUnlocked(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.volume = 1.0;
          videoRef.current.muted = false;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          requestAnimationFrame(done);
          return;
        }
        video.addEventListener("canplay", done, { once: true });
        setTimeout(done, 2500);
      });
      return true;
    } catch (error) {
      console.warn("Audio output not ready:", error);
      return false;
    }
  }, [isStreamReady]);

  /** Idempotent unlock for Go Live / Camera / Gallery (after user gesture). */
  const unlockAudio = useCallback(async () => {
    if (audioUnlockedRef.current) {
      return;
    }
    await ensureAudioOutputReady();
  }, [ensureAudioOutputReady]);

  const performOnlineLookup = useCallback(
    async (query: string, location: string) => {
      if (isOnlineLookupLoading) return true;
      const topic = summarizeOnlineLookupTopic(query);
      const lookupLocation = normalizeLookupLocation(location);
      setIsOnlineLookupLoading(true);
      setOnlineLookupSources([]);
      setOnlineLookupResultLines([]);
      setSourcePreview(null);
      setOnlineLookupNotice(`Looking online for ${topic}`);
      if (mode === "FULL") {
        try {
          stopListening();
        } catch {
          // The listener may already be paused.
        }
      }
      try {
        const response = await fetch("/api/online-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, location: lookupLocation }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || typeof data?.answer !== "string") {
          throw new Error(data?.error || "Online lookup failed");
        }
        const resultLines = getOnlineLookupResultLines(data.answer);
        setOnlineLookupSources([]);
        setOnlineLookupResultLines(resultLines);
        setOnlineLookupNotice(null);
        const spoken = formatOnlineLookupSpeech(resultLines, query);
        await repeat(spoken);
        if (mode === "FULL") {
          window.setTimeout(() => startListening(), 900);
        }
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        schedulePromptBrain(query);
        return true;
      } catch (error) {
        console.error("Online lookup failed:", error);
        const spoken =
          "I had trouble looking that up online. Try telling me the city or ZIP code again.";
        setOnlineLookupNotice(null);
        setOnlineLookupResultLines([]);
        await repeat(spoken);
        if (mode === "FULL") {
          window.setTimeout(() => startListening(), 900);
        }
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      } finally {
        setIsOnlineLookupLoading(false);
      }
    },
    [isOnlineLookupLoading, mode, repeat, schedulePromptBrain, startListening, stopListening],
  );

  const requestSharedLocation = useCallback(async () => {
    const fallbackQuery =
      lastUserTextRef.current && isOnlineLookupIntent(lastUserTextRef.current)
        ? lastUserTextRef.current
        : isHikingLookupQuery(lastUserTextRef.current)
          ? lastUserTextRef.current
          : "find local hikes";
    const lookupQuery = onlineLookupPendingQueryRef.current ?? fallbackQuery;
    onlineLookupPendingQueryRef.current = lookupQuery;
    setOnlineLookupSources([]);
    setOnlineLookupResultLines([]);
    setSourcePreview(null);
    setOnlineLookupNotice(null);
    setThoughtPrompts(getLookupLocationPrompts(lookupQuery));
    const spoken =
      "Tell me your five-digit ZIP code, and I'll look around there.";
    await repeat(spoken);
    lastAvatarResponseRef.current = spoken;
    rememberConversationLine("assistant", spoken);
    lastVisionResponseTimeRef.current = Date.now();
  }, [rememberConversationLine, repeat]);

  const handleOnlineLookupSpeech = useCallback(
    async (userText: string) => {
      const text = userText.trim();
      const pendingQuery = onlineLookupPendingQueryRef.current;
      if (LOCATION_SHARE_CHOICE_RE.test(text) && (pendingQuery || onlineLookupNotice)) {
        if (!pendingQuery) {
          onlineLookupPendingQueryRef.current =
            lastUserTextRef.current && isOnlineLookupIntent(lastUserTextRef.current)
              ? lastUserTextRef.current
              : isHikingLookupQuery(lastUserTextRef.current)
                ? lastUserTextRef.current
                : "find local hikes";
        }
        await requestSharedLocation();
        return true;
      }
      if (pendingQuery) {
        if (LOCATION_SHARE_CHOICE_RE.test(text)) {
          await requestSharedLocation();
          return true;
        }
        if (soundsLikeInvalidZipCode(text)) {
          const spoken =
            "That ZIP code does not sound quite right. ZIP codes are five digits. Tell me the five-digit ZIP code.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          return true;
        }
        const pendingLocation = onlineLookupLocationRef.current;
        if (pendingLocation && isOnlineLookupIntent(text)) {
          onlineLookupPendingQueryRef.current = null;
          return performOnlineLookup(text, pendingLocation);
        }
        if (
          pendingLocation &&
          shouldAskPreferencesBeforeLookup(pendingQuery) &&
          !isOnlineLookupIntent(text)
        ) {
          if (isLookupPreferenceFiller(text)) {
            const spoken = getLookupPreferenceQuestion(pendingQuery);
            await repeat(spoken);
            lastAvatarResponseRef.current = spoken;
            lastVisionResponseTimeRef.current = Date.now();
            return true;
          }
          onlineLookupPendingQueryRef.current = null;
          const preferenceText = text.replace(/^let'?s work on this next:\s*/i, "").trim();
          const lookupQuery =
            preferenceText.length > 1
              ? `${pendingQuery}. The user likes: ${preferenceText}`
              : pendingQuery;
          return performOnlineLookup(lookupQuery, pendingLocation);
        }
        const location =
          extractLocationHint(text) ?? (isLikelyTypedLocation(text) ? text : null);
        if (!location) return false;
        onlineLookupLocationRef.current = normalizeLookupLocation(location);
        if (shouldAskPreferencesBeforeLookup(pendingQuery)) {
          const spoken = getLookupPreferenceQuestion(pendingQuery);
          setOnlineLookupNotice(" ");
          setOnlineLookupResultLines([]);
          setThoughtPrompts(getLookupPreferencePrompts(pendingQuery));
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          return true;
        }
        onlineLookupPendingQueryRef.current = null;
        return performOnlineLookup(pendingQuery, location);
      }

      if (!isOnlineLookupIntent(text)) return false;

      const location = extractLocationHint(text);
      if (location) {
        onlineLookupLocationRef.current = normalizeLookupLocation(location);
        if (shouldAskPreferencesBeforeLookup(text)) {
          onlineLookupPendingQueryRef.current = text;
          const spoken = getLookupPreferenceQuestion(text);
          setOnlineLookupNotice(" ");
          setOnlineLookupResultLines([]);
          setThoughtPrompts(getLookupPreferencePrompts(text));
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          return true;
        }
        return performOnlineLookup(text, location);
      }

      if (onlineLookupLocationRef.current) {
        if (shouldAskPreferencesBeforeLookup(text)) {
          onlineLookupPendingQueryRef.current = text;
          const spoken = getLookupPreferenceQuestion(text);
          setOnlineLookupNotice(" ");
          setOnlineLookupResultLines([]);
          setThoughtPrompts(getLookupPreferencePrompts(text));
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          return true;
        }
        return performOnlineLookup(text, onlineLookupLocationRef.current);
      }

      onlineLookupPendingQueryRef.current = text;
      onlineLookupLocationRef.current = null;
      setOnlineLookupSources([]);
      setOnlineLookupResultLines([]);
      setOnlineLookupNotice(null);
      const spoken =
        "I can look that up online. Tell me your five-digit ZIP code or city.";
      await repeat(spoken);
      lastAvatarResponseRef.current = spoken;
      lastVisionResponseTimeRef.current = Date.now();
      setThoughtPrompts(
        getLookupLocationPrompts(text),
      );
      return true;
    },
    [onlineLookupNotice, performOnlineLookup, repeat, requestSharedLocation],
  );

  const handleThoughtPromptTap = useCallback(
    async (prompt: string) => {
      if (
        dissolvingPrompt ||
        sessionState !== SessionState.CONNECTED ||
        !isStreamReady
      ) {
        return;
      }

      const listIntent = detectListIntent(prompt);
      if (listIntent) {
        ensureAssistantList(listIntent, { preferFresh: shouldStartFreshList(prompt) });
      }
      setDissolvingPrompt(prompt);

      setTimeout(() => {
        setThoughtPrompts((currentPrompts) => {
          const nextPrompts = currentPrompts.filter((item) => item !== prompt);
          const refillPrompts = DEFAULT_THOUGHT_PROMPTS.filter(
            (item) => item !== prompt && !nextPrompts.includes(item),
          );
          return normalizeThoughtPrompts([...nextPrompts, ...refillPrompts]);
        });
        setDissolvingPrompt(null);
      }, 620);

      try {
        await ensureAudioOutputReady();
        await interrupt();
        if (listIntent) {
          const ensured = lastEnsuredListRef.current;
          const pendingCustomization = pendingListCustomizationPromptRef.current;
          const hasPendingCustomization =
            Boolean(pendingCustomization) &&
            pendingCustomization?.id === ensured?.id;
          const spoken =
            hasPendingCustomization && pendingCustomization
              ? `I made the ${pendingCustomization.title}. Want this one a different color, a different shade, bullets instead of numbers, or anything else that makes it easier to scan?`
              : `I ${ensured?.wasNew ? "started" : "opened"} the ${ensured?.title ?? listIntent.title}. Just tell me what goes on it.${
                  listCloseEducationSpokenRef.current
                    ? ""
                    : ` ${LIST_CLOSE_EDUCATION}`
                }`;
          if (hasPendingCustomization) {
            pendingListCustomizationPromptRef.current = null;
          } else if (!listCloseEducationSpokenRef.current) {
            listCloseEducationSpokenRef.current = true;
          }
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          schedulePromptBrain(prompt);
          return;
        }
        if (LIST_CLOSE_RE.test(prompt)) {
          setIsShoppingMode(false);
          setActiveListId(null);
          latestListMutationRef.current = null;
          setListFocusNonce((value) => value + 1);
          const spoken = "I closed the list.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          return;
        }
        if (prompt === "Explore aiASAP" || prompt === "Quick Tour") {
          const spoken =
            prompt === "Quick Tour"
              ? "A. I. A-S-A-P. is the easy way into AI. You talk to me, and I help with lists, weekend plans, practical ideas, and eventually building bigger things. What should we try first?"
              : "A. I. A-S-A-P. is built so you can just talk to me and I help you get things done. Lists, weekend plans, practical ideas, and bigger things later. Want the quick tour, or want to start with something useful?";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          setThoughtPrompts(
            normalizeThoughtPrompts([
              "Quick Tour",
              "Start a Grocery List",
              "To Do List",
              "Plan This Weekend",
            ]),
          );
          return;
        }
        if (/^close\s+(?:search|box|location)$/i.test(prompt)) {
          onlineLookupPendingQueryRef.current = null;
          onlineLookupLocationRef.current = null;
          setOnlineLookupNotice(null);
          setOnlineLookupSources([]);
          setOnlineLookupResultLines([]);
          setSourcePreview(null);
          setThoughtPrompts(normalizeThoughtPrompts(DEFAULT_THOUGHT_PROMPTS));
          return;
        }
        if (prompt === "Give ZIP Code" || prompt === "Enter City or ZIP") {
          const spoken =
            "Tell me your ZIP code, and I'll look online around there.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          return;
        }
        if (isOnlineLookupIntent(prompt)) {
          const handledLookup = await handleOnlineLookupSpeech(prompt);
          if (handledLookup) return;
        }
        await sendMessage(
          buildMemoryAugmentedMessage(`Let's work on this next: ${prompt}`),
        );
        schedulePromptBrain(prompt);
      } catch (error) {
        console.error("Failed to send thought prompt:", error);
      }
    },
    [
      dissolvingPrompt,
      buildMemoryAugmentedMessage,
      ensureAudioOutputReady,
      ensureAssistantList,
      interrupt,
      handleOnlineLookupSpeech,
      isStreamReady,
      repeat,
      requestSharedLocation,
      schedulePromptBrain,
      sendMessage,
      sessionState,
    ],
  );

  const resumeListeningAfterAvatarSpeech = useCallback(
    (fallbackMs: number) => {
      if (mode !== "FULL") return;
      const session = sessionRef.current;
      let resumed = false;
      let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
      let resume: () => void = () => {};

      const cleanup = () => {
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = null;
        }
        if (!session) return;
        if (typeof (session as any).off === "function") {
          (session as any).off(AgentEventsEnum.AVATAR_SPEAK_ENDED, resume);
        } else if (typeof session.removeListener === "function") {
          session.removeListener(AgentEventsEnum.AVATAR_SPEAK_ENDED, resume);
        }
      };

      resume = () => {
        if (resumed) return;
        resumed = true;
        cleanup();
        startListening();
      };

      if (session) {
        session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, resume);
      }
      fallbackTimer = setTimeout(resume, fallbackMs);
    },
    [mode, sessionRef, startListening],
  );

  const resetAnonymousSessionState = useCallback(() => {
    accountMemorySnapshotRef.current = null;
    accountMemoryContextInjectedRef.current = false;
    accountPendingStateTokenRef.current = null;
    recentConversationRef.current = [];
    lastUserTextRef.current = "";
    lastAvatarResponseRef.current = "";
    onlineLookupPendingQueryRef.current = null;
    onlineLookupLocationRef.current = null;
    latestListMutationRef.current = null;
    pendingListDeleteRef.current = null;
    pendingListCustomizationPromptRef.current = null;
    endSessionConfirmationPendingRef.current = false;
    endSessionConfirmationAskedAtRef.current = 0;
    postVerifyGreetingSpokenRef.current = false;
    accountSetupAwaitingReadyRef.current = false;
    accountSetupAwaitingEmailRef.current = false;
    accountSetupAwaitingNameRef.current = false;
    accountSetupPendingEmailRef.current = null;
    accountSetupRejectedEmailRef.current = null;
    accountSetupAwaitingSendRef.current = false;
    accountSetupSendEmailRef.current = null;
    accountSetupEmailMissCountRef.current = 0;

    try {
      window.localStorage.removeItem(ASSISTANT_LISTS_STORAGE_KEY);
      window.localStorage.removeItem(DEVICE_PROFILE_STORAGE_KEY);
      window.localStorage.removeItem(ACCOUNT_PENDING_STATE_TOKEN_STORAGE_KEY);
    } catch {
      // Best effort only. In-memory state is still cleared below.
    }

    setAssistantLists([]);
    setActiveListId(null);
    setIsShoppingMode(false);
    setDeviceProfile(emptyDeviceProfile());
    setPostVerifyGreeting(null);
    setAccountNotice(null);
    setAccountVerificationUrl(null);
    setEmailEntryOpen(false);
    setTypedAccountEmail("");
    setOnlineLookupNotice(null);
    setOnlineLookupSources([]);
    setOnlineLookupResultLines([]);
    setSourcePreview(null);
    setIsOnlineLookupLoading(false);
    setThoughtPrompts(normalizeThoughtPrompts(DEFAULT_THOUGHT_PROMPTS));
    setDissolvingPrompt(null);
  }, []);

  const handleVoiceStartStop = useCallback(async () => {
    if (voiceIsActive && hasUserPressedVoiceStart) {
      void interrupt();
      // r21 (G's phone, CUSTOM maiden flight: "He did not know I was there"):
      // CUSTOM used to only flip a flag and never touch the mic. Both modes
      // now run the SAME voice-chat lifecycle — the mode only changes who
      // does the brain/voice, never whether 6 can hear.
      stop();
      stopListening();
      if (mode === "CUSTOM") {
        setIsCustomVoiceActive(false);
      }
      setHasUserPressedVoiceStart(false);
      return;
    }
    if (
      sessionState !== SessionState.CONNECTED ||
      !isStreamReady ||
      !accountAuthChecked
    ) {
      return;
    }
    // G 2026-06-01: a returning, signed-in user must NEVER get the first-timer
    // hard-coded intro. resetAnonymousSessionState() wipes the returning state
    // (name, memory snapshot, postVerifyGreeting), so only run it for genuinely
    // anonymous users. A known returner keeps who they are.
    const isReturningKnownUser = !!accountEmail;
    if (!isReturningKnownUser) {
      resetAnonymousSessionState();
    }
    setVoiceStartAwaitingReady(true);
    try {
      const ok = await ensureAudioOutputReady();
      if (!ok) {
        return;
      }
      // r21: start the MIC in both modes (CUSTOM previously never did — deaf).
      await start();
      stopListening();
      if (mode === "CUSTOM") {
        setIsCustomVoiceActive(true);
      }
      // First-timers get the hard-coded intro. Returning signed-in users get a
      // returning-tier intro (2nd / 3rd / regular / long-gap) — unless the
      // verified/resume auto-effect already spoke one this load
      // (postVerifyGreetingSpokenRef), in which case we don't repeat it.
      let greeting: string | null;
      if (isReturningKnownUser) {
        greeting = postVerifyGreetingSpokenRef.current
          ? null
          : pickReturningGreeting(
              deviceProfileRef.current.name || null,
              accountMemorySnapshotRef.current?.visitCount ?? 1,
              accountMemorySnapshotRef.current?.longGap ?? false,
            );
        if (greeting) {
          // Claim the one-shot so the auto verified/resume effects don't ALSO
          // speak a returning greeting → guarantees no double-greet.
          postVerifyGreetingSpokenRef.current = true;
          setPostVerifyGreeting(null);
        }
      } else {
        greeting = VOICE_START_GREETING;
      }
      resumeListeningAfterAvatarSpeech(9000);
      greetingInFlightRef.current = true;
      greetingInterruptedRef.current = false;
      greetingCompletionPendingRef.current = false;
      if (greeting) {
        await repeat(greeting);
        lastAvatarResponseRef.current = greeting;
        rememberConversationLine("assistant", greeting);
        lastVisionResponseTimeRef.current = Date.now();
      }
      window.setTimeout(() => {
        startListening();
      }, 900);
      setHasUserPressedVoiceStart(true);
    } finally {
      setVoiceStartAwaitingReady(false);
    }
  }, [
    voiceIsActive,
    hasUserPressedVoiceStart,
    interrupt,
    repeat,
    stop,
    start,
    mode,
    startListening,
    stopListening,
    resumeListeningAfterAvatarSpeech,
    sessionState,
    isStreamReady,
    ensureAudioOutputReady,
    accountAuthChecked,
    rememberConversationLine,
    resetAnonymousSessionState,
    accountEmail,
  ]);

  // r22: keyed on hasUserPressedVoiceStart (OUR truth) instead of the SDK's
  // voice-active state — in CUSTOM the SDK reported voice active before any
  // tap, which hid the tap gate while audio was still locked ("he looked
  // alive but he wasn't there").
  const shouldShowBeginSurface =
    visionMode !== "streaming" &&
    !isCameraActive &&
    !hasUserPressedVoiceStart &&
    // r22: isAvatarTalking dropped — the CUSTOM session reports talking state
    // unreliably and it kept the tap gate hidden forever; pre-tap there is no
    // real speech to protect anyway.
    sessionState === SessionState.CONNECTED &&
    isStreamReady &&
    accountAuthChecked &&
    !voiceStartAwaitingReady;

  const shouldShowLoadingSurface =
    visionMode !== "streaming" &&
    !isCameraActive &&
    !voiceIsActive &&
    !isAvatarTalking &&
    !shouldShowBeginSurface &&
    (sessionState !== SessionState.CONNECTED ||
      !isStreamReady ||
      !accountAuthChecked ||
      voiceIsLoading);

  useEffect(() => {
    // console.log("isStreamReady: ", isStreamReady);
    // console.log("videoRef.current: ", videoRef.current);
    if (isStreamReady && videoRef.current) {
      const video = videoRef.current;
      // Muted autoplay is allowed without user gesture - avatar displays automatically
      video.muted = true;
      video.volume = 0;

      attachElement(videoRef.current);

      // Start playback immediately so avatar displays without user click/touch
      video.play().catch((err) => {
        console.warn("Autoplay (muted) failed:", err);
      });

      // If user already unlocked audio earlier (e.g. re-attach), restore sound
      if (audioUnlockedRef.current) {
        void ensureAudioOutputReady();
      }
    }
  }, [attachElement, isStreamReady, ensureAudioOutputReady]);

  // Ensure video has volume and is not muted whenever video element is available
  // Only unmute after user interaction (audio unlock) - CRITICAL to prevent mouth movement during loading
  useEffect(() => {
    if (videoRef.current && isStreamReady && audioUnlockedRef.current) {
      const video = videoRef.current;
      video.volume = 1.0;
      video.muted = false;
      // Also ensure audio tracks are enabled if available
      if (video.srcObject && video.srcObject instanceof MediaStream) {
        video.srcObject.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
      }
    } else if (videoRef.current && isStreamReady && !audioUnlockedRef.current) {
      // Ensure video stays muted if audio is not unlocked yet
      const video = videoRef.current;
      video.muted = true;
      video.volume = 0;
    }
  }, [isStreamReady, audioUnlockedRef]);

  // DISABLED: Function to trigger greeting - removed to prevent automatic "Hi" on load
  // Greeting should only happen on explicit user action, not automatically
  const triggerGreetingIfNeeded = useCallback(() => {
    // Do nothing - greeting disabled to prevent mouth movement during loading
  }, []);

  // Function to load fallback image from public folder
  const loadFallbackImage = useCallback(async (): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const file = new File(
                [blob],
                "2c44c052-e58a-4f6d-a6c8-dba901ff0e9e.jpg",
                { type: "image/jpeg" },
              );
              resolve(file);
            } else {
              reject(new Error("Failed to convert canvas to blob"));
            }
          },
          "image/jpeg",
          0.95,
        );
      };

      img.onerror = () => {
        reject(new Error("Failed to load fallback image from public folder"));
      };

      // Load image from public folder
      img.src = "/2c44c052-e58a-4f6d-a6c8-dba901ff0e9e.jpg";
    });
  }, []);

  // Handle Go Live button - enable real-time streaming vision mode (verbal questions)
  const handleGoLive = useCallback(async () => {
    // If already in streaming vision mode, return
    if (visionMode === "streaming") {
      return;
    }

    // Activate streaming Vision mode
    setVisionMode("streaming");

    // If camera is not available, show fallback mode with default image
    if (cameraAvailable === false) {
      setIsCameraActive(true);
      // If fallback image is not already set, load it
      if (!fallbackImage) {
        loadFallbackImage()
          .then((file) => {
            setFallbackImage(file);
            const previewUrl = URL.createObjectURL(file);
            setFallbackImagePreview(previewUrl);
          })
          .catch((error) => {
            console.error("Error loading fallback image:", error);
          });
      }
      return;
    }

    try {
      // First try to get rear camera (environment)
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        setCameraAvailable(true);
      } catch (error) {
        // If rear camera fails, try front camera (user)
        console.log("Rear camera not available, trying front camera");
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
          });
          setCameraAvailable(true);
        } catch (error2) {
          // No camera available, use fallback mode with default image
          console.log("No camera available, using fallback mode");
          setCameraAvailable(false);
          setIsCameraActive(true);
          // If fallback image is not already set, load it
          if (!fallbackImage) {
            loadFallbackImage()
              .then((file) => {
                setFallbackImage(file);
                const previewUrl = URL.createObjectURL(file);
                setFallbackImagePreview(previewUrl);
              })
              .catch((error) => {
                console.error("Error loading fallback image:", error);
              });
          }
          return;
        }
      }

      if (stream) {
        setCameraStream(stream);
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      // Use fallback mode instead of showing error
      setCameraAvailable(false);
      setIsCameraActive(true);
      if (!fallbackImage) {
        loadFallbackImage()
          .then((file) => {
            setFallbackImage(file);
            const previewUrl = URL.createObjectURL(file);
            setFallbackImagePreview(previewUrl);
          })
          .catch((error) => {
            console.error("Error loading fallback image:", error);
          });
      }
    }
  }, [
    triggerGreetingIfNeeded,
    visionMode,
    cameraAvailable,
    fallbackImage,
    loadFallbackImage,
  ]);

  // Allow the initial greeting (intro line) from the backend to play when session is fully loaded
  // No interception - when the avatar starts speaking the intro, let it play

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, [cameraStream]);

  // Set camera stream to video element when both are available
  useEffect(() => {
    if (cameraStream && cameraPreviewRef.current) {
      const video = cameraPreviewRef.current;
      video.srcObject = cameraStream;

      // Ensure video plays
      video.play().catch((error) => {
        console.error("Error playing camera video:", error);
      });

      // Log when video is ready
      const onLoadedMetadata = () => {
        console.log("Camera video metadata loaded:", {
          width: video.videoWidth,
          height: video.videoHeight,
          readyState: video.readyState,
        });
      };

      video.addEventListener("loadedmetadata", onLoadedMetadata);

      return () => {
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
      };
    }
  }, [cameraStream, isCameraActive]);

  // Function to capture frame from camera video or use fallback image
  const captureCameraFrame = useCallback(async (): Promise<File | null> => {
    if (!isCameraActive) {
      return null;
    }

    // If using fallback image, return it directly
    if (fallbackImage) {
      console.log("Using fallback image:", fallbackImage.name);
      return fallbackImage;
    }

    // Otherwise, try to capture from camera
    if (!cameraPreviewRef.current) {
      console.error("Camera preview ref not available");
      return null;
    }

    try {
      const video = cameraPreviewRef.current;

      // Wait for video to be ready with valid dimensions
      if (video.readyState < 2) {
        // Video not ready, wait for loadedmetadata
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Video metadata loading timeout"));
          }, 3000);

          const onLoadedMetadata = () => {
            clearTimeout(timeout);
            video.removeEventListener("loadedmetadata", onLoadedMetadata);
            resolve();
          };

          video.addEventListener("loadedmetadata", onLoadedMetadata);

          // If already loaded, resolve immediately
          if (video.readyState >= 2) {
            clearTimeout(timeout);
            video.removeEventListener("loadedmetadata", onLoadedMetadata);
            resolve();
          }
        });
      }

      // Check if video has valid dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.error(
          "Video has invalid dimensions:",
          video.videoWidth,
          video.videoHeight,
        );
        return null;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Failed to get canvas context");
        return null;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const file = new File([blob], "camera-frame.jpg", {
                type: "image/jpeg",
              });
              console.log("Camera frame captured successfully:", {
                width: canvas.width,
                height: canvas.height,
                fileSize: file.size,
              });
              resolve(file);
            } else {
              console.error("Failed to convert canvas to blob");
              resolve(null);
            }
          },
          "image/jpeg",
          0.95,
        );
      });
    } catch (error) {
      console.error("Error capturing camera frame:", error);
      return null;
    }
  }, [isCameraActive, fallbackImage]);

  // Function to capture photo and analyze it (only for snapshot mode)
  const handleSnapPhoto = useCallback(async () => {
    if (!isCameraActive || visionMode !== "snapshot") {
      return;
    }

    let frameFile: File | null = null;
    try {
      setIsAnalyzingImage(true);
      // Show "Analyzing" immediately (not "Loading")
      setIsProcessingCameraQuestion(true);

      // Capture frame from camera or use fallback image
      frameFile = await captureCameraFrame();

      if (!frameFile) {
        console.error("Failed to capture camera frame");
        setIsAnalyzingImage(false);
        return;
      }

      // Close camera preview and return to full avatar display
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }
      setIsCameraActive(false);
      setVisionMode(null);

      // Clean up preview URL if it's not the default fallback image
      if (
        fallbackImagePreview &&
        fallbackImage &&
        fallbackImage.name !== "2c44c052-e58a-4f6d-a6c8-dba901ff0e9e.jpg"
      ) {
        URL.revokeObjectURL(fallbackImagePreview);
      }
      setFallbackImage(null);
      setFallbackImagePreview(null);

      // Analyze the photo
      const formData = new FormData();
      formData.append("image", frameFile, frameFile.name || "camera-frame.jpg");
      formData.append("question", "Describe what you see briefly");

      const response = await fetch("/api/analyze-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = "Failed to analyze photo";
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
          if (error.details) errorMessage += ` (${error.details})`;
        } catch {
          errorMessage += ` (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const analysis = data.analysis;
      setImageAnalysis(analysis);
      void captureMedia({
        file: frameFile,
        source: "camera_snapshot",
        sessionId: dbSessionIdRef.current ?? getLiveAvatarSessionId(sessionRef.current) ?? null,
        geminiAnalysis: analysis,
        problem: currentProblemRef.current || null,
      });

      // Store analysis as context for future questions (no scripted repeat prompt)
      if (mode === "FULL" && sessionRef.current) {
        const contextMessage = `You are directly viewing an image. Here's what you see: ${analysis}. When the user asks about the image, respond as if you're directly viewing it. Describe what you see naturally and confidently - you have full visibility. Never say you can't see the image, that you don't have eyes, or that you're relying on someone else's analysis. You are directly viewing this image. When user asks about the image, respond briefly (1-2 sentences). Never tell them to point a camera or offer to take a look—you already have this image.`;
        injectFullModeContext(contextMessage);
      }

      setIsAnalyzingImage(false);
    } catch (error) {
      console.error("Error capturing and analyzing photo:", error);
      if (frameFile) {
        void captureMedia({
          file: frameFile,
          source: "camera_snapshot",
          sessionId: dbSessionIdRef.current ?? getLiveAvatarSessionId(sessionRef.current) ?? null,
          problem: currentProblemRef.current || null,
          error: error instanceof Error ? error.message : "Failed to analyze photo",
        });
      }
      if (mode === "FULL") {
        await repeat(
          "Oops! I had a little trouble analyzing the photo. Could you try again?",
        );
      }
      setIsAnalyzingImage(false);
    }
  }, [
    isCameraActive,
    visionMode,
    captureCameraFrame,
    cameraStream,
    fallbackImage,
    fallbackImagePreview,
    mode,
    sessionRef,
    repeat,
  ]);

  // Function to process camera question (only for streaming mode - verbal questions)
  const processCameraQuestion = useCallback(
    async (question: string, skipDuplicateCheck: boolean = false) => {
      console.log("processCameraQuestion called", {
        question,
        skipDuplicateCheck,
        isCameraActive,
        visionMode,
        isProcessingCameraQuestion,
      });

      // Only process in streaming mode (Go Live)
      if (!isCameraActive || visionMode !== "streaming") {
        console.log("Not in streaming vision mode, returning early");
        return;
      }

      const userText = question.trim();

      // Allow empty question for general analysis (when camera mode is first activated)
      // Skip only if we're not doing a general analysis (skipDuplicateCheck is false and question is empty)
      if (userText.length === 0 && !skipDuplicateCheck) {
        console.log(
          "Question is empty and not a general analysis request, returning early",
        );
        return;
      }

      // Skip if already processing (use ref for immediate check to prevent race conditions)
      // Note: We allow processing if isDebugProcessingRef is set by the current call
      // The check is done in handleDebugAnalysis before calling this function
      // BUT: Allow processing if skipDuplicateCheck is true (for initial vision recognition)
      if (isProcessingCameraQuestion && !skipDuplicateCheck) {
        console.log("Already processing, skipping duplicate request");
        return;
      }

      // Skip duplicate check if explicitly skipped (for debug button)
      if (
        !skipDuplicateCheck &&
        lastProcessedQuestionRef.current === userText
      ) {
        console.log("Skipping duplicate question:", userText);
        return;
      }

      // Clear any existing timeout
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }

      // Mark as processing and store the question
      console.log("Processing question with camera frame analysis...");
      setIsProcessingCameraQuestion(true);
      setIsAnalyzingImage(true);
      // Don't show loading text - we'll only show "Analyzing" via isProcessingCameraQuestion
      // Removed setShowVisionLoading(true) to prevent flashing text
      lastProcessedQuestionRef.current = userText;

      let frameFile: File | null = null;
      try {
        // Capture frame from camera or use fallback image
        console.log("Capturing camera frame or using fallback image...");
        frameFile = await captureCameraFrame();

        if (!frameFile) {
          console.error("Failed to capture camera frame or no fallback image");
          if (mode === "FULL") {
            if (cameraAvailable === false && !fallbackImage) {
              await repeat(
                "I don't have a camera or image to analyze right now. Please upload an image first by clicking the Camera button and selecting an image!",
              );
            } else {
              await repeat(
                "Hmm, I'm having trouble capturing what I'm seeing right now. Could you try asking again in a moment?",
              );
            }
          }
          setIsProcessingCameraQuestion(false);
          setIsAnalyzingImage(false);
          // Reset after a delay to allow retry
          processingTimeoutRef.current = setTimeout(() => {
            lastProcessedQuestionRef.current = "";
          }, 2000);
          return;
        }

        // Persist the current problem so Grok stays locked on it across every
        // subsequent frame in this Go Live session. We only overwrite when the
        // user says something meaningful — empty / auto-fire calls reuse the last problem.
        if (userText.length > 0) {
          currentProblemRef.current = userText;
        }

        console.log("Frame captured, sending to API with question:", userText);
        // Send to analyze-image API in streaming mode with problem context + last analysis
        // so Grok stays laser-focused on the user's actual problem and silent when nothing changed.
        const formData = new FormData();
        formData.append("image", frameFile, frameFile.name || "camera-frame.jpg");
        formData.append("question", userText);
        formData.append("mode", "streaming");
        if (currentProblemRef.current) {
          formData.append("problem", currentProblemRef.current);
        }
        if (lastAnalysisRef.current) {
          formData.append("lastAnalysis", lastAnalysisRef.current);
        }

        const response = await fetch("/api/analyze-image", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          let errorMessage = "Failed to analyze camera frame";
          try {
            const error = await response.json();
            errorMessage = error.error || errorMessage;
            if (error.details) errorMessage += ` (${error.details})`;
          } catch {
            errorMessage += ` (${response.status})`;
          }
          console.error("API error:", errorMessage);
          throw new Error(errorMessage);
        }

        const data = await response.json();
        const analysis: string = (data.analysis ?? "").toString();
        console.log("Analysis received:", analysis.substring(0, 100) + "...");
        void captureMedia({
          file: frameFile,
          source: "go_live_frame",
          sessionId: dbSessionIdRef.current ?? getLiveAvatarSessionId(sessionRef.current) ?? null,
          geminiAnalysis: analysis,
          problem: currentProblemRef.current || null,
        });

        // Silent-first: Grok outputs [SILENT] when nothing meaningful has changed.
        // Keep the avatar quiet entirely — no repeat(), no state churn.
        const trimmed = analysis.trim();
        if (trimmed === "[SILENT]" || trimmed.startsWith("[SILENT]")) {
          console.log("Vision: [SILENT] — avatar staying quiet.");
          // Reset the last processed question so the user can ask again if they want.
          processingTimeoutRef.current = setTimeout(() => {
            lastProcessedQuestionRef.current = "";
          }, 2000);
          return;
        }

        // OBJECT_NOT_VISIBLE: "Can you hold the [object] up center of frame for me?"
        // Strip the prefix and speak only the quoted prompt.
        let responseMessage = trimmed;
        const objectNotVisibleMatch = trimmed.match(
          /^OBJECT_NOT_VISIBLE\s*:\s*["“]?(.+?)["”]?$/s,
        );
        if (objectNotVisibleMatch) {
          responseMessage = objectNotVisibleMatch[1].trim();
          console.log("Vision: object not visible — asking user to reframe.");
        }

        setImageAnalysis(responseMessage);
        // Remember this analysis so the next frame can be compared against it for change detection.
        lastAnalysisRef.current = responseMessage;

        // Store the response to filter out avatar transcriptions later
        lastAvatarResponseRef.current = responseMessage.substring(0, 100); // Store first 100 chars for comparison

        // Hide loading is handled by isProcessingCameraQuestion state

        // Send the response to the avatar - use repeat() to speak directly without AI processing
        // IMPORTANT: Use repeat() which speaks directly without AI processing to prevent monologuing
        if (mode === "FULL") {
          console.log(
            "Sending response to avatar using repeat() - direct speech only",
          );
          // Use repeat() to make avatar speak ONLY this message, no AI processing = no monologue
          await repeat(responseMessage);
          lastVisionResponseTimeRef.current = Date.now();
          // CRITICAL: Do NOT send any additional messages to prevent continued talking
          // Do NOT use sessionRef.current.message() here as it triggers AI processing and monologuing
        }

        // Reset the last processed question after a delay to allow the same question to be asked again later
        processingTimeoutRef.current = setTimeout(() => {
          lastProcessedQuestionRef.current = "";
        }, 5000);
      } catch (error) {
        console.error("Error processing camera question:", error);
        if (frameFile) {
          void captureMedia({
            file: frameFile,
            source: "go_live_frame",
            sessionId: dbSessionIdRef.current ?? getLiveAvatarSessionId(sessionRef.current) ?? null,
            problem: currentProblemRef.current || null,
            error:
              error instanceof Error
                ? error.message
                : "Failed to analyze camera frame",
          });
        }
        // Send a friendly error message - use repeat() to speak directly
        if (mode === "FULL") {
          await repeat(
            "Oops! I had a little trouble analyzing what I'm seeing right now. Could you try asking again?",
          );
        }
        // Reset after error
        processingTimeoutRef.current = setTimeout(() => {
          lastProcessedQuestionRef.current = "";
        }, 2000);
      } finally {
        setIsProcessingCameraQuestion(false);
        setIsAnalyzingImage(false);
        // Loading will be hidden when avatar starts talking (via useEffect) or already hidden above
      }
    },
    [
      isCameraActive,
      isProcessingCameraQuestion,
      visionMode,
      mode,
      captureCameraFrame,
      cameraAvailable,
      fallbackImage,
      sessionRef,
      repeat,
    ],
  );

  // Debug button handler
  const handleDebugAnalysis = useCallback(async () => {
    console.log("Debug button clicked", {
      isDebugProcessing: isDebugProcessingRef.current,
      isProcessingCameraQuestion,
      isCameraActive,
      hasFallbackImage: !!fallbackImage,
      cameraAvailable,
    });

    // Prevent multiple simultaneous calls
    if (isDebugProcessingRef.current || isProcessingCameraQuestion) {
      console.log("Debug analysis already in progress, skipping...");
      return;
    }

    if (!isCameraActive) {
      console.error("Camera is not active, cannot analyze");
      return;
    }

    isDebugProcessingRef.current = true;
    const defaultQuestion =
      "What can you see in this image? Please describe everything you see with enthusiasm and humor!";

    console.log("Starting debug analysis with question:", defaultQuestion);

    try {
      await processCameraQuestion(defaultQuestion, true);
      console.log("Debug analysis completed successfully");
    } catch (error) {
      console.error("Error in debug analysis:", error);
    } finally {
      // Reset after processing completes
      setTimeout(() => {
        isDebugProcessingRef.current = false;
        console.log("Debug processing ref reset");
      }, 500);
    }
  }, [
    processCameraQuestion,
    isProcessingCameraQuestion,
    isCameraActive,
    fallbackImage,
    cameraAvailable,
  ]);

  // Listen to user transcriptions and handle verbal questions in streaming mode (Go Live)
  useEffect(() => {
    if (!sessionRef.current) {
      return;
    }

    // r33 (G 2026-06-12 21:15: "two voices" twice in one ride + every line
    // written twice): turns process ONE AT A TIME in arrival order. STT
    // delivering two utterances a beat apart used to race both through the
    // handler stack — two responders, overlapping audio through two
    // different voice pipes, double memory writes.
    const handleUserTranscription = (event: { text: string }) => {
      turnChainRef.current = turnChainRef.current
        .then(() =>
          // r35: 25s race — one hung turn can't dam the chain.
          Promise.race([
            processUserTurn(event),
            new Promise<void>((resolve) => setTimeout(resolve, 25_000)),
          ]),
        )
        .catch(() => {});
      return turnChainRef.current;
    };
    const processUserTurn = async (event: { text: string }) => {
      const userText = event.text.trim();
      if (isInternalSignal(userText)) {
        return;
      }
      // STT ECHO DEDUPE (2026-06-11): the pipeline delivers the same utterance
      // twice within a beat. Each echo dispatched twice — one "make it bigger"
      // stepped sizing twice (G's runaway pills), and a duplicated "Perfect."
      // confirmed the email was correct AND THEN satisfied the just-armed send
      // gate, mailing the sign-in link before consent was ever asked. A
      // normalized-identical utterance inside 2.5s is an echo, never the user
      // repeating themselves — drop it before anything can act on it.
      if (
        isDuplicateUtterance(
          prevUserSpeechRef.current?.text ?? null,
          prevUserSpeechRef.current?.at ?? 0,
          userText,
          Date.now(),
        )
      ) {
        return;
      }
      // ECHO FIREWALL (copilot 2026-06-12): when the WebAudio fallback voice
      // plays through speakers, the mic can hear 6 and transcribe HIM as the
      // user — the brain then answers itself in a loop (G's "multiple
      // voices"; transcript showed his greeting tail logged as user turns).
      // If this line matches something 6 just said, it is his own voice
      // coming back — drop it before anything can act on it.
      if (mode === "CUSTOM" && wasRecentlySpokenBySix(userText)) {
        reportCustomVoiceDiag(`[echo-dropped] ${userText.slice(0, 80)}`);
        logAppEvent("echo_dropped", {
          where: "avatar",
          heard: userText.slice(0, 200),
        });
        return;
      }
      // Snapshot the previous fragment BEFORE overwriting, so the close check
      // below can stitch same-utterance STT chunks together.
      const priorUserSpeech = prevUserSpeechRef.current;
      prevUserSpeechRef.current = { text: userText, at: Date.now() };
      lastUserTextRef.current = userText;
      rememberConversationLine("user", userText);
      // r25: CUSTOM sessions have no official LiveAvatar transcript — log the
      // user's words ourselves so sup pulls see the WHOLE conversation.
      // (Voice-list mode already logs in handleVoiceUtterance; avatar mode
      // logs here.)
      if (mode === "CUSTOM" && voicePresenceRef.current === "avatar") {
        voiceLogTurn("user", userText);
      }
      // r29 telemetry (G 2026-06-12): complaints ARE bug reports — file
      // silently, keep the conversation flowing. Frustration counter too.
      noteUserTurnForFrustration(userText);
      maybeSubmitBugReport({
        triggerText: userText,
        transcript: recentConversationRef.current.map((l) => ({
          role: l.role,
          text: l.text,
        })),
        listSnapshot: activeListSnapshotRef.current,
        mode,
      });
      maybeSubmitUserFeedback({
        triggerText: userText,
        transcript: recentConversationRef.current.map((l) => ({
          role: l.role,
          text: l.text,
        })),
        mode,
      });
      if (accountPendingStateTokenRef.current) {
        savePendingAccountState();
      }

      const rawLastAssistantText = lastAvatarResponseRef.current;
      const lastAssistantText = rawLastAssistantText.toLowerCase();
      const isAnsweringNamePrompt =
        /\b(?:what should i call you|what'?s your name|your name|full name|call you)\b/i.test(
          lastAssistantText,
        ) &&
        !activeListId &&
        !LIST_TRIGGER_RE.test(userText);
      const deviceNameCandidate = extractDeviceNameCandidate(
        userText,
        isAnsweringNamePrompt,
      );
      if (
        deviceNameCandidate &&
        (isAnsweringNamePrompt ||
          /\b(?:my name is|call me|i am|i'm|im)\b/i.test(userText))
      ) {
        setDeviceProfile((current) => ({
          ...current,
          name: deviceNameCandidate,
          updatedAt: Date.now(),
        }));
        // Sync the REF too (2026-06-07, G "6 re-asked my name"): the account-setup
        // flow checks deviceProfileRef.current.name (4232 / 4268). A name caught
        // here conversationally ("my name is George") only updated state, so the
        // ref stayed empty and 6 re-asked the name at the email step. Mirror the
        // ref the same way the scripted awaiting-name branch does.
        deviceProfileRef.current = {
          ...deviceProfileRef.current,
          name: deviceNameCandidate,
          updatedAt: Date.now(),
        };
        // signup-tracer (2026-06-10): server-readable breadcrumb so we can SEE
        // in error_logs that the spoken name landed in the ref (G's sessions
        // keep hitting "you already asked my name" — this proves/disproves the
        // capture side without needing his browser console).
        void captureClientWarn(
          new Error("signup-tracer: name captured"),
          { where: "name-catch", name: deviceNameCandidate },
        );
      }

      // YIELD THE FLOOR INSTANTLY: cut 6 off on ANY user speech while he's
      // talking. Cloned from the v1 domain build (G 2026-06-04: "v1 doesn't
      // interrupt as much") — v1 interrupts here UNCONDITIONALLY. v2.1 had gated
      // this on non-backchannel, so 6 kept talking through the user's words;
      // that's the extra interrupting G felt. Matching v1: the moment a user
      // transcription arrives while 6 is mid-speech, 6 stops.
      if (isAvatarTalking) {
        void interrupt();
      }

      // r30 (G 2026-06-12): voice sign-out — checked before every other
      // handler so nothing can eat "log me out" / "switch accounts".
      if (LOGOUT_COMMAND_RE.test(userText)) {
        await repeat(ACCOUNT_SIGNOUT_LINE);
        lastAvatarResponseRef.current = ACCOUNT_SIGNOUT_LINE;
        rememberConversationLine("assistant", ACCOUNT_SIGNOUT_LINE);
        performSignOut();
        return;
      }

      // FIX (latency, 2026-06-01): EMAIL-SPELLING FAST PATH.
      // When 6 is actively collecting the account email — either waiting on
      // spelled letters, or waiting on the yes/no after showing a candidate —
      // route the transcript STRAIGHT to the account handler before any of the
      // list / online-lookup / prompt-size / end-session checks + awaits below.
      // That chain (several regex tests plus the awaited handlePromptSizeSpeech /
      // hasEndSessionIntent yields) delayed when each spelled letter reached the
      // chest, contributing to the "looks broken" lag the user saw.
      // handleAccountSetupSpeech already shows the box (setShowChestEmail(true))
      // and appends letters with minimal delay. Gated strictly on the
      // awaiting-email refs, so normal conversation turns are unaffected.
      // CLOSE-ESCAPE (G 2026-06-03: "he could not close the session") lives
      // inside takesEmailFastPath: a genuine close always wins over email
      // collection; spelled letters and yes/no answers never match it.
      if (takesEmailFastPath(signupPorts, signupFlags, userText)) {
        // FIX (double-voice, 2026-06-01): the avatar's own LiveAvatar brain was
        // reading the spelled email back aloud and chattering over the scripted
        // flow (G's "you're really interrupting me"). The fix lives in the CW
        // (6af8624c): 6 is now instructed to NEVER say the email aloud / never
        // spell it back, just ask "Is the email on screen correct?". We do NOT
        // stopListening() here on purpose — in FULL mode the spelled letters
        // arrive via the server USER_TRANSCRIPTION stream, and muting listening
        // risks starving that capture. We DO skip schedulePromptBrain so the
        // pillbox labels hold steady (the chest box is the focus) instead of
        // churning mid-spell.
        let fastPathHandled = false;
        try {
          fastPathHandled = await handleAccountSetupSpeech(userText);
        } catch (machineError) {
          // signup-tracer (2026-06-10): a THROW here used to vanish as an
          // unhandled rejection and the machine just looked "dark" while 6's
          // brain freelanced the signup. Surface it server-side.
          void captureClientError(machineError, {
            where: "signup-machine-fastpath",
            userText: userText.slice(0, 160),
          });
        }
        if (fastPathHandled) {
          return;
        }
      }

      // Data export / download: catch "download my data / export my info / get a
      // copy" BEFORE the delete check, so a "download before you delete" request
      // routes to export - and runs cleanly even mid-delete-confirm. (G 2026-06-07)
      if (await handleDataExportSpeech(userText)) {
        schedulePromptBrain(userText);
        return;
      }

      // Data deletion: catch "delete my data / close my account / forget me"
      // (and the yes/no while confirming) BEFORE the close-session + account-
      // setup checks, so "close my account" routes to deletion, never a session
      // close. Only acts for signed-in users with the intent; no-ops otherwise.
      // (G 2026-06-07)
      if (await handleDataDeleteSpeech(userText)) {
        schedulePromptBrain(userText);
        return;
      }

      // Reminders run BEFORE list logic so "remind me to buy milk" becomes a
      // reminder, never a grocery item. Stateless — cannot trap a turn.
      if (await handleReminderSpeech(userText)) {
        schedulePromptBrain(userText);
        return;
      }

      if (await handleSmsOptInSpeech(userText)) {
        schedulePromptBrain(userText);
        return;
      }

      // Timezone by voice (2026-06-11): zip / "wrong time zone" / place-with-
      // time-context. Stateless; window-scoped bare answers; cannot trap.
      if (await handleTimezoneSpeech(userText)) {
        schedulePromptBrain(userText);
        return;
      }

      // r18: "what time is it?" — the app speaks the exact clock itself.
      if (await handleTimeAskSpeech(userText)) {
        schedulePromptBrain(userText);
        return;
      }

      if (pendingListDeleteRef.current) {
        const listIdToDelete = pendingListDeleteRef.current;
        if (END_SESSION_CONFIRM_RE.test(userText)) {
          const listTitle =
            assistantLists.find((list) => list.id === listIdToDelete)?.title ??
            "that list";
          deleteAssistantList(listIdToDelete);
          const spoken = `Deleted ${listTitle}.`;
          await interrupt();
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }
        if (END_SESSION_CANCEL_RE.test(userText)) {
          pendingListDeleteRef.current = null;
          const spoken = "Okay, I kept the list.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }
        const spoken = "Before I delete that list, say yes to delete it or no to keep it.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        return;
      }

      if (ONLINE_LOOKUP_CLOSE_RE.test(userText)) {
        onlineLookupPendingQueryRef.current = null;
        onlineLookupLocationRef.current = null;
        setOnlineLookupNotice(null);
        setOnlineLookupSources([]);
        setOnlineLookupResultLines([]);
        setSourcePreview(null);
        clearAccountEmailEntry();
        setThoughtPrompts(normalizeThoughtPrompts(DEFAULT_THOUGHT_PROMPTS));
        const spoken = "I closed that box.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        return;
      }

      const listIntent = detectListIntent(userText);

      if (SHOPPING_MODE_CLOSE_RE.test(userText)) {
        clearAccountEmailEntry();
        setIsShoppingMode(false);
        await interrupt();
        const spoken = "I closed shopping mode.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        schedulePromptBrain(userText);
        return;
      }

      if (activeList && LIST_DELETE_RE.test(userText)) {
        pendingListDeleteRef.current = activeList.id;
        const spoken = `Do you want me to delete ${activeList.title}? Say yes to delete it, or no to keep it.`;
        await interrupt();
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        return;
      }

      if (LIST_CLOSE_RE.test(userText)) {
        clearAccountEmailEntry();
        onlineLookupPendingQueryRef.current = null;
        onlineLookupLocationRef.current = null;
        setOnlineLookupNotice(null);
        setOnlineLookupSources([]);
        setOnlineLookupResultLines([]);
        setSourcePreview(null);
        setIsShoppingMode(false);
        setActiveListId(null);
        latestListMutationRef.current = null;
        setListFocusNonce((value) => value + 1);
        const spoken = "I closed the list.";
        await interrupt();
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        schedulePromptBrain(userText);
        return;
      }

      if (endSessionConfirmationPendingRef.current) {
        // Ignore empty/echo fragments — keep waiting for a real answer.
        if (!userText.trim()) return;
        if (END_SESSION_CANCEL_RE.test(userText)) {
          endSessionConfirmationPendingRef.current = false;
          endSessionConfirmationAskedAtRef.current = 0;
          const spoken = "Okay, we'll keep going.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }
        if (confirmsEndSession(userText)) {
          void handleEndSession();
          return;
        }
        // Not a confirm and not a cancel: the user simply kept talking. Drop the
        // close prompt and handle their words normally below — never swallow the
        // turn or auto-close on a passing mention.
        endSessionConfirmationPendingRef.current = false;
        endSessionConfirmationAskedAtRef.current = 0;
      }

      if (await handlePromptSizeSpeech(userText)) {
        // NO prompt-brain on sizing turns (G 23:37: pills started saying
        // "Adjust Text Size" / "Try Different Fonts" — label churn from the
        // sizing chatter). Labels hold their normal topics through a resize.
        return;
      }

      if (hasEndSessionIntent(userText)) {
        // EAGER close (G 2026-06-03): a clear close closes IMMEDIATELY — no
        // confirm turn to fight 6's brain over. BUT guard against a close-verb
        // FRAGMENT inside a QUESTION about closing: STT split "Let me ask you,
        // if I [close this site out, would you remember me next time]" across
        // chunks, so the bare "close this site out" fragment slipped past the
        // "if i" block and closed mid-question. Re-check the block with the
        // prior fragment stitched on when it arrived within the same utterance
        // window (~6s); if the wider context is a question/hypothetical, do NOT
        // close — fall through and treat it as normal conversation.
        const stitchedForClose =
          priorUserSpeech.text && Date.now() - priorUserSpeech.at < 6000
            ? `${priorUserSpeech.text} ${userText}`
            : userText;
        if (!END_SESSION_BLOCK_RE.test(stitchedForClose)) {
          endSessionConfirmationPendingRef.current = false;
          endSessionConfirmationAskedAtRef.current = 0;
          await interrupt();
          void handleEndSession();
          return;
        }
      }

      let setupHandled = false;
      try {
        setupHandled = await handleAccountSetupSpeech(userText);
      } catch (machineError) {
        void captureClientError(machineError, {
          where: "signup-machine",
          userText: userText.slice(0, 160),
        });
      }
      // signup-tracer (2026-06-10): G's 09:44 session showed the BRAIN running
      // the whole signup while this scripted machine stayed dark — and we could
      // not tell which gate failed from the transcript alone. Until root-caused:
      // log every signup-shaped utterance the machine does NOT handle, with the
      // full gate state, into error_logs (server-readable, no console needed).
      if (
        !setupHandled &&
        (ACCOUNT_SETUP_TRIGGER_RE.test(userText) ||
          accountSetupAwaitingReadyRef.current ||
          accountSetupAwaitingEmailRef.current ||
          accountSetupAwaitingNameRef.current ||
          accountSetupAwaitingSendRef.current ||
          accountSetupPendingEmailRef.current !== null)
      ) {
        void captureClientError(
          new Error("signup-tracer: signup-shaped utterance NOT handled"),
          {
            where: "signup-tracer",
            userText: userText.slice(0, 160),
            userName: deviceProfileRef.current.name ?? "",
            signedIn: accountSignedInRef.current,
            awaitingReady: accountSetupAwaitingReadyRef.current,
            awaitingEmail: accountSetupAwaitingEmailRef.current,
            awaitingName: accountSetupAwaitingNameRef.current,
            awaitingSend: accountSetupAwaitingSendRef.current,
            pendingEmail: accountSetupPendingEmailRef.current ?? "",
          },
        );
      }
      if (setupHandled) {
        schedulePromptBrain(userText);
        return;
      }

      // r32 (G live 2026-06-12 20:49: "show me the list" → "Tell me your
      // five-digit ZIP code" — the lookup ate it): showing a list always
      // wins over searching the internet.
      if (
        /\bshow (?:me )?(?:the |my )?(?:\w+ )?list\b|\bput (?:the |my )?list (?:back )?up\b|\bwhere(?:'s| is) (?:the |my )list\b/i.test(
          userText,
        ) &&
        assistantLists.length > 0
      ) {
        const shown = activeList ?? moveActiveList(1);
        if (shown) {
          const spoken = `I opened the ${shown.title}.`;
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }
      }

      if (await handleOnlineLookupSpeech(userText)) {
        schedulePromptBrain(userText);
        return;
      }

      if (LIST_NAV_NEXT_RE.test(userText)) {
        const nextList = moveActiveList(1);
        if (nextList) {
          const spoken = `I opened the ${nextList.title}.`;
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }
      } else if (LIST_NAV_PREV_RE.test(userText)) {
        const previousList = moveActiveList(-1);
        if (previousList) {
          const spoken = `I opened the ${previousList.title}.`;
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }
      }

      const referencedAssistantItems =
        LIST_START_WITH_REFERENCED_ITEMS_RE.test(userText)
          ? extractReferencedAssistantListItems(rawLastAssistantText)
          : [];
      const inferredListIntentRaw =
        listIntent ??
        (referencedAssistantItems.length > 0
          ? { title: "Shopping List", kind: "shopping" as const }
          : null);
      // r19 (G live 21:06: "It's still a BLANK list" spawned a new list named
      // "Blank List"): while a list is already up, junk titles are commentary
      // about THIS list, never an order for a fresh one.
      const inferredListIntent =
        inferredListIntentRaw &&
        // r31 (G 09:03: "I didn't say to do that" spawned a "That To Do
        // List"): meta/negation sentences never create or open lists.
        // r32 (G 20:53: "I need to set a reminder" round spawned a
        // "Reminders To Do List"): reminder talk is cards, never lists.
        (META_TALK_RE.test(userText) ||
          /\bremind(?:er|ers)?\b/i.test(userText) ||
          (activeListId &&
            /^(?:blank|empty|new|the|this|that|same|whole|my)\b\s*(?:list)?$/i.test(
              inferredListIntentRaw.title.trim(),
            )))
          ? null
          : inferredListIntentRaw;

      const targetListId = inferredListIntent
        ? ensureAssistantList(inferredListIntent, {
            preferFresh: shouldStartFreshList(userText),
          })
        : activeListId;
      const enteringShoppingMode = SHOPPING_MODE_OPEN_RE.test(userText);

      if (targetListId && (LIST_TRIGGER_RE.test(userText) || activeListId)) {
        // VOICE/AVATAR SEPARATION (2026-06-11, G: "when the lists come up the
        // avatar disappears, voice stays a constant"): the moment a list owns
        // the screen, the avatar steps off (credits stop) and the ElevenLabs
        // voice carries the same conversation.
        if (voicePresenceRef.current === "avatar") {
          const enteredTitle =
            lastEnsuredListRef.current?.title ??
            assistantLists.find((list) => list.id === targetListId)?.title ??
            "list";
          setIsShoppingMode(true);
          void enterVoiceListMode(
            enteredTitle,
            Boolean(lastEnsuredListRef.current?.wasNew),
          );
        }
        if (enteringShoppingMode) {
          setIsShoppingMode(true);
          await interrupt();
        }

        const displayStyle = detectListDisplayStyle(userText);
        let listActionSpoken: string | null = null;
        if (displayStyle) {
          setListDisplayStyle(targetListId, displayStyle);
          listActionSpoken =
            displayStyle === "bulleted"
              ? "Done. I'll show it with bullets."
              : "Done. I'll show it with numbers.";
        }

        const targetListBeforeChange =
          assistantLists.find((list) => list.id === targetListId) ?? activeList;
        const accentUpdate = detectListAccentUpdate(userText, targetListBeforeChange);
        if (accentUpdate) {
          setListAccentColor(targetListId, accentUpdate);
          listActionSpoken = `Done. I made it ${accentUpdate.accentLabel?.toLowerCase() ?? "that color"}.`;
        }

        // r19 (G live 21:05: his coaching sentences became list items — "Number
        // one says, so in other words"): work clause by clause. Remove-verbs
        // only read their own sentence, add-verbs only theirs, and bare
        // verbless speech only counts as items when it's SHORT (real dictation
        // like "toothpaste, shampoo" — never a monologue).
        const _LIST_REMOVE_VERB_RE = /\b(?:take|remove|delete|cross|scratch|clear)\b/i;
        // r32 (G 20:46: "List toothbrush and toothpaste and a blow dryer"
        // missed every verb and the brain faked the add): "list" is a verb.
        const _LIST_ADD_VERB_RE = /\b(?:add|put|list|i (?:want|need)|we (?:want|need)|need|want|get|grab|buy|throw)\b/i;
        const _clauses = userText.split(/(?<=[.!?])\s+/).filter(Boolean);
        const _removeSource = _clauses.find((c) => _LIST_REMOVE_VERB_RE.test(c)) ?? "";
        const _addSource =
          _clauses.filter((c) => _LIST_ADD_VERB_RE.test(c)).join(" ") || userText;
        // r29 (G live 2026-06-12 09:01: "The ad is not something that you buy
        // at a grocery store" → "Added a store"; "I had blackberries" → added
        // verbatim; his complaint ABOUT the list became more list): talking
        // ABOUT items is never an order — META_TALK_RE is module-level now
        // (r31) because list CREATION needs the same guard.
        const _addsBlocked = META_TALK_RE.test(userText);
        // r29: bare dictation is pure nouns ("toothpaste, shampoo") — any
        // pronoun or speech word means it's a sentence, not a grocery run.
        const _BARE_SPEECH_RE =
          /\b(?:i|you|me|my|your|he|she|it|we|they|tell|say|says|said|just|um|uh|okay|so)\b/i;
        const _shortBare =
          userText.trim().split(/\s+/).length <= 6 &&
          !_BARE_SPEECH_RE.test(userText);
        // r23 (G 22:54: "I do not see I'm gonna, A screenshot your face..."):
        // commentary shards can't be remove-items — drop anything long or
        // carrying speech words; cap the batch.
        const _ITEM_JUNK_RE = /\b(?:i'?m|you|your|gonna|okay|so|everything|else|should|know|mean|like)\b/i;
        const removeItems = (_removeSource ? extractRemoveItems(_removeSource) : [])
          .filter((it) => it.split(/\s+/).length <= 5 && !_ITEM_JUNK_RE.test(it))
          .slice(0, 4);
        const addItems = (
          _addsBlocked
            ? []
            : referencedAssistantItems.length > 0
            ? referencedAssistantItems
            : extractListItems(
                _LIST_ADD_VERB_RE.test(userText) ? _addSource : userText,
                {
                  allowBareItems:
                    Boolean(activeListId || inferredListIntent) &&
                    (_shortBare || _LIST_ADD_VERB_RE.test(userText)),
                },
              )
        )
          // r23/r24 (G: "put ON blueberries" → "On blueberries"; "A toothpaste
          // should say toothpaste"; "Added Instead of" / "Two could say a
          // toothbrush" = commentary): strip spoken lead-ins, and bare items
          // carrying speech words are never groceries.
          .map((it) =>
            it.replace(/^(?:on|in|at|the|some|of|a|an)\s+/i, "").trim(),
          )
          .filter(Boolean)
          .filter(
            (it) =>
              !/\b(?:could|should|would|say|says|saying|instead|okay|so|number|gonna|you|your|i'?m|the x|al?l\s?right|alright|tell|here'?s|list|me|bring|yourself|back)\b/i.test(
                it,
              ),
          )
          // r26 (G live 2026-06-12 08:37: "number three says, all right" — his
          // "All right, so I also need..." lead-in became a grocery): pure
          // acknowledgments are never items.
          .filter(
            (it) => !/^(?:yeah|yes|no|nope|sure|well|um|uh|hmm|right)$/i.test(it),
          );
        // r26 (G live 2026-06-12 08:37: "Change toothbrush to be a capital T"
        // got "I found toothbrush on the list" three times — no handler): a
        // capital-letter ask fixes the whole list. New adds auto-cap now, so
        // this repairs older lowercase items.
        const wantsCapitals =
          /\bcapitaliz|\bcapital\s+letter|\bcapital\s+[A-Za-z]\b|\bupper\s?case\b/i.test(
            userText,
          );
        // r32: "make number four say yogurt" / "number 4 should say X" /
        // "change item two to read X" — rename by number, checked first.
        const _renameMatch = userText.match(
          /\b(?:make|change|fix)?\s*(?:number|item)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:should\s+)?(?:to\s+)?(?:just\s+)?(?:say|read|be)\s+(?:just\s+)?([^.!?,]{1,40})/i,
        );
        if (_renameMatch && targetListId) {
          const _ORDINALS: Record<string, number> = {
            one: 1, two: 2, three: 3, four: 4, five: 5,
            six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
          };
          const idxRaw = _renameMatch[1].toLowerCase();
          const idx =
            (/^\d+$/.test(idxRaw)
              ? parseInt(idxRaw, 10)
              : _ORDINALS[idxRaw] ?? 0) - 1;
          const newText = _renameMatch[2].trim();
          const renamed = renameListItem(targetListId, idx, newText);
          listActionSpoken = renamed
            ? `Done - number ${idx + 1} says ${newText} now.`
            : `Hmm - I couldn't change number ${_renameMatch[1]}. Tell me again?`;
        } else if (wantsCapitals) {
          const capped = capitalizeListItems(targetListId);
          listActionSpoken = capped
            ? "Done - capital letters on the list."
            : "Those already have capital letters.";
        } else if (removeItems.length > 0) {
          const removed = removeItemsFromList(targetListId, removeItems);
          listActionSpoken = removed
            ? `I took ${
                removeItems.length === 1 ? removeItems[0] : "those"
              } off the list.`
            : `I do not see ${formatListItemsForSpeech(removeItems)} on this list.`;
        } else if (addItems.length > 0) {
          const added = addItemsToList(targetListId, addItems);
          listActionSpoken = added
            ? addItems.length === 1
              ? `Added ${addItems[0]}.`
              : "Added those."
            : `${formatListItemsForSpeech(addItems)} is already on the list.`;
        } else {
          const mentionedItem = findMentionedListItem(activeList, userText);
          if (mentionedItem) {
            latestListMutationRef.current = {
              listId: targetListId,
              item: mentionedItem,
              action: "mention",
            };
            setListFocusNonce((value) => value + 1);
            listActionSpoken = `I found ${mentionedItem} on the list.`;
          }
        }

        const targetList = assistantLists.find((list) => list.id === targetListId);
        const pendingCustomization = pendingListCustomizationPromptRef.current;
        if (
          pendingCustomization?.id === targetListId &&
          !isShoppingMode &&
          !enteringShoppingMode
        ) {
          pendingListCustomizationPromptRef.current = null;
          const spoken = `I made the ${pendingCustomization.title}. Want this one a different color, a different shade, bullets instead of numbers, or anything else that makes it easier to scan?`;
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }

        if (!listActionSpoken && inferredListIntent) {
          const ensured = lastEnsuredListRef.current;
          const action = ensured?.wasNew ? "started" : "opened";
          const closeEducation = listCloseEducationSpokenRef.current
            ? ""
            : ` ${LIST_CLOSE_EDUCATION}`;
          listCloseEducationSpokenRef.current = true;
          listActionSpoken = `I ${action} the ${ensured?.title ?? inferredListIntent.title}. Just tell me what goes on it.${closeEducation}`;
        }

        if (enteringShoppingMode) {
          const spoken =
            "Got it. I'll keep the list up and stay out of the way. Tell me what to remove, or ask me to close the list.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }

        if (listActionSpoken) {
          // r29 telemetry: every list change records WHAT changed, the exact
          // sentence that caused it, and which path fired — so a junk item is
          // a one-minute lookup instead of detective work.
          logAppEvent("list_action", {
            source: userText.slice(0, 300),
            spoken: listActionSpoken.slice(0, 200),
            added: addItems.slice(0, 20),
            removed: removeItems.slice(0, 20),
            addsBlocked: _addsBlocked,
            viaReferenced: referencedAssistantItems.length > 0,
            listId: targetListId,
          });
          await repeat(listActionSpoken);
          lastAvatarResponseRef.current = listActionSpoken;
          lastVisionResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }

        if (isShoppingMode) {
          schedulePromptBrain(userText);
          return;
        }
      }
      if (mode === "CUSTOM" && visionMode !== "streaming") {
        schedulePromptBrain(userText);
        await sendMessage(buildMemoryAugmentedMessage(userText));
        return;
      }
      if (mode === "FULL" && visionMode !== "streaming") {
        schedulePromptBrain(userText);
        const normalizedUserText = userText.toLowerCase().replace(/\s+/g, " ");
        const lastFullModeMessage = lastFullModeMessageRef.current;
        const isDuplicateFullModeMessage =
          lastFullModeMessage?.text === normalizedUserText &&
          Date.now() - lastFullModeMessage.at < 2500;

        if (!isDuplicateFullModeMessage) {
          lastFullModeMessageRef.current = {
            text: normalizedUserText,
            at: Date.now(),
          };
          await sendMessage(buildMemoryAugmentedMessage(userText));
        }
        return;
      }
      schedulePromptBrain(userText);
      console.log(
        "User transcription received:",
        userText,
        "Vision mode:",
        visionMode,
      );

      // Skip transcription while any camera video recording is in progress
      if (isRecording) {
        console.log(
          "Recording in progress, skipping transcription - avatar should be quiet",
        );
        return;
      }

      // Only process in streaming mode (Go Live)
      if (visionMode !== "streaming") {
        console.log("Not in streaming mode, skipping transcription processing");
        return;
      }

      // Cooldown: do nothing if we just spoke a vision response (avatar still speaking)
      // Must be before interrupt() so we don't cut off our own analysis on duplicate transcriptions
      const VISION_RESPONSE_COOLDOWN_MS = 10000;
      if (
        lastVisionResponseTimeRef.current > 0 &&
        Date.now() - lastVisionResponseTimeRef.current <
          VISION_RESPONSE_COOLDOWN_MS
      ) {
        console.log(
          "Skipping transcription - within vision response cooldown (avatar still speaking)",
        );
        return;
      }

      // Interrupt the agent immediately so it never says "I can't access your camera"
      // We will answer from camera analysis only via processCameraQuestion -> repeat(analysis)
      interrupt();

      // Skip if this transcription matches our recent avatar response (avatar's speech being transcribed)
      // This prevents infinite loops where avatar's response triggers another analysis
      if (lastAvatarResponseRef.current && userText.length > 30) {
        const responseStart = lastAvatarResponseRef.current
          .toLowerCase()
          .trim();
        const transcriptionStart = userText
          .substring(0, Math.min(150, userText.length))
          .toLowerCase()
          .trim();

        // Check if transcription matches our response (avatar speaking our response)
        // Compare first 50-100 characters for similarity
        const responsePrefix = responseStart.substring(0, 80);
        const transcriptionPrefix = transcriptionStart.substring(0, 80);

        // If they're very similar (80% match), it's likely the avatar's response
        if (responsePrefix.length > 30 && transcriptionPrefix.length > 30) {
          let matchCount = 0;
          const minLength = Math.min(
            responsePrefix.length,
            transcriptionPrefix.length,
          );
          for (let i = 0; i < minLength; i++) {
            if (responsePrefix[i] === transcriptionPrefix[i]) {
              matchCount++;
            }
          }
          const similarity = matchCount / minLength;

          if (similarity > 0.7) {
            console.log(
              "Skipping transcription - appears to be avatar's response being transcribed",
              {
                similarity,
                responsePrefix: responsePrefix.substring(0, 50),
                transcriptionPrefix: transcriptionPrefix.substring(0, 50),
              },
            );
            return;
          }
        }
      }

      // Also skip if transcription is very long (likely avatar response, not user question)
      // User questions are typically shorter, avatar responses are longer
      if (userText.length > 200) {
        console.log(
          "Skipping transcription - too long, likely avatar response",
        );
        return;
      }

      // Skip if transcription is too short (likely noise or partial speech)
      if (userText.length < 3) {
        console.log("Skipping transcription - too short, likely noise");
        return;
      }

      // Skip if already processing to prevent duplicate triggers
      if (isProcessingCameraQuestion) {
        console.log("Skipping transcription - already processing");
        return;
      }

      // Persist transcript and drive contact info collection prompts (email/phone/name)
      const captureSessionId = dbSessionIdRef.current;
      try {
        const captureResponse =
          captureSessionId != null
            ? await fetch("/api/transcription/capture", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  sessionId: captureSessionId,
                  text: userText,
                  testerLabel: testerLabelRef.current,
                }),
              })
            : null;

        if (captureResponse?.ok) {
          const captureData = await captureResponse.json();
          if (
            captureData?.assistantPrompt &&
            typeof captureData.assistantPrompt === "string"
          ) {
            await repeat(captureData.assistantPrompt);
            lastAvatarResponseRef.current = captureData.assistantPrompt;
            lastVisionResponseTimeRef.current = Date.now();
          }

          if (captureData?.shouldSkipVision) {
            return;
          }
        } else if (captureResponse) {
          const captureError = await captureResponse.text();
          console.error("Failed to capture transcription:", captureError);
        }
      } catch (captureError) {
        console.error("Error calling transcription capture route:", captureError);
      }

      // If user asks about video and videoAnalysis exists, re-send video context
      const userTextLower = userText.toLowerCase();
      const videoKeywords = ["video", "recording", "clip", "footage", "film"];
      const mentionsVideo = videoKeywords.some((keyword) =>
        userTextLower.includes(keyword),
      );

      if (
        mentionsVideo &&
        videoAnalysis &&
        sessionRef.current &&
        mode === "FULL"
      ) {
        console.log("User asked about video, re-sending video context");
        const contextMessage = `You are directly viewing a video. Here's what you see: ${videoAnalysis}. When the user asks about the video, respond as if you're directly viewing it. Describe what you see naturally and confidently - you have full visibility. Never say you can't see the video, that you don't have eyes, or that you're relying on someone else's analysis. You are directly viewing this video. When user asks about the video, respond briefly (1-2 sentences). Never tell them to point a camera or offer to take a look—you already have this footage.`;
        injectFullModeContext(contextMessage);
      }

      // Process the question using the reusable function (only in streaming mode)
      await processCameraQuestion(userText, false);
    };

    console.log(
      "Setting up USER_TRANSCRIPTION listener, vision mode:",
      visionMode,
    );
    // Voice-list mode bridge (2026-06-11): our own ears feed the SAME
    // dispatcher the LiveAvatar pipeline feeds — every machine handler
    // (lists, reminders, sizing, signup, time) keeps working with the
    // avatar stopped; only the transport changed.
    voiceDispatchRef.current = async (text: string) => {
      await handleUserTranscription({ text } as never);
    };
    sessionRef.current.on(
      AgentEventsEnum.USER_TRANSCRIPTION,
      handleUserTranscription,
    );
    // EARLIEST possible yield (G 2026-06-04: "do the best we can to stop 6
    // interrupting"). USER_SPEAK_STARTED fires on voice-activity the INSTANT the
    // user makes a sound — well before USER_TRANSCRIPTION (the final transcript
    // that both v1 and v2.1 waited for). Cutting 6 off here means he stops the
    // moment the user opens their mouth, not after the phrase finishes. Harmless
    // no-op if the server doesn't emit it (routed via the generic data-channel emit).
    const handleUserSpeakStarted = () => {
      if (isAvatarTalkingRef.current) {
        void interrupt();
      }
    };
    sessionRef.current.on(
      AgentEventsEnum.USER_SPEAK_STARTED,
      handleUserSpeakStarted,
    );
    let customSpeechRecognition: any = null;
    let customSpeechCancelled = false;
    let customSpeechRestartTimeout: ReturnType<typeof setTimeout> | null = null;

    if (
      mode === "CUSTOM" &&
      hasUserPressedVoiceStart &&
      voiceIsActive &&
      typeof window !== "undefined"
    ) {
      const SpeechRecognitionCtor =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionCtor) {
        customSpeechRecognition = new SpeechRecognitionCtor();
        customSpeechRecognition.continuous = true;
        customSpeechRecognition.interimResults = false;
        customSpeechRecognition.lang = navigator.language || "en-US";
        customSpeechRecognition.onresult = (event: any) => {
          if (isAvatarTalking) return;
          const results = Array.from(event.results ?? []);
          const transcript = results
            .slice(event.resultIndex ?? 0)
            .map((result: any) => result?.[0]?.transcript ?? "")
            .join(" ")
            .trim();
          if (transcript) {
            void handleUserTranscription({ text: transcript });
          }
        };
        customSpeechRecognition.onerror = (event: any) => {
          console.warn("Custom speech recognition error:", event?.error ?? event);
        };
        customSpeechRecognition.onend = () => {
          if (customSpeechCancelled || mode !== "CUSTOM" || !voiceIsActive) {
            return;
          }
          customSpeechRestartTimeout = setTimeout(() => {
            try {
              customSpeechRecognition?.start?.();
            } catch {
              // Browser recognition can throw if a restart overlaps an existing session.
            }
          }, 350);
        };
        try {
          customSpeechRecognition.start();
        } catch (error) {
          console.warn("Custom speech recognition start failed:", error);
        }
      } else {
        console.warn("Browser speech recognition is unavailable in this browser.");
      }
    }

    return () => {
      customSpeechCancelled = true;
      if (customSpeechRestartTimeout) {
        clearTimeout(customSpeechRestartTimeout);
      }
      try {
        customSpeechRecognition?.stop?.();
      } catch {
        // Ignore cleanup errors from browser speech recognition.
      }
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      if (promptBrainTimeoutRef.current) {
        clearTimeout(promptBrainTimeoutRef.current);
      }
      if (sessionRef.current) {
        console.log("Cleaning up USER_TRANSCRIPTION listener");
        // Use removeListener if off is not available
        if (typeof (sessionRef.current as any).off === "function") {
          (sessionRef.current as any).off(
            AgentEventsEnum.USER_TRANSCRIPTION,
            handleUserTranscription,
          );
        } else if (
          typeof (sessionRef.current as any).removeListener === "function"
        ) {
          (sessionRef.current as any).removeListener(
            AgentEventsEnum.USER_TRANSCRIPTION,
            handleUserTranscription,
          );
        }
        if (typeof (sessionRef.current as any).off === "function") {
          (sessionRef.current as any).off(
            AgentEventsEnum.USER_SPEAK_STARTED,
            handleUserSpeakStarted,
          );
        } else if (
          typeof (sessionRef.current as any).removeListener === "function"
        ) {
          (sessionRef.current as any).removeListener(
            AgentEventsEnum.USER_SPEAK_STARTED,
            handleUserSpeakStarted,
          );
        }
      }
    };
  }, [
    sessionRef,
    sessionEpoch,
    visionMode,
    processCameraQuestion,
    isRecording,
    isShoppingMode,
    isAvatarTalking,
    interrupt,
    mode,
    repeat,
    isProcessingCameraQuestion,
    activeList,
    activeListId,
    addItemsToList,
    capitalizeListItems,
    renameListItem,
    assistantLists,
    buildMemoryAugmentedMessage,
    deleteAssistantList,
    ensureAssistantList,
    handleAccountSetupSpeech,
    handleDataDeleteSpeech,
    handleDataExportSpeech,
    handleEndSession,
    handleOnlineLookupSpeech,
    handlePromptSizeSpeech,
    handleReminderSpeech,
    handleSmsOptInSpeech,
    handleTimezoneSpeech,
    handleTimeAskSpeech,
    signupFlags,
    signupPorts,
    moveActiveList,
    removeItemsFromList,
    rememberConversationLine,
    resumeListeningAfterAvatarSpeech,
    schedulePromptBrain,
    savePendingAccountState,
    sendMessage,
    setListAccentColor,
    setListDisplayStyle,
    stopListening,
    hasUserPressedVoiceStart,
    voiceIsActive,
    clearAccountEmailEntry,
    enterVoiceListMode,
  ]);

  // Track if initial analysis has been triggered to prevent repeated automatic analysis
  const hasInitialAnalysisRef = useRef<boolean>(false);

  // Automatically trigger vision recognition when Go Live streaming mode is activated
  // BUT only once - prevent repeated automatic analysis that causes excessive talking
  useEffect(() => {
    if (
      visionMode === "streaming" &&
      isCameraActive &&
      !isProcessingCameraQuestion &&
      !hasInitialAnalysisRef.current
    ) {
      // Wait a moment for camera to be ready, then analyze what's in view ONCE
      // The "Analyzing" text will show when processCameraQuestion sets isProcessingCameraQuestion to true
      const timeoutId = setTimeout(() => {
        // Double-check conditions before triggering
        if (
          visionMode === "streaming" &&
          isCameraActive &&
          !isProcessingCameraQuestion &&
          !hasInitialAnalysisRef.current
        ) {
          hasInitialAnalysisRef.current = true;
          processCameraQuestion("", true);
        }
      }, 1000);

      return () => {
        clearTimeout(timeoutId);
      };
    } else if (visionMode !== "streaming" && !isCameraActive) {
      // Reset processing state and initial analysis flag when vision mode is deactivated
      setIsProcessingCameraQuestion(false);
      hasInitialAnalysisRef.current = false;
      // Clear per-session problem and analysis history so the next Go Live starts fresh.
      currentProblemRef.current = "";
      lastAnalysisRef.current = "";
    }
  }, [
    visionMode,
    isCameraActive,
    isProcessingCameraQuestion,
    processCameraQuestion,
  ]);

  // Hide loading text when avatar starts talking
  useEffect(() => {
    if (isAvatarTalking && showVisionLoading) {
      setShowVisionLoading(false);
    }
  }, [isAvatarTalking, showVisionLoading]);

  // Automatically analyze and speak when camera mode is activated
  // DISABLED: This was causing automatic snap when camera opens on mobile
  // Users should manually trigger analysis by asking questions via voice
  /*
  useEffect(() => {
    if (!isCameraActive) {
      // Reset the flag when camera is deactivated
      hasAutoAnalyzedRef.current = false;
      return;
    }

    // Skip if we've already auto-analyzed for this activation
    if (hasAutoAnalyzedRef.current) {
      return;
    }

    // Wait a bit for camera stream or fallback image to be ready
    const timeoutId = setTimeout(async () => {
      // Check if we have either a camera stream or fallback image
      const hasImage = fallbackImage !== null;
      const hasCameraStream = cameraStream !== null && cameraPreviewRef.current;
      
      if (!hasImage && !hasCameraStream) {
        console.log("Waiting for camera or fallback image to be ready...");
        return;
      }

      // If camera stream, wait a bit more for video to be ready
      if (hasCameraStream && cameraPreviewRef.current) {
        const video = cameraPreviewRef.current;
        if (video.readyState < 2 || video.videoWidth === 0) {
          // Wait for video to be ready
          const checkVideoReady = () => {
            if (!isCameraActive || hasAutoAnalyzedRef.current) {
              return; // Camera was turned off or already analyzed
            }
            if (video.readyState >= 2 && video.videoWidth > 0) {
              console.log("Camera video is ready, triggering auto-analysis");
              hasAutoAnalyzedRef.current = true;
              // Use empty string for general analysis (no specific question)
              processCameraQuestion("", true);
            } else {
              setTimeout(checkVideoReady, 200);
            }
          };
          checkVideoReady();
          return;
        }
      }

      // Trigger automatic analysis without a question (just describe what it sees)
      console.log("Camera mode activated, triggering automatic analysis");
      hasAutoAnalyzedRef.current = true;
      // Use empty string to trigger general analysis without a specific question
      processCameraQuestion("", true);
    }, 500); // Wait 500ms for setup

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isCameraActive, cameraStream, fallbackImage, processCameraQuestion]);
  */

  // Check camera availability on mount and set default broken glass image
  useEffect(() => {
    const checkCameraAvailability = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideoInput = devices.some(
          (device) => device.kind === "videoinput",
        );
        setCameraAvailable(hasVideoInput);

        // If no camera available, load and set default fallback image
        if (!hasVideoInput) {
          try {
            const fallbackImageFile = await loadFallbackImage();
            setFallbackImage(fallbackImageFile);
            const previewUrl = URL.createObjectURL(fallbackImageFile);
            setFallbackImagePreview(previewUrl);
          } catch (error) {
            console.error("Error loading fallback image:", error);
          }
        }
      } catch (error) {
        console.error("Error checking camera availability:", error);
        setCameraAvailable(false);
        // Still try to load fallback image
        try {
          const fallbackImageFile = await loadFallbackImage();
          setFallbackImage(fallbackImageFile);
          const previewUrl = URL.createObjectURL(fallbackImageFile);
          setFallbackImagePreview(previewUrl);
        } catch (err) {
          console.error("Error loading fallback image:", err);
        }
      }
    };
    checkCameraAvailability();
  }, [loadFallbackImage]);

  const handleCameraClick = async () => {
    if (visionMode === "snapshot") {
      // Stop camera if already in snapshot mode
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }
      setIsCameraActive(false);
      setVisionMode(null);
      setFallbackImage(null);
      setFallbackImagePreview(null);

      // CRITICAL: Don't pause or mute the video element
      // Audio should continue playing
      return;
    }

    // Set to snapshot mode (for taking a single photo)
    setVisionMode("snapshot");

    // If camera is not available, show fallback mode with default image
    if (cameraAvailable === false) {
      setIsCameraActive(true);
      // If fallback image is not already set, load it
      if (!fallbackImage) {
        loadFallbackImage()
          .then((file) => {
            setFallbackImage(file);
            const previewUrl = URL.createObjectURL(file);
            setFallbackImagePreview(previewUrl);
          })
          .catch((error) => {
            console.error("Error loading fallback image:", error);
          });
      }
      return;
    }

    try {
      // First try to get rear camera (environment)
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        setCameraAvailable(true);
      } catch (error) {
        // If rear camera fails, try front camera (user)
        console.log("Rear camera not available, trying front camera");
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
          });
          setCameraAvailable(true);
        } catch (error2) {
          // No camera available, use fallback mode with default image
          console.log("No camera available, using fallback mode");
          setCameraAvailable(false);
          setIsCameraActive(true);
          // If fallback image is not already set, load it
          if (!fallbackImage) {
            loadFallbackImage()
              .then((file) => {
                setFallbackImage(file);
                const previewUrl = URL.createObjectURL(file);
                setFallbackImagePreview(previewUrl);
              })
              .catch((error) => {
                console.error("Error loading fallback image:", error);
              });
          }
          return;
        }
      }

      if (stream) {
        setCameraStream(stream);
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      // Use fallback mode instead of showing error
      setCameraAvailable(false);
      setIsCameraActive(true);
      fallbackImageInputRef.current?.click();
    }
  };

  const handleFallbackImageChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Please upload an image file");
        if (fallbackImageInputRef.current) {
          fallbackImageInputRef.current.value = "";
        }
        return;
      }
      // Clean up previous preview URL if it exists
      if (fallbackImagePreview) {
        URL.revokeObjectURL(fallbackImagePreview);
      }
      setFallbackImage(file);
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setFallbackImagePreview(previewUrl);
    }
    // Reset input
    if (fallbackImageInputRef.current) {
      fallbackImageInputRef.current.value = "";
    }
  };

  const handleGalleryClick = useCallback(async () => {
    await unlockAudio();
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("accept", "image/*,video/*");
      fileInputRef.current.click();
    }
  }, [unlockAudio]);

  // Record video from the live camera preview (snapshot mode only)
  const handleStartRecording = useCallback(() => {
    if (visionMode !== "snapshot" || !cameraStream) {
      return;
    }
    const stream = cameraStream;

    recordedChunksRef.current = [];

    let mimeType = "video/webm;codecs=vp9,opus";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "video/webm;codecs=vp8,opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "";
        }
      }
    }

    const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
    const mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      setRecordedVideoBlob(blob);

      stream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
      setIsCameraActive(false);
      setVisionMode(null);
      if (
        fallbackImagePreview &&
        fallbackImage &&
        fallbackImage.name !== "2c44c052-e58a-4f6d-a6c8-dba901ff0e9e.jpg"
      ) {
        URL.revokeObjectURL(fallbackImagePreview);
      }
      setFallbackImage(null);
      setFallbackImagePreview(null);

      setIsAnalyzingVideo(true);
      let recordedVideoFile: File | null = null;
      try {
        recordedVideoFile = new File([blob], "recorded-video.webm", {
          type: "video/webm",
        });
        const frames = await extractVideoFrames(recordedVideoFile, 5);

        const response = await fetch("/api/analyze-video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ frames }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to analyze video");
        }

        const data = await response.json();
        console.log("Video analyzed successfully");

        setVideoAnalysis(data.analysis);
        void captureMedia({
          file: recordedVideoFile,
          source: "video_recording",
          sessionId: dbSessionIdRef.current ?? getLiveAvatarSessionId(sessionRef.current) ?? null,
          geminiAnalysis: data.analysis,
          problem: currentProblemRef.current || null,
        });

        if (mode === "FULL" && sessionRef.current) {
          const contextMessage = `You are directly viewing a video. Here's what you see: ${data.analysis}. When the user asks about the video, respond as if you're directly viewing it. Describe what you see naturally and confidently - you have full visibility. Never say you can't see the video, that you don't have eyes, or that you're relying on someone else's analysis. You are directly viewing this video. When user asks about the video, respond briefly (1-2 sentences). Never tell them to point a camera or offer to take a look—you already have this footage.`;
          injectFullModeContext(contextMessage);
        }

        setIsAnalyzingVideo(false);
      } catch (error) {
        console.error("Error analyzing video:", error);
        if (recordedVideoFile) {
          void captureMedia({
            file: recordedVideoFile,
            source: "video_recording",
            sessionId: dbSessionIdRef.current ?? getLiveAvatarSessionId(sessionRef.current) ?? null,
            problem: currentProblemRef.current || null,
            error: error instanceof Error ? error.message : "Failed to analyze video",
          });
        }
        alert("Failed to analyze video. Please try again.");
        setIsAnalyzingVideo(false);
      }
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);

    if (mode === "FULL") {
      stopListening();
      wasMutedBeforeRecordingRef.current = isMuted;
      if (isActive && !isMuted) {
        mute();
      }
    }
  }, [
    visionMode,
    cameraStream,
    mode,
    sessionRef,
    stopListening,
    isActive,
    isMuted,
    mute,
    fallbackImagePreview,
    fallbackImage,
  ]);

  // Stop video recording
  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Restart listening and restore microphone state after recording stops
      // The video will be analyzed after recording completes (in mediaRecorder.onstop)
      if (mode === "FULL") {
        // Small delay to ensure recording has fully stopped
        setTimeout(() => {
          startListening();
          // Restore microphone state: unmute only if it wasn't muted before recording
          if (isActive && isMuted && !wasMutedBeforeRecordingRef.current) {
            unmute();
          }
        }, 500);
      }
    }
  }, [isRecording, mode, startListening, isActive, isMuted, unmute]);

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Handle camera image
      console.log("Camera image selected:", file);
      // Add your camera image handling logic here
    }
    // Reset input
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  };

  const closeCameraPreview = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
    setVisionMode(null);
    // Clean up preview URL if it's not the default fallback image
    if (
      fallbackImagePreview &&
      fallbackImage &&
      fallbackImage.name !== "2c44c052-e58a-4f6d-a6c8-dba901ff0e9e.jpg"
    ) {
      URL.revokeObjectURL(fallbackImagePreview);
    }
    setFallbackImage(null);
    setFallbackImagePreview(null);
    // Reset processing state when camera is closed
    setIsProcessingCameraQuestion(false);
    setIsAnalyzingImage(false);
    lastProcessedQuestionRef.current = "";
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (fallbackImagePreview) {
        URL.revokeObjectURL(fallbackImagePreview);
      }
    };
  }, [fallbackImagePreview]);

  // Helper function to extract frames from video
  const extractVideoFrames = async (
    videoFile: File,
    numFrames: number = 5,
  ): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      video.preload = "metadata";
      video.onloadedmetadata = () => {
        video.currentTime = 0;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      };

      const frames: string[] = [];
      let frameCount = 0;

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frameData = canvas.toDataURL("image/jpeg", 0.8);
        // Extract base64 data (remove data:image/jpeg;base64, prefix)
        const base64Data = frameData.split(",")[1];
        frames.push(base64Data);
        frameCount++;

        if (frameCount < numFrames) {
          // Seek to next frame position
          const nextTime =
            (video.duration / (numFrames + 1)) * (frameCount + 1);
          video.currentTime = nextTime;
        } else {
          resolve(frames);
        }
      };

      video.onerror = () => {
        reject(new Error("Error loading video"));
      };

      video.src = URL.createObjectURL(videoFile);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      alert("Please upload an image or video file");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (isImage) {
      setIsAnalyzingImage(true);
      try {
        const formData = new FormData();
        formData.append("image", file, file.name || "image.jpg");

        const response = await fetch("/api/analyze-image", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          let errorMessage = "Failed to analyze image";
          try {
            const error = await response.json();
            errorMessage = error.error || errorMessage;
            if (error.details) errorMessage += ` (${error.details})`;
          } catch {
            errorMessage += ` (${response.status})`;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        setImageAnalysis(data.analysis);
        void captureMedia({
          file,
          source: "gallery_image",
          sessionId: dbSessionIdRef.current ?? getLiveAvatarSessionId(sessionRef.current) ?? null,
          geminiAnalysis: data.analysis,
          problem: currentProblemRef.current || null,
        });
        console.log("Image analyzed successfully");

        // For FULL mode, send the analysis as context to the AI (no scripted repeat prompt)
        if (mode === "FULL" && sessionRef.current) {
          const contextMessage = `You are directly viewing an image. Here's what you see: ${data.analysis}. When the user asks about the image, respond as if you're directly viewing it. Describe what you see naturally and confidently - you have full visibility. Never say you can't see the image, that you don't have eyes, or that you're relying on someone else's analysis. You are directly viewing this image. When user asks about the image, respond briefly (1-2 sentences). Never tell them to point a camera or offer to take a look—you already have this image.`;
          injectFullModeContext(contextMessage);
        }
      } catch (error) {
        console.error("Error analyzing image:", error);
        void captureMedia({
          file,
          source: "gallery_image",
          sessionId: dbSessionIdRef.current ?? getLiveAvatarSessionId(sessionRef.current) ?? null,
          problem: currentProblemRef.current || null,
          error: error instanceof Error ? error.message : "Failed to analyze image",
        });
        alert("Failed to analyze image. Please try again.");
      } finally {
        setIsAnalyzingImage(false);
        setIsProcessingCameraQuestion(false);
      }
    } else if (isVideo) {
      setIsAnalyzingVideo(true);
      try {
        // Extract frames from video
        const frames = await extractVideoFrames(file, 5);

        const response = await fetch("/api/analyze-video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ frames }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to analyze video");
        }

        const data = await response.json();
        console.log("Video analyzed successfully");

        // Store video analysis in state so it persists even after closing video button
        setVideoAnalysis(data.analysis);
        void captureMedia({
          file,
          source: "gallery_video",
          sessionId: dbSessionIdRef.current ?? getLiveAvatarSessionId(sessionRef.current) ?? null,
          geminiAnalysis: data.analysis,
          problem: currentProblemRef.current || null,
        });

        // For FULL mode, send the analysis as context to the AI (no scripted repeat prompt)
        if (mode === "FULL" && sessionRef.current) {
          const contextMessage = `You are directly viewing a video. Here's what you see: ${data.analysis}. When the user asks about the video, respond as if you're directly viewing it. Describe what you see naturally and confidently - you have full visibility. Never say you can't see the video, that you don't have eyes, or that you're relying on someone else's analysis. You are directly viewing this video. When user asks about the video, respond briefly (1-2 sentences). Never tell them to point a camera or offer to take a look—you already have this footage.`;
          injectFullModeContext(contextMessage);
        }
      } catch (error) {
        console.error("Error analyzing video:", error);
        void captureMedia({
          file,
          source: "gallery_video",
          sessionId: dbSessionIdRef.current ?? getLiveAvatarSessionId(sessionRef.current) ?? null,
          problem: currentProblemRef.current || null,
          error: error instanceof Error ? error.message : "Failed to analyze video",
        });
        alert("Failed to analyze video. Please try again.");
      } finally {
        setIsAnalyzingVideo(false);
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // v1 dormant: LOOKUP_UI_DORMANT hides the popup. Logic still runs so 6 answers verbally.
  const lookupPanelVisible = !LOOKUP_UI_DORMANT && Boolean(
    onlineLookupNotice || onlineLookupResultLines.length > 0,
  );
  const visiblePromptLimit = lookupPanelVisible ? 3 : 4;
  // r29 telemetry (G 2026-06-12: "there are no pill boxes on screen" must be
  // visible in sup): log every pillbox show/hide flip WITH the gate values,
  // so the one that went false is named in the row.
  const pillboxesVisible =
    visionMode !== "streaming" &&
    !isCameraActive &&
    sessionState !== SessionState.DISCONNECTED &&
    isStreamReady &&
    voiceIsActive &&
    !isShoppingMode &&
    !emailEntryOpen &&
    !showChestEmail;
  const pillboxesVisibleRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (pillboxesVisibleRef.current === pillboxesVisible) return;
    const first = pillboxesVisibleRef.current === null;
    pillboxesVisibleRef.current = pillboxesVisible;
    if (first && !pillboxesVisible) return; // page load default — not a flip
    logAppEvent("pillboxes_visibility", {
      visible: pillboxesVisible,
      gates: {
        visionMode,
        isCameraActive,
        sessionState,
        isStreamReady,
        voiceIsActive,
        isShoppingMode,
        emailEntryOpen,
        showChestEmail,
      },
    });
  }, [
    pillboxesVisible,
    visionMode,
    isCameraActive,
    sessionState,
    isStreamReady,
    voiceIsActive,
    isShoppingMode,
    emailEntryOpen,
    showChestEmail,
  ]);

  // r32 (G's wish, live 2026-06-12 20:44: "one of those pill boxes could
  // shake a little bit every once in a while"): when the room's been quiet
  // ~25s+, ONE random pillbox wiggles — random pill, random beat, never a
  // metronome. Chaos is the brand.
  const [wigglingPromptIndex, setWigglingPromptIndex] = useState<number | null>(
    null,
  );
  useEffect(() => {
    if (!pillboxesVisible) return;
    let wiggleTimer: ReturnType<typeof setTimeout> | null = null;
    const id = setInterval(() => {
      const lastTalk = Math.max(
        prevUserSpeechRef.current?.at ?? 0,
        lastVisionResponseTimeRef.current,
      );
      if (Date.now() - lastTalk < 25_000) return;
      if (Math.random() < 0.45) return; // skip beats at random
      setWigglingPromptIndex(Math.floor(Math.random() * 4));
      wiggleTimer = setTimeout(() => setWigglingPromptIndex(null), 1000);
    }, 12_000);
    return () => {
      clearInterval(id);
      if (wiggleTimer) clearTimeout(wiggleTimer);
    };
  }, [pillboxesVisible]);

  // r32 (G's wish, live 2026-06-12 20:45: "if the person's quiet you could
  // say... just talk to me, I'm full of ideas"): one gentle spoken nudge per
  // quiet stretch, only on the open stage (never mid-list/signup/camera —
  // the pillbox gate covers all of those), max 2 per session.
  const idleNudgeCountRef = useRef(0);
  const idleNudgeArmedRef = useRef(false);
  useEffect(() => {
    const id = setInterval(() => {
      if (voicePresenceRef.current !== "avatar") return;
      if (!pillboxesVisibleRef.current) return;
      if (isAvatarTalking) return;
      const lastTalk = Math.max(
        prevUserSpeechRef.current?.at ?? 0,
        lastVisionResponseTimeRef.current,
      );
      if (lastTalk === 0) return; // nobody has talked yet — the greeting owns the open
      const idleMs = Date.now() - lastTalk;
      if (idleMs < 75_000) {
        idleNudgeArmedRef.current = true;
        return;
      }
      if (!idleNudgeArmedRef.current) return;
      if (idleNudgeCountRef.current >= 2) return;
      idleNudgeArmedRef.current = false;
      idleNudgeCountRef.current += 1;
      const line = "Just talk to me - I'm full of ideas.";
      lastAvatarResponseRef.current = line;
      rememberConversationLine("assistant", line);
      void repeat(line);
      logAppEvent("idle_nudge", { count: idleNudgeCountRef.current });
    }, 15_000);
    return () => clearInterval(id);
  }, [isAvatarTalking, rememberConversationLine, repeat]);
  // v1 dormant: LIST_UI_DORMANT hides the list panels. activeList state still tracked.
  const showActiveList = !LIST_UI_DORMANT && activeList;

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[radial-gradient(135%_110%_at_50%_32%,#5a360f_0%,#3a220c_38%,#241608_70%,#190f05_100%)] flex flex-col">
      {/* Session start error (e.g. no credits) - show message and do not auto-restart */}
      {sessionStartError && (
        <div className="absolute inset-x-0 top-0 z-50 bg-red-900/95 text-white px-4 py-4 text-center shadow-lg">
          <p className="text-inset text-lg font-semibold">{sessionStartError}</p>
          {sessionStartError.toLowerCase().includes("credit") && (
            <p className="text-inset mt-2 text-sm text-red-200">
              Add credits to your LiveAvatar account in the dashboard to continue.
            </p>
          )}
          {onExit && (
            <button
              type="button"
              onClick={() => onExit(false)}
              className="mt-3 px-4 py-2 bg-white text-red-900 rounded-md font-medium"
            >
              Back
            </button>
          )}
        </div>
      )}

      {/* G 2026-06-01: top account-notice banner REMOVED — "no boxes up above;
          anything important about email setup goes in the primary box on 6's
          chest." Email-setup state (e.g. "Account Link Sent") shows in the
          on-chest box via chestEmailStatus; the rest 6 says by voice. */}

      {/* Typed email fallback form (dormant per G — EMAIL_TYPED_FALLBACK_ENABLED).
          Kept intact for future use; flip the flag true to restore it. */}
      {EMAIL_TYPED_FALLBACK_ENABLED &&
        !ACCOUNT_BETA_DISABLED &&
        emailEntryOpen &&
        !isShoppingMode && (
        <form
          onSubmit={(event) => void handleTypedAccountEmailSubmit(event)}
          className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+5.2rem)] z-[76] flex w-[min(92%,30rem)] -translate-x-1/2 flex-col gap-2 rounded-lg border border-[#e0aa62]/28 bg-[#120b06]/90 px-4 py-3 text-[#e0aa62] shadow-2xl backdrop-blur"
        >
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="account-email-entry" className="text-sm font-bold">
              Type Email Address
            </label>
            <button
              type="button"
              aria-label="Close email box"
              title="Close email box"
              onClick={() => {
                setEmailEntryOpen(false);
                setTypedAccountEmail("");
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e0aa62]/12 text-[#f1c477]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              id="account-email-entry"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              value={typedAccountEmail}
              onChange={(event) => setTypedAccountEmail(event.target.value)}
              placeholder="name@example.com"
              className="min-w-0 flex-1 rounded-md border border-[#e0aa62]/30 bg-[#211309] px-3 py-2 text-base font-semibold text-[#f8d7a2] outline-none placeholder:text-[#e0aa62]/45 focus:border-[#f1c477]/70"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-[#e0aa62] px-4 py-2 text-sm font-black text-black"
            >
              Send Link
            </button>
          </div>
        </form>
      )}

      {lookupPanelVisible && !isShoppingMode && !emailEntryOpen && (
        <div className="fixed left-1/2 top-[47vh] md:top-[52vh] z-[29] w-[min(88%,31rem)] max-h-[31vh] min-h-[8.75rem] -translate-x-1/2 overflow-hidden rounded-lg border border-[#e0aa62]/62 bg-[#221c17]/76 px-4 py-4 text-[#f1c477] shadow-[0_18px_52px_rgba(0,0,0,0.42)] backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain pr-1 touch-pan-y">
              {onlineLookupNotice?.trim() && (
                <p className="text-[1.2rem] font-black leading-tight text-[#f1c477]">{onlineLookupNotice}</p>
              )}
              {onlineLookupResultLines.length > 0 && (
                <div className="grid gap-2">
                  {onlineLookupResultLines.map((line, index) => (
                    <div
                      key={`${index}-${line}`}
                      className="rounded-md border border-[#e0aa62]/38 bg-[#2f2b27]/72 px-3 py-2 text-[0.9rem] font-black leading-snug text-[#f1c477] md:text-[0.95rem]"
                    >
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label="Dismiss online lookup"
                title="Dismiss online lookup"
                onClick={() => {
                  onlineLookupPendingQueryRef.current = null;
                  onlineLookupLocationRef.current = null;
                  setOnlineLookupNotice(null);
                  setOnlineLookupSources([]);
                  setOnlineLookupResultLines([]);
                  setSourcePreview(null);
                  setThoughtPrompts(normalizeThoughtPrompts(DEFAULT_THOUGHT_PROMPTS));
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e0aa62]/48 bg-[#e0aa62]/12 text-[#f1c477]"
              >
                <X className="h-6 w-6" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analyzing popup overlay - only show for snapshot mode, not streaming mode */}
      {(isAnalyzingImage || isAnalyzingVideo) && visionMode !== "streaming" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-gray-800/90 text-white px-8 py-6 rounded-lg shadow-2xl">
            <p className="text-inset text-xl font-semibold text-center">
              {isAnalyzingImage ? "Analyzing Photo...." : "Analyzing Video...."}
            </p>
          </div>
        </div>
      )}

      {/* Text overlays — locked inside avatar frame top via --stage-top var (scales with viewport) */}
      <div className="absolute left-0 right-0 z-10 flex flex-col items-center pb-1 pt-1 sm:pt-2 md:pt-0" style={{ top: "calc(var(--stage-top) + 0.25rem)" }}>
        <div className="text-center px-4">
          <div className="flex items-start justify-center">
            <h1 className="aiasap-logo-mark relative top-[0.45rem] inline-block overflow-visible px-5 pt-1 pb-1 bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-[calc(var(--stage-width)*0.10)] font-bold italic leading-[1.12] tracking-normal text-transparent drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)]">
              aiASAP
            </h1>
          </div>
          <p className="mt-0 text-[calc(var(--stage-width)*0.032)] font-semibold tracking-[0.39em] md:tracking-[0.26em] xl:tracking-[0.55em] uppercase bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)]">
            Take the Leap
          </p>
        </div>
        {microphoneWarning && (
          <div className="mt-4 bg-yellow-500 text-black px-4 py-2 rounded-md max-w-2xl text-center">
            <p className="font-semibold">⚠️ Warning: {microphoneWarning}</p>
          </div>
        )}
        {/* {isAnalyzingImage && (
          <div className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md max-w-2xl text-center">
            <p className="font-semibold">🔄 Analyzing image...</p>
          </div>
        )}
        {imageAnalysis && !isAnalyzingImage && (
          <div className="mt-4 bg-green-500 text-white px-4 py-2 rounded-md max-w-2xl text-center">
            <p className="font-semibold">✅ Image analyzed successfully</p>
          </div>
        )} */}
      </div>

      {/* Full screen video */}
      <div
        className={`relative w-full flex-1 flex items-center justify-center pb-[8svh] md:pb-0 md:px-8 ${isCameraActive ? "pt-24" : ""}`}
      >
        {/* Avatar video - full screen when camera inactive, small overlay in left corner when active */}
        <video
          ref={videoRef}
          autoPlay // Native autoplay
          playsInline
          preload="auto"
          muted={true} // Start muted to prevent mouth movement during loading
          className={`${
            isCameraActive
              ? "absolute top-24 left-4 w-24 h-44 object-contain z-20 rounded-lg border-2 border-white shadow-2xl"
              : `h-full w-full object-cover md:object-contain md:object-center md:h-[94vh] md:max-h-[80rem] md:w-auto md:aspect-[9/16] md:rounded-[2.25rem] md:border md:border-[#d7a05a]/40 ${
                  isStreamReady
                    ? "md:shadow-[0_0_0_1px_rgba(215,160,90,0.45),0_30px_90px_rgba(0,0,0,0.72)]"
                    : "md:shadow-[0_0_0_1px_rgba(215,160,90,0.45)]"
                }`
          }`}
        />

        {/* r22 (G's laptop + phone: "no tap/click line... he looked alive but
            he wasn't there"): this fragment held the ENTIRE interactive UI —
            tap gate, pills, lists, chest, Terms — and was gated FULL-only
            since the May custom experiment. CUSTOM is the default now; the
            UI belongs to both modes. */}
        {(mode === "FULL" || mode === "CUSTOM") && (
          <>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleCameraChange}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        )}

        {/* Camera Preview - full screen under header when active */}
        {isCameraActive && (
          <div className="absolute inset-0 pt-24 flex items-center justify-center z-10">
            {cameraAvailable === false && fallbackImagePreview ? (
              // Fallback image preview (default image from public folder)
              <div className="relative w-full h-full max-w-4xl max-h-[calc(100vh-8rem)] flex flex-col">
                <img
                  src={fallbackImagePreview}
                  alt="Fallback"
                  className="w-full h-full object-contain rounded-lg"
                />
                {/* <button
                  onClick={() => fallbackImageInputRef.current?.click()}
                  className="absolute top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-md z-40 hover:bg-blue-700 text-sm"
                >
                  Change Image
                </button> */}
                <input
                  ref={fallbackImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFallbackImageChange}
                />
              </div>
            ) : cameraAvailable === false && !fallbackImagePreview ? (
              // Loading fallback image
              <div className="flex flex-col items-center justify-center w-full h-full max-w-4xl max-h-[calc(100vh-8rem)] bg-gray-900 rounded-lg p-8">
                <div className="text-center">
                  <p className="text-inset text-lg">Loading...</p>
                </div>
              </div>
            ) : fallbackImagePreview ? (
              // User uploaded image preview
              <div className="relative w-full h-full max-w-4xl max-h-[calc(100vh-8rem)] flex flex-col">
                <img
                  src={fallbackImagePreview}
                  alt="Uploaded preview"
                  className="w-full h-full object-contain rounded-lg"
                />
                <button
                  onClick={() => fallbackImageInputRef.current?.click()}
                  className="absolute top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-md z-40 hover:bg-blue-700 text-sm"
                >
                  Change Image
                </button>
                <input
                  ref={fallbackImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFallbackImageChange}
                />
              </div>
            ) : (
              // Camera video preview
              <video
                ref={cameraPreviewRef}
                autoPlay
                playsInline
                className="max-h-[calc(100vh-6rem)] w-full object-contain"
              />
            )}
          </div>
        )}

        {/* Snapshot: photo capture + optional video record (same camera session) */}
        {isCameraActive && visionMode === "snapshot" && (
          <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-30 flex gap-4 items-center justify-center">
            <button
              type="button"
              onClick={() => void handleSnapPhoto()}
              disabled={
                isRecording ||
                isAnalyzingImage ||
                isProcessingCameraQuestion ||
                (!cameraStream && !fallbackImage)
              }
              className="btn-inset rounded-lg px-5 py-3 min-w-[8.5rem] min-h-[3.25rem] flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-70"
              aria-label="Capture photo"
            >
              <Camera className="w-4.5 h-4.5" />
              Camera
            </button>
            {!isRecording ? (
              <button
                type="button"
                onClick={() => handleStartRecording()}
                disabled={!cameraStream || isAnalyzingImage}
                className="btn-inset rounded-lg px-5 py-3 min-w-[8.5rem] min-h-[3.25rem] flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-70"
                aria-label="Record video"
              >
                <Video className="w-4.5 h-4.5" />
                Video
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleStopRecording()}
                className="btn-inset rounded-lg px-6 py-3 flex items-center justify-center text-sm font-semibold"
              >
                Stop Recording
              </button>
            )}
          </div>
        )}
      </div>

      {shouldShowLoadingSurface && (
        <div className="fixed inset-x-0 z-30 flex -translate-y-1/2 justify-center px-4 pointer-events-none top-[calc(var(--stage-top)+var(--stage-height)*0.55)]">
          <div className="text-center text-[#e0aa62] drop-shadow-[0_10px_28px_rgba(0,0,0,0.72)]">
            <p className="text-[1.35rem] sm:text-[1.6rem] font-black uppercase tracking-[0.16em] bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)]">
              Loading
            </p>
            <div className="mx-auto mt-3 h-1.5 w-36 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full w-1/2 animate-[loading-sweep_2.15s_ease-in-out_infinite] rounded-full bg-[#e0aa62]" />
            </div>
          </div>
        </div>
      )}

      {shouldShowBeginSurface && (
        <button
          type="button"
          aria-label="Begin talking with 6"
          className="fixed inset-0 z-30 cursor-pointer bg-transparent"
          onClick={() => void handleVoiceStartStop()}
        />
      )}

      {/* Fixed buttons at bottom - positioned relative to viewport */}
      {/* r22: THIS is the fragment that holds the whole interactive UI (tap
          gate, pills, lists, chest, Terms) — its first children are dead
          commented-out buttons, which is why the FULL-only gate hid here so
          well. CUSTOM is the default now; both modes get the full UI. */}
      {(mode === "FULL" || mode === "CUSTOM") && (
        <>
          {/* <button
            className="fixed bottom-20 left-1/4 bg-white text-black px-6 py-3 rounded-md z-20 transform -translate-x-1/2 flex items-center justify-center gap-2"
            onClick={handleCameraClick}
          >
            📷 {isCameraActive ? "Close Camera" : "Camera"}
          </button>
          <button
            className="fixed bottom-20 right-1/4 bg-white text-black px-6 py-3 rounded-md z-20 transform translate-x-1/2 flex items-center justify-center gap-2"
            onClick={handleFileUploadClick}
          >
            📁 Upload
          </button> */}

          {/* Debug button - only visible in camera mode */}
          {/* {isCameraActive && (
            <button
              className="fixed bottom-20 left-1/2 bg-purple-600 text-white px-6 py-3 rounded-md z-20 transform -translate-x-1/2 flex items-center justify-center gap-2 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("Debug button onClick triggered", {
                  isProcessingCameraQuestion,
                  isAnalyzingImage,
                  isDebugProcessing: isDebugProcessingRef.current,
                  isCameraActive,
                  hasFallbackImage: !!fallbackImage
                });
                // Always call the handler - it will check internally if it should proceed
                handleDebugAnalysis().catch((error) => {
                  console.error("Error in handleDebugAnalysis:", error);
                });
              }}
              disabled={isProcessingCameraQuestion || isAnalyzingImage || isDebugProcessingRef.current}
            >
              {isAnalyzingImage || isDebugProcessingRef.current ? (
                <>🔄 Analyzing...</>
              ) : (
                <>🔍 Debug: Analyze Image</>
              )}
            </button>
          )} */}

          {/* Analyzing text for vision recognition in streaming mode - ONLY show when actually processing */}
          {/* Positioned just above Stop button when four boxes are not visible */}
          {visionMode === "streaming" && isProcessingCameraQuestion && (
            <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-30">
              <p className="text-inset text-2xl font-semibold text-center drop-shadow-lg">
                <span className="inline-flex items-center">
                  Analyzing...
                </span>
              </p>
            </div>
          )}

          {visionMode !== "streaming" && !isCameraActive && !hasUserPressedVoiceStart && !shouldShowLoadingSurface && (
            <div className="fixed left-1/2 bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.14)] md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.22)] -translate-x-1/2 w-[94%] max-w-3xl z-20 px-3 flex flex-col items-center pointer-events-none">
              {sessionState !== SessionState.DISCONNECTED &&
                isStreamReady && (
                  <div className="w-full flex items-center justify-center text-center">
                    <p className="px-1 w-full max-w-none text-balance">
                      <span
                        className="inline-flex min-h-[3.75rem] flex-col items-center justify-center gap-1 text-[#e0aa62] drop-shadow-[0_10px_28px_rgba(0,0,0,0.6)]"
                        style={tapPromptFont}
                      >
                        <span className="flex -translate-y-1.5 items-center text-[calc(var(--stage-width)*0.05)] font-bold italic tracking-[0.14em] bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#9e6a35] bg-clip-text text-transparent drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)]" style={{ fontFamily: '"Lora", Georgia, serif' }}>
                          Tap/Click ANYWHERE
                        </span>
                        <span className="-translate-y-1 text-[calc(var(--stage-width)*0.10)] font-extrabold tracking-[-0.025em] leading-none bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)]" style={{ fontFamily: '"Lora", Georgia, serif' }}>
                          To Talk To 6
                        </span>
                      </span>
                    </p>
                  </div>
                )}
              <div className="hidden">
                <div className="mb-2.5">
                  <button
                    type="button"
                    className="btn-inset w-full py-4 px-6 rounded-lg flex items-center justify-center text-2xl sm:text-3xl font-semibold whitespace-nowrap min-h-[4.75rem]"
                    disabled={
                      sessionState !== SessionState.CONNECTED ||
                      !isStreamReady ||
                      voiceStartAwaitingReady ||
                      (voiceIsLoading && !voiceIsActive)
                    }
                    onClick={() => void handleVoiceStartStop()}
                  >
                    {/* <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className={isActive ? "" : "text-[0.8em] leading-none"}
                      >
                        {isActive ? "⏹" : "▶"}
                      </span>
                      <span className={isActive ? "" : "-ml-0.5"}>
                        {isActive ? "Stop" : "Start"}
                      </span>
                    </span> */}
                    {voiceIsActive ? (
                      <Square
                        className="mr-3 w-7 h-7 shrink-0 text-red-500 fill-current"
                        aria-hidden
                      />
                    ) : (
                      <Play
                        className="mr-3 w-7 h-7 shrink-0 text-red-500 fill-current"
                        aria-hidden
                      />
                    )}
                    {voiceIsActive ? "Stop" : "Start"}
                  </button>
                  <button
                    type="button"
                    className="hidden"
                    onClick={async () => {
                      await unlockAudio();
                      handleGoLive();
                    }}
                  >
                    <Radio className="mr-1.5 w-4 h-4 shrink-0" aria-hidden />
                    Go Live
                  </button>
                </div>
                <div className="hidden">
                  <button
                    type="button"
                    className="btn-inset py-2 px-2.5 rounded-md flex items-center justify-center text-sm font-medium whitespace-nowrap min-h-[2.75rem]"
                    onClick={async () => {
                      await unlockAudio();
                      void handleCameraClick();
                    }}
                  >
                    <Camera className="mr-1.5 w-4 h-4 shrink-0" aria-hidden />
                    Camera
                  </button>
                  <button
                    type="button"
                    className="btn-inset py-2 px-2.5 rounded-md flex items-center justify-center text-sm font-medium whitespace-nowrap min-h-[2.75rem]"
                    onClick={() => void handleGalleryClick()}
                  >
                    <Images className="mr-1.5 w-4 h-4 shrink-0" aria-hidden />
                    Gallery
                  </button>
                </div>
              </div>
            </div>
          )}

          {showActiveList && isShoppingMode && (
            <div
              className="fixed left-1/2 z-[80] flex -translate-x-1/2 flex-col overflow-hidden rounded-[2rem] border border-[#e0aa62]/45 px-4 pb-4 pt-4 shadow-[0_0_0_1px_rgba(215,160,90,0.25)]"
              style={{
                // r20 (G screenshot: "the list should only be the size of the
                // avatar, not the whole screen"): the list lives exactly where
                // 6's video sits — the page's brown glow stays visible on the
                // sides, the avatar just swaps out for the list.
                top: "var(--stage-top)",
                height: "var(--stage-height)",
                width: "var(--stage-width)",
                background: activeListUsesBlackTheme
                  ? "linear-gradient(145deg, #f7f2e8 0%, #d7ccba 48%, #a7977f 100%)"
                  // r35 (G's screenshot ask 2026-06-12 21:55: "the colors
                  // should be nicer and more brown in the center, not this
                  // hard color. that is not a brand color"): warm brand
                  // browns — center rides #3a2108, no near-black.
                  : `radial-gradient(circle at 18% 8%, ${activeListTheme.soft}, transparent 34%), linear-gradient(145deg, #34200d 0%, #3a2108 50%, #241406 100%)`,
                color: activeListTheme.foreground,
                colorScheme: activeListUsesBlackTheme ? "light" : "dark",
              }}
            >
              <div
                className="mb-4 flex items-center justify-between gap-3 rounded-[1.45rem] border px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.24)] backdrop-blur-md"
                style={compactListPanelStyle}
              >
                <div className="min-w-0">
                  {/* r28 (G's screenshot): "6 Listening" label REMOVED ("six
                      listening should not be there") and the mute button is
                      GONE ("microphone button needs to go"). The title gets
                      the whole row — no more "Gro..." truncation; it wraps. */}
                  <h2 className="break-words text-[clamp(1.05rem,5.5vw,1.875rem)] font-black leading-tight">
                    {activeList.title}
                  </h2>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {/* 6's face — smaller circle (G's screenshot ask), pulsing in
                      REAL TIME with whoever is talking (the 60ms voice meters
                      drive glow + scale). Tap = bring him back; closing the
                      list is by voice ("close the list"). */}
                  <button
                    type="button"
                    aria-label="Bring 6 back"
                    title="Bring 6 back"
                    onClick={() => {
                      // a tap is an explicit ask — always gets a fresh budget
                      voiceReturnAttemptsRef.current = 0;
                      void beginAvatarReturn(true);
                    }}
                    className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full focus:outline-none"
                  >
                    {/* r20 (G's screenshot: the circle wasn't 6's face — the
                        2c44c052 jpg is a vision-mode test image). startscreen
                        IS 6; object-position frames his face in the circle. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      id="six-voice-circle"
                      src="/startscreen.png"
                      alt="6 - tap to bring him back"
                      className={`h-full w-full scale-[1.7] rounded-full border-2 object-cover transition-all duration-150 ${
                        voiceUserTalking ||
                        voiceSixTalking ||
                        voicePresence === "returning"
                          ? "border-[#ffe9c2]"
                          : "border-[#d7a05a]/70"
                      }`}
                      style={
                        voiceUserTalking ||
                        voiceSixTalking ||
                        voicePresence === "returning"
                          ? {
                              objectPosition: "50% 12%",
                              boxShadow:
                                "0 0 0 4px rgba(215,160,90,0.35), 0 0 26px 8px rgba(244,208,134,0.6)",
                            }
                          : {
                              objectPosition: "50% 12%",
                              boxShadow: "0 0 10px 2px rgba(215,160,90,0.35)",
                            }
                      }
                    />
                  </button>
                </div>
              </div>

              <div
                className="mb-5 h-1.5 w-full rounded-full shadow-[0_0_24px_currentColor]"
                style={{ backgroundColor: activeListTheme.foreground }}
              />

              <div ref={shoppingListScrollRef} className="min-h-0 flex-1 overflow-y-auto">
                {activeList.items.length > 0 ? (
                  // r24 (G live: "the text is way too big... like half"):
                  // 2xl → lg, and the size level still rides on top.
                  <ol
                    className="space-y-2.5 font-bold leading-tight"
                    style={{ fontSize: `${(1.1 * UI_CARD_SCALE[promptSizeLevel]).toFixed(3)}rem` }}
                  >
                    {activeList.items.map((item, index) => (
                      <li
                        key={`${item}-${index}`}
                        data-list-index={index}
                        className="grid min-h-[2.9rem] grid-cols-[1.9rem_1fr_2rem] items-center gap-2.5 rounded-[1rem] border px-3 py-2"
                        style={compactListRowStyle}
                      >
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-full border text-sm font-black"
                          style={compactListBadgeStyle}
                        >
                          {activeList.displayStyle === "numbered"
                            ? `${index + 1}.`
                            : "•"}
                        </span>
                        <span className="min-w-0 break-words">{item}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${item}`}
                          title={`Remove ${item}`}
                          onClick={() => removeListItemAtIndex(activeList.id, index)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border transition hover:scale-105"
                          style={compactListControlStyle}
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="pt-16 text-center text-xl font-black" style={compactListMutedStyle}>
                    Nothing here yet - just say what to add.
                  </p>
                )}
              </div>
            </div>
          )}

          {visionMode !== "streaming" &&
            !isCameraActive &&
            sessionState !== SessionState.DISCONNECTED &&
            isStreamReady &&
            voiceIsActive &&
            !isShoppingMode &&
            !lookupPanelVisible &&
            showActiveList && (
              <div
                className="fixed left-1/2 z-30 flex w-[92%] max-w-[32rem] -translate-x-1/2 flex-col overflow-hidden rounded-[1.35rem] border px-4 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.48)] backdrop-blur-md"
                style={{
                  ...compactListPanelStyle,
                  top: "calc(var(--stage-top) + var(--stage-height) * 0.38)",
                  height: "calc(var(--stage-height) * 0.32)",
                }}
              >
                <div
                  className="absolute inset-x-6 top-0 h-1 rounded-b-full"
                  style={{ backgroundColor: activeListTheme.foreground }}
                />
                <div className="mb-3 flex items-center justify-between gap-3 pt-1">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-black leading-tight drop-shadow-[0_3px_16px_rgba(30,14,0,0.62)]" style={{ fontSize: `${(1.45 * UI_CARD_SCALE[promptSizeLevel]).toFixed(3)}rem` }}>
                      {activeList.title}
                    </h2>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className="rounded-full border px-3 py-1 text-[0.78rem] font-black uppercase"
                      style={compactListControlStyle}
                    >
                      {activeList.items.length || 0}
                    </span>
                    <button
                      type="button"
                      aria-label="Close list"
                      title="Close list"
                      onClick={() => {
                        setIsShoppingMode(false);
                        setActiveListId(null);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full border opacity-90 transition hover:scale-105 hover:opacity-100"
                      style={compactListControlStyle}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>
                <div ref={listScrollRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
                  {activeList.items.length > 0 ? (
                    <ol className="space-y-2 font-bold leading-tight" style={{ fontSize: `${(1.06 * UI_CARD_SCALE[promptSizeLevel]).toFixed(3)}rem` }}>
                      {activeList.items.map((item, index) => (
                        <li
                          key={`${item}-${index}`}
                          data-list-index={index}
                          className="grid min-h-[3.1rem] grid-cols-[2.35rem_1fr_2.35rem] items-center gap-2 rounded-[0.95rem] border px-2.5 py-2"
                          style={compactListRowStyle}
                        >
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-full border text-[0.86rem] font-black"
                            style={compactListBadgeStyle}
                          >
                            {activeList.displayStyle === "numbered"
                              ? `${index + 1}.`
                              : "•"}
                          </span>
                          <span className="min-w-0 break-words">{item}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${item}`}
                            title={`Remove ${item}`}
                            onClick={() =>
                              removeListItemAtIndex(activeList.id, index)
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-full border opacity-85 transition hover:scale-105 hover:opacity-100"
                            style={compactListControlStyle}
                          >
                            <X className="h-4 w-4" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="pt-6 text-center text-[1.2rem] font-black leading-snug" style={compactListMutedStyle}>
                      Nothing here yet - just say what to add.
                    </p>
                  )}
                </div>
              </div>
            )}

          {/* FIX 1 (2026-06-01): on-chest email box. Sits directly above the top
              pillbox, centered, bottom-anchored so it scales with the viewport.
              Shows the address the user is SPELLING, live. 6 never reads it back
              by voice — this box is the source of truth the user checks.
              Lowered to the CENTER of 6's chest per G (2026-06-01): bottom
              multiplier 0.28 (mobile) / 0.38 (md). The 4 pillboxes drop away
              (hidden via !showChestEmail) and this box rises into the chest —
              keep that motion.
              When chestEmailStatus is set (e.g. "Account Link Sent") it shows
              that status in place of the label + address, then fades. */}
          {!ACCOUNT_BETA_DISABLED &&
            showChestEmail &&
            !emailEntryOpen &&
            visionMode !== "streaming" &&
            !isCameraActive &&
            sessionState !== SessionState.DISCONNECTED &&
            isStreamReady &&
            !isShoppingMode && (
              <div
                className="fixed left-1/2 z-[31] -translate-x-1/2 flex w-[90%] max-w-[min(26rem,calc(var(--stage-width)*0.88))] flex-col items-center gap-[calc(var(--stage-height)*0.004)] rounded-2xl border border-[#e0aa62]/55 bg-[#3a2108]/55 px-4 py-[calc(var(--stage-height)*0.012)] text-center shadow-[inset_0_1px_10px_rgba(255,255,255,0.10),0_10px_28px_rgba(0,0,0,0.42)] backdrop-blur-[3px] pointer-events-none bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.22)] md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.30)]"
              >
                {chestEmailStatus ? (
                  <span
                    className="w-full font-black leading-tight bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent"
                    style={{
                      fontFamily:
                        '"Cascadia Code", "Consolas", "SFMono-Regular", ui-monospace, monospace',
                      // Voice sizing covers "the writing on your chest" too
                      // (G 2026-06-10 23:15). Level 2 = the exact old size.
                      fontSize: `calc(var(--stage-height) * ${(0.024 * UI_CARD_SCALE[promptSizeLevel]).toFixed(4)})`,
                    }}
                  >
                    {`${chestEmailStatus} ✓`}
                  </span>
                ) : (
                  <>
                    <span
                      className="font-semibold uppercase tracking-[0.18em] bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent"
                      style={{
                        fontSize: `calc(var(--stage-height) * ${(0.015 * UI_CARD_SCALE[promptSizeLevel]).toFixed(4)})`,
                      }}
                    >
                      Your Email
                    </span>
                    <span
                      className="w-full break-all font-black leading-tight bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent"
                      style={{
                        fontFamily:
                          '"Cascadia Code", "Consolas", "SFMono-Regular", ui-monospace, monospace',
                        fontSize: `calc(var(--stage-height) * ${(0.024 * UI_CARD_SCALE[promptSizeLevel]).toFixed(4)})`,
                      }}
                    >
                      {chestEmailText || "spell your email…"}
                    </span>
                  </>
                )}
              </div>
            )}

          {/* r30 (G 2026-06-12): always know WHICH account this is — tiny
              signed-in badge, brand gold, bottom-left, never interactive.
              Shows in avatar AND list modes; absent = anonymous/guest. */}
          {accountEmail && sessionState !== SessionState.DISCONNECTED && (
            <div className="fixed bottom-2 left-3 z-40 pointer-events-none rounded-full border border-[#e0aa62]/40 bg-[#241608]/70 px-3 py-1 backdrop-blur-[2px]">
              <span className="text-[11px] font-semibold tracking-wide bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#b97f3e] bg-clip-text text-transparent">
                Signed in: {accountEmail}
              </span>
            </div>
          )}

          {visionMode !== "streaming" &&
            !isCameraActive &&
            sessionState !== SessionState.DISCONNECTED &&
            isStreamReady &&
            voiceIsActive &&
            !isShoppingMode &&
            !emailEntryOpen &&
            !showChestEmail && (
              <div
                className={`fixed left-1/2 z-30 -translate-x-1/2 text-center pointer-events-none ${
                  showActiveList
                    ? "top-[calc(var(--stage-top)+var(--stage-height)*0.72)] grid w-[92%] max-w-[32rem] grid-cols-2 grid-rows-2 gap-2 md:gap-2.5"
                    : "bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.12)] md:bottom-[calc(var(--stage-bottom)+var(--stage-height)*0.22)] flex w-[94%] flex-col items-center gap-[calc(var(--stage-height)*0.010)]"
                }`}
                style={
                  showActiveList
                    ? ({
                        "--prompt-lift": `${3.15 + promptSizeLevel * 0.25}rem`,
                        height: "calc(var(--stage-height) * 0.20)",
                        maxWidth: "min(32rem, calc(var(--stage-width) * 0.95))",
                      } as React.CSSProperties)
                    : ({
                        "--prompt-lift": `${3.15 + promptSizeLevel * 0.25}rem`,
                        /* LOCKED SPEC per CLAUDE.md aiASAP build facts:
                             bottom: calc(var(--stage-bottom) + var(--stage-height) * 0.20)
                             Tweak envelope 0.16-0.21.
                           Bottom-anchored so the stack stays at the same visual
                           position no matter how tall pillboxes get (font, padding,
                           gap). DO NOT switch back to top-anchored values without
                           an explicit ask. */
                        maxWidth: "min(42rem, calc(var(--stage-width) * 1.0))",
                      } as React.CSSProperties)
                }
              >
                {visibleThoughtPrompts.slice(0, visiblePromptLimit).map((prompt, index) => {
                  const isDissolving = dissolvingPrompt === prompt;
                  const _visiblePromptsForSize = visibleThoughtPrompts.slice(0, visiblePromptLimit);
                  const _maxPromptLen = Math.max(...(_visiblePromptsForSize.map((p) => p.length)), 0);
                  let _tierBase: number;
                  if (_maxPromptLen > 26) _tierBase = 0.70;
                  else if (_maxPromptLen > 22) _tierBase = 0.85;
                  else _tierBase = 1.06;
                  // Compact pills (the 4 on the home stage), G 2026-06-11:
                  // "text should generally fill most of the pill boxes...
                  // when text got bigger, pills got taller but not wider,
                  // they should stay in proportion." The pill is now a
                  // function of its TEXT: font = the smaller of the fill cap
                  // (3% of stage height) and the exact width budget for the
                  // longest visible label (0.55em avg char, conservative —
                  // measured Trebuchet semibold runs ~0.47em, so real text
                  // sits ~85% of the inner width). Pill height = font × 1.5
                  // (text fills two-thirds), width rides the size level.
                  // This replaces the 2026-06-07 length-tier table — same
                  // "drop to whatever fits" intent, continuous instead of
                  // stepped, and it can never clip at any stage size/level.
                  const _pillScale = UI_CARD_SCALE[promptSizeLevel];
                  const _pillMaxWidth = `min(calc(var(--stage-width) * ${(0.56 * _pillScale).toFixed(4)}), 92vw)`;
                  // r18: budget floor 18 = the default-set maximum. Sets of
                  // short labels no longer POP bigger and (with the ≤18 filter
                  // in normalizeThoughtPrompts) long ones no longer shrink the
                  // stack — the font is stable across prompt rotation. Level-2
                  // default look unchanged (defaults already max at 18).
                  const _pillFont = `min(calc(var(--stage-height) * ${(0.030 * _pillScale).toFixed(5)}), calc((${_pillMaxWidth} - 2rem) / ${(0.55 * Math.max(_maxPromptLen, 18)).toFixed(2)}))`;
                  return (
                    <button
                      type="button"
                      key={prompt}
                      onClick={() => void handleThoughtPromptTap(prompt)}
                      disabled={Boolean(dissolvingPrompt)}
                      className={`pointer-events-auto overflow-hidden rounded-full border border-[#e0aa62]/55 bg-[#3a2108]/30 font-semibold leading-tight text-[#f1c477] shadow-[inset_0_1px_10px_rgba(255,255,255,0.10),0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-[3px] drop-shadow-[0_3px_16px_rgba(30,14,0,0.9)] transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none ${
                        showActiveList
                          ? "h-full w-full px-2 py-1.5 md:px-3 md:py-2 text-[var(--prompt-font-size)] md:text-[calc(var(--prompt-font-size)+0.05rem)] whitespace-normal break-words"
                          : "flex items-center justify-center w-full px-4 whitespace-nowrap"
                      } ${
                        isDissolving
                          ? "animate-prompt-dissolve"
                          : "animate-prompt-enter"
                      }${wigglingPromptIndex === index ? " pill-wiggle" : ""}`}
                      style={{
                        animationDelay: `${index * 80}ms`,
                        // G 23:36 "total fail": the compact home-stage pills
                        // computed fontSize from stage height ALONE — the size
                        // level never reached them. Both the text AND the box
                        // (minHeight) now ride UI_CARD_SCALE; level 2 is
                        // byte-identical to the old values.
                        "--prompt-font-size": showActiveList
                          ? `${(0.9 * UI_CARD_SCALE[promptSizeLevel]).toFixed(3)}rem`
                          : `${((_tierBase + 0.2) * UI_CARD_SCALE[promptSizeLevel]).toFixed(3)}rem`,
                        ...(showActiveList
                          ? {}
                          : {
                              fontSize: _pillFont,
                              // Height follows the text (flex centers it) —
                              // no static py, or it would un-proportion the
                              // fill the moment the width budget binds.
                              minHeight: `calc(${_pillFont} * 1.5)`,
                              maxWidth: _pillMaxWidth,
                            }),
                        color: "#e0aa62",
                        fontFamily:
                          '"Trebuchet MS", "Aptos", "Segoe UI", system-ui, sans-serif',
                      } as React.CSSProperties}
                    >
                      <span className="bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent">
                        {prompt}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

          {visionMode !== "streaming" && !isCameraActive && !isShoppingMode && (
            <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] md:bottom-[calc((var(--stage-bottom)-0.875rem)/2)] md:top-auto left-1/2 -translate-x-1/2 z-40 flex items-center justify-center gap-1 pointer-events-auto">
              <Link
                href="/terms"
                target="_blank"
                className="text-[10px] sm:text-[11px] whitespace-nowrap bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent hover:opacity-90 transition-opacity"
              >
                Terms
              </Link>
              <span className="text-[10px] sm:text-[11px] bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent">&middot;</span>
              <span className="text-center text-[10px] sm:text-[11px] whitespace-nowrap bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent">
                &copy; 2026 aiASAP All Rights Reserved
              </span>
              <span className="text-[10px] sm:text-[11px] bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent">&middot;</span>
              <Link
                href="/privacy"
                target="_blank"
                className="text-[10px] sm:text-[11px] whitespace-nowrap bg-gradient-to-b from-[#ffe9c2] via-[#d7a05a] to-[#3a2108] bg-clip-text text-transparent hover:opacity-90 transition-opacity"
              >
                Privacy
              </Link>
            </div>
          )}
        </>
      )}

      {/* Stop: exit Go Live / camera overlay (or end session when already on home) */}
      {(visionMode === "streaming" || isCameraActive) && (
        <>
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[95%] max-w-7xl z-20 px-4">
            <div className="flex justify-center">
              <button
                className="btn-inset py-2.5 px-6 rounded-lg flex items-center justify-center text-lg font-medium whitespace-nowrap"
                onClick={async () => {
                  // Unlock audio on button click (user interaction)
                  await unlockAudio();
                  handleStopSession();
                }}
              >
                  <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="text-red-500">⏹</span>
                  <span>Stop</span>
                </span>
              </button>
            </div>
          </div>
          <div className="fixed bottom-1 left-1/2 -translate-x-1/2 z-20">
            <Link
              href="/terms"
              target="_blank"
              className="block text-center text-[11px] sm:text-xs text-[#d7a05a]/70 hover:text-[#d7a05a] transition-colors py-1"
            >
              Terms
            </Link>
          </div>
        </>
      )}
      <style>{`
        @keyframes idea-rise {
          0% {
            opacity: 0;
            transform: translateY(0.65rem) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes prompt-dissolve {
          0% {
            opacity: 1;
            filter: blur(0);
            transform: translateY(0) scale(1);
          }
          42% {
            opacity: 0.68;
            filter: blur(1.5px);
            transform: translateY(-0.45rem) scale(1.025);
          }
          100% {
            opacity: 0;
            filter: blur(12px);
            transform: translateY(-1.35rem) scale(1.09);
          }
        }

        @keyframes loading-sweep {
          0% {
            transform: translateX(-125%);
          }
          55% {
            transform: translateX(160%);
          }
          100% {
            transform: translateX(160%);
          }
        }

        .animate-prompt-enter {
          animation: idea-rise 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .animate-prompt-dissolve {
          animation: prompt-dissolve 620ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
      `}</style>
    </div>
  );
};

export const LiveAvatarSession: React.FC<{
  mode: "FULL" | "CUSTOM";
  sessionAccessToken: string;
  onSessionStopped: (opts?: SessionStoppedReason) => void;
  onExit?: () => void;
}> = ({ mode, sessionAccessToken, onSessionStopped, onExit }) => {
  return (
    <LiveAvatarContextProvider sessionAccessToken={sessionAccessToken} mode={mode}>
      <LiveAvatarSessionComponent
        mode={mode}
        onSessionStopped={onSessionStopped}
        onExit={onExit}
      />
    </LiveAvatarContextProvider>
  );
};
