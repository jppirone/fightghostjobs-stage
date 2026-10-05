// search-scroll.test.js - after a successful search the recap scrolls to the top of the window (October 5, 2026, E4), in a real browser on the repo's own files with a fake backend (tests/fake-site.js; no real project, no key).
// Before this the page stayed at the top: at 1280 the first card began at the bottom edge and on a phone the results were off screen, so pressing Search looked like nothing happened.
// Rules: a SCROLL, never a focus move (focus stays on the Search button); smooth (the page is seen moving, not jumping); a person who prefers reduced motion gets no scroll at all; a search that failed or was stopped by a message does not scroll;
// a search replayed by the sign-in handoff does not scroll (the person did nothing, and the landing note sits above). At 1280, 375 and 320 pixels the recap ends up at the top of the window.
// Then negative controls: one defect at a time; each must make a check fail. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/search-scroll.test.js
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

async function openSearch(tab, site, width, phone, reduced) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.viewport(width, phone, phone ? 700 : 900);
  await tab.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }] });
  await tab.goto(site.url + "/search.html");
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(700);
}
const fill = (tab, company, title) => tab.eval(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }; set("company", ${JSON.stringify(company)}); set("titleq", ${JSON.stringify(title)}); })()`);
// a person who presses Search can see the button: bring it into view first (so the test does not scroll the page by itself), then press Enter; -> the scroll position at that moment
const searchByKey = async (tab) => { await tab.eval(`(() => { const b = document.getElementById("searchBtn"); b.scrollIntoView({ block: "center", behavior: "instant" }); b.focus(); })()`); await sleep(150); const y0 = Math.round(await tab.eval("window.scrollY")); await tab.key("Enter"); return y0; };
// sample the scroll position while the page moves: -> { y: final, moves: how many different positions were seen, recapTop }
async function watchScroll(tab, ms) {
  const seen = new Set(); const until = Date.now() + ms;
  while (Date.now() < until) { seen.add(Math.round(await tab.eval("window.scrollY"))); await sleep(30); }
  return { moves: seen.size, y: Math.round(await tab.eval("window.scrollY")), recapTop: await tab.eval(`(() => { const r = document.getElementById("recap"); return r && !r.hidden ? Math.round(r.getBoundingClientRect().top) : null; })()`) };
}

const SCENARIOS = {
  async scroll(site) {
    const bad = [], tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      for (const [width, phone] of [[1280, false], [375, true], [320, true]]) {
        const tag = "at " + width + ": ";
        // normal motion: the recap ends at the top, the page was seen moving, focus did not move
        await openSearch(tab, site, width, phone, false);
        await fill(tab, "Meridian", "Nurse"); const y0a = await searchByKey(tab);
        const w = await watchScroll(tab, 1800);
        if (w.recapTop === null) { bad.push(tag + "no recap after the search"); continue; }
        if (w.recapTop < -2 || w.recapTop > 40) bad.push(tag + "the recap is not at the top of the window (its top is at " + w.recapTop + ", the page is scrolled " + w.y + ")");
        if (Math.abs(w.y - y0a) < 100) bad.push(tag + "the page did not scroll after the search (from " + y0a + " to " + w.y + ")");
        if (w.moves < 4) bad.push(tag + "the scroll was a jump, not smooth (" + w.moves + " different positions seen)");
        if ((await tab.eval("document.activeElement && document.activeElement.id")) !== "searchBtn") bad.push(tag + "focus moved after the search (" + (await tab.eval("document.activeElement && document.activeElement.id")) + ")");
        // a search that is stopped by a message does not scroll
                await fill(tab, "", "Nurse"); const y0b = await searchByKey(tab); const f = await watchScroll(tab, 700);
        // (the browser itself brings the box that needs fixing into view, instantly; what must not happen is the smooth scroll to a recap)
        if (f.recapTop !== null || f.moves > 3) bad.push(tag + "a search stopped by a message scrolled the page smoothly or showed a recap (" + f.moves + " positions, recap " + f.recapTop + ")");
        // reduced motion: no scroll at all
        await openSearch(tab, site, width, phone, true);
        await fill(tab, "Meridian", "Nurse"); const y0c = await searchByKey(tab); const r = await watchScroll(tab, 1500);
        if (r.recapTop === null) bad.push(tag + "no recap after the search (reduced motion)");
        else if (r.y !== y0c) bad.push(tag + "the page scrolled although the person prefers reduced motion (from " + y0c + " to " + r.y + ")");
      }
      // a replayed search (the saved search after the sign-in link) does not scroll
      await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
      await tab.viewport(1280, false, 900); await tab.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
      await tab.eval("localStorage.setItem('fgj-pending-search', JSON.stringify({ v: { company: 'Meridian', q: 'Nurse', r: '' }, exp: Date.now() + 600000 }))");
      await tab.goto(site.url + "/_dev/link?kind=candidate");
      await tab.waitFor("location.pathname === '/search.html' && !!document.getElementById('recap') && !document.getElementById('recap').hidden", 12000);
      const p = await watchScroll(tab, 1500);
      if (p.recapTop === null) bad.push("replay: the saved search did not run and end with a recap");
      else if (p.y !== 0) bad.push("replay: the replayed search scrolled the page (to " + p.y + ")");
    } finally { await tab.send("Emulation.setEmulatedMedia", { features: [] }).catch(() => {}); await tab.close(); }
    return bad;
  },
};

async function withSite(root, fn) { const site = await startFakeSite(root); try { return await fn(site); } finally { await site.close(); } }

test("search scroll: the recap scrolls to the top after a successful search (smooth, no focus move), not on a failed or replayed search, not with reduced motion", { timeout: 600000 }, async () => {
  const problems = [];
  await withSite(ROOT, async (site) => { for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](site)) problems.push(n + ": " + p); });
  assert.deepEqual(problems, [], "search scroll problems:\n" + problems.join("\n"));
});

const DEFECTS = [
  ["the page never scrolls after a search", [["js/pages/search.js", (s) => s.replace('recapEl.scrollIntoView({ block: "start", behavior: "smooth" });', "void 0;")]]],
  ["the scroll is an instant jump", [["js/pages/search.js", (s) => s.replace('behavior: "smooth"', 'behavior: "instant"')]]],
  ["the page scrolls although the person prefers reduced motion", [["js/pages/search.js", (s) => s.replace('!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)', "true")]]],
  ["a replayed search scrolls too", [["js/pages/search.js", (s) => s.replace("if (!auto && !(window.matchMedia", "if (!(window.matchMedia")]]],
  ["focus moves to the recap", [["js/pages/search.js", (s) => s.replace('recapEl.scrollIntoView({ block: "start", behavior: "smooth" });', 'recapEl.scrollIntoView({ block: "start", behavior: "smooth" }); recapEl.setAttribute("tabindex", "-1"); recapEl.focus({ preventScroll: true });')]]],
  ["the page scrolls to the results' end instead of the recap", [["js/pages/search.js", (s) => s.replace('recapEl.scrollIntoView({ block: "start", behavior: "smooth" });', 'resultsEl.scrollIntoView({ block: "end", behavior: "smooth" });')]]],
  ["a search stopped by a message scrolls", [["js/pages/search.js", (s) => s.replace('  setFormError(""); hideRecap();', '  setFormError(""); hideRecap(); window.scrollTo({ top: 400, behavior: "smooth" });')]]],
];
test("negative controls: each defect in the post-search scroll makes a check fail", { timeout: 3000000 }, async () => {
  const missed = [];
  for (const [label, edits] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-ss-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = await withSite(dir, (site) => SCENARIOS.scroll(site));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 160) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
