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
const CAND_LANDING = "You are signed in. You can close this tab and go back to the one you started from, or keep searching here.";
const EMP_LANDING = "You are signed in. You can close this tab and go back to the one you started from, or keep working here.";
const BOTH_NOTE = "This address is also registered as an employer, so the employer buttons show above. Searching here works as a candidate.";
const VERIFY_NOTE = "Verify your email first. We keep your search in this browser for one hour and run it when you open the link in this browser. If the link opens somewhere else, enter your search again.";
const SENT_NOTE = "Check your email. Open the link in this same browser and your search will be waiting. If it opens in another browser or app, enter your search again there.";
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
      else if ((await A.eval("document.querySelector('#candEmailError').textContent")) !== VERIFY_NOTE) bad.push("the verify card does not carry the approved wording (it says: " + (await A.eval("document.querySelector('#candEmailError').textContent")) + ")");
      const kept = JSON.parse((await A.eval("localStorage.getItem('fgj-pending-search')")) || "null");
      if (!kept) bad.push("the typed search is not in localStorage");
      else { const mins = (kept.exp - Date.now()) / 60000; if (mins < 55 || mins > 61) bad.push("the saved search does not expire in about an hour (" + Math.round(mins) + " minutes)"); }
      if ((await A.eval("sessionStorage.getItem('fgj-pending-search')")) !== null) bad.push("the typed search is also in tab-local storage");
      await askForLink(A, "reader@example.test");
      if (!(await A.waitFor("!document.querySelector('#candSent').hidden"))) bad.push("tab A does not say 'Check your email'");
      else if ((await A.eval("document.querySelector('#candSent').textContent.trim()")) !== SENT_NOTE) bad.push("the Check your email notice does not carry the approved wording (it says: " + (await A.eval("document.querySelector('#candSent').textContent")) + ")");
      const otp = site.calls.filter((c) => c.name === "auth-otp");
      if (otp.length !== 1) bad.push("the sign-in request was made " + otp.length + " times");
      else if (/Meridian|Analyst|fgj-pending|company|titleq/i.test(otp[0].address + JSON.stringify(otp[0].body))) bad.push("the typed search was put into the sign-in request or its address");
      await A.setFront(false);                                   // the person has gone to their webmail tab
      await B.goto(site.url + "/_dev/link?kind=candidate");      // what the emailed link does, in a NEW tab
      if (!(await B.waitFor("location.pathname === '/search.html' && document.querySelectorAll('#results .card').length > 0", 12000))) bad.push("the new tab did not land on the search page with the saved search's results (it is at " + (await B.eval("location.pathname + ' fields=' + document.querySelector('#company').value + '|' + document.querySelector('#titleq').value")) + ")");
      else {
        // Part C (October 5, 2026): the replayed search ends the way a typed one does: the boxes are emptied and the recap sits above the results; Edit this search puts the typed values back
        if ((await B.eval("document.querySelector('#company').value + '|' + document.querySelector('#titleq').value + '|' + document.querySelector('#reqq').value")) !== "||") bad.push("the replayed search did not empty the three boxes");
        const recapB = await B.eval("(() => { const r = document.querySelector('#recap'); return r && !r.hidden ? document.querySelector('#recapText').textContent : null; })()");
        if (recapB !== "You searched for: company Meridian Health, title Analyst. Your results are below.") bad.push("the new tab does not show the recap sentence after the replayed search (it shows: " + recapB + ")");
        await B.eval("document.querySelector('#recapEdit').click()"); await sleep(200);
        if ((await B.eval("document.querySelector('#company').value + '|' + document.querySelector('#titleq').value")) !== "Meridian Health|Analyst") bad.push("Edit this search did not put the typed search back in the new tab");
        if ((await B.eval("document.activeElement && document.activeElement.id")) !== "company") bad.push("Edit this search did not put the cursor in the Company box");
        if (await B.eval("!document.querySelector('#recap').hidden")) bad.push("the recap stays after Edit this search");
      }
      if (await B.eval("localStorage.getItem('fgj-pending-search')") !== null) bad.push("the saved search was not removed after it was used");
      if ((await B.eval("(() => { const n = document.querySelector('#landedNotice'); return n && !n.hidden ? n.textContent.trim() : null; })()")) !== CAND_LANDING) bad.push("the new tab does not show the approved landing note for a candidate (it shows: " + (await B.eval("(document.querySelector('#landedNotice') || {}).textContent")) + ")");
      await B.goto(site.url + "/search.html"); await B.waitFor("document.readyState === 'complete'"); await sleep(500);
      if (await B.eval("(() => { const n = document.querySelector('#landedNotice'); return !!(n && !n.hidden); })()")) bad.push("the landing note shows again on a second visit (it must show once)");
      if (!(await A.waitFor("document.querySelector('#signinWrap').hidden === true && window.__tabA === 'same page'", 8000))) bad.push("tab A did not move to the signed-in state by itself (without a reload)");
      if (!(await A.eval("/Email verified/.test(document.querySelector('#navAccount').textContent)"))) bad.push("tab A's header does not show the signed-in state");
      if ((await A.eval("document.querySelector('#company').value + '|' + document.querySelector('#titleq').value")) !== "Meridian Health|Analyst") bad.push("tab A lost what was typed");
      if (await A.eval("!document.querySelector('#recap').hidden")) bad.push("the background tab shows a recap although its search never ran");
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
      if (!(await B.waitFor("(() => { const n = document.querySelector('#landedNotice'); return !!(n && !n.hidden && n.textContent.trim() === " + JSON.stringify(EMP_LANDING) + "); })()", 6000))) bad.push("the new tab does not show the approved landing note for an employer");
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
// the both-roles note on the search page: only for a session that carries BOTH claims (candidate-only and employer-only get none of it)
SCENARIOS.rolesNote = async (site) => {
  const bad = []; site.calls.length = 0;
  const A = await browser.newTab();
  try {
    for (const [kind, want] of [["candidate", "none"], ["both", "both"], ["poster", "employer"]]) {
      await clean(A, site);
      await A.eval("localStorage.setItem('fgj-landing-page', JSON.stringify({ v: 'search.html', exp: Date.now() + 600000 }))");   // a link asked for from the search page
      await A.goto(site.url + "/_dev/link?kind=" + kind);
      if (!(await A.waitFor("location.pathname === '/search.html'", 12000))) { bad.push(kind + ": did not land on the search page"); continue; }
      await sleep(900);
      const shown = await A.eval("(() => { const n = document.querySelector('#roleNotice'); return n && !n.hidden ? n.textContent.trim() : ''; })()");
      const header = await A.eval("!!document.querySelector('#navAccount a[href=\"dashboard.html\"]')");
      if (want === "both") { if (shown !== BOTH_NOTE) bad.push("both claims: the search page does not show the approved note (it shows: " + shown + ")"); if (!header) bad.push("both claims: the employer buttons are gone from the top bar (the header behavior must not change)"); }
      else if (want === "employer") { if (!/^You are signed in as an employer\./.test(shown) || shown.includes(BOTH_NOTE)) bad.push("employer only: the search page shows the wrong note (" + shown + ")"); }
      else { if (shown !== "") bad.push("candidate only: the search page shows a role note (" + shown + ")"); if (header) bad.push("candidate only: the employer buttons show"); }
      const hasBoth = await A.eval("document.body.textContent.includes(" + JSON.stringify(BOTH_NOTE) + ")");
      if (want !== "both" && hasBoth) bad.push(kind + ": the both-roles note appears anywhere on the page");
    }
  } finally { await A.close(); }
  return bad;
};
// WHICH landing note: by the PAGE the sign-in lands on, whatever the session's claims (stage recheck, October 4, 2026: an address that is both an employer and a candidate got the candidate sentence on My postings).
// Employer pages (My postings, Analytics, Team, Edit, Register a posting, an employer's own comments page) show the employer sentence after an employer-only or a both-roles sign-in; Search and a candidate's comments page show the
// candidate sentence after a candidate-only or a both-roles sign-in; an employer-only session on Search shows NO landing note and exactly ONE notice (the existing one that says an employer session cannot search).
SCENARIOS.landingNotes = async (site) => {
  const bad = []; site.calls.length = 0;
  const A = await browser.newTab();
  const GID = "3f1d5b1e-0000-4000-8000-000000000001";
  const EMP_PAGES = ["dashboard.html", "analytics.html", "team.html", "edit.html?id=" + GID, "register.html", "comments.html?id=" + GID];
  const cases = [];
  for (const kind of ["poster", "both"]) for (const p of EMP_PAGES) cases.push([kind, p, EMP_LANDING]);
  cases.push(["candidate", "search.html", CAND_LANDING], ["both", "search.html", CAND_LANDING], ["candidate", "comments.html?ref=" + REF, CAND_LANDING], ["both", "comments.html?ref=" + REF, CAND_LANDING], ["poster", "search.html", null]);
  try {
    for (const [kind, page, want] of cases) {
      const label = kind + " session on " + page.split("?")[0] + (page.includes("id=") ? " (employer comments)" : page.includes("ref=") ? " (candidate comments)" : "");
      await clean(A, site);
      await A.eval("localStorage.setItem('fgj-landing-page', JSON.stringify({ v: " + JSON.stringify(page) + ", exp: Date.now() + 600000 }))");   // the page the link was asked from
      await A.goto(site.url + "/_dev/link?kind=" + kind);
      if (!(await A.waitFor("location.pathname === '/" + page.split("?")[0] + "'", 12000))) { bad.push(label + ": did not land on the page (it is at " + (await A.eval("location.pathname")) + ")"); continue; }
      await sleep(1100);
      const note = await A.eval("(() => { const n = document.querySelector('#landedNotice'); return n && !n.hidden ? n.textContent.trim() : ''; })()");
      if (want) { if (note !== want) bad.push(label + ": the landing note is '" + note + "' (wanted '" + want + "')"); }
      else {
        if (note !== "") bad.push(label + ": a landing note shows (" + note + ") although the page already says an employer session cannot search");
        const role = await A.eval("(() => { const n = document.querySelector('#roleNotice'); return n && !n.hidden ? n.textContent.trim() : ''; })()");
        if (!/^You are signed in as an employer\./.test(role)) bad.push(label + ": the search page does not show its employer notice");
        const alerts = await A.eval("Array.from(document.querySelectorAll('.alert')).filter((e) => !!(e.offsetWidth || e.offsetHeight)).length");
        if (alerts !== 1) bad.push(label + ": " + alerts + " notices show (one coherent notice is wanted)");
      }
    }
  } finally { await A.close(); }
  return bad;
};
// A3 (October 5, 2026): a both-roles address that asked for an employer page does not see the "Email verified / You can search now." flash on the way; a candidate destination keeps it exactly as it was.
SCENARIOS.callbackFlash = async (site) => {
  const bad = []; site.calls.length = 0;
  const A = await browser.newTab();
  try {
    await A.onNewDocument("if (location.pathname.endsWith('auth-callback.html')) { new MutationObserver(() => { const t = document.getElementById('title'); if (t && /Email verified/.test(t.textContent)) sessionStorage.setItem('__flash', 'yes'); }).observe(document, { childList: true, subtree: true, characterData: true }); }");
    const cases = [["both", "dashboard.html", false], ["both", "team.html", false], ["both", "register.html", false], ["candidate", "search.html", true], ["both", "search.html", true], ["candidate", "comments.html?ref=" + REF, true]];
    for (const [kind, page, flash] of cases) {
      await clean(A, site);
      await A.eval("localStorage.setItem('fgj-landing-page', JSON.stringify({ v: " + JSON.stringify(page) + ", exp: Date.now() + 600000 }))");
      await A.goto(site.url + "/_dev/link?kind=" + kind);
      if (!(await A.waitFor("location.pathname === '/" + page.split("?")[0] + "'", 12000))) { bad.push(kind + " to " + page + ": did not land there"); continue; }
      await sleep(500);
      const saw = (await A.eval("sessionStorage.getItem('__flash')")) === "yes";
      if (saw !== flash) bad.push(kind + " session going to " + page.split("?")[0] + ": the 'Email verified' flash " + (saw ? "showed" : "did not show") + " (wanted " + (flash ? "shown" : "not shown") + ")");
    }
  } finally { await A.close(); }
  return bad;
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
  ["the callback flashes Email verified on employer pages again", ["callbackFlash"], "js/pages/auth-callback.js", (s) => s.replace('landingKindForPage("/" + destPage[0], destPage[1] ? "?" + destPage[1] : "") !== "poster")', "true)")],
  ["the callback never flashes Email verified (the candidate keeps nothing)", ["callbackFlash"], "js/pages/auth-callback.js", (s) => s.replace('say("Email verified", "You can search now.", []);', "")],
  ["the landing note is chosen by the flag the callback left (the page is ignored)", ["landingNotes"], "js/app.js", (s) => s.replace("const kind = landingKindForPage(location.pathname, location.search) || flag;", "const kind = flag;")],
  ["the landing note is chosen by the session's role (employer wording whenever there is an employer claim)", ["landingNotes"], "js/app.js", (s) => s.replace("const kind = landingKindForPage(location.pathname, location.search) || flag;", 'const kind = session.isPoster ? "poster" : "candidate";')],
  ["the Team page is missing from the employer pages", ["landingNotes"], "js/landing-notice.js", (s) => s.replace('"analytics.html", "team.html", ', '"analytics.html", ')],
  ["the search page is counted as an employer page", ["landingNotes"], "js/landing-notice.js", (s) => s.replace('export const CANDIDATE_PAGES = ["search.html"];', 'export const CANDIDATE_PAGES = [];')],
  ["the landing note is switched off", ["candidateWithSearch"], "js/landing-notice.js", (s) => s.replace("LANDING_NOTICE_ENABLED = true;", "LANDING_NOTICE_ENABLED = false;")],
  ["the landing note shows on every visit (the flag is not consumed)", ["candidateWithSearch"], "js/landing-notice.js", (s) => s.replace('store.removeItem(LANDED_KEY); ', "")],
  ["the landing note carries the wrong wording for an employer", ["employerDefault"], "js/landing-notice.js", (s) => s.replace("or keep working here.", "or keep searching here.")],
  ["the both-roles note shows for a candidate-only session", ["rolesNote"], "js/landing-notice.js", (s) => s.replace('if (session.isPoster && session.isCandidate) return "both";', 'if (session.isCandidate) return "both";')],
  ["the both-roles note does not show for a session with both claims", ["rolesNote"], "js/landing-notice.js", (s) => s.replace('if (session.isPoster && session.isCandidate) return "both";', "")],
  ["the both-roles note shows for an employer-only session", ["rolesNote"], "js/landing-notice.js", (s) => s.replace('if (session.isPoster) return "employer";', 'if (session.isPoster) return "both";')],
  ["the verify card still has the old wording", ["candidateWithSearch"], "js/pages/search.js", (s) => s.replace("We keep your search in this browser for one hour and run it when you open the link in this browser. If the link opens somewhere else, enter your search again.", "your search is saved and runs as soon as you are back.")],
  ["the Check your email notice still has the old wording", ["candidateWithSearch"], "js/pages/search.js", (s) => s.replace("Open the link in this same browser and your search will be waiting. If it opens in another browser or app, enter your search again there.", "The link takes you straight back here; your search will be waiting.")],
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
