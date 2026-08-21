const LIST_NOUN_RE =
  /\b(?:list|walmart|grocery|groceries|shopping|to[-\s]?do|todo|tasks?)\b/i;

const EXPLICIT_LIST_ACTION_RE =
  /\b(?:make|create|start|open|show|switch\s+to|pull\s+up|go\s+to|bring|resume|continue|reopen|see)\b[\s\S]{0,80}\b(?:list|walmart|grocery|groceries|shopping|to[-\s]?do|todo)\b/i;

const EXPLICIT_LIST_NEED_RE =
  /\b(?:i|we)\s+(?:need|want)\b[\s\S]{0,50}\b(?:list|walmart|grocery|groceries|shopping|to[-\s]?do|todo)\b/i;

const EXPLICIT_MUTATION_RE =
  /\b(?:add|put|grab|buy|pick\s+up|throw|remove|delete|take\s+off|cross\s+off|clear|rename|change|reorder|move)\b|\b(?:i|we)\s+(?:need|want|have|got)\b|^(?:need|want)\b/i;

const DIRECT_MUTATION_ACTION_RE =
  /\b(?:add|put|grab|buy|pick\s+up|throw|remove|delete|take\s+off|cross\s+off|clear|rename|change|reorder|move)\b/i;

const BARE_LIST_ROUTE_RE =
  /^(?:(?:the|my|our)\s+)?(?:walmart|grocery|groceries|shopping|to[-\s]?do|todo)\s+list[.!]?$/i;

const ACKNOWLEDGMENT_RE =
  /^(?:yes|yeah|yep|yup|no|nope|nah|okay|ok|sure|right|great|perfect|thanks|thank\s+you)[.!]?$/i;

const LIST_META_RE =
  /\b(?:didn'?t\s+say|did\s+not\s+say|why\s+did|why\s+is|why\s+was|what\s+(?:is|was)|what'?s|come\s+up|came\s+up|accident(?:al|ally)|talk(?:ing)?\s+about|complain(?:ing|t)?|not\s+(?:a|the|my)\s+list|take\s+(?:the|this|that)\s+list\s+down|list\s+down)\b/i;

const CONVERSATIONAL_NEED_RE =
  /\b(?:need|want)\s+(?:you|him|her|them|us|me)\s+to\b|\b(?:need|want)\s+to\s+(?:do|be|have|make|find|figure|help|talk|work|set|build|change|use|see|know|start|stop)\b/i;

const APP_MECHANIC_RE =
  /\b(?:zip(?:\s+code)?|search\s+results?|pill\s*boxes?|screen|card|avatar|session)\b/i;

const BARE_SERIES_SPEECH_RE =
  /\b(?:i|you|me|my|your|he|she|it|we|they|them|tell|say|said|think|know|mean|just|okay|so|hey|hello|buddy|right|what|why|how|where|when|who|which|problem|issue|talk|accident)\b/i;

function tidy(value: string): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

const NEGATED_DIRECT_MUTATION_RE =
  /\b(?:do\s+not|don'?t|did\s+not|didn'?t|never|not)\b[^.!?]{0,40}\b(?:add|put|grab|buy|pick\s+up|throw|remove|delete|take\s+off|cross\s+off|clear|rename|change|reorder|move)\b/i;

const NEGATED_LIST_ACTION_RE =
  /\b(?:do\s+not|don'?t|did\s+not|didn'?t|never|no\s+need\s+to|not\s+now|stop\s+trying\s+to|please\s+avoid)\b[^.!?]{0,80}\b(?:make|create|start|open|show|switch\s+to|pull\s+up|go\s+to|bring|resume|continue|reopen|see|add|put|remove|delete|clear|rename)\b/i;

function hasActionableDirectMutation(text: string): boolean {
  return tidy(text)
    .split(/(?<=[.!?])\s+/)
    .some((clause) => {
      if (NEGATED_DIRECT_MUTATION_RE.test(clause)) return false;
      const match = clause.match(
        /\b(?:add|put|grab|buy|pick\s+up|throw|remove|delete|take\s+off|cross\s+off|clear|rename|change|reorder|move)\b\s+(.{1,100})$/i,
      );
      if (!match?.[1]) return false;
      const object = match[1].replace(/[.!?]+$/g, "").trim();
      return !/^(?:a|an|the|to|on|from|of|to\s+(?:the\s+)?list)$/i.test(
        object,
      );
    });
}

export function isSpokenListQuestion(text: string): boolean {
  const value = tidy(text);
  if (!value) return false;
  if (NEGATED_LIST_ACTION_RE.test(value)) return false;

  if (
    /^(?:what|where|why|how|which|who|when|is|are|am|do|does|did|have|has)\b/i.test(
      value,
    )
  ) {
    return true;
  }

  // Modal action requests are commands even when spoken as questions.
  if (/^(?:can|could|would|should|will)\b/i.test(value)) {
    return !(
      EXPLICIT_LIST_ACTION_RE.test(value) ||
      hasActionableDirectMutation(value)
    );
  }

  if (!/[?]\s*$/.test(value)) return false;
  return !(
    EXPLICIT_LIST_ACTION_RE.test(value) ||
    DIRECT_MUTATION_ACTION_RE.test(value)
  );
}

export function stripDestinationListContext(text: string): string | null {
  const value = tidy(text);
  const match = value.match(
    /^(.{2,100}?)\s+(?:for|on|to)\s+(?:the\s+|my\s+)?(?:walmart|grocery|groceries|shopping)(?:\s+list)?[.!]?$/i,
  );
  if (!match?.[1]) return null;
  return match[1].replace(/[\s,.;:!?-]+$/g, "").trim() || null;
}

export function isDestinationListDictation(text: string): boolean {
  const source = stripDestinationListContext(text);
  if (!source) return false;
  if (isSpokenListQuestion(text) || LIST_META_RE.test(text)) return false;
  if (source.split(/\s+/).length > 12) return false;
  if (
    /\b(?:i|you|we|they|he|she)\s+(?:am|are|is|was|were|work|works|worked|go|went|live|shop|shopping|talk|think|know)\b/i.test(
      source,
    )
  ) {
    return false;
  }
  return !ACKNOWLEDGMENT_RE.test(source);
}

export function shouldAllowDetectedListIntent(text: string): boolean {
  const value = tidy(text);
  if (!value || !LIST_NOUN_RE.test(value)) return false;

  if (NEGATED_LIST_ACTION_RE.test(value)) return false;
  if (CONVERSATIONAL_NEED_RE.test(value)) return false;

  if (isDestinationListDictation(value)) return true;
  if (EXPLICIT_LIST_ACTION_RE.test(value) || EXPLICIT_LIST_NEED_RE.test(value)) {
    return true;
  }
  if (BARE_LIST_ROUTE_RE.test(value)) return true;

  if (isSpokenListQuestion(value) || LIST_META_RE.test(value)) return false;
  if (/\b(?:fuck|fucking|shit|damn|hell)\b/i.test(value)) return false;

  // Mutations that name their destination are legitimate even without a create verb.
  if (EXPLICIT_MUTATION_RE.test(value) && LIST_NOUN_RE.test(value)) return true;
  return false;
}

export function shouldTreatAsListMutation(
  text: string,
  options: { hasActiveList: boolean },
): boolean {
  const value = tidy(text);
  if (!value || ACKNOWLEDGMENT_RE.test(value)) return false;
  if (isSpokenListQuestion(value)) return false;
  if (hasActionableDirectMutation(value)) return true;
  if (NEGATED_DIRECT_MUTATION_RE.test(value)) return false;
  if (LIST_META_RE.test(value)) return false;
  if (/\b(?:fuck|fucking|shit|damn|hell)\b/i.test(value)) return false;
  if (CONVERSATIONAL_NEED_RE.test(value) || APP_MECHANIC_RE.test(value)) {
    return false;
  }
  if (isDestinationListDictation(value)) return true;

  if (EXPLICIT_MUTATION_RE.test(value)) {
    // A signal alone or followed only by a dangling article is not a mutation yet.
    if (
      /^(?:and\s+)?(?:i\s+)?(?:add(?:ed)?|put|grab|buy|need|want|have|got)\s+(?:a|an|the)?[.!]?$/i.test(
        value,
      )
    ) {
      return false;
    }
    return true;
  }

  if (!options.hasActiveList) return false;
  const words = value.replace(/[.!?]+$/g, "").split(/\s+/).filter(Boolean);
  return (
    words.length >= 2 &&
    words.length <= 12 &&
    /[,;\n]|\band\b/i.test(value) &&
    !BARE_SERIES_SPEECH_RE.test(value)
  );
}

export function shouldLookupListItem(text: string): boolean {
  const value = tidy(text);
  if (!value || ACKNOWLEDGMENT_RE.test(value)) return false;
  if (
    /\b(?:number|item)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:should\s+)?(?:say|read|be)\b/i.test(
      value,
    )
  ) {
    return false;
  }
  if (/\b(?:says?|reads?)\s+added\b/i.test(value)) return false;

  return (
    /\b(?:where\s+is|find|look\s+for|locate)\b/i.test(value) ||
    /\b(?:do\s+i\s+have|have\s+i\s+got|is\s+.+?\s+(?:already\s+)?on\s+(?:there|the\s+list|my\s+list))\b/i.test(
      value,
    ) ||
    /\b(?:what|which)\s+(?:number|item)\s+is\b/i.test(value)
  );
}

function normalizeListItemKey(value: string): string {
  return tidy(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(
      /[^a-z0-9\u00c0-\u024f\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\s]/gi,
      " ",
    )
    .replace(
      /\b(?:a|an|the|some|el|la|los|las|un|una|le|les|des|du|der|die|das|ein|eine)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ies\b/g, "y")
    .replace(/s\b/g, "");
}

export function listItemKeysMatch(a: string, b: string): boolean {
  const left = normalizeListItemKey(a);
  const right = normalizeListItemKey(b);
  return Boolean(left && right && left === right);
}
