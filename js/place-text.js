// place-text.js - the place an employer TYPES for an opening that is outside the US catalog (prompt BH, October 11, 2026). Pure (no DOM, no network): tested in Node by tests/place-text.unit.test.js.
//
// WHAT IT IS: a place outside the US, or not in the list, is typed as plain text and kept in the opening's display-only column (the request field below). It is a LABEL: nothing searches, sorts or filters by it, and
// it is shown exactly as the employer wrote it (js/place.js draws it with textContent only). One or the other: an opening has a place from the US list or a typed place, never both ("Remote" stays its own choice).
// THE RULE is the database's (public.location_text_problem) and edit-posting's / create-posting's, mirrored: 1 to 100 characters after trimming and collapsing spaces, plain text on one line (no line break, tab or
// invisible character), no web address in any disguise and no email address (the same checks the AI notes use: js/ai-notes.js), no < or >.
// S68: this file and js/place.js are the only scripts that name the field (js/api.js keeps its staff key list); every other script goes through the helpers here.
import { hasBadChars, looksLikeWebAddress } from "./ai-notes.js?v=35c5dc92";

export const PLACE_FIELD = "source_location_text";          // the request and answer field (create-posting, edit-posting, get-my-posting, list-my-postings)
export const MAX_PLACE_TEXT = 100;

// the words the employer reads (listed in reports\stage-bh-report.txt)
export const PLACE_WORDS = {
  CHOICE: "A place outside the US or not in the list",
  PLACEHOLDER: "For example: Lisbon, Portugal",
  HINT: "Shown to candidates as you wrote it. It is not used to search, sort or filter, and it cannot hold a link or an email address.",
  EMPTY: "Enter the place.",
  LONG: "Keep it to " + MAX_PLACE_TEXT + " characters or fewer.",
  CHARS: "Keep it to plain text on one line.",
  LINK: "No web addresses here.",
  EMAIL: "No email addresses here.",
  MARKUP: "Keep it to plain text: no < or >.",
  NOT_SAVED: "The opening was saved, but the place was not. Open it from My openings and type the place again.",
};

// runs of spaces (and no-break and other spaces) become one space; the ends are trimmed. A line break or a tab is NOT collapsed: it is refused.
export function collapsePlaceText(raw) {
  return String(raw == null ? "" : raw).replace(/[  -   　]+/g, " ").replace(/ {2,}/g, " ").replace(/^ +| +$/g, "");
}

// t: already collapsed. -> the sentence to show under the box, or null when the place is fine
export function placeTextProblem(t) {
  const s = String(t == null ? "" : t);
  if (s === "") return PLACE_WORDS.EMPTY;
  if (hasBadChars(s)) return PLACE_WORDS.CHARS;
  if (Array.from(s).length > MAX_PLACE_TEXT) return PLACE_WORDS.LONG;
  if (looksLikeWebAddress(s)) return PLACE_WORDS.LINK;
  if (s.includes("@")) return PLACE_WORDS.EMAIL;
  if (/[<>]/.test(s)) return PLACE_WORDS.MARKUP;
  return null;
}

// what the stored opening says its typed place is: the text, or "" (get-my-posting and list-my-postings answers)
export const storedPlaceText = (posting) => (posting && typeof posting === "object" && typeof posting[PLACE_FIELD] === "string" ? posting[PLACE_FIELD] : "");

// the form's answer -> { outside, text } with the text collapsed (what is sent and what is compared with the stored one)
export function placeFromForm(v) {
  const outside = !!v && v.outside === true;
  return { outside, text: outside ? collapsePlaceText(v.locText) : null };
}
