// privacy-notice.test.js (prompt FK, October 29, 2026; rewritten by prompt JB, November 7, 2026) - the sentence about the record of a search: "We keep a record of your search, including the words you typed, so we can count what people look for.
// ... Employers never see who searched. Details are in our Privacy Policy." with a link on the words Privacy Policy to the marketing privacy page. Prompt JB moved it from under the results to the info box behind the "i" (at the heading and in the
// recap box): the paragraph stays in search.html, hidden, inside #infoSource, and the box copies it. Run: node --test tests/privacy-notice.test.js
//   PART 1 (no browser): the page file and the script hold exactly the approved sentence and link, hidden for good, in #infoSource, read by the info box, switched off for staff, on no other page, nothing added that stores, sends or loads anything.
//          Then breakages, each made on a copy held in memory, must be caught, and a plant at nothing must not be flagged.
//   PART 2 (a real browser on the repo's own files with the fake backend tests/fake-site.js; no real project, no key): at 360 and 1440 px the notice is never on the page (before a search, after one that found openings, after one that found
//          nothing), the box opened from the heading "i" and the one in the recap box both hold the exact sentence with its link to the privacy page (same tab, no target); opening the box sends no request and stores nothing; in the staff view the box
//          leaves the sentence out (a staff search is not recorded as a candidate search, prompt FM); a signed-in person who is not staff with scope=all gets it.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite } from "./fake-site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rd = (p, root = ROOT) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");
const NOTICE_TEXT = "We keep a record of your search, including the words you typed, so we can count what people look for. The record also holds any KIO ID or req number you typed or we read from the job page, and an ID you mistyped is kept as typed. Employers never see who searched. Details are in our Privacy Policy.";
const LINK = "https://www.fightghostjobs.com/privacy.html";
const DASH = new RegExp(String.fromCharCode(8212) + "|" + String.fromCharCode(8211));
const strip = (h) => h.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");

// ---------------------------------------------------------------- PART 1: the files
function staticFindings(html, js, panel, otherPages) {
  const bad = [];
  const els = [...html.matchAll(/<p\b[^>]*\bid="searchNotice"[^>]*>([\s\S]*?)<\/p>/g)];
  if (els.length !== 1) { bad.push("the page has " + els.length + " searchNotice paragraph(s), not one"); return bad; }
  const tag = els[0][0].match(/^<p\b[^>]*>/)[0], inner = els[0][1];
  if (strip(inner).trim() !== NOTICE_TEXT) bad.push("the notice text is not the approved sentence: " + strip(inner).trim().slice(0, 60));
  if (/\bhidden\b/.test(tag)) bad.push("the notice paragraph carries its own hidden flag (it is hidden by its container, #infoSource)");
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
  // it sits inside the hidden container, and the container is hidden
  const src = (html.match(/<div id="infoSource" hidden>([\s\S]*?)\n<\/div>/) || [])[1] || "";
  if (!src.includes('id="searchNotice"')) bad.push("the notice is not inside the hidden #infoSource");
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].length;
  if (scripts !== 2) bad.push("search.html has " + scripts + " script tags (two are expected: stage-gate.js and search.js)");
  // the script: the page only switches it off for staff; it is never shown on the page
  const nn = (js.match(/const noticeEl = \$\("#searchNotice"\);/g) || []).length;
  if (nn !== 1) bad.push("search.js does not look up the notice exactly once");
  if (/noticeEl\.hidden/.test(js)) bad.push("search.js shows or hides the notice on the page (it must stay hidden; the info box shows it)");
  if (!/recapEl\.hidden = false; noticeEl\.dataset\.off = staffMode \? "1" : "0";/.test(js)) bad.push("showRecap does not keep the notice out of the info box in the staff view (it must read staffMode, the page's own flag)");
  if (!/noticeEl\.dataset\.off = "1";/.test(js) || !/noticeEl\.dataset\.off = "0";/.test(js)) bad.push("entering and leaving the staff view do not switch the notice off and on");
  if ((js.match(/noticeEl\./g) || []).length !== 3) bad.push("the notice is touched in other places than the three (show with the recap, enter staff, leave staff)");
  if ((js.match(/searchNotice/g) || []).length !== 1) bad.push("search.js reaches the notice in more than the one lookup (a second route to the element)");
  for (const line of js.split("\n").filter((l) => /noticeEl|searchNotice/.test(l))) if (/fetch|localStorage|sessionStorage|document\.cookie|XMLHttp|sendBeacon|window\.open|\.href\s*=/.test(line.replace(/\/\/.*$/, ""))) bad.push("the notice code stores, sends or loads something: " + line.trim().slice(0, 80));
  // the info box reads it, and leaves it out when it is switched off
  if (!/copyOf\(doc, "searchNotice"\)/.test(panel) || (panel.match(/notice\.dataset\.off !== "1"/g) || []).length !== 2) bad.push("the info box does not copy the notice, or does not leave it out when it is switched off");
  // no other page carries it
  for (const [name, text] of Object.entries(otherPages)) if (/searchNotice|We keep a record of your search/.test(text)) bad.push(name + " carries the notice, but shows no search");
  return bad;
}
const others = () => Object.fromEntries(fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && f !== "search.html").map((f) => [f, rd(f)]));

test("PART 1: the page and the script hold exactly the approved notice, hidden for good, and nothing else is added", () => {
  const bad = staticFindings(rd("search.html"), rd("js/pages/search.js"), rd("js/info-panel.js"), others());
  assert.deepEqual(bad, []);
});

test("PART 1: breakages are caught, a plant at nothing is not", () => {
  const html = rd("search.html"), js = rd("js/pages/search.js"), panel = rd("js/info-panel.js"), oth = others();
  const sw = (t, a, b) => { if (t.split(a).length !== 2) throw new Error("anchor not found once: " + a.slice(0, 50)); return t.replace(a, () => b); };
  const SHOW = 'recapEl.hidden = false; noticeEl.dataset.off = staffMode ? "1" : "0";';
  const BREAK = [
    ["the link is broken (another address)", () => [sw(html, 'href="' + LINK + '">Privacy Policy', 'href="https://www.fightghostjobs.com/privacy">Privacy Policy'), js, panel, oth]],
    ["the link is on other words", () => [sw(html, ">Privacy Policy</a>", ">Privacy</a>"), js, panel, oth]],
    ["the link opens a new tab", () => [sw(html, 'href="' + LINK + '">Privacy Policy', 'href="' + LINK + '" target="_blank">Privacy Policy'), js, panel, oth]],
    ["the notice text is changed", () => [sw(html, "Employers never see who searched.", "Employers see who searched."), js, panel, oth]],
    ["the notice text loses a sentence", () => [sw(html, " Employers never see who searched.", ""), js, panel, oth]],
    ["an em dash is added", () => [sw(html, "so we can count", "so we can count " + String.fromCharCode(8212)), js, panel, oth]],
    ["the notice paragraph gets its own hidden flag", () => [sw(html, '<p id="searchNotice" class="field-hint">', '<p id="searchNotice" class="field-hint" hidden>'), js, panel, oth]],
    ["the notice gets its own colour", () => [sw(html, '<p id="searchNotice" class="field-hint">', '<p id="searchNotice" class="field-hint" style="color:#123456">'), js, panel, oth]],
    ["the notice is moved out of the hidden container (it shows on the page)", () => { const n = html.match(/  <p id="searchNotice"[\s\S]*?<\/p>\n/)[0]; return [sw(html.replace(n, ""), '  </div>\n</div>\n\n<!-- Prompt JB', '    ' + n.trim() + '\n  </div>\n</div>\n\n<!-- Prompt JB'), js, panel, oth]; }],
    ["the page shows it with the recap again (script)", () => [html, sw(js, SHOW, "recapEl.hidden = false; noticeEl.hidden = false;"), panel, oth]],
    // prompt FM (October 29, 2026): not in the staff view, unchanged for a candidate
    ["the notice is kept for staff again (the staff test is gone)", () => [html, sw(js, SHOW, 'recapEl.hidden = false; noticeEl.dataset.off = "0";'), panel, oth]],
    ["the notice is left out for candidates too (always off)", () => [html, sw(js, SHOW, 'recapEl.hidden = false; noticeEl.dataset.off = "1";'), panel, oth]],
    ["the check reads the wrong state (the request flag, not the staff answer)", () => [html, sw(js, SHOW, 'recapEl.hidden = false; noticeEl.dataset.off = STAFF_REQUESTED ? "1" : "0";'), panel, oth]],
    ["the check is turned round", () => [html, sw(js, SHOW, 'recapEl.hidden = false; noticeEl.dataset.off = !staffMode ? "1" : "0";'), panel, oth]],
    ["a second route reaches the notice (a duplicate lookup)", () => [html, sw(js, SHOW, SHOW + ' document.getElementById("searchNotice").hidden = false;'), panel, oth]],
    ["the staff flag is kept in storage for the notice", () => [html, sw(js, SHOW, 'recapEl.hidden = false; noticeEl.dataset.off = localStorage.getItem("staff");'), panel, oth]],
    ["the notice is in the page a second time (a duplicate paragraph)", () => [sw(html, '  <p id="searchNotice" class="field-hint">', '  <p id="searchNotice" class="field-hint">x</p>\n  <p id="searchNotice" class="field-hint">'), js, panel, oth]],
    ["the info box stops copying the notice", () => [html, js, sw(panel, 'privacy.push(copyOf(doc, "searchNotice"));', "privacy.push(null);"), oth]],
    ["the info box ignores the staff switch", () => [html, js, sw(panel, 'if (notice && notice.dataset.off !== "1") privacy.push(copyOf(doc, "searchNotice"));', 'privacy.push(copyOf(doc, "searchNotice"));'), oth]],   // prompt JK: the same switch also guards the employer sentence (a second line)
    ["a script is added to the page", () => [sw(html, "</body>", '<script type="module" src="js/x.js"></script></body>'), js, panel, oth]],
    ["the script stores something when the notice is switched", () => [html, sw(js, SHOW, SHOW + " localStorage.setItem('n', '1');"), panel, oth]],
    ["the notice is copied onto another page", () => [html, js, panel, { ...oth, "index.html": oth["index.html"] + '<p id="searchNotice">x</p>' }]],
  ];
  const missed = [];
  for (const [what, f] of BREAK) { const [h, j, p, o] = f(); const bad = staticFindings(h, j, p, o); if (!bad.length) missed.push(what); }
  assert.deepEqual(missed, [], "breakages the findings missed");
  assert.ok(BREAK.length >= 5);
  const PLANT = [() => [sw(html, "</head>", "<!-- nothing -->\n</head>"), js, panel, oth], () => [html, js + "\n// a comment about nothing\n", panel, oth], () => [sw(html, "<footer", "\n\n<footer"), js, panel, oth],
    () => [html, sw(js, SHOW, SHOW + "   // a comment that mentions the staff view and nothing else"), panel, oth],
    () => [html, js + "\n// staffMode is a plain word in a comment, nothing more\n", panel, oth]];
  for (const f of PLANT) { const [h, j, p, o] = f(); assert.deepEqual(staticFindings(h, j, p, o), [], "a plant at nothing was flagged"); }
});

// ---------------------------------------------------------------- PART 2: a real browser
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

async function openSearch(tab, site, qs = "", email = "") {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate" + (email ? "&email=" + encodeURIComponent(email) : "")); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.goto(site.url + "/search.html" + qs);
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(600);
}
const fill = (tab, company, title) => tab.eval(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }; set("company", ${JSON.stringify(company)}); set("titleq", ${JSON.stringify(title)}); })()`);
const press = async (tab) => { await tab.eval(`document.getElementById("searchBtn").focus()`); await tab.key("Enter"); };
// the notice on the page (it must never be rendered) and the notice in the box opened from the heading "i" or from the recap "i": its text, its link, closed again afterwards
const PAGE = `(() => { const n = document.getElementById("searchNotice"); return { rendered: !!n && n.getClientRects().length > 0, cookie: document.cookie, keys: Object.keys(localStorage).sort().join(",") + "|" + Object.keys(sessionStorage).sort().join(","), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; })()`;
const BOX = (slot) => `(() => { const i = document.querySelector('${slot} .info-box-icon'); if (!i) return null; i.click(); const b = document.querySelector('.info-box-body'); if (!b) return { none: true };
  const p = Array.from(b.querySelectorAll('p')).find((e) => /We keep a record of your search/.test(e.textContent)), a = p ? p.querySelector('a') : null;
  const out = { has: !!p, text: p ? p.textContent.replace(/\\s+/g, ' ').trim() : null, href: a ? a.getAttribute('href') : null, target: a ? a.getAttribute('target') : null, linkText: a ? a.textContent : null, idDup: document.querySelectorAll('#searchNotice').length };
  const c = document.querySelector('.info-box-close'); if (c) c.click(); return out; })()`;

async function walk(root, width, { email = "", qs = "", company = "Meridian", title = "Nurse" } = {}) {
  const site = await startFakeSite(root), tab = await browser.newTab(), out = {};
  try {
    await tab.focusEmulation(true);
    const phone = width < 700;
    await tab.viewport(width, phone, phone ? 700 : 900);
    await openSearch(tab, site, qs, email); await tab.viewport(width, phone, phone ? 700 : 900); await sleep(300);
    out.banner = await tab.eval(`!!document.getElementById("staffBanner")`);
    out.start = await tab.eval(PAGE);
    out.startBox = await tab.eval(BOX("#infoSlot"));
    const callsBefore = site.calls.length;
    out.startBoxCalls = site.calls.length - callsBefore;
    await fill(tab, company, title); await press(tab);
    out.foundOk = !!(await tab.waitFor(`!document.getElementById("recap").hidden`, 8000)); await sleep(600);
    out.found = await tab.eval(PAGE);
    out.foundBox = await tab.eval(BOX("#recapInfoSlot"));
    out.foundHeadBox = await tab.eval(BOX("#infoSlot"));
    await fill(tab, "", ""); await tab.eval(`document.getElementById("recapEdit").click()`); await sleep(300);
    await fill(tab, "Zzyzx Unknown", title); await press(tab);
    out.noneOk = !!(await tab.waitFor(`!document.getElementById("recap").hidden`, 8000)); await sleep(600);
    out.none = await tab.eval(PAGE);
    out.noneBox = await tab.eval(BOX("#recapInfoSlot"));
    // a click on the link: same tab, to the marketing privacy page (the fake site answers every other address with its 404 page, so the address is read before the navigation completes)
    out.clickedTo = await tab.eval(`(() => { document.querySelector('#recapInfoSlot .info-box-icon').click(); const a = Array.from(document.querySelectorAll('.info-box-body a')).find((x) => /privacy/.test(x.href)); if (!a) return null; let to = null; a.addEventListener("click", (e) => { to = a.href; e.preventDefault(); }, { once: true }); a.click(); const c = document.querySelector('.info-box-close'); if (c) c.click(); return to; })()`);
    await tab.goto(site.url + "/index.html"); await sleep(300);
    out.index = await tab.eval(`(() => ({ has: !!document.getElementById("searchNotice") || /We keep a record of your search/.test(document.body.textContent) }))()`);
    await tab.goto(site.url + "/comments.html"); await sleep(300);
    out.comments = await tab.eval(`(() => ({ has: !!document.getElementById("searchNotice") || /We keep a record of your search/.test(document.body.textContent) }))()`);
  } finally { await tab.close(); await site.close(); }
  return out;
}

for (const width of [360, 1440]) {
  test("PART 2 at " + width + " px: never on the page; the box (heading \"i\" and recap \"i\") holds the exact sentence and link; same tab link; opening the box stores and sends nothing", async () => {
    const r = await walk(ROOT, width), bad = [];
    if (r.start.rendered || r.found.rendered || r.none.rendered) bad.push("the notice is rendered on the page (it must be behind the info button only)");
    if (!r.foundOk || !r.noneOk) bad.push("a search did not finish");
    for (const [k, s] of [["start (heading i)", r.startBox], ["found (recap i)", r.foundBox], ["found (heading i)", r.foundHeadBox], ["none (recap i)", r.noneBox]]) {
      if (!s || !s.has) { bad.push(k + ": the box does not hold the notice"); continue; }
      if (s.text !== NOTICE_TEXT) bad.push(k + ": the text is '" + s.text + "'");
      if (s.href !== LINK) bad.push(k + ": the link goes to " + s.href);
      if (s.target !== null) bad.push(k + ": the link has a target (" + s.target + ")");
      if (s.linkText !== "Privacy Policy") bad.push(k + ": the link is on '" + s.linkText + "'");
      if (s.idDup !== 1) bad.push(k + ": the page has " + s.idDup + " elements with the id searchNotice (a copy kept its id)");
    }
    if (r.startBoxCalls !== 0) bad.push("opening the box sent " + r.startBoxCalls + " request(s)");
    if (r.found.sw > r.found.cw + 0.5) bad.push("the page scrolls sideways");
    for (const [k, s] of [["start", r.start], ["found", r.found], ["none", r.none]]) if (s.cookie !== "") bad.push(k + ": a cookie exists: " + s.cookie);
    if (r.found.keys !== r.start.keys && r.found.keys.replace(/fgj-[a-z-]*/g, "") !== r.start.keys.replace(/fgj-[a-z-]*/g, "")) bad.push("storage keys changed during the search: " + r.start.keys + " -> " + r.found.keys);
    if (r.clickedTo !== LINK) bad.push("a click goes to " + r.clickedTo);
    if (r.index.has || r.comments.has) bad.push("the notice is on a page that shows no search");
    assert.deepEqual(bad, []);
  });
}

// ---- prompt FM (October 29, 2026): the staff view. A staff search is not recorded as a candidate search, so the box leaves the sentence about the record out. A person who is signed in but is NOT staff, with the same ?scope=all, gets the candidate page and the sentence.
for (const width of [360, 1440]) {
  test("PART 2 at " + width + " px, staff view: the box does not hold the notice (before and after a search)", async () => {
    const r = await walk(ROOT, width, { email: "staff@example.test", qs: "?scope=all", title: "Analyst" }), bad = [];
    if (!r.banner) bad.push("the staff banner is not there (the page is not in the staff view)");
    if (r.start.rendered || r.found.rendered || r.none.rendered) bad.push("the notice is rendered on the page");
    if (r.startBox && r.startBox.has) bad.push("the box holds the notice in the staff view before any search");
    if (!r.foundOk) bad.push("no recap after the staff search");
    if (r.foundBox && r.foundBox.has) bad.push("the box holds the notice in the staff view after a search that found openings");
    if (r.noneOk && r.noneBox && r.noneBox.has) bad.push("the box holds the notice in the staff view after a search that found nothing");
    if (r.found.cookie !== "") bad.push("a cookie appeared in the staff view");
    assert.deepEqual(bad, []);
  });
  test("PART 2 at " + width + " px, a signed-in person who is not staff with scope=all: the candidate page, the box holds the notice as before", async () => {
    const r = await walk(ROOT, width, { email: "cand@example.test", qs: "?scope=all" }), bad = [];
    if (r.banner) bad.push("the staff banner shows for a person who is not staff");
    if (!r.startBox || !r.startBox.has || r.startBox.text !== NOTICE_TEXT) bad.push("the box does not hold the notice before a search: " + JSON.stringify(r.startBox));
    if (!r.foundOk || !r.foundBox || !r.foundBox.has || r.foundBox.href !== LINK) bad.push("the box does not hold the notice after a search");
    assert.deepEqual(bad, []);
  });
}
