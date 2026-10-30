// refine-hint.js - the two gentle lines above the results of a title search (October 20, 2026). They are only words: the search has already run and its results are shown whatever these say.
//   refineHints({ mode, query, count, truncated }) -> an array of 0, 1 or 2 plain sentences
//     mode       the answer's own mode ("phrase" for a title search; a req number, a postID or a KIO ID search never shows a hint)
//     query      the title words the person typed
//     count      how many openings came back; truncated: the database stopped at its limit of 25 (there are more)
//   1. MORE THAN REFINE_HINT_MAX_RESULTS (3) OPENINGS: "We found N openings. To narrow it, add a more specific word from the title, such as a team or function."  (with the limit reached: "We found more than 25 openings ...")
//   2. THE TYPED TITLE IS ONE GENERIC WORD (the filler words and punctuation left out): "That word is common in many titles. Adding another word from the title will narrow the results."
// Both can show at once (the count line first). None shows for a search that found nothing. The words are the ones John asked for; no word of fear, no "verified".
import { REFINE_HINT_MAX_RESULTS, GENERIC_TITLE_WORDS, TITLE_FILLER_WORDS } from "./config.js?v=cb962576";

// the typed title as its words: lower case, letters and digits only, the filler words left out
export function titleWords(text) {
  const filler = new Set(TITLE_FILLER_WORDS);
  return String(text == null ? "" : text).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w !== "" && !filler.has(w));
}
export function isGenericTitle(text) {
  const w = titleWords(text);
  return w.length === 1 && GENERIC_TITLE_WORDS.includes(w[0]);
}
export function refineHints({ mode, query, count, truncated }) {
  if (mode !== "phrase" || !Number.isInteger(count) || count < 1) return [];
  const out = [];
  if (count > REFINE_HINT_MAX_RESULTS) out.push(truncated === true ? "We found more than " + count + " openings. To narrow it, add a more specific word from the title, such as a team or function." : "We found " + count + " openings. To narrow it, add a more specific word from the title, such as a team or function.");
  if (isGenericTitle(query)) out.push("That word is common in many titles. Adding another word from the title will narrow the results.");
  return out;
}
