// my-openings.test.js - prompt BL (October 11, 2026), in a real browser: the My openings table fits its card (no sideways scroll at 1366 pixels, uses the window width up to the page's cap, a readable Title column,
// an Actions column that is no wider than its cap even when a row carries the long expired-draft note) and an employer never sees "as provided by the employer" (My openings, the opening editor) while every
// screen a candidate sees keeps it. The repo's own files and a fake backend (tests/fake-site.js; no real project, no key).
// Then negative controls: one defect at a time in the page code or the style; each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/my-openings.test.js
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
const NOTE = "as provided by the employer";
const EDIT = "edit.html?id=3f1d5b1e-0000-4000-8000-000000000001";
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

async function withSite(root, opts, fn) { const site = await startFakeSite(root, opts); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }
const q = JSON.stringify;
const text = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; })()");
async function signIn(tab, site, kind, width, phone) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=" + kind); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.viewport(width || 1366, !!phone, phone ? 800 : 900);
}
async function openDash(tab, site, width, phone) {
  await signIn(tab, site, "poster", width, phone);
  await tab.goto(site.url + "/dashboard.html");
  await tab.waitFor("document.querySelectorAll('tbody tr').length > 0", 10000); await sleep(700);
}
const day = 86400000;
// a mix of rows: a live opening with a long place line, a paused one, a closed one, a draft, a scheduled draft, an expired live one, and an expired DRAFT with the long note
const MIX = () => ({
  plan: "verified",
  mineOverrides: [
    { title: "Associate Product Manager", is_remote: true, locations: [], location_ids: [], source_location_text: "Paris, France" },
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
  const card = document.querySelector('.card.flush'), table = document.querySelector('table.dash-table'), cr = card.getBoundingClientRect();
  const ths = Array.from(document.querySelectorAll('thead th')).map((t) => ({ name: t.textContent.trim().replace(/\\s+/g, ' '), w: Math.round(t.getBoundingClientRect().width), right: Math.round(t.getBoundingClientRect().right) }));
  const apm = Array.from(document.querySelectorAll('tbody tr')).find((r) => /Associate Product Manager/.test(r.textContent));
  const acts = Array.from(document.querySelectorAll('tbody td[data-label="Actions"]')).map((c) => Math.round(c.getBoundingClientRect().width));
  const note = document.querySelector('.act-note'), nr = note ? note.getBoundingClientRect() : null;
  const cells = Array.from(document.querySelectorAll('tbody td')).map((c) => Math.round(c.getBoundingClientRect().right));
  return { viewport: window.innerWidth, cardW: Math.round(cr.width), cardRight: Math.round(cr.right), tableW: Math.round(table.getBoundingClientRect().width), sideScroll: card.scrollWidth > card.clientWidth + 1,
    pageScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, ths, apmH: apm ? Math.round(apm.getBoundingClientRect().height) : null, acts,
    note: nr ? { w: Math.round(nr.width), h: Math.round(nr.height) } : null, maxCellRight: Math.max(...cells), lastTh: ths.length ? ths[ths.length - 1].right : null };
})()`;
const TITLE_MIN = 176, ACTIONS_CAP = 260;

const SCENARIOS = {
  // ---- the layout
  async layout1366(root) { return withSite(root, MIX(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, 1366);
    const m = await tab.eval(MEASURE);
    if (m.sideScroll) bad.push("a sideways scroll bar shows at 1366 (table " + m.tableW + " in a card of " + m.cardW + ")");
    if (m.lastTh > m.cardRight + 1 || m.maxCellRight > m.cardRight + 1) bad.push("a column runs past the edge of the card: " + JSON.stringify({ lastTh: m.lastTh, cardRight: m.cardRight, maxCell: m.maxCellRight }));
    const title = m.ths.find((t) => t.name === "Title");
    if (!title || title.w < TITLE_MIN) bad.push("the Title column is " + (title && title.w) + " pixels (at least " + TITLE_MIN + ")");
    if (Math.max(...m.acts) > ACTIONS_CAP) bad.push("the Actions column is " + Math.max(...m.acts) + " pixels (at most " + ACTIONS_CAP + "): " + JSON.stringify(m.acts));
    if (!m.note) bad.push("the expired draft's note is not on the page");
    else {
      if (m.note.w > 240) bad.push("the note is " + m.note.w + " pixels wide (it wraps at a fixed width)");
      if (m.note.h < 30) bad.push("the note did not wrap (" + m.note.h + " pixels high)");
    }
    if (m.apmH > 110) bad.push("the row with the long place line is " + m.apmH + " pixels high (a few lines at most)");
    const noteText = await text(tab, ".act-note");
    if (noteText !== "Publish window ended: a draft can be published for 14 days after it was saved. To use it, add it again as a new opening.") bad.push("the note's words changed: '" + noteText + "'");
    return bad; })); },
  async layoutNarrow(root) { return withSite(root, MIX(), (site) => withTab(async (tab) => { const bad = [];
    for (const w of [1100, 768]) {
      await openDash(tab, site, w);
      const m = await tab.eval(MEASURE);
      const title = m.ths.find((t) => t.name === "Title");
      if (!title || title.w < TITLE_MIN) bad.push(w + ": the Title column is " + (title && title.w) + " pixels");
      if (Math.max(...m.acts) > ACTIONS_CAP) bad.push(w + ": the Actions column is " + Math.max(...m.acts) + " pixels");
      if (!m.sideScroll && (m.lastTh > m.cardRight + 1)) bad.push(w + ": a column is cut off without a scroll bar");
      if (m.pageScroll) bad.push(w + ": the whole page scrolls sideways");
      if (m.apmH > 140) bad.push(w + ": the row with the long place line is " + m.apmH + " pixels high");
      if (w === 1100 && m.sideScroll) bad.push("1100: a sideways scroll bar shows although the columns fit (table " + m.tableW + " in " + m.cardW + ")");
    }
    return bad; })); },
  async layoutPhone(root) { return withSite(root, MIX(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, 390, true);
    const m = await tab.eval(MEASURE);
    if (m.pageScroll) bad.push("390: the page scrolls sideways");
    if (m.maxCellRight > m.cardRight + 1) bad.push("390: a cell runs past the card (" + m.maxCellRight + " > " + m.cardRight + ")");
    if (m.apmH > 380) bad.push("390: the row is " + m.apmH + " pixels high (it was 375 before this prompt)");
    return bad; })); },
  async layoutZoomedOut(root) { return withSite(root, MIX(), (site) => withTab(async (tab) => { const bad = [];
    // zooming out makes the window wider in page pixels: the card follows it (it used to stop at 1376 and leave empty page on both sides)
    await openDash(tab, site, 1700);
    const a = await tab.eval(MEASURE);
    if (a.cardW < 1500) bad.push("at 1700 the card is only " + a.cardW + " pixels wide (it must follow the window)");
    if (a.sideScroll) bad.push("at 1700 a sideways scroll bar shows");
    await tab.viewport(2400, false, 900); await tab.goto(site.url + "/dashboard.html"); await tab.waitFor("document.querySelectorAll('tbody tr').length > 0", 10000); await sleep(600);
    const b = await tab.eval(MEASURE);
    if (b.cardW > 1740) bad.push("at 2400 the card is " + b.cardW + " pixels wide (the page's cap is 1800 with 32 pixel sides)");
    return bad; })); },
  // ---- the other pages that share the table style do not move
  async teamUnchanged(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site, "poster", 1366);
    await tab.goto(site.url + "/team.html"); await tab.waitFor("document.querySelectorAll('tbody tr').length > 0", 10000); await sleep(600);
    const r = await tab.eval("(() => { const t = document.querySelector('table.dash-table'); const p = document.querySelector('.pg'); return { my: t.classList.contains('my-openings'), pgMax: getComputedStyle(p).maxWidth }; })()");
    if (r.my) bad.push("the Team table carries the My openings class");
    if (r.pgMax !== "1100px") bad.push("the Team page's width cap changed: " + r.pgMax + " (it is 1100 pixels in team.html)");
    return bad; })); },
  // ---- the place line: an employer never sees the note; a candidate always does; an empty place looks right
  async placeEmployer(root) { return withSite(root, {
      plan: "verified", postingRemote: true, placeText: "Paris, France",
      mineOverrides: [
        { title: "Typed place and remote", is_remote: true, locations: [], location_ids: [], source_location_text: "Paris, France" },
        { title: "Remote and no place", is_remote: true, locations: [], location_ids: [], source_location_text: null },
        { title: "List place only", is_remote: false, locations: ["Austin, TX"], location_ids: [], source_location_text: null },
        { title: "Remote and list place", is_remote: true, locations: ["Boston, MA"], location_ids: [], source_location_text: null },
        { title: "Typed place only", is_remote: false, locations: [], location_ids: [], source_location_text: "Lisbon, Portugal" },
      ] }, (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, 1366);
    const lines = await tab.eval("(() => { const o = {}; for (const tr of document.querySelectorAll('tbody tr')) { const td = tr.querySelector('td'); const title = td.firstChild.textContent.trim(); const d = td.querySelector('div'); o[title] = d ? d.innerText.replace(/\\s+/g, ' ').trim() : ''; } return o; })()");
    const WANT = { "Typed place and remote": "Remote · Paris, France", "Remote and no place": "Remote", "List place only": "Austin, TX", "Remote and list place": "Remote · Boston, MA", "Typed place only": "Lisbon, Portugal" };
    for (const [title, want] of Object.entries(WANT)) if (lines[title] !== want) bad.push("My openings, '" + title + "': the place line is '" + lines[title] + "', expected '" + want + "'");
    for (const [title, line] of Object.entries(lines)) {
      if (line.includes(NOTE)) bad.push("My openings shows the note for '" + title + "'");
      if (/^[·,\-\s]|[·,\-\s]$|· ·|,\s*,/.test(line)) bad.push("My openings, '" + title + "': stray punctuation in '" + line + "'");
    }
    if ((await tab.eval("document.body.innerText.includes(" + q(NOTE) + ")"))) bad.push("My openings shows the note somewhere on the page");
    // the opening editor: typed place with remote
    await tab.goto(site.url + "/" + EDIT);
    await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden && !!document.querySelector('#jtitle').value", 10000); await sleep(700);
    const pl = await text(tab, "#placeLine");
    if (pl !== "Place: Remote · Paris, France") bad.push("the editor's place line is '" + pl + "'");
    if ((await tab.eval("document.body.innerText.includes(" + q(NOTE) + ")"))) bad.push("the editor shows the note somewhere on the page");
    return bad; })); },
  async placeEditorEmpty(root) { return withSite(root, { plan: "verified", postingRemote: true, postingNoPlace: true }, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site, "poster", 1366);
    await tab.goto(site.url + "/" + EDIT);
    await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden && !!document.querySelector('#jtitle').value", 10000); await sleep(700);
    const pl = await text(tab, "#placeLine");
    if (pl !== "Place: Remote") bad.push("remote and no place: the editor's place line is '" + pl + "'");
    return bad; })); },
  async placeCandidate(root) { return withSite(root, {
      placeOverrides: [{ locations: [], is_remote: true, source_location_text: "Paris, France" }, { locations: [], is_remote: true, source_location_text: null }],
      detailOverride: { locations: [], is_remote: true, source_location_text: "Paris, France" } }, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site, "candidate", 1366);
    await tab.goto(site.url + "/search.html"); await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(800);
    await tab.eval("(() => { document.querySelector('#company').value = 'Meridian'; document.querySelector('#titleq').value = 'Analyst'; document.querySelector('#searchForm').requestSubmit(); })()");
    await tab.waitFor("document.querySelectorAll('#results .card').length > 0 && !document.querySelector('#searchBtn').disabled", 12000); await sleep(500);
    const metas = await tab.eval("[...document.querySelectorAll('#results .card')].slice(0, 2).map((c) => { const m = c.querySelector('.res-head > div > div:nth-child(3)'); return m ? m.innerText.replace(/\\s+/g, ' ').trim() : ''; })");
    if (!metas[0] || !metas[0].startsWith("Remote · Paris, France " + NOTE)) bad.push("the candidate card reads '" + metas[0] + "'");
    if (!metas[1] || !/^Remote · Opening ID /.test(metas[1]) || metas[1].includes(NOTE)) bad.push("a remote opening with no place reads '" + metas[1] + "' on the candidate card");
    await tab.eval("document.querySelectorAll('#results .view-details')[0].click()");
    await tab.waitFor("document.querySelector('#modalBackdrop').classList.contains('open')", 8000); await sleep(500);
    const win = await text(tab, "#modalPlace");
    if (!win || !win.includes(NOTE) || !win.startsWith("Remote · Paris, France")) bad.push("the details window reads '" + win + "'");
    await tab.eval("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))"); await sleep(300);
    await tab.goto(site.url + "/comments.html?ref=d21m48ybzqbfxxxxxxxx");
    await tab.waitFor("!document.querySelector('#threadWrap').hidden || !document.querySelector('#pageAlert').hidden", 10000); await sleep(500);
    const meta = await text(tab, "#recapMeta");
    if (!meta || !meta.startsWith("Remote · Paris, France " + NOTE)) bad.push("the comments page reads '" + meta + "'");
    return bad; })); },
};

for (const [name, run] of Object.entries(SCENARIOS)) {
  test("prompt BL, " + name, { timeout: 240000 }, async () => {
    const bad = await run(ROOT);
    assert.deepEqual(bad, [], bad.join("\n"));
  });
}

// ---- negative controls: one defect at a time; each must make a scenario fail
const DEFECTS = [
  ["the card's width cap is back at 1440", [["dashboard.html", (s) => s.replace("max-width:1800px;margin:0 auto;padding:44px 32px;", "max-width:1440px;margin:0 auto;padding:44px 32px;")]], ["layoutZoomedOut"]],
  ["the page has no width cap at all", [["dashboard.html", (s) => s.replace("max-width:1800px;margin:0 auto;padding:44px 32px;", "margin:0 auto;padding:44px 32px;")]], ["layoutZoomedOut"]],
  ["the Actions cell is back to one line (nowrap)", [["js/pages/dashboard.js", (s) => s.replace('h("td", { role: "cell", "data-label": "Actions" }, actionCells(p, now))', 'h("td", { role: "cell", "data-label": "Actions", style: "white-space:nowrap;" }, actionCells(p, now))')]], ["layout1366", "layoutNarrow"]],
  ["the note is back to one line inline pieces", [["js/pages/dashboard.js", (s) => s.replace('h("div", { class: "row-note act-note" },', 'h("span", { class: "row-note", style: "white-space:nowrap;" },')]], ["layout1366"]],
  ["the note has no width cap", [["app.css", (s) => s.replace(".my-openings .act-note{max-width:24ch;white-space:normal;overflow-wrap:break-word}", ".my-openings .act-note{white-space:nowrap}")]], ["layout1366"]],
  ["the Title column has no minimum", [["app.css", (s) => s.replace(".my-openings thead th:first-child,.my-openings td[data-label=\"Title\"]{min-width:11rem}", "")]], ["layoutNarrow"]],
  ["the style is applied to every table (not scoped to My openings)", [["dashboard.html", (s) => s.replace('class="dash-table rtable my-openings"', 'class="dash-table rtable"')]], ["layout1366"]],
  ["My openings shows the note again", [["js/pages/dashboard.js", (s) => s.replace("placeNodes(h, p, { note: false })", "placeNodes(h, p)")]], ["placeEmployer"]],
  ["the editor shows the note again", [["js/pages/edit.js", (s) => s.replace("placeNodes(h, p, { note: false })", "placeNodes(h, p)")]], ["placeEmployer"]],
  ["no screen shows the note any more", [["js/place.js", (s) => s.replace("if (p.note && !(opts && opts.note === false)) out.push(", "if (false) out.push(")]], ["placeCandidate"]],
  ["the candidate card loses the note when the employer's option is off", [["js/place.js", (s) => s.replace("if (p.note && !(opts && opts.note === false)) out.push(", "if (p.note && false) out.push(")]], ["placeCandidate"]],
  ["a dash is left when there is no place", [["js/place.js", (s) => s.replace("return { text: (remote ? \"Remote · \" : \"\") + src, note: PLACE_NOTE };", "return { text: (remote ? \"Remote · \" : \"\") + src, note: PLACE_NOTE };").replace("if (src === \"\") return { text: locationLine(row ? row.is_remote : null, row ? row.locations : null), note: null };", "if (src === \"\") return { text: locationLine(row ? row.is_remote : null, row ? row.locations : null) + \" ·\", note: null };")]], ["placeEmployer", "placeEditorEmpty"]],
];
test("negative controls: each defect makes a scenario fail", { timeout: 3600000 }, async () => {
  const missed = [];
  for (const [label, edits, scenarios] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-bl-ctl-"));
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
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
