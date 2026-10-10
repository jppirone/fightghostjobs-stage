// registered.test.js - the "Registered" check mark in a real browser (October 9, 2026). The repo's own files and a fake backend (tests/fake-site.js; no real project, no key, no network).
//
// THE RULE the page follows: the DATABASE says, per result row, is_registered true or false (an active paid plan). The page draws the check mark ONLY for a real boolean true: false, a missing value, the string "true", a number, null are all "no mark".
// The staff view uses the same rule. The page never sees a plan name, a source or an expiry (the fake carries none, and a static rule keeps those words out of the scripts).
// Then negative controls: one defect at a time in the page code (the mark always drawn, any truthy value drawn, the staff card ignoring the rule, the helper using Boolean()); each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/registered.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite, STAFF_ROWS } from "./fake-site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

const STAFF = "staff@example.test", PLAIN = "cand@example.test";
async function openSearch(tab, site, email, query) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate&email=" + encodeURIComponent(email));
  await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.goto(site.url + "/search.html" + (query || ""));
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(900);
}
async function runSearch(tab) {
  await tab.eval("(() => { document.querySelector('#company').value = 'Meridian'; document.querySelector('#titleq').value = 'Analyst'; document.querySelector('#searchForm').requestSubmit(); })()");
  await tab.waitFor("document.querySelectorAll('#results .card').length > 0 && !document.querySelector('#searchBtn').disabled", 12000); await sleep(400);
}
// for each card: its title and whether it carries the check mark (text), plus the count of marks on the whole page
const MARKS = `(() => ({ cards: [...document.querySelectorAll('#results .card')].map((c) => ({ title: (c.querySelector('.res-head > div > div:nth-child(2)') || {}).textContent, mark: /\\u2713 Registered/.test(c.querySelector('.res-head').innerText) })),
  total: (document.querySelector('#results').innerText.match(/\\u2713 Registered/g) || []).length, text: document.querySelector('#results').innerText }))()`;
async function withSite(root, opts, fn) { const site = await startFakeSite(root, opts); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }

// the public view with a given list of is_registered values, one per result in order; expected: which of the two cards carry the mark
async function publicCase(root, values, expected, label) {
  return withSite(root, { registeredValues: values }, (site) => withTab(async (tab) => { const bad = [];
    await openSearch(tab, site, PLAIN, ""); await runSearch(tab); const o = await tab.eval(MARKS);
    if (o.cards.length !== 2) { bad.push(label + ": expected 2 results, got " + o.cards.length); return bad; }
    expected.forEach((want, i) => { if (o.cards[i].mark !== want) bad.push(label + ": result " + (i + 1) + (want ? " should" : " must not") + " carry the check mark"); });
    if (/\bplan\b|paid|pilot|promotional|expir.*plan/i.test(o.text.replace(/Expires|Closes/g, ""))) bad.push(label + ": the page says something about a plan");
    return bad; })); }

const SCENARIOS = {
  async publicTrueFalse(root) { return publicCase(root, undefined, [true, false], "the fake's own values (true, false)"); },
  async publicEveryOtherValue(root) { const bad = [];
    for (const [vals, label] of [[[false, false], "both false"], [["true", "true"], 'the string "true"'], [[1, 1], "the number 1"], [[null, null], "null"], [["omit", "omit"], "the key missing"], [[{}, []], "an object and an array"], [["yes", "Registered"], "other words"]])
      bad.push(...(await publicCase(root, vals, [false, false], label)));
    bad.push(...(await publicCase(root, [true, true], [true, true], "both true")));
    return bad; },
  // the staff view: the same rule on its cards; the live row is registered, every other row is not; a staff answer without the key (before the database change) still shows every row with no mark
  async staffView(root) { const bad = [];
    await withSite(root, {}, (site) => withTab(async (tab) => {
      await openSearch(tab, site, STAFF, "?scope=all"); await tab.waitFor("!!document.querySelector('#staffBanner')", 8000); await runSearch(tab); const o = await tab.eval(MARKS);
      if (o.cards.length !== STAFF_ROWS.length) bad.push("staff: expected " + STAFF_ROWS.length + " cards, got " + o.cards.length);
      const want = STAFF_ROWS.map((r) => r.is_registered === true);
      o.cards.forEach((c, i) => { if (c.mark !== want[i]) bad.push("staff: card " + (i + 1) + (want[i] ? " should" : " must not") + " carry the check mark"); });
      if (o.total !== 1) bad.push("staff: expected exactly 1 mark on the page, found " + o.total);
    }));
    await withSite(root, { staffOmitRegistered: true }, (site) => withTab(async (tab) => {
      await openSearch(tab, site, STAFF, "?scope=all"); await tab.waitFor("!!document.querySelector('#staffBanner')", 8000); await runSearch(tab); const o = await tab.eval(MARKS);
      if (o.cards.length !== STAFF_ROWS.length || o.total !== 0) bad.push("staff without the key: expected " + STAFF_ROWS.length + " cards and no mark, got " + o.cards.length + " cards and " + o.total + " marks");
    }));
    return bad; },
};

test("the Registered check mark: drawn only for a real true from the database, in the public view and the staff view", { timeout: 900000 }, async () => {
  const problems = [];
  for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](ROOT)) problems.push(n + ": " + p);
  assert.deepEqual(problems, [], "check mark problems:\n" + problems.join("\n"));
});

const DEFECTS = [
  ["the mark is drawn on every result again", ["publicTrueFalse"], [["js/pages/search.js", (s) => s.replace('isRegistered(row) ? h("div", { class: "pill badge-verified", style: "flex-shrink:0;" }, "✓ Registered") : null', 'h("div", { class: "pill badge-verified", style: "flex-shrink:0;" }, "✓ Registered")')]]],
  ["any truthy value draws the mark (the string true)", ["publicEveryOtherValue"], [["js/registered.js", (s) => s.replace("row.is_registered === true", "!!row.is_registered")]]],
  ["a missing value draws the mark", ["publicEveryOtherValue"], [["js/registered.js", (s) => s.replace("row.is_registered === true", "row.is_registered !== false")]]],
  ["the staff card ignores the rule and draws the mark on every row", ["staffView"], [["js/pages/search.js", (s) => s.replace('isRegistered(row) ? h("div", { class: "pill badge-verified" }, "✓ Registered") : null', 'h("div", { class: "pill badge-verified" }, "✓ Registered")')]]],
  ["the staff card never draws the mark", ["staffView"], [["js/pages/search.js", (s) => s.replace('isRegistered(row) ? h("div", { class: "pill badge-verified" }, "✓ Registered") : null', "null")]]],
  ["the staff answer is refused when the key is missing", ["staffView"], [["js/api.js", (s) => s.replace("&& STAFF_ROW_KEYS.every((k) => Object.hasOwn(r, k))", "&& STAFF_ROW_KEYS.every((k) => Object.hasOwn(r, k)) && Object.hasOwn(r, \"is_registered\")")]]],
];
test("negative controls: each defect in the check mark rule makes a scenario fail", { timeout: 1800000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-reg-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      for (const n of scenarios) found.push(...(await SCENARIOS[n](dir)).map((x) => n + ": " + x));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0] + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
