// target-size.test.js - every link and control is at least 24 by 24 CSS pixels, in a real browser, on the repo's own files with a fake backend (tests/fake-site.js; no real project, no key). October 5, 2026
// (John's keyboard-only pass on stage, October 4, 2026: the "3 Comments" link on the home page's example card and the "See what's included" link were too small to hit). The WCAG 2.2 level AA size rule for pointer targets.
// For every page, in every state a person meets it in (signed out, candidate, employer; the verify card, search results, the open details window, a comments thread, the edit page with its unsaved bar showing), at 1280 and at
// 375 pixels: every link, button, form field, switch, check box and radio button that is shown must be at least 24 x 24 (a button's invisible touch margin, drawn with ::before, counts, the way a finger does). On a phone the
// rule the phone layout test already enforces (44 pixels for buttons, navigation, footer and form fields) still holds; this test adds the 24 pixel floor for everything else.
// The one exemption is the same one the standard makes: a link that is a word inside a sentence (an inline link whose paragraph has other text next to it) is sized by its line of text. They are listed in the failure
// message when they would otherwise have been found, so the list stays visible. Then negative controls: one rule undone at a time; each must be caught. A missing browser FAILS the test (set FGJ_BROWSER).
// Run: node --test tests/target-size.test.js
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
const REF = "d21m48ybzqbfxxxxxxxx", EDIT = "edit.html?id=3f1d5b1e-0000-4000-8000-000000000001";
const MIN = 24;
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

const STATES = [
  { id: "home", who: "out", page: "index.html" },
  { id: "search, signed out, verify card", who: "out", page: "search.html", act: "verify" },
  { id: "employer sign-in", who: "out", page: "employer-signin.html" },
  { id: "privacy", who: "out", page: "privacy.html" },
  { id: "not found", who: "out", page: "404.html" },
  { id: "comments, signed out, verify card", who: "out", page: "comments.html?ref=" + REF },
  { id: "My postings", who: "poster", page: "dashboard.html", table: true },
  { id: "Analytics", who: "poster", page: "analytics.html", table: true },
  { id: "Team", who: "poster", page: "team.html", table: true },
  { id: "Register a posting", who: "poster", page: "register.html" },
  { id: "Edit a posting", who: "poster", page: EDIT },
  { id: "Edit a posting, unsaved bar showing", who: "poster", page: EDIT, act: "dirty" },
  { id: "search, employer notice", who: "poster", page: "search.html" },
  { id: "search, results", who: "cand", page: "search.html", act: "results" },
  { id: "search, details window", who: "cand", page: "search.html", act: "details" },
  { id: "comments, thread", who: "cand", page: "comments.html?ref=" + REF },
];

// every shown interactive element that is smaller than 24 x 24, except a word inside a sentence (those are returned apart)
const SCAN = `(async () => {
  await document.fonts.ready; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const sel = (e) => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\\s+/).slice(0, 2).join(".") : "");
  const shown = (e) => { const c = getComputedStyle(e); if (c.display === "none" || c.visibility === "hidden") return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const out = { small: [], inline: [], checked: 0 };
  const WORDS = /[A-Za-z0-9]/;
  // is this link a word inside a sentence: an inline link whose parent has text of its own next to it
  const inSentence = (e) => {
    if (e.tagName !== "A" || getComputedStyle(e).display !== "inline") return false;
    const p = e.parentElement; if (!p) return false;
    return Array.from(p.childNodes).some((n) => n.nodeType === 3 && WORDS.test(n.textContent));
  };
  for (const el of document.querySelectorAll("a[href], button, [role=button], select, textarea, summary, input:not([type=hidden])")) {
    if (!shown(el) || el.closest(".info-tooltip, [aria-hidden=true]")) continue;
    if (el.closest(".skip-link") && el.getBoundingClientRect().left < -100) continue;   // the skip link waits off screen until it gets focus (then it is 44 pixels tall)
    // a check box or radio button is small inside a larger label: the label (text included) is what a person points at, so the label is measured
    const t = el.tagName === "INPUT" && (el.type === "checkbox" || el.type === "radio") && el.closest("label") && shown(el.closest("label")) ? el.closest("label") : el;
    const r = t.getBoundingClientRect(); let w = r.width, h = r.height;
    const ps = getComputedStyle(t, "::before"); if (ps.content !== "none" && ps.position === "absolute") { w = Math.max(w, px(ps.width)); h = Math.max(h, px(ps.height)); }
    out.checked++;
    if (w < ${MIN} - 0.5 || h < ${MIN} - 0.5) {
      const line = sel(el) + " " + Math.round(w) + "x" + Math.round(h) + " '" + (el.textContent || el.getAttribute("aria-label") || el.value || "").trim().slice(0, 28) + "'";
      (inSentence(el) ? out.inline : out.small).push(line);
    }
  }
  return out;
})()`;

let signedAs = null;
async function become(tab, site, who) {
  if (signedAs === who) return; signedAs = who;
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  if (who === "out") return;
  await tab.goto(site.url + "/_dev/link?kind=" + (who === "poster" ? "poster" : "candidate"));
  await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
async function openState(tab, site, st, width) {
  await become(tab, site, st.who);
  await tab.viewport(width, width <= 640);
  await tab.goto(site.url + "/" + st.page);
  await tab.waitFor("document.readyState === 'complete'");
  if (st.who === "poster") await tab.waitFor("!!document.querySelector('.avatar-btn')", 8000);
  if (st.table) await tab.waitFor("document.querySelectorAll('.rtable tbody tr').length > 0", 8000);
  if (st.page.startsWith("edit")) await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden", 8000);
  if (st.page.startsWith("comments") && st.who === "cand") await tab.waitFor("!document.querySelector('#threadWrap').hidden && document.querySelectorAll('#thread > *').length > 0", 8000);
  if (st.page.startsWith("comments") && st.who === "out") await tab.waitFor("!document.querySelector('#signinWrap').hidden", 8000);
  if (st.act === "verify") { await tab.eval("(() => { document.querySelector('#company').value = 'Meridian Health'; document.querySelector('#titleq').value = 'Analyst'; document.querySelector('#searchForm').requestSubmit(); })()"); await tab.waitFor("!document.querySelector('#signinWrap').hidden", 8000); }
  if (st.act === "results" || st.act === "details") {
    await tab.eval("(() => { document.querySelector('#company').value = 'Meridian Health'; document.querySelector('#titleq').value = 'a'; document.querySelector('#searchForm').requestSubmit(); })()");
    await tab.waitFor("document.querySelectorAll('#results .card').length > 0", 8000);
  }
  if (st.act === "details") { await tab.eval("document.querySelector('.view-details').click()"); await tab.waitFor("document.querySelector('#modalBackdrop.open') && document.querySelectorAll('#modalLinks .source-row').length > 0", 8000); }
  if (st.act === "dirty") { await tab.eval("(() => { const t = document.querySelector('#jtitle'); t.value = t.value + ' x'; t.dispatchEvent(new Event('input', { bubbles: true })); })()"); await tab.waitFor("!document.querySelector('#unsavedBar').hidden", 4000); }
  await sleep(350);
}

async function withSite(root, fn) { const site = await startFakeSite(root); try { return await fn(site); } finally { await site.close(); } }

const SCENARIOS = {
  async scan(site) {
    const bad = [], inline = new Set(); let checked = 0;
    const tab = await browser.newTab(); signedAs = null;
    try {
      for (const st of STATES) for (const w of [1280, 375]) {
        await openState(tab, site, st, w);
        const m = await tab.eval(SCAN); checked += m.checked;
        for (const o of m.small) bad.push(st.id + " at " + w + ": " + o);
        for (const o of m.inline) inline.add(o.replace(/ \d+x\d+ /, " "));
      }
      if (checked < 400) bad.push("only " + checked + " controls were measured: the scan is not looking at enough of the page");
    } finally { await tab.close(); }
    SCENARIOS.__inline = Array.from(inline);
    return bad;
  },
};

test("every link and control is at least 24 by 24 CSS pixels (a word inside a sentence excepted), at 1280 and 375, in every state", { timeout: 900000 }, async () => {
  const problems = [];
  await withSite(ROOT, async (site) => { for (const p of await SCENARIOS.scan(site)) problems.push(p); });
  if (SCENARIOS.__inline && SCENARIOS.__inline.length) console.log("links that are words inside a sentence (exempt, listed for the record):\n  " + SCENARIOS.__inline.join("\n  "));
  assert.deepEqual(problems, [], "targets under 24 x 24:\n" + problems.join("\n"));
});

// ---- negative controls: one rule undone at a time ---------------------------------------------------------------------------------------------------------------------------------------------
const DEFECTS = [
  ["the top bar links lose their hit area", [["app.css", (s) => s.replace(".nav-links a::before,", "")]]],
  ["the footer links lose their hit area", [["app.css", (s) => s.replace(".site-footer a::before,", "")]]],
  ["the home page footer links lose their hit area", [["app.css", (s) => s.replace("footer.wrapflex a::before,", "")]]],
  ["the 3 Comments and See what is included links lose their hit area", [["app.css", (s) => s.replace(".hit::before,", "")]]],
  ["the details window links lose their hit area", [["app.css", (s) => s.replace("#modalMore a::before,", "")]]],
  ["Edit, Pause, Close and the other row actions lose their hit area", [["app.css", (s) => s.replace(".row-action::before,", "")]]],
  ["the check box and radio rows lose their hit area", [["app.css", (s) => s.replace(",.check-row::before{", "{")]]],
  ["the remove cross on a location chip loses its hit area", [["app.css", (s) => s.replace(".loc-remove::before{content:\"\";position:absolute;inset:-1px}", "")]]],
  ["the little i icons lose their hit area", [["app.css", (s) => s.replace(".info-icon::before{content:\"\";position:absolute;inset:-5px}", "")]]],
  ["the drop-down list loses its minimum height", [["app.css", (s) => s.replace("select{min-height:24px}", "")]]],
  ["the 3 Comments link loses its class", [["index.html", (s) => s.replace('<a class="hit" href="search.html"', '<a href="search.html"')]]],
  ["the See what is included link loses its class", [["register.html", (s) => s.replace('<a class="hit" href="https://www.fightghostjobs.com/plans.html"', '<a href="https://www.fightghostjobs.com/plans.html"')]]],
];
test("negative controls: each undone target rule makes the scan fail", { timeout: 900000 }, async () => {
  const missed = [];
  for (const [label, edits] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-ts-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = await withSite(dir, (site) => SCENARIOS.scan(site));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 160) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
