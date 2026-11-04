// extractor.js - finds the search values in the text a page screenshot was read into (OCR). Pure functions, no browser API: unit tested with synthetic page layouts.
//
// WHAT COMES OUT: the company (always) and exactly ONE second value, the FIRST of these that is found cleanly: (a) the FightGhostJobs postID, (b) the req number, (c) the job title.
// The search page takes the req number box or the postID/title box, never both, so only one is ever returned. NOTHING IS GUESSED: a value is only taken from a label it sits next to, or from a
// pattern that can only mean that value; when two different values are found for the same thing the answer is "not found" for that thing, never a pick. Company and title are never taken from
// the same words, and a company that cannot be told apart reliably from the title is returned as not found.
//
// INPUT: { width, height, lines: [{ text, x0, y0, x1, y1 }] }  (lines in reading order; the boxes are optional: without them only the text rules apply)
// OUTPUT: { ok: true, company, kind: "postid" | "req" | "title", value, rules: { company, second } }
//      or { ok: false, missing: { company: boolean, second: boolean }, ambiguous: ["company" | "postid" | "req" | "title", ...] }
// The rules are named so a test can say which one fired; no OCR text is ever put in the output except the values themselves.
// findAllValues(ocr) is the same reading but returns EVERY value found, each one or null ({ company, postid, req, title, ambiguous, rules }): the popup shows them all in editable boxes. findSearchValues is built on it.
//
// RULES (in order of trust; the lowest tier that has a candidate decides, and two different candidates in that tier mean "not found"):
//   COMPANY  tier 1: a label line "Company:", "Employer:", "Hiring company:", "Organization:" with the name after the colon, or the label alone and the name to its right on the same row or on the line right below
//            tier 2: a headline "<title> at <company>" (or "@"), or "Careers at / Jobs at / Work at <company>"
//            (no tier 3: a company is NEVER taken from "About <company>", "About us" or any About text, nor from a "Title - Company" dash headline)
//   KIO ID   (BO, October 11, 2026) KIO plus 12 characters in any grouping (KIO-XXXX-XXXX-XXXX): found by its prefix, and only taken when its check character fits (kio.js). A 12 character code that passes the check is a KIO ID too
//            (about 1 old code in 32 does by chance). A prefix whose check fails is never taken and is reported as unreadable (findAllValues: unreadable). Labels: KIO ID, Opening ID, Post ID, FightGhostJobs ID, FGJ ID.
//   POSTID   the pattern XXXX-XXXX-XXXX (three groups of four letters or digits). With the word postID (or "FightGhostJobs ID") on the same line or the line before it is taken as is; without a label it is
//            taken only when every character is in the postID alphabet (0-9 and A-Z without I, L, O, U), capital letters, and it has at least one letter and one digit
//   REQ      a label of the Req and Requisition families only: "Req", "Req #", "Req ID", "Requisition", "Requisition #", "Requisition ID", "Requisition number" followed by a value (same line, to the right, or the line below) that has
//            at least one digit. "Job ID", "Job number", "Job #" and "Job code" are NOT req labels: such a line (and its value) is ignored entirely, it is neither a req number nor a title
//   TITLE    tier 1: a label "Job title:", "Position:", "Role:", "Title:" (inline or alone with the value to the right or below)
//            tier 2: the "<title>" part of the headline "<title> at <company>"
//            tier 3: the one headline: the single line with the largest letters in the top of the page, if every other line is at least 40 percent smaller in letter height, and it does not read like a
//                    button, a menu or a banner (Apply, Share, Sign in, cookies, ...)
// LIMITS: see the report; in short, no logo-only company names, no company that is only in a header image, titles that wrap over two lines, and pages that are not English.

import { readKio } from "./kio.js?v=5b8d8489";   // BO: the KIO ID and its check character

const ALNUM = /[\p{L}\p{N}]/gu;
const alnum = (s) => (String(s).match(ALNUM) || []).length;
const HY = "[-\\u2010\\u2011\\u2012\\u2013\\u2014\\u2212]";
const key = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();

export const LIMITS = { company: 200, postid: 14, req: 100, title: 80 };

// ---- input
function prepare(ocr) {
  const raw = ocr && Array.isArray(ocr.lines) ? ocr.lines : [];
  const lines = [];
  for (const l of raw) {
    const text = String(l && l.text != null ? l.text : "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
    if (text === "" || text.length > 400) continue;
    const ok = l && [l.x0, l.y0, l.x1, l.y1].every((n) => typeof n === "number" && Number.isFinite(n)) && l.y1 > l.y0;
    lines.push({ text, box: ok ? { x0: l.x0, y0: l.y0, x1: l.x1, y1: l.y1 } : null, h: ok ? l.y1 - l.y0 : null });
  }
  return { lines, width: Number(ocr && ocr.width) || 0, height: Number(ocr && ocr.height) || 0 };
}

// the text that sits after a label that stands alone on its line: to its right on the same row, else right below it; without boxes, the next line
function valueLine(lines, idx) {
  const L = lines[idx];
  if (L.box) {
    const cy = (L.box.y0 + L.box.y1) / 2;
    const right = lines.filter((m) => m !== L && m.box && m.box.x0 >= L.box.x1 - 2 && cy >= m.box.y0 && cy <= m.box.y1).sort((a, b) => a.box.x0 - b.box.x0)[0];
    if (right) return right;
    const below = lines.filter((m) => m !== L && m.box && m.box.y0 >= L.box.y1 - 2 && m.box.y0 - L.box.y1 <= 1.6 * L.h && Math.abs(m.box.x0 - L.box.x0) <= Math.max(40, L.h * 2)).sort((a, b) => a.box.y0 - b.box.y0)[0];
    return below || null;
  }
  return lines[idx + 1] || null;
}
const valueNear = (lines, idx) => { const m = valueLine(lines, idx); return m ? m.text : null; };

// the lowest tier with a candidate decides; two different candidates in it mean "not found" (ambiguous)
function pick(cands) {
  if (cands.length === 0) return { value: null, why: "none" };
  const best = Math.min(...cands.map((c) => c.tier));
  const same = new Map();
  for (const c of cands) if (c.tier === best) same.set(key(c.value), c);
  if (same.size > 1) return { value: null, why: "ambiguous" };
  const c = [...same.values()][0];
  return { value: c.value, why: "ok", rule: c.rule, cut: !!c.cut, short: !!c.short };
}

// ---- cleaning
// EDGE CLEANING of every extracted company, title, req number and postID: whitespace and any run of these characters is removed from BOTH ends: + - | / \ < > ~ = * _ ^ ` : ; , quotes, and the arrow, chevron, triangle and bullet glyphs
// (the angle quotes, single arrows, filled triangles, down and up chevrons, bullet and middle dot, all written as \u escapes in EDGE_CHARS below). OCR reads a dropdown arrow as "+" or a glyph, which gave "UIC + +". NOT removed: a trailing ")" (so "Acme (US)" stays), and a trailing "." only after a company suffix (see cleanCompany),
// "&" (AT&T), and anything in the middle of a value. OCR invents a full stop after a name at small text sizes, so a trailing "." is removed from a title, a req number and a postID always (keepDot false), and from a company unless the word before it is a company suffix. Not fixable here: OCR sometimes reads a down-triangle as the LETTER v, which is a letter, not an edge character.
const EDGE_CHARS = "\\s+\\-|/\\\\<>~=*_^`:;,\"'\\u2018\\u2019\\u201c\\u201d\\u00bb\\u00ab\\u203a\\u2039\\u2192\\u2190\\u2191\\u2193\\u25be\\u25b4\\u25b8\\u25bc\\u25b2\\u25ba\\u25c4\\u25b6\\u25c0\\u2304\\u02c5\\u02c4\\u2022\\u00b7\\u276e\\u276f";
const EDGE_START = new RegExp("^[" + EDGE_CHARS + "]+"), EDGE_END = new RegExp("[" + EDGE_CHARS + "]+$"), EDGE_END_NO_DOT = new RegExp("[" + EDGE_CHARS + ".]+$");
export const stripEdges = (s, { keepDot = true } = {}) => String(s).replace(EDGE_START, "").replace(keepDot ? EDGE_END : EDGE_END_NO_DOT, "").replace(/\s+/g, " ").trim();
const looksLikeAddress = (s) => /https?:|www\.|@|\.[a-z]{2,}\//i.test(s);
// a company keeps its trailing "." only after one of these suffixes ("Acme, Inc.", "Acme Ltd."), compared without case; anywhere else the engine has invented it ("Bluebird Logistics.")
const COMPANY_SUFFIX_DOT = /(?:^|[^\p{L}\p{N}])(?:inc|ltd|co|corp|llc|llp|lp|plc|bros)\.$/iu;
export function cleanCompany(s) {
  let t = stripEdges(s);
  if (t.endsWith(".") && !COMPANY_SUFFIX_DOT.test(t)) t = stripEdges(t, { keepDot: false });
  if (alnum(t) < 2 || t.length > LIMITS.company || looksLikeAddress(t)) return null;
  return t;
}
// A title that ends in an ellipsis is CUT OFF on screen: the single ellipsis character, a run of two or more dots, or spaced dots (". . ."). One trailing full stop ("Sr.") is not one, and the same marks in the middle of a title do not count.
// It must be asked of the text BEFORE cleaning: cleanTitle takes trailing dots off (and the single ellipsis character is kept), so after cleaning a cut-off title looks whole.
// at most two stray symbols may follow the dots (an icon or a bullet the engine read as a symbol): "Integration... " + a copyright sign is still cut off; a letter or a digit after the dots is not a stray symbol
const CUT_OFF_END = new RegExp("(?:" + String.fromCharCode(0x2026) + "|\\.(?:\\s*\\.)+)(?:\\s*[^\\p{L}\\p{N}\\s." + String.fromCharCode(0x2026) + "]){0,2}\\s*$", "u");   // the ellipsis character, or two or more dots (spaces between allowed), at the very end
export const isCutOff = (s) => CUT_OFF_END.test(String(s == null ? "" : s));
// fitTitle is cleanTitle with one more answer: shortened is true when the title is shorter than the cleaned text because the title limit cut it (HY: the mobile reader tells the person)
export function fitTitle(s) {
  let t = stripEdges(s, { keepDot: false });
  if (alnum(t) < 3 || looksLikeAddress(t)) return { title: null, shortened: false };
  let shortened = false;
  if (t.length > LIMITS.title) {                       // the title search is a PART of the title, so a title cut at a word is still a true part of it
    const cut = t.slice(0, LIMITS.title + 1).replace(/\s+\S*$/, "");
    if (alnum(cut) < 3) return { title: null, shortened: false };
    shortened = cut.length < t.length;
    t = cut;
  }
  return { title: t, shortened };
}
export const cleanTitle = (s) => fitTitle(s).title;

// ---- company and title
const CO = "(?:hiring\\s+)?(?:company|employer|organi[sz]ation)(?:\\s+name)?";
const TI = "(?:job\\s+title|position(?:\\s+title)?|role|title)";
const CO_INLINE = new RegExp("^" + CO + "\\s*[:;]\\s*(.+)$", "i"), CO_ALONE = new RegExp("^" + CO + "\\s*[:;]?$", "i");
const TI_INLINE = new RegExp("^" + TI + "\\s*[:;]\\s*(.+)$", "i"), TI_ALONE = new RegExp("^" + TI + "\\s*[:;]?$", "i");
const NOT_FIRST = /^(?:apply|learn|click|sign|join|search|careers?|jobs?|work|working|life|posted|sent|view|see|share|save|read|get|log|login|register|now|meet|come|visit)\b/i;
const AT_LINE = /^(.{3,80}?)\s+(?:at|@)\s+(.{2,100})$/i;
const CAREERS_AT = /^(?:careers|jobs|work|working|life|join\s+us|join)\s+(?:at|@|with)\s+(.{2,100})$/i;
const NOT_NAME = /^(?:the|our|a|an|this|these|any|your|us|home|work|all|every|you|me|them|it|team|company|job|role|position|benefits|salary|working|how|what|why|who)\b/i;
// the label of an identifier that is NOT a req number: "Job ID", "Job number", "Job #", "Job code" ("1D" and "lD" are how OCR reads the letters ID)
const JOBID_LABEL = /^job\s*(?:id|1d|ld|number|no|num|#|code)(?![A-Za-z])/i, JOBID_ALONE = /^job\s*(?:id|1d|ld|number|no|num|#|code)\s*[.:#]*$/i;
// a "Label: value" row or a label alone ("Location:", "Posted: 3 days ago") is a detail of the posting, never its headline
const LABELISH = /^[^:]{1,30}:(?:\s|$)/;
// words that start a button, a menu or a banner: the biggest line of a page can be one of these, and it is never a job title
const PAGE_CONTROL = /^(?:apply|share|save|sign\s*in|sign\s*up|log\s*in|login|register|home|menu|search|jobs?|careers?|about|contact|back|next|submit|accept|cookies?|we\s+use|welcome|subscribe|follow|report|print|email|copy|close|skip)\b/i;

function labelValue(lines, i, inline, alone) {
  const t = lines[i].text;
  const m = t.match(inline);
  if (m) return m[1];
  if (alone.test(t)) { const v = valueNear(lines, i); return v === null || inline.test(v) || alone.test(v) ? null : v; }
  return null;
}

function headlineSet(lines, height) {
  const boxed = lines.filter((l) => l.box && (height === 0 || l.box.y0 < height * 0.7));
  if (boxed.length === 0) return new Set(lines.slice(0, 3));
  const maxH = Math.max(...boxed.map((l) => l.h));
  return new Set(boxed.filter((l) => l.h >= maxH * 0.8));
}

function findCompanyAndTitle(lines, height) {
  const co = [], ti = [], head = headlineSet(lines, height);
  lines.forEach((L, i) => {
    let v = labelValue(lines, i, CO_INLINE, CO_ALONE);
    if (v !== null) { const c = cleanCompany(v); if (c) co.push({ value: c, tier: 1, rule: "company-label" }); }
    v = labelValue(lines, i, TI_INLINE, TI_ALONE);
    if (v !== null) { const ft = fitTitle(v), t = ft.title; if (t) ti.push({ value: t, tier: 1, rule: "title-label", cut: isCutOff(v), short: ft.shortened }); }
    if (head.has(L)) {
      const m = L.text.match(AT_LINE);
      // a headline that wraps onto a second line of the same big letters is cut in the middle: the company would be only its first words, so nothing is taken from it
      const wrapped = !!L.box && lines.some((n) => n !== L && n.box && n.box.y0 >= L.box.y1 - 2 && n.box.y0 - L.box.y1 <= 0.9 * L.h && Math.abs(n.box.x0 - L.box.x0) <= L.h && n.h >= 0.75 * L.h);
      if (m && !wrapped && !NOT_FIRST.test(m[1]) && !/\s(?:at|@)\s/i.test(m[2]) && !NOT_NAME.test(m[2])) {
        const c = cleanCompany(m[2]), ft = fitTitle(m[1]), t = ft.title;
        if (c && t) { co.push({ value: c, tier: 2, rule: "headline-at" }); ti.push({ value: t, tier: 2, rule: "headline-at", cut: isCutOff(m[1]), short: ft.shortened }); }
      }
    }
    const ca = L.text.match(CAREERS_AT);
    if (ca && !NOT_NAME.test(ca[1])) { const c = cleanCompany(ca[1]); if (c) co.push({ value: c, tier: 2, rule: "careers-at" }); }
  });
  // tier 3 title: the one headline, clearly larger than every other line; never a label line or a company line
  const taken = new Set(co.map((c) => key(c.value)));
  // a headline stands alone on its row: a line with another line to its left on the same row is the value cell of a table row (its label is the line on its left)
  const hasLeftNeighbor = (l) => lines.some((m) => m !== l && m.box && l.box && m.box.x1 <= l.box.x0 + 2 && (l.box.y0 + l.box.y1) / 2 >= m.box.y0 && (l.box.y0 + l.box.y1) / 2 <= m.box.y1);
  // a "Job ID" / "Job number" / "Job #" / "Job code" line, and the value that goes with it, is ignored entirely: it is not a req number and it is never taken as a title
  const ignored = new Set();
  lines.forEach((l, i) => { if (JOBID_LABEL.test(l.text)) { ignored.add(l); if (JOBID_ALONE.test(l.text)) { const v = valueLine(lines, i); if (v) ignored.add(v); } } });
  const boxed = lines.filter((l) => l.box && (height === 0 || l.box.y0 < height * 0.7) && alnum(l.text) >= 3 && l.text.length <= 100 && !CO_INLINE.test(l.text) && !TI_INLINE.test(l.text) && !CO_ALONE.test(l.text) && !TI_ALONE.test(l.text) && !LABELISH.test(l.text) && !hasLeftNeighbor(l) && !ignored.has(l));
  if (boxed.length >= 2) {
    const sorted = boxed.slice().sort((a, b) => b.h - a.h);
    if (sorted[0].h >= sorted[1].h * 1.4 && !taken.has(key(sorted[0].text)) && !PAGE_CONTROL.test(sorted[0].text)) { const ft = fitTitle(sorted[0].text), t = ft.title; if (t) ti.push({ value: t, tier: 3, rule: "headline-size", cut: isCutOff(sorted[0].text), short: ft.shortened }); }
  }
  return { co, ti };
}

// ---- postID
const POSTID_RE = new RegExp("(?<![A-Za-z0-9])([A-Za-z0-9]{4})" + HY + "([A-Za-z0-9]{4})" + HY + "([A-Za-z0-9]{4})(?![A-Za-z0-9])", "g");
// BO (October 11, 2026): the KIO ID. The value of the "postID" slot is either a KIO ID in its displayed form (KIO-XXXX-XXXX-XXXX, the check character passed) or an old code (XXXX-XXXX-XXXX). kio.js decides which; nothing that does not pass is ever a KIO ID.
const POSTID_LABEL = /post\s*-?\s*id|opening\s*-?\s*id|kio\s*-?\s*id|fightghostjobs\s+id|fgj\s+id/i;
const STRICT = /^[0-9A-HJKMNP-TV-Z]{12}$/;
// a KIO ID WITH its prefix as a page or a picture may show it: the prefix (K, I or 1 or l, O or 0), then 12 characters with spaces or hyphens anywhere between them. Found by the prefix alone (no label is needed: the prefix and the check character are the proof).
const KIO_SEP = "[\\s\\u00a0\\-\\u2010-\\u2015\\u2212]*";
const KIO_RE = new RegExp("(?<![A-Za-z0-9])K[Il1|L][O0]" + KIO_SEP + "((?:[A-Za-z0-9]" + KIO_SEP + "){11}[A-Za-z0-9])(?![A-Za-z0-9])", "gi");
function postIdCandidates(lines) {
  const out = new Map();
  let kioFailed = false;
  const put = (value, tier, rule) => { const have = out.get(value); if (!have || tier < have.tier) out.set(value, { value, tier, rule }); };
  lines.forEach((L, i) => {
    const labelled = POSTID_LABEL.test(L.text) || (i > 0 && POSTID_LABEL.test(lines[i - 1].text) && lines[i - 1].text.length <= 40);
    const spans = [];   // where a KIO prefix was seen: the 12 characters after it are never read again as an old code (a failed KIO ID must not become a different, old looking code)
    for (const m of L.text.matchAll(KIO_RE)) {
      spans.push([m.index, m.index + m[0].length]);
      const r = readKio("KIO" + m[1]);
      if (r.kind === "kio") put(r.display, 1, "kio-check"); else kioFailed = true;   // a KIO prefix whose check character does not fit: never searched, the person is asked to type it
    }
    for (const m of L.text.matchAll(POSTID_RE)) {
      if (spans.some(([a, b]) => m.index >= a && m.index + m[0].length <= b)) continue;
      const raw = m[1] + m[2] + m[3], value = stripEdges((m[1] + "-" + m[2] + "-" + m[3]).toUpperCase(), { keepDot: false });
      const strict = STRICT.test(raw) && /[0-9]/.test(raw) && /[A-Z]/.test(raw);
      if (!(labelled || strict)) continue;
      const r = readKio(raw);
      if (r.kind === "kio") put(r.display, labelled ? 1 : 2, "kio-check");   // 12 characters that pass the check: a KIO ID without its prefix
      else put(value, labelled ? 1 : 2, labelled ? "postid-label" : "postid-shape");   // an old code, exactly as before
    }
  });
  return { found: [...out.values()], kioFailed };
}
const findPostIds = (lines) => postIdCandidates(lines).found;

// ---- req number
// "1D" and "lD" are how OCR often reads the letters ID in a label; a value is never followed by a colon (then it is itself a label)
const REQ_LABEL = "(?:req(?:uisition)?(?![A-Za-z])\\s*(?:id|1d|ld|number|no|num|#)?(?![A-Za-z]))";
const REQ_VALUE = "[A-Za-z0-9][A-Za-z0-9._\\/-]{1,39}";
const REQ_INLINE = new RegExp("(?<![A-Za-z0-9])" + REQ_LABEL + "\\s*[.:#]*\\s*(" + REQ_VALUE + ")(?![A-Za-z0-9._/-])(?!\\s*:)", "gi");
const REQ_ALONE = new RegExp("(?<![A-Za-z0-9])" + REQ_LABEL + "\\s*[.:#]*$", "i");
const REQ_BARE = new RegExp("^" + REQ_VALUE + "$");
const looksLikeDate = (s) => /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(s);
export function reqOk(v) { const t = stripEdges(v, { keepDot: false }); return alnum(t) >= 2 && t.length <= LIMITS.req && /\d/.test(t) && !looksLikeDate(t) ? t : null; }
function findReqs(lines) {
  const out = new Map();
  lines.forEach((L, i) => {
    for (const m of L.text.matchAll(REQ_INLINE)) { const v = reqOk(m[1]); if (v) out.set(v.toUpperCase(), { value: v, tier: 1, rule: "req-label" }); }
    if (REQ_ALONE.test(L.text) && !/\d/.test(L.text.replace(/^.*?req/i, ""))) {
      const near = valueNear(lines, i);
      if (near !== null && REQ_BARE.test(near.trim())) { const v = reqOk(near.trim()); if (v) out.set(v.toUpperCase(), { value: v, tier: 1, rule: "req-label" }); }
    }
  });
  return [...out.values()];
}

// ---- the chain
// ALL the values found, each one or null (the edit view of the popup shows every one of them): { company, postid, req, title, ambiguous: [...], rules: { company, postid, req, title } }
export function findAllValues(ocr) {
  const { lines, height } = prepare(ocr);
  const { co, ti } = findCompanyAndTitle(lines, height);
  const ids = postIdCandidates(lines);
  const company = pick(co), title = pick(ti), postid = pick(ids.found), req = pick(findReqs(lines));
  const unreadable = ids.kioFailed && !postid.value && postid.why !== "ambiguous" ? ["postid"] : [];   // a KIO prefix was there but no ID passed the check: the box says so and asks the person to type it
  const ambiguous = [];
  if (company.why === "ambiguous") ambiguous.push("company");
  if (postid.why === "ambiguous") ambiguous.push("postid");
  if (req.why === "ambiguous") ambiguous.push("req");
  if (title.why === "ambiguous") ambiguous.push("title");
  // the same words can not be both the company and the title
  let titleValue = title.value;
  const titleCutOff = !!titleValue && title.cut;   // a cut-off title is not a value: the title is left empty and the flag says why (the popup tells the person)
  if (titleCutOff) titleValue = null;
  if (company.value && titleValue && key(company.value) === key(titleValue)) titleValue = null;
  return { company: company.value, postid: postid.value, req: req.value, title: titleValue, titleCutOff, titleShortened: !!titleValue && title.short === true, ambiguous, unreadable, rules: { company: company.rule || null, postid: postid.rule || null, req: req.rule || null, title: title.rule || null } };
}

// the company and exactly ONE second value, by the priority postID, then req number, then title (the one-click answer)
export function findSearchValues(ocr) {
  const all = findAllValues(ocr), company = { value: all.company, rule: all.rules.company }, postid = { value: all.postid, rule: all.rules.postid }, req = { value: all.req, rule: all.rules.req }, titleValue = all.title, title = { rule: all.rules.title }, ambiguous = all.ambiguous;
  const kio = postid.value ? readKio(postid.value) : null;   // a KIO ID is the kind "kio" with its stored form; an old code stays the kind "postid"
  const second = postid.value ? (kio && kio.kind === "kio" ? { kind: "kio", value: kio.stored, rule: postid.rule } : { kind: "postid", value: postid.value, rule: postid.rule }) : req.value ? { kind: "req", value: req.value, rule: req.rule } : titleValue ? { kind: "title", value: titleValue, rule: title.rule } : null;
  if (company.value && second) return { ok: true, company: company.value, kind: second.kind, value: second.value, rules: { company: company.rule, second: second.rule } };
  return { ok: false, missing: { company: !company.value, second: !second }, ambiguous };
}
