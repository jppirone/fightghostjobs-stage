// privacy-notice.test.js (prompt FK, October 29, 2026) - the one sentence under the search results: "We keep a record of your search, including the words you typed, so we can count what people look for. Employers never see who
// searched. Details are in our Privacy Policy." with a link on the words Privacy Policy to the marketing privacy page. Run: node --test tests/privacy-notice.test.js
//   PART 1 (no browser): the page file and the script hold exactly the approved sentence and link, hidden at the start, tied to the recap, on no other page, nothing added that stores, sends or loads anything. Then breakages, each made on a
//          copy held in memory, must be caught, and a plant at nothing must not be flagged.
//   PART 2 (a real browser on the repo's own files with the fake backend tests/fake-site.js; no real project, no key): at 360, 768, 1093 and 1440 px the notice is hidden before any search and after a refused search, shown after a search that
//          found openings and after one that found none, sits under the results, links to the privacy page in the same tab; no cookie, no storage key and no backend request is added; nothing above the notice moves; what is below it
//          moves down by exactly its own height. With FGJ_BASE_ROOT set to a copy of the page BEFORE the change, the same measurements are taken on that copy and compared.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite } from "./fake-site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_ROOT = process.env.FGJ_BASE_ROOT || "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rd = (p, root = ROOT) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");
const NOTICE_TEXT = "We keep a record of your search, including the words you typed, so we can count what people look for. Employers never see who searched. Details are in our Privacy Policy.";
const LINK = "https://www.fightghostjobs.com/privacy.html";
const DASH = new RegExp(String.fromCharCode(8212) + "|" + String.fromCharCode(8211));
const strip = (h) => h.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");

// ---------------------------------------------------------------- PART 1: the files
function staticFindings(html, js, otherPages) {
  const bad = [];
  const els = [...html.matchAll(/<p\b[^>]*\bid="searchNotice"[^>]*>([\s\S]*?)<\/p>/g)];
  if (els.length !== 1) { bad.push("the page has " + els.length + " searchNotice paragraph(s), not one"); return bad; }
  const tag = els[0][0].match(/^<p\b[^>]*>/)[0], inner = els[0][1];
  if (strip(inner).trim() !== NOTICE_TEXT) bad.push("the notice text is not the approved sentence: " + strip(inner).trim().slice(0, 60));
  if (!/\bhidden\b/.test(tag)) bad.push("the notice is not hidden at the start (it must show only once a search has run)");
  if (!/\bclass="field-hint"/.test(tag)) bad.push("the notice does not use the app's own small secondary text class (field-hint)");
  if (/\bstyle=/.test(tag)) bad.push("the notice has its own style (no new colour or size is allowed)");
  const links = [...inner.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
  if (links.length !== 1) bad.push("the notice holds " + links.length + " link(s), not one");
  else {
    const [, attrs, text] = links[0];
    if (text !== "Privacy Policy") bad.push("the link is not on the words Privacy Policy: " + text);
    if (!new RegExp('href="' + LINK.replace(/[.\/]/g, "\\$&") + '"').test(attrs)) bad.push("the link does not go to " + LINK + ": " + attrs);
    if (/\btarget=|\bonclick=|\bstyle=|\bclass=/.test(attrs)) bad.push("the link opens another tab or carries script or style: " + attrs);
  }
  if (DASH.test(els[0][0])) bad.push("the notice holds an em dash or an en dash");
  const iRes = html.indexOf('id="results"'), iNote = html.indexOf('id="searchNotice"');
  if (!(iRes > 0 && iNote > iRes && !html.slice(iRes, iNote).includes("</div>\n  </div>"))) bad.push("the notice is not right under the results area, inside the same column");
  if (html.slice(iRes, iNote).split("<").length > 4) bad.push("something else sits between the results and the notice");
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].length;
  if (scripts !== 2) bad.push("search.html has " + scripts + " script tags (two are expected: stage-gate.js and search.js)");
  // the script: shown with the recap, hidden when the recap is
  const nn = (js.match(/const noticeEl = \$\("#searchNotice"\);/g) || []).length;
  if (nn !== 1) bad.push("search.js does not look up the notice exactly once");
  if (!/function hideRecap\(\) \{[^}]*noticeEl\.hidden = true;[^}]*\}/.test(js)) bad.push("hideRecap does not hide the notice");
  if (!/recapEl\.hidden = false; noticeEl\.hidden = staffMode;/.test(js)) bad.push("showRecap does not show the notice together with the recap for a candidate and keep it hidden in the staff view (it must read staffMode, the page's own flag)");
  if ((js.match(/noticeEl\./g) || []).length !== 2) bad.push("the notice is touched in more than the two places (show with the recap, hide with the recap)");
  if ((js.match(/searchNotice/g) || []).length !== 1) bad.push("search.js reaches the notice in more than the one lookup (a second route to the element)");  for (const line of js.split("\n").filter((l) => /noticeEl|searchNotice/.test(l))) if (/fetch|localStorage|sessionStorage|document\.cookie|XMLHttp|sendBeacon|window\.open|\.href\s*=/.test(line)) bad.push("a notice line stores, sends or opens something: " + line.trim().slice(0, 60));
  // no other page carries it
  for (const [name, text] of Object.entries(otherPages)) if (/searchNotice|We keep a record of your search/.test(text)) bad.push(name + " carries the notice, but shows no search");
  return bad;
}
const others = () => Object.fromEntries(fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && f !== "search.html").map((f) => [f, rd(f)]));

test("PART 1: the page and the script hold exactly the approved notice, and nothing else is added", () => {
  const bad = staticFindings(rd("search.html"), rd("js/pages/search.js"), others());
  assert.deepEqual(bad, []);
});

test("PART 1: breakages are caught, a plant at nothing is not", () => {
  const html = rd("search.html"), js = rd("js/pages/search.js"), oth = others();
  const sw = (t, a, b) => { if (t.split(a).length !== 2) throw new Error("anchor not found once: " + a.slice(0, 50)); return t.replace(a, () => b); };
  const BREAK = [
    ["the link is broken (another address)", () => [sw(html, 'href="' + LINK + '">Privacy Policy', 'href="https://www.fightghostjobs.com/privacy">Privacy Policy'), js, oth]],
    ["the link is on other words", () => [sw(html, ">Privacy Policy</a>", ">Privacy</a>"), js, oth]],
    ["the link opens a new tab", () => [sw(html, 'href="' + LINK + '">Privacy Policy', 'href="' + LINK + '" target="_blank">Privacy Policy'), js, oth]],
    ["the notice text is changed", () => [sw(html, "Employers never see who searched.", "Employers see who searched."), js, oth]],
    ["the notice text loses a sentence", () => [sw(html, " Employers never see who searched.", ""), js, oth]],
    ["an em dash is added", () => [sw(html, "so we can count", "so we can count " + String.fromCharCode(8212)), js, oth]],
    ["the notice is shown before any search (hidden is gone)", () => [sw(html, '<p id="searchNotice" class="field-hint" hidden>', '<p id="searchNotice" class="field-hint">'), js, oth]],
    ["the notice gets its own colour", () => [sw(html, '<p id="searchNotice" class="field-hint" hidden>', '<p id="searchNotice" class="field-hint" style="color:#123456" hidden>'), js, oth]],
    ["the notice is moved above the results", () => { const n = html.match(/    <p id="searchNotice"[\s\S]*?<\/p>\n/)[0]; return [sw(html.replace(n, ""), '    <div id="results"', n + '    <div id="results"'), js, oth]; }],
    ["the recap no longer shows it (script)", () => [html, sw(js, "recapEl.hidden = false; noticeEl.hidden = staffMode;", "recapEl.hidden = false;"), oth]],
    // prompt FM (October 29, 2026): hidden in the staff view, unchanged for a candidate
    ["the notice is shown to staff again (the staff test is gone)", () => [html, sw(js, "recapEl.hidden = false; noticeEl.hidden = staffMode;", "recapEl.hidden = false; noticeEl.hidden = false;"), oth]],
    ["the notice is hidden from candidates too (always hidden)", () => [html, sw(js, "recapEl.hidden = false; noticeEl.hidden = staffMode;", "recapEl.hidden = false; noticeEl.hidden = true;"), oth]],
    ["the check reads the wrong state (the request flag, not the staff answer)", () => [html, sw(js, "recapEl.hidden = false; noticeEl.hidden = staffMode;", "recapEl.hidden = false; noticeEl.hidden = STAFF_REQUESTED;"), oth]],
    ["the check is turned round (shown to staff, hidden from candidates)", () => [html, sw(js, "recapEl.hidden = false; noticeEl.hidden = staffMode;", "recapEl.hidden = false; noticeEl.hidden = !staffMode;"), oth]],
    ["a second route shows the notice (a duplicate lookup)", () => [html, sw(js, "recapEl.hidden = false; noticeEl.hidden = staffMode;", "recapEl.hidden = false; noticeEl.hidden = staffMode; document.getElementById(\"searchNotice\").hidden = false;"), oth]],
    ["the staff flag is kept in storage for the notice", () => [html, sw(js, "recapEl.hidden = false; noticeEl.hidden = staffMode;", "recapEl.hidden = false; noticeEl.hidden = localStorage.getItem('staff') === '1';"), oth]],
    ["the notice is shown a second time in the page (a duplicate paragraph)", () => [sw(html, '    <p id="searchNotice" class="field-hint" hidden>', '    <p id="searchNotice2" class="field-hint">x</p>\n    <p id="searchNotice" class="field-hint" hidden>').replace('id="searchNotice2"', 'id="searchNotice"'), js, oth]],
    ["the recap no longer hides it (script)", () => [html, sw(js, "recapTextEl.textContent = \"\"; noticeEl.hidden = true;", "recapTextEl.textContent = \"\";"), oth]],
    ["a script is added to the page", () => [sw(html, "</body>", '<script type="module" src="js/x.js"></script></body>'), js, oth]],
    ["the script stores something when the notice shows", () => [html, sw(js, "recapEl.hidden = false; noticeEl.hidden = staffMode;", "recapEl.hidden = false; noticeEl.hidden = staffMode; localStorage.setItem('n', '1');"), oth]],
    ["the notice is copied onto another page", () => [html, js, { ...oth, "index.html": oth["index.html"] + '<p id="searchNotice">x</p>' }]],
  ];
  const missed = [];
  for (const [what, f] of BREAK) { const [h, j, o] = f(); const bad = staticFindings(h, j, o); if (!bad.length) missed.push(what); }
  assert.deepEqual(missed, [], "breakages the findings missed");
  assert.ok(BREAK.length >= 5);
  const PLANT = [() => [sw(html, "</head>", "<!-- nothing -->\n</head>"), js, oth], () => [html, js + "\n// a comment about nothing\n", oth], () => [sw(html, "<footer", "\n\n<footer"), js, oth],
    () => [html, sw(js, "recapEl.hidden = false; noticeEl.hidden = staffMode;", "recapEl.hidden = false; noticeEl.hidden = staffMode;   // a comment that mentions the staff view and nothing else"), oth],
    () => [html, js + "\n// staffMode is a plain word in a comment, nothing more\n", oth]];
  for (const f of PLANT) { const [h, j, o] = f(); assert.deepEqual(staticFindings(h, j, o), [], "a plant at nothing was flagged"); }
});

// ---------------------------------------------------------------- PART 2: a real browser
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

async function openSearch(tab, site) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.goto(site.url + "/search.html");
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(600);
}
const fill = (tab, company, title) => tab.eval(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }; set("company", ${JSON.stringify(company)}); set("titleq", ${JSON.stringify(title)}); })()`);
const press = async (tab) => { await tab.eval(`document.getElementById("searchBtn").focus()`); await tab.key("Enter"); };
const STATE = `(() => { const n = document.getElementById("searchNotice"), res = document.getElementById("results"), a = n ? n.querySelector("a") : null;
  const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left * 100) / 100, Math.round((b.top + scrollY) * 100) / 100, Math.round(b.width * 100) / 100, Math.round(b.height * 100) / 100]; };
  const shown = !!n && !n.hidden && n.getClientRects().length > 0, cs = n ? getComputedStyle(n) : null, ac = a ? getComputedStyle(a) : null, hint = document.querySelector(".field-hint:not(#searchNotice)");
  return { shown, mt: cs ? parseFloat(cs.marginTop) : 0, mb: cs ? parseFloat(cs.marginBottom) : 0, text: n ? n.textContent : null, href: a ? a.getAttribute("href") : null, target: a ? a.getAttribute("target") : null, linkText: a ? a.textContent : null, rect: n ? r(n) : null, resultsRect: r(res),
    color: cs ? cs.color : null, size: cs ? cs.fontSize : null, hintColor: hint ? getComputedStyle(hint).color : null, hintSize: hint ? getComputedStyle(hint).fontSize : null, linkColor: ac ? ac.color : null, linkDecoration: ac ? ac.textDecorationLine : null,
    cookie: document.cookie, keys: Object.keys(localStorage).sort().join(",") + "|" + Object.keys(sessionStorage).sort().join(","), docH: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    anchors: Array.from(document.querySelectorAll("header, #searchForm, #recap, #resultCount, #results, .site-footer")).map((e) => [e.id || e.tagName.toLowerCase() + (e.className ? "." + String(e.className).split(" ")[0] : ""), r(e)]) }; })()`;

async function walk(root, width) {
  const site = await startFakeSite(root), tab = await browser.newTab(), out = {};
  try {
    await tab.focusEmulation(true);
    const phone = width < 700;
    await tab.viewport(width, phone, phone ? 700 : 900);
    await openSearch(tab, site); await tab.viewport(width, phone, phone ? 700 : 900); await sleep(300);
    out.start = await tab.eval(STATE);
    await fill(tab, "", "Nurse"); await press(tab); await sleep(500);   // refused: no company
    out.refused = await tab.eval(STATE);
    const callsBefore = site.calls.length;
    await fill(tab, "Meridian", "Nurse"); await press(tab);
    out.foundOk = !!(await tab.waitFor(`!document.getElementById("recap").hidden`, 6000)); await sleep(600);
    out.found = await tab.eval(STATE);
    out.foundCalls = site.calls.slice(callsBefore).map((c) => c.name);
    await tab.eval(`document.getElementById("recapEdit").focus()`); await tab.key("Enter"); await sleep(400);
    out.edited = await tab.eval(STATE);
    await fill(tab, "Zzyzx Unknown", "Nurse"); await press(tab);
    out.noneOk = !!(await tab.waitFor(`!document.getElementById("recap").hidden`, 6000)); await sleep(600);
    out.none = await tab.eval(STATE);
    // a click on the link: same tab, to the marketing privacy page (the fake site answers every other address with its 404 page, so the address is read before the navigation completes)
    out.clickedTo = await tab.eval(`(() => { const a = document.querySelector("#searchNotice a"); if (!a) return null; let to = null; a.addEventListener("click", (e) => { to = a.href; e.preventDefault(); }, { once: true }); a.click(); return to; })()`);
    await tab.goto(site.url + "/index.html"); await sleep(300);
    out.index = await tab.eval(`(() => ({ has: !!document.getElementById("searchNotice") || /We keep a record of your search/.test(document.body.textContent) }))()`);
    await tab.goto(site.url + "/comments.html"); await sleep(300);
    out.comments = await tab.eval(`(() => ({ has: !!document.getElementById("searchNotice") || /We keep a record of your search/.test(document.body.textContent) }))()`);
  } finally { await tab.close(); await site.close(); }
  return out;
}

for (const width of [360, 768, 1093, 1440]) {
  test("PART 2 at " + width + " px: shown after a search (found or not), hidden before and after a refusal and after Edit this search; same tab link; nothing stored or sent; nothing above it moves", async () => {
    const r = await walk(ROOT, width), bad = [];
    if (r.start.shown) bad.push("the notice shows before any search");
    if (r.refused.shown) bad.push("the notice shows after a refused search");
    if (!r.foundOk || !r.found.shown) bad.push("the notice is not shown after a search that found openings");
    if (!r.noneOk || !r.none.shown) bad.push("the notice is not shown after a search that found nothing");
    if (r.edited.shown) bad.push("the notice stays after Edit this search (the recap is gone)");
    for (const [k, s] of [["found", r.found], ["none", r.none]]) {
      if (s.text !== NOTICE_TEXT) bad.push(k + ": the text is '" + s.text + "'");
      if (s.href !== LINK) bad.push(k + ": the link goes to " + s.href);
      if (s.target !== null) bad.push(k + ": the link has a target (" + s.target + ")");
      if (s.linkText !== "Privacy Policy") bad.push(k + ": the link is on '" + s.linkText + "'");
      if (s.color !== s.hintColor || s.size !== s.hintSize) bad.push(k + ": the notice uses another colour or size than the page's hint text (" + s.color + " " + s.size + " vs " + s.hintColor + " " + s.hintSize + ")");
      if (s.linkDecoration.indexOf("underline") < 0) bad.push(k + ": the link is not underlined like the other links in the main area");
      if (s.rect[1] < s.resultsRect[1] + s.resultsRect[3] - 0.5) bad.push(k + ": the notice is not under the results area");
      if (s.rect[0] !== s.resultsRect[0]) bad.push(k + ": the notice is not aligned with the results column (" + s.rect[0] + " vs " + s.resultsRect[0] + ")");
      if (s.sw > s.cw + 0.5) bad.push(k + ": the page scrolls sideways");
      if (s.cookie !== "") bad.push(k + ": a cookie exists: " + s.cookie);
    }
    if (r.found.keys !== r.start.keys && r.found.keys.replace(/fgj-[a-z-]*/g, "") !== r.start.keys.replace(/fgj-[a-z-]*/g, "")) bad.push("storage keys changed during the search: " + r.start.keys + " -> " + r.found.keys);
    if (r.clickedTo !== LINK) bad.push("a click goes to " + r.clickedTo);
    if (r.index.has || r.comments.has) bad.push("the notice is on a page that shows no search");
    assert.deepEqual(bad, []);
  });
}

// ---- prompt FM (October 29, 2026): the staff view. A staff search is not recorded as a candidate search, so the notice about the record stays out of it. A person who is signed in but is NOT staff, with the same ?scope=all, gets the candidate page and the notice.
async function walkScope(root, width, email, title) {
  const site = await startFakeSite(root), tab = await browser.newTab(), out = {};
  try {
    await tab.focusEmulation(true);
    const phone = width < 700;
    await tab.viewport(width, phone, phone ? 700 : 900);
    await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
    await tab.goto(site.url + "/_dev/link?kind=candidate&email=" + encodeURIComponent(email)); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
    await tab.goto(site.url + "/search.html?scope=all");
    await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await tab.viewport(width, phone, phone ? 700 : 900); await sleep(900);
    out.banner = await tab.eval(`!!document.getElementById("staffBanner")`);
    out.start = await tab.eval(STATE);
    out.calls0 = site.calls.length;
    await fill(tab, "Meridian", title); await press(tab);
    out.foundOk = !!(await tab.waitFor(`!document.getElementById("recap").hidden`, 8000)); await sleep(600);
    out.found = await tab.eval(STATE);
    out.foundCalls = site.calls.slice(out.calls0).map((c) => c.name);
    out.foundCards = await tab.eval(`document.querySelectorAll("#results .card").length`);
    await tab.eval(`document.getElementById("recapEdit").focus()`); await tab.key("Enter"); await sleep(400);
    out.edited = await tab.eval(STATE);
    await fill(tab, "Zzyzx Unknown", title); await press(tab);
    out.noneOk = !!(await tab.waitFor(`!document.getElementById("recap").hidden`, 8000)); await sleep(600);
    out.none = await tab.eval(STATE);
    out.noneText = await tab.eval(`document.getElementById("results").innerText`);
  } finally { await tab.close(); await site.close(); }
  return out;
}
for (const width of [360, 1440]) {
  test("PART 2 at " + width + " px, staff view: the recap shows, the notice does not (after a search that found openings, after one that found nothing, and while the recap stays)", async () => {
    const r = await walkScope(ROOT, width, "staff@example.test", "Analyst"), bad = [];
    if (!r.banner) bad.push("the staff banner is not there (the page is not in the staff view)");
    if (r.start.shown) bad.push("the notice shows in the staff view before any search");
    if (!r.foundOk) bad.push("no recap after the staff search that should find openings");
    if (r.found.shown) bad.push("the notice shows in the staff view after a search that found openings");
    if (r.foundCards < 1) bad.push("the staff search found no openings, so this run does not prove the found case");
    if (!r.foundCalls.includes("rpc:staff_search_openings")) bad.push("the staff search did not go through the staff function: " + r.foundCalls.join(","));
    if (r.edited.shown) bad.push("the notice shows after Edit this search");
    if (!r.noneOk) bad.push("no recap after the staff search that should find nothing");
    if (r.none.shown) bad.push("the notice shows in the staff view after a search that found nothing");
    if (!/Nothing matches/.test(r.noneText)) bad.push("the staff search that should find nothing did not say so: " + r.noneText.slice(0, 60));
    if (r.found.cookie !== "" || r.found.keys !== r.start.keys && r.found.keys.replace(/fgj-[a-z-]*/g, "") !== r.start.keys.replace(/fgj-[a-z-]*/g, "")) bad.push("a cookie or a storage key appeared in the staff view");
    assert.deepEqual(bad, []);
  });
  test("PART 2 at " + width + " px, a signed-in person who is not staff with scope=all: the candidate page, the notice shows after a search as before", async () => {
    const r = await walkScope(ROOT, width, "cand@example.test", "Nurse"), bad = [];
    if (r.banner) bad.push("the staff banner shows for a person who is not staff");
    if (r.start.shown) bad.push("the notice shows before any search");
    if (!r.foundOk || !r.found.shown) bad.push("the notice is not shown after a search that found openings");
    if (!r.noneOk || !r.none.shown) bad.push("the notice is not shown after a search that found nothing");
    if (r.found.href !== LINK || r.found.text !== NOTICE_TEXT) bad.push("the notice text or link differs: " + r.found.text);
    if (r.foundCalls.includes("rpc:staff_search_openings")) bad.push("a person who is not staff called the staff search");
    assert.deepEqual(bad, []);
  });
}

test("PART 2: against the page BEFORE the change (FGJ_BASE_ROOT): the same requests, the same storage, and every element above the notice is where it was; what is below moves down by the notice's own height", { skip: BASE_ROOT ? false : "FGJ_BASE_ROOT is not set" }, async () => {
  const bad = [];
  for (const width of [360, 768, 1093, 1440]) {
    const a = await walk(BASE_ROOT, width), b = await walk(ROOT, width);
    for (const k of ["start", "refused", "found", "edited", "none"]) {
      const x = a[k], y = b[k];
      if (x.keys !== y.keys) bad.push(width + " " + k + ": storage differs " + x.keys + " | " + y.keys);
      if (x.cookie !== y.cookie) bad.push(width + " " + k + ": cookies differ");
      if (x.sw !== y.sw) bad.push(width + " " + k + ": the page width differs");
      const grew = y.docH - x.docH;
      const noteOn = y.shown ? y.rect[3] + 20 + y.mt + y.mb : 0;   // its own height, the 20 pixel gap of the column and the margins the page's own paragraph and hint styles give it
      const noteBox = y.shown ? y.rect : null;
      for (let i = 0; i < x.anchors.length; i++) {
        const [name, rx] = x.anchors[i], [name2, ry] = y.anchors[i] || [];
        if (name !== name2) { bad.push(width + " " + k + ": the element list differs at " + name); continue; }
        const above = noteBox ? rx[1] + rx[3] <= noteBox[1] + 0.5 : true;
        if (above || !y.shown) { if (JSON.stringify(rx) !== JSON.stringify(ry)) bad.push(width + " " + k + ": " + name + " moved " + JSON.stringify(rx) + " -> " + JSON.stringify(ry)); }
        else if (Math.abs((ry[1] - rx[1]) - grew) > 1.5 && rx[1] > noteBox[1]) bad.push(width + " " + k + ": " + name + " below the notice moved by " + (ry[1] - rx[1]) + " (the page grew " + grew + ")");
      }
      if (process.env.FGJ_REPORT) console.log("LAYOUT " + width + " px, " + k + ": notice " + (y.shown ? y.rect.join(" ") : "hidden") + "; page height " + x.docH + " -> " + y.docH + " (+" + grew + "); moved: " + (x.anchors.map(([n, rx], i) => (JSON.stringify(rx) === JSON.stringify(y.anchors[i][1]) ? null : n + " by " + (y.anchors[i][1][1] - rx[1]))).filter(Boolean).join(", ") || "nothing"));
      if (y.shown && Math.abs(grew - noteOn) > 1.5) bad.push(width + " " + k + ": the page grew " + grew + ", the notice accounts for " + noteOn + " (" + y.rect[3] + " high, the 20 pixel gap, margins " + y.mt + " and " + y.mb + ")");
      if (!y.shown && grew !== 0) bad.push(width + " " + k + ": the page height changed by " + grew + " while the notice is hidden");
    }
    if (JSON.stringify(a.foundCalls) !== JSON.stringify(b.foundCalls)) bad.push(width + ": the backend requests of a search differ " + a.foundCalls + " | " + b.foundCalls);
  }
  assert.deepEqual(bad, []);
});
