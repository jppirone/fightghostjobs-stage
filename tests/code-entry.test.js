// code-entry.test.js - the emailed one-time code, typed in the SAME tab (October 6, 2026, Phase 4). Real headless Chrome, the repo's own files, a fake backend (tests/fake-site.js: /auth/v1/verify accepts the code 123456; no real project, no key).
// The sign-in email keeps its link and also carries a short code. The search page and the employer sign-in page have a field for it, shown once a link has been requested. Proven here:
//   1. candidate, search page: a wrong code is refused with the plain sentence and the field is emptied and nothing is signed in; letters and an empty field are refused without any request; a rate limit has its own sentence; the right code (typed with a space) signs in
//      IN THE SAME TAB (no reload, no second tab): the saved search runs once and the recap shows, the header shows the signed-in state, no "close this tab" landing note, the saved search is removed; the request carries only the address, the code and the type, never the search;
//   2. a first-time address: the Auth service wants the code as type "signup" when "email" is refused, and the page then still signs in; 3. "Send a new link or use another address" brings the form back and a second request shows ONE code form;
//   4. employer sign-in page: the right code takes the person to the employer area in the same tab (no landing note); an address that is not an employer ends on the plain "Signed in, but not as an employer" page;
//   5. with EMAIL_CODE_ENTRY off, neither page shows the code field; 6. the link text of the page ("Check your email...") is exactly as before (the other test, tests/signin-tabs.test.js, still proves the two-tab link flow).
// Then negative controls: one defect at a time, each must make a scenario fail. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/code-entry.test.js
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
const SENT_NOTE = "Check your email. Open the link in this same browser and your search will be waiting. If it opens in another browser or app, enter your search again there.";
const WRONG = "That code did not work. Check it, or ask for a new link.", DIGITS = "The code is made of digits only, usually 6.", EMPTY = "Type the code from the email.", RATE = "Too many tries. Wait a minute and try again.";
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

const clean = async (tab, site) => { await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}"); };
const verifyCalls = (site) => site.calls.filter((c) => c.name === "auth-verify");
const searchCalls = (site) => site.calls.filter((c) => c.name === "candidate-search").length;
const typeSearch = (tab) => tab.eval("(() => { document.querySelector('#company').value = 'Meridian Health'; document.querySelector('#titleq').value = 'Analyst'; document.querySelector('#searchForm').requestSubmit(); })()");
const askLinkCand = (tab, email) => tab.eval("(() => { document.querySelector('#candEmail').value = " + JSON.stringify(email) + "; document.querySelector('#signinForm').requestSubmit(); })()");
const askLinkEmp = (tab, email) => tab.eval("(() => { document.querySelector('#email').value = " + JSON.stringify(email) + "; document.querySelector('#form').requestSubmit(); })()");
const sendCode = (tab, code) => tab.eval("(() => { document.querySelector('#codeInput').value = " + JSON.stringify(code) + "; document.querySelector('#codeForm').requestSubmit(); })()");
const errorText = (tab) => tab.eval("(() => { const e = document.querySelector('#codeError'); return e && !e.hidden ? e.textContent : null; })()");
const signedIn = (tab) => tab.eval("!!localStorage.getItem('fgj-auth')");
const noteShown = (tab) => tab.eval("(() => { const n = document.querySelector('#landedNotice'); return n && !n.hidden ? n.textContent.trim() : ''; })()");
async function withSite(root, opts, fn) { const site = await startFakeSite(root, opts); try { return await fn(site); } finally { await site.close(); } }

const SCENARIOS = {
  async candidateSameTab(root) {
    return withSite(root, {}, async (site) => {
      const bad = [], A = await browser.newTab();
      try {
        await A.focusEmulation(true);
        await clean(A, site); await A.goto(site.url + "/search.html");
        await A.waitFor("!!document.querySelector('#signinWrap') && !document.querySelector('#signinWrap').hidden");
        await A.eval("window.__tabA = 'same page'");
        await typeSearch(A);
        await A.waitFor("!document.querySelector('#candEmailError').hidden");
        await askLinkCand(A, "reader@example.test");
        if (!(await A.waitFor("!document.querySelector('#candSent').hidden && !!document.querySelector('#codeForm')"))) { bad.push("no code field after the link was requested"); return bad; }
        if ((await A.eval("document.querySelector('#candSent').textContent.trim()")) !== SENT_NOTE) bad.push("the Check your email notice changed");
        const f = await A.eval("(() => { const i = document.querySelector('#codeInput'), l = document.querySelector('label[for=codeInput]'); return { auto: i.getAttribute('autocomplete'), mode: i.getAttribute('inputmode'), label: l && l.textContent, hint: document.querySelector('#codeHint').textContent, vis: i.getClientRects().length > 0 }; })()");
        if (f.auto !== "one-time-code" || f.mode !== "numeric" || !f.vis) bad.push("the code field is not a visible numeric one-time-code field (" + JSON.stringify(f) + ")");
        if (f.label !== "Or type the code from the email") bad.push("the code field has no label with the approved wording (" + f.label + ")");
        if (!/6 digits/.test(f.hint)) bad.push("the code hint does not say the code is 6 digits");
        const before = verifyCalls(site).length;
        for (const [code, want, why] of [["abc", DIGITS, "letters"], ["", EMPTY, "an empty field"]]) {
          await sendCode(A, code); await sleep(300);
          if ((await errorText(A)) !== want) bad.push(why + ": the field does not say '" + want + "' (it says: " + (await errorText(A)) + ")");
        }
        if (verifyCalls(site).length !== before) bad.push("letters or an empty field were sent to the server");
        await sendCode(A, "111111");
        if (!(await A.waitFor("(() => { const e = document.querySelector('#codeError'); return !!e && !e.hidden && e.textContent !== ''; })() && document.querySelector('#codeInput').value === ''", 6000)) || (await errorText(A)) !== WRONG) bad.push("a wrong code is not refused with the plain sentence and an emptied field (it says: " + (await errorText(A)) + ")");
        if (await signedIn(A)) bad.push("a wrong code signed the person in");
        if (searchCalls(site) !== 0) bad.push("a search ran before the sign-in");
        await sendCode(A, "000429");
        if (!(await A.waitFor("(document.querySelector('#codeError') || {}).textContent === " + JSON.stringify(RATE), 6000))) bad.push("a rate limit does not have its own sentence (it says: " + (await errorText(A)) + ")");
        if (verifyCalls(site).filter((c) => c.body.token === "000429").length !== 1) bad.push("a rate-limited code was sent to the Auth service more than once");
        await sendCode(A, "123 456");
        if (!(await A.waitFor("document.querySelector('#signinWrap').hidden === true && document.querySelectorAll('#results .card').length > 0", 10000))) { bad.push("the right code did not sign in and run the saved search in this tab"); return bad; }
        if ((await A.eval("window.__tabA")) !== "same page") bad.push("the page was reloaded or replaced");
        const recap = await A.eval("(() => { const r = document.querySelector('#recap'); return r && !r.hidden ? document.querySelector('#recapText').textContent : null; })()");
        if (recap !== "You searched for: company Meridian Health, title Analyst. Your results are below.") bad.push("no recap after the search that followed the code (" + recap + ")");
        if (!(await A.eval("/Email confirmed/.test(document.querySelector('#navAccount').textContent)"))) bad.push("the header does not show the signed-in state");
        if (await noteShown(A)) bad.push("the 'close this tab' landing note shows although nobody came from another tab");
        if (await A.eval("localStorage.getItem('fgj-pending-search')") !== null) bad.push("the saved search was not removed");
        await sleep(600);
        if (searchCalls(site) !== 1) bad.push("the saved search ran " + searchCalls(site) + " times (once is right)");
        const last = verifyCalls(site).at(-1);
        if (!last || last.body.email !== "reader@example.test" || last.body.token !== "123456" || last.body.type !== "email") bad.push("the confirm request is not {email, token 123456, type email} (" + JSON.stringify(last && last.body) + ")");
        if (verifyCalls(site).some((c) => /Meridian|Analyst|company|titleq|fgj-pending/i.test(c.address + JSON.stringify(c.body)))) bad.push("the typed search went into a confirm request");
      } finally { await A.close(); }
      return bad;
    });
  },
  async firstTimeAddress(root) {
    return withSite(root, { codeType: "signup" }, async (site) => {
      const bad = [], A = await browser.newTab();
      try {
        await A.focusEmulation(true);
        await clean(A, site); await A.goto(site.url + "/search.html");
        await A.waitFor("!!document.querySelector('#signinWrap') && !document.querySelector('#signinWrap').hidden");
        await askLinkCand(A, "newcomer@example.test");
        await A.waitFor("!!document.querySelector('#codeForm')");
        await sendCode(A, "123456");
        if (!(await A.waitFor("document.querySelector('#signinWrap').hidden === true", 8000))) bad.push("a first-time address did not sign in with the code");
        if (verifyCalls(site).map((c) => c.body.type).join(",") !== "email,signup") bad.push("expected the code to be tried as email then signup, got: " + verifyCalls(site).map((c) => c.body.type).join(","));
      } finally { await A.close(); }
      return bad;
    });
  },
  async startOver(root) {
    return withSite(root, {}, async (site) => {
      const bad = [], A = await browser.newTab();
      try {
        await A.focusEmulation(true);
        await clean(A, site); await A.goto(site.url + "/search.html");
        await A.waitFor("!!document.querySelector('#signinWrap') && !document.querySelector('#signinWrap').hidden");
        await askLinkCand(A, "reader@example.test");
        await A.waitFor("!!document.querySelector('#codeForm')");
        await A.eval("document.querySelector('#codeStartOver').click()"); await sleep(300);
        if (await A.eval("document.querySelector('#signinForm').hidden || !document.querySelector('#candSent').hidden || !!document.querySelector('#codeForm')")) bad.push("'Send a new link' did not bring the form back and clear the code field");
        await askLinkCand(A, "reader2@example.test");
        await A.waitFor("!!document.querySelector('#codeForm')");
        if ((await A.eval("document.querySelectorAll('#codeForm').length")) !== 1) bad.push("a second request shows more than one code form");
      } finally { await A.close(); }
      return bad;
    });
  },
  async employerSameTab(root) {
    return withSite(root, {}, async (site) => {
      const bad = [], A = await browser.newTab();
      try {
        await A.focusEmulation(true);
        await clean(A, site); await A.goto(site.url + "/employer-signin.html");
        await A.waitFor("!!document.querySelector('#email')");
        await askLinkEmp(A, "poster@meridian.example");
        if (!(await A.waitFor("!document.querySelector('#sent').hidden && !!document.querySelector('#codeForm')"))) { bad.push("no code field on the employer page after the link was requested"); return bad; }
        await sendCode(A, "111111");
        await A.waitFor("!!document.querySelector('#codeError') && !document.querySelector('#codeError').hidden", 6000);
        if (await signedIn(A)) bad.push("a wrong code signed an employer in");
        await sendCode(A, "123456");
        if (!(await A.waitFor("location.pathname === '/register.html' && document.readyState === 'complete'", 15000))) { bad.push("the right code did not take the employer to the employer area in this tab (it is at " + (await A.eval("location.pathname")) + ")"); return bad; }
        await sleep(800);
        if (await noteShown(A)) bad.push("the 'close this tab' landing note shows after a code typed in the same tab (" + (await noteShown(A)) + ")");
        if (!(await signedIn(A))) bad.push("no session after the code");
      } finally { await A.close(); }
      return bad;
    });
  },
  async employerNotOnRoster(root) {
    return withSite(root, {}, async (site) => {
      const bad = [], A = await browser.newTab();
      try {
        await A.focusEmulation(true);
        await clean(A, site); await A.goto(site.url + "/employer-signin.html");
        await A.waitFor("!!document.querySelector('#email')");
        await askLinkEmp(A, "nobody@meridian.example");
        await A.waitFor("!!document.querySelector('#codeForm')");
        await sendCode(A, "123456");
        if (!(await A.waitFor("location.pathname === '/auth-callback.html' && /Signed in, but not as an employer/.test(document.body.innerText)", 12000))) bad.push("an address that is not an employer did not end on the plain 'Signed in, but not as an employer' page (it is at " + (await A.eval("location.pathname")) + ")");
      } finally { await A.close(); }
      return bad;
    });
  },
  async codeOff(root) {
    return withSite(root, { codeOff: true }, async (site) => {
      const bad = [], A = await browser.newTab();
      try {
        await A.focusEmulation(true);
        await clean(A, site); await A.goto(site.url + "/search.html");
        await A.waitFor("!!document.querySelector('#signinWrap') && !document.querySelector('#signinWrap').hidden");
        await askLinkCand(A, "reader@example.test");
        await A.waitFor("!document.querySelector('#candSent').hidden"); await sleep(300);
        if (await A.eval("!!document.querySelector('#codeForm')")) bad.push("the search page shows the code field although EMAIL_CODE_ENTRY is off");
        await clean(A, site); await A.goto(site.url + "/employer-signin.html");
        await A.waitFor("!!document.querySelector('#email')");
        await askLinkEmp(A, "poster@meridian.example");
        await A.waitFor("!document.querySelector('#sent').hidden"); await sleep(300);
        if (await A.eval("!!document.querySelector('#codeForm')")) bad.push("the employer page shows the code field although EMAIL_CODE_ENTRY is off");
      } finally { await A.close(); }
      return bad;
    });
  },
};
const ALL = Object.keys(SCENARIOS);

test("the emailed code typed in the same tab: candidate, first-time address, start over, employer, employer not on a roster, switched off", { timeout: 600000 }, async () => {
  const problems = [];
  for (const name of ALL) for (const p of await SCENARIOS[name](ROOT)) problems.push(name + ": " + p);
  assert.deepEqual(problems, [], "emailed code problems:\n" + problems.join("\n"));
});

// ---- negative controls ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const DEFECTS = [
  ["the code is confirmed as the wrong type", ["candidateSameTab"], "js/session.js", (s) => s.replace('call("email");', 'call("sms");')],
  ["a first-time address is not tried as signup", ["firstTimeAddress"], "js/session.js", (s) => s.replace("if (error && error.status !== 429) {", "if (false) {")],
  ["a rate limit is retried as if it were a wrong type", ["candidateSameTab"], "js/session.js", (s) => s.replace("if (error && error.status !== 429) {", "if (error) {")],
  ["the right code does not finish the sign-in on the page", ["candidateSameTab"], "js/pages/search.js", (s) => s.replace("  await becameSignedIn(s);\n}", "  session = s;\n}")],
  ["the right code never adopts the session", ["candidateSameTab"], "js/pages/search.js", (s) => s.replace("  const s = await currentSession();\n  if (!s) {", "  const s = null;\n  if (!s) {")],
  ["the code field is placed inside the Check your email notice", ["candidateSameTab"], "js/pages/search.js", (s) => s.replace("const host = $(\"#candCode\");", "const host = sent;")],
  ["the wrong-code sentence is not shown", ["candidateSameTab"], "js/code-entry.js", (s) => s.replace('say(failureText(r)); input.value = "";', 'input.value = "";')],
  ["a wrong code is not emptied", ["candidateSameTab"], "js/code-entry.js", (s) => s.replace('say(failureText(r)); input.value = "";', "say(failureText(r));")],
  ["letters are sent to the server", ["candidateSameTab"], "js/code-entry.js", (s) => s.replace('return /^\\d{6,10}$/.test(c) ? null : "The code is made of digits only, usually 6.";', "return null;")],
  ["an empty field is sent to the server", ["candidateSameTab"], "js/code-entry.js", (s) => s.replace('if (c === "") return "Type the code from the email.";', "")],
  ["spaces in the code are not removed", ["candidateSameTab"], "js/code-entry.js", (s) => s.replace("replace(/[\\s-]/g, \"\")", "replace(/-/g, \"\")")],
  ["a rate limit has no sentence of its own", ["candidateSameTab"], "js/code-entry.js", (s) => s.replace("Too many tries. Wait a minute and try again.", "That code did not work. Check it, or ask for a new link.")],
  ["the code field is not a one-time-code field", ["candidateSameTab"], "js/code-entry.js", (s) => s.replace('autocomplete: "one-time-code"', 'autocomplete: "off"')],
  ["the code field has no label", ["candidateSameTab"], "js/code-entry.js", (s) => s.replace('h("label", { for: "codeInput" }, "Or type the code from the email"),', "")],
  ["Send a new link does nothing", ["startOver"], "js/code-entry.js", (s) => s.replace("startOver.addEventListener(\"click\", () => onStartOver());", "")],
  ["the old code form stays after Send a new link", ["startOver"], "js/pages/search.js", (s) => s.replace("onStartOver: () => { clear(host); host.hidden = true;", "onStartOver: () => { ")],
  ["the employer page ignores the code", ["employerSameTab"], "js/pages/employer-signin.js", (s) => s.replace('go("auth-callback.html?via=code");', "")],
  ["the employer page shows the landing note after a typed code", ["employerSameTab"], "js/pages/auth-callback.js", (s) => s.replace('if (!viaCode) markLanded(sessionStorage, "poster");', 'markLanded(sessionStorage, "poster");')],
  ["the employer who is not on a roster is treated as one", ["employerNotOnRoster"], "js/pages/auth-callback.js", (s) => s.replace("if (!session.isPoster) {", "if (false) {")],
  ["the switch is ignored by the search page", ["codeOff"], "js/code-entry.js", (s) => s.replace("export const CODE_ENABLED = EMAIL_CODE_ENTRY === true;", "export const CODE_ENABLED = true;")],
  ["the switch is ignored by the employer page", ["codeOff"], "js/pages/employer-signin.js", (s) => s.replace("if (CODE_ENABLED) {", "if (true) {")],
];
test("negative controls: each deliberate defect makes an emailed-code scenario fail", { timeout: 3000000 }, async () => {
  const missed = [];
  for (const [label, scenarios, rel, mutate] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-code-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const p = path.join(dir, rel), before = fs.readFileSync(p, "utf8"), after = mutate(before);
      assert.notEqual(after, before, "the defect '" + label + "' changed nothing in " + rel);
      fs.writeFileSync(p, after);
      const found = [];
      for (const name of scenarios) found.push(...(await SCENARIOS[name](dir)).map((x) => name + ": " + x));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 160) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
