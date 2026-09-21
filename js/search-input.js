// search-input.js - turns what a candidate typed into exactly what candidate-search accepts, and refuses early what the backend would refuse (so a typo costs no rate-limit budget).
// The backend is the authority: it accepts { company, phrase } OR { company, code }. Rules mirrored here (public.candidate_search_postings):
//   company : at least 2 letters/digits, at most 200 characters
//   phrase  : at least 3 letters/digits (spaces excluded), at most 80 characters
//   code    : 12 characters of 0-9 A-Z minus I L O U (I and L read as 1, O as 0); spaces and hyphens ignored; at most 40 typed characters, printable ASCII only
// The people-facing field is ONE box ("Title or req code"), so this decides which of the two the text is.

const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{12}$/;

// What the page says when a search finds nothing: an echo of exactly what was searched, then the note. The last sentence of the note is deliberate: a title search lists only live or
// paused postings (candidate_search_postings), so a posting that has closed or expired is found only by its req code, and without that sentence "no match" would read as "never registered".
// The echo lets a person see at a glance that they typed "Acme" where the employer registered "Acme Inc" (the company must match the registered name; it is not a prefix search).
export const NO_MATCH_NOTE = "A posting appears here only if a real employer has registered it with FightGhostJobs, so a missing posting is itself worth knowing. Check the company name and try a shorter part of the title. Closed or expired postings appear only when you search by req code.";

const clip = (s, n) => { const t = String(s == null ? "" : s).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

// kind: "phrase" | "code"  ->  No postings found for "Acme Inc" + "Senior Analyst". <note>
export function noMatchMessage(company, query, kind) {
  const what = kind === "code" ? "code \"" + clip(query, 40) + "\"" : "\"" + clip(query, 80) + "\"";
  return "No postings found for \"" + clip(company, 80) + "\" + " + what + ". " + NO_MATCH_NOTE;
}

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
  if (t === "") return { ok: false, message: "Enter a job title or a req code." };
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
  if (alnumCount(t.replace(/\s+/g, "")) < 3) return { ok: false, message: "Enter at least 3 letters or digits for the title (or a full req code)." };
  if (t.length > 80) return { ok: false, message: "That title is too long (80 characters at most)." };
  return { ok: true, kind: "phrase", value: t };
}
