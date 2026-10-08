// comments-model.js - the comments page's pure logic (design brief 7.4, 13, 16): what the page checks before sending, what the server's refusals mean in words, relative times, the link choices
// of a wrong-link report. The backend (candidate-post-comment and the database rule public.comment_problem) is the authority; these checks spare a round trip and a rate-limit token.

import { describeError } from "./api.js";
import { waitText } from "./format.js";

export const MIN_COMMENT = 10, MAX_COMMENT = 2000, MAX_REASON = 300, MAX_LINK_REPORT = 500, PAGE_SIZE = 25;

export const COMMENT_RULES = "10 to 2,000 characters of plain text. No web addresses. Never say where you found this job ad (a job board, an application system, a social site) unless this page already shows that platform on one of its links. Comments are public and anonymous; anyone can report one.";

// control and invisible characters, built by code point so the file holds none: C0 controls except tab, line feed and carriage return; C1; soft hyphen; zero-width and bidi characters; the byte-order mark
const cc = (n) => String.fromCharCode(n);
const BAD = new RegExp("[" + cc(0) + "-" + cc(8) + cc(11) + cc(12) + cc(14) + "-" + cc(31) + cc(127) + "-" + cc(159) + cc(173) + cc(847) + cc(6158) + cc(8203) + "-" + cc(8207) + cc(8232) + "-" + cc(8238) + cc(8288) + "-" + cc(8292) + cc(65279) + "]");
const ONE_LINE_BAD = new RegExp("[" + cc(0) + "-" + cc(31) + cc(127) + "-" + cc(159) + "]");

// the comment as typed -> { text, problem } (text: line breaks normalised to LF, trimmed; problem: the sentence to show, or null)
export function checkComment(raw) {
  const text = String(raw == null ? "" : raw).replace(/\r\n?/g, "\n").replace(/^[\s]+|[\s]+$/g, "");
  if (BAD.test(text)) return { text, problem: "Plain text only, please (no control or invisible characters)." };
  const n = Array.from(text).length;
  if (n < MIN_COMMENT) return { text, problem: n === 0 ? "Write your comment first." : "Say a little more: at least " + MIN_COMMENT + " characters." };
  if (n > MAX_COMMENT) return { text, problem: "Keep it to " + MAX_COMMENT.toLocaleString("en-US") + " characters (" + n.toLocaleString("en-US") + " now)." };
  return { text, problem: null };
}

// what the server's refusal reasons mean (candidate-post-comment answers 400 with reason: chars | short | long | link | civility | source)
export const REFUSAL_TEXT = {
  chars: "Plain text only, please (no control or invisible characters).",
  short: "Say a little more: at least " + MIN_COMMENT + " characters.",
  long: "Keep it to " + MAX_COMMENT.toLocaleString("en-US") + " characters.",
  link: "No web addresses in a comment. If a link on this opening is wrong, use “Report a wrong link” below instead.",
  civility: "That wording is not allowed here. Say it plainly and it will post.",
  source: "Comments can’t say where you found this job ad: a job board, an application system, a social site, or “found it on …”. Take that out and it will post.",
};
export const refusalText = (err) => (err && REFUSAL_TEXT[err.reason]) || (err && err.message) || "The comment was not accepted.";

// a report's reason (one line, 1-300) and a wrong-link report's detail (1-500, line breaks fine) -> the problem or null
export function checkReason(raw) {
  const t = String(raw == null ? "" : raw).trim();
  if (t === "") return "Say why, in a few words.";
  if (ONE_LINE_BAD.test(t)) return "One line of plain text, please.";
  if (Array.from(t).length > MAX_REASON) return "Keep it to " + MAX_REASON + " characters.";
  return null;
}
export function checkLinkReport(raw) {
  const t = String(raw == null ? "" : raw).replace(/\r\n?/g, "\n").trim();
  if (t === "") return "Say what happened: where the link took you, or what was wrong.";
  if (BAD.test(t)) return "Plain text only, please.";
  if (Array.from(t).length > MAX_LINK_REPORT) return "Keep it to " + MAX_LINK_REPORT + " characters.";
  return null;
}

// "Verified candidate · 3 days ago": relative for a month, then the date
export function ago(iso, nowMs) {
  const t = Date.parse(iso); if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.floor(((typeof nowMs === "number" ? nowMs : Date.now()) - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return m + (m === 1 ? " minute ago" : " minutes ago");
  const hh = Math.floor(m / 60); if (hh < 24) return hh + (hh === 1 ? " hour ago" : " hours ago");
  const d = Math.floor(hh / 24); if (d === 1) return "yesterday"; if (d < 7) return d + " days ago";
  const w = Math.floor(d / 7); if (d < 31) return w + (w === 1 ? " week ago" : " weeks ago");
  return "on " + new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// the links a wrong-link report can point at, from the candidate detail's links: [{ value: "kind:position", text }]; plus the "something else" choice
export function linkChoices(links) {
  const out = (Array.isArray(links) ? links : []).map((l) => {
    const kind = l.kind === "recruiter" ? "recruiter" : "apply";
    const text = kind === "recruiter" ? "Recruiter firm: " + (l.firm || "?") + (l.label ? " (" + l.label + ")" : "") : "Link " + l.position + ": " + (l.label || "Application link " + l.position);
    return { value: kind + ":" + l.position, text };
  });
  out.push({ value: "", text: "Something else about this opening’s links" });
  return out;
}
// the "Which link?" label and dropdown are shown only when the posting has links to choose from (none for a paused, closed or expired posting, for an organization without the destination links tier, or when the employer gave none); the report can still be sent with no specific link
// the links a candidate detail answer carries: none on the not-open answer (409), none when the destination links tier does not apply
export function detailLinks(d) { return d && d.ok && d.data && Array.isArray(d.data.links) ? d.data.links : []; }
export function showLinkPicker(links) { return Array.isArray(links) && links.length > 0; }
// how long a rate-limited button stays disabled, in milliseconds: at least one second, never beyond what one timer can hold
export function cooldownMs(seconds) { return Math.min(2147483647, Math.max(1, Math.ceil(Number(seconds) || 0)) * 1000); }
export function parseLinkChoice(value) {
  const m = /^(apply|recruiter):([1-9]|10)$/.exec(String(value || ""));
  return m ? { kind: m[1], position: Number(m[2]) } : { kind: null, position: null };
}

// ---- contested comments (item A): the employer or poster who owns a posting can contest one comment on it, once. The comment stays visible, with this notice, while the contest is open.
// The server (the contest-comment function and the database) is the authority for every rule below; these checks spare a round trip and a rate-limit token, and the numbers the server answers with replace the defaults.

// THE notice: shown on a contested comment to candidates AND to the employer. Defined here and nowhere else (tests/site-check.js S36 pins the text and that both views use this constant).
export const CONTEST_NOTICE = "This comment has been contested by the employer and is under review. It may be removed after additional investigation, at the sole discretion of FightGhostJobs.com.";

// what the employer reads before the contest is filed (the confirm step)
export const CONTEST_CONFIRM = "The comment stays visible to everyone, with a notice that it is under review, while FightGhostJobs.com reviews it. A comment can be contested only once.";

// shown when the server says this comment already has a contest, open or decided
export const CONTEST_ALREADY = "This comment has already been contested and cannot be contested again.";

// the six reasons: the code is what is sent, the label is what is shown (the dropdown is built from this list and from nothing else)
export const CONTEST_CATEGORIES = [
  { code: "inaccurate", label: "Factually inaccurate about this opening" },
  { code: "closed_or_outdated", label: "Opening closed or comment outdated" },
  { code: "confidential_or_personal", label: "Contains confidential or personal information" },
  { code: "not_about_posting", label: "Not about this opening" },
  { code: "abusive", label: "Abusive language" },
  { code: "other", label: "Other" },
];
export const contestCategoryLabel = (code) => { const c = CONTEST_CATEGORIES.find((x) => x.code === code); return c ? c.label : null; };

// first display only: the server's own limits (explanation_length answers carry min and max) replace these as soon as one arrives
export const DEFAULT_CONTEST_LIMITS = Object.freeze({ min: 30, max: 1000 });

// the limits to use after a refusal: the server's min and max when both are whole numbers in a sane range, else what was in use
export function contestLimits(err, current) {
  const keep = { min: current && Number.isInteger(current.min) ? current.min : DEFAULT_CONTEST_LIMITS.min, max: current && Number.isInteger(current.max) ? current.max : DEFAULT_CONTEST_LIMITS.max };
  if (err && err.code === "explanation_length" && Number.isInteger(err.min) && Number.isInteger(err.max) && err.min >= 1 && err.max >= err.min && err.max <= 5000) return { min: err.min, max: err.max };
  return keep;
}

// the explanation as the server will measure it: line breaks as LF, spaces, tabs and line breaks trimmed at both ends
export const normalizeExplanation = (raw) => String(raw == null ? "" : raw).replace(/\r\n?/g, "\n").replace(/^[ \t\n]+|[ \t\n]+$/g, "");
// control characters (except tab, line feed, carriage return), zero-width and bidi-control characters, by code point so the file holds none
const EXPLANATION_BAD = new RegExp("[" + cc(0) + "-" + cc(8) + cc(11) + cc(12) + cc(14) + "-" + cc(31) + cc(127) + "-" + cc(159) + cc(8203) + "-" + cc(8207) + cc(8234) + "-" + cc(8238) + cc(8294) + "-" + cc(8297) + cc(65279) + "]");
const num = (n) => Number(n).toLocaleString("en-US");

// the live counter under the explanation box: "12 / 1,000 characters (at least 30)"
export function contestCounter(raw, limits) {
  const l = limits || DEFAULT_CONTEST_LIMITS;
  return num(Array.from(normalizeExplanation(raw)).length) + " / " + num(l.max) + " characters (at least " + num(l.min) + ")";
}

// the chosen reason -> the problem or null (the empty choice is the prompt, not a reason)
export const checkContestCategory = (code) => (CONTEST_CATEGORIES.some((c) => c.code === code) ? null : "Choose a reason from the list.");

// the explanation as typed -> { text, problem } (a written explanation is required for every reason, "Other" included)
export function checkContestExplanation(raw, limits) {
  const l = limits || DEFAULT_CONTEST_LIMITS, text = normalizeExplanation(raw), n = Array.from(text).length;
  if (n === 0) return { text, problem: "Write your explanation first. It is required for every reason." };
  if (n < l.min) return { text, problem: "Say a little more: at least " + num(l.min) + " characters (" + num(n) + " now)." };
  if (n > l.max) return { text, problem: "Keep it to " + num(l.max) + " characters (" + num(n) + " now)." };
  if (EXPLANATION_BAD.test(text)) return { text, problem: "Plain text only, please (no control or invisible characters)." };
  return { text, problem: null };
}

// what each answer of the contest-comment function means in words: { text, where, settled }
//   where: "category" | "explanation" (the form goes back to that field) | "form" (the message stays under the confirm step)
//   settled: true when trying again cannot help (the form is closed and the text stays in its place)
// not_found is ONE neutral message for every cause: it must not tell anyone whether a comment exists or who owns it.
export function contestRefusal(err, limits) {
  const l = limits || DEFAULT_CONTEST_LIMITS, code = err && err.code;
  switch (code) {
    case "invalid_category": return { text: "Choose a reason from the list.", where: "category", settled: false };
    case "explanation_length": return { text: "The explanation must be between " + num(l.min) + " and " + num(l.max) + " characters.", where: "explanation", settled: false };
    case "explanation_chars": return { text: "Plain text only, please (no control or invisible characters).", where: "explanation", settled: false };
    case "already_contested": return { text: CONTEST_ALREADY, where: "form", settled: true };
    case "not_found": return { text: "This comment could not be contested. Reload the page to see the comments as they are now.", where: "form", settled: true };
    case "limit_open": return { text: Number.isInteger(err.limit) ? "Your organization already has " + num(err.limit) + " contests under review, which is the most it can have at once." : "Your organization already has the most contests under review that it can have at once.", where: "form", settled: false };
    case "limit_month": return { text: Number.isInteger(err.limit) ? "Your organization has already filed " + num(err.limit) + " contests in the last 30 days, which is the most it can file in that time." : "Your organization has already filed the most contests it can file in the last 30 days.", where: "form", settled: false };
    case "rate_limited": return { text: "You are filing too fast. Try again in " + waitText(err.retryAfter || 60) + ".", where: "form", settled: false };
    default: return { text: describeError(err, { what: "The contest" }), where: "form", settled: false };
  }
}
