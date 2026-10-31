// refine-hint.test.js - the gentle refine hints of the title search (October 20, 2026), in a real browser on the repo's own files with a fake backend (tests/fake-site.js; no real project, no key).
// Above the results of a TITLE search: more than 3 openings -> "We found N openings. To narrow it, add a more specific word from the title, such as a team or function."; a title that is only one generic word (after the
// filler words are left out) -> "That word is common in many titles. Adding another word from the title will narrow the results."; both at once, the count first; neither for exactly 3 or fewer openings, for a req number
// search, or for a search that found nothing. The lines are only words: every result still shows below them, they are not an alert, they are spoken once inside the search's one status message, they never make the page scroll
// sideways, and a new search clears them. Then negative controls: one defect at a time; each must make a check fail. A missing browser FAILS the test (set FGJ_BROWSER).
// Run: node --test tests/refine-hint.test.js
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

const COUNT = (n, more) => "We found " + (more ? "more than " : "") + n + " openings. To narrow it, add a more specific word from the title, such as a team or function.";
const GENERIC = "That word is common in many titles. Adding another word from the title will narrow the results.";
const REQ = "R-2026-0451";

async function openSearch(tab, site) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.goto(site.url + "/search.html");
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(600);
}
const fill = (tab, company, title, req) => tab.eval(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }; set("company", ${JSON.stringify(company)}); set("titleq", ${JSON.stringify(title)}); set("reqq", ${JSON.stringify(req)}); })()`);
const search = async (tab) => { await tab.eval(`document.getElementById("searchBtn").focus()`); await tab.key("Enter"); };
const WATCH = `(() => { window.__said = []; const live = (n) => { const e = n.nodeType === 1 ? n : n.parentElement; return e && e.closest ? e.closest('[role=status],[role=alert],[aria-live]') : null; };
  new MutationObserver((ms) => { for (const m of ms) { const r = live(m.target); if (r && r.textContent.trim() !== "") window.__said.push({ id: r.id, text: r.textContent.trim() }); } }).observe(document, { childList: true, subtree: true, characterData: true }); })()`;
const READ = `(() => { const h = document.getElementById("refineHint"), res = document.getElementById("results"), cards = res.querySelectorAll(".card"), first = cards[0];
  return { hint: h ? Array.from(h.querySelectorAll("p")).map((p) => p.textContent) : null, role: h ? h.getAttribute("role") : null, inLive: h ? !!h.closest("[aria-live],[role=status],[role=alert]") : null,
    hintBottom: h ? h.getBoundingClientRect().bottom : null, firstTop: first ? first.getBoundingClientRect().top : null, cards: cards.length, count: document.getElementById("resultCount").textContent,
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, hints: document.querySelectorAll("#refineHint").length }; })()`;

// one search in a fresh page: what is typed, what the fake backend answers (opts), what must show
async function oneSearch(root, opts, typed, want, tag, width = 1280) {
  const bad = [], site = await startFakeSite(root, opts), tab = await browser.newTab();
  try {
    await tab.focusEmulation(true); await tab.viewport(width, width < 700, width < 700 ? 700 : 900);
    await openSearch(tab, site); await tab.viewport(width, width < 700, width < 700 ? 700 : 900); await tab.eval(WATCH);
    await fill(tab, typed.company || "Meridian", typed.title || "", typed.req || ""); await tab.eval("window.__said = []"); await search(tab);
    if (!(await tab.waitFor(`!document.getElementById("recap").hidden`, 6000))) { bad.push(tag + ": no recap appeared (the search did not run)"); return bad; }
    await sleep(500);
    const r = await tab.eval(READ);
    if (JSON.stringify(r.hint) !== JSON.stringify(want.hint)) bad.push(tag + ": the hint lines are " + JSON.stringify(r.hint) + " (wanted " + JSON.stringify(want.hint) + ")");
    if (r.hints > 1) bad.push(tag + ": the hint block is in the page " + r.hints + " times");
    if (r.cards !== want.cards) bad.push(tag + ": " + r.cards + " result cards show (wanted " + want.cards + "): the hint must never hide the results");
    if (r.hint && r.role !== null) bad.push(tag + ": the hint has a role (" + r.role + "); it is a plain note, not an alert");
    if (r.hint && r.inLive) bad.push(tag + ": the hint sits inside a live region (it is spoken only through the search status)");
    if (r.hint && r.firstTop !== null && !(r.hintBottom <= r.firstTop + 1)) bad.push(tag + ": the hint is not above the first result");
    if (r.sw > r.cw + 0.5) bad.push(tag + ": the page scrolls sideways at " + width);
    const said = JSON.parse(await tab.eval("JSON.stringify(window.__said)")), mine = said.filter((x) => x.id === "searchStatus");
    const spoken = (mine[0] && mine[0].text) || "";
    if (mine.length !== 1) bad.push(tag + ": the search status spoke " + mine.length + " times");
    for (const line of want.hint || []) if (!spoken.includes(line)) bad.push(tag + ": the spoken message does not carry the hint '" + line.slice(0, 40) + "': " + JSON.stringify(spoken).slice(0, 200));
    if (!want.hint && /We found|common in many titles/.test(spoken)) bad.push(tag + ": the spoken message carries a hint that is not shown");
    if (said.some((x) => x.id !== "searchStatus")) bad.push(tag + ": another live region spoke too: " + JSON.stringify(said.filter((x) => x.id !== "searchStatus")));
    if ((await tab.eval(`document.activeElement && document.activeElement.id`)) !== "searchBtn") bad.push(tag + ": focus left the Search button");
  } finally { await tab.close(); await site.close(); }
  return bad;
}

const SCENARIOS = {
  async many(root) { return oneSearch(root, { resultCount: 5 }, { title: "support analyst" }, { hint: [COUNT(5)], cards: 5 }, "5 openings"); },
  async four(root) { return oneSearch(root, { resultCount: 4 }, { title: "support analyst" }, { hint: [COUNT(4)], cards: 4 }, "4 openings"); },
  async three(root) { return oneSearch(root, { resultCount: 3 }, { title: "support analyst" }, { hint: null, cards: 3 }, "exactly 3 openings"); },
  async generic(root) { return oneSearch(root, { resultCount: 2 }, { title: "Manager" }, { hint: [GENERIC], cards: 2 }, "one generic word"); },
  async genericFiller(root) { return oneSearch(root, { resultCount: 1 }, { title: "the manager of" }, { hint: [GENERIC], cards: 1 }, "one generic word with filler"); },
  async notGeneric(root) { return oneSearch(root, { resultCount: 2 }, { title: "Nurse" }, { hint: null, cards: 2 }, "a word that is not generic"); },
  async both(root) { return oneSearch(root, { resultCount: 6 }, { title: "analyst" }, { hint: [COUNT(6), GENERIC], cards: 6 }, "many openings and one generic word"); },
  async truncated(root) { return oneSearch(root, { resultCount: 25, truncated: true }, { title: "support analyst" }, { hint: [COUNT(25, true)], cards: 25 }, "the database limit"); },
  async req(root) { return oneSearch(root, { resultCount: 5 }, { req: REQ }, { hint: null, cards: 5 }, "a req number search with 5 openings"); },
  async none(root) { return oneSearch(root, {}, { company: "Zzyzx Unknown", title: "manager" }, { hint: null, cards: 0 }, "nothing found"); },
  async phone(root) { return oneSearch(root, { resultCount: 6 }, { title: "analyst" }, { hint: [COUNT(6), GENERIC], cards: 6 }, "375 wide", 375); },
  // a new search clears the old hint (the results and the hint go together)
  async cleared(root) {
    const bad = [], site = await startFakeSite(root, { resultCount: 5 }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await tab.viewport(1280, false, 900);
      await openSearch(tab, site);
      await fill(tab, "Meridian", "support analyst", ""); await search(tab); await tab.waitFor(`!document.getElementById("recap").hidden`, 6000); await sleep(400);
      if (!(await tab.eval(READ)).hint) bad.push("the first search showed no hint");
      await fill(tab, "Zzyzx Unknown", "nurse", ""); await search(tab); await sleep(900);
      const r = await tab.eval(READ);
      if (r.hint !== null) bad.push("the hint of the earlier search is still on the page after a new search: " + JSON.stringify(r.hint));
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
};

test("refine hints: the count line above 3 openings, the generic word line, both, neither; results always shown; plain note, spoken once; cleared by a new search", { timeout: 600000 }, async () => {
  const problems = [];
  for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](ROOT)) problems.push(n + ": " + p);
  assert.deepEqual(problems, [], "refine hint problems:\n" + problems.join("\n"));
});

const DEFECTS = [
  ["the count line is never shown", ["many", "four", "both", "truncated"], [["js/pages/search.js", (s) => s.replace("if (hints.length) resultsEl.append(", "if (false) resultsEl.append(")]]],
  ["the limit is one too low (3 openings show the line)", ["three"], [["js/config.js", (s) => s.replace("REFINE_HINT_MAX_RESULTS = 3;", "REFINE_HINT_MAX_RESULTS = 2;")]]],
  ["the limit is one too high (4 openings show nothing)", ["four"], [["js/config.js", (s) => s.replace("REFINE_HINT_MAX_RESULTS = 3;", "REFINE_HINT_MAX_RESULTS = 4;")]]],
  ["the generic words are not known", ["generic", "both", "genericFiller"], [["js/config.js", (s) => s.replace(/export const GENERIC_TITLE_WORDS = \[[^\]]*\];/, "export const GENERIC_TITLE_WORDS = [];")]]],
  ["every single word counts as generic", ["notGeneric"], [["js/refine-hint.js", (s) => s.replace("return w.length === 1 && GENERIC_TITLE_WORDS.includes(w[0]);", "return w.length === 1;")]]],
  ["the filler words are not left out", ["genericFiller"], [["js/config.js", (s) => s.replace(/export const TITLE_FILLER_WORDS = \[[^\]]*\];/, "export const TITLE_FILLER_WORDS = [];")]]],
  ["a req number search shows the hint too", ["req"], [["js/refine-hint.js", (s) => s.replace('if (mode !== "phrase" || !Number.isInteger(count) || count < 1) return [];', "if (!Number.isInteger(count) || count < 1) return [];")]]],
  ["a search that found nothing shows a hint", ["none"], [["js/refine-hint.js", (s) => s.replace("count < 1) return [];", "count < 0) return [];")], ["js/pages/search.js", (s) => s.replace("  if (n === 0) {\n    countEl.textContent = \"No matching openings\";", "  if (n === 0) {\n    resultsEl.append(h(\"div\", { class: \"refine-hint\", id: \"refineHint\" }, h(\"p\", {}, \"That word is common in many titles. Adding another word from the title will narrow the results.\")));\n    countEl.textContent = \"No matching openings\";")]]],
  ["the hint sits under the results", ["many"], [["js/pages/search.js", (s) => s.replace('  if (hints.length) resultsEl.append(h("div", { class: "refine-hint", id: "refineHint" }, ...hints.map((t) => h("p", {}, t))));\n  for (const row of data.results) resultsEl.append(renderCard(row));', '  for (const row of data.results) resultsEl.append(renderCard(row));\n  if (hints.length) resultsEl.append(h("div", { class: "refine-hint", id: "refineHint" }, ...hints.map((t) => h("p", {}, t))));')]]],
  ["the hint is an alert", ["many"], [["js/pages/search.js", (s) => s.replace('h("div", { class: "refine-hint", id: "refineHint" }, ...hints', 'h("div", { class: "refine-hint", id: "refineHint", role: "alert" }, ...hints')]]],
  ["the results are not shown when there is a hint", ["many", "both"], [["js/pages/search.js", (s) => s.replace("  for (const row of data.results) resultsEl.append(renderCard(row));\n  return hints;", "  if (!hints.length) for (const row of data.results) resultsEl.append(renderCard(row));\n  return hints;")]]],
  ["the hint is not spoken", ["many", "generic"], [["js/pages/search.js", (s) => s.replace("[mismatchText, ...(hints || []), missSpoken].filter(Boolean).join(\" \")", "mismatchText")]]],   // (prompt HD: the anchor names the spoken miss message too)
  ["the count line is reworded", ["many"], [["js/refine-hint.js", (s) => s.replace(/To narrow it, add a more specific word/g, "To narrow it add a specific word")]]],
  ["the hint is added twice", ["many"], [["js/pages/search.js", (s) => s.replace('  if (hints.length) resultsEl.append(h("div", { class: "refine-hint", id: "refineHint" }, ...hints.map((t) => h("p", {}, t))));', '  if (hints.length) { resultsEl.append(h("div", { class: "refine-hint", id: "refineHint" }, ...hints.map((t) => h("p", {}, t)))); resultsEl.append(h("div", { class: "refine-hint", id: "refineHint" }, ...hints.map((t) => h("p", {}, t)))); }')]]],
];
test("negative controls: each defect in the refine hints makes a check fail", { timeout: 3000000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-refine-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8").replace(/\?v=[0-9a-f]{8}(?=["'])/g, ""), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      for (const n of scenarios) found.push(...(await SCENARIOS[n](dir)).map((x) => n + ": " + x));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 160) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
