// reader.js - reads a BLOCK OF TEXT (what a phone read out of a screenshot of a job card or a job page) into the search fields (prompt HS, November 1 to 2, 2026; prompt HT, November 1, 2026). Pure functions, no browser API, no network, nothing stored: unit tested.
//   readText(text) -> { company, title, kio, kioStored, req, reqUnlabelled, cut: { company, title }, notes: { company, title, kio, req }, cards: [{ company, title, notes }], seen: { cards, truncated } }
//   Each of company, title, kio, req is a cleaned string or null. NOTHING IS GUESSED: a field that is not clearly there is null and the person types it. A wrong value is worse than a null.
// WHAT IS REUSED (not copied): the extension's own extractor (extractor.js: findAllValues for labelled fields "Company:", "Role:", "Req ID:", "KIO ID:", the headline "<title> at <company>", and the KIO ID and req number wherever they are; cleanCompany and
// cleanTitle for the cleaning and the caps company 200 and title 80) and kio.js (the KIO ID check character). WHAT IS NEW here is only the reading of the plain TEXT of a job CARD, which has no boxes and no labels:
//   a card is a run of title lines, then the company line, then detail lines (a place, a pay line, benefits, a work mode, a badge such as Viewed or Promoted). The company is the line right above the first detail line; the title is the lines above that
//   (a title wrapped over two or three lines is joined). A line that holds "Company, place, 2 days ago" separated by dots gives the company from its first part.
// RULES THAT KEEP IT HONEST: more than one card in the text -> company and title are null (which opening is meant is not clear), the cards are listed so the person can tap the one they mean; a run of text that has a sentence in it is not a card;
// a company line that reads like a job title, a card with a single text line, a title of more than three lines, or a company line that follows a title line ending in a comma, a dash or an ampersand -> null with a note.
// PROMPT HT (real phone screenshots): icons and logos that the text reader turned into letters are dropped (a lone close mark, a shield read as a copyright sign, a badge icon read as one letter before a badge); benefits lines and a few more badges count as details;
// a value that is CUT OFF on the screen (it ends with dots) is KEPT without the dots and flagged (cut.company, cut.title): the page says "This looks cut off. Check it."; a requisition number written as "(R12345)" or "(R-12345)" at the end of a title line is
// taken as an UNLABELLED candidate (reqUnlabelled) and removed from the title; the engine's habit of reading the letters AI as Al is corrected in a title.
// (Every special character below is written as a character code inside a string, never typed into a regular expression, so no file carries a hidden character.)
import { findAllValues, cleanCompany, fitTitle, stripEdges, isCutOff } from "../extractor.js?v=443daa62";
import { readKio } from "../kio.js?v=5b8d8489";

export const LIMITS = { text: 6000, lines: 120, cardLines: 4, titleLines: 3, companyLines: 3, words: 14, lineChars: 100 };

const rx = (src, flags = "") => new RegExp(src, flags);
const U = (...codes) => codes.map((c) => "\\u" + c.toString(16).padStart(4, "0")).join("");   // character codes -> the text of a regular expression
const MIDDOT = U(0xb7), BULLET = U(0x2022), ELLIPSIS = U(0x2026);

// ---- 1. the text -> lines. Line breaks of every kind; the invisible characters and the no-break space go; a bullet, a dot between items, a bar or an icon read as a symbol (a copyright sign, a registered sign, an at sign, an angle quote, a yen sign)
// at the START or END of a line is a stray symbol and goes; a lone x or xX (a close mark read as letters) at the start or end of a line goes; blank lines go.
const LINE_BREAK = rx("\\r\\n|\\r|\\n|" + U(0x2028) + "|" + U(0x2029));
const INVISIBLE = rx("[" + U(0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2060, 0xfeff) + "]", "g");
const NO_BREAK_SPACE = rx(U(0xa0), "g");
const STRAY = "\\s" + U(0x2022, 0xb7, 0x25aa, 0x25cf, 0x25e6, 0x2023, 0x2043, 0x2219, 0xa9, 0xae, 0x40, 0xab, 0xbb, 0xa5, 0x2122) + "|*";
const STRAY_EDGE = rx("^[" + STRAY + "]+|[" + STRAY + "]+$", "g");
const CLOSE_LEAD = /^(?:xX|Xx|x)\s+(?=\S)/, CLOSE_TRAIL = /\s+x$/;
export function toLines(text) {
  const raw = String(text == null ? "" : text);
  const truncated = raw.length > LIMITS.text;
  const lines = [];
  for (const piece of raw.slice(0, LIMITS.text).split(LINE_BREAK)) {
    let t = piece.replace(INVISIBLE, "").replace(NO_BREAK_SPACE, " ").replace(/\s+/g, " ").trim(), prev;
    do { prev = t; t = t.replace(STRAY_EDGE, "").replace(CLOSE_LEAD, "").replace(CLOSE_TRAIL, "").trim(); } while (t !== prev);
    if (t !== "") lines.push(t);
    if (lines.length >= LIMITS.lines) break;
  }
  return { lines, truncated };
}

// ---- 2. what a line is: chrome (the app around the card), noise (an icon or logo read as a few letters), a detail of the card (place, pay, benefits, work mode, a badge, a time), or text (a title line or the company line)
const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR AB BC MB NB NL NS ON PE QC SK".split(" ");
const STATE_RE = STATES.join("|");
const NAME_CHARS = "[\\p{L}.'" + U(0x2019) + " -]";
const PLACE = [
  rx("^" + NAME_CHARS + "{2,40},\\s*(?:" + STATE_RE + ")(?![A-Za-z])(?:\\s+\\d{5}(?:-\\d{4})?)?(?:\\s*[,(].*|\\s+[-" + MIDDOT + BULLET + U(0xab, 0xbb) + "].*)?$", "u"),            // Miami, FL   Miami, FL (Hybrid)   Austin, TX, United States   Minneapolis, MN - Remote
  rx("^" + NAME_CHARS + "{2,40},\\s*[\\p{L} ]{2,30},\\s*(?:united states|usa|us|canada|united kingdom|uk)$", "iu"),   // Miami, Florida, United States
  rx("^(?:greater\\s+)?" + NAME_CHARS + "{2,40}\\s+(?:metropolitan\\s+)?area(?:\\s*\\(.*\\))?$", "iu"),     // Greater Miami Area
  rx("^(?:remote|hybrid|on-?site|anywhere|united states|usa|worldwide)(?:\\s*[,(" + MIDDOT + "].*)?$", "i"),   // Remote   United States
  /\((?:remote|hybrid|on-?site)\)\s*$/i,
  /^remote in .{2,40}$/i,                                                                                    // Remote in Remote   Remote in Seattle, WA
  rx("," + "\\s*(?:" + ELLIPSIS + "|\\.{3})$"),                                                              // a place cut off after a comma: "Florida,..."
];
// a pay line has an amount followed by a range dash, a slash, a period word or the end ("$8 Shortcut Input" is an icon read as $8 and a label, not pay)
const PAY = [rx("[$" + U(0xa3, 0x20ac) + "]\\s*\\d[\\d,]*(?:\\.\\d+)?\\s*[kK]?(?:\\s*(?:-|/|to\\b|an?\\b|per\\b|yr\\b|hr\\b|\\()|\\s*$)", "i"), /\b\d+(?:\.\d+)?\s*[kK]?\s*\/\s*(?:yr|hr|year|hour|mo|month|wk|week)\b/i];
const MODE = rx("^(?:full[- ]?time|part[- ]?time|contract|temporary|internship|intern|permanent|freelance|per diem)(?:\\s*[," + MIDDOT + "-].*)?$", "i");
const AGO = "(?:\\d+\\s*(?:seconds?|minutes?|mins?|hours?|hrs?|days?|weeks?|wks?|months?|mos?|yrs?|years?)\\s+ago|(?:just now|today|yesterday))";
const APOS = "['" + U(0x2019) + "]";
const BADGE_WORDS = rx("^(?:" + [
  "viewed", "promoted", "easy apply", "\\d+-click apply", "actively reviewing applicants", "actively recruiting", "actively hiring", "new", "applied", "saved", "reposted", "hiring", "urgently hiring", "be an early applicant", "you" + APOS + "?d be a top applicant", "be seen first",
  "be among the first \\d+ applicants", "over \\d+ applicants", "\\d+\\+? applicants?", "\\d+ people clicked apply", "\\d+ (?:school alumni|company alumni|alumni|connections?|mutual connections?|people you know)", "\\d+ (?:school alumni|company alumni|alumni|connections?|people|contacts?) (?:work|works|worked) here", "connections? (?:work|works|worked) here", "easily apply", "(?:an? |per )?(?:hour|year|month|week|day)",
  "responses managed off \\w+", "no longer accepting applications", AGO, "posted " + AGO, "reposted " + AGO,
].join("|") + ")$", "i");
const BENEFIT = "(?:medical|vision|dental|401\\(k\\)|401k|life|disability|pto|paid time off|bonus|equity|retirement|insurance|health|tuition assistance)";
const BENEFITS = rx("^" + BENEFIT + "(?:\\s*(?:,|and|&)\\s*" + BENEFIT + ")*(?:\\s+benefits?)?$", "i");   // Medical, Vision, Dental, 401(k)   401(k) benefit   Retirement
const CHROME = rx("^(?:" + [
  "jobs?", "search", "home", "my network", "messaging", "notifications", "back", "share", "save", "apply", "done", "cancel", "close", "menu", "filters?", "sort by.*", "show (?:all|more|less)", "see (?:all|more|less)", "view (?:all|more)",
  "top job picks for you", "jobs? (?:based on|similar|you may|for you|picked).*", "jobs that match.*", "based on your.*", "describe the job.*", "recommended(?: for you)?", "suggested.*", "more jobs.*", "similar jobs.*", "\\d[\\d,]* results?", "results?", "people also viewed", "about the job", "job description",
  "\\d{1,2}:\\d{2}(?:\\s*[ap]m)?", "\\d{1,3}%", "welcome back.*", "matches your preferences", "career scout", "my jobs", "messages", "my network notifications", "more\\.?", "lte|5g|4g|wi-?fi", "[<>" + U(0x2039, 0x203a, 0xab, 0xbb) + "]+", "easy apply to .*",
  "\\d[\\d,]*\\+?\\s+new\\b.*\\bjobs?\\b(?:\\s+(?:in|near|for|at|from)\\b.*)?", "(?:these )?jobs? (?:match|matches|matching)\\b.*", "new jobs?(?: for you| in .*)?", "(?:view|see) (?:all|more)(?: \\w+)? jobs?", "(?:your|manage your|manage|edit your) (?:saved )?job alerts?.*", "unsubscribe(?:\\s+(?:from|here|or|now|link)\\b.*)?",   // the header and footer of a job alert email
].join("|") + ")$", "i");
const TITLE_WORDS = /\b(?:manager|engineer|analyst|director|specialist|coordinator|developer|associate|assistant|officer|lead|representative|consultant|designer|recruiter|administrator|supervisor|technician|scientist|architect|intern|executive|accountant|programmer|planner|buyer|clerk|operator|nurse|therapist|advisor|adviser|strategist|writer|editor|agent|president|vp|head of)\b/i;
const SPLIT_PARTS = rx("\\s+[" + MIDDOT + BULLET + "|-]\\s+");
const splitParts = (t) => t.split(SPLIT_PARTS).map((s) => s.trim()).filter(Boolean);
const isPlace = (t) => PLACE.some((re) => re.test(t));
const isPay = (t) => PAY.some((re) => re.test(t));
const isDetailPart = (t) => isPlace(t) || isPay(t) || MODE.test(t) || BENEFITS.test(t) || BADGE_WORDS.test(t.replace(/[.!]+$/, ""));
// a labelled detail ("Location: ...", "Requisition ID: ...", "KIO ID ...") or a line that holds a KIO ID belongs to the card as a detail, it is never a title or company line
const KNOWN_LABEL = /^(?:location|salary|pay|compensation|posted|employment type|seniority level|job function|industry|work\s*mode|schedule|department|company|employer|role|position|title|job\s*title|req(?:uisition)?(?:\s*(?:id|1d|number|no|num|#))?|job\s*(?:id|1d|number|no|num|#|code)|(?:kio|post|opening)\s*(?:id|1d))\s*[:#]/i;
const HAS_KIO = /\bKIO[\s-]*[0-9A-Z]{4}/i;
// the phone's status bar can be read as ONE line ("9:41 5G 100%"): a line made only of status bar words is chrome
const STATUS_TOKEN = /^(?:\d{1,2}:\d{2}(?:[ap]m)?|\d{1,3}%|lte|5g|4g|3g|wi-?fi|e|ge)$/i;
const SHORT_CAPS = /^[A-Z][A-Z0-9&]{1,4}$/;
// a badge icon is read as one or two letters before the words ("A You'd be a top applicant"), an icon after them the same way, and "Promoted ." can be read as "Promoted -": the line is tried without its first short token, without its last short token and without a trailing dash
function variants(t) {
  const tok = t.split(" "), out = [t];
  if (tok.length >= 2 && tok[0].length <= 2) out.push(tok.slice(1).join(" "));
  if (tok.length >= 2 && tok[tok.length - 1].length <= 2) out.push(tok.slice(0, -1).join(" "));
  const dash = t.replace(/\s*[-]+$/, "").trim();
  if (dash !== t && dash !== "") out.push(dash);
  // "1 week ago " + bullet + "in": the logo word at the end goes with the short token, and the bullet it leaves behind goes too
  for (const v of out.slice()) { const s = v.replace(STRAY_EDGE, "").trim(); if (s !== "" && !out.includes(s)) out.push(s); }
  return out;
}
const ADDRESS_TEXT = /%[0-9A-Fa-f]{2}|:\/\/|www\.|\.html\b|#\w=/;   // a web address or encoded text (the text of a shortcut, a link): not a title or company
const ABBREV = /\b(Sr|Jr|St|Dr|Mr|Ms|Mrs|Inc|Co|Corp|Ltd|vs|No)\./g;   // "Sr. Project Manager" is a title, not the end of a sentence
const CUT_PLACE = /^[\p{L} .'-]{2,30},$/u;   // a place cut off after its comma ("Florida,") after "Company - ": the dots were lost by the engine
function classify(t) {
  if (ADDRESS_TEXT.test(t) || /describe the job you/i.test(t)) return { kind: "chrome" };   // the search bar of a job app, with an icon read as letters before it ("G Q, Describe the job you want")
  if (/^\(R-?\d{4,8}\)$/.test(t)) return { kind: "text" };   // an unlabelled requisition number on a title line of its own is part of the title block
  if (CHROME.test(t) || t.split(/\s+/).every((tok) => STATUS_TOKEN.test(tok))) return { kind: "chrome" };
  for (const v of variants(t)) {
    if (CHROME.test(v) && v !== t) return { kind: "chrome" };   // "Show all =": the arrow after the words was read as a symbol
    if (KNOWN_LABEL.test(v) || HAS_KIO.test(v)) return { kind: "detail" };
    const parts = splitParts(v);
    if (isDetailPart(v) || (parts.length > 1 && parts.every(isDetailPart))) return { kind: "detail" };
    // "Company . Place . 2 days ago": the first part is a company and every other part is a detail of the card
    if (parts.length > 1 && !isDetailPart(parts[0]) && parts.slice(1).every((p) => isDetailPart(p) || CUT_PLACE.test(p))) return { kind: "companydetail", company: parts[0] };
  }
  // an icon or a logo read as a few symbols or letters ("9", "xX", "oul"), and the signal and battery of the status bar read as a short word and numbers ("wll 2 (59", "TIE 58"): no word of four letters and a digit in it
  if ((!/\p{L}{3}/u.test(t) && !SHORT_CAPS.test(t)) || /^[a-z]{1,4}$/.test(t) || (!/\p{L}{4}/u.test(t) && /\d/.test(t))) return { kind: "noise" };
  const words = t.split(/\s+/).length;
  if (words > LIMITS.words || t.length > LIMITS.lineChars || /[.!?]\s+\p{Lu}/u.test(t.replace(ABBREV, "$1")) || (/[.!?]$/.test(t) && words > 6)) return { kind: "prose" };   // a sentence: not a title line and not a company
  return { kind: "text" };
}

// ---- 3. the cards of the text
const TRAILING_DOTS = rx("(?:" + ELLIPSIS + "|\\.(?:\\s*\\.)+)[^\\p{L}\\p{N}]*$", "u");
const withoutDots = (s) => s.replace(TRAILING_DOTS, "").replace(STRAY_EDGE, "").trim();
const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
function joinTitle(lines) {
  return stripEdges(lines.map((l) => l.replace(STRAY_EDGE, "").trim()).filter(Boolean).join(" "), { keepDot: false });
}
// a title end with its R number, a bullet and the company on ONE line ("Manager (R-19993) . Dun & Bradstreet"): split only here, where the R number closes the title
const MERGED = rx("^(.*\\(R-?\\d{4,8}\\))\\s+[" + MIDDOT + BULLET + "|]\\s+(.+)$");
const STATE_FIRST = rx("^(?:" + STATE_RE + ")$");
// a logo that repeats the company name after the details: the text of the line is the start of the company (one line, or a company that wrapped over two or three lines and the logo covers more than the first)
function logoOf(t, lead) {
  const n = norm(t);
  if (n.length < 4) return null;
  for (let q = 1; q <= Math.min(3, lead.length); q++) {
    const suf = lead.slice(-q), s = norm(suf.map((x) => x.t).join(""));
    if (s.startsWith(n) && (q === 1 || n.length > norm(suf[0].t).length)) return n;
  }
  return null;
}
// an ID with a hash and a bullet in front of the company ("#26-27638 . US Tech Solutions"): four digits or more, digits and hyphens only; the company is confirmed by the place line that closes the card
const HASH_ID = rx("^#(\\d[\\d-]*\\d)\\s+[" + MIDDOT + BULLET + "|]\\s+(.+)$");
const startsWithState = (t) => {
  const parts = splitParts(t);
  if (!parts.length) return false;
  const first = parts[0].split(/\s+/)[0], rest0 = parts[0].slice(first.length).trim();      // "FL (Remote)": the state, then the work mode in brackets
  return STATE_FIRST.test(first) && (rest0 === "" || /^\((?:remote|hybrid|on-?site)\)$/i.test(rest0)) && parts.slice(1).every(isDetailPart);
};
function cardsOf(lines) {
  const items = [];
  lines.forEach((t, i) => {
    const c = classify(t);
    if (c.kind === "chrome" || c.kind === "noise") return;
    const m = c.kind === "text" && t.match(MERGED);
    if (m && classify(m[2]).kind === "text") { items.push({ t: m[1], i, kind: "text" }, { t: m[2], i, kind: "text", cs: true }); return; }
    const h = c.kind === "text" && t.match(HASH_ID);
    if (h && h[1].replace(/\D/g, "").length >= 4 && classify(h[2]).kind === "text") { items.push({ t: "#" + h[1], i, kind: "text", idTok: h[1] }, { t: h[2], i, kind: "text", cs: true }); return; }
    items.push({ t, i, kind: c.kind, company: c.company });
  });
  // a place that wrapped after its comma: the line "Hollywood," and the state at the start of the next line ("FL (Remote)", "WA", "DC . Remote") are details, not a company or a second card
  for (let i = 0; i < items.length; i++) {
    const it = items[i], prev = items[i - 1], nx = items[i + 1];
    if (it.kind === "text" && !it.cs && CUT_PLACE.test(it.t) && nx && startsWithState(nx.t)) it.kind = "detail";
    if (prev && (prev.kind === "detail" || prev.kind === "companydetail") && /,$/.test(prev.t) && ["text", "detail", "companydetail"].includes(it.kind) && startsWithState(it.t)) it.kind = "detail";
  }
  // a title that ends in a work mode bracket ("Quality System Manager (Onsite)") sits right above its company line: it is the title, not a place (the bracket stays). The POSITION decides, no word list (prompt JC):
  // the text before the bracket is not a place, not a pay line, and the line is one part; the next line is a company-and-detail line, or a company line followed by a detail line, or the text is exactly these two lines
  const WORK_BRACKET = /\((?:remote|hybrid|on-?site)\)\s*$/i;
  for (let i = 0; i + 1 < items.length; i++) {
    const it = items[i], n1 = items[i + 1], n2 = items[i + 2];
    if (it.kind !== "detail" || !WORK_BRACKET.test(it.t)) continue;
    const pre = it.t.replace(WORK_BRACKET, "").trim();
    if (pre === "" || PLACE.some((re, k) => k !== 4 && re.test(it.t)) || isPlace(pre) || STATE_FIRST.test(pre) || isPay(pre) || isPay(it.t) || MODE.test(it.t) || splitParts(it.t).length !== 1) continue;
    if (n1.kind === "companydetail" || (n1.kind === "text" && !n1.cs && ((n2 && (n2.kind === "detail" || n2.kind === "companydetail")) || (!n2 && i === 0 && items.length === 2)))) { it.kind = "text"; it.brk = true; }
  }
  const cards = [];
  let run = [];
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    if (it.kind === "text") { run.push(it); continue; }
    if (it.kind === "prose") { run = []; continue; }
    // a detail line (or a company-and-detail line) closes the run: that run is a card
    const lead = run.slice();
    if (it.kind === "companydetail") lead.push({ t: it.company, i: it.i, company: true, cd: true });
    if (lead.length) cards.push(lead);
    run = [];
    lead.logos = [];
    // the rest of the detail lines of this card open nothing, nor does a logo that repeats the company name
    for (;;) {
      const nx = items[k + 1];
      if (!nx) break;
      if (nx.kind === "detail") { k++; continue; }
      const lg = nx.kind === "text" && !nx.cs && lead.length ? logoOf(nx.t, lead) : null;
      if (lg) { lead.logos.push(lg); k++; continue; }
      break;
    }
  }
  // a crop of just the title and the company (prompt JC): after the chrome and the logo lines are gone exactly two lines are left, both plain text of 2 to 80 characters, neither a sentence. The first is the title and the second the company (the order of Indeed and LinkedIn);
  // when exactly one of them holds a title word and it is the second, they are turned round. When position alone decided (no title word, or a title word in both) the card carries orderAssumed. readCard still refuses a pair that does not read like a title and a company.
  const shortLine = (x) => x.kind === "text" && !x.cs && !x.idTok && x.t.length >= 2 && x.t.length <= 80 && !/[.!?]$/.test(x.t.replace(ABBREV, "$1"));
  if (!cards.length && items.length === 2 && items.every(shortLine)) {
    const [a, b] = items, ta = TITLE_WORDS.test(a.t), tb = TITLE_WORDS.test(b.t);
    const lead = !a.brk && tb && !ta ? [b, a] : [a, b];
    lead.orderAssumed = a.brk ? !(ta && !tb) : ta === tb;
    lead.logos = [];
    cards.push(lead);
    run = [];
  }
  // a card that ends the text with a company line cut off on the screen ("Voice Systems...") has no detail line after it
  if (run.length >= 2 && isCutOff(run[run.length - 1].t)) cards.push(run);
  // three text lines or more left at the end with no detail line after them: a card cut by the bottom edge of the screen (it is counted as seen, never read)
  else if (run.length >= 3) cards.cutRuns = [run];
  cards.cutRuns = cards.cutRuns || [];
  return cards;
}
const LABEL_LOOKALIKE = "easilyapply";
function looksLikeLabel(t) {
  const c = norm(t);
  if (c.length !== LABEL_LOOKALIKE.length || c === LABEL_LOOKALIKE || c[0] !== LABEL_LOOKALIKE[0]) return false;
  let diff = 0;
  for (let i = 0; i < c.length; i++) if (c[i] !== LABEL_LOOKALIKE[i]) diff++;
  return diff <= 4;
}
const RATING = /\s+[1-5]\.\d(?:\s*%)?$/;   // "4.0", "4.0 *" (the star is stripped as a stray symbol), and the star read as a percent sign: "3.4 %" (only in the company first layout, see readCard)
const INITIALS_LINE = /^[^\p{L}\p{N}\s]\s*([A-Z][A-Z0-9&]{1,5})$/u;   // a logo that is the initials of the company, with a symbol in front (": NIS")
const SMALL_WORDS = new Set(["of", "and", "the", "for", "to", "in", "at", "with", "on", "or", "by", "a", "an", "as", "de", "la", "le", "du", "des", "van", "von", "der", "di", "da", "per", "via", "vs"]);
// how many leading lines are certainly title: a line with a bracket not closed takes the next line with it (a comma or a dash at the end does not count: titles such as "Senior Director, Services Consulting, AI" have commas and are not a sign that the company wrapped)
function openLines(L) {
  let depth = 0, f = 0;
  for (let i = 0; i < L.length - 1; i++) {
    const t = L[i].t;
    depth += (t.match(/\(/g) || []).length - (t.match(/\)/g) || []).length;
    if (depth > 0) f = i + 2;
  }
  return Math.min(f, L.length);
}
const R_TOKEN = /^(.*?)\s*\((R-?\d{4,8})\)$/;      // "(R12345)" or "(R-12345)" at the end of a title line, or alone
// a logo read as two capital letters before a capitalised title ("NN AI Transformation ...") goes, unless the two letters are a common title start (AI Engineer, IT Manager, RN Case Manager)
const JUNK_CAPS = /^([A-Z]{2})\s+(?=[A-Z])/;
const TITLE_ACRONYMS = new Set(["AI", "IT", "HR", "VP", "UX", "UI", "QA", "QC", "PM", "IP", "ML", "EV", "BI", "DB", "PR", "IS", "AR", "VR", "GM", "RN", "MD", "PA"]);
const CONTINUES = /(?:[,&\/-]|\s(?:and|of|the|for|in|to|at|with))$/i;
function readCard(lead) {
  const notes = { company: null, title: null, req: null };
  const out = { orderAssumed: false, company: null, title: null, req: null, cut: { company: false, title: false }, titleShortened: false, titleBroken: false, notes };
  const blank = (why) => { notes.company = notes.title = why; return out; };
  // an icon or a logo read as capitals between the lines ("RN") is not a line of the card; only the last line may be a short name such as EY
  let L = lead.filter((x, i) => i === lead.length - 1 || !SHORT_CAPS.test(x.t));
  // a star rating at the end of a line ("Resort 4.0") is not part of the name: it goes, and the line is marked as the end of the company
  L = L.map((x) => { const m = x.t.match(RATING); return m && !TITLE_WORDS.test(x.t) && /\p{L}{3}/u.test(x.t.slice(0, m.index)) ? { ...x, t: x.t.slice(0, m.index).trim(), rated: true, pct: /%$/.test(m[0]), orig: x.t } : x; });
  if (L.length < 2) return blank("only one line above the details, so it is not clear whether it is the title or the company");
  // a line that is almost the badge "Easily apply" ("Easilv annlv": the same length, the same first letter, at most 4 letters different) is a misread button: it is never made a detail (a real line could be taken away) and never glued to a title; the card is refused
  if (L.some((x) => looksLikeLabel(x.t))) return blank("a line like a misread button (Easily apply) is in front of the opening, so it is not clear where the title starts");
  // a number followed by a percent sign ("Fund 3.4 %") is a rating only in the company first layout (the title lines follow it); anywhere else the line stays as it was read
  const r0 = L.findIndex((x) => x.rated);
  if (!(r0 >= 0 && r0 < L.length - 1)) L = L.map((x) => (x.pct ? { ...x, t: x.orig, rated: false } : x));
  let idReq = null;
  // a line above the details that starts with a bracket ("(PCG)", "(SEIS), LLC") is the end of a company name that wrapped over several lines: where that name starts is not clear
  if (/^\(/.test(L[L.length - 1].t) && !/^\(R-?\d{4,8}\)$/.test(L[L.length - 1].t)) return blank("the line above the details starts with a bracket, so it is the end of a company name that wrapped and the company is not clear");
  // where the title ends and the company begins: after a line that ends with dots (the screen cut the title off there); else the last line
  const cutAt = L.findIndex((x, i) => i < L.length - 1 && isCutOff(x.t));
  const csAt = L.findIndex((x) => x.cs), ratedAt = L.findIndex((x) => x.rated);
  let titleLines, companyLines;
  if (csAt > 0) { titleLines = L.slice(0, csAt); companyLines = L.slice(csAt); }      // a merged line was split at its R number: the company starts there
  else if (ratedAt >= 0 && ratedAt < L.length - 1) {
    // company first (Glassdoor): logo text, the company with its rating, then the title lines. The logo lines at the start are told by the company name starting with the same letters
    const B = L.slice(0, ratedAt + 1), n0 = norm(B[0].t);
    let j = ratedAt === 0 ? 0 : -1;
    // the logo is the start of the company name, or a whole word (a middle or last part) of it: "Mirador" before "El Mirador"
    const wholeWord = (logo, rest) => rx("(?:^|\\s)" + logo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:\\s|$)", "i").test(rest);
    for (let q = 1; q <= ratedAt && j < 0; q++) if (n0.length >= 4 && norm(B.slice(q).map((x) => x.t).join(" ")).startsWith(n0)) j = q;
    // only when the logo is the line right above the company line with the rating (a line between them, or a company that wrapped, would make the whole word match unsafe: "Ridge" / "North" / "Ridge Foods 3.1")
    if (j < 0 && ratedAt === 1 && n0.length >= 4 && wholeWord(B[0].t, B[1].t)) j = 1;
    if (j < 0) return blank("the company has a rating after it and the title comes below it, but which lines above the rating are the company is not clear");
    companyLines = B.slice(j); titleLines = L.slice(ratedAt + 1);
    // a stray stub in front of the company name, only in this layout: one lower case letter ("a KPMG"), or two or three letters that are a part of the name that follows ("TM LTM Limited")
    const first = companyLines[0], stripped = first.t.replace(/^[^\p{L}\p{N}]+/u, ""), sm = stripped.match(/^(\p{L}{1,3})\s+(?=\p{Lu})(.+)$/u);
    if (sm && ((sm[1].length === 1 && /\p{Ll}/u.test(sm[1])) || (sm[1].length >= 2 && norm(sm[2]).includes(norm(sm[1]))))) companyLines = [{ ...first, t: sm[2] }, ...companyLines.slice(1)];
    // a number like 2.0 inside a name ("Platform Version 2.0") is not a rating: the lines below must read like a title
    if (!TITLE_WORDS.test(titleLines.map((x) => x.t).join(" "))) return blank("a number like 4.0 ends a line and more text follows, but the text below does not read like a title, so the line may not be a company with a rating");
  } else if (cutAt >= 0) { titleLines = L.slice(0, cutAt + 1); companyLines = L.slice(cutAt + 1); }
  else {
    companyLines = L.slice(-1); titleLines = L.slice(0, -1);
    // the company on the SAME line as the end of the title, no separator: split only when the logo line at the top of the card is exactly the last word or words of that line and what is left reads like a title
    const lastL = L[L.length - 1], logoTop = L[0].t;
    if (L.length >= 2 && !lastL.cd && logoTop.length >= 3 && !TITLE_WORDS.test(logoTop) && lastL.t.endsWith(" " + logoTop)) {
      const prefix = lastL.t.slice(0, lastL.t.length - logoTop.length).trim();
      if (prefix !== "" && TITLE_WORDS.test(prefix)) { companyLines = [{ ...lastL, t: logoTop }]; titleLines = [...L.slice(1, -1), { ...lastL, t: prefix }]; }
    }
    // a company that wrapped over lines is told by the logo text below the details: the logo covers the start of the name over those lines
    let k = 1;
    for (const lg of lead.logos || []) {
      for (let q = 1; q <= Math.min(3, L.length - 1) && k === 1; q++) {
        const suf = L.slice(-q);
        if (norm(suf.map((x) => x.t).join("")).startsWith(lg) && (q === 1 || lg.length > norm(suf[0].t).length)) k = q;
      }
    }
    if (k > 1) { companyLines = L.slice(-k); titleLines = L.slice(0, -k); }
    // a title that is still open (a bracket not closed, a dash or comma at the end) over lines, then more than one line above a company-and-place line, and no logo to tell: which lines are the company is not clear
    else if (L[L.length - 1].cd && openLines(L) > 0 && L.length - openLines(L) >= 2) return blank("the title carries on over several lines and the company may too, so which lines are the company is not clear");
  }
  // an ID with a hash that was split from the company line leaves the title; the dash that led into it goes too; the ID is offered in the req box
  const ix = titleLines.findIndex((x) => x.idTok);
  if (ix >= 0) {
    idReq = titleLines[ix].idTok;
    titleLines = titleLines.filter((_, k) => k !== ix);
    if (ix > 0) titleLines[ix - 1] = { ...titleLines[ix - 1], t: titleLines[ix - 1].t.replace(/\s*-\s*$/, "") };
    if (!titleLines.length) return blank("an ID was found where the title should be, so the title is not clear");
  }
  // an icon read as a capital letter O at the end of a title line ("Solution Owner O") is not part of the title
  titleLines = titleLines.map((x) => ({ ...x, t: x.t.replace(/(?<=\p{Ll})\s+O$/u, "") }));
  // a logo or a status icon read as a short lower case word before a capitalised title ("viene Head of AI") goes
  titleLines = titleLines.map((x, i) => (i === 0 ? { ...x, t: x.t.replace(/^[a-z]{2,5}\s+(?=[A-Z])/, "").replace(JUNK_CAPS, (m, w) => (TITLE_ACRONYMS.has(w) ? m : "")) } : x));
  // a logo that holds the company name is read as lines at the start that repeat the company: they go
  const cn = norm(companyLines.map((x) => x.t).join(" "));
  while (titleLines.length > 1 && cn !== "" && norm(titleLines[0].t) !== "" && cn.includes(norm(titleLines[0].t))) titleLines = titleLines.slice(1);
  if (companyLines.length > LIMITS.companyLines) return blank("a company over more than " + LIMITS.companyLines + " lines is not clear");
  if (titleLines.length > LIMITS.titleLines) return blank("a title of more than " + LIMITS.titleLines + " lines is not clear");
  if (titleLines.length + companyLines.length > LIMITS.cardLines + (companyLines.length - 1)) return blank("more than " + LIMITS.cardLines + " lines above the details, so the title and company are not clear");
  const companyText = companyLines.map((x) => x.t.replace(STRAY_EDGE, "").trim()).join(" ");
  // a logo that is the INITIALS of the company, with a symbol in front (": NIS" above "Nationwide IT Services") is dropped; capitals with a symbol that do not match the company are not glued to the title: the card is refused
  const il = titleLines.length > 1 ? titleLines[titleLines.length - 1].t.match(INITIALS_LINE) : null;
  if (il) {
    const words = companyText.split(/\s+/).filter((w) => /^\p{L}/u.test(w));
    const ini = words.map((w) => w[0].toUpperCase()).join(""), ini2 = words.filter((w) => !SMALL_WORDS.has(w.toLowerCase())).map((w) => w[0].toUpperCase()).join("");
    if (il[1] === ini || il[1] === ini2) titleLines = titleLines.slice(0, -1);
    else return blank("a line of capital letters with a symbol in front sits above the company; it may be a logo but it does not match the company, so the title and company are not clear");
  }
  if (/^#/.test(companyText)) return blank("the company line starts with a number sign, so it may be an ID and not a company");
  if (/^[a-z]+(?:\s|$)/.test(companyText)) return blank("the line above the details starts with a lower case word, so it continues the line above it and is not a company");
  if (/[-,]$/.test(companyText) || TITLE_WORDS.test(companyText) || companyText.length > 60) return blank("the line above the details reads like part of a title, so the company is not clear");
  const lastTitle = titleLines[titleLines.length - 1].t.replace(STRAY_EDGE, "").trim();
  if (CONTINUES.test(lastTitle) && !isCutOff(lastTitle)) return blank("the line above the company ends with a comma, a dash or an ampersand, so the company line may be part of the title");
  // an unlabelled requisition number written as (R12345) at the end of a title line is taken out of the title and offered for checking
  let reqToken = idReq;
  const titleParts = [];
  for (const x of titleLines) {
    const m = x.t.replace(STRAY_EDGE, "").trim().match(R_TOKEN);
    if (m) { if (reqToken === null) reqToken = m[2]; else if (reqToken !== m[2]) reqToken = false; if (m[1] !== "") titleParts.push({ ...x, t: m[1] }); }
    else titleParts.push(x);
  }
  if (reqToken) { out.req = reqToken; notes.req = "Found in the title, not labelled. Check it."; }
  const titleCut = isCutOff(titleLines[titleLines.length - 1].t), companyCut = isCutOff(companyLines[companyLines.length - 1].t);
  let titleText = joinTitle(titleParts.map((x) => x.t));
  if (titleCut) titleText = withoutDots(titleText);
  const fitted = titleText ? fitTitle(titleText) : { title: null, shortened: false };
  let title = fitted.title;
  // a word the app broke in the middle ("Implementatio" then "n Specialist"): which letters are missing cannot be proven, so the title is left for the person to type
  // the second shape that can be proven without a word list: a title that ends with dots (the screen cut it) and holds a capitalised word, a space and a lower case piece that is neither a small word nor a title word ("Implement ation Spe...")
  const toks = titleText.split(/\s+/);
  const brokenInLine = titleCut && toks.some((tok, i) => i > 0 && /^\p{Ll}{2,8}$/u.test(tok) && /^\p{Lu}\p{Ll}+$/u.test(toks[i - 1]) && !SMALL_WORDS.has(tok) && !TITLE_WORDS.test(tok));
  const brokenWord = titleLines.some((x, i) => i > 0 && /^[a-z]\s/.test(x.t.replace(STRAY_EDGE, "").trim())) || brokenInLine;
  // titleBroken: the title is empty BECAUSE of a broken word (a title that was not there anyway is not this case)
  if (brokenWord) { out.titleBroken = title !== null; title = null; }
  // a title cut at 80 characters by the extension's own rule ends at a word: a dash or comma left at the end goes
  if (title && titleText.length > title.length) title = title.replace(/[\s,&\/-]+$/, "");
  const company = cleanCompany(companyCut ? withoutDots(companyText) : companyText);
  // the engine reads the capitals AI as Al: a standalone Al in a title is corrected
  let aiFixed = false;
  if (title && /\bAl\b/.test(title)) { title = title.replace(/\bAl\b/g, "AI"); aiFixed = true; }
  // a slash read as a bracket ("Outcome [ Product") is put back; a lone bracket is never a title word
  let slashFixed = false;
  if (title && /\s[\[\]]\s/.test(title)) { title = title.replace(/\s[\[\]]\s/g, " / "); slashFixed = true; }
  if (company && title && lead.orderAssumed) out.orderAssumed = true;      // the order of a two line crop was decided by position alone (output only)
  if (company) { out.company = company; out.cut.company = companyCut; notes.company = "line " + (companyLines[0].i + 1) + (companyLines.length > 1 ? " to " + (companyLines[companyLines.length - 1].i + 1) + " joined" : "") + ": the company, right above the place, pay or badges" + (companyCut ? ". It ends with dots, so it looks cut off." : ""); }
  if (brokenWord) notes.title = "a word in the title looks broken in the middle, so the title was not taken: type it";
  if (title) {
    out.title = title; out.cut.title = titleCut;
    out.titleShortened = fitted.shortened && !titleCut;      // a title that ended in dots is cut.title, never both
    notes.title = "line" + (titleLines.length > 1 ? "s " + (titleLines[0].i + 1) + " to " + (titleLines[titleLines.length - 1].i + 1) + " joined" : " " + (titleLines[0].i + 1)) + ": above the company" + (titleCut ? ". It ends with dots, so it looks cut off." : "") + (aiFixed ? " The letters AI were read as Al and corrected." : "") + (slashFixed ? " A slash was read as a bracket and corrected." : "");
  }
  return out;
}

// ---- 4. the whole text
const SOCIAL = /^(?:\d+\s?[smhdwy]|\d+\s?(?:likes?|comments?|reactions?|reposts?)|like|comment|repost|send|follow|connect)$/i;
const POSTER_ROLE = /^(?:(?:senior |technical |lead |sr\.? )?recruiter|talent (?:acquisition|partner|sourcer).*|hiring manager|hr (?:manager|business partner|generalist)|human resources.*|sourcer|founder|co-?founder|ceo|owner|staffing.*)$/i;
export function readText(text) {
  const { lines, truncated } = toLines(text);
  const result = { orderAssumed: false, company: null, title: null, kio: null, kioStored: null, req: null, reqUnlabelled: false, cut: { company: false, title: false }, titleShortened: false, titleBroken: false, notes: { company: null, title: null, kio: null, req: null }, cards: [], seen: { cards: 0, truncated } };
  if (!lines.length) return result;
  const plain = { lines: lines.map((t) => ({ text: t })) };
  const found = findAllValues(plain);     // the extension's own rules: labels, "<title> at <company>", the KIO ID and the req number anywhere
  // a company or a title is never taken from a SENTENCE ("We are hiring a Senior Analyst at Contoso."): the rules for them see only the lines that are not sentences (the KIO ID and the req number may sit anywhere, so they use the whole text)
  const short = findAllValues({ lines: lines.filter((t) => classify(t).kind !== "prose").map((t) => ({ text: t })) });
  found.company = short.company; found.title = short.title; found.titleCutOff = short.titleCutOff;
  found.rules = { ...found.rules, company: short.rules.company, title: short.rules.title };
  // "<title> at <company>" is trusted only when it is the headline of an opening: in a social post it is the poster's own line ("Recruiter at Northwind Talent"), and a poster's role is never the opening
  const social = lines.some((t) => SOCIAL.test(t)), posterRole = found.title && POSTER_ROLE.test(found.title);
  if (found.rules.company === "headline-at" && (social || posterRole)) {
    found.company = found.title = null; found.rules.company = found.rules.title = null;
    result.notes.company = result.notes.title = social ? "this looks like a social post: a line like 'Recruiter at Company' is the poster, not the opening, so it was not taken" : "that line is the poster's own role, not the opening, so it was not taken";
  }
  // the KIO ID (an old format code is not used here: the search takes it through its own box)
  if (found.postid) {
    const k = readKio(found.postid);
    if (k.kind === "kio") { result.kio = k.display; result.kioStored = k.stored; result.notes.kio = "found in the text (" + found.rules.postid + "), its check character fits"; }
    else result.notes.kio = "an old format code was found; it is left for the person to type";
  } else if (found.ambiguous.includes("postid")) result.notes.kio = "two different IDs were found, so none was taken";
  else if (found.unreadable && found.unreadable.includes("postid")) result.notes.kio = "a KIO ID was there but its check character does not fit, so it was not taken";
  if (found.req) { result.req = found.req; result.notes.req = "found by its label (" + found.rules.req + ")"; }
  else if (found.ambiguous.includes("req")) result.notes.req = "two different req numbers were found, so none was taken";
  // company and title: labels or the "<title> at <company>" headline first; else the card reading
  if (found.company && found.rules.company) { result.company = found.company; result.notes.company = "found by its label or headline (" + found.rules.company + ")"; }
  if (found.title && found.rules.title && !found.titleCutOff) { result.title = found.title; result.titleShortened = found.titleShortened; result.notes.title = "found by its label or headline (" + found.rules.title + ")"; }
  if (found.titleCutOff) result.notes.title = "the title looks cut off on the screen, so it was not taken";
  if (!result.company && !result.title && !found.titleCutOff) {
    const raw = cardsOf(lines), cards = raw.map(readCard), cutRuns = raw.cutRuns || [];
    result.cards = cards.filter((c) => c.company && c.title).map((c) => ({ company: c.company, title: c.title, req: c.req, cut: c.cut, orderAssumed: c.orderAssumed, titleShortened: c.titleShortened, titleBroken: c.titleBroken, notes: c.notes }));
    result.seen.cards = cards.length;      // the cards that were read or refused; the page offers the list when this is more than one
    if (cutRuns.length) result.seen.cut = cutRuns.length;      // a card cut by the bottom edge of the screen is counted here, never read
    if (!cards.length && cutRuns.length) result.notes.company = result.notes.title = "the card may be cut by the edge of the screen, so no company or title was taken";
    if (cards.length === 1) {
      result.company = cards[0].company; result.title = cards[0].title; result.cut = cards[0].cut; result.titleShortened = cards[0].titleShortened; result.titleBroken = cards[0].titleBroken; result.orderAssumed = cards[0].orderAssumed;
      result.notes.company = cards[0].notes.company; result.notes.title = cards[0].notes.title;
      // an unlabelled requisition number from the title: only when no labelled one was found
      if (cards[0].req && !result.req) { result.req = cards[0].req; result.reqUnlabelled = true; result.notes.req = cards[0].notes.req; }
    } else if (cards.length > 1) {
      result.notes.company = result.notes.title = "more than one opening is in the text (" + cards.length + "), so it is not clear which one you mean: tap the one you want, or crop the screenshot to one";
    }
  }
  if (result.company && result.title && result.company.toLowerCase() === result.title.toLowerCase()) { result.title = null; result.cut.title = false; result.titleShortened = false; result.notes.title = "the same words as the company, so the title was not taken"; }
  return result;
}
