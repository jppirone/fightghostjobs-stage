// info-panel.unit.test.js (prompt JB, November 7, 2026) - the words that moved behind the info button of the search page are the same words: nothing is rewritten, nothing is lost.
// No browser. Run: node --test tests/info-panel.unit.test.js
//   1. the pieces the page cuts (the "nothing found" notes) join back into exactly the old text, and what the page shows is exactly the approved visible text (the first sentence(s)); the remainder is what the info box carries
//   2. the sentences that stay in the page, hidden (#infoSource), are the old sentences letter for letter, and the page shows only the approved short texts
//   3. planted breakages, each made on a copy in memory, are caught
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { noMatchMessage, noMatchParts, splitSentences, MISS_LINE_SPLIT, MISS_MESSAGES, NO_MATCH_NOTE, NO_MATCH_NOTE_REQ, NO_MATCH_SPLIT, NO_MATCH_REQ_SPLIT } from "../js/search-input.js";
import { INFO_TITLE, INFO_ICON_LABEL, INFO_SECTIONS } from "../js/info-panel.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (p) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
const wc = (t) => t.trim().split(/\s+/).filter(Boolean).length;

// the old words, as they were before prompt JB (copied from the commit 50d2f2e; the page and the notes were these letter for letter)
const OLD_NOTE = "An opening appears here only if an employer has added it to FightGhostJobs. A missing opening may simply not be added; it says nothing about whether the job exists. Check the company name, and check the KIO ID exactly as it is printed in the job ad. If you searched by title, try a different part of the title. A title search finds only openings that are live: closed or expired openings are found only by KIO ID or req number.";
const OLD_NOTE_REQ = "Check the company name exactly as the employer entered it, and the req number exactly as printed in the job ad. If the job ad shows a KIO ID, try that instead. An opening appears here only if an employer has added it to FightGhostJobs; a missing opening may simply not be added.";
const OLD_MISS_LINE = "Check the KIO ID, title or req number against the opening you are looking at. If the employer is advertising it but it is not here, the employer has not registered it with us.";
const SHOWN_NOTE = "An opening appears here only if an employer has added it to FightGhostJobs.";
const SHOWN_NOTE_REQ = "Check the company name exactly as the employer entered it, and the req number exactly as printed in the job ad. If the job ad shows a KIO ID, try that instead.";
const SHOWN_MISS_LINE = "Check the KIO ID, title or req number against the opening you are looking at.";

const OLD_HTML = {
  guideKio: "Easiest and most exact: the KIO ID from the employer's job ad (no company name needed), or the company name plus the requisition (req) number.",
  guideTitle: "No KIO ID? Use the company name plus part of the job title, copied from the job ad if you can.",
  companyHintFull: "Must match the employer's name. We ignore endings like Inc., Co. and LLC. Not needed with a KIO ID.",
  reqHint: "Company is required, unless you type a KIO ID. Then fill in the req number, the KIO ID / title box, or both: if the req number does not match, the title is used. A KIO ID cannot be used with a req number. The req number is hidden as you type; press Show to check it.",
  titleNote: "A title search will not list all of a company's jobs, and it will not show openings that are not live. Closed or expired openings are found only by KIO ID or req number.",
  sourceNote: "Employers see this exactly as you type it.",   // prompt JK (November 7, 2026): it left the form and is among the hidden sentences that the info box copies
  signinFull: 'One quick step: we email you a link, and that keeps your email confirmed for 90 days. No password, no account form. Free for job seekers. Your email is only used to confirm you are a person and is never shown to anyone. <a href="https://www.fightghostjobs.com/privacy.html">Privacy</a>.',
  searchNotice: 'We keep a record of your search, including the words you typed, so we can count what people look for. The record also holds any KIO ID or req number you typed or we read from the job page, and an ID you mistyped is kept as typed. Employers never see who searched. Details are in our <a href="https://www.fightghostjobs.com/privacy.html">Privacy Policy</a>.',
};

function findings(html, input, panel) {
  const bad = [];
  if (NO_MATCH_NOTE !== OLD_NOTE) bad.push("NO_MATCH_NOTE changed");
  if (NO_MATCH_NOTE_REQ !== OLD_NOTE_REQ) bad.push("NO_MATCH_NOTE_REQ changed");
  if (MISS_MESSAGES.registered_no_match[1] !== OLD_MISS_LINE) bad.push("the second line of registered_no_match changed");
  // 1. the notes
  for (const [kind, company, query] of [["phrase", "Acme Widgets", "Welder"], ["code", "Acme Widgets", "D21M48YBZQBF"], ["req", "Acme Widgets", ""]]) {
    const echo = kind === "req" ? 'No openings found for "Acme Widgets" with that req number. ' : kind === "code" ? 'No openings found for "Acme Widgets" + code "D21M48YBZQBF". ' : 'No openings found for "Acme Widgets" + "Welder". ';
    const old = echo + (kind === "req" ? OLD_NOTE_REQ : OLD_NOTE);
    const p = noMatchParts(company, query, kind);
    if (p.visible + " " + p.rest !== old) bad.push(kind + ": visible + rest is not the old note");
    if (noMatchMessage(company, query, kind) !== old) bad.push(kind + ": noMatchMessage is not the old note");
    if (p.visible !== echo + (kind === "req" ? SHOWN_NOTE_REQ : SHOWN_NOTE)) bad.push(kind + ": what the page shows is not the approved text: " + p.visible.slice(-60));
    if (p.rest !== (kind === "req" ? OLD_NOTE_REQ.slice(SHOWN_NOTE_REQ.length + 1) : OLD_NOTE.slice(SHOWN_NOTE.length + 1))) bad.push(kind + ": the rest is not the remainder of the old note");
  }
  const kio = noMatchParts("Acme", "KIO-1", "kio");
  if (kio.rest !== "" || kio.visible === "") bad.push("a KIO ID search got a cut note");
  const ml = MISS_LINE_SPLIT(OLD_MISS_LINE);
  if (ml.visible !== SHOWN_MISS_LINE || ml.visible + " " + ml.rest !== OLD_MISS_LINE) bad.push("the registered_no_match second line is not cut after its first sentence");
  for (const other of [MISS_MESSAGES.not_registered[0], MISS_MESSAGES.registered_no_match[0], MISS_MESSAGES.registered_none_live[0]]) { const s = MISS_LINE_SPLIT(other); if (s.visible !== other || s.rest !== "") bad.push("a miss line that is not cut was cut: " + other.slice(0, 40)); }
  if (NO_MATCH_SPLIT().visible !== SHOWN_NOTE || NO_MATCH_REQ_SPLIT().visible !== SHOWN_NOTE_REQ) bad.push("the split constants differ from the approved visible text");
  for (const n of [1, 2, 3]) { const s = splitSentences(OLD_NOTE, n); if ((s.rest ? s.visible + " " + s.rest : s.visible) !== OLD_NOTE) bad.push("splitSentences loses words at " + n); }
  // the info box carries all three remainders
  for (const need of ["NO_MATCH_SPLIT().rest", "NO_MATCH_REQ_SPLIT().rest", "MISS_MESSAGES.registered_no_match[1]"]) if (!panel.includes(need)) bad.push("the info box does not carry " + need);
  if (!panel.includes('copyOf(doc, "sourceNote")')) bad.push("the info box does not copy the employer sentence of the source field");
  // 2. the page
  const src = (html.match(/<div id="infoSource" hidden>([\s\S]*?)\n<\/div>/) || [])[1] || "";
  for (const [id, want] of Object.entries(OLD_HTML)) {
    const m = src.match(new RegExp('<(p|div) id="' + id + '"[^>]*>([\\s\\S]*?)</\\1>'));
    if (!m) { bad.push("#" + id + " is not in the hidden #infoSource"); continue; }
    if (m[2] !== want) bad.push("#" + id + " is not the old sentence: " + m[2].slice(0, 50));
  }
  const page = html.replace(src, "");
  for (const [id, want] of Object.entries({ companyHint: "Not needed with a KIO ID." })) if (!new RegExp('id="' + id + '"[^>]*>' + want.replace(/\./g, "\\.") + "</div>").test(page)) bad.push("the page does not show the short text of #" + id);
  if (!page.includes("<p>One quick step: we email you a link. No password, no account form.</p>")) bad.push("the sign-in card does not show the approved short text");
  if (!page.includes('<p class="srch-lead">Search for one specific job you already know about.</p>')) bad.push("the lead sentence is not on the page");
  if (page.includes("Employers see this exactly as you type it.")) bad.push("the employer sentence of the source field is on the visible page (John, November 7, 2026, prompt JK: it is only behind the info button)");
  if (!page.includes('<div id="sourceHint" class="field-hint">Site (ex. LinkedIn.com or LinkedIn) or email (ex. jobs@linkedin.com)</div>')) bad.push("the one help line of the optional field is not the approved short line");
  if (!/id="sourceq"[^>]*aria-describedby="sourceHint sourceNote"/.test(page)) bad.push("the optional box is not described by its help line and the hidden employer sentence");
  for (const gone of ["Most exact. Copy it from the job ad.", "A KIO ID is exact. No KIO ID? Use part of the title."]) if (page.includes(gone) || src.includes(gone)) bad.push("a removed hint is back: " + gone);
  // the box is named
  if (INFO_TITLE !== "About this search" || INFO_ICON_LABEL !== "About this search page") bad.push("the box title or the name of the 'i' changed");
  if (Object.values(INFO_SECTIONS).join("|") !== "How to search|When nothing is found|Your privacy") bad.push("the section names changed");
  // no em or en dash in what is new
  for (const [name, text] of [["search.html", src], ["info-panel.js", panel], ["search-input.js", input]]) if (/—|–/.test(text)) bad.push(name + " holds an em dash or an en dash");
  return bad;
}

test("the moved sentences are the old sentences, the page shows the approved short texts", () => {
  assert.deepEqual(findings(rd("search.html"), rd("js/search-input.js"), rd("js/info-panel.js")), []);
});

test("words saved on the page by this prompt: the shortened pieces are shorter by the approved amounts", () => {
  const before = wc(OLD_NOTE) + wc(OLD_NOTE_REQ) + wc(OLD_MISS_LINE) + wc(OLD_HTML.companyHintFull) + wc(OLD_HTML.signinFull.replace(/<[^>]+>/g, ""));
  const after = wc(SHOWN_NOTE) + wc(SHOWN_NOTE_REQ) + wc(SHOWN_MISS_LINE) + wc("Not needed with a KIO ID.") + wc("One quick step: we email you a link. No password, no account form.");
  assert.ok(after < before / 2, "the shortened pieces still hold " + after + " of " + before + " words");
});

test("breakages are caught, a plant at nothing is not", () => {
  const html = rd("search.html"), input = rd("js/search-input.js"), panel = rd("js/info-panel.js");
  const sw = (t, a, b) => { if (t.split(a).length !== 2) throw new Error("anchor not found once: " + a.slice(0, 60)); return t.replace(a, () => b); };
  const BREAK = [
    ["a guide sentence is reworded", () => [sw(html, "Easiest and most exact:", "Easiest:"), input, panel]],
    ["a guide sentence is deleted", () => [sw(html, '  <p id="guideTitle">No KIO ID? Use the company name plus part of the job title, copied from the job ad if you can.</p>\n', ""), input, panel]],
    ["the company hint loses a word", () => [sw(html, "Must match the employer's name. We ignore endings like Inc., Co. and LLC. Not needed with a KIO ID.</div>", "Must match the employer's name. We ignore endings like Inc., Co. and LLC.</div>"), input, panel]],
    ["the sign-in paragraph loses its link", () => [sw(html, 'is never shown to anyone. <a href="https://www.fightghostjobs.com/privacy.html">Privacy</a>.</p>', "is never shown to anyone.</p>"), input, panel]],
    ["the record notice loses a sentence", () => [sw(html, " Employers never see who searched.", ""), input, panel]],
    ["the short text of the sign-in card is the long one", () => [sw(html, "<p>One quick step: we email you a link. No password, no account form.</p>", "<p>One quick step: we email you a link, and that keeps your email confirmed for 90 days. No password, no account form.</p>"), input, panel]],
    ["the employer sentence of the source field is gone from the hidden sentences", () => [sw(html, '<div id="sourceNote" class="field-hint">Employers see this exactly as you type it.</div>', '<div id="sourceNote" class="field-hint"></div>'), input, panel]],
    ["the employer sentence is back on the form", () => [sw(html, '<div id="sourceHint"', '<div class="field-hint">Employers see this exactly as you type it.</div><div id="sourceHint"'), input, panel]],
    ["the long instruction line is back", () => [sw(html, "Site (ex. LinkedIn.com or LinkedIn) or email (ex. jobs@linkedin.com)", "Type a site name or domain, such as LinkedIn.com (LinkedIn alone is fine), or the address of the email the job came from, such as jobs@linkedin.com."), input, panel]],
    ["the info box stops copying the employer sentence", () => [html, input, sw(panel, 'privacy.push(copyOf(doc, "sourceNote"));', "")]],
    ["a removed hint comes back", () => [sw(html, '<div id="searchGuide"', '<div id="reqCellHint" class="field-hint">Most exact. Copy it from the job ad.</div><div id="searchGuide"'), input, panel]],
    ["the note is cut after two sentences", () => [html, sw(input, "splitSentences(NO_MATCH_NOTE, 1)", "splitSentences(NO_MATCH_NOTE, 2)"), panel]],
    ["the req note is cut after one sentence", () => [html, sw(input, "splitSentences(NO_MATCH_NOTE_REQ, 2)", "splitSentences(NO_MATCH_NOTE_REQ, 1)"), panel]],
    ["the note's wording changes", () => [html, sw(input, "A missing opening may simply not be added; it says nothing about whether the job exists.", "A missing opening may simply not be added."), panel]],
    ["the info box drops the req remainder", () => [html, input, sw(panel, ", NO_MATCH_REQ_SPLIT().rest]", "]")]],
    ["the info box drops the miss line remainder", () => [html, input, sw(panel, "MISS_MESSAGES.registered_no_match[1]", "MISS_MESSAGES.not_registered[0]")]],
    ["the box is renamed", () => [html, input, sw(panel, 'export const INFO_TITLE = "About this search";', 'export const INFO_TITLE = "Help";')]],
  ];
  const missed = [];
  for (const [what, f] of BREAK) {
    const [h, i, p] = f();
    let bad;
    try { bad = findingsOnCopy(h, i, p); } catch (e) { bad = ["threw: " + e.message]; }
    if (!bad.length) missed.push(what);
  }
  assert.deepEqual(missed, [], "breakages the findings missed");
  const PLANT = [() => [html.replace("</head>", "<!-- nothing -->\n</head>"), input, panel], () => [html, input + "\n// a comment about nothing\n", panel], () => [html, input, panel + "\n// a comment about nothing\n"]];
  for (const f of PLANT) { const [h, i, p] = f(); assert.deepEqual(findingsOnCopy(h, i, p), [], "a plant at nothing was flagged"); }
});

// the findings on copies held in memory: the imported functions come from the real files, so a change to a copy of search-input.js or info-panel.js is judged by reading its text for the cut points, and the page by its html
function findingsOnCopy(html, input, panel) {
  const bad = [];
  const sNote = (input.match(/export const NO_MATCH_SPLIT = \(\) => splitSentences\(NO_MATCH_NOTE, (\d)\)/) || [])[1], sReq = (input.match(/export const NO_MATCH_REQ_SPLIT = \(\) => splitSentences\(NO_MATCH_NOTE_REQ, (\d)\)/) || [])[1];
  if (sNote !== "1") bad.push("the plain note is not cut after its first sentence");
  if (sReq !== "2") bad.push("the req note is not cut after its second sentence");
  const noteConst = (input.match(/export const NO_MATCH_NOTE = "([^"]*)";/) || [])[1];
  if (noteConst !== OLD_NOTE) bad.push("NO_MATCH_NOTE changed");
  const reqConst = (input.match(/export const NO_MATCH_NOTE_REQ = "([^"]*)";/) || [])[1];
  if (reqConst !== OLD_NOTE_REQ) bad.push("NO_MATCH_NOTE_REQ changed");
  const sp = findings(html, rd("js/search-input.js"), panel).filter((x) => !/^(NO_MATCH|the second line|phrase|code|req|a KIO|the registered|the split|splitSentences|a miss line)/.test(x));
  const title = (panel.match(/export const INFO_TITLE = "([^"]*)"/) || [])[1];
  if (title !== "About this search") bad.push("the box title changed");
  return [...bad, ...sp];
}
