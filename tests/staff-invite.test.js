// staff-invite.test.js - the staff page "Companies to invite" in a real headless Chrome (prompt IV, November 6, 2026), the repo's own files and a fake backend (tests/fake-site.js: a FAKE of the three database functions
// is_staff, staff_invite_list and staff_invite_list_titles; no real project, no key, no token). Invented company names only.
//   signedout   a signed out visitor sees one plain line and no data, and nothing is sent to any database function
//   notstaff    a signed in candidate, a signed in employer, and a failed staff check each see "This page is not available." with no data, and the list function is never called
//   table       a staff person: the table (company, searches, different people with "at least" for an inexact count, first and last month, status as returned), the default dates, the sort both ways without a new request
//   filters     company (the whole name, any letter case; part of a name finds nothing), minimum, dates; each is passed to the database exactly; wrong values are refused on the page, with no request
//   titles      the Titles view of one company: the request (the dates of the list on screen, the company key, minimum 1), the rows, the focus on the heading, Back to the list and Escape return the focus to the button
//   states      the empty state, the error state (never the database's words), an answer with an extra key (an account code) refused whole, a titles failure, the sign in ending mid use
//   leak        nothing is stored in the browser, only the three functions are called (uncached), noindex, the rows are removed when the page is left, nothing links to the page
//   keyboard    a label on every control, the tab order, Enter in the company box, Enter on the button, Escape in the titles
//   layout      390 x 844 (phone) and 1280 x 900: nothing wider than the screen, the table is cards on a phone, the buttons are big enough to tap
// Then planted breakages: one deliberate defect at a time in a COPY of the repo, each must make a scenario (or the unit test) fail. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/staff-invite.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite } from "./fake-site.js";
import * as M from "../js/staff-invite-model.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

const STAFF = "staff@example.test", PLAIN = "cand@example.test";
const NAMES = ["Zeta Works", "Northwind Traders", "Acme Rockets", "Pilot Example Co"];
const FN = ["rpc:is_staff", "rpc:staff_invite_list", "rpc:staff_invite_list_titles"];
const PAGE = "/staff-invite.html";
const WANT_ROWS = [
  ["Zeta Works", "12", "at least 6", "Sep 2026", "Oct 2026", "registered, free", "Titles"],
  ["Northwind Traders", "7", "5", "Aug 2026", "Oct 2026", "No match", "Titles"],
  ["Acme Rockets", "3", "3", "Oct 2026", "Oct 2026", "No match", "Titles"],
  ["Pilot Example Co", "1", "1", "Oct 2026", "Oct 2026", "pilot partner", "Titles"],
];
const SNAP = `(() => {
  const $ = (id) => document.getElementById(id), txt = (el) => el.textContent.trim();
  return {
    gate: $("gate").hidden ? null : txt($("gateText")), areaHidden: $("area").hidden,
    heads: [...document.querySelectorAll("#listCard thead th")].map(txt),
    rows: [...document.querySelectorAll("#rows tr")].map((tr) => [...tr.children].map(txt)),
    count: txt($("countLine")), empty: $("emptyNote").hidden ? null : txt($("emptyNote")), alert: $("listAlert").hidden ? null : txt($("listAlert")),
    tableHidden: $("listCard").hidden, peopleNote: !$("peopleNote").hidden,
    titlesOpen: !$("titlesPanel").hidden, titlesHeading: txt($("titlesHeading")), titleRows: [...document.querySelectorAll("#titleRows tr")].map((tr) => [...tr.children].map(txt)),
    titlesAlert: $("titlesAlert").hidden ? null : txt($("titlesAlert")), titlesEmpty: $("titlesEmpty").hidden ? null : txt($("titlesEmpty")), titlesTableHidden: $("titlesCard").hidden,
    focus: document.activeElement ? (document.activeElement.id || document.activeElement.getAttribute("aria-label") || document.activeElement.tagName) : null,
    errors: ["fFrom", "fTo", "fCompany", "fMin"].map((id) => { const e = document.querySelector("[data-error-for=" + id + "]"); return e.hidden ? null : txt(e); }),
    invalid: ["fFrom", "fTo", "fCompany", "fMin"].filter((id) => $(id).getAttribute("aria-invalid") === "true"),
    fields: { from: $("fFrom").value, to: $("fTo").value, company: $("fCompany").value, min: $("fMin").value, sort: $("fSort").value },
    busy: $("showBtn").disabled, text: document.body.innerText,
  };
})()`;
const snap = (tab) => tab.eval(SNAP);
const listCalls = (site, from = 0) => site.calls.slice(from).filter((c) => c.name === "rpc:staff_invite_list");
const titleCalls = (site, from = 0) => site.calls.slice(from).filter((c) => c.name === "rpc:staff_invite_list_titles");
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function become(tab, site, email, kind = "candidate") {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  if (!email) return;
  await tab.goto(site.url + "/_dev/link?kind=" + kind + "&email=" + encodeURIComponent(email));
  await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
// open the page and wait until it has settled: a gate line, or the first list answer (rows, the empty note or the error line)
async function open(tab, site, email, kind) {
  await become(tab, site, email, kind);
  await tab.goto(site.url + PAGE);
  await tab.waitFor("!document.getElementById('gate').hidden || (!document.getElementById('area').hidden && (document.getElementById('countLine').textContent.indexOf('in this date range') >= 0 || !document.getElementById('listAlert').hidden))", 12000);
  await sleep(300);
  return snap(tab);
}
// fill the boxes (any of them) and press the button the way a person does; waits for the call (when one is expected) and for the page to settle
async function run(tab, site, v, expectCall = true) {
  const n0 = site.calls.length;
  await tab.eval("(() => { const v = " + JSON.stringify(v) + "; const set = (id, x) => { if (x !== undefined) document.getElementById(id).value = x; }; set('fFrom', v.from); set('fTo', v.to); set('fCompany', v.company); set('fMin', v.min); set('fSort', v.sort); document.getElementById('filters').requestSubmit(); })()");
  if (expectCall) { const until = Date.now() + 8000; while (site.calls.length === n0 && Date.now() < until) await sleep(80); }
  await tab.waitFor("!document.getElementById('showBtn').disabled", 8000); await sleep(350);
  return snap(tab);
}
const DEF = () => M.defaultRange(new Date());

// every scenario takes the root of the repo under test and answers a list of problems (empty = fine)
async function withPage(root, opts, fn) {
  const site = await startFakeSite(root, opts || {}), tab = await browser.newTab(), bad = [];
  try { await tab.focusEmulation(true); await tab.viewport(1280, false, 900); await fn({ site, tab, bad }); }
  catch (e) { bad.push("the scenario stopped: " + String(e.message).slice(0, 140)); }   // what was found before the stop is kept, and the stop is itself a problem
  finally { await tab.close(); await site.close(); }
  return bad;
}
const hasNone = (text, words) => words.filter((w) => text.includes(w));

const SCENARIOS = {
  async signedout(root) {
    return withPage(root, {}, async ({ site, tab, bad }) => {
      const s = await open(tab, site, null);
      if (s.gate !== M.SIGNED_OUT_TEXT) bad.push("signed out: the line is " + JSON.stringify(s.gate));
      if (!s.areaHidden || s.rows.length || s.tableHidden === false) bad.push("signed out: the filters or rows are showing");
      const named = hasNone(s.text, NAMES); if (named.length) bad.push("signed out: the page holds " + named.join(", "));
      const rpcs = site.calls.filter((c) => c.name.startsWith("rpc:")); if (rpcs.length) bad.push("signed out: the page asked the database: " + rpcs.map((c) => c.name).join(", "));
    });
  },
  async notstaff(root) {
    const bad = [];
    for (const [label, email, kind, extra] of [["a candidate", PLAIN, "candidate", {}], ["an employer", "poster@example.test", "poster", {}], ["a staff person whose check fails", STAFF, "candidate", { rpcFail: true }]]) {
      bad.push(...await withPage(root, extra, async ({ site, tab, bad: b }) => {
        const s = await open(tab, site, email, kind);
        if (s.gate !== M.NOT_AVAILABLE_TEXT) b.push(label + ": the line is " + JSON.stringify(s.gate));
        if (!s.areaHidden || s.rows.length || s.titlesOpen) b.push(label + ": the filters, rows or titles are showing");
        const named = hasNone(s.text, NAMES); if (named.length) b.push(label + ": the page holds " + named.join(", "));
        if (listCalls(site).length || titleCalls(site).length) b.push(label + ": the list function was called");
        if (!site.calls.some((c) => c.name === "rpc:is_staff")) b.push(label + ": the staff check was not asked");
        if (/[Ss]taff list|not staff|not on the list|permission/.test(s.gate || "")) b.push(label + ": the line hints at what exists");
      }));
    }
    return bad;
  },
  async table(root) {
    return withPage(root, {}, async ({ site, tab, bad }) => {
      const s = await open(tab, site, STAFF);
      if (s.gate !== null || s.areaHidden) bad.push("staff: the page did not open: " + JSON.stringify(s.gate));
      if (!eq(s.heads, ["Company", "Searches", "Different people", "First month", "Last month", "Status", "Titles"])) bad.push("staff: the headings are " + JSON.stringify(s.heads));
      if (!eq(s.rows, WANT_ROWS)) bad.push("staff: the rows are " + JSON.stringify(s.rows));
      if (s.count !== "4 companies in this date range.") bad.push("staff: the count line is " + JSON.stringify(s.count));
      if (!s.peopleNote) bad.push("staff: the note for an inexact count is missing"); if (s.empty !== null || s.alert !== null) bad.push("staff: an empty or error line shows");
      if (s.fields.sort !== "most") bad.push("staff: the sort starts as " + s.fields.sort);
      const d = DEF(), lc = listCalls(site);
      if (lc.length !== 1 || !eq(lc[0].body, { p_from: d.from, p_to: d.to, p_company: null, p_min_searches: 1 })) bad.push("staff: the first request was " + JSON.stringify(lc.map((c) => c.body)));
      if (s.fields.from !== d.from || s.fields.to !== d.to) bad.push("staff: the boxes start as " + s.fields.from + " to " + s.fields.to);
      const n = site.calls.length;
      await tab.eval("(() => { const el = document.getElementById('fSort'); el.value = 'fewest'; el.dispatchEvent(new Event('change', { bubbles: true })); })()"); await sleep(300);
      const f = await snap(tab);
      if (!eq(f.rows.map((r) => r[0]), ["Pilot Example Co", "Acme Rockets", "Northwind Traders", "Zeta Works"])) bad.push("sort fewest first: " + JSON.stringify(f.rows.map((r) => r[0])));
      if (site.calls.length !== n) bad.push("sorting asked the database again");
      await tab.eval("(() => { const el = document.getElementById('fSort'); el.value = 'most'; el.dispatchEvent(new Event('change', { bubbles: true })); })()"); await sleep(300);
      if (!eq((await snap(tab)).rows.map((r) => r[0]), NAMES)) bad.push("sort most first: not back to the first order");
    });
  },
  async filters(root) {
    return withPage(root, {}, async ({ site, tab, bad }) => {
      await open(tab, site, STAFF);
      const d = DEF();
      let n = site.calls.length, s = await run(tab, site, { company: "Zeta Works" });
      if (!eq(listCalls(site, n).map((c) => c.body), [{ p_from: d.from, p_to: d.to, p_company: "Zeta Works", p_min_searches: 1 }])) bad.push("company: the request was " + JSON.stringify(listCalls(site, n).map((c) => c.body)));
      if (!eq(s.rows.map((r) => r[0]), ["Zeta Works"]) || s.count !== "1 company in this date range.") bad.push("company: the rows are " + JSON.stringify(s.rows.map((r) => r[0])) + ", " + s.count);
      s = await run(tab, site, { company: "zeta works" }); if (!eq(s.rows.map((r) => r[0]), ["Zeta Works"])) bad.push("company in lower case: " + JSON.stringify(s.rows.map((r) => r[0])));
      s = await run(tab, site, { company: "  Zeta Works  " }); if (!eq(s.rows.map((r) => r[0]), ["Zeta Works"]) || site.calls.filter((c) => c.name === "rpc:staff_invite_list").pop().body.p_company !== "Zeta Works") bad.push("company with spaces is not trimmed");
      n = site.calls.length; s = await run(tab, site, { company: "Zeta" });
      if (s.rows.length !== 0 || s.empty !== M.EMPTY_TEXT || !s.tableHidden) bad.push("part of a name: rows " + s.rows.length + ", empty " + JSON.stringify(s.empty));
      if (listCalls(site, n)[0].body.p_company !== "Zeta") bad.push("part of a name: the request did not carry what was typed");
      n = site.calls.length; s = await run(tab, site, { company: "" });
      if (s.rows.length !== 4 || listCalls(site, n)[0].body.p_company !== null) bad.push("an empty company box must ask for every company (null)");
      n = site.calls.length; s = await run(tab, site, { min: "5" });
      if (listCalls(site, n)[0].body.p_min_searches !== 5 || !eq(s.rows.map((r) => r[0]), ["Zeta Works", "Northwind Traders"])) bad.push("minimum 5: request " + JSON.stringify(listCalls(site, n)[0].body) + ", rows " + JSON.stringify(s.rows.map((r) => r[0])));
      n = site.calls.length; s = await run(tab, site, { min: "" }); if (listCalls(site, n)[0].body.p_min_searches !== 1 || s.rows.length !== 4) bad.push("a blank minimum must be 1");
      n = site.calls.length; s = await run(tab, site, { from: "2026-09-15", to: "2026-10-31" });
      if (!eq(listCalls(site, n).map((c) => [c.body.p_from, c.body.p_to]), [["2026-09-15", "2026-10-31"]])) bad.push("dates: the request was " + JSON.stringify(listCalls(site, n).map((c) => c.body)));
      for (const [label, v, field, text] of [["from after to", { from: "2026-11-07", to: "2026-11-06" }, "fTo", M.checkInputs({ from: "2026-11-07", to: "2026-11-06", min: "1", company: "" }).errors.to], ["from in a later month than to", { from: "2026-12-01", to: "2026-11-06" }, "fTo", "The To date cannot be before the From date."], ["over 36 months", { from: "2023-10-31", to: "2026-11-01" }, "fTo", "Use a range of at most 36 months."], ["a minimum of 0", { from: "2026-08-01", to: "2026-11-06", min: "0" }, "fMin", "Enter a whole number from 1 to 100000."], ["no From date", { from: "", to: "2026-11-06", min: "1" }, "fFrom", "Enter the From date."]]) {
        n = site.calls.length; s = await run(tab, site, v, false);
        if (site.calls.length !== n) bad.push(label + ": a request was sent"); const shownErr = s.errors.filter(Boolean);
        if (!eq(shownErr, [text])) bad.push(label + ": the errors are " + JSON.stringify(s.errors)); if (!s.invalid.includes(field)) bad.push(label + ": " + field + " is not marked invalid"); if (s.focus !== field) bad.push(label + ": the focus is on " + s.focus + ", not " + field);
      }
    });
  },
  async titles(root) {
    return withPage(root, {}, async ({ site, tab, bad }) => {
      const s0 = await open(tab, site, STAFF); const d = DEF();
      const click = (name) => tab.eval("document.querySelector('#rows button[aria-label=\"Titles for " + name + "\"]').click()");
      const waitTitles = async () => { await tab.waitFor("!document.getElementById('titlesPanel').hidden && (!document.getElementById('titlesCard').hidden || !document.getElementById('titlesAlert').hidden || !document.getElementById('titlesEmpty').hidden)", 8000); await sleep(300); return snap(tab); };
      let n = site.calls.length; await click("Northwind Traders"); let s = await waitTitles();
      if (!eq(titleCalls(site, n).map((c) => c.body), [{ p_from: d.from, p_to: d.to, p_company: "northwind traders", p_min_searches: 1 }])) bad.push("titles: the request was " + JSON.stringify(titleCalls(site, n).map((c) => c.body)));
      if (s.titlesHeading !== "Titles searched for Northwind Traders") bad.push("titles: the heading is " + JSON.stringify(s.titlesHeading));
      if (!eq(s.titleRows, [["buyer", "5"], ["planner", "2"]])) bad.push("titles: the rows are " + JSON.stringify(s.titleRows));
      if (s.focus !== "titlesHeading") bad.push("titles: the focus is on " + s.focus);
      if (!eq(s.rows, s0.rows)) bad.push("titles: the list changed when the titles opened");
      await tab.eval("document.getElementById('titlesClose').click()"); await sleep(300); s = await snap(tab);
      if (s.titlesOpen || s.titleRows.length) bad.push("titles: Back to the list left the panel open");
      if (s.focus !== "Titles for Northwind Traders") bad.push("titles: after Back the focus is on " + s.focus);
      n = site.calls.length; await click("Zeta Works"); s = await waitTitles();
      if (!eq(s.titleRows, [["data analyst", "8"], ["(lookup by code)", "4"]])) bad.push("titles of Zeta Works: " + JSON.stringify(s.titleRows));
      await tab.key("Escape"); await sleep(300); s = await snap(tab);
      if (s.titlesOpen) bad.push("titles: Escape did not close the panel"); if (s.focus !== "Titles for Zeta Works") bad.push("titles: after Escape the focus is on " + s.focus);
      // the dates of the list on the screen are used, not what was typed since
      await tab.eval("document.getElementById('fFrom').value = '2026-01-01'"); n = site.calls.length; await click("Acme Rockets"); s = await waitTitles();
      if (titleCalls(site, n)[0].body.p_from !== d.from) bad.push("titles: the request used the typed date " + titleCalls(site, n)[0].body.p_from + " instead of the dates of the list on screen");
      // a new list closes the titles
      await run(tab, site, { from: d.from, company: "" }); s = await snap(tab); if (s.titlesOpen) bad.push("titles: a new list left the titles open");
    });
  },
  async states(root) {
    const bad = [];
    bad.push(...await withPage(root, { inviteRows: [] }, async ({ site, tab, bad: b }) => {
      const s = await open(tab, site, STAFF);
      if (s.empty !== "No searches for companies outside the system in this date range.") b.push("empty: the line is " + JSON.stringify(s.empty));
      if (!s.tableHidden || s.rows.length || s.alert !== null || s.count !== "0 companies in this date range.") b.push("empty: table " + s.tableHidden + ", alert " + s.alert + ", count " + s.count);
    }));
    bad.push(...await withPage(root, { inviteFails: true }, async ({ site, tab, bad: b }) => {
      const s = await open(tab, site, STAFF);
      if (s.alert !== M.LOAD_FAILED_TEXT) b.push("error: the line is " + JSON.stringify(s.alert));
      if (hasNone(s.text, ["SECRET", "boom", "XX000", "500"]).length) b.push("error: the database's words are on the page"); if (!s.tableHidden || s.rows.length || s.empty !== null) b.push("error: rows or the empty line show");
    }));
    bad.push(...await withPage(root, { inviteBadShape: true }, async ({ site, tab, bad: b }) => {
      const s = await open(tab, site, STAFF);
      if (s.alert !== M.LOAD_FAILED_TEXT) b.push("extra key: the line is " + JSON.stringify(s.alert)); if (s.rows.length || hasNone(s.text, ["account_hash", "Zeta Works"]).length) b.push("extra key: the data was shown");
    }));
    bad.push(...await withPage(root, { inviteTitlesFail: true }, async ({ site, tab, bad: b }) => {
      await open(tab, site, STAFF);
      await tab.eval("document.querySelector('#rows button').click()"); await tab.waitFor("!document.getElementById('titlesAlert').hidden", 8000); await sleep(300); const s = await snap(tab);
      if (s.titlesAlert !== M.TITLES_FAILED_TEXT) b.push("titles error: the line is " + JSON.stringify(s.titlesAlert)); if (hasNone(s.text, ["SECRET", "boom"]).length) b.push("titles error: the database's words are on the page"); if (!s.titlesTableHidden || s.titleRows.length) b.push("titles error: rows show");
      if (!s.rows.length) b.push("titles error: the list was taken away");
    }));
    bad.push(...await withPage(root, {}, async ({ site, tab, bad: b }) => {
      await open(tab, site, STAFF);
      await tab.eval("document.querySelector('#rows button').click()"); await tab.waitFor("!document.getElementById('titlesCard').hidden", 8000);
      await tab.eval("localStorage.clear()");
      await tab.eval("document.getElementById('filters').requestSubmit()"); await tab.waitFor("!document.getElementById('gate').hidden", 8000); await sleep(300); const s = await snap(tab);
      if (s.gate !== M.SESSION_ENDED_TEXT) b.push("sign in ended: the line is " + JSON.stringify(s.gate)); if (!s.areaHidden || s.rows.length || s.titlesOpen || hasNone(s.text, NAMES).length) b.push("sign in ended: data is still on the page");
    }));
    return bad;
  },
  async leak(root) {
    return withPage(root, {}, async ({ site, tab, bad }) => {
      await become(tab, site, STAFF);
      const before = await tab.eval("JSON.stringify([Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort()])");
      const start = site.calls.length;
      await tab.goto(site.url + PAGE);
      await tab.waitFor("document.getElementById('countLine').textContent.indexOf('in this date range') >= 0", 12000); await sleep(300);
      await tab.eval("document.querySelector('#rows button').click()"); await tab.waitFor("!document.getElementById('titlesCard').hidden", 8000); await sleep(200);
      const after = await tab.eval("JSON.stringify([Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort()])");
      if (before !== after) bad.push("storage changed: " + before + " -> " + after);
      const all = await tab.eval("JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), document.cookie, window.name, history.state])");
      const named = hasNone(all, NAMES.concat(["northwind traders", "zeta works"])); if (named.length) bad.push("the browser keeps " + named.join(", "));
      const rpcs = site.calls.slice(start); const other = rpcs.filter((c) => !FN.includes(c.name)); if (other.length) bad.push("other calls were made: " + other.map((c) => c.name).join(", "));
      if (rpcs.some((c) => !c.cacheControl || !/no-cache|no-store/.test(c.cacheControl))) bad.push("a database call may be cached");
      const meta = await tab.eval("(document.querySelector('meta[name=robots]') || {}).content || null"); if (meta !== "noindex, nofollow") bad.push("the robots tag is " + JSON.stringify(meta));
      await tab.eval("window.dispatchEvent(new Event('pagehide'))"); await sleep(200);
      const w = await tab.eval("document.getElementById('area').textContent"); const left = hasNone(w, NAMES).concat(snapRowsLeft(await snap(tab))); if (left.length) bad.push("leaving the page left data in it: " + left.join(", "));
      // nothing links to the page
      const linkers = [];
      const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (!/^(\.git|node_modules|tests)$/.test(e.name)) walk(p); } else if (/\.(html|js|css|txt|xml|json)$/.test(e.name)) { const rel = path.relative(root, p).split(path.sep).join("/"); if (!/^(staff-invite\.html|js\/pages\/staff-invite\.js|js\/staff-invite-model\.js)$/.test(rel) && /staff-invite/.test(fs.readFileSync(p, "utf8").replace(/\?v=[0-9a-f]{8}/g, ""))) linkers.push(rel); } } };
      walk(root); if (linkers.length) bad.push("these files name the page: " + linkers.join(", "));
    });
  },
  async keyboard(root) {
    return withPage(root, {}, async ({ site, tab, bad }) => {
      await open(tab, site, STAFF);
      const lab = await tab.eval("JSON.stringify(['fFrom','fTo','fCompany','fMin','fSort'].map((id) => { const l = document.querySelector('label[for=' + id + ']'); return [id, l ? l.textContent.trim() : null]; }))");
      if (!eq(JSON.parse(lab), [["fFrom", "From"], ["fTo", "To"], ["fCompany", "Company"], ["fMin", "Minimum searches"], ["fSort", "Sort by searches"]])) bad.push("labels: " + lab);
      const desc = await tab.eval("(() => { const d = document.getElementById('fCompany').getAttribute('aria-describedby'); const e = d && document.getElementById(d); return e ? e.textContent.trim() : null; })()");
      if (desc !== M.COMPANY_NOTE) bad.push("the company box is not tied to its note: " + JSON.stringify(desc));
      const order = await tab.eval("JSON.stringify([...document.querySelectorAll('#area input, #area select, #area button')].filter((e) => !e.closest('[hidden]') && e.tabIndex >= 0).map((e) => e.id || e.getAttribute('aria-label')))");
      if (!eq(JSON.parse(order), ["fFrom", "fTo", "fCompany", "fMin", "fSort", "showBtn", "Titles for Zeta Works", "Titles for Northwind Traders", "Titles for Acme Rockets", "Titles for Pilot Example Co"])) bad.push("tab order: " + order);
      if (await tab.eval("[...document.querySelectorAll('[tabindex]')].some((e) => e.tabIndex > 0)")) bad.push("a positive tabindex");
      await tab.eval("document.getElementById('fCompany').focus()");
      await tab.key("Tab"); if ((await snap(tab)).focus !== "fMin") bad.push("Tab from Company did not reach Minimum searches");
      await tab.key("Tab"); if ((await snap(tab)).focus !== "fSort") bad.push("Tab from Minimum did not reach Sort");
      await tab.key("Tab"); if ((await snap(tab)).focus !== "showBtn") bad.push("Tab from Sort did not reach the button");
      let n = site.calls.length; await tab.key("Enter"); await sleep(600);
      if (listCalls(site, n).length !== 1) bad.push("Enter on the button did not ask for the list once");
      await tab.key("Tab"); let s = await snap(tab); if (s.focus !== "Titles for Zeta Works") bad.push("Tab from the button did not reach the first Titles button: " + s.focus);
      n = site.calls.length; await tab.key("Enter"); await tab.waitFor("!document.getElementById('titlesCard').hidden", 8000); s = await snap(tab);
      if (titleCalls(site, n).length !== 1 || s.focus !== "titlesHeading" || !s.titlesOpen) bad.push("Enter on a Titles button: calls " + titleCalls(site, n).length + ", focus " + s.focus);
      await tab.key("Tab"); s = await snap(tab); if (s.focus !== "titlesClose") bad.push("Tab from the titles heading did not reach Back to the list: " + s.focus);
      await tab.key("Enter"); await sleep(300); s = await snap(tab); if (s.titlesOpen || s.focus !== "Titles for Zeta Works") bad.push("Back to the list with Enter: open " + s.titlesOpen + ", focus " + s.focus);
      await tab.eval("document.getElementById('fCompany').focus(); document.getElementById('fCompany').value = 'Acme Rockets'"); n = site.calls.length; await tab.key("Enter"); await sleep(700);
      if (listCalls(site, n).length !== 1 || listCalls(site, n)[0].body.p_company !== "Acme Rockets") bad.push("Enter in the company box did not submit the list");
    });
  },
  async layout(root) {
    const bad = [];
    for (const [label, w, h, phone] of [["phone 390x844", 390, 844, true], ["computer 1280x900", 1280, 900, false]]) {
      bad.push(...await withPage(root, {}, async ({ site, tab, bad: b }) => {
        await tab.viewport(w, phone, h);
        await open(tab, site, STAFF);
        await tab.eval("document.querySelector('#rows button').click()"); await tab.waitFor("!document.getElementById('titlesCard').hidden", 8000); await sleep(400);
        const m = await tab.eval(`(() => { const r = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height), Math.round(b.right)]; };
          const td = document.querySelector('#rows td'), th = document.querySelector('#listCard thead th');
          return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, show: r(document.getElementById('showBtn')), titles: r(document.querySelector('#rows button')), close: r(document.getElementById('titlesClose')),
            cardLike: getComputedStyle(td).display !== 'table-cell', headVisible: th.getBoundingClientRect().width > 4 && getComputedStyle(th).position !== 'absolute',
            fields: [...document.querySelectorAll('#filters input, #filters select')].map((e) => r(e)[2]) }; })()`);
        if (m.sw > m.iw) b.push(label + ": the page is " + m.sw + " wide in a " + m.iw + " window");
        if (m.fields.some((x) => x > m.iw)) b.push(label + ": a field reaches past the screen");
        if (phone) {
          if (!m.cardLike) b.push(label + ": the table is not shown as cards");
          for (const [n, v] of [["Show companies", m.show], ["Titles", m.titles], ["Back to the list", m.close]]) if (v[0] < 44 || v[1] < 44) b.push(label + ": the " + n + " button is " + v[0] + " x " + v[1] + " (44 x 44 is the least)");
        } else if (m.cardLike || !m.headVisible) b.push(label + ": the table lost its columns on a computer");
      }));
    }
    return bad;
  },
  // the pure parts, in the copy under test (so a defect made in a copy of the code is seen by the unit tests as well)
  async unit(root) {
    const env = Object.assign({}, process.env); delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, ["--test", path.join(root, "tests", "staff-invite.unit.test.js")], { cwd: root, env, encoding: "utf8", timeout: 300000 });
    if (r.status === 0) return [];
    const first = (r.stdout.match(/^\s*(?:✖|not ok \d+ -) (.+?)(?: \(\d[\d.]*ms\))?$/m) || [])[1];
    return ["staff-invite.unit.test.js fails: " + (first || String(r.stderr || r.stdout).slice(0, 120)).slice(0, 160)];
  },
};
const snapRowsLeft = (s) => (s.rows.length ? ["table rows"] : []).concat(s.titleRows.length ? ["title rows"] : [], s.titlesHeading ? ["titles heading"] : []);

// ---- the tests ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const go = async (name) => { const t0 = Date.now(), bad = await SCENARIOS[name](ROOT); console.log("scenario " + name + ": " + ((Date.now() - t0) / 1000).toFixed(0) + " s, " + bad.length + " problems"); assert.deepEqual(bad, [], name + " problems:\n" + bad.join("\n")); };
test("signed out: one plain line, no data, nothing asked of the database", { timeout: 300000 }, () => go("signedout"));
test("signed in but not staff (a candidate, an employer, a failed check): the same plain line, no data, the list is never called", { timeout: 300000 }, () => go("notstaff"));
test("staff: the table, the default dates, the sort both ways without a new request", { timeout: 300000 }, () => go("table"));
test("staff: company (whole name), minimum and dates reach the database exactly; wrong values are refused on the page", { timeout: 300000 }, () => go("filters"));
test("staff: the Titles view, its request, its focus, Back to the list and Escape", { timeout: 300000 }, () => go("titles"));
test("staff: the empty state, the error state, an extra key refused, a titles failure, the sign in ending", { timeout: 300000 }, () => go("states"));
test("nothing stored, only three functions called and uncached, noindex, rows removed on leaving, nothing links to the page", { timeout: 300000 }, () => go("leak"));
test("the keyboard: labels, tab order, Enter in the box and on the buttons, Escape", { timeout: 300000 }, () => go("keyboard"));
test("390 and 1280 wide: nothing wider than the screen, cards on a phone, big enough buttons", { timeout: 300000 }, () => go("layout"));

// ---- planted breakages: one deliberate defect at a time in a copy of the repository; each must make a scenario (or the unit test) fail ---------------------------------------------------------------------------------
const PG = "js/pages/staff-invite.js", MD = "js/staff-invite-model.js", API = "js/api.js", HT = "staff-invite.html";
const DEFECTS = [
  ["a person who is not staff is shown the page (the staff check is skipped)", [["notstaff"]], [[PG, (s) => s.replace("if (!(staff.ok && staff.data === true)) {", "if (false) {")]]],
  ["any answer of the staff check is trusted, not only a clear true", [["notstaff"]], [[PG, (s) => s.replace("staff.ok && staff.data === true", "staff.ok")]]],
  ["a signed out visitor is not stopped at the first line", [["signedout"]], [[PG, (s) => s.replace("if (!session) { showGate(SIGNED_OUT_TEXT); return; }", "")]]],
  ["the list asks the older report function", [["table"]], [[API, (s) => s.replace('rpc("staff_invite_list", q,', 'rpc("search_event_invite_list_report_staff", q,')]]],
  ["the titles ask the gated not found report", [["titles"]], [[API, (s) => s.replace('rpc("staff_invite_list_titles", q,', 'rpc("search_event_not_found_report", q,')]]],
  ["the date filter is dropped (always the same From date)", [["table"], ["filters"]], [[MD, (s) => s.replace("p_from: String(from).trim()", 'p_from: "2000-01-01"')]]],
  ["the sort is the wrong way round", [["table"], ["unit"]], [[MD, (s) => s.replace('const sign = dir === "fewest" ? 1 : -1;', 'const sign = dir === "fewest" ? -1 : 1;')]]],
  ["the sort choice is ignored", [["table"]], [[PG, (s) => s.replace("const list = sortRows(rows, fSort.value);", "const list = rows.slice();")]]],
  ["the company box is not sent", [["filters"], ["unit"]], [[MD, (s) => s.replace('p_company: c === "" ? null : c', "p_company: null")]]],
  ["the minimum is not sent", [["filters"], ["unit"]], [[MD, (s) => s.replace("p_min_searches: m }", "p_min_searches: 1 }")]]],
  ["the titles ask for every company", [["titles"]], [[PG, (s) => s.replace("p_company: row.company_key, p_min_searches: 1", "p_company: null, p_min_searches: 1")]]],
  ["the titles use the dates typed since, not those of the list on screen", [["titles"]], [[PG, (s) => s.replace("p_from: shown.p_from, p_to: shown.p_to", "p_from: fFrom.value, p_to: shown.p_to")]]],
  ["an error shows technical words", [["states"]], [[PG, (s) => s.replace('kind === "range" ? RANGE_REFUSED_TEXT : LOAD_FAILED_TEXT', 'kind === "range" ? RANGE_REFUSED_TEXT : "Error " + r.status + " " + r.error.code')]]],
  ["the noindex tag is gone", [["leak"]], [[HT, (s) => s.replace('<meta name="robots" content="noindex, nofollow">', '<meta name="robots" content="index, follow">')]]],
  ["a public page links to the staff page", [["leak"]], [["index.html", (s) => s.replace("</footer>", '<a href="staff-invite.html">Staff</a></footer>')]]],
  ["the rows stay in the page when it is left", [["leak"]], [[PG, (s) => s.replace('window.addEventListener("pagehide", () => { wipe(); });', "")]]],
  ["the list is kept in the browser's session storage", [["leak"]], [[PG, (s) => s.replace("  rows = r.data; shown = checked.args;", "  rows = r.data; shown = checked.args; try { sessionStorage.setItem('last-list', JSON.stringify(r.data)); } catch (e) { /* planted */ }")]]],
  ["an inexact count is shown as exact", [["table"], ["unit"]], [[MD, (s) => s.replace('row.people_exact === false ? "at least " + row.different_people : String(row.different_people)', "String(row.different_people)")]]],
  ["a company with no status gets a word of judgment", [["table"], ["unit"]], [[MD, (s) => s.replace('row.status : "No match")', 'row.status : "Not in the system")')]]],
  ["the empty state says something else", [["states"], ["unit"]], [[MD, (s) => s.replace("No searches for companies outside the system in this date range.", "Nothing found.")]]],
  ["an answer with an extra key (an account code) is accepted", [["states"], ["unit"]], [[API, (s) => s.replace("Object.keys(r).length === 9 && isStr(r.company)", "isStr(r.company)")]]],
  ["a sign in that has ended keeps the data on the page", [["states"]], [[PG, (s) => s.replace('if (kind === "session") { showGate(SESSION_ENDED_TEXT); return; }', 'if (kind === "session") { say(listAlert, "error", LOAD_FAILED_TEXT); return; }')]]],
  ["the company box has no label", [["keyboard"]], [[HT, (s) => s.replace('<label for="fCompany">Company</label>', "")]]],
  ["the company box is not tied to its note", [["keyboard"]], [[HT, (s) => s.replace(' aria-describedby="companyHint"', "")]]],
  ["the Titles button has no name of its company", [["keyboard"], ["titles"]], [[PG, (s) => s.replace('"aria-label": "Titles for " + r.company, ', "")]]],
  ["the list has no minimum of 44 pixels on a phone (the Show button is small)", [["layout"]], [["app.css", (s) => s + "\n#showBtn{min-height:0!important;height:30px!important;padding:0 8px!important}\n"]]],
  ["a wrong date range is sent to the database", [["filters"], ["unit"]], [[MD, (s) => s.replace("(f.y * 12 + f.mo) > (t.y * 12 + t.mo) ||", "false ||")]]],
  ["Escape no longer closes the titles", [["titles"], ["keyboard"]], [[PG, (s) => s.replace('if (ev.key === "Escape") { ev.preventDefault(); closeTitles(true); }', "")]]],
];
test("planted breakages: each deliberate defect in the staff page makes a scenario fail", { timeout: 6000000 }, async () => {
  const missed = [], only = process.env.FGJ_IV_ONLY ? process.env.FGJ_IV_ONLY.split("|") : null;
  let n = 0;
  for (const [label, scenarios, edits] of DEFECTS) {
    if (only && !only.some((x) => label.includes(x))) continue;
    n++;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-invite-ctl-")), t0 = Date.now();
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) {
        const p = path.join(dir, rel), before = fs.readFileSync(p, "utf8").replace(/\?v=[0-9a-f]{8}(?=["'`])/g, ""), after = mutate(before);
        assert.notEqual(after, before, "the defect '" + label + "' changed nothing in " + rel);
        fs.writeFileSync(p, after);
      }
      const found = [];
      for (const [name] of scenarios) {
        // a defect that breaks the page so badly that the scenario cannot even run is caught too, and the log says so ("could not run")
        try { found.push(...(await SCENARIOS[name](dir)).map((x) => name + ": " + x)); } catch (e) { found.push(name + ": the scenario could not run (" + String(e.message).slice(0, 90) + ")"); }
      }
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  [" + ((Date.now() - t0) / 1000).toFixed(0) + " s]  (" + found[0].slice(0, 150) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  console.log("planted breakages run: " + n + ", missed: " + missed.length);
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
