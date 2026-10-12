// bx.test.js - prompt BX item 1 (October 12, 2026): when an opening is added (Add opening, Add and schedule, Save draft, a publish that fails after the opening exists, and the retry buttons), keyboard focus goes
// to the confirmation's heading, with no further input: a screen reader reads it, a keyboard user is not left on the page body, the first Tab goes to Copy ID as before, the page is where it was, nothing was added
// as a live region, and the unsaved bar stays hidden. Focus does not move while the request is in flight or after a failed add. In a real browser set up like John's screen (1093 CSS pixels = 1366 at 125 percent)
// on the repo's own files with a fake backend (tests/fake-site.js; no real project, no key). REAL key and mouse events; the create request is held open while the key goes down and up, then answered; nothing is
// sent to the page after the answer. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/bx.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startFakeSite } from "./fake-site.js";
import { johnsBrowser, johnsWindow } from "./johns-screen.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = JSON.stringify;
let browser;
before(async () => { browser = await johnsBrowser(); });
after(async () => { if (browser) await browser.close(); });

// what the page shows and where the cursor is, right now (a page expression; it sends nothing to the page)
const STATE = `(() => { const res = document.getElementById('result'), h = res.querySelector('h2'), a = document.activeElement, bar = document.getElementById('unsavedBar');
  const r = h ? h.getBoundingClientRect() : null;
  return { resultShown: !res.hidden, heading: h ? h.textContent : null, headingId: h ? h.id : null, headingTabindex: h ? h.getAttribute('tabindex') : null, headingTabIndexProp: h ? h.tabIndex : null,
    activeId: a ? (a.id || '') : null, activeTag: a ? a.tagName : null, activeIsHeading: !!h && a === h, activeIsBody: a === document.body,
    headingInView: !!r && r.bottom > 0 && r.top < window.innerHeight, headingTop: r ? Math.round(r.top) : null, innerHeight: window.innerHeight,
    resultLive: !!res.getAttribute('aria-live') || !!res.getAttribute('role'), headingLive: !!(h && (h.getAttribute('aria-live') || h.getAttribute('role'))),
    liveInConfirmation: res.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]').length,
    barHidden: bar.hidden, status: document.getElementById('unsavedLive').textContent }; })()`;

async function withSite(root, opts, fn) { const site = await startFakeSite(root, { kio: true, plan: "verified", ...opts }); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }
async function signIn(tab, site) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=poster"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
const typeIn = (tab, sel, value) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); e.value = " + q(value) + "; e.dispatchEvent(new Event('input', { bubbles: true })); })()");
async function openRegister(tab, site) {
  await signIn(tab, site);
  await johnsWindow(tab, 1093, 800);
  await tab.goto(site.url + "/register.html");
  await tab.waitFor("!!document.querySelector('#jtitle') && !!document.querySelector('#locOutside') && document.readyState === 'complete' && !document.querySelector('#policyRow').hidden", 10000).catch(() => null);
  await tab.waitFor("document.fonts.status === 'loaded'", 10000); await sleep(600);
  await tab.eval("window.confirm = () => true;");
}
async function fillForm(tab, { later = false } = {}) {
  await typeIn(tab, "#jtitle", "ZZ test focus after add"); await typeIn(tab, "#req", "R-2026-78"); await typeIn(tab, "#closeout", "Closes when the role is filled"); await typeIn(tab, "#desc", "A plain description of the role.");
  await typeIn(tab, "#locq", "Austin");
  await tab.waitFor("document.querySelectorAll('#locList li').length > 0", 10000);
  await tab.eval("document.querySelector('#locList li').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))"); await sleep(250);
  if (later) {
    const when = new Date(Date.now() + 3 * 86400000), p = (n) => String(n).padStart(2, "0");
    const local = when.getFullYear() + "-" + p(when.getMonth() + 1) + "-" + p(when.getDate()) + "T" + p(when.getHours()) + ":" + p(when.getMinutes());
    await tab.eval("(() => { const l = document.getElementById('glLater'); l.checked = true; l.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await typeIn(tab, "#gldate", local);
  }
  await tab.eval("document.getElementById('desc').focus()");
}
async function tabTo(tab, sel, max = 150) {
  for (let i = 0; i < max; i++) {
    if (await tab.eval("document.activeElement === document.querySelector(" + q(sel) + ")")) return true;
    await tab.key("Tab");
  }
  return false;
}
async function mouseClick(tab, sel) {
  const r = await tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()");
  await tab.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x, y: r.y });
  await tab.send("Input.dispatchMouseEvent", { type: "mousePressed", x: r.x, y: r.y, button: "left", clickCount: 1 });
  await tab.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: r.x, y: r.y, button: "left", clickCount: 1 });
}
const HOWS = {
  enterOnAdd: async (tab) => { if (!(await tabTo(tab, "#registerBtn"))) throw new Error("the Tab key never reached Add opening"); await tab.key("Enter"); },
  spaceOnAdd: async (tab) => { if (!(await tabTo(tab, "#registerBtn"))) throw new Error("the Tab key never reached Add opening"); await tab.key(" "); },
  mouseOnAdd: async (tab) => { await mouseClick(tab, "#registerBtn"); },
  enterInField: async (tab) => { await tab.eval("document.getElementById('jtitle').focus()"); await tab.key("Enter"); },
  enterOnSaveDraft: async (tab) => { if (!(await tabTo(tab, "#draftBtn"))) throw new Error("the Tab key never reached Save draft"); await tab.key("Enter"); },
  enterOnBarSaveDraft: async (tab) => { if (!(await tabTo(tab, "#unsavedSave"))) throw new Error("the Tab key never reached the bar's Save draft"); await tab.key("Enter"); },
};

// one way of sending (request held open, then answered); nothing is sent to the page after the answer
async function addWith(root, how, want, { opts = {}, later = false, then = null } = {}) {
  return withSite(root, { createHold: true, ...opts }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await fillForm(tab, { later });
    await HOWS[how](tab);
    await sleep(700);
    const inflight = await tab.eval(STATE);
    if (inflight.activeIsHeading || inflight.resultShown) bad.push(how + ": the cursor or the confirmation moved before the answer (" + q({ active: inflight.activeId || inflight.activeTag, shown: inflight.resultShown }) + ")");
    site.releaseCreate();
    if (opts.createRefusal) {
      await sleep(900);
      const failed = await tab.eval(STATE);
      if (failed.activeIsHeading || failed.resultShown) bad.push(how + ": after a FAILED add the cursor moved to a confirmation or one is shown");
      if (failed.activeId !== inflight.activeId || failed.activeTag !== inflight.activeTag) bad.push(how + ": after a FAILED add the cursor moved from " + (inflight.activeId || inflight.activeTag) + " to " + (failed.activeId || failed.activeTag));
      return bad;
    }
    if (!(await tab.waitFor("!document.getElementById('result').hidden", 10000))) { bad.push(how + ": the confirmation never showed"); return bad; }
    await sleep(1100);      // the smooth scroll has finished; NO key, NO pointer, NO focus change from here on: only reading the page
    const s = await tab.eval(STATE);
    if (s.heading !== want) bad.push(how + ": the confirmation reads '" + s.heading + "' (wanted '" + want + "')");
    if (!s.activeIsHeading) bad.push(how + ": the cursor is on " + (s.activeIsBody ? "the page body" : (s.activeId || s.activeTag)) + ", not on the confirmation heading, with no later input");
    if (s.headingId !== "resultHeading") bad.push(how + ": the heading has no id resultHeading");
    if (s.headingTabindex !== "-1" || s.headingTabIndexProp !== -1) bad.push(how + ": the heading is not tabindex -1 (it must never be a Tab stop)");
    if (!s.headingInView) bad.push(how + ": the confirmation heading is out of the window (top " + s.headingTop + " of " + s.innerHeight + ")");
    if (s.resultLive || s.headingLive) bad.push(how + ": the confirmation or its heading is a live region (the focus is the only announcement)");
    if (!s.barHidden) bad.push(how + ": the unsaved bar is on the screen");
    if (then) bad.push(...await then(tab, site, how));
    return bad; })); }

const firstTabIsCopyId = async (tab, site, how) => {
  await tab.key("Tab");
  const t = await tab.eval("(() => { const a = document.activeElement; return a ? (a.textContent || a.id || a.tagName).trim().slice(0, 40) : null; })()");
  return t === "Copy ID" ? [] : [how + ": the first Tab goes to '" + t + "' (wanted Copy ID)"];
};

const SCENARIOS = {
  async enterOnAdd(root) { return addWith(root, "enterOnAdd", "Added. It is live now.", { then: firstTabIsCopyId }); },
  async spaceOnAdd(root) { return addWith(root, "spaceOnAdd", "Added. It is live now.", { then: firstTabIsCopyId }); },
  async mouseOnAdd(root) { return addWith(root, "mouseOnAdd", "Added. It is live now."); },
  async enterInField(root) { return addWith(root, "enterInField", "Added. It is live now."); },
  async addAndSchedule(root) { return addWith(root, "enterOnAdd", "Added. It is scheduled.", { later: true, then: firstTabIsCopyId }); },
  async saveDraft(root) { return addWith(root, "enterOnSaveDraft", "Saved as a draft", { then: firstTabIsCopyId }); },
  async barSaveDraft(root) { return addWith(root, "enterOnBarSaveDraft", "Saved as a draft"); },
  async publishFailed(root) { return addWith(root, "enterOnAdd", "Saved as a draft. Publishing did not finish.", { opts: { publishRefusal: { status: 500, body: { error: "Internal error", code: "internal_error" } } } }); },
  async scheduleFailed(root) { return addWith(root, "enterOnAdd", "Saved as a draft. The go-live time was not set.", { later: true, opts: { scheduleRefusal: { status: 500, body: { error: "Internal error", code: "internal_error" } } } }); },
  async failedAdd(root) { return addWith(root, "enterOnAdd", null, { opts: { createRefusal: { status: 500, body: { error: "Internal error", code: "internal_error" } } } }); },
  // the retry button of a failed publish builds the confirmation again: the cursor goes to the new heading (it was on a button that was taken away)
  async retryPublish(root) { return withSite(root, { createHold: true, publishRefusal: { status: 500, body: { error: "Internal error", code: "internal_error" } } }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site); await fillForm(tab);
    await HOWS.enterOnAdd(tab); await sleep(300); site.releaseCreate();
    await tab.waitFor("!!document.getElementById('retryPublish')", 10000); await sleep(500);
    if (!(await tabTo(tab, "#retryPublish"))) { bad.push("the Tab key never reached Try publishing again"); return bad; }
    await tab.key("Enter"); await sleep(1200);
    const s = await tab.eval(STATE);
    if (!s.activeIsHeading) bad.push("after Try publishing again the cursor is on " + (s.activeIsBody ? "the page body" : (s.activeId || s.activeTag)) + ", not on the new confirmation heading");
    return bad; })); },
  // Add another opening keeps what it did: the cursor goes to the title box
  async addAnother(root) { return withSite(root, { createHold: true }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site); await fillForm(tab);
    await HOWS.enterOnAdd(tab); await sleep(300); site.releaseCreate();
    await tab.waitFor("!document.getElementById('result').hidden", 10000); await sleep(500);
    await tab.eval("Array.from(document.querySelectorAll('#result button')).find((b) => /Add another opening/.test(b.textContent)).click()"); await sleep(400);
    const a = await tab.eval("document.activeElement ? document.activeElement.id : null");
    if (a !== "jtitle") bad.push("after Add another opening the cursor is on '" + a + "' (the title box was wanted)");
    return bad; })); },
};

test("BX: after an opening is added the keyboard focus is on the confirmation heading, whichever key or button did it, with no later input; the first Tab goes to Copy ID; nothing moves in flight or after a failed add", { timeout: 1800000 }, async () => {
  const problems = [];
  for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](ROOT)) problems.push(n + ": " + p);
  assert.deepEqual(problems, [], "BX problems:\n" + problems.join("\n"));
});

// ---- negative controls: [label, scenarios, [[file, mutate]]]
const FOCUS = "headingEl.focus({ preventScroll: true });";
const DEFECTS = [
  ["the cursor is not moved (the page body keeps it)", ["enterOnAdd", "saveDraft", "retryPublish"], [["js/pages/register.js", (s) => s.replace(FOCUS, "")]]],
  ["the cursor goes to the first button instead of the heading", ["enterOnAdd"], [["js/pages/register.js", (s) => s.replace(FOCUS, "(result.querySelector(\"button\") || headingEl).focus({ preventScroll: true });")]]],
  ["the heading is a Tab stop (tabindex 0)", ["enterOnAdd"], [["js/pages/register.js", (s) => s.replace('tabindex: "-1", style: "font-size:22px;font-weight:700;"', 'tabindex: "0", style: "font-size:22px;font-weight:700;"')]]],
  ["the confirmation is a live region as well (announced twice)", ["enterOnAdd"], [["js/pages/register.js", (s) => s.replace(FOCUS, FOCUS + " result.setAttribute(\"role\", \"status\");")]]],
  // ("the focus call scrolls the page by itself" is not a browser control: the smooth scroll that follows always ends with the confirmation in view, so the end state cannot tell; the preventScroll pin is S88 and its control)
  ["the cursor moves on a failed add", ["failedAdd"], [["js/pages/register.js", (s) => s.replace("      showErrors(m.byField);\n      say(formAlert,", "      showErrors(m.byField); $(\"#jtitle\").focus();\n      say(formAlert,")]]],
  ["Add another opening leaves the cursor on nothing", ["addAnother"], [["js/pages/register.js", (s) => s.replace('function registerAnother() { resetForm(); unlockForm(); $("#jtitle").focus(); refreshUnsaved(); }', "function registerAnother() { resetForm(); unlockForm(); refreshUnsaved(); }")]]],
];
test("negative controls: each defect of BX makes a check fail", { timeout: 6000000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    if (process.env.BX_ONLY && !label.includes(process.env.BX_ONLY)) continue;   // BX_ONLY=<part of a label>: run one control while building
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-bx-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      for (const n of scenarios) {
        try { found.push(...(await SCENARIOS[n](dir)).map((x) => n + ": " + x)); }
        catch (e) { found.push(n + ": the page broke (" + String(e && e.message).slice(0, 120) + ")"); }
      }
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 170) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
