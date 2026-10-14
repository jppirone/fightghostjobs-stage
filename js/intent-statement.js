// intent-statement.js - the employer's optional statement of the kind of an opening (prompt ST1, part C of the AI and hiring statement and intent spec). Pure (no DOM): tested in Node (tests/intent.test.js).
// One OPTIONAL choice per opening: not stated (the default; candidates see nothing) or exactly one of four values. Two of them take a date. The server and the database are the authority (create-posting,
// edit-posting, postings_intent_statement_check, postings_intent_date_rule); these checks only spare the employer a round trip.
// The WORDS are not here: the employer's labels come from the database's wording table (public.intent_statement_options, changed by staff with no deploy) and the sentence a candidate reads is built there
// too and arrives finished. DEFAULT_INTENT_OPTIONS is only what the employer's page offers when that list could not be read.

export const INTENT_CODES = ["fill_by", "fill_no_sooner", "not_current", "legal_requirement"];
export const INTENT_DATE_CODES = ["fill_by", "fill_no_sooner"];
export const takesDate = (code) => INTENT_DATE_CODES.includes(code);

// the spec's value names and meanings (the same text the wording table is seeded with)
export const DEFAULT_INTENT_OPTIONS = [
  { code: "fill_by", label: "Current vacancy, fill by a date", meaning: "The employer intends to fill this opening within 90 days or less.", needs_date: true },
  { code: "fill_no_sooner", label: "Current vacancy, fill no sooner than a date", meaning: "The employer expects to fill this opening after more than 90 days.", needs_date: true },
  { code: "not_current", label: "Not a current vacancy", meaning: "The employer is collecting applications for the future.", needs_date: false },
  { code: "legal_requirement", label: "Advertised to meet a legal or policy requirement", meaning: "The employer is advertising because a rule requires it; a candidate may already be identified.", needs_date: false },
];

// the words on the employer's pages (owner review: listed in the report). Nothing here says that a choice satisfies any law.
export const INTENT_WORDS = {
  LABEL: "Kind of opening (optional)",
  NOT_STATED: "Not stated",
  HINT: "Optional. Say what kind of opening this is. Candidates read it as a line that begins \"The employer says\". Leave it as Not stated to show nothing.",
  DATE_FILL_BY: "Fill by (date)",
  DATE_FILL_NO_SOONER: "Earliest fill date",
  DATE_NEEDED: "Choose the date that goes with this kind of opening.",
  DATE_BAD: "Enter the date as a real day.",
  UNAVAILABLE: "Stating the kind of an opening is not available right now. The rest of the opening can be saved.",
};
export const dateLabelFor = (code) => (code === "fill_by" ? INTENT_WORDS.DATE_FILL_BY : INTENT_WORDS.DATE_FILL_NO_SOONER);

const isStr = (v) => typeof v === "string";
// the list the database function intent_statement_options answers: [{ code, label, meaning, needs_date }] in order, only known codes, nothing else read
export function intentOptionsOk(d) {
  return Array.isArray(d) && d.length > 0 && d.length <= 4 && d.every((o) => o && typeof o === "object" && INTENT_CODES.includes(o.code) && isStr(o.label) && o.label.trim() !== "" && o.label.length <= 120
    && isStr(o.meaning) && o.meaning.length <= 300 && typeof o.needs_date === "boolean" && o.needs_date === takesDate(o.code));
}
// the options a page shows: the database's list when it is good, else the spec's; a value the opening already holds that is no longer offered stays selectable (so the page never changes it by accident)
export function optionsFor(list, current) {
  const base = intentOptionsOk(list) ? list.map((o) => ({ code: o.code, label: o.label.trim(), meaning: o.meaning, needs_date: o.needs_date })) : DEFAULT_INTENT_OPTIONS.map((o) => ({ ...o }));
  if (INTENT_CODES.includes(current) && !base.some((o) => o.code === current)) {
    const d = DEFAULT_INTENT_OPTIONS.find((o) => o.code === current);
    base.push({ code: current, label: d.label, meaning: d.meaning, needs_date: d.needs_date });
  }
  return base;
}

// "2026-12-01" is a real calendar day (the page's date box gives exactly this; a typed value may not)
export function dayOk(s) {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(s == null ? "" : s));
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  return y >= 2000 && y <= 2200 && t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

// code: the select's value ("" = not stated); date: the date box's text. -> null when fine, else the sentence to show under the date box
export function intentProblem(code, date) {
  const c = String(code == null ? "" : code);
  if (c === "") return null;
  if (!INTENT_CODES.includes(c)) return INTENT_WORDS.UNAVAILABLE;
  if (!takesDate(c)) return null;
  const d = String(date == null ? "" : date).trim();
  if (d === "") return INTENT_WORDS.DATE_NEEDED;
  return dayOk(d) ? null : INTENT_WORDS.DATE_BAD;
}

// the fields create-posting reads: nothing at all when not stated
export function intentFields(code, date) {
  const c = String(code == null ? "" : code);
  if (!INTENT_CODES.includes(c)) return {};
  return takesDate(c) ? { intent_statement: c, intent_date: String(date).trim() } : { intent_statement: c };
}

// what edit-posting is sent: only what changed. orig: the stored { intent_statement, intent_date } (null when not stated); code / date: the form. The word not_stated takes a statement away (with its date);
// a value that takes no date is sent with intent_date null so the server's check of the resulting state passes.
export function intentChange(orig, code, date) {
  const o = orig && typeof orig === "object" ? orig : {};
  const was = INTENT_CODES.includes(o.intent_statement) ? o.intent_statement : "";
  const wasDate = typeof o.intent_date === "string" ? o.intent_date : "";
  const c = INTENT_CODES.includes(String(code == null ? "" : code)) ? String(code) : "";
  const d = takesDate(c) ? String(date == null ? "" : date).trim() : "";
  if (c === was && d === wasDate) return {};
  if (c === "") return was === "" ? {} : { intent_statement: "not_stated" };
  const out = {};
  if (c !== was) out.intent_statement = c;
  if (takesDate(c)) { if (d !== wasDate || c !== was) out.intent_date = d; } else if (wasDate !== "") out.intent_date = null;
  return out;
}

// the server's field names -> the ids of the page's boxes (for showing a refusal under the right box)
// (both land on the one error line under the choice, which stays in the page whatever value is chosen)
export const INTENT_FIELD_IDS = { intent_statement: "intentDate", intent_date: "intentDate" };

// What a candidate reads. p: a search row or the details' posting. -> [{ key, label, text }], like aiNotes(): nothing at all when the opening does not state a kind. The sentence arrives finished from the
// database (built from the staff wording table); it is shown only if it is a plain sentence that begins "The employer says" (we present what the employer says, we do not confirm it), never anything else.
export const INTENT_LINE_START = "The employer says";
export function intentNotes(p) {
  const t = p && typeof p === "object" ? p.intent_line : null;
  if (typeof t !== "string") return [];
  const s = t.trim();
  if (s.length < 10 || s.length > 300 || !s.startsWith(INTENT_LINE_START) || /[\u0000-\u001f\u007f]/.test(s)) return [];
  return [{ key: "intent", label: "Kind of opening", text: s }];
}
