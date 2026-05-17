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
import { extractContactDetails } from "../lib/contactExtraction";
import { X } from "lucide-react";

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

const VOICE_START_GREETING =
  "Hi, I'm 6, your a-i-buddy. You know why they call me 6? 'Cuz I got your back. So how can I make your life a little bit better today?";
const SESSION_END_CONFIRMATION_MESSAGE =
  "Want me to close this session? Say stop or close to end it, or keep going.";
const LIST_CLOSE_EDUCATION =
  "If you want this list off the screen, just ask me to close the list.";
const LIST_MULTI_NAV_EDUCATION =
  "You have more than one list now. Swipe left or right with your thumb to move between lists, or just ask me to switch lists for you.";
const ACCOUNT_BETA_DISABLED = true;
const BETA_FRESH_START_EVERY_SESSION = true;
// Ask on 6's third total banter line: the fixed intro is line 1, one normal 6 reply is line 2, then line 3 ends with the name ask.
const NAME_PROMPT_MIN_MEANINGFUL_TURNS = 2;
const NAME_PROMPT_RETRY_AFTER_TURNS = 7;
const NAME_USE_MIN_TURNS = 6;
const NAME_USE_TURN_WINDOW = 5;
const NAME_PROMPT_TEXT = "Oh, by the way, what should I call you?";
const NAME_PROMPT_RETRY_TEXT = "Before I forget, what should I call you?";
const buildNameCaptureAck = (name: string) =>
  `Well howdy, ${name}. I'm Six. It's the number six, not the word. It's a pleasure to meet you. What would make today easier?`;
const PRIVATE_GUIDANCE_RE = /\s*\[Private guidance for 6:[\s\S]*?\]\s*/gi;

const ACCOUNT_MEMORY_VALUE_LINES = [
  "With an account, your lists stay intact, I remember the last conversation, and we pick up where we left off every time.",
  "That account is how I remember your likes, dislikes, lists, and the thread of the conversation instead of acting like we just met.",
  "If you've got a phone, you've got a friend. The account is what lets me remember you next time.",
  "When you create an account, I will remember everything you ask me to keep.",
];

const RETURNING_GREETING_OPTIONS = [
  "Hey{name}, good to see you. What are we working on today?",
  "Welcome back{name}. What's going on today?",
  "{namePrefix}I'm here. What do you want to tackle first?",
  "Good to see you{name}. Where should we pick up?",
];

const DEFAULT_THOUGHT_PROMPTS = [
  "Build Relationships",
  "Create Financial Freedom",
  "Set & Track Goals",
  "Build Your Socials",
];
const GENERAL_ROTATING_PROMPTS = [
  "Create a Shopping List",
  "Build a Better Life",
  "Make More Money",
  "Find Your Life Partner",
  "Build a Business",
  "Build Friendships",
  "Build Your Brand",
  "Market Yourself",
  "Create Walmart List",
  "Create To Do List",
  "Plan Your Weekend",
  "Market Your Product",
  "Market Your Service",
  "Next Vacation Ideas",
];
const GENERAL_OPENING_LEADS = [
  ...DEFAULT_THOUGHT_PROMPTS,
  ...GENERAL_ROTATING_PROMPTS,
];

function defaultThoughtPromptsForNow(): string[] {
  return DEFAULT_THOUGHT_PROMPTS;
}

const BROAD_MIXED_PROMPTS = [
  "Build Relationships",
  "Create Financial Freedom",
  "Set & Track Goals",
  "Build Your Socials",
];
const EARLY_BUSINESS_PROMPTS = [
  "Business Ideas",
  "Likes and Loves",
  "Your Passions",
  "What You're Good At",
];
const AI_CONSULTANT_PROMPTS = [
  "AI Service Ideas",
  "Pick Customer Type",
  "Choose First Service",
  "Write First Pitch",
];
const BUSINESS_PROMPTS = EARLY_BUSINESS_PROMPTS;
const FRIENDSHIP_PROMPTS = [
  "Meet New People",
  "Find a Hobby",
  "Reconnect With Someone",
  "Find Local Groups",
];
const RELATIONSHIP_GOAL_PROMPTS = [
  "Choose One Relationship",
  "Be Fully Honest",
  "Own Your Part",
  "Plan Better Talk",
];
const SOCIAL_PROMPTS = [
  "Build Full Brand",
  "Create Content",
  "Link Accounts",
  "Post Everywhere",
];
const BRAND_PROMPTS = [
  "Build Your Brand",
  "Market Yourself",
  "Define Your Audience",
  "Write First Post",
];
const BETTER_LIFE_PROMPTS = [
  "Set & Track Goals",
  "Make More Money",
  "Fix One Problem",
  "Make Action Plan",
];
const HEALTHY_FOOD_PROMPTS = [
  "Cut Sugar Plan",
  "Find Hidden Sugar",
  "Plan Better Snacks",
  "Swap Unhealthy Foods",
];
const MONEY_PROMPTS = [
  "Create Financial Freedom",
  "Start Side Hustle",
  "Cut Waste",
  "Invest for Future",
];
const SIDE_HUSTLE_PROMPTS = [
  "Side Hustle Ideas",
  "Use Your Skills",
  "Pick First Offer",
  "Find First Buyer",
];
const WEEKEND_PROMPTS = [
  "Cool Stuff to Do",
  "Go on a Hike",
  "Find a Great Movie",
  "Find Local Events",
];
const HIKING_PROMPTS = [
  "Find Places to Hike",
  "Check the Weather",
  "Give ZIP Code",
  "Easy Places to Hike",
];
const LIST_START_CHOICE_PROMPTS = [
  "Create a Shopping List",
  "Create To Do List",
  "Create Walmart List",
  "Create Another List",
];
const GROCERY_LIST_PROMPTS = LIST_START_CHOICE_PROMPTS;
const TODO_LIST_PROMPTS = LIST_START_CHOICE_PROMPTS;
const ACTIVE_LIST_THOUGHT_PROMPTS = [
  "Add Item",
  "Remove Item",
  "Store Mode",
  "Close List",
];
const IMMEDIATE_DEFAULT_PROMPTS_RE =
  /\b(?:weekend plans?|plan (?:my|your|this|the)? weekend|date night ideas?|local hikes?|nearby events?|sugar|unhealthy foods?|healthy foods?|diet|snacks?|adjust box spacing|compare font sizes|review layout options|optimize text alignment)\b/i;
const DATING_CONTEXT_RE =
  /\b(?:find your life partner|get that guy|get that girl|win them over|plan first message|ask them out|plan a date|boyfriend|girlfriend|crush|dating|date night|date ideas|romantic|romance|ask (?:him|her|them) out|win (?:him|her|them) over|life partner|future partner|talking about (?:a\s+)?(?:girl|woman|guy|man)|(?:girl|woman|guy|man)\s+i\s+like)\b/i;
const RELATIONSHIP_GOALS_CONTEXT_RE =
  /\b(?:set relationship goals?|relationship goals?|relationship conflict|conflict with|fighting with|fight(?:ing)? with|argu(?:e|ing|ment)s? with|having (?:a\s+)?fight|having (?:an\s+)?argument|not speaking|mad at|angry with|upset with|improve (?:a|my|our|the)? relationship|relationship with (?:my|our|their)?\s*(?:parent|parents|mom|mother|dad|father|kid|kids|child|children|son|daughter|spouse|wife|husband|partner|boyfriend|girlfriend|friend|friends|family|sibling|brother|sister|coworker|boss|neighbor)|family relationships?)\b/i;
const AI_CONSULTANT_CONTEXT_RE =
  /\b(?:ai consultant|ai consulting|ai strategy|ai service|ai services|ai boom|technology and ai)\b/i;
const BUSINESS_CONTEXT_RE =
  /\b(?:build (?:a|my|the)? business|business ideas|likes and loves|your passions|what you're good at|business|company|startup|mom and pop|small business|local business|first customer|first sale)\b/i;
const FRIENDSHIP_CONTEXT_RE =
  /\b(?:build friendships|build relationships\/friends|build relationships|make friends|make more friends|find local groups|meet new people|reconnect with someone|relationships?|friends?|friendship|lonely|loneliness|meet people|social life|human to human|community|real people|in person)\b/i;
const SOCIAL_CONTEXT_RE =
  /\b(?:build your socials|pick platforms|plan content|write first post|social media|socials\b|instagram|facebook|tiktok|youtube|linkedin|followers?|audience|content)\b/i;
const BRAND_CONTEXT_RE =
  /\b(?:build your brand|market yourself|personal brand|branding|brand strategy|reputation|positioning)\b/i;
const MARKETING_CONTEXT_RE =
  /\b(?:market your product|market your service|find best customer|find best buyer|write service offer|write product pitch|market yourself|market|marketing|product|service|sales pitch|offer|buyer|customer)\b/i;
const BETTER_LIFE_CONTEXT_RE =
  /\b(?:life builder|life building|build my life|build your life|build a better life|set\s*(?:\/|&)\s*track (?:life )?goals?|set goals?|track goals?|set (?:life|relationship|business|money|social|health|family|work|personal|career|fitness|home) goals?|set main goal|fix one problem|make action plan|better life|improve my life|improve their life|goals?|stability|happier|happy|habits?|health|family|home|work|get organized|organized|fix my life)\b/i;
const HEALTHY_FOOD_CONTEXT_RE =
  /\b(?:cut sugar|less sugar|reduce sugar|getting rid of sugar|eliminat(?:e|ing) sugar|hidden sugar|sugary foods?|unhealthy foods?|healthy foods?|healthy alternatives?|food swaps?|snacks?|better snacks?|diet)\b/i;
const MONEY_CONTEXT_RE =
  /\b(?:make more money|build financial freedom|create financial freedom|financial freedom|financial independence|cut waste|invest for future|money|income|revenue|earn|earning|paid|profit)\b/i;
const SIDE_HUSTLE_CONTEXT_RE =
  /\b(?:side hustle|starting a side hustle|start a side hustle|start side hustle|side business|first offer|first buyer|pick first offer|find first buyer|use your skills)\b/i;
const LIFE_GOALS_CONTEXT_RE =
  /\b(?:set\s*(?:\/|&)\s*track (?:life )?goals?|set life goals?|track life goals?|life goals?)\b/i;
const WEEKEND_CONTEXT_RE =
  /\b(?:plan your weekend|find nearby events|plan the day|pick best option|make weekend list|weekend plans?|plan (?:my|your|this|the)? weekend|nearby events?|local events?|cool things to do|cool stuff(?: to do)?|things to do|great movies?|movies?)\b/i;
const HIKING_CONTEXT_RE =
  /\b(?:find places to hike|easy places to hike|easy hikes|hike|hikes|hiking|trail|trails|park|parks|outside|outdoor|outdoors|waterfall|waterfalls)\b/i;
const LIST_TOPIC_CONTEXT_RE =
  /\b(?:create a shopping list|create a to[-\s]?do list|add item|remove item|store mode|open another list|close list|to[-\s]?do|todo|task|shopping|grocery|groceries|walmart|home depot|list)\b/i;
const BROAD_PROMPT_MIX_FEEDBACK_RE =
  /\b(?:main prompts?|initial prompts?|top four|first four|all\s+(?:4|four)\s+together|coming up too much|mix\s+(?:them|it|a\s+build|build a better life)|make more money.{0,90}(?:number|first|second|forth|fourth)|number\s+(?:1|2).{0,90}make more money)\b/i;

function contextualListIntentForText(
  text: string,
): { title: string; kind: AssistantListKind } | null {
  if (/\b(?:shopping|grocery|groceries|store)\s+list\b/i.test(text)) {
    return { title: "Shopping List", kind: "shopping" };
  }
  if (/\bwalmart\s+list\b/i.test(text)) {
    return { title: "Walmart List", kind: "shopping" };
  }
  if (/\b(?:to[-\s]?do|todo|task)s?\s+list\b/i.test(text)) {
    return { title: "To Do List", kind: "todo" };
  }
  if (/\bhoney[-\s]?do\s+list\b/i.test(text)) {
    return { title: "Honey-do List", kind: "todo" };
  }
  if (/\b(?:weekend(?:\s+planning)?|plan(?:ning)?\s+(?:my|your|this|the)?\s*weekend)\s+list\b/i.test(text)) {
    return { title: "Plan Your Weekend", kind: "custom" };
  }
  if (
    /\b(?:make more money|build financial freedom|create financial freedom|financial freedom|more money|money goals?|income|side hustle|earn(?:ing)?|paid|profit|first sale|sell(?:ing)?|sales?)\b/i.test(
      text,
    )
  ) {
    return {
      title: /\b(?:build|create)?\s*financial freedom\b/i.test(text)
        ? "Create Financial Freedom"
        : "Make More Money",
      kind: "custom",
    };
  }
  if (LIFE_GOALS_CONTEXT_RE.test(text)) {
    return { title: "Goals", kind: "custom" };
  }
  if (/\b(?:build a better life|better life|improve my life|fix my life)\b/i.test(text)) {
    return { title: "Build a Better Life", kind: "custom" };
  }
  if (BUSINESS_CONTEXT_RE.test(text)) return { title: "Build a Business", kind: "custom" };
  if (BRAND_CONTEXT_RE.test(text)) return { title: "Build Your Brand", kind: "custom" };
  if (SOCIAL_CONTEXT_RE.test(text)) return { title: "Build Your Socials", kind: "custom" };
  if (RELATIONSHIP_GOALS_CONTEXT_RE.test(text)) {
    return { title: "Set Relationship Goals", kind: "custom" };
  }
  if (DATING_CONTEXT_RE.test(text)) return { title: "Find Your Life Partner", kind: "custom" };
  if (WEEKEND_CONTEXT_RE.test(text)) return { title: "Plan Your Weekend", kind: "custom" };
  return null;
}

function isNewListNameObservation(text: string): boolean {
  return /\b(?:called|named|says?|show(?:s|ed|ing)?|title(?:d)?|labeled)\s+(?:the\s+)?(?:new|another|nother|different|other)\s+list\b|\bit'?s\s+just\s+called\s+(?:new|another|nother|different|other)\s+list\b/i.test(
    text,
  );
}

function relationshipPromptsForContext(text: string): string[] {
  const targetPrompt =
    /\b(?:guy|boyfriend|him)\b/i.test(text)
      ? "Get That Guy"
      : /\b(?:girl|girlfriend|her)\b/i.test(text)
        ? "Get That Girl"
        : "Win Them Over";
  return [targetPrompt, "Plan First Message", "Ask Them Out", "Plan a Date"];
}

function getFocusedThoughtPrompts(text: string): string[] | null {
  if (BROAD_PROMPT_MIX_FEEDBACK_RE.test(text)) return BROAD_MIXED_PROMPTS;
  if (RELATIONSHIP_GOALS_CONTEXT_RE.test(text)) return RELATIONSHIP_GOAL_PROMPTS;
  if (DATING_CONTEXT_RE.test(text)) return relationshipPromptsForContext(text);
  if (AI_CONSULTANT_CONTEXT_RE.test(text)) return AI_CONSULTANT_PROMPTS;
  if (FRIENDSHIP_CONTEXT_RE.test(text)) return FRIENDSHIP_PROMPTS;
  if (WEEKEND_CONTEXT_RE.test(text)) return WEEKEND_PROMPTS;
  if (SIDE_HUSTLE_CONTEXT_RE.test(text)) return SIDE_HUSTLE_PROMPTS;
  if (BUSINESS_CONTEXT_RE.test(text)) return BUSINESS_PROMPTS;
  if (BRAND_CONTEXT_RE.test(text)) return BRAND_PROMPTS;
  if (SOCIAL_CONTEXT_RE.test(text)) return SOCIAL_PROMPTS;
  if (MARKETING_CONTEXT_RE.test(text)) {
    return /\bservice\b/i.test(text)
      ? ["Market Your Service", "Find Best Customer", "Write Service Offer", "Plan First Sale"]
      : ["Market Your Product", "Find Best Buyer", "Write Product Pitch", "Plan First Sale"];
  }
  if (HEALTHY_FOOD_CONTEXT_RE.test(text)) return HEALTHY_FOOD_PROMPTS;
  if (BETTER_LIFE_CONTEXT_RE.test(text)) return BETTER_LIFE_PROMPTS;
  if (MONEY_CONTEXT_RE.test(text)) return MONEY_PROMPTS;
  if (HIKING_CONTEXT_RE.test(text)) return HIKING_PROMPTS;
  if (LIST_TOPIC_CONTEXT_RE.test(text)) {
    return /\b(?:grocery|groceries|shopping|walmart|store)\b/i.test(text)
      ? GROCERY_LIST_PROMPTS
      : TODO_LIST_PROMPTS;
  }
  return null;
}

function keepExploreAiASAPLow(prompts: string[]): string[] {
  const explore = prompts.find((prompt) => /^explore\s+aiasap$/i.test(prompt));
  if (!explore) return prompts;
  return [
    ...prompts.filter((prompt) => !/^explore\s+aiasap$/i.test(prompt)),
    "Explore aiASAP",
  ];
}

type TapPromptFontVariant = "default" | "rounded" | "classic" | "condensed";

const CTA_GOUDY_FONT_STACK =
  '"Goudy Old Style", "Goudy Old Style Bold", "Sorts Mill Goudy", Georgia, serif';

const TAP_PROMPT_FONT_OPTIONS: Record<TapPromptFontVariant, React.CSSProperties> = {
  default: {
    fontFamily: CTA_GOUDY_FONT_STACK,
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

const PROMPT_SIZE_REQUEST_RE =
  /\b(?:make|show|turn)\s+(?:the\s+)?prompts?\s+(?:bigger|larger|easier to read)|\b(?:bigger|larger)\s+prompts?\b|\breading glasses\b/i;

const getThoughtPrompts = (text: string): string[] => {
  const value = text.toLowerCase();
  const focusedPrompts = getFocusedThoughtPrompts(text);
  if (focusedPrompts) return focusedPrompts;

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
      "Add Next Task",
    ];
  }

  if (value.includes("birthday")) {
    return [
      "Birthday Gift List",
      "Plan a Gift",
      "Birthday To Do",
      "Write Birthday Message",
    ];
  }

  if (value.includes("anniversary")) {
    return [
      "Anniversary Gift List",
      "Plan a Gift",
      "Anniversary To Do",
      "Write Love Note",
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
      value.includes("walmart") ? "Open Walmart List" : "Create a Shopping List",
      "Create To Do List",
      "Close List",
      "Open Another List",
    ];
  }

  if (
    value.includes("find your life partner") ||
    value.includes("date night") ||
    value.includes("date ideas") ||
    value.includes("dating") ||
    value.includes("romantic") ||
    value.includes("romance") ||
    value.includes("boyfriend") ||
    value.includes("girlfriend") ||
    value.includes("crush") ||
    value.includes("ask him out") ||
    value.includes("ask her out") ||
    value.includes("ask them out") ||
    value.includes("win him over") ||
    value.includes("win her over") ||
    value.includes("win them over") ||
    /\b(?:life partner|future partner)\b/i.test(value)
  ) {
    const targetPrompt =
      /\b(?:guy|boyfriend|him)\b/i.test(value)
        ? "Get That Guy"
        : /\b(?:girl|girlfriend|her)\b/i.test(value)
          ? "Get That Girl"
          : "Win Them Over";
    return [
      targetPrompt,
      "Plan First Message",
      "Ask Them Out",
      "Plan a Date",
    ];
  }

  if (
    value.includes("ai consultant") ||
    value.includes("ai consulting") ||
    value.includes("ai strategy") ||
    value.includes("ai service") ||
    value.includes("ai services") ||
    value.includes("ai boom") ||
    value.includes("technology and ai")
  ) {
    return AI_CONSULTANT_PROMPTS;
  }

  if (
    value.includes("build a business") ||
    value.includes("build my business") ||
    value.includes("business") ||
    value.includes("company") ||
    value.includes("startup")
  ) {
    return BUSINESS_PROMPTS;
  }

  if (
    value.includes("build friendships") ||
    value.includes("build relationships/friends") ||
    value.includes("build relationships") ||
    value.includes("make friends") ||
    value.includes("make more friends") ||
    value.includes("friends") ||
    value.includes("friendship") ||
    value.includes("lonely") ||
    value.includes("loneliness") ||
    value.includes("meet people") ||
    value.includes("social life") ||
    value.includes("human to human") ||
    value.includes("community")
  ) {
    return FRIENDSHIP_PROMPTS;
  }

  if (
    value.includes("weekend") ||
    value.includes("cool stuff") ||
    value.includes("things to do") ||
    value.includes("great movie") ||
    value.includes("movie") ||
    value.includes("nearby event") ||
    value.includes("local event")
  ) {
    return WEEKEND_PROMPTS;
  }

  if (
    value.includes("hike") ||
    value.includes("hiking") ||
    value.includes("trail") ||
    value.includes("park") ||
    value.includes("outside") ||
    value.includes("outdoor")
  ) {
    return HIKING_PROMPTS;
  }

  if (
    value.includes("build your brand") ||
    value.includes("market yourself") ||
    value.includes("personal brand") ||
    value.includes("brand strategy") ||
    value.includes("branding")
  ) {
    return BRAND_PROMPTS;
  }

  if (
    value.includes("social") ||
    value.includes("instagram") ||
    value.includes("facebook") ||
    value.includes("tiktok") ||
    value.includes("youtube") ||
    value.includes("linkedin")
  ) {
    return SOCIAL_PROMPTS;
  }

  if (
    value.includes("market") ||
    value.includes("marketing") ||
    value.includes("product") ||
    value.includes("service")
  ) {
    return value.includes("service")
      ? [
          "Market Your Service",
          "Find Best Customer",
          "Write Service Offer",
          "Plan First Sale",
        ]
      : [
          "Market Your Product",
          "Find Best Buyer",
          "Write Product Pitch",
          "Plan First Sale",
        ];
  }

  if (
    value.includes("side hustle") ||
    value.includes("side business") ||
    value.includes("first offer") ||
    value.includes("first buyer") ||
    value.includes("use your skills")
  ) {
    return SIDE_HUSTLE_PROMPTS;
  }

  if (
    value.includes("money") ||
    value.includes("income") ||
    value.includes("revenue") ||
    value.includes("financial freedom") ||
    value.includes("financial independence")
  ) {
    return MONEY_PROMPTS;
  }

  if (
    value.includes("better life") ||
    value.includes("set/track goals") ||
    value.includes("set & track goals") ||
    value.includes("set/track life goals") ||
    value.includes("set & track life goals") ||
    value.includes("set life goals") ||
    value.includes("track life goals")
  ) {
    return BETTER_LIFE_PROMPTS;
  }

  return DEFAULT_THOUGHT_PROMPTS;
};

function directStarterForThoughtPrompt(
  prompt: string,
): { spoken: string; prompts: string[] } | null {
  const normalized = prompt.trim().toLowerCase();
  const specificGoalMatch = normalized.match(
    /^set (life|relationship|business|money|social|health|family|work|personal|career|fitness|home) goals?$/,
  );

  if (normalized === "build a better life") {
    return {
      spoken:
        "Let's build a better life. That's a major part of aiASAP. The heart is getting useful AI to people as soon as possible and making it feel easy. Pick one thing first: health, money, relationships, home, work, or getting organized. What do you want to make better?",
      prompts: BETTER_LIFE_PROMPTS,
    };
  }
  if (
    normalized === "set/track goals" ||
    normalized === "set & track goals" ||
    normalized === "set/track life goals" ||
    normalized === "set & track life goals" ||
    normalized === "set life goals" ||
    normalized === "set goals"
  ) {
    return {
      spoken:
        "Let's set and track goals. I can help you think them through and work them into steps right here. What is one part of your life you want to make better first?",
      prompts: BETTER_LIFE_PROMPTS,
    };
  }
  if (specificGoalMatch) {
    const area = specificGoalMatch[1];
    const areaLabel = area.charAt(0).toUpperCase() + area.slice(1);
    if (area === "relationship") {
      return {
        spoken:
          "I can help you work on that relationship, but you have to be absolutely honest with me, including your part. Who is this with first: spouse, parent, child, friend, coworker, or someone else?",
        prompts: RELATIONSHIP_GOAL_PROMPTS,
      };
    }
    return {
      spoken: `Let's set ${area} goals. What is the first thing you want to improve there?`,
      prompts: [
        `Set ${areaLabel} Goals`,
        "Pick First Goal",
        "Plan First Step",
        "Make Action Plan",
      ],
    };
  }
  if (normalized === "set main goal") {
    return {
      spoken:
        "Let's set one main life goal. What part of your life would make the biggest difference if we improved it first?",
      prompts: BETTER_LIFE_PROMPTS,
    };
  }
  if (normalized === "be fully honest") {
    return {
      spoken:
        "Good. Tell me the truth as plainly as you can: what happened, what did they do, and what did you do?",
      prompts: RELATIONSHIP_GOAL_PROMPTS,
    };
  }
  if (normalized === "choose one relationship" || normalized === "pick one person") {
    return {
      spoken:
        "Let's choose the one relationship to work on first. Who is this with: spouse, parent, child, friend, coworker, or someone else?",
      prompts: RELATIONSHIP_GOAL_PROMPTS,
    };
  }
  if (normalized === "own your part") {
    return {
      spoken:
        "Let's look at your part honestly. What did you say or do that may have made it worse?",
      prompts: RELATIONSHIP_GOAL_PROMPTS,
    };
  }
  if (normalized === "plan better talk") {
    return {
      spoken:
        "Let's plan the next conversation. What do you want them to understand, and what are you willing to hear from them?",
      prompts: RELATIONSHIP_GOAL_PROMPTS,
    };
  }
  if (normalized === "fix one problem") {
    return {
      spoken:
        "Let's fix one problem. Tell me the one thing that keeps bothering you, and we will break it into a simple next step.",
      prompts: BETTER_LIFE_PROMPTS,
    };
  }
  if (normalized === "make action plan") {
    return {
      spoken:
        "Let's make an action plan. Tell me the goal, and I will help turn it into a few clear steps.",
      prompts: BETTER_LIFE_PROMPTS,
    };
  }
  if (normalized === "build your socials") {
    return {
      spoken:
        "Let's build your socials. The Codex-powered aiASAP system can help build the whole machine: choose platforms, build the entire brand, make gorgeous artwork, create content, set up a social command center, and prepare the account-linking and posting workflow that is coming soon. You drive the bus: you steer, hit the gas, hit the brakes, approve permissions, and keep final control before anything connects or posts. Where should we start: brand, artwork, content, command center, or account setup?",
      prompts: SOCIAL_PROMPTS,
    };
  }
  if (normalized === "build full brand") {
    return {
      spoken:
        "Let's build the full brand. Tell me what you want people to feel, know, and remember when they see you online.",
      prompts: SOCIAL_PROMPTS,
    };
  }
  if (normalized === "create content") {
    return {
      spoken:
        "Let's create content. Tell me what you do, who you want to reach, and what result you want from the next post.",
      prompts: SOCIAL_PROMPTS,
    };
  }
  if (normalized === "link accounts") {
    return {
      spoken:
        "Account linking is coming soon. I can help get the setup plan ready across the platforms you want, and when linking is available you will still control logins, permissions, account ownership, and final approvals before anything connects or posts.",
      prompts: SOCIAL_PROMPTS,
    };
  }
  if (normalized === "post everywhere") {
    return {
      spoken:
        "Assisted posting is coming soon. I can help prepare platform-ready posts now, and when posting is live you stay in charge of the wheel, the gas, the brake, and final approval before anything publishes.",
      prompts: SOCIAL_PROMPTS,
    };
  }
  if (normalized === "build your brand") {
    return {
      spoken:
        "Let's build your brand. What do you want people to know you for first?",
      prompts: BRAND_PROMPTS,
    };
  }
  if (normalized === "market yourself") {
    return {
      spoken:
        "Let's market yourself clearly. What do you want people to understand about who you are and what you do?",
      prompts: BRAND_PROMPTS,
    };
  }
  if (normalized === "pick platforms") {
    return {
      spoken:
        "Let's pick platforms. Tell me what you do and who you want to reach, and I will help choose where to focus first.",
      prompts: SOCIAL_PROMPTS,
    };
  }
  if (normalized === "plan content") {
    return {
      spoken:
        "Let's plan content. What do you want people to know you for?",
      prompts: SOCIAL_PROMPTS,
    };
  }
  if (normalized === "write first post") {
    return {
      spoken:
        "Let's write the first post. Tell me what you want to say, even roughly, and I will shape it.",
      prompts: SOCIAL_PROMPTS,
    };
  }
  if (normalized === "build a business") {
    return {
      spoken:
        "Let's build a business. Start with what you love, what you're good at, or what people already ask you for help with.",
      prompts: BUSINESS_PROMPTS,
    };
  }
  if (normalized === "business ideas") {
    return {
      spoken:
        "Let's find business ideas. What do you love doing, what are you good at, and what problems do people ask you to solve?",
      prompts: BUSINESS_PROMPTS,
    };
  }
  if (normalized === "likes and loves" || normalized === "your passions") {
    return {
      spoken:
        "Good place to start. Tell me a few things you love, even if they seem random.",
      prompts: BUSINESS_PROMPTS,
    };
  }
  if (normalized === "what you're good at") {
    return {
      spoken:
        "Tell me what you're good at. Work skills, people skills, hobbies, anything other people notice.",
      prompts: BUSINESS_PROMPTS,
    };
  }
  if (normalized === "make more money") {
    return {
      spoken:
        "Let's work on making more money. What do you know how to do, what do you enjoy, or what could you sell or help people with?",
      prompts: MONEY_PROMPTS,
    };
  }
  if (normalized === "cut waste" || normalized === "invest for future") {
    return {
      spoken:
        "Let's work on financial freedom. We can look at what comes in, what leaks out, and what can grow over time.",
      prompts: MONEY_PROMPTS,
    };
  }
  if (
    normalized === "start side hustle" ||
    normalized === "side hustle ideas" ||
    normalized === "use your skills" ||
    normalized === "pick first offer" ||
    normalized === "find first buyer"
  ) {
    return {
      spoken:
        "Let's work on a side hustle. We can start with ideas, your skills, a first offer, or the first person who might buy it.",
      prompts: SIDE_HUSTLE_PROMPTS,
    };
  }
  if (
    normalized === "build financial freedom" ||
    normalized === "create financial freedom"
  ) {
    return {
      spoken:
        "Let's work on financial freedom. Money is a tool for safety, options, generosity, and building the life you want. What would change first if money felt less tight?",
      prompts: MONEY_PROMPTS,
    };
  }
  if (
    normalized === "build friendships" ||
    normalized === "build relationships/friends" ||
    normalized === "build relationships" ||
    normalized === "make friends" ||
    normalized === "make more friends"
  ) {
    return {
      spoken:
        "Let's build friendships. Do you want to meet new people, find a hobby, reconnect with someone, or find local groups?",
      prompts: FRIENDSHIP_PROMPTS,
    };
  }
  if (normalized === "find your life partner") {
    return {
      spoken:
        "Let's think about finding your life partner in a respectful, real way. Are you trying to meet someone new, talk to someone specific, or get clearer on who is right for you?",
      prompts: ["Find Your Life Partner", "Meet New People", "Plan First Message", "Plan a Date"],
    };
  }
  if (HEALTHY_FOOD_CONTEXT_RE.test(prompt)) {
    return {
      spoken:
        "Let's focus on the food goal. Are you trying to cut sugar, find hidden sugar, plan better snacks, or swap out unhealthy foods first?",
      prompts: HEALTHY_FOOD_PROMPTS,
    };
  }

  return null;
}

function socialFeatureExplanationForSpeech(
  text: string,
  contextText: string,
): { spoken: string; prompts: string[] } | null {
  const value = stripDirect6Address(text)
    .replace(/\byou\s+know\b/gi, " ")
    .replace(/[\u2013\u2014-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!value) return null;

  if (
    /\bwhat\s+does\b.{0,60}\bbuild\s+your\s+socials\b.{0,30}\bmean\b/i.test(
      value,
    )
  ) {
    return directStarterForThoughtPrompt("Build Your Socials");
  }

  if (
    /\bwhat\s+does\b.{0,60}\blink\s+accounts\b.{0,30}\bmean\b/i.test(value) ||
    /\blink\s+accounts\b.{0,40}\bmean\b/i.test(value)
  ) {
    return {
      spoken:
        "Link Accounts means getting your social accounts ready to connect to aiASAP. That connection feature is coming soon. I can help plan the setup now, and when it is available you will approve accounts, permissions, and posts before anything connects or publishes.",
      prompts: SOCIAL_PROMPTS,
    };
  }

  if (
    /\b(?:so\s+)?(?:you|we)\s+can\s+do\s+that\b/i.test(value) &&
    /\b(?:link accounts|account linking|build your socials|social media|post everywhere|social accounts)\b/i.test(
      contextText,
    )
  ) {
    return {
      spoken:
        "That feature is coming soon. I can help prepare the brand, content, artwork, calendar, and account-linking plan now. When account linking and posting are live, you approve permissions and final posts before anything happens.",
      prompts: SOCIAL_PROMPTS,
    };
  }

  return null;
}

function isBuildPromptLabel(prompt: string): boolean {
  return /^build\b/i.test(prompt.trim());
}

function balanceBuildPromptMix(prompts: string[]): string[] {
  const unique = prompts.filter((prompt, index, all) => all.indexOf(prompt) === index);
  const firstFour = unique.slice(0, DEFAULT_THOUGHT_PROMPTS.length);
  if (firstFour.join("\n") === DEFAULT_THOUGHT_PROMPTS.join("\n")) {
    return firstFour;
  }
  const selected: string[] = [];
  let buildCount = 0;

  for (const prompt of unique) {
    if (selected.length >= 4) break;
    const isBuildPrompt = isBuildPromptLabel(prompt);
    if (isBuildPrompt && buildCount >= 2) continue;
    if (isBuildPrompt && selected.length > 0 && isBuildPromptLabel(selected[selected.length - 1])) {
      continue;
    }
    selected.push(prompt);
    if (isBuildPrompt) buildCount += 1;
  }

  if (selected.length < 4) {
    for (const prompt of unique) {
      if (selected.length >= 4) break;
      if (selected.includes(prompt) || isBuildPromptLabel(prompt)) continue;
      selected.push(prompt);
    }
  }

  return selected.slice(0, 4);
}

function normalizeThoughtPrompts(prompts: string[]): string[] {
  const cleanThoughtPrompt = (prompt: string) => {
    const cleaned = prompt
      .trim()
      .replace(/\bAI\s+ASAP\b/g, "aiASAP")
      .replace(/\bai[-\s]?asap\b/gi, "aiASAP")
      .replace(/\bBuild\s+Relationships\s*\/\s*Friends\b/gi, "Build Friendships")
      .replace(/\bBuild\s+Relationships\s+(?:and|&)\s+Friends\b/gi, "Build Friendships")
      .replace(/\bMake\s+Friends\b/gi, "Build Friendships")
      .replace(/\bMake\s+More\s+Friends\b/gi, "Build Friendships")
      .replace(/\bPick\s+One\s+Person\b/gi, "Choose One Relationship")
      .replace(/\bFind\s+(?:a|the)\s+Life\s+Partner\b/gi, "Find Your Life Partner")
      .replace(/\bSet\s*(?:\/|&)\s*Track\s+(?:Life\s+)?Goals\b/gi, "Set & Track Goals")
      .replace(/\bSet\s+Life\s+Goals\b/gi, "Set & Track Goals")
      .replace(/\bBuild\s+Financial\s+Freedom\b/gi, "Create Financial Freedom")
      .replace(/\bCreate\s+(?:a\s+)?To\s+Do\s+List\b/gi, "Create To Do List")
      .replace(/^(?:To\s+Do|Todo)\s+List$/gi, "Create To Do List")
      .replace(/\bCreate\s+WalMart\s+List\b/gi, "Create Walmart List")
      .replace(/^Walmart\s+List$/gi, "Create Walmart List")
      .replace(/^Other\s+Lists?$/gi, "Create Another List")
      .replace(/\bMake\s+(?:a\s+)?(?:Grocery|Shopping)\s+List\b/gi, "Create a Shopping List")
      .replace(/^(?:Grocery|Shopping)\s+List$/gi, "Create a Shopping List")
      .replace(/\bExplore\s+Plan\s+(?:This|Your)\s+Weekend\b/gi, "Plan Your Weekend")
      .replace(/\bPlan\s+This\s+Weekend\b/gi, "Plan Your Weekend")
      .replace(/\bPlan\s+Weekend\s+Plans\b/gi, "Plan Your Weekend")
      .replace(/\bWeekend\s+Plans\b/gi, "Plan Your Weekend")
      .replace(/\bactivities\b/gi, "plans")
      .replace(/\bactivity\b/gi, "plan")
      .replace(/\s+/g, " ");
    if (/^explore\s+aiasap$/i.test(cleaned)) return "Explore aiASAP";
    if (/^to\s+do\s+list$/i.test(cleaned)) return "Create To Do List";
    if (/^set\s+goals?$/i.test(cleaned)) return "Set & Track Goals";
    return cleaned;
  };
  const cleaned = prompts
    .map(cleanThoughtPrompt)
    .filter(Boolean)
    .filter((prompt) => !/\b(?:contact|named g|for g|call g|text g|email g)\b/i.test(prompt))
    .filter((prompt) => !/\b(?:reminder|remind|notify|notification)\b/i.test(prompt))
    .filter((prompt) => !/^add the next item$/i.test(prompt))
    .filter((prompt) => !/\b(?:reminder|remind|notify|notification)\b/i.test(prompt))
    .filter((prompt) => !BLOCKED_THOUGHT_PROMPT_RE.test(prompt))
    .filter((prompt) => !/^take a hike$/i.test(prompt))
    .filter((prompt) => !/^share (?:my )?location$/i.test(prompt))
    .filter((prompt, index, all) => all.indexOf(prompt) === index)
    .filter((prompt) => !/^change subject$/i.test(prompt));
  const listContextFallback = [
    "Create a Shopping List",
    "Create To Do List",
    "Create Walmart List",
    "Create Another List",
  ];
  const hasWeekendPrompt = cleaned.some((prompt) =>
    /\b(?:cool stuff|weekend|great movie|local events?|go on a hike)\b/i.test(prompt),
  );
  const hasHealthyFoodPrompt = cleaned.some((prompt) =>
    /\b(?:sugar|unhealthy foods?|healthy foods?|hidden sugar|snacks?|food swaps?)\b/i.test(prompt),
  );
  const hasListPrompt = cleaned.some((prompt) =>
    /\b(?:list|item|task|store mode|close list|another list)\b/i.test(prompt),
  );
  const hasFriendshipPrompt = cleaned.some((prompt) =>
    FRIENDSHIP_CONTEXT_RE.test(prompt),
  );
  const fallbackPrompts = hasWeekendPrompt
    ? WEEKEND_PROMPTS
    : hasHealthyFoodPrompt
      ? HEALTHY_FOOD_PROMPTS
    : hasListPrompt
      ? listContextFallback
    : hasFriendshipPrompt
      ? FRIENDSHIP_PROMPTS
      : GENERAL_OPENING_LEADS;
  return balanceBuildPromptMix(keepExploreAiASAPLow([...cleaned, ...fallbackPrompts])
    .filter((prompt, index, all) => all.indexOf(prompt) === index)
    .filter((prompt) => !/^add the next item$/i.test(prompt))
    .filter((prompt) => !BLOCKED_THOUGHT_PROMPT_RE.test(prompt))
    .filter((prompt) => !/^take a hike$/i.test(prompt))
    .filter((prompt) => !/^share (?:my )?location$/i.test(prompt))
    .filter((prompt) => !/^change subject$/i.test(prompt)));
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
      /\b(?:weekend|things to do|cool things|cool stuff|places to go|events?|great movies?|movies?)\b/i.test(
        query,
      ),
  );
}

function getLookupLocationPrompts(query: string | null | undefined): string[] {
  if (isHikingLookupQuery(query)) {
    return normalizeThoughtPrompts([
      "Give ZIP Code",
      "Close Search",
      "Easy Places to Hike",
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

function renderThoughtPromptLabel(prompt: string) {
  if (prompt !== "Set & Track Goals") return prompt;
  return (
    <>
      Set <span className="aiasap-prompt-amp">&amp;</span> Track Goals
    </>
  );
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
    isWeekendLookupQuery(query) ? "Go on a Hike" : "Share My Interests",
    isWeekendLookupQuery(query) ? "Find a Great Movie" : "Find Cool Things",
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

type AssistantListStateAction =
  | "create"
  | "open"
  | "add"
  | "remove"
  | "style"
  | "color"
  | "view"
  | "close"
  | "delete";

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

type QueuedConversationLogEntry = {
  sessionId: string;
  role: "user" | "assistant";
  text: string;
  source: string;
};

type AccountMemorySnapshot = {
  greetingTopic: string | null;
  contextText: string;
};

const ASSISTANT_LISTS_STORAGE_KEY = "aiasap.assistantLists.v1";
const ACCOUNT_PENDING_STATE_TOKEN_STORAGE_KEY =
  "aiasap.accountPendingStateToken.v1";
const DEVICE_PROFILE_STORAGE_KEY = "aiasap.deviceProfile.v1";
const ANONYMOUS_VISITOR_STORAGE_KEY = "aiasap.anonymousVisitor.v1";
const RECENT_ACTIONS_STORAGE_KEY = "aiasap.recentActions.v1";
const BETA_FRESH_STORAGE_KEYS = [
  ASSISTANT_LISTS_STORAGE_KEY,
  ACCOUNT_PENDING_STATE_TOKEN_STORAGE_KEY,
  DEVICE_PROFILE_STORAGE_KEY,
  ANONYMOUS_VISITOR_STORAGE_KEY,
  RECENT_ACTIONS_STORAGE_KEY,
];
const MAX_LIST_ITEMS = 80;
const MAX_ACTIVE_STICKY_NOTES = 10;
const MAX_RECENT_REMOVALS = 5;
const MAX_RECENT_ACTIONS = 20;
const MAX_LIST_STATE_LOG_ITEMS = 40;
const LIST_STATE_LOG_PREFIX = "[[aiASAP:list_state:v1]]";
const MAX_PROMPT_SIZE_LEVEL = 3;
const INTERNAL_SIGNAL_RE =
  /^\s*\[(?:USER HAS BEEN SILENT|SILENT|OBJECT_NOT_VISIBLE)[^\]]*\]/i;

function clearBetaFreshSessionStorage() {
  if (!BETA_FRESH_START_EVERY_SESSION || typeof window === "undefined") return;
  try {
    BETA_FRESH_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Fresh-start cleanup is best-effort; in-memory state still starts clean.
  }
}

const LIST_TRIGGER_RE =
  /\b(grocery|groceries|shopping|store|walmart|list|todo|to-do|to do|task|sticky\s+notes?|lista|listas|compras|mercado|tarea|tareas|liste|courses|einkaufsliste|einkauf|aufgaben)\b/i;
const LIST_ITEM_PREFIX_RE =
  /^(?:(?:and|y|e|et|und)\s+)?(?:(?:i\s+)?(?:(?:need|want)\s+(?:to\s+)?|have\s+to\s+get|gotta\s+get|should\s+get|add|put|get|grab|buy|pick\s+up)\s+|(?:necesito|quiero|agrega|agregar|anade|a\u00f1ade|poner|pon|compra|comprar)\s+|(?:j'?ai besoin de|je veux|ajoute|ajouter|achete|acheter)\s+|(?:ich brauche|ich will|fuege hinzu|f\u00fcge hinzu|hinzufuegen|hinzuf\u00fcgen|kauf|kaufen)\s+|(?:let'?s|lets)\s+(?:(?:put|add|get|grab|buy|pick up)\s+)?(?:(?:on|to|in)\s+)?(?:(?:their|there|the|my|our|this|that)\s+)?|(?:on|to|in)\s+(?:(?:their|there|the|my|our|this|that)\s+)?|some\s+|a\s+|an\s+|the\s+)/i;
const SPOKEN_LIST_COMMAND_RE =
  /\b(?:(?:let'?s|lets)\s+)?(?:put|add|get|grab|buy|pick up)\s+(?:it\s+)?(?:(?:on|to|in)\s+)?(?:(?:their|there|the|my|our|this|that)\s+)?/gi;
const LIST_COMMAND_ONLY_RE =
  /\b(?:make|create|start|open|show|switch to|pull up|pop up|go to|toggle|another|new|abre|abrir|muestra|mostrar|cambia|crear|crea|haz|hacer|ouvre|ouvrir|montre|affiche|wechsel|oeffne|\u00f6ffne|zeige)\b.*\b(?:list|todo|to-do|to do|sticky\s+notes?|lista|listas|liste|einkaufsliste)\b|\bput me on\b.*\b(?:list|walmart|grocery|shopping|todo|to-do|to do|sticky\s+notes?)\b/i;
const LIST_OPEN_EXISTING_COMMAND_RE =
  /\b(?:go\s+back\s+to|back\s+to|return\s+to|open|show|pull\s+up|bring\s+up|switch\s+to|go\s+to)\b.{0,80}\b(?:grocery|shopping|walmart|to[-\s]?do|todo|task)?\s*list\b|\bput\b.{0,40}\b(?:grocery|shopping|walmart|to[-\s]?do|todo|task)?\s*list\s+up\b|\bwhere'?s\b.{0,40}\b(?:grocery|shopping|walmart|to[-\s]?do|todo|task)?\s*list\b|\bdid\s+we\s+make\b.{0,40}\b(?:grocery|shopping|walmart|to[-\s]?do|todo|task)?\s*list\b.{0,20}\byet\b/i;
const REMOVE_COMMAND_RE =
  /\b(?:remove|delete|get rid of|take\s*off|takeoff|take out|cross off|cross out|check off|mark off|i got(?!\s+to\b)|got(?!\s+to\b)|grabbed|picked up|quita|quitar|elimina|eliminar|borra|borrar|tacha|tachar|ya tengo|j'?ai pris|retire|retirer|supprime|supprimer|enleve|enlever|loesche|l\u00f6sche|streiche|abhaken)\b/i;
const LIST_DELETE_RE =
  /\b(?:delete|get rid of|remove|trash|erase)\s+(?:the|my|this|that)?\s*(?:grocery|shopping|walmart|to[-\s]?do)?\s*(?:list|lists|sticky\s+notes?)\b|\b(?:delete|get rid of|remove|trash|erase)\s+(?:it|that|this)\b/i;
const LIST_CLEAR_RE =
  /\b(?:clear|empty|wipe)\s+(?:everything|all|the whole thing|all items)?\s*(?:from|off|out of)?\s*(?:the|this|that|my)?\s*(?:list|sticky note|note)?\b/i;
const LIST_UNDO_REMOVAL_RE =
  /\b(?:put|add|bring)\s+(?:it|that|them|those|the item|the items)?\s*back\b|\bundo\b/i;
const LIST_RENAME_RE =
  /\b(?:call|name|rename)\s+(?:this|that|the|my)?\s*(?:list|sticky note|note)?\s*(?:to|as)?\s+(.{2,60})$|\bchange\s+(?:the\s+)?(?:title|name)\s+of\s+(?:this|that|the|my)?\s*(?:list|sticky note|note)?\s*(?:to|as)\s+(.{2,60})$|\bchange\s+(?:this|that|the|my)?\s*(?:list|sticky note|note)?\s*(?:to|as)\s+(.{2,60})$/i;
const LIST_NAV_NEXT_RE = /\b(?:next|toggle|switch)\s+list\b/i;
const LIST_NAV_PREV_RE = /\b(?:previous|prior|last|back)\s+list\b/i;
const LIST_NAV_FIRST_RE =
  /\b(?:first|original|starting)\s+list\b|\bgo\s+back\s+to\s+(?:the\s+)?first\s+list\b/i;
const LIST_SAVE_RE =
  /\b(?:save|keep|store)\s+(?:that|this|the|my|your)?\s*(?:grocery|shopping|walmart|to[-\s]?do|todo)?\s*(?:list|sticky\s+note)\b/i;
const LIST_CLOSE_RE =
  /\b(?:close|hide|dismiss|drop|put away|take down|minimize|cierra|cerrar|oculta|ocultar|quita|quitar|ferme|fermer|cache|cacher|schliesse|schlie\u00dfe|ausblenden)\s+(?:the|my|this|that|la|mi|esta|esa|le|ma|cette|die|meine|diese)?\s*(?:grocery|shopping|walmart|to[-\s]?do|compras|mercado|tareas|courses|einkauf)?\s*(?:list|lists|sticky\s+notes?|lista|listas|liste)\b|\bmake\s+(?:the|my|this|that)?\s*(?:list|lists|sticky\s+notes?)\s+(?:disappear|go away)\b|\b(?:take|pull|get|remove|drop)\s+(?:it|the|my|this|that)?\s*(?:grocery|shopping|walmart|to[-\s]?do)?\s*(?:list|lists|sticky\s+notes?)\s+(?:down|off|away|from|out)(?:\s+(?:from|off)?\s*(?:the\s+)?screen)?\b|\bno\s+(?:visible\s+)?(?:list|sticky\s+note)\b|\bback\s+to\s+(?:the\s+)?(?:prompts|boxes)\b/i;
const LIST_STYLE_BULLET_RE = /\b(?:bullet|bullets|bullet points)\b/i;
const LIST_STYLE_NUMBER_RE = /\b(?:numbered|numbers|number list|numbered list)\b/i;
const ACCOUNT_SETUP_TRIGGER_RE =
  /\b(?:set up|setup|create|start|make|open)\s+(?:an?\s+)?account\b|\b(?:remember me|remember this next time|remember everything|save this for next time|sign me in|log me in)\b/i;
const ACCOUNT_READY_YES_RE =
  /\b(?:yes|yeah|yep|sure|ready|ok|okay|correct|that'?s correct|that is correct|that'?s right|that is right|that does|sounds right|looks right|looks good|do it|let'?s do it|set it up|send it)\b/i;
const ACCOUNT_READY_NO_RE = /\b(?:no|not now|later|stop|never mind|cancel)\b/i;
const LIST_START_CONFIRM_YES_RE =
  /\b(?:yes|yeah|yep|yup|sure|ok|okay|please|do it|go ahead|start it|make it|create it|let'?s do it|let'?s make it)\b/i;
const LIST_START_CONFIRM_NO_RE =
  /\b(?:no|nope|nah|not now|later|never mind|nevermind|cancel|don'?t|do not)\b/i;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const EMAIL_ENTRY_REQUEST_RE =
  /\b(?:type|typing|text|write|enter|keyboard|text box|textbox|input|pop up|popup)\b.*\b(?:email|address|it|that)\b|\b(?:can i|let me)\s+(?:type|text|write|enter)\s+(?:the\s+)?(?:email|address|it)\b/i;
const LIST_DONE_RE =
  /\b(?:that'?s all|that is all|that'?s it|that is it|all done|done|finished|complete|nothing else|no more)\b/i;
const ACCOUNT_SETUP_REOFFER_COOLDOWN_MS = 90_000;
const END_CONVERSATION_RE =
  /\b(?:end|stop|finish|quit|exit|close|shut\s+down|wrap up|done with)\s+(?:this|the|my)?\s*(?:conversation|session|chat|talk|site|app|avatar|six|6)\b|\b(?:i'?m done|all done|that'?s all)\s+(?:with\s+)?(?:this|the|my)?\s*(?:conversation|session|chat|talk|site|app|avatar|six|6|for now)\b/i;
const DIRECT_END_SESSION_RE =
  /\b(?:close|stop|end|quit|exit|shut\s+(?:it\s+)?down)\s+(?:this|the|my)?\s*(?:session|conversation|chat|talk|avatar|six|6)\b/i;
const SINGLE_WORD_END_SESSION_RE = /^\s*(?:stop|end|quit|exit)\s*[.!?]*\s*$/i;
const END_SESSION_CONFIRM_RE =
  /\b(?:yes|yeah|yep|yup|yea|sure|ok|okay|correct|right|do it|go ahead|close|stop|end|quit|exit|shut\s+(?:it\s+)?down|that'?s right|that is right|please)\b/i;
const END_SESSION_CANCEL_RE =
  /\b(?:no|nope|nah|not now|later|never mind|nevermind|cancel|keep going|continue|stay|don'?t|do not)\b/i;

function isGenericUnnamedListStart(text: string): boolean {
  const value = stripDirect6Address(text)
    .replace(/\b(?:okay|ok|so|all right|alright|great|please|well|um|uh|like)\b/gi, " ")
    .replace(/\bgo ahead and\b/gi, " ")
    .replace(/[.!?,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!value) return false;
  if (/\b(?:called|named|grocery|shopping|walmart|to[-\s]?do|todo|task)\b/i.test(value)) {
    return false;
  }
  return /^(?:(?:let'?s|lets)\s+)?(?:make|create|start|open|pull up|show|new)\s+(?:a|an|the|my|some|another|nother|different|other)?\s*lists?$|^(?:another|nother|new|different|other)\s+lists?$/i.test(
    value,
  ) || /^i\s+(?:need|want|would like|could use)\s+(?:to\s+)?(?:make|create|start|open|pull up|show)\s+(?:a|an|the|my|some|another|nother|different|other)?\s*lists?$/i.test(
    value,
  );
}

const ONLINE_LOOKUP_TOPIC_RE =
  /\b(?:hike|hikes|hiking|trail|trails|park|parks|walk|walking|outside|outdoor|outdoors|waterfall|waterfalls|weekend|date night|date ideas|romantic dinner|dinner spots|cool things|things to do|places to go|place to go|weather|forecast|concert|concerts|show|shows|events?|museum|museums|restaurant|restaurants)\b/i;
const ONLINE_LOOKUP_ACTION_RE =
  /\b(?:find|look up|search|show me|give me|add|where|nearby|near me|check|check out|hit|visit|go to|help me find|plan|i want to|i need to|i would like to|i'?d like to|we want to|let'?s)\b/i;
const ONLINE_LOOKUP_DIRECT_RE =
  /\b(?:nearby|near me|where i am|weather|forecast|hike|hiking|trail|park|waterfall|waterfalls|weekend|date night|date ideas|romantic dinner|dinner spots|cool things to do|concert|concerts|show|shows|events?|museums?|restaurants?)\b/i;
const ONLINE_LOOKUP_MORE_RE =
  /\b(?:give me|add|show me|find|look up|search|can you|could you)\b.{0,50}\b(?:4th|fourth|another|more|one more|next|few more|couple more|other|option|thing|result)\b|\b(?:4th|fourth|another|more|one more|next|few more|couple more)\s+(?:thing|option|result)\b/i;
const ONLINE_LOOKUP_COMMENTARY_RE =
  /\b(?:it'?s got|it has|none of these|none of this was (?:a )?relevant|these are|that says|this says|looking online for|now it just|just changed|things are changing|making logical sense|inside the box|in this box|on the list|the things that are on|where are these (?:\d+|five) things coming up|why would you think|why can'?t he|why can he|they think i want|i don'?t want to go to|do not want to go to|not interested in|that should not come on)\b/i;
const ONLINE_LOOKUP_FEEDBACK_RE =
  /\b(?:went away|box (?:just )?(?:came up|went away)|big and square|came up pink|square box|pillboxes? (?:came back|should)|plan weekend plans|we just planned this weekend|we just did (?:the )?plan(?: the)? weekend|it said,?\s+plan|no\s+(?:date night ideas?|local hikes?|nearby events?|weekend plans?)|i don'?t like the way that sounds|did not ask for (?:the )?(?:zip code|box|popup|pop up)|zip code.*(?:popup|pop up)|should not (?:pop up|come up)|shouldn'?t come up|should ask me|do i want to|things? should toggle|buttons? should toggle|toggle|toggling|inside the box)\b/i;
const PROMPT_LABEL_REVIEW_RE =
  /\b(?:build a business|build a better life|build friendships|build relationships|make friends|make more friends|build your socials|market your product|market your service|next vacation ideas|get that guy|get that girl|win them over|plan first message|ask them out|plan a date|find places to hike|plan (?:this|your) weekend|make a (?:grocery|shopping) list|to do list|make more money|build financial freedom|create financial freedom|shopping list|find nearby events|local hikes?|nearby events?|weekend plans?|date night ideas?|compare popular codecs|explain (?:different |video |audio )?codecs?|list codec uses|c[\s.-]*o[\s.-]*d[\s.-]*e[\s.-]*c[\s.-]*s?)\b.{0,80}\b(?:comes?|came|pops?|popped|shows?|showed)\s+up\b|\bwhat\s+does\b.{0,80}\b(?:build a business|build a better life|build friendships|build relationships|make friends|make more friends|build your socials|market your product|market your service|next vacation ideas|get that guy|get that girl|win them over|plan first message|ask them out|plan a date|find places to hike|plan (?:this|your) weekend|make a (?:grocery|shopping) list|to do list|make more money|build financial freedom|create financial freedom|shopping list|find nearby events|local hikes?|nearby events?|weekend plans?|date night ideas?|compare popular codecs|explain (?:different |video |audio )?codecs?|list codec uses|c[\s.-]*o[\s.-]*d[\s.-]*e[\s.-]*c[\s.-]*s?)\b.{0,40}\bmean\b|\b(?:that|they|this|it)\s+should\s+not\s+come\s+up\b/i;
const PROMPT_LABEL_META_RE =
  /\b(?:says?|said|show(?:s|ed|ing)?|came\s+up|comes\s+up|popped\s+up|first\s+screenshot|screenshot|screen|middle\s+of\s+(?:that|the)\s+conversation|where\s+it\s+says|the\s+four|4\s+boxes|pillboxes?|pill\s+boxes?|prompts?)\b.{0,160}\b(?:build a business|build a better life|build friendships|build relationships|make friends|make more friends|build your socials|market your product|market your service|next vacation ideas|get that guy|get that girl|win them over|plan first message|ask them out|plan a date|find places to hike|plan (?:this|your) weekend|make a (?:grocery|shopping) list|to[-\s]?do list|make more money|build financial freedom|create financial freedom|shopping list)\b|\b(?:build a business|build a better life|build friendships|build relationships|make friends|make more friends|build your socials|market your product|market your service|next vacation ideas|get that guy|get that girl|win them over|plan first message|ask them out|plan a date|find places to hike|plan (?:this|your) weekend|make a (?:grocery|shopping) list|to[-\s]?do list|make more money|build financial freedom|create financial freedom|shopping list)\b.{0,160}\b(?:says?|said|show(?:s|ed|ing)?|prompt(?:s)?|pillboxes?|pill\s+boxes?|boxes|screenshot|screen|should\s+be|should\s+show|should\s+not)\b/i;
const CURRENT_GENERAL_PROMPT_LABEL_REVIEW_RE =
  /\b(?:create financial freedom|build friendships|build relationships\/friends|build relationships|make friends|create a shopping list|find your life partner|build your brand|build your socials|market yourself|create a to[-\s]?do list|set\s*(?:\/|&)\s*track life goals?|be fully honest|pick one person|own your part|plan better talk)\b.{0,120}\b(?:should|prompt(?:s)?|pillboxes?|pill\s+boxes?|boxes|comes?|came|pops?|popped|shows?|showed|top\s*4|top four|bottom list|opening leads?|feed|label|used?)\b|\b(?:should|prompt(?:s)?|pillboxes?|pill\s+boxes?|boxes|comes?|came|pops?|popped|shows?|showed|top\s*4|top four|bottom list|opening leads?|feed|label|used?)\b.{0,120}\b(?:create financial freedom|build friendships|build relationships\/friends|build relationships|make friends|create a shopping list|find your life partner|build your brand|build your socials|market yourself|create a to[-\s]?do list|set\s*(?:\/|&)\s*track life goals?|be fully honest|pick one person|own your part|plan better talk)\b/i;
const GOAL_PROMPT_LABEL_FEEDBACK_RE =
  /\b(?:set goals?|set (?:life|relationship|business|money|social|health|family|work|personal|career|fitness|home) goals?)\b.{0,100}\b(?:never works|two words?|should|prompt(?:s)?|labels?|boxes?|pillboxes?|comes?\s+up|came\s+up|shows?|showed|used?|use)\b|\b(?:never works|two words?|should|prompt(?:s)?|labels?|boxes?|pillboxes?|comes?\s+up|came\s+up|shows?|showed|used?|use)\b.{0,100}\b(?:set goals?|set (?:life|relationship|business|money|social|health|family|work|personal|career|fitness|home) goals?)\b/i;
const PROMPT_TOPIC_FEEDBACK_RE =
  /\b(?:should\s+(?:not\s+)?be\b.{0,80}\bprompts?|prompts?\b.{0,80}\b(?:talking\s+about|girl|woman|guy|man)|(?:talking\s+about\s+(?:a\s+)?(?:girl|woman|guy|man)).{0,80}\bprompts?)\b/i;
const OPENING_LEAD_REVIEW_RE =
  /\b(?:(?:build a business|build a better life|build friendships|build relationships|make friends|make more friends|build your socials|market your product|market your service|next vacation ideas|get that guy|get that girl|win them over|plan first message|ask them out|plan a date|shopping list|find places to hike|plan (?:this|your) weekend|make a (?:grocery|shopping) list|to do list|make more money|build financial freedom|create financial freedom|plan your day).{0,80}(?:(?:comes?|came|pops?|popped|shows?|showed)\s+up|should\s+be|should\s+show|prompt(?:s)?|leads?|often\s+used|used\s+often)|opening leads?|primary (?:pill )?prompts?|prompt feed|idea boxes?|leads? inside|inside the pill boxes|started? out with|start(?:s|ed)? out with|take a hike|much more generic|appl(?:y|ies) to most people|social site'?s algorithm)\b/i;
const LIST_OPEN_FEEDBACK_RE =
  /\b(?:same issues?|i (?:do not|don'?t|dont|didn'?t|did not) ask(?:ed)? for (?:a )?list|system brings? (?:a )?list(?: box)? up|list (?:box )?(?:came|comes|came up|comes up)|why did (?:you )?(?:pop|pull|bring) (?:that|this|it) up|why (?:did|is) (?:that|this|it) (?:pop|come|show)(?:ing)? up|only after (?:the )?user asks?|6 confirms|can'?t assume that everyone needs|cannot assume that everyone needs|small box|too small|wider and taller|terms line)\b/i;
const LIST_START_REHEARSAL_RE =
  /\b(?:you'?re supposed to say|you are supposed to say|he should say|he should have said|six should say|6 should say|what\s+(?:6|six)\s+should\s+say|should\s+have\s+gone|should\s+i\s+make\s+(?:a|the)?\s*(?:grocery|shopping|walmart|to[-\s]?do|todo)?\s*list|want me to (?:start|make|create|open) (?:a|the|that|this)?\s*(?:grocery|shopping|walmart|to[-\s]?do|todo)?\s*list|what\s+do\s+you\s+want\s+(?:me\s+)?to\s+put\s+on\s+(?:your|that|the)\b|what\s+do\s+you\s+want\s+to\s+call\s+this\s+list|i say yes|if\s+i\s+say\b|when\s+(?:the\s+)?user\s+says\s+something\s+like|when\s+i\s+say\s+something\s+like|something\s+like\s+open\b|(?:and\s+)?then\s+(?:the\s+)?user\s+says|user says yes|after\s+we\s+make\s+the\s+list|before\s+anything\s+gets\s+on\s+there|anything\s+like\s+that\s+should\s+key|should\s+key\s+the\s+system|auto[-\s]?generate\s+(?:the\s+)?(?:list|word)|then you open(?:ed)? (?:the )?(?:grocery|shopping|walmart|to[-\s]?do|todo)?\s*list)\b/i;
const LIST_BUG_FEEDBACK_RE =
  /\b(?:not\s+saying\s+a\s+word|just\s+(?:sitting\s+there\s+)?looking\s+at\s+me|doesn'?t\s+know\s+what\s+to\s+say|does\s+not\s+know\s+what\s+to\s+say|none\s+of\s+these\s+voice\s+prompts\s+are\s+working|voice\s+prompts\s+are\s+working|he'?s\s+gibbering|he\s+is\s+gibbering|gibbering\s+again|why\s+is\s+he\s+gibbering|sputtering|all\s+these\s+issues|these\s+issues|explore\s+all\s+these\s+issues|explore\s+that|take\s+all\s+the\s+time|problem\s+there|put\s+a\s+list\s+together\s+of\s+all\s+the\s+things|make\s+a\s+list\s+of\s+all\s+that\s+we\s+just\s+went\s+through|all\s+that\s+we\s+just\s+went\s+through|things?\s+that\s+need\s+attention|finish\s+them\s+all|work\s+on\s+that\s+one\s+by\s+one|one\s+by\s+one\s+till\s+you'?re\s+done|work\s+on\s+it|let'?s\s+fix\s+it|lets\s+fix\s+it|fix\s+it|fix\s+that|fix\s+them|go\s+down\s+the\s+list|keep\s+going\s+down\s+the\s+list|do\s+number\s+(?:1|one|2|two|3|three)|knock\s+all\s+these(?:\s+off)?|not\s+quite\s+there\s+yet|we'?re\s+getting\s+there|got\s+it\s+together|this\s+is\s+so\s+great|that'?s\s+great|that\s+is\s+great|it\s+added\s+them\s+all|added\s+them\s+all|doesn'?t\s+make\s+sense|does\s+not\s+make\s+sense|there\s+are\s+no\s+lists?\s+open|not\s+ever\s+anything\s+called|called\s+(?:another|nother|different|other)\s+list|that'?s\s+not\s+something\s+for\s+the\s+list|that\s+is\s+not\s+something\s+for\s+the\s+list|did\s+not\s+make\s+(?:number|it)|didn'?t\s+make\s+(?:number|it)|made\s+it\s+(?:on|to)\s+(?:number|the\s+list)|spelled\s+right|capital\s+b|b[-\s]?e[-\s]?r|should\s+just\s+pop\s+up|boom,?\s+start\s+it|prompt\s+pillbox|go\s+from\s+the\s+.+?\s+list\s+back\s+to\s+the\s+.+?\s+list)\b/i;
const LIST_META_COMMAND_RE =
  /\b(?:i\s+just\s+said|just\s+said|so\s+i\s+said|whatever\s+i\s+said|said\s+(?:make|start|create|open)|i\s+said,?\s+open|wanting\s+to\s+make|had\s+to\s+ask|before\s+he\s+did\s+it|did\s+finally\s+do\s+it|he\s+did\s+finally|it\s+opened\s+it\s+up|opened\s+it\s+up|it\s+just\s+changed\s+from|changed\s+from\s+\w+\s+to\s+\w+|no\s+more\s+changing\s+colors|unless\s+the\s+user\s+explicitly\s+asks|he\s+(?:made|started|opened)|six\s+(?:made|started|opened)|not\s+as\s+part\s+of|as\s+part\s+of|unless\s+we\s+make|didn'?t\s+ask\s+for|did\s+not\s+ask\s+for|where\s+did\s+this\s+list\s+come\s+from|how\s+many\s+lists?\s+do\s+i\s+have|as\s+soon\s+as\s+me,\s+the\s+user|the\s+user\s+says|list\s+should\s+go\s+away|it\s+should\s+be\s+automatic|it\s+should\s+automatically\s+start|should\s+just\s+pop\s+up|the\s+system\s+(?:started|should\s+start)\s+(?:the\s+)?(?:grocery|shopping|walmart|to[-\s]?do|todo)?\s*list|so\s+just\s+do\s+that\s+for\s+anything|anything\s+like\s+that\s+should\s+key|should\s+key\s+the\s+system|auto[-\s]?generate\s+(?:the\s+)?(?:list|word)|got\s+to\s+be\s+taken\s+care\s+of|taken\s+care\s+of)\b/i;
const LIST_REMOVAL_FAILURE_RE =
  /\b(?:(?:he|six|6|it)\s+)?(?:didn'?t|did\s+not|doesn'?t|does\s+not)\s+(?:remove|take\s+off|take)\b|\bnot\s+remove(?:d)?\b/i;
const ONLINE_LOOKUP_START_CONFIRM_RE =
  /^\s*(?:wow[,\s]+)?(?:(?:we|i)\s+can\s+|(?:let'?s|lets)\s+|can\s+we\s+|i\s+want\s+to\s+)?plan\s+(?:this\s+)?weekend\s*[.!?]*$/i;
const ONLINE_LOOKUP_CLOSE_RE =
  /\b(?:close|hide|dismiss|clear|stop|end|remove|get\s+rid\s+of)\s+(?:the|this|that|my|a|an)?\s*(?:search|results?|sources?|lookup|online\s+search|events?|pill\s*boxes?|pills?|location(?:\s+(?:box|popup|pop\s*up|panel|window))?|box|popup|pop\s*up|panel|window|screen|things\s+that\s+came\s+up)(?:\s+(?:from|off)\s+(?:the\s+)?screen)?\b|\btake\s+(?:it|that|this|the|the\s+search|the\s+results?|the\s+box|the\s+panel|the\s+pills?|the\s+pill\s*boxes?)\s*(?:off|away|down)(?:\s+(?:from|off)\s+(?:the\s+)?screen)?\b|\bmake\s+(?:the|this|that|my)?\s*(?:events?|search|results?|box|popup|pop\s*up|panel|pill\s*boxes?|pills?)\s+go\s+away\b/i;
const LOCATION_HINT_RE =
  /\b(?:near|around|in|by|at|close to|outside of)\s+([a-z0-9][a-z0-9\s,.'-]{1,70})/i;
const LOCATION_SHARE_CHOICE_RE =
  /\b(?:share (?:my )?location|use (?:my )?location|current location|where i am|near me|around me)\b/i;
const SHOPPING_MODE_OPEN_RE =
  /\b(?:shopping mode|store mode|full screen list|make (?:the )?list full screen|open (?:the )?list full screen)\b/i;
const SHOPPING_MODE_CLOSE_RE =
  /\b(?:close|exit|leave|stop)\s+(?:shopping|store|full screen)\s*mode\b/i;
const LIST_MUTATION_SIGNAL_RE =
  /\b(?:need|want|have to get|gotta get|should get|add|put|get|grab|buy|pick up|also|necesito|quiero|agrega|agregar|anade|a\u00f1ade|poner|pon|compra|comprar|tambien|tambi\u00e9n|j'?ai besoin de|je veux|ajoute|ajouter|achete|acheter|aussi|ich brauche|ich will|fuege|f\u00fcge|hinzufuegen|hinzuf\u00fcgen|kauf|kaufen|auch)\b/i;
const TODO_ACTION_ITEM_RE =
  /^(?:\s*(?:and\s+)?(?:um|uh|okay|ok|please|so|let'?s(?:\s+see)?|lets(?:\s+see)?)[,\s]*)*(?:is\s+)*(?:take(?!\s+(?:off|out|away|down))|call|email|text|pay|schedule|book|fix|clean|vacuum|balance|finish|write|send|level|drop\s+off|pick\s+up)\b/i;
const LIST_START_COMMAND_WITHOUT_ITEMS_RE =
  /\b(?:(?:let'?s|lets)\s+)?(?:make|create|start(?:\s+with)?|open|show|pull\s+up|pop\s+up)\s+(?:a|an|the|my|some)?\s*(?:(?:grocery|shopping|walmart|to[-\s]?do|todo|honey[-\s]?do|weekend(?:\s+planning)?)?\s*lists?|sticky\s+notes?)\b|\bi\s+(?:need|want|would like|could use)\s+(?:to\s+)?(?:make|create|start(?:\s+with)?|open|pull\s+up|pop\s+up)\s+(?:a|an|the|my|some)?\s*(?:(?:grocery|shopping|walmart|to[-\s]?do|todo|honey[-\s]?do|weekend(?:\s+planning)?)?\s*lists?|sticky\s+notes?)\b/i;
const LIST_ITEM_WITH_START_COMMAND_RE =
  /\bwith\s+[a-z0-9][a-z0-9' -]{1,80}\b|\b(?:add|put|get|grab|buy|pick\s+up)\b/i;
const LIST_START_WITH_REFERENCED_ITEMS_RE =
  /\b(?:start|make|create)\s+(?:a\s+)?list\s+with\s+(?:those|these|them|that)\b|\badd\s+(?:those|these|them|that)\s+(?:to|on)\s+(?:a\s+|the\s+)?list\b/i;
const CUSTOM_LIST_TOPIC_START_RE =
  /\b(?:(?:can|could|would)\s+you\s+)?(?:(?:let'?s|lets)\s+)?(?:(?:make|create|start|build|put together)\s+(?:me\s+)?|i\s+(?:need|want|would like|could use)\s+)(?:a|an|the|my|another)?\s*list\s+(?:of|for|about)\s+(?:(?:my|our|the|a|an)\b)?\s*([a-z][a-z0-9' -]{1,60})/i;
const GENERIC_LIST_START_RE =
  /\b(?:(?:let'?s|lets)\s+)?(?:make|create|start|new)\s+(?:a|an|the|my|some|another|nother|different|other)?\s*(?:lists?|sticky\s+notes?)\b|\bi\s+(?:need|want|would like|could use)\s+(?:a|an|the|my|some|another|nother|different|other)?\s*(?:lists?|sticky\s+notes?)\b/i;
const EXPLICIT_LIST_DO_START_RE =
  /(?:\b(?:(?:let'?s|lets)\s+){0,2}(?:make|create|start(?:\s+with)?|open|show|pull up|pop up)|\b(?:(?:let'?s|lets)\s+){1,2}do|^do)\s+(?:a|an|the|my|some)?\s*(?:(?:grocery|shopping|walmart|to[-\s]?do|todo|honey[-\s]?do|weekend(?:\s+planning)?)?\s*lists?|sticky\s+notes?)\b/i;
const LIST_CONVERSATION_FRAGMENT_RE =
  /\b(?:i mean|i know|you know|all those|all kinds of|did you|do you|didn'?t|am i|are they|they'?re|they are|what about|what do you mean|what do i want to do|want to do now|going to open it up|lengthening|pulling it all the way down|why\b|why can'?t he|why can he|he told me he couldn'?t|he told me he could not|six told me he couldn'?t|six told me he could not|before moving forward|ready to check out|check out|change back to|not on|put them on|put some on there|just put|nothing about|or let me|let me make sure|make sure 6 can|on there|that'?s what|that'?s wonderful|there'?s another|say that|when the user is talking|when we'?re talking|talking about (?:a\s+)?(?:girl|woman|guy|man)|normal mode|conversational mode|you mean|what are you|what is|what's|you could|i could|we could|talking right now to codex|talking to codex|talking to you|inner conversation|look at everything on the list|to be able to make|words in passing|things on the grocery list|things like that|things below|doesn'?t make sense|does not make sense|there are no lists? open|say something like|prompt labels?|prompts? when|middle of (?:that|the) conversation|where it says|four boxes|4 boxes|four things came up|4 things came up|pillboxes?|box should|boxes under|big and square|came up pink|being quiet|on purpose|not talking|grocery list is too short|grocery list.*box is too small|box is minuscule|almost touching the sides|too short|low on the screen|start it in the middle|full size|blank list|different color|make those changes|stop it here|just go ahead|perspective on the size|size of the|date night ideas? has got to go|you don'?t want to have date nights?|90[-\s]?year[-\s]?old|6[-\s]?year[-\s]?old|screenshot|screen shot|screenshot coming in|the third|transcription|supabase|soup codex|codex is monitoring|compare popular codecs|explain (?:different |video |audio )?codecs?|list codec uses|c[\s.-]*o[\s.-]*d[\s.-]*e[\s.-]*c[\s.-]*s?|adjust box spacing|compare font sizes|review layout options|optimize text alignment|text alignment|font sizes|box spacing|top button|shirt|real estate|limited space|terms line|scrollable|swipe|swiped|cache clean|slate clean|new user|returning user|where did this list come from|this list should not be up here|came as number|number\s+\d+\s+(?:came|says|was|should\s+not\s+say)|should have been able to finish|box moved|tried to move it|white box|white circle|give you too much information|getting really good|said the four|just said|wanting to make|not as part of|as part of|if it'?s up|its fine|it'?s fine|for the woman|wigging out|the entire|entire list|list should be|not just (?:the )?letters?|lighters?|darkers?|squares?|mostly a mid|he named it|named it|shouldn'?t have a name|should not have a name|what it should be for|get the name correct|let'?s get that changed|lets get that changed)\b/i;
const LIST_FILLER_ITEM_RE =
  /^(?:no|not|nothing|nothing about|that's|that is|that's all|that is all|that's wonderful|that is wonderful|wonderful|there's another|there is another|there we go|we go|say that|anything else|yeah|yep|yes|ok|okay|sure|go ahead|great|thanks|thank you|right|number|codex|codecs|compare popular codecs|explain video codecs|explain audio codecs|explain different codecs|list codec uses|in|into|on|of|it'?s|its|it'?s fine|its fine|if it'?s up|if its up|as part of|for the woman|mm-?hmm|by the way|see|words in passing|but|however|should|if they to change|i mean|i know|you know|you know all the same|i guess|actually|together|let'?s|lets|or|or let me|one or the other|one or the other should happen|really falling apart|really falling apart here|things are really falling apart|things are really falling apart here|falling apart|falling apart here|already open|already opened|should not open|shouldn'?t open|does not seem to look like|doesn'?t seem to look like|not option 6|so the fade|the fade|overall look|of this|of this i want|of this i want to|let me make sure 6 can|let me make sure six can|let'?s make|let'?s make a|let'?s stop|let'?s stop it here|just go ahead|make those changes|make it|make it black|even darker|darker|lighter|half|some half|a couple more|couple more|a couple more things|a few more|few more|more things|things like that|mistakes|what about|oh|huh|um|uh|put|put on|on put|on put put|put on put|put uh|on uh|whatever|you put whatever|or you put whatever|damn|dam|up|my|needed|i need|i need half|i need to do|i want|i want some|i'?m gonna|gonna|gonna give you|change back to|change back to the|just put some on there|put some on there|some on there|on there|some|screenshot|screen shot|screenshot coming in|the screenshot|the third|voice|voices|voz|all those|it|that|this|them|they|those|these|the|to|to the|to do|todo|and|me|me on|god|got|well|so|there|all right|you|you could|i could|we could|could i|i'?ve|self|six|avatar|stop|close|end|quit|exit|letter g|grocery|groceries|shopping|wal[-\s]?mart|list|everything|forward|ford|before moving forward|now|now it'?s|wow|man|why|why can'?t he|so six told me he couldn'?t|so six told me he could not|wigging out|said the four|like to[-\s]?do list|oh my god|holy shit|it came up pink|came up pink|i'?m being quiet|being quiet|on purpose|it came with 4 boxes under there|it came with four boxes under there|i the 4 boxes|i the four boxes|market of crafts galore|i have a grocery|take i have a grocery|a dad|he'?s|he just|system|the system|the system started the list|the system should start the walmart list|putting|putting things|that to|entire|the entire|mostly a mid|let'?s get that changed|lets get that changed|get that changed|he named it|named it|can you|this one|so it shouldn'?t have a name|so it should not have a name|it shouldn'?t have a name|it should not have a name|changed to|get the name correct|what 6 should say is|what six should say is|and then 6 should say|and then six should say|what do you want to call this list|what do you want me to put on your walmart list|six just asked me|number one says|number two says|fix those errors|so let'?s fix those errors|lets fix those errors|automatically gets?|added)$/i;
const LIST_SUPABASE_FEEDBACK_ITEM_RE =
  /^(?:ah|create|nah|never mind|nevermind|that'?s great|that is great|it added them all|added them all|kodaks|kodex|if|you can|say|bar|north|south|south or|another list|nother list|knock all these|knock all these off|fix them|fulfillment)$/i;
const LIST_UI_META_FEEDBACK_RE =
  /\b(?:sticky\s+notes?|list\s+box|lists?|notes?)\b.{0,140}\b(?:already\s+open(?:ed)?|should\s+not\s+open|shouldn'?t\s+open|one\s+or\s+the\s+other\s+should\s+happen|falling\s+apart|does\s+not\s+seem\s+to\s+look\s+like|doesn'?t\s+seem\s+to\s+look\s+like|from\s+the\s+list\s+much\s+better|not\s+option\s+6|fade|yellow|brown|lighter|darker|overall\s+look|needs?\s+to\s+be\s+wider|wider|smidges?\s+on\s+the\s+(?:right|left)|go\s+down\s+(?:two|2)\s+smidges?|keep\s+the\s+top\s+exactly\s+where\s+it\s+is)\b|\b(?:fade|yellow|brown|lighter|darker|overall\s+look|needs?\s+to\s+be\s+wider|wider|smidges?\s+on\s+the\s+(?:right|left)|go\s+down\s+(?:two|2)\s+smidges?|keep\s+the\s+top\s+exactly\s+where\s+it\s+is)\b.{0,140}\b(?:sticky\s+notes?|list\s+box|lists?|notes?|this)\b|\b(?:already\s+open(?:ed)?|should\s+not\s+open|shouldn'?t\s+open|one\s+or\s+the\s+other\s+should\s+happen|really\s+falling\s+apart|falling\s+apart\s+here|things\s+are\s+really\s+falling\s+apart|not\s+option\s+6|so\s+the\s+fade|smidges?\s+on\s+the\s+(?:right|left)|go\s+down\s+(?:two|2)\s+smidges?|keep\s+the\s+top\s+exactly\s+where\s+it\s+is)\b/i;
const LIST_REVIEW_OR_LAYOUT_SPEECH_RE =
  /\b(?:notice\s+before|word\s+sticky\s+note\s+is\s+in\s+the\s+center|should\s+be\s+on\s+the\s+left\s+side|want\s+it\s+on\s+the\s+left\s+side|left\s+side|lines?\s+up(?:\s+with)?|will\s+line\s+up|the\s+text\s+when\s+it\s+comes\s+up|text\s+is\s+on\s+there|look\s+at\s+(?:that|this)|look\s+at\s+what'?s\s+on\s+the\s+list|look\s+at\s+what\s+is\s+on\s+the\s+list|he\s+said\s+he\s+put\s+those\s+things\s+on|it\s+says\s+yes|okay,?\s+so\s+it\s+says\s+yes|in\s+the\s+top|popped\s+up\s+and\s+it\s+says|number\s+\d+\s+(?:is|says)|number\s+(?:one|two|three|four)\s+says|why\s+(?:you'?ve|you\s+have|it'?s|it\s+has)\s+got\s+\d+\s+things|some\s+things\s+did\s+automatically\s+get\s+added|automatically\s+gets?|just\s+going\s+to\s+talk\s+a\s+little\s+bit|if\s+i\s+keep\s+speaking|should\s+have\s+just\s+stopped\s+at|six\s+just\s+asked\s+me|6\s+just\s+asked\s+me|didn'?t\s+have\s+to\s+ask\s+me|did\s+not\s+have\s+to\s+ask\s+me|he\s+should\s+know|that\s+it\s+was\s+created|if\s+i\s+wanted\s+to\s+create\s+it|fix\s+those\s+errors|should\s+say|none\s+of\s+this\s+makes\s+any\s+logical\s+sense|the\s+list\s+right\s+now|no,?\s*(?:1|one),?\s*(?:2|two),?\s*(?:3|three),?\s*(?:4|four))\b/i;
const LIST_STATE_REVIEW_SPEECH_RE =
  /\b(?:it\s+got\s+everything|got\s+everything|everything\s+disappeared|what\s+happened\s+to\s+all\s+the\s+things|nice\s+to\s+meet\s+you\s+(?:is\s+)?(?:still\s+)?(?:on|in)\s+(?:there|the\s+list)|there'?s\s+no\s+.+?\s+on\s+(?:there|the\s+list)|it\s+says\s+nice\s+to\s+meet\s+you|says?\s+number\s+one\s+nice\s+to\s+meet\s+you)\b/i;
const LIST_PRODUCT_REVIEW_REHEARSAL_RE =
  /\b(?:so\s+i\s+said|whatever\s+i\s+said|it\s+opened\s+it\s+up|opened\s+it\s+up|got\s+to\s+be\s+taken\s+care\s+of|taken\s+care\s+of|after\s+we\s+make\s+the\s+list|before\s+anything\s+gets\s+on\s+there|what\s+do\s+you\s+want\s+(?:me\s+)?to\s+put\s+on\s+(?:that|the|your\s+\w+)\s+list|should\s+say|should\s+have\s+gone|he\s+should\s+have\s+said|6\s+should\s+say|six\s+should\s+say|if\s+i\s+say\b|when\s+(?:the\s+)?user\s+says\s+something\s+like|when\s+i\s+say\s+something\s+like|something\s+like\s+open\b|anything\s+like\s+that\s+should\s+key|should\s+key\s+the\s+system|auto[-\s]?generate\s+(?:the\s+)?(?:list|word)|number\s+(?:1|one|2|two)\s+says|none\s+of\s+this\s+makes\s+any\s+logical\s+sense|look\s+at\s+what'?s\s+on\s+the\s+list|look\s+at\s+what\s+is\s+on\s+the\s+list|the\s+list\s+right\s+now|for\s+to\s+buy\s+for\s+christmas|like\s+a\s+ring\s+for\s+their\s+wife|toys\s+for\s+their\s+kids|things\s+like\s+that)\b/i;

function normalizeListFlowFeedbackText(text: string): string {
  return stripDirect6Address(text)
    .replace(/[\u2013\u2014-]+/g, " ")
    .replace(/[.,!?;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isListFlowProductFeedbackSpeech(text: string): boolean {
  const value = normalizeListFlowFeedbackText(text);
  if (!value || isIdeaBoxActionRequest(value)) return false;
  return (
    LIST_BUG_FEEDBACK_RE.test(value) ||
    /\b(?:system|app|six|6|he)\s+(?:created|made|started|opened)\b.{0,80}\b(?:walmart|grocery|shopping|to\s*do|todo)?\s*list\b/i.test(value) ||
    /\b(?:walmart|grocery|shopping|to\s*do|todo)?\s*list\b.{0,80}\b(?:already\s+(?:made|created|open(?:ed)?)|created\s+perfectly)\b/i.test(value) ||
    /\b(?:want me to|wants me to)\s+(?:start|make|create|open)\b.{0,80}\b(?:walmart|grocery|shopping|to\s*do|todo)?\s*list\b/i.test(value) ||
    /\b(?:he|six|6)\s+should\s+(?:have\s+)?(?:not\s+)?(?:say|said)\b/i.test(value) ||
    /\b(?:what\s+do\s+you\s+want|what\s+would\s+you\s+like)\b.{0,80}\bput\b.{0,80}\b(?:walmart|grocery|shopping|to\s*do|todo)?\s*list\b/i.test(value) ||
    /\b(?:just\s+)?number\s+(?:1|one)\b.{0,50}\bnumber\s+(?:2|two)\b.{0,50}\b(?:came\s+up|showed\s+up|popped\s+up)\b/i.test(value) ||
    /\bnumber\s+(?:1|one|2|two)\b.{0,80}\b(?:already\s+made|make\s+that|came\s+up|says?)\b/i.test(value) ||
    /\bme\s+to\s+make\s+that\s+because\b/i.test(value) ||
    /\b(?:work\s+on\s+this\s+until\s+you\s+get\s+it\s+right|significantly\s+better|not\s+a\s+problem\s+anymore|smoke\s+test)\b/i.test(value)
  );
}

function isListFlowFeedbackFragment(text: string): boolean {
  const value = normalizeListFlowFeedbackText(text);
  if (!value) return false;
  return (
    isListFlowProductFeedbackSpeech(value) ||
    /^(?:and\s+)?(?:for\s+sure|till\s+this|til\s+this|until\s+this|right|is)$/.test(value)
  );
}

function extractSayBackText(text: string): string | null {
  const value = stripDirect6Address(text)
    .replace(/[\u2013\u2014]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    /\b(?:can|could|should|would|might|may|it|he|six|6|they)\s+say\b/i.test(value) ||
    /\bsay\s+something\s+about\b/i.test(value)
  ) {
    return null;
  }
  const tail =
    value.match(/\bsay\s+that\s+back\s+to\s+me[\s,.!?:-]+(.{2,90})$/i)?.[1] ??
    value.match(/\bsay\s+the\s+words\s+to\s+me[\s,.!?:-]+(.{2,90})$/i)?.[1] ??
    value.match(/\bthe\s+words\s+to\s+me[\s,.!?:-]+(.{2,90})$/i)?.[1] ??
    value.match(/^\s*(?:please\s+)?say[,:]?\s+(.{2,90})$/i)?.[1] ??
    null;
  if (!tail) return null;
  const cleaned = stripDirect6Address(tail)
    .replace(/^(?:the\s+words\s+)?(?:to\s+me\s+)?/i, "")
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || /^(?:it|that|this|something|something about.*)$/i.test(cleaned)) return null;
  if (cleaned.length > 90) return null;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function isListReviewOrLayoutSpeech(text: string): boolean {
  const value = text
    .replace(/[.,!?;:\u2013\u2014-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (LIST_STATE_REVIEW_SPEECH_RE.test(value)) return true;
  if (LIST_BUG_FEEDBACK_RE.test(value)) return true;
  if (
    /\b(?:keep\s+the\s+name|only\s+change\s+it|upon\s+(?:6|six)\s+confirming|change\s+the\s+name\s+of\s+(?:it|the\s+list)|start\s+a\s+new\s+list|what\s+he\s+should\s+actually\s+say)\b/i.test(
      value,
    )
  ) {
    return true;
  }
  return (
    isListFlowProductFeedbackSpeech(value) ||
    LIST_REVIEW_OR_LAYOUT_SPEECH_RE.test(value) ||
    LIST_PRODUCT_REVIEW_REHEARSAL_RE.test(value)
  );
}

function isPendingListNamingFiller(text: string): boolean {
  const value = stripDirect6Address(text)
    .replace(/[.,!?;:\u2013\u2014-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!value) return true;
  if (/^(?:yes|yeah|yep|yup|sure|ok|okay|please|right|correct|start it|open it|make it)$/i.test(value)) {
    return true;
  }
  if (/^(?:(?:um|uh|ah|hm|hmm|mm|mm hmm|uh huh)\s*)+$/i.test(value)) {
    return true;
  }
  return /^(?:no\s+)?(?:i\s+)?(?:want|need|would\s+like)?\s*(?:a|an|the)?\s*(?:(?:um|uh|ah|hm|hmm|mm)\s*)+$/i.test(
    value,
  );
}

function isListTranscriptFeedbackItem(item: string): boolean {
  const value = item
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (LIST_UI_META_FEEDBACK_RE.test(value)) return true;
  if (LIST_PRODUCT_REVIEW_REHEARSAL_RE.test(value)) return true;
  if (
    /^(?:those three|these three|those \d+|these \d+|so let'?s|refine these|let'?s try to|lets try to|work through these|these problems|top|box|in the top|it says yes|okay so it says yes|system to (?:6|six)|so let'?s work|let'?s work on that also|number one says top|number 1 says top|six just asked me|6 just asked me|number one says|number two says|fix those errors|so let'?s fix those errors|lets fix those errors|automatically gets?|added)$/i.test(
      value,
    )
  ) {
    return true;
  }
  if (/^(?:or|one or the other(?: should happen)?|really falling apart(?: here)?|falling apart(?: here)?)$/.test(value)) {
    return true;
  }
  if (ACTIVE_SCREEN_DESIGN_FEEDBACK_RE.test(value)) return true;
  if (CTA_TEXT_DESIGN_FEEDBACK_RE.test(value)) return true;
  if (
    /^(?:too dark|too light|i dropped|screenshots?|dropbox(?: about it)?|of course he'?s|the opacity(?: in the center)?|opacity(?: in the center)?|lists? from before|one full second|1 full second|half second|full half second|1 1,?000|2 1,?000|3 1,?000|colors? way too fast|flipped through|he flipped through|can that be|if anything|they can be a little less wide|make it a little smidge|smidge thinner|taller in the text|all taller|good job|it can go down (?:two|2) smidges too|smidges? on the right|smidges? on the left|keep the top exactly where it is)$/.test(
      value,
    )
  ) {
    return true;
  }
  if (/^(?:i'?m|i am)\s+in\s+the\s+mood\s+for\b/i.test(value)) {
    return true;
  }
  return (
    /\b(?:opacity|too dark|too light|screenshots?|dropbox|of course he'?s|lists? from before|one full second|1 full second|half second|full half second|1 1,?000|2 1,?000|3 1,?000|colors? way too fast|flipped through)\b/i.test(
      value,
    ) && !LIST_MUTATION_SIGNAL_RE.test(value)
  );
}
const APP_FEEDBACK_ONLY_RE =
  /\b(?:codex|brand colors?|white(?:\s+lettering)?|lettering|not attractive|same size|low on the screen|start it in the middle|full size|blank list|different color|make those changes|stop it here|just go ahead|date night ideas? has got to go|you don'?t want to have date nights?|90[-\s]?year[-\s]?old|6[-\s]?year[-\s]?old|little circle|left[-\s]?hand side|screen|screenshot|print screen|white box|white circle|white outside line|circle around the x|around the x|brand colors around|yellow squares?|square box|this box|the box|inside the box|6'?s box|six'?s box|box that 6 is in|box that six is in|box could be bigger|box should be bigger|box moved|tried to move it|full[-\s]?size box|larger box|much larger box|big and square|came up pink|too short|popup|pop up|zip code|zipcode|should not pop up|pillboxes?|pill boxes?|pillbox changes|prompt pills?|prompt labels?|things below|things? should toggle|buttons? should toggle|toggle|toggling|say something like|no\s+(?:date night ideas?|local hikes?|nearby events?|weekend plans?)|i don'?t like the way that sounds|should ask me|do i want to|adjust box spacing|compare font sizes|review layout options|optimize text alignment|text alignment|font sizes|box spacing|four boxes|4 boxes|four things came up|4 things came up|under (?:the|this) list|where did this list come from|this list should not be up here|came as number|top button|shirt|real estate|limited space|terms line|bottom two pillboxes|top two pillboxes|square is a little bit low|scrollable|swipe|swiped|cache clean|slate clean|new user|returning user|none of these are links|none of this was (?:a )?relevant|things are changing|making logical sense|should have been able to finish|give you too much information|getting really good|talking over|talk(?:ing)? to me|talking to you|talked to me|normal conversation|being quiet|on purpose|not talking|interrupting|interruptions?|people (?:are )?not gonna like|people won'?t like|get him fixed|get six fixed|fix 6|fix six|malfunction|malfunctioning|health monitor|11\s*labs\s+monitoring|liveavatar\.com|run out of credits|system can come down|reports? on that|monitoring built into the system|transcript|transcription|supabase|captured|smoke test|count to 10|click out|stand down|ruined it|needs?\s+to\s+be\s+wider|smidges?\s+on\s+the\s+(?:right|left)|go\s+down\s+(?:two|2)\s+smidges?|keep\s+the\s+top\s+exactly\s+where\s+it\s+is)\b/i;
const PRODUCT_PROBLEM_FEEDBACK_RE =
  /\b(?:broken|wrong|wrong item|didn'?t work|did not work|doesn'?t work|does not work|not working|can'?t hear|cannot hear|not listening|silent|not responding|stopped talking|cut off|frozen|stuck|wrong list|won'?t remove|will not remove|did not close the session|didn'?t close the session|delayed|stayed up too long|stay(?:s|ed)? (?:this way )?for (?:way )?too long|too high|too big|huge|side to side|did not ask permission|didn'?t ask permission|hate this|looks bad|this sucks|bad layout|malfunction|none of these are links|none of this was (?:a )?relevant|things are changing|making logical sense|pretend he doesn'?t know me|doesn'?t know where i live|does not know where i live|not interested in)\b/i;
const PRODUCT_FEEDBACK_GUARD_RE =
  /\b(?:codex|screenshot|print screen|screen|small mode|larger mode|full[-\s]?size box|larger box|low on the screen|start it in the middle|full size|blank list|different color|make those changes|stop it here|just go ahead|date night ideas? has got to go|you don'?t want to have date nights?|90[-\s]?year[-\s]?old|6[-\s]?year[-\s]?old|brand colors?|around the x|circle around the x|white box|white circle|inside the box|6'?s box|six'?s box|box that 6 is in|box that six is in|box could be bigger|box should be bigger|box moved|tried to move it|popup|pop up|zip code|zipcode|should not pop up|pillboxes?|pill boxes?|pillbox changes|prompt pills?|prompt labels?|things below|things? should toggle|buttons? should toggle|toggle|toggling|say something like|no\s+(?:date night ideas?|local hikes?|nearby events?|weekend plans?)|i don'?t like the way that sounds|should ask me|do i want to|adjust box spacing|compare font sizes|review layout options|optimize text alignment|text alignment|font sizes|box spacing|four boxes|4 boxes|four things came up|4 things came up|talk(?:ing)? to me|talking to you|talking to codex|talked to me|normal conversation|did not close the session|didn'?t close the session|stayed up too long|stay(?:s|ed)? (?:this way )?for (?:way )?too long|too high|too big|too short|huge|side to side|nice size|not changing|revert(?:s|ed)? to (?:the )?pillboxes?|ask permission|do you want to start|should say|what do you want|what do i want to do|want to do now|going to open it up|lengthening|pulling it all the way down|under (?:the|this) list|where did this list come from|this list should not be up here|came as number|top button|shirt|real estate|limited space|terms line|bottom two pillboxes|top two pillboxes|square is a little bit low|scrollable|swipe|swiped|cache clean|slate clean|new user|returning user|things (?:that )?people might want|wrong|word right is wrong|doesn'?t know where i live|does not know where i live|pretend he doesn'?t know me|markets? of craft|crafts? and jewelry|gem and jewelry|not interested in|should have been able to finish|give you too much information|getting really good|finish your thought|discuss challenges|plan next steps|ask for help|where are these (?:\d+|five) things coming up|none of this was (?:a )?relevant|what is going on|list is continuing|keeps? going|popped?\s+up|by the way|transcript|captured|smoke test|count to 10|click out|stand down|ruined it|needs?\s+to\s+be\s+wider|smidges?\s+on\s+the\s+(?:right|left)|go\s+down\s+(?:two|2)\s+smidges?|keep\s+the\s+top\s+exactly\s+where\s+it\s+is)\b/i;
const ACTIVE_SCREEN_DESIGN_FEEDBACK_RE =
  /\b(?:mobile|take the leap|turbocharge your life|don'?t touch ai asap|do not touch ai asap|ai asap|opacity(?: is)? still too heavy|opacity|lighter,? at least|25%|color variation|colors? (?:were|are)? too fast|slow(?:ed)? (?:the )?timing|1 full second|one full second|can'?t see (?:them|it)|cannot see (?:them|it)|against the back|letters?|lettering|fonts?|font sizes?|wide|less wide|thinner|smidge|taller(?: in the text)?|all taller|3 sizes bigger|three sizes bigger|between the lines|center between the lines|circles? around the x|x'?s|if anything|ton of things on the list|good job|opposite|contrast|text should|text pop|background color|base color|soft white[-\s]?blue|almost black blue|dark yellow|other style of the notes?|different look|real sticky note|with lines|big space at the top|solid color|below it,?\s+opacity|stay on key|pillboxes?|build a business|build a better life|me list|blank list is way too small|named it me list|he named it me list)\b/i;
const CTA_TEXT_DESIGN_FEEDBACK_RE =
  /\b(?:tap\/?click|tap click|tap,?\s*click|tap\/click anywhere|tap click anywhere|to talk to 6|talk to 6|top two lines|all the text|color fade|colors? fade|fade (?:inside|within)|letter fade|goudy|gaud(?:i|\u00ed)|font options?|open in the browser like we did|in the thread|in the conversation)\b|\b(?:text|letters?|lettering).{0,90}\b(?:yellow|gold(?:en)?|brown(?:er)?|fade|shade)\b|\b(?:yellow|gold(?:en)?|brown(?:er)?|shade).{0,90}\b(?:text|letters?|lettering)\b/i;
const BLOCKED_THOUGHT_PROMPT_RE =
  /^(?:complete your question|complete your thought|clarify your thought|improve conversation flow|practice speaking clearly|explain your idea|finish your thought|discuss challenges|discuss possible solutions|plan next steps|ask for help|ask for more details|confirm understanding|review key points|check understanding|summarize conversation|clarify (?:his|the)? limitations|possible solutions|adjust box spacing|compare font sizes|review layout options|optimize text alignment|compare popular codecs|explain (?:different |video |audio )?codecs?|list codec uses|change subject|everything|forward|ford|now|now it'?s|wow|man|however|why|why can'?t he|so six told me he couldn'?t|there|all right|before moving forward|said the four|wigging out|like to[-\s]?do list|white box|white circle|oh my god|it came with 4 boxes under there|it came with four boxes under there|i the 4 boxes|i the four boxes|market of crafts galore)$/i;
const PRODUCT_PRAISE_FEEDBACK_RE =
  /\b(?:i love this|love this|that worked|worked perfectly|perfect|that'?s beautiful|that is beautiful|awesome|great job|looks great|that looks good)\b/i;
const UI_TRANSCRIPT_FEEDBACK_RE =
  /\b(?:came up after|box (?:just )?(?:came up|went away)|square box|big and square|came up pink|pillboxes? (?:came back|should)|went away|plan weekend plans|we just planned this weekend|we just did (?:the )?plan(?: the)? weekend|no\s+(?:date night ideas?|local hikes?|nearby events?|weekend plans?)|i don'?t like the way that sounds|adjust box spacing|compare font sizes|review layout options|optimize text alignment|for the record|did not close the to[-\s]?do list|didn'?t close the to[-\s]?do list|take a screenshot|the,?\s+the four|and then the 4 boxes|and then the four boxes|full transcript|entire transcript|where it ends|click out|count to 10|smoke test|stand down|ruined it|should have talked to me|should ask me|do i want to|being quiet|on purpose|not talking|transcription|supabase|codex is monitoring)\b/i;
const PREFERENCE_SIGNAL_RE =
  /\b(?:i love|i like|i hate|i don'?t like|i do not like|i prefer|my favorite|i can'?t stand|i want|i need)\b.{2,160}/i;
const SENSITIVE_MEMORY_RE =
  /\b(?:password|passcode|pin|social security|ssn|medical|diagnosis|medicine|medication|bank|banking|credit card|debit card|routing number|account number|api key|secret key|private key|seed phrase)\b/i;
const APP_FEEDBACK_QUIET_MS = 8_000;
const PRODUCT_REVIEW_INTENT_GUARD_MS = 90_000;
const SILENCE_OR_CUTOFF_FEEDBACK_RE =
  /\b(?:6|six|he)\s+(?:is|was|just|will|would|keeps?|keep|kept|can|will|would|(?:wi|wo)n'?t|(?:i|he)'?ll)?\s*(?:silent|being silent|not responding|stopped talking|stopping talking|stop talking|started to stop|cut off|looking at me|stop(?:s|ped)?|sputtering|frozen|stuck|discombobulated)|\b(?:he just did it again|just did it again|half[-\s]?word|half a word|you there|waiting for a response|expecting him to say something|starts? saying (?:a )?(?:couple|few) words?|then (?:he|6|six)(?:'?ll| will)? stop|just sit there|sit there for|not finishing (?:his )?sentences?|should (?:not be silent|be talking|keep talking)|shouldn'?t be silent|should find something to say|appropriate for him to talk|when (?:it'?s|it is) appropriate for him to talk|why\s+(?:is|was)\s+(?:he|6|six)\s+sputtering)\b/i;
const NAME_PROMPT_AVOID_RE =
  /\b(?:what were you saying|what was that|you there|silent|not responding|stopped talking|cut off|pillbox|pillboxes?|prompt boxes?|idea boxes?|take the leap|turbocharge your life|taller|letters?|wide|thinner|smidge|opacity|mobile)\b/i;
const DIRECT_6_ADDRESS_RE =
  /(?:^\s*(?:hey[,\s]+)?(?:six|6)(?:\s*[,.:]\s*|\s+(?!year\b))|[,;:.]\s*(?:six|6)\s*$|\b(?:six|6)\s*[,.:]\s*)/i;
const CODEX_DIRECTED_APP_TASK_RE =
  /\bcodex\b|\b(?:put|make|create)\s+(?:a\s+)?lists?\s+(?:together\s+)?of\s+(?:all\s+)?(?:the\s+)?things\s+(?:that\s+)?(?:you\s+need\s+to\s+do|need\s+to\s+be\s+fixed)\b|\bof\s+all\s+(?:the\s+)?things\s+that\s+need\s+to\s+be\s+fixed\b|\bdo\s+them\s+all\b|\b(?:make|create|start)\s+(?:a\s+)?list\s+of\s+everything\b/i;
const PRODUCT_REVIEW_CONTEXT_RE =
  /\b(?:codex|soup codex|supabase|transcription|monitoring|screenshot|screen shot|prompt labels?|pillboxes?|box|came up pink|big and square|being quiet|on purpose|not talking|too short|low on the screen|start it in the middle|full size|blank list|different color|make those changes|stop it here|just go ahead|perspective on the size|what(?:'s| is) on the list|say(?:ing)? what(?:'s| is) on the list|what were the 4 things|what were the four things|general things|most people|all these things|date night ideas? number|date night ideas? has got to go|you don'?t want to have date nights?|90[-\s]?year[-\s]?old|6[-\s]?year[-\s]?old)\b/i;
const NORMAL_CONVERSATION_ACK_RE =
  /\b(?:talk(?:ing)? to me|talk normally|normal conversation|like a normal conversation|should be talking|are you gonna talk|are you going to talk|from here on out)\b/i;
const PROMPT_REFRESH_MIN_MS = 12_000;
const PROMPT_BRAIN_DELAY_MS = 1_800;
const LIST_VAGUE_BARE_ITEM_RE =
  /\b(?:stuff|things|thing|whatever|all kinds)\b/i;
const LIST_COLOR_DECIDE_RE =
  /\b(?:you decide|you choose|pick for me|choose for me|surprise me|your call|whatever you think|whatever looks best|you can decide)\b/i;
const LIST_COLOR_CHANGE_REQUEST_RE =
  /\b(?:can you|could you|will you|would you|please|make|turn|change|switch|set)\b.{0,56}\b(?:it|this|that|list|note|sticky note|sticky notes?)\b.{0,56}\b(?:color|colour|shade|blue|green|gold|golden|yellow|orange|amber|purple|violet|white|black|gray|grey|silver|pink|rose|red|darker|lighter|brighter|deeper|mid brand|dark brand|light brand)\b|\b(?:change|switch|set)\b.{0,56}\b(?:color|colour|shade)\b/i;
const LIST_COLOR_REVIEW_ONLY_RE =
  /\b(?:he did not change it to|he didn'?t change it to|did not change it to|didn'?t change it to|number one is colors?|number 1 is colors?|colors? and you'?re seeing|colors? and you are seeing|are you seeing|you seeing)\b/i;
const LIST_OPEN_REVIEW_ONLY_RE =
  /\b(?:shopping list popped up|list popped up|want me to start (?:that|the)?\s*(?:grocery|shopping|walmart|to[-\s]?do|todo)?\s*list|should either pop up|him saying nothing|he saying nothing|he said nothing|just it'?s there|now it says number|just fix this stuff)\b/i;

function isIdeaBoxActionRequest(text: string): boolean {
  const value = stripDirect6Address(text)
    .replace(/[\u2013\u2014-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!value) return false;
  if (
    /\b(?:when i say|if i click|clicked|button|pillboxes?|pill boxes?|prompt labels?|should|should be|should start|just disappeared|just looks at me|starts saying|product feedback|codex|screenshot|supabase)\b/i.test(
      value,
    )
  ) {
    return false;
  }
  return (
    /^let'?s work on this next:\s*(?:build a better life|build friendships|build relationships\/friends|build relationships|make friends|find your life partner|set\s*(?:\/|&)\s*track life goals?|set goals?|set (?:life|relationship|business|money|social|health|family|work|personal|career|fitness|home) goals?|set main goal|fix one problem|make action plan|be fully honest|own your part|plan better talk|build your socials|build your brand|market yourself|pick platforms|plan content|write first post|build a business|business ideas|likes and loves|your passions|what you're good at|make more money|build financial freedom|create financial freedom|cut waste|invest for future|start(?:ing)? (?:a )?side hustle|side hustle ideas|use your skills|pick first offer|find first buyer|make more friends)$/i.test(value) ||
    /\b(?:help me|let'?s|lets|can you|could you|you can|i want to|i need to)\b.{0,48}\b(?:build a better life|build friendships|build relationships\/friends|build relationships|make friends|find your life partner|build your socials|build your brand|market yourself|build a business|make more money|build financial freedom|create financial freedom|cut waste|invest for future|start(?:ing)? (?:a )?side hustle|side hustle ideas|use your skills|pick first offer|find first buyer|make more friends|be fully honest|own your part|plan better talk|set\s*(?:\/|&)\s*track life goals?|set goals?|set (?:life|relationship|business|money|social|health|family|work|personal|career|fitness|home) goals?)\b/i.test(
      value,
    )
  );
}

function promptFromIdeaBoxActionRequest(text: string): string | null {
  const value = stripDirect6Address(text)
    .replace(/[\u2013\u2014-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!isIdeaBoxActionRequest(value)) return null;
  const labels: Array<[string, string]> = [
    ["build a better life", "Build a Better Life"],
    ["build friendships", "Build Friendships"],
    ["build relationships/friends", "Build Friendships"],
    ["build relationships", "Build Relationships"],
    ["make friends", "Build Friendships"],
    ["find your life partner", "Find Your Life Partner"],
    ["set/track goals", "Set & Track Goals"],
    ["set & track goals", "Set & Track Goals"],
    ["set/track life goals", "Set & Track Goals"],
    ["set & track life goals", "Set & Track Goals"],
    ["set relationship goals", "Set Relationship Goals"],
    ["be fully honest", "Be Fully Honest"],
    ["own your part", "Own Your Part"],
    ["plan better talk", "Plan Better Talk"],
    ["set business goals", "Set Business Goals"],
    ["set money goals", "Set Money Goals"],
    ["set social goals", "Set Social Goals"],
    ["set health goals", "Set Health Goals"],
    ["set family goals", "Set Family Goals"],
    ["set work goals", "Set Work Goals"],
    ["set personal goals", "Set Personal Goals"],
    ["set career goals", "Set Career Goals"],
    ["set fitness goals", "Set Fitness Goals"],
    ["set home goals", "Set Home Goals"],
    ["set life goals", "Set & Track Goals"],
    ["set goals", "Set & Track Goals"],
    ["set main goal", "Set Main Goal"],
    ["fix one problem", "Fix One Problem"],
    ["make action plan", "Make Action Plan"],
    ["build your socials", "Build Your Socials"],
    ["build your brand", "Build Your Brand"],
    ["market yourself", "Market Yourself"],
    ["pick platforms", "Pick Platforms"],
    ["plan content", "Plan Content"],
    ["write first post", "Write First Post"],
    ["build a business", "Build a Business"],
    ["business ideas", "Business Ideas"],
    ["likes and loves", "Likes and Loves"],
    ["your passions", "Your Passions"],
    ["what you're good at", "What You're Good At"],
    ["make more money", "Make More Money"],
    ["build financial freedom", "Create Financial Freedom"],
    ["create financial freedom", "Create Financial Freedom"],
    ["cut waste", "Cut Waste"],
    ["invest for future", "Invest for Future"],
    ["starting a side hustle", "Start Side Hustle"],
    ["start a side hustle", "Start Side Hustle"],
    ["start side hustle", "Start Side Hustle"],
    ["side hustle ideas", "Side Hustle Ideas"],
    ["use your skills", "Use Your Skills"],
    ["pick first offer", "Pick First Offer"],
    ["find first buyer", "Find First Buyer"],
    ["make more friends", "Build Friendships"],
  ];
  return labels.find(([needle]) => value.includes(needle))?.[1] ?? null;
}

function isListReviewFeedback(text: string): boolean {
  const value = stripDirect6Address(text).toLowerCase();
  if (isIdeaBoxActionRequest(value)) return false;
  if (isNewListNameObservation(value)) return true;
  if (LIST_UI_META_FEEDBACK_RE.test(value)) return true;
  if (LIST_PRODUCT_REVIEW_REHEARSAL_RE.test(value)) return true;
  if (LIST_OPEN_REVIEW_ONLY_RE.test(value)) return true;
  if (ACTIVE_SCREEN_DESIGN_FEEDBACK_RE.test(value)) return true;
  if (CTA_TEXT_DESIGN_FEEDBACK_RE.test(value)) return true;
  return /\b(?:for the record|had to ask|before he did it|did finally do it|changed from \w+ to \w+|no more changing colors|unless the user explicitly asks|the entire|entire list|list should be|color of the list|not just (?:the )?letters?|lighters?|darkers?|x'?s|squares?|opacity|too dark|too light|one full second|1 full second|half second|full half second|one thousand|1 1,?000|2 1,?000|3 1,?000|flipped through|colors? way too fast|he named it|named it|this one|shouldn'?t have a name|should not have a name|what it should be for|until i tell|get the name correct|changed to .{0,36}list|let'?s get that changed|lets get that changed|mostly a mid|i dropped|screenshots?|dropbox about it|of course he'?s|lists? from before|did not close .{0,36}list|didn'?t close .{0,36}list)\b/i.test(
    value,
  );
}

function isStickyNoteColorMention(text: string): boolean {
  const value = stripDirect6Address(text).toLowerCase();
  if (/\b(?:codex|supabase|soup codex|transcript|transcription|screenshot|screen shot|for the record)\b/i.test(value)) {
    return false;
  }
  const colorWord =
    /\b(?:color|colour|shade|shades|blue|green|gold|golden|yellow|orange|amber|purple|violet|white|black|gray|grey|silver|pink|rose|red|darker|lighter|brighter|deeper|too bright|too dark)\b/i;
  const stickyTarget =
    /\b(?:sticky notes?|notes?|list|lists|walmart list|grocery list|shopping list|to[-\s]?do list|todo list)\b/i;
  const colorComplaint =
    /\b(?:don'?t like|dont like|do not like|hate|dislike|not liking|ugly|wrong|bad)\b.{0,56}\b(?:color|colour|shade|blue|green|gold|yellow|orange|amber|purple|violet|white|black|gray|grey|silver|pink|rose|red)\b|\b(?:color|colour|shade)\b.{0,56}\b(?:ugly|wrong|bad|awful|too bright|too dark|not right)\b/i;
  return (
    (colorWord.test(value) && stickyTarget.test(value)) ||
    colorComplaint.test(value)
  );
}

function createClientTranscriptSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `client_${crypto.randomUUID()}`;
  }
  return `client_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

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

type DemoListAccentUpdate = ListAccentUpdate & {
  family: string;
  tone: "light" | "dark";
};

const LIST_COLOR_NAME_MAP: Record<string, string> = {
  amber: "#e8b46b",
  black: "#050505",
  blue: "#8ec5ff",
  blurple: "#5865f2",
  brown: "#b8895b",
  burgundy: "#7f1d3b",
  "burnt orange": "#c65f28",
  "burned orange": "#7c2d12",
  coral: "#ff9f8c",
  copper: "#c96f3d",
  cyan: "#67e8f9",
  gold: "#f5c76f",
  gray: "#d1d5db",
  green: "#86efac",
  grey: "#d1d5db",
  indigo: "#a5b4fc",
  "light blue": "#bfdbfe",
  "light orange": "#fed7aa",
  "light purple": "#ddd6fe",
  "light yellow": "#fef08a",
  lavender: "#c4b5fd",
  lilac: "#d8b4fe",
  lime: "#bef264",
  magenta: "#e879f9",
  maroon: "#7f1d1d",
  mint: "#99f6e4",
  navy: "#7aa7ff",
  orange: "#fdba74",
  orchid: "#c084fc",
  oxblood: "#641e2e",
  pink: "#f9a8d4",
  plum: "#7e3a8a",
  purple: "#d8b4fe",
  red: "#fca5a5",
  rose: "#fda4af",
  silver: "#e5e7eb",
  teal: "#5eead4",
  terracotta: "#c96d4d",
  violet: "#c4b5fd",
  white: "#ffffff",
  wine: "#8a2445",
  yellow: "#fde68a",
  "soft blue": "#bfdbfe",
  "soft orange": "#fed7aa",
  "soft purple": "#ddd6fe",
  "soft yellow": "#fef08a",
  "dark blue": "#1d4ed8",
  "dark orange": "#7c2d12",
  "dark purple": "#4c1d95",
  "dark yellow": "#a16207",
  "hard yellow": "#a16207",
};

function colorNameRegexSource(color: string): string {
  return color
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
}

const LIST_COLOR_NAME_PATTERN = Object.keys(LIST_COLOR_NAME_MAP)
  .sort((a, b) => b.length - a.length)
  .map(colorNameRegexSource)
  .join("|");

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

function colorWithAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return softFromHex(LIST_ACCENT_COLORS.amber.solid, alpha);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function perceivedBrightness(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 180;
  return rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
}

function isDarkHex(hex: string): boolean {
  return perceivedBrightness(hex) < 92;
}

function contrastTextForHex(hex: string): string {
  const brightness = perceivedBrightness(hex);
  if (brightness < 118) return adjustHexShade(hex, 0.82);
  if (brightness > 178) return adjustHexShade(hex, -0.78);
  return brightness < 150 ? adjustHexShade(hex, 0.86) : adjustHexShade(hex, -0.82);
}

function listColorThemeFor(list: AssistantList | null): ListColorTheme {
  if (!list) {
    const base = LIST_ACCENT_COLORS.amber;
    return { ...base, foreground: "#050505" };
  }
  const base = LIST_ACCENT_COLORS[list.accentColor] ?? LIST_ACCENT_COLORS.amber;
  const customHex = list.accentHex?.trim();
  if (customHex && hexToRgb(customHex)) {
    return {
      label: list.accentLabel ?? base.label,
      foreground: "#050505",
      solid: customHex,
      soft: softFromHex(customHex, 0.22),
    };
  }
  return {
    ...base,
    label: list.accentLabel ?? base.label,
    foreground: "#050505",
  };
}

function isInstructionalColorFeedback(text: string): boolean {
  const value = stripDirect6Address(text).toLowerCase();
  return /\b(?:what i think|he should|six should|6 should|should do is say|do you want it|colors? come up|as the colors? come up|can we do that|is that too|intricate|he'?ll say|he will say|have the colors? come up)\b/i.test(
    value,
  );
}

function normalizeSimpleListColorChoiceText(text: string): string {
  return stripDirect6Address(text)
    .toLowerCase()
    .replace(/[.!?,;:\-\u2013\u2014]+/g, " ")
    .replace(
      /^(?:how about|what about|maybe|go with|let'?s do|lets do|can we do|could we do|can you do|i want|i like|i would like|i'?d like|pick|choose|use)\s+/i,
      " ",
    )
    .replace(/\b(?:um|uh|okay|ok|please|so|just|make|turn|change|set|it|the|this|that|note|sticky|color|colour|to|a|an|with)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSingleListColorChoiceValue(value: string): boolean {
  if (/^#[0-9a-f]{6}$/i.test(value)) return true;
  return new RegExp(
    `^(?:(?:light|lighter|soft|softer|dark|darker|deep|deeper|hard|bright|brighter|burnt|burned)\\s+)?(?:${LIST_COLOR_NAME_PATTERN})$`,
    "i",
  ).test(value);
}

function isBareListColorSelection(text: string): boolean {
  const value = stripDirect6Address(text)
    .toLowerCase()
    .replace(/[.!?,;:\-\u2013\u2014]+/g, " ")
    .replace(/\b(?:um|uh|okay|ok|please|so|just)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return isSingleListColorChoiceValue(value);
}

function isSimplePendingColorSelection(text: string): boolean {
  if (isInstructionalColorFeedback(text)) return false;
  if (LIST_COLOR_DECIDE_RE.test(text)) return true;
  return isSingleListColorChoiceValue(normalizeSimpleListColorChoiceText(text));
}

function buildListStateLogMessage(
  action: AssistantListStateAction,
  list: AssistantList,
  options: {
    activeListId: string | null;
    isShoppingMode: boolean;
    visible?: boolean;
    detail?: Record<string, unknown>;
  },
): string {
  return `${LIST_STATE_LOG_PREFIX} ${JSON.stringify({
    event: "list_state",
    version: 1,
    action,
    at: new Date().toISOString(),
    list: {
      id: list.id,
      title: list.title,
      kind: list.kind,
      displayStyle: list.displayStyle,
      accentColor: list.accentColor,
      accentHex: list.accentHex ?? null,
      accentLabel: list.accentLabel ?? null,
      itemCount: list.items.length,
      items: list.items.slice(0, MAX_LIST_STATE_LOG_ITEMS),
      truncated: list.items.length > MAX_LIST_STATE_LOG_ITEMS,
      updatedAt: list.updatedAt,
    },
    ui: {
      activeListId: options.activeListId,
      isActive: options.activeListId === list.id,
      isVisible: options.visible ?? options.activeListId === list.id,
      isShoppingMode: options.isShoppingMode,
      panel: options.isShoppingMode ? "shopping" : "compact",
    },
    detail: options.detail ?? null,
  })}`;
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
    if (/\bhoney[-\s]?do\b/i.test(cleaned)) return "Honey-do List";
    const scope = cleaned
      .replace(/\b(?:todo|to-do|to do|task|tasks|list)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return scope ? `${titleCaseWords(scope)} To Do List` : "To Do List";
  }

  if (/\blist\b/i.test(cleaned) && !/^(?:list|new list)$/i.test(cleaned)) {
    return titleCaseWords(cleaned);
  }
  const withoutList = cleaned.replace(/\blist\b/gi, " ").trim();
  return withoutList ? titleCaseWords(withoutList) : "New List";
}

function listKindForTitle(title: string, fallback: AssistantListKind): AssistantListKind {
  if (/^grocery\s+list$/i.test(title)) return "grocery";
  if (/^(?:shopping|walmart)\s+list$/i.test(title)) return "shopping";
  if (/^honey[-\s]?do\s+list$/i.test(title)) return "todo";
  if (/^(?:to[-\s]?do|todo|task)\s+list$/i.test(title)) return "todo";
  return fallback;
}

function listTitleForSpeech(title: string): string {
  return title.replace(/\s+List$/i, " list");
}

function cleanRequestedListTitle(
  value: string,
  options: { appendList?: boolean } = {},
): string | null {
  const cleaned = value
    .replace(/[^\w\s'-]/g, " ")
    .replace(/^\s*(?:just\s+)?(?:call|name)\s+(?:it|this|that)\s+/i, " ")
    .replace(/^\s*(?:a|an|the|my)\s+(?=(?:grocery|shopping|walmart|to[-\s]?do|todo|task)\s+list\b)/i, "")
    .replace(/^\s*list\s+(?=(?:grocery|shopping|walmart|to[-\s]?do|todo)\s+list\b)/i, " ")
    .replace(
      /\b(?:just\s+)?(?:call|name)\s+(?:it|this|that)\b[\s\S]*$/i,
      " ",
    )
    .replace(
      /\b(?:go ahead and|go ahead|and then|then|so we can|so that|because|while we|after that|okay|ok)\b[\s\S]*$/i,
      " ",
    )
    .replace(
      /\b(?:title|name)\s+of\s+(?:this|that|the|my)?\s*(?:list|sticky note|note)\s+(?:to|as)\s+/i,
      " ",
    )
    .replace(/\b(?:um|uh|like|please|for me|right now|instead|now)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  if (/^(?:another|nother|different|other)(?:\s+list)?$/i.test(cleaned)) {
    return null;
  }
  if (/^(?:it\s+on(?:\s+the)?(?:\s+list)?|keep\s+the\s+name|keep\s+that\s+stored|remember\s+that|only|ask|cool|that\s+has)$/i.test(cleaned)) {
    return null;
  }
  if (/^(?:me|you|him|her|them|us|it|this|that|something|stuff|things)$/i.test(cleaned)) {
    return null;
  }
  if (/^(?:yes|yeah|yep|yup|sure|ok|okay|please|right|correct|start it|open it|make it)$/i.test(cleaned)) {
    return null;
  }
  if (/^shopping\s+list$/i.test(cleaned)) return "Shopping List";
  if (/^grocery\s+list$/i.test(cleaned)) return "Grocery List";
  if (/^walmart\s+list$/i.test(cleaned)) return "Walmart List";
  if (/^(?:to[-\s]?do|todo)\s+list$/i.test(cleaned)) return "To Do List";
  const shouldAppendList = options.appendList ?? true;
  const titleSource = shouldAppendList ? cleaned : cleaned.trim();
  if (!titleSource) return null;
  const titled = titleCaseWords(titleSource);
  return shouldAppendList && !/\blist\b/i.test(titled) ? `${titled} List` : titled;
}

function cleanCustomListTopic(value: string): string | null {
  const trimmedTopic = value
    .replace(
      /\b(?:and then|then|so we can|so that|because|while we|after that)\b[\s\S]*$/i,
      " ",
    )
    .replace(/\b(?:my|our|the|a|an)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const title = cleanRequestedListTitle(trimmedTopic, { appendList: false });
  if (
    !title ||
    /^(?:list|new list|me list|everything|all things|all the things|all that we just went through)$/i.test(
      title,
    )
  )
    return null;
  return title;
}

function detectCustomListTopicTitle(text: string): string | null {
  const topic = text.match(CUSTOM_LIST_TOPIC_START_RE)?.[1];
  return topic ? cleanCustomListTopic(topic) : null;
}

function extractActiveListRenameTitle(text: string): string | null {
  const value = stripDirect6Address(text);
  if (
    /\b(?:for the record|screenshot|screen shot|i want (?:him|six|6) to say|want (?:him|six|6) to say|should say|supposed to say|what would you like to name|what do you want to name|what should we call|name this list|what are we making|once it'?s called|once it is called|still called|should not|shouldn'?t|should have been|let'?s keep it at|just changed|changed somehow|changed to|it changed to|went back to|now it'?s|now it is|the list is open|list is open|looks? like|nothing that looks|unless i explicitly say|why (?:is|was) (?:it|this|that).{0,30}called|called lavender|lavender list|make this instead|user can change|people can change|color combo|generic|go[-\s]?to for most everyone|for most everyone|it says|it was called|this is getting|getting much better|getting better|getting great|came up|didn'?t come up until now)\b/i.test(
      value,
    )
  ) {
    return null;
  }
  const colorOnly =
    /\b(?:color|colour|shade|shades|lighter|darker|brighter|deeper|pink|blue|green|gold|golden|yellow|orange|amber|purple|violet|white|black|gray|grey|silver)\b/i.test(
      value,
    ) &&
    !/\b(?:grocery|shopping|walmart|to[-\s]?do|todo|task)s?\s+list\b/i.test(
      value,
    );
  if (colorOnly) return null;

  const shouldBeCalledKnownListTitle = /\b(?:this|that|it|this\s+list|that\s+list|the\s+list|this\s+sticky\s+note|that\s+sticky\s+note|the\s+sticky\s+note)\s+should\s+be\s+called\b.{0,24}\b(?:call\s+(?:it|this|that)\s+)?(?:a|an|the)?\s*((?:shopping|walmart|grocery|to[-\s]?do|todo|task)\s+list)\b/i.exec(
    value,
  )?.[1];
  const cleanedShouldBeCalledKnownListTitle = shouldBeCalledKnownListTitle
    ? cleanRequestedListTitle(shouldBeCalledKnownListTitle, {
        appendList: false,
      })
    : null;
  if (
    cleanedShouldBeCalledKnownListTitle &&
    !/^(?:list|new list)$/i.test(cleanedShouldBeCalledKnownListTitle)
  ) {
    return cleanedShouldBeCalledKnownListTitle;
  }

  const makeThisKnownListTitle = /\b(?:actually,?\s*)?(?:let'?s|lets|please\s+)?(?:make|change|turn)\s+(?:it|this|that|this\s+list|that\s+list|the\s+list|this\s+sticky\s+note|that\s+sticky\s+note|the\s+sticky\s+note)\s+(?:into|to|as)?\s*(?:a|an|the)?\s*((?:shopping|walmart|grocery|to[-\s]?do|todo|task)\s+list)\b/i.exec(
    value,
  )?.[1];
  const cleanedKnownListTitle = makeThisKnownListTitle
    ? cleanRequestedListTitle(makeThisKnownListTitle, { appendList: false })
    : null;
  if (cleanedKnownListTitle && !/^(?:list|new list)$/i.test(cleanedKnownListTitle)) {
    return cleanedKnownListTitle;
  }

  const makeItTitle = /\b(?:actually,?\s*)?(?:let'?s|lets)\s+make\s+(?:it|this|that|this\s+list|that\s+list|the\s+list|this\s+sticky\s+note|that\s+sticky\s+note|the\s+sticky\s+note)\s*,?\s*(?:to|into|as)?\s*(?:um|uh|a|an|the)?\s*([a-z][a-z0-9' -]{1,40})(?:\s+list)?(?:[\s,.;:\-\u2013\u2014]*$|\s+\band\b)/i.exec(
    value,
  )?.[1];
  const cleanedMakeItTitle = makeItTitle
    ? cleanRequestedListTitle(makeItTitle, { appendList: false })
    : null;
  if (cleanedMakeItTitle && !/^(?:list|new list)$/i.test(cleanedMakeItTitle)) {
    return cleanedMakeItTitle;
  }

  const explicitCallItTitle = /\b(?:just\s+)?(?:call|name)\s+(?:this\s+sticky\s+note|that\s+sticky\s+note|the\s+sticky\s+note|this\s+note|that\s+note|the\s+note|this\s+list|that\s+list|the\s+list|it|this|that)\s+([a-z][a-z0-9' -]{1,40})\b/i.exec(
    value,
  )?.[1];
  const cleanedExplicitTitle = explicitCallItTitle
    ? cleanRequestedListTitle(explicitCallItTitle, { appendList: false })
    : null;
  if (cleanedExplicitTitle && !/^(?:list|new list)$/i.test(cleanedExplicitTitle)) {
    return cleanedExplicitTitle;
  }

  const makeThisCalledTitle = /\b(?:make|change|turn)\s+(?:this\s+sticky\s+note|that\s+sticky\s+note|the\s+sticky\s+note|this\s+note|that\s+note|the\s+note|this\s+list|that\s+list|the\s+list|it|this|that)\s+(?:call|called|name|named)\s+(?:um|uh|a|an|the)?\s*([a-z][a-z0-9' -]{1,40})\b/i.exec(
    value,
  )?.[1];
  const cleanedMakeThisCalledTitle = makeThisCalledTitle
    ? cleanRequestedListTitle(makeThisCalledTitle, { appendList: false })
    : null;
  if (
    cleanedMakeThisCalledTitle &&
    !/^(?:list|new list)$/i.test(cleanedMakeThisCalledTitle)
  ) {
    return cleanedMakeThisCalledTitle;
  }

  const patterns = [
    /^\s*(?:to|as)\s+(?:a|an|the)?\s*([a-z][a-z0-9' -]{1,40})\s+list\b/i,
    /\b(?:it'?s|it is|this is|that is|this one is|that one is|the sticky note is|the note is|the list is)\s+(?:going to be|gonna be|supposed to be|should be)?\s*called\s+(?:um|uh|a|an|the)?\s*([a-z][a-z0-9' -]{1,40})(?:\s+list)?\b/i,
    /\b(?:title|name)\s+of\s+(?:this|that|the|my)?\s*(?:sticky note|note|list)\s+(?:to|as)\s+(?:a|an|the)?\s*([a-z][a-z0-9' -]{1,40})\b/i,
    /\b(?:this one|that one|this list|that list|this sticky note|that sticky note|the sticky note|this note|that note|the note|the list)\s+(?:is going to be|will be|should be|is|going to be)\s+(?:a|an|the)?\s*([a-z][a-z0-9' -]{1,40})(?:\s+list)?\b/i,
    /\b(?:change|changed|rename|name|get(?:ting)? the name correct)\b.{0,44}\b(?:to|as)\s+(?:a|an|the)?\s*([a-z][a-z0-9' -]{1,40})(?:\s+list)?\b/i,
  ];

  for (const pattern of patterns) {
    const title = pattern.exec(value)?.[1];
    const cleanedTitle = title
      ? cleanRequestedListTitle(title, { appendList: false })
      : null;
    if (cleanedTitle && !/^(?:list|new list)$/i.test(cleanedTitle)) {
      return cleanedTitle;
    }
  }
  return null;
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

function sanitizeAssistantList(value: unknown): AssistantList | null {
  if (!isAssistantList(value)) return null;
  const now = Date.now();
  const kind: AssistantListKind =
    value.kind === "grocery" ||
    value.kind === "shopping" ||
    value.kind === "todo" ||
    value.kind === "custom"
      ? value.kind
      : "custom";
  const accentColor: ListAccentColor =
    value.accentColor === "amber" ||
    value.accentColor === "blue" ||
    value.accentColor === "green" ||
    value.accentColor === "rose" ||
    value.accentColor === "purple" ||
    value.accentColor === "white"
      ? value.accentColor
      : "amber";
  const displayStyle: ListDisplayStyle =
    value.displayStyle === "bulleted" ? "bulleted" : "numbered";
  return {
    id: value.id,
    title: value.title.trim().slice(0, 80) || normalizeListTitle(value.title, kind),
    kind,
    items: cleanStoredListItems(value.items),
    displayStyle,
    accentColor,
    accentHex: value.accentHex,
    accentLabel: value.accentLabel,
    createdAt: Number.isFinite(value.createdAt) ? value.createdAt : now,
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : now,
  };
}

function storeAssistantLists(lists: AssistantList[]) {
  if (typeof window === "undefined") return;
  try {
    if (BETA_FRESH_START_EVERY_SESSION) {
      window.localStorage.removeItem(ASSISTANT_LISTS_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      ASSISTANT_LISTS_STORAGE_KEY,
      JSON.stringify(lists.slice(0, MAX_ACTIVE_STICKY_NOTES)),
    );
  } catch {
    // Local persistence is best-effort.
  }
}

function loadAssistantLists(): AssistantList[] {
  if (typeof window === "undefined") return [];
  try {
    if (BETA_FRESH_START_EVERY_SESSION) {
      window.localStorage.removeItem(ASSISTANT_LISTS_STORAGE_KEY);
      return [];
    }
    const raw = window.localStorage.getItem(ASSISTANT_LISTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => sanitizeAssistantList(item))
      .filter((item): item is AssistantList => Boolean(item))
      .slice(0, MAX_ACTIVE_STICKY_NOTES);
  } catch {
    // Ignore storage failures. Anonymous sessions should still work in memory.
  }
  return [];
}

function emptyDeviceProfile(): DeviceProfile {
  return { name: null, greetingCount: 0, updatedAt: Date.now() };
}

function loadDeviceProfile(): DeviceProfile {
  if (typeof window === "undefined") return emptyDeviceProfile();
  try {
    if (BETA_FRESH_START_EVERY_SESSION) {
      window.localStorage.removeItem(DEVICE_PROFILE_STORAGE_KEY);
      return emptyDeviceProfile();
    }
    const raw = window.localStorage.getItem(DEVICE_PROFILE_STORAGE_KEY);
    if (!raw) return emptyDeviceProfile();
    const parsed = JSON.parse(raw) as Partial<DeviceProfile>;
    return {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : null,
      greetingCount:
        typeof parsed.greetingCount === "number" && Number.isFinite(parsed.greetingCount)
          ? parsed.greetingCount
          : 0,
      updatedAt:
        typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
          ? parsed.updatedAt
          : Date.now(),
    };
  } catch {
    // Anonymous sessions should still start if cache is unavailable.
  }
  return emptyDeviceProfile();
}

function storeDeviceProfile(profile: DeviceProfile) {
  if (typeof window === "undefined") return;
  try {
    if (BETA_FRESH_START_EVERY_SESSION) {
      window.localStorage.removeItem(DEVICE_PROFILE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(DEVICE_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Anonymous device memory is best-effort.
  }
}

function createAnonymousVisitorId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `anon_${random}`;
}

function loadAnonymousVisitorId(): string {
  if (typeof window === "undefined") return createAnonymousVisitorId();
  try {
    if (BETA_FRESH_START_EVERY_SESSION) {
      window.localStorage.removeItem(ANONYMOUS_VISITOR_STORAGE_KEY);
      return createAnonymousVisitorId();
    }
    const existing = window.localStorage.getItem(ANONYMOUS_VISITOR_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9:_-]{4,160}$/.test(existing)) {
      return existing;
    }
    const next = createAnonymousVisitorId();
    window.localStorage.setItem(ANONYMOUS_VISITOR_STORAGE_KEY, next);
    return next;
  } catch {
    return createAnonymousVisitorId();
  }
}

function loadRecentActions(): string[] {
  if (typeof window === "undefined") return [];
  try {
    if (BETA_FRESH_START_EVERY_SESSION) {
      window.localStorage.removeItem(RECENT_ACTIONS_STORAGE_KEY);
      return [];
    }
    const parsed = JSON.parse(
      window.localStorage.getItem(RECENT_ACTIONS_STORAGE_KEY) ?? "[]",
    );
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is string => typeof item === "string")
          .slice(0, MAX_RECENT_ACTIONS)
      : [];
  } catch {
    return [];
  }
}

function storeRecentActions(actions: string[]) {
  if (typeof window === "undefined") return;
  try {
    if (BETA_FRESH_START_EVERY_SESSION) {
      window.localStorage.removeItem(RECENT_ACTIONS_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      RECENT_ACTIONS_STORAGE_KEY,
      JSON.stringify(actions.slice(0, MAX_RECENT_ACTIONS)),
    );
  } catch {
    // Recent action logging is best-effort.
  }
}

function isInternalSignal(text: string): boolean {
  return INTERNAL_SIGNAL_RE.test(text.trim());
}

function hasEndSessionIntent(text: string): boolean {
  if (isInternalSignal(text)) return false;
  if (
    LIST_CLOSE_RE.test(text) ||
    SHOPPING_MODE_CLOSE_RE.test(text) ||
    ONLINE_LOOKUP_CLOSE_RE.test(text)
  ) {
    return false;
  }
  return END_CONVERSATION_RE.test(text);
}

function hasDirectEndSessionCommand(text: string): boolean {
  if (isInternalSignal(text)) return false;
  return DIRECT_END_SESSION_RE.test(text) || SINGLE_WORD_END_SESSION_RE.test(text);
}

function confirmsEndSession(text: string): boolean {
  if (END_SESSION_CANCEL_RE.test(text)) return false;
  return END_SESSION_CONFIRM_RE.test(text) || hasEndSessionIntent(text);
}

function isListRoutingOnlyCommand(text: string): boolean {
  const value = text.trim().toLowerCase();
  if (isNewListNameObservation(value)) return false;
  if (/\bput me on\b.*\b(?:list|walmart|grocery|shopping|todo|to-do|to do)\b/i.test(value)) {
    return true;
  }
  if (
    /\b(?:put|bring|pull|show|open)\b.{0,40}\b(?:grocery|shopping|walmart|to[-\s]?do|todo|task)?\s*list\s+up\b/i.test(value) ||
    /\bwhere'?s\b.{0,40}\b(?:grocery|shopping|walmart|to[-\s]?do|todo|task)?\s*list\b/i.test(value) ||
    /\bdid\s+we\s+make\b.{0,40}\b(?:grocery|shopping|walmart|to[-\s]?do|todo|task)?\s*list\b.{0,20}\byet\b/i.test(value) ||
    /^(?:do|show|bring\s+up|pull\s+up)\s+(?:the\s+)?(?:grocery|shopping|walmart|to[-\s]?do|todo|task)\s*list\b/i.test(value)
  ) {
    return true;
  }
  if (
    /\b(?:open|show|switch to|pull up|pop up|go to|abre|abrir|muestra|mostrar|cambia a|ouvre|ouvrir|montre|affiche|wechsel|oeffne|\u00f6ffne|zeige)\b.*\b(?:list|walmart|grocery|shopping|todo|to-do|to do|honey[-\s]?do|weekend(?:\s+planning)?|sticky\s+notes?|lista|listas|compras|mercado|liste|courses|einkaufsliste|einkauf)\b/i.test(
      value,
    )
  ) {
    return !LIST_MUTATION_SIGNAL_RE.test(value);
  }
  if (
    /\b(?:go|switch|move)\s+from\b.*\b(?:list|walmart|grocery|shopping|todo|to-do|to do)\b.*\bback\s+to\b.*\b(?:list|walmart|grocery|shopping|todo|to-do|to do)\b/i.test(
      value,
    ) ||
    /\bback\s+to\s+(?:the\s+)?(?:grocery|shopping|walmart|to[-\s]?do|todo|task)?\s*list\b/i.test(
      value,
    )
  ) {
    return true;
  }
  if (
    /\b(?:start|make|create|new|crear|crea|haz|hacer|nueva|nouvelle|neue)\b.*\b(?:list|walmart|grocery|shopping|todo|to-do|to do|honey[-\s]?do|weekend(?:\s+planning)?|sticky\s+notes?|lista|listas|compras|mercado|liste|courses|einkaufsliste|einkauf)\b/i.test(
      value,
    )
  ) {
    return !/\b(?:with|con|avec|mit)\b/i.test(value) && !LIST_MUTATION_SIGNAL_RE.test(value);
  }
  return false;
}

function isExplicitListActionCommand(text: string): boolean {
  const value = stripDirect6Address(text)
    .replace(/\b(?:okay|ok|so|all right|alright|great|please|well|um|uh|like)\b/gi, " ")
    .replace(/\bgo ahead and\b/gi, " ")
    .replace(/\bby the way\b/gi, " ")
    .replace(/[.!?,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!value) return false;
  if (/^(?:why|what|how|when|where|who)\b/i.test(value)) return false;
  if (
    LIST_META_COMMAND_RE.test(value) ||
    LIST_START_REHEARSAL_RE.test(value) ||
    CURRENT_GENERAL_PROMPT_LABEL_REVIEW_RE.test(value) ||
    PROMPT_LABEL_META_RE.test(value) ||
    PROMPT_TOPIC_FEEDBACK_RE.test(value)
  ) {
    return false;
  }
  if (EXPLICIT_LIST_DO_START_RE.test(value)) return true;
  if (
    /^(?:and\s+)?(?:(?:let'?s|lets)\s+)?(?:make|create|start|open)\s+(?:with\s+)?(?:a|an|the|my)?\s*(?:grocery|shopping|walmart|to[-\s]?do|todo|task)\s+list$/i.test(
      value,
    ) ||
    /^(?:and\s+)?(?:make|create|start|open)\s+(?:another|new)\s+list\s+(?:that'?s|that\s+is|called|named|as)?\s*(?:a|an|the|my)?\s*(?:grocery|shopping|walmart|to[-\s]?do|todo|task)\s+list$/i.test(
      value,
    )
  ) {
    return true;
  }
  if (isListRoutingOnlyCommand(value)) return true;
  if (CUSTOM_LIST_TOPIC_START_RE.test(value)) return true;

  const listName = "(?:grocery|shopping|walmart|to[-\\s]?do|todo)?";
  const listObject = `(?:a\\s+|the\\s+|my\\s+)?(?:${listName}\\s*list|sticky\\s+notes?)`;
  return (
    new RegExp(`^(?:let'?s|lets)\\s+(?:make|start(?:\\s+with)?|create|open|pull up|pop up|show)\\s+${listObject}$`, "i").test(value) ||
    new RegExp(`^(?:make|start(?:\\s+with)?|create|open|pull up|pop up|show|new)\\s+${listObject}$`, "i").test(value) ||
    new RegExp(`^(?:can|could|would)\\s+you\\s+(?:make|start(?:\\s+with)?|create|open|pull up|pop up|show)\\s+${listObject}$`, "i").test(value) ||
    new RegExp(`^i\\s+(?:need|want)\\s+(?:to\\s+)?(?:make|start(?:\\s+with)?|create|open|pull up|pop up)?\\s*${listObject}$`, "i").test(value)
  );
}

function isProtectedProductFeedback(text: string): boolean {
  const value = text.trim().toLowerCase();
  if (isIdeaBoxActionRequest(value)) return false;
  if (isListFlowProductFeedbackSpeech(value)) return true;
  if (isListReviewOrLayoutSpeech(value)) return true;
  if (isListReviewFeedback(value)) return true;
  if (
    PROMPT_LABEL_REVIEW_RE.test(value) ||
    CURRENT_GENERAL_PROMPT_LABEL_REVIEW_RE.test(value) ||
    PROMPT_LABEL_META_RE.test(value) ||
    GOAL_PROMPT_LABEL_FEEDBACK_RE.test(value) ||
    PROMPT_TOPIC_FEEDBACK_RE.test(value) ||
    LIST_START_REHEARSAL_RE.test(value) ||
    LIST_META_COMMAND_RE.test(value)
  ) {
    return true;
  }
  if (ACTIVE_SCREEN_DESIGN_FEEDBACK_RE.test(value)) return true;
  if (CTA_TEXT_DESIGN_FEEDBACK_RE.test(value)) return true;
  if (OPENING_LEAD_REVIEW_RE.test(value) || LIST_OPEN_FEEDBACK_RE.test(value)) {
    return true;
  }
  if (PRODUCT_REVIEW_CONTEXT_RE.test(value)) return true;
  if (UI_TRANSCRIPT_FEEDBACK_RE.test(value)) return true;
  if (!PRODUCT_FEEDBACK_GUARD_RE.test(value)) return false;
  if (
    /^\s*(?:take\s+off|remove|delete|get\s+rid\s+of|cross\s+off|close|hide|dismiss)\b/i.test(
      value,
    )
  ) {
    return false;
  }
  if (
    /^\s*(?:add|put|buy|grab|pick\s+up)\b/i.test(value) &&
    !/\b(?:wrong|should|codex|screen|screenshot|pillboxes?|permission|talking)\b/i.test(
      value,
    )
  ) {
    return false;
  }
  return true;
}

function isListObservationOnly(text: string): boolean {
  const value = text.trim().toLowerCase();
  if (isExplicitListActionCommand(value)) return false;
  if (isListReviewOrLayoutSpeech(value)) return true;
  if (isListReviewFeedback(value)) return true;
  if (isProtectedProductFeedback(value)) return true;
  const feedbackFragment =
    /\b(?:popped?\s+up|it says|it just says|right now it says|number\s+\d+\s+says|number\s+\d+|there is no|there'?s no|did not ask|didn'?t ask|should be|should ask|keeps going|stayed up too long|stay(?:s|ed)? (?:this way )?for (?:way )?too long|too high|too big|just a test|talking to codex|talking to you|look at (?:this|the)|this grocery list|under (?:the|this) list|what do you want|things (?:that )?people might want|finish your thought|discuss challenges|plan next steps|ask for help)\b/i.test(
      value,
    );
  if (!LIST_TRIGGER_RE.test(value) && !feedbackFragment) return false;
  if (
    LIST_MUTATION_SIGNAL_RE.test(value) ||
    REMOVE_COMMAND_RE.test(value) ||
    LIST_CLOSE_RE.test(value) ||
    LIST_DELETE_RE.test(value) ||
    LIST_NAV_NEXT_RE.test(value) ||
    LIST_NAV_PREV_RE.test(value) ||
    SHOPPING_MODE_OPEN_RE.test(value)
  ) {
    return false;
  }
  return /\b(?:popped?\s+up|blank|why|wondering|called|changed\s+(?:the\s+)?name|gone\s+back|went\s+back|he\s+just|it\s+just|let\s+me\s+know\s+what\s+you\s+see|talking\s+to\s+codex|talking\s+to\s+you|talking\s+over\s+me|malfunction|wrong|looks?|says|screen|screenshot|permission|pillboxes?|prompt)\b/i.test(
    value,
  ) || feedbackFragment;
}

function isAppFeedbackOnly(text: string): boolean {
  if (isIdeaBoxActionRequest(text)) return false;
  if (isListFlowProductFeedbackSpeech(text)) return true;
  if (isListReviewFeedback(text)) return true;
  if (
    PROMPT_LABEL_REVIEW_RE.test(text) ||
    CURRENT_GENERAL_PROMPT_LABEL_REVIEW_RE.test(text) ||
    PROMPT_LABEL_META_RE.test(text) ||
    GOAL_PROMPT_LABEL_FEEDBACK_RE.test(text) ||
    PROMPT_TOPIC_FEEDBACK_RE.test(text) ||
    LIST_START_REHEARSAL_RE.test(text) ||
    LIST_META_COMMAND_RE.test(text)
  ) {
    return true;
  }
  if (ACTIVE_SCREEN_DESIGN_FEEDBACK_RE.test(text)) return true;
  if (CTA_TEXT_DESIGN_FEEDBACK_RE.test(text)) return true;
  if (OPENING_LEAD_REVIEW_RE.test(text) || LIST_OPEN_FEEDBACK_RE.test(text)) {
    return true;
  }
  if (UI_TRANSCRIPT_FEEDBACK_RE.test(text)) return true;
  if (!APP_FEEDBACK_ONLY_RE.test(text)) return false;
  if (/\b(?:share my location|use my location|current location)\b/i.test(text)) {
    return false;
  }
  const isDesignFeedback =
    /\b(?:button|buttons?|toggle|toggling|brand colors?|white|lettering|attractive|same size|circle|screen|screenshot|popup|pop up|zip code|zipcode|inside the box|pillboxes?|talking over|interrupting|malfunction)\b/i.test(
      text,
    );
  if (!isDesignFeedback && /\b(?:find|search|look up|check)\b/i.test(text)) {
    return false;
  }
  if (!isDesignFeedback && /\b(?:add|remove|delete|close|open|show)\b/i.test(text)) {
    return false;
  }
  return true;
}

function isPendingColorChoiceFeedback(text: string): boolean {
  const value = stripDirect6Address(text).toLowerCase();
  return (
    isInstructionalColorFeedback(value) ||
    isListReviewFeedback(value) ||
    isProtectedProductFeedback(value) ||
    isAppFeedbackOnly(value) ||
    /\b(?:opacity|too dark|too light|one full second|1 full second|half second|full half second|one thousand|1 1,?000|2 1,?000|3 1,?000|flipped through|colors? way too fast|screenshots?|dropbox|i dropped|of course he'?s|lists? from before|vibrant colors?|discord|purples?|burgundy|burnt orange)\b/i.test(
      value,
    )
  );
}

function classifyProductFeedback(
  text: string,
): { sentiment: "negative" | "positive"; severity: "critical" | "high" | "medium" | "low" } | null {
  if (isIdeaBoxActionRequest(text)) return null;
  if (PRODUCT_PRAISE_FEEDBACK_RE.test(text)) {
    return { sentiment: "positive", severity: "low" };
  }
  if (
    /\b(?:can'?t hear|cannot hear|not listening|frozen|stuck|wrong list|won'?t remove|will not remove|run out of credits|system can come down)\b/i.test(
      text,
    )
  ) {
    return { sentiment: "negative", severity: "critical" };
  }
  if (
    PRODUCT_PROBLEM_FEEDBACK_RE.test(text) ||
    isAppFeedbackOnly(text) ||
    isProtectedProductFeedback(text)
  ) {
    return { sentiment: "negative", severity: "high" };
  }
  return null;
}

function extractPreferenceSignal(text: string): string | null {
  if (SENSITIVE_MEMORY_RE.test(text)) return null;
  const match = text.match(PREFERENCE_SIGNAL_RE);
  if (!match?.[0]) return null;
  const signal = match[0].replace(/\s+/g, " ").trim();
  if (/\b(?:this|site|layout|button|screen|sticky note|list|6)\b/i.test(signal)) {
    return null;
  }
  return signal.slice(0, 220);
}

function shouldStartFreshList(text: string): boolean {
  const value = text.toLowerCase();
  if (/\b(?:open|show|pull up|continue|resume|saved|old|existing|last|abre|abrir|muestra|continua|contin\u00faa|sigue|guardada|vieja|existente|ouvre|ouvrir|montre|continue|enregistree|enregistr\u00e9e|alt|gespeichert|weiter)\b/i.test(value)) {
    return false;
  }
  return /\b(?:another|new|fresh|different|separate|blank|empty)\b.*\b(?:list|walmart|grocery|shopping|todo|to-do|to do|sticky\s+notes?|lista|listas|compras|mercado|liste|courses|einkaufsliste|einkauf)\b|\b(?:start over|from scratch)\b/i.test(
    value,
  );
}

function correctListItem(item: string): string {
  if (/^a\s+shampoo$/i.test(item)) return "Shampoo";
  if (/^unions$/i.test(item)) return "Onions";
  if (/^black\s*berrys$/i.test(item)) return "Blackberries";
  if (/^blue\s*berrys$/i.test(item)) return "Blueberries";
  if (/^jam\s+(?:like\s+)?jelly$/i.test(item)) return "Jam";
  if (/^(?:veggies|vegetables)\s+or\s+(?:veggies|vegetables)$/i.test(item)) {
    return "Vegetables";
  }
  if (/^half(?:[-\s]?and[-\s]?|and)half$/i.test(item)) return "Half and half";
  return item;
}

function getListFragmentGuardText(value: string): string {
  return value
    .replace(SPOKEN_LIST_COMMAND_RE, " ")
    .replace(/^\s*(?:on|to|in)\s+(?:(?:their|there|the|my|our|this|that)\s+)?/i, " ")
    .replace(/\s+(?:on|to|in)\s+(?:their|there|the|my|our|this|that)\b/gi, " ")
    .replace(/[\u2013\u2014-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DEVICE_NAME_STOP_WORDS = new Set([
  "yes",
  "yeah",
  "yep",
  "yup",
  "no",
  "um",
  "uh",
  "er",
  "ah",
  "hmm",
  "mm",
  "just",
  "okay",
  "ok",
  "sure",
  "right",
  "so",
  "well",
  "a",
  "an",
  "the",
  "what",
  "you",
  "your",
  "you're",
  "youre",
  "you'll",
  "youll",
  "were",
  "saying",
  "buddy",
  "six",
  "build",
  "business",
  "company",
  "startup",
  "organize",
  "daily",
  "tasks",
  "connect",
  "people",
  "goals",
  "new",
  "prompt",
  "prompts",
  "pillbox",
  "pillboxes",
  "boxes",
  "ideas",
  "grocery",
  "groceries",
  "list",
  "todo",
  "to-do",
  "walmart",
  "shopping",
  "store",
  "at",
  "in",
  "on",
  "to",
  "for",
  "from",
  "going",
  "looking",
  "trying",
  "working",
  "doing",
  "having",
  "making",
  "building",
  "planning",
  "here",
  "back",
  "ready",
  "fine",
  "good",
  "excited",
  "reminder",
  "birthday",
  "weekend",
  "hike",
  "hikes",
  "hiking",
  "email",
  "phone",
  "help",
  "approve",
  "approves",
  "approved",
  "things",
  "feature",
  "soon",
  "taller",
  "thinner",
  "smidge",
  "wide",
  "letters",
  "letter",
  "opacity",
  "mobile",
  "nothing",
  "later",
  "cancel",
]);

function cleanDeviceName(value: string): string | null {
  let name = value
    .replace(/\b([a-z])\s*[\u2013\u2014-]\s*(?:the\s+letter\s+)?\1\b/i, "$1")
    .replace(/\b(?:the\s+letter|letter)\s+([a-z])\b/i, "$1")
    .replace(/^(?:is|it's|its|this is)\s+/i, "")
    .replace(/[.,!?;:\u2013\u2014-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!name || name.length > 40 || /[@\d?]/.test(name)) return null;
  if (
    /\b(?:he|six|6|it|the\s+system)\s+should\b/i.test(name) ||
    LIST_START_REHEARSAL_RE.test(name) ||
    LIST_META_COMMAND_RE.test(name) ||
    PRODUCT_REVIEW_CONTEXT_RE.test(name) ||
    NAME_PROMPT_AVOID_RE.test(name)
  ) {
    return null;
  }
  const brandCandidate = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (/^(?:asap|aiasap|aisap)$/.test(brandCandidate)) return null;
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length > 3) return null;
  if (words.some((word) => DEVICE_NAME_STOP_WORDS.has(word.toLowerCase()))) {
    return null;
  }
  if (!words.every((word) => /^[a-z][a-z'.-]*$/i.test(word))) return null;

  name = words
    .map((word) =>
      word.length === 1
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
  return name;
}

function extractDeviceNameCandidate(text: string, allowPlainAnswer: boolean): string | null {
  const explicit =
    text.match(/\bmy name is\s+([^,.!?]{1,40})/i)?.[1] ??
    text.match(/\bmy name'?s\s+([^,.!?]{1,40})/i)?.[1] ??
    text.match(/\b(?:you can )?call me\s+([^,.!?]{1,40})/i)?.[1] ??
    text.match(/\b(?:i am|i'm|im)\s+([^,.!?]{1,40})/i)?.[1] ??
    null;
  if (explicit) return cleanDeviceName(explicit);
  if (!allowPlainAnswer) return null;
  if (text.length > 40 || /[?@]/.test(text)) return null;
  return cleanDeviceName(text);
}

function hasExplicitNameIntro(text: string): boolean {
  return /\b(?:my name is|my name'?s|you can call me|call me)\b/i.test(text);
}

function isMeaningfulNameRelationshipTurn(text: string): boolean {
  const cleaned = text
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!cleaned) return false;
  if (ACTIVE_SCREEN_DESIGN_FEEDBACK_RE.test(cleaned)) return false;
  if (CTA_TEXT_DESIGN_FEEDBACK_RE.test(cleaned)) return false;
  if (/^(?:um|uh|hmm|mm|yeah|yep|yes|no|ok|okay|sure|right|so|well)$/i.test(cleaned)) {
    return false;
  }
  if (
    /^(?:good|fine|great|busy|tired|hungry|bored|stressed|okay thanks|pretty good|not bad|not much|nothing much|doing good|doing fine)$/i.test(
      cleaned,
    )
  ) {
    return true;
  }
  return cleaned.length >= 8 || cleaned.split(/\s+/).length >= 3;
}

function isNamePromptOpportunityTurn(text: string): boolean {
  const cleaned = stripDirect6Address(text)
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!cleaned || hasDirectEndSessionCommand(text)) return false;
  if (/^(?:um|uh|hmm|mm|yeah|yep|yes|no|ok|okay|sure|right|so|well|and)$/i.test(cleaned)) {
    return false;
  }
  if (shouldSuppressNamePromptOpportunity(text)) return false;
  return (
    isMeaningfulNameRelationshipTurn(text) ||
    LIST_TRIGGER_RE.test(text) ||
    LIST_MUTATION_SIGNAL_RE.test(text) ||
    REMOVE_COMMAND_RE.test(text) ||
    cleaned.length >= 8 ||
    cleaned.split(/\s+/).length >= 3
  );
}

function nextNameUseTurn(currentTurn: number): number {
  return (
    currentTurn +
    NAME_USE_MIN_TURNS +
    (currentTurn % NAME_USE_TURN_WINDOW)
  );
}

function shouldAvoidNameRelationshipPrompt(text: string): boolean {
  return (
    isInternalSignal(text) ||
    isProtectedProductFeedback(text) ||
    isAppFeedbackOnly(text) ||
    isListObservationOnly(text) ||
    SILENCE_OR_CUTOFF_FEEDBACK_RE.test(text) ||
    NAME_PROMPT_AVOID_RE.test(text) ||
    hasDirectEndSessionCommand(text)
  );
}

function shouldSuppressNamePromptOpportunity(text: string): boolean {
  if (
    shouldAvoidNameRelationshipPrompt(text) ||
    PRODUCT_REVIEW_CONTEXT_RE.test(text) ||
    LIST_START_REHEARSAL_RE.test(text) ||
    LIST_META_COMMAND_RE.test(text)
  ) {
    return true;
  }
  if (
    LIST_START_COMMAND_WITHOUT_ITEMS_RE.test(text) &&
    !LIST_ITEM_WITH_START_COMMAND_RE.test(text)
  ) {
    return true;
  }
  return LIST_COMMAND_ONLY_RE.test(text) && !LIST_MUTATION_SIGNAL_RE.test(text);
}

function responseForSilenceOrCutoffFeedback(text: string): string {
  if (/\b(?:ai boom|ai consultant|ai consulting|ai service|ai services)\b/i.test(text)) {
    return "I'm here. Let's stay on the AI business. I can help you pick a customer, choose the first service, and write the first pitch.";
  }
  if (/\b(?:business|company|startup|make more money)\b/i.test(text)) {
    return "I'm here. Let's stay on building the business. Tell me what you like doing, what you're good at, or what kind of customer you want to help.";
  }
  return "I'm here. I should keep responding. Tell me the next thing you want to work out.";
}

function stripPrivateGuidance(text: string): string {
  return text.replace(PRIVATE_GUIDANCE_RE, " ").replace(/\s+/g, " ").trim();
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
    .slice(-12);
}

function buildAccountMemoryOffer(customSpoken: string | undefined, seed: number): string {
  const valueLine =
    ACCOUNT_MEMORY_VALUE_LINES[seed % ACCOUNT_MEMORY_VALUE_LINES.length];
  const base = customSpoken?.trim()
    ? customSpoken.replace(/\s+You ready\??$/i, "").trim()
    : "Account setup is optional, but it makes this feel more human.";
  return `${base} ${valueLine} You ready?`;
}

function summarizeMemoryTopic(value: string | null): string | null {
  if (!value) return null;
  return summarizeOnlineLookupTopic(value)
    .replace(/^that$/i, "where we left off")
    .slice(0, 80);
}

function buildAccountMemorySnapshot(args: {
  lists: AssistantList[];
  resumeState: Record<string, unknown> | null;
  restoredList: AssistantList | null;
  onlineQuery: string | null;
  onlineLocation: string | null;
}): AccountMemorySnapshot | null {
  const lastUserText = cleanMemoryText(args.resumeState?.lastUserText);
  const lastAssistantText = cleanMemoryText(
    args.resumeState?.lastAssistantText,
  );
  const recentConversation = cleanMemoryConversation(
    args.resumeState?.recentConversation,
  );
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
      "SIGNED-IN USER MEMORY. Use this quietly so the conversation feels like friends picking back up.",
      "Do not recite this memory dump. Do not reopen lists, search, location, or other UI unless the user asks.",
      ...contextParts,
    ].join("\n"),
  };
}

function buildReturningGreeting(
  profile: DeviceProfile,
  _memory: AccountMemorySnapshot | null,
): string {
  const template =
    RETURNING_GREETING_OPTIONS[
      profile.greetingCount % RETURNING_GREETING_OPTIONS.length
    ];
  const name = profile.name ? `, ${profile.name}` : "";
  const namePrefix = profile.name ? `${profile.name}, ` : "";
  return template.replace("{name}", name).replace("{namePrefix}", namePrefix);
}

function cleanListItem(
  value: string,
  options: {
    fromExplicitCommand?: boolean;
    activeListKind?: AssistantListKind | null;
  } = {},
): string | null {
  const fragmentGuardValue = getListFragmentGuardText(value);
  if (
    /[?]/.test(value) ||
    hasExplicitNameIntro(value) ||
    isListFlowFeedbackFragment(fragmentGuardValue) ||
    isListReviewOrLayoutSpeech(fragmentGuardValue) ||
    isListReviewFeedback(fragmentGuardValue) ||
    LIST_CONVERSATION_FRAGMENT_RE.test(fragmentGuardValue) ||
    LIST_META_COMMAND_RE.test(fragmentGuardValue) ||
    PROMPT_LABEL_META_RE.test(fragmentGuardValue) ||
    PROMPT_TOPIC_FEEDBACK_RE.test(fragmentGuardValue)
  ) {
    return null;
  }

  let item = value
    .replace(/^let'?s work on this next:\s*/i, "")
    .replace(/\bjam\s+like\s+jelly\b/gi, "jam")
    .replace(/^(?:(?:and\s+)?(?:um|uh|okay|ok|please|so|let'?s(?:\s+see)?|lets(?:\s+see)?)[,\s]+)+/i, "")
    .replace(/\b(?:i need|i want|i'd like|id like)\s+(?:a\s+)?(?:grocery|shopping|walmart|to[-\s]?do|todo)?\s*list\b/gi, " ")
    .replace(/\b(?:(?:let'?s|lets)\s+)?(?:just\s+)?start\s+with\s+(?:the\s+)?(?:grocery|shopping|walmart|to[-\s]?do|todo)?\s*list\b/gi, " ")
    .replace(/\b(?:for when i go to the grocery store|you mentioned creating an account|take the grocery list off the screen|take grocery list off the screen)\b/gi, " ")
    .replace(/\bso\s+(?:six|6)\b/gi, " ")
    .replace(/\b(?:just\s+)?put\s+some\s+on\s+there\b/gi, " ")
    .replace(/\bi\s+know\b/gi, " ")
    .replace(
      /^(?:let'?s|lets)\s+(?:(?:put|add|grab|buy|pick up)\s+)?(?:(?:on|to|in)\s+)?(?:(?:their|there|the|my|our|this|that)\s+)?/i,
      "",
    )
    .replace(
      /^(?:put|add|grab|buy|pick up)\s+(?:(?:it|that|this)\s+)?(?:(?:on|to|in)\s+)?(?:(?:their|there|the|my|our|this|that)\s+)?/i,
      "",
    )
    .replace(/^(?:on|to|in)\s+(?:(?:their|there|the|my|our|this|that)\s+)?/i, "")
    .replace(/\bfor\s+tacos?\b/gi, (match) =>
      value.trim().toLowerCase() === match.toLowerCase() ? "Taco Stuff" : " ",
    )
    .replace(/\b(?:um|uh|like|please|por favor|s'il vous plait|s'il vous pla\u00eet|bitte)\b/gi, " ")
    .replace(/\b(?:i\s+)?(?:need|want|have)\s+to\s+/gi, " ")
    .replace(/\byou\s+know\b/gi, " ")
    .replace(/^(?:one\s+)?goal\s+in\s+life\s+(?:is\s+)?(?:to\s+)?/i, "")
    .replace(/^(?:that\s+)?(?:the\s+)?(?:number\s+one|#1|first)\s+goal\s+(?:is\s+)?(?:to\s+)?/i, "")
    .replace(
      /\s+(?:to|on|in)\s+(?:(?:the|my|this|that|our)\s+)?(?:(?:grocery|shopping|walmart|to[-\s]?do)\s+)?list\b/gi,
      " ",
    )
    .replace(/\b(?:okay|ok|the things that|things that|things|are|from|off|grocery|groceries|shopping|wal[-\s]?mart|list|my list|the list|lista|listas|mi lista|la lista|liste|ma liste|meine liste)\b/gi, " ")
    .replace(/^(?:is\s+)+/i, "")
    .replace(LIST_ITEM_PREFIX_RE, "")
    .replace(/\b(?:i\s+)?(?:need|want|have)\s+to\s+/gi, " ")
    .replace(/\b(?:i\s+)?(?:need|want|would like|like|have to get|gotta get|should get|add|put|get|grab|buy|pick up)\s+/gi, " ")
    .replace(
      /^(?:and\s+)?(?:i\s+)?(?:need|want|would like|like|have to get|gotta get|should get|add|put|get|grab|buy|pick up)\s+/i,
      "",
    )
    .replace(
      /\s+(?:on|to|in)\s+(?:(?:their|there|the|my|our|this|that|it)\s*)$/i,
      "",
    )
    .replace(
      /\s+(?:to|on|in)\s+(?:(?:the|my|this|that|our)\s+)?(?:(?:grocery|shopping|walmart|to[-\s]?do)\s+)?list$/i,
      "",
    )
    .replace(/^(?:some|a|an|the|their|there|my|our|el|la|los|las|un|una|le|la|les|des|du|der|die|das|ein|eine)\s+/i, "")
    .replace(/[.!?]+$/g, "")
    .replace(/^[\s,.;:\-\u2013\u2014]+|[\s,.;:\-\u2013\u2014]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (
    LIST_SUPABASE_FEEDBACK_ITEM_RE.test(item) ||
    /^(?:so\s+all|lists?\s+created\s+will\s+be\s+saved|created\s+will\s+be\s+saved|nice\s+to\s+meet\s+you(?:\s+six)?|pleasure\s+to\s+meet\s+you|good\s+to\s+meet\s+you)$/i.test(
      item,
    )
  ) {
    return null;
  }
  if (
    /^(?:grocery|shopping)$/.test(options.activeListKind ?? "") &&
    /^t$/i.test(item)
  ) {
    return "Tea";
  }
  if (
    isListReviewOrLayoutSpeech(item) ||
    isListFlowFeedbackFragment(item) ||
    /\b(?:because we (?:need )?more|because we more|more space for|all that talk|didn'?t come up until now|this is getting)\b/i.test(
      item,
    )
  ) {
    return null;
  }
  if (
    /^(?:(?:let'?s|lets)\s+)?(?:create|make|start|open|show|pull up)\s+(?:a\s+)?$/i.test(
      item,
    ) ||
    /^(?:to\s+)?(?:make|create|start|open)\s+(?:a\s+)?$/i.test(item) ||
    LIST_COLOR_REVIEW_ONLY_RE.test(item) ||
    LIST_OPEN_REVIEW_ONLY_RE.test(item) ||
    /\b(?:to know this above everything else|i need to know this above everything else|there'?s a (?:grocery )?list there|so there'?s a there|already it says|it says number|codex can you see|can you see what'?s on)\b/i.test(
      item,
    )
  ) {
    return null;
  }
  if (
    /^(?:he|him|just|top|box|in the top|it says yes|okay so it says yes|system to (?:6|six)|so let'?s work|let'?s work on that also|let'?s make it|it'?s there|its there)$/i.test(
      item,
    )
  ) return null;
  if (/^(?:i'?m|i am)\s+in\s+the\s+mood\s+for\b/i.test(item)) return null;
  if (/^number\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)$/i.test(item)) return null;
  if (
    /^(?:grocery|shopping)$/.test(options.activeListKind ?? "") &&
    /^colors?$/i.test(item)
  ) {
    return null;
  }
  if (item.length < 2 || item.length > 42) return null;
  const normalizedItemKey = item
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (
    /^(?:soisaid|makeachristmasorwhateverisaid|makeachristmasorwhateverisaidandit|itopeneditup|sothosehaveall|tobetakencareof|gottobetakencareof|then|forchristmas|thingslikethat|whatever|youputwhatever|oryouputwhatever|doaroundthehouse|thingsineedtododaroundthehouse|thingsineedtodothehouse)$/.test(
      normalizedItemKey,
    )
  ) {
    return null;
  }
  if (
    !options.fromExplicitCommand &&
    /^(?:aringfortheirwife|ringfortheirwife|toysfortheirkids)$/.test(
      normalizedItemKey,
    )
  ) {
    return null;
  }
  if (
    /^(?:grocery|shopping)$/.test(options.activeListKind ?? "") &&
    /^(?:tooth|forkitchen|forthekitchen|forbathroom|forthebathroom)$/.test(
      normalizedItemKey,
    )
  ) {
    return null;
  }
  if (
    /^(?:keepthename|keepthatstored|rememberthat|only|ask|cool|thathas|stuffonit|itonthelist|itonlist|itonthe|iton|whatum|letssee|letsseewhat|someonthere|metomakethatbecause|itsalreadymade|alreadymade|forsure|andforsure|tillthis|tilthis|untilthis|dontsendmeasmoketest|donotsendmeasmoketest|workonthis|workonthisuntilyougetitright|number1andnumber2justcameup|numberoneandnumbertwojustcameup|nicetomeetyou|nicetomeetyousix|pleasuretomeetyou|goodtomeetyou)$/.test(
      normalizedItemKey,
    )
  ) {
    return null;
  }
  if (/^(?:top|box|inthetop|itsaysyes|okaysoitsaysyes|systemto6|systemtosix|soletswork|letsworkonthatalso|letsmakeit|iminmoodforasalad|iminthemoodforasalad|iaminthemoodforasalad|numberonesaystop|number1saystop)$/.test(normalizedItemKey)) {
    return null;
  }
  if (
    /^(?:cose|cos|close|stop|avatar|six|6|so6|tosix|to6|to|the|and|or|of|not|its|itsfine|ifitsup|aspartof|forthewoman|forwoman|itshouldbe|itshouldnotbe|ijustsaid|justsaid|justsaidmakeatodolist|wantingtomakeatodolist|great|thanks|thankyou|right|number|codex|codecs|comparepopularcodecs|explainvideocodecs|explainaudiocodecs|explainedifferentcodecs|listcodecuses|in|on|up|my|damn|dam|therewego|wego|mmhmm|bytheway|see|wordsinpassing|but|however|should|iftheytochange|iknow|youknowallthesame|together|lets|orletme|oneortheother|oneortheothershouldhappen|reallyfallingapart|reallyfallingaparthere|thingsarereallyfallingapart|thingsarereallyfallingaparthere|fallingapart|fallingaparthere|alreadyopen|alreadyopened|shouldnotopen|shouldntopen|doesnotseemtolooklike|doesntseemtolooklike|notoption6|sothefade|thefade|overalllook|ofthis|ofthisiwant|ofthisiwantto|letmemakesure6can|letmemakesuresixcan|letsmake|letsmakea|makeit|makeitblack|evendarker|darker|lighter|half|ineed|ineedhalf|somehalf|iwant|iwantsome|justputsomeonthere|putsomeonthere|someonthere|couplethingsonit|acouplethingsonit|coupleonit|acoupleonit|couplethings|acouplethings|onthere|some|me|meon|everything|forward|ford|now|nowits|wow|man|why|whycanthe|whycanhe|there|allright|beforemovingforward|sosixtoldmehecouldnt|sosixtoldmehecouldnot|hetoldmehecouldnt|hetoldmehecouldnot|sixtoldmehecouldnt|sixtoldmehecouldnot|wiggingout|saidthefour|saidfour|liketodolist|liketodolist|walmart|add|changethename|itsstillcalledstickynote|stillcalledstickynote|itcangodowntwosmidgestoo|itcangodown2smidgestoo|itssmidgesontheright|smidgesontheright|smidgesontheleft|smidgeisontheright|twosmidgesontherighttwosmidgesontheleft|2smidgesontheright2smidgesontheleft|ohmygod|thats|thatis|thatswonderful|thatiswonderful|wonderful|theresanother|thereisanother|saythat|mistakes|thingslikethat|hes|put|puton|onput|putonput|onputput|putuh|onuh|umput|umputon|putting|puttingthings|itcamewith4boxesunderthere|itcamewithfourboxesunderthere|ithe4boxes|ithefourboxes|marketofcraftsgalore|entire|theentire|mostlyamid|letsgetthatchanged|getthatchanged|henamedit|henamed|namedit|canyou|thisone|soitshouldnthaveaname|soitshouldnothaveaname|itshouldnthaveaname|itshouldnothaveaname|changedto|getthenamecorrect)$/.test(
      normalizedItemKey,
    )
  ) {
    return null;
  }
  if (isListTranscriptFeedbackItem(item)) return null;
  if (LIST_FILLER_ITEM_RE.test(item)) return null;
  if (/\b(?:the|a|an|to|for|with|of|in|on|at)$/i.test(item)) return null;
  if (
    !options.fromExplicitCommand &&
    /\b(?:that'?s|that is|there'?s|there is|should|would|could|user|tell me what|repeat that|needs? to be|thinner to|talk(?:ing)?|conversation(?:ally)?|normal mode|silent|screenshot|screen shot|screen|depicted|brand colors?|white box|white circle|pink|blue|color|colour)\b/i.test(
      item,
    )
  ) {
    return null;
  }
  if (
    !options.fromExplicitCommand &&
    /^(?:why|what|how|when|where|who)\b/i.test(item)
  ) {
    return null;
  }
  if (
    /\b(?:couldn'?t|could not|told me he|six told me|before moving forward)\b/i.test(
      item,
    )
  ) {
    return null;
  }
  if (
    LIST_MUTATION_SIGNAL_RE.test(value) &&
    /\b(?:to|for|with|at|from|about)$/i.test(item)
  ) {
    const trimmedItem = item
      .replace(/\s+(?:to|for|with|at|from|about)$/i, "")
      .trim();
    if (trimmedItem.length >= 2) {
      item = trimmedItem;
    } else {
      return null;
    }
  }
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

function cleanSpokenCorrectionTerm(value: string): string | null {
  const item = stripDirect6Address(value)
    .replace(/\b(?:like|as in)\s+jelly\b/gi, "")
    .replace(/\b(?:um|uh|okay|ok|so|no|not)\b/gi, " ")
    .replace(/[.!?"'`]+$/g, "")
    .replace(/^[\s,.;:\-\u2013\u2014]+|[\s,.;:\-\u2013\u2014]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (item.length < 2 || item.length > 42) return null;
  const corrected = correctListItem(item.charAt(0).toUpperCase() + item.slice(1));
  return corrected.charAt(0).toUpperCase() + corrected.slice(1);
}

function extractSpokenListCorrection(
  text: string,
  options: { activeListKind?: AssistantListKind | null } = {},
): { wanted: string; wrong: string } | null {
  const match = stripDirect6Address(text).match(
    /\bi\s+said\s+(.{1,50}?)\s*,?\s+not\s+(.{1,50}?)(?:[.!?]|$)/i,
  );
  if (!match?.[1] || !match[2]) return null;
  const wanted =
    cleanListItem(match[1], {
      fromExplicitCommand: true,
      activeListKind: options.activeListKind,
    }) ?? cleanSpokenCorrectionTerm(match[1]);
  const wrong = cleanSpokenCorrectionTerm(match[2]);
  return wanted && wrong ? { wanted, wrong } : null;
}

function getIncompleteListItemFragment(text: string): string | null {
  const isTodoActionFragment = TODO_ACTION_ITEM_RE.test(text);
  if (
    isInternalSignal(text) ||
    isProtectedProductFeedback(text) ||
    isListFlowFeedbackFragment(text) ||
    isAppFeedbackOnly(text) ||
    isListObservationOnly(text) ||
    /[?]/.test(text) ||
    LIST_CONVERSATION_FRAGMENT_RE.test(text) ||
    (!LIST_MUTATION_SIGNAL_RE.test(text) && !isTodoActionFragment)
  ) {
    return null;
  }

  const fragment = text
    .replace(/[\u2013\u2014-]+\s*$/g, "")
    .replace(/\b(?:um|uh|okay|ok|please)\b/gi, " ")
    .replace(/^[\s,.;:\-\u2013\u2014]+|[\s,.;:\-\u2013\u2014]+$/g, "")
    .replace(/^(?:and\s+)?(?:do\s+)?(?:i\s+)?(?:need|want|have)\s+to\s+/i, "")
    .replace(
      /^(?:and\s+)?(?:i\s+)?(?:need|want|would like|like|have to get|gotta get|should get|add|put|get|grab|buy|pick up)\s+/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (!fragment || fragment.split(/\s+/).length < 2) return null;
  if (!/\b(?:to|for|with|at|from|about)(?:\s+(?:the|a|an|my|our|their|his|her))?$/i.test(fragment)) return null;
  return fragment.charAt(0).toLowerCase() + fragment.slice(1);
}

function completePendingListItemFragment(
  fragment: string,
  nextItem: string,
): string | null {
  const tail =
    fragment.charAt(0) === fragment.charAt(0).toLowerCase()
      ? nextItem.charAt(0).toLowerCase() + nextItem.slice(1)
      : nextItem;
  const combined = `${fragment} ${tail}`
    .replace(/\s+/g, " ")
    .trim();
  return cleanListItem(combined, { fromExplicitCommand: true });
}

function canInferListItems(
  text: string,
  options: {
    allowBareItems?: boolean;
    activeListKind?: AssistantListKind | null;
  } = {},
): boolean {
  const hasExplicitMutation = LIST_MUTATION_SIGNAL_RE.test(text);
  if (isInternalSignal(text) || (LIST_COMMAND_ONLY_RE.test(text) && !hasExplicitMutation)) {
    return false;
  }
  if (
    LIST_START_COMMAND_WITHOUT_ITEMS_RE.test(text) &&
    !LIST_ITEM_WITH_START_COMMAND_RE.test(text)
  ) {
    return false;
  }
  if (
    LIST_COLOR_CHANGE_REQUEST_RE.test(text) ||
    LIST_COLOR_REVIEW_ONLY_RE.test(text) ||
    LIST_OPEN_REVIEW_ONLY_RE.test(text)
  ) {
    return false;
  }
  if (hasEndSessionIntent(text)) return false;
  if (
    isProtectedProductFeedback(text) ||
    isListFlowFeedbackFragment(text) ||
    isAppFeedbackOnly(text) ||
    isListObservationOnly(text)
  ) {
    return false;
  }
  if (isListRoutingOnlyCommand(text)) return false;
  if (REMOVE_COMMAND_RE.test(text)) return false;
  if (detectListAccentUpdate(text, null)) return false;
  const fragmentGuardText = getListFragmentGuardText(text);
  if (
    /[?]/.test(text) ||
    isListFlowFeedbackFragment(fragmentGuardText) ||
    LIST_CONVERSATION_FRAGMENT_RE.test(fragmentGuardText) ||
    LIST_META_COMMAND_RE.test(fragmentGuardText) ||
    PROMPT_LABEL_META_RE.test(fragmentGuardText) ||
    PROMPT_TOPIC_FEEDBACK_RE.test(fragmentGuardText)
  ) {
    return false;
  }
  if (LIST_TRIGGER_RE.test(text) && !hasExplicitMutation) return false;
  if (
    !hasExplicitMutation &&
    /^(?:why|what|how|when|where|who)\b/i.test(text.trim())
  ) {
    return false;
  }
  if (
    !hasExplicitMutation &&
    /\b(?:couldn'?t|could not|told me he|six told me|before moving forward)\b/i.test(
      text,
    )
  ) {
    return false;
  }
  if (hasExplicitMutation) return true;
  if (!options.allowBareItems) return false;
  if (
    /^(?:custom|todo)$/.test(options.activeListKind ?? "") &&
    TODO_ACTION_ITEM_RE.test(text) &&
    text.trim().split(/\s+/).length <= 9
  ) {
    return true;
  }
  if (/[,;\n]|\band\b/i.test(text)) return true;
  const cleaned = cleanListItem(text, {
    activeListKind: options.activeListKind,
  });
  if (!cleaned) return false;
  return cleaned.split(/\s+/).length <= 3;
}

function isOnlineLookupIntent(text: string): boolean {
  if (
    isProtectedProductFeedback(text) ||
    isAppFeedbackOnly(text) ||
    isListObservationOnly(text)
  ) {
    return false;
  }
  if (PROMPT_LABEL_REVIEW_RE.test(text)) return false;
  if (ONLINE_LOOKUP_FEEDBACK_RE.test(text)) return false;
  if (ONLINE_LOOKUP_COMMENTARY_RE.test(text)) return false;
  if (!ONLINE_LOOKUP_TOPIC_RE.test(text)) return false;
  if (ONLINE_LOOKUP_ACTION_RE.test(text)) return true;
  if (ONLINE_LOOKUP_DIRECT_RE.test(text)) return true;
  return false;
}

function shouldSuppressProductReviewIntent(text: string, guardActive: boolean): boolean {
  if (!guardActive) return false;
  const value = stripDirect6Address(text)
    .replace(/\b(?:okay|ok|so|all right|alright|great|please|well|um|uh|like|again)\b/gi, " ")
    .replace(/[.!?,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    CODEX_DIRECTED_APP_TASK_RE.test(value) ||
    /^(?:make|create|start|open|show|pull up)?\s*lists?$/i.test(value)
  ) {
    return true;
  }
  if (DIRECT_6_ADDRESS_RE.test(text)) return false;
  if (isExplicitListActionCommand(text)) return false;
  return (
    isListFlowFeedbackFragment(text) ||
    OPENING_LEAD_REVIEW_RE.test(text) ||
    CURRENT_GENERAL_PROMPT_LABEL_REVIEW_RE.test(text) ||
    LIST_OPEN_FEEDBACK_RE.test(text) ||
    PRODUCT_REVIEW_CONTEXT_RE.test(text) ||
    ONLINE_LOOKUP_TOPIC_RE.test(text) ||
    LIST_TRIGGER_RE.test(text) ||
    LIST_MUTATION_SIGNAL_RE.test(text) ||
    REMOVE_COMMAND_RE.test(text)
  );
}

function shouldAskPreferencesBeforeLookup(query: string): boolean {
  return isWeekendLookupQuery(query) || /\b(?:things to do|cool things|events?|places to go)\b/i.test(query);
}

function shouldConfirmOnlineLookupStart(text: string): boolean {
  const cleaned = text.replace(/^let'?s work on this next:\s*/i, "").trim();
  if (OPENING_LEAD_REVIEW_RE.test(cleaned)) return false;
  if (CURRENT_GENERAL_PROMPT_LABEL_REVIEW_RE.test(cleaned)) return false;
  if (PROMPT_LABEL_REVIEW_RE.test(cleaned)) return false;
  if (ONLINE_LOOKUP_FEEDBACK_RE.test(cleaned)) return false;
  if (ONLINE_LOOKUP_COMMENTARY_RE.test(cleaned)) return false;
  return ONLINE_LOOKUP_START_CONFIRM_RE.test(cleaned) || isOnlineLookupIntent(cleaned);
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
  if (digits.length === 0 || digits.length >= 5) return false;
  return /\b(?:zip|zipcode|code)\b/i.test(value) || /^[\s\d-]+$/.test(value);
}

const ZIP_LOCATION_OVERRIDES: Record<string, string> = {
  "21093": "Timonium, MD 21093",
};

const STICKY_NOTE_PALETTE: Array<
  ListAccentUpdate & { base: ListAccentColor }
> = [
  { base: "amber", accentColor: "amber", accentHex: "#a9784a", accentLabel: "Dark Brand" },
  { base: "amber", accentColor: "amber", accentHex: "#d7a05a", accentLabel: "Mid Brand" },
  { base: "amber", accentColor: "amber", accentHex: "#f2c986", accentLabel: "Light Brand" },
];

const NEW_LIST_COLOR_LIGHT_POOL: DemoListAccentUpdate[] = [
  { family: "brand", tone: "light", accentColor: "amber", accentHex: "#f2c986", accentLabel: "Light Brand" },
  { family: "brand", tone: "light", accentColor: "amber", accentHex: "#d7a05a", accentLabel: "Mid Brand" },
];
const NEW_LIST_COLOR_DARK_POOL: DemoListAccentUpdate[] = [
  { family: "brand", tone: "dark", accentColor: "amber", accentHex: "#a9784a", accentLabel: "Dark Brand" },
  { family: "brand", tone: "dark", accentColor: "amber", accentHex: "#d7a05a", accentLabel: "Mid Brand" },
];

function randomArrayItem<T>(items: T[]): T {
  if (items.length === 0) {
    throw new Error("Expected at least one item");
  }
  return items[Math.floor(Math.random() * items.length)] as T;
}

function shuffleListAccentUpdates(items: ListAccentUpdate[]): ListAccentUpdate[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    const swap = shuffled[swapIndex];
    if (!current || !swap) continue;
    shuffled[index] = swap;
    shuffled[swapIndex] = current;
  }
  return shuffled;
}

function createNewListColorDemo(noteIndex: number): {
  sequence: ListAccentUpdate[];
  decidedColor: ListAccentUpdate;
} {
  const decidedColor = stickyNoteColorForIndex(noteIndex);
  const sequence = [decidedColor];
  return {
    sequence,
    decidedColor,
  };
}

function formatColorDemoLabels(sequence: ListAccentUpdate[]): string {
  const labels = sequence
    .map((color) => color.accentLabel?.toLowerCase())
    .filter((label): label is string => Boolean(label));
  if (labels.length === 0) return "a light color, a bold color, and a deep color";
  if (labels.length === 1) return labels[0] ?? "a color";
  return `${labels.slice(0, -1).join(", then ")}, then ${labels[labels.length - 1] ?? "a color"}`;
}

function stickyNoteColorForIndex(index: number): ListAccentUpdate {
  const color = STICKY_NOTE_PALETTE[index % STICKY_NOTE_PALETTE.length];
  return {
    accentColor: color.base,
    accentHex: color.accentHex,
    accentLabel: color.accentLabel,
  };
}

function initialListAccentForIntent(
  intent: { title: string; kind: AssistantListKind },
  index: number,
): ListAccentUpdate {
  return stickyNoteColorForIndex(index);
}

const KNOWN_LOOKUP_LOCATIONS: Array<{ pattern: RegExp; location: string }> = [
  { pattern: /\bpatapsco\b/i, location: "Patapsco Valley State Park, Maryland" },
  { pattern: /\bloch\s+raven\b/i, location: "Loch Raven Reservoir, Maryland" },
  { pattern: /\bgum?powder\b/i, location: "Gunpowder Falls State Park, Maryland" },
];

function normalizeLookupLocation(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  const zip = cleaned.match(/\b\d{5}(?:-\d{4})?\b/)?.[0]?.slice(0, 5);
  if (zip && ZIP_LOCATION_OVERRIDES[zip]) return ZIP_LOCATION_OVERRIDES[zip];
  return cleaned;
}

function getImplicitLookupLocation(text: string): string | null {
  return KNOWN_LOOKUP_LOCATIONS.find((entry) => entry.pattern.test(text))?.location ?? null;
}

function getLookupLocationNotice(query: string): string {
  return `Tell me your ZIP code or city for ${summarizeOnlineLookupTopic(query)}.`;
}

function cleanOnlineLookupLine(value: string): string | null {
  const cleaned = value
    .replace(/^\s*(?:[-*]|\d{1,2}[.)])\s*/, "")
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
    /^(?:here are|here is|i found|these are|some options|events? happening|weather for|current conditions|i need a zip code|need a zip code|please provide a zip|tell me your zip code)\b/i.test(
      cleaned,
    )
  ) {
    return null;
  }
  const repeatedName = cleaned.match(
    /^(.{3,60}?):\s*(?:explore|visit|enjoy|check out)\s+(?:the\s+)?\1\b(?:\s+.*)?$/i,
  );
  if (repeatedName?.[1]) return repeatedName[1].trim();
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
    .slice(0, 5);
}

function formatOnlineLookupSpeech(lines: string[], query: string): string {
  if (lines.length === 0) {
    return "I found a few options. Want me to narrow them down?";
  }
  if (/\b(?:weather|forecast)\b/i.test(query)) {
    return lines.length > 0
      ? `${lines.join(" ")} Want me to use that to pick the best day?`
      : "I had trouble getting the weather right now. Try the ZIP code again.";
  }
  return `I found ${lines.length} quick ideas and put them on the screen. Want one of these, or a few more?`;
}

function stripListItemThinkingPreamble(text: string): string {
  return text
    .replace(/\bwhat else do i (?:want|need)\?\s*/gi, " ")
    .replace(/\bwhat else should i (?:get|add|buy)\?\s*/gi, " ")
    .replace(/\blet'?s see,?\s*(?:um|uh)?\s*/gi, " ")
    .replace(/\band,?\s+um\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function focusExplicitListMutationText(text: string): string {
  const mutationMatches = [
    ...text.matchAll(
      /\b(?:(?:let'?s|lets)\s+)?(?:add|put|get|grab|buy|pick\s+up)\b/gi,
    ),
  ];
  const lastMutation = mutationMatches[mutationMatches.length - 1];
  if (!lastMutation || lastMutation.index == null) return text;
  return text.slice(lastMutation.index).trim();
}

function splitExplicitListItemText(
  source: string,
  options: { activeListKind?: AssistantListKind | null } = {},
): string[] {
  const normalized = source
    .replace(/\bhalf\s*[-\s]+and\s*[-\s]+half\s+coffee\b/gi, "halfandhalf, coffee")
    .replace(/\bhalf\s*[-\s]+and\s*[-\s]+half\b/gi, "halfandhalf")
    .replace(/\bhalf\s+and\s+half\b/gi, "halfandhalf")
    .replace(
      /\b(blackberries|blueberries|raspberries|strawberries|black\s+berries|blue\s+berries|rasp\s+berries|straw\s+berries)\s+(?=(?:blackberries|blueberries|raspberries|strawberries|black\s+berries|blue\s+berries|rasp\s+berries|straw\s+berries)\b)/gi,
      "$1, ",
    )
    .replace(/\b(?:um|uh|okay|ok|please|just|so|let'?s see|lets see)\b/gi, " ")
    .replace(/\b(?:and then|also|then)\b/gi, ",")
    .replace(/\band\s+(?=(?:put|add|get|grab|buy|pick\s+up)\b)/gi, ",")
    .replace(/\b(?:put|add|get|grab|buy|pick\s+up)\b/gi, ",")
    .replace(/[\u2013\u2014]+/g, ",")
    .replace(/\s+/g, " ");

  const extracted = normalized
    .split(/[,.;\n]|\b(?:and|y|e|et|und)\b/gi)
    .map((item) =>
      cleanListItem(item, {
        fromExplicitCommand: true,
        activeListKind: options.activeListKind,
      }),
    )
    .filter((item): item is string => Boolean(item));
  return [...new Map(extracted.map((item) => [item.toLowerCase(), item])).values()];
}

function extractExplicitTargetedListMutationItems(
  text: string,
  options: { activeListKind?: AssistantListKind | null } = {},
): string[] {
  const hasExplicitMutationTail =
    focusExplicitListMutationText(stripDirect6Address(text)) !==
    stripDirect6Address(text);
  if (
    isInternalSignal(text) ||
    LIST_START_REHEARSAL_RE.test(text) ||
    LIST_META_COMMAND_RE.test(text) ||
    (isListReviewOrLayoutSpeech(text) && !hasExplicitMutationTail) ||
    (isListObservationOnly(text) && !hasExplicitMutationTail)
  ) {
    return [];
  }

  const source = focusExplicitListMutationText(stripDirect6Address(text))
    .replace(/[\u2013\u2014]+/g, " ")
    .replace(
      /\s+(?:on|to|in)\s+(?:the\s+)?shop(?:ping)?\s+(?=(?:on|to|in)\s+(?:the\s+)?(?:walmart|shopping|grocery|to[-\s]?do|todo)?\s*list\b)/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  if (!source) return [];

  const takeTaskBeforeTarget = source.match(
    /\b(take(?!\s+(?:off|out|away|down))\s+.{2,180}?)\s+(?:on|to|in)\s+(?:the\s+|my\s+|your\s+|that\s+|this\s+)?(?:grocery\s+|shopping\s+|walmart\s+|to[-\s]?do\s+|todo\s+|task\s+)?list\b/i,
  )?.[1];
  if (takeTaskBeforeTarget) {
    return splitExplicitListItemText(takeTaskBeforeTarget, options);
  }

  const command = "(?:put|add|get|grab|buy|pick\\s+up)";
  const listTarget =
    "(?:the\\s+|my\\s+|your\\s+|that\\s+|this\\s+)?(?:grocery\\s+|shopping\\s+|walmart\\s+|to[-\\s]?do\\s+|todo\\s+|task\\s+)?list";

  const mixedCommand = source.match(
    new RegExp(
      `^\\s*(.{2,80}?)\\s+(?:and|then|also)\\s+${command}\\s+(.{2,120}?)\\s+(?:on|to|in)\\s+${listTarget}\\b`,
      "i",
    ),
  );
  if (mixedCommand?.[1] && mixedCommand[2]) {
    return splitExplicitListItemText(`${mixedCommand[1]}, ${mixedCommand[2]}`, options);
  }

  const afterTarget = source.match(
    new RegExp(
      `\\b${command}\\s+(?:on|to|in)\\s+${listTarget}[\\s,.;:!?\\-]+(.{2,180})$`,
      "i",
    ),
  )?.[1];
  if (afterTarget) return splitExplicitListItemText(afterTarget, options);

  const beforeTarget = source.match(
    new RegExp(
      `\\b${command}\\s+(.{2,180}?)\\s+(?:on|to|in)\\s+${listTarget}\\b`,
      "i",
    ),
  )?.[1];
  if (beforeTarget) return splitExplicitListItemText(beforeTarget, options);

  return [];
}

function isExplicitTargetedListMutationSpeech(text: string): boolean {
  if (extractExplicitTargetedListMutationItems(text).length > 0) return true;
  return /\b(?:put|add|get|grab|buy|pick\s+up)\b[\s\S]{0,180}\b(?:on|to|in)\s+(?:the|my|your|that|this)?\s*(?:grocery|shopping|walmart|to[-\s]?do|todo|task)?\s*list\b/i.test(
    stripDirect6Address(text),
  );
}

function extractListItems(
  text: string,
  options: {
    allowBareItems?: boolean;
    activeListKind?: AssistantListKind | null;
  } = {},
): string[] {
  const itemText = focusExplicitListMutationText(
    stripListItemThinkingPreamble(text),
  );
  if (/^\s*(?:um|uh|and|okay|ok|please|just|so|,|\s)*tooth\s*[\u2013\u2014-]+\s*$/i.test(itemText)) {
    return [];
  }
  const targetedItems = extractExplicitTargetedListMutationItems(itemText, {
    activeListKind: options.activeListKind,
  });
  if (targetedItems.length > 0) return targetedItems;
  if (!canInferListItems(itemText, options)) return [];
  const fromExplicitCommand = LIST_MUTATION_SIGNAL_RE.test(itemText);
  const explicitTodoTail =
    itemText.match(
      /\b(?:to[-\s]?do|todo|task)\b[\s,;:\u2013\u2014-]+(?:i\s+)?(?:need|want|have)\s+to\s+(.{2,120})$/i,
    )?.[1] ?? null;
  if (explicitTodoTail) {
    return extractListItems(`I need to ${explicitTodoTail}`, {
      allowBareItems: false,
      activeListKind: options.activeListKind,
    });
  }

  const normalized = itemText
    .replace(/\bpot\s*[\u2013\u2014-]+\s*(?=toothpaste\b)/gi, "")
    .replace(
      /\b(?:a\s+)?(?:couple|few|some)\s+things\s+(?:on|in|to)\s+(?:here|there|the\s+list)\b/gi,
      " ",
    )
    .replace(/\bhalf\s*[-\s]+and\s*[-\s]+half\s+coffee\b/gi, "halfandhalf, coffee")
    .replace(/\bhalf\s*[-\s]+and\s*[-\s]+half\b/gi, "halfandhalf")
    .replace(/\r/g, "\n")
    .replace(/[\u2013\u2014]+/g, ",")
    .replace(/\bhalf\s+and\s+half\b/gi, "halfandhalf")
    .replace(/\b(?:and then|also|tambien|tambi\u00e9n|aussi|auch)\b/gi, ",")
    .replace(SPOKEN_LIST_COMMAND_RE, ", ")
    .replace(/\b(?:i need|i want|i would like|i'd like|id like|have to get|gotta get|should get|add|put|get|grab|buy|pick up|necesito|quiero|agrega|agregar|anade|a\u00f1ade|comprar|compra|j'?ai besoin de|je veux|ajoute|ajouter|acheter|achete|ich brauche|ich will|fuege|f\u00fcge|kauf|kaufen)\b/gi, ", $&")
    .replace(/\s+/g, " ");

  const extracted = normalized
    .split(/[,.;\n]|\b(?:and|y|e|et|und)\b/gi)
    .map((item) =>
      cleanListItem(item, {
        fromExplicitCommand,
        activeListKind: options.activeListKind,
      }),
    )
    .filter((item): item is string => Boolean(item));
  return [...new Map(extracted.map((item) => [item.toLowerCase(), item])).values()];
}

function isShortBareListItemSpeech(
  text: string,
  activeListKind?: AssistantListKind | null,
): boolean {
  const value = stripDirect6Address(text)
    .replace(/[\u2013\u2014-]+/g, " ")
    .replace(/[.!?,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!value || /[?]/.test(text)) return false;
  if (
    LIST_TRIGGER_RE.test(value) ||
    LIST_CLOSE_RE.test(value) ||
    LIST_DELETE_RE.test(value) ||
    REMOVE_COMMAND_RE.test(value) ||
    LIST_START_REHEARSAL_RE.test(value) ||
    LIST_META_COMMAND_RE.test(value) ||
    LIST_PRODUCT_REVIEW_REHEARSAL_RE.test(value) ||
    isListFlowFeedbackFragment(value) ||
    isListReviewOrLayoutSpeech(value) ||
    isListObservationOnly(value)
  ) {
    return false;
  }
  const words = value
    .replace(/\b(?:okay|ok|um|uh|please)\b/gi, " ")
    .replace(/\byou\s+know\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  return (
    extractListItems(value, {
      allowBareItems: true,
      activeListKind,
    }).length > 0
  );
}

function extractMixedExplicitActiveListItems(
  text: string,
  options: { activeListKind?: AssistantListKind | null } = {},
): string[] {
  const value = stripDirect6Address(text).replace(/\s+/g, " ").trim();
  const afterListMention =
    value.match(
      /\b(?:on|to|in)\s+(?:the|my|your|that|this)?\s*(?:grocery|shopping|walmart|to[-\s]?do|todo)?\s*list[.!?,;:\s]+(.{2,160})$/i,
    )?.[1] ?? null;
  if (afterListMention) {
    const trailingItems = extractListItems(afterListMention, {
      allowBareItems: true,
      activeListKind: options.activeListKind,
    });
    if (trailingItems.length > 0) return trailingItems;
  }
  const explicitTail =
    value.match(
      /\b(?:first\s+(?:thing|item)\s+is\s+)?(?:put|add|get|grab|buy|pick\s+up)\s+(.{2,160})$/i,
    )?.[1] ??
    value.match(/\b(?:let'?s|lets)\s+(?:do|start with|go with)[,.\s]+(.{2,160})$/i)?.[1] ??
    value.match(/\bwhat\s+do\s+i\s+need\s+to\s+do\??\s*i\s+need\s+to\s+(.{2,160})$/i)?.[1] ??
    value.match(/\bi\s+need\s+to\s+(.{2,160})$/i)?.[1] ??
    value.match(/\bi\s+(?:need|want|would\s+like)\s+(?:to\s+(?:get|buy|grab|pick\s+up)\s+|a\s+|an\s+|some\s+)?(.{2,160})$/i)?.[1] ??
    null;
  if (!explicitTail) return [];
  const boundedTail = explicitTail
    .replace(/\b(?:so\s+put\s+those|put\s+those|mm-?hmm|mhm|and\s+that'?s|that'?s all)\b[\s\S]*$/i, " ")
    .trim();
  if (!boundedTail) return [];
  return extractListItems(`I need to ${boundedTail}`, {
    allowBareItems: false,
    activeListKind: options.activeListKind,
  });
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

function formatSmallCountForSpeech(count: number): string {
  const words = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
  ];
  return words[count] ?? String(count);
}

function appSpeechAllowanceMs(text: string): number {
  return Math.min(14000, Math.max(3200, text.length * 58));
}

function buildNamePromptForTurn(
  text: string,
  activeListKind?: AssistantListKind | null,
): string {
  if (shouldSuppressNamePromptOpportunity(text)) return NAME_PROMPT_TEXT;
  const addedItems = extractListItems(text, {
    allowBareItems: true,
    activeListKind,
  });
  if (addedItems.length > 0) {
    const countText = formatSmallCountForSpeech(addedItems.length);
    const noun = addedItems.length === 1 ? "thing" : "things";
    return `I added ${countText} ${noun}. Oh, by the way, what should I call you?`;
  }
  return NAME_PROMPT_TEXT;
}

function vagueShoppingCategoryFromSpeech(
  text: string,
  activeListKind?: AssistantListKind | null,
): string | null {
  if (!/^(?:grocery|shopping)$/.test(activeListKind ?? "")) return null;
  if (isProtectedProductFeedback(text) || isAppFeedbackOnly(text) || isListObservationOnly(text)) {
    return null;
  }
  const match = stripDirect6Address(text)
    .toLowerCase()
    .replace(/[\u2013\u2014-]+/g, " ")
    .replace(/[.!?,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .match(
      /\b(?:a\s+)?(?:bunch|lot|lots|loads|some|several|variety|all kinds|assortment)\s+of\s+(vegetables|veggies|fruit|fruits|snacks|drinks|meat|toiletries|cleaning supplies|groceries)\b/i,
    )?.[1];
  if (!match) return null;
  if (/^veggies$/i.test(match)) return "vegetables";
  if (/^fruits$/i.test(match)) return "fruit";
  return match.toLowerCase();
}

function vagueShoppingCategoryPrompt(category: string): string {
  const item = titleCaseWords(category);
  return `What ${category} do you want me to add, or should I just put ${item}?`;
}

function extractDirect6CommandSegment(text: string): string {
  const addressRe = /\b(?:hey[,\s]+)?(?:six|6)\s*[,.:]\s*/gi;
  let lastAddressEnd = -1;
  let match: RegExpExecArray | null;
  while ((match = addressRe.exec(text)) !== null) {
    lastAddressEnd = addressRe.lastIndex;
  }
  return lastAddressEnd >= 0 ? text.slice(lastAddressEnd).trim() : text;
}

function stripDirect6Address(text: string): string {
  return extractDirect6CommandSegment(text)
    .replace(/^\s*(?:hey[,\s]+)?(?:six|6)(?:\s*[,:]\s*|\s+(?!year\b))/i, "")
    .replace(/[,;:]\s*(?:six|6)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanRemoveListItem(value: string): string | null {
  const item = stripDirect6Address(value)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\b(?:remove|delete|get rid of|take\s*off|takeoff|take out|take|cross off|cross out|check off|mark off)\b/gi, " ")
    .replace(/\b(?:from|off|the|my|this|that|list|got it|i got it|de|del|la|el|mi|esta|ese|eso|lista|liste|ma|meine)\b/gi, " ")
    .replace(/\b(?:um|uh|like|please|okay|ok|por favor|s'il vous plait|s'il vous pla\u00eet|bitte)\b/gi, " ")
    .replace(/^[\s,.;:"'-]+|[\s,.;:"'-]+$/g, "")
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
  if (isListReviewOrLayoutSpeech(text) || isListObservationOnly(text)) return [];
  const source = stripDirect6Address(text)
    .replace(/[â€œâ€]/g, '"')
    .replace(/[â€˜â€™]/g, "'")
    .replace(/[\u2013\u2014]+/g, " ");
  const directCommandMatches = [
    ...source.matchAll(
      /\b(?:remove|delete|get rid of|take\s*off|takeoff|take out|cross off|cross out|check off|mark off|retire|retirer|supprime|supprimer|enleve|enlever|loesche|l\u00f6sche|streiche|abhaken)\s+(.{1,80}?)(?=$|[.?!,;]|\s+(?:and|then|also)\s+(?:put|add|get|grab|buy|pick\s+up)\b|\s+(?:from|off|out of)\s+(?:the|my|this|that)?\s*(?:grocery|shopping|walmart|to[-\s]?do)?\s*list\b)/gi,
    ),
    ...source.matchAll(
      /\btake\s+(.{1,80}?)\s+off(?:\s+(?:the|my|this|that)?\s*(?:grocery|shopping|walmart|to[-\s]?do)?\s*list)?(?=$|[.?!,;]|\s+(?:and|then|also)\s+(?:put|add|get|grab|buy|pick\s+up)\b)/gi,
    ),
  ].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const directCommandText =
    directCommandMatches[directCommandMatches.length - 1]?.[1]?.trim();
  if (directCommandText) {
    return directCommandText
      .split(/[,;\n]|\b(?:and|y|e|et|und)\b/gi)
      .map(cleanRemoveListItem)
      .filter((item): item is string => Boolean(item));
  }

  const normalized = source
    .replace(
      /\btake\s+(.{1,60}?)\s+off(?:\s+(?:the|my|this|that)?\s*(?:grocery|shopping|walmart|to[-\s]?do)?\s*list)?\b/gi,
      ", $1 ",
    )
    .replace(
      /\b(?:remove|delete|get rid of|take\s*off|takeoff|take out|cross off|cross out|check off|mark off|i got(?!\s+to\b)|got(?!\s+to\b)|grabbed|picked up|quita|quitar|elimina|eliminar|borra|borrar|tacha|tachar|ya tengo|j'?ai pris|retire|retirer|supprime|supprimer|enleve|enlever|loesche|l\u00f6sche|streiche|abhaken)\b/gi,
      ",",
    )
    .replace(/\b(?:from|off|the|my|this|that|list|i got it|got it|de|del|la|el|mi|esta|ese|eso|lista|liste|ma|meine)\b/gi, " ")
    .replace(/\s+/g, " ");

  return normalized
    .split(/[,.;\n]|\b(?:and|y|e|et|und)\b/gi)
    .map(cleanRemoveListItem)
    .filter((item): item is string => Boolean(item));
}

function extractPostRemovalAddItems(
  text: string,
  options: { activeListKind?: AssistantListKind | null } = {},
): string[] {
  if (!REMOVE_COMMAND_RE.test(text)) return [];
  if (isListReviewOrLayoutSpeech(text) || isListObservationOnly(text)) return [];
  const source = stripDirect6Address(text)
    .replace(/[Ã¢â‚¬Å“Ã¢â‚¬Â]/g, '"')
    .replace(/[Ã¢â‚¬ËœÃ¢â‚¬â„¢]/g, "'")
    .replace(/[\u2013\u2014]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const addTail =
    source.match(
      /\b(?:remove|delete|get rid of|take\s*off|takeoff|take out|cross off|cross out|check off|mark off)\b[\s\S]{0,120}?\b(?:and|then|also)\s+(?:put|add|get|grab|buy|pick\s+up)\s+(.{2,160})$/i,
    )?.[1] ??
    source.match(
      /\btake\s+[\s\S]{1,90}?\s+off(?:\s+(?:the|my|this|that)?\s*(?:grocery|shopping|walmart|to[-\s]?do)?\s*list)?\s+(?:and|then|also)\s+(?:put|add|get|grab|buy|pick\s+up)\s+(.{2,160})$/i,
    )?.[1] ??
    null;
  if (!addTail) return [];
  return extractListItems(`I need to ${addTail}`, {
    allowBareItems: false,
    activeListKind: options.activeListKind,
  });
}

function spokenNumberToIndex(value: string): number | null {
  const normalized = value.toLowerCase().trim();
  const digit = normalized.match(/\b(?:number|item|#)\s*(\d{1,2})\b/)?.[1];
  if (digit) {
    const index = Number(digit) - 1;
    return Number.isInteger(index) && index >= 0 ? index : null;
  }
  const words: Record<string, number> = {
    one: 0,
    two: 1,
    three: 2,
    four: 3,
    five: 4,
    six: 5,
    seven: 6,
    eight: 7,
    nine: 8,
    ten: 9,
  };
  const word = normalized.match(/\b(?:number|item)\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b/)?.[1];
  return word ? words[word] : null;
}

function extractRemoveItemIndex(text: string): number | null {
  if (!REMOVE_COMMAND_RE.test(text)) return null;
  if (isListReviewOrLayoutSpeech(text) || isListObservationOnly(text)) return null;
  return spokenNumberToIndex(stripDirect6Address(text));
}

function extractRemoveItemIndices(text: string): number[] {
  if (isInternalSignal(text) || !REMOVE_COMMAND_RE.test(text)) return [];
  if (isListReviewOrLayoutSpeech(text) || isListObservationOnly(text)) return [];
  const normalized = stripDirect6Address(text)
    .toLowerCase()
    .replace(/[\u2013\u2014]+/g, " ")
    .replace(/\b(?:okay|ok|so|um|uh|just|please)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words: Record<string, number> = {
    one: 0,
    two: 1,
    three: 2,
    four: 3,
    five: 4,
    six: 5,
    seven: 6,
    eight: 7,
    nine: 8,
    ten: 9,
  };
  const indices = [
    ...[...normalized.matchAll(/\b(?:number|item|#)\s*(\d{1,2})\b/g)].map(
      (match) => Number(match[1]) - 1,
    ),
    ...[...normalized.matchAll(/\b(?:number|item)\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b/g)].map(
      (match) => words[match[1] ?? ""] ?? -1,
    ),
  ].filter((index) => Number.isInteger(index) && index >= 0);

  if (indices.length > 0) {
    return [...new Set(indices)].sort((a, b) => a - b);
  }

  const commandTail =
    normalized.match(
      /\b(?:remove|delete|get rid of|take off|take out|cross off|cross out|check off|mark off)\s+(.{1,80})$/i,
    )?.[1] ?? "";
  const bareIndices = [...commandTail.matchAll(/\b(\d{1,2})\b/g)]
    .map((match) => Number(match[1]) - 1)
    .filter((index) => Number.isInteger(index) && index >= 0);
  return [...new Set(bareIndices)].sort((a, b) => a - b);
}

function detectListIntent(text: string): {
  title: string;
  kind: AssistantListKind;
} | null {
  if (isInternalSignal(text)) return null;
  if (isNewListNameObservation(text)) return null;
  const explicitListActionCommand = isExplicitListActionCommand(text);
  if (
    !explicitListActionCommand &&
    (isProtectedProductFeedback(text) || isAppFeedbackOnly(text) || isListObservationOnly(text))
  ) {
    return null;
  }
  const value = text.toLowerCase();
  if (CODEX_DIRECTED_APP_TASK_RE.test(value)) return null;
  if (
    LIST_META_COMMAND_RE.test(value) ||
    LIST_START_REHEARSAL_RE.test(value) ||
    PROMPT_LABEL_META_RE.test(value) ||
    PROMPT_TOPIC_FEEDBACK_RE.test(value)
  ) {
    return null;
  }

  if (
    /\b(?:what do i want to do|want to do now|going to open it up|lengthening|pulling it all the way down)\b/i.test(
      text,
    )
  ) {
    return null;
  }

  if (/\b(?:went|stopped|changed)\s+(?:to|into)\s+it\s+on\s+list\b|\bit\s+on\s+list\b/i.test(text)) {
    return null;
  }

  if (/\bwhat\s+to\s+do\s+list\b/i.test(text)) {
    return null;
  }

  if (/^\s*like\s+to[-\s]?do\s+list\b/i.test(text)) {
    return null;
  }

  if (/\bshopping\s+list\b[\s\S]{0,80}\bnot\s+(?:a\s+)?wal[-\s]?mart\s+list\b/i.test(text)) {
    return { title: "Shopping List", kind: "shopping" };
  }

  if (/\bwal[-\s]?mart\s+list\b[\s\S]{0,80}\bnot\s+(?:a\s+)?shopping\s+list\b/i.test(text)) {
    return { title: "Walmart List", kind: "shopping" };
  }

  if (/\bwal[-\s]?mart\b/.test(value)) {
    if (
      /\b(?:came\s+(?:up\s+)?as|came\s+as|number\s+\d|option\s+\d|things?\s+came\s+up|market|craft|galore)\b/i.test(
        text,
      )
    ) {
      return null;
    }
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

  if (explicitListActionCommand && /\bsticky\s+notes?\b/i.test(text)) {
    return { title: "Sticky Note", kind: "custom" };
  }

  if (/\bhoney[-\s]?do\s+list\b/i.test(text)) {
    return { title: "Honey-do List", kind: "todo" };
  }

  if (/\b(?:weekend(?:\s+planning)?|plan(?:ning)?\s+(?:my|your|this|the)?\s*weekend)\s+list\b/i.test(text)) {
    return { title: "Plan Your Weekend", kind: "custom" };
  }

  if (/\bgrocer(?:y|ies)\b/.test(value)) {
    return { title: "Grocery List", kind: "grocery" };
  }

  if (/\bshopping\s+list\b/i.test(text)) {
    return { title: "Shopping List", kind: "shopping" };
  }

  if (/\b(?:things to do|anything to do|to do that|to do with|able to)\b/i.test(text)) {
    return null;
  }

  if (/\blist\s+for\s+me\b/i.test(text) && GENERIC_LIST_START_RE.test(text)) {
    return { title: "New List", kind: "custom" };
  }

  const customTopicTitle = detectCustomListTopicTitle(text);
  if (customTopicTitle) {
    return { title: customTopicTitle, kind: "custom" };
  }

  const articleNamedList = text.match(
    /\b(?:a|an|the|my|our)\s+([a-z][a-z0-9'-]{1,24})\s+list\b/i,
  )?.[1];
  if (
    articleNamedList &&
    !/^(?:grocery|shopping|todo|to|do|new|another|different|other|first|second|third|fourth|fifth)$/i.test(
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
    !/^(?:a|an|actually|and|do|for|from|i|just|like|my|need|now|of|or|our|right|that|the|then|to|want|where|your|make|turn|green|blue|black|white|pink|purple|red|yellow|orange|lighter|darker)$/i.test(
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
    return { title: "New List", kind: "custom" };
  }

  const namedList = text.match(
    /\b(?:open|show|switch to|pull up|go to|create|make|start|new)\s+(?:a|an|the|my|another)?\s*([a-z][a-z0-9' -]{1,28})\s+list\b/i,
  )?.[1];
  if (
    namedList &&
    !/^(?:it\s+on(?:\s+the)?|keep\s+the\s+name|keep\s+that\s+stored|remember\s+that|only|ask|cool|that\s+has|stuff\s+on\s+it|another|nother|different|other)$/i.test(
      namedList.trim(),
    )
  ) {
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

  if (/\b(?:another|nother)\s+list\b/i.test(text)) {
    return { title: "New List", kind: "custom" };
  }

  if (EXPLICIT_LIST_DO_START_RE.test(stripDirect6Address(text))) {
    return { title: "New List", kind: "custom" };
  }

  if (GENERIC_LIST_START_RE.test(text)) {
    return { title: "New List", kind: "custom" };
  }

  return null;
}

function normalizedIntentTitle(intent: {
  title: string;
  kind: AssistantListKind;
}): string {
  return intent.title === "New List"
    ? "New List"
    : normalizeListTitle(intent.title, intent.kind);
}

function findAssistantListForIntent(
  lists: AssistantList[],
  intent: { title: string; kind: AssistantListKind },
): AssistantList | null {
  const normalizedTitle = normalizedIntentTitle(intent).trim().toLowerCase();
  const exact = lists.find(
    (list) => list.title.trim().toLowerCase() === normalizedTitle,
  );
  if (exact) return exact;
  if (/^(?:grocery|shopping)$/.test(intent.kind)) {
    return (
      lists
        .filter(
          (list) =>
            /^(?:grocery|shopping)$/.test(list.kind) &&
            !/^walmart\s+list$/i.test(list.title),
        )
        .sort((a, b) => {
          const itemScore = Number(b.items.length > 0) - Number(a.items.length > 0);
          if (itemScore !== 0) return itemScore;
          return b.updatedAt - a.updatedAt;
        })[0] ?? null
    );
  }
  return null;
}

function shouldConfirmListStartRequest(
  text: string,
  intent: { title: string; kind: AssistantListKind },
  lists: AssistantList[],
  activeListId: string | null,
): boolean {
  if (activeListId) return false;
  if (LIST_START_WITH_REFERENCED_ITEMS_RE.test(text)) return false;
  if (shouldStartListImmediately(text, intent)) return false;
  if (isProtectedProductFeedback(text) || isListObservationOnly(text)) {
    return false;
  }

  const value = text.trim().toLowerCase();
  const normalizedTitle = normalizedIntentTitle(intent);
  const hasExistingList = lists.some(
    (list) => list.title.toLowerCase() === normalizedTitle.toLowerCase(),
  );
  const asksToOpen = /\b(?:open|show|pull up|pop up|switch to|go to)\b/i.test(value);
  const asksToStart =
    /\b(?:start|make|create|new)\b/i.test(value) ||
    /\blet'?s\s+(?:make|start|create)\b/i.test(value) ||
    /\bi\s+(?:need|want)\s+(?:a\s+|an\s+)?(?:grocery|shopping|walmart|to[-\s]?do|todo)?\s*list\b/i.test(
      value,
    );

  if (asksToOpen && hasExistingList) return false;
  if (hasExistingList && !asksToStart) return false;
  if (/\b(?:add|put|grab|buy|pick\s+up|have to get|gotta get|should get)\b/i.test(value)) {
    return false;
  }
  if (
    LIST_MUTATION_SIGNAL_RE.test(value) &&
    !asksToStart &&
    !/\b(?:grocery|walmart|shopping|to[-\s]?do|todo)\s+list\b/i.test(value)
  ) {
    return false;
  }
  return (
    asksToStart ||
    /\b(?:grocery|walmart|shopping|to[-\s]?do|todo)\s+list\b/i.test(value)
  );
}

function shouldStartListImmediately(
  text: string,
  intent: { title: string; kind: AssistantListKind },
): boolean {
  const explicitListActionCommand = isExplicitListActionCommand(text);
  if (
    !explicitListActionCommand &&
    (isProtectedProductFeedback(text) || isListObservationOnly(text))
  ) {
    return false;
  }
  if (explicitListActionCommand && !/\blet'?s\s+say\b/i.test(text)) return true;
  if (
    /\b(?:make|create|start|open)\s+(?:with\s+)?(?:a|an|the|my)?\s*(?:grocery|shopping|walmart|to[-\s]?do|todo|task)\s+list\b/i.test(
      stripDirect6Address(text),
    ) ||
    /\b(?:make|create|start|open)\s+(?:another|new)\s+list\b.{0,60}\b(?:grocery|shopping|walmart|to[-\s]?do|todo|task)\s+list\b/i.test(
      stripDirect6Address(text),
    )
  ) {
    return true;
  }
  if (detectCustomListTopicTitle(text)) return true;
  if (
    /^\s*(?:a|an|the|my)?\s*(?:walmart|shopping|grocery|to[-\s]?do|todo|task)\s+list\s*[.!?]*\s*$/i.test(
      stripDirect6Address(text),
    )
  ) {
    return true;
  }
  return false;
}

function getListStartConfirmationPrompt(intent: {
  title: string;
  kind: AssistantListKind;
}): string {
  const title = normalizedIntentTitle(intent);
  if (/^sticky note$/i.test(title)) return "Want me to open a list for you?";
  if (/^walmart list$/i.test(title)) return "Should I make a Walmart list?";
  if (intent.kind === "grocery") return "Should I make a grocery list?";
  if (intent.kind === "shopping") return `Should I make the ${title}?`;
  if (intent.kind === "todo") return "Should I make a to-do list?";
  return `Should I make the ${title}?`;
}

function confirmsListStartFromSpeech(text: string): boolean {
  const value = text.trim();
  if (!value || LIST_START_CONFIRM_NO_RE.test(value)) return false;
  if (
    isProtectedProductFeedback(value) ||
    isListObservationOnly(value) ||
    LIST_START_REHEARSAL_RE.test(value)
  ) {
    return false;
  }

  const compact = value.replace(/[.!?]+$/g, "").trim();
  return (
    /^(?:yes|yeah|yep|yup|sure|ok|okay|please)$/i.test(compact) ||
    /^(?:yes|yeah|yep|yup|sure|ok|okay|please),?\s+(?:start|make|create|open)\s+(?:it|that|this|the\s+list)$/i.test(compact) ||
    /^(?:start|make|create|open)\s+(?:it|that|this|the\s+list)$/i.test(compact) ||
    /^(?:yes|yeah|yep|yup|sure|ok|okay),?\s+(?:start|make|create|open)\s+(?:the\s+)?(?:grocery|shopping|walmart|to[-\s]?do|todo)?\s*list$/i.test(compact)
  );
}

function confirmsListRenameFromSpeech(text: string): boolean {
  const value = text.trim();
  if (!value || LIST_START_CONFIRM_NO_RE.test(value)) return false;
  if (
    isProtectedProductFeedback(value) ||
    isListObservationOnly(value) ||
    LIST_START_REHEARSAL_RE.test(value)
  ) {
    return false;
  }

  const compact = value.replace(/[.!?]+$/g, "").trim();
  return (
    /^(?:yes|yeah|yep|yup|sure|ok|okay|please|correct|right|that'?s right|that is right|do it|go ahead)$/i.test(compact) ||
    /^(?:yes|yeah|yep|yup|sure|ok|okay|please),?\s+(?:rename|change|name)\s+(?:it|that|this|the\s+list)$/i.test(compact) ||
    /^(?:rename|change|name)\s+(?:it|that|this|the\s+list)$/i.test(compact)
  );
}

function wantsSixToHelpNameList(text: string): boolean {
  const value = stripDirect6Address(text).trim();
  return /\b(?:i don'?t know|not sure|you decide|six decide|6 decide|what should (?:i|we) (?:call|name) (?:it|this|the list)|what would you (?:call|name) (?:it|this|the list)|what do you think (?:i|we) should (?:call|name) (?:it|this|the list)|help me (?:name|call) (?:it|this|the list)|suggest (?:a\s+)?(?:name|title))\b/i.test(
    value,
  );
}

function shouldIgnorePendingListNamingSpeech(text: string): boolean {
  const value = stripDirect6Address(text)
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return true;
  return (
    isProtectedProductFeedback(value) ||
    isAppFeedbackOnly(value) ||
    isListObservationOnly(value) ||
    isListFlowFeedbackFragment(value) ||
    isListReviewOrLayoutSpeech(value) ||
    LIST_META_COMMAND_RE.test(value) ||
    LIST_START_REHEARSAL_RE.test(value) ||
    LIST_PRODUCT_REVIEW_REHEARSAL_RE.test(value) ||
    PRODUCT_REVIEW_CONTEXT_RE.test(value) ||
    SILENCE_OR_CUTOFF_FEEDBACK_RE.test(value) ||
    /\b(?:pillboxes?|prompt boxes?|prompt labels?|should\s+not\s+be\s+there|if\s+it\s+says|says?\s+other\s+lists?|talking\s+about\s+lists?|now\s+it'?s\s+back|we'?re\s+talking\s+about|what\s+was\s+the\s+problem|problem\s+needs?\s+to\s+be\s+fixed|sputtering)\b/i.test(
      value,
    )
  );
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
  if (/\b(?:gold|golden|yellow|orange|amber|burnt orange|copper|terracotta|brown)\b/.test(value)) return "amber";
  if (/\b(?:blue|navy|cyan|blurple)\b/.test(value)) return "blue";
  if (/\b(?:green|mint|lime|teal)\b/.test(value)) return "green";
  if (/\b(?:pink|rose|red|coral|burgundy|maroon|wine|oxblood)\b/.test(value)) return "rose";
  if (/\b(?:purple|violet|lavender|indigo|lilac|orchid|plum|magenta)\b/.test(value)) return "purple";
  if (/\b(?:white|plain|light)\b/.test(value)) return "white";
  return null;
}

function detectListAccentUpdate(
  text: string,
  currentList: AssistantList | null,
): ListAccentUpdate | null {
  void text;
  void currentList;
  return null;
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

const SPOKEN_EMAIL_NOISE_WORDS = new Set([
  "email",
  "e",
  "mail",
  "address",
  "is",
  "its",
  "it",
  "my",
  "the",
  "send",
  "link",
  "to",
]);

function isValidEmailCandidate(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function extractSpokenEmailCandidate(text: string): string | null {
  const direct = text.match(EMAIL_RE)?.[0]?.trim().toLowerCase();
  if (direct && isValidEmailCandidate(direct)) return direct;

  const normalized = text
    .toLowerCase()
    .replace(/[']/g, "")
    .replace(/[\u2013\u2014]+/g, " ")
    .replace(/\b(?:at sign|at)\b/g, " @ ")
    .replace(/\b(?:dot|period|point)\b/g, " . ")
    .replace(/\s+/g, " ")
    .trim();
  const atIndex = normalized.indexOf("@");
  if (atIndex < 1) return null;

  const localTokens = normalized
    .slice(0, atIndex)
    .split(/[^a-z0-9._%+-]+/g)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !SPOKEN_EMAIL_NOISE_WORDS.has(token));
  const local = localTokens
    .slice(-6)
    .join("")
    .replace(/[^a-z0-9._%+-]/g, "");
  if (local.length < 2) return null;

  const domainWords = normalized
    .slice(atIndex + 1)
    .replace(/\s*\.\s*/g, ".")
    .replace(/[^a-z0-9.\s-]/g, " ")
    .split(/\s+/g)
    .map((word) => word.trim())
    .filter(Boolean);
  let domain: string | null = null;
  for (let count = 1; count <= Math.min(domainWords.length, 5); count += 1) {
    const candidate = domainWords
      .slice(0, count)
      .join("")
      .replace(/[^a-z0-9.-]/g, "");
    if (/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(candidate)) {
      const tld = candidate.split(".").at(-1) ?? "";
      if (tld.length >= 2) {
        domain = candidate;
        break;
      }
    }
  }
  if (!domain) return null;

  const candidate = `${local}@${domain}`;
  return isValidEmailCandidate(candidate) ? candidate : null;
}

function mergeEmailDomainCorrection(
  text: string,
  previousEmail: string | null,
): string | null {
  if (!previousEmail || !previousEmail.includes("@")) return null;
  const local = previousEmail.split("@")[0];
  if (!local || local.length < 2) return null;
  const normalized = text
    .toLowerCase()
    .replace(/[']/g, "")
    .replace(/\b(?:dot|period|point)\b/g, ".")
    .replace(/[^a-z0-9.\s-]/g, " ")
    .replace(/\s*\.\s*/g, ".")
    .replace(/\s+/g, " ")
    .trim();
  const domain = normalized.match(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/)?.[0];
  if (!domain) return null;
  const candidate = `${local}@${domain}`;
  return isValidEmailCandidate(candidate) ? candidate : null;
}

function extractAccountEmailCandidate(
  text: string,
  fallbackEmail: string | null,
): string | null {
  return extractSpokenEmailCandidate(text) ?? fallbackEmail?.trim().toLowerCase() ?? null;
}

const LiveAvatarSessionComponent: React.FC<{
  onSessionStopped: (opts?: SessionStoppedReason) => void;
  onExit?: (completeExit?: boolean) => void;
}> = ({ onSessionStopped, onExit }) => {
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
    useAvatarActions();

  const { sendMessage } = useTextChat();
  const { sessionRef } = useLiveAvatarContext();
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastAvatarResponseRef = useRef<string>("");
  const lastUserTextRef = useRef<string>("");
  const recentConversationRef = useRef<MemoryConversationLine[]>([]);
  const lastFullModeMessageRef = useRef<{ text: string; at: number } | null>(
    null,
  );
  const generalAvatarResponseTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const pendingGeneralAvatarMessageRef = useRef<{
    text: string;
    normalized: string;
  } | null>(null);
  const voiceActivityRef = useRef({ user: false, avatar: false });
  const normalConversationModeRef = useRef(false);
  const siteFeedbackQuietUntilRef = useRef(0);
  const productReviewIntentGuardUntilRef = useRef(0);
  const suppressNativeListUiSpeechUntilRef = useRef(0);
  const appSideSpeechAllowedUntilRef = useRef(0);
  const allowedAppSpeechStartsRef = useRef(0);
  const lastAvatarResponseTimeRef = useRef<number>(0);
  const anonymousVisitorIdRef = useRef<string>(loadAnonymousVisitorId());
  const recentActionsRef = useRef<string[]>(loadRecentActions());
  const listSwipeStartRef = useRef<{ x: number; y: number; at: number } | null>(
    null,
  );

  const isAttachedRef = useRef<boolean>(false);
  const greetingTriggeredRef = useRef<boolean>(false);
  const audioUnlockedRef = useRef<boolean>(false);
  const wasMutedBeforeRecordingRef = useRef<boolean>(false);
  /** LiveAvatar server session id — used for DB + official transcript API (set when CONNECTED). */
  const dbSessionIdRef = useRef<string | null>(null);
  const clientTranscriptSessionIdRef = useRef<string>(
    createClientTranscriptSessionId(),
  );
  const userTranscriptLogQueueRef = useRef<QueuedConversationLogEntry[]>([]);
  const userTranscriptFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
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
  const [listSwipeNudge, setListSwipeNudge] = useState<"left" | "right" | null>(
    null,
  );
  const [isShoppingMode, setIsShoppingMode] = useState(false);
  const [deviceProfile, setDeviceProfile] =
    useState<DeviceProfile>(loadDeviceProfile);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [accountAuthChecked, setAccountAuthChecked] = useState(true);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const [accountVerificationUrl, setAccountVerificationUrl] = useState<
    string | null
  >(null);
  const [emailEntryOpen, setEmailEntryOpen] = useState(false);
  const [typedAccountEmail, setTypedAccountEmail] = useState("");
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
  const [promptSizeLevel, setPromptSizeLevel] = useState(0);
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
  const lastPromptUpdateAtRef = useRef(0);

  useEffect(() => {
    setThoughtPrompts(normalizeThoughtPrompts(defaultThoughtPromptsForNow()));
  }, []);
  const onlineLookupLocationRef = useRef<string | null>(null);
  const onlineLookupPendingQueryRef = useRef<string | null>(null);
  const pendingOnlineLookupConfirmationRef = useRef<{
    query: string;
    requestedAt: number;
  } | null>(null);
  const onlineLookupLastQueryRef = useRef<string | null>(null);
  const onlineLookupLastLocationRef = useRef<string | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const shoppingListScrollRef = useRef<HTMLDivElement | null>(null);
  const latestListMutationRef = useRef<{
    listId: string;
    item: string | null;
    action: "add" | "remove" | "mention";
  } | null>(null);
  const recentRemovedItemsRef = useRef<
    Array<{ listId: string; item: string; removedAt: number }>
  >([]);
  const pendingListDeleteRef = useRef<string | null>(null);
  const pendingListItemRemovalRef = useRef<{
    listId: string;
    requestedAt: number;
  } | null>(null);
  const pendingListItemFragmentRef = useRef<{
    listId: string;
    text: string;
    requestedAt: number;
  } | null>(null);
  const pendingListStartConfirmationRef = useRef<{
    intent: { title: string; kind: AssistantListKind };
    preferFresh: boolean;
    requestedAt: number;
  } | null>(null);
  const pendingGenericListNamingRef = useRef<{
    requestedAt: number;
    preferFresh: boolean;
    listId?: string;
  } | null>(null);
  const lastListTopicIntentRef = useRef<{
    title: string;
    kind: AssistantListKind;
  } | null>(null);
  const lastEnsuredListRef = useRef<{
    id: string;
    title: string;
    wasNew: boolean;
  } | null>(null);
  const pendingListRetitleRef = useRef<{
    id: string;
    title: string;
    kind: AssistantListKind;
  } | null>(null);
  const pendingListRenameConfirmationRef = useRef<{
    listId: string;
    title: string;
    requestedAt: number;
  } | null>(null);
  const deviceProfileRef = useRef(deviceProfile);
  const nameRelationshipTurnCountRef = useRef(0);
  const namePromptAskedRef = useRef(false);
  const namePromptRetryAskedRef = useRef(false);
  const namePromptAskedAtTurnRef = useRef<number | null>(null);
  const nextNameUseTurnRef = useRef(nextNameUseTurn(0));
  const pendingNamePromptAfterAvatarRef = useRef<string | null>(null);
  const namePromptFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const accountMemorySnapshotRef = useRef<AccountMemorySnapshot | null>(null);
  const accountMemoryContextInjectedRef = useRef(false);
  const postVerifyGreetingSpokenRef = useRef(false);
  const accountSetupAwaitingReadyRef = useRef(false);
  const accountSetupAwaitingEmailRef = useRef(false);
  const accountSetupPendingEmailRef = useRef<string | null>(null);
  const accountSetupRejectedEmailRef = useRef<string | null>(null);
  const accountSetupOfferMadeRef = useRef(false);
  const accountSetupDeclinedAtRef = useRef(0);
  const accountSetupEmailMissCountRef = useRef(0);
  const accountPendingStateTokenRef = useRef<string | null>(null);
  const endSessionConfirmationPendingRef = useRef(false);
  const endSessionConfirmationAskedAtRef = useRef(0);
  const explicitEndSessionRef = useRef(false);
  const listCloseEducationSpokenRef = useRef(false);
  const listMultiNavEducationSpokenRef = useRef(false);
  const pendingListCustomizationPromptRef = useRef<{
    id: string;
    title: string;
  } | null>(null);
  const pendingListColorChoiceRef = useRef<{
    id: string;
    title: string;
    requestedAt: number;
    closeEducation: string;
    navEducation: string;
    demoSequence: ListAccentUpdate[];
    decidedColor: ListAccentUpdate;
    feedbackHeard?: boolean;
    lastReminderAt?: number;
  } | null>(null);
  const listColorDemoTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
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
  const assistantListsRef = useRef<AssistantList[]>(assistantLists);
  const activeListIdRef = useRef<string | null>(activeListId);
  const activeListRef = useRef<AssistantList | null>(activeList);
  useEffect(() => {
    assistantListsRef.current = assistantLists;
    activeListIdRef.current = activeListId;
    activeListRef.current = activeList;
  }, [activeList, activeListId, assistantLists]);
  const visibleThoughtPrompts = useMemo(() => {
    const listIsVisible = Boolean(activeList || isShoppingMode);
    if (
      activeList &&
      pendingListColorChoiceRef.current?.id === activeList.id &&
      !isShoppingMode
    ) {
      return normalizeThoughtPrompts(thoughtPrompts);
    }
    if (activeList && !isShoppingMode) {
      return normalizeThoughtPrompts(ACTIVE_LIST_THOUGHT_PROMPTS);
    }
    return normalizeThoughtPrompts(
      thoughtPrompts.filter(
        (prompt) =>
          listIsVisible ||
          !/^(?:close list|open another list)$/i.test(prompt),
      ),
    );
  }, [activeList, isShoppingMode, thoughtPrompts]);
  const lookupPanelVisible = Boolean(
    onlineLookupNotice || onlineLookupResultLines.length > 0,
  );
  const visiblePromptLimit = lookupPanelVisible ? 3 : 4;
  const promptRowHasActiveList = Boolean(activeList && !isShoppingMode);

  useEffect(() => {
    voiceActivityRef.current = {
      user: isUserTalking,
      avatar: isAvatarTalking,
    };
  }, [isAvatarTalking, isUserTalking]);
  const activeListTheme = listColorThemeFor(activeList);
  const activeListUsesBlackTheme =
    activeListTheme.label.toLowerCase().includes("black") ||
    activeListTheme.solid.toLowerCase() === "#050505";
  const activeListShadePalette = useMemo(
    () => ({
      light: adjustHexShade(activeListTheme.solid, activeListUsesBlackTheme ? 0.42 : 0.34),
      lift: adjustHexShade(activeListTheme.solid, activeListUsesBlackTheme ? 0.24 : 0.18),
      solid: activeListTheme.solid,
      dark: adjustHexShade(activeListTheme.solid, activeListUsesBlackTheme ? -0.1 : -0.28),
      deep: adjustHexShade(activeListTheme.solid, activeListUsesBlackTheme ? -0.26 : -0.54),
    }),
    [activeListTheme.solid, activeListUsesBlackTheme],
  );
  const activeListPaperPalette = useMemo(() => {
    const accent = activeListTheme.solid;
    const brandLine = "#f1c477";
    const paper = "#3a210e";
    const top = "#80521f";
    const header = "#704317";
    const bottom = "#110604";
    const ink = "#ffd98a";
    return {
      accent,
      brandLine,
      paper,
      top,
      header,
      bottom,
      ink,
      line: colorWithAlpha(brandLine, 0.3),
      strongLine: colorWithAlpha(brandLine, 0.58),
      shadow: colorWithAlpha(brandLine, 0.18),
    };
  }, [activeListTheme.solid]);
  const compactListPanelStyle = useMemo<React.CSSProperties>(
    () => ({
      color: activeListPaperPalette.ink,
      borderColor: activeListPaperPalette.strongLine,
      borderRadius: "1.375rem",
      background: `radial-gradient(circle at 50% 0%, ${colorWithAlpha("#ffd98a", 0.34)}, transparent 16rem), linear-gradient(180deg, ${colorWithAlpha(activeListPaperPalette.top, 0.98)} 0%, ${colorWithAlpha(activeListPaperPalette.paper, 0.98)} 72%, ${colorWithAlpha(activeListPaperPalette.bottom, 0.99)} 100%)`,
      boxShadow: `0 0 0 1px ${activeListPaperPalette.shadow}, 0 24px 62px rgba(0,0,0,0.52)`,
    }),
    [activeListPaperPalette],
  );
  const compactListHeaderStyle = useMemo<React.CSSProperties>(
    () => ({
      color: activeListPaperPalette.ink,
      borderColor: activeListPaperPalette.line,
      borderRadius: "1.375rem 1.375rem 0 0",
      background: "transparent",
      boxShadow: `inset 0 -1px 0 ${activeListPaperPalette.line}`,
    }),
    [activeListPaperPalette],
  );
  const compactListBodyStyle = useMemo<React.CSSProperties>(
    () => ({
      borderRadius: "0 0 1.375rem 1.375rem",
      background: "transparent",
      color: activeListPaperPalette.ink,
    }),
    [activeListPaperPalette],
  );
  const compactListMutedStyle = useMemo<React.CSSProperties>(
    () => ({
      color: colorWithAlpha(activeListPaperPalette.ink, 0.72),
    }),
    [activeListPaperPalette],
  );
  const compactListRowStyle = useMemo<React.CSSProperties>(
    () => ({
      background: `linear-gradient(180deg, ${colorWithAlpha("#76501f", 0.66)}, ${colorWithAlpha("#2b1307", 0.72)})`,
      borderColor: activeListPaperPalette.line,
      borderRadius: "0.75rem",
      boxShadow: "none",
    }),
    [activeListPaperPalette],
  );
  const compactListControlStyle = useMemo<React.CSSProperties>(
    () => ({
      background: colorWithAlpha("#76501f", 0.66),
      color: activeListPaperPalette.ink,
      borderColor: colorWithAlpha(activeListPaperPalette.brandLine, 0.32),
    }),
    [activeListPaperPalette],
  );

  const rememberConversationLine = useCallback(
    (role: MemoryConversationLine["role"], text: string) => {
      const cleaned = cleanMemoryText(text, 220);
      if (!cleaned || isInternalSignal(cleaned)) return;
      recentConversationRef.current = [
        ...recentConversationRef.current,
        { role, text: cleaned },
      ].slice(-12);
    },
    [],
  );

  const getConversationLogSessionId = useCallback(() => {
    return (
      dbSessionIdRef.current ??
      getLiveAvatarSessionId(sessionRef.current) ??
      clientTranscriptSessionIdRef.current
    );
  }, [sessionRef]);

  const flushUserTranscriptLogQueue = useCallback((keepalive = false) => {
    if (userTranscriptFlushTimerRef.current) {
      clearTimeout(userTranscriptFlushTimerRef.current);
      userTranscriptFlushTimerRef.current = null;
    }
    const entries = userTranscriptLogQueueRef.current.splice(0, 60);
    if (entries.length === 0) return;

    void fetch("/api/conversation/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
      keepalive,
    }).then((res) => {
      if (!res.ok && !keepalive) {
        userTranscriptLogQueueRef.current = [
          ...entries,
          ...userTranscriptLogQueueRef.current,
        ].slice(0, 120);
      }
    }).catch((error) => {
      if (!keepalive) {
        userTranscriptLogQueueRef.current = [
          ...entries,
          ...userTranscriptLogQueueRef.current,
        ].slice(0, 120);
      }
      console.error("User transcript immediate log failed:", error);
    });
  }, []);

  const queueConversationLogEntry = useCallback(
    (role: "user" | "assistant", text: string, source: string) => {
      const safeText = role === "user" ? stripPrivateGuidance(text) : text;
      const cleaned = safeText.replace(/\s+/g, " ").trim();
      if (!cleaned) return;
      userTranscriptLogQueueRef.current.push({
        sessionId: getConversationLogSessionId(),
        role,
        text: cleaned,
        source,
      });
      if (userTranscriptLogQueueRef.current.length >= 8) {
        flushUserTranscriptLogQueue();
        return;
      }
      if (!userTranscriptFlushTimerRef.current) {
        userTranscriptFlushTimerRef.current = setTimeout(
          () => flushUserTranscriptLogQueue(),
          2_000,
        );
      }
    },
    [flushUserTranscriptLogQueue, getConversationLogSessionId],
  );

  useEffect(() => {
    const handleAssistantRepeat = (event: Event) => {
      const message = (event as CustomEvent<{ message?: unknown }>).detail
        ?.message;
      if (typeof message !== "string") return;
      queueConversationLogEntry("assistant", message, "assistant_app_repeat");
    };

    window.addEventListener("aiasap:assistant-repeat", handleAssistantRepeat);
    return () => {
      window.removeEventListener(
        "aiasap:assistant-repeat",
        handleAssistantRepeat,
      );
    };
  }, [queueConversationLogEntry]);

  useEffect(() => {
    return () => {
      flushUserTranscriptLogQueue(true);
    };
  }, [flushUserTranscriptLogQueue]);

  const buildMemoryAugmentedMessage = useCallback(
    (message: string) => {
      return stripPrivateGuidance(message);
    },
    [],
  );

  const clearNamePromptFallbackTimer = useCallback(() => {
    if (namePromptFallbackTimerRef.current) {
      clearTimeout(namePromptFallbackTimerRef.current);
      namePromptFallbackTimerRef.current = null;
    }
  }, []);

  const takeListMultiNavEducation = useCallback((listCount: number) => {
    if (listCount < 2 || listMultiNavEducationSpokenRef.current) return "";
    listMultiNavEducationSpokenRef.current = true;
    return ` ${LIST_MULTI_NAV_EDUCATION}`;
  }, []);

  const clearListColorDemoTimers = useCallback(() => {
    listColorDemoTimersRef.current.forEach((timer) => clearTimeout(timer));
    listColorDemoTimersRef.current = [];
  }, []);

  const speakPendingNamePrompt = useCallback(async () => {
    const prompt = pendingNamePromptAfterAvatarRef.current;
    if (!prompt || deviceProfileRef.current.name) return;
    const retryPendingPrompt = (delayMs: number) => {
      clearNamePromptFallbackTimer();
      namePromptFallbackTimerRef.current = setTimeout(() => {
        void speakPendingNamePrompt();
      }, delayMs);
    };
    if (
      pendingListStartConfirmationRef.current ||
      pendingGenericListNamingRef.current
    ) {
      retryPendingPrompt(2500);
      return;
    }
    if (voiceActivityRef.current.user || voiceActivityRef.current.avatar) {
      retryPendingPrompt(1800);
      return;
    }

    pendingNamePromptAfterAvatarRef.current = null;
    clearNamePromptFallbackTimer();
    try {
      await interrupt();
      appSideSpeechAllowedUntilRef.current =
        Date.now() + appSpeechAllowanceMs(prompt);
      allowedAppSpeechStartsRef.current = Math.max(
        allowedAppSpeechStartsRef.current,
        1,
      );
      await repeat(prompt);
      lastAvatarResponseRef.current = prompt;
      rememberConversationLine("assistant", prompt);
      lastAvatarResponseTimeRef.current = Date.now();
    } catch (error) {
      console.error("Failed to speak pending name prompt:", error);
      pendingNamePromptAfterAvatarRef.current = prompt;
    }
  }, [clearNamePromptFallbackTimer, interrupt, rememberConversationLine, repeat]);

  const armPendingNamePrompt = useCallback(
    (prompt: string) => {
      pendingNamePromptAfterAvatarRef.current = prompt;
      clearNamePromptFallbackTimer();
      namePromptFallbackTimerRef.current = setTimeout(() => {
        void speakPendingNamePrompt();
      }, 4000);
    },
    [clearNamePromptFallbackTimer, speakPendingNamePrompt],
  );

  const cancelQueuedGeneralAvatarResponse = useCallback(() => {
    if (generalAvatarResponseTimeoutRef.current) {
      clearTimeout(generalAvatarResponseTimeoutRef.current);
      generalAvatarResponseTimeoutRef.current = null;
    }
    pendingGeneralAvatarMessageRef.current = null;
  }, []);

  const armNativeListUiSpeechSuppression = useCallback(
    (durationMs = 22000, firstDelayMs = 250) => {
      const until = Date.now() + durationMs;
      suppressNativeListUiSpeechUntilRef.current = Math.max(
        suppressNativeListUiSpeechUntilRef.current,
        until,
      );
      [firstDelayMs, firstDelayMs + 450, firstDelayMs + 1100, firstDelayMs + 2200].forEach(
        (delay) => {
          window.setTimeout(() => {
            const now = Date.now();
            if (
              now >= suppressNativeListUiSpeechUntilRef.current ||
              now < appSideSpeechAllowedUntilRef.current ||
              voiceActivityRef.current.user
            ) {
              return;
            }
            cancelQueuedGeneralAvatarResponse();
            void interrupt();
          }, delay);
        },
      );
    },
    [cancelQueuedGeneralAvatarResponse, interrupt],
  );

  const permitNextAppSpeech = useCallback(
    (text: string, suppressMs = 0) => {
      const allowanceMs = appSpeechAllowanceMs(text);
      const now = Date.now();
      appSideSpeechAllowedUntilRef.current = Math.max(
        appSideSpeechAllowedUntilRef.current,
        now + allowanceMs,
      );
      allowedAppSpeechStartsRef.current = Math.max(
        allowedAppSpeechStartsRef.current,
        1,
      );
      if (suppressMs > 0) {
        armNativeListUiSpeechSuppression(suppressMs, allowanceMs + 350);
      }
    },
    [armNativeListUiSpeechSuppression],
  );

  const queueGeneralAvatarResponse = useCallback(
    (message: string) => {
      const normalized = message.toLowerCase().replace(/\s+/g, " ").trim();
      if (!normalized) return;
      const pending = { text: message, normalized };
      pendingGeneralAvatarMessageRef.current = pending;
      if (generalAvatarResponseTimeoutRef.current) {
        clearTimeout(generalAvatarResponseTimeoutRef.current);
      }

      const flush = (attempt = 0) => {
        if (pendingGeneralAvatarMessageRef.current !== pending) return;
        if (voiceActivityRef.current.user && attempt < 24) {
          generalAvatarResponseTimeoutRef.current = setTimeout(
            () => flush(attempt + 1),
            1500,
          );
          return;
        }
        if (voiceActivityRef.current.user) return;

        pendingGeneralAvatarMessageRef.current = null;
        generalAvatarResponseTimeoutRef.current = null;
        const lastFullModeMessage = lastFullModeMessageRef.current;
        const isDuplicateFullModeMessage =
          lastFullModeMessage?.text === pending.normalized &&
          Date.now() - lastFullModeMessage.at < 5000;
        if (isDuplicateFullModeMessage) return;

        lastFullModeMessageRef.current = {
          text: pending.normalized,
          at: Date.now(),
        };
        void sendMessage(buildMemoryAugmentedMessage(pending.text)).catch(
          (error) => console.error("Failed to send queued avatar message:", error),
        );
      };

      generalAvatarResponseTimeoutRef.current = setTimeout(() => flush(), 2200);
    },
    [buildMemoryAugmentedMessage, sendMessage],
  );

  const recordRecentAction = useCallback((action: string) => {
    const cleaned = action.replace(/\s+/g, " ").trim().slice(0, 220);
    if (!cleaned) return;
    const nextActions = [
      `${new Date().toISOString()} ${cleaned}`,
      ...recentActionsRef.current,
    ].slice(0, MAX_RECENT_ACTIONS);
    recentActionsRef.current = nextActions;
    storeRecentActions(nextActions);
  }, []);

  const getStructuredScreenState = useCallback(() => {
    const activeIndex = activeList
      ? assistantLists.findIndex((list) => list.id === activeList.id)
      : -1;
    return {
      route:
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/",
      viewport:
        typeof window !== "undefined"
          ? `${window.innerWidth}x${window.innerHeight}`
          : null,
      activeList: activeList?.title ?? null,
      visibleItems: activeList?.items.slice(0, MAX_LIST_STATE_LOG_ITEMS) ?? [],
      visiblePromptBoxes: visibleThoughtPrompts.slice(0, visiblePromptLimit),
      listIndex: activeIndex >= 0 ? activeIndex + 1 : null,
      listCount: assistantLists.length,
      lookupPanel: {
        visible: lookupPanelVisible,
        notice: onlineLookupNotice,
        resultLines: onlineLookupResultLines.slice(0, 8),
        sourceCount: onlineLookupSources.length,
        sources: onlineLookupSources
          .slice(0, 8)
          .map((source) => ({ title: source.title, url: source.url })),
      },
      recentActions: recentActionsRef.current.slice(0, MAX_RECENT_ACTIONS),
      mode: "full-liveavatar",
    };
  }, [
    activeList,
    assistantLists,
    lookupPanelVisible,
    onlineLookupNotice,
    onlineLookupResultLines,
    onlineLookupSources,
    visiblePromptLimit,
    visibleThoughtPrompts,
  ]);

  const logProductFeedback = useCallback(
    (
      phrase: string,
      classification: {
        sentiment: "negative" | "positive";
        severity: "critical" | "high" | "medium" | "low";
      },
    ) => {
      const sessionId =
        dbSessionIdRef.current ?? getLiveAvatarSessionId(sessionRef.current);
      const screen = getStructuredScreenState();
      void fetch("/api/app-events/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "feedback",
          sessionId,
          anonymousVisitorId: anonymousVisitorIdRef.current,
          phrase,
          sentiment: classification.sentiment,
          severity: classification.severity,
          route: screen.route,
          viewport: screen.viewport,
          activeList: screen.activeList,
          visibleItems: screen.visibleItems,
          visiblePromptBoxes: screen.visiblePromptBoxes,
          listIndex: screen.listIndex,
          listCount: screen.listCount,
          recentActions: screen.recentActions,
          mode: screen.mode,
          payload: screen,
        }),
        keepalive: phrase.length < 700,
      }).catch((error) => console.warn("Feedback event log failed:", error));
    },
    [getStructuredScreenState, sessionRef],
  );

  const logPreferenceCandidate = useCallback(
    (sourceText: string) => {
      const signal = extractPreferenceSignal(sourceText);
      if (!signal) return;
      const sessionId =
        dbSessionIdRef.current ?? getLiveAvatarSessionId(sessionRef.current);
      void fetch("/api/app-events/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "preference",
          sessionId,
          anonymousVisitorId: anonymousVisitorIdRef.current,
          signal,
          sourceText,
          confidence: 0.62,
          payload: getStructuredScreenState(),
        }),
        keepalive: sourceText.length < 700,
      }).catch((error) => console.warn("Preference event log failed:", error));
    },
    [getStructuredScreenState, sessionRef],
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
    clearBetaFreshSessionStorage();
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
      if (!isShoppingMode && activeList.items.length <= 4) {
        container.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
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

  // When session fails to start (e.g. no credits), show message and don't auto-restart
  const [sessionStartError, setSessionStartError] = useState<string | null>(
    null,
  );
  const sessionStartErrorRef = useRef<string | null>(null);
  const voiceIsActive = isActive;
  const voiceIsLoading = isLoading || voiceStartAwaitingReady;

  const runPromptBrain = useCallback(async (text: string) => {
    const latestUserText = text.trim();
    if (latestUserText.length < 3) return;

    const pendingLookupQuery = onlineLookupPendingQueryRef.current;
    if (pendingLookupQuery && !onlineLookupLocationRef.current) {
      lastPromptUpdateAtRef.current = Date.now();
      setThoughtPrompts(getLookupLocationPrompts(pendingLookupQuery));
      return;
    }
    if (
      pendingLookupQuery &&
      onlineLookupLocationRef.current &&
      shouldAskPreferencesBeforeLookup(pendingLookupQuery)
    ) {
      lastPromptUpdateAtRef.current = Date.now();
      setThoughtPrompts(getLookupPreferencePrompts(pendingLookupQuery));
      return;
    }

    const recentUserTexts = [
      ...promptBrainHistoryRef.current,
      latestUserText,
    ].slice(-8);
    promptBrainHistoryRef.current = recentUserTexts;
    const promptContext = recentUserTexts.join(" ");
    const fallbackPrompts = normalizeThoughtPrompts(
      getThoughtPrompts(promptContext),
    );

    const sequence = ++promptBrainSeqRef.current;
    lastPromptUpdateAtRef.current = Date.now();
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
          lastPromptUpdateAtRef.current = Date.now();
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
      if (
        isAppFeedbackOnly(latestUserText) ||
        isProtectedProductFeedback(latestUserText) ||
        PRODUCT_REVIEW_CONTEXT_RE.test(latestUserText) ||
        classifyProductFeedback(latestUserText)
      ) {
        return;
      }
      const contextualListIntent = contextualListIntentForText(latestUserText);
      if (contextualListIntent) {
        lastListTopicIntentRef.current = contextualListIntent;
      }

      const pendingLookupQuery = onlineLookupPendingQueryRef.current;
      if (pendingLookupQuery && !onlineLookupLocationRef.current) {
        lastPromptUpdateAtRef.current = Date.now();
        setThoughtPrompts(getLookupLocationPrompts(pendingLookupQuery));
        return;
      }
      if (
        pendingLookupQuery &&
        onlineLookupLocationRef.current &&
        shouldAskPreferencesBeforeLookup(pendingLookupQuery)
      ) {
        lastPromptUpdateAtRef.current = Date.now();
        setThoughtPrompts(getLookupPreferencePrompts(pendingLookupQuery));
        return;
      }

      const now = Date.now();
      const hasFocusedPromptContext = Boolean(getFocusedThoughtPrompts(latestUserText));
      const shouldRefreshNow =
        hasFocusedPromptContext ||
        IMMEDIATE_DEFAULT_PROMPTS_RE.test(latestUserText) ||
        isAppFeedbackOnly(latestUserText) ||
        now - lastPromptUpdateAtRef.current >= PROMPT_REFRESH_MIN_MS;
      if (shouldRefreshNow) {
        lastPromptUpdateAtRef.current = now;
        setThoughtPrompts(
          normalizeThoughtPrompts(
            getThoughtPrompts(latestUserText),
          ),
        );
      }

      if (promptBrainTimeoutRef.current) {
        clearTimeout(promptBrainTimeoutRef.current);
      }
      promptBrainTimeoutRef.current = setTimeout(() => {
        void runPromptBrain(latestUserText);
      }, PROMPT_BRAIN_DELAY_MS);
    },
    [runPromptBrain],
  );

  useEffect(() => {
    storeAssistantLists(assistantLists);
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
      setActiveListId(null);
      setIsShoppingMode(false);
      try {
        window.localStorage.removeItem(ACCOUNT_PENDING_STATE_TOKEN_STORAGE_KEY);
      } catch {
        // Fresh beta sessions must not depend on browser storage cleanup.
      }
      void fetch("/api/account/me", { cache: "no-store" }).catch(() => {});
      return;
    }

    let cancelled = false;
    fetch("/api/account/me")
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!data?.authenticated) {
          accountListsLoadedRef.current = true;
          setAccountAuthChecked(true);
          return;
        }
        if (typeof data.user?.email === "string") {
          setAccountEmail(data.user.email);
          accountPendingStateTokenRef.current = null;
          try {
            window.localStorage.removeItem(
              ACCOUNT_PENDING_STATE_TOKEN_STORAGE_KEY,
            );
          } catch {
            // Ignore storage cleanup failures.
          }
        }
        const accountFullName =
          typeof data.user?.fullName === "string"
            ? cleanDeviceName(data.user.fullName)
            : null;
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
        });
        accountMemoryContextInjectedRef.current = false;

        onlineLookupPendingQueryRef.current = null;
        pendingOnlineLookupConfirmationRef.current = null;
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
          setPostVerifyGreeting(
            "You're back. Account is set, and I can remember you now. We can pick up like friends.",
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
      !isStreamReady
    ) {
      return;
    }
    postVerifyGreetingSpokenRef.current = true;
    setAccountNotice("Account verified");
    void repeat(postVerifyGreeting).then(() => {
      lastAvatarResponseRef.current = postVerifyGreeting;
      rememberConversationLine("assistant", postVerifyGreeting);
      lastAvatarResponseTimeRef.current = Date.now();
    });
  }, [isStreamReady, postVerifyGreeting, rememberConversationLine, repeat, sessionState]);

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

  const logAssistantListState = useCallback(
    (
      action: AssistantListStateAction,
      list: AssistantList,
      options: {
        activeListId?: string | null;
        isShoppingMode?: boolean;
        visible?: boolean;
        detail?: Record<string, unknown>;
      } = {},
    ) => {
      recordRecentAction(
        `${action} list ${list.title}${
          options.detail ? ` ${JSON.stringify(options.detail).slice(0, 140)}` : ""
        }`,
      );
      const sessionId =
        dbSessionIdRef.current ?? getLiveAvatarSessionId(sessionRef.current);
      if (!sessionId) return;

      const text = buildListStateLogMessage(action, list, {
        activeListId: options.activeListId ?? activeListId,
        isShoppingMode: options.isShoppingMode ?? isShoppingMode,
        visible: options.visible,
        detail: options.detail,
      });

      void fetch("/api/conversation/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          role: "assistant",
          text,
          source: "list_state",
        }),
        keepalive: text.length < 3500,
      }).catch((error) => console.warn("List state log failed:", error));
    },
    [activeListId, isShoppingMode, recordRecentAction, sessionRef],
  );

  const rememberRemovedListItems = useCallback(
    (listId: string, items: string[]) => {
      const cleaned = items
        .map((item) => cleanListItem(item))
        .filter((item): item is string => Boolean(item));
      if (cleaned.length === 0) return;
      recentRemovedItemsRef.current = [
        ...cleaned.map((item) => ({ listId, item, removedAt: Date.now() })),
        ...recentRemovedItemsRef.current,
      ].slice(0, MAX_RECENT_REMOVALS);
    },
    [],
  );

  const ensureAssistantList = useCallback(
    (
      intent: { title: string; kind: AssistantListKind },
      options: { preferFresh?: boolean } = {},
    ): string | null => {
      const now = Date.now();
      const normalizedTitle =
        intent.title === "New List"
          ? "New List"
          : normalizeListTitle(intent.title, intent.kind);
      const liveLists = assistantListsRef.current.length
        ? assistantListsRef.current
        : assistantLists;
      const matchingLists = liveLists.filter(
        (list) => list.title.toLowerCase() === normalizedTitle.toLowerCase(),
      );
      const activeMatchingList = activeListIdRef.current
        ? matchingLists.find((list) => list.id === activeListIdRef.current)
        : null;
      const existing =
        activeMatchingList ??
        matchingLists
          .slice()
          .sort((a, b) => {
            const itemScore = Number(b.items.length > 0) - Number(a.items.length > 0);
            if (itemScore !== 0) return itemScore;
            return b.updatedAt - a.updatedAt;
          })[0] ??
        null;

      if (existing && !options.preferFresh) {
        lastEnsuredListRef.current = {
          id: existing.id,
          title: existing.title,
          wasNew: false,
        };
        onlineLookupPendingQueryRef.current = null;
        pendingOnlineLookupConfirmationRef.current = null;
        onlineLookupLocationRef.current = null;
        setOnlineLookupNotice(null);
        setOnlineLookupSources([]);
        setOnlineLookupResultLines([]);
        setSourcePreview(null);
        activeListIdRef.current = existing.id;
        activeListRef.current = existing;
        setActiveListId(existing.id);
        logAssistantListState("open", existing, {
          activeListId: existing.id,
          detail: { wasNew: false },
        });
        return existing.id;
      }

      if (liveLists.length >= MAX_ACTIVE_STICKY_NOTES) {
        lastEnsuredListRef.current = null;
        setOnlineLookupNotice(
          "You have 10 lists open. Tell 6 which one to change out.",
        );
        setOnlineLookupSources([]);
        setOnlineLookupResultLines([]);
        setSourcePreview(null);
        return null;
      }

      const baseId = listIdForTitle(normalizedTitle);
      let id = baseId;
      let suffix = 2;
      while (liveLists.some((list) => list.id === id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }

      const accent = initialListAccentForIntent(intent, liveLists.length);
      const newList: AssistantList = {
        id,
        title: normalizedTitle,
        kind: intent.kind,
        items: [],
        displayStyle: "numbered",
        accentColor: accent.accentColor,
        accentHex: accent.accentHex,
        accentLabel: accent.accentLabel,
        createdAt: now,
        updatedAt: now,
      };

      assistantListsRef.current = [...liveLists, newList];
      activeListIdRef.current = id;
      activeListRef.current = newList;
      setAssistantLists((currentLists) => {
        if (currentLists.some((list) => list.id === id)) return currentLists;
        return [...currentLists, newList];
      });
      lastEnsuredListRef.current = {
        id,
        title: normalizedTitle,
        wasNew: true,
      };
      onlineLookupPendingQueryRef.current = null;
      pendingOnlineLookupConfirmationRef.current = null;
      onlineLookupLocationRef.current = null;
      setOnlineLookupNotice(null);
      setOnlineLookupSources([]);
      setOnlineLookupResultLines([]);
      setSourcePreview(null);
      setActiveListId(id);
      logAssistantListState("create", newList, {
        activeListId: id,
        detail: { wasNew: true },
      });
      return id;
    },
    [assistantLists, logAssistantListState],
  );

  const addItemsToList = useCallback((listId: string, items: string[]) => {
    if (items.length === 0) return false;
    const liveLists = assistantListsRef.current.length
      ? assistantListsRef.current
      : assistantLists;
    const list = liveLists.find((item) => item.id === listId);
    if (!list) {
      let changed = false;
      let nextListForLog: AssistantList | null = null;
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
              changed = true;
            }
          }
          nextListForLog = {
            ...currentList,
            items: nextItems.slice(0, MAX_LIST_ITEMS),
            updatedAt: Date.now(),
          };
          return nextListForLog;
        }),
      );
      if (!changed || !nextListForLog) return false;
      assistantListsRef.current = assistantListsRef.current.map((currentList) =>
        currentList.id === listId ? nextListForLog as AssistantList : currentList,
      );
      if (activeListIdRef.current === listId) activeListRef.current = nextListForLog;
      latestListMutationRef.current = {
        listId,
        item: items[items.length - 1] ?? null,
        action: "add",
      };
      logAssistantListState("add", nextListForLog, {
        activeListId: listId,
        detail: { addedItems: items },
      });
      setListFocusNonce((value) => value + 1);
      return true;
    }
    const pendingRetitle =
      pendingListRetitleRef.current?.id === listId
        ? pendingListRetitleRef.current
        : null;
    const listForMutation = pendingRetitle
      ? { ...list, title: pendingRetitle.title, kind: pendingRetitle.kind }
      : list;
    const nextItems = [...listForMutation.items];
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

    const nextList = {
      ...listForMutation,
      items: nextItems.slice(0, MAX_LIST_ITEMS),
      updatedAt: Date.now(),
    };
    if (pendingRetitle) {
      pendingListRetitleRef.current = null;
    }
    assistantListsRef.current = liveLists.map((currentList) =>
      currentList.id === listId ? nextList : currentList,
    );
    if (activeListIdRef.current === listId) activeListRef.current = nextList;
    latestListMutationRef.current = {
      listId,
      item: items[items.length - 1] ?? null,
      action: "add",
    };
    setAssistantLists((currentLists) =>
      currentLists.map((currentList) => {
        if (currentList.id !== listId) return currentList;
        return nextList;
      }),
    );
    logAssistantListState("add", nextList, {
      activeListId: listId,
      detail: { addedItems: items },
    });
    setListFocusNonce((value) => value + 1);
    return true;
  }, [assistantLists, logAssistantListState]);

  const removeItemsFromList = useCallback((listId: string, items: string[]) => {
    if (items.length === 0) return false;
    const liveLists = assistantListsRef.current.length
      ? assistantListsRef.current
      : assistantLists;
    const list = liveLists.find((item) => item.id === listId);
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
    const removedItems = list.items.filter((item) =>
      wantsRemoveAddLiteral && /^add$/i.test(item)
        ? true
        : items.some((removeItem) => itemKeysMatch(item, removeItem)),
    );
    rememberRemovedListItems(listId, removedItems);

    const nextList = {
      ...list,
      items: nextItems,
      updatedAt: Date.now(),
    };
    latestListMutationRef.current = {
      listId,
      item: items[0] ?? null,
      action: "remove",
    };
    assistantListsRef.current = liveLists.map((currentList) =>
      currentList.id === listId ? nextList : currentList,
    );
    if (activeListIdRef.current === listId) activeListRef.current = nextList;
    setAssistantLists((currentLists) =>
      currentLists.map((currentList) =>
        currentList.id === listId
          ? nextList
          : currentList,
      ),
    );
    logAssistantListState("remove", nextList, {
      activeListId: listId,
      detail: { requestedItems: items, removedCount: list.items.length - nextItems.length },
    });
    setListFocusNonce((value) => value + 1);
    return true;
  }, [assistantLists, logAssistantListState, rememberRemovedListItems]);

  const clearListItems = useCallback(
    (listId: string) => {
      const list = assistantLists.find((item) => item.id === listId);
      if (!list || list.items.length === 0) return false;
      rememberRemovedListItems(listId, list.items);
      const nextList = {
        ...list,
        items: [],
        updatedAt: Date.now(),
      };
      setAssistantLists((currentLists) =>
        currentLists.map((currentList) =>
          currentList.id === listId ? nextList : currentList,
        ),
      );
      setActiveListId(null);
      setIsShoppingMode(false);
      logAssistantListState("remove", nextList, {
        activeListId: null,
        visible: false,
        detail: { cleared: true, removedCount: list.items.length },
      });
      setListFocusNonce((value) => value + 1);
      return true;
    },
    [assistantLists, logAssistantListState, rememberRemovedListItems],
  );

  const deleteAssistantList = useCallback(
    (listId: string) => {
      const list = assistantLists.find((item) => item.id === listId);
      if (list) {
        logAssistantListState("delete", list, {
          activeListId: activeListId === listId ? null : activeListId,
          isShoppingMode: false,
          visible: false,
        });
      }
      setAssistantLists((currentLists) =>
        currentLists.filter((currentList) => currentList.id !== listId),
      );
      setActiveListId((currentActiveId) =>
        currentActiveId === listId ? null : currentActiveId,
      );
      setIsShoppingMode(false);
      latestListMutationRef.current = null;
      pendingListDeleteRef.current = null;
      pendingListItemRemovalRef.current = null;
    },
    [activeListId, assistantLists, logAssistantListState],
  );

  const removeListItemAtIndex = useCallback(
    (listId: string, itemIndex: number) => {
      const list = assistantLists.find((item) => item.id === listId);
      if (!list || itemIndex < 0 || itemIndex >= list.items.length) return false;
      const removedItem = list.items[itemIndex] ?? null;
      if (removedItem) {
        rememberRemovedListItems(listId, [removedItem]);
      }
      const nextList = {
        ...list,
        items: list.items.filter((_, index) => index !== itemIndex),
        updatedAt: Date.now(),
      };
      latestListMutationRef.current = {
        listId,
        item: removedItem,
        action: "remove",
      };
      setAssistantLists((currentLists) =>
        currentLists.map((currentList) =>
          currentList.id === listId ? nextList : currentList,
        ),
      );
      logAssistantListState("remove", nextList, {
        activeListId: listId,
        detail: { removedIndex: itemIndex, removedItem },
      });
      setListFocusNonce((value) => value + 1);
      return true;
    },
    [assistantLists, logAssistantListState, rememberRemovedListItems],
  );

  const removeListItemsAtIndices = useCallback(
    (listId: string, itemIndices: number[]) => {
      const liveLists = assistantListsRef.current.length
        ? assistantListsRef.current
        : assistantLists;
      const list = liveLists.find((item) => item.id === listId);
      if (!list) return [];
      const indices = [...new Set(itemIndices)]
        .filter((index) => index >= 0 && index < list.items.length)
        .sort((a, b) => a - b);
      if (indices.length === 0) return [];
      const removeSet = new Set(indices);
      const removedItems = indices
        .map((index) => list.items[index])
        .filter((item): item is string => Boolean(item));
      if (removedItems.length > 0) {
        rememberRemovedListItems(listId, removedItems);
      }
      const nextList = {
        ...list,
        items: list.items.filter((_, index) => !removeSet.has(index)),
        updatedAt: Date.now(),
      };
      latestListMutationRef.current = {
        listId,
        item: removedItems.join(", "),
        action: "remove",
      };
      assistantListsRef.current = liveLists.map((currentList) =>
        currentList.id === listId ? nextList : currentList,
      );
      if (activeListIdRef.current === listId) activeListRef.current = nextList;
      setAssistantLists((currentLists) =>
        currentLists.map((currentList) =>
          currentList.id === listId ? nextList : currentList,
        ),
      );
      logAssistantListState("remove", nextList, {
        activeListId: listId,
        detail: {
          removedIndices: indices.map((index) => index + 1),
          removedItems,
        },
      });
      setListFocusNonce((value) => value + 1);
      return removedItems;
    },
    [assistantLists, logAssistantListState, rememberRemovedListItems],
  );

  const renameAssistantList = useCallback(
    (listId: string, title: string) => {
      const liveLists = assistantListsRef.current.length
        ? assistantListsRef.current
        : assistantLists;
      const list = liveLists.find((item) => item.id === listId);
      const cleanTitle = cleanRequestedListTitle(title, {
        appendList: list?.kind !== "custom",
      });
      if (!list || !cleanTitle) return false;
      if (list.title.trim().toLowerCase() === cleanTitle.trim().toLowerCase()) {
        return false;
      }
      const nextKind = listKindForTitle(cleanTitle, list.kind);
      const nextList = {
        ...list,
        title: cleanTitle,
        kind: nextKind,
        updatedAt: Date.now(),
      };
      pendingListRetitleRef.current = {
        id: listId,
        title: cleanTitle,
        kind: nextKind,
      };
      assistantListsRef.current = liveLists.map((currentList) =>
        currentList.id === listId ? nextList : currentList,
      );
      if (activeListIdRef.current === listId) {
        activeListRef.current = nextList;
      }
      setAssistantLists((currentLists) =>
        currentLists.map((currentList) =>
          currentList.id === listId ? nextList : currentList,
        ),
      );
      logAssistantListState("style", nextList, {
        activeListId: listId,
        detail: { renamed: true, previousTitle: list.title },
      });
      return true;
    },
    [assistantLists, logAssistantListState],
  );

  const requestListRenameConfirmation = useCallback(
    async (listId: string, title: string) => {
      const liveLists = assistantListsRef.current.length
        ? assistantListsRef.current
        : assistantLists;
      const list = liveLists.find((item) => item.id === listId);
      const cleanTitle = cleanRequestedListTitle(title, {
        appendList: list?.kind !== "custom",
      });
      if (!list || !cleanTitle) return false;
      if (list.title.trim().toLowerCase() === cleanTitle.trim().toLowerCase()) {
        return false;
      }

      pendingListRenameConfirmationRef.current = {
        listId,
        title: cleanTitle,
        requestedAt: Date.now(),
      };
      setThoughtPrompts(
        normalizeThoughtPrompts([
          "Yes, Rename It",
          "No, Keep It",
          "Add Item",
          "Close List",
        ]),
      );
      const spoken = `Should I rename this list to ${cleanTitle}, or start a new ${cleanTitle}?`;
      await interrupt();
      await repeat(spoken);
      lastAvatarResponseRef.current = spoken;
      lastAvatarResponseTimeRef.current = Date.now();
      return true;
    },
    [assistantLists, interrupt, repeat],
  );

  const setListDisplayStyle = useCallback(
    (listId: string, style: ListDisplayStyle) => {
      const list = assistantLists.find((item) => item.id === listId);
      const nextList = list
        ? { ...list, displayStyle: style, updatedAt: Date.now() }
        : null;
      setAssistantLists((currentLists) =>
        currentLists.map((list) =>
          list.id === listId
            ? (nextList ?? { ...list, displayStyle: style, updatedAt: Date.now() })
            : list,
        ),
      );
      if (nextList) {
        logAssistantListState("style", nextList, {
          activeListId: listId,
          detail: { displayStyle: style },
        });
      }
    },
    [assistantLists, logAssistantListState],
  );

  const setListAccentColor = useCallback(
    (listId: string, update: ListAccentUpdate) => {
      const list = assistantLists.find((item) => item.id === listId);
      const nextList = list
        ? {
            ...list,
            accentColor: update.accentColor,
            accentHex: update.accentHex,
            accentLabel: update.accentLabel,
            updatedAt: Date.now(),
          }
        : null;
      setAssistantLists((currentLists) =>
        currentLists.map((list) =>
          list.id === listId
            ? (nextList ?? {
                ...list,
                accentColor: update.accentColor,
                accentHex: update.accentHex,
                accentLabel: update.accentLabel,
                updatedAt: Date.now(),
              })
            : list,
        ),
      );
      if (nextList) {
        logAssistantListState("color", nextList, {
          activeListId: listId,
          detail: {
            accentColor: update.accentColor,
            accentHex: update.accentHex ?? null,
            accentLabel: update.accentLabel ?? null,
          },
        });
      }
    },
    [assistantLists, logAssistantListState],
  );

  const askForNewListColor = useCallback(
    async (
      listId: string,
      title: string,
      options: { closeEducation?: string; navEducation?: string } = {},
    ) => {
      clearListColorDemoTimers();
      void listId;
      pendingListColorChoiceRef.current = null;
      setThoughtPrompts(normalizeThoughtPrompts(ACTIVE_LIST_THOUGHT_PROMPTS));
      void options;
      const spoken = `What would you like for me to put on your ${listTitleForSpeech(title)}?`;
      suppressNativeListUiSpeechUntilRef.current = Math.max(
        suppressNativeListUiSpeechUntilRef.current,
        Date.now() + 18000,
      );
      await interrupt();
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 180);
      });
      await interrupt();
      permitNextAppSpeech(spoken, 18000);
      await repeat(spoken);
      lastAvatarResponseRef.current = spoken;
      lastAvatarResponseTimeRef.current = Date.now();
    },
    [clearListColorDemoTimers, interrupt, permitNextAppSpeech, repeat],
  );

  const handlePendingListColorChoice = useCallback(
    async (text: string) => {
      void text;
      pendingListColorChoiceRef.current = null;
      clearListColorDemoTimers();
      return false;
    },
    [clearListColorDemoTimers],
  );

  const moveActiveList = useCallback(
    (direction: 1 | -1) => {
      if (assistantLists.length === 0) return null;
      if (!activeListId) {
        if (direction < 0) return null;
        const firstList = assistantLists[0];
        if (!firstList) return null;
        activeListIdRef.current = firstList.id;
        activeListRef.current = firstList;
        setActiveListId(firstList.id);
        logAssistantListState("open", firstList, {
          activeListId: firstList.id,
          detail: { direction, fromHome: true },
        });
        return firstList;
      }

      const currentIndex = assistantLists.findIndex(
        (list) => list.id === activeListId,
      );
      if (currentIndex < 0) return null;
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0) {
        const currentList = assistantLists[currentIndex];
        if (currentList) {
          logAssistantListState("close", currentList, {
            activeListId: null,
            visible: false,
            detail: { direction, toHome: true },
          });
        }
        activeListIdRef.current = null;
        activeListRef.current = null;
        setActiveListId(null);
        setIsShoppingMode(false);
        return null;
      }
      if (nextIndex >= assistantLists.length) {
        const currentList = assistantLists[currentIndex];
        setListSwipeNudge("left");
        window.setTimeout(() => setListSwipeNudge(null), 180);
        return currentList ?? null;
      }
      const nextList = assistantLists[nextIndex];
      activeListIdRef.current = nextList.id;
      activeListRef.current = nextList;
      setActiveListId(nextList.id);
      logAssistantListState("open", nextList, {
        activeListId: nextList.id,
        detail: { direction },
      });
      return nextList;
    },
    [activeListId, assistantLists, logAssistantListState],
  );

  const handleStickyNoteTouchStart = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      const touch = event.touches[0];
      if (!touch) return;
      listSwipeStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        at: Date.now(),
      };
    },
    [],
  );

  const handleStickyNoteTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      const startPoint = listSwipeStartRef.current;
      listSwipeStartRef.current = null;
      const touch = event.changedTouches[0];
      if (!startPoint || !touch) return;
      const deltaX = touch.clientX - startPoint.x;
      const deltaY = touch.clientY - startPoint.y;
      if (Math.abs(deltaX) < 52 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) {
        return;
      }
      event.preventDefault();
      moveActiveList(deltaX < 0 ? 1 : -1);
    },
    [moveActiveList],
  );

  const startAccountSetup = useCallback(
    async (email: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      setAccountNotice("Sending Account Link");
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
          data?.emailSent
            ? "Account Link Sent"
            : verificationUrl
              ? "Account Link Ready for This Test"
              : "Account Email Needs Setup",
        );
        setAccountVerificationUrl(verificationUrl);
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        rememberConversationLine("assistant", spoken);
        lastAvatarResponseTimeRef.current = Date.now();
        accountSetupOfferMadeRef.current = false;
        accountSetupDeclinedAtRef.current = 0;
        accountSetupEmailMissCountRef.current = 0;
        setEmailEntryOpen(false);
        setTypedAccountEmail("");
        return true;
      } catch (error) {
        console.error("Account setup failed:", error);
        const spoken =
          "I had trouble setting up that email link. I made a note for G to fix account setup.";
        setAccountNotice("Account setup needs attention");
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        rememberConversationLine("assistant", spoken);
        lastAvatarResponseTimeRef.current = Date.now();
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

  const openEmailEntry = useCallback(
    async (spoken?: string) => {
      setEmailEntryOpen(true);
      const message =
        spoken ||
        "I opened the email box so you can type it. I will still read it back before I send anything.";
      await repeat(message);
      lastAvatarResponseRef.current = message;
      lastAvatarResponseTimeRef.current = Date.now();
      return true;
    },
    [repeat],
  );

  const handleEmailMiss = useCallback(
    async (spokenBeforeTypedFallback?: string) => {
      accountSetupEmailMissCountRef.current += 1;
      if (accountSetupEmailMissCountRef.current >= 2) {
        return openEmailEntry(
          spokenBeforeTypedFallback ||
            "I'm still not catching it cleanly. Why don't you go ahead and type your email address in here?",
        );
      }
      const spoken =
        "I did not catch a complete email address yet. No rush. Say it slowly, with the at and the dot, and I'll read it back before I send anything.";
      await repeat(spoken);
      lastAvatarResponseRef.current = spoken;
      lastAvatarResponseTimeRef.current = Date.now();
      return true;
    },
    [openEmailEntry, repeat],
  );

  const confirmAccountEmailCandidate = useCallback(
    async (email: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!isValidEmailCandidate(normalizedEmail)) {
        return openEmailEntry(
          "That does not look like a complete email address yet. Type it like name at domain dot com, or say it slowly.",
        );
      }
      accountSetupPendingEmailRef.current = normalizedEmail;
      accountSetupRejectedEmailRef.current = null;
      accountSetupAwaitingEmailRef.current = false;
      accountSetupAwaitingReadyRef.current = false;
      accountSetupEmailMissCountRef.current = 0;
      setEmailEntryOpen(false);
      setTypedAccountEmail(normalizedEmail);
      const spoken = `I heard ${speakEmailAddress(normalizedEmail)}. Does that sound correct, or did I get it wrong? I will not send the email until you say yes.`;
      await repeat(spoken);
      lastAvatarResponseRef.current = spoken;
      lastAvatarResponseTimeRef.current = Date.now();
      return true;
    },
    [openEmailEntry, repeat],
  );

  const handleTypedAccountEmailSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const candidate = extractAccountEmailCandidate(typedAccountEmail, null);
      await confirmAccountEmailCandidate(candidate ?? typedAccountEmail);
    },
    [confirmAccountEmailCandidate, typedAccountEmail],
  );

  const clearAccountEmailEntry = useCallback(() => {
    accountSetupAwaitingEmailRef.current = false;
    accountSetupPendingEmailRef.current = null;
    accountSetupRejectedEmailRef.current = null;
    accountSetupEmailMissCountRef.current = 0;
    setEmailEntryOpen(false);
    setTypedAccountEmail("");
  }, []);

  const offerAccountSetupForMemory = useCallback(async (customSpoken?: string) => {
    void customSpoken;
    return false;
  }, []);

  const handleAccountSetupSpeech = useCallback(
    async (userText: string) => {
      if (ACCOUNT_BETA_DISABLED) {
        if (!ACCOUNT_SETUP_TRIGGER_RE.test(userText)) return false;
        clearAccountEmailEntry();
        const spoken =
          "For this beta, every new session starts blank. I can help with this session right now.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        return true;
      }

      const contact = extractContactDetails(userText);
      const correctedEmail = mergeEmailDomainCorrection(
        userText,
        accountSetupPendingEmailRef.current ?? accountSetupRejectedEmailRef.current,
      );
      const directEmail =
        extractAccountEmailCandidate(userText, contact.email) ?? correctedEmail;

      if (
        EMAIL_ENTRY_REQUEST_RE.test(userText) &&
        (accountSetupAwaitingEmailRef.current ||
          accountSetupAwaitingReadyRef.current ||
          accountSetupPendingEmailRef.current ||
          ACCOUNT_SETUP_TRIGGER_RE.test(userText))
      ) {
        accountSetupAwaitingReadyRef.current = false;
        accountSetupAwaitingEmailRef.current = true;
        return openEmailEntry(
          "Yes. I opened the email box so you can type it. I will read it back before I send anything.",
        );
      }

      if (accountSetupPendingEmailRef.current) {
        if (
          directEmail &&
          directEmail !== accountSetupPendingEmailRef.current
        ) {
          return confirmAccountEmailCandidate(directEmail);
        }
        if (ACCOUNT_READY_YES_RE.test(userText)) {
          const emailToSend = accountSetupPendingEmailRef.current;
          accountSetupPendingEmailRef.current = null;
          accountSetupAwaitingEmailRef.current = false;
          accountSetupAwaitingReadyRef.current = false;
          accountSetupRejectedEmailRef.current = null;
          return await startAccountSetup(emailToSend);
        }
        if (ACCOUNT_READY_NO_RE.test(userText)) {
          accountSetupRejectedEmailRef.current =
            accountSetupPendingEmailRef.current;
          accountSetupPendingEmailRef.current = null;
          accountSetupAwaitingEmailRef.current = true;
          accountSetupAwaitingReadyRef.current = false;
          return handleEmailMiss(
            "Okay, I will not send it. I'm still not catching it cleanly. Why don't you go ahead and type your email address in here?",
          );
        }
        const spoken =
          "Before I send the account email, I need a yes or no. Is that email address correct?";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        return true;
      }

      if (accountSetupAwaitingEmailRef.current && directEmail) {
        return confirmAccountEmailCandidate(directEmail);
      }

      if (accountSetupAwaitingEmailRef.current) {
        return handleEmailMiss();
      }

      if (accountSetupAwaitingReadyRef.current) {
        if (ACCOUNT_READY_NO_RE.test(userText)) {
          accountSetupAwaitingReadyRef.current = false;
          accountSetupAwaitingEmailRef.current = false;
          accountSetupPendingEmailRef.current = null;
          accountSetupRejectedEmailRef.current = null;
          accountSetupDeclinedAtRef.current = Date.now();
          accountSetupOfferMadeRef.current = false;
          accountSetupEmailMissCountRef.current = 0;
          setEmailEntryOpen(false);
          const spoken =
            "No problem. We can keep using this session. When you want me to remember next time, we'll set it up.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          return true;
        }
        if (ACCOUNT_READY_YES_RE.test(userText)) {
          accountSetupAwaitingReadyRef.current = false;
          accountSetupAwaitingEmailRef.current = true;
          accountSetupPendingEmailRef.current = null;
          accountSetupRejectedEmailRef.current = null;
          accountSetupEmailMissCountRef.current = 0;
          setEmailEntryOpen(false);
          setTypedAccountEmail("");
          const spoken =
            "Great. What email address should I send the link to? Say it slowly, with the at and the dot, and I'll read it back before I send anything.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          return true;
        }
      }

      if (ACCOUNT_SETUP_TRIGGER_RE.test(userText)) {
        if (directEmail) {
          return confirmAccountEmailCandidate(directEmail);
        }
        accountSetupAwaitingReadyRef.current = true;
        accountSetupAwaitingEmailRef.current = false;
        accountSetupPendingEmailRef.current = null;
        accountSetupRejectedEmailRef.current = null;
        accountSetupEmailMissCountRef.current = 0;
        const spoken = buildAccountMemoryOffer(
          "You can use the site right now. Account setup is optional, but it lets me remember you next time.",
          deviceProfileRef.current.greetingCount + 1,
        );
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        rememberConversationLine("assistant", spoken);
        lastAvatarResponseTimeRef.current = Date.now();
        return true;
      }

      return false;
    },
    [
      clearAccountEmailEntry,
      confirmAccountEmailCandidate,
      handleEmailMiss,
      openEmailEntry,
      rememberConversationLine,
      repeat,
      startAccountSetup,
    ],
  );

  const handlePromptSizeSpeech = useCallback(
    async (userText: string) => {
      if (!PROMPT_SIZE_REQUEST_RE.test(userText)) return false;
      let reachedMax = false;
      setPromptSizeLevel((current) => {
        if (current >= MAX_PROMPT_SIZE_LEVEL) {
          reachedMax = true;
          return current;
        }
        return current + 1;
      });
      const spoken = reachedMax
        ? "That's as big as I can make the prompts without crowding my face or the Terms line."
        : "I made the prompts a little bigger. Is that enough?";
      await repeat(spoken);
      lastAvatarResponseRef.current = spoken;
      lastAvatarResponseTimeRef.current = Date.now();
      return true;
    },
    [repeat],
  );

  useEffect(() => {
    if (sessionState === SessionState.DISCONNECTED) {
      if (sessionStartErrorRef.current) {
        setSessionStartError(sessionStartErrorRef.current);
        sessionStartErrorRef.current = null;
        greetingTriggeredRef.current = false;
        return;
      }
      if (explicitEndSessionRef.current) {
        explicitEndSessionRef.current = false;
        onExit?.(false);
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
      flushUserTranscriptLogQueue(true);
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
    const activeSessionId = getLiveAvatarSessionId(sessionRef.current);
    if (sessionState === SessionState.CONNECTED && activeSessionId) {
      const sid = activeSessionId;
      if (lastSyncedLaSessionIdRef.current !== sid) {
        transcriptCursorRef.current = null;
        lastSyncedLaSessionIdRef.current = sid;
      }
      dbSessionIdRef.current = sid;
    }
  }, [flushUserTranscriptLogQueue, sessionState, sessionRef]);

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

  // Function to reset to home screen while keeping saved sticky notes available.
  const resetToHomeScreen = useCallback(() => {
    setActiveListId(null);
    setIsShoppingMode(false);
    pendingListColorChoiceRef.current = null;
    pendingGenericListNamingRef.current = null;
    clearListColorDemoTimers();
    setOnlineLookupNotice(null);
    setOnlineLookupSources([]);
    setOnlineLookupResultLines([]);
    setSourcePreview(null);
    setEmailEntryOpen(false);
  }, [clearListColorDemoTimers]);

  const handleStopSession = useCallback(() => {
    greetingTriggeredRef.current = false;
    stopSession();
  }, [stopSession]);

  const handleEndSession = useCallback(async () => {
    explicitEndSessionRef.current = true;
    endSessionConfirmationPendingRef.current = false;
    greetingTriggeredRef.current = false;
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
    try {
      await stopSession();
    } catch {
      // Parent exit still prevents auto-restart if LiveAvatar is already disconnected.
    } finally {
      onExit?.(false);
    }
  }, [interrupt, onExit, resetToHomeScreen, stop, stopListening, stopSession]);

  // Voice chat starts only after the user taps the begin surface.
  useEffect(() => {
    if (sessionState === SessionState.DISCONNECTED) {
      voiceHeldUntilUserStartRef.current = false;
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
      const now = Date.now();
      if (now < suppressNativeListUiSpeechUntilRef.current) {
        if (allowedAppSpeechStartsRef.current > 0) {
          allowedAppSpeechStartsRef.current -= 1;
          return;
        }
        cancelQueuedGeneralAvatarResponse();
        void interrupt();
        return;
      }
      const appSideSpeechAllowed = now < appSideSpeechAllowedUntilRef.current;
      if (now < siteFeedbackQuietUntilRef.current) {
        if (allowedAppSpeechStartsRef.current > 0) {
          allowedAppSpeechStartsRef.current -= 1;
          return;
        }
        cancelQueuedGeneralAvatarResponse();
        void interrupt();
        return;
      }
      if (
        voiceActivityRef.current.user
      ) {
        cancelQueuedGeneralAvatarResponse();
        if (
          activeListIdRef.current &&
          !appSideSpeechAllowed
        ) {
          void interrupt();
          return;
        }
      }
      if (!audioUnlockedRef.current || explicitEndSessionRef.current) {
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
  }, [sessionRef, interrupt, cancelQueuedGeneralAvatarResponse]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) {
      return;
    }
    const onAvatarSpeakEnded = () => {
      if (!pendingNamePromptAfterAvatarRef.current) return;
      window.setTimeout(() => {
        void speakPendingNamePrompt();
      }, 350);
    };
    session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, onAvatarSpeakEnded);
    return () => {
      if (typeof (session as any).off === "function") {
        (session as any).off(AgentEventsEnum.AVATAR_SPEAK_ENDED, onAvatarSpeakEnded);
      } else if (typeof session.removeListener === "function") {
        session.removeListener(AgentEventsEnum.AVATAR_SPEAK_ENDED, onAvatarSpeakEnded);
      }
      clearNamePromptFallbackTimer();
    };
  }, [clearNamePromptFallbackTimer, sessionRef, speakPendingNamePrompt]);

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

  /** Idempotent audio unlock after user gesture. */
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
      onlineLookupLastQueryRef.current = query;
      onlineLookupLastLocationRef.current = lookupLocation;
      setIsOnlineLookupLoading(true);
      setSourcePreview(null);
      setOnlineLookupNotice(
        onlineLookupResultLines.length > 0
          ? `Adding more ${topic}`
          : `Looking online for ${topic}`,
      );
      try {
        stopListening();
      } catch {
        // The listener may already be paused.
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
        const sources = Array.isArray(data?.sources)
          ? data.sources.filter(
              (source: unknown): source is OnlineLookupSource =>
                Boolean(source) &&
                typeof source === "object" &&
                typeof (source as OnlineLookupSource).title === "string" &&
                typeof (source as OnlineLookupSource).url === "string" &&
                /^https?:\/\//i.test((source as OnlineLookupSource).url),
            )
          : [];
        const isWeather = /\b(?:weather|forecast)\b/i.test(query);
        setOnlineLookupSources(isWeather ? [] : sources);
        setOnlineLookupResultLines(isWeather ? [] : resultLines);
        setOnlineLookupNotice(null);
        const spoken = formatOnlineLookupSpeech(resultLines, query);
        await interrupt();
        await repeat(spoken);
        window.setTimeout(() => startListening(), 900);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        schedulePromptBrain(query);
        return true;
      } catch (error) {
        console.error("Online lookup failed:", error);
        const spoken =
          "I had trouble looking that up online. Try telling me the city or ZIP code again.";
        setOnlineLookupNotice(null);
        setOnlineLookupResultLines([]);
        await repeat(spoken);
        window.setTimeout(() => startListening(), 900);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        return true;
      } finally {
        setIsOnlineLookupLoading(false);
      }
    },
    [interrupt, isOnlineLookupLoading, repeat, schedulePromptBrain, startListening, stopListening],
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
    setOnlineLookupNotice(getLookupLocationNotice(lookupQuery));
    setThoughtPrompts(getLookupLocationPrompts(lookupQuery));
    const spoken =
      "Tell me your five-digit ZIP code, and I'll look around there.";
    await interrupt();
    await repeat(spoken);
    lastAvatarResponseRef.current = spoken;
    rememberConversationLine("assistant", spoken);
    lastAvatarResponseTimeRef.current = Date.now();
  }, [interrupt, rememberConversationLine, repeat]);

  const handleOnlineLookupSpeech = useCallback(
    async (userText: string) => {
      const text = userText.trim();
      const pendingQuery = onlineLookupPendingQueryRef.current;
      if (
        lookupPanelVisible &&
        ONLINE_LOOKUP_MORE_RE.test(text) &&
        onlineLookupLastQueryRef.current &&
        onlineLookupLastLocationRef.current
      ) {
        return performOnlineLookup(
          onlineLookupLastQueryRef.current,
          onlineLookupLastLocationRef.current,
        );
      }
      if (lookupPanelVisible && ONLINE_LOOKUP_COMMENTARY_RE.test(text)) {
        return false;
      }
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
          await interrupt();
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
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
            await interrupt();
            await repeat(spoken);
            lastAvatarResponseRef.current = spoken;
            lastAvatarResponseTimeRef.current = Date.now();
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
          extractLocationHint(text) ??
          getImplicitLookupLocation(text) ??
          (isLikelyTypedLocation(text) ? text : null);
        if (!location) return false;
        onlineLookupLocationRef.current = normalizeLookupLocation(location);
        if (shouldAskPreferencesBeforeLookup(pendingQuery)) {
          const spoken = getLookupPreferenceQuestion(pendingQuery);
          setOnlineLookupNotice(" ");
          setOnlineLookupResultLines([]);
          setThoughtPrompts(getLookupPreferencePrompts(pendingQuery));
          await interrupt();
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          return true;
        }
        onlineLookupPendingQueryRef.current = null;
        return performOnlineLookup(pendingQuery, location);
      }

      if (!isOnlineLookupIntent(text)) return false;

      const location = extractLocationHint(text) ?? getImplicitLookupLocation(text);
      if (location) {
        onlineLookupLocationRef.current = normalizeLookupLocation(location);
        if (shouldAskPreferencesBeforeLookup(text)) {
          onlineLookupPendingQueryRef.current = text;
          const spoken = getLookupPreferenceQuestion(text);
          setOnlineLookupNotice(" ");
          setOnlineLookupResultLines([]);
          setThoughtPrompts(getLookupPreferencePrompts(text));
          await interrupt();
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
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
          await interrupt();
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          return true;
        }
        return performOnlineLookup(text, onlineLookupLocationRef.current);
      }

      onlineLookupPendingQueryRef.current = text;
      onlineLookupLocationRef.current = null;
      setOnlineLookupSources([]);
      setOnlineLookupResultLines([]);
      setOnlineLookupNotice(getLookupLocationNotice(text));
      const spoken =
        "I can look that up online. Tell me your five-digit ZIP code or city.";
      await interrupt();
      await repeat(spoken);
      lastAvatarResponseRef.current = spoken;
      lastAvatarResponseTimeRef.current = Date.now();
      setThoughtPrompts(
        getLookupLocationPrompts(text),
      );
      return true;
    },
    [
      interrupt,
      lookupPanelVisible,
      onlineLookupNotice,
      performOnlineLookup,
      repeat,
      requestSharedLocation,
    ],
  );

  const requestOnlineLookupConfirmation = useCallback(
    async (query: string) => {
      const topic = summarizeOnlineLookupTopic(query);
      pendingOnlineLookupConfirmationRef.current = {
        query,
        requestedAt: Date.now(),
      };
      onlineLookupPendingQueryRef.current = null;
      setOnlineLookupNotice(null);
      setOnlineLookupSources([]);
      setOnlineLookupResultLines([]);
      setSourcePreview(null);
      const spoken =
        topic === "this weekend"
          ? "Want me to do a search for weekend ideas?"
          : `Want me to do a search for ${topic}?`;
      await interrupt();
      await repeat(spoken);
      lastAvatarResponseRef.current = spoken;
      rememberConversationLine("assistant", spoken);
      lastAvatarResponseTimeRef.current = Date.now();
      setThoughtPrompts(
        normalizeThoughtPrompts([
          "Yes, Search",
          "Not Now",
          "To Do List",
          "Explore aiASAP",
        ]),
      );
      return true;
    },
    [interrupt, rememberConversationLine, repeat],
  );

  const openLifeGoalsStickyNote = useCallback(
    async (sourceText: string) => {
      const ensuredListId = ensureAssistantList({
        title: "Goals",
        kind: "custom",
      });
      if (!ensuredListId) {
        await repeat(
          "You have 10 lists open. Tell me which one to change out.",
        );
        return true;
      }

      await ensureAudioOutputReady();
      await interrupt();
      const spoken =
        "I opened Goals. Tell me the first goal you want to work on, and we'll break it into steps.";
      await repeat(spoken);
      lastAvatarResponseRef.current = spoken;
      rememberConversationLine("assistant", spoken);
      lastAvatarResponseTimeRef.current = Date.now();
      setThoughtPrompts(normalizeThoughtPrompts(ACTIVE_LIST_THOUGHT_PROMPTS));
      schedulePromptBrain(sourceText);
      return true;
    },
    [
      ensureAssistantList,
      ensureAudioOutputReady,
      interrupt,
      rememberConversationLine,
      repeat,
      schedulePromptBrain,
    ],
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

      const promptContextualListIntent = contextualListIntentForText(prompt);
      if (promptContextualListIntent) {
        lastListTopicIntentRef.current = promptContextualListIntent;
      }
      if (promptContextualListIntent?.title === "Goals") {
        await openLifeGoalsStickyNote(prompt);
        return;
      }

      const pendingListStart = pendingListStartConfirmationRef.current;
      if (/^yes,?\s+start it$/i.test(prompt) && pendingListStart) {
        pendingListStartConfirmationRef.current = null;
        const ensuredListId = ensureAssistantList(pendingListStart.intent, {
          preferFresh: pendingListStart.preferFresh,
        });
        if (!ensuredListId) {
          await repeat(
            "You have 10 lists open. Tell me which one to change out.",
          );
          return;
        }
        await interrupt();
        const ensured = lastEnsuredListRef.current;
        const listCount = assistantLists.some((list) => list.id === ensuredListId)
          ? assistantLists.length
          : assistantLists.length + 1;
        const navEducation = takeListMultiNavEducation(listCount);
        if (ensured?.wasNew) {
          listCloseEducationSpokenRef.current = true;
          await askForNewListColor(ensuredListId, ensured.title, {
            closeEducation: ` ${LIST_CLOSE_EDUCATION}`,
            navEducation,
          });
          return;
        }
        const spoken = `I ${ensured?.wasNew ? "started" : "opened"} the ${ensured?.title ?? pendingListStart.intent.title}. Tell me the first item.${navEducation}`;
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        setThoughtPrompts(normalizeThoughtPrompts(ACTIVE_LIST_THOUGHT_PROMPTS));
        return;
      }
      if (/^not\s+now$/i.test(prompt) && pendingListStart) {
        pendingListStartConfirmationRef.current = null;
        await interrupt();
        const spoken = "Okay, I will not start it.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        setThoughtPrompts(normalizeThoughtPrompts(DEFAULT_THOUGHT_PROMPTS));
        return;
      }

      const pendingListRename = pendingListRenameConfirmationRef.current;
      if (/^yes,?\s+rename it$/i.test(prompt) && pendingListRename) {
        pendingListRenameConfirmationRef.current = null;
        const renamed = renameAssistantList(
          pendingListRename.listId,
          pendingListRename.title,
        );
        await interrupt();
        const spoken = renamed ? "Done." : "That name is already set.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        setThoughtPrompts(normalizeThoughtPrompts(ACTIVE_LIST_THOUGHT_PROMPTS));
        return;
      }
      if (/^no,?\s+keep it$/i.test(prompt) && pendingListRename) {
        pendingListRenameConfirmationRef.current = null;
        await interrupt();
        const spoken = "Okay, I kept the name.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        setThoughtPrompts(normalizeThoughtPrompts(ACTIVE_LIST_THOUGHT_PROMPTS));
        return;
      }

      if (await handlePendingListColorChoice(prompt)) {
        return;
      }

      const pendingLookupStart = pendingOnlineLookupConfirmationRef.current;
      if (/^yes,?\s+(?:start it|search|do search|do it)$/i.test(prompt) && pendingLookupStart) {
        pendingOnlineLookupConfirmationRef.current = null;
        await ensureAudioOutputReady();
        const handledLookup = await handleOnlineLookupSpeech(pendingLookupStart.query);
        if (handledLookup) return;
      }
      if (/^not\s+now$/i.test(prompt) && pendingLookupStart) {
        pendingOnlineLookupConfirmationRef.current = null;
        await interrupt();
        const spoken = "Okay, I will not pull anything up.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        setThoughtPrompts(normalizeThoughtPrompts(DEFAULT_THOUGHT_PROMPTS));
        return;
      }

      if (/^add item$/i.test(prompt) && activeList) {
        await interrupt();
        const spoken = `Tell me the item to add to the ${activeList.title}.`;
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        return;
      }

      if (/^remove item$/i.test(prompt) && activeList) {
        pendingListItemRemovalRef.current = {
          listId: activeList.id,
          requestedAt: Date.now(),
        };
        await interrupt();
        const spoken = `Tell me what to take off the ${activeList.title}.`;
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        return;
      }

      if (/^store mode$/i.test(prompt) && activeList) {
        setIsShoppingMode(true);
        logAssistantListState("view", activeList, {
          activeListId: activeList.id,
          isShoppingMode: true,
          detail: { shoppingMode: true, source: "prompt" },
        });
        await interrupt();
        const spoken =
          "Store mode is on. Tell me what to remove, or ask me to close the list.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        return;
      }

      const pendingGenericListNaming = pendingGenericListNamingRef.current;
      if (pendingGenericListNaming) {
        const promptIntent = detectListIntent(prompt);
        const cleanedTitle = promptIntent
          ? null
          : cleanRequestedListTitle(prompt, { appendList: true });
        const namedIntent =
          promptIntent && promptIntent.title !== "New List"
            ? promptIntent
            : cleanedTitle
              ? {
                  title: cleanedTitle,
                  kind: listKindForTitle(cleanedTitle, "custom" as const),
                }
              : null;
        if (namedIntent) {
          pendingGenericListNamingRef.current = null;
          if (pendingGenericListNaming.listId) {
            const renamed = renameAssistantList(
              pendingGenericListNaming.listId,
              namedIntent.title,
            );
            if (renamed) {
              await interrupt();
              const spoken = "What would you like for me to put on it?";
              await repeat(spoken);
              lastAvatarResponseRef.current = spoken;
              lastAvatarResponseTimeRef.current = Date.now();
              setThoughtPrompts(normalizeThoughtPrompts(ACTIVE_LIST_THOUGHT_PROMPTS));
              return;
            }
          }
        }
      }

      const listIntent = detectListIntent(prompt);
      if (listIntent) {
        pendingListStartConfirmationRef.current = {
          intent: listIntent,
          preferFresh: shouldStartFreshList(prompt),
          requestedAt: Date.now(),
        };
        await ensureAudioOutputReady();
        await interrupt();
        const spoken = getListStartConfirmationPrompt(listIntent);
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        setThoughtPrompts(
          normalizeThoughtPrompts([
            "Yes, Start It",
            "Not Now",
            "Make More Money",
            "Plan Your Weekend",
          ]),
        );
        return;
      }
      if (shouldConfirmOnlineLookupStart(prompt)) {
        await ensureAudioOutputReady();
        await requestOnlineLookupConfirmation(prompt);
        return;
      }
      const directStarter = directStarterForThoughtPrompt(prompt);
      if (directStarter) {
        await ensureAudioOutputReady();
        await interrupt();
        setThoughtPrompts(normalizeThoughtPrompts(directStarter.prompts));
        await repeat(directStarter.spoken);
        lastAvatarResponseRef.current = directStarter.spoken;
        rememberConversationLine("assistant", directStarter.spoken);
        lastAvatarResponseTimeRef.current = Date.now();
        schedulePromptBrain(prompt);
        return;
      }
      setDissolvingPrompt(prompt);

      setTimeout(() => {
        setThoughtPrompts((currentPrompts) => {
          const nextPrompts = currentPrompts.filter((item) => item !== prompt);
          const refillPrompts = getThoughtPrompts(prompt).filter(
            (item) => item !== prompt && !nextPrompts.includes(item),
          );
          return normalizeThoughtPrompts([...nextPrompts, ...refillPrompts]);
        });
        setDissolvingPrompt(null);
      }, 620);

      try {
        await ensureAudioOutputReady();
        await interrupt();
        if (LIST_CLOSE_RE.test(prompt)) {
      setIsShoppingMode(false);
        activeListIdRef.current = null;
        activeListRef.current = null;
      setActiveListId(null);
          latestListMutationRef.current = null;
          pendingListColorChoiceRef.current = null;
          clearListColorDemoTimers();
          setListFocusNonce((value) => value + 1);
          const spoken = "I closed the list.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          return;
        }
        if (prompt === "Explore aiASAP" || prompt === "Quick Tour") {
          const spoken =
            prompt === "Quick Tour"
              ? "a-i-ASAP is the easy way into AI. You talk to me, and I help with lists, weekend plans, practical ideas, and eventually building bigger things. What should we try first?"
              : "a-i-ASAP is built so you can just talk to me and I help you get things done. Lists, weekend plans, practical ideas, and bigger things later. Want the quick tour, or want to start with something useful?";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          setThoughtPrompts(
            normalizeThoughtPrompts([
              "Quick Tour",
              "Shopping List",
              "To Do List",
              "Make More Money",
            ]),
          );
          return;
        }
        if (/^close\s+(?:search|box|location)$/i.test(prompt)) {
          onlineLookupPendingQueryRef.current = null;
          pendingOnlineLookupConfirmationRef.current = null;
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
          lastAvatarResponseTimeRef.current = Date.now();
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
      activeList,
      assistantLists,
      askForNewListColor,
      buildMemoryAugmentedMessage,
      clearListColorDemoTimers,
      ensureAudioOutputReady,
      ensureAssistantList,
      handlePendingListColorChoice,
      logAssistantListState,
      interrupt,
      handleOnlineLookupSpeech,
      isStreamReady,
      openLifeGoalsStickyNote,
      rememberConversationLine,
      renameAssistantList,
      repeat,
      requestOnlineLookupConfirmation,
      requestSharedLocation,
      schedulePromptBrain,
      sendMessage,
      sessionState,
      takeListMultiNavEducation,
    ],
  );

  const resumeListeningAfterAvatarSpeech = useCallback(
    (fallbackMs: number) => {
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
    [sessionRef, startListening],
  );

  const resetAnonymousSessionState = useCallback(() => {
    clearBetaFreshSessionStorage();
    accountMemorySnapshotRef.current = null;
    accountMemoryContextInjectedRef.current = false;
    accountPendingStateTokenRef.current = null;
    recentConversationRef.current = [];
    recentActionsRef.current = [];
    recentRemovedItemsRef.current = [];
    lastUserTextRef.current = "";
    lastAvatarResponseRef.current = "";
    lastListTopicIntentRef.current = null;
    nameRelationshipTurnCountRef.current = 0;
    namePromptAskedRef.current = false;
    namePromptRetryAskedRef.current = false;
    namePromptAskedAtTurnRef.current = null;
    nextNameUseTurnRef.current = nextNameUseTurn(0);
    pendingNamePromptAfterAvatarRef.current = null;
    clearNamePromptFallbackTimer();
    listMultiNavEducationSpokenRef.current = false;
    onlineLookupPendingQueryRef.current = null;
    pendingOnlineLookupConfirmationRef.current = null;
    onlineLookupLocationRef.current = null;
    onlineLookupLastQueryRef.current = null;
    onlineLookupLastLocationRef.current = null;
    latestListMutationRef.current = null;
    pendingListDeleteRef.current = null;
    pendingListItemRemovalRef.current = null;
    pendingListItemFragmentRef.current = null;
    pendingListStartConfirmationRef.current = null;
    pendingListRenameConfirmationRef.current = null;
    pendingListCustomizationPromptRef.current = null;
    pendingListColorChoiceRef.current = null;
    clearListColorDemoTimers();
    endSessionConfirmationPendingRef.current = false;
    endSessionConfirmationAskedAtRef.current = 0;
    postVerifyGreetingSpokenRef.current = false;
    accountSetupAwaitingReadyRef.current = false;
    accountSetupAwaitingEmailRef.current = false;
    accountSetupPendingEmailRef.current = null;
    accountSetupRejectedEmailRef.current = null;
    accountSetupEmailMissCountRef.current = 0;

    try {
      window.localStorage.removeItem(ACCOUNT_PENDING_STATE_TOKEN_STORAGE_KEY);
    } catch {
      // Best effort only. In-memory state is still reset below.
    }

    const freshProfile = emptyDeviceProfile();
    deviceProfileRef.current = freshProfile;
    setAssistantLists([]);
    setActiveListId(null);
    setIsShoppingMode(false);
    setPostVerifyGreeting(null);
    setAccountNotice(null);
    setAccountVerificationUrl(null);
    setEmailEntryOpen(false);
    setTypedAccountEmail("");
    setDeviceProfile(freshProfile);
    setOnlineLookupNotice(null);
    setOnlineLookupSources([]);
    setOnlineLookupResultLines([]);
    setSourcePreview(null);
    setIsOnlineLookupLoading(false);
    setThoughtPrompts(normalizeThoughtPrompts(DEFAULT_THOUGHT_PROMPTS));
    setDissolvingPrompt(null);
  }, [clearNamePromptFallbackTimer]);

  const handleVoiceStartStop = useCallback(async () => {
    if (voiceIsActive) {
      void interrupt();
      stop();
      stopListening();
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
    resetAnonymousSessionState();
    setVoiceStartAwaitingReady(true);
    try {
      const ok = await ensureAudioOutputReady();
      if (!ok) {
        return;
      }
      await start();
      stopListening();
      const greeting = VOICE_START_GREETING;
      resumeListeningAfterAvatarSpeech(9000);
      await repeat(greeting);
      lastAvatarResponseRef.current = greeting;
      rememberConversationLine("assistant", greeting);
      lastAvatarResponseTimeRef.current = Date.now();
      setHasUserPressedVoiceStart(true);
    } finally {
      setVoiceStartAwaitingReady(false);
    }
  }, [
    voiceIsActive,
    interrupt,
    repeat,
    stop,
    start,
    startListening,
    stopListening,
    resumeListeningAfterAvatarSpeech,
    sessionState,
    isStreamReady,
    ensureAudioOutputReady,
    accountAuthChecked,
    rememberConversationLine,
    resetAnonymousSessionState,
  ]);

  const shouldShowBeginSurface =
    !voiceIsActive &&
    !isAvatarTalking &&
    sessionState === SessionState.CONNECTED &&
    isStreamReady &&
    accountAuthChecked &&
    !voiceStartAwaitingReady;

  const shouldShowLoadingSurface =
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

  // Listen to user transcriptions and handle voice-first MVP commands
  useEffect(() => {
    if (!sessionRef.current) {
      return;
    }

    const handleUserTranscription = async (event: { text: string }) => {
      const userText = stripPrivateGuidance(event.text.trim());
      if (isInternalSignal(userText)) {
        return;
      }
      queueConversationLogEntry("user", userText, "user_transcription_event");
      cancelQueuedGeneralAvatarResponse();
      lastUserTextRef.current = userText;
      rememberConversationLine("user", userText);
      const contextualListIntent = contextualListIntentForText(userText);
      const explicitListActionCommand = isExplicitListActionCommand(userText);
      const feedbackOnly =
        !explicitListActionCommand &&
        (isProtectedProductFeedback(userText) ||
          isAppFeedbackOnly(userText) ||
          SILENCE_OR_CUTOFF_FEEDBACK_RE.test(userText) ||
          isListObservationOnly(userText));
      const productFeedback = classifyProductFeedback(userText);
      if (productFeedback) {
        logProductFeedback(userText, productFeedback);
      }
      const codexDirectedAppTask = CODEX_DIRECTED_APP_TASK_RE.test(userText);
      if (codexDirectedAppTask) {
        productReviewIntentGuardUntilRef.current = Math.max(
          productReviewIntentGuardUntilRef.current,
          Date.now() + PRODUCT_REVIEW_INTENT_GUARD_MS,
        );
        siteFeedbackQuietUntilRef.current = Date.now() + APP_FEEDBACK_QUIET_MS;
        pendingListStartConfirmationRef.current = null;
        pendingListRenameConfirmationRef.current = null;
        pendingGenericListNamingRef.current = null;
        cancelQueuedGeneralAvatarResponse();
        schedulePromptBrain(userText);
        return;
      }
      if (
        !feedbackOnly &&
        !productFeedback &&
        LIST_TRIGGER_RE.test(userText) &&
        !REMOVE_COMMAND_RE.test(userText) &&
        !LIST_CLOSE_RE.test(userText) &&
        !LIST_DELETE_RE.test(userText)
      ) {
        armNativeListUiSpeechSuppression(18000, 150);
        void interrupt();
      }
      if (feedbackOnly || productFeedback || PRODUCT_REVIEW_CONTEXT_RE.test(userText)) {
        productReviewIntentGuardUntilRef.current = Math.max(
          productReviewIntentGuardUntilRef.current,
          Date.now() + PRODUCT_REVIEW_INTENT_GUARD_MS,
        );
      }
      if (feedbackOnly || productFeedback) {
        siteFeedbackQuietUntilRef.current = Date.now() + APP_FEEDBACK_QUIET_MS;
        cancelQueuedGeneralAvatarResponse();
        armNativeListUiSpeechSuppression(14000, 0);
        void interrupt();
        pendingListStartConfirmationRef.current = null;
        pendingListRenameConfirmationRef.current = null;
      }
      const feedbackQuietActive =
        Date.now() < siteFeedbackQuietUntilRef.current ||
        Date.now() < productReviewIntentGuardUntilRef.current;
      const directListMutationLead = stripDirect6Address(userText)
        .replace(/^(?:(?:okay|ok|so|um|uh|please|just|and|also|let'?s see|lets see)[,.\s]+)+/gi, "")
        .trim();
      const directListMutationSpeech = /^\s*(?:(?:let'?s|lets)\s+)?(?:add|put|get|grab|buy|pick\s+up|remove|delete|get\s+rid\s+of|take\s*off|takeoff|take\s+out|cross\s+off|cross\s+out|check\s+off|mark\s+off|i\s+got|got|grabbed|picked\s+up|i\s+(?:need|want|have\s+to\s+get|gotta\s+get|should\s+get)|need|want)\b/i.test(
        directListMutationLead,
      );
      const liveAssistantLists = assistantListsRef.current.length
        ? assistantListsRef.current
        : assistantLists;
      const liveActiveListId = activeListIdRef.current ?? activeListId;
      const liveActiveList =
        (liveActiveListId
          ? liveAssistantLists.find((list) => list.id === liveActiveListId) ?? null
          : null) ??
        activeListRef.current ??
        activeList;
      if (
        liveActiveListId &&
        liveActiveList &&
        !feedbackOnly &&
        !productFeedback &&
        (directListMutationSpeech || TODO_ACTION_ITEM_RE.test(directListMutationLead))
      ) {
        armNativeListUiSpeechSuppression(14000, 0);
        void interrupt();
      }
      const targetedListMutationItems =
        liveActiveListId && liveActiveList
          ? extractExplicitTargetedListMutationItems(userText, {
              activeListKind: liveActiveList.kind,
            })
          : [];
      const targetedListMutationSpeech =
        targetedListMutationItems.length > 0 ||
        isExplicitTargetedListMutationSpeech(userText);
      const rawLastAssistantText = lastAvatarResponseRef.current;
      const lastAssistantText = rawLastAssistantText.toLowerCase();
      const isAnsweringNamePrompt =
        /\b(?:what should i call you|what'?s your name|your name|full name|call you)\b/i.test(
          lastAssistantText,
        ) && !LIST_TRIGGER_RE.test(userText);
      const bareActiveListItemAfterNamePrompt = Boolean(
        liveActiveListId &&
          liveActiveList &&
          isAnsweringNamePrompt &&
          isShortBareListItemSpeech(userText, liveActiveList.kind),
      );
      const bareActiveListItemsDuringQuiet =
        liveActiveListId &&
        liveActiveList &&
        !feedbackOnly &&
        !productFeedback
          ? extractListItems(userText, {
              allowBareItems: true,
              activeListKind: liveActiveList.kind,
            })
          : [];
      const bareActiveListItemDuringQuiet = bareActiveListItemsDuringQuiet.length > 0;
      if (
        !deviceProfileRef.current.name &&
        !feedbackQuietActive &&
        !feedbackOnly &&
        !productFeedback &&
        !pendingListStartConfirmationRef.current &&
        !pendingGenericListNamingRef.current &&
        !shouldSuppressNamePromptOpportunity(userText) &&
        isNamePromptOpportunityTurn(userText)
      ) {
        nameRelationshipTurnCountRef.current += 1;
        const turnCount = nameRelationshipTurnCountRef.current;
        if (
          !namePromptAskedRef.current &&
          turnCount >= NAME_PROMPT_MIN_MEANINGFUL_TURNS
        ) {
          namePromptAskedRef.current = true;
          namePromptAskedAtTurnRef.current = turnCount;
          armPendingNamePrompt(
            buildNamePromptForTurn(userText, liveActiveList?.kind),
          );
        } else if (
          namePromptAskedRef.current &&
          !namePromptRetryAskedRef.current &&
          !pendingNamePromptAfterAvatarRef.current &&
          namePromptAskedAtTurnRef.current != null &&
          turnCount - namePromptAskedAtTurnRef.current >=
            NAME_PROMPT_RETRY_AFTER_TURNS
        ) {
          namePromptRetryAskedRef.current = true;
          namePromptAskedAtTurnRef.current = turnCount;
          armPendingNamePrompt(NAME_PROMPT_RETRY_TEXT);
        }
      }
      const listFlowFeedbackSpeech = isListFlowFeedbackFragment(userText);
      const allowFeedbackListMutation =
        targetedListMutationItems.length > 0 ||
        ((directListMutationSpeech || targetedListMutationSpeech) &&
        !listFlowFeedbackSpeech &&
        !isListReviewOrLayoutSpeech(userText) &&
        !isListObservationOnly(userText) &&
        (!PRODUCT_REVIEW_CONTEXT_RE.test(userText) || targetedListMutationSpeech) &&
        !LIST_START_REHEARSAL_RE.test(userText));
      const allowListMutationDuringReviewGuard =
        !feedbackQuietActive ||
        allowFeedbackListMutation ||
        bareActiveListItemAfterNamePrompt ||
        bareActiveListItemDuringQuiet;
      const sayBackText = extractSayBackText(userText);
      if (sayBackText) {
        pendingListColorChoiceRef.current = null;
        clearListColorDemoTimers();
        cancelQueuedGeneralAvatarResponse();
        await interrupt();
        await repeat(sayBackText);
        lastAvatarResponseRef.current = sayBackText;
        lastAvatarResponseTimeRef.current = Date.now();
        schedulePromptBrain(userText);
        return;
      }
      const spokenListCorrection =
        liveActiveListId && liveActiveList
          ? extractSpokenListCorrection(userText, {
              activeListKind: liveActiveList.kind,
            })
          : null;
      if (
        liveActiveListId &&
        liveActiveList &&
        spokenListCorrection &&
        !isListReviewOrLayoutSpeech(userText) &&
        !isListObservationOnly(userText)
      ) {
        pendingListColorChoiceRef.current = null;
        clearListColorDemoTimers();
        removeItemsFromList(liveActiveListId, [spokenListCorrection.wrong]);
        const added = addItemsToList(liveActiveListId, [spokenListCorrection.wanted]);
        const spoken = added
          ? `I fixed it to ${spokenListCorrection.wanted}.`
          : `${spokenListCorrection.wanted} is already on the list.`;
        await interrupt();
        permitNextAppSpeech(spoken, 8000);
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        setThoughtPrompts(normalizeThoughtPrompts(ACTIVE_LIST_THOUGHT_PROMPTS));
        schedulePromptBrain(userText);
        return;
      }
      if (
        liveActiveListId &&
        liveActiveList &&
        feedbackQuietActive &&
        listFlowFeedbackSpeech &&
        !allowFeedbackListMutation
      ) {
        pendingListColorChoiceRef.current = null;
        cancelQueuedGeneralAvatarResponse();
        schedulePromptBrain(userText);
        return;
      }
      if (
        contextualListIntent &&
        !feedbackOnly &&
        !productFeedback &&
        !PRODUCT_REVIEW_CONTEXT_RE.test(userText)
      ) {
        lastListTopicIntentRef.current = contextualListIntent;
      }
      const immediateActiveListRemoveIndices =
        liveActiveListId &&
        liveActiveList &&
        !feedbackOnly &&
        !productFeedback &&
        allowListMutationDuringReviewGuard &&
        !isListReviewOrLayoutSpeech(userText) &&
        !isListObservationOnly(userText) &&
        !LIST_REMOVAL_FAILURE_RE.test(userText) &&
        !LIST_DELETE_RE.test(userText) &&
        !LIST_CLEAR_RE.test(userText) &&
        !LIST_CLOSE_RE.test(userText) &&
        REMOVE_COMMAND_RE.test(userText)
          ? extractRemoveItemIndices(userText)
          : [];
      if (
        liveActiveListId &&
        liveActiveList &&
        immediateActiveListRemoveIndices.length > 0
      ) {
        pendingListColorChoiceRef.current = null;
        clearListColorDemoTimers();
        const removedItems = removeListItemsAtIndices(
          liveActiveListId,
          immediateActiveListRemoveIndices,
        );
        const spoken =
          removedItems.length > 0
            ? `I took ${formatListItemsForSpeech(removedItems)} off the list.`
            : `I do not see item ${immediateActiveListRemoveIndices
                .map((index) => index + 1)
                .join(" or item ")} on this list.`;
        await interrupt();
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        setThoughtPrompts(normalizeThoughtPrompts(ACTIVE_LIST_THOUGHT_PROMPTS));
        schedulePromptBrain(userText);
        return;
      }
      const immediateActiveListRemoveItems =
        liveActiveListId &&
        liveActiveList &&
        !feedbackOnly &&
        !productFeedback &&
        allowListMutationDuringReviewGuard &&
        !isListReviewOrLayoutSpeech(userText) &&
        !isListObservationOnly(userText) &&
        !LIST_REMOVAL_FAILURE_RE.test(userText) &&
        !LIST_DELETE_RE.test(userText) &&
        !LIST_CLEAR_RE.test(userText) &&
        !LIST_CLOSE_RE.test(userText) &&
        REMOVE_COMMAND_RE.test(userText)
          ? extractRemoveItems(userText)
          : [];
      if (liveActiveListId && immediateActiveListRemoveItems.length > 0) {
        pendingListColorChoiceRef.current = null;
        clearListColorDemoTimers();
        const removed = removeItemsFromList(
          liveActiveListId,
          immediateActiveListRemoveItems,
        );
        const postRemovalAddItems = extractPostRemovalAddItems(userText, {
          activeListKind: liveActiveList?.kind,
        });
        const added =
          removed && postRemovalAddItems.length > 0
            ? addItemsToList(liveActiveListId, postRemovalAddItems)
            : false;
        const spoken = removed
          ? added
            ? `I took ${formatListItemsForSpeech(immediateActiveListRemoveItems)} off and added ${formatListItemsForSpeech(postRemovalAddItems)}.`
            : `I took ${formatListItemsForSpeech(immediateActiveListRemoveItems)} off the list.`
          : `I do not see ${formatListItemsForSpeech(immediateActiveListRemoveItems)} on this list.`;
        await interrupt();
        permitNextAppSpeech(spoken, 8000);
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        setThoughtPrompts(normalizeThoughtPrompts(ACTIVE_LIST_THOUGHT_PROMPTS));
        schedulePromptBrain(userText);
        return;
      }
      const immediateActiveListAddItems =
        liveActiveListId &&
        liveActiveList &&
        !pendingGenericListNamingRef.current &&
        (!feedbackOnly || allowFeedbackListMutation) &&
        (!productFeedback || allowFeedbackListMutation) &&
        allowListMutationDuringReviewGuard &&
        (!isListReviewOrLayoutSpeech(userText) || targetedListMutationItems.length > 0) &&
        (!isListObservationOnly(userText) || targetedListMutationItems.length > 0) &&
        (!PRODUCT_REVIEW_CONTEXT_RE.test(userText) || targetedListMutationSpeech) &&
        !LIST_START_REHEARSAL_RE.test(userText) &&
        !LIST_CLOSE_RE.test(userText) &&
        !REMOVE_COMMAND_RE.test(userText)
          ? targetedListMutationItems.length > 0
            ? targetedListMutationItems
            : extractListItems(userText, {
                allowBareItems: true,
                activeListKind: liveActiveList.kind,
              })
          : [];
      if (liveActiveListId && immediateActiveListAddItems.length > 0) {
        pendingListColorChoiceRef.current = null;
        clearListColorDemoTimers();
        const added = addItemsToList(liveActiveListId, immediateActiveListAddItems);
        if (!added) {
          const spoken = `${formatListItemsForSpeech(immediateActiveListAddItems)} is already on the list.`;
          await interrupt();
          permitNextAppSpeech(spoken, 8000);
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
        } else {
          const spoken = `I added ${formatListItemsForSpeech(immediateActiveListAddItems)}.`;
          await interrupt();
          permitNextAppSpeech(spoken, 8000);
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
        }
        setThoughtPrompts(normalizeThoughtPrompts(ACTIVE_LIST_THOUGHT_PROMPTS));
        schedulePromptBrain(userText);
        return;
      }
      if (!feedbackOnly) {
        logPreferenceCandidate(userText);
      }
      if (accountPendingStateTokenRef.current) {
        savePendingAccountState();
      }

      const namePromptAskedAtTurn = namePromptAskedAtTurnRef.current;
      const protectedNameCaptureContext =
        feedbackOnly ||
        productFeedback ||
        isProtectedProductFeedback(userText) ||
        isAppFeedbackOnly(userText) ||
        isListObservationOnly(userText) ||
        PRODUCT_REVIEW_CONTEXT_RE.test(userText) ||
        LIST_START_REHEARSAL_RE.test(userText) ||
        LIST_META_COMMAND_RE.test(userText);
      const recentlyAskedName =
        !deviceProfileRef.current.name &&
        !feedbackQuietActive &&
        !protectedNameCaptureContext &&
        namePromptAskedAtTurn != null &&
        nameRelationshipTurnCountRef.current - namePromptAskedAtTurn <= 4;
      const allowPlainNameAnswer =
        (isAnsweringNamePrompt || recentlyAskedName) &&
        !protectedNameCaptureContext &&
        !bareActiveListItemAfterNamePrompt;
      const deviceNameCandidate = extractDeviceNameCandidate(
        userText,
        allowPlainNameAnswer,
      );
      if (
        deviceNameCandidate &&
        !protectedNameCaptureContext &&
        (allowPlainNameAnswer || hasExplicitNameIntro(userText))
      ) {
        setDeviceProfile((current) => {
          const nextProfile = {
            ...current,
            name: deviceNameCandidate,
            updatedAt: Date.now(),
          };
          deviceProfileRef.current = nextProfile;
          return nextProfile;
        });
        nextNameUseTurnRef.current = nextNameUseTurn(
          nameRelationshipTurnCountRef.current,
        );
        namePromptAskedRef.current = true;
        pendingNamePromptAfterAvatarRef.current = null;
        clearNamePromptFallbackTimer();
        const spoken = buildNameCaptureAck(deviceNameCandidate);
        await interrupt();
        permitNextAppSpeech(spoken);
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        rememberConversationLine("assistant", spoken);
        lastAvatarResponseTimeRef.current = Date.now();
        schedulePromptBrain(userText);
        return;
      }

      const socialFeatureExplanation =
        !feedbackOnly && !productFeedback
          ? socialFeatureExplanationForSpeech(
              userText,
              [
                lastAvatarResponseRef.current,
                ...recentConversationRef.current.map((line) => line.text),
                ...promptBrainHistoryRef.current,
              ].join(" "),
            )
          : null;
      if (socialFeatureExplanation) {
        if (isAvatarTalking) {
          await interrupt();
        }
        setThoughtPrompts(normalizeThoughtPrompts(socialFeatureExplanation.prompts));
        await repeat(socialFeatureExplanation.spoken);
        lastAvatarResponseRef.current = socialFeatureExplanation.spoken;
        rememberConversationLine("assistant", socialFeatureExplanation.spoken);
        lastAvatarResponseTimeRef.current = Date.now();
        schedulePromptBrain(userText);
        return;
      }

      const requestedIdeaBoxPrompt = promptFromIdeaBoxActionRequest(userText);
      const requestedIdeaBoxStarter = requestedIdeaBoxPrompt
        ? directStarterForThoughtPrompt(requestedIdeaBoxPrompt)
        : null;
      if (isAvatarTalking && !feedbackOnly && !requestedIdeaBoxStarter) {
        void interrupt();
      }
      if (
        !feedbackOnly &&
        !productFeedback &&
        requestedIdeaBoxPrompt &&
        contextualListIntentForText(requestedIdeaBoxPrompt)?.title === "Goals"
      ) {
        await openLifeGoalsStickyNote(requestedIdeaBoxPrompt);
        return;
      }
      if (!feedbackOnly && requestedIdeaBoxStarter) {
        if (isAvatarTalking) {
          await interrupt();
        }
        setThoughtPrompts(normalizeThoughtPrompts(requestedIdeaBoxStarter.prompts));
        await repeat(requestedIdeaBoxStarter.spoken);
        lastAvatarResponseRef.current = requestedIdeaBoxStarter.spoken;
        rememberConversationLine("assistant", requestedIdeaBoxStarter.spoken);
        lastAvatarResponseTimeRef.current = Date.now();
        schedulePromptBrain(requestedIdeaBoxPrompt ?? userText);
        return;
      }
      if (
        !feedbackOnly &&
        !productFeedback &&
        !PRODUCT_REVIEW_CONTEXT_RE.test(userText) &&
        contextualListIntent?.title === "Goals"
      ) {
        await openLifeGoalsStickyNote(userText);
        return;
      }

      if (await handlePendingListColorChoice(userText)) {
        schedulePromptBrain(userText);
        return;
      }

      const listCloseFailureReport =
        /\b(?:for the record|didn'?t|did not|doesn'?t|does not)\b.{0,80}\bclose\b.{0,80}\blist\b/i.test(
          userText,
        );
      const closeThenStartListCommand =
        liveActiveList &&
        (LIST_DELETE_RE.test(userText) || LIST_CLOSE_RE.test(userText)) &&
        /\b(?:and|then)\b.{0,80}\b(?:make|create|start|open)\b/i.test(
          userText,
        ) &&
        !feedbackOnly &&
        !productFeedback &&
        !isProtectedProductFeedback(userText);
      const directListCloseCommand =
        (LIST_CLOSE_RE.test(userText) || Boolean(closeThenStartListCommand)) &&
        !listCloseFailureReport &&
        !feedbackOnly &&
        !productFeedback &&
        !isProtectedProductFeedback(userText);
      const closeAndStartListIntent = directListCloseCommand
        ? detectListIntent(userText)
        : null;
      if (directListCloseCommand && closeAndStartListIntent && liveActiveList) {
        logAssistantListState("close", liveActiveList, {
          activeListId: null,
          isShoppingMode: false,
          visible: false,
          detail: { source: "speech", followedBy: "list_start" },
        });
        setIsShoppingMode(false);
        activeListIdRef.current = null;
        activeListRef.current = null;
        setActiveListId(null);
        latestListMutationRef.current = null;
        pendingListItemRemovalRef.current = null;
        pendingListItemFragmentRef.current = null;
        pendingListColorChoiceRef.current = null;
        clearListColorDemoTimers();
        if (closeAndStartListIntent.title === "New List") {
          pendingGenericListNamingRef.current = {
            requestedAt: Date.now(),
            preferFresh: true,
          };
          pendingListStartConfirmationRef.current = null;
          const spoken = "What do you want to call the new list?";
          await interrupt();
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          setThoughtPrompts(
            normalizeThoughtPrompts([
              "Grocery List",
              "Shopping List",
              "To Do List",
              "Walmart List",
            ]),
          );
          return;
        }
      }
      if (directListCloseCommand && !closeAndStartListIntent) {
        clearAccountEmailEntry();
        onlineLookupPendingQueryRef.current = null;
        pendingOnlineLookupConfirmationRef.current = null;
        onlineLookupLocationRef.current = null;
        setOnlineLookupNotice(null);
        setOnlineLookupSources([]);
        setOnlineLookupResultLines([]);
        setSourcePreview(null);
        if (activeList) {
          logAssistantListState("close", activeList, {
            activeListId: null,
            isShoppingMode: false,
            visible: false,
            detail: { source: "speech" },
          });
        }
        setIsShoppingMode(false);
        activeListIdRef.current = null;
        activeListRef.current = null;
        setActiveListId(null);
        latestListMutationRef.current = null;
        pendingListItemRemovalRef.current = null;
        pendingListItemFragmentRef.current = null;
        pendingListColorChoiceRef.current = null;
        clearListColorDemoTimers();
        setListFocusNonce((value) => value + 1);
        const spoken = "I closed the list.";
        await interrupt();
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        schedulePromptBrain(userText);
        return;
      }

      const pendingListRename = pendingListRenameConfirmationRef.current;
      if (pendingListRename) {
        const pendingIsFresh = Date.now() - pendingListRename.requestedAt < 30_000;
        const updatedRenameTitle =
          liveActiveList && !feedbackOnly && !productFeedback
            ? extractActiveListRenameTitle(userText) ??
              (userText.match(LIST_RENAME_RE)?.[1] ??
                userText.match(LIST_RENAME_RE)?.[2] ??
                userText.match(LIST_RENAME_RE)?.[3] ??
                null)
            : null;
        const updatedRenameCleanTitle =
          liveActiveList && updatedRenameTitle
            ? cleanRequestedListTitle(updatedRenameTitle, {
                appendList: liveActiveList.kind !== "custom",
              })
            : null;
        if (!pendingIsFresh) {
          pendingListRenameConfirmationRef.current = null;
        } else if (
          updatedRenameCleanTitle &&
          updatedRenameCleanTitle.toLowerCase() === pendingListRename.title.toLowerCase()
        ) {
          pendingListRenameConfirmationRef.current = null;
          const renamed = renameAssistantList(
            pendingListRename.listId,
            pendingListRename.title,
          );
          const spoken = renamed ? "Done." : "That name is already set.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        } else if (
          feedbackOnly ||
          productFeedback ||
          PRODUCT_REVIEW_CONTEXT_RE.test(userText)
        ) {
          pendingListRenameConfirmationRef.current = null;
          schedulePromptBrain(userText);
          return;
        } else if (updatedRenameTitle) {
          await requestListRenameConfirmation(
            pendingListRename.listId,
            updatedRenameTitle,
          );
          schedulePromptBrain(userText);
          return;
        } else if (
          /\b(?:start|make|create|open)\s+(?:a\s+)?(?:new\s+)?(?:list|one)\b|\bnew\s+(?:list|one)\b/i.test(
            userText,
          )
        ) {
          pendingListRenameConfirmationRef.current = null;
          const ensuredListId = ensureAssistantList(
            {
              title: pendingListRename.title,
              kind: listKindForTitle(pendingListRename.title, "custom"),
            },
            { preferFresh: true },
          );
          if (!ensuredListId) {
            await repeat(
              "You have 10 lists open. Tell me which one to change out.",
            );
            return;
          }
          await askForNewListColor(ensuredListId, pendingListRename.title);
          schedulePromptBrain(userText);
          return;
        } else if (
          LIST_START_CONFIRM_NO_RE.test(userText) ||
          END_SESSION_CANCEL_RE.test(userText)
        ) {
          pendingListRenameConfirmationRef.current = null;
          const spoken = "Okay, I kept the name.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        } else if (confirmsListRenameFromSpeech(userText)) {
          pendingListRenameConfirmationRef.current = null;
          const renamed = renameAssistantList(
            pendingListRename.listId,
            pendingListRename.title,
          );
          const spoken = renamed ? "Done." : "That name is already set.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        } else {
          const spoken = `Say yes to rename it to ${pendingListRename.title}, or no to keep the current name.`;
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          return;
        }
      }

      const activeListRenameTitle = liveActiveList
        ? extractActiveListRenameTitle(userText)
        : null;
      const activeListRenameCleanTitle =
        liveActiveList && activeListRenameTitle
          ? cleanRequestedListTitle(activeListRenameTitle, {
              appendList: liveActiveList.kind !== "custom",
            })
          : null;
      const renameRepeatsCurrentTitleWithItems =
        Boolean(
          liveActiveList &&
            activeListRenameCleanTitle &&
            liveActiveList.title.trim().toLowerCase() ===
              activeListRenameCleanTitle.trim().toLowerCase(),
        ) && extractListItems(userText, { allowBareItems: true }).length > 0;
      if (
        liveActiveList &&
        activeListRenameTitle &&
        !feedbackOnly &&
        !productFeedback &&
        !PRODUCT_REVIEW_CONTEXT_RE.test(userText) &&
        !renameRepeatsCurrentTitleWithItems
      ) {
        await requestListRenameConfirmation(liveActiveList.id, activeListRenameTitle);
        schedulePromptBrain(userText);
        return;
      }

      const shouldBlockColorChangeTalk =
        isStickyNoteColorMention(userText) ||
        LIST_COLOR_CHANGE_REQUEST_RE.test(userText) ||
        LIST_COLOR_REVIEW_ONLY_RE.test(userText);
      if (
        shouldBlockColorChangeTalk &&
        !feedbackOnly &&
        !productFeedback &&
        !feedbackQuietActive &&
        !PRODUCT_REVIEW_CONTEXT_RE.test(userText) &&
        !isListReviewOrLayoutSpeech(userText) &&
        !isListObservationOnly(userText)
      ) {
        const spoken = activeList
          ? "Color changes are off right now. Tell me what to add to the list."
          : "Color changes are off right now.";
        await interrupt();
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        schedulePromptBrain(userText);
        return;
      }

      if (hasDirectEndSessionCommand(userText)) {
        cancelQueuedGeneralAvatarResponse();
        await handleEndSession();
        return;
      }

      if (NORMAL_CONVERSATION_ACK_RE.test(userText)) {
        normalConversationModeRef.current = true;
        siteFeedbackQuietUntilRef.current = 0;
        suppressNativeListUiSpeechUntilRef.current = 0;
        onlineLookupPendingQueryRef.current = null;
        pendingOnlineLookupConfirmationRef.current = null;
        onlineLookupLocationRef.current = null;
        setOnlineLookupNotice(null);
        setOnlineLookupSources([]);
        setOnlineLookupResultLines([]);
        setSourcePreview(null);
        clearAccountEmailEntry();
        cancelQueuedGeneralAvatarResponse();
        const spoken =
          "I'm here with you. I'll talk normally, and I won't pull boxes up unless you ask me to.";
        await interrupt();
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        schedulePromptBrain(userText);
        return;
      }

      const productReviewIntentGuardActive =
        Date.now() < productReviewIntentGuardUntilRef.current;
      if (
        shouldSuppressProductReviewIntent(userText, productReviewIntentGuardActive)
      ) {
        pendingListStartConfirmationRef.current = null;
        pendingOnlineLookupConfirmationRef.current = null;
        onlineLookupPendingQueryRef.current = null;
        onlineLookupLocationRef.current = null;
        if (lookupPanelVisible || onlineLookupNotice) {
          setOnlineLookupNotice(null);
          setOnlineLookupSources([]);
          setOnlineLookupResultLines([]);
          setSourcePreview(null);
          setThoughtPrompts(normalizeThoughtPrompts(DEFAULT_THOUGHT_PROMPTS));
        }
        cancelQueuedGeneralAvatarResponse();
        schedulePromptBrain(userText);
        return;
      }

      const pendingListStart = pendingListStartConfirmationRef.current;
      if (pendingListStart) {
        const pendingIsFresh =
          Date.now() - pendingListStart.requestedAt < 20_000;
        if (!pendingIsFresh) {
          pendingListStartConfirmationRef.current = null;
        } else if (
          feedbackOnly ||
          productFeedback ||
          PRODUCT_REVIEW_CONTEXT_RE.test(userText) ||
          LIST_START_REHEARSAL_RE.test(userText)
        ) {
          pendingListStartConfirmationRef.current = null;
          schedulePromptBrain(userText);
          return;
        } else if (confirmsListStartFromSpeech(userText)) {
          pendingListStartConfirmationRef.current = null;
          const ensuredListId = ensureAssistantList(pendingListStart.intent, {
            preferFresh: pendingListStart.preferFresh,
          });
          if (!ensuredListId) {
            await repeat(
              "You have 10 lists open. Tell me which one to change out.",
            );
            return;
          }
          const ensured = lastEnsuredListRef.current;
          const action = ensured?.wasNew ? "started" : "opened";
          const closeEducation = listCloseEducationSpokenRef.current
            ? ""
            : ` ${LIST_CLOSE_EDUCATION}`;
          const listCount = assistantLists.some((list) => list.id === ensuredListId)
            ? assistantLists.length
            : assistantLists.length + 1;
          const navEducation = takeListMultiNavEducation(listCount);
          listCloseEducationSpokenRef.current = true;
          if (ensured?.wasNew) {
            await askForNewListColor(ensuredListId, ensured.title, {
              closeEducation: ` ${LIST_CLOSE_EDUCATION}`,
              navEducation,
            });
            return;
          }
          const spoken = `I ${action} the ${ensured?.title ?? pendingListStart.intent.title}. Tell me the first item.${closeEducation}${navEducation}`;
          await interrupt();
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          setThoughtPrompts(normalizeThoughtPrompts(ACTIVE_LIST_THOUGHT_PROMPTS));
          return;
        } else if (LIST_START_CONFIRM_NO_RE.test(userText)) {
          pendingListStartConfirmationRef.current = null;
          const spoken = "Okay, I will not start it.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }
      }

      const pendingGenericListNaming = pendingGenericListNamingRef.current;
      if (pendingGenericListNaming) {
        const pendingIsFresh =
          Date.now() - pendingGenericListNaming.requestedAt < 30_000;
        const pendingRenameTitle =
          liveActiveList && !feedbackOnly && !productFeedback
            ? extractActiveListRenameTitle(userText)
            : null;
        if (!pendingIsFresh) {
          pendingGenericListNamingRef.current = null;
        } else if (pendingRenameTitle && liveActiveList) {
          pendingGenericListNamingRef.current = null;
          await requestListRenameConfirmation(
            pendingGenericListNaming.listId ?? liveActiveList.id,
            pendingRenameTitle,
          );
          schedulePromptBrain(userText);
          return;
        } else if (shouldIgnorePendingListNamingSpeech(userText)) {
          pendingGenericListNamingRef.current = null;
          schedulePromptBrain(userText);
          return;
        } else if (isPendingListNamingFiller(userText)) {
          pendingGenericListNamingRef.current = {
            ...pendingGenericListNaming,
            requestedAt: Date.now(),
          };
          if (/^(?:yes|yeah|yep|yup|sure|ok|okay|please|right|correct|start it|open it|make it)[.!?]*$/i.test(userText.trim())) {
            const spoken = "What do you want to call this list?";
            await interrupt();
            await repeat(spoken);
            lastAvatarResponseRef.current = spoken;
            lastAvatarResponseTimeRef.current = Date.now();
            return;
          }
          schedulePromptBrain(userText);
          return;
        } else if (
          LIST_START_CONFIRM_NO_RE.test(userText) &&
          !/\b(?:want|need|would\s+like|call|name|to[-\s]?do|todo|grocery|shopping|walmart|task)\b/i.test(
            userText,
          )
        ) {
          pendingGenericListNamingRef.current = null;
        } else if (wantsSixToHelpNameList(userText)) {
          pendingGenericListNamingRef.current = {
            ...pendingGenericListNaming,
            requestedAt: Date.now(),
          };
          const spoken =
            "Tell me the final name when you want me to put it on the list.";
          await interrupt();
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          setThoughtPrompts(
            normalizeThoughtPrompts([
              "Grocery List",
              "Shopping List",
              "To Do List",
              "Create Walmart List",
            ]),
          );
          return;
        } else if (
          feedbackOnly ||
          productFeedback ||
          isProtectedProductFeedback(userText) ||
          isAppFeedbackOnly(userText) ||
          isListObservationOnly(userText)
        ) {
          pendingGenericListNamingRef.current = {
            ...pendingGenericListNaming,
            requestedAt: Date.now(),
          };
          schedulePromptBrain(userText);
          return;
        } else if (!feedbackOnly && !isProtectedProductFeedback(userText)) {
          const namedIntentFromSpeech = detectListIntent(userText);
          const cleanedTitle = namedIntentFromSpeech
            ? null
            : cleanRequestedListTitle(userText, { appendList: true });
          const namedIntent =
            namedIntentFromSpeech && namedIntentFromSpeech.title !== "New List"
              ? namedIntentFromSpeech
              : cleanedTitle
                ? {
                    title: cleanedTitle,
                    kind: listKindForTitle(cleanedTitle, "custom" as const),
                  }
                : null;
          if (namedIntent) {
            pendingGenericListNamingRef.current = null;
            if (pendingGenericListNaming.listId) {
              const renamed = renameAssistantList(
                pendingGenericListNaming.listId,
                namedIntent.title,
              );
              if (renamed) {
                const spoken = "What would you like for me to put on it?";
                await interrupt();
                await repeat(spoken);
                lastAvatarResponseRef.current = spoken;
                lastAvatarResponseTimeRef.current = Date.now();
                setThoughtPrompts(normalizeThoughtPrompts(ACTIVE_LIST_THOUGHT_PROMPTS));
                return;
              }
            }
            const ensuredListId = ensureAssistantList(namedIntent, {
              preferFresh: pendingGenericListNaming.preferFresh,
            });
            if (!ensuredListId) {
              await repeat(
                "You have 10 lists open. Tell me which one to change out.",
              );
              return;
            }
            const ensured = lastEnsuredListRef.current;
            if (ensured?.wasNew) {
              await askForNewListColor(ensuredListId, ensured.title);
              return;
            }
            const spoken = `I opened the ${ensured?.title ?? namedIntent.title}.`;
            await interrupt();
            await repeat(spoken);
            lastAvatarResponseRef.current = spoken;
            lastAvatarResponseTimeRef.current = Date.now();
            setThoughtPrompts(normalizeThoughtPrompts(ACTIVE_LIST_THOUGHT_PROMPTS));
            return;
          }

          const spoken =
            "What would you like to name the list? What are we making this a list of?";
          await interrupt();
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          pendingGenericListNamingRef.current = {
            ...pendingGenericListNaming,
            requestedAt: Date.now(),
          };
          return;
        }
      }

      const pendingLookupStart = pendingOnlineLookupConfirmationRef.current;
      if (pendingLookupStart) {
        const pendingIsFresh =
          Date.now() - pendingLookupStart.requestedAt < 20_000;
        if (!pendingIsFresh) {
          pendingOnlineLookupConfirmationRef.current = null;
        } else if (
          LIST_START_CONFIRM_YES_RE.test(userText) ||
          shouldConfirmOnlineLookupStart(userText)
        ) {
          pendingOnlineLookupConfirmationRef.current = null;
          const handledLookup = await handleOnlineLookupSpeech(pendingLookupStart.query);
          if (handledLookup) return;
        } else if (LIST_START_CONFIRM_NO_RE.test(userText)) {
          pendingOnlineLookupConfirmationRef.current = null;
          const spoken = "Okay, I will not pull anything up.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          setThoughtPrompts(normalizeThoughtPrompts(DEFAULT_THOUGHT_PROMPTS));
          schedulePromptBrain(userText);
          return;
        }
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
          lastAvatarResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }
        if (END_SESSION_CANCEL_RE.test(userText)) {
          pendingListDeleteRef.current = null;
          const spoken = "Okay, I kept the list.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }
        const spoken = "Before I delete that list, say yes to delete it or no to keep it.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        return;
      }

      if (ONLINE_LOOKUP_CLOSE_RE.test(userText)) {
        onlineLookupPendingQueryRef.current = null;
        pendingOnlineLookupConfirmationRef.current = null;
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
        lastAvatarResponseTimeRef.current = Date.now();
        return;
      }

      if (SHOPPING_MODE_CLOSE_RE.test(userText)) {
        clearAccountEmailEntry();
        setIsShoppingMode(false);
        await interrupt();
        const spoken = "I closed shopping mode.";
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        schedulePromptBrain(userText);
        return;
      }

      if (liveActiveList && LIST_UNDO_REMOVAL_RE.test(userText)) {
        const removal = recentRemovedItemsRef.current.find(
          (item) => item.listId === liveActiveList.id,
        );
        if (removal) {
          recentRemovedItemsRef.current = recentRemovedItemsRef.current.filter(
            (item) => item !== removal,
          );
          addItemsToList(removal.listId, [removal.item]);
          schedulePromptBrain(userText);
          return;
        }
      }

      const renameMatch =
        liveActiveList && !/\b(?:color|colour|pink|blue|green|gold|golden|yellow|orange|amber|purple|violet|white|black|gray|grey|silver|darker|lighter|brighter|deeper|shade)\b/i.test(userText)
          ? userText.match(LIST_RENAME_RE)
          : null;
      const requestedRenameTitle =
        renameMatch?.[1] ?? renameMatch?.[2] ?? renameMatch?.[3] ?? null;
      if (
        liveActiveList &&
        requestedRenameTitle &&
        !feedbackOnly &&
        !productFeedback &&
        !PRODUCT_REVIEW_CONTEXT_RE.test(userText)
      ) {
        await requestListRenameConfirmation(liveActiveList.id, requestedRenameTitle);
        schedulePromptBrain(userText);
        return;
      }

      if (liveActiveList && LIST_CLEAR_RE.test(userText)) {
        clearListItems(liveActiveList.id);
        schedulePromptBrain(userText);
        return;
      }

      if (LIST_DELETE_RE.test(userText) && !closeAndStartListIntent) {
        const deleteIntent = detectListIntent(userText);
        const listToDelete =
          deleteIntent && deleteIntent.title !== "New List"
            ? findAssistantListForIntent(liveAssistantLists, deleteIntent)
            : liveActiveList;
        if (!listToDelete) {
          const spoken = "I do not see that list.";
          await interrupt();
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }
        deleteAssistantList(listToDelete.id);
        if (listToDelete.id === liveActiveListId) {
          activeListIdRef.current = null;
          activeListRef.current = null;
        }
        setListFocusNonce((value) => value + 1);
        const spoken = `I deleted the ${listToDelete.title}.`;
        await interrupt();
        permitNextAppSpeech(spoken, 8000);
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        schedulePromptBrain(userText);
        return;
      }

      if (directListCloseCommand && !closeAndStartListIntent) {
        clearAccountEmailEntry();
        onlineLookupPendingQueryRef.current = null;
        pendingOnlineLookupConfirmationRef.current = null;
        onlineLookupLocationRef.current = null;
        setOnlineLookupNotice(null);
        setOnlineLookupSources([]);
        setOnlineLookupResultLines([]);
        setSourcePreview(null);
        if (activeList) {
          logAssistantListState("close", activeList, {
            activeListId: null,
            isShoppingMode: false,
            visible: false,
          });
        }
        setIsShoppingMode(false);
        activeListIdRef.current = null;
        activeListRef.current = null;
        setActiveListId(null);
        latestListMutationRef.current = null;
        pendingListItemRemovalRef.current = null;
        pendingListItemFragmentRef.current = null;
        pendingListColorChoiceRef.current = null;
        clearListColorDemoTimers();
        setListFocusNonce((value) => value + 1);
        const spoken = "I closed the list.";
        await interrupt();
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        schedulePromptBrain(userText);
        return;
      }

      const mixedFeedbackListItems =
        liveActiveListId && liveActiveList && (feedbackOnly || productFeedback)
          ? extractMixedExplicitActiveListItems(userText, {
              activeListKind: liveActiveList.kind,
            })
          : [];
      if (liveActiveListId && mixedFeedbackListItems.length > 0) {
        pendingListColorChoiceRef.current = null;
        clearListColorDemoTimers();
        const added = addItemsToList(liveActiveListId, mixedFeedbackListItems);
        const spoken = added
          ? `I added ${formatListItemsForSpeech(mixedFeedbackListItems)}.`
          : `${formatListItemsForSpeech(mixedFeedbackListItems)} is already on the list.`;
        await interrupt();
        permitNextAppSpeech(spoken, 8000);
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        setThoughtPrompts(normalizeThoughtPrompts(ACTIVE_LIST_THOUGHT_PROMPTS));
        schedulePromptBrain(userText);
        return;
      }

      if (feedbackOnly) {
        cancelQueuedGeneralAvatarResponse();
        if (
          lookupPanelVisible ||
          onlineLookupPendingQueryRef.current ||
          pendingOnlineLookupConfirmationRef.current
        ) {
          onlineLookupPendingQueryRef.current = null;
          pendingOnlineLookupConfirmationRef.current = null;
          onlineLookupLocationRef.current = null;
          setOnlineLookupNotice(null);
          setOnlineLookupSources([]);
          setOnlineLookupResultLines([]);
          setSourcePreview(null);
          setThoughtPrompts(normalizeThoughtPrompts(DEFAULT_THOUGHT_PROMPTS));
        }
        if (SILENCE_OR_CUTOFF_FEEDBACK_RE.test(userText)) {
          const contextText = [userText, ...promptBrainHistoryRef.current].join(" ");
          const spoken = responseForSilenceOrCutoffFeedback(contextText);
          setThoughtPrompts(normalizeThoughtPrompts(getThoughtPrompts(contextText)));
          await interrupt();
          stopListening();
          resumeListeningAfterAvatarSpeech(6500);
          permitNextAppSpeech(spoken, 8000);
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          rememberConversationLine("assistant", spoken);
          lastAvatarResponseTimeRef.current = Date.now();
          schedulePromptBrain(contextText);
          return;
        }
        schedulePromptBrain(userText);
        return;
      }

      const detectedListIntent = detectListIntent(userText);
      const shouldKeepCurrentListForItem =
        Boolean(liveActiveListId) &&
        !explicitListActionCommand &&
        (LIST_MUTATION_SIGNAL_RE.test(userText) ||
          extractListItems(userText, {
            allowBareItems: true,
            activeListKind: liveActiveList?.kind,
          }).length > 0);
      const usableDetectedListIntent = shouldKeepCurrentListForItem
        ? null
        : detectedListIntent;
      const listContextText = [
        userText,
        lastAvatarResponseRef.current,
        ...recentConversationRef.current.map((line) => line.text),
        ...promptBrainHistoryRef.current,
      ].join(" ");
      const contextualFallbackIntent =
        contextualListIntent ??
        (isGenericUnnamedListStart(userText) ? null : lastListTopicIntentRef.current) ??
        (isGenericUnnamedListStart(userText)
          ? null
          : contextualListIntentForText(listContextText));
      const listIntent =
        usableDetectedListIntent?.title === "New List" && contextualFallbackIntent
          ? contextualFallbackIntent
          : usableDetectedListIntent;
      if (
        liveActiveList &&
        detectedListIntent &&
        detectedListIntent.title !== "New List" &&
        /^(?:new list|name this list|list grocery)$/i.test(liveActiveList.title.trim()) &&
        (LIST_MUTATION_SIGNAL_RE.test(userText) ||
          /\b(?:grocery|shopping|walmart|to[-\s]?do|todo)\s+list\b/i.test(userText))
      ) {
        renameAssistantList(liveActiveList.id, detectedListIntent.title);
      }

      const pendingItemRemoval = pendingListItemRemovalRef.current;
      if (
        pendingItemRemoval &&
        liveActiveList &&
        pendingItemRemoval.listId === liveActiveList.id &&
        Date.now() - pendingItemRemoval.requestedAt < 15000
      ) {
        pendingListItemRemovalRef.current = null;
        const itemToRemove = cleanRemoveListItem(userText);
        const spoken = itemToRemove
          ? removeItemsFromList(liveActiveList.id, [itemToRemove])
            ? `I took ${itemToRemove} off the list.`
            : `I do not see ${itemToRemove} on this list.`
          : "I missed what to take off. Say remove, then the item name.";
        await interrupt();
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        schedulePromptBrain(userText);
        return;
      } else if (pendingItemRemoval) {
        pendingListItemRemovalRef.current = null;
      }

      if (endSessionConfirmationPendingRef.current) {
        if (confirmsEndSession(userText)) {
          await handleEndSession();
          return;
        }
        if (END_SESSION_CANCEL_RE.test(userText)) {
          endSessionConfirmationPendingRef.current = false;
          const spoken = "Okay, we'll keep going.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }
        if (Date.now() - endSessionConfirmationAskedAtRef.current < 8000) {
          return;
        }
        endSessionConfirmationAskedAtRef.current = Date.now();
        const spoken =
          "I can close it. Say stop or close to end it, or keep going.";
        await interrupt();
        stopListening();
        resumeListeningAfterAvatarSpeech(4500);
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        return;
      }

      if (await handlePromptSizeSpeech(userText)) {
        schedulePromptBrain(userText);
        return;
      }

      if (hasEndSessionIntent(userText)) {
        endSessionConfirmationPendingRef.current = true;
        endSessionConfirmationAskedAtRef.current = Date.now();
        const spoken = SESSION_END_CONFIRMATION_MESSAGE;
        await interrupt();
        stopListening();
        resumeListeningAfterAvatarSpeech(5000);
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        return;
      }

      if (await handleAccountSetupSpeech(userText)) {
        schedulePromptBrain(userText);
        return;
      }

      if (!feedbackQuietActive && shouldConfirmOnlineLookupStart(userText)) {
        await requestOnlineLookupConfirmation(userText);
        return;
      }

      if (
        (!feedbackQuietActive || Boolean(onlineLookupPendingQueryRef.current)) &&
        (await handleOnlineLookupSpeech(userText))
      ) {
        schedulePromptBrain(userText);
        return;
      }

      if (LIST_SAVE_RE.test(userText) && liveActiveListId && liveActiveList) {
        cancelQueuedGeneralAvatarResponse();
        const spoken = "This list is saved automatically.";
        await interrupt();
        permitNextAppSpeech(spoken, 8000);
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        rememberConversationLine("assistant", spoken);
        lastAvatarResponseTimeRef.current = Date.now();
        schedulePromptBrain(userText);
        return;
      }

      if (LIST_NAV_FIRST_RE.test(userText)) {
        const firstList = liveAssistantLists[0] ?? null;
        if (firstList) {
          activeListIdRef.current = firstList.id;
          activeListRef.current = firstList;
          setActiveListId(firstList.id);
          logAssistantListState("open", firstList, {
            activeListId: firstList.id,
            detail: { firstList: true },
          });
          const spoken = `I opened the ${firstList.title}.`;
          await interrupt();
          permitNextAppSpeech(spoken, 8000);
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }
      }

      if (LIST_NAV_NEXT_RE.test(userText)) {
        const nextList = moveActiveList(1);
        if (nextList) {
          const spoken = `I opened the ${nextList.title}.`;
          await interrupt();
          permitNextAppSpeech(spoken, 8000);
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }
      } else if (LIST_NAV_PREV_RE.test(userText)) {
        const previousList = moveActiveList(-1);
        if (previousList) {
          const spoken = `I opened the ${previousList.title}.`;
          await interrupt();
          permitNextAppSpeech(spoken, 8000);
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }
      }

      const referencedAssistantItems =
        LIST_START_WITH_REFERENCED_ITEMS_RE.test(userText)
          ? extractReferencedAssistantListItems(rawLastAssistantText)
          : [];
      const listObservationOnly = isListObservationOnly(userText);
      const inferredListIntent =
        listObservationOnly
          ? null
          : listIntent ??
            (referencedAssistantItems.length > 0
              ? { title: "Shopping List", kind: "shopping" as const }
              : null);
      const startListImmediately = inferredListIntent
        ? shouldStartListImmediately(userText, inferredListIntent)
        : false;

      if (
        inferredListIntent?.title === "New List" &&
        referencedAssistantItems.length === 0 &&
        isGenericUnnamedListStart(userText)
      ) {
        pendingGenericListNamingRef.current = {
          requestedAt: Date.now(),
          preferFresh: /\banother\b|\bnew\b/i.test(userText),
        };
        pendingListStartConfirmationRef.current = null;
        const spoken = "What do you want to call this list?";
        await interrupt();
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        setThoughtPrompts(
          normalizeThoughtPrompts([
            "Grocery List",
            "Shopping List",
            "To Do List",
            "Walmart List",
          ]),
        );
        return;
      }

      if (
        inferredListIntent &&
        referencedAssistantItems.length === 0 &&
        shouldConfirmListStartRequest(
          userText,
          inferredListIntent,
          assistantLists,
          liveActiveListId,
        )
      ) {
        pendingListStartConfirmationRef.current = {
          intent: inferredListIntent,
          preferFresh: shouldStartFreshList(userText),
          requestedAt: Date.now(),
        };
        const spoken = getListStartConfirmationPrompt(inferredListIntent);
        await interrupt();
        await repeat(spoken);
        lastAvatarResponseRef.current = spoken;
        lastAvatarResponseTimeRef.current = Date.now();
        setThoughtPrompts(
          normalizeThoughtPrompts([
            "Yes, Start It",
            "Not Now",
            "Make More Money",
            "Plan Your Weekend",
          ]),
        );
        return;
      }

      if (inferredListIntent && referencedAssistantItems.length === 0 && !liveActiveListId) {
        const normalizedTitle = normalizedIntentTitle(inferredListIntent);
        const canOpenExistingList =
          /\b(?:open|show|pull up|switch to|go to)\b/i.test(userText) &&
          liveAssistantLists.some(
            (list) => list.title.toLowerCase() === normalizedTitle.toLowerCase(),
          );
        if (!canOpenExistingList && !startListImmediately) {
          schedulePromptBrain(userText);
          return;
        }
      }

      const inferredListMatchesActive =
        Boolean(inferredListIntent && liveActiveList) &&
        normalizedIntentTitle(inferredListIntent as { title: string; kind: AssistantListKind })
          .trim()
          .toLowerCase() === liveActiveList!.title.trim().toLowerCase();
      const openExistingListRequest =
        Boolean(inferredListIntent) &&
        LIST_OPEN_EXISTING_COMMAND_RE.test(userText) &&
        !shouldStartFreshList(userText);
      const existingOpenList =
        inferredListIntent && openExistingListRequest && !inferredListMatchesActive
          ? liveAssistantLists.find(
              (list) =>
                list.title.trim().toLowerCase() ===
                normalizedIntentTitle(inferredListIntent).trim().toLowerCase(),
            ) ??
            (/^(?:grocery|shopping)$/.test(inferredListIntent.kind)
              ? liveAssistantLists
                  .filter(
                    (list) =>
                      /^(?:grocery|shopping)$/.test(list.kind) &&
                      !/^walmart\s+list$/i.test(list.title),
                  )
                  .sort((a, b) => {
                    const itemScore =
                      Number(b.items.length > 0) - Number(a.items.length > 0);
                    if (itemScore !== 0) return itemScore;
                    return b.updatedAt - a.updatedAt;
                  })[0] ?? null
              : null)
          : null;
      if (inferredListIntent && openExistingListRequest && !inferredListMatchesActive) {
        if (!existingOpenList) {
          const spoken = `I do not see the ${normalizedIntentTitle(inferredListIntent)} open.`;
          await interrupt();
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }
        activeListIdRef.current = existingOpenList.id;
        activeListRef.current = existingOpenList;
        lastEnsuredListRef.current = {
          id: existingOpenList.id,
          title: existingOpenList.title,
          wasNew: false,
        };
        setActiveListId(existingOpenList.id);
        logAssistantListState("open", existingOpenList, {
          activeListId: existingOpenList.id,
          detail: { openExistingAlias: true },
        });
      }
      const targetListId = inferredListIntent
        ? inferredListMatchesActive
          ? liveActiveListId
          : existingOpenList
            ? existingOpenList.id
            : ensureAssistantList(inferredListIntent, {
                preferFresh: openExistingListRequest ? false : shouldStartFreshList(userText),
              })
        : liveActiveListId;
      const enteringShoppingMode = SHOPPING_MODE_OPEN_RE.test(userText);

      if (
        !listObservationOnly &&
        targetListId &&
        (LIST_TRIGGER_RE.test(userText) || liveActiveListId)
      ) {
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
          liveAssistantLists.find((list) => list.id === targetListId) ??
          liveActiveList;
        const accentUpdate = null;

        const removeIndices = allowListMutationDuringReviewGuard
          ? extractRemoveItemIndices(userText)
          : [];
        const removeIndex =
          allowListMutationDuringReviewGuard && removeIndices.length === 0
            ? extractRemoveItemIndex(userText)
            : null;
        const removeItems = allowListMutationDuringReviewGuard
          ? extractRemoveItems(userText)
          : [];
        let listMutationHandled = false;
        const vagueShoppingCategory = vagueShoppingCategoryFromSpeech(
          userText,
          targetListBeforeChange?.kind,
        );
        const targetListMutationItems = extractExplicitTargetedListMutationItems(
          userText,
          {
            activeListKind: targetListBeforeChange?.kind,
          },
        );
        let addItems =
          accentUpdate ||
          displayStyle ||
          vagueShoppingCategory ||
          !allowListMutationDuringReviewGuard ||
          (isListReviewOrLayoutSpeech(userText) &&
            targetListMutationItems.length === 0)
            ? []
            : referencedAssistantItems.length > 0
            ? referencedAssistantItems
            : targetListMutationItems.length > 0
            ? targetListMutationItems
            : extractListItems(userText, {
                allowBareItems: Boolean(
                  (liveActiveListId || inferredListIntent) && !feedbackQuietActive,
                ),
                activeListKind: targetListBeforeChange?.kind,
              });
        const pendingListItemFragment = pendingListItemFragmentRef.current;
        if (
          pendingListItemFragment &&
          pendingListItemFragment.listId === targetListId &&
          Date.now() - pendingListItemFragment.requestedAt < 12_000
        ) {
          const completedItem =
            addItems.length > 0
              ? completePendingListItemFragment(
                  pendingListItemFragment.text,
                  addItems[0] ?? "",
                )
              : null;
          if (completedItem) {
            addItems = [completedItem, ...addItems.slice(1)];
          }
          pendingListItemFragmentRef.current = null;
        } else if (pendingListItemFragment) {
          pendingListItemFragmentRef.current = null;
        }
        const nextListItemFragment = getIncompleteListItemFragment(userText);
        let heldListItemFragment = false;
        if (
          removeIndices.length > 0 &&
          targetListBeforeChange
        ) {
          const removedItems = removeListItemsAtIndices(targetListId, removeIndices);
          if (removedItems.length > 0) {
            listMutationHandled = true;
          } else {
            listActionSpoken = `I do not see item ${removeIndices
              .map((index) => index + 1)
              .join(" or item ")} on this list.`;
          }
        } else if (
          removeIndex != null &&
          targetListBeforeChange &&
          removeIndex >= 0 &&
          removeIndex < targetListBeforeChange.items.length
        ) {
          const removedItem =
            targetListBeforeChange.items[removeIndex] ?? `item ${removeIndex + 1}`;
          removeListItemAtIndex(targetListId, removeIndex);
          void removedItem;
          listMutationHandled = true;
        } else if (removeIndex != null) {
          listActionSpoken = `I do not see item ${removeIndex + 1} on this list.`;
        } else if (
          REMOVE_COMMAND_RE.test(userText) &&
          removeItems.length === 0 &&
          !isListReviewOrLayoutSpeech(userText) &&
          !isListObservationOnly(userText)
        ) {
          pendingListItemRemovalRef.current = {
            listId: targetListId,
            requestedAt: Date.now(),
          };
          listActionSpoken = "What should I take off the list?";
        } else if (removeItems.length > 0) {
          const removed = removeItemsFromList(targetListId, removeItems);
          if (removed) {
            listMutationHandled = true;
          } else {
            listActionSpoken = `I do not see ${formatListItemsForSpeech(removeItems)} on this list.`;
          }
        } else if (vagueShoppingCategory) {
          listActionSpoken = vagueShoppingCategoryPrompt(vagueShoppingCategory);
        } else if (
          /^(?:grocery|shopping)$/.test(targetListBeforeChange?.kind ?? "") &&
          /\b(?:let me think(?: about it)?|think about it|not sure|what do i want to put)\b/i.test(
            userText,
          )
        ) {
          listActionSpoken = "What kind of things do you like to eat?";
        } else if (nextListItemFragment) {
          pendingListItemFragmentRef.current = {
            listId: targetListId,
            text: nextListItemFragment,
            requestedAt: Date.now(),
          };
          heldListItemFragment = true;
        } else if (addItems.length > 0) {
          const added = addItemsToList(targetListId, addItems);
          if (added) {
            listMutationHandled = true;
            armNativeListUiSpeechSuppression(8000, 100);
            listActionSpoken = `I added ${formatListItemsForSpeech(addItems)}.`;
            lastAvatarResponseRef.current = listActionSpoken;
            lastAvatarResponseTimeRef.current = Date.now();
          } else {
            listActionSpoken = `${formatListItemsForSpeech(addItems)} is already on the list.`;
          }
        } else if (
          !feedbackOnly &&
          !productFeedback &&
          !feedbackQuietActive &&
          !PRODUCT_REVIEW_CONTEXT_RE.test(userText) &&
          !isListReviewOrLayoutSpeech(userText) &&
          !isListObservationOnly(userText)
        ) {
          const mentionedItem = findMentionedListItem(liveActiveList, userText);
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

        const pendingCustomization = pendingListCustomizationPromptRef.current;
        if (
          pendingCustomization?.id === targetListId &&
          !isShoppingMode &&
          !enteringShoppingMode
        ) {
          pendingListCustomizationPromptRef.current = null;
          const spoken = `I made the ${pendingCustomization.title}. Want this one numbered, bulleted, renamed, or anything else that makes it easier to scan?`;
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }

        if (!listActionSpoken && inferredListIntent) {
          const ensured = lastEnsuredListRef.current;
          const action = ensured?.wasNew ? "started" : "opened";
          const closeEducation = listCloseEducationSpokenRef.current
            ? ""
            : ` ${LIST_CLOSE_EDUCATION}`;
          const listCount = targetListId && liveAssistantLists.some((list) => list.id === targetListId)
            ? liveAssistantLists.length
            : liveAssistantLists.length + 1;
          const navEducation = takeListMultiNavEducation(listCount);
          listCloseEducationSpokenRef.current = true;
          if (ensured?.wasNew) {
            await askForNewListColor(targetListId, ensured.title, {
              closeEducation: closeAndStartListIntent ? "" : closeEducation,
              navEducation: closeAndStartListIntent ? "" : navEducation,
            });
            return;
          }
          listActionSpoken = `I ${action} the ${ensured?.title ?? inferredListIntent.title}. Just tell me what goes on it.${closeAndStartListIntent ? "" : closeEducation}${closeAndStartListIntent ? "" : navEducation}`;
        }

        if (enteringShoppingMode) {
          const visibleList =
            liveAssistantLists.find((list) => list.id === targetListId) ??
            targetListBeforeChange;
          if (visibleList) {
            logAssistantListState("view", visibleList, {
              activeListId: targetListId,
              isShoppingMode: true,
              detail: { shoppingMode: true },
            });
          }
          const spoken =
            "Got it. I'll keep the list up and stay out of the way. Tell me what to remove, or ask me to close the list.";
          await repeat(spoken);
          lastAvatarResponseRef.current = spoken;
          lastAvatarResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }

        if (listActionSpoken) {
          if (/^(?:I added|Added|Removed)\b/i.test(listActionSpoken)) {
            await interrupt();
          }
          permitNextAppSpeech(listActionSpoken, 8000);
          await repeat(listActionSpoken);
          lastAvatarResponseRef.current = listActionSpoken;
          lastAvatarResponseTimeRef.current = Date.now();
          schedulePromptBrain(userText);
          return;
        }

        if (listMutationHandled) {
          schedulePromptBrain(userText);
          return;
        }

        if (heldListItemFragment) {
          schedulePromptBrain(userText);
          return;
        }

        if (isShoppingMode) {
          schedulePromptBrain(userText);
          return;
        }
      }

      if (isAppFeedbackOnly(userText)) {
        siteFeedbackQuietUntilRef.current = Date.now() + APP_FEEDBACK_QUIET_MS;
        schedulePromptBrain(userText);
        return;
      }

      schedulePromptBrain(userText);
      if (Date.now() < siteFeedbackQuietUntilRef.current) {
        return;
      }
      queueGeneralAvatarResponse(userText);
    };

    sessionRef.current.on(
      AgentEventsEnum.USER_TRANSCRIPTION,
      handleUserTranscription,
    );

    return () => {
      if (promptBrainTimeoutRef.current) {
        clearTimeout(promptBrainTimeoutRef.current);
      }
      if (generalAvatarResponseTimeoutRef.current) {
        clearTimeout(generalAvatarResponseTimeoutRef.current);
        generalAvatarResponseTimeoutRef.current = null;
        pendingGeneralAvatarMessageRef.current = null;
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
    isShoppingMode,
    isAvatarTalking,
    interrupt,
    repeat,
    activeList,
    activeListId,
    addItemsToList,
    armNativeListUiSpeechSuppression,
    armPendingNamePrompt,
    askForNewListColor,
    assistantLists,
    buildMemoryAugmentedMessage,
    cancelQueuedGeneralAvatarResponse,
    clearListColorDemoTimers,
    clearNamePromptFallbackTimer,
    clearListItems,
    deleteAssistantList,
    ensureAssistantList,
    handleAccountSetupSpeech,
    handleEndSession,
    handleOnlineLookupSpeech,
    handlePendingListColorChoice,
    handlePromptSizeSpeech,
    logPreferenceCandidate,
    logAssistantListState,
    logProductFeedback,
    moveActiveList,
    openLifeGoalsStickyNote,
    permitNextAppSpeech,
    queueConversationLogEntry,
    removeListItemAtIndex,
    removeListItemsAtIndices,
    removeItemsFromList,
    requestOnlineLookupConfirmation,
    requestListRenameConfirmation,
    renameAssistantList,
    queueGeneralAvatarResponse,
    rememberConversationLine,
    resumeListeningAfterAvatarSpeech,
    schedulePromptBrain,
    savePendingAccountState,
    sendMessage,
    setListAccentColor,
    setListDisplayStyle,
    stopListening,
    takeListMultiNavEducation,
    clearAccountEmailEntry,
  ]);

  return (
    <div className="aiasap-viewport fixed inset-0 h-screen w-screen overflow-hidden bg-black md:bg-[radial-gradient(circle_at_center,#1c1009_0%,#080403_58%,#000_100%)]">
      <div
        className="aiasap-shell relative flex min-h-full w-full flex-col"
        style={{
          "--aiasap-list-scroll-thumb": activeListTheme.foreground,
          "--aiasap-list-scroll-track": colorWithAlpha(
            activeListPaperPalette.brandLine,
            0.36,
          ),
        } as React.CSSProperties}
      >
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

      {!ACCOUNT_BETA_DISABLED && accountNotice && !isShoppingMode && (
        <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[75] rounded-lg border border-[#f2be73]/45 bg-[#090604]/92 px-4 py-3 text-[#fff6e6] shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-sm font-semibold">{accountNotice}</p>
            <button
              type="button"
              aria-label="Dismiss account notice"
              title="Dismiss account notice"
              onClick={() => setAccountNotice(null)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f2be73]/16"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {accountVerificationUrl && (
            <a
              href={accountVerificationUrl}
              className="mt-2 block rounded-md border border-[#fff2d2] bg-[#f2be73] px-3 py-2 text-center text-sm font-black text-[#090604]"
            >
              Finish Account Setup
            </a>
          )}
        </div>
      )}

      {!ACCOUNT_BETA_DISABLED && emailEntryOpen && !isShoppingMode && (
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
        <div
          className="fixed left-1/2 bottom-[calc(env(safe-area-inset-bottom)+3.05rem)] md:bottom-auto md:top-[55vh] z-[34] h-[30vh] min-h-[10rem] max-h-[18rem] w-[min(90%,28rem)] -translate-x-1/2 overflow-hidden rounded-lg border-2 border-[#e0aa62]/78 bg-[#18110c]/91 px-3.5 py-3.5 text-[#f1c477] shadow-[0_18px_52px_rgba(0,0,0,0.46)] backdrop-blur-md md:h-[18vh] md:min-h-[8.25rem] md:max-h-[12rem] md:w-[min(82vw,20rem)] md:px-3 md:py-3"
          style={{
            borderColor: "#e0aa62",
            boxShadow:
              "0 0 0 1px rgba(241,196,119,0.28), 0 18px 52px rgba(0,0,0,0.46)",
          }}
        >
          <div className="flex h-full items-start justify-between gap-3">
            <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain pr-1 touch-pan-y">
              {onlineLookupNotice?.trim() && (
                <p className="text-[1.08rem] font-black leading-tight text-[#f1c477] md:text-[1rem]">{onlineLookupNotice}</p>
              )}
              {onlineLookupResultLines.length > 0 && (
                <div className="grid gap-2">
                  {onlineLookupResultLines.map((line, index) => {
                    const source = onlineLookupSources[index];
                    const content = (
                      <span
                        className="block overflow-hidden"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {line}
                      </span>
                    );
                    const rowClassName =
                      "rounded-md border border-[#e0aa62]/48 bg-[#2d2116]/78 px-3 py-2 text-[0.9rem] font-black leading-snug text-[#f1c477] md:px-2.5 md:py-1.5 md:text-[0.82rem]";
                    const rowStyle = {
                      backgroundColor: "rgba(45,33,22,0.86)",
                      borderColor: "#e0aa62",
                      color: "#f1c477",
                    } satisfies React.CSSProperties;
                    return source?.url ? (
                      <a
                        key={`${index}-${line}`}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`${rowClassName} underline decoration-[#f1c477]/55 underline-offset-4 transition hover:border-[#f1c477]/70 hover:bg-[#3a2a1c]/86`}
                        style={rowStyle}
                      >
                        {content}
                      </a>
                    ) : (
                      <div
                        key={`${index}-${line}`}
                        className={`${rowClassName} opacity-95`}
                        style={rowStyle}
                      >
                        {content}
                      </div>
                    );
                  })}
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
                  pendingOnlineLookupConfirmationRef.current = null;
                  onlineLookupLocationRef.current = null;
                  setOnlineLookupNotice(null);
                  setOnlineLookupSources([]);
                  setOnlineLookupResultLines([]);
                  setSourcePreview(null);
                  recordRecentAction("closed lookup box with X");
                  setThoughtPrompts(normalizeThoughtPrompts(DEFAULT_THOUGHT_PROMPTS));
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#e0aa62]/88 bg-[#3a2a1c]/82 text-[#f1c477] shadow-[0_8px_20px_rgba(0,0,0,0.32)]"
                style={{
                  backgroundColor: "rgba(58,42,28,0.94)",
                  borderColor: "#e0aa62",
                  color: "#f1c477",
                }}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text overlays at the top */}
      <div className="aiasap-logo-shell absolute top-0 left-0 right-0 z-10 flex flex-col items-center pt-5 sm:pt-6 pb-2 md:top-[max(0.25rem,calc(11.5vh-8.25rem))] md:pt-0">
        <div className="text-center px-4">
          <div className="flex flex-col items-center justify-start">
            <h1 className="aiasap-logo-mark relative inline-block overflow-visible px-5 pt-1 pb-2 bg-gradient-to-b from-[#d8aa71] via-[#b7834f] to-[#7f4f2b] bg-clip-text text-[clamp(2.18rem,4.25vh,3.55rem)] font-bold italic leading-none tracking-normal text-transparent drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)]">
              aiASAP
            </h1>
            <span className="aiasap-leap-line -mt-1.5 inline-block whitespace-nowrap bg-gradient-to-b from-[#d8aa71] via-[#b7834f] to-[#7f4f2b] bg-clip-text text-center font-black leading-none text-transparent drop-shadow-[0_2px_12px_rgba(0,0,0,0.78)]">
              Take the Leap
            </span>
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
        className={`aiasap-avatar-stage relative w-full flex-1 flex items-center justify-center md:px-8 `}
      >
        {/* Avatar video - full screen when active */}
        <video
          ref={videoRef}
          autoPlay // Native autoplay
          playsInline
          preload="auto"
          muted={true} // Start muted to prevent mouth movement during loading
          className="aiasap-avatar-video h-full w-full object-contain md:h-[90vh] md:max-h-[76rem] md:w-auto md:aspect-[9/16] md:rounded-[2.25rem] md:border md:border-[#a9784a]/18 md:bg-black/35 md:shadow-[0_0_0_1px_rgba(255,255,255,0.035),0_30px_90px_rgba(0,0,0,0.72)]"
          style={{
            borderColor: "#a9784a",
            boxShadow:
              "0 0 0 1px rgba(169,120,74,0.5), 0 30px 90px rgba(0,0,0,0.72)",
          }}
        />

      </div>

      {shouldShowLoadingSurface && (
        <div className="fixed inset-x-0 top-[54vh] z-30 flex -translate-y-1/2 justify-center px-4 pointer-events-none">
          <div className="text-center text-[#8f6540] drop-shadow-[0_10px_28px_rgba(0,0,0,0.72)]">
            <p className="text-[1.35rem] sm:text-[1.6rem] font-black uppercase tracking-[0.16em] text-[#a7774b]/78">
              Loading
            </p>
            <div className="mx-auto mt-3 h-1.5 w-36 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full w-1/2 animate-[loading-sweep_2.15s_ease-in-out_infinite] rounded-full bg-[#8f6540]" />
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

      {/* Fixed controls at bottom */}
      <>
          {!voiceIsActive && (
            <div className="aiasap-start-prompt fixed left-1/2 bottom-[7.85rem] sm:bottom-[8.35rem] md:bottom-[calc(16vh+7.5rem)] -translate-x-1/2 w-[94%] max-w-3xl z-20 px-3 flex flex-col items-center pointer-events-none">
              {sessionState !== SessionState.DISCONNECTED &&
                !isAvatarTalking &&
                isStreamReady && (
                  <div className="w-full flex items-center justify-center text-center">
                    <p className="px-1 w-full max-w-none text-balance">
                      {voiceStartAwaitingReady ? (
                        <span className="block">Starting…</span>
                      ) : (
                        <span
                          className="inline-flex min-h-[3.75rem] flex-col items-center justify-center gap-1 text-[#a9784a] drop-shadow-[0_10px_28px_rgba(0,0,0,0.6)]"
                          style={tapPromptFont}
                        >
                          <span className="aiasap-tap-line flex translate-y-0.5 items-center whitespace-nowrap font-black text-[#c9965d]/84">
                            <span>Tap/Click Anywhere</span>
                          </span>
                          <span className="aiasap-talk-line whitespace-nowrap text-[2.05rem] sm:text-[2.45rem] md:text-[2.65rem] font-semibold tracking-normal leading-none">
                            <span>To Talk To 6</span>
                          </span>
                        </span>
                      )}
                    </p>
                  </div>
                )}
            </div>
          )}

          {activeList && isShoppingMode && (
            <div
              className="fixed inset-0 z-[80] flex flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)]"
              onTouchStart={handleStickyNoteTouchStart}
              onTouchEnd={handleStickyNoteTouchEnd}
              style={{
                background: activeListUsesBlackTheme
                  ? `radial-gradient(circle at 14% 8%, ${colorWithAlpha(activeListShadePalette.light, 0.3)}, transparent 36%), linear-gradient(145deg, ${colorWithAlpha(activeListShadePalette.lift, 0.98)} 0%, ${colorWithAlpha(activeListShadePalette.dark, 0.98)} 52%, ${colorWithAlpha(activeListShadePalette.deep, 1)} 100%)`
                  : `radial-gradient(circle at 18% 8%, ${colorWithAlpha(activeListShadePalette.light, 0.24)}, transparent 36%), radial-gradient(circle at 88% 20%, ${colorWithAlpha(activeListShadePalette.solid, 0.12)}, transparent 38%), linear-gradient(145deg, ${colorWithAlpha(activeListShadePalette.lift, 0.46)} 0%, ${colorWithAlpha(activeListShadePalette.dark, 0.44)} 62%, ${colorWithAlpha(activeListShadePalette.deep, 0.5)} 100%)`,
                color: activeListTheme.foreground,
                colorScheme: "dark",
              }}
            >
              <div
                className="mb-4 flex items-center justify-between gap-3 rounded-[1.45rem] border px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.24)] backdrop-blur-md"
                style={compactListHeaderStyle}
              >
                <div className="min-w-0 flex-1 pl-14 text-center">
                  <p
                    className="text-xs font-bold uppercase tracking-[0.16em]"
                    style={compactListMutedStyle}
                  >
                    6 Listening
                  </p>
                  <h2
                    className="truncate text-3xl font-black leading-tight"
                    style={{ fontFamily: CTA_GOUDY_FONT_STACK }}
                  >
                    {activeList.title}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Close list"
                  title="Close list"
                  onClick={() => {
                    logAssistantListState("close", activeList, {
                      activeListId: null,
                      isShoppingMode: false,
                      visible: false,
                      detail: { source: "note_x" },
                    });
                    setIsShoppingMode(false);
                    setActiveListId(null);
                  }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition hover:scale-105"
                  style={compactListControlStyle}
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <div
                className="mb-5 h-1.5 w-full rounded-full shadow-[0_0_24px_currentColor]"
                style={{ backgroundColor: activeListTheme.solid }}
              />

              <div
                ref={shoppingListScrollRef}
                className="aiasap-list-scroll min-h-0 flex-1 overflow-y-auto rounded-[1.45rem] border px-4 py-4"
                style={{
                  ...compactListPanelStyle,
                  borderColor: activeListUsesBlackTheme
                    ? colorWithAlpha(activeListShadePalette.light, 0.28)
                    : colorWithAlpha(activeListTheme.foreground, 0.24),
                } as React.CSSProperties}
              >
                {activeList.items.length > 0 ? (
                  <ol className="text-[1.72rem] font-bold leading-tight">
                    {activeList.items.map((item, index) => (
                      <li
                        key={`${item}-${index}`}
                        data-list-index={index}
                        className="grid grid-cols-[2.8rem_1fr_3rem] items-center gap-3 rounded-[0.75rem] border px-3 py-2"
                        style={{
                          ...compactListRowStyle,
                          minHeight: "3.1rem",
                        }}
                      >
                        <span
                          className="flex h-10 w-10 items-center justify-center text-[1.22rem] font-black"
                          style={{
                            color: activeListPaperPalette.ink,
                            transform: "translateY(-0.18rem)",
                          }}
                        >
                          {activeList.displayStyle === "numbered"
                            ? `${index + 1}.`
                            : "•"}
                        </span>
                        <span
                          className="min-w-0 break-words"
                          style={{ transform: "translateY(-0.18rem)" }}
                        >
                          {item}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${item}`}
                          title={`Remove ${item}`}
                          onClick={() => removeListItemAtIndex(activeList.id, index)}
                          className="flex h-11 w-11 items-center justify-center rounded-full border transition hover:scale-105"
                          style={{
                            ...compactListControlStyle,
                            transform: "translateY(-0.12rem)",
                          }}
                        >
                          <X className="h-5 w-5" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div aria-hidden="true" className="min-h-full" />
                )}
              </div>
            </div>
          )}

          {sessionState !== SessionState.DISCONNECTED &&
            isStreamReady &&
            voiceIsActive &&
            !isShoppingMode &&
            !lookupPanelVisible &&
            activeList && (
              <div
                className="aiasap-compact-list-panel fixed left-1/2 bottom-[calc(env(safe-area-inset-bottom)+13.45rem)] z-30 flex h-[min(22vh,15.25rem)] min-h-[min(10.5rem,calc(100vh-25rem))] max-h-[15.25rem] w-[min(84vw,15rem)] max-w-[15rem] -translate-x-1/2 flex-col overflow-hidden rounded-[1.05rem] border shadow-[0_18px_48px_rgba(0,0,0,0.48)] backdrop-blur-md transition-[transform,box-shadow] duration-200 ease-out md:bottom-[calc(env(safe-area-inset-bottom)+18.85rem)] md:h-[min(18vh,14.75rem)] md:min-h-[min(10.25rem,calc(100vh-30rem))] md:max-h-[14.75rem] md:w-[min(58vw,21rem)] md:max-w-[21rem]"
                onTouchStart={handleStickyNoteTouchStart}
                onTouchEnd={handleStickyNoteTouchEnd}
                style={{
                  ...compactListPanelStyle,
                  "--aiasap-control-zone-top": "calc(var(--aiasap-lock-top) + 51.2dvh)",
                  transform:
                    listSwipeNudge === "left"
                      ? "translateX(calc(-50% - 12px)) scale(0.992)"
                      : listSwipeNudge === "right"
                        ? "translateX(calc(-50% + 12px)) scale(0.992)"
                        : "translateX(-50%)",
                } as React.CSSProperties}
              >
                <div
                  className="flex min-h-[3.25rem] items-center justify-between gap-2.5 border-b px-3.5 py-1.5"
                  style={compactListHeaderStyle}
                >
                  <div className="min-w-0 flex-1 pl-10 text-left">
                    <h2
                      className="truncate text-[1.62rem] font-black leading-none drop-shadow-[0_3px_16px_rgba(30,14,0,0.38)]"
                      style={{ fontFamily: CTA_GOUDY_FONT_STACK }}
                    >
                      {activeList.title}
                    </h2>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      aria-label="Close list"
                      title="Close list"
                      onClick={() => {
                        logAssistantListState("close", activeList, {
                          activeListId: null,
                          isShoppingMode: false,
                          visible: false,
                          detail: { source: "note_x" },
                        });
                        setIsShoppingMode(false);
                        setActiveListId(null);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full border-2 opacity-95 transition hover:scale-105 hover:opacity-100"
                      style={compactListControlStyle}
                    >
                      <X className="h-[1.1rem] w-[1.1rem] stroke-[3]" aria-hidden />
                    </button>
                  </div>
                </div>
                <div
                  ref={listScrollRef}
                  className="aiasap-list-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2"
                  style={{
                    ...compactListBodyStyle,
                  } as React.CSSProperties}
                >
                  {activeList.items.length > 0 ? (
                    <ol className="text-[1.05rem] font-bold leading-tight">
                      {activeList.items.map((item, index) => (
                        <li
                          key={`${item}-${index}`}
                          data-list-index={index}
                          className="grid grid-cols-[1.45rem_1fr_1.55rem] items-center gap-1.5 rounded-[0.75rem] border px-2 py-1"
                          style={{
                            ...compactListRowStyle,
                            minHeight: "2.46rem",
                          }}
                        >
                          <span
                            className="flex h-6 w-6 items-center justify-center text-[0.86rem] font-black"
                            style={{
                              color: activeListPaperPalette.ink,
                              transform: "translateY(-0.18rem)",
                            }}
                          >
                            {activeList.displayStyle === "numbered"
                              ? `${index + 1}.`
                              : "•"}
                          </span>
                          <span
                            className="min-w-0 break-words"
                            style={{ transform: "translateY(-0.18rem)" }}
                          >
                            {item}
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${item}`}
                            title={`Remove ${item}`}
                            onClick={() =>
                              removeListItemAtIndex(activeList.id, index)
                            }
                            className="flex h-6 w-6 items-center justify-center rounded-full border opacity-85 transition hover:scale-105 hover:opacity-100"
                            style={{
                              ...compactListControlStyle,
                              transform: "translateY(-0.14rem)",
                            }}
                          >
                            <X className="h-4 w-4" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div
                      aria-hidden="true"
                      className="h-full min-h-[2.32rem]"
                    />
                  )}
                </div>
              </div>
            )}

          {sessionState !== SessionState.DISCONNECTED &&
            isStreamReady &&
            voiceIsActive &&
            !activeList &&
            !lookupPanelVisible &&
            !emailEntryOpen && (
              <div
                className={`aiasap-thought-prompts ${
                  promptRowHasActiveList ? "aiasap-thought-prompts-list" : "aiasap-thought-prompts-open"
                } fixed left-1/2 z-30 flex w-[94%] max-w-[32rem] -translate-x-1/2 items-center text-center pointer-events-none ${
                  promptRowHasActiveList
                    ? "bottom-[calc(env(safe-area-inset-bottom)+2.72rem)] flex-row flex-wrap justify-center gap-1.5"
                    : "bottom-[calc(env(safe-area-inset-bottom)+var(--prompt-lift))] flex-col gap-1 md:bottom-[calc(8vh+10.25rem)] md:gap-1.5"
                }`}
                style={{
                  "--aiasap-control-zone-top": "calc(var(--aiasap-lock-top) + 56.4dvh)",
                  "--prompt-lift": `${11.75 + promptSizeLevel * 0.1}rem`,
                } as React.CSSProperties}
              >
                {visibleThoughtPrompts.slice(0, visiblePromptLimit).map((prompt, index) => {
                  const isDissolving = dissolvingPrompt === prompt;
                  const compactPrompt = prompt.length > 25;
                  return (
                    <button
                      type="button"
                      key={prompt}
                      onClick={() => void handleThoughtPromptTap(prompt)}
                      disabled={Boolean(dissolvingPrompt)}
                      className={`aiasap-thought-prompt pointer-events-auto overflow-hidden rounded-full border border-[#e0aa62]/60 bg-[#272a2f]/62 whitespace-nowrap text-ellipsis text-[var(--prompt-font-size)] font-semibold leading-none text-[#e0aa62] shadow-[inset_0_1px_10px_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-[3px] drop-shadow-[0_3px_16px_rgba(0,0,0,0.86)] transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none ${
                        promptRowHasActiveList
                          ? "min-h-[2.08rem] w-[calc(50%_-_0.25rem)] max-w-[10.2rem] px-2.5 py-1.5 text-[var(--prompt-font-size)]"
                          : "min-h-[2.28rem] w-[min(100%,15.25rem)] px-3.5 py-1.5 md:min-h-[2.6rem] md:w-[min(100%,20rem)] md:px-4 md:py-2 md:text-[calc(var(--prompt-font-size)+0.06rem)] xl:min-h-[2.72rem] xl:w-[min(100%,21.5rem)] xl:px-5 xl:py-2.5 xl:text-[calc(var(--prompt-font-size)+0.08rem)]"
                      } ${
                        isDissolving
                          ? "animate-prompt-dissolve"
                          : "animate-prompt-enter"
                      }`}
                      style={{
                        animationDelay: `${index * 80}ms`,
                        "--prompt-font-size": `${(promptRowHasActiveList ? 0.82 : compactPrompt ? 0.9 : 0.96) + promptSizeLevel * (promptRowHasActiveList ? 0.04 : 0.045)}rem`,
                        backgroundColor: "rgba(39,42,47,0.62)",
                        borderColor: "#a9784a",
                        color: "#a9784a",
                        fontFamily:
                          '"Trebuchet MS", "Aptos", "Segoe UI", system-ui, sans-serif',
                      } as React.CSSProperties}
                    >
                      {renderThoughtPromptLabel(prompt)}
                    </button>
                  );
                })}
              </div>
            )}

          {!isShoppingMode && (
            <div className="aiasap-footer fixed bottom-[calc(env(safe-area-inset-bottom)+1.05rem)] md:bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center pointer-events-auto">
              <div
                className="block text-center text-[10px] sm:text-[11px] text-[#a9784a]/72 whitespace-nowrap"
                style={{ color: "rgba(169, 120, 74, 0.72)" }}
              >
                &copy; 2026 aiASAP All Rights Reserved &middot;{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="hover:text-[#ba8550] transition-colors"
                >
                  Terms
                </Link>{" "}
                &middot;{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="hover:text-[#ba8550] transition-colors"
                >
                  Privacy Policy
                </Link>
              </div>
            </div>
          )}
      </>
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Sorts+Mill+Goudy:ital@0;1&display=swap");

        html,
        body {
          background:
            radial-gradient(ellipse at 50% 45%, rgba(42, 27, 18, 0.32) 0%, rgba(28, 18, 12, 0.72) 44%, rgba(8, 5, 4, 0.98) 76%, #000 100%);
        }

        .aiasap-viewport {
          height: 100vh !important;
          min-height: 100vh;
          background:
            radial-gradient(ellipse at 50% 45%, rgba(42, 27, 18, 0.32) 0%, rgba(28, 18, 12, 0.72) 44%, rgba(8, 5, 4, 0.98) 76%, #000 100%);
        }

        @supports (height: 100dvh) {
          .aiasap-viewport {
            height: 100dvh !important;
            min-height: 100dvh;
          }
        }

        @media (min-width: 768px) {
          .aiasap-viewport {
            background:
              radial-gradient(ellipse at 50% 45%, rgba(44, 28, 18, 0.34) 0%, rgba(27, 17, 11, 0.74) 45%, rgba(8, 5, 4, 0.98) 77%, #000 100%) !important;
          }
        }

        .aiasap-shell {
          --aiasap-lock-h: 100vh;
          --aiasap-lock-w: 100vw;
          --aiasap-lock-top: calc((100vh - var(--aiasap-lock-h)) / 2);
          --aiasap-lock-bottom-gap: calc(100vh - (var(--aiasap-lock-top) + var(--aiasap-lock-h)));
          min-height: var(--aiasap-lock-h);
        }

        @supports (height: 100dvh) {
          .aiasap-shell {
            --aiasap-lock-h: 100dvh;
            --aiasap-lock-top: 0px;
            --aiasap-lock-bottom-gap: 0px;
          }
        }

        .aiasap-logo-shell {
          left: 50% !important;
          right: auto !important;
          top: calc(var(--aiasap-lock-top) + 0.7rem) !important;
          width: var(--aiasap-lock-w) !important;
          padding-top: 0 !important;
          transform: translateX(-50%) !important;
        }

        .aiasap-leap-line {
          font-size: clamp(1.02rem, 2.08vh, 1.38rem);
          letter-spacing: clamp(0.18em, 0.48vh, 0.34em);
          text-indent: clamp(0.18em, 0.48vh, 0.34em);
          line-height: 1.18;
          margin-inline: 0;
          max-width: min(96vw, calc(var(--aiasap-lock-w, 100vw) + 4rem));
          overflow: visible;
          padding: 0 0.36em 0.12em;
          transform: none;
          transform-origin: center center;
        }

        .aiasap-tap-line {
          background: linear-gradient(to bottom, #f1c477 0%, #c28a4c 48%, #6f3e20 100%);
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent !important;
          font-family: ${CTA_GOUDY_FONT_STACK} !important;
          font-size: clamp(1.35rem, 3.18vh, 1.85rem);
          font-weight: 700 !important;
          letter-spacing: clamp(0.02em, 0.16vh, 0.055em);
        }

        .aiasap-talk-line {
          background: linear-gradient(to bottom, #f1c477 0%, #c28a4c 48%, #6f3e20 100%);
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent !important;
          font-family: ${CTA_GOUDY_FONT_STACK} !important;
          font-size: clamp(2.54rem, 6.82vh, 3.45rem);
          font-weight: 800;
          letter-spacing: 0;
          text-shadow: 0 5px 18px rgba(0, 0, 0, 0.72);
        }

        .aiasap-talk-tail {
          font-size: calc(1em - 5pt);
        }

        .aiasap-avatar-stage {
          min-height: var(--aiasap-lock-h);
          transform: none;
        }

        .aiasap-avatar-video {
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
          height: var(--aiasap-lock-h) !important;
          max-height: var(--aiasap-lock-h) !important;
          width: var(--aiasap-lock-w) !important;
          max-width: var(--aiasap-lock-w) !important;
          object-fit: cover !important;
          object-position: center center !important;
        }

        .aiasap-start-prompt {
          top: calc(var(--aiasap-lock-top) + var(--aiasap-lock-h) - 12.85rem) !important;
          bottom: auto !important;
          width: var(--aiasap-lock-w) !important;
          max-width: var(--aiasap-lock-w) !important;
          transform: translate(-50%, -50%) !important;
        }

        .aiasap-thought-prompts {
          top: var(--aiasap-control-zone-top, calc(var(--aiasap-lock-top) + 56.4dvh)) !important;
          bottom: auto !important;
          gap: 0.26rem !important;
          width: var(--aiasap-lock-w) !important;
          max-width: var(--aiasap-lock-w) !important;
        }

        .aiasap-thought-prompt {
          flex: none !important;
          height: 2.36rem !important;
          min-height: 2.36rem !important;
          width: min(100%, 64vw, 15.25rem) !important;
          max-width: 15.25rem !important;
          padding: 0 0.72rem !important;
          font-size: min(calc(var(--prompt-font-size) + 0.08rem), 1.08rem) !important;
          line-height: 1 !important;
        }

        .aiasap-prompt-amp {
          font-family: "Aptos", "Segoe UI", system-ui, sans-serif !important;
          font-weight: inherit;
        }

        .aiasap-compact-list-panel {
          top: var(--aiasap-control-zone-top, calc(var(--aiasap-lock-top) + 51.2dvh)) !important;
          bottom: auto !important;
          height: 13.25rem !important;
          min-height: 13.25rem !important;
          max-height: 13.25rem !important;
          width: min(var(--aiasap-lock-w), 88vw, 16rem) !important;
          max-width: 16rem !important;
        }

        .aiasap-footer {
          bottom: calc(var(--aiasap-lock-bottom-gap) + 1.05rem) !important;
          width: var(--aiasap-lock-w) !important;
        }

        .aiasap-list-scroll {
          scrollbar-color: var(--aiasap-list-scroll-thumb, rgba(215, 160, 90, 0.86)) var(--aiasap-list-scroll-track, rgba(18, 11, 8, 0.72));
          scrollbar-width: auto;
        }

        .aiasap-list-scroll::-webkit-scrollbar {
          width: 16px;
        }

        .aiasap-list-scroll::-webkit-scrollbar-track {
          background: var(--aiasap-list-scroll-track, rgba(18, 11, 8, 0.72));
          border-radius: 999px;
        }

        .aiasap-list-scroll::-webkit-scrollbar-button {
          background: linear-gradient(to bottom, #f2c986, var(--aiasap-list-scroll-thumb, #d7a05a) 52%, #7b4728);
          border-radius: 999px;
        }

        .aiasap-list-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #f2c986, var(--aiasap-list-scroll-thumb, #d7a05a) 52%, #7b4728);
          border-radius: 999px;
          border: 3px solid var(--aiasap-list-scroll-track, rgba(18, 11, 8, 0.72));
        }

        @media (min-width: 768px) {
          .aiasap-shell {
            --aiasap-lock-h: 90vh;
            --aiasap-lock-w: min(42.75rem, 50.625vh, 94vw);
            --aiasap-lock-top: calc((100vh - var(--aiasap-lock-h)) / 2);
            --aiasap-lock-bottom-gap: calc(100vh - (var(--aiasap-lock-top) + var(--aiasap-lock-h)));
          }

          .aiasap-logo-shell {
            position: fixed !important;
            top: calc(var(--aiasap-lock-top) + clamp(0.5rem, 1.1vh, 1rem)) !important;
            padding-top: 0 !important;
          }

          .aiasap-avatar-stage {
            min-height: 100vh;
            transform: none;
          }

          .aiasap-avatar-video {
            border: 1px solid #a9784a !important;
            border-radius: 2.25rem !important;
            box-shadow:
              0 0 0 1px rgba(169, 120, 74, 0.48),
              0 30px 90px rgba(0, 0, 0, 0.72) !important;
            background:
              radial-gradient(ellipse at 50% 46%, rgba(43, 27, 17, 0.28) 0%, rgba(27, 17, 11, 0.72) 56%, rgba(10, 6, 4, 0.98) 100%) !important;
            height: var(--aiasap-lock-h) !important;
            max-height: var(--aiasap-lock-h) !important;
          }

          .aiasap-start-prompt {
            position: fixed !important;
            top: calc(var(--aiasap-lock-top) + var(--aiasap-lock-h) - clamp(13.15rem, 22.5vh, 18.25rem)) !important;
            bottom: auto !important;
            transform: translate(-50%, -50%) !important;
          }

          .aiasap-tap-line {
            font-size: clamp(1.28rem, calc(2.35vh + 2pt), 1.62rem);
          }

          .aiasap-talk-line {
            font-size: clamp(2.35rem, calc(5.8vh + 2pt), 3.22rem);
            font-weight: 800;
            text-shadow: 0 5px 18px rgba(0, 0, 0, 0.72);
          }

          .aiasap-talk-tail {
            font-size: calc(1em - 8pt);
          }

          .aiasap-thought-prompts {
            top: calc(var(--aiasap-lock-top) + 45.5vh) !important;
            bottom: auto !important;
          }

          .aiasap-footer {
            position: fixed !important;
            bottom: calc(var(--aiasap-lock-bottom-gap) + 1rem) !important;
          }
        }

        @media (min-width: 700px) {
          .aiasap-thought-prompts {
            top: calc(var(--aiasap-lock-top) + 49.5vh) !important;
            bottom: auto !important;
            gap: 0.34rem !important;
          }

          .aiasap-thought-prompt {
            flex: 0 0 auto !important;
            height: 2.62rem !important;
            min-height: 2.62rem !important;
            width: min(100%, 58vw, 20rem) !important;
            max-width: 20rem !important;
            padding: 0 1rem !important;
          }

          .aiasap-thought-prompts-open {
            gap: 0.42rem !important;
            top: calc(var(--aiasap-lock-top) + 54.2vh) !important;
          }

          .aiasap-thought-prompts-open .aiasap-thought-prompt {
            flex: 0 0 auto !important;
            height: 3.08rem !important;
            min-height: 3.08rem !important;
            width: min(100%, 50vw, 16rem) !important;
            max-width: 16rem !important;
            padding-inline: 1rem !important;
            font-size: calc(var(--prompt-font-size) + 0.08rem) !important;
          }

          .aiasap-compact-list-panel {
            top: calc(var(--aiasap-lock-top) + 46.5vh) !important;
            bottom: auto !important;
            height: 20.5rem !important;
            min-height: 20.5rem !important;
            max-height: 20.5rem !important;
            width: min(var(--aiasap-lock-w), 62vw, 22.75rem) !important;
            max-width: 22.75rem !important;
          }
        }

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

        @media (min-width: 768px) and (max-height: 840px) {
          .aiasap-shell {
            --aiasap-lock-h: 88vh;
            --aiasap-lock-w: min(42.75rem, 49.5vh, 94vw);
          }

          .aiasap-avatar-stage {
            transform: none;
          }

          .aiasap-avatar-video {
            height: var(--aiasap-lock-h) !important;
          }

          .aiasap-thought-prompts {
            top: calc(var(--aiasap-lock-top) + 50.2vh) !important;
            bottom: auto !important;
            gap: 0.3rem !important;
            max-width: var(--aiasap-lock-w) !important;
            width: var(--aiasap-lock-w) !important;
          }

          .aiasap-thought-prompt {
            height: 2.24rem !important;
            min-height: 2.24rem !important;
            width: min(100%, 56vw, 16rem) !important;
            padding: 0 0.85rem !important;
            font-size: calc(var(--prompt-font-size) + 0.08rem) !important;
          }

          .aiasap-compact-list-panel {
            top: calc(var(--aiasap-lock-top) + 46.2vh) !important;
            bottom: auto !important;
            height: 13.25rem !important;
            min-height: 13.25rem !important;
            max-height: 13.25rem !important;
            width: min(var(--aiasap-lock-w), 62vw, 16rem) !important;
            max-width: 16rem !important;
          }
        }

        @media (min-width: 768px) and (max-height: 520px) {
          .aiasap-viewport {
            overflow-x: hidden;
            overflow-y: hidden;
          }

          .aiasap-shell {
            --aiasap-lock-h: 86vh;
            --aiasap-lock-w: min(42.75rem, 48.375vh, 42vw);
            --aiasap-lock-top: calc((100vh - var(--aiasap-lock-h)) / 2);
            --aiasap-lock-bottom-gap: calc(100vh - (var(--aiasap-lock-top) + var(--aiasap-lock-h)));
            min-height: 100vh;
          }

          .aiasap-avatar-stage {
            min-height: 100vh;
            transform: none;
          }

          .aiasap-avatar-video {
            height: var(--aiasap-lock-h) !important;
            max-height: var(--aiasap-lock-h) !important;
            width: var(--aiasap-lock-w) !important;
            max-width: var(--aiasap-lock-w) !important;
          }

          .aiasap-start-prompt {
            position: fixed !important;
            top: calc(var(--aiasap-lock-top) + var(--aiasap-lock-h) - clamp(6.15rem, 25vh, 9.65rem)) !important;
            bottom: auto !important;
            width: var(--aiasap-lock-w) !important;
            max-width: var(--aiasap-lock-w) !important;
            transform: translate(-50%, -50%) !important;
          }

          .aiasap-footer {
            position: fixed !important;
            bottom: calc(var(--aiasap-lock-bottom-gap) + 1rem) !important;
          }

          .aiasap-footer a {
            font-size: 7px !important;
          }

          .aiasap-talk-line {
            font-size: clamp(1.72rem, calc(6.6vh + 2pt), 2.45rem);
            font-weight: 800;
          }

          .aiasap-tap-line {
            font-size: clamp(0.88rem, calc(2.8vh + 2pt), 1.24rem);
            letter-spacing: 0.055em;
          }

          .aiasap-leap-line {
            font-size: clamp(0.84rem, 2.78vh, 1.08rem);
            letter-spacing: clamp(0.16em, 0.42vh, 0.3em);
            text-indent: clamp(0.16em, 0.42vh, 0.3em);
          }

          .aiasap-thought-prompts {
            top: calc(var(--aiasap-lock-top) + 43.4vh) !important;
            bottom: auto !important;
            display: flex !important;
            flex-direction: column !important;
            flex-wrap: nowrap !important;
            gap: 0.22rem !important;
            max-width: var(--aiasap-lock-w) !important;
            width: var(--aiasap-lock-w) !important;
          }

          .aiasap-thought-prompt {
            height: 1.7rem !important;
            min-height: 1.7rem !important;
            width: min(100%, 58vw, 15rem) !important;
            max-width: 15rem !important;
            padding: 0 0.58rem !important;
            font-size: 0.88rem !important;
            line-height: 1 !important;
          }

          .aiasap-compact-list-panel {
            top: calc(var(--aiasap-lock-top) + 41vh) !important;
            bottom: auto !important;
            height: 8.25rem !important;
            min-height: 8.25rem !important;
            max-height: 8.25rem !important;
            width: min(var(--aiasap-lock-w), 62vw, 11.25rem) !important;
            max-width: 11.25rem !important;
          }
        }

        @media (min-width: 768px) and (min-height: 841px) {
          .aiasap-avatar-stage {
            transform: none;
          }
        }

        @media (min-width: 768px) and (max-width: 900px) and (min-height: 841px) {
          .aiasap-thought-prompts-open {
            top: calc(var(--aiasap-lock-top) + 61.5vh) !important;
          }
        }

        @media (min-width: 700px) and (max-width: 767px) and (min-height: 841px) {
          .aiasap-thought-prompts-open {
            top: calc(var(--aiasap-lock-top) + 59.9vh) !important;
          }
        }

        @media (min-width: 768px) {
          .aiasap-leap-line {
            letter-spacing: clamp(0.18em, 0.48vh, 0.34em) !important;
            text-indent: clamp(0.18em, 0.48vh, 0.34em) !important;
            margin-inline: 0 !important;
            padding-inline: 0.36em !important;
          }
        }

        @media (min-width: 700px) and (max-width: 900px) and (min-height: 841px) {
          .aiasap-logo-mark {
            font-size: clamp(2.35rem, 4.65vh, 3.8rem) !important;
          }

          .aiasap-leap-line {
            letter-spacing: clamp(0.16em, 0.42vh, 0.3em) !important;
            text-indent: clamp(0.16em, 0.42vh, 0.3em) !important;
            margin-inline: 0 !important;
            padding-inline: 0.34em !important;
          }

          .aiasap-thought-prompts-open {
            top: calc(var(--aiasap-lock-top) + 57.5vh) !important;
          }

          .aiasap-thought-prompts-open .aiasap-thought-prompt {
            width: min(100%, 46vw, 15rem) !important;
            max-width: 15rem !important;
          }
        }

        @media (min-width: 700px) and (max-width: 900px) and (min-height: 841px) and (hover: hover) and (pointer: fine) {
          .aiasap-tap-line {
            background: linear-gradient(to bottom, #f1c477 0%, #c28a4c 48%, #6f3e20 100%) !important;
            background-clip: text !important;
            -webkit-background-clip: text !important;
            color: transparent !important;
            filter: drop-shadow(0 2px 12px rgba(0, 0, 0, 0.78)) !important;
            font-size: clamp(1.31rem, 2.57vh, 1.62rem) !important;
          }

          .aiasap-talk-line {
            background: linear-gradient(to bottom, #f1c477 0%, #c28a4c 48%, #6f3e20 100%) !important;
            background-clip: text !important;
            -webkit-background-clip: text !important;
            color: transparent !important;
            filter: drop-shadow(0 2px 12px rgba(0, 0, 0, 0.78)) !important;
            font-family: ${CTA_GOUDY_FONT_STACK} !important;
            font-size: clamp(2.61rem, 5.36vh, 3.2rem) !important;
            font-weight: 800 !important;
            letter-spacing: clamp(0.18em, 0.9vh, 0.26em) !important;
            line-height: 1 !important;
            text-indent: clamp(0.18em, 0.9vh, 0.26em) !important;
            text-shadow: none !important;
          }

          .aiasap-thought-prompts-open {
            gap: 0.5rem !important;
            top: calc(var(--aiasap-lock-top) + 57.5vh + 0.125rem) !important;
          }

          .aiasap-thought-prompts-open .aiasap-thought-prompt {
            height: 4.32875rem !important;
            min-height: 4.32875rem !important;
            width: min(100%, 82vw, 26.75rem) !important;
            max-width: 26.75rem !important;
            padding-inline: 1.18rem !important;
            font-size: min(calc(var(--prompt-font-size) + 0.56rem), 1.52rem) !important;
          }
        }

        @media (min-width: 901px) and (max-width: 1999px) and (min-height: 680px) {
          .aiasap-logo-mark {
            font-size: clamp(2.05rem, 4.05vh, 3.38rem) !important;
          }

          .aiasap-start-prompt {
            left: 50% !important;
            transform: translate(-50%, -62%) !important;
            width: var(--aiasap-lock-w) !important;
            max-width: var(--aiasap-lock-w) !important;
            align-items: center !important;
            text-align: center !important;
          }

          .aiasap-tap-line {
            justify-content: center !important;
            width: 100% !important;
            font-size: clamp(1.06rem, calc(1.95vh + 1.66pt), 1.34rem) !important;
            letter-spacing: 0 !important;
            text-indent: 0 !important;
          }

          .aiasap-talk-line {
            display: flex !important;
            justify-content: center !important;
            width: 100% !important;
            font-size: clamp(1.95rem, calc(4.83vh + 1.66pt), 2.69rem) !important;
            letter-spacing: 0 !important;
            text-indent: 0 !important;
          }

          .aiasap-thought-prompts-open {
            gap: 0.24rem !important;
            top: calc(var(--aiasap-lock-top) + 47.6vh) !important;
          }

          .aiasap-thought-prompts-open .aiasap-thought-prompt {
            height: 2.36rem !important;
            min-height: 2.36rem !important;
            width: min(100%, 41vw, 15.5rem) !important;
            max-width: 15.5rem !important;
            padding-inline: 0.72rem !important;
            font-size: min(calc(var(--prompt-font-size) + 0.02rem), 1.04rem) !important;
          }
        }

        @media (min-width: 700px) and (max-width: 1999px) and (min-height: 1000px) and (any-pointer: fine) {
          .aiasap-start-prompt {
            top: calc(var(--aiasap-lock-top) + var(--aiasap-lock-h) - clamp(17.2rem, 29.25vh, 22.625rem)) !important;
          }

          .aiasap-tap-line,
          .aiasap-talk-line {
            background: linear-gradient(to bottom, #f1c477 0%, #c28a4c 48%, #6f3e20 100%) !important;
            background-clip: text !important;
            -webkit-background-clip: text !important;
            color: transparent !important;
            filter: drop-shadow(0 2px 12px rgba(0, 0, 0, 0.78)) !important;
          }

          .aiasap-talk-line {
            font-family: ${CTA_GOUDY_FONT_STACK} !important;
            font-size: clamp(3.85rem, calc(9.35vh + 3.1pt), 5.25rem) !important;
            font-weight: 800 !important;
            text-shadow: none !important;
          }

          .aiasap-tap-line {
            font-size: clamp(2.03rem, calc(3.85vh + 3.1pt), 2.63rem) !important;
          }

          .aiasap-thought-prompts-open {
            top: calc(var(--aiasap-lock-top) + 49.2vh + 0.375rem) !important;
          }

          .aiasap-thought-prompts-open .aiasap-thought-prompt {
            height: 4.26625rem !important;
            min-height: 4.26625rem !important;
            width: min(100%, 82vw, 24.75rem) !important;
            max-width: 24.75rem !important;
            font-size: min(calc(var(--prompt-font-size) + 0.56rem), 1.52rem) !important;
          }

          .aiasap-compact-list-panel {
            width: min(var(--aiasap-lock-w), 76vw, 28rem) !important;
            max-width: 28rem !important;
          }

          .aiasap-list-scroll {
            scrollbar-width: auto;
          }

          .aiasap-list-scroll::-webkit-scrollbar {
            width: 18px;
          }

          .aiasap-list-scroll::-webkit-scrollbar-thumb {
            border-width: 3px;
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
    </div>
  );
};

export const LiveAvatarSession: React.FC<{
  sessionAccessToken: string;
  onSessionStopped: (opts?: SessionStoppedReason) => void;
  onExit?: () => void;
}> = ({ sessionAccessToken, onSessionStopped, onExit }) => {
  return (
    <LiveAvatarContextProvider sessionAccessToken={sessionAccessToken}>
      <LiveAvatarSessionComponent
        onSessionStopped={onSessionStopped}
        onExit={onExit}
      />
    </LiveAvatarContextProvider>
  );
};
