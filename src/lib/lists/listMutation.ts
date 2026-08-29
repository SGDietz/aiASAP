export type ListMutationTarget = {
  id: string;
  items: string[];
  updatedAt: number;
};

export type AddItemsOptions = {
  maxItems?: number;
  now?: number;
  revisionBefore?: number;
  utteranceId?: string | null;
};

export type AddItemsReceipt<TList extends ListMutationTarget> = {
  status: "changed" | "unchanged" | "missing";
  listId: string;
  requested: string[];
  added: string[];
  alreadyPresent: string[];
  rejectedByLimit: string[];
  itemsBefore: string[];
  resultingItems: string[];
  nextLists: TList[];
  revisionBefore: number;
  revisionAfter: number;
  utteranceId: string | null;
  idempotencyKey: string;
};

export type ListItemsFormatter = (items: string[]) => string;

export function buildAddItemsAcknowledgment<
  TList extends ListMutationTarget,
>(
  receipt: AddItemsReceipt<TList>,
  formatItems: ListItemsFormatter,
): string {
  if (receipt.status === "missing") {
    return "I couldn't find that list, so I didn't add anything.";
  }

  const sentences: string[] = [];
  if (receipt.added.length > 0) {
    sentences.push(`Added ${formatItems(receipt.added)}.`);
  }
  if (receipt.alreadyPresent.length > 0) {
    const verb = receipt.alreadyPresent.length === 1 ? "was" : "were";
    sentences.push(
      `${formatItems(receipt.alreadyPresent)} ${verb} already on the list.`,
    );
  }
  if (receipt.rejectedByLimit.length > 0) {
    sentences.push(
      `The list is full, so I couldn't add ${formatItems(receipt.rejectedByLimit)}.`,
    );
  }

  return sentences.join(" ") || "I didn't add anything.";
}

const DEFAULT_MAX_LIST_ITEMS = 80;

function normalizeRequestedItem(value: string): string | null {
  const cleaned = (value ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function itemKey(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function requestedItemsFingerprint(items: readonly string[]): string {
  // Deterministic FNV-1a keeps fallback idempotency keys short while ensuring
  // different commands against the same list revision cannot collide.
  let hash = 0x811c9dc5;
  for (const char of items.map(itemKey).join("\u001f")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function normalizeRequestedItems(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const item = normalizeRequestedItem(value);
    if (!item) continue;
    const key = itemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(item);
  }

  return normalized;
}

/**
 * Calculates a list add from the supplied authoritative collection and returns
 * an exact receipt. It never reads React closure state and never mutates input.
 * Feed each receipt's nextLists into the next transaction to prevent stale-turn
 * overwrites.
 */
export function applyAddItems<TList extends ListMutationTarget>(
  lists: TList[],
  listId: string,
  values: readonly string[],
  options: AddItemsOptions = {},
): AddItemsReceipt<TList> {
  const requested = normalizeRequestedItems(values);
  const revisionBefore = Math.max(0, options.revisionBefore ?? 0);
  const maxItems = Math.max(0, options.maxItems ?? DEFAULT_MAX_LIST_ITEMS);
  const target = lists.find((list) => list.id === listId);
  const utteranceId = options.utteranceId?.trim() || null;
  const idempotencyKey = utteranceId
    ? `${utteranceId}:list:add:${listId}`
    : `list:add:${listId}:revision:${revisionBefore}:items:${requestedItemsFingerprint(requested)}`;

  if (!target) {
    return {
      status: "missing",
      listId,
      requested,
      added: [],
      alreadyPresent: [],
      rejectedByLimit: [],
      itemsBefore: [],
      resultingItems: [],
      nextLists: lists,
      revisionBefore,
      revisionAfter: revisionBefore,
      utteranceId,
      idempotencyKey,
    };
  }

  const resultingItems = [...target.items];
  const added: string[] = [];
  const alreadyPresent: string[] = [];
  const rejectedByLimit: string[] = [];

  for (const requestedItem of requested) {
    const existing = resultingItems.find(
      (item) => itemKey(item) === itemKey(requestedItem),
    );
    if (existing) {
      alreadyPresent.push(existing);
      continue;
    }
    if (resultingItems.length >= maxItems) {
      rejectedByLimit.push(requestedItem);
      continue;
    }
    resultingItems.push(requestedItem);
    added.push(requestedItem);
  }

  if (added.length === 0) {
    return {
      status: "unchanged",
      listId,
      requested,
      added,
      alreadyPresent,
      rejectedByLimit,
      itemsBefore: [...target.items],
      resultingItems,
      nextLists: lists,
      revisionBefore,
      revisionAfter: revisionBefore,
      utteranceId,
      idempotencyKey,
    };
  }

  const updatedAt = options.now ?? Date.now();
  const nextLists = lists.map((list) =>
    list.id === listId
      ? ({ ...list, items: resultingItems, updatedAt } as TList)
      : list,
  );

  return {
    status: "changed",
    listId,
    requested,
    added,
    alreadyPresent,
    rejectedByLimit,
    itemsBefore: [...target.items],
    resultingItems,
    nextLists,
    revisionBefore,
    revisionAfter: revisionBefore + 1,
    utteranceId,
    idempotencyKey,
  };
}
