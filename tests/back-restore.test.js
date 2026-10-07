// back-restore.test.js - Back from Comments or Report a wrong link gives the search page back as it was (October 7, 2026), in a real browser on the repo's own files with a fake backend (tests/fake-site.js; no real project, no key).
// The problem: a person searched, opened a posting's details, followed Comments or Report a wrong link and pressed the browser's Back button: the search form was blank, the results were gone. The browser DID keep the search page (its back/forward cache)
// and threw it away on return, because the Auth library opens a BroadcastChannel on every page and the comments page posts on it ("broadcastchannel-message"). js/session.js now creates the client without that channel, and the search page checks the
// session when it is handed back (js/pages/search.js, the pageshow guard).
// The fake site serves pages with Cache-Control: max-age=600 here (opts.pageCache), as the real stage does: its default no-store alone would stop the browser from keeping any page and the test would prove nothing.
// Proven here (7 scenarios): 1. search, open the details window, follow Comments, Back: the SAME document (a marker set on it is still there), the results, the recap sentence, the scroll position, the details window open with focus inside it, and the platform's
// BroadcastChannel still exists; 2. the same for Report a wrong link; 3. Forward and Back again; 4. signed out in another tab meanwhile: the page comes back, the results, the recap and the window are cleared and the sign-in card is shown; 5. the extension's
// fragment (search.html#c=...&t=...): the boxes are filled, the fragment is gone, no history entry was added, nothing is searched, and a search run from it also comes back after Comments; 6. a refresh gives a fresh blank form; 7. nothing new is stored:
// after the search, Comments and Back, no value typed into the search is in localStorage or sessionStorage and no new key was written.
// Then negative controls: one defect at a time; each must make a scenario fail. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/back-restore.test.js
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

const TYPED = { company: "Meridian", title: "Nurse", req: "R-2026-0451", code: "D21M48YBZQBF" };
const REF = "d21m48ybzqbfxxxxxxxx";

async function signIn(tab, site) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
async function openSearch(tab, site, hash) {
  await tab.goto(site.url + "/search.html" + (hash || ""));
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(700);
}
const fill = (tab, company, title) => tab.eval(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }; set("company", ${JSON.stringify(company)}); set("titleq", ${JSON.stringify(title)}); return true; })()`);
async function search(tab) {
  await fill(tab, TYPED.company, TYPED.title);
  await tab.eval(`document.getElementById("searchBtn").focus()`); await tab.key("Enter");
  await tab.waitFor("document.querySelectorAll('#results .card').length > 0", 8000); await sleep(900);
}
// the details window, then the link in it (Comments or Report a wrong link): a real click on the real link
async function followLink(tab, which) {
  await tab.eval(`document.querySelector("#results .view-details").click(); true`);
  await tab.waitFor("!!document.querySelector('#modalBackdrop.open') && document.querySelectorAll('#modalMore a').length > 0", 8000); await sleep(400);
  await tab.eval(`(() => { const a = Array.from(document.querySelectorAll("#modalMore a")).find((x) => ${which === "report" ? "/report/i" : "/^Comments/"}.test(x.textContent)); a.click(); return true; })()`);
  await tab.waitFor("location.pathname.indexOf('comments.html') >= 0 && !!document.getElementById('recap')", 8000); await sleep(1500);
}
async function back(tab) { await tab.eval("history.back(); true"); await tab.waitFor("location.pathname.indexOf('search.html') >= 0", 8000); await sleep(2000); }
const STATE = `(() => { const r = document.getElementById("results"), recap = document.getElementById("recap"), modal = document.querySelector("#modalBackdrop .modal"), sw = document.getElementById("signinWrap");
  return { marker: window.__marker || null, bc: typeof BroadcastChannel, cards: r ? r.querySelectorAll(".card").length : -1, recapShown: !!recap && !recap.hidden, recapText: recap && !recap.hidden ? document.getElementById("recapText").textContent : "", count: (document.getElementById("resultCount") || {}).hidden === false,
    scrollY: Math.round(scrollY), modalOpen: !!document.querySelector("#modalBackdrop.open"), focusInModal: !!modal && modal.contains(document.activeElement), signinShown: !!sw && !sw.hidden, company: document.getElementById("company").value, titleq: document.getElementById("titleq").value, reqq: document.getElementById("reqq").value,
    hash: location.hash, histLen: history.length, path: location.pathname }; })()`;
const stored = (tab) => tab.eval(`(() => { const dump = (s) => { const o = {}; for (let i = 0; i < s.length; i++) { const k = s.key(i); o[k] = s.getItem(k); } return o; }; return { local: dump(localStorage), session: dump(sessionStorage) }; })()`);
const SEARCH_RECAP = "You searched for: company Meridian, title Nurse. Your results are below.";

// 1 and 2: Comments / Report a wrong link and Back: the same page, as it was
async function restores(site, which) {
  const bad = [], tab = await browser.newTab();
  try {
    await tab.focusEmulation(true); await tab.viewport(1280, false, 900);
    await signIn(tab, site); await openSearch(tab, site);
    await tab.eval("window.__marker = 'THE-SAME-DOCUMENT'; true");
    await search(tab);
    await tab.eval(`document.querySelector("#results .view-details").click(); true`);
    await tab.waitFor("!!document.querySelector('#modalBackdrop.open') && document.querySelectorAll('#modalMore a').length > 0", 8000); await sleep(300);
    const before = await tab.eval(STATE);
    if (before.cards !== 2 || !before.recapShown || before.recapText !== SEARCH_RECAP || !before.modalOpen) bad.push(which + ": the test did not reach the state it needs: " + JSON.stringify(before));
    if (before.bc !== "function") bad.push(which + ": the browser's BroadcastChannel is missing after the sign-in client was created (it must be put back): " + before.bc);
    await tab.eval(`(() => { const a = Array.from(document.querySelectorAll("#modalMore a")).find((x) => ${which === "report" ? "/report/i" : "/^Comments/"}.test(x.textContent)); a.click(); return true; })()`);
    await tab.waitFor("location.pathname.indexOf('comments.html') >= 0 && !!document.getElementById('recap')", 8000); await sleep(1500);
    const there = await tab.eval(`location.pathname + location.search + location.hash`);
    if (there !== "/comments.html?ref=" + REF + (which === "report" ? "#report" : "")) bad.push(which + ": the link went to " + there);
    await back(tab);
    const after = await tab.eval(STATE);
    if (after.marker !== "THE-SAME-DOCUMENT") bad.push(which + ": Back loaded the search page again (a new document); the browser did not give the same page back");
    if (after.cards !== 2) bad.push(which + ": " + after.cards + " result cards after Back, 2 before");
    if (!after.recapShown || after.recapText !== SEARCH_RECAP) bad.push(which + ": the recap after Back is " + JSON.stringify(after.recapText));
    if (Math.abs(after.scrollY - before.scrollY) > 2) bad.push(which + ": the scroll position after Back is " + after.scrollY + ", it was " + before.scrollY);
    if (!after.modalOpen || !after.focusInModal) bad.push(which + ": the details window after Back: open " + after.modalOpen + ", focus inside it " + after.focusInModal);
    if (after.bc !== "function") bad.push(which + ": BroadcastChannel is gone after Back");
    if (after.signinShown) bad.push(which + ": the sign-in card shows for a person who is still signed in");
    if (which === "comments") {
      // 3: Forward and Back again: the same page each time
      await tab.eval("history.forward(); true"); await tab.waitFor("location.pathname.indexOf('comments.html') >= 0", 8000); await sleep(1200);
      await back(tab);
      const again = await tab.eval(STATE);
      if (again.marker !== "THE-SAME-DOCUMENT" || again.cards !== 2 || again.recapText !== SEARCH_RECAP) bad.push("Forward and Back again did not give the same page: " + JSON.stringify({ marker: again.marker, cards: again.cards, recap: again.recapText }));
      // Escape closes the window and focus goes back to View posting details (the existing focus code), as before
      await tab.key("Escape"); await sleep(300);
      const esc = await tab.eval(`({ open: !!document.querySelector("#modalBackdrop.open"), onButton: document.activeElement && document.activeElement.classList.contains("view-details") })`);
      if (esc.open || !esc.onButton) bad.push("after Back, Escape: window open " + esc.open + ", focus on View posting details " + esc.onButton);
    }
  } finally { await tab.close(); }
  return bad;
}

const SCENARIOS = {
  // the test itself is meaningful: the pages are served the way the real stage serves them
  async header(site) {
    const cc = (await fetch(site.url + "/search.html")).headers.get("cache-control");
    return cc === "max-age=600" ? [] : ["the fake site serves the pages with Cache-Control " + cc + ", the real stage serves max-age=600"];
  },
  comments: (site) => restores(site, "comments"),
  report: (site) => restores(site, "report"),
  // 4: signed out in another tab while this one was away: the page comes back, the results do not
  async signedOutMeanwhile(site) {
    const bad = [], tab = await browser.newTab(), other = await browser.newTab();
    try {
      await tab.focusEmulation(true); await tab.viewport(1280, false, 900);
      await signIn(tab, site); await openSearch(tab, site);
      await tab.eval("window.__marker = 'THE-SAME-DOCUMENT'; true");
      await search(tab); await followLink(tab, "comments");
      await other.goto(site.url + "/404.html"); await other.eval("localStorage.removeItem('fgj-auth'); true");   // the person signs out in another tab
      await back(tab); await sleep(800);
      const s = await tab.eval(STATE);
      if (s.marker !== "THE-SAME-DOCUMENT") bad.push("the test needs the page restored from the browser's cache and it was loaded again");
      if (s.cards !== 0 || s.recapShown || s.count) bad.push("signed out meanwhile: results " + s.cards + ", recap shown " + s.recapShown + ", count shown " + s.count + " (all must be cleared)");
      if (s.modalOpen) bad.push("signed out meanwhile: the details window is still open");
      if (!s.signinShown) bad.push("signed out meanwhile: the sign-in card is not shown");
      const said = await tab.eval(`document.getElementById("candEmailError").textContent`);
      if (!/confirm your email/i.test(said)) bad.push("signed out meanwhile: the card says " + JSON.stringify(said));
    } finally { await tab.close(); await other.close(); }
    return bad;
  },
  // 5: the extension's fragment
  async fragment(site) {
    const bad = [], tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await tab.viewport(1280, false, 900);
      await signIn(tab, site);
      await openSearch(tab, site); const plain = await tab.eval(STATE);
      await tab.goto(site.url + "/404.html");   // a page load, not a change of the fragment of the page that is already open
      await openSearch(tab, site, "#c=Meridian&t=Nurse"); const s = await tab.eval(STATE);
      if (s.company !== "Meridian" || s.titleq !== "Nurse" || s.reqq !== "") bad.push("the fragment did not fill the boxes: " + JSON.stringify({ company: s.company, title: s.titleq, req: s.reqq }));
      if (s.hash !== "") bad.push("the fragment is still in the address bar: " + s.hash);
      if (s.cards !== 0 || s.recapShown) bad.push("the fragment started a search by itself");
      // opening the page with the fragment adds the same ONE history entry as opening it without
      if (s.histLen !== plain.histLen + 2) bad.push("history length " + s.histLen + " after the fragment page, " + plain.histLen + " after the plain page (two more are expected: the other page and the search page itself, no entry for the fragment)");
      await tab.eval("window.__marker = 'THE-SAME-DOCUMENT'; true");
      await tab.eval(`document.getElementById("searchBtn").focus()`); await tab.key("Enter");   // the person presses Search
      await tab.waitFor("document.querySelectorAll('#results .card').length > 0", 8000); await sleep(900);
      await followLink(tab, "comments"); await back(tab);
      const after = await tab.eval(STATE);
      if (after.marker !== "THE-SAME-DOCUMENT" || after.cards < 1 || !after.recapShown) bad.push("a search started from the fragment did not come back after Comments: " + JSON.stringify({ marker: after.marker, cards: after.cards, recap: after.recapShown }));
      if (after.hash !== "" || after.company !== "") bad.push("after Back the boxes or the address carry the fragment again: " + JSON.stringify({ hash: after.hash, company: after.company }));
    } finally { await tab.close(); }
    return bad;
  },
  // 6: a refresh is a fresh page
  async refresh(site) {
    const bad = [], tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await tab.viewport(1280, false, 900);
      await signIn(tab, site); await openSearch(tab, site); await tab.eval("window.__marker = 'THE-SAME-DOCUMENT'; true");
      await search(tab); await followLink(tab, "comments"); await back(tab);
      await tab.eval("location.reload(); true"); await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(1000);
      const s = await tab.eval(STATE);
      if (s.marker !== null || s.cards !== 0 || s.recapShown || s.company !== "" || s.titleq !== "") bad.push("a refresh did not give a fresh blank form: " + JSON.stringify(s));
    } finally { await tab.close(); }
    return bad;
  },
  // 7: nothing new is stored, and none of the typed values is anywhere in storage
  async nothingStored(site) {
    const bad = [], tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await tab.viewport(1280, false, 900);
      await signIn(tab, site); await openSearch(tab, site);
      const base = await stored(tab);
      await tab.eval(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }; set("company", "Meridian"); set("reqq", ${JSON.stringify(TYPED.req)}); return true; })()`);
      await tab.eval(`document.getElementById("searchBtn").focus()`); await tab.key("Enter");
      await tab.waitFor("document.querySelectorAll('#results .card').length > 0", 8000); await sleep(900);
      await followLink(tab, "comments"); await back(tab);
      const now = await stored(tab);
      for (const kind of ["local", "session"]) {
        const added = Object.keys(now[kind]).filter((k) => !(k in base[kind]));
        if (added.length) bad.push("a new " + kind + "Storage key appeared: " + added.join(", "));
        const text = JSON.stringify(now[kind]);
        for (const v of [TYPED.company, TYPED.req, TYPED.code, TYPED.title]) if (text.includes(v)) bad.push("the typed value " + JSON.stringify(v) + " is in " + kind + "Storage");
      }
    } finally { await tab.close(); }
    return bad;
  },
};

async function withSite(root, fn) { const site = await startFakeSite(root, { pageCache: "max-age=600" }); try { return await fn(site); } finally { await site.close(); } }

test("Back from Comments or Report a wrong link gives the search page back as it was; signed out meanwhile clears it; the fragment fill, a refresh and storage are unchanged", { timeout: 900000 }, async () => {
  const problems = [];
  await withSite(ROOT, async (site) => { for (const n of Object.keys(SCENARIOS)) { if (process.env.FGJ_ONLY && !process.env.FGJ_ONLY.split(",").includes(n)) continue; for (const p of await SCENARIOS[n](site).catch((e) => ["the scenario stopped: " + String(e.message).slice(0, 200)])) problems.push(n + ": " + p); } });
  assert.deepEqual(problems, [], "problems:\n" + problems.join("\n"));
});

// one defect at a time, planted in a copy of the site: [label, [[file, mutate]], the scenarios that must notice it]
const DEFECTS = [
  ["the Auth client keeps its cross-tab channel", [["js/session.js", (s) => s.replace("    globalThis.BroadcastChannel = undefined;\n", "")]], ["comments", "report", "signedOutMeanwhile", "fragment", "refresh", "nothingStored"]],
  ["the channel is never put back after the client is created", [["js/session.js", (s) => s.replace("} finally { globalThis.BroadcastChannel = channel; }", "} finally { }")]], ["comments"]],
  ["the search page has an unload handler", [["js/pages/search.js", (s) => s + "\nwindow.addEventListener(\"unload\", () => {});\n"]], ["comments", "signedOutMeanwhile"]],
  ["another script talks on a channel the search page listens on", [["js/pages/search.js", (s) => s + "\nnew BroadcastChannel(\"fgj-x\");\n"], ["js/pages/comments.js", (s) => s + "\ntry { new BroadcastChannel(\"fgj-x\").postMessage(1); } catch (e) {}\n"]], ["comments", "report"]],
  ["the page guard is gone: results stay in a restored signed-out page", [["js/pages/search.js", (s) => s.replace('window.addEventListener("pageshow", async (ev) => {', 'window.addEventListener("pageshow-gone", async (ev) => {')]], ["signedOutMeanwhile"]],
  ["the guard keeps the results", [["js/pages/search.js", (s) => s.replace("closeModal(); clear(resultsEl); countEl.hidden = true; hideRecap(); lastSearch = null; status.clear();", "lastSearch = null; status.clear();")]], ["signedOutMeanwhile"]],
  ["the guard does not show the sign-in card", [["js/pages/search.js", (s) => s.replace('  if (!session) showSignIn("Please confirm your email to search.");\n});', "});")]], ["signedOutMeanwhile"]],
  ["the guard also clears the results of a person who is still signed in", [["js/pages/search.js", (s) => s.replace("if (s && s.isCandidate) { session = s; return; }\n  closeModal();", "closeModal();")]], ["comments", "report", "fragment"]],
  ["the last search is kept in sessionStorage", [["js/pages/search.js", (s) => s.replace("  lastSearch = typed;\n", "  lastSearch = typed; try { sessionStorage.setItem(\"fgj-last-search\", JSON.stringify(typed)); } catch { /* ignore */ }\n")]], ["nothingStored"]],
  ["the typed company is kept in localStorage", [["js/pages/search.js", (s) => s.replace("  lastSearch = typed;\n", "  lastSearch = typed; try { localStorage.setItem(\"fgj-x\", typed.company); } catch { /* ignore */ }\n")]], ["nothingStored"]],
  ["the fragment adds a history entry", [["js/fragment-prefill.js", (s) => s.replace("win.history.replaceState(", "win.history.pushState(")]], ["fragment"]],
  ["the fragment is not taken out of the address bar", [["js/fragment-prefill.js", (s) => s.replace("win.history.replaceState(win.history.state, \"\", win.location.pathname + win.location.search);", "void 0;")]], ["fragment"]],
  ["the Comments link opens the page in the same window but the details window is closed first", [["js/pages/search.js", (s) => s.replace("function moreLinks(row, count, withReport) {", "function moreLinks(row, count, withReport) { setTimeout(() => { for (const a of document.querySelectorAll('#modalMore a')) a.addEventListener('click', () => closeModal()); }, 0);")]], ["comments", "report"]],
];
// FGJ_CTL_LOG=<file>: one line per defect and scenario with the seconds it took (for a slow machine); nothing is written without it
const log = (line) => { if (process.env.FGJ_CTL_LOG) fs.appendFileSync(process.env.FGJ_CTL_LOG, new Date().toLocaleTimeString() + "  " + line + "\n"); };
test("negative controls: each defect makes the scenario that guards it fail", { timeout: 3500000 }, async () => {
  const missed = [];
  for (const [label, edits, scenarios] of DEFECTS) {
    if (process.env.FGJ_CTL_ONLY && !label.includes(process.env.FGJ_CTL_ONLY)) continue;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-br-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      await withSite(dir, async (site) => { for (const n of scenarios) { const t0 = Date.now(); for (const p of await SCENARIOS[n](site)) found.push(n + ": " + p); log(label.slice(0, 50) + " | " + n + " | " + Math.round((Date.now() - t0) / 1000) + " s"); } });
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 150) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
