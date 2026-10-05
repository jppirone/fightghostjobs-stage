// search-recap.test.js - the search recap (October 5, 2026, Part C), in a real browser on the repo's own files with a fake backend (tests/fake-site.js; no real project, no key).
// After a search has actually run (postings found, or none) the three boxes are EMPTIED and a read-only recap sits between the form and the results: "You searched for: company X, title Y. Your results are below."
// A req number and a postID are NEVER shown in clear (the recap says "a req number was entered" or "a postID was entered"; a phrase of twelve plain letters, which could be a postID, is treated the same way); they are in the page
// nowhere and in no storage. The recap does not repeat the count ("N matching postings" / "No matching postings" stays on its own line under it). "Edit this search" (a real button, keyboard too) puts the typed values back, hides the
// recap and puts the cursor in Company. A search stopped by a message (a missing company, both boxes filled) or by the "verify your email first" card shows no recap and the boxes keep what was typed. A reload shows an empty form and
// no recap. ONE polite status message per search is spoken: the recap sentence and the count in one message ("... Your results are below. 2 matching postings." / "... No matching postings."); focus stays on the Search button. At 1280, 375 and 320 nothing scrolls sideways and the button is a real target.
// Screenshots go to brand-kit\audits\screens-oct5\ when FGJ_SHOTS is set to that folder. Then negative controls: one defect at a time; each must make a check fail. A missing browser FAILS the test (set FGJ_BROWSER).
// Run: node --test tests/search-recap.test.js
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
const SHOTS = process.env.FGJ_SHOTS || "";
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

const REQ = "R-2026-0451", CODE = "D21M48YBZQBF", PLAIN12 = "Receptionist";
const sentence = (company, what) => "You searched for: company " + company + ", " + what + ". Your results are below.";

async function openSearch(tab, site, who) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  if (who === "cand") { await tab.goto(site.url + "/_dev/link?kind=candidate"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500); }
  await tab.goto(site.url + "/search.html");
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(600);
}
const fill = (tab, company, title, req) => tab.eval(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }; set("company", ${JSON.stringify(company)}); set("titleq", ${JSON.stringify(title || "")}); set("reqq", ${JSON.stringify(req || "")}); })()`);
const values = (tab) => tab.eval(`["company", "titleq", "reqq"].map((id) => document.getElementById(id).value).join("|")`);
const search = async (tab) => { await tab.eval(`document.getElementById("searchBtn").focus()`); await tab.key("Enter"); };
const WATCH = `(() => { window.__said = []; const live = (n) => { const e = n.nodeType === 1 ? n : n.parentElement; return e && e.closest ? e.closest('[role=status],[role=alert],[aria-live]') : null; };
  new MutationObserver((ms) => { for (const m of ms) { const r = live(m.target); if (r && r.textContent.trim() !== "") window.__said.push({ id: r.id, text: r.textContent.trim() }); } }).observe(document, { childList: true, subtree: true, characterData: true }); })()`;
const RECAP = `(() => { const r = document.getElementById("recap"), t = document.getElementById("recapText"), res = document.getElementById("results"), form = document.getElementById("searchForm"), cnt = document.getElementById("resultCount");
  const top = (e) => e.getBoundingClientRect().top, bottom = (e) => e.getBoundingClientRect().bottom, shown = !!r && !r.hidden && r.getClientRects().length > 0;
  const b = document.getElementById("recapEdit");
  return { shown, text: t ? t.textContent : null, formBottom: bottom(form), recapTop: shown ? top(r) : null, recapBottom: shown ? bottom(r) : null, countTop: cnt.hidden ? null : top(cnt), resultsTop: top(res), countText: cnt.hidden ? null : cnt.textContent,
    btn: b ? { text: b.textContent.trim(), tag: b.tagName, h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width } : null, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, noMatchCount: (document.body.innerText.match(/No matching postings/gi) || []).length - (document.getElementById("searchStatus").textContent.match(/No matching postings/gi) || []).length }; })()`;

async function shot(tab, name) { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await tab.shotFull(path.join(SHOTS, name), 2400); } }

const SCENARIOS = {
  // a signed-in candidate, every kind of search; sizes 1280, 375, 320
  async kinds(site) {
    const bad = [], tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      for (const [width, phone] of [[1280, false], [375, true], [320, true]]) {
        const tag = "at " + width + ": ";
        await tab.viewport(width, phone, phone ? 700 : 900);
        await openSearch(tab, site, "cand"); await tab.viewport(width, phone, phone ? 700 : 900); await tab.eval(WATCH);
        const before = await tab.eval(RECAP);
        if (before.shown) bad.push(tag + "a recap shows before any search");
        const cases = [
          ["a title", "Meridian", "Nurse", "", sentence("Meridian", "title Nurse"), "2 matching postings"],
          ["a req number", "Meridian", "", REQ, sentence("Meridian", "a req number was entered"), "2 matching postings"],
          ["a postID", "Meridian", CODE, "", sentence("Meridian", "a postID was entered"), "2 matching postings"],
          ["twelve plain letters (could be a postID)", "Meridian", PLAIN12, "", sentence("Meridian", "a postID was entered"), "2 matching postings"],
          ["a search that finds nothing", "Zzyzx Unknown", "Nurse", "", sentence("Zzyzx Unknown", "title Nurse"), "No matching postings"],
        ];
        for (const [what, company, title, req, want, wantCount] of cases) {
          await fill(tab, company, title, req); await tab.eval("window.__said = []"); await search(tab);
          if (!(await tab.waitFor(`!document.getElementById("recap").hidden`, 6000))) { bad.push(tag + what + ": no recap appeared"); continue; }
          await sleep(500);
          const r = await tab.eval(RECAP), v = await values(tab);
          if (v !== "||") bad.push(tag + what + ": the three boxes were not emptied (" + v + ")");
          if (r.text !== want) bad.push(tag + what + ": the recap says '" + r.text + "'");
          if (!(r.formBottom <= r.recapTop + 1 && r.recapBottom <= r.resultsTop + 1)) bad.push(tag + what + ": the recap is not between the form and the results " + JSON.stringify([r.formBottom, r.recapTop, r.recapBottom, r.resultsTop]));
          if (r.countText !== wantCount) bad.push(tag + what + ": the count line says '" + r.countText + "'");
          if (r.countTop !== null && !(r.recapBottom <= r.countTop + 1)) bad.push(tag + what + ": the count line is not under the recap");
          if (/matching posting/i.test(r.text || "")) bad.push(tag + what + ": the recap repeats the count");
          if (r.noMatchCount > (wantCount === "No matching postings" ? 1 : 0)) bad.push(tag + what + ": 'No matching postings' appears " + r.noMatchCount + " times on the page");
          if (!r.btn || r.btn.tag !== "BUTTON" || r.btn.text !== "Edit this search") bad.push(tag + what + ": no real Edit this search button (" + JSON.stringify(r.btn) + ")");
          else if (r.btn.h < 43.5 && phone) bad.push(tag + what + ": the Edit this search button is only " + Math.round(r.btn.h) + " high on a phone");
          else if (r.btn.h < 23.5 || r.btn.w < 23.5) bad.push(tag + what + ": the Edit this search button is smaller than 24 x 24");
          if (r.sw > r.cw + 0.5) bad.push(tag + what + ": the page scrolls sideways");
          // a req number or a postID is nowhere: not in the text of the page, not in any storage, not in the status
          const secrets = REQ.toLowerCase() + "|" + CODE.toLowerCase() + "|" + PLAIN12.toLowerCase();
          const leak = await tab.eval(`(() => { const all = (document.body.innerText + " " + document.getElementById("searchStatus").textContent + " " + JSON.stringify(localStorage) + " " + JSON.stringify(sessionStorage) + " " + Array.from(document.querySelectorAll("[value],[title],[aria-label],[placeholder]")).map((e) => e.getAttribute("value") + " " + e.getAttribute("title") + " " + e.getAttribute("aria-label")).join(" ")).toLowerCase(); return ${JSON.stringify(secrets)}.split("|").filter((s) => all.includes(s)); })()`);
          const allowed = what.startsWith("a title") || what.includes("finds nothing") ? [PLAIN12.toLowerCase()] : [];
          const real = leak.filter((x) => !allowed.includes(x));
          if (real.length) bad.push(tag + what + ": a value that must stay private is on the page or in storage: " + real.join(", "));
          if (what.startsWith("twelve") === false && (leak.includes(REQ.toLowerCase()) || leak.includes(CODE.toLowerCase()))) { /* already reported above */ }
          // one spoken message, the recap sentence, once; focus stays on the Search button
          const said = JSON.parse(await tab.eval("JSON.stringify(window.__said)")), mine = said.filter((x) => x.id === "searchStatus");
          const spoken = want + " " + wantCount + ".";
          if (mine.length !== 1 || mine[0].text !== spoken) bad.push(tag + what + ": the search status spoke " + JSON.stringify(mine) + " (wanted " + JSON.stringify(spoken) + ")");
          if (said.some((x) => x.id !== "searchStatus")) bad.push(tag + what + ": another live region spoke too: " + JSON.stringify(said.filter((x) => x.id !== "searchStatus")));
          const at = await tab.eval("document.activeElement && document.activeElement.id");
          if (at !== "searchBtn") bad.push(tag + what + ": focus is on '" + at + "' after the search (wanted searchBtn)");
          if (what === "a title" || what.includes("finds nothing")) await shot(tab, "C-recap-" + (what === "a title" ? "results" : "nomatch") + "-" + width + ".png");
        }
        // Edit this search: with the keyboard; puts the typed values back (the req number too, still hidden), hides the recap, cursor in Company
        await fill(tab, "Meridian", "", REQ); await search(tab); await tab.waitFor(`!document.getElementById("recap").hidden`, 6000); await sleep(300);
        await tab.eval(`document.getElementById("recapEdit").focus()`); await tab.key("Enter"); await sleep(250);
        if ((await values(tab)) !== "Meridian||" + REQ) bad.push(tag + "Edit this search did not put the typed values back: " + (await values(tab)));
        if ((await tab.eval(`document.getElementById("reqq").type`)) !== "password") bad.push(tag + "the restored req number is not hidden");
        if ((await tab.eval(`document.activeElement && document.activeElement.id`)) !== "company") bad.push(tag + "Edit this search did not put the cursor in Company");
        if ((await tab.eval(RECAP)).shown) bad.push(tag + "the recap stays after Edit this search");
        if (width === 375) await shot(tab, "C-edit-restored-375.png");
        // a search stopped by a message: no recap, the boxes keep what was typed
        await fill(tab, "Meridian", "Nurse", ""); await search(tab); await tab.waitFor(`!document.getElementById("recap").hidden`, 6000); await sleep(300);
        for (const [what, c, t, rq, wantMsg] of [["a missing company", "", "Nurse", "", "Enter the company name"], ["both boxes filled", "Meridian", "Nurse", REQ, "not both"]]) {
          await fill(tab, c, t, rq); await search(tab); await sleep(500);
          const r = await tab.eval(RECAP), msg = await tab.eval(`document.getElementById("formError").hidden ? "" : document.getElementById("formError").textContent`);
          if (r.shown) bad.push(tag + what + ": the recap is still shown");
          if (!msg.includes(wantMsg)) bad.push(tag + what + ": the message is '" + msg + "'");
          if ((await values(tab)) !== c + "|" + t + "|" + rq) bad.push(tag + what + ": the boxes did not keep what was typed: " + (await values(tab)));
        }
        // a reload: empty form, no recap
        await fill(tab, "Meridian", "Nurse", ""); await search(tab); await tab.waitFor(`!document.getElementById("recap").hidden`, 6000);
        await tab.goto(site.url + "/search.html"); await tab.waitFor("document.readyState === 'complete'"); await sleep(700);
        if ((await values(tab)) !== "||" || (await tab.eval(RECAP)).shown) bad.push(tag + "a reload does not show an empty form without a recap");
      }
    } finally { await tab.close(); }
    return bad;
  },
  // signed out: the verify card stops the search; no recap, the boxes keep what was typed
  async signedOut(site) {
    const bad = [], tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      await openSearch(tab, site, "out");
      await fill(tab, "Meridian Health", "Analyst", ""); await search(tab); await sleep(700);
      if (!(await tab.eval(`!document.getElementById("signinWrap").hidden`))) bad.push("the verify your email card did not show");
      if ((await tab.eval(RECAP)).shown) bad.push("a recap shows on the verify your email card");
      if ((await values(tab)) !== "Meridian Health|Analyst|") bad.push("the boxes did not keep what was typed on the verify card: " + (await values(tab)));
    } finally { await tab.close(); }
    return bad;
  },
};

async function withSite(root, fn) { const site = await startFakeSite(root); try { return await fn(site); } finally { await site.close(); } }

test("search recap: boxes emptied, read-only recap between form and results, req and postID never shown, Edit this search, no recap when a search is stopped, one spoken message", { timeout: 600000 }, async () => {
  const problems = [];
  await withSite(ROOT, async (site) => { for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](site)) problems.push(n + ": " + p); });
  assert.deepEqual(problems, [], "recap problems:\n" + problems.join("\n"));
});

const DEFECTS = [
  ["the boxes are not emptied after a search", ["kinds"], [["js/pages/search.js", (s) => s.replace('companyIn.value = ""; queryIn.value = ""; reqIn.value = "";\n  const text', "const text")]]],
  ["the req number is shown in clear", ["kinds"], [["js/search-recap.js", (s) => s.replace("search.kind === \"req\" ? RECAP.REQ", "search.kind === \"req\" ? \"req \" + search.value")]]],
  ["the postID is shown in clear", ["kinds"], [["js/search-recap.js", (s) => s.replace("search.kind === \"code\" || search.alsoTryCode ? RECAP.CODE", "search.kind === \"code\" ? \"postID \" + search.value : search.alsoTryCode ? RECAP.CODE")]]],
  ["twelve plain letters are printed as a title", ["kinds"], [["js/search-recap.js", (s) => s.replace("search.kind === \"code\" || search.alsoTryCode ? RECAP.CODE", "search.kind === \"code\" ? RECAP.CODE")]]],
  ["the recap repeats the count", ["kinds"], [["js/search-recap.js", (s) => s.replace('"." + RECAP.TAIL', '"." + RECAP.TAIL + " 2 matching postings"')]]],
  ["the recap sentence is reworded", ["kinds"], [["js/search-recap.js", (s) => s.replace('TAIL: " Your results are below."', 'TAIL: " The results are below."')]]],
  ["the recap sits under the results", ["kinds"], [["search.html", (s) => { const a = s.indexOf('    <div id="recap" class="recap" hidden>'), b = s.indexOf('    <div id="searchStatus"'), blk = s.slice(a, b), rest = s.slice(0, a) + s.slice(b), at = rest.indexOf('    <div id="results"'), end = rest.indexOf("</div>", at) + 7; return rest.slice(0, end) + blk + rest.slice(end); }]]],
  ["the Edit this search button is a plain link-looking span", ["kinds"], [["search.html", (s) => s.replace('<button type="button" id="recapEdit" class="btn btn-outline btn-sm">Edit this search</button>', '<span id="recapEdit" tabindex="0" class="btn btn-outline btn-sm">Edit this search</span>')]]],
  ["Edit this search does not put the values back", ["kinds"], [["js/pages/search.js", (s) => s.replace("if (lastSearch) { companyIn.value = lastSearch.company; queryIn.value = lastSearch.q; reqIn.value = lastSearch.r; }", "")]]],
  ["Edit this search does not move the cursor to Company", ["kinds"], [["js/pages/search.js", (s) => s.replace("lastSearch = null; hideRecap(); companyIn.focus();", "lastSearch = null; hideRecap();")]]],
  ["Edit this search leaves the recap showing", ["kinds"], [["js/pages/search.js", (s) => s.replace("lastSearch = null; hideRecap(); companyIn.focus();", "lastSearch = null; companyIn.focus();")]]],
  ["a new search that is stopped by a message leaves the old recap showing", ["kinds"], [["js/pages/search.js", (s) => s.replace('setFormError(""); hideRecap();', 'setFormError("");')]]],
  ["the verify your email card shows a recap", ["signedOut"], [["js/pages/search.js", (s) => s.replace('    showSignIn("Verify your email first.', '    recapEl.hidden = false;\n    showSignIn("Verify your email first.')]]],
  ["the typed values are kept in browser storage", ["kinds"], [["js/pages/search.js", (s) => s.replace("  lastSearch = typed;\n", "  lastSearch = typed; sessionStorage.setItem(\"last-search\", JSON.stringify(typed));\n")]]],
  ["the recap sentence is not spoken", ["kinds"], [["js/pages/search.js", (s) => s.replace("  status.announce(spoken);\n}", "}")]]],
  ["the count is left out of the spoken message", ["kinds"], [["js/pages/search.js", (s) => s.replace('const spoken = text + " " + countEl.textContent + ".";', "const spoken = text;")]]],
  ["the count is spoken as a second message instead of one", ["kinds"], [["js/pages/search.js", (s) => s.replace("  status.announce(spoken);\n}", "  status.announce(text); setTimeout(() => status.announce(countEl.textContent), 200);\n}")]]],
];
test("negative controls: each defect in the recap makes a check fail", { timeout: 3000000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-recap-ctl-"));
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
