// bu.test.js - prompt BU (October 12, 2026), in a real browser set up like John's screen (tests/johns-screen.js) on the repo's own files with a fake backend (tests/fake-site.js; no real project, no key). Proven here:
//   1. the label of the public code is "KIO ID" on every page a person sees it, never "Opening ID": My openings (the column header at 1093, 1100 and 1366 pixels with no sideways scroll bar and the Title column at least
//      176 pixels, the cell label on a phone, the filter box and its accessible name, the note under the table), the editor's ID block, the Add confirmation, the candidate search page (the box label, the hints, the
//      explainer, the help text, the refusals, the empty-result notes, the recap with and without a company, the result line, the details window), the comments page (candidate and employer), the staff view, the home
//      page and the privacy page; a sweep of the text, the accessible names, the titles and the placeholders of every page finds no "Opening ID";
//   2. a column rule written for the header still matches it: the KIO ID column takes what its words need (no spare width), so a label and its style rule cannot drift apart;
//   3. a draft whose publish window ended sorts with the closed and expired rows in both Closes directions, among them by its publish-by day; Added and Title are unchanged; the Expiring pill does not hold it; its
//      Closes cell reads "Ended <day>" since prompt BV (BU left it "Publish by <day>"), and a draft with time left still reads "Publish by <day>".
// Then negative controls: one deliberate defect at a time in the page code or the style; each must make a scenario fail. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/bu.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startFakeSite, kioOf } from "./fake-site.js";
import { johnsBrowser, johnsWindow, johnsRows, MEASURE, DAY } from "./johns-screen.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = JSON.stringify;
let browser;
before(async () => { browser = await johnsBrowser(); });
after(async () => { if (browser) await browser.close(); });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (ms) => { const d = new Date(ms); return MONTHS[d.getMonth()] + " " + d.getDate(); };
const iso = (ms) => new Date(ms).toISOString();
const FIRST = kioOf("D21M48YBZQBF");
const EDIT = "edit.html?id=3f1d5b1e-0000-4000-8000-000000000001";
const WITH_LINKS = "d21m48ybzqbfxxxxxxxx";
const STAFF = "staff@example.test";

// the page expression: every place a person could read the old word on the page that is open now (text, accessible names, titles, placeholders, alt text, the cell labels of the phone list)
const SWEEP = `(() => { const re = /opening(\\s|\\u00a0)+id/i, hits = [];
  for (const e of document.querySelectorAll('*')) { if (/^(SCRIPT|STYLE)$/.test(e.tagName)) continue;
    for (const a of ['aria-label', 'title', 'placeholder', 'alt', 'aria-description', 'data-label', 'value']) { const v = e.getAttribute(a); if (v && re.test(v)) hits.push(e.tagName.toLowerCase() + ' ' + a + ': ' + v.slice(0, 90)); }
    for (const n of e.childNodes) if (n.nodeType === 3 && re.test(n.nodeValue)) hits.push(e.tagName.toLowerCase() + ' text: ' + n.nodeValue.trim().slice(0, 90)); }
  return hits; })()`;

async function withSite(root, opts, fn) { const site = await startFakeSite(root, { kio: true, ...opts }); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }
async function signIn(tab, site, kind, email) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  if (kind === "out") return;
  await tab.goto(site.url + "/_dev/link?kind=" + kind + (email ? "&email=" + encodeURIComponent(email) : "")); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
const text = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; })()");
const content = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; })()");
const typeIn = (tab, sel, value) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); e.value = " + q(value) + "; e.dispatchEvent(new Event('input', { bubbles: true })); })()");
const click = (tab, sel) => tab.eval("document.querySelector(" + q(sel) + ").click()");
const pill = (tab, label) => tab.eval("(() => { const b = Array.from(document.querySelectorAll('#filters .filter-pill')).find((x) => x.textContent.trim() === " + q(label) + "); if (!b) throw new Error('no pill ' + " + q(label) + "); b.click(); })()");
const pickSort = (tab, value) => tab.eval("(() => { const s = document.querySelector('#sortBox'); s.value = " + q(value) + "; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
const titles = (tab) => tab.eval("Array.from(document.querySelectorAll('tbody tr')).map((tr) => tr.querySelector('td').firstChild.textContent.trim())");
const closesOf = (tab) => tab.eval("Object.fromEntries(Array.from(document.querySelectorAll('tbody tr')).map((tr) => [tr.querySelector('td').firstChild.textContent.trim(), (tr.querySelector('td[data-label=\"Closes\"] .dt') || tr.querySelector('td[data-label=\"Closes\"]')).innerText.replace(/\\s+/g, ' ').trim()]))");   // (prompt BV: the date words only, without the flag line under them)
async function openDash(tab, site, width, phone = false) {
  await signIn(tab, site, "poster");
  if (phone) await tab.viewport(width, true, 800); else await johnsWindow(tab, width, 500);
  await tab.goto(site.url + "/dashboard.html");
  await tab.waitFor("document.querySelectorAll('tbody tr').length > 0", 10000);
  await tab.waitFor("document.fonts.status === 'loaded'", 10000); await sleep(400);
}
async function openSearch(tab, site, hash = "") {
  await tab.goto(site.url + "/search.html" + hash); await tab.waitFor("document.readyState === 'complete' && !!document.getElementById('company')", 15000); await sleep(600);
}
const fill = (tab, company, title, req = "") => tab.eval("(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; set('company', " + q(company) + "); set('titleq', " + q(title) + "); set('reqq', " + q(req) + "); })()");
const pressSearch = async (tab) => { await tab.eval("document.getElementById('searchBtn').focus()"); await tab.key("Enter"); };

// the rows of the sort scenario: open rows and ended rows of every kind, including two drafts whose publish window ended
function sortRows(now = Date.now()) {
  const base = (title, o) => Object.assign({ title, is_remote: false, locations: ["Austin, TX"], location_ids: [], source_location_text: null, bump_used: false, bump_days: null, posted_at: iso(now - 12 * DAY), publish_by: null, go_live_at: null, closed_reason: null, created_at: iso(now - 20 * DAY) }, o);
  const list = [
    base("Alpha Live", { status: "live", stored_status: "live", expiration_date: iso(now + 20 * DAY) }),
    base("Bravo Closed", { status: "closed", stored_status: "closed", closed_reason: "filled", expiration_date: iso(now + 30 * DAY), closed_at: iso(now - 5 * DAY) }),
    base("Charlie Closed", { status: "closed", stored_status: "closed", closed_reason: "withdrawn", expiration_date: iso(now + 60 * DAY), closed_at: iso(now - 2 * DAY) }),
    base("Delta Expired", { status: "expired", stored_status: "live", closed_reason: "expired_no_action", expiration_date: iso(now - 4 * DAY) }),
    base("Echo Closed Undated", { status: "closed", stored_status: "closed", closed_reason: "filled", expiration_date: iso(now + 10 * DAY) }),
    base("Foxtrot Paused", { status: "paused", stored_status: "paused", expiration_date: iso(now + 3 * DAY) }),
    base("Hotel Dead Draft", { status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: iso(now - 3 * DAY), created_at: iso(now - 17 * DAY) }),
    base("India Dead Draft Older", { status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: iso(now - 9 * DAY), created_at: iso(now - 23 * DAY) }),
    base("Juliet Draft Alive", { status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: iso(now + 6 * DAY), created_at: iso(now - 8 * DAY) }),
    base("Kilo Scheduled", { status: "scheduled", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: null, go_live_at: iso(now + 2 * DAY), created_at: iso(now - 5 * DAY) }),
  ];
  return { plan: "verified", mineOverrides: list.slice(0, 5), mineExtra: list.slice(5) };
}

const SCENARIOS = {
  // ---- 1. My openings: the header at three widths, the column rule, the phone label, the filter box, the note
  async myOpenings(root) { return withSite(root, johnsRows(), (site) => withTab(async (tab) => { const bad = [];
    for (const width of [1093, 1100, 1366]) {
      await openDash(tab, site, width);
      const m = await tab.eval(MEASURE);
      const names = m.ths.map((t) => t.name);
      if (!names.includes("KIO ID")) bad.push(width + ": the column header is not KIO ID (" + names.join("|") + ")");
      if (names.some((n) => /opening\s*id/i.test(n))) bad.push(width + ": a header still says Opening ID");
      if (JSON.stringify(names.slice(0, 3)) !== JSON.stringify(["Title", "Req #", "KIO ID"])) bad.push(width + ": the first three headers are " + names.slice(0, 3).join("|"));
      if (m.pageScroll) bad.push(width + ": the page scrolls sideways");
      if (m.sideScroll) bad.push(width + ": the table scrolls sideways inside its card");
      const title = m.ths.find((t) => t.name === "Title");
      if (!title || title.w < 176) bad.push(width + ": the Title column is " + (title && title.w) + " pixels (176 at least)");
      const ids = await tab.eval(`Array.from(document.querySelectorAll('tbody td[data-label="KIO ID"]')).map((td) => { const r = document.createRange(); r.selectNodeContents(td); const cs = getComputedStyle(td);
        return { t: td.textContent.trim(), over: td.scrollWidth > td.clientWidth + 1, spare: Math.round(td.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - r.getBoundingClientRect().width), ws: cs.whiteSpace }; })`);
      if (ids.length < 5) bad.push(width + ": only " + ids.length + " cells are labelled KIO ID");
      if (ids.some((x) => !/^KIO-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(x.t))) bad.push(width + ": a KIO ID cell reads " + q(ids.map((x) => x.t)));
      if (ids.some((x) => x.over)) bad.push(width + ": an ID is cut off in its cell");
      // 2. the column rule written for the label still matches it: the column takes what its words need and no spare width, at the roomy window (the narrower ones fit the table by sharing the width)
      if (width === 1366 && ids.some((x) => x.spare > 4)) bad.push(width + ": the KIO ID column has " + Math.max(...ids.map((x) => x.spare)) + " pixels of spare width (the column rule no longer matches the label)");
      if (ids.some((x) => x.ws !== "nowrap")) bad.push(width + ": a KIO ID cell may wrap (" + q(ids.map((x) => x.ws)) + ")");
      // the style rule that gives the column its width matches the label of its cells (asked of the browser: the rule's selector against the cell)
      const ruled = await tab.eval(`(() => { const td = document.querySelector('tbody td[data-label="KIO ID"]'); if (!td) return false; let hit = false;
        const visit = (rules) => { for (const r of rules) { if (r.selectorText && r.style && r.style.width === '1%' && td.matches(r.selectorText)) hit = true; if (r.cssRules && r.cssRules.length) visit(r.cssRules); } };
        for (const s of document.styleSheets) { try { visit(s.cssRules); } catch (e) { /* a sheet from another site */ } } return hit; })()`);
      if (width === 1366 && !ruled) bad.push(width + ": no style rule gives the KIO ID column its width (the column rule no longer matches the label)");
    }
    // the filter box and the note under the table
    const f = await tab.eval("({ ph: document.getElementById('textFilter').getAttribute('placeholder'), aria: document.getElementById('textFilter').getAttribute('aria-label') })");
    if (f.ph !== "Filter by title, req # or KIO ID") bad.push("the filter box placeholder is '" + f.ph + "'");
    if (f.aria !== "Filter by title, req number or KIO ID") bad.push("the filter box accessible name is '" + f.aria + "'");
    if ((await text(tab, "#postIdNote")) !== "You may place an opening's KIO ID on your own site: it lets candidates find the opening exactly.") bad.push("the note under the table says '" + (await text(tab, "#postIdNote")) + "'");
    // typing an ID into the filter still finds the opening (the filter is about the value, not the label). The filter compares with the stored form (no hyphens); typing the shown form with its hyphens finds
    // nothing today and is reported, not changed, by prompt BU
    const some = await tab.eval("((document.querySelector('tbody td[data-label=\"KIO ID\"]') || { textContent: '' }).textContent.trim().replace(/-/g, ''))");
    await typeIn(tab, "#textFilter", some); await sleep(300);
    if ((await tab.eval("document.querySelectorAll('tbody tr').length")) < 1) bad.push("the filter finds nothing for an ID typed from the table");
    const hits = await tab.eval(SWEEP);
    if (hits.length) bad.push("the page still says Opening ID: " + q(hits.slice(0, 4)));
    // a phone: the cell carries the label the card list shows
    await openDash(tab, site, 375, true);
    const ph = await tab.eval(`(() => { const td = document.querySelector('tbody td[data-label="KIO ID"]'); return td ? { label: td.getAttribute('data-label'), before: getComputedStyle(td, '::before').content } : null; })()`);
    if (!ph) bad.push("a phone: no cell is labelled KIO ID");
    else if (ph.before && ph.before !== "none" && ph.before !== "normal" && !/KIO ID/.test(ph.before)) bad.push("a phone: the label shown is " + ph.before);
    return bad; })); },
  // ---- 3. the draft whose publish window ended, in the Closes sort
  async deadDraft(root) { return withSite(root, sortRows(), (site) => withTab(async (tab) => { const bad = [], now = Date.now();
    await openDash(tab, site, 1366);
    const OPEN_ASC = ["Kilo Scheduled", "Foxtrot Paused", "Juliet Draft Alive", "Alpha Live"];                        // goes live in 2 days, closes in 3, publish by in 6, closes in 20
    const ENDED_ASC = ["India Dead Draft Older", "Bravo Closed", "Delta Expired", "Hotel Dead Draft", "Charlie Closed", "Echo Closed Undated"];   // by the day each ended: -9, -5, -4, -3, -2, none
    const ENDED_DESC = ["Charlie Closed", "Hotel Dead Draft", "Delta Expired", "Bravo Closed", "India Dead Draft Older", "Echo Closed Undated"];
    await pickSort(tab, "closes_asc"); await sleep(300);
    let t = await titles(tab);
    if (JSON.stringify(t) !== JSON.stringify(OPEN_ASC.concat(ENDED_ASC))) bad.push("Closes soonest first: " + q(t));
    await pickSort(tab, "closes_desc"); await sleep(300);
    t = await titles(tab);
    if (JSON.stringify(t) !== JSON.stringify(OPEN_ASC.slice().reverse().concat(ENDED_DESC))) bad.push("Closes furthest first: " + q(t));
    // the pills: a dead draft is under Draft (after the draft that is still open, in both directions) and never under Expiring
    await pill(tab, "Draft"); await pickSort(tab, "closes_asc"); await sleep(300);
    t = await titles(tab);
    if (JSON.stringify(t) !== JSON.stringify(["Juliet Draft Alive", "India Dead Draft Older", "Hotel Dead Draft"])) bad.push("Draft pill, soonest first: " + q(t));
    await pickSort(tab, "closes_desc"); await sleep(300);
    t = await titles(tab);
    if (JSON.stringify(t) !== JSON.stringify(["Juliet Draft Alive", "Hotel Dead Draft", "India Dead Draft Older"])) bad.push("Draft pill, furthest first: " + q(t));
    await pill(tab, "Expiring"); await sleep(300);
    t = await titles(tab);
    if (JSON.stringify(t) !== JSON.stringify(["Juliet Draft Alive"])) bad.push("Expiring holds " + q(t) + " (only the draft with time left)");
    // the Closes cell of a dead draft keeps its words; the others keep theirs
    await pill(tab, "All"); await sleep(300);
    const c = await closesOf(tab);
    // prompt BV (October 12, 2026): the cell of a draft whose window ended reads "Ended <day>" (BU left it "Publish by <day>", pending John's word); a draft with time left still reads "Publish by"
    if (c["Hotel Dead Draft"] !== "Ended " + day(now - 3 * DAY)) bad.push("a dead draft's Closes cell reads '" + c["Hotel Dead Draft"] + "'");
    if (c["Juliet Draft Alive"] !== "Publish by " + day(now + 6 * DAY)) bad.push("a draft with time left reads '" + c["Juliet Draft Alive"] + "'");
    if (c["Bravo Closed"] !== "Closed " + day(now - 5 * DAY)) bad.push("a closed row's Closes cell reads '" + c["Bravo Closed"] + "'");
    // the other sorts are as they were
    await pickSort(tab, "title_asc"); await sleep(300);
    t = await titles(tab);
    const want = t.slice().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
    if (JSON.stringify(t) !== JSON.stringify(want) || t.length !== 10) bad.push("Title A to Z changed: " + q(t));
    await pickSort(tab, "added_desc"); await sleep(300);
    t = await titles(tab);
    // added 5, 8, 17 days ago, then six rows added 20 days ago (by title), then 23 days ago: a dead draft is not moved by this sort
    const ADDED = ["Kilo Scheduled", "Juliet Draft Alive", "Hotel Dead Draft", "Alpha Live", "Bravo Closed", "Charlie Closed", "Delta Expired", "Echo Closed Undated", "Foxtrot Paused", "India Dead Draft Older"];
    if (JSON.stringify(t) !== JSON.stringify(ADDED)) bad.push("Added, newest first changed: " + q(t));
    return bad; })); },
  // ---- 1. the employer's ID block (the editor) and the confirmation of a new opening
  async editorBlock(root) { return withSite(root, {}, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site, "poster");
    await tab.goto(site.url + "/" + EDIT); await tab.waitFor("!!document.getElementById('kioBlock')", 10000); await sleep(500);
    const labels = await tab.eval("Array.from(document.querySelectorAll('#kioBlock .kio-label')).map((e) => e.textContent.trim())");
    if (labels[0] !== "KIO ID") bad.push("the editor's ID block is labelled '" + labels[0] + "'");
    if (!/^KIO-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test((await text(tab, "#postId")) || "")) bad.push("the editor's ID reads '" + (await text(tab, "#postId")) + "'");
    const lines = await tab.eval("Array.from(document.querySelectorAll('#kioAdLines .kio-adline')).map((e) => e.textContent)");
    if (!/^KIO ID: KIO-/.test(lines[0] || "")) bad.push("the first job ad line reads '" + lines[0] + "'");
    const hits = await tab.eval(SWEEP);
    if (hits.length) bad.push("the editor still says Opening ID: " + q(hits.slice(0, 4)));
    return bad; })); },
  async confirmation(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site, "poster");
    await tab.viewport(1280, false);
    await tab.goto(site.url + "/register.html");
    await tab.waitFor("!!document.querySelector('#jtitle') && !!document.querySelector('#locOutside') && document.readyState === 'complete'", 10000).catch(() => null); await sleep(700);
    await tab.eval("window.confirm = () => true;");
    await typeIn(tab, "#jtitle", "Support Analyst"); await typeIn(tab, "#req", "R-2026-77"); await typeIn(tab, "#closeout", "Closes when the role is filled"); await typeIn(tab, "#desc", "A plain description of the role.");
    await typeIn(tab, "#locq", "Austin");
    await tab.waitFor("document.querySelectorAll('#locList li').length > 0", 10000);
    await tab.eval("document.querySelector('#locList li').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))"); await sleep(200);
    await click(tab, "#draftBtn");
    await tab.waitFor("!document.querySelector('#result').hidden && !!document.querySelector('#result .kio-block')", 10000).catch(() => null); await sleep(400);
    const heading = await tab.eval("(() => { const b = document.querySelector('#result .kio-block'); const p = b && b.previousElementSibling; return p ? p.textContent.trim() : null; })()");
    if (heading !== "Your KIO ID") bad.push("the confirmation's heading over the ID is '" + heading + "'");
    const labels = await tab.eval("Array.from(document.querySelectorAll('#result .kio-label')).map((e) => e.textContent.trim())");
    if (labels[0] !== "KIO ID") bad.push("the confirmation's ID block is labelled '" + labels[0] + "'");
    const hits = await tab.eval(SWEEP);
    if (hits.length) bad.push("the confirmation still says Opening ID: " + q(hits.slice(0, 4)));
    return bad; })); },
  // ---- 1. the candidate's search page
  async searchPage(root) { return withSite(root, {}, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site, "candidate");
    await openSearch(tab, site);
    const label = await tab.eval("document.querySelector('label[for=\"titleq\"]').firstChild.textContent.trim()");
    if (label !== "KIO ID, or part of the title") bad.push("the box label is '" + label + "'");
    if ((await text(tab, "#titleHint")) !== "A KIO ID is exact. No KIO ID? Use part of the title.") bad.push("the hint says '" + (await text(tab, "#titleHint")) + "'");
    const guide = (await text(tab, "#searchGuide")) || "";
    for (const s of ["Easiest and most exact: the KIO ID from the employer's job ad (no company name needed), or the company name plus the requisition (req) number.", "No KIO ID? Use the company name plus part of the job title, copied from the job ad if you can."]) if (!guide.includes(s)) bad.push("the explainer lacks: " + s);
    if (!((await text(tab, "#companyHint")) || "").endsWith("Not needed with a KIO ID.")) bad.push("the company hint says '" + (await text(tab, "#companyHint")) + "'");
    if ((await text(tab, "#reqHint")) !== "Company is required, unless you type a KIO ID. Then fill in one of the other two boxes: the req number, or the KIO ID / title box, not both. The req number is hidden as you type; press Show to check it.") bad.push("the sentence under the form says '" + (await text(tab, "#reqHint")) + "'");
    if (!((await text(tab, "#titleNote")) || "").endsWith("Closed or expired openings are found only by KIO ID or req number.")) bad.push("the second line under the form says '" + (await text(tab, "#titleNote")) + "'");
    // the help text: the heading, the accessible names, the list items (grammar: a KIO ID)
    const tips = await tab.eval("Array.from(document.querySelectorAll('.info-icon')).map((e) => ({ aria: e.getAttribute('aria-label') || '', title: ((e.querySelector('.tip-title') || {}).textContent || '').trim(), items: Array.from(e.querySelectorAll('li')).map((l) => l.textContent.trim()) }))");
    const idTip = tips.find((x) => /^What's a KIO ID\?/.test(x.aria));
    if (!idTip) bad.push("no help text asks 'What's a KIO ID?' (" + q(tips.map((x) => x.title)) + ")");
    else {
      if (idTip.title !== "What's a KIO ID?") bad.push("the help heading is '" + idTip.title + "'");
      if (!idTip.aria.includes("No KIO ID handy? Type part of the job title instead; this box takes either.")) bad.push("the help accessible name lacks the last sentence");
      if (!idTip.items.includes("No KIO ID handy? Type part of the job title instead; this box takes either")) bad.push("the help list lacks the last item");
    }
    const reqTip = tips.find((x) => /^What's the req number\?/.test(x.aria));
    if (!reqTip || !reqTip.aria.includes("try the KIO ID, or part of the title.") || !reqTip.items.some((l) => l.endsWith("try the KIO ID, or part of the title"))) bad.push("the req number help does not send the person to the KIO ID");
    // the refusals
    await fill(tab, "", ""); await pressSearch(tab); await sleep(400);
    if ((await text(tab, "#formError")) !== "Enter the company name (at least 2 letters or digits).") bad.push("an empty form says '" + (await text(tab, "#formError")) + "'");
    await fill(tab, "Meridian Health", ""); await pressSearch(tab); await sleep(400);
    if ((await text(tab, "#formError")) !== "Enter a req number, a KIO ID or part of the job title.") bad.push("no lookup value says '" + (await text(tab, "#formError")) + "'");
    await fill(tab, "Meridian Health", "Nurse", "R-1"); await pressSearch(tab); await sleep(400);
    if ((await text(tab, "#formError")) !== "Fill in the req number, or the KIO ID / title box, not both.") bad.push("both boxes say '" + (await text(tab, "#formError")) + "'");
    await fill(tab, "Meridian Health", "--"); await pressSearch(tab); await sleep(400);
    if ((await text(tab, "#formError")) !== "Enter some letters or digits from the job title, or a KIO ID.") bad.push("a title with no letters says '" + (await text(tab, "#formError")) + "'");
    // a search that finds nothing: the notes
    await fill(tab, "Zzyzx Unknown", "Nurse"); await pressSearch(tab); await sleep(1000);
    const none = (await text(tab, "#results")) || "";
    if (!none.includes("check the KIO ID exactly as it is printed in the job ad") || !none.includes("found only by KIO ID or req number.")) bad.push("the empty-result note says '" + none.slice(0, 400) + "'");
    await tab.eval("(() => { const b = document.getElementById('recapEdit'); if (b) b.click(); })()");
    await fill(tab, "Zzyzx Unknown", "", "R-9999"); await pressSearch(tab); await sleep(1000);
    const noneReq = (await text(tab, "#results")) || "";
    if (!noneReq.includes("If the job ad shows a KIO ID, try that instead.")) bad.push("the req number's empty-result note says '" + noneReq.slice(0, 300) + "'");
    // the recap, the result line and the details window
    await tab.eval("(() => { const b = document.getElementById('recapEdit'); if (b) b.click(); })()");
    await fill(tab, "Meridian Health", FIRST.shown); await pressSearch(tab);
    await tab.waitFor("!document.getElementById('recap').hidden", 8000); await sleep(600);
    if ((await text(tab, "#recapText")) !== "You searched for: company Meridian Health, KIO ID: " + FIRST.shown + ". Your results are below.") bad.push("the recap with a company says '" + (await text(tab, "#recapText")) + "'");
    if (!((await text(tab, "#results")) || "").includes("KIO ID: " + FIRST.shown)) bad.push("the result line does not read 'KIO ID: " + FIRST.shown + "'");
    await tab.eval("document.querySelector('#results .view-details').click()"); await sleep(600);
    const refs = await text(tab, "#modalRefs");
    if (!refs || !refs.startsWith("KIO ID: " + FIRST.shown)) bad.push("the details window line reads '" + refs + "'");
    await tab.eval("document.getElementById('modalClose').click()"); await sleep(300);
    await tab.eval("document.getElementById('recapEdit').click()");
    await fill(tab, "", FIRST.shown); await pressSearch(tab);
    await tab.waitFor("!document.getElementById('recap').hidden", 8000); await sleep(600);
    if ((await text(tab, "#recapText")) !== "You searched for: KIO ID: " + FIRST.shown + ". Your results are below.") bad.push("the recap without a company says '" + (await text(tab, "#recapText")) + "'");
    // an old 12 character code typed into the box is still never printed
    await tab.eval("document.getElementById('recapEdit').click()");
    await fill(tab, "Meridian Health", "D21M-48YB-ZQBF"); await pressSearch(tab); await sleep(1000);
    const old = (await text(tab, "#recapText")) || "";
    if (old && (old.includes("D21M") || !old.includes("a KIO ID was entered"))) bad.push("an old code's recap says '" + old + "'");
    const hits = await tab.eval(SWEEP);
    if (hits.length) bad.push("the search page still says Opening ID: " + q(hits.slice(0, 4)));
    return bad; })); },
  // ---- 1. the comments page (candidate and employer), the staff view
  async commentsAndStaff(root) { return withSite(root, {}, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site, "candidate");
    await tab.goto(site.url + "/comments.html?ref=" + WITH_LINKS);
    await tab.waitFor("!document.querySelector('#threadWrap').hidden || !document.querySelector('#pageAlert').hidden", 10000); await sleep(500);
    const m = (await text(tab, "#recapMeta")) || "";
    if (!/ · KIO ID: \S+/.test(m) || /Opening ID/.test(m)) bad.push("the candidate's comments page line reads '" + m + "'");
    let hits = await tab.eval(SWEEP);
    if (hits.length) bad.push("the comments page (candidate) still says Opening ID: " + q(hits.slice(0, 4)));
    await signIn(tab, site, "poster");
    await tab.goto(site.url + "/comments.html?id=3f1d5b1e-0000-4000-8000-000000000001");
    await tab.waitFor("!!document.querySelector('#recapMeta') && document.querySelector('#recapMeta').textContent.trim() !== ''", 10000).catch(() => null); await sleep(500);
    const e = (await text(tab, "#recapMeta")) || "";
    if (!/^KIO ID: \S+ · /.test(e)) bad.push("the employer's comments page line reads '" + e + "'");
    hits = await tab.eval(SWEEP);
    if (hits.length) bad.push("the comments page (employer) still says Opening ID: " + q(hits.slice(0, 4)));
    return bad; })); },
  async staffView(root) { return withSite(root, {}, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site, "candidate", STAFF);
    await openSearch(tab, site, "?scope=all");
    await fill(tab, "Meridian", "Analyst"); await pressSearch(tab);
    await tab.waitFor("document.querySelectorAll('#results .staff-card').length > 0", 12000).catch(() => null); await sleep(500);
    const cards = await tab.eval("Array.from(document.querySelectorAll('#results .staff-card')).map((c) => c.innerText.replace(/\\s+/g, ' ').trim())");
    if (cards.length < 2) bad.push("the staff view has " + cards.length + " cards");
    if (cards.some((c) => /Opening ID/.test(c)) || !cards.some((c) => / · KIO ID: KIO-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}/.test(c))) bad.push("a staff card line is not 'KIO ID: <ID>': " + q(cards.slice(0, 2)).slice(0, 400));
    const hits = await tab.eval(SWEEP);
    if (hits.length) bad.push("the staff view still says Opening ID: " + q(hits.slice(0, 4)));
    return bad; })); },
  // ---- 1. the other pages: the home page, the privacy page, and a sweep of every page for the old words
  async otherPages(root) { return withSite(root, {}, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site, "out");
    await tab.goto(site.url + "/index.html"); await tab.waitFor("document.readyState === 'complete'", 10000); await sleep(400);
    const home = (await text(tab, "main")) || (await text(tab, "body")) || "";
    if (!home.includes("Remote · KIO ID: KIO-EV9B-V8ZV-Q45P")) bad.push("the home page's sample card line is not 'KIO ID: KIO-...' (prompt BV: the whole sample ID)");
    if (!home.includes("Title, location, dates, and a KIO ID. Included on every tier.")) bad.push("the home page's first step does not say a KIO ID");
    if (!home.includes("or by company and KIO ID or title, before applying.")) bad.push("the home page's third step does not say KIO ID");
    await tab.goto(site.url + "/privacy.html"); await tab.waitFor("document.readyState === 'complete'", 10000); await sleep(300);
    if (!((await text(tab, "#privacyEmails")) || "").includes("These emails carry the opening's title and KIO ID, never")) bad.push("the privacy page's email sentence does not say KIO ID");
    for (const p of ["index.html", "search.html", "privacy.html", "employer-signin.html", "404.html", "no-such-page"]) {
      await tab.goto(site.url + "/" + p); await sleep(500);
      const h = await tab.eval(SWEEP);
      if (h.length) bad.push(p + " still says Opening ID: " + q(h.slice(0, 3)));
    }
    await signIn(tab, site, "poster");
    for (const p of ["dashboard.html", "register.html", EDIT, "team.html", "analytics.html"]) {
      await tab.goto(site.url + "/" + p); await sleep(900);
      const h = await tab.eval(SWEEP);
      if (h.length) bad.push(p.split("?")[0] + " still says Opening ID: " + q(h.slice(0, 3)));
    }
    return bad; })); },
};

test("BU: the label KIO ID on every page, the column rule that follows it, and a draft whose publish window ended sorted with the ended rows", { timeout: 1800000 }, async () => {
  const problems = [];
  for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](ROOT)) problems.push(n + ": " + p);
  assert.deepEqual(problems, [], "BU problems:\n" + problems.join("\n"));
});

// ---- negative controls: [label, scenarios, [[file, mutate]]]
const DEFECTS = [
  ["the My openings header says Opening ID", ["myOpenings"], [["js/pages/dashboard.js", (s) => s.replace('["Title", "Req #", "KIO ID", ...', '["Title", "Req #", "Opening ID", ...')]]],
  ["the cell label says Opening ID", ["myOpenings"], [["js/pages/dashboard.js", (s) => s.replace('"data-label": "KIO ID", class: "mono"', '"data-label": "Opening ID", class: "mono"')]]],
  ["the column rule keeps the old label", ["myOpenings"], [["app.css", (s) => s.replace('.my-openings td[data-label="Closes"],.my-openings td[data-label="KIO ID"],.my-openings td[data-label="Comments"],.my-openings td[data-label="Status"]{width:1%;white-space:nowrap}', '.my-openings td[data-label="Closes"],.my-openings td[data-label="Opening ID"],.my-openings td[data-label="Comments"],.my-openings td[data-label="Status"]{width:1%;white-space:nowrap}')]]],
  ["the filter box's accessible name says Opening ID", ["myOpenings"], [["dashboard.html", (s) => s.replace('aria-label="Filter by title, req number or KIO ID"', 'aria-label="Filter by title, req number or Opening ID"')]]],
  ["the note under the table says Opening ID", ["myOpenings"], [["dashboard.html", (s) => s.replace("You may place an opening's KIO ID on your own site", "You may place an opening's Opening ID on your own site")]]],
  ["the editor's ID block says Opening ID", ["editorBlock", "confirmation"], [["js/kio-block.js", (s) => s.replace('h("span", { class: "kio-label" }, "KIO ID"),', 'h("span", { class: "kio-label" }, "Opening ID"),')]]],
  ["the confirmation says Your Opening ID", ["confirmation"], [["js/pages/register.js", (s) => s.replace('}, "Your KIO ID"),', '}, "Your Opening ID"),')]]],
  ["the search box label says Opening ID", ["searchPage"], [["search.html", (s) => s.replace(">KIO ID, or part of the title\n", ">Opening ID, or part of the title\n")]]],
  ["the box hint says Opening ID", ["searchPage"], [["search.html", (s) => s.replace("A KIO ID is exact. No KIO ID? Use part of the title.", "An Opening ID is exact. No ID? Use part of the title.")]]],
  ["the explainer says Opening ID", ["searchPage"], [["search.html", (s) => s.replace("the KIO ID from the employer's job ad", "the Opening ID from the employer's job ad")]]],
  ["the help heading says Opening ID", ["searchPage"], [["search.html", (s) => s.replace("<span class=\"tip-title\">What's a KIO ID?</span>", "<span class=\"tip-title\">What's an Opening ID?</span>")]]],
  ["the empty box refusal says Opening ID", ["searchPage"], [["js/search-input.js", (s) => s.replace('message: "Enter a req number, a KIO ID or part of the job title."', 'message: "Enter a req number, an Opening ID or part of the job title."')]]],
  ["the empty-result note says the ID", ["searchPage"], [["js/search-input.js", (s) => s.replace("check the KIO ID exactly as it is printed", "check the ID exactly as it is printed")]]],
  ["the recap says Opening ID", ["searchPage"], [["js/search-recap.js", (s) => s.replace('KIO: "KIO ID: ",', 'KIO: "Opening ID ",')]]],
  ["the result line says Opening ID", ["searchPage"], [["js/pages/search.js", (s) => s.replace('" · KIO ID: " + openingIdText(row)', '" · Opening ID " + openingIdText(row)')]]],
  ["the details window says Opening ID", ["searchPage"], [["js/pages/search.js", (s) => s.replace('textContent = "KIO ID: " + openingIdText(row)', 'textContent = "Opening ID " + openingIdText(row)')]]],
  ["an old code's recap says an Opening ID", ["searchPage"], [["js/search-recap.js", (s) => s.replace('CODE: "a KIO ID was entered",', 'CODE: "an Opening ID was entered",')]]],
  ["the comments page line says Opening ID", ["commentsAndStaff"], [["js/pages/comments.js", (s) => s.replace('" · KIO ID: " + p.masked_code', '" · Opening ID " + p.masked_code')]]],
  ["the employer's comments line says Opening ID", ["commentsAndStaff"], [["js/pages/comments.js", (s) => s.replace('"KIO ID: " + groupCode(p.post_id)', '"Opening ID " + groupCode(p.post_id)')]]],
  ["the staff card line says Opening ID", ["staffView"], [["js/staff-scope.js", (s) => s.replace('" · KIO ID: " + row.opening_id', '" · Opening ID " + row.opening_id')]]],
  ["the home page sample says Opening ID", ["otherPages"], [["index.html", (s) => s.replace("Remote · KIO ID: <span", "Remote · Opening ID <span")]]],
  ["the privacy page says Opening ID", ["otherPages"], [["privacy.html", (s) => s.replace("the opening's title and KIO ID, never", "the opening's title and Opening ID, never")]]],
  ["a draft whose window ended sorts with the open rows", ["deadDraft"], [["js/dashboard-model.js", (s) => s.replace("const ea = isEnded(a, nowMs), eb = isEnded(b, nowMs);", "const ea = isOver(a), eb = isOver(b);")]]],
  ["the ended rows go first in the descending order", ["deadDraft"], [["js/dashboard-model.js", (s) => s.replace("if (ea !== eb) return ea ? 1 : -1; const x", "if (ea !== eb) return ea ? (sign > 0 ? 1 : -1) : (sign > 0 ? -1 : 1); const x")]]],
  ["a dead draft is counted as time left in the Expiring pill", ["deadDraft"], [["js/dashboard-model.js", (s) => s.replace('export const isExpiring = (p, nowMs) => p.status === "draft" && leftWithinFlag(p, nowMs) !== null && !isClosingSoon(p, nowMs);', 'export const isExpiring = (p, nowMs) => p.status === "draft" && lapseAt(p) !== null && Date.parse(lapseAt(p)) - nowMs <= EXPIRY_FLAG_DAYS * DAY_MS && !isClosingSoon(p, nowMs);')]]],
  ["the Added sort puts a dead draft last", ["deadDraft"], [["js/dashboard-model.js", (s) => s.replace('default: return list.sort(tie);', 'default: return list.sort((a, b) => publishWindowEnded(a, nowMs) - publishWindowEnded(b, nowMs) || tie(a, b));')]]],
  ["a dead draft's Closes cell says Publish by again (prompt BV: it says Ended)", ["deadDraft"], [["js/dashboard-model.js", (s) => s.replace('(nowMs !== undefined && publishWindowEnded(p, nowMs) ? "Ended " : "Publish by ")', '"Publish by "')]]],
];
test("negative controls: each defect of BU makes a check fail", { timeout: 6000000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    if (process.env.BU_ONLY && !label.includes(process.env.BU_ONLY)) continue;   // BU_ONLY=<part of a label>: run one control while building
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-bu-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      for (const n of scenarios) {
        try { found.push(...(await SCENARIOS[n](dir)).map((x) => n + ": " + x)); }
        catch (e) { found.push(n + ": the page broke (" + String(e && e.message).slice(0, 120) + ")"); }      // a page that no longer works is a failed check too
      }
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 160) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
