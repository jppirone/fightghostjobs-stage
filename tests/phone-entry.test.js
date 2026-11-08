// phone-entry.test.js - the phone entry in a real headless Chrome (prompt IB, November 3, 2026), the repo's own files and a fake backend (tests/fake-site.js; no real project, no key, no token).
// The Shortcut address is search.html#x=<the text read out of a screenshot, URL encoded>; this test builds it from each reading of tests/phone-readings.js, encoded the way the Shortcut encodes it (encodeURIComponent).
//   readings     every reading at 390 x 844 (phone, touch), 844 x 390 (landscape), 820 x 1180 (tablet) and 1440 x 900 (computer, mouse): the state, the boxes, the notes, the sentences (only the fixed ones, nothing from the screenshot
//                outside the boxes and the list), the list of other openings (only complete cards), picking one, the address cleaned, the taps (44 pixels), nothing wider than the screen, and at 390 the request Search sends
//   proof        no request holds any of the text; no storage (local, session, IndexedDB, cookies, window.name, history state, cache storage) holds any of it; after Search the request holds only the box values and origin mobile
//   hashchange   a second x on the same page, without a reload, is read; a refused fragment clears; a fragment without x changes nothing
//   signin       signed out, Search with a reading saves the search with origin mobile; the emailed link opens a session and the search that runs by itself carries origin mobile
//   noX          without x the page is the ordinary search page and the phone files are never fetched; the classic address still fills as before
//   refused      hostile addresses fill nothing, show sentence 10 and are removed from the address bar; a search typed afterwards is the site's
//   markup       markup in the screenshot text is only text in a box
//   edit         typing in a box ends its note
//   keyboard     the panel is a polite live region; the button, the list and the choices work with Tab and Enter
//   devices      a mouse at 800 pixels, an iPad (touch, 1024), an iPhone asking for the desktop site (touch, 980) get the tool; a mouse at 1440 gets sentence 12 (and no link while EXTENSION_PAGE_URL is empty)
// Then planted breakages: one deliberate defect at a time in a COPY of the repo, each must make a scenario (or the unit test) fail. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/phone-entry.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite } from "./fake-site.js";
import { READINGS } from "./phone-readings.js";
import { SENTENCES } from "../js/phone-text.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const enc = encodeURIComponent;
const S = SENTENCES;
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

const SIZES = [
  { n: "phone 390x844", w: 390, h: 844, phone: true, computer: false, search: true },
  { n: "landscape 844x390", w: 844, h: 390, phone: true, computer: false },
  { n: "tablet 820x1180", w: 820, h: 1180, phone: true, computer: false },
  { n: "computer 1440x900", w: 1440, h: 900, phone: false, computer: true },
];
const PHONE = SIZES[0], COMPUTER = SIZES[3];
const reading = (id) => READINGS.find((r) => r.id === id);

async function become(tab, site, who) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  if (who === "out") return;
  await tab.goto(site.url + "/_dev/link?kind=" + who); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
// every visit is a fresh load of search.html (a fragment-only change is not a load), at a window size
async function openAt(tab, site, size, hash, waitPhone = true) {
  await tab.viewport(size.w, size.phone, size.h);
  await tab.goto(site.url + "/404.html"); await tab.goto(site.url + "/search.html" + hash);
  await tab.waitFor("document.readyState === 'complete' && !!document.getElementById('company')", 15000);
  if (waitPhone) await tab.waitFor("!document.getElementById('phoneBody').hidden", 10000); else await sleep(900);
  await sleep(250);
}
const SNAP = `(() => { const g = (id) => document.getElementById(id), t = (el) => (el ? el.textContent : null);
  const pick = g('phoneMore').querySelector('button'), box = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; };
  return { c: g('company').value, q: g('titleq').value, r: g('reqq').value, rType: g('reqq').type, bodyHidden: g('phoneBody').hidden, line: t(g('phoneLine')), moreHidden: g('phoneMore').hidden, more: t(g('phoneMore')), pick: !!pick, pickBox: pick ? box(pick) : null,
    expanded: pick ? pick.getAttribute('aria-expanded') : null, listHidden: g('phoneList').hidden, listHead: t(g('phoneList').querySelector('.phone-list-head')),
    choices: Array.from(g('phoneList').querySelectorAll('button')).map((b) => ({ text: b.textContent, box: box(b) })), privacyHidden: g('phonePrivacy').dataset.on !== '1', privacyRendered: g('phonePrivacy').getClientRects().length > 0, privacy: t(g('phonePrivacy')),   /* prompt JB: the sentence stays hidden on the page for good; "hidden" here means not switched on (data-on), i.e. not in the info box */
    notes: { company: t(g('phoneNoteCompany')), query: t(g('phoneNoteQuery')), req: t(g('phoneNoteReq')) }, noteCount: document.querySelectorAll('.phone-note').length,
    describedby: { company: g('company').getAttribute('aria-describedby'), query: g('titleq').getAttribute('aria-describedby'), req: g('reqq').getAttribute('aria-describedby') },
    hash: location.hash, href: location.href, live: g('phonePanel').getAttribute('aria-live'), liveParent: g('phoneLine').closest('[aria-live]') ? g('phoneLine').closest('[aria-live]').id : null, links: g('phoneBody').querySelectorAll('a').length,
    xss: window.__xss === undefined ? null : window.__xss, imgs: document.querySelectorAll('img[src="x"], svg[onload], script:not([src])').length, bolds: document.querySelectorAll('form b, #phonePanel b').length,
    sideScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, inner: window.innerWidth, formError: g('formError').hidden ? null : t(g('formError')), signin: !g('signinWrap').hidden,
    pending: localStorage.getItem('fgj-pending-search'), resultCards: document.querySelectorAll('#results .card').length, recapShown: !g('recap').hidden }; })()`;
const snap = (tab) => tab.eval(SNAP);
const searches = (site) => site.calls.filter((c) => c.name === "candidate-search");
const cleanAddress = (s) => s.hash === "" && !/#|[?&]x=/.test(s.href);

// the line of the panel for a reading, and the sentence under a box
const lineOf = (r) => (r.expect.state === "nothing" ? S[9] : S[1]) + (r.expect.cut ? " " + S[11] : "");
const noteText = (n) => (n ? S[n] : null);
const splitChoice = (label) => { const i = label.lastIndexOf(" at "); return { title: label.slice(0, i), company: label.slice(i + 4) }; };
// what Search must send for the three boxes (company, KIO or title, req number), built here from the rules of the search page, not from the page
const acceptable = (c, q, r) => /^KIO-/.test(q) || (c !== "" && (q !== "" || r !== ""));
function wantBody(c, q, r) {
  if (/^KIO-/.test(q)) return Object.assign({ kio: "KIO" + q.slice(4).replace(/-/g, "") }, c !== "" ? { company: c } : {}, { origin: "mobile" });
  const b = { company: c };
  if (r !== "") { b.req = r; if (q !== "") b.phrase = q; } else b.phrase = q;
  return Object.assign(b, { origin: "mobile" });
}
const sameBody = (got, want) => JSON.stringify(Object.keys(got).sort()) === JSON.stringify(Object.keys(want).sort()) && Object.keys(want).every((k) => got[k] === want[k]);

// ---- the scenarios ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
async function checkReading(tab, size, r, label, bad) {
  const s = await snap(tab);
  if (!cleanAddress(s)) bad.push(label + ": the address still holds the fragment: " + s.href.replace(/x=.*/, "x=..."));
  if (s.sideScroll) bad.push(label + ": the page scrolls sideways");
  if (s.xss !== null || s.imgs !== 0) bad.push(label + ": markup ran or was created");
  if (s.live !== "polite" || s.liveParent !== "phonePanel") bad.push(label + ": the panel is not a polite live region (" + s.live + ", " + s.liveParent + ")");
  if (size.computer) {
    if (s.c !== "" || s.q !== "" || s.r !== "") bad.push(label + ": the computer got filled boxes " + JSON.stringify([s.c.slice(0, 20), s.q.slice(0, 20), s.r]));
    if (s.line !== S[12]) bad.push(label + ": the computer's panel line is '" + s.line + "'");
    if (!s.moreHidden || !s.listHidden || !s.privacyHidden || s.noteCount !== 0 || s.links !== 0) bad.push(label + ": the computer got more than sentence 12 (more hidden " + s.moreHidden + ", privacy hidden " + s.privacyHidden + ", notes " + s.noteCount + ", links " + s.links + ")");
    return s;
  }
  if (s.bodyHidden) { bad.push(label + ": the panel is not shown"); return s; }
  if (s.line !== lineOf(r)) bad.push(label + ": the panel line is '" + String(s.line).slice(0, 80) + "', wanted '" + lineOf(r).slice(0, 80) + "'");
  if (s.c !== r.expect.company || s.q !== r.expect.query || s.r !== r.expect.req) bad.push(label + ": the boxes are " + JSON.stringify([s.c, s.q, s.r]) + ", wanted " + JSON.stringify([r.expect.company, r.expect.query, r.expect.req]));
  if (s.rType !== "password") bad.push(label + ": the req number box is not hidden any more");
  for (const k of ["company", "query", "req"]) {
    if (s.notes[k] !== noteText(r.expect.notes[k])) bad.push(label + ": the note under " + k + " is " + JSON.stringify(s.notes[k]) + ", wanted " + JSON.stringify(noteText(r.expect.notes[k])));
    if (r.expect.notes[k] && !String(s.describedby[k] || "").includes("phoneNote")) bad.push(label + ": the box " + k + " is not tied to its note for a screen reader");
  }
  if (s.noteCount !== Object.values(r.expect.notes).filter(Boolean).length) bad.push(label + ": " + s.noteCount + " notes on the page");
  if (s.privacyHidden || s.privacy !== S[13]) bad.push(label + ": the privacy sentence is not ready for the info box (switched on, with its words)");
  if (s.privacyRendered) bad.push(label + ": the privacy sentence is on the page (prompt JB: it is behind the info button)");
  const others = r.expect.others;
  if (others.length === 0) { if (!s.moreHidden || s.pick) bad.push(label + ": the page offers other openings when there are none"); }
  else {
    if (s.moreHidden || s.more !== S[6]) bad.push(label + ": sentence 6 is '" + s.more + "'");
    if (!s.pick || s.pickBox.w < 44 || s.pickBox.h < 44) bad.push(label + ": the Pick another opening button is smaller than 44 by 44 (" + JSON.stringify(s.pickBox) + ")");
    if (!s.listHidden) bad.push(label + ": the list of other openings is open before the button is pressed");
  }
  return s;
}
async function checkPick(tab, size, r, label, bad, which = 0, pickedNotes = { company: null, query: null, req: null }, pickedReq = "") {
  const others = r.expect.others;
  await tab.eval("document.getElementById('phoneMore').querySelector('button').click()"); await sleep(150);
  let s = await snap(tab);
  if (s.listHidden || s.listHead !== S[7] || s.expanded !== "true") bad.push(label + ": the list is not open with sentence 7 (" + JSON.stringify([s.listHidden, s.listHead, s.expanded]) + ")");
  if (JSON.stringify(s.choices.map((c) => c.text)) !== JSON.stringify(others)) bad.push(label + ": the list holds " + JSON.stringify(s.choices.map((c) => c.text)) + ", wanted " + JSON.stringify(others));
  for (const c of s.choices) { if (c.box.w < 44 || c.box.h < 44) bad.push(label + ": a choice is smaller than 44 by 44: " + JSON.stringify(c.box)); if (c.box.right > s.inner) bad.push(label + ": a choice is wider than the screen (right edge " + c.box.right + " of " + s.inner + ")"); }
  if (s.sideScroll) bad.push(label + ": the open list makes the page scroll sideways");
  const want = splitChoice(others[which]);
  await tab.eval("document.getElementById('phoneList').querySelectorAll('button')[" + which + "].click()"); await sleep(200);
  s = await snap(tab);
  if (s.c !== want.company || s.q !== want.title) bad.push(label + ": picking '" + others[which] + "' filled " + JSON.stringify([s.c, s.q]));
  if (s.r !== pickedReq) bad.push(label + ": after picking the req box holds '" + s.r + "', wanted '" + pickedReq + "' (the first opening's req number must go; the picked opening brings its own, if its title has one)");
  if (s.line !== S[8] + (r.expect.cut ? " " + S[11] : "")) bad.push(label + ": after picking the panel line is '" + s.line + "'");
  if (!s.listHidden) bad.push(label + ": the list stays open after picking");
  for (const k of ["company", "query", "req"]) if (s.notes[k] !== noteText(pickedNotes[k])) bad.push(label + ": after picking the note under " + k + " is " + JSON.stringify(s.notes[k]) + ", wanted " + JSON.stringify(noteText(pickedNotes[k])));
  if (s.noteCount !== Object.values(pickedNotes).filter(Boolean).length) bad.push(label + ": after picking " + s.noteCount + " notes are on the page (the notes of the first opening must go)");
  if (JSON.stringify(s.choices.map((c) => c.text)) !== "[]") { /* the list is closed: nothing to check */ }
  return s;
}

const SCENARIOS = {
  async readings(root, o = {}) {
    const bad = [], sizes = o.sizes || SIZES, ids = o.ids || READINGS.map((r) => r.id);
    const site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      for (const size of sizes) {
        await tab.viewport(size.w, size.phone, size.h); await become(tab, site, size.search && !o.signedOut ? "candidate" : "out");
        for (const id of ids) {
          const r = reading(id), label = size.n + " " + id;
          site.calls.length = 0;
          await openAt(tab, site, size, "#x=" + enc(r.text));
          await checkReading(tab, size, r, label, bad);
          if (searches(site).length) bad.push(label + ": a search ran by itself");
          if (!size.computer && r.expect.others.length) {
            // the second opening of A07 (a real LinkedIn screen) has a requisition number in its title: picking it fills the req box and shows sentence 3
            await checkPick(tab, size, r, label, bad, 0, id === "A07" ? { company: null, query: null, req: 3 } : { company: null, query: null, req: null }, id === "A07" ? "26-27638" : "");
            if (id === "A05") { await openAt(tab, site, size, "#x=" + enc(r.text)); await checkPick(tab, size, r, label + " (last)", bad, r.expect.others.length - 1, { company: null, query: 2, req: null }); }
          }
          // at 390 signed in: the request Search sends
          if (size.search && !o.signedOut && !o.noSearch && !size.computer) {
            site.calls.length = 0;
            await openAt(tab, site, size, "#x=" + enc(r.text));
            const s0 = await snap(tab);
            await tab.eval("document.getElementById('searchForm').requestSubmit()"); await sleep(r.expect.state === "read" && acceptable(s0.c, s0.q, s0.r) ? 1500 : 700);
            const sent = searches(site), s1 = await snap(tab);
            if (acceptable(s0.c, s0.q, s0.r)) {
              if (sent.length !== 1) bad.push(label + ": Search sent " + sent.length + " searches");
              else if (!sameBody(sent[0].body, wantBody(s0.c, s0.q, s0.r))) bad.push(label + ": the search carried " + JSON.stringify(sent[0].body) + ", wanted " + JSON.stringify(wantBody(s0.c, s0.q, s0.r)));
              if (!s1.recapShown || !s1.bodyHidden) bad.push(label + ": after the search the sentences about the screenshot stay on the page");
              if (s1.c !== "" || s1.q !== "" || s1.r !== "" || s1.noteCount !== 0) bad.push(label + ": after the search the boxes or notes were not emptied");
              if (s1.privacyHidden && r.expect.state === "read") bad.push(label + ": the privacy sentence went with the search");
            } else {
              if (sent.length !== 0) bad.push(label + ": a search was sent from boxes the page refuses: " + JSON.stringify(sent[0] && sent[0].body));
              if (!s1.formError) bad.push(label + ": Search with boxes that cannot be searched shows no message");
              if (s1.bodyHidden && r.expect.state === "read") bad.push(label + ": the panel went away although nothing was searched");
            }
          }
        }
      }
    } finally { await tab.close(); await site.close(); }
    return bad;
  },

  // the proof of section 3d of report HX
  async proof(root, o = {}) {
    const bad = [], ids = o.ids || ["I07", "A02", "A05", "I04", "I01"];
    const site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    const DUMP = `(async () => {
      const out = { local: JSON.stringify(Object.assign({}, localStorage)), session: JSON.stringify(Object.assign({}, sessionStorage)), cookie: document.cookie, name: window.name, histState: JSON.stringify(history.state), title: document.title, perf: performance.getEntriesByType('resource').map((e) => e.name).join(' '), idb: '', caches: '' };
      try { if (indexedDB.databases) { const dbs = await indexedDB.databases(); out.idb = JSON.stringify(dbs); for (const d of dbs) { out.idb += await new Promise((res) => { const rq = indexedDB.open(d.name); rq.onerror = () => res(''); rq.onsuccess = () => { const db = rq.result, names = Array.from(db.objectStoreNames); if (!names.length) { db.close(); return res(''); } const tx = db.transaction(names); let acc = '', left = names.length; names.forEach((n) => { const g = tx.objectStore(n).getAll(); g.onsuccess = () => { try { acc += JSON.stringify(g.result); } catch (e) {} if (--left === 0) { db.close(); res(acc); } }; g.onerror = () => { if (--left === 0) { db.close(); res(acc); } }; }); }; }); } } } catch (e) {}
      try { out.caches = JSON.stringify(await caches.keys()); } catch (e) {}
      return out; })()`;
    try {
      await tab.focusEmulation(true); await tab.viewport(PHONE.w, true, PHONE.h); await become(tab, site, "candidate");
      for (const id of ids) {
        const r = reading(id), label = "proof " + id;
        const lines = r.text.split(/\r\n|\r|\n/).map((l) => l.trim()).filter((l) => l.length >= 5);
        const tokens = [...new Set([...lines, r.text.trim(), enc(r.text), enc(r.text).slice(0, 60)])].filter(Boolean);
        const hayOf = (x) => { let d = x; try { d = decodeURIComponent(x); } catch { /* not encoded */ } return (x + " " + d).toLowerCase(); };
        const scanWire = (skip) => { for (const w of site.wire) { const hay = hayOf(w.url + " " + w.body); for (const t of tokens) if (!skip(t) && hay.includes(t.toLowerCase())) bad.push(label + ": a request holds the screenshot text: " + w.method + " " + w.url.slice(0, 60) + " holds '" + t.slice(0, 30) + "'"); } };
        site.wire.length = 0; site.calls.length = 0;
        await openAt(tab, site, PHONE, "#x=" + enc(r.text));
        const s0 = await snap(tab);
        if (!cleanAddress(s0)) bad.push(label + ": the address bar still holds the text");
        scanWire(() => false);
        for (const c of site.calls) { const hay = hayOf(JSON.stringify(c)); for (const t of tokens) if (hay.includes(t.toLowerCase())) bad.push(label + ": a backend call holds the screenshot text before Search: " + c.name); }
        if (searches(site).length) bad.push(label + ": a search was sent before the person pressed Search");
        const dump = async (when) => {
          const d = await tab.eval(DUMP);
          let cookies = ""; try { cookies = JSON.stringify((await tab.send("Network.getAllCookies")).cookies || []); } catch { /* not available */ }
          const all = { ...d, cookies };
          for (const [k, v] of Object.entries(all)) { const hay = hayOf(String(v)); for (const t of tokens) if (hay.includes(t.toLowerCase())) bad.push(label + ": " + when + " the " + k + " holds the screenshot text ('" + t.slice(0, 30) + "')"); }
        };
        await dump("before Search");
        // Search: only the box values and the origin
        site.wire.length = 0; site.calls.length = 0;
        if (acceptable(s0.c, s0.q, s0.r)) {
          await tab.eval("document.getElementById('searchForm').requestSubmit()"); await sleep(1600);
          const sent = searches(site);
          if (sent.length !== 1) bad.push(label + ": Search sent " + sent.length + " searches");
          else {
            if (!sameBody(sent[0].body, wantBody(s0.c, s0.q, s0.r))) bad.push(label + ": the search carried " + JSON.stringify(sent[0].body));
            if ("origin_host" in sent[0].body) bad.push(label + ": the search carried a host");
          }
          const values = [s0.c, s0.q, s0.r].filter(Boolean).map((v) => v.toLowerCase());
          // nothing of the screenshot that was not in a box is in the search
          // a line of the screenshot that is a part of a box value (a title that wrapped over two lines) is the box value itself
          const inBox = (t) => values.some((v) => v.includes(t.toLowerCase()) || enc(v).toLowerCase().includes(t.toLowerCase()));
          if (sent.length === 1) for (const t of tokens) if (!inBox(t) && JSON.stringify(sent[0].body).toLowerCase().includes(t.toLowerCase())) bad.push(label + ": the search holds text that was not in a box: '" + t.slice(0, 30) + "'");
          scanWire(inBox);
          await dump("after Search");
        }
      }
    } finally { await tab.close(); await site.close(); }
    return bad;
  },

  async hashchange(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await tab.viewport(PHONE.w, true, PHONE.h); await become(tab, site, "out");
      const a = reading("A02"), b = reading("I01"), c = reading("I04");
      await openAt(tab, site, PHONE, "#x=" + enc(a.text));
      await tab.eval("window.__marker = 'same page'");
      let s = await snap(tab);
      if (s.c !== a.expect.company || s.r !== a.expect.req) bad.push("the first reading did not fill: " + JSON.stringify([s.c, s.q, s.r]));
      // the Shortcut opens the same page again with another fragment: the page is not reloaded, the fragment changes
      for (const [label, next, want] of [["a second reading", b, b], ["a third reading", c, c], ["the same reading again", c, c]]) {
        await tab.eval("location.hash = " + JSON.stringify("#x=" + enc(next.text))); await sleep(900);
        s = await snap(tab);
        if ((await tab.eval("window.__marker")) !== "same page") bad.push(label + ": the page was reloaded");
        if (s.c !== want.expect.company || s.q !== want.expect.query || s.r !== want.expect.req) bad.push(label + ": the boxes are " + JSON.stringify([s.c, s.q, s.r]) + ", wanted " + JSON.stringify([want.expect.company, want.expect.query, want.expect.req]));
        if (s.line !== lineOf(want)) bad.push(label + ": the panel line is '" + s.line + "'");
        for (const k of ["company", "query", "req"]) if (s.notes[k] !== noteText(want.expect.notes[k])) bad.push(label + ": the note under " + k + " is " + JSON.stringify(s.notes[k]) + " (the notes of the earlier reading must go)");
        if (!cleanAddress(s)) bad.push(label + ": the address was not cleaned again: " + s.href.replace(/x=.*/, "x=..."));
      }
      // a fragment that is refused empties the form and says so; a fragment without x changes nothing
      await tab.eval("location.hash = '#x=%E0%A4%A'"); await sleep(700); s = await snap(tab);
      if (s.c !== "" || s.q !== "" || s.r !== "" || s.line !== S[10] || s.noteCount !== 0) bad.push("a refused second fragment: " + JSON.stringify([s.c, s.q, s.r, s.line, s.noteCount]));
      await tab.eval("location.hash = " + JSON.stringify("#x=" + enc(a.text))); await sleep(800);
      await tab.eval("location.hash = '#top'"); await sleep(500); s = await snap(tab);
      if (s.c !== a.expect.company || s.line !== lineOf(a)) bad.push("a fragment without x changed the page: " + JSON.stringify([s.c, s.line]));
      if (s.hash !== "#top") bad.push("a fragment without x was changed: " + s.hash);
      // a search saved before a sign-in link is dropped when a reading arrives
      await tab.eval("localStorage.setItem('fgj-pending-search', JSON.stringify({ v: { company: 'Other Company', q: 'Other Title', r: '' }, exp: Date.now() + 3600000 }))");
      await tab.eval("location.hash = " + JSON.stringify("#x=" + enc(b.text))); await sleep(800); s = await snap(tab);
      if (s.pending !== null) bad.push("an older saved search was not dropped when a reading arrived");
      if (s.c !== b.expect.company) bad.push("the saved search overwrote the reading: " + s.c);
    } finally { await tab.close(); await site.close(); }
    return bad;
  },

  async signin(root, o = {}) {
    const bad = [], ids = o.ids || ["I01", "I07", "A02"];
    for (const id of ids) {
      const r = reading(id), site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
      try {
        await tab.focusEmulation(true); await tab.viewport(PHONE.w, true, PHONE.h); await become(tab, site, "out");
        await openAt(tab, site, PHONE, "#x=" + enc(r.text));
        const s0 = await snap(tab);
        await tab.eval("document.getElementById('searchForm').requestSubmit()"); await sleep(800);
        const kept = JSON.parse((await snap(tab)).pending || "null");
        if (!kept) { bad.push(id + ": nothing was saved while waiting for the link"); continue; }
        if (Object.keys(kept.v).sort().join(",") !== "company,host,origin,q,r") bad.push(id + ": the saved search holds " + Object.keys(kept.v).sort().join(",") + " (exactly company, host, origin, q, r are allowed)");
        if (kept.v.origin !== "mobile" || kept.v.host !== null) bad.push(id + ": the saved origin is " + JSON.stringify([kept.v.origin, kept.v.host]));
        if (kept.v.company !== s0.c || kept.v.q !== s0.q || kept.v.r !== s0.r) bad.push(id + ": the saved search is not what was in the boxes: " + JSON.stringify(kept.v));
        const text = JSON.stringify(kept); for (const l of r.text.split("\n").map((x) => x.trim()).filter((x) => x.length >= 5)) if (text.includes(l) && ![s0.c, s0.q, s0.r].includes(l)) bad.push(id + ": the saved search holds a line of the screenshot that was not in a box: " + l);
        if (searches(site).length !== 0) bad.push(id + ": a search ran while signed out");
        if (await tab.eval("document.getElementById('signinWrap').hidden")) bad.push(id + ": the email step was not shown");
        // the person opens the emailed link: a session appears, then the search page starts and runs the saved search by itself
        await tab.goto(site.url + "/_dev/link?kind=candidate"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
        await tab.goto(site.url + "/search.html"); await tab.waitFor("document.readyState === 'complete' && !!document.getElementById('company')", 15000);
        await tab.waitFor("document.querySelectorAll('#results .card').length > 0 || !document.getElementById('recap').hidden", 8000); await sleep(600);
        const sent = searches(site);
        if (sent.length !== 1) bad.push(id + ": after the link the saved search ran " + sent.length + " times");
        else {
          if (!sameBody(sent[0].body, wantBody(s0.c, s0.q, s0.r))) bad.push(id + ": the search that ran by itself carried " + JSON.stringify(sent[0].body) + ", wanted " + JSON.stringify(wantBody(s0.c, s0.q, s0.r)));
        }
        if ((await snap(tab)).pending !== null) bad.push(id + ": the saved search was not removed after it ran");
      } finally { await tab.close(); await site.close(); }
    }
    return bad;
  },

  async noX(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    const phoneFiles = () => site.hits.filter((h) => /\/js\/(phone-|mobile\/)/.test(h));
    try {
      await tab.focusEmulation(true); await become(tab, site, "out");
      for (const [label, hash, want] of [["a plain visit", "", { c: "", q: "" }], ["a classic address", "#c=" + enc("Meridian Health") + "&t=" + enc("Senior Data Analyst"), { c: "Meridian Health", q: "Senior Data Analyst" }], ["a fragment that is not ours", "#top", { c: "", q: "" }], ["an x inside a classic value", "#c=" + enc("Max=1 Corp") + "&t=Analyst", { c: "Max=1 Corp", q: "Analyst" }]]) {
        site.hits.length = 0;
        await openAt(tab, site, PHONE, hash, false);
        const s = await snap(tab);
        if (s.c !== want.c || s.q !== want.q) bad.push(label + ": the boxes are " + JSON.stringify([s.c, s.q]) + ", wanted " + JSON.stringify([want.c, want.q]));
        if (!s.bodyHidden || !s.privacyHidden || s.noteCount !== 0) bad.push(label + ": the phone panel is shown without an x");
        if (phoneFiles().length) bad.push(label + ": the phone files were fetched without an x: " + phoneFiles().join(", "));
        if (label === "a fragment that is not ours" && s.hash !== "#top") bad.push(label + ": the fragment was changed to '" + s.hash + "'");
      }
      site.hits.length = 0;
      await openAt(tab, site, PHONE, "#x=" + enc(reading("I01").text));
      const files = phoneFiles();
      for (const need of ["/js/phone-entry.js", "/js/phone-model.js", "/js/phone-text.js", "/js/mobile/mobile-reader/reader.js", "/js/mobile/extractor.js", "/js/mobile/kio.js"]) if (!files.some((f) => f.endsWith(need))) bad.push("with an x the page did not load " + need);
    } finally { await tab.close(); await site.close(); }
    return bad;
  },

  async refused(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    const A = enc(reading("I01").text);
    const CASES = [["a bad percent escape", "#x=%E0%A4%A"], ["a tab", "#x=a%09b"], ["a nul", "#x=a%00b"], ["x twice", "#x=" + A + "&x=" + A], ["x with a company", "#c=Meridian%20Health&x=" + A], ["x with a title", "#x=" + A + "&t=Analyst"], ["x with a req number", "#x=" + A + "&r=4471"], ["x with o", "#x=" + A + "&o=e&h=jobs.example.invalid"], ["x with a KIO ID", "#x=" + A + "&k=KIO7K3M9Q2XW4T9"]];
    try {
      await tab.focusEmulation(true); await tab.viewport(PHONE.w, true, PHONE.h); await become(tab, site, "candidate");
      for (const [label, hash] of CASES) {
        site.calls.length = 0;
        await openAt(tab, site, PHONE, hash);
        const s = await snap(tab);
        if (s.c !== "" || s.q !== "" || s.r !== "") bad.push(label + ": filled " + JSON.stringify([s.c.slice(0, 20), s.q.slice(0, 20), s.r]));
        if (s.line !== S[10]) bad.push(label + ": the panel line is '" + s.line + "'");
        if (!cleanAddress(s)) bad.push(label + ": the refused address is still in the address bar");
        if (!s.privacyHidden || s.noteCount !== 0 || !s.moreHidden) bad.push(label + ": more than sentence 10 is shown");
        if (searches(site).length) bad.push(label + ": a search ran");
        // a search the person types afterwards is the site's own (a refused address is not the phone entry's)
        await tab.eval("(() => { document.getElementById('company').value = 'Meridian Health'; document.getElementById('titleq').value = 'Senior Data Analyst'; document.getElementById('searchForm').requestSubmit(); })()"); await sleep(1300);
        const sent = searches(site);
        if (sent.length !== 1) bad.push(label + ": the typed search was sent " + sent.length + " times");
        else if (sent[0].body.origin !== "site") bad.push(label + ": a search typed after a refused address carried origin " + sent[0].body.origin);
      }
      // an empty text is "nothing could be read": the module ran, the form is empty, the search is the phone entry's
      site.calls.length = 0;
      await openAt(tab, site, PHONE, "#x=");
      let s = await snap(tab);
      if (s.line !== S[9] || s.c !== "" || s.privacyHidden || !cleanAddress(s)) bad.push("an empty x: " + JSON.stringify([s.line, s.c, s.privacyHidden, s.hash]));
      await tab.eval("(() => { document.getElementById('company').value = 'Meridian Health'; document.getElementById('titleq').value = 'Senior Data Analyst'; document.getElementById('searchForm').requestSubmit(); })()"); await sleep(1300);
      if (searches(site).length !== 1 || searches(site)[0].body.origin !== "mobile") bad.push("a search typed after an empty x carried " + JSON.stringify(searches(site).map((c) => c.body.origin)));
    } finally { await tab.close(); await site.close(); }
    return bad;
  },

  async markup(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    const TEXTS = ["Company: <b>Bold</b> Corp <img src=x onerror=\"window.__xss=1\">\nRole: <img src=x onerror=window.__xss=2>Analyst <svg onload=\"window.__xss=3\">\nReq ID: <script>window.__xss=4</script>4471", "<img src=x onerror=window.__xss=5>\nContoso <b>Freight</b>\nAustin, TX\nViewed\n<svg onload=window.__xss=6>"];
    try {
      await tab.focusEmulation(true); await tab.viewport(PHONE.w, true, PHONE.h); await become(tab, site, "out");
      for (const [i, t] of TEXTS.entries()) {
        await openAt(tab, site, PHONE, "#x=" + enc(t));
        const s = await snap(tab);
        if (s.xss !== null || s.imgs !== 0 || s.bolds !== 0) bad.push("text " + (i + 1) + ": markup in the screenshot text ran or became an element (xss " + s.xss + ", elements " + s.imgs + ", bold " + s.bolds + ")");
        const allowed = new Set(Object.values(S).concat([S[1] + " " + S[11], S[9] + " " + S[11]]));
        if (!allowed.has(s.line)) bad.push("text " + (i + 1) + ": the panel line is not one of the fixed sentences: " + String(s.line).slice(0, 60));
      }
    } finally { await tab.close(); await site.close(); }
    return bad;
  },

  async edit(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await tab.viewport(PHONE.w, true, PHONE.h); await become(tab, site, "out");
      const r = reading("I06");   // a company that ends with dots: a note under the company box
      await openAt(tab, site, PHONE, "#x=" + enc(r.text));
      let s = await snap(tab);
      if (s.notes.company !== S[2]) { bad.push("no note under the company box to start with: " + JSON.stringify(s.notes)); return bad; }
      await tab.eval("document.getElementById('titleq').focus()"); await tab.send("Input.insertText", { text: "x" }); await sleep(150);
      s = await snap(tab);
      if (s.notes.company !== S[2]) bad.push("typing in the title box ended the note under the company box");
      await tab.eval("document.getElementById('company').focus()"); await tab.send("Input.insertText", { text: "x" }); await sleep(150);
      s = await snap(tab);
      if (s.notes.company !== null || s.noteCount !== 0) bad.push("typing in the company box did not end its note: " + JSON.stringify(s.notes));
      if (String(s.describedby.company || "").includes("phoneNote")) bad.push("the company box is still tied to a note that is gone");
      const r2 = reading("I04");   // the req number found in the title
      await openAt(tab, site, PHONE, "#x=" + enc(r2.text));
      await tab.eval("document.getElementById('reqq').focus()"); await tab.send("Input.insertText", { text: "9" }); await sleep(150);
      s = await snap(tab);
      if (s.notes.req !== null) bad.push("typing in the req number box did not end its note");
    } finally { await tab.close(); await site.close(); }
    return bad;
  },

  async keyboard(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await tab.viewport(PHONE.w, true, PHONE.h); await become(tab, site, "out");
      const r = reading("A06");
      await openAt(tab, site, PHONE, "#x=" + enc(r.text));
      const active = () => tab.eval("(() => { const a = document.activeElement; return a ? (a.id || a.textContent || a.tagName).slice(0, 80) : ''; })()");
      let n = 0, here = "";
      for (; n < 40; n++) { await tab.key("Tab"); here = await active(); if (here === "Pick another opening") break; }
      if (here !== "Pick another opening") { bad.push("Tab never reached the Pick another opening button (stopped at '" + here + "')"); return bad; }
      await tab.key("Enter"); await sleep(150);
      let s = await snap(tab);
      if (s.expanded !== "true" || s.listHidden) bad.push("Enter on the button did not open the list");
      await tab.key("Tab"); const first = await active();
      if (first !== r.expect.others[0]) bad.push("Tab from the button did not reach the first choice: '" + first + "'");
      await tab.key("Enter"); await sleep(200);
      s = await snap(tab);
      const want = splitChoice(r.expect.others[0]);
      if (s.c !== want.company || s.q !== want.title || s.line !== S[8]) bad.push("Enter on a choice did not pick it: " + JSON.stringify([s.c, s.q, s.line]));
      if ((await active()) !== "Pick another opening") bad.push("after picking the focus is not on the button");
      // the panel is a polite live region and holds its line
      if (s.live !== "polite") bad.push("the panel is not aria-live polite");
    } finally { await tab.close(); await site.close(); }
    return bad;
  },

  async devices(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    const r = reading("I01");
    const CASES = [
      ["a mouse in a 800 pixel window", { n: "mouse800", w: 800, h: 900, phone: false }, "tool"], ["an iPad, touch, 1024 pixels", { n: "ipad", w: 1024, h: 768, phone: true }, "tool"], ["an iPad Pro, touch, 1366 pixels", { n: "ipadpro", w: 1366, h: 1024, phone: true }, "tool"],
      ["an iPhone asking for the desktop site, touch, 980 pixels", { n: "desktopsite", w: 980, h: 1200, phone: true }, "tool"], ["a mouse at 1440 pixels", { n: "computer", w: 1440, h: 900, phone: false }, "message"], ["a mouse at 1100 pixels", { n: "computer1100", w: 1100, h: 800, phone: false }, "message"],
    ];
    try {
      await tab.focusEmulation(true); await become(tab, site, "candidate");
      for (const [label, size, want] of CASES) {
        site.calls.length = 0;
        await openAt(tab, site, size, "#x=" + enc(r.text));
        const s = await snap(tab);
        if (want === "tool") { if (s.c !== r.expect.company || s.line !== S[1]) bad.push(label + ": expected the tool, got " + JSON.stringify([s.c, s.line])); }
        else {
          if (s.c !== "" || s.line !== S[12]) bad.push(label + ": expected sentence 12, got " + JSON.stringify([s.c, s.line]));
          if (s.links !== 0) bad.push(label + ": a link is shown while EXTENSION_PAGE_URL is empty");
          if (!cleanAddress(s)) bad.push(label + ": the address still holds the fragment");
          await tab.eval("(() => { document.getElementById('company').value = 'Meridian Health'; document.getElementById('titleq').value = 'Senior Data Analyst'; document.getElementById('searchForm').requestSubmit(); })()"); await sleep(1300);
          const sent = searches(site);
          if (sent.length !== 1 || sent[0].body.origin !== "site") bad.push(label + ": a search typed on a computer carried " + JSON.stringify(sent.map((c) => c.body.origin)));
        }
      }
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  // the pure parts, in the copy under test (so a defect made in a copy of the code is seen by the unit tests as well)
  async unit(root) { return runUnit(root, "phone-entry.unit.test.js"); },
};
function runUnit(root, file) {
  const env = Object.assign({}, process.env); delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ["--test", path.join(root, "tests", file)], { cwd: root, env, encoding: "utf8", timeout: 300000 });
  if (r.status === 0) return [];
  const first = (r.stdout.match(/^\s*(?:✖|not ok \d+ -) (.+?)(?: \(\d[\d.]*ms\))?$/m) || [])[1];
  return [file + " fails: " + (first || String(r.stderr || r.stdout).slice(0, 120)).slice(0, 160)];
}

// ---- the tests ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const run = async (name, o) => { const t0 = Date.now(), bad = await SCENARIOS[name](ROOT, o); console.log("scenario " + name + ": " + ((Date.now() - t0) / 1000).toFixed(0) + " s, " + bad.length + " problems"); assert.deepEqual(bad, [], name + " problems:\n" + bad.join("\n")); };
test("every reading at 390 x 844, 844 x 390, 820 x 1180 and 1440 x 900: state, boxes, notes, sentences, list, address, taps, and at 390 the request Search sends", { timeout: 2400000 }, () => run("readings"));
test("the proof: no request, no storage and no log holds the screenshot text; Search sends only the box values and origin mobile", { timeout: 1200000 }, () => run("proof"));
test("hashchange: a second reading on the same page is read", { timeout: 600000 }, () => run("hashchange"));
test("the sign in round trip: the saved search carries origin mobile and the search that runs by itself is sent with it", { timeout: 900000 }, () => run("signin"));
test("without an x the page is the ordinary search page and the phone files are not fetched", { timeout: 600000 }, () => run("noX"));
test("refused addresses fill nothing, say sentence 10 and are removed from the address bar", { timeout: 600000 }, () => run("refused"));
test("markup in the screenshot text is only text", { timeout: 600000 }, () => run("markup"));
test("typing in a box ends its note", { timeout: 600000 }, () => run("edit"));
test("the keyboard and the live region", { timeout: 600000 }, () => run("keyboard"));
test("devices: the tool for a phone, a tablet, a small window and an iPhone asking for the desktop site; sentence 12 for a computer", { timeout: 900000 }, () => run("devices"));

// ---- planted breakages: one deliberate defect at a time in a copy of the repository; each must make a scenario (or the unit test) fail ---------------------------------------------------------------------------------
const PE = "js/phone-entry.js", PM = "js/phone-model.js", SP = "js/pages/search.js";
const FIND_PARSED = "const parsed = readFragment(win.location.hash);";
const DEFECTS = [
  ["the screenshot text is sent in a request", [["proof", { ids: ["I01"] }]], [[PE, (s) => s.replace(FIND_PARSED, FIND_PARSED + " try { win.fetch(win.location.origin + '/leak?t=' + encodeURIComponent(win.location.hash)); } catch (e) { /* planted */ }")]]],
  ["the screenshot text is sent in the body of a request", [["proof", { ids: ["I01"] }]], [[PE, (s) => s.replace(FIND_PARSED, FIND_PARSED + " try { win.fetch(win.location.origin + '/leak', { method: 'POST', body: win.location.hash }); } catch (e) { /* planted */ }")]]],
  ["the screenshot text is stored in localStorage", [["proof", { ids: ["I01"] }]], [[PE, (s) => s.replace(FIND_PARSED, FIND_PARSED + " try { win.localStorage.setItem('last-reading', win.location.hash); } catch (e) { /* planted */ }")]]],
  ["the screenshot text is stored in sessionStorage", [["proof", { ids: ["I01"] }]], [[PE, (s) => s.replace(FIND_PARSED, FIND_PARSED + " try { win.sessionStorage.setItem('last-reading', win.location.hash); } catch (e) { /* planted */ }")]]],
  ["the screenshot text is kept in window.name", [["proof", { ids: ["I01"] }]], [[PE, (s) => s.replace(FIND_PARSED, FIND_PARSED + " win.name = win.location.hash;")]]],
  ["the screenshot text is kept in a cookie", [["proof", { ids: ["I01"] }]], [[PE, (s) => s.replace(FIND_PARSED, FIND_PARSED + " doc.cookie = 'last=' + win.location.hash.slice(0, 200);")]]],
  ["the screenshot text is kept in the history state", [["proof", { ids: ["I01"] }]], [[PE, (s) => s.replace("win.history.replaceState(win.history.state, \"\", win.location.pathname + win.location.search)", "win.history.replaceState(win.location.hash, \"\", win.location.pathname + win.location.search)")]]],
  ["the search is started by the page (no press of Search)", [["proof", { ids: ["I01"] }]], [[PE, (s) => s.replace("  showBody();\n  return true;\n}", "  showBody();\n  doc.getElementById('searchForm').requestSubmit();\n  return true;\n}")]]],
  ["the address is not cleaned", [["readings", { ids: ["I01"], sizes: [PHONE], noSearch: true }]], [[PE, (s) => s.replace("const takeAddress = () => { try { win.history.replaceState(win.history.state, \"\", win.location.pathname + win.location.search); } catch { /* the address bar keeps the fragment; the boxes are still filled */ } };", "const takeAddress = () => {};")]]],
  ["a refused address is not cleaned", [["refused"]], [[PE, (s) => s.replace("  if (parsed.refused) {\n    takeAddress(); fill(", "  if (parsed.refused) {\n    fill(")]]],
  ["the first card is not the one that fills the boxes (the last one is)", [["readings", { ids: ["I02", "I03"], sizes: [PHONE], noSearch: true }]], [[PM, (s) => s.replace("primary = cards[0];", "primary = cards[cards.length - 1];")]]],
  ["a card cut by the edge of the screen is listed", [["readings", { ids: ["I11", "A07"], sizes: [PHONE], noSearch: true }]], [[PM, (s) => s.replace("cards = complete.map(ofCard);", "cards = complete.map(ofCard); if (r.seen && r.seen.cut) cards.push({ company: 'Cut Card Inc', title: 'Cut Title', req: '', reqUnlabelled: false, cutCompany: false, cutTitle: false, titleShortened: false, titleBroken: false });")]]],
  ["a title the reader shortened gets no note", [["readings", { ids: ["I12"], sizes: [PHONE], noSearch: true }], ["unit"]], [[PM, (s) => s.replace("titleShortened: r.titleShortened === true, titleBroken: r.titleBroken === true };\n  } else if", "titleShortened: false, titleBroken: r.titleBroken === true };\n  } else if")]]],
  ["a picked card's shortened title gets no note", [["readings", { ids: ["A05"], sizes: [PHONE], noSearch: true }]], [[PM, (s) => s.replace("titleShortened: c.titleShortened === true, titleBroken: false", "titleShortened: false, titleBroken: false")]]],
  ["a title cut off by dots gets no note", [["readings", { ids: ["I05"], sizes: [PHONE], noSearch: true }], ["unit"]], [[PM, (s) => s.replace("if (p.cutTitle || p.titleShortened) notes.query = 2;", "")]]],
  ["a broken word in the title gets no sentence 4", [["readings", { ids: ["I10"], sizes: [PHONE], noSearch: true }], ["unit"]], [[PM, (s) => s.replace("else if (p.titleBroken) notes.query = 4;", "")]]],
  ["the hashchange of the page is ignored", [["hashchange"]], [[SP, (s) => s.replace("window.addEventListener(\"hashchange\", () => { if (PHONE_X.test(location.hash)) { takePending(localStorage); runPhone(); } });", "")]]],
  ["the desktop message is shown on a phone", [["readings", { ids: ["I01"], sizes: [PHONE], noSearch: true }]], [[PE, (s) => s.replace("  if (isComputer(win)) {", "  if (true) {")]]],
  ["the tool is shown on a computer", [["readings", { ids: ["I01"], sizes: [COMPUTER], noSearch: true }], ["devices"]], [[PE, (s) => s.replace("export const isComputer = (win) => { try { return !!(win.matchMedia && win.matchMedia(COMPUTER_QUERY).matches); } catch { return false; } };", "export const isComputer = (win) => false;")]]],
  ["a touch screen of 1024 pixels is taken for a computer (the pointer test is gone)", [["devices"]], [[PE, (s) => s.replace('export const COMPUTER_QUERY = "(hover: hover) and (pointer: fine) and (min-width: 900px)";', 'export const COMPUTER_QUERY = "(min-width: 900px)";')]]],
  ["the origin is not mobile", [["proof", { ids: ["I01"] }], ["signin", { ids: ["I01"] }]], [[PE, (s) => s.replace('onOrigin({ origin: "mobile", host: null })', 'onOrigin({ origin: "site", host: null })')]]],
  ["the origin carries a host", [["signin", { ids: ["I01"] }]], [[PE, (s) => s.replace('onOrigin({ origin: "mobile", host: null })', 'onOrigin({ origin: "mobile", host: "jobs.example.invalid" })')], ["js/search-origin.js", (s) => s.replace('if (o === "m") return { origin: "mobile", host: null };', 'if (o === "m") return { origin: "mobile", host: h == null ? null : cleanHost(h) };').replace('if (o.origin === "mobile") return { origin: "mobile" };', 'if (o.origin === "mobile") return { origin: "mobile", origin_host: o.host };')]]],
  ["x is accepted together with the classic keys", [["refused"], ["unit"]], [[PM, (s) => s.replace("if (old || xCount > 1 ||", "if (xCount > 1 ||")]]],
  ["a repeated x is accepted", [["unit"]], [[PM, (s) => s.replace("xCount > 1 || raw.length", "xCount > 100 || raw.length")]]],
  ["a control character is accepted", [["refused"], ["unit"]], [[PM, (s) => s.replace("if (hasBadControl(text)) return", "if (false) return")]]],
  ["a bad percent escape is accepted as it is", [["refused"], ["unit"]], [[PM, (s) => s.replace("try { text = decodeURIComponent(value); } catch { return { x: true, refused: true, text: \"\", source: \"\" }; }", "try { text = decodeURIComponent(value); } catch { text = value; }")]]],
  ["the cap of 600 characters is gone", [["readings", { ids: ["I13"], sizes: [PHONE], noSearch: true }], ["unit"]], [[PM, (s) => s.replace("export const TEXT_CAP = 600,", "export const TEXT_CAP = 60000,")]]],
  ["the screenshot text is put into the page as markup", [["markup"]], [[PE, (s) => s.replace("const fill = (f) => { companyEl.value = f.company;", "const fill = (f) => { companyEl.insertAdjacentHTML('afterend', f.company); companyEl.value = f.company;")]]],
  ["the screenshot text is echoed in the panel line", [["readings", { ids: ["I01"], sizes: [PHONE], noSearch: true }]], [[PE, (s) => s.replace("  say(SENTENCES[1]);\n  if (parsed.cut)", "  say(SENTENCES[1] + ' ' + parsed.boxes.fill.company);\n  if (parsed.cut)")]]],
  ["the privacy sentence is missing", [["readings", { ids: ["I01"], sizes: [PHONE], noSearch: true }]], [[PE, (s) => s.replace("privacy.textContent = SENTENCES[13]; privacy.dataset.on = \"1\";", "")]]],
  ["the privacy sentence is shown on the page again (it must stay behind the info button)", [["readings", { ids: ["I01"], sizes: [PHONE], noSearch: true }]], [[PE, (s) => s.replace("privacy.textContent = SENTENCES[13]; privacy.dataset.on = \"1\";", "privacy.textContent = SENTENCES[13]; privacy.dataset.on = \"1\"; privacy.hidden = false;")]]],
  ["editing a box keeps its note", [["edit"]], [[PE, (s) => s.replace("boxes[name].addEventListener(\"input\", () => clearNote(name));", "boxes[name].addEventListener(\"input\", () => {});")]]],
  ["picking another opening keeps the notes of the first one", [["readings", { ids: ["I15"], sizes: [PHONE], noSearch: true }]], [[PE, (s) => s.replace("fill(b.fill); setNotes(b.notes);", "fill(b.fill);")]]],
  ["picking another opening keeps the first opening's req number", [["readings", { ids: ["I15"], sizes: [PHONE], noSearch: true }]], [[PE, (s) => s.replace("fill(b.fill); setNotes(b.notes);", "companyEl.value = b.fill.company; queryEl.value = b.fill.query; setNotes(b.notes);")]]],
  ["the phone files are loaded for every visit (a static import)", [["noX"]], [[SP, (s) => s.replace('import { applyFragmentPrefill }', 'import "../phone-entry.js";\nimport { applyFragmentPrefill }')]]],
  ["the classic prefill is skipped when there is no x", [["noX"]], [[SP, (s) => s.replace("else if (applyFragmentPrefill(", "else if (false && applyFragmentPrefill(")]]],
  ["an address on another site is shown as the extension link", [["devices"], ["unit"]], [[PE, (s) => s.replace("return u.origin === win.location.origin && (u.protocol", "return (u.protocol")], ["js/config.js", (s) => s.replace('export const EXTENSION_PAGE_URL = "";', 'export const EXTENSION_PAGE_URL = "https://evil.example.invalid/x";')]]],
  ["the Pick another opening button is a small tap target", [["readings", { ids: ["I02"], sizes: [PHONE], noSearch: true }]], [["app.css", (s) => s.replace(".phone-body .phone-pick,.phone-body .phone-choice{min-height:44px;min-width:44px;box-sizing:border-box;vertical-align:middle}", ".phone-body .phone-pick,.phone-body .phone-choice{min-height:20px;min-width:20px;padding:0;box-sizing:border-box;vertical-align:middle}").replace(".phone-body .phone-pick{margin:0 2px;padding:8px 12px}", ".phone-body .phone-pick{margin:0 2px;padding:0}")]]],
  ["a choice is wider than the screen", [["readings", { ids: ["A05"], sizes: [PHONE], noSearch: true }]], [["app.css", (s) => s.replace("white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}", "white-space:nowrap;width:max-content;max-width:none;display:block}")]]],
];
test("planted breakages: each deliberate defect in the phone entry makes a scenario fail", { timeout: 6000000 }, async () => {
  const missed = [], only = process.env.FGJ_IB_ONLY ? process.env.FGJ_IB_ONLY.split("|") : null;
  let n = 0;
  for (const [label, scenarios, edits] of DEFECTS) {
    if (only && !only.some((x) => label.includes(x))) continue;
    n++;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-phone-ctl-")), t0 = Date.now();
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) {
        const p = path.join(dir, rel), before = fs.readFileSync(p, "utf8").replace(/\?v=[0-9a-f]{8}(?=["'`])/g, ""), after = mutate(before);
        assert.notEqual(after, before, "the defect '" + label + "' changed nothing in " + rel);
        fs.writeFileSync(p, after);
      }
      const found = [];
      for (const [name, o] of scenarios) found.push(...(await SCENARIOS[name](dir, o)).map((x) => name + ": " + x));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  [" + ((Date.now() - t0) / 1000).toFixed(0) + " s]  (" + found[0].slice(0, 150) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  console.log("planted breakages run: " + n + ", missed: " + missed.length);
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
