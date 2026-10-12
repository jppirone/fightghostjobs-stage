// bw.test.js - prompt BW (October 12, 2026): the "This opening is not added yet" bar must be gone the moment an opening is added (or saved as a draft), whichever key or button did it, with NO later key, pointer or
// focus event. In a real browser set up like John's screen (tests/johns-screen.js, 1093 CSS pixels = 1366 at 125 percent) on the repo's own files with a fake backend (tests/fake-site.js; no real project, no key).
// REAL key and mouse events (Input.dispatchKeyEvent, Input.dispatchMouseEvent), never element.click(). The create request is HELD OPEN (opts.createHold) while the key goes down and up, and answered afterwards,
// so the key's own keyup can never be the thing that hides the bar (that is exactly what happens on a real keyboard, and what a quick fake answer would hide). After the answer NOTHING is sent to the page.
// Proven here: Enter on Add opening, Space on Add opening, a real mouse click, Enter inside a field, Enter on Save draft, the bar's own Save draft; the bar stays while the request is in flight and after a failed
// Add; the bar's buttons and the skip link are out of the page afterwards; a publish that fails after the opening exists; the bar comes back when the next opening is typed; the status line says nothing new.
// Then negative controls. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/bw.test.js
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

// the bar and everything that belongs to it, as the page shows it right now (a page expression; it sends nothing to the page)
const BAR = `(() => { const bar = document.getElementById('unsavedBar'), skip = document.getElementById('skipToUnsaved'), live = document.getElementById('unsavedLive'), res = document.getElementById('result');
  const shown = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  return { barHidden: bar.hidden, barShown: shown(bar), barButtons: Array.from(bar.querySelectorAll('button')).filter(shown).length, skipHidden: skip.hidden, skipShown: shown(skip),
    rootOn: document.documentElement.classList.contains('unsaved-on'), live: live.textContent, resultShown: !res.hidden, heading: (res.querySelector('h2') || {}).textContent || null,
    busy: document.getElementById('registerBtn').disabled, alert: (document.getElementById('formAlert') || {}).hidden === false ? document.getElementById('formAlert').textContent.trim() : '',
    active: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null }; })()`;

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
async function fillForm(tab) {
  await typeIn(tab, "#jtitle", "ZZ test tabbing keyboard"); await typeIn(tab, "#req", "R-2026-77"); await typeIn(tab, "#closeout", "Closes when the role is filled"); await typeIn(tab, "#desc", "A plain description of the role.");
  await typeIn(tab, "#locq", "Austin");
  await tab.waitFor("document.querySelectorAll('#locList li').length > 0", 10000);
  await tab.eval("document.querySelector('#locList li').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))"); await sleep(250);
  await tab.eval("document.getElementById('desc').focus()");      // the cursor is in the last field, as after typing the description
}
// the real Tab key until the cursor is on the element (a keyboard user walking the page)
async function tabTo(tab, sel, max = 150) {
  for (let i = 0; i < max; i++) {
    if (await tab.eval("document.activeElement === document.querySelector(" + q(sel) + ")")) return true;
    await tab.key("Tab");
  }
  return false;
}
// a real mouse click at the middle of an element
async function mouseClick(tab, sel) {
  const r = await tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()");
  await tab.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x, y: r.y });
  await tab.send("Input.dispatchMouseEvent", { type: "mousePressed", x: r.x, y: r.y, button: "left", clickCount: 1 });
  await tab.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: r.x, y: r.y, button: "left", clickCount: 1 });
}

// how the opening is sent: each way a person can press it
const HOWS = {
  enterOnAdd: async (tab) => { if (!(await tabTo(tab, "#registerBtn"))) throw new Error("the Tab key never reached Add opening"); await tab.key("Enter"); },
  spaceOnAdd: async (tab) => { if (!(await tabTo(tab, "#registerBtn"))) throw new Error("the Tab key never reached Add opening"); await tab.key(" "); },
  mouseOnAdd: async (tab) => { await mouseClick(tab, "#registerBtn"); },
  enterInField: async (tab) => { await tab.eval("document.getElementById('jtitle').focus()"); await tab.key("Enter"); },
  enterOnSaveDraft: async (tab) => { if (!(await tabTo(tab, "#draftBtn"))) throw new Error("the Tab key never reached Save draft"); await tab.key("Enter"); },
  enterOnBarSaveDraft: async (tab) => { if (!(await tabTo(tab, "#unsavedSave"))) throw new Error("the Tab key never reached the bar's Save draft"); await tab.key("Enter"); },
};
const HEADING = { enterOnAdd: "Added. It is live now.", spaceOnAdd: "Added. It is live now.", mouseOnAdd: "Added. It is live now.", enterInField: "Added. It is live now.", enterOnSaveDraft: "Saved as a draft", enterOnBarSaveDraft: "Saved as a draft" };

// one way of sending, request held open, then answered; nothing is sent to the page after the answer
async function addWith(root, how, extra = {}) {
  return withSite(root, { createHold: true, ...extra }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await fillForm(tab);
    const before = await tab.eval(BAR);
    if (before.barHidden || !before.barShown || !before.rootOn) { bad.push(how + ": the bar is not shown for a form with typed work (" + q(before) + ")"); return bad; }
    await HOWS[how](tab);
    await sleep(700);
    const inflight = await tab.eval(BAR);
    if (!site.calls.some((c) => c.name === "create-posting")) bad.push(how + ": the request was never sent");
    if (inflight.barHidden || !inflight.barShown) bad.push(how + ": the bar went away while the request was still in flight");
    if (inflight.resultShown) bad.push(how + ": the confirmation is shown before the answer");
    site.releaseCreate();
    if (extra.createRefusal) {
      await sleep(900);
      const failed = await tab.eval(BAR);
      if (failed.barHidden || !failed.barShown) bad.push(how + ": the bar went away after a FAILED add (the form is still unsaved)");
      if (failed.resultShown) bad.push(how + ": a confirmation is shown after a failed add");
      return bad;
    }
    if (!(await tab.waitFor("!document.getElementById('result').hidden", 10000))) { bad.push(how + ": the confirmation never showed"); return bad; }
    await sleep(500);      // NO key, NO pointer, NO focus change from here on: only reading the page
    const done = await tab.eval(BAR);
    const want = extra.publishRefusal ? "Saved as a draft. Publishing did not finish." : HEADING[how];
    if (done.heading !== want) bad.push(how + ": the confirmation reads '" + done.heading + "' (wanted '" + want + "')");
    if (!done.barHidden || done.barShown) bad.push(how + ": the bar is still on the screen after the opening was added, with no later input");
    if (done.barButtons !== 0) bad.push(how + ": " + done.barButtons + " of the bar's buttons are still on the screen");
    if (!done.skipHidden || done.skipShown) bad.push(how + ": the Skip to unsaved changes link is still there");
    if (done.rootOn) bad.push(how + ": the page is still marked as having unsaved work");
    // what the status line says: nothing for the page's own buttons (the confirmation is not a live region, so a closing sentence would be the only thing said); the bar's own Save draft keeps the closing
    // sentence it always said ("No unsaved changes."), because the guard redraws itself out loud when that save ends
    const liveWant = how === "enterOnBarSaveDraft" ? "No unsaved changes." : "";
    if (done.live !== liveWant) bad.push(how + ": the status line says '" + done.live + "' (wanted '" + liveWant + "': what is announced is unchanged)");
    return bad; })); }

const SCENARIOS = {
  async enterOnAdd(root) { return addWith(root, "enterOnAdd"); },
  async spaceOnAdd(root) { return addWith(root, "spaceOnAdd"); },
  async mouseOnAdd(root) { return addWith(root, "mouseOnAdd"); },
  async enterInField(root) { return addWith(root, "enterInField"); },
  async enterOnSaveDraft(root) { return addWith(root, "enterOnSaveDraft"); },
  async enterOnBarSaveDraft(root) { return addWith(root, "enterOnBarSaveDraft"); },
  // a failed Add: the bar must stay (nothing is added)
  async failedAdd(root) { return addWith(root, "enterOnAdd", { createRefusal: { status: 500, body: { error: "Internal error", code: "internal_error" } } }); },
  // the opening exists but publishing failed: it is a draft now, the bar is gone, the sentence says so
  async publishFailed(root) { return addWith(root, "enterOnAdd", { publishRefusal: { status: 500, body: { error: "Internal error", code: "internal_error" } } }); },
  // after the add: Tab never lands on the bar's buttons, a second opening typed brings the bar back, and Add another opening works
  async afterwards(root) { return withSite(root, { createHold: true }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site); await fillForm(tab);
    await HOWS.enterOnAdd(tab); await sleep(300); site.releaseCreate();
    await tab.waitFor("!document.getElementById('result').hidden", 10000); await sleep(400);
    for (let i = 0; i < 12; i++) {
      await tab.key("Tab");
      const inBar = await tab.eval("(() => { const a = document.activeElement, bar = document.getElementById('unsavedBar'), skip = document.getElementById('skipToUnsaved'); return !!a && (bar.contains(a) || a === skip); })()");
      if (inBar) { bad.push("a Tab press landed on the bar or its skip link after the add"); break; }
    }
    // Add another opening (the form is empty and unlocked: nothing is unsaved), then typing brings the bar back
    await tab.eval("Array.from(document.querySelectorAll('#result button')).find((b) => /Add another opening/.test(b.textContent)).click()"); await sleep(400);
    let s = await tab.eval(BAR);
    if (!s.barHidden) bad.push("the bar shows for the empty form after Add another opening");
    await typeIn(tab, "#jtitle", "ZZ second"); await sleep(250);
    s = await tab.eval(BAR);
    if (s.barHidden || !s.barShown) bad.push("the bar did not come back when the next opening was typed");
    return bad; })); },
};

test("BW: the 'not added yet' bar is gone the moment the opening is added, by every key and by the mouse, with no later input; it stays while the request is in flight and after a failed add", { timeout: 1800000 }, async () => {
  const problems = [];
  for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](ROOT)) problems.push(n + ": " + p);
  assert.deepEqual(problems, [], "BW problems:\n" + problems.join("\n"));
});

// ---- negative controls: [label, scenarios, [[file, mutate]]]
const ALL_ADDS = ["enterOnAdd", "spaceOnAdd", "mouseOnAdd", "enterInField", "enterOnSaveDraft", "enterOnBarSaveDraft", "publishFailed", "afterwards"];
const DEFECTS = [
  ["the bar is redrawn only by a later key, click or input (the old behavior)", ALL_ADDS.filter((n) => n !== "enterOnBarSaveDraft"), [["js/pages/register.js", (s) => s.replace("    if (!opts.viaBar) refreshUnsaved({ quiet: true });\n", "")]]],
  ["the bar is redrawn out loud (the closing sentence is spoken at the add)", ["enterOnAdd"], [["js/pages/register.js", (s) => s.replace("if (!opts.viaBar) refreshUnsaved({ quiet: true });", "if (!opts.viaBar) refreshUnsaved();")]]],
  ["the bar's own Save draft loses its closing sentence", ["enterOnBarSaveDraft"], [["js/pages/register.js", (s) => s.replace("if (!opts.viaBar) refreshUnsaved({ quiet: true });", "refreshUnsaved({ quiet: true });")]]],
  ["the bar goes away as soon as the Add is pressed (while the request is in flight)", ["enterOnAdd", "failedAdd"], [["js/pages/register.js", (s) => s.replace("  if (state.baseline === null || state.saved) return { dirty: false, sections: [] };", "  if (state.baseline === null || state.saved || state.busy) return { dirty: false, sections: [] };")]]],
  ["the bar goes away after a failed add too", ["failedAdd"], [["js/pages/register.js", (s) => s.replace("      showErrors(m.byField);\n      say(formAlert,", "      state.saved = {}; refreshUnsaved({ quiet: true }); state.saved = null;\n      showErrors(m.byField);\n      say(formAlert,")]]],
  ["the bar never shows", ["enterOnAdd"], [["js/pages/register.js", (s) => s.replace("  if (state.baseline === null || state.saved) return { dirty: false, sections: [] };", "  return { dirty: false, sections: [] };")]]],
  ["the bar is not redrawn after Add another opening", ["afterwards"], [["js/pages/register.js", (s) => s.replace("function registerAnother() { resetForm(); unlockForm(); $(\"#jtitle\").focus(); refreshUnsaved(); }", "function registerAnother() { resetForm(); unlockForm(); $(\"#jtitle\").focus(); }").replace("for (const ev of [\"input\", \"change\", \"click\", \"keyup\"]) document.addEventListener(ev, () => refreshUnsaved());", "")]]],
];
test("negative controls: each defect of BW makes a check fail", { timeout: 6000000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    if (process.env.BW_ONLY && !label.includes(process.env.BW_ONLY)) continue;   // BW_ONLY=<part of a label>: run one control while building
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-bw-ctl-"));
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
