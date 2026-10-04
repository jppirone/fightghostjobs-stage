// signin-tabs.test.js - the emailed sign-in link opens in a NEW tab (October 4, 2026). Two real tabs in one headless browser profile, the repo's own files, a fake backend (tests/fake-site.js; no real project, no key).
//
// Proven here:
//   1. a search typed in tab A, sign-in completed in tab B: tab B refills the fields and RUNS the search once, tab A (in the background) updates itself (no reload) and does not run it a second time;
//   2. the same with no search typed; 3. a saved search that has expired is not used and is removed; 4. when tab A is the tab in front it runs the saved search itself, once;
//   5. the employer sign-in page: the new tab lands in the employer area (or on the page that sent the person to sign in) and tab A moves on by itself; 6. the comments page: the new tab lands on the same comments page and tab A shows the thread;
//   7. nothing typed ever goes to the server or into the sign-in request.
// Then negative controls: one deliberate defect at a time (saved search in tab-local storage, no listener in tab A, wrong landing page, saved search not cleared after use, kept past its expiry, a background tab that takes the saved search,
// the search put into the sign-in request) and each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/signin-tabs.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite, fakeJwt } from "./fake-site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF = "d21m48ybzqbfxxxxxxxx";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

const searchCalls = (site) => site.calls.filter((c) => c.name === "candidate-search").length;
async function clean(tab, site) { await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}"); }
const typeSearch = (tab) => tab.eval("(() => { document.querySelector('#company').value = 'Meridian Health'; document.querySelector('#titleq').value = 'Analyst'; document.querySelector('#searchForm').requestSubmit(); })()");
const askForLink = (tab, email) => tab.eval("(() => { document.querySelector('#candEmail').value = " + JSON.stringify(email) + "; document.querySelector('#signinForm').requestSubmit(); })()");
const sessionJson = (claims) => JSON.stringify({ access_token: fakeJwt(claims), refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });

// each scenario returns a list of what went wrong (empty = it works)
const SCENARIOS = {
  async candidateWithSearch(site) {
    const bad = []; site.calls.length = 0;
    const A = await browser.newTab(), B = await browser.newTab();
    try {
      await clean(A, site); await A.goto(site.url + "/search.html");
      if (!(await A.waitFor("!!document.querySelector('#signinWrap') && !document.querySelector('#signinWrap').hidden"))) bad.push("tab A does not show the verify card");
      await A.eval("window.__tabA = 'same page'");
      await typeSearch(A);
      if (!(await A.waitFor("!document.querySelector('#candEmailError').hidden"))) bad.push("tab A does not say the search is saved");
      const kept = JSON.parse((await A.eval("localStorage.getItem('fgj-pending-search')")) || "null");
      if (!kept) bad.push("the typed search is not in localStorage");
      else { const mins = (kept.exp - Date.now()) / 60000; if (mins < 55 || mins > 61) bad.push("the saved search does not expire in about an hour (" + Math.round(mins) + " minutes)"); }
      if ((await A.eval("sessionStorage.getItem('fgj-pending-search')")) !== null) bad.push("the typed search is also in tab-local storage");
      await askForLink(A, "reader@example.test");
      if (!(await A.waitFor("!document.querySelector('#candSent').hidden"))) bad.push("tab A does not say 'Check your email'");
      const otp = site.calls.filter((c) => c.name === "auth-otp");
      if (otp.length !== 1) bad.push("the sign-in request was made " + otp.length + " times");
      else if (/Meridian|Analyst|fgj-pending|company|titleq/i.test(otp[0].address + JSON.stringify(otp[0].body))) bad.push("the typed search was put into the sign-in request or its address");
      await A.setFront(false);                                   // the person has gone to their webmail tab
      await B.goto(site.url + "/_dev/link?kind=candidate");      // what the emailed link does, in a NEW tab
      if (!(await B.waitFor("location.pathname === '/search.html' && document.querySelectorAll('#results .card').length > 0", 12000))) bad.push("the new tab did not land on the search page with the saved search's results (it is at " + (await B.eval("location.pathname + ' fields=' + document.querySelector('#company').value + '|' + document.querySelector('#titleq').value")) + ")");
      else {
        if ((await B.eval("document.querySelector('#company').value + '|' + document.querySelector('#titleq').value")) !== "Meridian Health|Analyst") bad.push("the new tab did not refill the typed search");
      }
      if (await B.eval("localStorage.getItem('fgj-pending-search')") !== null) bad.push("the saved search was not removed after it was used");
      if (!(await A.waitFor("document.querySelector('#signinWrap').hidden === true && window.__tabA === 'same page'", 8000))) bad.push("tab A did not move to the signed-in state by itself (without a reload)");
      if (!(await A.eval("/Email verified/.test(document.querySelector('#navAccount').textContent)"))) bad.push("tab A's header does not show the signed-in state");
      if ((await A.eval("document.querySelector('#company').value + '|' + document.querySelector('#titleq').value")) !== "Meridian Health|Analyst") bad.push("tab A lost what was typed");
      await A.setFront(true); await sleep(700);
      if (searchCalls(site) !== 1) bad.push("the saved search ran " + searchCalls(site) + " times (once is right)");
    } finally { await A.close(); await B.close(); }
    return bad;
  },
  async candidateNoSearch(site) {
    const bad = []; site.calls.length = 0;
    const A = await browser.newTab(), B = await browser.newTab();
    try {
      await clean(A, site); await A.goto(site.url + "/search.html");
      await A.waitFor("!!document.querySelector('#signinWrap') && !document.querySelector('#signinWrap').hidden");
      await A.eval("window.__tabA = 'same page'");
      await askForLink(A, "reader@example.test");
      if (!(await A.waitFor("!document.querySelector('#candSent').hidden"))) bad.push("tab A does not say 'Check your email'");
      await A.setFront(false);
      await B.goto(site.url + "/_dev/link?kind=candidate");
      if (!(await B.waitFor("location.pathname === '/search.html' && !!document.querySelector('.avatar-btn, #navAccount span') && document.querySelector('#signinWrap').hidden === true", 12000))) bad.push("the new tab did not land on the search page signed in");
      if (!(await A.waitFor("document.querySelector('#signinWrap').hidden === true && window.__tabA === 'same page'", 8000))) bad.push("tab A did not move to the signed-in state by itself (without a reload)");
      await sleep(500);
      if (searchCalls(site) !== 0) bad.push("a search ran although none was typed");
    } finally { await A.close(); await B.close(); }
    return bad;
  },
  async expiredSearch(site) {
    const bad = []; site.calls.length = 0;
    const A = await browser.newTab(), B = await browser.newTab();
    try {
      await clean(A, site);
      await A.eval("localStorage.setItem('fgj-pending-search', JSON.stringify({ v: { company: 'Meridian Health', q: 'Analyst', r: '' }, exp: Date.now() - 1000 }))");
      await A.goto(site.url + "/search.html");
      await A.waitFor("!!document.querySelector('#signinWrap') && !document.querySelector('#signinWrap').hidden");
      await B.goto(site.url + "/_dev/link?kind=candidate");
      if (!(await B.waitFor("location.pathname === '/search.html' && document.querySelector('#signinWrap').hidden === true", 12000))) bad.push("the new tab did not land on the search page signed in");
      await sleep(700);
      if (searchCalls(site) !== 0) bad.push("a search that had expired was run");
      if ((await B.eval("document.querySelector('#company').value")) !== "") bad.push("an expired search was put back into the form");
      if ((await B.eval("localStorage.getItem('fgj-pending-search')")) !== null) bad.push("an expired saved search was left in storage");
    } finally { await A.close(); await B.close(); }
    return bad;
  },
  async tabAInFront(site) {
    const bad = []; site.calls.length = 0;
    const A = await browser.newTab(), B = await browser.newTab();
    try {
      await clean(A, site); await A.goto(site.url + "/search.html");
      await A.waitFor("!!document.querySelector('#signinWrap') && !document.querySelector('#signinWrap').hidden");
      await A.eval("window.__tabA = 'same page'");
      await typeSearch(A); await A.waitFor("!document.querySelector('#candEmailError').hidden");
      await A.setFront(true);
      await clean0(B, site);
      await B.eval("localStorage.setItem('fgj-auth', " + JSON.stringify(sessionJson({ candidate_identity_id: "00000000-0000-4000-8000-0000000000cc" })) + ")");   // the sign-in completed in another tab
      if (!(await A.waitFor("document.querySelectorAll('#results .card').length > 0 && window.__tabA === 'same page'", 10000))) bad.push("tab A, the one in front, did not run its saved search after the sign-in in the other tab");
      await sleep(500);
      if (searchCalls(site) !== 1) bad.push("the saved search ran " + searchCalls(site) + " times (once is right)");
      if ((await A.eval("localStorage.getItem('fgj-pending-search')")) !== null) bad.push("the saved search was not removed after it was used");
    } finally { await A.close(); await B.close(); }
    return bad;
  },
  async employerDefault(site) {
    const bad = []; site.calls.length = 0;
    const A = await browser.newTab(), B = await browser.newTab();
    try {
      await clean(A, site); await A.goto(site.url + "/employer-signin.html");
      await A.waitFor("!!document.querySelector('#email')");
      await A.eval("(() => { document.querySelector('#email').value = 'dana@meridian.example'; document.querySelector('#form').requestSubmit(); })()");
      if (!(await A.waitFor("!document.querySelector('#sent').hidden"))) bad.push("the employer page does not say 'Check your email'");
      await B.goto(site.url + "/_dev/link?kind=poster");
      if (!(await B.waitFor("location.pathname === '/register.html'", 12000))) bad.push("the new tab did not land in the employer area (it is at " + (await B.eval("location.pathname")) + ")");
      if (!(await A.waitFor("location.pathname === '/register.html'", 8000))) bad.push("tab A did not move on by itself to where a signed-in employer goes (it is at " + (await A.eval("location.pathname")) + ")");
    } finally { await A.close(); await B.close(); }
    return bad;
  },
  async employerFromDashboard(site) {
    const bad = []; site.calls.length = 0;
    const A = await browser.newTab(), B = await browser.newTab();
    try {
      await clean(A, site); await A.goto(site.url + "/dashboard.html");
      if (!(await A.waitFor("location.pathname === '/employer-signin.html' && !!document.querySelector('#email')", 10000))) bad.push("the dashboard did not send a signed-out visitor to the employer sign-in page");
      await A.eval("(() => { document.querySelector('#email').value = 'dana@meridian.example'; document.querySelector('#form').requestSubmit(); })()");
      await A.waitFor("!document.querySelector('#sent').hidden");
      await B.goto(site.url + "/_dev/link?kind=poster");
      if (!(await B.waitFor("location.pathname === '/dashboard.html'", 12000))) bad.push("the new tab did not land on the page that sent the person to sign in (it is at " + (await B.eval("location.pathname")) + ")");
      if (!(await A.waitFor("location.pathname === '/dashboard.html'", 8000))) bad.push("tab A did not move on by itself to that page (it is at " + (await A.eval("location.pathname")) + ")");
    } finally { await A.close(); await B.close(); }
    return bad;
  },
  async commentsPage(site) {
    const bad = []; site.calls.length = 0;
    const A = await browser.newTab(), B = await browser.newTab();
    try {
      await clean(A, site); await A.goto(site.url + "/comments.html?ref=" + REF);
      if (!(await A.waitFor("!!document.querySelector('#signinWrap') && !document.querySelector('#signinWrap').hidden", 10000))) bad.push("the comments page does not show the verify card");
      await A.eval("window.__tabA = 'same page'");
      await askForLink(A, "reader@example.test");
      await A.waitFor("!document.querySelector('#candSent').hidden");
      await A.setFront(false);
      await B.goto(site.url + "/_dev/link?kind=candidate");
      if (!(await B.waitFor("location.pathname === '/comments.html' && location.search === '?ref=" + REF + "'", 12000))) bad.push("the new tab did not land on the same comments page (it is at " + (await B.eval("location.pathname + location.search")) + ")");
      if (!(await A.waitFor("document.querySelector('#signinWrap').hidden === true && !document.querySelector('#threadWrap').hidden && window.__tabA === 'same page'", 10000))) bad.push("tab A did not show the comments by itself (without a reload)");
    } finally { await A.close(); await B.close(); }
    return bad;
  },
};
async function clean0(tab, site) { await tab.goto(site.url + "/404.html"); }

async function withSite(root, fn) { const site = await startFakeSite(root); try { return await fn(site); } finally { await site.close(); } }
const ALL = Object.keys(SCENARIOS);

test("the sign-in link in a new tab: search, no search, expiry, tab in front, employer pages, comments page", { timeout: 300000 }, async () => {
  const problems = [];
  await withSite(ROOT, async (site) => { for (const name of ALL) for (const p of await SCENARIOS[name](site)) problems.push(name + ": " + p); });
  assert.deepEqual(problems, [], "sign-in tab problems:\n" + problems.join("\n"));
});

// ---- negative controls ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const DEFECTS = [
  ["the saved search is kept in tab-local storage", ["candidateWithSearch"], "js/pages/search.js", (s) => s.replace("savePending(localStorage,", "savePending(sessionStorage,").replace("takePending(localStorage)", "takePending(sessionStorage)")],
  ["tab A has no listener for a sign-in in another tab", ["candidateNoSearch", "employerDefault"], "js/session.js", (s) => s.replace("return watchSignIn({ win: window,", "return () => {}; watchSignIn({ win: window,")],
  ["the new tab ignores the page the person started from", ["employerFromDashboard", "commentsPage"], "js/session.js", (s) => s.replace('if (!next) next = fromOtherTab || "";', "")],
  ["the saved search is not removed after it is used", ["candidateWithSearch"], "js/signin-handoff.js", (s) => s.replace("    store.removeItem(key);\n", "")],
  ["the saved search is kept past its expiry", ["expiredSearch"], "js/signin-handoff.js", (s) => s.replace('typeof o.exp !== "number" || !(o.exp > now)', 'typeof o.exp !== "number"')],
  ["a background tab takes the saved search", ["candidateWithSearch"], "js/pages/search.js", (s) => s.replace("  if (inFront()) { resumePending(); return; }", "  resumePending(); return;")],
  ["the typed search is put into the sign-in request", ["candidateWithSearch"], "js/session.js", (s) => s.replace('emailRedirectTo: location.origin + "/auth-callback.html"', 'emailRedirectTo: location.origin + "/auth-callback.html?c=" + encodeURIComponent((document.getElementById("company") || {}).value || "")')],
  ["the tab in front does not run the saved search", ["tabAInFront"], "js/pages/search.js", (s) => s.replace("  if (inFront()) { resumePending(); return; }", "  if (inFront()) { return; }")],
  ["the comments page has no listener", ["commentsPage"], "js/pages/comments.js", (s) => s.replace("watchOtherTabSignIn(async () => {", "(async () => { if (true) return; ")],
];
test("negative controls: each deliberate defect makes a sign-in tab scenario fail", { timeout: 900000 }, async () => {
  const missed = [];
  for (const [label, scenarios, rel, mutate] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-tabs-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const p = path.join(dir, rel), before = fs.readFileSync(p, "utf8"), after = mutate(before);
      assert.notEqual(after, before, "the defect '" + label + "' changed nothing");
      fs.writeFileSync(p, after);
      let found = [];
      await withSite(dir, async (site) => { for (const name of scenarios) found.push(...(await SCENARIOS[name](site)).map((x) => name + ": " + x)); });
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0] + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
