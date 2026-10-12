// follow-up-bn.test.js - prompt BN (October 11, 2026), in a real browser: (1) the My openings table tidied (the action words side by side with an even gap and no indent on a wrapped line, every date on one line or
// broken only between the date and its time, a wider expired-draft note, shorter rows, no sideways scroll at 1366 and 1100, the phone card list unchanged); (2) an employer's two screens show NOTHING for the place
// when nothing is set while a candidate screen keeps "Location not stated"; (3) the destination links sentence above the bottom button is shown only while it is true, and the address typed in a cancelled link form
// is neither kept nor sent. The repo's own files and a fake backend (tests/fake-site.js; no real project, no key).
// Then negative controls: one defect at a time in the page code or the style; each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/follow-up-bn.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite } from "./fake-site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EDIT = "edit.html?id=3f1d5b1e-0000-4000-8000-000000000001";
const NOT_STATED = "Location not stated";
const NOTE_WORDS = "Publish window ended: a draft can be published for 14 days after it was added. To use it, add it again as a new opening.";   // prompt BR (October 12, 2026): "added", as the server counts it
const ONE_SENTENCE = "The destination links section has something that is not saved. Use the button in that section to save it first, then press Save changes.";
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

async function withSite(root, opts, fn) { const site = await startFakeSite(root, opts); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }
const q = JSON.stringify;
const text = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; })()");
const exists = (tab, sel) => tab.eval("!!document.querySelector(" + q(sel) + ")");
const click = (tab, sel) => tab.eval("document.querySelector(" + q(sel) + ").click()");
const clickText = (tab, scope, label) => tab.eval("(() => { const b = Array.from(document.querySelectorAll(" + q(scope) + ")).find((x) => x.textContent.trim() === " + q(label) + "); if (!b) throw new Error('no button ' + " + q(label) + "); b.click(); })()");
const typeIn = (tab, sel, value) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); e.focus(); e.value = " + q(value) + "; e.dispatchEvent(new Event('input', { bubbles: true })); })()");
async function signIn(tab, site, kind, width, phone) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=" + kind); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.viewport(width || 1366, !!phone, phone ? 800 : 900);
}
async function openDash(tab, site, width, phone) {
  await signIn(tab, site, "poster", width, phone);
  await tab.goto(site.url + "/dashboard.html");
  await tab.waitFor("document.querySelectorAll('tbody tr').length > 0", 10000);
  await tab.waitFor("document.fonts.status === 'loaded'", 10000); await sleep(500);          // the numbers are only the same every time once the page's own fonts are in
}
async function openEdit(tab, site) {
  await signIn(tab, site, "poster", 1366);
  await tab.goto(site.url + "/" + EDIT);
  await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden && !!document.querySelector('#jtitle').value && document.querySelectorAll('#linksList .link-row').length > 0", 10000); await sleep(700);
  await tab.eval("window.confirm = () => true;");
}
const day = 86400000;
// the rows of the layout: a remote opening with a typed place and a long extended-closes line, a paused one with a long title, a closed one, a draft with a publish-by line, a scheduled draft, an expired live one and an expired DRAFT with the note
const MIX = () => ({
  plan: "verified",
  mineOverrides: [
    { title: "Associate Product Manager", is_remote: true, locations: [], location_ids: [], source_location_text: "Paris, France", bump_used: true, bump_days: 15 },
    { title: "Nurse Practitioner Specialist, Evenings and Weekends" },
    {}, {}, {},
  ],
  mineExtra: [
    { title: "Closed Opening", status: "closed", stored_status: "closed", closed_reason: "filled", expiration_date: new Date(Date.now() + 5 * day).toISOString() },
    { title: "Expired Draft Opening", status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: new Date(Date.now() - 3 * day).toISOString() },
  ],
});
// what the table looks like right now
const MEASURE = `(() => {
  const card = document.querySelector('.card.flush'), cr = card.getBoundingClientRect();
  const ths = Array.from(document.querySelectorAll('thead th')).map((t) => ({ name: t.textContent.trim().replace(/\\s+/g, ' '), w: Math.round(t.getBoundingClientRect().width) }));
  const tops = (els) => Array.from(new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))));
  const rows = Array.from(document.querySelectorAll('tbody tr')).map((tr) => {
    const c = (l) => tr.querySelector('td[data-label="' + l + '"]');
    const words = Array.from(c('Actions').children).filter((e) => e.classList.contains('row-action')).map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), left: r.left, right: r.right, top: Math.round(r.top), h: Math.round(r.height), lines: e.getClientRects().length }; });
    const bits = (l) => !c(l) ? [] : Array.from(c(l).querySelectorAll('.nb')).map((e) => ({ t: e.textContent.trim(), top: Math.round(e.getBoundingClientRect().top), lines: e.getClientRects().length }));
    const note = c('Actions').querySelector('.act-note'), nr = note ? note.getBoundingClientRect() : null, link = note ? note.querySelector('a') : null;
    return { title: tr.querySelector('td').firstChild.textContent.trim(), h: Math.round(tr.getBoundingClientRect().height), words, closes: bits('Closes'), added: bits('Added'), cellLeft: c('Actions').getBoundingClientRect().left,
      note: nr ? { w: Math.round(nr.width), h: Math.round(nr.height), text: note.innerText.replace(/\\s+/g, ' ').trim(), href: link ? link.getAttribute('href') : null, linkText: link ? link.textContent.trim() : null } : null };
  });
  return { viewport: window.innerWidth, cardW: Math.round(cr.width), cardRight: Math.round(cr.right), sideScroll: card.scrollWidth > card.clientWidth + 1, pageScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, ths, rows,
    lastTh: Math.round(document.querySelector('thead th:last-child').getBoundingClientRect().right) };
})()`;
const TITLE_MIN = 176;
const oneLine = (parts) => new Set(parts.map((p) => p.top)).size <= 1 && parts.every((p) => p.lines === 1);

const SCENARIOS = {
  // ---- the table at John's window
  async tidy1366(root) { return withSite(root, MIX(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, 1366);
    const m = await tab.eval(MEASURE);
    if (m.sideScroll) bad.push("a sideways scroll bar shows at 1366");
    if (m.pageScroll || m.lastTh > m.cardRight + 1) bad.push("a column runs past the card at 1366");
    const title = m.ths.find((t) => t.name === "Title");
    if (!title || title.w < TITLE_MIN) bad.push("the Title column is " + (title && title.w) + " pixels (at least " + TITLE_MIN + ")");
    const apm = m.rows.find((r) => r.title === "Associate Product Manager"), exp = m.rows.find((r) => r.title === "Expired Draft Opening");
    if (!apm || apm.h > 78) bad.push("the Associate Product Manager row is " + (apm && apm.h) + " pixels high (78 at most)");
    if (!exp || exp.h > 120) bad.push("the expired draft row is " + (exp && exp.h) + " pixels high (about 120 at most)");
    // prompt BP: every row carries the Added line under its title, so a one-line row is about 70 pixels (it was 62): the limit for the others is 90 (a two-line title, the place and the Added line)
    for (const r of m.rows) if (!/^Expired Draft/.test(r.title) && r.h > 90) bad.push("'" + r.title + "' is " + r.h + " pixels high (90 at most)");
    for (const r of m.rows) {
      if (r.words.length > 0 && !oneLine(r.words)) bad.push("'" + r.title + "': the action words are not on one line at 1366: " + JSON.stringify(r.words.map((w) => [w.t, w.top])));
      for (let i = 1; i < r.words.length; i++) { const gap = Math.round(r.words[i].left - r.words[i - 1].right); if (gap < 13 || gap > 15) bad.push("'" + r.title + "': the gap between '" + r.words[i - 1].t + "' and '" + r.words[i].t + "' is " + gap + " pixels (even, 14)"); }
      if (r.closes.length && !oneLine(r.closes)) bad.push("'" + r.title + "': the Closes value is not on one line at 1366: " + JSON.stringify(r.closes));
      if (r.added.length && !oneLine(r.added)) bad.push("'" + r.title + "': the Added value is not on one line at 1366: " + JSON.stringify(r.added));
    }
    const allWords = m.rows.flatMap((r) => r.words.map((w) => w.t));
    for (const w of ["Edit", "Pause", "Resume", "Publish", "Close", "Remove schedule"]) if (!allWords.includes(w)) bad.push("the test rows carry no '" + w + "' action");
    if (!m.rows.some((r) => r.closes.some((c) => /^Goes live/.test(c.t)))) bad.push("the test rows carry no 'Goes live' value");
    if (!m.rows.some((r) => r.closes.some((c) => /^Publish by/.test(c.t)))) bad.push("the test rows carry no 'Publish by' value");
    // the expired-draft note: about 36 characters wide (three or four lines), its words unchanged, its link still a link to Add an opening
    if (!exp || !exp.note) bad.push("the expired draft's note is not on the page");
    else {
      if (exp.note.w < 250 || exp.note.w > 330) bad.push("the note is " + exp.note.w + " pixels wide (about 36 characters: 250 to 330)");
      if (exp.note.h > 70) bad.push("the note is " + exp.note.h + " pixels high (three or four lines)");
      if (exp.note.text !== NOTE_WORDS) bad.push("the note's words changed: '" + exp.note.text + "'");
      if (exp.note.href !== "register.html" || exp.note.linkText !== "add it again") bad.push("the note's link is '" + exp.note.linkText + "' to '" + exp.note.href + "'");
    }
    return bad; })); },
  // the windows a little narrower than 1366 (1349 is a 1366 screen with a scroll bar; 1320 is the narrowest window that still shows every value on one line)
  async tidyWide(root) { return withSite(root, MIX(), (site) => withTab(async (tab) => { const bad = [];
    for (const width of [1349, 1320]) {
      await openDash(tab, site, width);
      const m = await tab.eval(MEASURE);
      if (m.sideScroll || m.pageScroll || m.lastTh > m.cardRight + 1) bad.push(width + ": a sideways scroll bar shows or a column runs past the card");
      const title = m.ths.find((t) => t.name === "Title");
      if (!title || title.w < TITLE_MIN) bad.push(width + ": the Title column is " + (title && title.w) + " pixels");
      const apm = m.rows.find((r) => r.title === "Associate Product Manager");
      if (!apm || apm.h > 78) bad.push(width + ": the Associate Product Manager row is " + (apm && apm.h) + " pixels high (78 at most)");
      if (width === 1349) for (const r of m.rows) if (!/^Expired Draft/.test(r.title) && r.h > 90) bad.push("1349: '" + r.title + "' is " + r.h + " pixels high (90 at most)");
      for (const r of m.rows) {
        if (r.words.length > 0 && !oneLine(r.words)) bad.push(width + ": '" + r.title + "': the action words are not on one line");
        if (r.closes.length && !oneLine(r.closes)) bad.push(width + ": '" + r.title + "': the Closes value is not on one line");
        if (r.added.length && !oneLine(r.added)) bad.push(width + ": '" + r.title + "': the Added value is not on one line");
      }
    }
    return bad; })); },
  async tidyNarrow(root) { return withSite(root, MIX(), (site) => withTab(async (tab) => { const bad = [];
    let wrapped = 0, brokenDates = 0;
    // prompt BP: at 1100 the reworked table keeps every value on one line (fewer columns), so the wrapping is exercised at 1000 and 768 (it was 1100 and 768)
    for (const width of [1100, 1000, 768]) {
      await openDash(tab, site, width);
      const m = await tab.eval(MEASURE);
      if (width === 1100 && m.sideScroll) bad.push("a sideways scroll bar shows at 1100");
      if (m.pageScroll || (!m.sideScroll && m.lastTh > m.cardRight + 1)) bad.push(width + ": the page scrolls sideways or a column runs past the card");
      const title = m.ths.find((t) => t.name === "Title");
      if (!title || title.w < TITLE_MIN) bad.push(width + ": the Title column is " + (title && title.w) + " pixels");
      const apm = m.rows.find((r) => r.title === "Associate Product Manager");
      if (width === 1100 && (!apm || apm.h > 90)) bad.push("1100: the Associate Product Manager row is " + (apm && apm.h) + " pixels high (90 at most: a two-line title, the place and the Added line)");      // prompt BP: was 80 before the Added line
      for (const r of m.rows) {
        // a word never splits; a word that wraps starts at the same left edge as the first word (no indent)
        for (const w of r.words) if (w.lines > 1 || w.h > 24) bad.push(width + ": '" + r.title + "': the word '" + w.t + "' is split over lines");
        const firstLeft = r.words.length ? Math.min(...r.words.map((w) => w.left)) : null, firstTop = r.words.length ? Math.min(...r.words.map((w) => w.top)) : null;
        for (const top of new Set(r.words.map((w) => w.top))) {          // the leftmost word of every later line starts at the first word's left edge
          if (top <= firstTop + 2) continue;
          wrapped++;
          const start = r.words.filter((w) => w.top === top).sort((a, b) => a.left - b.left)[0];
          if (Math.abs(start.left - firstLeft) > 1) bad.push(width + ": '" + r.title + "': the wrapped line starts with '" + start.t + "' indented by " + Math.round(start.left - firstLeft) + " pixels");
        }
        // a date and its time never break in the middle: every piece is one line, and a line breaks only between pieces
        for (const p of [...r.closes, ...r.added]) if (p.lines !== 1) bad.push(width + ": '" + r.title + "': '" + p.t + "' is broken over lines");
        if (new Set(r.closes.map((c) => c.top)).size > 1) brokenDates++;
      }
    }
    if (wrapped === 0) bad.push("no row wrapped its action words at 1100, 1000 or 768, so the test did not exercise the wrapping");
    if (brokenDates === 0) bad.push("no Closes value wrapped at 1100, 1000 or 768, so the test did not exercise the date and time break");
    return bad; })); },
  async phoneUnchanged(root) { return withSite(root, MIX(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, 390, true);
    const r = await tab.eval(`(() => {
      const a = document.querySelector('td[data-label="Actions"] .row-action'), nb = document.querySelector('.my-openings .nb'), cell = a.closest('td'), tr = cell.closest('tr');
      const dt = document.querySelector('td[data-label="Closes"] .dt'), dc = dt.closest('td'), dr = dt.getBoundingClientRect(), cr = dc.getBoundingClientRect();
      return { ml: getComputedStyle(a).marginLeft, mr: getComputedStyle(a).marginRight, ws: getComputedStyle(nb).whiteSpace, cellPad: getComputedStyle(cell).paddingLeft, disp: getComputedStyle(cell).display, pageScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        trDisp: getComputedStyle(tr).display, dtTop: Math.round(dr.top - cr.top), dtLeft: Math.round(dr.left - cr.left), items: Array.from(dc.children).filter((e) => !e.classList.contains('row-note')).length };
    })()`);
    // the value is ONE grid item beside its label (a phone's cell is a grid: pieces that were separate items would land under the label)
    if (r.items !== 1 || r.dtLeft < 100 || r.dtTop > 12) bad.push("the phone card's Closes value moved: " + JSON.stringify({ items: r.items, left: r.dtLeft, top: r.dtTop }));
    if (r.ml !== "0px" || r.mr !== "14px") bad.push("the phone card's action words have margins " + r.ml + " / " + r.mr + " (0 / 14 as before)");
    if (r.ws !== "normal") bad.push("the phone card's dates are no-wrap (" + r.ws + ")");
    if (r.disp !== "flex" || r.pageScroll) bad.push("the phone card list changed: " + JSON.stringify(r));
    return bad; })); },
  // ---- an empty place on the employer's two screens; a candidate keeps the words
  async emptyPlaceEmployer(root) { return withSite(root, {
      plan: "verified", postingNoPlace: true,
      mineOverrides: [
        { title: "Nothing set at all", is_remote: false, locations: [], location_ids: [], source_location_text: null },
        { title: "Remote and no place", is_remote: true, locations: [], location_ids: [], source_location_text: null },
        { title: "List place only", is_remote: false, locations: ["Austin, TX"], location_ids: [], source_location_text: null },
        { title: "Typed place only", is_remote: false, locations: [], location_ids: [], source_location_text: "Lisbon, Portugal" },
        { title: "Remote and typed place", is_remote: true, locations: [], location_ids: [], source_location_text: "Paris, France" },
      ] }, (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, 1366);
    // prompt BP: the title cell also carries the Added line, so the place line is read by its own marker (data-part="place")
    const cells = await tab.eval("(() => { const o = {}; for (const tr of document.querySelectorAll('tbody tr')) { const td = tr.querySelector('td'); const p = td.querySelector('[data-part=\"place\"]'); o[td.firstChild.textContent.trim()] = { place: p ? p.innerText.replace(/\\s+/g, ' ').trim() : null, text: td.innerText.replace(/\\s+/g, ' ').trim() }; } return o; })()");
    const WANT = { "Nothing set at all": null, "Remote and no place": "Remote", "List place only": "Austin, TX", "Typed place only": "Lisbon, Portugal", "Remote and typed place": "Remote · Paris, France" };
    for (const [title, want] of Object.entries(WANT)) if (!cells[title] || cells[title].place !== want) bad.push("My openings, '" + title + "': the place line is " + JSON.stringify(cells[title] && cells[title].place) + ", expected " + JSON.stringify(want));
    if (cells["Nothing set at all"] && /Location not stated/.test(cells["Nothing set at all"].text)) bad.push("My openings shows '" + NOT_STATED + "' for the opening with nothing set");
    if (await tab.eval("document.body.innerText.includes(" + q(NOT_STATED) + ")")) bad.push("My openings shows '" + NOT_STATED + "'");
    // the editor: nothing set (the fake opening has no place and no Remote), then Remote with no place
    await tab.goto(site.url + "/" + EDIT);
    await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden && !!document.querySelector('#jtitle').value", 10000); await sleep(700);
    if (!(await tab.eval("document.querySelector('#placeLine').hidden"))) bad.push("the editor shows a place line for an opening with nothing set: '" + (await text(tab, "#placeLine")) + "'");
    if (await tab.eval("document.body.innerText.includes('Place:') && document.querySelector('#placeLine').innerText.trim() !== ''")) bad.push("the editor shows a 'Place:' label with nothing after it");
    if (await tab.eval("document.body.innerText.includes(" + q(NOT_STATED) + ")")) bad.push("the editor shows '" + NOT_STATED + "'");
    return bad; })); },
  async remoteNoPlaceEditor(root) { return withSite(root, { plan: "verified", postingRemote: true, postingNoPlace: true }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    if ((await text(tab, "#placeLine")) !== "Place: Remote") bad.push("remote and no place: the editor reads '" + (await text(tab, "#placeLine")) + "'");
    return bad; })); },
  async candidateKeepsWords(root) { return withSite(root, {
      placeOverrides: [{ locations: [], is_remote: false, source_location_text: null }],
      detailOverride: { locations: [], is_remote: false, source_location_text: null } }, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site, "candidate", 1366);
    await tab.goto(site.url + "/search.html"); await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(800);
    await tab.eval("(() => { document.querySelector('#company').value = 'Meridian'; document.querySelector('#titleq').value = 'Analyst'; document.querySelector('#searchForm').requestSubmit(); })()");
    await tab.waitFor("document.querySelectorAll('#results .card').length > 0 && !document.querySelector('#searchBtn').disabled", 12000); await sleep(500);
    const meta = await tab.eval("(() => { const c = document.querySelector('#results .card'); const m = c.querySelector('.res-head > div > div:nth-child(3)'); return m ? m.innerText.replace(/\\s+/g, ' ').trim() : ''; })()");
    if (!meta.startsWith(NOT_STATED)) bad.push("the candidate card reads '" + meta + "' (it keeps '" + NOT_STATED + "')");
    await tab.eval("document.querySelectorAll('#results .view-details')[0].click()");
    await tab.waitFor("document.querySelector('#modalBackdrop').classList.contains('open')", 8000); await sleep(500);
    const win = await text(tab, "#modalPlace");
    if (win !== NOT_STATED) bad.push("the details window reads '" + win + "' (it keeps '" + NOT_STATED + "')");
    return bad; })); },
  // ---- the destination links sentence: shown only while it is true
  async johnsSequence(root) { return withSite(root, { plan: "verified", applyLinks: [{ label: "Careers site" }, { label: null }] }, (site) => withTab(async (tab) => { const bad = [];
    const ROWBTN = '#linksList .link-row[data-position="1"] .link-row-actions button', FORMBTN = '#linksList .link-row[data-position="1"] form button', ADDR = '#linksList .link-row[data-position="1"] form input';
    const JUNK = "https://junk.example/typed-junk-address";
    const sentence = async () => (await tab.eval("document.querySelector('#formAlert').hidden")) ? "" : await text(tab, "#formAlert");
    await openEdit(tab, site);
    // the replace form of Link 1: junk typed, the bottom button, the sentence; Cancel in the link form; the sentence is gone
    await clickText(tab, ROWBTN, "Edit"); await sleep(150); await typeIn(tab, ADDR, JUNK); await sleep(150);
    await click(tab, "#saveBtn"); await sleep(250);
    if ((await sentence()) !== ONE_SENTENCE) bad.push("with a link not saved the bottom button says '" + (await sentence()) + "'");
    await clickText(tab, FORMBTN, "Cancel"); await sleep(250);
    if ((await sentence()) !== "") bad.push("the sentence is still there after Cancel in the link form: '" + (await sentence()) + "'");
    if ((await tab.eval("(() => { const i = document.querySelector(" + q(ADDR) + "); return i ? i.value : ''; })()")) !== "") bad.push("the cancelled address is still held in its box");
    // then a main form change: the box appears and the sentence is not there
    await click(tab, "#aiInterviewToggle"); await sleep(250);
    if (!(await exists(tab, "#note"))) bad.push("no note box after the main form change");
    if ((await sentence()) !== "") bad.push("the sentence came back or stayed after a main form change: '" + (await sentence()) + "'");
    // John's own order: sentence, Discard in the bar, a main form change
    await tab.goto(site.url + "/" + EDIT);
    await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden && !!document.querySelector('#jtitle').value && document.querySelectorAll('#linksList .link-row').length > 0", 10000); await sleep(600);
    await tab.eval("window.confirm = () => true;");
    await clickText(tab, ROWBTN, "Edit"); await sleep(150); await typeIn(tab, ADDR, JUNK); await sleep(150);
    await click(tab, "#saveBtn"); await sleep(250);
    if ((await sentence()) !== ONE_SENTENCE) bad.push("(second run) the bottom button says '" + (await sentence()) + "'");
    await click(tab, "#unsavedDiscard"); await sleep(400);
    await click(tab, "#aiInterviewToggle"); await sleep(250);
    if ((await sentence()) !== "") bad.push("after Discard and a main form change the sentence reads '" + (await sentence()) + "'");
    // the junk was never sent anywhere
    if (JSON.stringify(site.calls).includes("junk.example")) bad.push("the cancelled address was sent in a request");
    if (site.calls.some((c) => c.name === "set-destination-links")) bad.push("a link save was sent");
    return bad; })); },
  async linkReallyUnsaved(root) { return withSite(root, { plan: "verified", applyLinks: [{ label: "Careers site" }, { label: null }] }, (site) => withTab(async (tab) => { const bad = [];
    const ROWBTN = '#linksList .link-row[data-position="1"] .link-row-actions button', ADDR = '#linksList .link-row[data-position="1"] form input';
    const sentence = async () => (await tab.eval("document.querySelector('#formAlert').hidden")) ? "" : await text(tab, "#formAlert");
    await openEdit(tab, site);
    await clickText(tab, ROWBTN, "Edit"); await sleep(150); await typeIn(tab, ADDR, "https://junk.example/typed-junk-address"); await sleep(150);
    await click(tab, "#saveBtn"); await sleep(250);
    if ((await sentence()) !== ONE_SENTENCE) bad.push("the sentence is not shown for a link that is truly not saved: '" + (await sentence()) + "'");
    // a main form change while the link is still not saved: the sentence stays (it is still true), and the bottom button holds again
    await click(tab, "#aiInterviewToggle"); await sleep(250);
    if ((await sentence()) !== ONE_SENTENCE) bad.push("the sentence went while the link is still not saved: '" + (await sentence()) + "'");
    await click(tab, "#saveBtn"); await sleep(300);
    if ((await sentence()) !== ONE_SENTENCE) bad.push("the bottom button did not show the sentence again: '" + (await sentence()) + "'");
    if (site.calls.some((c) => c.name === "edit-posting")) bad.push("the main form was saved while a link section held something not saved");
    // the policy link box is typed in too: the sentence names both sections, then only the one that is left
    await typeIn(tab, "#policyUrl", "https://example.com/ai-policy"); await sleep(250);
    if (!/^These sections have something that is not saved: AI and hiring policy link and destination links\./.test(await sentence())) bad.push("with two sections not saved the sentence reads '" + (await sentence()) + "'");
    await typeIn(tab, ADDR, ""); await sleep(250);
    if (!/^The AI and hiring policy link section has something that is not saved\./.test(await sentence())) bad.push("with one section left the sentence reads '" + (await sentence()) + "'");
    await typeIn(tab, "#policyUrl", ""); await sleep(250);
    if ((await sentence()) !== "") bad.push("with nothing left the sentence reads '" + (await sentence()) + "'");
    return bad; })); },
  async otherMessagesStay(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await tab.eval("document.querySelector('#aiInterviewToggle').click()"); await sleep(150);
    await typeIn(tab, "#note", "Turned the switch on"); await click(tab, "#saveBtn"); await sleep(1000);
    if ((await text(tab, "#formAlert")) !== "Saved. 1 field was changed.") bad.push("the saved message reads '" + (await text(tab, "#formAlert")) + "'");
    // it stays while nothing else happens (it is a statement of what just happened, not a condition): a key press or a click that changes nothing does not take it away...
    await tab.eval("document.body.dispatchEvent(new Event('keyup', { bubbles: true })); document.body.dispatchEvent(new Event('click', { bubbles: true }))");
    await sleep(500);
    if ((await text(tab, "#formAlert")) !== "Saved. 1 field was changed.") bad.push("the saved message went by itself: '" + (await text(tab, "#formAlert")) + "'");
    // ...and, prompt BR (October 12, 2026, John's decision), it goes the moment the NEXT change begins (BN had kept it until the next save)
    await typeIn(tab, "#jtitle", "Data Analyst II"); await sleep(250);
    if ((await text(tab, "#formAlert")) !== "") bad.push("the saved message stayed when the next change began: '" + (await text(tab, "#formAlert")) + "'");
    return bad; })); },
};

for (const [name, run] of Object.entries(SCENARIOS)) {
  test("prompt BN, " + name, { timeout: 240000 }, async () => {
    const bad = await run(ROOT);
    assert.deepEqual(bad, [], bad.join("\n"));
  });
}

// ---- negative controls: one defect at a time; each must make a scenario fail
const CSS_ACTION_MARGIN = '  .my-openings td[data-label="Actions"] .row-action{margin:0 14px 0 0}\n  .my-openings td[data-label="Actions"] .row-action:last-child{margin-right:0}\n';
const DEFECTS = [
  ["the action words keep a left margin each (a wrapped word is indented)", [["app.css", (s) => s.replace(CSS_ACTION_MARGIN, "")]], ["tidyNarrow"]],
  ["the action words may split inside a word", [["app.css", (s) => s.replace('  .my-openings td[data-label="Actions"] .row-action{white-space:nowrap}\n', "")]], ["tidyNarrow"]],
  ["a date and its time may break in the middle", [["app.css", (s) => s.replace("  .my-openings .nb{white-space:nowrap}\n", "")]], ["tidyNarrow"]],
  ["the dates are plain text again (no pieces)", [["js/pages/dashboard.js", (s) => s.replace('h("td", { role: "cell", "data-label": "Closes", style: "color:var(--muted);" }, dateBits(closesCell(p))', 'h("td", { role: "cell", "data-label": "Closes", style: "color:var(--muted);" }, closesCell(p)')]], ["tidyNarrow"]],
  ["the wide window rule is gone (the columns share the width in proportion)", [["app.css", (s) => s.replace("{width:1%;white-space:nowrap}", "{}")]], ["tidy1366", "tidyWide"]],
  ["the expired-draft note has no width of its own", [["app.css", (s) => s.replace("  .my-openings .act-note{min-width:36ch}", "")]], ["tidy1366"]],
  // prompt BP: the control "the side padding is back at 12 pixels" moved to my-openings-bp.test.js (at1100), where the one-line layout at 1100 depends on it
  ["the date pieces sit straight in the cell (a phone card's grid takes each as an item)", [["js/pages/dashboard.js", (s) => s.replace('return h("span", { class: "dt" }, ...out);', "return out;")]], ["phoneUnchanged"]],
  ["the phone card list is changed by the table rules", [["app.css", (s) => s.replace("  .my-openings .nb{white-space:nowrap}\n", "").replace("@media (min-width:641px){\n  .my-openings thead th,.my-openings td{padding-left:8px", "@media (min-width:0px){\n  .my-openings .nb{white-space:nowrap}\n  .my-openings thead th,.my-openings td{padding-left:8px")]], ["phoneUnchanged"]],
  ["My openings says Location not stated for an opening with nothing set", [["js/pages/dashboard.js", (s) => s.replace("placeNodes(h, p, { note: false, hideNone: true })", "placeNodes(h, p, { note: false })")]], ["emptyPlaceEmployer"]],
  ["the editor says Place: Location not stated", [["js/pages/edit.js", (s) => s.replace("placeNodes(h, p, { note: false, hideNone: true })", "placeNodes(h, p, { note: false })")]], ["emptyPlaceEmployer"]],
  ["the editor keeps the Place: label with nothing after it", [["js/pages/edit.js", (s) => s.replace("pl.hidden = placeKids.length === 0;\n  if (placeKids.length > 0) pl.append(\"Place: \", ...placeKids);", "pl.hidden = false; pl.append(\"Place: \", ...placeKids);")]], ["emptyPlaceEmployer"]],
  ["the place rule hides Remote with no place", [["js/place.js", (s) => s.replace("if (!p.stated && opts && opts.hideNone === true) return [];", "if (opts && opts.hideNone === true) return [];")]], ["emptyPlaceEmployer", "remoteNoPlaceEditor"]],
  ["a candidate screen leaves the words out too", [["js/place.js", (s) => s.replace("if (!p.stated && opts && opts.hideNone === true) return [];", "if (!p.stated) return [];")]], ["candidateKeepsWords"]],
  ["the sentence is never taken away", [["js/pages/edit.js", (s) => s.replace("  syncLiveSentence();\n  syncActions();", "  syncActions();")]], ["johnsSequence", "linkReallyUnsaved"]],
  ["the sentence is taken away whatever the sections hold", [["js/pages/edit.js", (s) => s.replace("  if (text === \"\") { say(formAlert, \"error\", \"\"); return; }", "  { say(formAlert, \"error\", \"\"); return; }")]], ["linkReallyUnsaved"]],
  ["the sentence is never re-worded when the sections change", [["js/pages/edit.js", (s) => s.replace("  if (text !== formAlert.textContent.trim()) { say(formAlert, \"notice\", text); formAlert.setAttribute(\"data-live-sentence\", \"panels\"); }\n", "")]], ["linkReallyUnsaved"]],
  ["every message is taken away when nothing is unsaved", [["js/pages/edit.js", (s) => s.replace("  if (formAlert.getAttribute(\"data-live-sentence\") !== \"panels\") return;\n", "")]], ["otherMessagesStay"]],
];
test("negative controls: each defect makes a scenario fail", { timeout: 3600000 }, async () => {
  const missed = [];
  const only = process.env.FGJ_BN_ONLY;          // a part of a defect's label: runs only those (a restricted run is never evidence for a push)
  for (const [label, edits, scenarios] of DEFECTS) {
    if (only && !label.includes(only)) continue;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-bn-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) {
        const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8").replace(/\?v=[0-9a-f]{8}(?=["'])/g, ""), a0 = mutate(b0);
        assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel);
        fs.writeFileSync(p, a0);
      }
      const found = [];
      for (const n of scenarios) {
        try { for (const p of await SCENARIOS[n](dir)) found.push(n + ": " + p); } catch (e) { found.push(n + ": the scenario could not finish: " + String(e.message).slice(0, 100)); }
      }
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 150) + ")");
      if (only) console.log(found.length + " finding(s)" + (found.length === 0 ? "" : ": " + found.join(" | ").slice(0, 600)));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
