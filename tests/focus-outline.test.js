// focus-outline.test.js - no ring around a sentence or a box that a script moves focus to, and the ring stays on every control (prompt BG, October 10, 2026), in a real browser.
// The repo's own files and a fake backend (tests/fake-site.js; no real project, no key, no network).
//
// What was wrong: after Remove on a row the confirm question took focus and was drawn with a red box; after a firm rename the green "Firm 1 was renamed." message took focus and was drawn with a dark box. The focus
// move is kept (a screen reader reads the sentence); the ring is removed from elements that are not controls (tabindex="-1" on anything but a button, link or field). Buttons, links and fields keep their ring.
// Keyboard use is real here (the test presses the keys), because a browser draws the ring for script focus only after keyboard use.
// Then negative controls: one defect at a time in the style; each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/focus-outline.test.js
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

async function withSite(root, opts, fn) { const site = await startFakeSite(root, opts); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }
async function openEdit(tab, site) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=poster"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.viewport(1280, false);
  await tab.goto(site.url + "/" + EDIT);
  await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden && !!document.querySelector('#jtitle').value", 10000); await sleep(600);
}
// what has focus now, and how it is drawn
const ACTIVE = `(() => { const a = document.activeElement; if (!a) return null; const s = getComputedStyle(a);
  return { tag: a.tagName, cls: a.className || '', tabindex: a.getAttribute('tabindex'), outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, text: (a.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 60), focusVisible: a.matches(':focus-visible') }; })()`;
const ringed = (a) => a && a.outlineStyle !== "none" && parseFloat(a.outlineWidth) > 0;
const THREE = [{ firm: "Acme Staffing" }, { firm: "Name Only Partners", with_address: false }, { firm: "Third Search Group" }];

const SCENARIOS = {
  // Remove by keyboard: the confirm question takes focus, then the sentence after the removal
  async remove(root) { return withSite(root, { plan: "verified", recruiter: true, firms: THREE }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await tab.eval("document.querySelector('#firmsList button[aria-label=\"Remove firm 2\"]').focus()");
    await tab.key("Enter"); await sleep(400);
    let a = await tab.eval(ACTIVE);
    if (!a || a.tabindex !== "-1" || a.tag !== "P") bad.push("the confirm question did not take focus: " + JSON.stringify(a));
    else if (ringed(a)) bad.push("the confirm question is drawn with a ring: " + JSON.stringify(a));
    // the confirm button, by keyboard
    await tab.eval("document.querySelector('#firmsList .link-row[data-position=\"2\"] .link-remove button.btn-dark').focus()");
    const btn = await tab.eval(ACTIVE);
    if (!ringed(btn)) bad.push("the Remove (confirm) button lost its ring: " + JSON.stringify(btn));
    await tab.key("Enter"); await sleep(900);
    a = await tab.eval(ACTIVE);
    if (!a || a.tabindex !== "-1") bad.push("the sentence after the removal did not take focus: " + JSON.stringify(a));
    else if (ringed(a)) bad.push("the sentence after the removal is drawn with a ring: " + JSON.stringify(a));
    return bad; })); },
  // a firm rename by keyboard: the confirm question, then the green sentence
  async rename(root) { return withSite(root, { plan: "verified", recruiter: true, firms: THREE }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await tab.eval("document.querySelector('#firmsList button[aria-label=\"Edit firm 1\"]').focus()");
    await tab.key("Enter"); await sleep(400);
    await tab.eval("(() => { const i = document.querySelectorAll('#firmsList .link-row[data-position=\"1\"] form input')[1]; i.value = 'Acme Talent Partners'; i.focus(); })()");
    await tab.key("Enter"); await sleep(500);
    let a = await tab.eval(ACTIVE);
    if (!a || a.tabindex !== "-1") bad.push("the confirm question did not take focus: " + JSON.stringify(a));
    else if (ringed(a)) bad.push("the confirm question of a rename is drawn with a ring: " + JSON.stringify(a));
    await tab.eval("[...document.querySelectorAll('#firmsList .link-row[data-position=\"1\"] form button')].find((b) => b.innerText.trim() === 'Save').focus()");
    const save = await tab.eval(ACTIVE);
    if (!ringed(save)) bad.push("the Save button lost its ring: " + JSON.stringify(save));
    await tab.key("Enter"); await sleep(1000);
    a = await tab.eval(ACTIVE);
    if (!a || a.tabindex !== "-1") bad.push("the sentence after the rename did not take focus: " + JSON.stringify(a));
    else if (ringed(a)) bad.push("the green sentence after the rename is drawn with a ring: " + JSON.stringify(a));
    return bad; })); },
  // every kind of element: a sentence, a box, a note, a heading with tabindex -1 has no ring; a button, a link, a field has one
  async kinds(root) { return withSite(root, { plan: "verified", recruiter: true, firms: THREE }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await tab.eval("document.querySelector('#jtitle').focus()"); await tab.key("Tab"); await sleep(100);   // keyboard use: the ring is drawn for script focus from here on
    const made = await tab.eval(`(() => { const host = document.querySelector('main') || document.body; const out = [];
      const mk = (tag, cls, attrs) => { const e = document.createElement(tag); if (cls) e.className = cls; for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); e.textContent = 'x'; host.append(e); out.push(e); return e; };
      mk('p', 'link-confirm-text', { tabindex: '-1', id: 'k1' }); mk('div', '', { tabindex: '-1', id: 'k2' }); mk('div', 'contest-notice', { tabindex: '-1', id: 'k3' }); mk('p', 'contest-confirm-title', { tabindex: '-1', id: 'k4' });
      mk('h2', '', { tabindex: '-1', id: 'k5' }); mk('span', 'alert', { tabindex: '-1', id: 'k6' });
      mk('button', 'btn', { type: 'button', tabindex: '-1', id: 'b1' }); mk('a', '', { href: '#', tabindex: '-1', id: 'b2' }); mk('input', '', { type: 'text', tabindex: '-1', id: 'b3' }); mk('textarea', '', { tabindex: '-1', id: 'b4' });
      return out.length; })()`);
    if (made !== 10) bad.push("the probe elements were not made");
    for (const id of ["k1", "k2", "k3", "k4", "k5", "k6"]) {
      await tab.eval("document.getElementById('" + id + "').focus()"); await tab.key("Shift"); const a = await tab.eval(ACTIVE);
      if (ringed(a)) bad.push("a non-interactive element (#" + id + ", " + a.tag + "." + a.cls + ") is drawn with a ring: " + JSON.stringify(a));
    }
    for (const id of ["b1", "b2", "b3", "b4"]) {
      await tab.eval("document.getElementById('" + id + "').focus()"); const a = await tab.eval(ACTIVE);
      if (!ringed(a)) bad.push("a control (#" + id + ", " + a.tag + ") lost its ring: " + JSON.stringify(a));
    }
    return bad; })); },
};

for (const [name, run] of Object.entries(SCENARIOS)) {
  test("the focus ring, " + name, { timeout: 180000 }, async () => {
    const bad = await run(ROOT);
    assert.deepEqual(bad, [], bad.join("\n"));
  });
}

// ---- negative controls
const DEFECTS = [
  ["the rule that removes the ring from non-interactive focus targets is gone", [["app.css", (s) => s.replace(/\/\* BG focus:[^\n]*\n[^\n]*\n[^\n]*\n/, "")]], ["remove", "rename", "kinds"]],
  ["buttons lose their ring too", [["app.css", (s) => s.replace("a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible,.info-icon:focus-visible{outline:2px solid var(--ember);outline-offset:2px}", "a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible,.info-icon:focus-visible{outline:none}")]], ["remove", "kinds"]],
  ["the confirm question gets its own ring again", [["app.css", (s) => s + "\n.link-confirm-text:focus-visible{outline:2px solid var(--ember) !important;outline-offset:2px}\n"]], ["remove"]],
];
test("negative controls: each defect makes a scenario fail", { timeout: 1800000 }, async () => {
  const missed = [];
  for (const [label, edits, scenarios] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-focus-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      for (const n of scenarios) {
        try { for (const p of await SCENARIOS[n](dir)) found.push(n + ": " + p); } catch (e) { found.push(n + ": the scenario could not finish: " + String(e.message).slice(0, 100)); }
      }
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 150) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
