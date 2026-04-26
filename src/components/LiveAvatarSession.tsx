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
import { captureMedia } from "../lib/captureMedia";
import { extractContactDetails } from "../lib/contactExtraction";
import {
  Radio,
  Camera,
  Images,
  Video,
  Play,
  Square,
  X,
  MapPin,
} from "lucide-react";

export type SessionStoppedReason = { reason?: "inactivity" };

const AIASAP_FOUNDER_TITLE =
  "Creator/Builder/Founder/Financier/CEO aiASAP";

const VOICE_START_GREETING =
  "Hi, I'm 6, your AI buddy. You know why they call me 6? Because I got your back. a-i-ASAP is here to make AI easy, just by talking to me. What should I call you?";

const DEFAULT_THOUGHT_PROMPTS = [
  "Start a Grocery List",
  "Create To Do List",
  "Plan This Weekend",
  "Change Subject",
];

const CHANGE_SUBJECT_PROMPT = "Change Subject";

const getThoughtPrompts = (text: string): string[] => {
  const value = text.toLowerCase();

  if (
    value.includes("todo") ||
    value.includes("to-do") ||
    value.includes("to do") ||
    value.includes("task")
  ) {
    return [
      "Create To Do List",
      "Open Work To Do",
      "Open Family To Do",
      CHANGE_SUBJECT_PROMPT,
    ];
  }

  if (value.includes("birthday")) {
    return [
      "Remember the Birthday",
      "Add Yearly Reminder",
      "Plan a Gift",
      CHANGE_SUBJECT_PROMPT,
    ];
  }

  if (value.includes("anniversary")) {
    return [
      "Remember the Anniversary",
      "Add Yearly Reminder",
      "Plan a Gift",
      CHANGE_SUBJECT_PROMPT,
    ];
  }

  if (
    value.includes("shopping") ||
    value.includes("grocery") ||
    value.includes("store") ||
    value.includes("home depot") ||
    value.includes("walmart") ||
    value.includes("list")
  ) {
    return [
      value.includes("walmart") ? "Open Walmart List" : "Add to Grocery List",
      "Create To Do List",
      "Add the Next Item",
      CHANGE_SUBJECT_PROMPT,
    ];
  }

  if (
    value.includes("hike") ||
    value.includes("hiking") ||
    value.includes("trail") ||
    value.includes("park") ||
    value.includes("outside") ||
    value.includes("outdoor") ||
    value.includes("weekend")
  ) {
    return [
      "Find Local Hikes",
      "Plan This Weekend",
      "Check the Weather",
      CHANGE_SUBJECT_PROMPT,
    ];
  }

  if (
    value.includes("business") ||
    value.includes("company") ||
    value.includes("money") ||
    value.includes("build")
  ) {
    return [
      "Pick the Next Step",
      "Make a Simple Plan",
      "Find Helpful People",
      CHANGE_SUBJECT_PROMPT,
    ];
  }

  return DEFAULT_THOUGHT_PROMPTS;
};

function normalizeThoughtPrompts(prompts: string[]): string[] {
  const cleaned = prompts
    .map((prompt) => prompt.trim())
    .filter(Boolean)
    .filter((prompt) => !/\b(?:contact|named g|for g|call g|text g|email g)\b/i.test(prompt))
    .filter((prompt, index, all) => all.indexOf(prompt) === index)
    .filter((prompt) => prompt !== CHANGE_SUBJECT_PROMPT)
    .slice(0, 3);
  return [...cleaned, ...DEFAULT_THOUGHT_PROMPTS]
    .filter((prompt, index, all) => all.indexOf(prompt) === index)
    .filter((prompt) => prompt !== CHANGE_SUBJECT_PROMPT)
    .slice(0, 3)
    .concat(CHANGE_SUBJECT_PROMPT);
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
  createdAt: number;
  updatedAt: number;
};

type OnlineLookupSource = {
  title: string;
  url: string;
};

const ASSISTANT_LISTS_STORAGE_KEY = "aiasap.assistantLists.v1";
const MAX_LIST_ITEMS = 80;
const MAX_ONLINE_LOOKUP_SOURCE_COUNT = 3;
const INTERNAL_SIGNAL_RE =
  /^\s*\[(?:USER HAS BEEN SILENT|SILENT|OBJECT_NOT_VISIBLE)[^\]]*\]/i;
const LIST_TRIGGER_RE =
  /\b(grocery|groceries|shopping|store|walmart|list|todo|to-do|to do|task)\b/i;
const LIST_ITEM_PREFIX_RE =
  /^(?:and\s+)?(?:(?:i\s+)?(?:need|want|have to get|gotta get|should get|add|put|grab|buy|pick up)\s+|some\s+|a\s+|an\s+|the\s+)/i;
const LIST_COMMAND_ONLY_RE =
  /\b(?:make|create|start|open|show|switch to|pull up|go to|toggle|another|new)\b.*\b(?:list|todo|to-do|to do)\b/i;
const REMOVE_COMMAND_RE =
  /\b(?:remove|delete|cross off|check off|mark off|i got|got|grabbed|picked up)\b/i;
const LIST_NAV_NEXT_RE = /\b(?:next|another|toggle|switch)\s+list\b/i;
const LIST_NAV_PREV_RE = /\b(?:previous|prior|last|back)\s+list\b/i;
const LIST_CLOSE_RE =
  /\b(?:close|hide|dismiss|put away|minimize)\s+(?:the|my|this|that)?\s*(?:list|lists)\b|\bmake\s+(?:the|my|this|that)?\s*(?:list|lists)\s+disappear\b/i;
const LIST_STYLE_BULLET_RE = /\b(?:bullet|bullets|bullet points)\b/i;
const LIST_STYLE_NUMBER_RE = /\b(?:numbered|numbers|number list|numbered list)\b/i;
const BUG_REPORT_TRIGGER_RE =
  /\b(?:report (?:a )?bug|file (?:a )?bug|bug report|this (?:is|looks) broken|the app (?:is|seems|looks) broken|something (?:is|went) wrong|this is not working|that did not work|issue with (?:the )?app)\b/i;
const ACCOUNT_SETUP_TRIGGER_RE =
  /\b(?:set up|setup|create|start|make|open)\s+(?:an?\s+)?account\b|\b(?:remember me|remember this next time|remember everything|save this for next time|sign me in|log me in)\b/i;
const ACCOUNT_SETUP_NATURAL_MOMENT_RE =
  /\b(?:send me (?:an?\s+)?email|email reminder|text me|notify me|two weeks before|2 weeks before|one week before|1 week before|day before|morning of|set (?:those|that|them) reminders?|save (?:that|this) reminder)\b/i;
const ACCOUNT_READY_YES_RE =
  /\b(?:yes|yeah|yep|sure|ready|ok|okay|do it|let'?s do it|set it up|send it)\b/i;
const ACCOUNT_READY_NO_RE = /\b(?:no|not now|later|stop|never mind|cancel)\b/i;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const ONLINE_LOOKUP_TOPIC_RE =
  /\b(?:hike|hikes|hiking|trail|trails|park|parks|walk|walking|outside|outdoor|outdoors|weekend|weekend activities|things to do|places to go|place to go|weather|forecast)\b/i;
const ONLINE_LOOKUP_ACTION_RE =
  /\b(?:find|look up|search|show me|where|nearby|near me|plan|check|help me find)\b/i;
const LOCATION_HINT_RE =
  /\b(?:near|around|in|by|close to|outside of)\s+([a-z0-9][a-z0-9\s,.'-]{1,70})/i;
const SHOPPING_MODE_OPEN_RE =
  /\b(?:shopping mode|store mode|in the store|at the store|i'?m shopping|go shopping|shopping now|full screen list|make (?:the )?list full screen|open (?:the )?list full screen)\b/i;
const SHOPPING_MODE_CLOSE_RE =
  /\b(?:close|exit|leave|stop)\s+(?:shopping|store|full screen)\s*mode\b/i;
const LIST_MUTATION_SIGNAL_RE =
  /\b(?:need|want|have to get|gotta get|should get|add|put|grab|buy|pick up|also)\b/i;
const LIST_CONVERSATION_FRAGMENT_RE =
  /\b(?:i mean|all those|all kinds of|did you|do you|am i|are they|they'?re|they are|what do you mean|ready to check out|check out|not on|put them on|that'?s what|you mean|what are you|what is|what's)\b/i;
const LIST_FILLER_ITEM_RE =
  /^(?:no|nothing|that's all|that is all|anything else|yeah|yep|yes|ok|okay|i mean|i guess|all those|it|that|this|them|they|those|these)$/i;
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
    maybe.items.every((item) => typeof item === "string")
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
    const raw = window.localStorage.getItem(ASSISTANT_LISTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAssistantList).map((list) => ({
      ...list,
      kind: list.kind || "custom",
      displayStyle:
        list.displayStyle === "bulleted" || list.displayStyle === "numbered"
          ? list.displayStyle
          : "numbered",
      accentColor:
        list.accentColor && list.accentColor in LIST_ACCENT_COLORS
          ? list.accentColor
          : "amber",
      createdAt: Number.isFinite(list.createdAt) ? list.createdAt : Date.now(),
      updatedAt: Number.isFinite(list.updatedAt) ? list.updatedAt : Date.now(),
      items: cleanStoredListItems(list.items),
    }));
  } catch {
    return [];
  }
}

function isInternalSignal(text: string): boolean {
  return INTERNAL_SIGNAL_RE.test(text.trim());
}

function correctListItem(item: string): string {
  if (/^unions$/i.test(item)) return "Onions";
  return item;
}

function cleanListItem(
  value: string,
  options: { fromExplicitCommand?: boolean } = {},
): string | null {
  if (/[?]/.test(value) || LIST_CONVERSATION_FRAGMENT_RE.test(value)) {
    return null;
  }

  const item = value
    .replace(/^let'?s work on this next:\s*/i, "")
    .replace(/\b(?:um|uh|like|please)\b/gi, " ")
    .replace(/\b(?:okay|ok|the things that|things that|things|are|from|off|list|my list|the list)\b/gi, " ")
    .replace(LIST_ITEM_PREFIX_RE, "")
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (item.length < 2 || item.length > 42) return null;
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
  if (REMOVE_COMMAND_RE.test(text)) return false;
  if (/[?]/.test(text) || LIST_CONVERSATION_FRAGMENT_RE.test(text)) return false;
  const hasExplicitMutation = LIST_MUTATION_SIGNAL_RE.test(text);
  if (hasExplicitMutation) return true;
  if (!options.allowBareItems) return false;
  if (/[,;\n]|\band\b/i.test(text)) return true;
  const cleaned = cleanListItem(text);
  if (!cleaned) return false;
  return cleaned.split(/\s+/).length <= 3;
}

function isOnlineLookupIntent(text: string): boolean {
  return (
    ONLINE_LOOKUP_TOPIC_RE.test(text) &&
    (ONLINE_LOOKUP_ACTION_RE.test(text) || /\b(?:weekend|hike|hiking)\b/i.test(text))
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
  if (ACCOUNT_READY_YES_RE.test(value) || ACCOUNT_READY_NO_RE.test(value)) {
    return false;
  }
  return /\b\d{5}(?:-\d{4})?\b/.test(value) || /^[a-z][a-z\s,.'-]+$/i.test(value);
}

function extractListItems(
  text: string,
  options: { allowBareItems?: boolean } = {},
): string[] {
  if (!canInferListItems(text, options)) return [];
  const fromExplicitCommand = LIST_MUTATION_SIGNAL_RE.test(text);

  const normalized = text
    .replace(/\b(?:and then|also)\b/gi, ",")
    .replace(/\b(?:i need|i want|add|grab|buy|pick up)\b/gi, ", $&")
    .replace(/\s+/g, " ");

  return normalized
    .split(/[,.;\n]|\band\b/gi)
    .map((item) => cleanListItem(item, { fromExplicitCommand }))
    .filter((item): item is string => Boolean(item));
}

function extractRemoveItems(text: string): string[] {
  if (isInternalSignal(text) || !REMOVE_COMMAND_RE.test(text)) return [];

  const normalized = text
    .replace(REMOVE_COMMAND_RE, ",")
    .replace(/\b(?:from|off|the|my|this|that|list|i got it|got it)\b/gi, " ")
    .replace(/\s+/g, " ");

  return normalized
    .split(/[,.;\n]|\band\b/gi)
    .map((item) => cleanListItem(item, { fromExplicitCommand: true }))
    .filter((item): item is string => Boolean(item));
}

function detectListIntent(text: string): {
  title: string;
  kind: AssistantListKind;
} | null {
  if (isInternalSignal(text)) return null;
  const value = text.toLowerCase();

  if (/\bgrocer(?:y|ies)\b/.test(value)) {
    return { title: "Grocery List", kind: "grocery" };
  }

  if (/\bwalmart\b/.test(value)) {
    return { title: "Walmart List", kind: "shopping" };
  }

  const todoScope =
    text.match(/\b(?:to[-\s]?do|todo|task)s?\s+(?:list\s+)?([a-z][a-z0-9'-]{1,24})\b/i)?.[1] ??
    text.match(/\b([a-z][a-z0-9'-]{1,24})\s+(?:to[-\s]?do|todo|tasks?)\b/i)?.[1] ??
    null;

  if (/\b(?:to[-\s]?do|todo|tasks?)\b/i.test(text)) {
    return {
      title: todoScope ? `${titleCaseWords(todoScope)} To Do List` : "To Do List",
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

  if (/\banother\s+list\b/i.test(text)) {
    return { title: "New List", kind: "custom" };
  }

  if (/\bshopping\s+list\b/i.test(text)) {
    return { title: "Shopping List", kind: "shopping" };
  }

  return null;
}

function hasBugReportIntent(text: string): boolean {
  return !isInternalSignal(text) && BUG_REPORT_TRIGGER_RE.test(text);
}

function summarizeBugReport(text: string): string {
  return text
    .replace(/^let'?s work on this next:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
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

  const { interrupt, repeat, startListening, stopListening } =
    useAvatarActions(mode);

  const { sendMessage } = useTextChat(mode);
  const { sessionRef } = useLiveAvatarContext();
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
  const audioUnlockedRef = useRef<boolean>(false);
  const wasMutedBeforeRecordingRef = useRef<boolean>(false);
  /** LiveAvatar server session id — used for DB + official transcript API (set when CONNECTED). */
  const dbSessionIdRef = useRef<string | null>(null);
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
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [isShoppingMode, setIsShoppingMode] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const [accountVerificationUrl, setAccountVerificationUrl] = useState<
    string | null
  >(null);
  const [onlineLookupNotice, setOnlineLookupNotice] = useState<string | null>(
    null,
  );
  const [onlineLookupSources, setOnlineLookupSources] = useState<
    OnlineLookupSource[]
  >([]);
  const [isOnlineLookupLoading, setIsOnlineLookupLoading] = useState(false);
  const [postVerifyGreeting, setPostVerifyGreeting] = useState<string | null>(
    null,
  );
  const promptBrainHistoryRef = useRef<string[]>([]);
  const promptBrainSeqRef = useRef(0);
  const promptBrainTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const onlineLookupLocationRef = useRef<string | null>(null);
  const onlineLookupPendingQueryRef = useRef<string | null>(null);
  const postVerifyGreetingSpokenRef = useRef(false);
  const accountSetupAwaitingReadyRef = useRef(false);
  const accountSetupAwaitingEmailRef = useRef(false);
  const accountSetupOfferMadeRef = useRef(false);
  const accountSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const accountListsLoadedRef = useRef(false);
  const activeList = useMemo(
    () => assistantLists.find((list) => list.id === activeListId) ?? null,
    [activeListId, assistantLists],
  );
  const activeListTheme = activeList
    ? LIST_ACCENT_COLORS[activeList.accentColor]
    : LIST_ACCENT_COLORS.amber;

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

  const runPromptBrain = useCallback(async (text: string) => {
    const latestUserText = text.trim();
    if (latestUserText.length < 3) return;

    const fallbackPrompts = normalizeThoughtPrompts(
      getThoughtPrompts(latestUserText),
    );
    const recentUserTexts = [
      ...promptBrainHistoryRef.current,
      latestUserText,
    ].slice(-8);
    promptBrainHistoryRef.current = recentUserTexts;

    const sequence = ++promptBrainSeqRef.current;
    setThoughtPrompts(fallbackPrompts);

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

      setThoughtPrompts(
        normalizeThoughtPrompts(getThoughtPrompts(latestUserText)),
      );

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
    window.localStorage.setItem(
      ASSISTANT_LISTS_STORAGE_KEY,
      JSON.stringify(assistantLists),
    );
  }, [assistantLists]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/me")
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (cancelled || !data?.authenticated) return;
        if (typeof data.user?.email === "string") {
          setAccountEmail(data.user.email);
        }
        if (Array.isArray(data.lists) && data.lists.length > 0) {
          const cleanedLists = data.lists
            .filter(isAssistantList)
            .map((list: AssistantList) => ({
              ...list,
              items: cleanStoredListItems(list.items),
            }));
          if (cleanedLists.length > 0) {
            setAssistantLists(cleanedLists);
            setActiveListId(
              (current) => current ?? cleanedLists[0]?.id ?? null,
            );
          }
        }
        const accountStatus = new URLSearchParams(window.location.search).get(
          "account",
        );
        if (accountStatus === "verified") {
          const firstListTitle =
            Array.isArray(data.lists) && data.lists[0]?.title
              ? String(data.lists[0].title)
              : null;
          setPostVerifyGreeting(
            firstListTitle
              ? `You're back. Account is set, and I remember your ${firstListTitle}. Let's pick up right there.`
              : "You're back. Account is set, and I'll remember what you ask me to remember.",
          );
          window.history.replaceState(
            {},
            "",
            `${window.location.pathname}${window.location.hash}`,
          );
        }
        accountListsLoadedRef.current = true;
      })
      .catch((error) => console.warn("Account load failed:", error));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !postVerifyGreeting ||
      postVerifyGreetingSpokenRef.current ||
      sessionState !== SessionState.CONNECTED ||
      !isStreamReady
    ) {
      return;
    }
    postVerifyGreetingSpokenRef.current = true;
    setAccountNotice("Account verified");
    void repeat(postVerifyGreeting).then(() => {
      lastAvatarResponseRef.current = postVerifyGreeting;
      lastVisionResponseTimeRef.current = Date.now();
    });
  }, [isStreamReady, postVerifyGreeting, repeat, sessionState]);

  useEffect(() => {
    if (!accountEmail || !accountListsLoadedRef.current) return;
    if (accountSaveTimeoutRef.current) {
      clearTimeout(accountSaveTimeoutRef.current);
    }
    accountSaveTimeoutRef.current = setTimeout(() => {
      void fetch("/api/account/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lists: assistantLists }),
      }).catch((error) => console.warn("Account list save failed:", error));
    }, 900);
  }, [accountEmail, assistantLists]);

  const ensureAssistantList = useCallback(
    (intent: { title: string; kind: AssistantListKind }): string => {
      const now = Date.now();
      const normalizedTitle =
        intent.title === "New List"
          ? `List ${assistantLists.length + 1}`
          : normalizeListTitle(intent.title, intent.kind);
      const existing = assistantLists.find(
        (list) => list.title.toLowerCase() === normalizedTitle.toLowerCase(),
      );

      if (existing) {
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
      setActiveListId(id);
      return id;
    },
    [assistantLists],
  );

  const addItemsToList = useCallback((listId: string, items: string[]) => {
    if (items.length === 0) return false;
    let changed = false;
    setAssistantLists((currentLists) =>
      currentLists.map((list) => {
        if (list.id !== listId) return list;
        const nextItems = [...list.items];
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
        return changed
          ? {
              ...list,
              items: nextItems.slice(0, MAX_LIST_ITEMS),
              updatedAt: Date.now(),
            }
          : list;
      }),
    );
    return changed;
  }, []);

  const removeItemsFromList = useCallback((listId: string, items: string[]) => {
    if (items.length === 0) return false;
    let changed = false;
    setAssistantLists((currentLists) =>
      currentLists.map((list) => {
        if (list.id !== listId) return list;
        const removeSet = new Set(items.map((item) => item.toLowerCase()));
        const nextItems = list.items.filter(
          (item) => !removeSet.has(item.toLowerCase()),
        );
        changed = nextItems.length !== list.items.length;
        return changed ? { ...list, items: nextItems, updatedAt: Date.now() } : list;
      }),
    );
    return changed;
  }, []);

  const removeListItemAtIndex = useCallback(
    (listId: string, itemIndex: number) => {
      setAssistantLists((currentLists) =>
        currentLists.map((list) => {
          if (list.id !== listId) return list;
          return {
            ...list,
            items: list.items.filter((_, index) => index !== itemIndex),
            updatedAt: Date.now(),
          };
        }),
      );
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
    (listId: string, accentColor: ListAccentColor) => {
      setAssistantLists((currentLists) =>
        currentLists.map((list) =>
          list.id === listId
            ? { ...list, accentColor, updatedAt: Date.now() }
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

  const fileBugReport = useCallback(
    async (rawText: string) => {
      const summary = summarizeBugReport(rawText);
      if (!summary) return false;
      try {
        const response = await fetch("/api/bug-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: dbSessionIdRef.current,
            summary,
            transcript: rawText,
            pageUrl: window.location.href,
            activeList: activeList
              ? {
                  title: activeList.title,
                  items: activeList.items,
                  displayStyle: activeList.displayStyle,
                  accentColor: activeList.accentColor,
                }
              : null,
          }),
        });

        if (!response.ok) return false;
        const data = await response.json();
        const spoken = data?.emailSent
          ? `I made a bug report and sent it to the ${AIASAP_FOUNDER_TITLE}.`
          : `I made a bug report for the ${AIASAP_FOUNDER_TITLE}.`;
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      } catch (error) {
        console.error("Failed to file bug report:", error);
        return false;
      }
    },
    [activeList, repeat],
  );

  const startAccountSetup = useCallback(
    async (email: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      setAccountNotice(`Sending account link to ${normalizedEmail}`);
      setAccountVerificationUrl(null);
      try {
        const response = await fetch("/api/account/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            sessionId: dbSessionIdRef.current,
            lists: assistantLists,
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || "Failed to send account link");
        }

        const verificationUrl =
          typeof data?.verificationUrl === "string" ? data.verificationUrl : null;
        const spoken = data?.emailSent
          ? "Done. I sent you an email. Click that link, and when you come back, I'll be like, hey, how's it going? I'll remember your lists and we'll pick up right where we left off."
          : verificationUrl
            ? "I saved your email, but the email sender is not finished yet. I put the sign-in link on your screen for this test."
            : "I saved your email, but the email sender is not fully connected yet. I made a note for G to finish account email before this goes live.";
        setAccountNotice(
          data?.emailSent
            ? `Account link sent to ${normalizedEmail}`
            : verificationUrl
              ? "Account link ready for this test"
              : "Account email needs setup",
        );
        setAccountVerificationUrl(verificationUrl);
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      } catch (error) {
        console.error("Account setup failed:", error);
        const spoken =
          "I had trouble setting up that email link. I made a note for G to fix account setup.";
        setAccountNotice("Account setup needs attention");
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      }
    },
    [assistantLists, repeat],
  );

  const offerAccountSetupForMemory = useCallback(async () => {
    if (
      accountEmail ||
      accountSetupOfferMadeRef.current ||
      accountSetupAwaitingReadyRef.current ||
      accountSetupAwaitingEmailRef.current
    ) {
      return false;
    }

    accountSetupOfferMadeRef.current = true;
    accountSetupAwaitingReadyRef.current = true;
    accountSetupAwaitingEmailRef.current = false;
    const spoken =
      "Let's get that account set up. It's just a quick email click. Then next time I can be like, hey, how's it going? I won't have to be like, do I know you? Have we met before? You ready?";
    await repeat(spoken);
    lastAvatarResponseRef.current = spoken;
    lastVisionResponseTimeRef.current = Date.now();
    return true;
  }, [accountEmail, repeat]);

  const handleAccountSetupSpeech = useCallback(
    async (userText: string) => {
      const contact = extractContactDetails(userText);
      const directEmail = contact.email ?? userText.match(EMAIL_RE)?.[0] ?? null;

      if (accountSetupAwaitingEmailRef.current && directEmail) {
        accountSetupAwaitingEmailRef.current = false;
        accountSetupAwaitingReadyRef.current = false;
        return await startAccountSetup(directEmail);
      }

      if (accountSetupAwaitingReadyRef.current) {
        if (ACCOUNT_READY_NO_RE.test(userText)) {
          accountSetupAwaitingReadyRef.current = false;
          accountSetupAwaitingEmailRef.current = false;
          const spoken =
            "No problem. We can keep using this session. When you want me to remember next time, we'll set it up.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          return true;
        }
        if (ACCOUNT_READY_YES_RE.test(userText)) {
          accountSetupAwaitingReadyRef.current = false;
          accountSetupAwaitingEmailRef.current = true;
          const spoken = "Great. What email address should I send the link to?";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          return true;
        }
      }

      if (ACCOUNT_SETUP_TRIGGER_RE.test(userText)) {
        if (directEmail) return await startAccountSetup(directEmail);
        accountSetupAwaitingReadyRef.current = true;
        accountSetupAwaitingEmailRef.current = false;
        const spoken =
          "You can use the site right now, but if you want me to remember everything next time, let's get that account set up. It's just a quick email click. Then when you come back, I can be like, hey, how's it going? I won't have to be like, do I know you? Have we met before? You ready?";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      }

      return false;
    },
    [repeat, startAccountSetup],
  );

  useEffect(() => {
    if (sessionState === SessionState.DISCONNECTED) {
      if (sessionStartErrorRef.current) {
        setSessionStartError(sessionStartErrorRef.current);
        sessionStartErrorRef.current = null;
        greetingTriggeredRef.current = false;
        return;
      }
      const opts: SessionStoppedReason | undefined = wasStoppedDueToInactivity()
        ? { reason: "inactivity" }
        : undefined;
      onSessionStopped(opts);
      // Reset greeting trigger when session disconnects
      greetingTriggeredRef.current = false;
    }
  }, [sessionState, onSessionStopped, wasStoppedDueToInactivity]);

  useEffect(() => {
    if (sessionState === SessionState.INACTIVE) {
      setSessionStartError(null);
      startSession().catch((err: Error) => {
        const message = err?.message ?? "Session start failed";
        sessionStartErrorRef.current = message;
      });
    }
  }, [startSession, sessionState]);

  // Track LiveAvatar session id for lead capture + official transcript sync
  useEffect(() => {
    if (sessionState === SessionState.DISCONNECTED) {
      const sid = dbSessionIdRef.current;
      const cursor = transcriptCursorRef.current;
      dbSessionIdRef.current = null;
      transcriptCursorRef.current = null;
      lastSyncedLaSessionIdRef.current = null;
      if (sid) {
        void fetch("/api/liveavatar/session-transcript/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            liveAvatarSessionId: sid,
            ...(cursor != null ? { startTimestamp: cursor } : {}),
          }),
          keepalive: true,
        }).catch(() => {});
      }
      return;
    }
    if (sessionState === SessionState.CONNECTED && sessionRef.current?.sessionId) {
      const sid = sessionRef.current.sessionId;
      if (lastSyncedLaSessionIdRef.current !== sid) {
        transcriptCursorRef.current = null;
        lastSyncedLaSessionIdRef.current = sid;
      }
      dbSessionIdRef.current = sid;
    }
  }, [sessionState, sessionRef]);

  // Poll LiveAvatar official transcript API while connected ([Get Session Transcript](https://docs.liveavatar.com/api-reference/sessions/get-session-transcript))
  useEffect(() => {
    if (sessionState !== SessionState.CONNECTED) return;
    const sid = sessionRef.current?.sessionId;
    if (!sid) return;

    const runSync = async () => {
      const body: Record<string, unknown> = { liveAvatarSessionId: sid };
      if (transcriptCursorRef.current != null) {
        body.startTimestamp = transcriptCursorRef.current;
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
      // On home screen: stop session so parent can show start screen.
      greetingTriggeredRef.current = false; // Reset greeting trigger
      stopSession();
    } else {
      // Not on home screen: reset to home screen (keep session)
      resetToHomeScreen();
    }
  }, [isOnHomeScreen, resetToHomeScreen, stopSession]);

  // Voice chat starts only after the user taps the begin surface.
  useEffect(() => {
    if (sessionState === SessionState.DISCONNECTED) {
      voiceHeldUntilUserStartRef.current = false;
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
      setIsOnlineLookupLoading(true);
      setOnlineLookupSources([]);
      setOnlineLookupNotice("Looking online...");
      try {
        const response = await fetch("/api/online-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, location }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || typeof data?.answer !== "string") {
          throw new Error(data?.error || "Online lookup failed");
        }
        const sources = Array.isArray(data.sources)
          ? data.sources
              .filter(
                (source: unknown): source is OnlineLookupSource =>
                  Boolean(source) &&
                  typeof source === "object" &&
                  typeof (source as OnlineLookupSource).title === "string" &&
                  typeof (source as OnlineLookupSource).url === "string",
              )
              .slice(0, MAX_ONLINE_LOOKUP_SOURCE_COUNT)
          : [];
        setOnlineLookupSources(sources);
        setOnlineLookupNotice(
          sources.length > 0
            ? "Online sources ready"
            : "Online lookup complete",
        );
        const spoken =
          sources.length > 0
            ? `${data.answer} I put the source links on your screen so you can check details before you go.`
            : data.answer;
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        schedulePromptBrain(query);
        return true;
      } catch (error) {
        console.error("Online lookup failed:", error);
        const spoken =
          "I had trouble looking that up online. Try telling me the city or ZIP code again.";
        setOnlineLookupNotice("Online lookup needs location");
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
        return true;
      } finally {
        setIsOnlineLookupLoading(false);
      }
    },
    [isOnlineLookupLoading, repeat, schedulePromptBrain],
  );

  const requestSharedLocation = useCallback(async () => {
    if (!onlineLookupPendingQueryRef.current) return;
    if (!navigator.geolocation) {
      const spoken =
        "This browser is not letting me ask for location. Tell me your city or ZIP code and I'll look from there.";
      await repeat(spoken);
      lastAvatarResponseRef.current = spoken;
      lastVisionResponseTimeRef.current = Date.now();
      return;
    }

    setOnlineLookupNotice("Waiting for location permission...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = `${position.coords.latitude.toFixed(2)},${position.coords.longitude.toFixed(2)}`;
        onlineLookupLocationRef.current = location;
        setOnlineLookupNotice("Using shared location");
        const query = onlineLookupPendingQueryRef.current;
        onlineLookupPendingQueryRef.current = null;
        if (query) void performOnlineLookup(query, location);
      },
      async () => {
        const spoken =
          "No problem. Tell me your city or ZIP code instead, and I'll search around there.";
        setOnlineLookupNotice("Tell 6 your city or ZIP");
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastVisionResponseTimeRef.current = Date.now();
      },
      { enableHighAccuracy: false, maximumAge: 1000 * 60 * 10, timeout: 12000 },
    );
  }, [performOnlineLookup, repeat]);

  const handleOnlineLookupSpeech = useCallback(
    async (userText: string) => {
      const text = userText.trim();
      const pendingQuery = onlineLookupPendingQueryRef.current;
      if (pendingQuery) {
        const location =
          extractLocationHint(text) ?? (isLikelyTypedLocation(text) ? text : null);
        if (!location) return false;
        onlineLookupPendingQueryRef.current = null;
        onlineLookupLocationRef.current = location;
        return performOnlineLookup(pendingQuery, location);
      }

      if (!isOnlineLookupIntent(text)) return false;

      const location = extractLocationHint(text) ?? onlineLookupLocationRef.current;
      if (location) {
        onlineLookupLocationRef.current = location;
        return performOnlineLookup(text, location);
      }

      onlineLookupPendingQueryRef.current = text;
      setOnlineLookupSources([]);
      setOnlineLookupNotice("Share location or tell 6 a city/ZIP");
      const spoken =
        "I can look that up online. Tell me your city or ZIP code, or tap Share Location and I'll search near you.";
      await repeat(spoken);
      lastAvatarResponseRef.current = spoken;
      lastVisionResponseTimeRef.current = Date.now();
      setThoughtPrompts(
        normalizeThoughtPrompts([
          "Share Location",
          "Enter City or ZIP",
          "Plan This Weekend",
          CHANGE_SUBJECT_PROMPT,
        ]),
      );
      return true;
    },
    [performOnlineLookup, repeat],
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
        ensureAssistantList(listIntent);
      }
      const isChangeSubject = prompt === CHANGE_SUBJECT_PROMPT;

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
        if (prompt === "Share Location") {
          await requestSharedLocation();
          return;
        }
        if (prompt === "Enter City or ZIP") {
          const spoken =
            "Tell me the city or ZIP code, and I'll look online around there.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          return;
        }
        if (isChangeSubject) {
          const spoken = "Sure. New subject. What are we working on now?";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastVisionResponseTimeRef.current = Date.now();
          setThoughtPrompts(normalizeThoughtPrompts(DEFAULT_THOUGHT_PROMPTS));
          return;
        }
        if (isOnlineLookupIntent(prompt)) {
          const handledLookup = await handleOnlineLookupSpeech(prompt);
          if (handledLookup) return;
        }
        await sendMessage(`Let's work on this next: ${prompt}`);
        schedulePromptBrain(prompt);
        if (listIntent) void offerAccountSetupForMemory();
      } catch (error) {
        console.error("Failed to send thought prompt:", error);
      }
    },
    [
      dissolvingPrompt,
      ensureAudioOutputReady,
      ensureAssistantList,
      interrupt,
      handleOnlineLookupSpeech,
      isStreamReady,
      offerAccountSetupForMemory,
      repeat,
      requestSharedLocation,
      schedulePromptBrain,
      sendMessage,
      sessionState,
    ],
  );

  const handleVoiceStartStop = useCallback(async () => {
    if (isActive) {
      void interrupt();
      stop();
      setHasUserPressedVoiceStart(false);
      if (mode === "FULL") {
        stopListening();
      }
      return;
    }
    if (sessionState !== SessionState.CONNECTED || !isStreamReady) {
      return;
    }
    setVoiceStartAwaitingReady(true);
    try {
      const ok = await ensureAudioOutputReady();
      if (!ok) {
        return;
      }
      await start();
      await repeat(VOICE_START_GREETING);
      if (mode === "FULL") {
        startListening();
      }
      setHasUserPressedVoiceStart(true);
    } finally {
      setVoiceStartAwaitingReady(false);
    }
  }, [
    isActive,
    interrupt,
    repeat,
    stop,
    start,
    mode,
    startListening,
    stopListening,
    sessionState,
    isStreamReady,
    ensureAudioOutputReady,
  ]);

  const shouldShowBeginSurface =
    mode === "FULL" &&
    visionMode !== "streaming" &&
    !isCameraActive &&
    !isActive &&
    !isAvatarTalking &&
    sessionState === SessionState.CONNECTED &&
    isStreamReady &&
    !voiceStartAwaitingReady;

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
        sessionId: dbSessionIdRef.current ?? sessionRef.current?.sessionId ?? null,
        geminiAnalysis: analysis,
        problem: currentProblemRef.current || null,
      });

      // Store analysis as context for future questions (no scripted repeat prompt)
      if (mode === "FULL" && sessionRef.current) {
        const contextMessage = `You are directly viewing an image. Here's what you see: ${analysis}. When the user asks about the image, respond as if you're directly viewing it. Describe what you see naturally and confidently - you have full visibility. Never say you can't see the image, that you don't have eyes, or that you're relying on someone else's analysis. You are directly viewing this image. When user asks about the image, respond briefly (1-2 sentences). Never tell them to point a camera or offer to take a look—you already have this image.`;
        sessionRef.current.message(contextMessage);
      }

      setIsAnalyzingImage(false);
    } catch (error) {
      console.error("Error capturing and analyzing photo:", error);
      if (frameFile) {
        void captureMedia({
          file: frameFile,
          source: "camera_snapshot",
          sessionId: dbSessionIdRef.current ?? sessionRef.current?.sessionId ?? null,
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
          sessionId: dbSessionIdRef.current ?? sessionRef.current?.sessionId ?? null,
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
            sessionId: dbSessionIdRef.current ?? sessionRef.current?.sessionId ?? null,
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

    const handleUserTranscription = async (event: { text: string }) => {
      const userText = event.text.trim();
      if (isInternalSignal(userText)) {
        return;
      }

      if (hasBugReportIntent(userText)) {
        const didFileBug = await fileBugReport(userText);
        if (didFileBug) return;
      }

      if (await handleAccountSetupSpeech(userText)) {
        schedulePromptBrain(userText);
        return;
      }

      if (
        !isShoppingMode &&
        ACCOUNT_SETUP_NATURAL_MOMENT_RE.test(userText) &&
        (await offerAccountSetupForMemory())
      ) {
        schedulePromptBrain(userText);
        return;
      }

      if (await handleOnlineLookupSpeech(userText)) {
        schedulePromptBrain(userText);
        return;
      }

      if (SHOPPING_MODE_CLOSE_RE.test(userText)) {
        setIsShoppingMode(false);
        schedulePromptBrain(userText);
        return;
      }

      if (LIST_CLOSE_RE.test(userText)) {
        setActiveListId(null);
        setIsShoppingMode(false);
        schedulePromptBrain(userText);
        return;
      }

      if (LIST_NAV_NEXT_RE.test(userText)) {
        moveActiveList(1);
      } else if (LIST_NAV_PREV_RE.test(userText)) {
        moveActiveList(-1);
      }

      const listIntent = detectListIntent(userText);
      const targetListId = listIntent
        ? ensureAssistantList(listIntent)
        : activeListId;
      const enteringShoppingMode = SHOPPING_MODE_OPEN_RE.test(userText);

      if (targetListId && (LIST_TRIGGER_RE.test(userText) || activeListId)) {
        if (enteringShoppingMode) {
          setIsShoppingMode(true);
        }

        const displayStyle = detectListDisplayStyle(userText);
        if (displayStyle) {
          setListDisplayStyle(targetListId, displayStyle);
        }

        const accentColor = detectListAccentColor(userText);
        if (accentColor) {
          setListAccentColor(targetListId, accentColor);
        }

        const removeItems = extractRemoveItems(userText);
        const addItems = extractListItems(userText, {
          allowBareItems: Boolean(activeListId || listIntent),
        });
        if (removeItems.length > 0) {
          removeItemsFromList(targetListId, removeItems);
        } else if (addItems.length > 0) {
          addItemsToList(targetListId, addItems);
        }

        const changedListByVoice =
          Boolean(listIntent) ||
          Boolean(displayStyle) ||
          Boolean(accentColor) ||
          removeItems.length > 0 ||
          addItems.length > 0;
        if (
          changedListByVoice &&
          !isShoppingMode &&
          !enteringShoppingMode &&
          (await offerAccountSetupForMemory())
        ) {
          schedulePromptBrain(userText);
          return;
        }

        if (isShoppingMode || enteringShoppingMode) {
          void interrupt();
          schedulePromptBrain(userText);
          return;
        }
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
        sessionRef.current.message(contextMessage);
      }

      // Process the question using the reusable function (only in streaming mode)
      await processCameraQuestion(userText, false);
    };

    console.log(
      "Setting up USER_TRANSCRIPTION listener, vision mode:",
      visionMode,
    );
    sessionRef.current.on(
      AgentEventsEnum.USER_TRANSCRIPTION,
      handleUserTranscription,
    );

    return () => {
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
      }
    };
  }, [
    sessionRef,
    visionMode,
    processCameraQuestion,
    isRecording,
    isShoppingMode,
    interrupt,
    mode,
    repeat,
    isProcessingCameraQuestion,
    activeListId,
    addItemsToList,
    ensureAssistantList,
    fileBugReport,
    handleAccountSetupSpeech,
    handleOnlineLookupSpeech,
    moveActiveList,
    offerAccountSetupForMemory,
    removeItemsFromList,
    schedulePromptBrain,
    setListAccentColor,
    setListDisplayStyle,
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
          sessionId: dbSessionIdRef.current ?? sessionRef.current?.sessionId ?? null,
          geminiAnalysis: data.analysis,
          problem: currentProblemRef.current || null,
        });

        if (mode === "FULL" && sessionRef.current) {
          const contextMessage = `You are directly viewing a video. Here's what you see: ${data.analysis}. When the user asks about the video, respond as if you're directly viewing it. Describe what you see naturally and confidently - you have full visibility. Never say you can't see the video, that you don't have eyes, or that you're relying on someone else's analysis. You are directly viewing this video. When user asks about the video, respond briefly (1-2 sentences). Never tell them to point a camera or offer to take a look—you already have this footage.`;
          sessionRef.current.message(contextMessage);
        }

        setIsAnalyzingVideo(false);
      } catch (error) {
        console.error("Error analyzing video:", error);
        if (recordedVideoFile) {
          void captureMedia({
            file: recordedVideoFile,
            source: "video_recording",
            sessionId: dbSessionIdRef.current ?? sessionRef.current?.sessionId ?? null,
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
          sessionId: dbSessionIdRef.current ?? sessionRef.current?.sessionId ?? null,
          geminiAnalysis: data.analysis,
          problem: currentProblemRef.current || null,
        });
        console.log("Image analyzed successfully");

        // For FULL mode, send the analysis as context to the AI (no scripted repeat prompt)
        if (mode === "FULL" && sessionRef.current) {
          const contextMessage = `You are directly viewing an image. Here's what you see: ${data.analysis}. When the user asks about the image, respond as if you're directly viewing it. Describe what you see naturally and confidently - you have full visibility. Never say you can't see the image, that you don't have eyes, or that you're relying on someone else's analysis. You are directly viewing this image. When user asks about the image, respond briefly (1-2 sentences). Never tell them to point a camera or offer to take a look—you already have this image.`;
          sessionRef.current.message(contextMessage);
        }
      } catch (error) {
        console.error("Error analyzing image:", error);
        void captureMedia({
          file,
          source: "gallery_image",
          sessionId: dbSessionIdRef.current ?? sessionRef.current?.sessionId ?? null,
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
          sessionId: dbSessionIdRef.current ?? sessionRef.current?.sessionId ?? null,
          geminiAnalysis: data.analysis,
          problem: currentProblemRef.current || null,
        });

        // For FULL mode, send the analysis as context to the AI (no scripted repeat prompt)
        if (mode === "FULL" && sessionRef.current) {
          const contextMessage = `You are directly viewing a video. Here's what you see: ${data.analysis}. When the user asks about the video, respond as if you're directly viewing it. Describe what you see naturally and confidently - you have full visibility. Never say you can't see the video, that you don't have eyes, or that you're relying on someone else's analysis. You are directly viewing this video. When user asks about the video, respond briefly (1-2 sentences). Never tell them to point a camera or offer to take a look—you already have this footage.`;
          sessionRef.current.message(contextMessage);
        }
      } catch (error) {
        console.error("Error analyzing video:", error);
        void captureMedia({
          file,
          source: "gallery_video",
          sessionId: dbSessionIdRef.current ?? sessionRef.current?.sessionId ?? null,
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

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black flex flex-col">
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

      {accountNotice && !isShoppingMode && (
        <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[75] rounded-lg border border-white/12 bg-black/82 px-4 py-3 text-white shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-sm font-semibold">{accountNotice}</p>
            <button
              type="button"
              aria-label="Dismiss account notice"
              title="Dismiss account notice"
              onClick={() => setAccountNotice(null)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {accountVerificationUrl && (
            <a
              href={accountVerificationUrl}
              className="mt-2 block rounded-md bg-white px-3 py-2 text-center text-sm font-bold text-black"
            >
              Finish Account Setup
            </a>
          )}
        </div>
      )}

      {onlineLookupNotice && !isShoppingMode && (
        <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.7rem)] z-[74] rounded-lg border border-white/12 bg-black/78 px-4 py-3 text-white shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{onlineLookupNotice}</p>
              {onlineLookupSources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {onlineLookupSources.map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="max-w-[13rem] truncate rounded-full bg-white/12 px-3 py-1 text-[0.78rem] font-semibold text-[#e0aa62] underline-offset-2 hover:underline"
                    >
                      {source.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onlineLookupPendingQueryRef.current && (
                <button
                  type="button"
                  onClick={() => void requestSharedLocation()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold text-black"
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  Share Location
                </button>
              )}
              <button
                type="button"
                aria-label="Dismiss online lookup"
                title="Dismiss online lookup"
                onClick={() => {
                  onlineLookupPendingQueryRef.current = null;
                  setOnlineLookupNotice(null);
                  setOnlineLookupSources([]);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10"
              >
                <X className="h-4 w-4" aria-hidden />
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

      {/* Text overlays at the top */}
      <div className="absolute top-0 left-0 right-0 z-10 flex flex-col items-center pt-4 sm:pt-6 pb-2">
        <div className="text-center px-4">
          <div className="flex items-start justify-center">
            <h1 className="relative top-[0.28rem] inline-block bg-gradient-to-b from-[#f1c477] via-[#d7a05a] to-[#a87534] bg-clip-text text-transparent text-[2.35rem] sm:text-[3rem] font-bold tracking-normal leading-none drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)]">
              aiASAP
            </h1>
          </div>
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
        className={`relative w-full flex-1 flex items-center justify-center ${isCameraActive ? "pt-24" : ""}`}
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
              : "h-full w-full object-contain"
          }`}
        />

        {mode === "FULL" && (
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

      {shouldShowBeginSurface && (
        <button
          type="button"
          aria-label="Begin talking with 6"
          className="fixed inset-0 z-30 cursor-pointer bg-transparent"
          onClick={() => void handleVoiceStartStop()}
        />
      )}

      {/* Fixed buttons at bottom - positioned relative to viewport */}
      {mode === "FULL" && (
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

          {visionMode !== "streaming" && !isCameraActive && !isActive && (
            <div className="fixed left-1/2 bottom-[11rem] sm:bottom-[11.5rem] -translate-x-1/2 w-[94%] max-w-3xl z-20 px-3 flex flex-col items-center pointer-events-none">
              {sessionState !== SessionState.DISCONNECTED &&
                !isAvatarTalking &&
                isStreamReady && (
                  <div className="w-full flex items-center justify-center text-center">
                    <p className="text-inset drop-shadow-lg px-1 w-full max-w-none text-[1.45rem] sm:text-[1.85rem] font-semibold leading-tight text-balance">
                      {voiceStartAwaitingReady ? (
                        <span className="block">Starting…</span>
                      ) : (
                        <span className="block">Tap Anywhere to Begin</span>
                      )}
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
                      (isLoading && !isActive)
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
                    {isActive ? (
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
                    {isActive ? "Stop" : "Start"}
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

          {activeList && isShoppingMode && (
            <div
              className="fixed inset-0 z-[80] flex flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)]"
              style={{ backgroundColor: "Canvas", color: "CanvasText", colorScheme: "light dark" }}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="text-xs font-bold uppercase tracking-[0.16em]"
                    style={{ color: activeListTheme.foreground }}
                  >
                    6 Listening
                  </p>
                  <h2 className="truncate text-3xl font-black leading-tight">
                    {activeList.title}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Exit shopping mode"
                  title="Exit shopping mode"
                  onClick={() => setIsShoppingMode(false)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-current/15"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <div
                className="mb-5 h-1.5 w-full rounded-full"
                style={{ backgroundColor: activeListTheme.foreground }}
              />

              <div className="min-h-0 flex-1 overflow-y-auto">
                {activeList.items.length > 0 ? (
                  <ol className="space-y-4 text-2xl font-bold leading-tight">
                    {activeList.items.map((item, index) => (
                      <li
                        key={`${item}-${index}`}
                        className="grid min-h-[3.75rem] grid-cols-[2.4rem_1fr_3rem] items-center gap-3 border-b border-current/10 pb-3"
                      >
                        <span
                          className="text-right text-xl"
                          style={{ color: activeListTheme.foreground }}
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
                          className="flex h-11 w-11 items-center justify-center rounded-full border border-current/15"
                        >
                          <X className="h-5 w-5" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="pt-16 text-center text-2xl font-bold opacity-70">
                    Say what you need
                  </p>
                )}
              </div>
            </div>
          )}

          {visionMode !== "streaming" &&
            !isCameraActive &&
            sessionState !== SessionState.DISCONNECTED &&
            isStreamReady &&
            isActive &&
            !isShoppingMode &&
            activeList && (
              <div
                className="fixed bottom-[calc(env(safe-area-inset-bottom)+3.75rem)] left-1/2 z-30 flex h-[43vh] w-[92%] max-w-[32rem] -translate-x-1/2 flex-col rounded-[2.75rem] border border-white/10 bg-neutral-700/42 px-6 py-5 shadow-[inset_0_1px_18px_rgba(255,255,255,0.06),0_14px_36px_rgba(0,0,0,0.42)] backdrop-blur-[4px]"
                style={{ color: activeListTheme.foreground }}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="min-w-0 flex-1 truncate text-[1.45rem] font-bold leading-none drop-shadow-[0_3px_16px_rgba(30,14,0,0.9)]">
                    {activeList.title}
                  </h2>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className="rounded-full bg-black/20 px-3 py-1 text-[0.78rem] font-semibold uppercase"
                      style={{ color: activeListTheme.foreground }}
                    >
                      {activeList.items.length || 0}
                    </span>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  {activeList.items.length > 0 ? (
                    <ol className="space-y-2.5 text-[1.12rem] font-semibold leading-tight">
                      {activeList.items.map((item, index) => (
                        <li
                          key={`${item}-${index}`}
                          className="grid grid-cols-[2rem_1fr_2.25rem] items-start gap-2"
                        >
                          <span className="text-right opacity-65">
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
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/24 opacity-80 transition hover:bg-black/38 hover:opacity-100"
                          >
                            <X className="h-4 w-4" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="pt-6 text-center text-[1.2rem] font-semibold leading-snug opacity-80">
                      Say what you need
                    </p>
                  )}
                </div>
              </div>
            )}

          {visionMode !== "streaming" &&
            !isCameraActive &&
            sessionState !== SessionState.DISCONNECTED &&
            isStreamReady &&
            isActive &&
            !activeList && (
              <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+3.15rem)] left-1/2 z-30 flex w-[94%] max-w-[32rem] -translate-x-1/2 flex-col items-center gap-1.5 text-center pointer-events-none">
                {thoughtPrompts.slice(0, 4).map((prompt, index) => {
                  const isDissolving = dissolvingPrompt === prompt;
                  const compactPrompt = prompt.length > 18;
                  return (
                    <button
                      type="button"
                      key={prompt}
                      onClick={() => void handleThoughtPromptTap(prompt)}
                      disabled={Boolean(dissolvingPrompt)}
                      className={`pointer-events-auto min-h-[2.05rem] w-[min(100%,21rem)] overflow-hidden rounded-full border border-white/10 bg-neutral-600/35 px-4 py-1.5 ${compactPrompt ? "text-[0.96rem] sm:text-[1.12rem]" : "text-[1.08rem] sm:text-[1.24rem]"} whitespace-nowrap text-ellipsis font-semibold leading-none text-[#e0aa62] shadow-[inset_0_1px_10px_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-[3px] drop-shadow-[0_3px_16px_rgba(30,14,0,0.9)] transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none ${
                        isDissolving
                          ? "animate-prompt-dissolve"
                          : "animate-prompt-enter"
                      }`}
                      style={{
                        animationDelay: `${index * 80}ms`,
                        fontFamily:
                          '"Trebuchet MS", "Aptos", "Segoe UI", system-ui, sans-serif',
                      }}
                    >
                      {prompt}
                    </button>
                  );
                })}
              </div>
            )}

          {visionMode !== "streaming" && !isCameraActive && !isShoppingMode && (
            <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.45rem)] left-1/2 -translate-x-1/2 z-40 flex items-center justify-center pointer-events-auto">
              <Link
                href="/terms"
                target="_blank"
                className="block text-center text-[10px] sm:text-[11px] text-[#d7a05a]/70 hover:text-[#d7a05a] transition-colors whitespace-nowrap"
              >
                &copy; 2026 aiASAP All Rights Reserved &middot; Terms
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
    <LiveAvatarContextProvider sessionAccessToken={sessionAccessToken}>
      <LiveAvatarSessionComponent
        mode={mode}
        onSessionStopped={onSessionStopped}
        onExit={onExit}
      />
    </LiveAvatarContextProvider>
  );
};
