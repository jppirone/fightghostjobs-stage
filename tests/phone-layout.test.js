// phone-layout.test.js - every page of the site on a phone-sized window, in a REAL browser, on the repo's own files with a fake backend (tests/fake-site.js; no real project, no key). October 4, 2026.
//
// Widths 320, 360, 375, 390 and 414 (phone emulation: touch, mobile viewport, pixel ratio 2), every one of the 12 pages in the states a person meets it in:
//   signed out: home, search (and its "Verify your email" card), employer sign-in, privacy, 404, the sign-in link page, a comments page (and its verify card);
//   signed in as an employer: My postings, Analytics, Team, Register a posting, Edit a posting, and the search page (employer notice);
//   signed in as a candidate: search with results, and the open "View posting details" window; a comments page with a thread.
// For each: the document must not scroll sideways (scroll width not over client width); no element may reach past the right edge unless it sits inside an explicitly labelled scroll area (data-scroll-area; there are none
// on purpose); no inner box may scroll sideways; every button, button-like link, footer or navigation link, form field and switch is a 44 pixel target (links inside running text are exempt: they are words in a sentence);
// form text is at least 16 pixels (a phone browser zooms the page when a smaller field is focused); two-column layouts and side-by-side fields stack; page and card side space is small (16 pixels); the verify card's email box and button
// fill the row; a result card's text has room; the details window fits the screen and its link rows stack; each table row is a card that carries the table roles and a visible label for each cell.
// Above 640 pixels nothing is asked of the phone rules: the desktop widths 1024 and 1280 are only checked for "no sideways scrolling" (a labelled scroll area, data-scroll-area, may scroll inside itself there: the three tables).
// Then negative controls: one deliberate defect injected at a time (the stylesheet fix undone) and each must be caught.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/phone-layout.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite } from "./fake-site.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WIDTHS = [320, 360, 375, 390, 414];
const DESKTOP = [1024, 1280];   // 641 to about 1000 pixels (a narrow desktop window, a tablet) keeps the desktop layout on purpose and is NOT covered: the home page is 834 wide at 700
const REF = "d21m48ybzqbfxxxxxxxx";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let site, browser, tab;
before(async () => { site = await startFakeSite(ROOT); browser = await launchBrowser(); tab = await browser.newTab(); });
after(async () => { if (browser) await browser.close(); if (site) await site.close(); });

// the states: who is signed in, the page, and what to do on it before measuring
const STATES = [
  { id: "home", who: "out", page: "index.html" },
  { id: "search, signed out, verify card", who: "out", page: "search.html", act: "verify" },
  { id: "employer sign-in", who: "out", page: "employer-signin.html" },
  { id: "privacy", who: "out", page: "privacy.html" },
  { id: "not found", who: "out", page: "404.html" },
  { id: "sign-in link page", who: "out", page: "auth-callback.html" },
  { id: "comments, signed out, verify card", who: "out", page: "comments.html?ref=" + REF },
  { id: "My openings", who: "poster", page: "dashboard.html", table: true },
  { id: "Analytics", who: "poster", page: "analytics.html", table: true },
  { id: "Team", who: "poster", page: "team.html", table: true },
  { id: "Register an opening", who: "poster", page: "register.html" },
  { id: "Edit an opening", who: "poster", page: "edit.html?id=3f1d5b1e-0000-4000-8000-000000000001" },
  { id: "search, employer notice", who: "poster", page: "search.html" },
  { id: "search, results", who: "cand", page: "search.html", act: "results", results: true },
  { id: "search, details window", who: "cand", page: "search.html", act: "details", results: true, modal: true },
  { id: "comments, thread", who: "cand", page: "comments.html?ref=" + REF },
];

// ---- measured in the page ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const MEASURE = `(async () => {
  await document.fonts.ready; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const de = document.documentElement, vw = de.clientWidth;
  const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const sel = (e) => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\\s+/).slice(0, 2).join(".") : "");
  const shown = (e) => { const c = getComputedStyle(e); if (c.display === "none" || c.visibility === "hidden") return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const R = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const out = { vw, sw: de.scrollWidth, over: [], innerScroll: [], small: [], smallFont: [], notStacked: [], pad: [], tables: [], misc: {} };
  const all = Array.from(document.body.querySelectorAll("*")).filter(shown);
  // 1. reaching past the right edge (an explicitly labelled scroll area, data-scroll-area, may hold wide things)
  const bad = new Set();
  for (const el of all) {
    const r = R(el); if (r.r <= vw + 0.5) continue;
    if (el.closest(".skip-link")) continue;
    let a = el.parentElement, labelled = false;
    while (a && a !== document.body) { if (a.hasAttribute("data-scroll-area")) { labelled = true; break; } a = a.parentElement; }
    if (labelled) continue;
    if (el.parentElement && bad.has(el.parentElement)) { bad.add(el); continue; }
    bad.add(el); out.over.push(sel(el) + " " + Math.round(r.l) + "-" + Math.round(r.r));
  }
  // 2. boxes that scroll sideways inside themselves
  for (const el of all) { const c = getComputedStyle(el); if ((c.overflowX === "auto" || c.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 1) out.innerScroll.push({ s: sel(el) + " " + el.scrollWidth + ">" + el.clientWidth, labelled: el.hasAttribute("data-scroll-area") }); }
  // 3. touch targets and form text
  const CONTROL = "button, a.btn, a.row-action, .row-action, .filter-pill, .source-row, [role=button], .toggle, .info-icon, .nav-links a, .nav-logo, footer a, .site-footer a, #modalMore a, select, textarea, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), label.check-row, .loc-remove";
  for (const el of document.querySelectorAll(CONTROL)) {
    if (!shown(el) || el.closest(".skip-link, .info-tooltip, [aria-hidden=true]")) continue;
    const r = R(el); let w = r.w, h = r.h;
    const ps = getComputedStyle(el, "::before"); if (ps.content !== "none" && ps.position === "absolute") { w = Math.max(w, px(ps.width)); h = Math.max(h, px(ps.height)); }
    if (w < 43.5 || h < 43.5) out.small.push(sel(el) + " " + Math.round(w) + "x" + Math.round(h) + " " + (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 20));
  }
  for (const el of document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea")) if (shown(el) && px(getComputedStyle(el).fontSize) < 15.99) out.smallFont.push(sel(el) + " " + getComputedStyle(el).fontSize);
  // 4. columns that must be one per row
  for (const g of document.querySelectorAll(".cols, .grid2, .grid3")) {
    if (!shown(g)) continue;
    const kids = Array.from(g.children).filter(shown);
    for (let i = 1; i < kids.length; i++) if (R(kids[i]).t < R(kids[i - 1]).b - 1) { out.notStacked.push(sel(g) + " child " + i + " is beside child " + (i - 1)); break; }
  }
  // 5. page and card side space
  for (const e of document.querySelectorAll(".pg")) if (shown(e) && (px(getComputedStyle(e).paddingLeft) > 16.5 || px(getComputedStyle(e).paddingRight) > 16.5)) out.pad.push(sel(e) + " side padding " + getComputedStyle(e).paddingLeft);
  for (const e of document.querySelectorAll(".card")) if (shown(e) && !e.classList.contains("flush") && px(getComputedStyle(e).paddingLeft) > 16.5) out.pad.push(sel(e) + " card padding " + getComputedStyle(e).paddingLeft);
  // 6. tables become cards
  for (const t of document.querySelectorAll(".rtable")) {
    if (!shown(t)) continue;
    const rows = Array.from(t.querySelectorAll("tbody tr")).filter(shown);
    const info = { id: sel(t), rows: rows.length, roles: t.getAttribute("role") === "table" && !!t.querySelector("thead [role=columnheader]") && rows.every((r) => r.getAttribute("role") === "row" && Array.from(r.children).every((c) => c.getAttribute("role") === "cell" && c.hasAttribute("data-label"))), display: getComputedStyle(t).display, rowW: rows.length ? Math.round(R(rows[0]).w) : 0, tw: Math.round(R(t).w), unlabelled: 0, sideBySide: 0 };
    for (const r of rows.slice(0, 2)) {
      const cells = Array.from(r.children).filter(shown);
      for (let i = 1; i < cells.length; i++) { if (R(cells[i]).t < R(cells[i - 1]).b - 1) info.sideBySide++; const b = getComputedStyle(cells[i], "::before"); if (b.content === "none" || b.content === "normal" || b.display === "none") info.unlabelled++; }
    }
    out.tables.push(info);
  }
  // 7. the verify card, the result card and the details window
  const row = document.querySelector(".signin-row");
  if (row && shown(row)) { const inp = row.querySelector("input"), btn = row.querySelector("button"), card = row.closest(".card"); out.misc.verify = { cardW: Math.round(R(card).w), inputW: Math.round(R(inp).w), btnW: Math.round(R(btn).w), btnH: Math.round(R(btn).h), stacked: R(btn).t >= R(inp).b - 1 }; }
  const rc = document.querySelector("#results .card");
  if (rc && shown(rc)) { const first = rc.children[0]; const block = first.children[0]; out.misc.result = { cardW: Math.round(R(rc).w), textW: Math.round(R(block).w), lines: Math.round(R(block).h / 22) }; }
  const bd = document.querySelector("#modalBackdrop.open");
  if (bd) { const m = bd.querySelector(".modal"), mr = R(m), br = R(bd); const rows2 = Array.from(bd.querySelectorAll(".source-row")); out.misc.modal = { backdropW: Math.round(br.w), modalL: Math.round(mr.l), modalR: Math.round(mr.r), vw, rows: rows2.length, rowsStacked: rows2.every((s) => { const kids = Array.from(s.children).filter(shown); return kids.length < 2 || R(kids[1]).t >= R(kids[0]).b - 1; }) }; }
  const foot = document.querySelector("footer.site-footer, footer .site-footer");
  if (foot) { const links = Array.from(document.querySelectorAll("footer a")).filter(shown); out.misc.footerRight = Math.max(0, ...links.map((a) => Math.round(R(a).r))); }
  return out;
})()`;

export function problems(m, ctx) {
  const P = [];
  const eps = 0.5;
  if (m.sw > m.vw + eps) P.push("the document scrolls sideways (" + m.sw + " wide in a " + m.vw + " window)");
  for (const o of m.over.slice(0, 4)) P.push("reaches past the right edge: " + o);
  // a labelled scroll area (data-scroll-area) may scroll sideways on a desktop window; on a phone nothing may
  for (const o of m.innerScroll.filter((x) => ctx.phone || !x.labelled).slice(0, 3)) P.push("scrolls sideways inside itself: " + o.s);
  if (ctx.phone) {
    for (const o of m.small.slice(0, 4)) P.push("touch target under 44 pixels: " + o);
    for (const o of m.smallFont.slice(0, 3)) P.push("form text under 16 pixels: " + o);
    for (const o of m.notStacked.slice(0, 3)) P.push("not one per row: " + o);
    for (const o of m.pad.slice(0, 3)) P.push("too much side space: " + o);
    for (const t of m.tables) {
      if (t.display !== "block") P.push("table " + t.id + " is not shown as cards (display " + t.display + ")");
      if (!t.roles) P.push("table " + t.id + " lost its table roles or a cell lost its data-label");
      if (t.rows && t.rowW < m.vw - 40) P.push("table " + t.id + " rows are only " + t.rowW + " wide");
      if (t.sideBySide) P.push("table " + t.id + " cells are side by side");
      if (t.unlabelled) P.push("table " + t.id + " has cells without a visible label");
    }
    const v = m.misc.verify;
    if (v) { if (!v.stacked) P.push("verify card: the email box and the button are side by side"); if (v.inputW < v.cardW - 40) P.push("verify card: the email box is only " + v.inputW + " of " + v.cardW); if (v.btnW < v.cardW - 40 || v.btnH < 43.5) P.push("verify card: the button is " + v.btnW + " x " + v.btnH); }
    const r = m.misc.result;
    if (r) { if (r.cardW < m.vw - 40) P.push("result card is only " + r.cardW + " wide"); if (r.textW < m.vw - 70) P.push("result card text has only " + r.textW + " pixels"); }
    const w = m.misc.modal;
    if (w) { if (w.backdropW > m.vw + eps) P.push("details window backdrop is " + w.backdropW + " wide in a " + m.vw + " window"); if (w.modalL < 0 || w.modalR > m.vw + eps) P.push("details window runs off the screen (" + w.modalL + " to " + w.modalR + ")"); if (w.rows && !w.rowsStacked) P.push("details window: a link's text and its Continue are squeezed side by side"); }
    if (m.misc.footerRight && m.misc.footerRight > m.vw + eps) P.push("footer link reaches " + m.misc.footerRight);
  }
  return P;
}

// ---- driving the states -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
let signedAs = null;
async function become(who) {
  if (signedAs === who) return; signedAs = who;
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  if (who === "out") return;
  await tab.goto(site.url + "/_dev/link?kind=" + (who === "poster" ? "poster" : "candidate"));
  assert.ok(await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000), "the fake sign-in link led to a stored session");
  await sleep(500);
}
async function openState(st, phoneWidth) {
  await become(st.who);
  await tab.viewport(phoneWidth, true);
  await tab.goto(site.url + "/" + st.page);
  await tab.waitFor("document.readyState === 'complete'");
  if (st.who === "poster") await tab.waitFor("!!document.querySelector('.avatar-btn')", 8000);
  if (st.table) await tab.waitFor("document.querySelectorAll('.rtable tbody tr').length > 0", 8000);
  if (st.page.startsWith("edit")) await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden", 8000);
  if (st.page.startsWith("comments") && st.who === "cand") await tab.waitFor("!document.querySelector('#threadWrap').hidden && document.querySelectorAll('#thread > *').length > 0", 8000);
  if (st.page.startsWith("comments") && st.who === "out") await tab.waitFor("!document.querySelector('#signinWrap').hidden", 8000);
  if (st.act === "verify") { await tab.eval("(() => { document.querySelector('#company').value = 'Meridian Health'; document.querySelector('#titleq').value = 'Analyst'; document.querySelector('#searchForm').requestSubmit(); })()"); await tab.waitFor("!document.querySelector('#signinWrap').hidden", 6000); }
  if (st.results) {
    await tab.eval("(() => { document.querySelector('#company').value = 'Meridian Health'; document.querySelector('#titleq').value = 'a'; document.querySelector('#searchForm').requestSubmit(); })()");
    assert.ok(await tab.waitFor("document.querySelectorAll('#results .card').length > 0", 8000), "the fake search returned results");
  }
  if (st.modal) { await tab.eval("document.querySelector('.view-details').click()"); assert.ok(await tab.waitFor("document.querySelector('#modalBackdrop.open') && document.querySelectorAll('#modalLinks .source-row').length > 0", 8000), "the details window opened"); }
  await sleep(350);
}

test("every page fits a phone window at 320, 360, 375, 390 and 414 (and the desktop widths 1024 and 1280 still do not scroll sideways)", { timeout: 600000 }, async () => {
  const bad = []; let measured = 0;
  for (const st of STATES) {
    await openState(st, 375);
    for (const w of WIDTHS) { await tab.viewport(w, true); await sleep(150); const m = await tab.eval(MEASURE); measured++; for (const p of problems(m, { phone: true })) bad.push(st.id + " at " + w + ": " + p); }
    for (const w of DESKTOP) { await tab.viewport(w, false); await sleep(150); const m = await tab.eval(MEASURE); measured++; for (const p of problems(m, { phone: false })) bad.push(st.id + " at " + w + " (desktop): " + p); }
  }
  assert.equal(measured, STATES.length * (WIDTHS.length + DESKTOP.length));
  assert.deepEqual(bad, [], "phone layout problems:\n" + bad.join("\n"));
});

// ---- negative controls: one fix undone at a time, on a state where it matters; the rule must catch it -------------------------------------------------------------------------------
const CONTROLS = [
  ["page side padding back to 64 pixels", "home", ".pg{padding-left:64px!important;padding-right:64px!important}"],
  ["cards back to 28 pixel padding", "Team", ".card{padding:28px!important}"],
  ["the home page's two columns do not stack", "home", ".cols{flex-direction:row!important}"],
  ["the sign-in page's headline sits beside the card", "employer sign-in", ".cols{flex-direction:row!important}"],
  ["the register page's form and side card are side by side", "Register an opening", ".cols{flex-direction:row!important}"],
  ["the edit page's Recent changes card is beside the form", "Edit an opening", ".cols{flex-direction:row!important}"],
  ["Job title and Req number side by side", "Register an opening", ".grid2{grid-template-columns:1fr 1fr!important}"],
  ["the three steps in a row on the home page", "home", ".grid3{grid-template-columns:1fr 1fr 1fr!important}"],
  ["My openings is a wide table again", "My openings", ".rtable,.rtable tbody,.rtable tr{display:revert!important}.rtable thead{display:revert!important}.rtable td,.rtable th{display:revert!important;white-space:nowrap!important;padding:14px 12px!important}.rtable td::before{display:none!important}"],
  ["the table cells lose their visible labels", "My openings", ".rtable td::before{content:none!important}"],
  ["Analytics keeps its wide table", "Analytics", ".rtable,.rtable tbody,.rtable tr,.rtable td{display:revert!important}.rtable td{white-space:nowrap!important;width:auto!important}.rtable td::before{display:none!important}"],
  ["the Team table keeps side-by-side cells", "Team", ".rtable td{display:inline-block!important;width:50%!important}"],
  ["the verify card's email box and button side by side", "search, signed out, verify card", ".signin-row{flex-direction:row!important}"],
  ["the verify card's button is small", "search, signed out, verify card", ".signin-row .btn{padding:2px 8px!important;font-size:12px!important;min-height:0!important;width:auto!important;align-self:flex-start!important}"],
  ["the footer cannot wrap", "home", ".site-footer,footer.wrapflex{flex-wrap:nowrap!important}footer.wrapflex a,.site-footer a{white-space:nowrap!important}footer.wrapflex,.site-footer{gap:0 60px!important}"],
  ["the results card is squeezed", "search, results", "#results .card{padding:0 90px!important}"],
  ["the details window is a fixed 480 pixels", "search, details window", ".modal{width:480px!important;max-width:none!important;flex:none!important}"],
  ["the details window backdrop is wider than the screen", "search, details window", ".modal-backdrop{width:520px!important}"],
  ["the details window's link and Continue are side by side", "search, details window", ".source-row{flex-direction:row!important}"],
  ["buttons are 30 pixels tall", "My openings", "main .btn,main button.btn,main a.btn{min-height:30px!important;height:30px!important}.filter-pill{min-height:30px!important;height:30px!important}"],
  ["form text is 12 pixels", "Register an opening", "input[type=text],input[type=email],select,textarea{font-size:12px!important}"],
  ["a wide element inside the page", "Edit an opening", "#form{width:560px!important}"],
  ["a labelled scroll area is not an excuse for sideways scrolling in a plain box", "My openings", ".card.flush{overflow-x:auto!important}.rtable{display:table!important;min-width:900px!important}.rtable thead,.rtable tbody{display:table-row-group!important}.rtable tr{display:table-row!important}.rtable td,.rtable th{display:table-cell!important}.rtable td::before{display:none!important}"],
];
test("negative controls: each phone fix undone makes the layout rule fail", { timeout: 900000 }, async () => {
  const missed = [];
  for (const [label, stateId, css] of CONTROLS) {
    const st = STATES.find((s) => s.id === stateId); assert.ok(st, "state " + stateId);
    await openState(st, 375);
    await tab.eval("(() => { const s = document.createElement('style'); s.id = 'ctl'; s.textContent = " + JSON.stringify(css) + "; document.head.append(s); })()");
    await sleep(200);
    const found = problems(await tab.eval(MEASURE), { phone: true });
    if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0] + ")");
  }
  assert.deepEqual(missed, [], "defects the layout rule did NOT catch: " + missed.join("; "));
});
