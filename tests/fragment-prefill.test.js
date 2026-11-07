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
import { spawnSync } from "node:child_process";
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
  ["a company over 200 characters", "#c=" + L(201, "N") + "&t=Analyst"], ["a title over 80 characters", "#c=Northwind&t=" + L(81)], ["a req number over 100 characters", "#c=Northwind&r=" + L(101, "4")], ["an Opening ID over 14 characters", "#c=Northwind&p=" + L(15, "D")],
  ["the company twice", "#c=A&c=B&t=Analyst"], ["the title twice", "#c=Northwind&t=Analyst&t=Planner"],
  ["a req number together with a title", "#c=Northwind&r=4471&t=Analyst"], ["an Opening ID together with a title", "#c=Northwind&p=D21M-48YB-ZQBF&t=Analyst"], ["a req number together with an Opening ID", "#c=Northwind&r=4471&p=D21M-48YB-ZQBF"],
  ["a control character (line feed)", "#c=Northwind&t=Ana%0Alyst"], ["a control character (nul)", "#c=North%00wind&t=Analyst"], ["a bad percent escape", "#c=Northwind&t=%E0%A4%A"],
  ["no company", "#t=Analyst"], ["no second value", "#c=Northwind"], ["an empty company", "#c=&t=Analyst"],
  ["an oversized whole fragment (valid values, one very long unknown key)", "#c=Northwind&t=Analyst&zz=" + L(700, "y")], ["too many parts (valid values, twelve more unknown keys)", "#c=Northwind&t=Analyst" + "&u=1".repeat(12)],   // TEST1 (October 13, 2026): the twelve keys were "k" and, since BQ, k is the KIO ID key: a repeated k is refused as a key given twice, so this case no longer proved the part count limit (the control "the part count limit is gone" was not caught). Twelve unknown keys are ignored one by one, so only the part count can refuse the fragment, as before.
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
      if (s.q !== "D21M-48YB-ZQBF" || s.r !== "" || s.c !== "Meridian Health") bad.push("Opening ID: the boxes are wrong: " + JSON.stringify([s.c, s.q, s.r]));
      await sleep(1200);
      if (searches(site).length !== 0) bad.push("Opening ID: a search ran by itself");
      await tab.eval("document.getElementById('searchForm').requestSubmit()"); await sleep(1500);
      if (searches(site).length !== 1 || !searches(site)[0].body.code) bad.push("Opening ID: Search did not send an Opening ID lookup (" + JSON.stringify(searches(site).map((c) => c.body)) + ")");
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
  // prompt IA (November 1, 2026): the key o. A classic address with o=m (the phone entry) sends origin "mobile" and no origin_host, o=e sends the extension with its cleaned host, anything else is the site; the search still starts only when the person presses Search
  async originSent(root) {
    const site = await startFakeSite(root), bad = [], tab = await browser.newTab();
    const base = "#c=" + enc("Meridian Health") + "&t=" + enc("Senior Data Analyst");
    const CASES = [
      ["o=m", base + "&o=m", { origin: "mobile" }], ["o=m with a host", base + "&o=m&h=" + enc("jobs.example.invalid"), { origin: "mobile" }], ["o=m first, then o=e", base + "&o=m&o=e&h=" + enc("jobs.example.invalid"), { origin: "mobile" }],
      ["o=e with a host", base + "&o=e&h=" + enc("https://www.Jobs.Example.invalid/x?y"), { origin: "extension", origin_host: "jobs.example.invalid" }], ["o=e with no host", base + "&o=e", { origin: "extension" }],
      ["no o", base, { origin: "site" }], ["o=x", base + "&o=x", { origin: "site" }], ["an empty o", base + "&o=", { origin: "site" }], ["o=M (capital)", base + "&o=M&h=" + enc("jobs.example.invalid"), { origin: "site" }],
    ];
    try {
      await tab.focusEmulation(true); await become(tab, site, "candidate");
      for (const [label, hash, want] of CASES) {
        site.calls.length = 0;
        await open(tab, site, hash);
        const s = await state(tab);
        if (s.c !== "Meridian Health" || s.q !== "Senior Data Analyst" || s.r !== "") bad.push(label + ": the boxes are not company / title only: " + JSON.stringify([s.c, s.q, s.r]));
        if (s.hash !== "" || /#/.test(s.href)) bad.push(label + ": the fragment is still in the address bar: " + s.href);
        await sleep(800);
        if (searches(site).length !== 0) bad.push(label + ": a search ran by itself");
        await tab.eval("document.getElementById('searchForm').requestSubmit()");
        if (!(await tab.waitFor("document.querySelectorAll('#results .card').length > 0", 8000))) bad.push(label + ": pressing Search did not show results");
        const sent = searches(site);
        if (sent.length !== 1) { bad.push(label + ": pressing Search ran " + sent.length + " searches"); continue; }
        const b = sent[0].body;
        if (b.origin !== want.origin || b.origin_host !== want.origin_host || ("origin_host" in b) !== ("origin_host" in want)) bad.push(label + ": the search carried origin " + JSON.stringify([b.origin, b.origin_host]) + ", wanted " + JSON.stringify([want.origin, want.origin_host]));
        if (b.company !== "Meridian Health" || b.phrase !== "Senior Data Analyst") bad.push(label + ": the search words changed: " + JSON.stringify(b));
        if (Object.keys(b).some((k) => !["company", "phrase", "origin", "origin_host"].includes(k))) bad.push(label + ": the search carried more than company, phrase and the origin: " + Object.keys(b).join(","));
      }
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  // the search saved while a signed out person waits for the emailed link carries the origin, and the search that runs by itself afterwards is sent with it (the link may open in a new tab, which has forgotten everything but the saved search)
  async originHandoff(root) {
    const bad = [];
    const base = "#c=" + enc("Meridian Health") + "&t=" + enc("Senior Data Analyst");
    const comeBack = async (tab, site) => {   // the person opens the emailed link: a session appears, then the search page starts and runs the saved search by itself
      await tab.goto(site.url + "/_dev/link?kind=candidate"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
      await tab.goto(site.url + "/search.html"); await tab.waitFor("document.readyState === 'complete' && !!document.getElementById('company')", 15000);
      await tab.waitFor("document.querySelectorAll('#results .card').length > 0", 8000); await sleep(500);
    };
    const CASES = [
      ["mobile", base + "&o=m", { origin: "mobile", host: null }, { origin: "mobile" }], ["mobile with a host", base + "&o=m&h=" + enc("jobs.example.invalid"), { origin: "mobile", host: null }, { origin: "mobile" }],
      ["extension with its host", base + "&o=e&h=" + enc("https://www.Jobs.Example.invalid/x"), { origin: "extension", host: "jobs.example.invalid" }, { origin: "extension", origin_host: "jobs.example.invalid" }],
      ["extension with no host", base + "&o=e", { origin: "extension", host: null }, { origin: "extension" }], ["no origin (the site)", base, { origin: "site", host: null }, { origin: "site" }],
    ];
    for (const [label, hash, savedWant, sentWant] of CASES) {
      const site = await startFakeSite(root), tab = await browser.newTab();
      try {
        await tab.focusEmulation(true); await become(tab, site, "out");
        await open(tab, site, hash);
        await tab.eval("document.getElementById('searchForm').requestSubmit()"); await sleep(700);
        const kept = JSON.parse((await state(tab)).pending || "null");
        if (!kept) { bad.push(label + ": nothing was saved"); continue; }
        if (Object.keys(kept.v).sort().join(",") !== "company,host,origin,q,r") bad.push(label + ": the saved search holds " + Object.keys(kept.v).sort().join(",") + " (exactly company, host, origin, q, r are allowed)");
        if (kept.v.origin !== savedWant.origin || kept.v.host !== savedWant.host) bad.push(label + ": the saved origin is " + JSON.stringify([kept.v.origin, kept.v.host]));
        if (kept.exp - Date.now() > 3600000 + 5000 || kept.exp - Date.now() < 3600000 - 60000) bad.push(label + ": the saved search is not kept for one hour (" + (kept.exp - Date.now()) + " ms left)");
        if (searches(site).length !== 0) bad.push(label + ": a search ran while signed out");
        await comeBack(tab, site);
        const sent = searches(site);
        if (sent.length !== 1) { bad.push(label + ": after the link the saved search ran " + sent.length + " times"); continue; }
        const b = sent[0].body;
        if (b.origin !== sentWant.origin || b.origin_host !== sentWant.origin_host || ("origin_host" in b) !== ("origin_host" in sentWant)) bad.push(label + ": the search that ran by itself carried origin " + JSON.stringify([b.origin, b.origin_host]) + ", wanted " + JSON.stringify([sentWant.origin, sentWant.origin_host]));
        if (b.company !== "Meridian Health" || b.phrase !== "Senior Data Analyst") bad.push(label + ": the search words changed: " + JSON.stringify(b));
        if ((await state(tab)).pending !== null) bad.push(label + ": the saved search was not removed after it ran");
      } finally { await tab.close(); await site.close(); }
    }
    // a saved search from before this change (no origin), a damaged one (unknown word, a host that is not text), a mobile one that carries a host: each runs once, and is sent as the site or as mobile without a host; never an error
    const SAVED = [
      ["saved before this change (no origin)", { company: "Meridian Health", q: "Senior Data Analyst", r: "" }, { origin: "site" }],
      ["an unknown origin word", { company: "Meridian Health", q: "Senior Data Analyst", r: "", origin: "phone", host: "x.example.invalid" }, { origin: "site" }],
      ["a capital letter", { company: "Meridian Health", q: "Senior Data Analyst", r: "", origin: "Mobile", host: null }, { origin: "site" }],
      ["an extension host that is not text", { company: "Meridian Health", q: "Senior Data Analyst", r: "", origin: "extension", host: 12345 }, { origin: "extension" }],
      ["a mobile search saved with a host", { company: "Meridian Health", q: "Senior Data Analyst", r: "", origin: "mobile", host: "x.example.invalid" }, { origin: "mobile" }],
    ];
    for (const [label, v, sentWant] of SAVED) {
      const site = await startFakeSite(root), tab = await browser.newTab();
      try {
        await tab.focusEmulation(true); await become(tab, site, "out");
        await tab.eval("localStorage.setItem('fgj-pending-search', JSON.stringify({ v: " + JSON.stringify(v) + ", exp: Date.now() + 3600000 }))");
        await comeBack(tab, site);
        const sent = searches(site);
        if (sent.length !== 1) { bad.push(label + ": the saved search ran " + sent.length + " times"); continue; }
        const b = sent[0].body;
        if (b.origin !== sentWant.origin || ("origin_host" in b) !== ("origin_host" in sentWant)) bad.push(label + ": the search carried " + JSON.stringify([b.origin, b.origin_host]) + ", wanted " + JSON.stringify(sentWant));
        if (await tab.eval("!document.getElementById('formError').hidden")) bad.push(label + ": the person was shown an error");
      } finally { await tab.close(); await site.close(); }
    }
    return bad;
  },
  // the pure parts, in the copy under test (so a defect made in a copy of the code is seen by the unit tests as well)
  async unitFragment(root) { return runUnit(root, "fragment-prefill.unit.test.js"); },
  async unitHandoff(root) { return runUnit(root, "signin-handoff.test.js"); },
};
function runUnit(root, file) {
  const env = Object.assign({}, process.env); delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ["--test", path.join(root, "tests", file)], { cwd: root, env, encoding: "utf8", timeout: 300000 });
  if (r.status === 0) return [];
  const first = (r.stdout.match(/^\s*(?:✖|not ok \d+ -) (.+?)(?: \(\d[\d.]*ms\))?$/m) || [])[1];
  return [file + " fails: " + (first || String(r.stderr || r.stdout).slice(0, 120)).slice(0, 160)];
}
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
  ["the page never reads the fragment", ["signedOutReq"], SP, (s) => s.replace("if (applyFragmentPrefill({ win: window, companyEl: companyIn, queryEl: queryIn, reqEl: reqIn, onKio: (k) => { heldKio = k.title || k.bad ? { stored: k.stored, title: k.title, shown: k.shown, bad: k.bad === true } : null; }, onOrigin: (o) => { heldOrigin = o || null; } })) takePending(localStorage);", "")],   // prompt HM: the call also has the held bad key and onOrigin   // TEST1 (October 13, 2026): the call has an onKio option since BQ (the held title words); the defect is the same: the page never reads the fragment
  ["a saved search is not dropped", ["savedSearchDropped"], SP, (s) => s.replace("onOrigin: (o) => { heldOrigin = o || null; } })) takePending(localStorage);", "onOrigin: (o) => { heldOrigin = o || null; } })) { /* kept */ }")],   // prompt HM: the anchor is the new end of the call   // TEST1 (October 13, 2026): same reason as the control above (the onKio option); the defect is the same: the saved search is kept
  ["the title limit is gone", ["hostile"], FP, (s) => s.replace("title: 80, kio: 24 }", "title: 80000, kio: 24 }")],   // TEST1 (October 13, 2026): the table has a kio limit since BQ; the defect is the same: the title limit is gone
  ["the total length limit is gone", ["hostile"], FP, (s) => s.replace("MAX_TOTAL = 700", "MAX_TOTAL = 700000")],
  ["the part count limit is gone", ["hostile"], FP, (s) => s.replace("MAX_PARTS = 12", "MAX_PARTS = 12000")],
  ["a repeated key is accepted (the first one wins)", ["hostile"], FP, (s) => s.replace("if (found.has(key)) { bad = true; continue; }", "if (found.has(key)) { continue; }")],
  ["more than one second value is accepted", ["hostile"], FP, (s) => s.replace("seconds.length !== 1", "seconds.length < 1")],
  ["a control character is accepted", ["hostile"], FP, (s) => s.replace("if (hasControl(value)) { bad = true; continue; }", "")],
  ["a bad percent escape is accepted as it is", ["hostile"], FP, (s) => s.replace("try { value = decodeURIComponent(piece.slice(eq + 1)); } catch { bad = true; continue; }", "try { value = decodeURIComponent(piece.slice(eq + 1)); } catch { value = piece.slice(eq + 1); }")],
  ["unknown keys make the fragment ours", ["hostile"], FP, (s) => s.replace("if (!Object.prototype.hasOwnProperty.call(FRAGMENT_KEYS, key)) continue;   // an unknown key (or \"__proto__\") is ignored", "")],
  ["the fragment text is put into the page as markup", ["hostile"], FP, (s) => s.replace("companyEl.value = result.company;", "companyEl.value = result.company; companyEl.insertAdjacentHTML(\"afterend\", result.company);")],
  ["the req number goes into the Opening ID/title box", ["signedOutReq"], FP, (s) => s.replace("if (result.kind === \"req\") reqEl.value = result.value; else queryEl.value = result.value;", "queryEl.value = result.value;")],
  ["the company is not filled", ["signedOutReq", "signedInTitleAndPostid"], FP, (s) => s.replace("companyEl.value = result.company;", "")],
  // prompt IA (November 1, 2026): the origin mobile and the origin in the saved search
  ["IA: o=m is ignored (a phone search is counted as the site)", ["unitFragment", "originSent"], FP, (s) => s.replace('oSent === "e" || oSent === "m" ? originOf(', 'oSent === "e" ? originOf(')],
  ["IA: a mobile search keeps the host that came with it", ["unitFragment", "originSent"], "js/search-origin.js", (s) => s.replace('if (o === "m") return { origin: "mobile", host: null };', 'if (o === "m") return { origin: "mobile", host: h == null ? null : cleanHost(h) };')],
  ["IA: a mobile origin read from the saved search keeps a host", ["unitFragment", "originHandoff"], "js/search-origin.js", (s) => s.replace('if (o.origin === "mobile") return { origin: "mobile" };', 'if (o.origin === "mobile") { const host = typeof o.host === "string" ? cleanHost(o.host) : null; return host ? { origin: "mobile", origin_host: host } : { origin: "mobile" }; }')],
  ["IA: any o value is taken as an origin", ["unitFragment"], FP, (s) => s.replace('oSent === "e" || oSent === "m" ? originOf(', 'oSent !== undefined ? originOf(')],
  ["IA: the saved search loses the origin (the page does not hand it over)", ["originHandoff"], SP, (s) => s.replace('r: reqIn.value, source: sourceIn.value, origin: heldOrigin ? heldOrigin.origin : "site", host: heldOrigin ? heldOrigin.host : null });', 'r: reqIn.value, source: sourceIn.value });')],
  ["IA: the search that runs by itself after the link ignores the saved origin", ["originHandoff"], SP, (s) => s.replace('heldOrigin = p.origin === "site" ? null : { origin: p.origin, host: p.host };', "")],
  ["IA: the saved search is written without the origin", ["unitHandoff", "originHandoff"], "js/signin-handoff.js", (s) => s.replace('r: p.r === undefined ? "" : p.r, ...originOfSaved(p.origin, p.host), ...sourceOfSaved(p.source) }, now);', 'r: p.r === undefined ? "" : p.r }, now);')],
  ["IA: the saved search keeps the KIO title words", ["unitHandoff"], "js/signin-handoff.js", (s) => s.replace('r: p.r === undefined ? "" : p.r, ...originOfSaved(p.origin, p.host), ...sourceOfSaved(p.source) }, now);', 'r: p.r === undefined ? "" : p.r, title: p.title, ...originOfSaved(p.origin, p.host), ...sourceOfSaved(p.source) }, now);')],
  ["IA: the saved origin is not checked again when it is read back", ["unitHandoff", "originHandoff"], "js/signin-handoff.js", (s) => s.replace("{ company: v.company, q: v.q, r: v.r, ...originOfSaved(v.origin, v.host), ...sourceOfSaved(v.source) }", "{ company: v.company, q: v.q, r: v.r, origin: v.origin, host: v.host }")],
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
