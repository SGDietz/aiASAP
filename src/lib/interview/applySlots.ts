/**
 * THE JOIN between the extractor and the ledger.
 *
 * extractInterviewSlots reads one turn and says what the person told us.
 * This puts it in the filing cabinet. Nothing else writes to the ledger from
 * a conversation, so every rule about what may be recorded lives here.
 *
 * THE MERGE IS THE POINT. List answers arrive in pieces - somebody describes
 * two things they did yesterday, then remembers a third one four turns later.
 * A plain write would replace three beats with one and part 2 would never
 * finish, so the whisper would pin on it forever and 6 would keep asking about
 * yesterday. List slots merge; single slots take the newest answer, because a
 * person correcting themselves means the new one.
 */

import { putBeats, BEAT_SEPARATOR, reconcile } from "./ledger";
import type { Ledger, PartId } from "./ledger";
import type { ExtractedSlot } from "./extractSlots";

/** The only two slots that hold several items. Must match extractSlots. */
const LIST_KEYS = new Set(["yesterday_beats", "typical_blocks"]);

/** Cap per list slot. Enough for a real answer, small enough to stay a slot. */
const MAX_BEATS = 12;

function existingBeats(ledger: Ledger, part: PartId, key: string): string[] {
  const slot = ledger.parts[part]?.slots?.[key];
  if (!slot?.value) return [];
  return slot.value.split(BEAT_SEPARATOR).map((b) => b.trim()).filter(Boolean);
}

export type ApplyResult = {
  ledger: Ledger;
  /** How many slots actually changed. Zero means the turn was small talk. */
  changed: number;
};

export function applySlots(
  ledger: Ledger,
  slots: ExtractedSlot[],
  now: number,
): ApplyResult {
  let changed = 0;

  for (const s of slots) {
    const part = s.part as PartId;
    if (!ledger.parts[part]) continue;

    if (LIST_KEYS.has(s.key)) {
      const before = existingBeats(ledger, part, s.key);
      // Case-insensitive dedupe: "Mowed the Jones place" arriving twice is one
      // beat, and a repeated beat would otherwise complete a part on its own.
      const seen = new Set(before.map((b) => b.toLowerCase()));
      const merged = [...before];
      for (const v of s.values) {
        const k = v.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        merged.push(v);
      }
      if (merged.length === before.length) continue;
      putBeats(ledger, part, s.key, merged.slice(0, MAX_BEATS), now);
      changed++;
      continue;
    }

    // Single-value slot. A newer answer replaces an older one - but an
    // identical answer is not a change, or every repetition would look like
    // fresh progress and keep the interview permanently "active".
    const prev = ledger.parts[part]?.slots?.[s.key]?.value;
    const next = s.values[0];
    if (!next || prev === next) continue;
    putBeats(ledger, part, s.key, [next], now);
    changed++;

    // Whether their contact details may go on a public page is a permission,
    // not a fact about their week, so it is mirrored onto the ledger itself.
    // Only an explicit "false" revokes it.
    if (s.key === "reach_publish") {
      ledger.publishOk = next !== "false";
    }
  }

  if (changed > 0) {
    ledger.lastActivityAt = now;
    // An abandoned interview that someone comes back to is running again.
    if (ledger.status === "idle" || ledger.status === "abandoned") {
      ledger.status = "running";
    }
  }

  // reconcile both upgrades parts that just became complete and downgrades any
  // that no longer are, so a state can never drift away from the substance.
  return { ledger: reconcile(ledger), changed };
}
