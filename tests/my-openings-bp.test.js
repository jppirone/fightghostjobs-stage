// my-openings-bp.test.js - prompt BP (October 11, 2026), in a real browser set up like John's screen (tests/johns-screen.js: a classic 15 pixel scroll bar, the site's own fonts loaded, a window of 1354 pixels and
// 5 percent less, 1366 and 1100): the My openings table reworked. The Applicant cap column is gone (the editor's box stays), Added sits under the title, the Status column is there only in a view that can hold more
// than one status, the Closes cell carries a flag line inside 7 days, the Expiring pill, the Sort by box (all six options, blanks last, together with a pill and a search, defaults, the choice kept, the live region),
// the keyboard order and the phone list. The repo's own files and a fake backend (tests/fake-site.js; no real project, no key).
// Then negative controls: one defect at a time in the page code or the style; each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/my-openings-bp.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startFakeSite } from "./fake-site.js";
import { johnsBrowser, johnsWindow, barOf, johnsRows, MEASURE, JOHN_WIDTH, SPARE_WIDTH, BAR, DAY } from "./johns-screen.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EDIT = "edit.html?id=3f1d5b1e-0000-4000-8000-000000000001";
const TITLE_MIN = 176;
let browser;
before(async () => { browser = await johnsBrowser(); });
after(async () => { if (browser) await browser.close(); });

async function withSite(root, opts, fn) { const site = await startFakeSite(root, opts); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }
const q = JSON.stringify;
const text = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; })()");
async function signIn(tab, site, kind) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=" + kind); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
// the window height is short on purpose: the page always scrolls, so the classic bar is always there (a short page in a real Chrome has none, which only gives the table MORE room)
async function openDash(tab, site, width, phone) {
  await signIn(tab, site, "poster");
  if (phone) await tab.viewport(width, true, 800); else await johnsWindow(tab, width, 500);
  await tab.goto(site.url + "/dashboard.html");
  await tab.waitFor("document.querySelectorAll('tbody tr').length > 0", 10000);
  await tab.waitFor("document.fonts.status === 'loaded'", 10000); await sleep(400);
}
const pill = (tab, label) => tab.eval("(() => { const b = Array.from(document.querySelectorAll('#filters .filter-pill')).find((x) => x.textContent.trim() === " + q(label) + "); if (!b) throw new Error('no pill ' + " + q(label) + "); b.click(); })()");
const pickSort = (tab, value) => tab.eval("(() => { const s = document.querySelector('#sortBox'); s.value = " + q(value) + "; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
const titles = (tab) => tab.eval("Array.from(document.querySelectorAll('tbody tr')).map((tr) => tr.querySelector('td').firstChild.textContent.trim())");
const heads = (tab) => tab.eval("Array.from(document.querySelectorAll('thead th')).map((t) => t.textContent.trim())");
const iso = (ms) => new Date(ms).toISOString();

// ---- the sort fixture: every row's dates are set by hand, so each order below is exact
const NOW0 = Date.now();
const SORT_ROWS = () => {
  const n = Date.now(), c = (d) => iso(n + d * DAY);
  const base = (title, o) => Object.assign({ title, is_remote: false, locations: ["Austin, TX"], location_ids: [], source_location_text: null, bump_used: false, bump_days: null, posted_at: c(-5), publish_by: null, go_live_at: null, closed_reason: null }, o);
  return {
    plan: "verified",
    mineOverrides: [
      base("Delta Analyst", { status: "live", stored_status: "live", created_at: c(-3), expiration_date: c(20) }),
      base("Alpha Engineer", { status: "live", stored_status: "live", created_at: c(-10), expiration_date: iso(n + 2 * DAY + 3600000) }),
      base("Charlie Nurse", { status: "paused", stored_status: "paused", created_at: c(-6), expiration_date: c(9) }),
      base("Bravo Draft", { status: "draft", stored_status: "draft", created_at: c(-1), posted_at: null, expiration_date: null, publish_by: iso(n + 5 * DAY + 3600000) }),
      base("Echo Scheduled", { status: "scheduled", stored_status: "draft", created_at: c(-4), posted_at: null, expiration_date: null, go_live_at: c(6) }),
    ],
    mineExtra: [
      base("Foxtrot Closed", { status: "closed", stored_status: "closed", closed_reason: "filled", created_at: c(-30), expiration_date: c(-5) }),
      base("Golf No Date", { status: "draft", stored_status: "draft", created_at: c(-8), posted_at: null, expiration_date: null, publish_by: null }),
      base("Hotel Expired", { status: "expired", stored_status: "live", closed_reason: "expired_no_action", created_at: c(-40), expiration_date: c(-3) }),
    ],
  };
};
const ORDER = {
  added_desc: ["Bravo Draft", "Delta Analyst", "Echo Scheduled", "Charlie Nurse", "Golf No Date", "Alpha Engineer", "Foxtrot Closed", "Hotel Expired"],
  added_asc: ["Hotel Expired", "Foxtrot Closed", "Alpha Engineer", "Golf No Date", "Charlie Nurse", "Echo Scheduled", "Delta Analyst", "Bravo Draft"],
  // prompt BR (October 12, 2026): closed and expired rows go after every open row in both directions (a closed row's scheduled date never came); among themselves by the day they really ended:
  // Hotel Expired ran out 3 days ago, Foxtrot Closed has no closing day from the server (no date: after the dated ones). Before BR they sorted in among the open rows by their expiration date.
  closes_asc: ["Alpha Engineer", "Bravo Draft", "Echo Scheduled", "Charlie Nurse", "Delta Analyst", "Golf No Date", "Hotel Expired", "Foxtrot Closed"],
  closes_desc: ["Delta Analyst", "Charlie Nurse", "Echo Scheduled", "Bravo Draft", "Alpha Engineer", "Golf No Date", "Hotel Expired", "Foxtrot Closed"],
  title_asc: ["Alpha Engineer", "Bravo Draft", "Charlie Nurse", "Delta Analyst", "Echo Scheduled", "Foxtrot Closed", "Golf No Date", "Hotel Expired"],
  title_desc: ["Hotel Expired", "Golf No Date", "Foxtrot Closed", "Echo Scheduled", "Delta Analyst", "Charlie Nurse", "Bravo Draft", "Alpha Engineer"],
  status: ["Foxtrot Closed", "Alpha Engineer", "Bravo Draft", "Golf No Date", "Hotel Expired", "Delta Analyst", "Charlie Nurse", "Echo Scheduled"],
};
const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const SCENARIOS = {
  // ---- the cap column is gone from the table and the phone list; the editor's box stays
  async capGone(root) { return withSite(root, johnsRows(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, JOHN_WIDTH);
    if ((await heads(tab)).some((t) => /cap/i.test(t))) bad.push("a column heading still names the cap: " + JSON.stringify(await heads(tab)));
    if (await tab.eval("!!document.querySelector('td[data-label=\"Applicant cap\"]') || /No cap set|Capped at/.test(document.querySelector('tbody').innerText)")) bad.push("a row still shows the cap");
    await openDash(tab, site, 390, true);
    if (await tab.eval("/applicant cap|No cap set|Capped at/i.test(document.querySelector('tbody').innerText)")) bad.push("the phone list still shows the cap");
    await tab.goto(site.url + "/" + EDIT);
    await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden && !!document.querySelector('#jtitle').value", 10000); await sleep(400);
    if (!(await tab.eval("!!document.querySelector('#appcap') && !!document.querySelector('label[for=\"appcap\"]')"))) bad.push("the editor's cap box is gone");
    return bad; })); },
  // ---- Added under the title, no Added column, no arrow
  async addedUnderTitle(root) { return withSite(root, johnsRows(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, JOHN_WIDTH);
    if ((await heads(tab)).includes("Added") || (await tab.eval("!!document.querySelector('td[data-label=\"Added\"]')"))) bad.push("an Added column is still there");
    if (await tab.eval("!!document.querySelector('#sortArrow') || !!document.querySelector('#sortHead')")) bad.push("the old Added arrow is still there");
    const m = await tab.eval(MEASURE);
    for (const r of m.rows) {
      if (!/^Added [A-Z][a-z]{2} \d{1,2}$/.test(r.addedLine || "")) bad.push("'" + r.title + "': the title cell's Added line is '" + r.addedLine + "'");
    }
    const exp = m.rows.find((r) => r.title === "Expired Draft Opening");
    if (!exp || !/^Added /.test(exp.addedLine || "")) bad.push("the expired draft has no Added line");
    // the Added line is under the place line, in the title cell
    const order = await tab.eval("(() => { const c = document.querySelector('tbody tr td'); return Array.from(c.querySelectorAll('[data-part]')).map((e) => e.getAttribute('data-part')); })()");
    if (JSON.stringify(order) !== JSON.stringify(["place", "added"])) bad.push("the lines under the title are " + JSON.stringify(order) + " (place, then added)");
    return bad; })); },
  // ---- the table at John's size: one line each, no sideways scroll bar, the row heights
  async johnsSize(root) { return withSite(root, johnsRows(), (site) => withTab(async (tab) => { const bad = [];
    for (const width of [JOHN_WIDTH, SPARE_WIDTH, 1366]) {
      await openDash(tab, site, width);
      const b = await barOf(tab);
      if (b.bar !== BAR) bad.push(width + ": the page's scroll bar is " + b.bar + " pixels (a classic bar is 15): the setup is not John's");
      const m = await tab.eval(MEASURE);
      if (m.sideScroll || m.pageScroll || m.lastTh > m.cardRight + 1) bad.push(width + ": a sideways scroll bar shows or a column runs past the card");
      const title = m.ths.find((t) => t.name === "Title");
      if (!title || title.w < TITLE_MIN) bad.push(width + ": the Title column is " + (title && title.w) + " pixels (at least " + TITLE_MIN + ")");
      for (const r of m.rows) {
        if (r.words.length && r.actLines !== 1) bad.push(width + ": '" + r.title + "': the action words are on " + r.actLines + " lines");
        for (let i = 1; i < r.words.length; i++) { const gap = r.words[i].left - r.words[i - 1].right; if (gap < 13 || gap > 15) bad.push(width + ": '" + r.title + "': the gap before '" + r.words[i].t + "' is " + Math.round(gap) + " pixels (14)"); }
        if (r.closes.length && r.closesLines !== 1) bad.push(width + ": '" + r.title + "': the Closes value is on " + r.closesLines + " lines: " + r.closesText);
      }
      // the numbers asked for: a one-line-title row, the Associate Product Manager row, the expired draft
      const apm = m.rows.find((r) => r.title === "Associate Product Manager"), exp = m.rows.find((r) => r.title === "Expired Draft Opening"), one = m.rows.find((r) => r.title === "Closing In Three Days");
      if (!apm || apm.h > 78) bad.push(width + ": the Associate Product Manager row is " + (apm && apm.h) + " pixels (78 at most)");
      if (!one || one.h > 76) bad.push(width + ": a one-line-title row is " + (one && one.h) + " pixels (76 at most: title, place and Added line)");
      if (!exp || exp.h > 120) bad.push(width + ": the expired draft row is " + (exp && exp.h) + " pixels (about 120 at most)");
      const jpm = m.rows.find((r) => r.title === "Junior Project Manager");
      if (!jpm || jpm.h > 100) bad.push(width + ": the Junior Project Manager row is " + (jpm && jpm.h) + " pixels (100 at most)");
    }
    return bad; })); },
  // the side padding of 8 pixels is what lets the roomiest layout hold at 1100 in the All view (every value on one line): with 12 it falls back to wrapping there
  async at1100(root) { return withSite(root, johnsRows(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, 1100);
    const m = await tab.eval(MEASURE);
    if (m.sideScroll || m.pageScroll) bad.push("1100: a sideways scroll bar shows");
    for (const r of m.rows) {
      if (r.words.length && r.actLines !== 1) bad.push("1100: '" + r.title + "': the action words are on " + r.actLines + " lines");
      if (r.closes.length && r.closesLines !== 1) bad.push("1100: '" + r.title + "': the Closes value is on " + r.closesLines + " lines");
    }
    // prompt BR (October 12, 2026): since the Status pills got their own fallback (they may wrap before any date does, with 6 pixel side padding at that level), the checks above hold at 1100 whatever the base padding is.
    // The padding of 8 still decides a window a little wider (about 1171 pixels, a card of about 1090): the snuggest layout needs about 1077 with 8 and about 1105 with 12, so with 12 the pills fall back to wrapping there.
    await openDash(tab, site, 1171);
    const wide = await tab.eval("Array.from(document.querySelectorAll('tbody td[data-label=\"Status\"] .status')).map((p) => ({ text: p.textContent.trim(), h: Math.round(p.getBoundingClientRect().height) }))");
    for (const p of wide) if (p.h > 30) bad.push("1171: the pill '" + p.text + "' is " + p.h + " pixels high (one line fits here with the 8 pixel padding)");
    return bad; })); },
  async smallerWindows(root) { return withSite(root, johnsRows(), (site) => withTab(async (tab) => { const bad = [];
    let wrapped = 0;
    for (const width of [1100, 1000]) {
      await openDash(tab, site, width);
      const m = await tab.eval(MEASURE);
      if (m.sideScroll || m.pageScroll || m.lastTh > m.cardRight + 1) bad.push(width + ": a sideways scroll bar shows or a column runs past the card");
      const title = m.ths.find((t) => t.name === "Title");
      if (!title || title.w < TITLE_MIN) bad.push(width + ": the Title column is " + (title && title.w) + " pixels");
      for (const r of m.rows) {
        for (const w of r.words) if (w.lines > 1 || w.h > 24) bad.push(width + ": '" + r.title + "': the word '" + w.t + "' is split over lines");
        // a line that starts below the first one begins at the same left edge as the first word (no indent): the leftmost word of every later line
        const firstLeft = r.words.length ? Math.min(...r.words.map((w) => w.left)) : null, firstTop = r.words.length ? Math.min(...r.words.map((w) => w.top)) : null;
        for (const top of new Set(r.words.map((w) => w.top))) {
          if (top <= firstTop + 2) continue;
          wrapped++;
          const start = r.words.filter((w) => w.top === top).sort((a, b) => a.left - b.left)[0];
          if (Math.abs(start.left - firstLeft) > 1) bad.push(width + ": '" + r.title + "': the wrapped line starts with '" + start.t + "' indented by " + Math.round(start.left - firstLeft) + " pixels");
        }
        for (const p of r.closes) if (p.lines !== 1) bad.push(width + ": '" + r.title + "': '" + p.t + "' is broken inside");
      }
    }
    // the fallback has to be exercised: at 1000 the All view (Status column, the widest values) cannot keep every value on one line
    await openDash(tab, site, 1000);
    const m = await tab.eval(MEASURE);
    if (!m.rows.some((r) => r.actLines > 1 || r.closesLines > 1)) bad.push("at 1000 nothing wrapped, so the narrow layout was not exercised");
    return bad; })); },
  // ---- the Status column only where it tells something
  async statusColumn(root) { return withSite(root, johnsRows(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, JOHN_WIDTH);
    const WITH = ["All", "Closing soon", "Closed"], WITHOUT = ["Live", "Expiring", "Paused", "Scheduled", "Draft"];
    for (const v of [...WITH, ...WITHOUT]) {
      await pill(tab, v); await sleep(200);
      const h = await heads(tab), cells = await tab.eval("document.querySelector('tbody tr') ? Array.from(document.querySelectorAll('tbody tr')[0].querySelectorAll('td')).map((t) => t.getAttribute('data-label')) : null");
      const has = h.includes("Status");
      if (WITH.includes(v) && !has) bad.push(v + ": no Status column (this view can hold more than one status)");
      if (WITHOUT.includes(v)) {
        if (has) bad.push(v + ": the Status column is there (every row has the same status)");
        if (cells && cells.includes("Status")) bad.push(v + ": a Status cell is in the row");
      }
      if (WITH.includes(v) && cells && !cells.includes("Status")) bad.push(v + ": the header says Status but the rows have no Status cell");
      if (cells && cells.length !== h.length) bad.push(v + ": " + h.length + " headings and " + cells.length + " cells");
      // removed, not hidden by style
      if (await tab.eval("Array.from(document.querySelectorAll('thead th')).some((t) => t.hidden || getComputedStyle(t).display === 'none')")) bad.push(v + ": a heading is hidden by style instead of being removed");
    }
    return bad; })); },
  // ---- the flag
  async flag(root) { return withSite(root, johnsRows(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, JOHN_WIDTH);
    const m = await tab.eval(MEASURE);
    const f = (t) => (m.rows.find((r) => r.title === t) || {}).flag;
    // the Nurse Practitioner row (paused) closes in 9 days in the fake data: the flag is for 7 days or fewer, so none; a scheduled draft's go-live time and a closed or expired row have none either
    const WANT = { "Closing In Three Days": "in 3 days", "Draft Near The End": "in 5 days", "Paused Closing In Four Days": "in 4 days", "Closing Past Seven Days": "", "Associate Product Manager": "", "Nurse Practitioner Specialist, Evenings and Weekends": "",
      "Expired Draft Opening": "", "Closed Opening": "", "Analytics Team Lead": "", "Data Governance Analyst": "" };
    for (const [t, want] of Object.entries(WANT)) if (f(t) !== want) bad.push("'" + t + "': the flag reads '" + f(t) + "', expected '" + want + "'");
    // words, a dark amber colour with a contrast of at least 4.5 to 1 on the card, and nothing hidden that repeats them
    const c = await tab.eval(`(() => { const e = document.querySelector('[data-part="flag"]'); const cs = getComputedStyle(e); let bg = null; for (let n = e; n && !bg; n = n.parentElement) { const b = getComputedStyle(n).backgroundColor; if (b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') bg = b; }
      return { color: cs.color, bg, text: e.textContent.trim(), hiddenCopies: document.querySelectorAll('tbody [aria-hidden="true"], tbody .sr-only, tbody .unsaved-sr').length, ariaHidden: e.getAttribute('aria-hidden') }; })()`);
    const rgb = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
    const lum = ([r, g, b]) => { const f2 = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f2(r) + 0.7152 * f2(g) + 0.0722 * f2(b); };
    const l1 = lum(rgb(c.color)), l2 = lum(rgb(c.bg)), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (ratio < 4.5) bad.push("the flag's contrast is " + ratio.toFixed(2) + " to 1 (at least 4.5)");
    if (c.hiddenCopies !== 0 || c.ariaHidden) bad.push("something hidden repeats the flag for a screen reader: " + JSON.stringify(c));
    if (!/^in /.test(c.text)) bad.push("the flag has no words: '" + c.text + "'");
    return bad; })); },
  // the 7 is one constant in one place: with it changed, the flags and the Expiring pill move together
  async constantMoves(root) { return withSite(root, johnsRows(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, JOHN_WIDTH);
    const m = await tab.eval(MEASURE);
    if (m.rows.some((r) => r.flag !== "")) { /* the normal run: flags exist */ } else bad.push("no flag shows in the run with the normal constant (the 7)");
    return bad; })); },
  // ---- the Expiring pill
  async expiringPill(root) { return withSite(root, johnsRows(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, JOHN_WIDTH);
    const m0 = await tab.eval(MEASURE);
    if (JSON.stringify(m0.pills.map((p) => p.replace("*", ""))) !== JSON.stringify(["All", "Live", "Closing soon", "Expiring", "Paused", "Scheduled", "Draft", "Closed"])) bad.push("the pills are " + JSON.stringify(m0.pills));
    await pill(tab, "Expiring"); await sleep(200);
    const t = await titles(tab);
    if (!sameList(t, ["Draft Near The End"])) bad.push("Expiring holds " + JSON.stringify(t) + " (only the draft with 5 days left; a paused or live row is under Closing soon)");
    if ((await text(tab, "#sortBox option:checked")) !== "Closes, soonest first") bad.push("Expiring opens sorted by '" + (await text(tab, "#sortBox option:checked")) + "'");
    // Closing soon is unchanged: live and paused within 10 days
    await pill(tab, "Closing soon"); await sleep(200);
    const cs = await titles(tab);
    for (const want of ["Closing In Three Days", "Paused Closing In Four Days", "Nurse Practitioner Specialist, Evenings and Weekends"]) if (!cs.includes(want)) bad.push("Closing soon lost '" + want + "'");
    if (cs.includes("Draft Near The End")) bad.push("a draft is under Closing soon");
    if ((await text(tab, "#sortBox option:checked")) !== "Closes, soonest first") bad.push("Closing soon opens sorted by '" + (await text(tab, "#sortBox option:checked")) + "'");
    return bad; })); },
  async expiringEmpty(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, JOHN_WIDTH);
    await pill(tab, "Expiring"); await sleep(200);
    if ((await titles(tab)).length !== 0) bad.push("Expiring holds rows although no draft is near the end");
    if ((await text(tab, "#tableNote")) !== "No openings match this filter.") bad.push("the empty message is '" + (await text(tab, "#tableNote")) + "'");
    return bad; })); },
  // ---- the sort box
  async sortOptions(root) { return withSite(root, SORT_ROWS(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, JOHN_WIDTH);
    const opts = () => tab.eval("Array.from(document.querySelectorAll('#sortBox option')).map((o) => o.textContent.trim())");
    const SIX = ["Added, newest first", "Added, oldest first", "Closes, soonest first", "Closes, furthest first", "Title, A to Z", "Title, Z to A"];
    if (!sameList(await opts(), [...SIX, "Status"])) bad.push("All: the options are " + JSON.stringify(await opts()));
    if ((await text(tab, 'label[for="sortBox"]')) !== "Sort by") bad.push("the box's label reads '" + (await text(tab, 'label[for="sortBox"]')) + "'");
    await pill(tab, "Live"); await sleep(200);
    if (!sameList(await opts(), SIX)) bad.push("Live (no Status column): the options are " + JSON.stringify(await opts()));
    await pill(tab, "Closed"); await sleep(200);
    if (!sameList(await opts(), [...SIX, "Status"])) bad.push("Closed: the options are " + JSON.stringify(await opts()));
    return bad; })); },
  async sortEach(root) { return withSite(root, SORT_ROWS(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, JOHN_WIDTH);
    if (!sameList(await titles(tab), ORDER.added_desc)) bad.push("the default order is " + JSON.stringify(await titles(tab)));
    for (const key of ["added_asc", "closes_asc", "closes_desc", "title_asc", "title_desc", "status", "added_desc"]) {
      await pickSort(tab, key); await sleep(150);
      const t = await titles(tab);
      if (!sameList(t, ORDER[key])) bad.push(key + ": " + JSON.stringify(t) + " (expected " + JSON.stringify(ORDER[key]) + ")");
    }
    return bad; })); },
  async sortWithPillAndSearch(root) { return withSite(root, SORT_ROWS(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, JOHN_WIDTH);
    await pickSort(tab, "title_desc"); await sleep(150);
    await pill(tab, "Closing soon"); await sleep(200);
    // the choice stays with the pill: Closing soon holds Alpha Engineer (live) and Charlie Nurse (paused)
    if ((await text(tab, "#sortBox option:checked")) !== "Title, Z to A") bad.push("the choice was not kept across pills: '" + (await text(tab, "#sortBox option:checked")) + "'");
    if (!sameList(await titles(tab), ["Charlie Nurse", "Alpha Engineer"])) bad.push("Closing soon, Title Z to A: " + JSON.stringify(await titles(tab)));
    await pill(tab, "All"); await sleep(150);
    await tab.eval("(() => { const i = document.querySelector('#textFilter'); i.value = 'o'; i.dispatchEvent(new Event('input', { bubbles: true })); })()"); await sleep(200);
    const t = await titles(tab), want = ORDER.title_desc.filter((x) => /o/i.test(x));      // no Opening ID or req number of the fixture has an o
    if (!sameList(t, want)) bad.push("search 'o' with Title Z to A: " + JSON.stringify(t) + " (expected " + JSON.stringify(want) + ")");
    await pickSort(tab, "closes_asc"); await sleep(150);
    const t2 = await titles(tab), want2 = ORDER.closes_asc.filter((x) => /o/i.test(x));
    if (!sameList(t2, want2)) bad.push("search 'o' with Closes soonest: " + JSON.stringify(t2) + " (expected " + JSON.stringify(want2) + ")");
    return bad; })); },
  async sortDefaults(root) { return withSite(root, SORT_ROWS(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, JOHN_WIDTH);
    const label = () => text(tab, "#sortBox option:checked");
    for (const [v, want] of [["All", "Added, newest first"], ["Live", "Added, newest first"], ["Closing soon", "Closes, soonest first"], ["Expiring", "Closes, soonest first"], ["Paused", "Added, newest first"], ["Scheduled", "Added, newest first"], ["Draft", "Added, newest first"], ["Closed", "Added, newest first"]]) {
      await pill(tab, v); await sleep(150);
      if ((await label()) !== want) bad.push(v + ": opens sorted by '" + (await label()) + "', expected '" + want + "'");
    }
    // a person's choice stays until they pick another
    await pill(tab, "All"); await pickSort(tab, "title_asc"); await sleep(100);
    for (const v of ["Closing soon", "Expiring", "Draft", "All"]) { await pill(tab, v); await sleep(120); if ((await label()) !== "Title, A to Z") bad.push(v + " after choosing Title A to Z: '" + (await label()) + "'"); }
    // Status was chosen and the next pill has no Status column: that pill uses its own default and the choice comes back where the column is
    await pickSort(tab, "status"); await sleep(100);
    await pill(tab, "Live"); await sleep(150);
    if ((await label()) !== "Added, newest first") bad.push("Live after Status: '" + (await label()) + "' (its default, there is no Status column)");
    await pill(tab, "All"); await sleep(150);
    if ((await label()) !== "Status") bad.push("All after Status: '" + (await label()) + "'");
    // a reload starts again
    await tab.goto(site.url + "/dashboard.html"); await tab.waitFor("document.querySelectorAll('tbody tr').length > 0", 10000); await sleep(300);
    if ((await label()) !== "Added, newest first") bad.push("after a reload: '" + (await label()) + "'");
    return bad; })); },
  async sortAnnounce(root) { return withSite(root, SORT_ROWS(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, JOHN_WIDTH);
    if ((await tab.eval("document.querySelector('#loadNote').getAttribute('role')")) !== "status") bad.push("the count line is not a status region");
    await pickSort(tab, "closes_asc"); await sleep(150);
    if (!/^Sorted by Closes, soonest first\. 8 of 8 openings$/.test((await text(tab, "#loadNote")) || "")) bad.push("the live region reads '" + (await text(tab, "#loadNote")) + "'");
    await pickSort(tab, "title_desc"); await sleep(150);
    if (!/^Sorted by Title, Z to A\./.test((await text(tab, "#loadNote")) || "")) bad.push("the live region reads '" + (await text(tab, "#loadNote")) + "' after Title Z to A");
    await pill(tab, "Live"); await sleep(150);
    if (/^Sorted by/.test((await text(tab, "#loadNote")) || "")) bad.push("the sentence is repeated when a pill is pressed: '" + (await text(tab, "#loadNote")) + "'");
    return bad; })); },
  // ---- the keyboard
  async keyboard(root) { return withSite(root, SORT_ROWS(), (site) => withTab(async (tab) => { const bad = [];
    await openDash(tab, site, JOHN_WIDTH);
    await tab.eval("document.querySelector('#textFilter').focus()");
    await tab.key("Tab");
    if (!(await tab.eval("document.activeElement && document.activeElement.id === 'sortBox'"))) bad.push("Tab from the search box did not reach the sort box: " + (await tab.eval("document.activeElement && (document.activeElement.id || document.activeElement.tagName)")));
    await tab.key("Tab");
    if (!(await tab.eval("document.activeElement && document.activeElement.tagName === 'A' && /edit\\.html/.test(document.activeElement.getAttribute('href'))"))) bad.push("Tab from the sort box did not reach the first row's Edit link");
    // a change moves no focus
    await tab.eval("document.querySelector('#sortBox').focus()");
    await pickSort(tab, "title_asc"); await sleep(150);
    if (!(await tab.eval("document.activeElement && document.activeElement.id === 'sortBox'"))) bad.push("changing the sort moved the focus");
    await pill(tab, "Live"); await sleep(100);
    // the select is a native one with its label
    if (!(await tab.eval("document.querySelector('#sortBox').tagName === 'SELECT' && document.querySelector('#sortBox').labels.length === 1"))) bad.push("the sort box is not a native select with one label");
    const r = await tab.eval("(() => { const s = document.querySelector('#sortBox').getBoundingClientRect(); return { w: s.width, h: s.height }; })()");
    if (r.w < 24 || r.h < 24) bad.push("the sort box is " + r.w + " x " + r.h + " (at least 24)");
    return bad; })); },
  // ---- the phone list
  async phoneList(root) { return withSite(root, johnsRows(), (site) => withTab(async (tab) => { const bad = [];
    for (const width of [390, 640]) {
      await openDash(tab, site, width, true);
      const r = await tab.eval(`(() => {
        const tr = Array.from(document.querySelectorAll('tbody tr')).find((x) => /Closing In Three Days/.test(x.textContent)), cl = tr.querySelector('td[data-label="Closes"]'), dt = cl.querySelector('.dt'), fl = cl.querySelector('[data-part="flag"]');
        const cr = cl.getBoundingClientRect(), dr = dt.getBoundingClientRect(), fr = fl.getBoundingClientRect(), tc = tr.querySelector('td'), sel = document.querySelector('#sortBox').getBoundingClientRect();
        return { pageScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, dtLeft: Math.round(dr.left - cr.left), dtTop: Math.round(dr.top - cr.top), flagLeft: Math.round(fr.left - cr.left), flagTop: Math.round(fr.top - dr.bottom),
          added: !!tc.querySelector('[data-part="added"]'), cellsLabels: Array.from(tr.querySelectorAll('td')).map((t) => t.getAttribute('data-label')), selW: Math.round(sel.width), rowH: Math.round(tr.getBoundingClientRect().height), headsVisible: Array.from(document.querySelectorAll('thead th')).some((t) => t.getBoundingClientRect().width > 2) };
      })()`);
      if (r.pageScroll) bad.push(width + ": the page scrolls sideways");
      if (r.dtLeft < 100 || r.dtTop > 12) bad.push(width + ": the Closes value moved: " + JSON.stringify({ left: r.dtLeft, top: r.dtTop }));
      if (r.flagLeft < 100) bad.push(width + ": the flag is under the label, not under the value: " + r.flagLeft);
      if (!r.added) bad.push(width + ": no Added line in the title block");
      if (r.cellsLabels.includes("Added") || r.cellsLabels.includes("Applicant cap")) bad.push(width + ": the list still has the cells " + JSON.stringify(r.cellsLabels));
      if (r.selW < 100) bad.push(width + ": the sort box is " + r.selW + " pixels wide");
      if (r.headsVisible) bad.push(width + ": column headings show on the phone list");
      // the sort box works there too
      await pickSort(tab, "title_asc"); await sleep(150);
      const t = await titles(tab), sorted = t.slice().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
      if (!sameList(t, sorted)) bad.push(width + ": Title A to Z on the phone list is " + JSON.stringify(t));
    }
    return bad; })); },
};

for (const [name, run] of Object.entries(SCENARIOS)) {
  test("prompt BP, " + name, { timeout: 300000 }, async () => {
    if (name === "constantMoves") {
      // run on the real site (flags exist), then on a copy where the ONE constant is 3: every flag and the Expiring pill move together
      const bad = await run(ROOT);
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-bp-const-"));
      try {
        fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
        const p = path.join(dir, "js", "dashboard-model.js"), s0 = fs.readFileSync(p, "utf8"), s1 = s0.replace(/export const EXPIRY_FLAG_DAYS = 7;/, "export const EXPIRY_FLAG_DAYS = 3;");
        assert.notEqual(s0, s1, "the constant was not found");
        fs.writeFileSync(p, s1);
        await withSite(dir, johnsRows(), (site) => withTab(async (tab) => {
          await openDash(tab, site, JOHN_WIDTH);
          const m = await tab.eval(MEASURE);
          const f = (t) => (m.rows.find((r) => r.title === t) || {}).flag;
          // with 3 days: "Closing In Three Days" (3 days and an hour) and the 4 and 5 day rows lose their flags
          for (const t of ["Closing In Three Days", "Draft Near The End", "Paused Closing In Four Days"]) if (f(t) !== "") bad.push("with the constant at 3 '" + t + "' still reads '" + f(t) + "'");
          await pill(tab, "Expiring"); await sleep(200);
          if ((await titles(tab)).length !== 0) bad.push("with the constant at 3 the Expiring pill still holds " + JSON.stringify(await titles(tab)));
        }));
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
      assert.deepEqual(bad, [], bad.join("\n"));
      return;
    }
    const bad = await run(ROOT);
    assert.deepEqual(bad, [], bad.join("\n"));
  });
}

// ---- negative controls: one defect at a time; each must make a scenario fail
const DEFECTS = [
  ["the Applicant cap column is back", [["js/pages/dashboard.js", (s) => s.replace('["Title", "Req #", "Opening ID", ...(showStatus ? ["Status"] : []), "Actions", "Closes", ...(COMMENTS_VISIBLE ? ["Comments"] : [])]', '["Title", "Req #", "Opening ID", ...(showStatus ? ["Status"] : []), "Actions", "Closes", "Applicant cap", ...(COMMENTS_VISIBLE ? ["Comments"] : [])]')]], ["capGone"]],
  ["the Added line is gone from the title cell", [["js/pages/dashboard.js", (s) => s.replace('      h("div", { class: "row-sub", "data-part": "added" }, addedCell(p))),', "      null),")]], ["addedUnderTitle", "phoneList"]],
  ["the Status column is always there", [["js/dashboard-model.js", (s) => s.replace("export const showsStatusColumn = (filterKey) => statusesIn(filterKey).length > 1;", "export const showsStatusColumn = (filterKey) => true;")]], ["statusColumn"]],
  ["the Status column is never there", [["js/dashboard-model.js", (s) => s.replace("export const showsStatusColumn = (filterKey) => statusesIn(filterKey).length > 1;", "export const showsStatusColumn = (filterKey) => false;")]], ["statusColumn"]],
  ["the flag is never drawn", [["js/pages/dashboard.js", (s) => s.replace("const flag = expiryFlag(p, now);", 'const flag = "";')]], ["flag"]],
  ["the flag covers 8 days", [["js/dashboard-model.js", (s) => s.replace("export const EXPIRY_FLAG_DAYS = 7;", "export const EXPIRY_FLAG_DAYS = 8;")]], ["constantMoves", "flag"]],
  ["the flag is on a closed opening too", [["js/dashboard-model.js", (s) => s.replace('if ((p.status === "live" || p.status === "paused") && typeof p.expiration_date === "string") return p.expiration_date;', 'if (typeof p.expiration_date === "string") return p.expiration_date;')]], ["flag"]],
  ["the flag is pale (colour alone, no contrast)", [["app.css", (s) => s.replace(".row-flag{font-size:12px;font-weight:600;color:#8A4B00;", ".row-flag{font-size:12px;font-weight:600;color:#E0A860;")]], ["flag"]],
  ["Expiring holds nothing", [["js/dashboard-model.js", (s) => s.replace('case "expiring": return isExpiring(p, nowMs);', 'case "expiring": return false;')]], ["expiringPill"]],
  ["Expiring holds paused rows too", [["js/dashboard-model.js", (s) => s.replace('export const isExpiring = (p, nowMs) => p.status === "draft" && leftWithinFlag(p, nowMs) !== null && !isClosingSoon(p, nowMs);', 'export const isExpiring = (p, nowMs) => (p.status === "draft" || p.status === "paused") && leftWithinFlag(p, nowMs) !== null;')]], ["expiringPill"]],
  ["the pill has no empty message", [["js/pages/dashboard.js", (s) => s.replace('note.hidden = false; clear(note); note.append("No openings match this filter.");', "note.hidden = true;")]], ["expiringEmpty"]],
  ["the sort box has no Status option in a mixed view", [["js/pages/dashboard.js", (s) => s.replace('if (k !== "status" || showStatus) box.append(', 'if (k !== "status") box.append(')]], ["sortOptions"]],
  ["Closes sorts blanks first", [["js/dashboard-model.js", (s) => s.replace("if (x === null) return 1; if (y === null) return -1; return sign * (x - y) || tie(a, b);", "if (x === null) return -1; if (y === null) return 1; return sign * (x - y) || tie(a, b);")]], ["sortEach"]],
  ["Closes furthest first reverses the blanks too", [["js/dashboard-model.js", (s) => s.replace("if (x === null) return 1; if (y === null) return -1; return sign * (x - y) || tie(a, b);", "if (x === null) return -sign; if (y === null) return sign; return sign * (x - y) || tie(a, b);")]], ["sortEach"]],
  ["Title Z to A is A to Z", [["js/dashboard-model.js", (s) => s.replace("case \"title_desc\": return list.sort((a, b) => byTitle(b, a) || tie(a, b));", "case \"title_desc\": return list.sort((a, b) => byTitle(a, b) || tie(a, b));")]], ["sortEach"]],
  ["the sort ignores the pill and the search", [["js/pages/dashboard.js", (s) => s.replace("const shown = sortRows(state.rows.filter((p) => matchesFilter(p, state.filter, now) && matchesText(p, state.text)), key, now);", "const shown = state.rows.filter((p) => matchesFilter(p, state.filter, now) && matchesText(p, state.text));")]], ["sortEach", "sortWithPillAndSearch"]],
  ["the choice is forgotten when the pill changes", [["js/pages/dashboard.js", (s) => s.replace("onclick: () => { state.filter = key; render(); }", "onclick: () => { state.filter = key; state.sort = null; render(); }")]], ["sortWithPillAndSearch", "sortDefaults"]],
  ["Closing soon opens sorted by Added", [["js/dashboard-model.js", (s) => s.replace('(filterKey === "closing" || filterKey === "expiring" ? "closes_asc" : "added_desc")', '"added_desc"')]], ["sortDefaults", "expiringPill"]],
  ["the sort says nothing", [["js/pages/dashboard.js", (s) => s.replace("state.sort = k; state.announce = SORT_ANNOUNCE(item[1]);", "state.sort = k;")]], ["sortAnnounce"]],
  ["the sort sentence is repeated on every draw", [["js/pages/dashboard.js", (s) => s.replace('  state.announce = "";\n  fitTable();', "  fitTable();")]], ["sortAnnounce"]],
  ["the sort box is before the search box", [["dashboard.html", (s) => s.replace('    <div class="sort-box"><label for="sortBox">Sort by</label><select id="sortBox"></select></div>\n', "").replace('  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">\n    <div id="filters"', '  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">\n    <div class="sort-box"><label for="sortBox">Sort by</label><select id="sortBox"></select></div>\n    <div id="filters"')]], ["keyboard"]],
  ["the table is not fitted to the card (no fallback)", [["js/pages/dashboard.js", (s) => s.replace("if (!wide.matches || level === \"tight\" || card.scrollWidth <= card.clientWidth + 1) break;", "break;")]], ["smallerWindows"]],
  ["the side padding is back at 12 pixels", [["app.css", (s) => s.replace("  .my-openings thead th,.my-openings td{padding-left:8px;padding-right:8px}\n", "")]], ["at1100"]],
  ["the columns are not shrunk to their words", [["app.css", (s) => s.replace('  .my-openings td[data-label="Actions"],.my-openings td[data-label="Closes"],.my-openings td[data-label="Opening ID"],.my-openings td[data-label="Comments"],.my-openings td[data-label="Status"]{width:1%;white-space:nowrap}\n', "")]], ["johnsSize"]],   // prompt BR: Status joined the list
  ["the date pieces sit straight in the cell (a phone grid takes each as an item)", [["js/pages/dashboard.js", (s) => s.replace('return h("span", { class: "dt" }, ...out);', "return out;")]], ["phoneList"]],
];
test("negative controls: each defect makes a scenario fail", { timeout: 7200000 }, async () => {
  const missed = [];
  const only = process.env.FGJ_BP_ONLY;          // a part of a defect's label: runs only those (a restricted run is never evidence for a push)
  for (const [label, edits, scenarios] of DEFECTS) {
    if (only && !label.includes(only)) continue;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-bp-ctl-"));
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
