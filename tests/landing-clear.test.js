// landing-clear.test.js - the green "You are signed in" note clears on the person's first real action (October 5, 2026), in a real browser on the repo's own files with a fake backend (tests/fake-site.js; no real project, no key).
// The note is for the new tab the emailed link opened. It must not stay above the work for the whole visit. Rules: on the search page it clears when the person types in one of the three boxes or when a search THE PERSON started has
// finished; a search replayed by the sign-in handoff does not clear it (the person did nothing; the two-tab test checks that the note is still there). On every other page it clears on the first click or key press inside the page content
// (not on the note itself, not in the top bar). No close button, no timer (it is still there seconds later), and nothing is announced when it goes (no live region speaks). A reload never shows it again.
// Then negative controls: one defect at a time; each must make a check fail. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/landing-clear.test.js
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
const REF = "d21m48ybzqbfxxxxxxxx", GID = "3f1d5b1e-0000-4000-8000-000000000001";
const CAND = "You are signed in. You can close this tab and go back to the one you started from, or keep searching here.";
const EMP = "You are signed in. You can close this tab and go back to the one you started from, or keep working here.";
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

const note = (tab) => tab.eval("(() => { const n = document.querySelector('#landedNotice'); return n && !n.hidden ? n.textContent.trim() : ''; })()");
const WATCH = `(() => { window.__said = []; new MutationObserver((ms) => { for (const m of ms) for (const n of [m.target, ...m.addedNodes]) { const e = n.nodeType === 1 ? n : n.parentElement, r = e && e.closest ? e.closest('[role=status],[role=alert],[aria-live]') : null; if (r && r.id !== "landedNotice" && !r.closest("#landedNotice") && r.textContent.trim() !== "") window.__said.push(r.textContent.trim().slice(0, 60)); } }).observe(document, { childList: true, subtree: true, characterData: true }); })()`;

async function land(tab, site, kind, page) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.eval("localStorage.setItem('fgj-landing-page', JSON.stringify({ v: " + JSON.stringify(page) + ", exp: Date.now() + 600000 }))");
  await tab.goto(site.url + "/_dev/link?kind=" + kind);
  await tab.waitFor("location.pathname === '/" + page.split("?")[0] + "'", 12000);
  await tab.waitFor("!!document.querySelector('#landedNotice') && !document.querySelector('#landedNotice').hidden", 8000);
  await sleep(500); await tab.eval(WATCH);
}

const SCENARIOS = {
  // every page but search: the first click or key press in the content clears it; not a click on the note; no timer; nothing is announced
  async content(site) {
    const bad = [], tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      for (const [kind, page, want, label] of [["poster", "dashboard.html", EMP, "My postings"], ["poster", "edit.html?id=" + GID, EMP, "Edit"], ["candidate", "comments.html?ref=" + REF, CAND, "candidate comments"]]) {
        const tag = label + ": ";
        await land(tab, site, kind, page);
        if ((await note(tab)) !== want) { bad.push(tag + "the landing note is not shown on arrival"); continue; }
        await sleep(2500);
        if ((await note(tab)) !== want) bad.push(tag + "the note went away by itself (it must not have a timer)");
        if (await tab.eval("!!document.querySelector('#landedNotice button, #landedNotice [role=button]')")) bad.push(tag + "the note has a close button");
        await tab.eval("document.querySelector('#landedNotice').click()"); await sleep(200);
        if ((await note(tab)) !== want) bad.push(tag + "a click on the note itself cleared it");
        await tab.eval("document.querySelector('header.nav').click()"); await sleep(200);
        if ((await note(tab)) !== want) bad.push(tag + "a click in the top bar cleared it (only the page content counts)");
        await tab.eval("window.__said = []");
        await tab.eval("document.querySelector('#main h1, #main h2').click()"); await sleep(300);
        if ((await note(tab)) !== "") bad.push(tag + "the first click in the page content did not clear the note");
        if ((await tab.eval("JSON.stringify(window.__said)")) !== "[]") bad.push(tag + "something was announced when the note went: " + (await tab.eval("JSON.stringify(window.__said)")));
        // a key press: land again, put the focus on a control in the content, press a key
        await land(tab, site, kind, page);
        await tab.eval("(() => { const c = Array.from(document.querySelectorAll('#main input, #main select, #main textarea, #main button, #main a[href]')).find((e) => e.offsetParent !== null && !e.disabled); if (c) c.focus(); window.__focused = c ? c.tagName + '#' + c.id : 'none'; })()");
        if ((await note(tab)) !== want) { bad.push(tag + "the note is not shown on arrival (second visit)"); continue; }
        await tab.key("Escape"); await sleep(300);
        if ((await note(tab)) !== "") bad.push(tag + "the first key press in the page content did not clear the note");
        await tab.goto(site.url + "/" + page); await sleep(800);
        if ((await note(tab)) !== "") bad.push(tag + "the note came back on a reload");
      }
    } finally { await tab.close(); }
    return bad;
  },
  // the search page: typing in a box clears it; a click on the page does not; a search the person started clears it when it finishes
  async search(site) {
    const bad = [], tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      await land(tab, site, "candidate", "search.html");
      if ((await note(tab)) !== CAND) { bad.push("search: the landing note is not shown on arrival"); return bad; }
      await sleep(2500);
      if ((await note(tab)) !== CAND) bad.push("search: the note went away by itself (no timer)");
      await tab.eval("document.querySelector('#main h1').click()"); await sleep(200);
      if ((await note(tab)) !== CAND) bad.push("search: a click on the page cleared it (the search page clears on typing or a finished search only)");
      await tab.eval("window.__said = []; (() => { const e = document.getElementById('company'); e.value = 'M'; e.dispatchEvent(new Event('input', { bubbles: true })); })()"); await sleep(300);
      if ((await note(tab)) !== "") bad.push("search: typing in a search box did not clear the note");
      if ((await tab.eval("JSON.stringify(window.__said)")) !== "[]") bad.push("search: something was announced when the note went");
      // a search the person starts (the fields are filled without an input event, as a browser's own autofill would do)
      await land(tab, site, "candidate", "search.html");
      await tab.eval("(() => { document.getElementById('company').value = 'Meridian'; document.getElementById('titleq').value = 'Nurse'; document.getElementById('searchForm').requestSubmit(); })()");
      await tab.waitFor("!document.getElementById('recap').hidden", 8000); await sleep(400);
      if ((await note(tab)) !== "") bad.push("search: the note is still there after a search the person started finished");
    } finally { await tab.close(); }
    return bad;
  },
};

async function withSite(root, fn) { const site = await startFakeSite(root); try { return await fn(site); } finally { await site.close(); } }

test("landing note: clears on the first real action, not on a timer, not on the note, not announced; on search by typing or a finished search the person started", { timeout: 600000 }, async () => {
  const problems = [];
  await withSite(ROOT, async (site) => { for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](site)) problems.push(n + ": " + p); });
  assert.deepEqual(problems, [], "landing note problems:\n" + problems.join("\n"));
});

const DEFECTS = [
  ["the note never clears on a content page", ["content"], [["js/app.js", (s) => s.replace('if (!/search\\.html$/.test(location.pathname)) for (const t of ["click", "keydown"]) document.addEventListener(t, onAct, true);', "void 0;")]]],
  ["a click on the note itself clears it", ["content"], [["js/app.js", (s) => s.replace(" && !box.contains(t)", "")]]],
  ["a click in the top bar clears it", ["content"], [["js/app.js", (s) => s.replace("main && main.contains(t) &&", "")]]],
  ["a key press does not clear it", ["content"], [["js/app.js", (s) => s.replace('for (const t of ["click", "keydown"]) document.addEventListener(t, onAct, true);', 'document.addEventListener("click", onAct, true);')]]],
  ["the note has a timer", ["content", "search"], [["js/app.js", (s) => s.replace("landingNoteOn = { box, off };", "landingNoteOn = { box, off }; setTimeout(clearLandingNote, 1500);")]]],
  ["something is announced when the note goes", ["content"], [["js/app.js", (s) => s.replace("box.hidden = true; clear(box);\n}", 'box.hidden = true; clear(box); const sr = document.createElement("div"); sr.setAttribute("role", "status"); sr.textContent = "Note closed"; document.body.append(sr);\n}')]]],
  ["typing in a search box does not clear it", ["search"], [["js/pages/search.js", (s) => s.replace('for (const el of [companyIn, queryIn, reqIn]) el.addEventListener("input", clearLandingNote);', "")]]],
  ["a search the person started does not clear it", ["search"], [["js/pages/search.js", (s) => s.replace("if (!auto) clearLandingNote();", "")]]],
  ["a click on the search page clears it", ["search"], [["js/app.js", (s) => s.replace('if (!/search\\.html$/.test(location.pathname)) for', "for")]]],
];
test("negative controls: each defect in the landing note's clearing makes a check fail", { timeout: 3000000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-lc-ctl-"));
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
