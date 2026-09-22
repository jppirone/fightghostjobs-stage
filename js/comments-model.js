// comments-model.js - the comments page's pure logic (design brief 7.4, 13, 16): what the page checks before sending, what the server's refusals mean in words, relative times, the link choices
// of a wrong-link report. The backend (candidate-post-comment and the database rule public.comment_problem) is the authority; these checks spare a round trip and a rate-limit token.

export const MIN_COMMENT = 10, MAX_COMMENT = 2000, MAX_REASON = 300, MAX_LINK_REPORT = 500, PAGE_SIZE = 25;

export const COMMENT_RULES = "10 to 2,000 characters of plain text. No web addresses. Never say where you found this posting (a job board, an application system, a social site) unless this page already shows that platform on one of its links. Comments are public and anonymous; anyone can report one.";

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
  link: "No web addresses in a comment. If a link on this posting is wrong, use “Report a wrong link” below instead.",
  civility: "That wording is not allowed here. Say it plainly and it will post.",
  source: "Comments can’t say where you found this posting: a job board, an application system, a social site, or “found it on …”. Take that out and it will post.",
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
  out.push({ value: "", text: "Something else about this posting’s links" });
  return out;
}
export function parseLinkChoice(value) {
  const m = /^(apply|recruiter):([1-9]|10)$/.exec(String(value || ""));
  return m ? { kind: m[1], position: Number(m[2]) } : { kind: null, position: null };
}
