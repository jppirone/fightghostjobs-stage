// place.js - what the place of an opening reads on screen (October 9, 2026, prompt AZ3). Pure (no DOM, no network): tested in Node by tests/place.unit.test.js.
//
// TWO SOURCES, ONE RULE. An opening's place is normally what the employer CHOSE from the catalog (the row's locations array, derived by the database from the catalog ids; the catalog is US only). Some openings were staged from the employer's own
// public job board feed and have no catalog place; for those the database keeps source_location_text, the place exactly as the employer's job board gave it. That text is DISPLAY ONLY:
//   * shown ONLY while locations is empty (a row that has any place from the catalog never shows it, even if the database sent one);
//   * always followed by the small note PLACE_NOTE, so a reader knows it is the employer's board's wording and not one of our catalog places;
//   * never read for searching, filtering or matching (rule S68 keeps every other script from touching it);
//   * shown with textContent only (the caller builds text nodes; nothing here makes markup), at most 200 characters, control characters removed.
import { locationLine, LOCATION_NOT_STATED } from "./format.js?v=032c6fc5";

export const PLACE_NOTE = "as provided by the employer";   // prompt BJ (October 11, 2026): the one note on every screen, for a place typed on the form and for one that came from an automated feed
export const MAX_PLACE_CHARS = 200;

// the text of a row's source place, cleaned, or "" when there is none (not a string, empty after cleaning)
export function sourcePlaceText(row) {
  const v = row && typeof row === "object" ? row.source_location_text : null;
  if (typeof v !== "string") return "";
  // control characters out (a new line, a tab, a bell), then trimmed, then the hard limit
  return v.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim().slice(0, MAX_PLACE_CHARS).trim();
}

// -> { text, note, stated } : text is the place line (the catalog places, "Remote", or the source place), note is PLACE_NOTE only when the line is the employer board's text, else null;
// stated is false only when nothing is set at all (no place, no Remote): the text is then "Location not stated"
export function placeParts(row) {
  const locs = row && Array.isArray(row.locations) ? row.locations.filter((l) => typeof l === "string" && l.trim() !== "") : [];
  const src = locs.length === 0 ? sourcePlaceText(row) : "";
  if (src === "") { const text = locationLine(row ? row.is_remote : null, row ? row.locations : null); return { text, note: null, stated: text !== LOCATION_NOT_STATED }; }
  // a remote opening whose board text is not itself "Remote" says Remote first, then the place
  const remote = row.is_remote === true && src.toLowerCase() !== "remote";
  return { text: (remote ? "Remote · " : "") + src, note: PLACE_NOTE, stated: true };
}

// ONE PLACE LINE EVERYWHERE (prompt BJ, October 11, 2026): the candidate results card, the details window, the opening's comments page, the staff view, My openings (and any other screen that names the place)
// draw the place through THIS function: the typed place when the row has one (with Remote first when the opening is remote), otherwise the list places in order with Remote, otherwise "Location not stated";
// the small note follows only a typed place. h is the page's element builder (js/dom.js). -> an array of nodes (text and one span)
// opts.note = false (prompt BL, October 11, 2026): the two screens only the EMPLOYER sees (My openings and the opening editor) show the plain place line: the employer typed the place themselves, so "as provided by
// the employer" tells them nothing. Every screen a candidate sees keeps the note: showing it is the default.
// opts.hideNone = true (prompt BN, October 11, 2026): when nothing is set (no place, no Remote) the employer's own two screens show NOTHING for the place instead of "Location not stated" (the title often says it):
// the result is an empty array and the caller leaves the label and the line out. A candidate screen never passes it.
export function placeNodes(h, row, opts) {
  const p = placeParts(row);
  if (!p.stated && opts && opts.hideNone === true) return [];
  const out = [p.text];
  if (p.note && !(opts && opts.note === false)) out.push(" ", h("span", { class: "place-note", style: "font-size:12px;color:var(--faint);" }, p.note));
  return out;
}
