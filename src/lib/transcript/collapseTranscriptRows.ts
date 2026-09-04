import { FRAGMENT_SOURCE, PARTIAL_SOURCE } from "./fragmentLink";

// ---------------------------------------------------------------------------
// Fold transcript rows into TURNS for the readers that print or pair them
// (2026-08-21, with fragmentLink.ts). The table keeps every row - the app's
// whole turn AND the provider's pieces of it. A reader that prints rows one by
// one shows the same breath up to eight times. This folds a turn's pieces
// under the app row they were linked to; pieces nobody claimed print as honest
// orphans. Nothing is dropped from the input - every row is in some turn's
// `rows`, so a caller that wants the raw count can still count.
//
// One utterance_id is NOT one app line: the app legitimately logs several
// assistant lines under one accepted user turn (6's reply, then the greeting
// re-fire - 03aef2a8 has both under utt-fb700e8b). Every app-born line is its
// own turn, in order; pieces attach to the FIRST app-born line of their group.
// Anchoring is by utterance_id presence, not source: the equality merge flips
// a claimed app row's source to 'liveavatar_api' and it must still anchor.
// ---------------------------------------------------------------------------

export type TranscriptRowLike = {
  id?: string | null;
  role: string;
  message: string | null;
  source?: string | null;
  utterance_id?: string | null;
  la_absolute_timestamp?: number | null;
  created_at?: string | null;
};

export type TranscriptTurn = {
  role: string;
  /** The app's line when one anchors the group; otherwise the pieces joined in spoken order. */
  text: string;
  utteranceId: string | null;
  /** Sort key (epoch ms): the app row's created_at, or the first piece's end-of-speech time. */
  atMs: number;
  createdAt: string;
  /** Every row folded in. Nothing is dropped; callers that want "8 rows" can count. */
  rows: TranscriptRowLike[];
  /** No app row anchors this group (FULL mode, or the app lost the turn). */
  piecesOnly: boolean;
};

/** Orphan pieces of one role whose end times sit this close read as one breath. */
export const ORPHAN_BREATH_GAP_MS = 8_000;

const isPiece = (r: TranscriptRowLike) =>
  r.source === FRAGMENT_SOURCE || r.source === PARTIAL_SOURCE;
const isAnchor = (r: TranscriptRowLike) => !isPiece(r) && Boolean(r.utterance_id);

function createdMs(r: TranscriptRowLike): number {
  const ms = Date.parse(r.created_at ?? "");
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Time a row stands for. App-born rows: created_at (the app logs a user turn
 * just after it ends and 6's line at emit). Provider rows: their end-of-speech
 * stamp, NOT created_at - a sync batch stores pieces up to 20 s after they were
 * spoken and every piece in the batch shares one created_at to the millisecond.
 * NOT la alone either: app rows have none, sort last, and never paired.
 */
function rowMs(r: TranscriptRowLike): number {
  if (isAnchor(r)) return createdMs(r);
  if (typeof r.la_absolute_timestamp === "number") {
    return r.la_absolute_timestamp * 1000;
  }
  return createdMs(r);
}

function newTurn(r: TranscriptRowLike, text: string, piecesOnly: boolean): TranscriptTurn {
  return {
    role: r.role,
    text,
    utteranceId: r.utterance_id ?? null,
    atMs: rowMs(r),
    createdAt: r.created_at ?? "",
    rows: [r],
    piecesOnly,
  };
}

export function collapseTranscriptRows(
  input: readonly TranscriptRowLike[],
): TranscriptTurn[] {
  const rows = [...input]
    .filter((r) => typeof r.message === "string" && r.message.trim())
    .sort((a, b) => rowMs(a) - rowMs(b));

  type Group = { anchor: TranscriptTurn | null; pieceTurn: TranscriptTurn | null };
  const groups = new Map<string, Group>();
  const turns: TranscriptTurn[] = [];
  let openOrphan: TranscriptTurn | null = null;

  for (const r of rows) {
    const text = (r.message ?? "").trim();
    const key = r.utterance_id ? `${r.role}:${r.utterance_id}` : null;

    if (key) {
      openOrphan = null;
      let group = groups.get(key);
      if (!group) {
        group = { anchor: null, pieceTurn: null };
        groups.set(key, group);
      }

      if (isPiece(r)) {
        if (group.anchor) {
          // Folded under the app's line: kept, counted, not printed. A turn
          // stands at the moment it BEGAN: the app's user row lands after the
          // last piece ends, so the first piece's time wins the sort.
          group.anchor.rows.push(r);
          group.anchor.atMs = Math.min(group.anchor.atMs, rowMs(r));
          continue;
        }
        if (group.pieceTurn) {
          group.pieceTurn.text = `${group.pieceTurn.text} ${text}`;
          group.pieceTurn.rows.push(r);
          continue;
        }
        group.pieceTurn = newTurn(r, text, true);
        turns.push(group.pieceTurn);
        continue;
      }

      // App-born line. Every one is its own turn, in order - never overwrite
      // an earlier line under the same utterance id.
      const turn = newTurn(r, text, false);
      if (!group.anchor) {
        group.anchor = turn;
        if (group.pieceTurn) {
          // Pieces sorted ahead of their app row (they end before it lands):
          // fold them under this line and drop the provisional pieces-only turn.
          turn.rows.unshift(...group.pieceTurn.rows);
          turn.atMs = Math.min(turn.atMs, group.pieceTurn.atMs);
          const at = turns.indexOf(group.pieceTurn);
          if (at >= 0) turns.splice(at, 1);
          group.pieceTurn = null;
        }
      }
      turns.push(turn);
      continue;
    }

    if (isPiece(r)) {
      // Orphan piece: no app turn claimed it. Keep it, joined with same-role
      // neighbours when they read as one breath.
      const at = rowMs(r);
      const prev = openOrphan ? openOrphan.rows[openOrphan.rows.length - 1] : null;
      if (
        openOrphan &&
        prev &&
        openOrphan.role === r.role &&
        at - rowMs(prev) <= ORPHAN_BREATH_GAP_MS
      ) {
        openOrphan.text = `${openOrphan.text} ${text}`;
        openOrphan.rows.push(r);
        continue;
      }
      openOrphan = newTurn(r, text, true);
      turns.push(openOrphan);
      continue;
    }

    // Plain row (old provider rows, app rows logged without an utterance id).
    openOrphan = null;
    turns.push(newTurn(r, text, false));
  }

  return turns.sort((a, b) => a.atMs - b.atMs);
}
