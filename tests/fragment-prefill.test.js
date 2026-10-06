// fragment-prefill.test.js - the search page opened with the company and ONE other value in the URL fragment (October 6, 2026; the browser extension does this). Real headless Chrome, the repo's own files,
// a fake backend (tests/fake-site.js; no real project, no key). Proven here, signed out AND signed in:
//   1. the boxes are filled (the req number into the req box, which stays hidden; a postID or a title into the postID/title box), the fragment is gone from the address bar, and NO search runs by itself;
//   2. signed out, the person presses Search and meets the same email step as always (the saved search holds what was filled in; the sign-in request carries only the address); signed in, pressing Search runs the search once;
//   3. a search saved before a sign-in link is dropped, so it can not run over what was filled in;
//   4. hostile fragments (too long, a key twice, req number together with a title or postID, a control character, a bad escape, no company) fill NOTHING and are still removed from the address bar; unknown keys are ignored;
//      HTML or script text is only ever text in a box: no element is created and nothing runs; a fragment that is not ours is left exactly as it is.
// Then negative controls: one deliberate defect at a time, each must make a scenario fail. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/fragment-prefill.test.js
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
const enc = encodeURIComponent;
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

async function become(tab, site, who) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  if (who === "out") return;
  await tab.goto(site.url + "/_dev/link?kind=" + who); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
// a fragment-only change of the address is NOT a new page load, so go through another page first: every visit is a fresh load of search.html, as a link from another site would be
const open = async (tab, site, hash) => { await tab.goto(site.url + "/404.html"); await tab.goto(site.url + "/search.html" + hash); await tab.waitFor("document.readyState === 'complete' && !!document.getElementById('company')", 15000); await sleep(700); };
const state = (tab) => tab.eval(`({ c: document.getElementById('company').value, q: document.getElementById('titleq').value, r: document.getElementById('reqq').value, rType: document.getElementById('reqq').type, hash: location.hash, href: location.href, xss: window.__xss === undefined ? null : window.__xss, imgs: document.querySelectorAll('img[src="x"], svg[onload], script:not([src])').length, pending: localStorage.getItem('fgj-pending-search') })`);
const searches = (site) => site.calls.filter((c) => c.name === "candidate-search");

// fragments that must fill nothing (each is still removed from the address bar)
const L = (n, ch = "x") => ch.repeat(n);
const REFUSED = [
  ["a company over 200 characters", "#c=" + L(201, "N") + "&t=Analyst"], ["a title over 80 characters", "#c=Northwind&t=" + L(81)], ["a req number over 100 characters", "#c=Northwind&r=" + L(101, "4")], ["a postID over 14 characters", "#c=Northwind&p=" + L(15, "D")],
  ["the company twice", "#c=A&c=B&t=Analyst"], ["the title twice", "#c=Northwind&t=Analyst&t=Planner"],
  ["a req number together with a title", "#c=Northwind&r=4471&t=Analyst"], ["a postID together with a title", "#c=Northwind&p=D21M-48YB-ZQBF&t=Analyst"], ["a req number together with a postID", "#c=Northwind&r=4471&p=D21M-48YB-ZQBF"],
  ["a control character (line feed)", "#c=Northwind&t=Ana%0Alyst"], ["a control character (nul)", "#c=North%00wind&t=Analyst"], ["a bad percent escape", "#c=Northwind&t=%E0%A4%A"],
  ["no company", "#t=Analyst"], ["no second value", "#c=Northwind"], ["an empty company", "#c=&t=Analyst"],
  ["an oversized whole fragment (valid values, one very long unknown key)", "#c=Northwind&t=Analyst&zz=" + L(700, "y")], ["too many parts (valid values, twelve more keys)", "#c=Northwind&t=Analyst" + "&k=1".repeat(12)],
];

const SCENARIOS = {
  async signedOutReq(root) {
    const site = await startFakeSite(root), bad = [], tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await become(tab, site, "out");
      await open(tab, site, "#c=" + enc("Northwind Analytics") + "&r=" + enc("R-2026-0451"));
      const s = await state(tab);
      if (s.c !== "Northwind Analytics" || s.r !== "R-2026-0451" || s.q !== "") bad.push("the boxes are not company / req number only: " + JSON.stringify([s.c, s.q, s.r]));
      if (s.rType !== "password") bad.push("the req number box is not hidden any more (type " + s.rType + ")");
      if (s.hash !== "" || /#/.test(s.href)) bad.push("the fragment is still in the address bar: " + s.href);
      await sleep(1200);
      if (searches(site).length !== 0) bad.push("a search ran by itself");
      if (site.calls.some((c) => c.name === "auth-otp")) bad.push("a sign-in email was requested by itself");
      // the person presses Search: the same email step as always, with what was filled in saved for an hour
      await tab.eval("document.getElementById('searchForm').requestSubmit()"); await sleep(600);
      if (!(await tab.eval("!document.getElementById('signinWrap').hidden"))) bad.push("pressing Search signed out does not show the email step");
      const kept = JSON.parse((await state(tab)).pending || "null");
      if (!kept || kept.v.company !== "Northwind Analytics" || kept.v.r !== "R-2026-0451" || kept.v.q !== "") bad.push("the saved search is not what was filled in: " + JSON.stringify(kept));
      await tab.eval("(() => { document.getElementById('candEmail').value = 'reader@example.test'; document.getElementById('signinForm').requestSubmit(); })()"); await sleep(800);
      const otp = site.calls.filter((c) => c.name === "auth-otp");
      if (otp.length !== 1) bad.push("the sign-in request was made " + otp.length + " times");
      else if (/Northwind|4510|R-2026|0451/i.test(otp[0].address + JSON.stringify(otp[0].body))) bad.push("the filled-in values went into the sign-in request");
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async signedInTitleAndPostid(root) {
    const site = await startFakeSite(root), bad = [], tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await become(tab, site, "candidate");
      await open(tab, site, "#c=" + enc("Meridian Health") + "&t=" + enc("Senior Data Analyst"));
      let s = await state(tab);
      if (s.c !== "Meridian Health" || s.q !== "Senior Data Analyst" || s.r !== "") bad.push("title: the boxes are not company / title only: " + JSON.stringify([s.c, s.q, s.r]));
      if (s.hash !== "" || /#/.test(s.href)) bad.push("title: the fragment is still in the address bar");
      await sleep(1500);
      if (searches(site).length !== 0) bad.push("signed in, a search ran by itself");
      await tab.eval("document.getElementById('searchForm').requestSubmit()");
      if (!(await tab.waitFor("document.querySelectorAll('#results .card').length > 0", 8000))) bad.push("pressing Search did not show results");
      if (searches(site).length !== 1) bad.push("pressing Search ran " + searches(site).length + " searches");
      else if (searches(site)[0].body.phrase !== "Senior Data Analyst" || searches(site)[0].body.company !== "Meridian Health") bad.push("the search carried: " + JSON.stringify(searches(site)[0].body));
      site.calls.length = 0;
      await open(tab, site, "#c=" + enc("Meridian Health") + "&p=" + enc("D21M-48YB-ZQBF"));
      s = await state(tab);
      if (s.q !== "D21M-48YB-ZQBF" || s.r !== "" || s.c !== "Meridian Health") bad.push("postID: the boxes are wrong: " + JSON.stringify([s.c, s.q, s.r]));
      await sleep(1200);
      if (searches(site).length !== 0) bad.push("postID: a search ran by itself");
      await tab.eval("document.getElementById('searchForm').requestSubmit()"); await sleep(1500);
      if (searches(site).length !== 1 || !searches(site)[0].body.code) bad.push("postID: Search did not send a postID lookup (" + JSON.stringify(searches(site).map((c) => c.body)) + ")");
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async savedSearchDropped(root) {
    const site = await startFakeSite(root), bad = [], tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await become(tab, site, "candidate");
      await tab.eval("localStorage.setItem('fgj-pending-search', JSON.stringify({ v: { company: 'Other Company', q: 'Other Title', r: '' }, exp: Date.now() + 3600000 }))");
      await open(tab, site, "#c=" + enc("Northwind Analytics") + "&t=" + enc("Senior Data Analyst"));
      await sleep(1500);
      const s = await state(tab);
      if (s.c !== "Northwind Analytics" || s.q !== "Senior Data Analyst") bad.push("an older saved search overwrote what was filled in: " + JSON.stringify([s.c, s.q]));
      if (searches(site).length !== 0) bad.push("the older saved search ran");
      if (s.pending !== null) bad.push("the older saved search was not dropped");
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async hostile(root) {
    const bad = [];
    for (const who of ["out", "candidate"]) {
      const site = await startFakeSite(root), tab = await browser.newTab();
      try {
        await tab.focusEmulation(true); await become(tab, site, who);
        for (const [label, hash] of REFUSED) {
          await open(tab, site, hash); const s = await state(tab);
          if (s.c !== "" || s.q !== "" || s.r !== "") bad.push(who + ", " + label + ": filled " + JSON.stringify([s.c.slice(0, 20), s.q.slice(0, 20), s.r.slice(0, 20)]));
          if (s.hash !== "" || /#/.test(s.href)) bad.push(who + ", " + label + ": the refused fragment is still in the address bar");
        }
        if (searches(site).length !== 0) bad.push(who + ": a search ran for a refused fragment");
        // unknown keys are ignored, the known ones are used
        await open(tab, site, "#c=Northwind&t=Analyst&zz=" + enc("<b>ZZ</b>") + "&utm_source=mail"); let s = await state(tab);
        if (s.c !== "Northwind" || s.q !== "Analyst" || /ZZ|mail/.test(s.c + s.q + s.r)) bad.push(who + ": unknown keys are not ignored: " + JSON.stringify([s.c, s.q, s.r]));
        if (s.hash !== "") bad.push(who + ": the fragment with unknown keys stays in the address bar");
        // markup and script text is only ever text
        const evil = "<img src=x onerror=\"window.__xss=1\"><script>window.__xss=2</script><svg onload=\"window.__xss=3\">";
        await open(tab, site, "#c=" + enc(evil) + "&t=" + enc("\"><img src=x onerror=window.__xss=4>")); s = await state(tab);
        if (s.c !== evil || s.q !== "\"><img src=x onerror=window.__xss=4>") bad.push(who + ": markup text did not come back as the same text in the boxes: " + JSON.stringify([s.c.slice(0, 30), s.q.slice(0, 30)]));
        if (s.imgs !== 0 || s.xss !== null) bad.push(who + ": markup in the fragment created an element or ran script (elements " + s.imgs + ", xss " + s.xss + ")");
        // a fragment that is not ours is left exactly as it is
        for (const h of ["#top", "#zz=1&yy=2", "#results"]) { await open(tab, site, h); const t = await state(tab); if (t.hash !== h) bad.push(who + ": a fragment that is not ours (" + h + ") was changed to '" + t.hash + "'"); if (t.c !== "" || t.q !== "" || t.r !== "") bad.push(who + ": a fragment that is not ours filled a box"); }
        await open(tab, site, ""); s = await state(tab);
        if (s.c !== "" || s.q !== "" || s.r !== "") bad.push(who + ": a plain visit fills a box");
      } finally { await tab.close(); await site.close(); }
    }
    return bad;
  },
};
const ALL = Object.keys(SCENARIOS);

test("the search page opened with a fragment: filled, no automatic search, signed out and signed in, hostile input refused", { timeout: 600000 }, async () => {
  const problems = [];
  for (const name of ALL) for (const p of await SCENARIOS[name](ROOT)) problems.push(name + ": " + p);
  assert.deepEqual(problems, [], "fragment problems:\n" + problems.join("\n"));
});

// ---- negative controls ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const FP = "js/fragment-prefill.js", SP = "js/pages/search.js";
const DEFECTS = [
  ["the fragment is left in the address bar", ["signedOutReq"], FP, (s) => s.replace("try { win.history.replaceState(win.history.state, \"\", win.location.pathname + win.location.search); } catch { /* the address bar keeps the fragment; the boxes are still filled below */ }", "")],
  ["a refused fragment is left in the address bar (removed only when valid)", ["hostile"], FP, (s) => s.replace("  try { win.history.replaceState(win.history.state, \"\", win.location.pathname + win.location.search); } catch { /* the address bar keeps the fragment; the boxes are still filled below */ }\n  if (!result) return false;", "  if (!result) return false;\n  try { win.history.replaceState(win.history.state, \"\", win.location.pathname + win.location.search); } catch { /* the address bar keeps the fragment; the boxes are still filled below */ }")],
  ["the search runs by itself", ["signedOutReq", "signedInTitleAndPostid"], SP, (s) => s.replace("takePending(localStorage);\n", "{ takePending(localStorage); runSearch(); }\n")],
  ["the page never reads the fragment", ["signedOutReq"], SP, (s) => s.replace("if (applyFragmentPrefill({ win: window, companyEl: companyIn, queryEl: queryIn, reqEl: reqIn })) takePending(localStorage);", "")],
  ["a saved search is not dropped", ["savedSearchDropped"], SP, (s) => s.replace("reqEl: reqIn })) takePending(localStorage);", "reqEl: reqIn })) { /* kept */ }")],
  ["the title limit is gone", ["hostile"], FP, (s) => s.replace("title: 80 }", "title: 80000 }")],
  ["the total length limit is gone", ["hostile"], FP, (s) => s.replace("MAX_TOTAL = 700", "MAX_TOTAL = 700000")],
  ["the part count limit is gone", ["hostile"], FP, (s) => s.replace("MAX_PARTS = 12", "MAX_PARTS = 12000")],
  ["a repeated key is accepted (the first one wins)", ["hostile"], FP, (s) => s.replace("if (found.has(key)) { bad = true; continue; }", "if (found.has(key)) { continue; }")],
  ["more than one second value is accepted", ["hostile"], FP, (s) => s.replace("seconds.length !== 1", "seconds.length < 1")],
  ["a control character is accepted", ["hostile"], FP, (s) => s.replace("if (hasControl(value)) { bad = true; continue; }", "")],
  ["a bad percent escape is accepted as it is", ["hostile"], FP, (s) => s.replace("try { value = decodeURIComponent(piece.slice(eq + 1)); } catch { bad = true; continue; }", "try { value = decodeURIComponent(piece.slice(eq + 1)); } catch { value = piece.slice(eq + 1); }")],
  ["unknown keys make the fragment ours", ["hostile"], FP, (s) => s.replace("if (!Object.prototype.hasOwnProperty.call(FRAGMENT_KEYS, key)) continue;   // an unknown key (or \"__proto__\") is ignored", "")],
  ["the fragment text is put into the page as markup", ["hostile"], FP, (s) => s.replace("companyEl.value = result.company;", "companyEl.value = result.company; companyEl.insertAdjacentHTML(\"afterend\", result.company);")],
  ["the req number goes into the postID/title box", ["signedOutReq"], FP, (s) => s.replace("if (result.kind === \"req\") reqEl.value = result.value; else queryEl.value = result.value;", "queryEl.value = result.value;")],
  ["the company is not filled", ["signedOutReq", "signedInTitleAndPostid"], FP, (s) => s.replace("companyEl.value = result.company;", "")],
];
test("negative controls: each deliberate defect in the fragment handling makes a scenario fail", { timeout: 3000000 }, async () => {
  const missed = [];
  for (const [label, scenarios, rel, mutate] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-frag-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      const p = path.join(dir, rel), before = fs.readFileSync(p, "utf8"), after = mutate(before);
      assert.notEqual(after, before, "the defect '" + label + "' changed nothing in " + rel);
      fs.writeFileSync(p, after);
      const found = [];
      for (const name of scenarios) found.push(...(await SCENARIOS[name](dir)).map((x) => name + ": " + x));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 170) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
