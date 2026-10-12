// kio-id.test.js - the KIO ID on the pages (prompt BQ, October 12, 2026), in a real browser (set up like John's screen for the table) on the repo's own files with a fake backend (tests/fake-site.js with opts.kio: the
// migrated database; no real project, no key). Proven here:
//   1. a lookup by the ID ALONE (no company): one request carrying only the ID, the whole ID on the card, the recap that never prints it; the company and title words are sent only when they were typed, and only they can raise
//      the notice that the ID is registered to a different company or title; the notice sits above the opening, which is still shown;
//   2. the extension's fragment #k=...&c=...&t=...: the ID in the one box, the company in its box, the title words nowhere on the page or in storage, the fragment gone from the address bar, NO search until Search is pressed;
//      k with r, a k that fails the check, a second key refuse the whole fragment; the title words belong to the ID they came with only;
//   3. the answers: an ID that fails the check is refused on the page with nothing sent; no opening under it; an opening past its retention; a closed opening with the day it closed;
//   4. the employer's pages: the ID block (the ID, the short link, the lines for a job ad) with a copy button for each, text only, for every status including a draft; the ad lines carry only the ID line while the short link is
//      off and both while it is on; My openings holds the 18 character ID at 1354, 1286, 1100 and 1366 pixels and on a phone;
//   5. the receiving page (404.html): a path that is a KIO ID goes to the search page with the ID filled in; an ID that fails the check says so; any other path is the page's usual "does not exist";
//   6. an unmigrated database: an old 12 character code is still shown as it always was, with no short link and no copy buttons.
// Then negative controls: one deliberate defect at a time in the page code; each must make a scenario fail. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/kio-id.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startFakeSite, kioOf, KIO_CLOSED, KIO_GONE } from "./fake-site.js";
import { johnsBrowser, johnsWindow, johnsRows, MEASURE, JOHN_WIDTH, SPARE_WIDTH } from "./johns-screen.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = JSON.stringify;
let browser;
before(async () => { browser = await johnsBrowser(); });
after(async () => { if (browser) await browser.close(); });

const FIRST = kioOf("D21M48YBZQBF");            // the first search result of the fake backend (a Meridian opening, "Senior Data Analyst, ...")
const UNKNOWN = kioOf("ABCDEFGHJKMN");           // well formed, nobody has it: 404
const EDITED = kioOf("ABCDEFGHJKMN");            // the ID of the one opening the edit page shows
const NOT_VALID = "That ID is not valid. Check it and try again.", NOT_REG = "No opening is registered under that ID.", GONE = "This opening is no longer on FightGhostJobs.";
const MISMATCH = "This ID is not registered to the ";   // prompt BS: the notice's opening words (the company, title and both cases are tests/bs.test.js)
const EDIT = "edit.html?id=3f1d5b1e-0000-4000-8000-000000000001";

async function signIn(tab, site, kind) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  if (kind === "out") return;
  await tab.goto(site.url + "/_dev/link?kind=" + kind); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
const openSearch = async (tab, site, hash = "") => {
  await tab.goto(site.url + "/404.html?x=1");   // (a path with a query that is no KIO ID: the receiving script leaves it alone)
  await tab.goto(site.url + "/search.html" + hash); await tab.waitFor("document.readyState === 'complete' && !!document.getElementById('company')", 15000); await sleep(600);
};
const fill = (tab, company, title, req = "") => tab.eval("(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; set('company', " + q(company) + "); set('titleq', " + q(title) + "); set('reqq', " + q(req) + "); })()");
const boxes = (tab) => tab.eval("['company', 'titleq', 'reqq'].map((id) => document.getElementById(id).value).join('|')");
const pressSearch = async (tab) => { await tab.eval("document.getElementById('searchBtn').focus()"); await tab.key("Enter"); };
const searches = (site) => site.calls.filter((c) => c.name === "candidate-search");
const results = (tab) => tab.eval("document.getElementById('results').innerText.replace(/\\s+/g, ' ').trim()");
const text = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; })()");
const asCand = async (root, opts, fn) => { const site = await startFakeSite(root, { kio: true, ...opts }), tab = await browser.newTab(); try { await signIn(tab, site, "candidate"); return await fn(site, tab); } finally { await tab.close(); await site.close(); } };
const asPoster = async (root, opts, fn) => { const site = await startFakeSite(root, { kio: true, ...opts }), tab = await browser.newTab(); try { await signIn(tab, site, "poster"); return await fn(site, tab); } finally { await tab.close(); await site.close(); } };
const settle = async (tab, ms = 900) => { await sleep(ms); };

const SCENARIOS = {
  // ---- 1. the ID alone
  async idAlone(root) { return asCand(root, {}, async (site, tab) => { const bad = [];
    await openSearch(tab, site);
    await fill(tab, "", FIRST.shown); await pressSearch(tab);
    await tab.waitFor("!document.getElementById('recap').hidden", 8000); await settle(tab);
    const s = searches(site);
    if (s.length !== 1 || JSON.stringify(s[0].body) !== JSON.stringify({ kio: FIRST.stored })) bad.push("an ID with no company sent " + JSON.stringify(s.map((c) => c.body)));
    const r = await results(tab);
    if (!r.includes("KIO ID: " + FIRST.shown)) bad.push("the card does not show the whole ID: " + r.slice(0, 220));
    if (/\*{4}-\*{4}/.test(r)) bad.push("the card still shows a masked code: " + r.slice(0, 220));
    if (r.includes(MISMATCH)) bad.push("a notice with nothing to compare");
    if ((await text(tab, "#recapText")) !== "You searched for: KIO ID: " + FIRST.shown + ". Your results are below.") bad.push("the recap says: " + (await text(tab, "#recapText")));
    if ((await boxes(tab)) !== "||") bad.push("the boxes were not emptied: " + (await boxes(tab)));
    if (await tab.eval("document.documentElement.innerHTML.includes(" + q(FIRST.stored) + ")")) bad.push("the stored form of the ID is on the page");
    // every typed form reads the same
    for (const typed of [FIRST.stored.toLowerCase(), FIRST.shown.toLowerCase().replace(/-/g, " "), FIRST.stored.slice(3)]) {
      await fill(tab, "", typed); await tab.eval("document.getElementById('recapEdit').click && 0"); await pressSearch(tab); await settle(tab, 700);
    }
    const bodies = searches(site).slice(1).map((c) => JSON.stringify(c.body));
    if (bodies.length !== 3 || bodies.some((b) => b !== JSON.stringify({ kio: FIRST.stored }))) bad.push("the typed forms did not all send the same ID: " + bodies.join(" "));
    return bad; }); },
  // the company and the title words are sent only when typed; only they can raise the notice
  async notice(root) { return asCand(root, {}, async (site, tab) => { const bad = [];
    await openSearch(tab, site);
    await fill(tab, "Meridian Health", FIRST.shown); await pressSearch(tab); await settle(tab);
    let b = searches(site).map((c) => c.body);
    if (JSON.stringify(b[0]) !== JSON.stringify({ kio: FIRST.stored, company: "Meridian Health" })) bad.push("company typed: sent " + JSON.stringify(b[0]));
    if ((await results(tab)).includes(MISMATCH)) bad.push("the notice shows for the company the record has");
    await tab.eval("document.getElementById('recapEdit').click()");
    await fill(tab, "Zzyzx Unknown Staffing", FIRST.shown); await pressSearch(tab); await settle(tab);
    const r = await results(tab);
    if (!r.includes(MISMATCH)) bad.push("no notice for another company");
    if (!r.includes("KIO ID: " + FIRST.shown)) bad.push("the opening is not shown beside the notice");
    const idx = await tab.eval("(() => { const n = document.getElementById('mismatchNotice'), c = document.querySelector('#results .card'); return n && c ? (n.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING ? 'above' : 'below') : 'missing'; })()");
    if (idx !== "above") bad.push("the notice is " + idx + " the opening");
    if (!(await tab.eval("(window.__said = 1, true)"))) bad.push("x");
    return bad; }); },
  // ---- 2. the fragment
  async fragment(root) { return asCand(root, {}, async (site, tab) => { const bad = [];
    const frag = (stored, c, t) => "#k=" + encodeURIComponent(stored) + (c ? "&c=" + encodeURIComponent(c) : "") + (t ? "&t=" + encodeURIComponent(t) : "");
    await openSearch(tab, site, frag(FIRST.stored, "Meridian Health", "Senior Data Analyst"));
    const st = await tab.eval("({ boxes: ['company', 'titleq', 'reqq'].map((id) => document.getElementById(id).value), hash: location.hash, href: location.href })");
    if (JSON.stringify(st.boxes) !== JSON.stringify(["Meridian Health", FIRST.shown, ""])) bad.push("the boxes after the fragment: " + JSON.stringify(st.boxes));
    if (st.hash !== "" || /#/.test(st.href)) bad.push("the fragment is still in the address bar");
    await sleep(900);
    if (searches(site).length !== 0) bad.push("a search ran by itself");
    await pressSearch(tab); await settle(tab);
    const b = searches(site).map((c) => c.body);
    if (b.length !== 1 || JSON.stringify(b[0]) !== JSON.stringify({ kio: FIRST.stored, company: "Meridian Health", phrase: "Senior Data Analyst" })) bad.push("pressing Search sent " + JSON.stringify(b));
    if ((await results(tab)).includes(MISMATCH)) bad.push("a notice for the title the record has");
    // other title words: the notice; and the title words are in no box and no storage
    await openSearch(tab, site, frag(FIRST.stored, "Meridian Health", "Welder Apprentice"));
    const keep = await tab.eval("JSON.stringify([localStorage, sessionStorage]) + document.getElementById('titleq').value + document.getElementById('company').value");
    if (/Welder/.test(keep)) bad.push("the title words are in a box or in storage");
    await pressSearch(tab); await settle(tab);
    if (!(await results(tab)).includes(MISMATCH)) bad.push("no notice for other title words");
    // the title words belong to the ID they came with: a changed ID sends none
    await openSearch(tab, site, frag(FIRST.stored, "", "Welder Apprentice"));
    await fill(tab, "", UNKNOWN.shown); await pressSearch(tab); await settle(tab);
    const last = searches(site).slice(-1)[0].body;
    if (JSON.stringify(last) !== JSON.stringify({ kio: UNKNOWN.stored })) bad.push("title words went with another ID: " + JSON.stringify(last));
    // the ID alone in the fragment
    await openSearch(tab, site, "#k=" + FIRST.stored);
    const only = await boxes(tab);
    if (only !== "|" + FIRST.shown + "|") bad.push("k alone fills " + only);
    return bad; }); },
  async fragmentRefused(root) { return asCand(root, {}, async (site, tab) => { const bad = [];
    const wrong = FIRST.stored.slice(0, -1) + (FIRST.stored.endsWith("A") ? "B" : "A");
    for (const [what, hash] of [["k with a req number", "#k=" + FIRST.stored + "&c=Meridian&r=4471"], ["k with an old code", "#k=" + FIRST.stored + "&c=Meridian&p=D21M-48YB-ZQBF"], ["a k that fails the check", "#k=" + wrong + "&c=Meridian"], ["k twice", "#k=" + FIRST.stored + "&k=" + FIRST.stored], ["a k that is not an ID", "#k=hello&c=Meridian"], ["a title over 80 characters", "#k=" + FIRST.stored + "&t=" + "x".repeat(81)]]) {
      await openSearch(tab, site, hash);
      const st = await tab.eval("({ boxes: ['company', 'titleq', 'reqq'].map((id) => document.getElementById(id).value).join('|'), hash: location.hash })");
      if (st.boxes !== "||") bad.push(what + ": the boxes were filled: " + st.boxes);
      if (st.hash !== "") bad.push(what + ": the fragment stayed in the address bar");
    }
    if (searches(site).length !== 0) bad.push("a search ran");
    return bad; }); },
  // ---- 3. the answers
  async answers(root) { return asCand(root, {}, async (site, tab) => { const bad = [];
    await openSearch(tab, site);
    const wrong = "KIO-" + UNKNOWN.shown.slice(4, 18).replace(/.$/, UNKNOWN.shown.endsWith("A") ? "B" : "A");
    await fill(tab, "", wrong); await pressSearch(tab); await settle(tab, 700);
    if ((await text(tab, "#formError")) !== NOT_VALID) bad.push("an ID that fails the check: the page says '" + (await text(tab, "#formError")) + "'");
    if (searches(site).length !== 0) bad.push("an ID that fails the check was sent");
    await fill(tab, "", UNKNOWN.shown); await pressSearch(tab); await settle(tab);
    if (!(await results(tab)).includes(NOT_REG)) bad.push("no opening under it: " + (await results(tab)).slice(0, 160));
    await tab.eval("document.getElementById('recapEdit').click()");
    await fill(tab, "", KIO_GONE); await pressSearch(tab); await settle(tab);
    if (!(await results(tab)).includes(GONE)) bad.push("past the retention: " + (await results(tab)).slice(0, 160));
    await tab.eval("document.getElementById('recapEdit').click()");
    await fill(tab, "", KIO_CLOSED); await pressSearch(tab); await settle(tab);
    const r = await results(tab);
    if (!/Closed · Filled/.test(r) || !/Closed on [A-Z][a-z]{2} \d{1,2}/.test(r)) bad.push("a closed opening does not show Closed with its date: " + r.slice(0, 260));
    return bad; }); },
  // ---- 4. the employer's pages
  async employerBlock(root) { const bad = [];
    for (const [status, live] of [["draft", false], ["live", false], ["closed", false], ["live", true]]) {
      bad.push(...await asPoster(root, { postingStatus: status, shortLinkLive: live }, async (site, tab) => { const b = [];
        const tag = status + (live ? " with the short link on" : "") + ": ";
        await tab.goto(site.url + "/" + EDIT); await tab.waitFor("!!document.getElementById('kioBlock')", 10000); await sleep(400);
        if (!(await tab.eval("(() => { const e = document.getElementById('kioBlock'); return !!e && e.getClientRects().length > 0 && !e.closest('[hidden]'); })()"))) b.push(tag + "the ID block is not on the screen");
        if ((await text(tab, "#postId")) !== EDITED.shown) b.push(tag + "the ID is '" + (await text(tab, "#postId")) + "'");
        if ((await text(tab, "#kioShortLink")) !== "knowitsopen.com/" + EDITED.shown) b.push(tag + "the short link is '" + (await text(tab, "#kioShortLink")) + "'");
        const lines = await tab.eval("Array.from(document.querySelectorAll('#kioAdLines .kio-adline')).map((e) => e.textContent)");
        const want = ["KIO ID: " + EDITED.shown].concat(live ? ["Check this opening: knowitsopen.com/" + EDITED.shown] : []);
        if (JSON.stringify(lines) !== JSON.stringify(want)) b.push(tag + "the ad lines are " + JSON.stringify(lines));
        if (await tab.eval("document.querySelectorAll('#kioBlock input, #kioBlock textarea, #kioBlock select, #kioBlock [contenteditable]').length")) b.push(tag + "the block holds a field");
        await tab.eval("Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { (window.__copied = window.__copied || []).push(t); } }, configurable: true })");
        for (const what of ["id", "link", "ad"]) await tab.eval("document.querySelector('#kioBlock [data-copy=" + what + "]').click()");
        await sleep(300);
        const copied = await tab.eval("window.__copied || []");
        const wantCopied = [EDITED.shown, "knowitsopen.com/" + EDITED.shown, want.join("\n")];
        if (JSON.stringify(copied) !== JSON.stringify(wantCopied)) b.push(tag + "copied " + JSON.stringify(copied));
        const buttons = await tab.eval("Array.from(document.querySelectorAll('#kioBlock button')).map((x) => x.textContent.trim())");
        if (buttons.join("|") !== "Copied|Copied|Copied") b.push(tag + "the buttons say " + buttons.join("|") + " right after copying");
        return b; }));
    }
    return bad; },
  async dashboardFit(root) { const site = await startFakeSite(root, { ...johnsRows(), kio: true }), tab = await browser.newTab(), bad = [];
    try {
      await signIn(tab, site, "poster");
      for (const [width, phone] of [[JOHN_WIDTH, false], [SPARE_WIDTH, false], [1100, false], [1366, false], [375, true]]) {
        if (phone) await tab.viewport(width, true, 800); else await johnsWindow(tab, width, 500);
        await tab.goto(site.url + "/dashboard.html"); await tab.waitFor("document.querySelectorAll('tbody tr').length > 0", 10000); await tab.waitFor("document.fonts.status === 'loaded'", 10000); await sleep(400);
        const ids = await tab.eval("Array.from(document.querySelectorAll('tbody td[data-label=\"KIO ID\"]')).map((td) => ({ t: td.textContent.trim(), over: td.scrollWidth > td.clientWidth + 1 }))");
        if (ids.length === 0 || ids.some((x) => !/^KIO-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(x.t))) bad.push(width + ": the ID column shows " + JSON.stringify(ids.map((x) => x.t)));
        if (ids.some((x) => x.over)) bad.push(width + ": an ID is cut off in its cell");
        const m = await tab.eval(MEASURE);
        if (m.pageScroll) bad.push(width + ": the page scrolls sideways");
        if (!phone && m.sideScroll) bad.push(width + ": the table scrolls sideways inside its card");
        if (!phone && m.lastTh > m.cardRight + 1) bad.push(width + ": the last column runs past the card");
        const title = m.ths.find((t) => t.name === "Title");
        if (!phone && (!title || title.w < 176)) bad.push(width + ": the Title column is " + (title && title.w) + " pixels (176 at least)");
        if (!phone && m.rows.some((r) => r.actLines > 1 && r.words.length < 2)) bad.push(width + ": an Actions cell broke");
      }
    } finally { await tab.close(); await site.close(); }
    return bad; },
  // ---- 5. the receiving page
  async receive(root) { const site = await startFakeSite(root, { kio: true }), tab = await browser.newTab(), bad = [];
    try {
      await signIn(tab, site, "out");
      await tab.goto(site.url + "/" + FIRST.shown);
      await tab.waitFor("location.pathname === '/search.html'", 8000); await tab.waitFor("!!document.getElementById('titleq')", 8000); await sleep(500);
      const st = await tab.eval("({ q: document.getElementById('titleq').value, c: document.getElementById('company').value, hash: location.hash, path: location.pathname })");
      if (st.q !== FIRST.shown || st.c !== "" || st.hash !== "") bad.push("the short link landed on " + JSON.stringify(st));
      if (searches(site).length !== 0) bad.push("the receiving page searched");
      await tab.goto(site.url + "/" + FIRST.shown.toLowerCase());
      await tab.waitFor("location.pathname === '/search.html'", 8000);
      const wrong = FIRST.shown.slice(0, -1) + (FIRST.shown.endsWith("A") ? "B" : "A");
      await tab.goto(site.url + "/" + wrong); await sleep(900);
      if ((await tab.eval("location.pathname")) !== "/" + wrong) bad.push("an ID that fails the check was forwarded");
      if ((await text(tab, "h1")) !== "That ID is not valid" || (await text(tab, "#notFoundText")) !== NOT_VALID) bad.push("an ID that fails the check says: " + (await text(tab, "h1")) + " / " + (await text(tab, "#notFoundText")));
      await tab.goto(site.url + "/no-such-page"); await sleep(700);
      if ((await text(tab, "h1")) !== "That page does not exist" || !(await text(tab, "#notFoundText")).startsWith("Check the address")) bad.push("an ordinary missing page changed: " + (await text(tab, "h1")));
      // no company, no title, nothing personal in what the receiving page does: it never calls the backend
      if (site.calls.length !== 0 && site.calls.some((c) => c.name !== "auth-otp")) bad.push("the receiving page called the backend: " + site.calls.map((c) => c.name).join(","));
    } finally { await tab.close(); await site.close(); }
    return bad; },
  // ---- 6. an unmigrated database
  async unmigrated(root) { const site = await startFakeSite(root, {}), tab = await browser.newTab(), bad = [];
    try {
      await signIn(tab, site, "poster");
      await tab.goto(site.url + "/" + EDIT); await tab.waitFor("!!document.getElementById('kioBlock')", 10000); await sleep(300);
      if ((await text(tab, "#postId")) !== "ABCD-EFGH-JKMN") bad.push("an old code is shown as '" + (await text(tab, "#postId")) + "'");
      if (await tab.eval("!!document.getElementById('kioShortLink') || document.querySelectorAll('#kioBlock button').length > 0")) bad.push("an old code carries a short link or copy buttons");
      await signIn(tab, site, "candidate");
      await openSearch(tab, site);
      await fill(tab, "Meridian", "Nurse"); await pressSearch(tab); await settle(tab);
      const r = await results(tab);
      if (!/KIO ID: \*{4}-\*{4}-[0-9A-Z]{4}/.test(r)) bad.push("an answer without a whole ID does not show the masked code: " + r.slice(0, 200));
    } finally { await tab.close(); await site.close(); }
    return bad; },
};

test("the KIO ID on the pages: the ID alone, the notice, the fragment, the answers, the employer's block and its copy buttons, My openings, the receiving page, an unmigrated database", { timeout: 1800000 }, async () => {
  const problems = [];
  for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](ROOT)) problems.push(n + ": " + p);
  assert.deepEqual(problems, [], "KIO ID problems:\n" + problems.join("\n"));
});

// ---- negative controls: [label, scenarios, [[file, mutate]]]
const DEFECTS = [
  ["a company is still asked for with an ID", ["idAlone"], [["js/pages/search.js", (s) => s.replace("const idAlone = !staffMode && q.ok", "const idAlone = false && q.ok")]]],
  ["the held title words go with any ID", ["fragment"], [["js/pages/search.js", (s) => s.replace("if (heldKio && heldKio.stored === stored) { b.phrase = heldKio.title; sentTitle = heldKio.title; }", "if (heldKio) { b.phrase = heldKio.title; sentTitle = heldKio.title; }")]]],
  ["the notice is never shown", ["notice"], [["js/pages/search.js", (s) => s.replace("if (data.mismatch === true) resultsEl.append(", "if (false) resultsEl.append(")]]],
  ["an ID that fails the check is sent to the backend", ["answers"], [["js/search-input.js", (s) => s.replace("if (k.kind === \"none\" && looksLikeKio(t)) return { ok: false, message: KIO_INVALID_MESSAGE };", "")]]],
  ["the card shows the masked code instead of the whole ID", ["idAlone"], [["js/pages/search.js", (s) => s.replace("(typeof row.kio_id === \"string\" && row.kio_id !== \"\" ? row.kio_id : row.masked_code)", "row.masked_code")]]],
  ["the fragment takes a req number with an ID", ["fragmentRefused"], [["js/fragment-prefill.js", (s) => s.replace("if (found.has(\"p\") || found.has(\"r\")) return { ours: true, result: null };", "")]]],
  ["the fragment takes an ID that fails the check", ["fragmentRefused"], [["js/fragment-prefill.js", (s) => s.replace("if (read.kind !== \"kio\") return { ours: true, result: null };", "")]]],
  ["the title words are put in the box", ["fragment"], [["js/fragment-prefill.js", (s) => s.replace("if (result.kind === \"req\") reqEl.value = result.value; else queryEl.value = result.value;", "if (result.kind === \"req\") reqEl.value = result.value; else queryEl.value = result.title || result.value;")]]],
  ["a fragment runs the search by itself", ["fragment"], [["js/pages/search.js", (s) => s.replace("let heldKio = null;", "let heldKio = null; setTimeout(() => { if (queryIn.value) form.requestSubmit(); }, 400);")]]],
  ["past the retention reads as not registered", ["answers"], [["js/pages/search.js", (s) => s.replace("searched.gone === true ? KIO_GONE_MESSAGE : noMatchMessage(", "noMatchMessage(")]]],
  ["a closed opening has no closing date", ["answers"], [["js/chips.js", (s) => s.replace(".concat(typeof p.closed_at === \"string\" && fmtDateTz(p.closed_at, tz) !== \"\" ? [{ text: \"Closed on \" + fmtDateTz(p.closed_at, tz) }] : [])", "")]]],
  ["the Check this opening line is always in the ad lines", ["employerBlock"], [["js/kio.js", (s) => s.replace("if (live === true) lines.push(", "if (true) lines.push(")]]],
  ["the Check this opening line is never in the ad lines", ["employerBlock"], [["js/kio.js", (s) => s.replace("if (live === true) lines.push(", "if (false) lines.push(")]]],
  ["Copy ID copies something else", ["employerBlock"], [["js/kio-block.js", (s) => s.replace("copyButton(\"Copy ID\", \"id\", shown)", "copyButton(\"Copy ID\", \"id\", \"x\" + shown)")]]],
  ["a draft shows no ID block", ["employerBlock"], [["js/pages/edit.js", (s) => s.replace("idLine.hidden = false;", "idLine.hidden = p.stored_status === \"draft\";")]]],
  ["the short link is an editable field", ["employerBlock"], [["js/kio-block.js", (s) => s.replace("h(\"span\", { class: \"mono kio-value\", id: \"kioShortLink\" }, link)", "h(\"input\", { class: \"mono kio-value\", id: \"kioShortLink\", value: link })")]]],
  ["My openings shows the ID without its hyphens", ["dashboardFit"], [["js/format.js", (s) => s.replace("return displayId(code);", "return String(code || \"\");")]]],
  ["the receiving page sends on more than the ID", ["receive"], [["js/kio-receive.js", (s) => s.replace("location.replace(\"/search.html#k=\" + stored);", "location.replace(\"/search.html#k=\" + stored + \"&r=4471\");")]]],
  ["the receiving page forwards an ID that fails the check", ["receive"], [["js/kio.js", (s) => s.replace("return r.kind === \"kio\" && r.hadPrefix ? r.stored : null;", "return r.kind === \"kio\" || r.reason === \"check\" ? (r.stored || \"KIO\" + String(t).replace(/[^0-9A-Za-z]/g, \"\").slice(3)) : null;")]]],
];
test("negative controls: each defect in the KIO ID pages makes a check fail", { timeout: 6000000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    if (process.env.KIO_ONLY && !label.includes(process.env.KIO_ONLY)) continue;   // KIO_ONLY=<part of a label>: run one control while building
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-kio-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      for (const n of scenarios) found.push(...(await SCENARIOS[n](dir)).map((x) => n + ": " + x));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 160) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
