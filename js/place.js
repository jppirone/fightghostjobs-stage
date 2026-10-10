// place.js - what the place of an opening reads on screen (October 9, 2026, prompt AZ3). Pure (no DOM, no network): tested in Node by tests/place.unit.test.js.
//
// TWO SOURCES, ONE RULE. An opening's place is normally what the employer CHOSE from the catalog (the row's locations array, derived by the database from the catalog ids; the catalog is US only). Some openings were staged from the employer's own
// public job board feed and have no catalog place; for those the database keeps source_location_text, the place exactly as the employer's job board gave it. That text is DISPLAY ONLY:
//   * shown ONLY while locations is empty (a row that has any place from the catalog never shows it, even if the database sent one);
//   * always followed by the small note PLACE_NOTE, so a reader knows it is the employer's board's wording and not one of our catalog places;
//   * never read for searching, filtering or matching (rule S68 keeps every other script from touching it);
//   * shown with textContent only (the caller builds text nodes; nothing here makes markup), at most 200 characters, control characters removed.
import { locationLine } from "./format.js";

export const PLACE_NOTE = "as given by the employer's job board";
export const MAX_PLACE_CHARS = 200;

// the text of a row's source place, cleaned, or "" when there is none (not a string, empty after cleaning)
export function sourcePlaceText(row) {
  const v = row && typeof row === "object" ? row.source_location_text : null;
  if (typeof v !== "string") return "";
  // control characters out (a new line, a tab, a bell), then trimmed, then the hard limit
  return v.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim().slice(0, MAX_PLACE_CHARS).trim();
}

// -> { text, note } : text is the place line (the catalog places, "Remote", or the source place), note is PLACE_NOTE only when the line is the employer board's text, else null
export function placeParts(row) {
  const locs = row && Array.isArray(row.locations) ? row.locations.filter((l) => typeof l === "string" && l.trim() !== "") : [];
  const src = locs.length === 0 ? sourcePlaceText(row) : "";
  if (src === "") return { text: locationLine(row ? row.is_remote : null, row ? row.locations : null), note: null };
  // a remote opening whose board text is not itself "Remote" says Remote first, then the place
  const remote = row.is_remote === true && src.toLowerCase() !== "remote";
  return { text: (remote ? "Remote · " : "") + src, note: PLACE_NOTE };
}
