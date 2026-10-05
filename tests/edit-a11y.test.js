// edit-a11y.test.js - the edit page's "unsaved changes" bar for screen-reader users, in a real browser (October 5, 2026; John's keyboard-only pass on stage, October 4, 2026). The repo's own files, a fake backend (tests/fake-site.js).
// B4(a): a polite status message is spoken ONCE when the bar appears (what is unsaved), is not repeated while the person keeps typing (the change note included), and is spoken ONCE when it goes away: "No unsaved changes." when
// the bar closes because the title was changed back by hand or because Save changes worked, the discard's own sentence (and nothing else) when Discard was used. Neither moves the keyboard focus.
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
];
test("negative controls: each defect in the unsaved bar's announcements makes a check fail", { timeout: 900000 }, async () => {
  const missed = [];
  for (const [label, edits] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-ea11y-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = await withSite(dir, (site) => SCENARIOS.unsaved(site));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 160) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
