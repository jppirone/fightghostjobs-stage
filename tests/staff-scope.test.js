// staff-scope.test.js - the staff-only search scope in a real browser (October 8, 2026). The repo's own files and a fake backend (tests/fake-site.js: a FAKE of the two database functions is_staff and staff_search_openings; no real project, no key, no network).
//
// WHAT IS PROVEN: (1) a signed-out visitor and a signed-in person who is NOT staff get exactly the same page and the same results with scope=all as without it (the same markup, the same candidate search, no banner, no staff word, the same robots tag);
// any other value of scope (ALL, empty, live, repeated) does not even ask the database; (2) a staff person with scope=all sees the banner, gets every status with its label and nothing to act on (no details window, no comment, no report, no apply link),
// the page is marked noindex, the request is never cached, nothing is written to the browser's storage and NO candidate function is called (so nothing is counted, recorded or emailed); (3) with the database functions missing, erroring, or the staff search failing
// the page falls back to exactly the normal live-only search; (4) a page kept for Back holds no staff results.
// Then negative controls: one defect at a time in the page code (it trusts the address, no noindex, the banner stays after a fallback, results kept for Back, the wrong banner); each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/staff-scope.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite, STAFF_ROWS } from "./fake-site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

const STAFF = "staff@example.test", PLAIN = "cand@example.test";
const BANNER = "Staff view: showing all openings, including ones that are not live.";

// signed out ("out"), or signed in through the fake emailed link as a candidate ("cand") or an employer ("poster") with the given address; then the search page with the given query string
async function openSearch(tab, site, who, email, query) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  if (who !== "out") { await tab.goto(site.url + "/_dev/link?kind=" + (who === "cand" ? "candidate" : who) + "&email=" + encodeURIComponent(email || "")); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500); }
  const start = site.calls.length;
  await tab.goto(site.url + "/search.html" + (query || ""));
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(900);
  return start;
}
async function runSearch(tab, company, title) {
  await tab.eval("(() => { document.querySelector('#company').value = " + JSON.stringify(company) + "; document.querySelector('#titleq').value = " + JSON.stringify(title) + "; document.querySelector('#searchForm').requestSubmit(); })()");
  await tab.waitFor("(document.querySelectorAll('#results .card').length > 0 || /No matching/.test(document.querySelector('#resultCount').textContent)) && !document.querySelector('#searchBtn').disabled", 12000); await sleep(400);
}
const SNAP = `(() => ({
  banner: !!document.querySelector('#staffBanner'), bannerText: (document.querySelector('#staffBanner') || {}).textContent || null,
  robots: (document.querySelector('meta[name=robots]') || {}).content || null, main: document.querySelector('main').innerHTML, text: document.body.innerText,
  cards: [...document.querySelectorAll('#results .card')].map((c) => c.innerText.replace(/\\s+/g, ' ').trim()), buttons: [...document.querySelectorAll('#results button, #results a')].map((b) => b.textContent.trim()),
  count: document.querySelector('#resultCount').hidden ? null : document.querySelector('#resultCount').textContent, signin: !document.querySelector('#signinWrap').hidden, roleNotice: !document.querySelector('#roleNotice').hidden,
  storage: Object.keys(localStorage).sort().join(','), session: Object.keys(sessionStorage).sort().join(',') }))()`;
const names = (site, start) => site.calls.slice(start).map((c) => c.name);

async function withSite(root, opts, fn) { const site = await startFakeSite(root, opts); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }

const SCENARIOS = {
  // a signed-out visitor: scope=all changes NOTHING and asks nothing
  async signedOut(root) { return withSite(root, {}, (site) => withTab(async (tab) => { const bad = [];
    await openSearch(tab, site, "out", "", ""); const a = await tab.eval(SNAP);
    const s0 = await openSearch(tab, site, "out", "", "?scope=all"); const b = await tab.eval(SNAP);
    if (a.main !== b.main || a.text !== b.text) bad.push("a signed-out visitor sees a different page with scope=all");
    if (b.banner || /staff/i.test(b.text)) bad.push("a signed-out visitor sees the staff banner or the word staff");
    if (names(site, s0).some((n) => n.startsWith("rpc:"))) bad.push("a signed-out visitor made a database call: " + names(site, s0));
    return bad; })); },
  // a signed-in person who is not staff: the same page, the same results, the same candidate search; the only extra thing is one quiet question to the database
  async notStaff(root) { return withSite(root, {}, (site) => withTab(async (tab) => { const bad = [];
    await openSearch(tab, site, "cand", PLAIN, ""); await runSearch(tab, "Meridian", "Analyst"); const a = await tab.eval(SNAP);
    const s0 = await openSearch(tab, site, "cand", PLAIN, "?scope=all"); const pre = await tab.eval(SNAP); await runSearch(tab, "Meridian", "Analyst"); const b = await tab.eval(SNAP);
    if (JSON.stringify(a.cards) !== JSON.stringify(b.cards) || a.count !== b.count || a.main !== b.main) bad.push("a person who is not staff gets different results or markup with scope=all");
    if (b.banner || b.cards.length !== 2 || b.buttons.length !== 2) bad.push("not staff: a banner, or not exactly the 2 live results with their one button each (" + b.cards.length + " cards, " + b.buttons.length + " buttons)");
    if (/staff|draft|held for review/i.test(b.text)) bad.push("not staff: the page says a staff word");
    if (pre.robots !== a.robots) bad.push("not staff: the robots tag changed");
    const n = names(site, s0); if (n.filter((x) => x === "rpc:is_staff").length !== 1 || n.includes("rpc:staff_search_openings") || !n.includes("candidate-search")) bad.push("not staff: wrong calls " + n);
    return bad; })); },
  // any other value of scope does not even ask the database, even for a person who IS staff
  async otherValues(root) { return withSite(root, {}, (site) => withTab(async (tab) => { const bad = [];
    for (const q of ["?scope=ALL", "?scope=", "?scope=live", "?scope=all&scope=all", "?scope=all&scope=x", "?scopes=all", "?scope=%20all"]) {
      const s0 = await openSearch(tab, site, "cand", STAFF, q); const o = await tab.eval(SNAP);
      if (o.banner || names(site, s0).some((x) => x.startsWith("rpc:"))) bad.push(q + ": the staff scope was asked for or shown (" + names(site, s0) + ")");
    }
    return bad; })); },
  // a staff person: the banner, every status, nothing to act on, nothing written, nothing counted
  async staff(root, who = "cand") { return withSite(root, {}, (site) => withTab(async (tab) => { const bad = [];
    const s0 = await openSearch(tab, site, who, STAFF, "?scope=all"); await tab.waitFor("!!document.querySelector('#staffBanner')", 6000);
    const pre = await tab.eval(SNAP);
    if (pre.bannerText !== BANNER) bad.push("the banner is not exactly the agreed words: " + JSON.stringify(pre.bannerText));
    if (pre.signin || pre.roleNotice) bad.push("a staff person is shown the sign-in card or the employer notice");
    if (pre.robots !== "noindex, nofollow") bad.push("the staff page is not marked noindex, nofollow (" + pre.robots + ")");
    await runSearch(tab, "Meridian", "Analyst"); const o = await tab.eval(SNAP);
    if (o.cards.length !== STAFF_ROWS.length) bad.push("staff did not get every status: " + o.cards.length + " cards, expected " + STAFF_ROWS.length);
    for (const want of ["Live", "Draft", "Scheduled", "Held for review", "Paused", "Closed", "Expired"]) if (!o.cards.some((c) => c.includes(want))) bad.push("no card carries the status " + want);
    if (!/Stored as live/.test(o.cards.join(" "))) bad.push("the expired row does not say it is stored as live");
    if (o.buttons.length !== 0) bad.push("a staff card has something to press: " + JSON.stringify(o.buttons));
    if (/post comment|\breport\b|view opening details|\bapply\b|tell the employer|\bwatch\b/i.test(o.cards.join(" "))) bad.push("a staff card offers an action");
    if (o.count !== "7 matching openings") bad.push("the count line is " + JSON.stringify(o.count));
    if (o.storage !== pre.storage || o.session !== pre.session) bad.push("a staff search wrote to the browser's storage: " + pre.storage + " / " + o.storage);
    const n = names(site, s0);
    const counted = n.filter((x) => x.startsWith("candidate-") && x !== "candidate-session");   // candidate-session only confirms the session the top bar shows; every other candidate function counts, records or emails
    if (counted.length) bad.push("a staff view called a candidate function (those count and record): " + counted);
    if (!n.includes("rpc:staff_search_openings")) bad.push("the staff search was never asked: " + n);
    const rpcs = site.calls.slice(s0).filter((c) => c.name.startsWith("rpc:")); if (!rpcs.length || rpcs.some((c) => !c.cacheControl || !/no-cache|no-store/.test(c.cacheControl))) bad.push("a staff request may be cached: " + JSON.stringify(rpcs.map((c) => c.cacheControl)));
    if (!(await tab.eval("document.querySelector('#recap') && !document.querySelector('#recap').hidden"))) bad.push("no recap line after the staff search");
    // the page the browser keeps for Back holds no staff results
    await tab.eval("window.dispatchEvent(new Event('pagehide'))"); await sleep(150);
    const gone = await tab.eval(SNAP); if (gone.cards.length !== 0 || gone.count !== null) bad.push("staff results stay in a page that is left (pagehide)");
    return bad; })); },
  async staffEmployerSession(root) { return SCENARIOS.staff(root, "poster"); },
  // the database functions do not exist (the SQL is not run), the database errors, or the staff search fails after is_staff said yes: the normal search, nothing else
  async failClosed(root) { const bad = [];
    for (const [label, opts] of [["the functions are missing", { noRpc: true }], ["the database errors on is_staff", { rpcFail: true }], ["the staff search errors after is_staff said yes", { staffSearchFails: true }]]) {
      bad.push(...(await withSite(root, opts, (site) => withTab(async (tab) => { const b = [];
        const s0 = await openSearch(tab, site, "cand", STAFF, "?scope=all"); await sleep(300);
        await runSearch(tab, "Meridian", "Analyst"); const o = await tab.eval(SNAP); const n = names(site, s0);
        if (o.banner) b.push(label + ": the banner is still shown");
        if (o.cards.length !== 2 || o.buttons.length !== 2) b.push(label + ": not the normal live results (" + o.cards.length + " cards, " + o.buttons.length + " buttons)");
        if (/draft|held for review|scheduled|stored as/i.test(o.cards.join(" "))) b.push(label + ": a staff-only row is shown");
        if (!n.includes("candidate-search")) b.push(label + ": the normal search was not used (" + n + ")");
        if (o.signin) b.push(label + ": the sign-in card shows for a signed-in person");
        return b; }))).map((x) => x));
    }
    return bad; },
};

// the same page with the robots tag turned to "index, follow" (what a production site may carry), to prove the staff page still says noindex and the ordinary page is left alone
function robotsCopy(root) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-staff-robots-"));
  fs.cpSync(root, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
  const p = path.join(dir, "search.html"), s = fs.readFileSync(p, "utf8"); assert.ok(s.includes('<meta name="robots" content="noindex, nofollow">')); fs.writeFileSync(p, s.replace('<meta name="robots" content="noindex, nofollow">', '<meta name="robots" content="index, follow">'));
  return dir;
}
SCENARIOS.robots = async (root) => { const dir = robotsCopy(root); try { return await withSite(dir, {}, (site) => withTab(async (tab) => { const bad = [];
  await openSearch(tab, site, "cand", PLAIN, "?scope=all"); const a = await tab.eval(SNAP); if (a.robots !== "index, follow") bad.push("a person who is not staff had the robots tag changed (" + a.robots + ")");
  await openSearch(tab, site, "cand", STAFF, "?scope=all"); await tab.waitFor("!!document.querySelector('#staffBanner')", 6000); const b = await tab.eval(SNAP); if (b.robots !== "noindex, nofollow") bad.push("the staff page does not say noindex, nofollow (" + b.robots + ")");
  return bad; })); } finally { fs.rmSync(dir, { recursive: true, force: true }); } };

test("the staff search scope: nothing changes for anyone who is not staff; staff get every status read only, uncounted, uncached and noindex; any failure falls back to the normal search", { timeout: 600000 }, async () => {
  const problems = [];
  for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](ROOT)) problems.push(n + ": " + p);
  assert.deepEqual(problems, [], "staff scope problems:\n" + problems.join("\n"));
});

const DEFECTS = [
  ["the page trusts the address and never asks the database", ["notStaff", "signedOut"], [["js/pages/search.js", (s) => s.replace("if (r.ok && r.data === true) enterStaffMode();", "enterStaffMode();")]]],
  ["the page asks the database only for the answer true but treats any answer as yes", ["notStaff"], [["js/pages/search.js", (s) => s.replace("if (r.ok && r.data === true) enterStaffMode();", "if (r.ok) enterStaffMode();")]]],
  ["the staff page is not marked noindex", ["robots"], [["js/pages/search.js", (s) => s.replace('if (robots) robots.setAttribute("content", "noindex, nofollow");', "")]]],
  ["a person who is not staff gets the robots tag changed", ["robots"], [["js/pages/search.js", (s) => s.replace("const STAFF_REQUESTED = wantsStaffScope(location.search);", "const STAFF_REQUESTED = wantsStaffScope(location.search); if (STAFF_REQUESTED) { const m = document.querySelector('meta[name=robots]'); if (m) m.setAttribute('content', 'noindex, nofollow'); }")]]],
  ["the banner stays after a fallback", ["failClosed"], [["js/pages/search.js", (s) => s.replace('const banner = $("#staffBanner"); if (banner) banner.remove();', "")]]],
  ["a failed staff search shows nothing instead of the normal results", ["failClosed"], [["js/pages/search.js", (s) => s.replace("    leaveStaffMode();\n    return false;", "    return true;")]]],
  ["staff results stay in a page kept for Back", ["staff"], [["js/pages/search.js", (s) => s.replace('window.addEventListener("pagehide", () => { if (staffMode) {', 'window.addEventListener("pagehide", () => { if (false) {')]]],
  ["the banner words are changed", ["staff"], [["js/staff-scope.js", (s) => s.replace("including ones that are not live.", "including ones that are live.")]]],
  ["a staff card gets a details button (a candidate action)", ["staff"], [["js/pages/search.js", (s) => s.replace('h("div", { style: "display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;" }, staffChips(row).map(chip)));', 'h("div", { style: "display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;" }, staffChips(row).map(chip)), h("button", { type: "button", class: "btn btn-outline" }, "View opening details"));')]]],
  ["the staff search is counted: it calls the candidate search", ["staff"], [["js/pages/search.js", (s) => s.replace("    let r = await api.staffSearch(Object.assign({ p_company: c.value }, key));", "    await api.candidateSearch({ company: c.value, phrase: q.value });\n    let r = await api.staffSearch(Object.assign({ p_company: c.value }, key));")]]],
  ["the staff search saves the search in the browser", ["staff"], [["js/pages/search.js", (s) => s.replace("    let r = await api.staffSearch(Object.assign({ p_company: c.value }, key));", "    savePending(localStorage, { company: companyIn.value, q: queryIn.value, r: reqIn.value });\n    let r = await api.staffSearch(Object.assign({ p_company: c.value }, key));")]]],
  ["any other scope value (scope=ALL) is accepted", ["otherValues"], [["js/staff-scope.js", (s) => s.replace('all.length === 1 && all[0] === "all"', 'all.length >= 1 && all[0].toLowerCase() === "all"')]]],
  ["the staff request may be cached", ["staff"], [["js/api.js", (s) => s.replace('body: JSON.stringify(body === undefined ? {} : body), cache: "no-store" });\n      text = await res.text();\n    } catch {\n      return { ok: false, status: 0, error: { code: "network" } };\n    }\n    if (!res.ok) return { ok: false, status: res.status, error: { code: "refused" } };', 'body: JSON.stringify(body === undefined ? {} : body) });\n      text = await res.text();\n    } catch {\n      return { ok: false, status: 0, error: { code: "network" } };\n    }\n    if (!res.ok) return { ok: false, status: res.status, error: { code: "refused" } };')]]],
];
test("negative controls: each defect in the staff scope makes a scenario fail", { timeout: 1800000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-staff-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      for (const n of scenarios) found.push(...(await SCENARIOS[n](dir)).map((x) => n + ": " + x));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0] + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
