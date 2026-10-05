// search-ui.test.js - the search page, in a real browser (October 4, 2026): (1) the three search fields look like fields, (2) the details window locks the page behind it. The repo's own files, a fake backend (tests/fake-site.js; no real
// project, no key).
//
// FIELDS: company, req number and "postID, or part of the title" are white on a white card. They had no border at all, so once filled in (for example after a sign-in link returns the saved search) they looked locked. Now each has a bottom line
// at rest that meets the 3 to 1 contrast rule for interface boundaries against the card, and a heavier line plus the focus ring when focused. At 320, 375 and 1280 pixels: the line is there empty and filled, the field order, labels, placeholders and
// the Search button are as before, the req number stays hidden as typed and Show still works, and nothing scrolls sideways.
// DETAILS WINDOW: while it is open the page behind it cannot scroll (a touch swipe on a phone window, the mouse wheel on a desktop one), the scroll position does not move, the page does not shift sideways when a classic scrollbar goes away, and
// closing it restores everything exactly (no leftover style on html or body, the page scrolls again, the position is the same).
// Then negative controls: one defect at a time (a missing line, a too-light line, no focus indication, no lock, a lock that is never undone, a lock that undoes the wrong thing, no scrollbar compensation); each must make a check fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/search-ui.test.js
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
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

async function openSearch(tab, site, who) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  if (who === "cand") { await tab.goto(site.url + "/_dev/link?kind=candidate"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500); }
  await tab.goto(site.url + "/search.html");
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(600);
}

// the contrast of a colour against the card behind the field (the nearest ancestor with a background), computed in the page
const FIELD_CHECK = `(() => {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const rgb = (s) => { const m = String(s).match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(",").map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const cardBg = (el) => { for (let e = el.parentElement; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const out = [];
  for (const id of ["company", "reqq", "titleq"]) {
    const el = document.getElementById(id), cs = getComputedStyle(el);
    const line = rgb(cs.borderBottomColor), bg = cardBg(el);
    const rest = { width: parseFloat(cs.borderBottomWidth), style: cs.borderBottomStyle, ratio: line ? ratio(line, bg) : 0 };
    el.focus();
    const fs = getComputedStyle(el);
    const focus = { outline: fs.outlineStyle, outlineWidth: parseFloat(fs.outlineWidth), shadow: fs.boxShadow, line: fs.borderBottomColor, ratio: rgb(fs.borderBottomColor) ? ratio(rgb(fs.borderBottomColor), bg) : 0 };
    el.blur();
    out.push({ id, rest, focus, type: el.type, ph: el.getAttribute("placeholder"), value: el.value });
  }
  const order = Array.from(document.querySelectorAll("#searchForm input")).map((e) => e.id);
  const labels = ["company", "reqq", "titleq"].map((id) => (document.querySelector("label[for=" + id + "]") || {}).childNodes ? document.querySelector("label[for=" + id + "]").childNodes[0].textContent.trim() : "");
  return { out, order, labels, button: (document.querySelector("#searchBtn") || {}).textContent, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, toggle: !!document.querySelector("#reqToggle") };
})()`;

const EXPECT_PH = { company: "e.g. Meridian Health Systems", reqq: "From the job ad", titleq: "XXXX-XXXX-XXXX, or e.g. Data Analyst" };
async function fieldProblems(tab, width, phone) {
  const bad = [];
  await tab.focusEmulation(true); await tab.viewport(width, phone); await sleep(250);
  for (const filled of [false, true]) {
    if (filled) await tab.eval("(() => { document.querySelector('#company').value = 'Fight Ghost Jobs Pilot'; document.querySelector('#reqq').value = 'R-1234'; document.querySelector('#titleq').value = 'Snr'; })()");
    const r = await tab.eval(FIELD_CHECK), tag = width + (filled ? " filled" : " empty") + ": ";
    for (const f of r.out) {
      if (!(f.rest.width >= 1.5 && f.rest.style === "solid")) bad.push(tag + f.id + " has no visible line at rest (" + f.rest.width + "px " + f.rest.style + ")");
      if (f.rest.ratio < 3) bad.push(tag + f.id + " line contrast " + f.rest.ratio.toFixed(2) + " to 1 (needs 3 to 1)");
      const ring = f.focus.outline !== "none" && f.focus.outlineWidth >= 2;
      const heavier = f.focus.line !== "" && f.focus.line !== undefined && f.focus.ratio > f.rest.ratio + 0.2;
      if (!ring) bad.push(tag + f.id + " shows no focus ring (outline " + f.focus.outline + " " + f.focus.outlineWidth + "px)");
      if (!heavier) bad.push(tag + f.id + " line does not get heavier when focused");
      if (f.ph !== EXPECT_PH[f.id]) bad.push(tag + f.id + " placeholder changed: " + f.ph);
    }
    if (r.order.join() !== "company,reqq,titleq") bad.push(tag + "field order changed: " + r.order.join());
    if (r.labels.join("|") !== "Company|Req number|PostID, or part of the title") bad.push(tag + "labels changed: " + r.labels.join("|"));
    if (r.button !== "Search") bad.push(tag + "the Search button changed: " + r.button);
    if (r.out.find((f) => f.id === "reqq").type !== "password") bad.push(tag + "the req number is no longer hidden as typed");
    if (r.sw > r.cw + 0.5) bad.push(tag + "the page scrolls sideways (" + r.sw + " in " + r.cw + ")");
  }
  await tab.eval("document.querySelector('#reqToggle').click()");
  if ((await tab.eval("document.querySelector('#reqq').type")) !== "text") bad.push(width + ": Show does not reveal the req number");
  await tab.eval("document.querySelector('#reqToggle').click()");
  if ((await tab.eval("document.querySelector('#reqq').type")) !== "password") bad.push(width + ": Hide does not hide the req number again");
  return bad;
}

// ---- the details window: the page behind it must not scroll
async function lockProblems(tab, site, width, phone) {
  const bad = [], tag = (phone ? "phone " : "desktop ") + width + ": ";
  await tab.viewport(width, phone, phone ? 667 : 500); await sleep(250);
  // a desktop window with a CLASSIC scrollbar (a headless browser has overlay scrollbars that take no room): a 15 pixel one is forced, so the page really does get wider when the lock hides it
  if (!phone) await tab.eval("(() => { const s = document.createElement('style'); s.textContent = 'html::-webkit-scrollbar{width:15px}'; document.head.append(s); })()");
  await tab.eval("(() => { document.querySelector('#company').value = 'Meridian Health'; document.querySelector('#titleq').value = 'a'; document.querySelector('#searchForm').requestSubmit(); })()");
  if (!(await tab.waitFor("document.querySelectorAll('#results .card').length > 0", 8000))) return [tag + "no results to open"];
  await sleep(300);
  const scroll = (dy) => (phone ? tab.swipe(60, 520, dy) : tab.wheel(300, 300, -dy));   // dy < 0: the page goes down
  const scrollBackdrop = (dy) => (phone ? tab.swipe(5, 520, dy) : tab.wheel(5, 300, -dy));   // on the dark edge outside the window
  const geo = () => tab.eval("(() => { const f = document.querySelector('#searchForm').getBoundingClientRect(), h = document.querySelector('header.nav').getBoundingClientRect(); return [Math.round(f.left * 10) / 10, Math.round(f.width * 10) / 10, Math.round(h.width * 10) / 10]; })()");
  // control: with no window open the same gesture DOES scroll the page (so the test could see a scroll)
  await tab.eval("window.scrollTo(0, 0)"); await scroll(-300);
  const moved = await tab.eval("window.scrollY");
  if (!(moved > 50)) return [tag + "the test gesture does not scroll the page at all (" + moved + "): the check cannot see a lock"];
  await tab.eval("window.scrollTo(0, 260)"); await sleep(150);
  const y0 = await tab.eval("window.scrollY"), g0 = await geo();
  const before_ = await tab.eval("[document.documentElement.getAttribute('style'), document.body.getAttribute('style')]");
  await tab.eval("document.querySelector('.view-details').click()");
  if (!(await tab.waitFor("document.querySelector('#modalBackdrop.open') && document.querySelectorAll('#modalLinks .source-row').length > 0", 8000))) return [tag + "the details window did not open"];
  await sleep(250);
  const ov = await tab.eval("[getComputedStyle(document.documentElement).overflow, getComputedStyle(document.body).overflow]");
  if (ov[0] !== "hidden" || ov[1] !== "hidden") bad.push(tag + "html and body are not overflow hidden while the window is open (" + ov.join(",") + ")");
  await scroll(-300); await scrollBackdrop(-300); await scroll(-300);
  const y1 = await tab.eval("window.scrollY");
  if (Math.abs(y1 - y0) > 1) bad.push(tag + "the page behind the window scrolled from " + y0 + " to " + y1);
  const g1 = await geo();
  if (Math.abs(g1[0] - g0[0]) > 0.6 || Math.abs(g1[1] - g0[1]) > 0.6 || Math.abs(g1[2] - g0[2]) > 0.6) bad.push(tag + "the page shifted when the window opened (" + g0 + " to " + g1 + ")");
  const modalBox = await tab.eval("(() => { const r = document.querySelector('#modalBackdrop .modal').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width)]; })()");
  await scroll(-200);
  const modalBox2 = await tab.eval("(() => { const r = document.querySelector('#modalBackdrop .modal').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width)]; })()");
  if (JSON.stringify(modalBox) !== JSON.stringify(modalBox2)) bad.push(tag + "the window itself moved (" + modalBox + " to " + modalBox2 + ")");
  await tab.eval("document.querySelector('#modalClose').click()");
  await sleep(250);
  const after_ = await tab.eval("[document.documentElement.getAttribute('style'), document.body.getAttribute('style')]");
  if (JSON.stringify(after_) !== JSON.stringify(before_)) bad.push(tag + "closing the window left a changed style on html or body: " + JSON.stringify(before_) + " became " + JSON.stringify(after_));
  const y2 = await tab.eval("window.scrollY"), g2 = await geo();
  if (Math.abs(y2 - y0) > 1) bad.push(tag + "closing the window moved the page from " + y0 + " to " + y2);
  if (Math.abs(g2[0] - g0[0]) > 0.6 || Math.abs(g2[1] - g0[1]) > 0.6 || Math.abs(g2[2] - g0[2]) > 0.6) bad.push(tag + "the page is not where it was after closing (" + g0 + " vs " + g2 + ")");
  await scroll(-200);
  if (!((await tab.eval("window.scrollY")) > y0 + 20)) bad.push(tag + "after closing, the page does not scroll again");
  return bad;
}

const SCENARIOS = {
  async fields(site) { const tab = await browser.newTab(); try { await openSearch(tab, site, "out"); const bad = []; for (const [w, p] of [[320, true], [375, true], [1280, false]]) bad.push(...(await fieldProblems(tab, w, p))); return bad; } finally { await tab.close(); } },
  async lockPhone(site) { const tab = await browser.newTab(); try { await openSearch(tab, site, "cand"); return await lockProblems(tab, site, 375, true); } finally { await tab.close(); } },
  async lockDesktop(site) { const tab = await browser.newTab(); try { await openSearch(tab, site, "cand"); return await lockProblems(tab, site, 1280, false); } finally { await tab.close(); } },
};
async function withSite(root, fn) { const site = await startFakeSite(root); try { return await fn(site); } finally { await site.close(); } }

test("search page: the three fields have a visible line and a focus ring; the details window locks the page behind it and restores it exactly", { timeout: 300000 }, async () => {
  const problems = [];
  await withSite(ROOT, async (site) => { for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](site)) problems.push(n + ": " + p); });
  assert.deepEqual(problems, [], "search page problems:\n" + problems.join("\n"));
});

const CSS_NO_TOUCH = (s) => s.replace(".modal-backdrop{touch-action:none;overscroll-behavior:contain}", "").replace(".modal{touch-action:pan-y;overscroll-behavior:contain}", "");
const DEFECTS = [
  ["the fields lose their line (the old border:none)", ["fields"], [["app.css", (s) => s.replace(".srch-input{border-bottom:2px solid #8A8379!important;border-radius:0!important;padding-bottom:6px!important}", ".srch-input{border-bottom:0!important}")]]],
  ["the line is too light (1.5 to 1)", ["fields"], [["app.css", (s) => s.replace("border-bottom:2px solid #8A8379!important", "border-bottom:2px solid #D8D2C6!important")]]],
  ["the line is only 1 pixel of white", ["fields"], [["app.css", (s) => s.replace("border-bottom:2px solid #8A8379!important", "border-bottom:1px solid #FFFFFF!important")]]],
  ["the focus ring and the heavier line are gone", ["fields"], [["app.css", (s) => s.replace(".srch-input:focus{border-bottom-color:var(--ember-dark)!important;box-shadow:0 1px 0 0 var(--ember-dark)}", ".srch-input:focus{outline:none!important;border-bottom-color:#8A8379!important;box-shadow:none!important}")]]],
  ["the req number is a plain visible text box", ["fields"], [["search.html", (s) => s.replace('id="reqq" class="srch-input" type="password"', 'id="reqq" class="srch-input" type="text"')]]],
  ["no scroll lock at all (no script lock, no touch rules): the page behind still scrolls", ["lockPhone", "lockDesktop"], [["js/pages/search.js", (s) => s.replace("if (!unlockScroll) unlockScroll = lockScroll(document, window);", "")], ["app.css", CSS_NO_TOUCH]]],
  ["no script lock (the touch rules alone are not the lock the desktop needs)", ["lockDesktop"], [["js/pages/search.js", (s) => s.replace("if (!unlockScroll) unlockScroll = lockScroll(document, window);", "")]]],
  ["the lock is never undone", ["lockPhone", "lockDesktop"], [["js/pages/search.js", (s) => s.replace("if (unlockScroll) { unlockScroll(); unlockScroll = null; }", "")]]],
  ["the unlock puts the wrong values back (auto instead of what was there)", ["lockPhone", "lockDesktop"], [["js/scroll-lock.js", (s) => s.replace("html.style.overflow = prev.html; body.style.overflow = prev.body;", 'html.style.overflow = "auto"; body.style.overflow = "auto";')]]],
  ["no scrollbar compensation (the page shifts sideways when the scrollbar goes away)", ["lockDesktop"], [["js/scroll-lock.js", (s) => s.replace("const bar = Math.max(0, win.innerWidth - html.clientWidth);", "const bar = 0;")]]],
];
test("negative controls: each defect in the search fields or the scroll lock makes a check fail", { timeout: 900000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-sui-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      await withSite(dir, async (site) => { for (const n of scenarios) found.push(...(await SCENARIOS[n](site)).map((x) => n + ": " + x)); });
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0] + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
