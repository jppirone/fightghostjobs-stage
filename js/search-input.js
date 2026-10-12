// search-input.js - turns what a candidate typed into exactly what candidate-search accepts, and refuses early what the backend would refuse (so a typo costs no rate-limit budget).
// The backend is the authority: it accepts { company, phrase } OR { company, code }. Rules mirrored here (public.candidate_search_postings_v2):
//   company : at least 2 letters/digits, at most 200 characters
//   phrase  : at most 80 characters, and at least 3 letters/digits UNLESS it is in the equivalent-words list the database keeps (so "vp", "sr", "jr" work). The front end cannot know that list,
//             so it refuses locally only what is certainly refused (empty, no letter or digit at all, over 80 characters) and lets a 1 or 2 letter title go to the backend, which answers
//             { field: "phrase" } when it refuses one (see searchErrorMessage below).
//   code    : 12 characters of 0-9 A-Z minus I L O U (I and L read as 1, O as 0); spaces and hyphens ignored; at most 40 typed characters, printable ASCII only
// The people-facing lookup boxes are "Req number" and ONE box for "PostID, or part of the title", so this decides which of the two the text in that box is.

import { readKio, looksLikeKio } from "./kio.js?v=80867368";

const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{12}$/;

// the KIO ID (prompt BQ, October 12, 2026): what the page says for each answer of a lookup by ID. The ID alone is enough: no company is asked for.
export const KIO_INVALID_MESSAGE = "That ID is not valid. Check it and try again.";
export const KIO_NOT_REGISTERED_MESSAGE = "No opening is registered under that ID.";
export const KIO_GONE_MESSAGE = "This opening is no longer on FightGhostJobs.";
// prompt BS (October 12, 2026): the notice says plainly what is different, without accusing anyone, and what to check. It names what the person entered (the company exactly as typed, the job title the job ad
// carried), as text. When both were sent the database does not say which differs, so the sentence names both. The opening is shown below it: hiding it would hide the sign of a job ad that borrows a real company's ID.
const KIO_MISMATCH_TAIL = " It belongs to the opening shown below. Check that you copied the ID correctly from the job ad.";
export function kioMismatchMessage(company, title) {
  const c = String(company == null ? "" : company).trim(), t = String(title == null ? "" : title).trim();
  if (c !== "" && t !== "") return "This ID is not registered to the company or job title you entered (" + c + ", " + t + ")." + KIO_MISMATCH_TAIL;
  if (t !== "") return "This ID is not registered to the job title you entered (" + t + ")." + KIO_MISMATCH_TAIL;
  if (c !== "") return "This ID is not registered to the company you entered (" + c + ")." + KIO_MISMATCH_TAIL;
  return "This ID is not registered to the company or job title in the job ad." + KIO_MISMATCH_TAIL;
}

// What the page says when a search finds nothing: an echo of exactly what was searched, then the note. The last sentence of the note is deliberate: a title search lists only live or
// paused postings (candidate_search_postings_v2), so a posting that has closed or expired is found only by its postID, and without that sentence "no match" would read as "never registered".
// The echo lets a person see at a glance that they typed "Acme" where the employer registered "Acme Inc" (the company must match the registered name; it is not a prefix search).
export const NO_MATCH_NOTE = "An opening appears here only if an employer has added it to FightGhostJobs. A missing opening may simply not be added; it says nothing about whether the job exists. Check the company name, and check the ID exactly as it is printed in the job ad. If you searched by title, try a different part of the title. A title search finds only openings that are live: closed or expired openings are found only by Opening ID or req number.";

const clip = (s, n) => { const t = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

// kind: "phrase" | "code"  ->  No postings found for "Acme Inc" + "Senior Analyst". <note>
export function noMatchMessage(company, query, kind) {
  if (kind === "kio") return KIO_NOT_REGISTERED_MESSAGE;
  if (kind === "req") return "No openings found for \"" + clip(company, 80) + "\" with that req number. " + NO_MATCH_NOTE_REQ;
  const what = kind === "code" ? "code \"" + clip(query, 40) + "\"" : "\"" + clip(query, 80) + "\"";
  return "No openings found for \"" + clip(company, 80) + "\" + " + what + ". " + NO_MATCH_NOTE;
}

// The wording when a req-number lookup finds nothing: the req is never echoed (it was typed into a masked box).
export const NO_MATCH_NOTE_REQ = "Check the company name exactly as the employer entered it, and the req number exactly as printed in the job ad. If the job ad shows an Opening ID, try that instead. An opening appears here only if an employer has added it to FightGhostJobs; a missing opening may simply not be added.";

export function normalizeCode(text) {
  return String(text).toUpperCase().replace(/[ -]+/g, "").replace(/[IL]/g, "1").replace(/O/g, "0");
}
const alnumCount = (s) => (String(s).match(/[\p{L}\p{N}]/gu) || []).length;

export function checkCompany(text) {
  const t = String(text || "").trim();
  if (alnumCount(t) < 2) return { ok: false, message: "Enter the company name (at least 2 letters or digits)." };
  if (t.length > 200) return { ok: false, message: "That company name is too long." };
  return { ok: true, value: t };
}

// -> { ok:false, message } | { ok:true, kind:"phrase"|"code", value, alsoTryCode? }
export function classifyQuery(text) {
  const t = String(text || "").trim();
  if (t === "") return { ok: false, message: "Enter an Opening ID or part of the job title." };
  // the KIO ID first (prompt BQ): an ID that passes the check is searched by itself; a text that has the shape of an ID but fails the check is refused at once (nothing is sent: it costs no search)
  const k = readKio(t);
  if (k.kind === "kio") {
    const groupsK = /^[A-Za-z0-9]{4}([ -][A-Za-z0-9]{4}){2}$/.test(t);
    if (k.hadPrefix || groupsK || /[0-9]/.test(t)) return { ok: true, kind: "kio", value: k.stored, shown: k.display };
    // twelve plain letters that happen to pass the check could be a word: searched as a title, and as an ID only if the title finds nothing
    if (alnumCount(t) >= 3) return { ok: true, kind: "phrase", value: t, alsoTryCode: true, alsoTryKio: k.stored };
  }
  if (k.kind === "none" && looksLikeKio(t)) return { ok: false, message: KIO_INVALID_MESSAGE };
  const printable = /^[ -~]+$/.test(t);
  const norm = printable && t.length <= 40 ? normalizeCode(t) : "";
  const isCodeShape = CODE_RE.test(norm);
  if (isCodeShape) {
    const groups = /^[A-Za-z0-9]{4}([ -][A-Za-z0-9]{4}){2}$/.test(t);          // XXXX-XXXX-XXXX as the employer shares it
    const hasDigit = /[0-9]/.test(t);
    if (groups || hasDigit) return { ok: true, kind: "code", value: t };
    // twelve plain letters is a valid code shape but also a real word ("Receptionist"): search it as a title, and only fall back to a code lookup if the title finds nothing
    if (alnumCount(t) >= 3) return { ok: true, kind: "phrase", value: t, alsoTryCode: true };
  }
  // a title of 1 or 2 letters/digits is NOT refused here: the backend allows it when it is one of its equivalent words (VP, SR, JR) and refuses it otherwise (searchErrorMessage explains that answer)
  if (alnumCount(t) < 1) return { ok: false, message: "Enter some letters or digits from the job title, or an Opening ID." };
  if (t.length > 80) return { ok: false, message: "That title is too long (80 characters at most)." };
  return { ok: true, kind: "phrase", value: t };
}

// ---- the req number box (masked as it is typed). The backend accepts { company, req }: at most 100 characters, no control characters, and at least one letter or digit.
const hasControl = (s) => Array.from(String(s)).some((ch) => { const c = ch.codePointAt(0); return c < 32 || c === 127; });
export function checkReq(text) {
  const t = String(text || "").trim();
  if (alnumCount(t) < 1) return { ok: false, message: "Enter the req number from the job ad." };
  if (t.length > 100 || hasControl(t)) return { ok: false, message: "That req number is not valid (100 characters at most)." };
  return { ok: true, value: t };
}

// Two boxes, exactly one used: "Req number" or "PostID, or part of the title".  -> { ok:false, message, focus:"title"|"req" } | { ok:true, kind:"phrase"|"code"|"req", value, alsoTryCode? }
export function resolveSearch(titleText, reqText) {
  const hasTitle = String(titleText || "").trim() !== "", hasReq = String(reqText || "").trim() !== "";
  if (hasTitle && hasReq) return { ok: false, message: "Fill in the req number, or the Opening ID / title box, not both.", focus: "req", clearResults: true };   // prompt BK: the page clears the earlier results under this refusal
  if (!hasTitle && !hasReq) return { ok: false, message: "Enter a req number, an Opening ID or part of the job title.", focus: "req" };
  if (hasReq) { const r = checkReq(reqText); return r.ok ? { ok: true, kind: "req", value: r.value } : { ok: false, message: r.message, focus: "req" }; }
  const q = classifyQuery(titleText);
  return q.ok ? q : Object.assign({ focus: "title" }, q);
}

// ---- what the backend says when it refuses a search (HTTP 400 with { error, field }). The one answer people can actually hit is the short-title refusal:
// "phrase must contain at least 3 letters or digits (and be at most 80 characters)". The over-80 case is caught before the call, so this answer means "too short".
export const PHRASE_TOO_SHORT_MESSAGE = "That part of the title is too short to search on its own. Use at least 3 letters or digits, or a short form like VP, SR or JR if the employer used one.";
export function searchErrorMessage(error) {
  const e = error || {};
  if (e.field === "phrase" && /at least 3|too short/i.test(String(e.message || ""))) return PHRASE_TOO_SHORT_MESSAGE;
  return e.message || "That search was not accepted.";
}
// which box a refusal is about, so the page can put the cursor there: "company" | "req" | "title" | null
export function searchErrorFocus(error) {
  const f = error && error.field;
  return f === "company" ? "company" : f === "req" ? "req" : f === "phrase" || f === "code" || f === "kio" ? "title" : null;
}
