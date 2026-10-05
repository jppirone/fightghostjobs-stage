// edit-a11y.test.js - the edit page's "unsaved changes" bar for screen-reader users, in a real browser (October 5, 2026; John's keyboard-only pass on stage, October 4, 2026). The repo's own files, a fake backend (tests/fake-site.js).
// B4(a): a polite status message is spoken ONCE when the bar appears (what is unsaved), is not repeated while the person keeps typing (the change note included), and is spoken ONCE when it goes away: "No unsaved changes." when
// the bar closes because the title was changed back by hand or because Save changes worked, the discard's own sentence (and nothing else) when Discard was used. Neither moves the keyboard focus.
// SKIP LINK (October 5, 2026): "Skip to unsaved changes" is the first link of the page, exists only while the bar shows (hidden and out of the Tab order otherwise, never stale after the bar closes by a change back, Discard or Save changes),
// is visible on focus like the other skip link (44 pixels tall on a phone, inside the window), moves focus to Save changes, and does not disturb the spoken messages.
// Then negative controls: one defect at a time (never announced on closing, announced twice on a discard, announced on every keystroke, focus moved to the bar); each must make a check fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/edit-a11y.test.js
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
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

const WATCH = `(() => { window.__said = []; new MutationObserver(() => { const t = document.getElementById("unsavedLive").textContent.trim(); if (t) window.__said.push(t); }).observe(document.getElementById("unsavedLive"), { childList: true, subtree: true, characterData: true }); })()`;
const type = (tab, id, value) => tab.eval(`(() => { const e = document.getElementById(${JSON.stringify(id)}); e.value = ${JSON.stringify(value)}; e.dispatchEvent(new Event("input", { bubbles: true })); })()`);
const said = async (tab) => { await sleep(250); return JSON.parse(await tab.eval("JSON.stringify(window.__said)")); };

const SCENARIOS = {
  async unsaved(site) {
    const bad = [], tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
      await tab.goto(site.url + "/_dev/link?kind=poster"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
      await tab.viewport(1280, false);
      await tab.goto(site.url + "/" + EDIT);
      await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden && !!document.querySelector('#jtitle').value", 10000); await sleep(500);
      await tab.eval(WATCH);
      await tab.eval(`document.getElementById("jtitle").focus(); window.confirm = () => true;`);
      const orig = await tab.eval(`document.getElementById("jtitle").value`);
      const focusIs = async (id, what) => { const at = await tab.eval("document.activeElement && document.activeElement.id"); if (at !== id) bad.push(what + ": focus moved to '" + at + "' (wanted '" + id + "')"); };
      const barShown = () => tab.eval(`!document.getElementById("unsavedBar").hidden`);
      const mark = (n, what) => async () => { const s = await said(tab); if (s.length !== n) bad.push(what + ": " + s.length + " spoken messages so far (wanted " + n + "): " + JSON.stringify(s.slice(-3))); return s; };

      // 1. the bar appears: told once; more typing and a typed note: not told again
      await type(tab, "jtitle", orig + " X"); await sleep(200);
      if (!(await barShown())) bad.push("the bar did not appear after a change");
      let s = await mark(1, "bar appears")();
      if (!(s[0] || "").startsWith("You have unsaved changes")) bad.push("the first message is not the unsaved-changes message: " + s[0]);
      await focusIs("jtitle", "bar appears");
      await type(tab, "jtitle", orig + " XY"); await type(tab, "note", "typo"); await tab.eval(`document.getElementById("note").dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }))`);
      await mark(1, "more typing")();
      // 2. changed back by hand: the bar goes away; told once
      await tab.eval(`document.getElementById("jtitle").focus()`); await type(tab, "jtitle", orig); await type(tab, "note", ""); await sleep(200);
      if (await barShown()) bad.push("the bar stayed after the title was changed back");
      s = await mark(2, "changed back by hand")();
      if (s[1] !== "No unsaved changes.") bad.push("the message when the bar goes away is '" + s[1] + "'");
      await focusIs("jtitle", "changed back by hand");
      // 3. the bar appears again: told again, once; Discard: its own sentence once, and nothing else
      await type(tab, "jtitle", orig + " Z"); await sleep(200); await mark(3, "bar appears again")();
      await tab.eval(`document.getElementById("unsavedDiscard").click()`); await sleep(600);
      if (await barShown()) bad.push("the bar stayed after Discard");
      s = await mark(4, "Discard")();
      if (!/discarded/.test(s[3] || "")) bad.push("the Discard message is '" + s[3] + "'");
      // 4. Save changes: the bar goes away because it worked; told once
      await tab.eval(`document.getElementById("jtitle").focus()`); await type(tab, "jtitle", orig + " Q"); await type(tab, "note", "fixed a typo"); await sleep(200);
      await mark(5, "bar appears before Save")();
      await tab.eval(`document.getElementById("unsavedSave").click()`);
      await tab.waitFor(`!document.getElementById("unsavedBar") || document.getElementById("unsavedBar").hidden`, 6000); await sleep(500);
      s = await mark(6, "Save changes")();
      if (s[5] !== "No unsaved changes.") bad.push("after Save changes the message is '" + s[5] + "'");
    } finally { await tab.close(); }
    return bad;
  },
};

// the first control Tab reaches from the very top of the page, and what the skip link looks like
const FIRST_TAB = async (tab) => {
  await tab.eval(`(() => { if (document.activeElement) document.activeElement.blur(); let s = document.getElementById("__start"); if (!s) { s = document.createElement("span"); s.id = "__start"; s.tabIndex = -1; document.body.prepend(s); } s.focus(); })()`);
  await tab.key("Tab");
  return tab.eval(`(() => { const a = document.activeElement, r = a.getBoundingClientRect(); return { id: a.id, text: a.textContent.trim().slice(0, 40), left: r.left, top: r.top, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight }; })()`);
};
const SKIP = "Skip to unsaved changes";
SCENARIOS.skip = async (site) => {
  const bad = [], tab = await browser.newTab();
  try {
    await tab.focusEmulation(true);
    for (const [width, phone] of [[1280, false], [375, true]]) {
      const tag = "at " + width + ": ";
      await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
      await tab.goto(site.url + "/_dev/link?kind=poster"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
      await tab.viewport(width, phone, 800);
      await tab.goto(site.url + "/" + EDIT);
      await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden && !!document.querySelector('#jtitle').value", 10000); await sleep(500);
      await tab.eval(WATCH + "; window.confirm = () => true;");
      const orig = await tab.eval(`document.getElementById("jtitle").value`);
      const link = () => tab.eval(`(() => { const a = document.getElementById("skipToUnsaved"); return a ? { hidden: a.hidden, shown: a.getClientRects().length > 0, text: a.textContent.trim(), href: a.getAttribute("href") } : null; })()`);
      const mustBeAbsent = async (when) => {
        const l = await link();
        if (!l || l.hidden !== true || l.shown) bad.push(tag + when + ": the skip link is not hidden (" + JSON.stringify(l) + ")");
        const first = await FIRST_TAB(tab);
        if (first.text !== "Skip to content") bad.push(tag + when + ": the first Tab stop is '" + first.text + "' (wanted Skip to content: no unsaved link while nothing is unsaved)");
      };
      await mustBeAbsent("nothing unsaved");
      // a change: the link appears and is the first Tab stop, visible on focus
      await tab.eval(`document.getElementById("jtitle").focus()`); await type(tab, "jtitle", orig + " X"); await sleep(250);
      const l1 = await link();
      if (!l1 || l1.hidden || !l1.shown || l1.text !== SKIP || l1.href !== "#unsavedSave") bad.push(tag + "with the bar showing the skip link is wrong: " + JSON.stringify(l1));
      const first = await FIRST_TAB(tab);
      if (first.id !== "skipToUnsaved") bad.push(tag + "the first Tab stop is '" + first.text + "', not the unsaved skip link");
      else {
        if (first.left < 0 || first.top < 0 || first.left + first.w > first.vw + 0.5 || first.h < 43.5) bad.push(tag + "the skip link is not visible and 44 pixels tall on focus " + JSON.stringify(first));
        await tab.key("Tab"); const second = await tab.eval("document.activeElement.textContent.trim().slice(0, 30)");
        if (second !== "Skip to content") bad.push(tag + "the second Tab stop is '" + second + "' (wanted Skip to content)");
        await FIRST_TAB(tab); const before = JSON.parse(await tab.eval("JSON.stringify(window.__said)")).length;
        await tab.key("Enter"); await sleep(250);
        const at = await tab.eval("document.activeElement.id");
        if (at !== "unsavedSave") bad.push(tag + "the skip link did not move focus to Save changes (focus is on '" + at + "')");
        if (JSON.parse(await tab.eval("JSON.stringify(window.__said)")).length !== before) bad.push(tag + "using the skip link changed what a screen reader is told");
        if (!(await tab.eval("!document.getElementById('unsavedBar').hidden"))) bad.push(tag + "the bar closed when the skip link was used");
      }
      // the bar goes away by a change back: the link goes with it
      await tab.eval(`document.getElementById("jtitle").focus()`); await type(tab, "jtitle", orig); await sleep(250);
      await mustBeAbsent("after the change was reverted");
      // Discard
      await tab.eval(`document.getElementById("jtitle").focus()`); await type(tab, "jtitle", orig + " Y"); await sleep(250);
      if (!(await link()).shown) bad.push(tag + "the skip link did not come back with the bar");
      await tab.eval(`document.getElementById("unsavedDiscard").click()`); await sleep(700);
      await mustBeAbsent("after Discard");
      // Save changes
      await tab.eval(`document.getElementById("jtitle").focus()`); await type(tab, "jtitle", orig + " Z"); await type(tab, "note", "fixed a typo"); await sleep(250);
      await tab.eval(`document.getElementById("unsavedSave").click()`);
      await tab.waitFor(`document.getElementById("unsavedBar").hidden`, 6000); await sleep(500);
      await mustBeAbsent("after Save changes");
    }
  } finally { await tab.close(); }
  return bad;
};

async function withSite(root, fn) { const site = await startFakeSite(root); try { return await fn(site); } finally { await site.close(); } }

test("edit page: the unsaved bar is announced once when it appears and once when it goes away, without moving focus", { timeout: 300000 }, async () => {
  const problems = [];
  await withSite(ROOT, async (site) => { for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](site)) problems.push(n + ": " + p); });
  assert.deepEqual(problems, [], "unsaved bar problems:\n" + problems.join("\n"));
});

const DEFECTS = [
  ["nothing is announced when the bar goes away", [["js/unsaved-guard.js", (s) => s.replace('(quiet ? "" : UNSAVED.CLEARED)', '""')]]],
  ["a discard announces twice (the bar closing and the discard sentence)", [["js/pages/edit.js", (s) => s.replace("guard.hush(true);", "void 0;")]]],
  ["the bar is announced on every keystroke", [["js/unsaved-guard.js", (s) => s.replace("if (say !== null && say !== lastLive) {", "if (say !== null) {")]]],
  ["focus is moved to the bar's Save button when it appears", [["js/unsaved-guard.js", (s) => s.replace("bar.hidden = !s.any;", "bar.hidden = !s.any; if (s.any && wasShownForFocus()) saveBtn.focus();").replace("  function refresh(opts) {", "  const wasShownForFocus = () => bar.dataset.seen !== \"1\" && (bar.dataset.seen = \"1\", true);\n  function refresh(opts) {")]]],
  ["the closing message is wiped by the next refresh (spoken for no time at all)", [["js/unsaved-guard.js", (s) => s.replace(": null);", ': "");')]]],
  ["the skip link is never shown", [["js/unsaved-guard.js", (s) => s.replace("if (skip) skip.hidden = !s.any;", "if (skip) skip.hidden = true;")]], ["skip"]],
  ["the skip link stays after the bar has gone (stale)", [["js/unsaved-guard.js", (s) => s.replace("if (skip) skip.hidden = !s.any;", "if (skip && s.any) skip.hidden = false;")]], ["skip"]],
  ["the skip link comes after Skip to content", [["edit.html", (s) => s.replace('<a id="skipToUnsaved" class="skip-link" href="#unsavedSave" hidden>Skip to unsaved changes</a>\n<a class="skip-link" href="#main">Skip to content</a>\n', '<a class="skip-link" href="#main">Skip to content</a>\n<a id="skipToUnsaved" class="skip-link" href="#unsavedSave" hidden>Skip to unsaved changes</a>\n')]], ["skip"]],
  ["the skip link goes to Discard instead of Save changes", [["js/unsaved-guard.js", (s) => s.replace("(saveBtn.hidden || saveBtn.disabled ? discardBtn : saveBtn).focus()", "discardBtn.focus()")]], ["skip"]],
  ["the skip link does not move focus", [["js/unsaved-guard.js", (s) => s.replace("(saveBtn.hidden || saveBtn.disabled ? discardBtn : saveBtn).focus()", "void 0")]], ["skip"]],
  ["the skip link stays hidden even when focused (never visible)", [["app.css", (s) => s.replace(".skip-link:focus{left:8px;color:#fff}", ".skip-link:focus{left:-9999px;color:#fff}")]], ["skip"]],
  ["the skip link speaks (a message each time it is used)", [["js/unsaved-guard.js", (s) => s.replace("ev.preventDefault(); (saveBtn.hidden", "ev.preventDefault(); announce(\"Skipped.\"); (saveBtn.hidden")]], ["skip"]],
];
test("negative controls: each defect in the unsaved bar's announcements makes a check fail", { timeout: 900000 }, async () => {
  const missed = [];
  for (const [label, edits, names] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-ea11y-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = []; await withSite(dir, async (site) => { for (const n of names || ["unsaved"]) found.push(...(await SCENARIOS[n](site)).map((x) => n + ": " + x)); });
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 160) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
