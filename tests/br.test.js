// br.test.js - prompt BR (October 12, 2026), in a real browser set up like John's screen (tests/johns-screen.js: a classic 15 pixel scroll bar, the site's own fonts loaded) on the repo's own files with a fake backend
// (tests/fake-site.js; no real project, no key). Proven here:
//   1. the Closes cell of a closed row says Closed and the day it was really closed (never the date it was scheduled to expire, which never came); an expired row says Expired and the day it ran out; a closed row whose
//      closing day the server did not send says Closed alone;
//   2. Sort by Closes, both directions: every closed and expired row after every open row, and among themselves by the day they really ended; the same in the Closed pill;
//   3. no Status pill is ever drawn in two clipped pieces: on a light set of rows and on John's rows (long titles, an expired draft with its note) at 1093, 1100 and 1366 pixels. At 1366 every pill is on one line; at 1093 and
//      1100 John's rows do not fit one line each without breaking a date or taking the Title below 176 pixels, so a pill may wrap between its words as ONE rounded box and every date stays whole; no sideways scroll bar;
//   4. the editor's saved line goes the moment the next change begins (a field, a switch), is shown again by a new save, and does not come back with the page from the browser's cache;
//   5. the 14 days are counted from the day the draft was ADDED in every place that says so (the note on My openings, the editor's schedule line).
// Then negative controls: one deliberate defect at a time in the page code or the style; each must make a scenario fail. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/br.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startFakeSite } from "./fake-site.js";
import { johnsBrowser, johnsWindow, johnsRows, MEASURE, DAY } from "./johns-screen.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = JSON.stringify;
let browser;
before(async () => { browser = await johnsBrowser(); });
after(async () => { if (browser) await browser.close(); });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso) => { const d = new Date(iso); return MONTHS[d.getMonth()] + " " + d.getDate(); };
const iso = (ms) => new Date(ms).toISOString();

// ---- the light rows: every kind of row the Closes cell and the pill have to carry, short titles
function rows(now = Date.now()) {
  const base = (title, o) => Object.assign({ title, is_remote: false, locations: ["Austin, TX"], location_ids: [], source_location_text: null, bump_used: false, bump_days: null, posted_at: iso(now - 12 * DAY), publish_by: null, go_live_at: null, closed_reason: null, created_at: iso(now - 20 * DAY) }, o);
  const list = [
    base("Alpha Live", { status: "live", stored_status: "live", expiration_date: iso(now + 20 * DAY) }),
    base("Bravo Closed Filled", { status: "closed", stored_status: "closed", closed_reason: "filled", expiration_date: iso(now + 30 * DAY), closed_at: iso(now - 5 * DAY) }),
    base("Charlie Closed Withdrawn", { status: "closed", stored_status: "closed", closed_reason: "withdrawn", expiration_date: iso(now + 60 * DAY), closed_at: iso(now - 2 * DAY) }),
    base("Delta Expired", { status: "expired", stored_status: "live", closed_reason: "expired_no_action", expiration_date: iso(now - 4 * DAY) }),
    base("Echo Closed Undated", { status: "closed", stored_status: "closed", closed_reason: "filled", expiration_date: iso(now + 10 * DAY) }),
    base("Foxtrot Paused Soon", { status: "paused", stored_status: "paused", expiration_date: iso(now + 3 * DAY) }),
    base("Golf In Review", { status: "flagged", stored_status: "flagged", expiration_date: iso(now + 9 * DAY) }),
    base("Hotel Expired Draft", { status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: iso(now - 3 * DAY), created_at: iso(now - 17 * DAY) }),
  ];
  return { plan: "verified", mineOverrides: list.slice(0, 5), mineExtra: list.slice(5) };
}
// John's rows (the BP set) with a real closing day on the closed one
function johnsBr() {
  const r = johnsRows();
  r.mineExtra = r.mineExtra.map((x) => (x.title === "Closed Opening" ? { ...x, closed_at: iso(Date.now() - 3 * DAY) } : x));
  return r;
}
const TITLES_OPEN = ["Alpha Live", "Foxtrot Paused Soon", "Golf In Review"];        // the rows that are still open (prompt BU: the expired draft is not one of them)

async function withSite(root, opts, fn) { const site = await startFakeSite(root, opts); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }
async function signIn(tab, site, kind) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=" + kind); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
async function openDash(tab, site, width) {
  await signIn(tab, site, "poster");
  await johnsWindow(tab, width, 500);
  await tab.goto(site.url + "/dashboard.html");
  await tab.waitFor("document.querySelectorAll('tbody tr').length > 0", 10000);
  await tab.waitFor("document.fonts.status === 'loaded'", 10000); await sleep(400);
}
const pill = (tab, label) => tab.eval("(() => { const b = Array.from(document.querySelectorAll('#filters .filter-pill')).find((x) => x.textContent.trim() === " + q(label) + "); if (!b) throw new Error('no pill ' + " + q(label) + "); b.click(); })()");
const pickSort = (tab, value) => tab.eval("(() => { const s = document.querySelector('#sortBox'); s.value = " + q(value) + "; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
const titles = (tab) => tab.eval("Array.from(document.querySelectorAll('tbody tr')).map((tr) => tr.querySelector('td').firstChild.textContent.trim())");
const closesOf = (tab) => tab.eval("Object.fromEntries(Array.from(document.querySelectorAll('tbody tr')).map((tr) => [tr.querySelector('td').firstChild.textContent.trim(), tr.querySelector('td[data-label=\"Closes\"]').innerText.replace(/\\s+/g, ' ').trim()]))");

// the pills of one set of rows at the three widths, then at two narrow ones
async function pillsOn(root, opts, wantAll) {
  return withSite(root, opts, (site) => withTab(async (tab) => { const bad = [];
    for (const width of [1093, 1100, 1366]) {
      await openDash(tab, site, width);
      const m = await tab.eval(MEASURE);
      if (m.pageScroll) bad.push(width + ": the page scrolls sideways");
      if (m.sideScroll) bad.push(width + ": the table scrolls sideways inside its card");
      const title = m.ths.find((x) => x.name === "Title");
      if (!title || title.w < 176) bad.push(width + ": the Title column is " + (title && title.w) + " pixels (176 at least)");
      const pills = await tab.eval(`Array.from(document.querySelectorAll('tbody td[data-label="Status"] .status')).map((p) => { const r = p.getBoundingClientRect(), td = p.closest('td').getBoundingClientRect(), cs = getComputedStyle(p);
        return { text: p.textContent.trim(), lines: p.getClientRects().length, h: Math.round(r.height), w: Math.round(r.width), over: r.right > td.right + 0.5 || r.left < td.left - 0.5, fs: parseFloat(cs.fontSize) }; })`);
      if (wantAll) for (const w of ["Live", "Closed · Filled", "Closed · Withdrawn", "Expired · No action taken", "Paused · closing soon", "In review", "Draft"]) if (!pills.some((p) => p.text === w)) bad.push(width + ": no pill reads '" + w + "' (" + pills.map((p) => p.text).join(" | ") + ")");
      // 1366: every pill on ONE line. 1093 and 1100: when the rows need the room (John's rows) the pill may wrap between its words, but it is ONE box (one rectangle), at most two lines high, and the dates stay whole
      const oneLine = width >= 1366;
      for (const p of pills) {
        if (p.lines !== 1) bad.push(width + ": the pill '" + p.text + "' is drawn in " + p.lines + " pieces (wrapped and clipped)");
        if (p.h > p.fs * (oneLine ? 2.1 : 3.3)) bad.push(width + ": the pill '" + p.text + "' is " + p.h + " pixels high (" + (oneLine ? "more than one line" : "more than two lines") + ")");
        if (p.over) bad.push(width + ": the pill '" + p.text + "' runs outside its cell");
      }
      for (const r of m.rows) if (r.closesLines > 1) bad.push(width + ": '" + r.title + "': the Closes value is on " + r.closesLines + " lines (the dates stay whole)");
    }
    // a narrow window (the table fits only by wrapping): a pill may wrap between its words, but it stays ONE box with its rounded shape, never two clipped pieces
    for (const width of [700, 780]) {
      await openDash(tab, site, width);
      const narrow = await tab.eval(`Array.from(document.querySelectorAll('tbody td[data-label="Status"] .status')).map((p) => { const r = p.getBoundingClientRect(), td = p.closest('td').getBoundingClientRect(); return { text: p.textContent.trim(), pieces: p.getClientRects().length, over: r.right > td.right + 0.5 }; })`);
      for (const p of narrow) {
        if (p.pieces !== 1) bad.push(width + ": the pill '" + p.text + "' is drawn in " + p.pieces + " pieces when it wraps");
        if (p.over) bad.push(width + ": the pill '" + p.text + "' runs outside its cell");
      }
    }
    return bad; }));
}

const SCENARIOS = {
  // ---- 1. the Closes cell
  async closesCell(root) { return withSite(root, rows(), (site) => withTab(async (tab) => { const bad = [], now = Date.now();
    await openDash(tab, site, 1093);
    const c = await closesOf(tab);
    const want = { "Bravo Closed Filled": "Closed " + day(now - 5 * DAY), "Charlie Closed Withdrawn": "Closed " + day(now - 2 * DAY), "Delta Expired": "Expired " + day(now - 4 * DAY), "Echo Closed Undated": "Closed" };
    for (const [t, w] of Object.entries(want)) if (c[t] !== w) bad.push("'" + t + "': Closes says '" + c[t] + "' (wanted '" + w + "')");
    for (const [t, sched] of [["Bravo Closed Filled", now + 30 * DAY], ["Charlie Closed Withdrawn", now + 60 * DAY], ["Echo Closed Undated", now + 10 * DAY]]) if ((c[t] || "").includes(day(sched))) bad.push("'" + t + "' still shows the date it was scheduled to expire (" + day(sched) + ")");
    for (const t of ["Bravo Closed Filled", "Delta Expired"]) if (/in \d+ (day|hour)/.test(c[t] || "")) bad.push("'" + t + "' carries a flag");
    return bad; })); },
  // ---- 2. the sort
  async sorting(root) { return withSite(root, rows(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, 1093);
    // prompt BU (October 12, 2026): the draft whose publish window ended ("Hotel Expired Draft", publish by 3 days ago) is one of the ended rows now, ordered among them by its publish-by day; BR had it among the open rows
    const OVER = ["Bravo Closed Filled", "Delta Expired", "Hotel Expired Draft", "Charlie Closed Withdrawn", "Echo Closed Undated"];        // by the day they really ended, asc: -5, -4, -3, -2, none
    await pickSort(tab, "closes_asc"); await sleep(250);
    let t = await titles(tab);
    const tail = t.slice(-5);
    if (JSON.stringify(tail) !== JSON.stringify(OVER)) bad.push("Closes soonest first: the last five are " + JSON.stringify(tail) + " (wanted " + JSON.stringify(OVER) + ")");
    if (JSON.stringify(t.slice(0, 3).sort()) !== JSON.stringify(TITLES_OPEN.slice().sort())) bad.push("Closes soonest first: the first three are " + JSON.stringify(t.slice(0, 3)));
    await pickSort(tab, "closes_desc"); await sleep(250);
    t = await titles(tab);
    const OVER_DESC = ["Charlie Closed Withdrawn", "Hotel Expired Draft", "Delta Expired", "Bravo Closed Filled", "Echo Closed Undated"];
    if (JSON.stringify(t.slice(-5)) !== JSON.stringify(OVER_DESC)) bad.push("Closes furthest first: the last five are " + JSON.stringify(t.slice(-5)) + " (wanted " + JSON.stringify(OVER_DESC) + ")");
    if (t[0] !== "Alpha Live") bad.push("Closes furthest first: the first is " + t[0]);
    await pill(tab, "Closed"); await pickSort(tab, "closes_asc"); await sleep(250);
    t = await titles(tab);
    if (JSON.stringify(t) !== JSON.stringify(OVER.filter((x) => x !== "Hotel Expired Draft"))) bad.push("the Closed pill, soonest first: " + JSON.stringify(t));
    // the other sorts are as they were
    await pill(tab, "All"); await pickSort(tab, "title_asc"); await sleep(250);
    t = await titles(tab);
    if (t[0] !== "Alpha Live" || t[1] !== "Bravo Closed Filled") bad.push("Title A to Z changed: " + JSON.stringify(t.slice(0, 3)));
    return bad; })); },
  // ---- 3. the pill, on light rows and on John's rows
  async pills(root) {
    const out = [];
    for (const [tag, opts, wantAll] of [["light rows", rows(), true], ["John's rows", johnsBr(), false]]) out.push(...(await pillsOn(root, opts, wantAll)).map((x) => tag + ": " + x));
    return out;
  },
  // ---- 4. the stale saved line
  async savedLine(root) { return withSite(root, { postingStatus: "draft", plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site, "poster");
    await johnsWindow(tab, 1093, 700);
    await tab.goto(site.url + "/edit.html?id=3f1d5b1e-0000-4000-8000-000000000001");
    await tab.waitFor("!!document.getElementById('jtitle') && document.getElementById('jtitle').value !== ''", 10000); await sleep(500);
    const said = () => tab.eval("(() => { const b = document.getElementById('formAlert'); return b && !b.hidden ? b.textContent.replace(/\\s+/g, ' ').trim() : ''; })()");
    const type = (v) => tab.eval("(() => { const e = document.getElementById('jtitle'); e.value = " + q(v) + "; e.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await type("Data Analyst, changed"); await sleep(250);
    await tab.eval("document.getElementById('saveBtn').click()"); await sleep(900);
    if (!/^Saved\. 1 field was changed\./.test(await said())) bad.push("after Save changes the line says '" + (await said()) + "'");
    await sleep(600);
    if (!/^Saved\./.test(await said())) bad.push("the saved line went by itself, with nothing changed");
    await type("Data Analyst, again"); await sleep(250);
    if ((await said()) !== "") bad.push("a field edit began and the saved line stayed: '" + (await said()) + "'");
    // a new save shows its own line again
    await tab.eval("document.getElementById('saveBtn').click()"); await sleep(900);
    if (!/^Saved\. 1 field was changed\./.test(await said())) bad.push("a second save does not show its line: '" + (await said()) + "'");
    // a switch begins the next change too
    await tab.eval("document.getElementById('recruiterToggle').click()"); await sleep(250);
    if ((await said()) !== "") bad.push("a switch was pressed and the saved line stayed: '" + (await said()) + "'");
    // coming back from the browser's cache does not bring the line back
    await tab.eval("document.getElementById('saveBtn').click()"); await sleep(900);
    const before = await said();
    await tab.eval("window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))"); await sleep(200);
    if (/^Saved\./.test(before) && (await said()) !== "") bad.push("the saved line is still there after the page came back from the cache");
    if (!/^Saved\./.test(before)) bad.push("the third save did not show its line: '" + before + "'");
    return bad; })); },
  // ---- 5. the wording
  async wording(root) { return withSite(root, { ...rows(), postingStatus: "draft" }, (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, 1093);
    const note = await tab.eval("(() => { const n = document.querySelector('.act-note'); return n ? n.innerText.replace(/\\s+/g, ' ').trim() : null; })()");
    if (note !== "Publish window ended: a draft can be published for 14 days after it was added. To use it, add it again as a new opening.") bad.push("the expired draft note says: " + q(note));
    await tab.goto(site.url + "/edit.html?id=3f1d5b1e-0000-4000-8000-000000000001");
    await tab.waitFor("!!document.getElementById('scheduleState') && document.getElementById('scheduleState').textContent.length > 0", 10000); await sleep(400);
    const sched = await tab.eval("document.getElementById('scheduleState').textContent.replace(/\\s+/g, ' ').trim()");
    if (!/a draft can be published for 14 days after it was added, until /.test(sched)) bad.push("the editor's schedule line says: " + q(sched));
    if (/after it was saved/.test(await tab.eval("document.body.innerText"))) bad.push("a page still counts the 14 days from 'saved'");
    return bad; })); },
};

test("BR: Closed and Expired with the real day, closed and expired rows last in both Closes directions, one clean Status pill at 1093, 1100 and 1366, the saved line gone at the next change, the 14 days from the day it was added", { timeout: 1800000 }, async () => {
  const problems = [];
  for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](ROOT)) problems.push(n + ": " + p);
  assert.deepEqual(problems, [], "BR problems:\n" + problems.join("\n"));
});

// ---- negative controls: [label, scenarios, [[file, mutate]]]
const DEFECTS = [
  ["a closed row shows its scheduled date again", ["closesCell"], [["js/dashboard-model.js", (s) => s.replace('if (p.status === "closed") return typeof p.closed_at === "string" && fmtDate(p.closed_at) !== "" ? "Closed " + fmtDate(p.closed_at) : "Closed";', 'if (p.status === "closed") return p.expiration_date ? fmtDate(p.expiration_date) : "None";')]]],
  ["an expired row has no word", ["closesCell"], [["js/dashboard-model.js", (s) => s.replace('return p.expiration_date ? "Expired " + fmtDate(p.expiration_date) : "Expired";', 'return p.expiration_date ? fmtDate(p.expiration_date) : "None";')]]],
  ["the real closing day is ignored", ["closesCell"], [["js/dashboard-model.js", (s) => s.replace('typeof p.closed_at === "string" && fmtDate(p.closed_at) !== "" ? "Closed " + fmtDate(p.closed_at) : "Closed"', '"Closed"')]]],
  ["closed rows sort by their scheduled date again", ["sorting"], [["js/dashboard-model.js", (s) => s.replace('if (isOver(p)) return endedAt(p);', 'if (false) return endedAt(p);').replace('return list.sort((a, b) => { const ea = isEnded(a, nowMs), eb = isEnded(b, nowMs); if (ea !== eb) return ea ? 1 : -1; const x', 'return list.sort((a, b) => { const x')]]],
  ["closed rows are mixed in by their real day instead of going last", ["sorting"], [["js/dashboard-model.js", (s) => s.replace("const ea = isEnded(a, nowMs), eb = isEnded(b, nowMs); if (ea !== eb) return ea ? 1 : -1; const x", "const x")]]],
  ["closed rows go first in the descending order", ["sorting"], [["js/dashboard-model.js", (s) => s.replace("const ea = isEnded(a, nowMs), eb = isEnded(b, nowMs); if (ea !== eb) return ea ? 1 : -1; const x", "const ea = isEnded(a, nowMs), eb = isEnded(b, nowMs); if (ea !== eb) return ea ? -1 : 1; const x")]]],
  ["the pill is a run of text again", ["pills"], [["app.css", (s) => s.replace('.my-openings td[data-label="Status"] .status{display:inline-block;border-radius:14px}', "")]]],
  ["the table has no level where the pills wrap before the dates do", ["pills"], [["js/pages/dashboard.js", (s) => s.replace('for (const level of ["", "snug", "wrap-status", "tight"]) {', 'for (const level of ["", "snug", "tight"]) {')]]],
  ["the saved line is never taken away", ["savedLine"], [["js/pages/edit.js", (s) => s.replace('if (anyUnsaved() && document.querySelector("[data-result]")) clearResults();', "")]]],
  ["the saved line is not marked as a result", ["savedLine"], [["js/pages/edit.js", (s) => s.replace('if (kind === "ok" || result === true) box.setAttribute("data-result", "1");', "")]]],
  ["the saved line comes back from the cache", ["savedLine"], [["js/pages/edit.js", (s) => s.replace('window.addEventListener("pageshow", (ev) => { if (ev.persisted) clearResults(); });', "")]]],
  ["the note counts from saved", ["wording"], [["js/pages/dashboard.js", (s) => s.replace("14 days after it was added. To use it, ", "14 days after it was saved. To use it, ")]]],
  ["the editor's schedule line counts from saved", ["wording"], [["js/pages/edit.js", (s) => s.replace("14 days after it was added, until ", "14 days after it was saved, until ")]]],
];
test("negative controls: each defect of BR makes a check fail", { timeout: 6000000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    if (process.env.BR_ONLY && !label.includes(process.env.BR_ONLY)) continue;   // BR_ONLY=<part of a label>: run one control while building
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-br-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      for (const n of scenarios) found.push(...(await SCENARIOS[n](dir)).map((x) => n + ": " + x));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 160) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
