// header-tab-order.test.js - the top bar's keyboard (Tab) order equals its on-screen order, in a real browser (October 5, 2026; John's keyboard-only pass on stage, October 4, 2026).
// The stylesheet reorders the bar with CSS "order" at 1080 and 640 pixels; js/header-order.js puts the page's own order in step with it. This test does what a keyboard user does: it presses Tab through the header
// and compares the order the controls are reached in with the order they are DRAWN in (rows top to bottom, left to right inside a row), at 320, 375, 640, 641, 768, 1080, 1081 and 1280 pixels, on every page that has the
// bar, signed out, signed in as a candidate and signed in as an employer (with and without Team). Three kinds of check:
//   1. a fresh load at each width on three representative pages;
//   2. every page, one load, the window resized through all the widths and back (the order must follow the window live);
//   3. the control that had the keyboard focus still has it after the window is resized across a breakpoint.
// Then negative controls: one defect at a time (the reordering switched off, a wrong breakpoint, no live watching, focus not given back, a CSS order change that is not mirrored); each must make a check fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/header-tab-order.test.js
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
const WIDTHS = [1280, 1081, 1080, 768, 641, 640, 375, 320];
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

const STATES = [
  { who: "out", pages: ["index.html", "search.html", "register.html", "privacy.html", "employer-signin.html"] },
  { who: "candidate", pages: ["search.html", "index.html"] },
  { who: "poster", pages: ["dashboard.html", "analytics.html", "team.html", EDIT, "search.html", "index.html"] },
];

async function signIn(tab, site, who) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  if (who === "out") return;
  await tab.goto(site.url + "/_dev/link?kind=" + who);
  await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
async function openPage(tab, site, page, width, who) {
  await tab.viewport(width, width <= 640);
  await tab.goto(site.url + "/" + page);
  await tab.waitFor("document.readyState === 'complete' && !!document.querySelector('header.nav')", 10000);
  if (who && who !== "out") await tab.waitFor("!!document.querySelector('#navAccount button')", 10000);
  await sleep(700);
}

// the header's controls in the order they are DRAWN (rows top to bottom, left to right inside a row), and the page's own order of the same controls
const DRAWN = `(() => {
  const els = Array.from(document.querySelectorAll("header.nav a[href], header.nav button")).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; });
  els.forEach((e, i) => { e.dataset.tt = String(i); });
  const label = (e) => (e.getAttribute("aria-label") || e.textContent || e.getAttribute("href")).trim().slice(0, 24);
  const items = els.map((e) => { const r = e.getBoundingClientRect(); return { i: e.dataset.tt, cy: r.top + r.height / 2, x: r.left, label: label(e) }; }).sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const it of items) { const row = rows.find((r) => Math.abs(r.cy - it.cy) < 14); if (row) row.items.push(it); else rows.push({ cy: it.cy, items: [it] }); }
  rows.sort((a, b) => a.cy - b.cy);
  return rows.flatMap((r) => r.items.sort((a, b) => a.x - b.x)).map((x) => ({ i: x.i, label: x.label }));
})()`;

async function press(tab, key, code, vk, shift) {
  const m = shift ? 8 : 0;
  await tab.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: m });
  await tab.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: m });
  await sleep(40);
}

// press Tab from a point just before the header until focus has visited every header control (or left the header); -> the labels in the order reached
async function tabOrder(tab, count) {
  await tab.eval(`(() => { if (document.activeElement) document.activeElement.blur(); let s = document.getElementById("__start"); if (!s) { s = document.createElement("span"); s.id = "__start"; s.tabIndex = -1; document.body.prepend(s); } s.focus(); })()`);
  const seen = [];
  for (let k = 0; k < count + 6 && seen.length < count; k++) {          // the page's skip link comes first (outside the bar); only the bar's own controls are recorded
    await press(tab, "Tab", "Tab", 9, false);
    const at = await tab.eval(`(() => { const a = document.activeElement; return a && a.dataset && a.dataset.tt !== undefined && a.closest("header.nav") ? a.dataset.tt : null; })()`);
    if (at !== null) seen.push(at);
  }
  return seen;
}

async function orderProblems(tab, tag) {
  const drawn = await tab.eval(DRAWN);
  if (drawn.length === 0) return [tag + ": the header has no controls to walk"];
  const seen = await tabOrder(tab, drawn.length);
  const want = drawn.map((d) => d.i), names = (ids) => ids.map((i) => (drawn.find((d) => d.i === i) || { label: "?" }).label).join(" > ");
  if (seen.join() !== want.join()) return [tag + ": Tab goes  " + names(seen) + "   but the bar is drawn  " + names(want)];
  return [];
}

const SCENARIOS = {
  // 1. a fresh load at each width
  async fresh(site) {
    const bad = [], tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      for (const [who, page] of [["poster", "dashboard.html"], ["candidate", "search.html"], ["out", "index.html"]]) {
        await signIn(tab, site, who);
        for (const w of WIDTHS) { await openPage(tab, site, page, w, who); bad.push(...(await orderProblems(tab, who + " " + page + " loaded at " + w))); }
      }
    } finally { await tab.close(); }
    return bad;
  },
  // 2. every page: one load, the window resized through every width and back
  async resize(site) {
    const bad = [], tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      for (const { who, pages } of STATES) {
        await signIn(tab, site, who);
        for (const page of pages) {
          await openPage(tab, site, page, 1280, who);
          for (const w of [...WIDTHS, 768, 1280]) {
            await tab.viewport(w, w <= 640); await sleep(350);
            bad.push(...(await orderProblems(tab, who + " " + page.split("?")[0] + " resized to " + w)));
          }
        }
      }
    } finally { await tab.close(); }
    return bad;
  },
  // 3. the control that has the keyboard focus keeps it when the window changes across a breakpoint (moving elements in a page drops the focus unless it is given back)
  async focus(site) {
    const bad = [], tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      await signIn(tab, site, "poster");
      await openPage(tab, site, "dashboard.html", 1280, "poster");
      for (const sel of ["#navAccount button.btn-ghost", "#navAccount a[href='analytics.html']", ".nav-logo"]) {
        for (const [from, to] of [[1280, 375], [375, 768], [768, 1280]]) {
          await tab.viewport(from, from <= 640); await sleep(300);
          await tab.eval(`document.querySelector(${JSON.stringify(sel)}).focus()`);
          await tab.viewport(to, to <= 640); await sleep(400);
          const kept = await tab.eval(`document.activeElement === document.querySelector(${JSON.stringify(sel)})`);
          if (!kept) bad.push("focus on " + sel + " was lost when the window went from " + from + " to " + to);
        }
      }
    } finally { await tab.close(); }
    return bad;
  },
};

async function withSite(root, fn) { const site = await startFakeSite(root); try { return await fn(site); } finally { await site.close(); } }

test("top bar: Tab visits the controls in the order they are drawn, at every width, on every page, signed out and signed in", { timeout: 900000 }, async () => {
  const problems = [];
  await withSite(ROOT, async (site) => { for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](site)) problems.push(n + ": " + p); });
  assert.deepEqual(problems, [], "top bar problems:\n" + problems.join("\n"));
});

const NO_REORDER = (s) => s.replace("export function orderHeader(doc, win) {", "export function orderHeader(doc, win) {\n  return false;");
const DEFECTS = [
  ["the page's order is never put in step with the drawn order", ["fresh", "resize"], [["js/header-order.js", NO_REORDER]]],
  ["the phone breakpoint is wrong (500 instead of 640)", ["fresh", "resize"], [["js/header-order.js", (s) => s.replace('PHONE_QUERY = "(max-width:640px)"', 'PHONE_QUERY = "(max-width:500px)"')]]],
  ["the middle breakpoint is wrong (900 instead of 1080)", ["fresh", "resize"], [["js/header-order.js", (s) => s.replace('MIDDLE_QUERY = "(max-width:1080px)"', 'MIDDLE_QUERY = "(max-width:900px)"')]]],
  ["the window is not watched (the order is only set when the page loads)", ["resize"], [["js/header-order.js", (s) => s.replace("m.addEventListener(\"change\", on)", "void on")]]],
  ["the order is set only at load for the account area (mountAccount never calls it)", ["fresh"], [["js/app.js", (s) => s.split("    orderHeader(document, window);\n").join("").replace("  orderHeader(document, window);\n  return session;", "  return session;")]]],
  ["the focused control is not given back after the move", ["focus"], [["js/header-order.js", (s) => s.replace("active.focus({ preventScroll: true });", "void 0;")]]],
  ["the phone order inside the account area is the wide order", ["fresh", "resize"], [["js/header-order.js", (s) => s.replace("const RANK_PHONE = { circle: 1, signout: 2, link: 3 };", "const RANK_PHONE = { link: 1, circle: 2, signout: 3 };")]]],
  ["the drawn order changes in the stylesheet and the page is not told (links drawn first on a phone)", ["fresh", "resize"], [["app.css", (s) => s.replace("  .nav-links{order:5;width:100%;", "  .nav-links{order:0;width:100%;")]]],
  ["the drawn order changes in the stylesheet (the middle bar puts the links before the account area)", ["fresh", "resize"], [["app.css", (s) => s.replace(".nav-links{order:3;width:100%;gap:20px;flex-wrap:wrap}", ".nav-links{order:-1;width:100%;gap:20px;flex-wrap:wrap}")]]],
];
test("negative controls: each defect in the top bar's order makes a check fail", { timeout: 3000000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-hto-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      await withSite(dir, async (site) => { for (const n of scenarios) found.push(...(await SCENARIOS[n](site)).map((x) => n + ": " + x)); });
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 160) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
