import {
  MAX_OPENAI_USER_MESSAGE_CHARS,
  assertAllowedOrigin,
  truncateUtf8String,
} from "../../../src/lib/apiRouteSecurity";
import { checkRateLimit } from "../../../src/lib/rateLimit";
import { OPENAI_API_KEY } from "../secrets";

const OPENAI_MODEL =
  process.env.OPENAI_PROMPT_BRAIN_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-4.1-mini";

const PRIMARY_OPENING_PROMPTS = [
  "Build Relationships",
  "Create Financial Freedom",
  "Set & Track Goals",
  "Build Your Socials",
];
const PRIMARY_PROMPT_FEED = [
  ...PRIMARY_OPENING_PROMPTS,
  "Create a Shopping List",
  "Build a Better Life",
  "Make More Money",
  "Find Your Life Partner",
  "Build a Business",
  "Build Friendships",
  "Build Your Brand",
  "Market Yourself",
  "Create WalMart List",
  "Create To Do List",
  "Plan Your Weekend",
  "Market Your Product",
  "Market Your Service",
  "Next Vacation Ideas",
];
function fallbackPrompts(): string[] {
  return PRIMARY_OPENING_PROMPTS;
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
const RELATIONSHIP_GOAL_PROMPTS = [
  "Choose One Relationship",
  "Be Fully Honest",
  "Own Your Part",
  "Plan Better Talk",
];
const HEALTHY_FOOD_PROMPTS = [
  "Cut Sugar Plan",
  "Find Hidden Sugar",
  "Plan Better Snacks",
  "Swap Unhealthy Foods",
];
const BETTER_LIFE_PROMPTS = [
  "Set & Track Goals",
  "Make More Money",
  "Fix One Problem",
  "Make Action Plan",
];
const FRIENDSHIP_PROMPTS = [
  "Meet New People",
  "Find a Hobby",
  "Reconnect With Someone",
  "Find Local Groups",
];
const SOCIAL_PROMPTS = ["Build Full Brand", "Create Content", "Link Accounts", "Post Everywhere"];
const BRAND_PROMPTS = ["Build Your Brand", "Market Yourself", "Define Your Audience", "Write First Post"];
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

const HIKING_CONTEXT_RE =
  /\b(?:hike|hikes|hiking|trail|trails|park|parks|outside|outdoor|outdoors|waterfall|waterfalls)\b/i;
const HIKING_PROMPT_RE = /\b(?:hike|hikes|hiking|trail|trails)\b/i;
const DATING_CONTEXT_RE =
  /\b(?:find your life partner|get that guy|get that girl|win them over|plan first message|ask them out|plan a date|boyfriend|girlfriend|crush|dating|date night|date ideas|romantic|romance|ask (?:him|her|them) out|win (?:him|her|them) over|life partner|future partner|talking about (?:a\s+)?(?:girl|woman|guy|man)|(?:girl|woman|guy|man)\s+i\s+like)\b/i;
const RELATIONSHIP_GOALS_CONTEXT_RE =
  /\b(?:set relationship goals?|relationship goals?|relationship conflict|conflict with|fighting with|fight(?:ing)? with|argu(?:e|ing|ment)s? with|having (?:a\s+)?fight|having (?:an\s+)?argument|not speaking|mad at|angry with|upset with|improve (?:a|my|our|the)? relationship|relationship with (?:my|our|their)?\s*(?:parent|parents|mom|mother|dad|father|kid|kids|child|children|son|daughter|spouse|wife|husband|partner|boyfriend|girlfriend|friend|friends|family|sibling|brother|sister|coworker|boss|neighbor)|family relationships?)\b/i;
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
const BUSINESS_CONTEXT_RE =
  /\b(?:build (?:a|my|the)? business|business ideas|likes and loves|your passions|what you're good at|business|company|startup|mom and pop|small business|local business|first customer|first sale)\b/i;
const AI_CONSULTANT_CONTEXT_RE =
  /\b(?:ai consultant|ai consulting|ai strategy|ai service|ai services|ai boom|technology and ai)\b/i;
const WEEKEND_CONTEXT_RE =
  /\b(?:plan your weekend|find nearby events|plan the day|pick best option|make weekend list|weekend plans?|plan (?:my|your|this|the)? weekend|nearby events?|local events?|cool things to do|cool stuff(?: to do)?|things to do|great movies?|movies?)\b/i;
const LIST_CONTEXT_RE =
  /\b(?:create a shopping list|create a to[-\s]?do list|to[-\s]?do|todo|task|shopping|grocery|groceries|walmart|home depot|list)\b/i;
const LIST_START_CHOICE_PROMPTS = [
  "Create a Shopping List",
  "Create To Do List",
  "Create Walmart List",
  "Other List",
];
const BROAD_PROMPT_MIX_FEEDBACK_RE =
  /\b(?:main prompts?|initial prompts?|top four|first four|all\s+(?:4|four)\s+together|coming up too much|mix\s+(?:them|it|a\s+build|build a better life)|make more money.{0,90}(?:number|first|second|forth|fourth)|number\s+(?:1|2).{0,90}make more money)\b/i;
const CTA_TEXT_DESIGN_FEEDBACK_RE =
  /\b(?:tap\/?click|tap click|tap,?\s*click|tap\/click anywhere|tap click anywhere|to talk to 6|talk to 6|top two lines|all the text|color fade|colors? fade|fade (?:inside|within)|letter fade|goudy|gaud(?:i|\u00ed)|font options?|open in the browser like we did|in the thread|in the conversation)\b|\b(?:text|letters?|lettering).{0,90}\b(?:yellow|gold(?:en)?|brown(?:er)?|fade|shade)\b|\b(?:yellow|gold(?:en)?|brown(?:er)?|shade).{0,90}\b(?:text|letters?|lettering)\b/i;
const LIST_UI_META_FEEDBACK_RE =
  /\b(?:sticky\s+notes?|list\s+box|lists?|notes?)\b.{0,140}\b(?:already\s+open(?:ed)?|should\s+not\s+open|shouldn'?t\s+open|one\s+or\s+the\s+other\s+should\s+happen|falling\s+apart|does\s+not\s+seem\s+to\s+look\s+like|doesn'?t\s+seem\s+to\s+look\s+like|does\s+not\s+make\s+sense|doesn'?t\s+make\s+sense|no\s+lists?\s+open|from\s+the\s+list\s+much\s+better|not\s+option\s+6|fade|yellow|brown|lighter|darker|overall\s+look|needs?\s+to\s+be\s+wider|wider|smidges?\s+on\s+the\s+(?:right|left)|go\s+down\s+(?:two|2)\s+smidges?|keep\s+the\s+top\s+exactly\s+where\s+it\s+is)\b|\b(?:does\s+not\s+make\s+sense|doesn'?t\s+make\s+sense|no\s+lists?\s+open|called\s+(?:another|nother|different|other)\s+list|fade|yellow|brown|lighter|darker|overall\s+look|needs?\s+to\s+be\s+wider|wider|smidges?\s+on\s+the\s+(?:right|left)|go\s+down\s+(?:two|2)\s+smidges?|keep\s+the\s+top\s+exactly\s+where\s+it\s+is)\b.{0,140}\b(?:sticky\s+notes?|list\s+box|lists?|notes?|this|prompt|prompts?)\b|\b(?:already\s+open(?:ed)?|should\s+not\s+open|shouldn'?t\s+open|one\s+or\s+the\s+other\s+should\s+happen|really\s+falling\s+apart|falling\s+apart\s+here|things\s+are\s+really\s+falling\s+apart|not\s+option\s+6|so\s+the\s+fade|smidges?\s+on\s+the\s+(?:right|left)|go\s+down\s+(?:two|2)\s+smidges?|keep\s+the\s+top\s+exactly\s+where\s+it\s+is)\b/i;

const BLOCKED_PROMPT_RE =
  /\b(?:contact|contacts|named g|for g|with g|call g|text g|email g|remind|reminder|notify|notification|g's|change subject|confirm understanding|review key points|check understanding|complete your question|complete your thought|clarify your thought|improve conversation flow|practice speaking clearly|explain your idea|finish your thought|discuss challenges|discuss possible solutions|plan next steps|ask for help|ask for more details|summarize conversation|clarify (?:his|the)? limitations|possible solutions|explore plan this weekend|compare popular codecs|explain (?:different |video |audio )?codecs?|list codec uses|c[\s.-]*o[\s.-]*d[\s.-]*e[\s.-]*c[\s.-]*s?|adjust box spacing|compare font sizes|review layout options|optimize text alignment|text alignment|font sizes|box spacing|everything|forward|ford|now|now it's|wow|man|however|why|why can'?t he|why can he|there|all right|before moving forward|he told me he couldn'?t|he told me he could not|six told me he couldn'?t|six told me he could not|said the four|wigging out|like to[-\s]?do list|oh my god|holy shit|market of crafts galore|four boxes|4 boxes|under there|pillboxes?|box should|box is minuscule|almost touching the sides|top button|white box|white boxes|white circle|where did this list come from|plan weekend plans|no\s+(?:date night ideas?|local hikes?|nearby events?|weekend plans?)|i don'?t like the way that sounds|should ask me|do i want to|went away|box came up|big and square|came up pink|being quiet|on purpose|not talking|screenshot|transcription|supabase|codex is monitoring|zip code|should not (?:pop up|come up)|toggle|toggling)\b/i;
const PROMPT_CONTEXT_FEEDBACK_RE =
  /\b(?:why can'?t he|why can he|he told me he couldn'?t|he told me he could not|six told me he couldn'?t|six told me he could not|before moving forward|brand colors?|white boxes?|white circles?|screenshot|screen|tap anywhere|tap\/click|talk to 6|talk(?:ing)? to me|talking to codex|talking right now to codex|normal conversation|pillboxes?|pill boxes?|prompt labels?|things below|say something like|outside of the box|inside the box|north[-\s]?south|complete your question|complete your thought|clarify your thought|improve conversation flow|practice speaking clearly|explain your idea|explore plan this weekend|what does .*plan this weekend.*mean|what does .*(?:codecs?|c[\s.-]*o[\s.-]*d[\s.-]*e[\s.-]*c[\s.-]*s?).*mean|(?:compare popular codecs|explain (?:different |video |audio )?codecs?|list codec uses).*(?:comes?|came|pops?|popped|shows?|showed) up|find places to hike.*(?:comes?|came|pops?|popped|shows?|showed) up|should not come up|adjust box spacing|compare font sizes|review layout options|optimize text alignment|text alignment|font sizes|box spacing|box should|box is minuscule|almost touching the sides|top button|low on the screen|start it in the middle|full size|blank list|different color|make those changes|stop it here|date night ideas? has got to go|you don'?t want to have date nights?|90[-\s]?year[-\s]?old|6[-\s]?year[-\s]?old|not fitting into the screen|pillboxes? (?:are )?awkward|crammed in|shorten the box|where did this list come from|plan weekend plans|no\s+(?:date night ideas?|local hikes?|nearby events?|weekend plans?)|i don'?t like the way that sounds|should ask me|do i want to|went away|box came up|big and square|came up pink|being quiet|on purpose|not talking|transcription|supabase|codex is monitoring|zip code|should not (?:pop up|come up)|things? should toggle|buttons? should toggle|toggle|toggling)\b/i;
const OPENING_LEAD_OR_LIST_FEEDBACK_RE =
  /\b(?:(?:build a business|build a better life|build friendships|build relationships|make friends|make more friends|build your socials|market your product|market your service|next vacation ideas|get that guy|get that girl|win them over|plan first message|ask them out|plan a date|shopping list|find places to hike|plan (?:this|your) weekend|make a (?:grocery|shopping) list|to do list|make more money|build financial freedom|create financial freedom).{0,80}(?:should\s+be|should\s+show|prompt(?:s)?|leads?|often\s+used|used\s+often|comes?|came|pops?|popped|shows?|showed)|opening leads?|primary (?:pill )?prompts?|prompt feed|idea boxes?|leads? inside|inside the pill boxes|started? out with|take a hike|much more generic|appl(?:y|ies) to most people|social site'?s algorithm|i (?:do not|don'?t|dont|didn'?t|did not) ask(?:ed)? for (?:a )?list|system brings? (?:a )?list(?: box)? up|list (?:box )?(?:came|comes|came up|comes up)|only after (?:the )?user asks?|6 confirms|can'?t assume that everyone needs|cannot assume that everyone needs|small box|too small|wider and taller|terms line)\b/i;
const PROMPT_LABEL_META_FEEDBACK_RE =
  /\b(?:says?|said|show(?:s|ed|ing)?|came\s+up|comes\s+up|popped\s+up|first\s+screenshot|screenshot|screen|middle\s+of\s+(?:that|the)\s+conversation|where\s+it\s+says|the\s+four|4\s+boxes|pillboxes?|pill\s+boxes?|prompts?)\b.{0,160}\b(?:build a business|build a better life|build friendships|build relationships|make friends|make more friends|build your socials|market your product|market your service|next vacation ideas|get that guy|get that girl|win them over|plan first message|ask them out|plan a date|find places to hike|plan (?:this|your) weekend|make a (?:grocery|shopping) list|to[-\s]?do list|make more money|build financial freedom|create financial freedom|shopping list)\b|\b(?:build a business|build a better life|build friendships|build relationships|make friends|make more friends|build your socials|market your product|market your service|next vacation ideas|get that guy|get that girl|win them over|plan first message|ask them out|plan a date|find places to hike|plan (?:this|your) weekend|make a (?:grocery|shopping) list|to[-\s]?do list|make more money|build financial freedom|create financial freedom|shopping list)\b.{0,160}\b(?:says?|said|show(?:s|ed|ing)?|prompt(?:s)?|pillboxes?|pill\s+boxes?|boxes|screenshot|screen|should\s+be|should\s+show|should\s+not)\b|\b(?:should\s+(?:not\s+)?be\b.{0,80}\bprompts?|prompts?\b.{0,80}\b(?:talking\s+about|girl|woman|guy|man)|(?:talking\s+about\s+(?:a\s+)?(?:girl|woman|guy|man)).{0,80}\bprompts?)\b/i;
const CURRENT_GENERAL_PROMPT_LABEL_FEEDBACK_RE =
  /\b(?:create financial freedom|build friendships|build relationships\/friends|build relationships|make friends|create a shopping list|find your life partner|build your brand|build your socials|market yourself|create a to[-\s]?do list|set\s*(?:\/|&)\s*track life goals?|be fully honest|pick one person|own your part|plan better talk)\b.{0,120}\b(?:should|prompt(?:s)?|pillboxes?|pill\s+boxes?|boxes|comes?|came|pops?|popped|shows?|showed|top\s*4|top four|bottom list|opening leads?|feed|label|used?)\b|\b(?:should|prompt(?:s)?|pillboxes?|pill\s+boxes?|boxes|comes?|came|pops?|popped|shows?|showed|top\s*4|top four|bottom list|opening leads?|feed|label|used?)\b.{0,120}\b(?:create financial freedom|build friendships|build relationships\/friends|build relationships|make friends|create a shopping list|find your life partner|build your brand|build your socials|market yourself|create a to[-\s]?do list|set\s*(?:\/|&)\s*track life goals?|be fully honest|pick one person|own your part|plan better talk)\b/i;
const GOAL_PROMPT_LABEL_FEEDBACK_RE =
  /\b(?:set goals?|set (?:life|relationship|business|money|social|health|family|work|personal|career|fitness|home) goals?)\b.{0,100}\b(?:never works|two words?|should|prompt(?:s)?|labels?|boxes?|pillboxes?|comes?\s+up|came\s+up|shows?|showed|used?|use)\b|\b(?:never works|two words?|should|prompt(?:s)?|labels?|boxes?|pillboxes?|comes?\s+up|came\s+up|shows?|showed|used?|use)\b.{0,100}\b(?:set goals?|set (?:life|relationship|business|money|social|health|family|work|personal|career|fitness|home) goals?)\b/i;
const STANDALONE_FRAGMENT_RE =
  /^(?:why|there|all right|before moving forward)$/i;

const LOWERCASE_TITLE_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "with",
]);

function toPromptTitleCase(value: string): string {
  return value
    .split(" ")
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (/^aiasap$/i.test(word) || /^ai[-\s]?asap$/i.test(word)) {
        return "aiASAP";
      }
      if (lower === "todo" || lower === "to-do") {
        return "To Do";
      }
      const previousLower = value.split(" ")[index - 1]?.toLowerCase();
      const nextLower = value.split(" ")[index + 1]?.toLowerCase();
      if (lower === "to" && nextLower === "do") {
        return "To";
      }
      if (lower === "do" && previousLower === "to") {
        return "Do";
      }
      if (index > 0 && LOWERCASE_TITLE_WORDS.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function cleanPrompt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/^\s*(?:\d+[\).:-]?|[-*])\s*/u, "")
    .replace(/\bAI\s+ASAP\b/g, "aiASAP")
    .replace(/\bai[-\s]?asap\b/gi, "aiASAP")
    .replace(/\bto[-\s]?do\b/gi, "To Do")
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
    .replace(/\bMake\s+(?:a\s+)?(?:Grocery|Shopping)\s+List\b/gi, "Create a Shopping List")
    .replace(/^(?:Grocery|Shopping)\s+List$/gi, "Create a Shopping List")
    .replace(/\bExplore\s+Plan\s+(?:This|Your)\s+Weekend\b/gi, "Plan Your Weekend")
    .replace(/\bPlan\s+This\s+Weekend\b/gi, "Plan Your Weekend")
    .replace(/\bPlan\s+Weekend\s+Plans\b/gi, "Plan Your Weekend")
    .replace(/\bWeekend\s+Plans\b/gi, "Plan Your Weekend")
    .replace(/\bactivities\b/gi, "plans")
    .replace(/\bactivity\b/gi, "plan")
    .replace(/[.!?。！？]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/^set\s+goals?$/i.test(cleaned)) return "Set & Track Goals";

  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (wordCount < 2 || wordCount > 4) return null;
  if (cleaned.length < 3 || cleaned.length > 32) return null;
  if (BLOCKED_PROMPT_RE.test(cleaned)) return null;
  if (/^take a hike$/i.test(cleaned)) return null;
  return toPromptTitleCase(cleaned);
}

function keepExploreAiASAPLow(prompts: string[]): string[] {
  const explore = prompts.find((prompt) => /^explore\s+aiasap$/i.test(prompt));
  if (!explore) return prompts;
  return [
    ...prompts.filter((prompt) => !/^explore\s+aiasap$/i.test(prompt)),
    "Explore aiASAP",
  ];
}

function isBuildPromptLabel(prompt: string): boolean {
  return /^build\b/i.test(prompt.trim());
}

function balanceBuildPromptMix(prompts: string[]): string[] {
  const unique = prompts.filter((prompt, index, all) => all.indexOf(prompt) === index);
  const firstFour = unique.slice(0, PRIMARY_OPENING_PROMPTS.length);
  if (firstFour.join("\n") === PRIMARY_OPENING_PROMPTS.join("\n")) {
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

function datingPromptsForContext(contextText: string): string[] | null {
  if (!DATING_CONTEXT_RE.test(contextText)) return null;
  const targetPrompt =
    /\b(?:guy|boyfriend|him)\b/i.test(contextText)
      ? "Get That Guy"
      : /\b(?:girl|girlfriend|her)\b/i.test(contextText)
        ? "Get That Girl"
        : "Win Them Over";
  return [targetPrompt, "Plan First Message", "Ask Them Out", "Plan a Date"];
}

function focusedPromptsForContext(contextText: string): string[] | null {
  if (BROAD_PROMPT_MIX_FEEDBACK_RE.test(contextText)) {
    return BROAD_MIXED_PROMPTS;
  }
  if (RELATIONSHIP_GOALS_CONTEXT_RE.test(contextText)) {
    return RELATIONSHIP_GOAL_PROMPTS;
  }
  if (DATING_CONTEXT_RE.test(contextText)) return datingPromptsForContext(contextText);
  if (AI_CONSULTANT_CONTEXT_RE.test(contextText)) {
    return AI_CONSULTANT_PROMPTS;
  }
  if (FRIENDSHIP_CONTEXT_RE.test(contextText)) {
    return FRIENDSHIP_PROMPTS;
  }
  if (WEEKEND_CONTEXT_RE.test(contextText)) {
    return ["Cool Stuff to Do", "Go on a Hike", "Find a Great Movie", "Find Local Events"];
  }
  if (SIDE_HUSTLE_CONTEXT_RE.test(contextText)) {
    return SIDE_HUSTLE_PROMPTS;
  }
  if (BUSINESS_CONTEXT_RE.test(contextText)) {
    return EARLY_BUSINESS_PROMPTS;
  }
  if (BRAND_CONTEXT_RE.test(contextText)) {
    return BRAND_PROMPTS;
  }
  if (SOCIAL_CONTEXT_RE.test(contextText)) {
    return SOCIAL_PROMPTS;
  }
  if (MARKETING_CONTEXT_RE.test(contextText)) {
    return /\bservice\b/i.test(contextText)
      ? ["Market Your Service", "Find Best Customer", "Write Service Offer", "Plan First Sale"]
      : ["Market Your Product", "Find Best Buyer", "Write Product Pitch", "Plan First Sale"];
  }
  if (HEALTHY_FOOD_CONTEXT_RE.test(contextText)) {
    return HEALTHY_FOOD_PROMPTS;
  }
  if (BETTER_LIFE_CONTEXT_RE.test(contextText)) {
    return BETTER_LIFE_PROMPTS;
  }
  if (MONEY_CONTEXT_RE.test(contextText)) {
    return MONEY_PROMPTS;
  }
  if (HIKING_CONTEXT_RE.test(contextText)) {
    return ["Find Places to Hike", "Check the Weather", "Give ZIP Code", "Easy Places to Hike"];
  }
  if (LIST_CONTEXT_RE.test(contextText)) return LIST_START_CHOICE_PROMPTS;
  return null;
}

function focusedPromptsForProductFeedbackContext(contextText: string): string[] | null {
  if (LIST_UI_META_FEEDBACK_RE.test(contextText)) {
    return fallbackPrompts();
  }
  if (BROAD_PROMPT_MIX_FEEDBACK_RE.test(contextText)) {
    return BROAD_MIXED_PROMPTS;
  }
  if (RELATIONSHIP_GOALS_CONTEXT_RE.test(contextText)) {
    return RELATIONSHIP_GOAL_PROMPTS;
  }
  if (DATING_CONTEXT_RE.test(contextText)) {
    return datingPromptsForContext(contextText);
  }
  if (AI_CONSULTANT_CONTEXT_RE.test(contextText)) {
    return AI_CONSULTANT_PROMPTS;
  }
  if (FRIENDSHIP_CONTEXT_RE.test(contextText)) {
    return FRIENDSHIP_PROMPTS;
  }
  if (WEEKEND_CONTEXT_RE.test(contextText)) {
    return ["Cool Stuff to Do", "Go on a Hike", "Find a Great Movie", "Find Local Events"];
  }
  if (SIDE_HUSTLE_CONTEXT_RE.test(contextText)) {
    return SIDE_HUSTLE_PROMPTS;
  }
  if (BUSINESS_CONTEXT_RE.test(contextText)) {
    return EARLY_BUSINESS_PROMPTS;
  }
  if (SOCIAL_CONTEXT_RE.test(contextText)) {
    return SOCIAL_PROMPTS;
  }
  if (BRAND_CONTEXT_RE.test(contextText)) {
    return BRAND_PROMPTS;
  }
  if (MARKETING_CONTEXT_RE.test(contextText)) {
    return /\bservice\b/i.test(contextText)
      ? ["Market Your Service", "Find Best Customer", "Write Service Offer", "Plan First Sale"]
      : ["Market Your Product", "Find Best Buyer", "Write Product Pitch", "Plan First Sale"];
  }
  if (MONEY_CONTEXT_RE.test(contextText)) {
    return MONEY_PROMPTS;
  }
  if (HEALTHY_FOOD_CONTEXT_RE.test(contextText)) {
    return HEALTHY_FOOD_PROMPTS;
  }
  if (BETTER_LIFE_CONTEXT_RE.test(contextText)) {
    return BETTER_LIFE_PROMPTS;
  }
  if (LIST_CONTEXT_RE.test(contextText)) return LIST_START_CHOICE_PROMPTS;
  return null;
}

function normalizePrompts(value: unknown, contextText = ""): string[] {
  if (!Array.isArray(value)) return fallbackPrompts();
  const allowHikingPrompts = HIKING_CONTEXT_RE.test(contextText);
  const hasWeekendContext = WEEKEND_CONTEXT_RE.test(contextText);
  const hasHealthyFoodContext = HEALTHY_FOOD_CONTEXT_RE.test(contextText);

  const prompts = value
    .map(cleanPrompt)
    .filter((prompt): prompt is string => Boolean(prompt))
    .filter((prompt) => allowHikingPrompts || !HIKING_PROMPT_RE.test(prompt));

  const unique = [...new Set(prompts)];
  const focusedFallback = focusedPromptsForContext(contextText);
  const contextFallback = focusedFallback
    ? focusedFallback
    : hasWeekendContext
    ? ["Cool Stuff to Do", "Go on a Hike", "Find a Great Movie", "Find Local Events"]
    : hasHealthyFoodContext
      ? HEALTHY_FOOD_PROMPTS
    : PRIMARY_PROMPT_FEED;

  return balanceBuildPromptMix(keepExploreAiASAPLow([...unique, ...contextFallback])
    .filter((prompt, index, all) => all.indexOf(prompt) === index)
    .filter((prompt) => !/^change subject$/i.test(prompt)));
}

export async function POST(request: Request) {
  const originErr = assertAllowedOrigin(request);
  if (originErr) return originErr;
  const rateLimitErr = await checkRateLimit(request);
  if (rateLimitErr) return rateLimitErr;

  try {
    const body = await request.json();
    const latestUserText =
      typeof body.latestUserText === "string"
        ? truncateUtf8String(
            body.latestUserText.trim(),
            MAX_OPENAI_USER_MESSAGE_CHARS,
          )
        : "";
    const recentUserTexts = Array.isArray(body.recentUserTexts)
      ? body.recentUserTexts
          .filter((item: unknown): item is string => typeof item === "string")
          .slice(-8)
          .map((item: string) => truncateUtf8String(item.trim(), 600))
          .filter(Boolean)
      : [];
    const currentPrompts = Array.isArray(body.currentPrompts)
      ? body.currentPrompts
          .filter((item: unknown): item is string => typeof item === "string")
          .slice(0, 4)
          .map((item: string) => truncateUtf8String(item.trim(), 120))
          .filter(Boolean)
      : [];

    if (!latestUserText && recentUserTexts.length === 0) {
      return new Response(JSON.stringify({ prompts: fallbackPrompts() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const promptContext = [latestUserText, ...recentUserTexts].join(" ");
    const productFeedbackContext =
      STANDALONE_FRAGMENT_RE.test(latestUserText) ||
      OPENING_LEAD_OR_LIST_FEEDBACK_RE.test(promptContext) ||
      CTA_TEXT_DESIGN_FEEDBACK_RE.test(promptContext) ||
      LIST_UI_META_FEEDBACK_RE.test(promptContext) ||
      PROMPT_CONTEXT_FEEDBACK_RE.test(promptContext) ||
      PROMPT_LABEL_META_FEEDBACK_RE.test(promptContext) ||
      CURRENT_GENERAL_PROMPT_LABEL_FEEDBACK_RE.test(promptContext) ||
      GOAL_PROMPT_LABEL_FEEDBACK_RE.test(promptContext);
    if (productFeedbackContext) {
      return new Response(JSON.stringify({
        prompts: focusedPromptsForProductFeedbackContext(promptContext) ?? fallbackPrompts(),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    const focusedPrompts = focusedPromptsForContext(promptContext);
    if (focusedPrompts) {
      return new Response(JSON.stringify({ prompts: focusedPrompts }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ prompts: fallbackPrompts() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const messages = [
      {
        role: "system",
        content:
          [
            "You are the quiet on-screen idea brain for aiASAP's voice assistant, 6.",
            "Return JSON only, shaped like {\"prompts\":[\"\",\"\",\"\",\"\"]}.",
            "Generate exactly four tappable conversation prompts for what the user is discussing right now.",
            "No numbering. No labels. No quotes. No punctuation at the end.",
            "Keep each prompt 2 to 4 words. Use title case, but keep the brand exactly aiASAP and keep small connector words lowercase, such as a, an, and, for, of, the, this, and to.",
            "aiASAP's brand line is TurboCharge Your Life. Its heart is AI as soon as possible: Easy AI for Everyone, ASAP. That means getting useful, friendly, state-of-the-art AI to every person fast and making it feel easy.",
            "Life Builder is a major product lane, not the core identity, so prompts should still be useful, forward-thinking next actions that help the user do more with 6 and build a better life when that is the active lane.",
            "When the user is hot on one topic, all four prompts must stay inside that topic and represent useful aspects of that topic; do not mix in unrelated broad defaults.",
            "Never use Change Subject, Complete Your Question, Confirm Understanding, Review Key Points, Finish Your Thought, Discuss Challenges, Plan Next Steps, Ask for Help, or labels that describe what 6 is thinking.",
            "Never generate codec prompts.",
            "The first four initial idea boxes should come up first in this exact order: Build Relationships, Create Financial Freedom, Set & Track Goals, and Build Your Socials.",
            "Use those four heavily throughout broad conversations when no stronger focused topic overrides them.",
            "After those first four, rotate important broad prompts with conversation-relevant prompts: Create a Shopping List, Build a Better Life, Make More Money, Find Your Life Partner, Build a Business, Build Friendships, Build Your Brand, Market Yourself, Create WalMart List, Create To Do List, Plan Your Weekend, Market Your Product, Market Your Service, and Next Vacation Ideas.",
            "Use Build Friendships instead of Make Friends or Make More Friends for the main friendship lane. Once Build Friendships is active, use friendship follow-ups such as Meet New People, Find a Hobby, Reconnect With Someone, and Find Local Groups.",
            "Make More Money should show up often, but not as the first broad prompt. Bring it in soon after. Use Create Financial Freedom as the main financial-freedom prompt.",
            "If the user is already deep in a money conversation, do not keep showing the generic Make More Money label back to them; use practical money next steps such as Create Financial Freedom, Start Side Hustle, Cut Waste, and Invest for Future. If they move into side hustle, all four prompts must stay inside side hustle, such as Side Hustle Ideas, Use Your Skills, Pick First Offer, and Find First Buyer.",
            "Use Build a Better Life when the user is talking broadly about improving life, getting organized, family, goals, stability, health, home, work, or becoming happier.",
            "After Build a Better Life starts the conversation, let that exact label go and use focused next steps such as Set & Track Goals, Make More Money, Fix One Problem, and Make Action Plan.",
            "Use Build Your Socials when business, creator, audience, social growth, followers, or platform posting is in context.",
            "For Build Your Socials context, use social-system prompts such as Build Full Brand, Create Content, Link Accounts, and Post Everywhere because aiASAP/Codex can help build the whole social machine: brand, platform choices, artwork, content strategy, post copy, launch content, content calendar, command center, account-linking flow, and posting workflow for major platforms. Account linking and assisted posting are coming soon; describe them as setup and approval workflows, with the user keeping permissions, account ownership, and final approvals.",
            "Use Build Your Brand and Market Yourself for personal brand, reputation, positioning, creator, career, or self-promotion talk.",
            "When the user is fighting, arguing, or in conflict with a spouse, parent, child, friend, family member, coworker, neighbor, boyfriend, girlfriend, or anyone in their life, use practical relationship-repair prompts such as Choose One Relationship, Be Fully Honest, Own Your Part, and Plan Better Talk.",
            "When the user is clearly talking about wanting a boyfriend, girlfriend, crush, romance, dating, finding a life partner, or asking someone out, use dating prompts such as Find Your Life Partner, Get That Guy, Get That Girl, Win Them Over, Plan First Message, Ask Them Out, or Plan a Date.",
            "Keep dating contextual only; never make dating a generic default except for the rotating broad prompt Find Your Life Partner.",
            "Never use Take a Hike. Use hiking prompts only when hiking, trails, parks, outdoors, a weekend-plan conversation, or a nearby-place lookup is actually discussed.",
            "Use Date Night Ideas only when the user is actually talking about dating, romance, or a date.",
            "Keep Create a Shopping List and Create a To Do List useful, but do not open visible lists from label-review or product-feedback speech.",
            "If the user already has or is building a grocery list, prefer Add to Grocery List over Create a Shopping List.",
            "Avoid stale ideas, vague coaching, sales language, reminder/contact prompts, or entertainment-only ideas.",
            "If the conversation changed, replace stale ideas with new relevant ones.",
          ].join(" "),
      },
      {
        role: "system",
        content:
            "Latest correction supersedes any older top-four text above: the first four idea boxes are Build Relationships, Create Financial Freedom, Set & Track Goals, and Build Your Socials. Use that exact order for the first four, and also sprinkle those four heavily throughout broad conversations when no stronger focused topic overrides them. Build Friendships is still approved and should be mixed into the broader feed after the first four; do not generate Build Relationships/Friends or Make Friends.",
      },
      {
        role: "system",
        content:
          "Important correction: use Set & Track Goals for the broad goals lane, not the older longer life-goals label. After the first four, sprinkle in Create a Shopping List, Build a Better Life, Make More Money, Find Your Life Partner, Build a Business, Build Friendships, Build Your Brand, Market Yourself, Create WalMart List, Create To Do List, Plan Your Weekend, Market Your Product, Market Your Service, and Next Vacation Ideas. For Build Your Socials context, use social-system prompts such as Build Full Brand, Create Content, Link Accounts, and Post Everywhere because aiASAP/Codex can help build the whole social machine: brand, platform choices, artwork, content strategy, post copy, launch content, content calendar, command center, account-linking flow, and posting workflow for major platforms. Account linking and assisted posting are coming soon; describe them as setup and approval workflows, with the user keeping permissions, account ownership, and final approvals. Specific goal prompts such as Set Relationship Goals, Set Business Goals, Set Health Goals, Set Money Goals, Set Work Goals, or Set Family Goals are still fine when that exact area is active. Set Relationship Goals is not only dating; it can mean goals with parents, kids, spouse, partner, friends, coworkers, neighbors, or anyone in the user's life. Relationship conflict help starts with honesty: 6 should make clear that he can help only if the user tells the truth, including their own part.",
      },
      {
        role: "user",
        content: JSON.stringify({
          latestUserText,
          recentUserTexts,
          currentPrompts,
          responseShape: { prompts: ["", "", "", ""] },
        }),
      },
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.35,
        max_tokens: 180,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.error("Prompt brain OpenAI error:", await res.text());
      return new Response(JSON.stringify({ prompts: fallbackPrompts() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : {};
    const prompts = normalizePrompts(parsed.prompts, promptContext);

    return new Response(JSON.stringify({ prompts }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Prompt brain failed:", error);
    return new Response(JSON.stringify({ prompts: fallbackPrompts() }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
