// info-box-search.test.js - the info button of the search page in a real headless Chrome (prompt JB, November 7, 2026), the repo's own files and a fake backend (tests/fake-site.js; no real project, no key, no token).
// The sentences that used to sit on the search screen are behind the "i" at the heading and the "i" in the recap box (one box, js/info-panel.js). John's answers of November 7, 2026: both buttons; "Employers see this exactly as you type it."
// stays on the page; the phone privacy sentence (sentence 13) and the phone source sentence are behind the button, the other phone sentences stay; the sign-in wait message stays; the two icons beside Req number and KIO ID stay; the refine hints stay.
//   button      the "i" is named, a keyboard stop, says it opens a dialog, sits on the heading line in the first screen, and on a phone its touch area is at least 44 pixels
//   open        mouse, Enter and Space open the box; it is a modal dialog with the title and the three sections; focus goes in and Tab stays in; Escape, the close button and a click outside close it and focus returns to the "i"
//   sentences   the box holds every moved sentence letter for letter (with the link of the privacy sentences); the boxes of the form still point at their sentences (hidden, not rendered, not empty)
//   visible     none of the moved sentences is on the page; the kept ones are; the word count of the empty form stays under its limit
//   recap       after a search the recap has its "i"; the note under it is the echo and its first sentence only; the box holds the remainder; the staff view and the other box rules are in tests/privacy-notice.test.js
//   phone       a Shortcut address: the two phone sentences are not on the page; the box holds them; the ordinary page's box does not
//   signedout   the sign-in card shows the short text; the box holds the whole paragraph with its link
// Then planted breakages: one deliberate defect at a time in a COPY of the repo, each must make a scenario fail. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/info-box-search.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite } from "./fake-site.js";
import { SOURCE_PHONE_SENTENCE } from "../js/source-text.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const enc = encodeURIComponent;
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

const PHONE = { n: "phone 390x844", w: 390, h: 844, phone: true }, WIDE = { n: "desktop 1250x900", w: 1250, h: 900, phone: false };
const TEXT = "Senior Logistics Analyst\nContoso Freight\nAustin, TX\n$85K/yr - $110K/yr\nViewed";
const NOTE = "We keep a record of your search, including the words you typed, so we can count what people look for. The record also holds any KIO ID or req number you typed or we read from the job page, and an ID you mistyped is kept as typed. Employers never see who searched. Details are in our Privacy Policy.";
const SIGNIN = "One quick step: we email you a link, and that keeps your email confirmed for 90 days. No password, no account form. Free for job seekers. Your email is only used to confirm you are a person and is never shown to anyone. Privacy.";
// the moved sentences (the old words, letter for letter)
const MOVED = [
  "Easiest and most exact: the KIO ID from the employer's job ad (no company name needed), or the company name plus the requisition (req) number.",
  "No KIO ID? Use the company name plus part of the job title, copied from the job ad if you can.",
  "Must match the employer's name. We ignore endings like Inc., Co. and LLC. Not needed with a KIO ID.",
  "Company is required, unless you type a KIO ID. Then fill in the req number, the KIO ID / title box, or both: if the req number does not match, the title is used. A KIO ID cannot be used with a req number. The req number is hidden as you type; press Show to check it.",
  "A title search will not list all of a company's jobs, and it will not show openings that are not live. Closed or expired openings are found only by KIO ID or req number.",
  "A missing opening may simply not be added; it says nothing about whether the job exists. Check the company name, and check the KIO ID exactly as it is printed in the job ad. If you searched by title, try a different part of the title. A title search finds only openings that are live: closed or expired openings are found only by KIO ID or req number.",
  "If the employer is advertising it but it is not here, the employer has not registered it with us.",
  "An opening appears here only if an employer has added it to FightGhostJobs; a missing opening may simply not be added.",
  NOTE, SIGNIN,
];
const REMOVED = ["Most exact. Copy it from the job ad.", "A KIO ID is exact. No KIO ID? Use part of the title."];
const KEPT = ["Search for one specific job you already know about.", "Employers see this exactly as you type it.", "Not needed with a KIO ID."];
const wc = (t) => t.trim().split(/\s+/).filter(Boolean).length;
const EMPTY_FORM_WORD_LIMIT = 90;   // the visible words of #main (the heading, the form and the field for the source) for a signed-in candidate before any search: 80 measured on November 7, 2026 (250 explanatory words before this prompt were 72 after)

async function become(tab, site, who) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  if (who === "out") return;
  await tab.goto(site.url + "/_dev/link?kind=" + who); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
async function openAt(tab, site, size, hash = "", waitPhone = false) {
  await tab.viewport(size.w, size.phone, size.h);
  await tab.goto(site.url + "/404.html"); await tab.goto(site.url + "/search.html" + hash);
  await tab.waitFor("document.readyState === 'complete' && !!document.getElementById('company')", 15000);
  if (waitPhone) await tab.waitFor("!document.getElementById('phoneBody').hidden", 10000); else await sleep(900);
  await sleep(250);
}
const norm = "replace(/\\s+/g, ' ').trim()";
const BOX_OPEN = (slot) => `(() => { const i = document.querySelector('${slot} .info-box-icon'); if (!i) return false; i.click(); return !!document.querySelector('.info-box'); })()`;
const BOX_TEXT = `(() => { const b = document.querySelector('.info-box-body'); return b ? b.innerText.${norm} : null; })()`;
const BOX_CLOSE = `(() => { const c = document.querySelector('.info-box-close'); if (c) c.click(); return !document.querySelector('.info-box'); })()`;
const PAGE_TEXT = `(() => document.getElementById('main').innerText.${norm})()`;
const readBox = async (tab, slot) => { const ok = await tab.eval(BOX_OPEN(slot)); await sleep(200); const t = ok ? await tab.eval(BOX_TEXT) : null; await tab.eval(BOX_CLOSE); await sleep(150); return t; };
const searches = (site) => site.calls.filter((c) => c.name === "candidate-search");
const fill = (tab, company, title) => tab.eval(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }; set("company", ${JSON.stringify(company)}); set("titleq", ${JSON.stringify(title)}); })()`);
const press = async (tab) => { await tab.eval(`document.getElementById("searchBtn").focus()`); await tab.key("Enter"); };

const SCENARIOS = {
  async button(root) {
    const bad = [], site = await startFakeSite(root), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      await become(tab, site, "candidate");
      for (const size of [WIDE, PHONE]) {
        await openAt(tab, site, size);
        const s = await tab.eval(`(() => { const i = document.querySelector('#infoSlot .info-box-icon'), h1 = document.querySelector('h1'); if (!i) return null; const r = i.getBoundingClientRect(), hr = h1.getBoundingClientRect();
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2, hit = (dx, dy) => { const e = document.elementFromPoint(cx + dx, cy + dy); return !!e && (e === i || i.contains(e)); };
          return { label: i.getAttribute('aria-label'), role: i.getAttribute('role'), popup: i.getAttribute('aria-haspopup'), tab: i.tabIndex, w: r.width, top: r.top, bottom: r.bottom, left: r.left, h1right: hr.right, h1top: hr.top, h1bottom: hr.bottom, vh: innerHeight, vw: innerWidth,
            hit22: hit(21, 0) && hit(-21, 0) && hit(0, 21) && hit(0, -21), count: document.querySelectorAll('#infoSlot .info-box-icon').length, text: i.textContent }; })()`);
        const L = size.n + ": ";
        if (!s) { bad.push(L + "no info button at the heading"); continue; }
        if (s.label !== "About this search page") bad.push(L + "the button is named '" + s.label + "'");
        if (s.role !== "button" || s.popup !== "dialog" || s.tab !== 0) bad.push(L + "the button is not a keyboard stop that opens a dialog: " + JSON.stringify([s.role, s.popup, s.tab]));
        if (s.count !== 1 || s.text !== "i") bad.push(L + "the heading has " + s.count + " buttons reading '" + s.text + "'");
        if (!(s.top < s.h1bottom && s.bottom > s.h1top) || s.left < s.h1right - 1) bad.push(L + "the button is not on the heading line, right of the heading");
        if (s.bottom > s.vh || s.left + s.w > s.vw) bad.push(L + "the button is not in the first screen");
        if (size.phone && !s.hit22) bad.push(L + "the touch area is under 44 pixels (a point 21 pixels from the centre misses the button)");
      }
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async open(root) {
    const bad = [], site = await startFakeSite(root), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      await become(tab, site, "candidate");
      for (const size of [WIDE, PHONE]) {
        await openAt(tab, site, size);
        const L = size.n + ": ";
        const inBox = `(() => { const d = document.querySelector('.info-box'); return !!d && d.contains(document.activeElement); })()`, onIcon = `document.activeElement === document.querySelector('#infoSlot .info-box-icon')`;
        // mouse
        await tab.eval(`document.querySelector('#infoSlot .info-box-icon').focus()`);
        if (!(await tab.eval(BOX_OPEN("#infoSlot")))) { bad.push(L + "a click does not open the box"); continue; }
        await sleep(250);
        const d = await tab.eval(`(() => { const d = document.querySelector('.info-box'); return { role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), title: document.getElementById('infoBoxTitle').textContent, sections: Array.from(d.querySelectorAll('.info-section')).map((e) => e.textContent), inert: !!document.querySelector('#main[inert], main[inert], body > [inert]') }; })()`);
        if (d.role !== "dialog" || d.modal !== "true") bad.push(L + "the box is not a modal dialog");
        if (d.title !== "About this search") bad.push(L + "the box title is '" + d.title + "'");
        if (d.sections.join("|") !== "How to search|When nothing is found|Your privacy") bad.push(L + "the sections are " + d.sections.join("|"));
        if (!(await tab.eval(inBox))) bad.push(L + "focus did not go into the box");
        for (let i = 0; i < 14; i++) await tab.key("Tab");
        if (!(await tab.eval(inBox))) bad.push(L + "Tab left the box");
        await tab.key("Escape"); await sleep(250);
        if (await tab.eval(`!!document.querySelector('.info-box')`)) bad.push(L + "Escape does not close the box");
        if (!(await tab.eval(onIcon))) bad.push(L + "focus did not return to the button after Escape");
        // keyboard: Enter, then Space
        for (const k of ["Enter", " "]) {
          await tab.key(k); await sleep(250);
          if (!(await tab.eval(`!!document.querySelector('.info-box')`))) bad.push(L + "the key '" + k + "' does not open the box");
          await tab.eval(`document.querySelector('.info-box-close').click()`); await sleep(250);
          if (!(await tab.eval(onIcon))) bad.push(L + "focus did not return to the button after the close button (" + k + ")");
        }
        // a click outside
        await tab.eval(BOX_OPEN("#infoSlot")); await sleep(200);
        await tab.eval(`document.querySelector('.info-box-backdrop').dispatchEvent(new MouseEvent('click', { bubbles: true }))`); await sleep(250);
        if (await tab.eval(`!!document.querySelector('.info-box')`)) bad.push(L + "a click outside does not close the box");
        if (searches(site).length) bad.push(L + "opening the box sent a search");
      }
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async sentences(root) {
    const bad = [], site = await startFakeSite(root), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      await become(tab, site, "candidate");
      await openAt(tab, site, WIDE);
      const calls0 = site.calls.length;
      const t = await readBox(tab, "#infoSlot");
      if (!t) return ["the box did not open"];
      for (const s of MOVED) if (!t.includes(s)) bad.push("the box lacks: " + s.slice(0, 70));
      await tab.eval(BOX_OPEN("#infoSlot")); await sleep(200);
      const link = await tab.eval(`Array.from(document.querySelectorAll('.info-box-body a')).map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('target')])`);
      await tab.eval(BOX_CLOSE);
      const want = [["Privacy Policy", "https://www.fightghostjobs.com/privacy.html", null], ["Privacy", "https://www.fightghostjobs.com/privacy.html", null]];
      if (JSON.stringify(link) !== JSON.stringify(want)) bad.push("the links in the box are " + JSON.stringify(link));
      if (site.calls.length !== calls0) bad.push("opening the box sent a request");
      const desc = await tab.eval(`(() => ['company', 'reqq', 'titleq'].map((id) => { const ids = (document.getElementById(id).getAttribute('aria-describedby') || '').split(/\\s+/).filter(Boolean); return [id, ids.map((x) => { const e = document.getElementById(x); return e ? [x, e.textContent.trim().length > 0, e.getClientRects().length === 0] : [x, false, false]; })]; }))()`);
      const wantIds = { company: ["companyHintFull"], reqq: ["reqHint"], titleq: ["reqHint", "titleNote"] };
      for (const [id, list] of desc) {
        if (JSON.stringify(list.map((x) => x[0])) !== JSON.stringify(wantIds[id])) bad.push("the " + id + " box is described by " + list.map((x) => x[0]).join(" "));
        for (const [x, filled, hidden] of list) { if (!filled) bad.push("#" + x + " is missing or empty"); if (!hidden) bad.push("#" + x + " is rendered on the page (it must be hidden)"); }
      }
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async visible(root) {
    const bad = [], site = await startFakeSite(root), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      await become(tab, site, "candidate");
      for (const size of [WIDE, PHONE]) {
        await openAt(tab, site, size);
        const t = await tab.eval(PAGE_TEXT), L = size.n + ": ";
        for (const s of MOVED) if (t.includes(s.slice(0, 60))) bad.push(L + "a moved sentence is on the page: " + s.slice(0, 60));
        for (const s of REMOVED) if (t.includes(s)) bad.push(L + "a removed hint is back: " + s);
        for (const s of KEPT) if (!t.includes(s)) bad.push(L + "a kept text is missing: " + s);
        if (wc(t) > EMPTY_FORM_WORD_LIMIT) bad.push(L + "the page holds " + wc(t) + " visible words (limit " + EMPTY_FORM_WORD_LIMIT + ")");
        if (process.env.FGJ_JB_REPORT) console.log("VISIBLE WORDS " + size.n + ": " + wc(t));
        // the two icons beside Req number and KIO ID stay as they were (they hide their own text)
        const tips = await tab.eval(`Array.from(document.querySelectorAll('.info-icon:not(.info-box-icon)')).map((e) => (e.getAttribute('aria-label') || '').slice(0, 20))`);
        if (JSON.stringify(tips) !== JSON.stringify(["What's the req numbe", "What's a KIO ID? The"])) bad.push(L + "the icons beside Req number and KIO ID changed: " + JSON.stringify(tips));
      }
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async recap(root) {
    const bad = [], site = await startFakeSite(root), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      await become(tab, site, "candidate");
      for (const size of [WIDE, PHONE]) {
        await openAt(tab, site, size);
        const L = size.n + ": ";
        const head = await readBox(tab, "#infoSlot");
        await fill(tab, "Zzyzx Unknown", "Nurse"); await press(tab);
        if (!(await tab.waitFor(`!document.getElementById("recap").hidden`, 8000))) { bad.push(L + "no recap after the search"); continue; }
        await sleep(500);
        const note = await tab.eval(`(() => { const n = document.getElementById('emptyNote'); return n ? n.innerText.${norm} : null; })()`);
        const want = 'No openings found for "Zzyzx Unknown" + "Nurse". An opening appears here only if an employer has added it to FightGhostJobs.';
        if (note !== want) bad.push(L + "the note under the recap is '" + note + "'");
        const recapBox = await readBox(tab, "#recapInfoSlot");
        if (!recapBox) { bad.push(L + "the recap has no working button"); continue; }
        if (recapBox !== head) bad.push(L + "the box from the recap is not the box from the heading");
        if (!recapBox.includes(MOVED[5]) || !recapBox.includes(NOTE)) bad.push(L + "the box does not hold the rest of the note and the record notice");
        const n = await tab.eval(`document.querySelectorAll('#recapInfoSlot .info-box-icon').length + document.querySelectorAll('#infoSlot .info-box-icon').length`);
        if (n !== 2) bad.push(L + "there are " + n + " buttons (two expected)");
        await tab.eval(`document.getElementById("recapEdit").click()`); await sleep(300);
        // a req number search that finds nothing: the page shows two sentences, the box the rest
        await fill(tab, "Zzyzx Unknown", ""); await tab.eval(`(() => { const e = document.getElementById('reqq'); e.value = 'R-9999'; e.dispatchEvent(new Event('input', { bubbles: true })); })()`); await press(tab);
        await tab.waitFor(`!document.getElementById("recap").hidden`, 8000); await sleep(500);
        const noteReq = await tab.eval(`(() => { const n = document.getElementById('emptyNote'); return n ? n.innerText.${norm} : null; })()`);
        if (!noteReq || !noteReq.includes("If the job ad shows a KIO ID, try that instead.") || noteReq.includes("a missing opening may simply not be added")) bad.push(L + "the req number note on the page is '" + noteReq + "'");
        await tab.eval(`document.getElementById("recapEdit").click()`); await sleep(200);
      }
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async phone(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      await become(tab, site, "candidate");
      await openAt(tab, site, PHONE, "#x=" + enc(TEXT) + "&s=" + enc("Jobs at LinkedIn"), true);
      const t = await tab.eval(PAGE_TEXT);
      if (t.includes("We never receive your screenshot") || t.includes("Where you found the job is optional")) bad.push("a phone sentence behind the button is on the page");
      const box = await readBox(tab, "#infoSlot");
      if (!box || !box.includes("We never receive your screenshot") || !box.includes(SOURCE_PHONE_SENTENCE)) bad.push("the box lacks a phone sentence: " + String(box).slice(-200));
      // the other phone sentences stay on the page (the line about what was read)
      if (!(await tab.eval(`document.getElementById('phoneLine').innerText.trim().length > 0 && document.getElementById('phoneBody').getClientRects().length > 0`))) bad.push("the phone line that stays visible is not on the page");
      // the ordinary page: no phone sentences in the box
      await openAt(tab, site, PHONE, "");
      const plain = await readBox(tab, "#infoSlot");
      if (plain && (plain.includes("We never receive your screenshot") || plain.includes(SOURCE_PHONE_SENTENCE))) bad.push("the ordinary page's box holds a phone sentence");
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async signedout(root) {
    const bad = [], site = await startFakeSite(root), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      await become(tab, site, "out");
      await openAt(tab, site, WIDE);
      const t = await tab.eval(PAGE_TEXT);
      if (!t.includes("One quick step: we email you a link. No password, no account form.") || t.includes("keeps your email confirmed for 90 days")) bad.push("the sign-in card does not show the short text only: " + t.slice(0, 200));
      const box = await readBox(tab, "#infoSlot");
      if (!box || !box.includes(SIGNIN)) bad.push("the box lacks the whole sign-in paragraph");
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
};

for (const [name, fn] of Object.entries(SCENARIOS)) {
  test("the info button: " + name, { timeout: 600000 }, async () => {
    const bad = await fn(ROOT);
    assert.deepEqual(bad, [], bad.join("\n"));
  });
}

// ---- planted breakages: [label, scenarios to run, [file, mutate(text)]...]. Each must make at least one scenario report a problem.
const SP = "js/pages/search.js", IP = "js/info-panel.js", SE = "js/phone-entry.js", H = "search.html";
const DEFECTS = [
  ["the button is named something else", ["button"], [[IP, (s) => s.replace('export const INFO_ICON_LABEL = "About this search page";', 'export const INFO_ICON_LABEL = "Help";')]]],
  ["the button at the heading is gone", ["button"], [[SP, (s) => s.replace('$("#infoSlot").append(infoPanelIcon()); ', "")]]],
  ["the button in the recap box is gone", ["recap"], [[SP, (s) => s.replace('$("#recapInfoSlot").append(infoPanelIcon());', "")]]],
  ["the button is a small target on a phone", ["button"], [["app.css", (s) => s.replace('  .info-icon::before{content:"";position:absolute;inset:-15px}', '  .info-icon::before{content:"";position:absolute;inset:0}')]]],
  ["a guide sentence is back on the page", ["visible"], [[H, (s) => s.replace('<p class="srch-lead">Search for one specific job you already know about.</p>', '<p class="srch-lead">Search for one specific job you already know about.</p><p>Easiest and most exact: the KIO ID from the employer\'s job ad (no company name needed), or the company name plus the requisition (req) number.</p>')]]],
  ["a removed hint is back", ["visible"], [[H, (s) => s.replace('<div id="searchGuide"', '<div id="titleHint" class="field-hint">A KIO ID is exact. No KIO ID? Use part of the title.</div><div id="searchGuide"')]]],
  ["the employer sentence of the source field leaves the page", ["visible"], [[H, (s) => s.replace("Employers see this exactly as you type it.", "")]]],
  ["the box drops the record notice", ["sentences", "recap"], [[IP, (s) => s.replace('privacy.push(copyOf(doc, "searchNotice"));', "privacy.push(null);")]]],
  ["the box drops the sign-in paragraph", ["sentences", "signedout"], [[IP, (s) => s.replace('privacy.push(copyOf(doc, "signinFull"));', "")]]],
  ["the box drops the rules under the form", ["sentences"], [[IP, (s) => s.replace('copyOf(doc, "reqHint"), copyOf(doc, "titleNote")', "null, null")]]],
  ["the box drops the rest of the note", ["recap", "sentences"], [[IP, (s) => s.replace("NO_MATCH_SPLIT().rest, ", "")]]],
  ["the note is whole on the page again", ["recap"], [[SP, (s) => s.replace("noMatchParts(searched.company, searched.query, searched.kind).visible);", "(p => p.visible + \" \" + p.rest)(noMatchParts(searched.company, searched.query, searched.kind)));")]]],
  ["a box of the form is no longer described by its sentence", ["sentences"], [[H, (s) => s.replace('aria-describedby="reqHint" data-lpignore', 'data-lpignore')]]],
  ["the sentences of the form are rendered on the page", ["sentences", "visible"], [[H, (s) => s.replace('<div id="infoSource" hidden>', '<div id="infoSource">')]]],
  ["the phone privacy sentence is back on the page", ["phone"], [[SE, (s) => s.replace('privacy.textContent = SENTENCES[13]; privacy.dataset.on = "1";', 'privacy.textContent = SENTENCES[13]; privacy.dataset.on = "1"; privacy.hidden = false;')]]],
  ["the box never holds the phone sentences", ["phone"], [[IP, (s) => s.replace('el.dataset.on === "1"', 'el.dataset.on === "never"')]]],
  ["the sign-in card shows the long paragraph", ["signedout"], [[H, (s) => s.replace("<p>One quick step: we email you a link. No password, no account form.</p>", "<p>One quick step: we email you a link, and that keeps your email confirmed for 90 days. No password, no account form.</p>")]]],
  ["the box has no title", ["open"], [[IP, (s) => s.replace('export const INFO_TITLE = "About this search";', 'export const INFO_TITLE = "";')]]],
  ["a section is missing", ["open"], [[IP, (s) => s.replace('nothing: "When nothing is found", ', "")]]],
];
test("planted breakages: each deliberate defect in the info button makes a scenario fail", { timeout: 6000000 }, async () => {
  const missed = [], only = process.env.FGJ_JB_ONLY ? process.env.FGJ_JB_ONLY.split("|") : null;
  let n = 0;
  for (const [label, scenarios, edits] of DEFECTS) {
    if (only && !only.some((x) => label.includes(x))) continue;
    n++;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-jb-ctl-")), t0 = Date.now();
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) {
        const p = path.join(dir, rel), before = fs.readFileSync(p, "utf8").replace(/\?v=[0-9a-f]{8}(?=["'`])/g, "").replace(/\r\n/g, "\n"), after = mutate(before);
        assert.notEqual(after, before, "the defect '" + label + "' changed nothing in " + rel);
        fs.writeFileSync(p, after);
      }
      const found = [];
      for (const name of scenarios) found.push(...(await SCENARIOS[name](dir)).map((x) => name + ": " + x));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  [" + ((Date.now() - t0) / 1000).toFixed(0) + " s]  (" + found[0].slice(0, 150) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  console.log("planted breakages run: " + n + ", missed: " + missed.length);
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
