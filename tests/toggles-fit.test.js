// toggles-fit.test.js - every on/off switch sits fully inside its box, at every width and at browser zoom 100 and 125 percent (prompt BG, October 10, 2026), in a real browser.
// The repo's own files and a fake backend (tests/fake-site.js; no real project, no key, no network).
//
// What was wrong: the switch is a flex item next to a long sentence. With nothing to stop it, the browser shrank the SWITCH (its box got narrower than 52 px) while its round knob is positioned inside it by
// absolute coordinates, so the knob ended up outside the switch and at the right edge of the white box. The fix: the switch never shrinks (flex: none, a fixed size) and the sentence beside it may wrap (min-width: 0).
// Checked here for every switch on the employer pages: the switch keeps its 52 x 30 size, its knob is inside it in both positions, the switch is inside the white box that holds it, and the page never scrolls sideways.
// Zoom 125 percent is the same layout as a window 1/1.25 as wide, which is how it is measured. Then negative controls: one defect at a time in the style; each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/toggles-fit.test.js
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

// the real widths the person works at; zoom 125 percent makes the page's CSS width 1/1.25 of it
const WIDTHS = [1366, 1280, 1024, 768, 390];
const CASES = [];
for (const w of WIDTHS) for (const zoom of [1, 1.25]) CASES.push({ w, zoom, css: Math.round(w / zoom) });

// every switch: its own box, its knob, the white box that holds it (the nearest ancestor with a white background and a border, or the page's card), and whether the page scrolls sideways
const MEASURE = `(() => {
  const rect = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const box = (e) => { let p = e.parentElement; while (p && p !== document.body) { const s = getComputedStyle(p); if (s.backgroundColor === 'rgb(255, 255, 255)' && parseFloat(s.borderTopWidth) > 0) return p; p = p.parentElement; } return document.querySelector('.card') || document.body; };
  return { sideways: document.documentElement.scrollWidth > window.innerWidth, innerWidth: window.innerWidth,
    toggles: [...document.querySelectorAll('button.toggle')].filter((t) => !t.closest('[hidden]') && t.offsetParent !== null).map((t) => {
      const k = t.querySelector('.toggle-knob'), b = box(t), text = t.parentElement.firstElementChild;
      return { id: t.id, tog: rect(t), knob: rect(k), box: rect(b), on: t.getAttribute('aria-checked') === 'true', text: text ? rect(text) : null };
    }) };
})()`;

async function openPage(tab, site, page, cssWidth) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=poster"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.viewport(cssWidth, cssWidth < 768);
  await tab.goto(site.url + "/" + page);
  if (page.startsWith("edit")) await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden && !!document.querySelector('#jtitle').value", 10000);
  else await tab.waitFor("document.readyState === 'complete' && !!document.querySelector('button.toggle')", 10000);
  await sleep(700);
}

function judge(label, m, bad) {
  if (m.sideways) bad.push(label + ": the page scrolls sideways");
  if (m.toggles.length === 0) bad.push(label + ": no switch was found on the page");
  for (const t of m.toggles) {
    const who = label + " #" + t.id;
    if (Math.abs(t.tog.w - 52) > 0.6 || Math.abs(t.tog.h - 30) > 0.6) bad.push(who + ": the switch is " + t.tog.w.toFixed(1) + " x " + t.tog.h.toFixed(1) + " px, not 52 x 30 (it was squeezed)");
    if (t.knob.l < t.tog.l - 0.5 || t.knob.r > t.tog.r + 0.5) bad.push(who + ": the knob is outside its switch (knob " + t.knob.l.toFixed(0) + "-" + t.knob.r.toFixed(0) + ", switch " + t.tog.l.toFixed(0) + "-" + t.tog.r.toFixed(0) + ")");
    if (t.tog.r > t.box.r + 0.5 || t.tog.l < t.box.l - 0.5) bad.push(who + ": the switch is outside its box (switch " + t.tog.l.toFixed(0) + "-" + t.tog.r.toFixed(0) + ", box " + t.box.l.toFixed(0) + "-" + t.box.r.toFixed(0) + ")");
    if (t.text && t.text.r > t.tog.l + 0.5) bad.push(who + ": the sentence runs under the switch");
  }
}

const SCENARIOS = {
  async editPage(root) { return withSite(root, { plan: "verified", recruiter: true }, async (site) => { const bad = [];
    for (const c of CASES) {
      await withTab(async (tab) => {
        await openPage(tab, site, EDIT, c.css);
        const m = await tab.eval(MEASURE);
        judge(c.w + "px at zoom " + c.zoom * 100 + "% (" + c.css + " css px) edit", m, bad);
        // the same with every switch turned on: the knob moves to the other end
        await tab.eval("document.querySelectorAll('button.toggle').forEach((t) => { if (t.getAttribute('aria-checked') !== 'true') t.click(); })"); await sleep(400);
        judge(c.w + "px at zoom " + c.zoom * 100 + "% (" + c.css + " css px) edit, all on", await tab.eval(MEASURE), bad);
      });
    }
    return bad; }); },
  async registerPage(root) { return withSite(root, { plan: "verified", recruiter: true }, async (site) => { const bad = [];
    for (const c of CASES) {
      await withTab(async (tab) => {
        await openPage(tab, site, "register.html", c.css);
        judge(c.w + "px at zoom " + c.zoom * 100 + "% (" + c.css + " css px) register", await tab.eval(MEASURE), bad);
      });
    }
    return bad; }); },
};

for (const [name, run] of Object.entries(SCENARIOS)) {
  test("every switch fits its box, " + name, { timeout: 900000 }, async () => {
    const bad = await run(ROOT);
    assert.deepEqual(bad, [], bad.slice(0, 40).join("\n") + (bad.length > 40 ? "\n... and " + (bad.length - 40) + " more" : ""));
  });
}

// ---- negative controls
const DEFECTS = [
  ["the switch is allowed to shrink again (no fixed size)", [["styles.css", (s) => s.replace(".toggle{width:52px;height:30px;flex:none;", ".toggle{width:52px;height:30px;")]], ["editPage", "registerPage"]],
  ["the sentence beside the switch may not wrap (it pushes the switch out)", [["styles.css", (s) => s.replace(".toggle-row>div:first-child{min-width:0;flex:1 1 auto}", ".toggle-row>div:first-child{flex:none;white-space:nowrap}")]], ["editPage"]],
  ["the knob is no longer held inside the switch (its position is not tied to the switch)", [["styles.css", (s) => s.replace(".toggle.on .toggle-knob{left:25px}", ".toggle.on .toggle-knob{left:35px}")]], ["editPage"]],
];
test("negative controls: each defect makes a scenario fail", { timeout: 1800000 }, async () => {
  const missed = [];
  for (const [label, edits, scenarios] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-toggle-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); fs.writeFileSync(p, a0); }
      const found = [];
      for (const n of scenarios) {
        try { for (const p of await SCENARIOS[n](dir)) found.push(n + ": " + p); } catch (e) { found.push(n + ": the scenario could not finish: " + String(e.message).slice(0, 100)); }
      }
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 150) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
