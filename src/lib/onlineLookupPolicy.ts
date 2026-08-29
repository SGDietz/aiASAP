/**
 * CUSTOM is the focused brand-and-website sales experience. It must not
 * consume a prospect's business description as a general online-search query.
 * FULL deliberately retains the existing local lookup experience.
 */
export function allowsOnlineLookup(mode: "FULL" | "CUSTOM"): boolean {
  return mode === "FULL";
}
