// bs.test.js - prompt BS (October 12, 2026), in a real browser on the repo's own files with a fake backend (tests/fake-site.js with opts.kio; no real project, no key). The candidate search page after the KIO ID:
//   1. the recap shows the ID in its shown form however it was typed (alone, with a company, typed without dashes and in lower case); a req number is still never shown;
//   2. the mismatch notice names what was entered: the company case (John's words), the title case, both; a company with markup characters is on the screen as text and nothing was created from it;
//   3. nothing of the earlier search stays when a new attempt begins or the page itself refuses an ID: results, notice, count line, recap, spoken message; after a result, Edit this search keeps the old results
//      until something is changed and Search is pressed; the same after a title search, an unregistered ID, an empty box and a refused company;
//   4. the short link path (the receiving page) still fills the box and searches nothing.
// Then negative controls: one deliberate defect at a time in the page code; each must make a scenario fail. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/bs.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startFakeSite, kioOf } from "./fake-site.js";
import { johnsBrowser, johnsWindow } from "./johns-screen.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = JSON.stringify;
let browser;
before(async () => { browser = await johnsBrowser(); });
after(async () => { if (browser) await browser.close(); });

const FIRST = kioOf("D21M48YBZQBF");            // the first search result of the fake backend (a Meridian opening, "Senior Data Analyst, ...")
const UNKNOWN = kioOf("ABCDEFGHJKMN");           // well formed, nobody has it
const TAIL = " It belongs to the opening shown below. Check that you copied the ID correctly from the job ad.";
const NOT_VALID = "That ID is not valid. Check it and try again.", NOT_REG = "No opening is registered under that ID.";
const REQ = "R-2026-0451";

async function signIn(tab, site) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
const openSearch = async (tab, site, hash = "") => {
  await tab.goto(site.url + "/404.html?x=1");
  await tab.goto(site.url + "/search.html" + hash); await tab.waitFor("document.readyState === 'complete' && !!document.getElementById('company')", 15000); await sleep(600);
};
const fill = (tab, company, title, req = "") => tab.eval("(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; set('company', " + q(company) + "); set('titleq', " + q(title) + "); set('reqq', " + q(req) + "); })()");
const pressSearch = async (tab) => { await tab.eval("document.getElementById('searchBtn').focus()"); await tab.key("Enter"); };
const searches = (site) => site.calls.filter((c) => c.name === "candidate-search");
const t = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); return e && !e.hidden && !e.closest('[hidden]') ? e.innerText.replace(/\\s+/g, ' ').trim() : ''; })()");
const asCand = async (root, fn) => { const site = await startFakeSite(root, { kio: true }), tab = await browser.newTab(); try { await signIn(tab, site); await johnsWindow(tab, 1093, 900); return await fn(site, tab); } finally { await tab.close(); await site.close(); } };
// what is on the page from an earlier search
const leftovers = (tab) => tab.eval(`(() => { const vis = (e) => !!e && !e.hidden && e.getClientRects().length > 0;
  return { cards: document.querySelectorAll('#results .card').length, notice: vis(document.getElementById('mismatchNotice')), count: vis(document.getElementById('resultCount')), recap: vis(document.getElementById('recap')),
    results: document.getElementById('results').innerText.trim(), empty: !!document.getElementById('emptyNote'), formError: (document.getElementById('formError').hidden ? '' : document.getElementById('formError').textContent) }; })()`);
const settle = (ms = 700) => sleep(ms);

const SCENARIOS = {
  // ---- 1. the recap
  async recap(root) { return asCand(root, async (site, tab) => { const bad = [];
    await openSearch(tab, site);
    const cases = [
      ["an ID alone", "", FIRST.shown, "", "You searched for: KIO ID: " + FIRST.shown + ". Your results are below."],
      ["an ID typed in lower case without dashes", "", FIRST.stored.toLowerCase(), "", "You searched for: KIO ID: " + FIRST.shown + ". Your results are below."],
      ["an ID with a company", "Meridian Health", FIRST.shown, "", "You searched for: company Meridian Health, KIO ID: " + FIRST.shown + ". Your results are below."],
      ["a req number (never shown)", "Meridian", "", REQ, "You searched for: company Meridian, a req number was entered. Your results are below."],
      ["part of a title", "Meridian", "Nurse", "", "You searched for: company Meridian, title Nurse. Your results are below."],
    ];
    for (const [what, company, title, req, want] of cases) {
      await fill(tab, company, title, req); await pressSearch(tab);
      await tab.waitFor("!document.getElementById('recap').hidden", 8000); await settle(400);
      const got = await t(tab, "#recapText");
      if (got !== want) bad.push(what + ": the recap says '" + got + "'");
      if (what.startsWith("a req") && (await tab.eval("document.documentElement.innerHTML.includes(" + q(REQ) + ")"))) bad.push(what + ": the req number is on the page");
      await tab.eval("document.getElementById('recapEdit').click()");
    }
    return bad; }); },
  // ---- 2. the notice
  async notice(root) { return asCand(root, async (site, tab) => { const bad = [];
    await openSearch(tab, site);
    await fill(tab, "Zzyzx Staffing", FIRST.shown); await pressSearch(tab); await settle();
    let n = await t(tab, "#mismatchNotice");
    if (n !== "This ID is not registered to the company you entered (Zzyzx Staffing)." + TAIL) bad.push("the company notice says '" + n + "'");
    if (!(await t(tab, "#results")).includes("KIO ID: " + FIRST.shown)) bad.push("the opening is not shown beside the notice");
    // a company with markup characters is text
    await tab.eval("document.getElementById('recapEdit').click()");
    const odd = '<b>Acme</b> & "Co" <img src=x onerror=window.__xss=1>';
    await fill(tab, odd, FIRST.shown); await pressSearch(tab); await settle();
    n = await t(tab, "#mismatchNotice");
    if (n !== "This ID is not registered to the company you entered (" + odd + ")." + TAIL) bad.push("the notice with markup characters says '" + n + "'");
    const made = await tab.eval("({ b: document.querySelectorAll('#mismatchNotice b, #mismatchNotice img').length, xss: window.__xss === undefined ? null : window.__xss })");
    if (made.b !== 0 || made.xss !== null) bad.push("markup was made from the company: " + JSON.stringify(made));
    // the title case, from the extension's fragment (no company), and both
    await openSearch(tab, site, "#k=" + FIRST.stored + "&t=" + encodeURIComponent("Welder Apprentice"));
    await pressSearch(tab); await settle();
    n = await t(tab, "#mismatchNotice");
    if (n !== "This ID is not registered to the job title you entered (Welder Apprentice)." + TAIL) bad.push("the title notice says '" + n + "'");
    await openSearch(tab, site, "#k=" + FIRST.stored + "&c=" + encodeURIComponent("Zzyzx Staffing") + "&t=" + encodeURIComponent("Welder Apprentice"));
    await pressSearch(tab); await settle();
    n = await t(tab, "#mismatchNotice");
    if (n !== "This ID is not registered to the company or job title you entered (Zzyzx Staffing, Welder Apprentice)." + TAIL) bad.push("the notice for both says '" + n + "'");
    // nothing that differs: no notice
    await openSearch(tab, site, "#k=" + FIRST.stored + "&c=" + encodeURIComponent("Meridian Health") + "&t=" + encodeURIComponent("Senior Data Analyst"));
    await pressSearch(tab); await settle();
    if ((await t(tab, "#mismatchNotice")) !== "") bad.push("a notice for a company and title that match");
    return bad; }); },
  // ---- 3. stale results
  async stale(root) { return asCand(root, async (site, tab) => { const bad = [];
    const wrong = "KIO-" + FIRST.shown.slice(4, 18).replace(/.$/, FIRST.shown.endsWith("A") ? "B" : "A");
    const afterResult = async (label, company, title, req) => {
      await fill(tab, "Zzyzx Staffing", FIRST.shown); await pressSearch(tab); await settle();          // a result, with the mismatch notice, its count and its recap
      const before = await leftovers(tab);
      if (before.cards !== 1 || !before.notice || !before.recap) bad.push(label + ": the first search did not leave a result with a notice and a recap " + JSON.stringify(before).slice(0, 160));
      await tab.eval("document.getElementById('recapEdit').click()"); await sleep(150);
      const kept = await leftovers(tab);
      if (kept.cards !== 1 || !kept.notice) bad.push(label + ": Edit this search took the old results away (they stay until something is changed and Search is pressed)");
      await fill(tab, company, title, req); await pressSearch(tab); await settle();
      return leftovers(tab);
    };
    await openSearch(tab, site);
    // 3a. a changed ID that fails the check, company removed: only the red line
    let s = await afterResult("bad ID", "", wrong, "");
    if (s.formError !== NOT_VALID) bad.push("bad ID: the red line says '" + s.formError + "'");
    if (s.cards || s.notice || s.count || s.recap || s.results !== "") bad.push("bad ID: the old search is still on the page " + JSON.stringify(s).slice(0, 220));
    // 3b. an ID that passes the check and nobody has: its own line only
    s = await afterResult("unregistered ID", "", UNKNOWN.shown, "");
    if (s.cards || s.notice) bad.push("unregistered ID: the old result or notice is still there");
    if (!s.results.includes(NOT_REG)) bad.push("unregistered ID: the line is '" + s.results.slice(0, 120) + "'");
    // 3c. a title search
    s = await afterResult("title search", "Meridian", "Nurse", "");
    if (s.notice || !s.results.includes("Nurse Practitioner")) bad.push("title search: notice " + s.notice + " / " + s.results.slice(0, 100));
    if (s.cards !== 2) bad.push("title search: " + s.cards + " cards (two openings match)");
    // 3d. a refused search: nothing in any box
    s = await afterResult("empty boxes", "", "", "");
    if (s.cards || s.notice || s.count || s.recap || s.results !== "") bad.push("empty boxes: the old search is still on the page " + JSON.stringify(s).slice(0, 220));
    if (s.formError === "") bad.push("empty boxes: no message");
    // 3e. a title without a company (the company is refused)
    s = await afterResult("title without company", "", "Nurse", "");
    if (s.cards || s.notice || s.recap) bad.push("title without company: the old search is still on the page");
    if (s.formError === "") bad.push("title without company: no message");
    return bad; }); },
  // ---- 4. the short link path
  async shortLink(root) { return asCand(root, async (site, tab) => { const bad = [];
    await tab.goto(site.url + "/" + FIRST.shown);
    await tab.waitFor("location.pathname === '/search.html'", 8000); await tab.waitFor("!!document.getElementById('titleq')", 8000); await sleep(600);
    const box = await tab.eval("document.getElementById('titleq').value + '|' + document.getElementById('company').value");
    if (box !== FIRST.shown + "|") bad.push("the box after the short link is '" + box + "'");
    if (searches(site).length !== 0) bad.push("the short link page searched");
    const o = await leftovers(tab);
    if (o.cards || o.recap) bad.push("something shows before Search is pressed");
    await pressSearch(tab); await settle();
    if ((await t(tab, "#recapText")) !== "You searched for: KIO ID: " + FIRST.shown + ". Your results are below.") bad.push("the recap after the short link says '" + (await t(tab, "#recapText")) + "'");
    return bad; }); },
};

test("BS: the recap shows the ID, the notice names what was entered, nothing of the earlier search stays, the short link still fills the box only", { timeout: 1800000 }, async () => {
  const problems = [];
  for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](ROOT)) problems.push(n + ": " + p);
  assert.deepEqual(problems, [], "BS problems:\n" + problems.join("\n"));
});

// ---- negative controls: [label, scenarios, [[file, mutate]]]
const DEFECTS = [
  ["the recap hides the ID again", ["recap"], [["js/search-recap.js", (s) => s.replace('search.kind === "kio" && typeof search.shown === "string" && search.shown !== "" ? RECAP.KIO + search.shown : ', "")]]],
  ["the recap shows the ID as typed", ["recap"], [["js/search-recap.js", (s) => s.replace("RECAP.KIO + search.shown :", "RECAP.KIO + search.value :")]]],
  ["the recap shows the req number", ["recap"], [["js/search-recap.js", (s) => s.replace("search.kind === \"req\" ? RECAP.REQ", "search.kind === \"req\" ? \"req \" + search.value")]]],
  ["the old notice words are back", ["notice"], [["js/search-input.js", (s) => s.replace('if (c !== "") return "This ID is not registered to the company you entered (" + c + ")." + KIO_MISMATCH_TAIL;', 'if (c !== "") return "This ID is registered to a different company or title (see results below) than the job ad where you found it.";')]]],
  ["the notice leaves out the check-the-copy sentence", ["notice"], [["js/search-input.js", (s) => s.replace('const KIO_MISMATCH_TAIL = " It belongs to the opening shown below. Check that you copied the ID correctly from the job ad.";', 'const KIO_MISMATCH_TAIL = " It belongs to the opening shown below.";')]]],
  ["the company is put in the notice as markup", ["notice"], [["js/pages/search.js", (s) => s.replace('h("div", { class: "alert alert-notice", id: "mismatchNotice", role: "status" }, searched.mismatchText || kioMismatchMessage(searched.company, searched.title))', 'Object.assign(h("div", { class: "alert alert-notice", id: "mismatchNotice", role: "status" }), { innerHTML: searched.mismatchText || kioMismatchMessage(searched.company, searched.title) })')]]],
  ["a new attempt leaves the earlier results", ["stale"], [["js/pages/search.js", (s) => s.replace('setFormError(""); hideRecap(); clearOutcome();', 'setFormError(""); hideRecap();')]]],
  ["the earlier count line stays", ["stale"], [["js/pages/search.js", (s) => s.replace('function clearOutcome() { clear(resultsEl); countEl.hidden = true; countEl.textContent = ""; hideRecap(); lastSearch = null; status.clear(); }', 'function clearOutcome() { clear(resultsEl); hideRecap(); lastSearch = null; status.clear(); }')]]],
  ["the page's own refusal of an ID leaves the earlier results", ["stale"], [["js/pages/search.js", (s) => s.replace('setFormError(""); hideRecap(); clearOutcome();\n  const q = resolveSearch', 'setFormError(""); hideRecap();\n  const q = resolveSearch').replace("if (!q.ok && q.message === KIO_INVALID_MESSAGE) { setFormError(q.message);", "if (!q.ok && q.message === KIO_INVALID_MESSAGE) { clearOutcome(); setFormError(q.message);")]]],
  ["Edit this search takes the old results away", ["stale"], [["js/pages/search.js", (s) => s.replace("  lastSearch = null; hideRecap(); companyIn.focus();", "  lastSearch = null; hideRecap(); clearOutcome(); companyIn.focus();")]]],
  ["the short link page searches by itself", ["shortLink"], [["js/pages/search.js", (s) => s.replace("let heldKio = null;", "let heldKio = null; setTimeout(() => { if (queryIn.value && !busy) form.requestSubmit(); }, 500);")]]],
];
test("negative controls: each defect of BS makes a check fail", { timeout: 6000000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    if (process.env.BS_ONLY && !label.includes(process.env.BS_ONLY)) continue;   // BS_ONLY=<part of a label>: run one control while building
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-bs-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      for (const n of scenarios) found.push(...(await SCENARIOS[n](dir)).map((x) => n + ": " + x));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 160) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
