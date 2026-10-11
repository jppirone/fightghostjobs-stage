// register-bj.test.js - prompt BJ (October 11, 2026), in a real browser: the register page ("Add an opening") and the one place line. The repo's own files and a fake backend (tests/fake-site.js; no real project, no key).
//
// THE REGISTER PAGE: the AI and hiring policy link box is always there (a box on the tier, the edit page's own sentence off it) and is saved right after the opening is added; every address is judged as typed
// (the edit page's rule) and every problem of every section is said in ONE list before anything is created; Add opening and Save draft sit at the very bottom after every section, there is no Cancel; the unsaved bar,
// Discard and the question before leaving the page are the edit page's own component; text typed in the recruiter firm rows while the recruiter switch is off is told to the person, never silently dropped.
// THE PLACE BOX: it says its limit and counts, on both forms.
// THE PLACE LINE: the same words on the comments page, in the editor and in the history of an opening (a draft's automatic line in plain words).
// Then negative controls: one defect at a time in the page code; each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/register-bj.test.js
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
const WITH_LINKS = "d21m48ybzqbfxxxxxxxx";
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

async function withSite(root, opts, fn) { const site = await startFakeSite(root, opts); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }
const q = JSON.stringify;
const text = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; })()");
const visible = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); return !!e && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none'; })()");
const typeIn = (tab, sel, value) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); e.value = " + q(value) + "; e.dispatchEvent(new Event('input', { bubbles: true })); })()");
const blur = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); e.focus(); e.blur(); })()");
const click = (tab, sel) => tab.eval("document.querySelector(" + q(sel) + ").click()");
const callsOf = (site, name) => site.calls.filter((c) => c.name === name);
const value = (tab, sel) => tab.eval("document.querySelector(" + q(sel) + ").value");
const policyCalls = (site) => callsOf(site, "set-destination-links").filter((c) => c.body.kind === "policy");
const applyCalls = (site) => callsOf(site, "set-destination-links").filter((c) => c.body.kind === undefined || c.body.kind === "apply");
const firmCalls = (site) => callsOf(site, "set-destination-links").filter((c) => c.body.kind === "recruiter");

async function signIn(tab, site, kind = "poster") {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=" + kind); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.viewport(1280, false);
}
async function openRegister(tab, site, confirmAnswer = true) {
  await signIn(tab, site);
  await tab.goto(site.url + "/register.html");
  await tab.waitFor("!!document.querySelector('#jtitle') && !!document.querySelector('#locOutside') && document.readyState === 'complete' && !document.querySelector('#policyRow').hidden", 10000).catch(() => null);
  await sleep(700);
  await tab.eval("window.confirm = () => " + (confirmAnswer ? "true" : "false") + ";");
}
async function openEdit(tab, site) {
  await signIn(tab, site);
  await tab.goto(site.url + "/" + EDIT);
  await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden && !!document.querySelector('#jtitle').value", 10000); await sleep(800);
  await tab.eval("window.confirm = () => true;");
}
const fillRegister = async (tab) => { await typeIn(tab, "#jtitle", "Support Analyst"); await typeIn(tab, "#req", "R-2026-77"); await typeIn(tab, "#closeout", "Closes when the role is filled"); await typeIn(tab, "#desc", "A plain description of the role."); };
// the form is valid for a draft: a place from the list, the two AI answers are the defaults (off)
async function pickAustin(tab) {
  await typeIn(tab, "#locq", "Austin");
  await tab.waitFor("document.querySelectorAll('#locList li').length > 0", 10000);
  await tab.eval("document.querySelector('#locList li').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))"); await sleep(200);
}
async function waitResult(tab) { await tab.waitFor("!document.querySelector('#result').hidden && document.querySelectorAll('#result *').length > 0", 10000).catch(() => null); await sleep(300); }

const SCENARIOS = {
  // ---- the policy box
  async policyLocked(root) { return withSite(root, {}, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    if (!(await visible(tab, "#policyRow"))) { bad.push("the policy row is not on the page for an organization off the tier"); return bad; }
    if ((await text(tab, "#policyLabel")) !== "Link to your AI and hiring policy (optional)") bad.push("the label reads '" + (await text(tab, "#policyLabel")) + "'");
    if (!(await visible(tab, "#policyLocked"))) bad.push("the not-on-the-tier sentence is not shown");
    if (!/destination links tier/.test((await text(tab, "#policyLocked")) || "") || !(await tab.eval("!!document.querySelector('#policyLocked a[href^=\"mailto:sales@fightghostjobs.com\"]')"))) bad.push("the sentence does not name the tier and carry the sales address: '" + (await text(tab, "#policyLocked")) + "'");
    if (await visible(tab, "#policyUrl")) bad.push("an address box is shown to an organization that cannot save one");
    await fillRegister(tab); await pickAustin(tab); await click(tab, "#draftBtn"); await waitResult(tab);
    if (policyCalls(site).length) bad.push("a policy link was sent for an organization off the tier");
    return bad; })); },
  async policyBox(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    if (!(await visible(tab, "#policyUrl"))) bad.push("the address box is not shown on the tier");
    if (await visible(tab, "#policyLocked")) bad.push("the locked sentence is shown on the tier");
    if (!/saved right after the opening is added/.test((await text(tab, "#policyHint")) || "")) bad.push("the hint does not say when it is saved: '" + (await text(tab, "#policyHint")) + "'");
    if ((await tab.eval("document.querySelector('#policyUrl').getAttribute('aria-describedby')")) !== "policyHint policyError") bad.push("the box is not tied to its hint and its error line");
    return bad; })); },
  async policyLapsed(root) { return withSite(root, { plan: "lapsed" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    if (!(await visible(tab, "#policyRow"))) bad.push("the row is gone when the tier ended");
    if (await visible(tab, "#policyUrl")) bad.push("an address box is shown after the tier ended");
    if (!/tier ended/.test((await text(tab, "#policyNote")) || "")) bad.push("the tier-ended sentence is missing: '" + (await text(tab, "#policyNote")) + "'");
    return bad; })); },
  async policySaved(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await fillRegister(tab); await pickAustin(tab);
    await typeIn(tab, "#policyUrl", "  https://example.com/ai-hiring-policy ");
    await click(tab, "#draftBtn"); await waitResult(tab);
    const names = site.calls.map((c) => c.name + (c.body && c.body.kind ? ":" + c.body.kind : "")).filter((n) => /create-posting|set-destination-links/.test(n));
    if (JSON.stringify(names) !== JSON.stringify(["create-posting", "set-destination-links:policy"])) bad.push("the calls were " + JSON.stringify(names) + " (the opening first, then the policy link)");
    const c = policyCalls(site)[0];
    if (!c || c.body.posting_id !== "3f1d5b1e-0000-4000-8000-0000000000aa" || JSON.stringify(c.body.links) !== JSON.stringify([{ url: "https://example.com/ai-hiring-policy" }])) bad.push("the policy call was " + JSON.stringify(c && c.body));
    if (!/^Saved\. Candidates see it as AI and hiring policy:/.test((await text(tab, "#policyOutcome")) || "")) bad.push("the result does not say the link was saved: '" + (await text(tab, "#policyOutcome")) + "'");
    return bad; })); },
  async policyNotRequired(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await fillRegister(tab); await pickAustin(tab);
    await click(tab, "#draftBtn"); await waitResult(tab);
    if (callsOf(site, "create-posting").length !== 1) bad.push("the opening was not created without a policy link");
    if (policyCalls(site).length) bad.push("an empty policy box sent a call");
    return bad; })); },
  async policyCheckFailed(root) { return withSite(root, { plan: "verified", policyCheck: "failed" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await fillRegister(tab); await pickAustin(tab);
    await typeIn(tab, "#policyUrl", "https://example.com/gone");
    await click(tab, "#draftBtn"); await waitResult(tab);
    // prompt BK: the card says what the editor says: it did not answer (with the code), candidates are not shown it until a check answers, and to make sure it is right and save it again
    const o = (await text(tab, "#policyOutcome")) || "";
    if (o !== "Saved, but when we checked, the address did not answer (HTTP 404). Candidates are not shown it until a check answers. Make sure the address is right, then save it again.") bad.push("the failed check is not told in the editor's words: '" + o + "'");
    if (await visible(tab, "#checkReport")) bad.push("the policy link is also in the one check sentence, which says 'saved anyway': '" + (await text(tab, "#checkReport")) + "'");
    if (!(await text(tab, "#result h2"))) bad.push("the opening itself was not reported as saved");
    return bad; })); },
  // ---- addresses judged as typed, every problem in one list
  async addressAsTyped(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await fillRegister(tab); await pickAustin(tab);
    await typeIn(tab, 'input[aria-label="Destination address 1"]', "https//example.com/apply");
    await blur(tab, 'input[aria-label="Destination address 1"]'); await sleep(150);
    const one = await tab.eval("(() => { const i = document.querySelector('input[aria-label=\"Destination address 1\"]'); const e = i.parentElement.querySelector('.field-error'); return { hidden: e.hidden, text: e.textContent, invalid: i.getAttribute('aria-invalid') }; })()");
    if (one.hidden || one.text !== "The address must start with https://" || one.invalid !== "true") bad.push("a malformed address is not told under its box when the person leaves it: " + JSON.stringify(one));
    // another row may not be added while an address above is malformed
    await click(tab, "#addLinkBtn"); await sleep(150);
    if ((await tab.eval("document.querySelectorAll('#linkRows > div').length")) !== 1) bad.push("a second row was added although the first address is malformed");
    if (!(await tab.eval("document.activeElement && document.activeElement.getAttribute('aria-label') === 'Destination address 1'"))) bad.push("the cursor was not put back in the malformed address");
    // the sentence goes away when the box is edited
    await typeIn(tab, 'input[aria-label="Destination address 1"]', "https://example.com/apply"); await sleep(100);
    if ((await tab.eval("document.querySelector('input[aria-label=\"Destination address 1\"]').parentElement.querySelector('.field-error').hidden")) !== true) bad.push("the sentence stays after the address was edited");
    // the policy box: judged when the person leaves it
    await typeIn(tab, "#policyUrl", "https//policy.example");
    await blur(tab, "#policyUrl"); await sleep(150);
    if ((await text(tab, "#policyError")) !== "The address must start with https://") bad.push("a malformed policy address is not told under its box: '" + (await text(tab, "#policyError")) + "'");
    // submit: nothing is created, and ONE list names every section that needs fixing
    await typeIn(tab, 'input[aria-label="Destination address 1"]', "https//example.com/apply");
    await click(tab, "#registerBtn"); await sleep(500);
    if (callsOf(site, "create-posting").length) bad.push("an opening was created although an address was malformed");
    const list = (await text(tab, "#formAlert")) || "";
    if (!/^Nothing was saved\. Please fix: .*destination link 1.*the AI and hiring policy link/.test(list)) bad.push("the one list is missing or incomplete: '" + list + "'");
    return bad; })); },
  async addressesSavedTogether(root) { return withSite(root, { plan: "verified", applyCheck: "failed" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await fillRegister(tab); await pickAustin(tab);
    await typeIn(tab, 'input[aria-label="Destination address 1"]', "https://example.com/apply");
    await typeIn(tab, "#policyUrl", "https://example.com/policy");
    await click(tab, "#draftBtn"); await waitResult(tab);
    if (applyCalls(site).length !== 1 || policyCalls(site).length !== 1) bad.push("expected one application call and one policy call, got " + applyCalls(site).length + " and " + policyCalls(site).length);
    const r = (await text(tab, "#checkReport")) || "";
    if (!/destination link 1 answered HTTP 404/.test(r) || (r.match(/When we checked/g) || []).length !== 1) bad.push("the address check is not ONE sentence: '" + r + "'");
    return bad; })); },
  // (prompt BK: the "a firm is typed while the switch is off" scenario is gone with the state it tested: turning the switch off clears the typed firm rows; tests\register-bk.test.js, firmsCleared)
  // ---- the buttons
  async bottomButtons(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    const o = await tab.eval(`(() => {
      const f = document.querySelector('#form'), reg = document.querySelector('#registerBtn'), dr = document.querySelector('#draftBtn');
      const all = Array.from(f.querySelectorAll('*'));
      const idx = (el) => all.indexOf(el);
      const sections = ['#policyRow', '#recruiterToggle', '#linksSection', '#goLive', '#closeout', '#desc'].map((s) => ({ s, i: idx(f.querySelector(s)) }));
      const controls = Array.from(f.querySelectorAll('button, a[href], input, textarea, select')).filter((e) => !e.closest('[hidden]'));
      const last = controls[controls.length - 1], beforeLast = controls[controls.length - 2];
      const cancel = Array.from(document.querySelectorAll('button, a')).filter((e) => /^\\s*cancel\\s*$/i.test(e.textContent)).length;
      return { reg: idx(reg), dr: idx(dr), sections, lastId: last && last.id, beforeLastId: beforeLast && beforeLast.id, regText: reg.textContent.trim(), drText: dr.textContent.trim(), cancel };
    })()`);
    for (const s of o.sections) if (s.i < 0 || s.i > o.reg) bad.push(s.s + " is not above Add opening (positions " + s.i + " and " + o.reg + ")");
    if (o.lastId !== "draftBtn" || o.beforeLastId !== "registerBtn") bad.push("the last two controls of the form are '" + o.beforeLastId + "' and '" + o.lastId + "'");
    if (o.regText !== "Add opening" || o.drText !== "Save draft") bad.push("the buttons read '" + o.regText + "' and '" + o.drText + "'");
    if (o.cancel !== 0) bad.push("there is a Cancel button or link (" + o.cancel + ")");
    return bad; })); },
  // ---- unsaved work, Discard, leaving the page
  async unsavedBar(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    if (await visible(tab, "#unsavedBar")) bad.push("the unsaved bar is up on a fresh page");
    await typeIn(tab, "#jtitle", "Support Analyst");
    if (!(await visible(tab, "#unsavedBar"))) { bad.push("typing a title does not show the unsaved bar"); return bad; }
    if ((await text(tab, "#unsavedHead")) !== "This opening is not added yet") bad.push("the bar says '" + (await text(tab, "#unsavedHead")) + "'");
    if (!/Nothing is kept until you press Add opening or Save draft\. Discard clears the form\./.test((await text(tab, "#unsavedDetail")) || "")) bad.push("the bar's detail is '" + (await text(tab, "#unsavedDetail")) + "'");
    await typeIn(tab, 'input[aria-label="Destination address 1"]', "https://example.com/apply");
    await typeIn(tab, "#policyUrl", "https://example.com/policy");
    if (!/Typed in: destination links and AI and hiring policy link\./.test((await text(tab, "#unsavedDetail")) || "")) bad.push("the bar does not name the sections that hold typed text: '" + (await text(tab, "#unsavedDetail")) + "'");
    // the browser's own question is registered while something is unsaved and not otherwise
    const asked = await tab.eval("(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; })()");
    if (asked !== true) bad.push("the leave-the-page question is not asked while something is unsaved");
    // Discard clears everything and says so
    await click(tab, "#unsavedDiscard"); await sleep(300);
    if (await visible(tab, "#unsavedBar")) bad.push("the bar stays after Discard");
    if ((await value(tab, "#jtitle")) !== "" || (await value(tab, 'input[aria-label="Destination address 1"]')) !== "" || (await value(tab, "#policyUrl")) !== "") bad.push("Discard left typed text in the form");
    if (!/What you typed was discarded\. The form is empty\./.test((await text(tab, "#unsavedLive")) || "")) bad.push("Discard is not announced: '" + (await text(tab, "#unsavedLive")) + "'");
    const asked2 = await tab.eval("(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; })()");
    if (asked2 === true) bad.push("the leave-the-page question is still asked after Discard");
    return bad; })); },
  async unsavedOnlyLinks(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    if (await visible(tab, "#unsavedBar")) bad.push("the unsaved bar is up on a fresh page");
    await typeIn(tab, 'input[aria-label="Destination address 1"]', "https://example.com/apply");
    if (!(await visible(tab, "#unsavedBar"))) bad.push("an address typed alone does not show the unsaved bar");
    if (!/Typed in: destination links\./.test((await text(tab, "#unsavedDetail")) || "")) bad.push("the bar does not name the destination links: '" + (await text(tab, "#unsavedDetail")) + "'");
    await typeIn(tab, 'input[aria-label="Destination address 1"]', "");
    if (await visible(tab, "#unsavedBar")) bad.push("clearing the address left the bar up");
    await typeIn(tab, "#policyUrl", "https://example.com/policy");
    if (!(await visible(tab, "#unsavedBar"))) bad.push("a policy address typed alone does not show the unsaved bar");
    await typeIn(tab, "#policyUrl", "");
    await click(tab, "#recruiterToggle"); await sleep(150);
    await typeIn(tab, 'input[aria-label="Recruiter firm 1"]', "Northwind Staffing");
    if (!(await visible(tab, "#unsavedBar"))) bad.push("a firm typed alone does not show the unsaved bar");
    return bad; })); },
  async discardRefused(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site, false);
    await typeIn(tab, "#jtitle", "Support Analyst");
    await click(tab, "#unsavedDiscard"); await sleep(200);
    if ((await value(tab, "#jtitle")) !== "Support Analyst") bad.push("Discard cleared the form although the person said no");
    return bad; })); },
  async leaveQuestion(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await tab.eval("document.querySelector('a[href=\"search.html\"]').click()"); await sleep(300);
    if (await visible(tab, "#leaveOverlay")) bad.push("a clean page asks before leaving");
    return bad; })); },
  async leaveDialog(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await typeIn(tab, "#jtitle", "Support Analyst");
    await tab.eval("document.querySelector('a[href=\"search.html\"]').click()"); await sleep(300);
    if (!(await visible(tab, "#leaveOverlay"))) { bad.push("a link out of the page does not ask first"); return bad; }
    if ((await tab.eval("location.pathname")) !== "/register.html") bad.push("the page was left before the person answered");
    const labels = await tab.eval("['#leaveSave', '#leaveDiscard', '#leaveStay'].map((s) => document.querySelector(s).textContent.trim())");
    if (JSON.stringify(labels) !== JSON.stringify(["Save draft and leave", "Discard and leave", "Stay on this page"])) bad.push("the dialog's buttons read " + JSON.stringify(labels));
    if (!(await tab.eval("document.activeElement && document.activeElement.id === 'leaveStay'"))) bad.push("focus is not on Stay");
    await click(tab, "#leaveStay"); await sleep(200);
    if (await visible(tab, "#leaveOverlay") || (await value(tab, "#jtitle")) !== "Support Analyst") bad.push("Stay did not close the dialog and keep the page as it was");
    await tab.eval("document.querySelector('a[href=\"search.html\"]').click()"); await sleep(300);
    await click(tab, "#leaveDiscard");
    await tab.waitFor("location.pathname === '/search.html'", 8000).catch(() => null);
    if ((await tab.eval("location.pathname")) !== "/search.html") bad.push("Discard and leave did not leave");
    if (callsOf(site, "create-posting").length) bad.push("Discard and leave created an opening");
    return bad; })); },
  async leaveSaveDraft(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await fillRegister(tab); await pickAustin(tab);
    await tab.eval("document.querySelector('a[href=\"search.html\"]').click()"); await sleep(300);
    await click(tab, "#leaveSave");
    await tab.waitFor("location.pathname === '/search.html'", 10000).catch(() => null);
    const c = callsOf(site, "create-posting");
    if (c.length !== 1) bad.push("create-posting was called " + c.length + " times");
    if ((await tab.eval("location.pathname")) !== "/search.html") bad.push("Save draft and leave did not leave");
    return bad; })); },
  async barSaveDraft(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await fillRegister(tab); await pickAustin(tab);
    await click(tab, "#unsavedSave"); await waitResult(tab);
    if (callsOf(site, "create-posting").length !== 1) bad.push("Save draft in the bar did not create the draft");
    if (!/Saved as a draft/.test((await text(tab, "#result h2")) || "")) bad.push("the result does not say it is a draft");
    if (await visible(tab, "#unsavedBar")) bad.push("the bar stays after the opening was saved");
    return bad; })); },
  async unsavedAfterRefusal(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await typeIn(tab, "#jtitle", "Support Analyst");
    await click(tab, "#draftBtn"); await sleep(400);          // refused: the other fields are missing
    if (!(await visible(tab, "#unsavedBar"))) bad.push("the bar went away although nothing was saved");
    return bad; })); },
  // ---- the place box: limit and count, on both forms
  async placeCount(root) { return withSite(root, { plan: "verified", placeText: "Zürich, Switzerland" }, (site) => withTab(async (tab) => { const bad = [];
    const hint = (t) => text(t, "#loctextHint");
    await openRegister(tab, site);
    await click(tab, "#locOutside"); await sleep(150);
    if (!/^Up to 100 characters\./.test((await hint(tab)) || "")) bad.push("register: the hint does not start with the limit: '" + (await hint(tab)) + "'");
    if ((await text(tab, "#loctextCount")) !== "0 of 100") bad.push("register: the count reads '" + (await text(tab, "#loctextCount")) + "'");
    await typeIn(tab, "#loctext", "Lisbon, Portugal");
    if ((await text(tab, "#loctextCount")) !== "16 of 100") bad.push("register: the count after typing reads '" + (await text(tab, "#loctextCount")) + "'");
    await typeIn(tab, "#loctext", "x".repeat(100));
    if (await visible(tab, "#loctextLimit")) bad.push("register: the limit sentence is shown before a character was refused");
    await tab.eval("(() => { const i = document.querySelector('#loctext'); i.focus(); i.setSelectionRange(100, 100); i.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: 'y', bubbles: true, cancelable: true })); })()"); await sleep(100);
    if ((await text(tab, "#loctextLimit")) !== "That is all it can hold: 100 characters.") bad.push("register: typing past the limit says '" + (await text(tab, "#loctextLimit")) + "'");
    await typeIn(tab, "#loctext", "x".repeat(90));
    if (await visible(tab, "#loctextLimit")) bad.push("register: the limit sentence stays after text was removed");
    await tab.eval("(() => { const i = document.querySelector('#loctext'); i.focus(); i.setSelectionRange(90, 90); const dt = new DataTransfer(); dt.setData('text/plain', 'abcdefghijklmnop'); i.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertFromPaste', dataTransfer: dt, bubbles: true, cancelable: true })); })()"); await sleep(100);
    if (!/was longer than 100 characters, so it was cut at 100\./.test((await text(tab, "#loctextLimit")) || "")) bad.push("register: a paste past the limit says '" + (await text(tab, "#loctextLimit")) + "'");
    await openEdit(tab, site);
    if (!/^Up to 100 characters\./.test((await hint(tab)) || "")) bad.push("edit: the hint does not start with the limit: '" + (await hint(tab)) + "'");
    if ((await text(tab, "#loctextCount")) !== "19 of 100") bad.push("edit: the count of the stored place reads '" + (await text(tab, "#loctextCount")) + "'");
    return bad; })); },
  // ---- one place line
  async commentsPlace(root) { return withSite(root, { detailOverride: { locations: [], is_remote: false, source_location_text: "Berlin, Germany" } }, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site, "candidate");
    await tab.goto(site.url + "/comments.html?ref=" + WITH_LINKS);
    await tab.waitFor("!document.querySelector('#threadWrap').hidden || !document.querySelector('#pageAlert').hidden", 10000); await sleep(500);
    const m = (await text(tab, "#recapMeta")) || "";
    if (!/^Berlin, Germany as provided by the employer · Opening ID /.test(m)) bad.push("a typed place on the comments page reads '" + m + "'");
    return bad; })); },
  async commentsPlaceRemote(root) { return withSite(root, { detailOverride: { locations: ["Boston, MA"], is_remote: true, source_location_text: null } }, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site, "candidate");
    await tab.goto(site.url + "/comments.html?ref=" + WITH_LINKS);
    await tab.waitFor("!document.querySelector('#threadWrap').hidden || !document.querySelector('#pageAlert').hidden", 10000); await sleep(500);
    const m = (await text(tab, "#recapMeta")) || "";
    if (!/^Remote · Boston, MA · Opening ID /.test(m) || /as provided/.test(m)) bad.push("a list place with Remote on the comments page reads '" + m + "'");
    return bad; })); },
  async commentsPlaceNone(root) { return withSite(root, { detailOverride: { locations: [], is_remote: false, source_location_text: null } }, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site, "candidate");
    await tab.goto(site.url + "/comments.html?ref=" + WITH_LINKS);
    await tab.waitFor("!document.querySelector('#threadWrap').hidden || !document.querySelector('#pageAlert').hidden", 10000); await sleep(500);
    const m = (await text(tab, "#recapMeta")) || "";
    if (!/^Location not stated · Opening ID /.test(m)) bad.push("no place on the comments page reads '" + m + "'");
    return bad; })); },
  async editPlaceLine(root) { return withSite(root, { plan: "verified", placeText: "Zürich, Switzerland" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    const t = (await text(tab, "#placeLine")) || "";
    // prompt BL: the employer typed it, so the editor shows the plain place line (the candidate screens keep the note)
    if (t !== "Place: Zürich, Switzerland") bad.push("the editor's place line reads '" + t + "'");
    return bad; })); },
  async historyWords(root) { return withSite(root, { plan: "verified", recentChanges: [
      { at: new Date(Date.now() - 86400000).toISOString(), note: "edit-posting: changed source_location_text", kind: "draft_edit", fields: [] },
      { at: new Date(Date.now() - 2 * 86400000).toISOString(), note: "edit-posting: changed title, req_number", kind: "draft_edit", fields: [] },
      { at: new Date(Date.now() - 3 * 86400000).toISOString(), note: "Fixed a typo in the third paragraph", kind: "text_correction", fields: [] }] }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    const t = (await text(tab, "#changesList")) || "";
    if (/source_location_text|req_number|edit-posting|_/.test(t)) bad.push("the history shows an internal name: '" + t + "'");
    if (!/Place changed/.test(t) || !/Changed: job title and req number\./.test(t) || !/Fixed a typo in the third paragraph/.test(t)) bad.push("the history lines are not in plain words: '" + t + "'");
    return bad; })); },
};

for (const [name, run] of Object.entries(SCENARIOS)) {
  test("prompt BJ, " + name, { timeout: 180000 }, async () => {
    const bad = await run(ROOT);
    assert.deepEqual(bad, [], bad.join("\n"));
  });
}

// ---- negative controls: one defect at a time in the page code; each must make a scenario fail
const DEFECTS = [
  ["the policy row is not drawn for an organization off the tier", [["js/pages/register.js", (s) => s.replace('$("#policyLocked").hidden = v.show !== "locked";', '$("#policyLocked").hidden = true; $("#policyRow").hidden = v.show !== "form";')]], ["policyLocked"]],
  ["the policy link is never saved", [["js/pages/register.js", (s) => s.replace("if (pc.used && await savePolicy(pc) === \"gone\") return;", "")]], ["policySaved", "addressesSavedTogether"]],
  ["the policy link is saved before the opening exists (sent with the create)", [["js/pages/register.js", (s) => s.replace("state.saved = created.data;\n    lockForm();", "state.saved = created.data;\n    lockForm();\n    await savePolicy({ url: \"https://example.com/x\" });")]], ["policyNotRequired"]],
  ["an address is not judged when the person leaves the box", [["js/link-rows.js", (s) => s.replace("row.addr.addEventListener(\"blur\", () => judge(row));", "")]], ["addressAsTyped"]],
  ["another row can be added while an address is malformed", [["js/link-rows.js", (s) => s.replace("if (bad) { bad.addr.focus(); return; }", "")]], ["addressAsTyped"]],
  ["the policy address is not judged before saving", [["js/pages/register.js", (s) => s.replace("const lp = linkProblems({ links: lc, firms: fc, policy: pc });", "const lp = linkProblems({ links: lc, firms: fc, policy: { used: false, ok: true } });")]], ["addressAsTyped"]],
  ["problems are told one section at a time (the policy is left out of the list)", [["js/register-form.js", (s) => s.replace("if (policy && policy.used && !policy.ok) items.push(", "if (false) items.push(")]], ["addressAsTyped"]],
  ["the card's policy words are not the editor's (it says 'saved anyway')", [["js/register-form.js", (s) => s.replace("return { kind: !l || l.check_status === \"ok\" ? \"ok\" : \"notice\", text: policySavedText(saved, false) };", "return { kind: \"notice\", text: \"When we checked, the AI and hiring policy link answered HTTP \" + (l && l.check_http) + \". It is saved anyway. Make sure it is right.\" };")]], ["policyCheckFailed"]],
  ["the unsaved bar is never shown on the register page", [["js/pages/register.js", (s) => s.replace("return { dirty: registerSnapshot(collect(), rowsNow()) !== state.baseline, sections: SECTIONS() };", "return { dirty: false, sections: [] };")]], ["unsavedBar", "leaveDialog", "barSaveDraft"]],
  ["the typed link rows are not counted as unsaved work", [["js/dirty-state.js", (s) => s.replace("links: strip(r.links, [\"url\", \"label\"]), firms: strip(r.firms, [\"name\", \"url\"]), policy: trim(r.policy),", "links: [], firms: [], policy: \"\",")]], ["unsavedOnlyLinks"]],
  ["Discard does not clear the policy box", [["js/pages/register.js", (s) => s.replace('"#aiInterviewNote", "#policyUrl", "#gldate"]', '"#aiInterviewNote", "#gldate"]')]], ["unsavedBar"]],
  ["Discard clears without asking", [["js/unsaved-guard.js", (s) => s.replace("if (!ctx.confirmDiscard()) return; ctx.discard();", "ctx.discard();")]], ["discardRefused"]],
  ["a link out of the page is not held back", [["js/pages/register.js", (s) => s.replace("state.guard.interceptClick(ev, { kind: \"link\", href: a.getAttribute(\"href\"), target: a.getAttribute(\"target\"), download: a.hasAttribute(\"download\"), el: a }); return; }", "return; }")]], ["leaveDialog", "leaveSaveDraft"]],
  ["the leave-the-page question is not registered", [["js/unsaved-guard.js", (s) => s.replace("if (s.any && !listening) { win.addEventListener(\"beforeunload\", onBeforeUnload); listening = true; }", "")]], ["unsavedBar"]],
  ["a Cancel button is added at the bottom", [["register.html", (s) => s.replace("<button type=\"button\" id=\"draftBtn\" class=\"btn btn-ghost\">Save draft</button>", "<button type=\"button\" id=\"draftBtn\" class=\"btn btn-ghost\">Save draft</button><a href=\"dashboard.html\" class=\"btn btn-ghost\">Cancel</a>")]], ["bottomButtons"]],
  ["the register page's place box does not say its limit", [["register.html", (s) => s.replace('<div id="loctextHint" class="field-hint">Up to 100 characters. Shown', '<div id="loctextHint" class="field-hint">Shown')]], ["placeCount"]],
  ["the editor's place box does not say its limit", [["edit.html", (s) => s.replace('<div id="loctextHint" class="field-hint">Up to 100 characters. Shown', '<div id="loctextHint" class="field-hint">Shown')]], ["placeCount"]],
  ["the place count is not drawn", [["js/place-choice.js", (s) => s.replace("const drawCount = () => { if (count) count.textContent = PLACE_WORDS.COUNT(input.value.length); };", "const drawCount = () => {};")]], ["placeCount"]],
  ["a paste that is cut says nothing", [["js/place-choice.js", (s) => s.replace("if (incoming.length > room) say(incoming.length > 1 ? PLACE_WORDS.CUT : PLACE_WORDS.FULL);", "")]], ["placeCount"]],
  ["the comments page leaves out the typed place", [["js/pages/comments.js", (s) => s.replace("meta.append(...placeNodes(h, p), ", "meta.append(\"Location not stated\", ")]], ["commentsPlace"]],
  ["the one place line leaves out Remote", [["js/format.js", (s) => s.replace('if (isRemote === true) parts.push("Remote");', "")]], ["commentsPlaceRemote"]],
  ["the editor shows no place line", [["js/pages/edit.js", (s) => s.replace("$(\"#placeLine\")", "$(\"#placeLineGone\")")]], ["editPlaceLine"]],
  ["the history shows the stored note as it is", [["js/pages/edit.js", (s) => s.replace("plainChangeNote(c.note)", "c.note")]], ["historyWords"]],
];
test("negative controls: each defect in the register page's code makes a scenario fail", { timeout: 3600000 }, async () => {
  const missed = [];
  for (const [label, edits, scenarios] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-bj-ctl-"));
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
