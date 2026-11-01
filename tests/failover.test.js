// failover.test.js - the failover on the candidate search page (prompt HM, October 31, 2026), in a real browser on the repo's own files with a fake backend (tests/fake-site.js; no real project, no key). The edge function (prompt HL)
// answers a failed key (a KIO ID that is not valid, not found or past its retention, or a req number that matches nothing) together with a company AND a title by searching the company and title instead, and adds
// failover { reason, tried_key } to the answer: a 200 with results, or a 404 with miss_kind (when the shared 20 a day allow it) and the failover when that search finds nothing. The fake backend answers exactly the shapes of the
// CONTRACT FOR HM in the HL report and nothing else (opts.failover). Proven here:
//   1. the four sentences, letter for letter, as plain text above the results, read out with the search's one message, no forbidden word, no dash;
//   2. each reason found (a valid ID that nobody holds, one past its retention, an ID that is not valid from the extension's fragment, a req number that matched nothing) and empty (with each miss kind and with none: the old standard words);
//   3. what is NOT a failover: a req number that matches, a plain title search, a KIO ID or a postID next to a req number (refused with new words, results cleared), an ID the edge refuses with the 400 (the boxes keep what was typed);
//   4. a malformed ID with nothing else: the usual words, and the ID text is sent so the edge function sees it;
//   5. the fragment keeps the company and title of an invalid k; o=e and h become origin extension and the cleaned host for the next search only; every other search is origin site with no host;
//   6. the sentence under the results about what the record holds.
// Then negative controls: one planted defect at a time on a copy of the repo; each must make a check fail.
// Run: node --test tests/failover.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite, kioOf, KIO_GONE } from "./fake-site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

// John's words, letter for letter (October 31, 2026), with <company> and <title> filled in
const SENTENCE = {
  id_invalid: (c, t) => `That KIO ID is not valid, so these are the results for ${c} and ${t}.`,
  id_not_registered: (c, t) => `That KIO ID was not found, so these are the results for ${c} and ${t}.`,
  id_gone: (c, t) => `That opening is no longer on FightGhostJobs, so these are the results for ${c} and ${t}.`,
  req_no_match: (c, t) => `That req number did not match, so these are the results for ${c} and ${t}.`,
};
const NOTICE = "We keep a record of your search, including the words you typed, so we can count what people look for. The record also holds any KIO ID or req number you typed or we read from the job page, and an ID you mistyped is kept as typed. Employers never see who searched. Details are in our Privacy Policy.";
const KEY_WITH_REQ = "A KIO ID cannot be used with a req number. Fill in one or the other.";
const KIO_INVALID = "That ID is not valid. Check it and try again.";
const FORBIDDEN = /\b(ghost|fake|scam|fraud|suspicious|verified|certified|trusted|safe|compliant|guaranteed|catch|detect|flag|expose|loophole|compliance|posting|postings)\b/i;
const BAD_ID = "KIO-7K3M-9Q2X-W4T8";                 // the shape of an ID, with a wrong check character
const UNKNOWN_ID = kioOf("Q2Q2Q2Q2Q2Q2").stored;      // a valid ID nobody holds in the fake backend
const MISS = {
  not_registered: ["This employer is not registered with FightGhostJobs yet. That says nothing about the employer or its openings."],
  registered_no_match: ["This employer is registered with FightGhostJobs and has openings in our system, but none match the details you gave.",
    "Check the KIO ID, title or req number against the opening you are looking at. If the employer is advertising it but it is not here, the employer has not registered it with us."],
  registered_none_live: ["This employer is registered with FightGhostJobs. It has no live openings in our system right now."],
};
const modOf = (root, file, q) => import(pathToFileURL(path.join(root, "js", file)).href + "?x=" + q + Math.random());

// ---- no browser
const UNIT = {
  async words(root) {
    const bad = [], m = await modOf(root, "search-input.js", "w");
    const reasons = Object.keys(SENTENCE);
    if (Object.keys(m.FAILOVER_SENTENCES).length !== 4) bad.push("FAILOVER_SENTENCES does not hold exactly four reasons");
    for (const r of reasons) {
      const got = m.failoverSentence(r, "Acme Inc", "Nurse Practitioner");
      if (got !== SENTENCE[r]("Acme Inc", "Nurse Practitioner")) bad.push(r + ": the sentence is " + JSON.stringify(got));
    }
    for (const v of [undefined, null, "", "bogus", "constructor", "__proto__", "toString", 5, true, {}, [], "ID_INVALID", " id_invalid", "kio"]) if (m.failoverSentence(v, "A", "B") !== null) bad.push("a value that is not one of the four reasons gave a sentence: " + JSON.stringify(v));
    const all = Object.values(m.FAILOVER_SENTENCES).join(" ") + " " + m.KEY_WITH_REQ_MESSAGE;
    if (FORBIDDEN.test(all.replace(/FightGhostJobs/g, "FGJ"))) bad.push("a forbidden word is in the strings: " + (all.replace(/FightGhostJobs/g, "FGJ").match(FORBIDDEN) || [])[0]);
    if (new RegExp("[" + String.fromCharCode(8211, 8212) + "]").test(all)) bad.push("a dash (em or en) is in the strings");
    if (m.KEY_WITH_REQ_MESSAGE !== KEY_WITH_REQ) bad.push("the KIO ID with a req number message changed: " + m.KEY_WITH_REQ_MESSAGE);
    // the company and the title are text, cut to 80 characters like the echo line, and never changed into markup
    const long = m.failoverSentence("id_invalid", "C".repeat(100), "T".repeat(100));
    if (!long.includes("C".repeat(79) + "…") || long.includes("C".repeat(81))) bad.push("the company is not cut at 80 characters");
    if (m.failoverSentence("id_invalid", "<b>a</b> & co", "x") !== "That KIO ID is not valid, so these are the results for <b>a</b> & co and x.") bad.push("typed characters were changed");
    return bad;
  },
  async resolve(root) {
    const bad = [], m = await modOf(root, "search-input.js", "r");
    const ok = m.resolveSearch("Nurse", "R-1");
    if (JSON.stringify(ok) !== JSON.stringify({ ok: true, kind: "req", value: "R-1", title: "Nurse" })) bad.push("a req number with a title is not a req search with the title kept: " + JSON.stringify(ok));
    const badId = m.resolveSearch(BAD_ID, "R-1");   // an ID that is not valid keeps its own words (it is sent to the edge function alone by the page)
    if (badId.ok !== false || badId.message !== KIO_INVALID) bad.push("an ID that is not valid next to a req number: " + JSON.stringify(badId));
    for (const [what, t] of [["a valid KIO ID", kioOf("D21M48YBZQBF").shown], ["a postID", "7777-7777-7777"]]) {
      const r = m.resolveSearch(t, "R-1");
      if (r.ok !== false || r.message !== KEY_WITH_REQ || r.clearResults !== true || r.focus !== "req") bad.push(what + " next to a req number is not refused with the new words: " + JSON.stringify(r));
    }
    if (m.resolveSearch("Nurse", "!!").focus !== "req") bad.push("a bad req number does not send the cursor to the req box");
    if (m.resolveSearch("--", "R-1").focus !== "title") bad.push("a title with no letters does not send the cursor to the title box");
    if (m.resolveSearch("Nurse", "").kind !== "phrase" || m.resolveSearch("", "R-1").kind !== "req") bad.push("a single box changed");
    return bad;
  },
  async fragment(root) {
    const bad = [], f = await modOf(root, "fragment-prefill.js", "f");
    const p = (h) => f.parseSearchFragment(h).result;
    const inv = p("#k=" + BAD_ID + "&c=Meridian&t=Nurse");
    if (!inv || inv.company !== "Meridian" || inv.title !== "Nurse" || inv.value !== BAD_ID || inv.bad !== true || inv.stored !== null) bad.push("an invalid k with a company and a title did not keep them: " + JSON.stringify(inv));
    for (const h of ["#k=" + BAD_ID + "&c=Meridian", "#k=" + BAD_ID + "&t=Nurse", "#k=" + BAD_ID, "#k=" + BAD_ID + "&c=Meridian&t=Nurse&r=4471", "#k=" + BAD_ID + "&c=Meridian&t=Nurse&p=D21M-48YB-ZQBF", "#k=" + "K".repeat(25) + "&c=Meridian&t=Nurse"]) if (p(h) !== null) bad.push("this fragment is not refused whole: " + h);
    const good = p("#k=" + UNKNOWN_ID + "&c=Meridian&t=Nurse");
    if (!good || good.bad || good.stored !== UNKNOWN_ID) bad.push("a valid k changed: " + JSON.stringify(good));
    // o and h: only o=e is the extension; the host is cleaned; a wrong value is ignored (never a reason to refuse); they do not make a fragment ours on their own
    const e = p("#c=Meridian&t=Nurse&o=e&h=" + encodeURIComponent("https://WWW.Indeed.com:443/viewjob?jk=1#x"));
    if (!e || !e.origin || e.origin.origin !== "extension" || e.origin.host !== "indeed.com") bad.push("o=e and a host were not read: " + JSON.stringify(e));
    const noHost = p("#c=Meridian&t=Nurse&o=e");
    if (!noHost || noHost.origin.origin !== "extension" || noHost.origin.host !== null) bad.push("o=e with no host: " + JSON.stringify(noHost));
    const badHost = p("#c=Meridian&t=Nurse&o=e&h=" + encodeURIComponent("not a host!!"));
    if (!badHost || badHost.origin.host !== null) bad.push("a host that is not a host was kept: " + JSON.stringify(badHost));
    for (const h of ["#c=Meridian&t=Nurse&o=x", "#c=Meridian&t=Nurse&o=extension", "#c=Meridian&t=Nurse&h=indeed.com", "#c=Meridian&t=Nurse"]) { const r = p(h); if (!r || "origin" in r) bad.push("this fragment carries an origin: " + h); }
    const dup = p("#c=Meridian&t=Nurse&o=e&o=x&h=a.com&h=b.com");
    if (!dup || dup.origin.origin !== "extension" || dup.origin.host !== "a.com") bad.push("a second o or h changed the first: " + JSON.stringify(dup));
    if (f.parseSearchFragment("#o=e&h=indeed.com").ours !== false) bad.push("o and h alone made a fragment ours");
    for (const [raw, want] of [["indeed.com", "indeed.com"], ["WWW.Indeed.COM", "indeed.com"], ["https://jobs.example.org/a/b?c=d", "jobs.example.org"], ["user@mail.example.net:8080", "mail.example.net"], ["example.com...", "example.com"], ["email", "email"], ["", null], ["a b", null], ["-bad.com", null], ["x".repeat(254), null]]) if (f.cleanHost(raw) !== want) bad.push("cleanHost(" + JSON.stringify(raw.slice(0, 30)) + ") is " + JSON.stringify(f.cleanHost(raw)));
    return bad;
  },
};

// ---- the page
async function openSearch(tab, site, hash) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.goto(site.url + "/404.html");
  await tab.goto(site.url + "/search.html" + (hash || ""));
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(500);
}
const fill = (tab, company, title, req) => tab.eval(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }; set("company", ${JSON.stringify(company)}); set("titleq", ${JSON.stringify(title)}); set("reqq", ${JSON.stringify(req)}); })()`);
const WATCH = `(() => { window.__said = []; const live = (n) => { const e = n.nodeType === 1 ? n : n.parentElement; return e && e.closest ? e.closest('[role=status],[role=alert],[aria-live]') : null; };
  new MutationObserver((ms) => { for (const m of ms) { const r = live(m.target); if (r && r.textContent.trim() !== "") window.__said.push(r.textContent.trim()); } }).observe(document, { childList: true, subtree: true, characterData: true }); })()`;
const READ = `(() => { const f = document.getElementById("failoverNotice"), n = document.getElementById("emptyNote"), res = document.getElementById("results"); const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth;
  return { fail: f ? f.textContent : null, failHtml: f ? f.innerHTML : null, failEls: f ? f.querySelectorAll("*").length : 0, order: Array.from(res.children).map((e) => e.id || (e.className || "").split(" ")[0]), note: n ? n.textContent : null,
    lines: n ? Array.from(n.querySelectorAll("p.miss-line")).map((p) => p.textContent) : [], cards: res.querySelectorAll(".card").length, missEls: res.querySelectorAll(".miss-line").length, titles: Array.from(res.querySelectorAll(".card")).map((c) => c.textContent).join(" | "), results: res.textContent,
    said: window.__said || [], sw, cw, count: document.getElementById("resultCount").hidden ? null : document.getElementById("resultCount").textContent, err: document.getElementById("formError").hidden ? null : document.getElementById("formError").textContent,
    recap: document.getElementById("recap").hidden ? null : document.getElementById("recapText").textContent, notice: document.getElementById("searchNotice").hidden ? null : document.getElementById("searchNotice").textContent.replace(/\\s+/g, " ").trim(),
    c: document.getElementById("company").value, q: document.getElementById("titleq").value, r: document.getElementById("reqq").value }; })()`;
const searches = (site) => site.calls.filter((c) => c.name === "candidate-search").map((c) => c.body);
// one flow: a fresh tab, signed in, the page opened (with an optional fragment), the boxes filled (or left as the fragment filled them), Search pressed; returns what is on the page and the requests made
async function flow(site, width, { hash, company, title, req, again }) {
  const tab = await browser.newTab();
  try {
    await tab.focusEmulation(true); await tab.viewport(width, width < 700, width < 700 ? 700 : 900);
    await openSearch(tab, site, hash); await tab.viewport(width, width < 700, width < 700 ? 700 : 900); await tab.eval(WATCH);
    if (company !== undefined) await fill(tab, company, title || "", req || "");
    await tab.eval(`document.getElementById("searchBtn").focus()`); await tab.key("Enter");
    await tab.waitFor("!!document.getElementById('failoverNotice') || !!document.getElementById('emptyNote') || document.querySelectorAll('#results .card').length > 0 || !document.getElementById('formError').hidden", 10000); await sleep(500);
    const first = await tab.eval(READ);
    let second = null;
    if (again) {   // the next search typed on the page
      await fill(tab, again.company, again.title || "", again.req || ""); await tab.eval(`document.getElementById("searchBtn").focus()`); await tab.key("Enter"); await sleep(1200);
      second = await tab.eval(READ);
    }
    return { r: first, second, calls: searches(site) };
  } finally { await tab.close(); }
}
const sub = (co, ti, req) => ({ company: co, title: ti, req });

const CASES = [   // reason, fragment (or none), the boxes to fill (or none), the body the page must send for the key
  ["id_invalid", "#k=" + BAD_ID + "&c=Meridian&t=Nurse", undefined, { kio: BAD_ID, company: "Meridian", phrase: "Nurse", origin: "site" }],
  ["id_not_registered", "#k=" + UNKNOWN_ID + "&c=Meridian&t=Nurse", undefined, { kio: UNKNOWN_ID, company: "Meridian", phrase: "Nurse", origin: "site" }],
  ["id_gone", "#k=" + KIO_GONE + "&c=Meridian&t=Nurse", undefined, { kio: KIO_GONE, company: "Meridian", phrase: "Nurse", origin: "site" }],
  ["req_no_match", "", sub("Meridian", "Nurse", "R-NOPE"), { company: "Meridian", req: "R-NOPE", phrase: "Nurse", origin: "site" }],
];
const EMPTY_CASES = [   // the same four with a company that has nothing
  ["id_invalid", "#k=" + BAD_ID + "&c=Zzz%20Nowhere&t=Nurse", undefined, { company: "Zzz Nowhere", title: "Nurse" }],
  ["id_not_registered", "#k=" + UNKNOWN_ID + "&c=Zzz%20Nowhere&t=Nurse", undefined, { company: "Zzz Nowhere", title: "Nurse" }],
  ["id_gone", "#k=" + KIO_GONE + "&c=Zzz%20Nowhere&t=Nurse", undefined, { company: "Zzz Nowhere", title: "Nurse" }],
  ["req_no_match", "", sub("Zzz Nowhere", "Nurse", "R-NOPE"), { company: "Zzz Nowhere", title: "Nurse" }],
];
const orderOk = (r) => r.order[0] === "failoverNotice";

const SCENARIOS = {
  unitWords: async (root) => UNIT.words(root),
  unitResolve: async (root) => UNIT.resolve(root),
  unitFragment: async (root) => UNIT.fragment(root),
  // each reason found, desktop and phone: the sentence above the results, the results of the company and title, nothing of a miss, nothing sideways, read out, the right request
  async pageFound(root) {
    const bad = [];
    const site = await startFakeSite(root, { kio: true, failover: { reqMatch: "R-MATCH" }, missKindOnFound: undefined });
    try {
      for (const [reason, hash, boxes, body] of CASES) for (const width of [1280, 375]) {
        const tag = reason + " / " + width + ": ";
        const { r, calls } = await flow(site, width, { hash, ...(boxes || {}) });
        const want = SENTENCE[reason]("Meridian", "Nurse");
        if (r.fail !== want) bad.push(tag + "the sentence is " + JSON.stringify(r.fail));
        if (!orderOk(r)) bad.push(tag + "the sentence is not the first thing in the results: " + JSON.stringify(r.order));
        if (r.cards !== 1 || !/Nurse Practitioner/.test(r.titles)) bad.push(tag + "the results are not the company and title results: " + r.cards);
        if (r.note !== null || r.lines.length || r.missEls) bad.push(tag + "a miss message is on a found failover");
        if (Object.values(MISS).flat().some((t) => r.results.includes(t.slice(0, 40)))) bad.push(tag + "the words of a miss message are among the results");
        if (r.count !== "1 matching opening") bad.push(tag + "the count line is " + JSON.stringify(r.count));
        if (r.sw > r.cw) bad.push(tag + "a sideways scroll bar (" + r.sw + " over " + r.cw + ")");
        if (!r.said.some((t) => t.includes(want))) bad.push(tag + "the sentence is not read out: " + JSON.stringify(r.said).slice(0, 200));
        if (JSON.stringify(calls.at(-1)) !== JSON.stringify(body)) bad.push(tag + "the request is " + JSON.stringify(calls.at(-1)) + " not " + JSON.stringify(body));
        if (!r.recap) bad.push(tag + "no recap");
      }
    } finally { await site.close(); }
    return bad;
  },
  // each reason empty: the sentence, then the echo line with the kind's words (or the old standard note when the answer has no kind); with a company that is typed markup the sentence is text
  async pageEmpty(root) {
    const bad = [];
    for (const kind of ["not_registered", "registered_no_match", "registered_none_live", undefined]) {
      const site = await startFakeSite(root, { kio: true, failover: { reqMatch: "R-MATCH" }, ...(kind ? { missKind: kind } : {}) });
      try {
        for (const [reason, hash, boxes, who] of EMPTY_CASES) for (const width of kind === "registered_no_match" || reason === "id_gone" ? [1280, 375] : [1280]) {
          const tag = reason + " / " + (kind || "no kind") + " / " + width + ": ";
          const { r } = await flow(site, width, { hash, ...(boxes || {}) });
          const want = SENTENCE[reason](who.company, who.title);
          const echo = `No openings found for "${who.company}" + "${who.title}". `;
          if (r.fail !== want) bad.push(tag + "the sentence is " + JSON.stringify(r.fail));
          if (r.order.join(",") !== "failoverNotice,emptyNote") bad.push(tag + "the order is " + JSON.stringify(r.order));
          if (r.cards !== 0) bad.push(tag + "result cards are shown");
          if (kind) { const w = [echo + MISS[kind][0], ...MISS[kind].slice(1)]; if (JSON.stringify(r.lines) !== JSON.stringify(w)) bad.push(tag + "the lines are " + JSON.stringify(r.lines)); if (/An opening appears here only if an employer has added it/.test(r.note || "")) bad.push(tag + "the general note is still there"); }
          else { if (!(r.note || "").startsWith(echo) || !/An opening appears here only if an employer has added it/.test(r.note || "") || r.lines.length) bad.push(tag + "no kind: not the standard words: " + String(r.note).slice(0, 120)); }
          if (/No opening is registered under that ID|no longer on FightGhostJobs\.$/.test(r.note || "")) bad.push(tag + "the words of an ID answer are shown");
          if (r.count !== "No matching openings") bad.push(tag + "the count line is " + JSON.stringify(r.count));
          if (r.sw > r.cw) bad.push(tag + "a sideways scroll bar (" + r.sw + " over " + r.cw + ")");
          if (!r.said.some((t) => t.includes(want))) bad.push(tag + "the sentence is not read out: " + JSON.stringify(r.said).slice(0, 160));
        }
        // typed markup is only ever text
        if (kind === "not_registered") {
          const evil = "<i>Zz</i> & <b>Co</b>", et = "<b>x</b> nurse";
          const { r } = await flow(site, 1280, { company: evil, title: et, req: "R-NOPE" });
          if (r.fail !== SENTENCE.req_no_match(evil, et)) bad.push("markup: the sentence is " + JSON.stringify(r.fail));
          if (r.failEls !== 0 || /<i>|<b>/.test(r.failHtml || "")) bad.push("markup: typed text became elements: " + String(r.failHtml).slice(0, 120));
        }
      } finally { await site.close(); }
    }
    return bad;
  },
  // not a failover
  async pageNot(root) {
    const bad = [];
    const site = await startFakeSite(root, { kio: true, failover: { reqMatch: "R-MATCH" } });
    try {
      let x = await flow(site, 1280, sub("Meridian", "Nurse", "R-MATCH"));
      if (x.r.fail !== null) bad.push("a req number that matched shows a failover sentence");
      if (x.r.cards < 1) bad.push("a req number that matched shows no results");
      if (JSON.stringify(x.calls.at(-1)) !== JSON.stringify({ company: "Meridian", req: "R-MATCH", phrase: "Nurse", origin: "site" })) bad.push("the req request is " + JSON.stringify(x.calls.at(-1)));
      x = await flow(site, 1280, sub("Meridian", "Nurse", ""));
      if (x.r.fail !== null || JSON.stringify(x.calls.at(-1)) !== JSON.stringify({ company: "Meridian", phrase: "Nurse", origin: "site" })) bad.push("a plain title search changed: " + JSON.stringify(x.calls.at(-1)));
      // a KIO ID or a postID next to a req number: refused on the page with the new words, nothing sent, the earlier results cleared
      for (const [what, t] of [["a valid KIO ID", kioOf("D21M48YBZQBF").shown], ["an ID that is not valid", BAD_ID], ["a postID", "7777-7777-7777"]]) {
        const before = searches(site).length;
        x = await flow(site, 1280, { ...sub("Meridian", "Nurse", ""), again: sub("Meridian", t, "R-1") });
        const sentBefore = searches(site).length - before;
        const wantMsg = what === "an ID that is not valid" ? [KEY_WITH_REQ, KIO_INVALID] : [KEY_WITH_REQ];
        if (!wantMsg.includes(x.second.err)) bad.push(what + " next to a req number: the message is " + JSON.stringify(x.second.err));
        if (what !== "an ID that is not valid" && (x.second.cards !== 0 || x.second.recap !== null)) bad.push(what + " next to a req number: the earlier results were not cleared");
        if (sentBefore !== 1 + (what === "an ID that is not valid" ? 1 : 0)) bad.push(what + " next to a req number: " + sentBefore + " requests were made");
      }
    } finally { await site.close(); }
    return bad;
  },
  // an ID the edge refuses with the 400 (for example over 60 characters): the usual words, and the boxes keep what was typed
  async pageRefused(root) {
    const bad = [];
    const site = await startFakeSite(root, { kio: true, failover: {}, refuseKio: true });
    try {
      const id = kioOf("D21M48YBZQBF").shown;
      let x = await flow(site, 1280, sub("Meridian Health", id, ""));
      if (x.r.err !== KIO_INVALID) bad.push("the message is " + JSON.stringify(x.r.err));
      if (x.r.c !== "Meridian Health" || x.r.q !== id) bad.push("the boxes did not keep what was typed: " + JSON.stringify([x.r.c, x.r.q]));
      if (x.r.recap !== null || x.r.cards !== 0) bad.push("a recap or results are shown");
      // the same from the extension's fragment (a valid ID with a company and a title)
      x = await flow(site, 1280, { hash: "#k=" + kioOf("D21M48YBZQBF").stored + "&c=Meridian&t=Nurse" });
      if (x.r.err !== KIO_INVALID || x.r.c !== "Meridian" || x.r.q !== id) bad.push("the fragment search: " + JSON.stringify([x.r.err, x.r.c, x.r.q]));
    } finally { await site.close(); }
    return bad;
  },
  // a malformed ID with nothing else: the usual words, and the ID text alone is sent
  async pageInvalidAlone(root) {
    const bad = [];
    const site = await startFakeSite(root, { kio: true, failover: {} });
    try {
      const x = await flow(site, 1280, sub("", BAD_ID, ""));
      if (x.r.err !== KIO_INVALID) bad.push("the message is " + JSON.stringify(x.r.err));
      if (x.calls.length !== 1 || JSON.stringify(x.calls[0]) !== JSON.stringify({ kio: BAD_ID, origin: "site" })) bad.push("the request is " + JSON.stringify(x.calls));
      if (x.r.cards !== 0 || x.r.recap !== null) bad.push("results or a recap are shown");
    } finally { await site.close(); }
    return bad;
  },
  // origin: the site for what is typed here, the extension (with the cleaned host) for the search that follows the extension's hand-off, once
  async pageOrigin(root) {
    const bad = [];
    const site = await startFakeSite(root, { kio: true, failover: {} });
    try {
      let x = await flow(site, 1280, { hash: "#c=Meridian&t=Nurse&o=e&h=" + encodeURIComponent("https://WWW.Indeed.com/viewjob?jk=1"), again: sub("Meridian", "Nurse", "") });
      if (JSON.stringify(x.calls[0]) !== JSON.stringify({ company: "Meridian", phrase: "Nurse", origin: "extension", origin_host: "indeed.com" })) bad.push("the extension search is " + JSON.stringify(x.calls[0]));
      if (JSON.stringify(x.calls[1]) !== JSON.stringify({ company: "Meridian", phrase: "Nurse", origin: "site" })) bad.push("the next search typed here is " + JSON.stringify(x.calls[1]));
      x = await flow(site, 1280, { hash: "#c=Meridian&t=Nurse&o=e" });
      if (JSON.stringify(x.calls.at(-1)) !== JSON.stringify({ company: "Meridian", phrase: "Nurse", origin: "extension" })) bad.push("o=e with no host: " + JSON.stringify(x.calls.at(-1)));
      x = await flow(site, 1280, { hash: "#c=Meridian&t=Nurse&o=x&h=indeed.com" });
      if (JSON.stringify(x.calls.at(-1)) !== JSON.stringify({ company: "Meridian", phrase: "Nurse", origin: "site" })) bad.push("a wrong o: " + JSON.stringify(x.calls.at(-1)));
      x = await flow(site, 1280, { hash: "#k=" + BAD_ID + "&c=Meridian&t=Nurse&o=e&h=linkedin.com" });
      if (JSON.stringify(x.calls.at(-1)) !== JSON.stringify({ kio: BAD_ID, company: "Meridian", phrase: "Nurse", origin: "extension", origin_host: "linkedin.com" })) bad.push("a failed key from the extension: " + JSON.stringify(x.calls.at(-1)));
    } finally { await site.close(); }
    return bad;
  },
  // the sentence under the results about what the record holds
  async pageNotice(root) {
    const bad = [];
    const site = await startFakeSite(root, { kio: true, failover: {} });
    try {
      const x = await flow(site, 375, sub("Meridian", "Nurse", ""));
      if (x.r.notice !== NOTICE) bad.push("the notice is " + JSON.stringify(x.r.notice));
      if (x.r.sw > x.r.cw) bad.push("a sideways scroll bar (" + x.r.sw + " over " + x.r.cw + ")");
    } finally { await site.close(); }
    return bad;
  },
};

for (const [name, fn] of Object.entries(SCENARIOS)) {
  test("failover: " + name, { timeout: 1800000 }, async () => { const bad = await fn(ROOT); assert.deepEqual(bad, []); });
}

// ---- negative controls: one planted defect at a time on a copy of the repo
const DEFECTS = [
  ["the sentence of one reason is another reason's words", [["js/search-input.js", (s) => s.replace('id_not_registered: "That KIO ID was not found, so these are the results for ",', 'id_not_registered: "That opening is no longer on FightGhostJobs, so these are the results for ",')]], ["unitWords", "pageFound"]],
  ["no sentence is shown for a failover", [["js/pages/search.js", (s) => s.replace("if (searched.failoverText) resultsEl.append(", "if (false) resultsEl.append(")]], ["pageFound", "pageEmpty"]],
  ["the typed company and title are put into the page as HTML", [["js/pages/search.js", (s) => s.replace('h("div", { class: "alert alert-notice", id: "failoverNotice", style: "overflow-wrap:anywhere;" }, searched.failoverText)', '(() => { const d = h("div", { class: "alert alert-notice", id: "failoverNotice" }); d.innerHTML = searched.failoverText; return d; })()')]], ["pageEmpty"]],
  ["the miss message is shown on a found failover", [["js/pages/search.js", (s) => s.replace("for (const row of data.results) resultsEl.append(renderCard(row));\n  return hints;", 'for (const row of data.results) resultsEl.append(renderCard(row));\n  if (searched.failoverText) resultsEl.append(h("p", { class: "miss-line" }, missMessage("not_registered")[0]));\n  return hints;')]], ["pageFound"]],
  ["a forbidden word is in a new sentence (verified)", [["js/search-input.js", (s) => s.replace('id_invalid: "That KIO ID is not valid, so', 'id_invalid: "That KIO ID is not verified, so')]], ["unitWords"]],
  ["a dash is in a new sentence", [["js/search-input.js", (s) => s.replace('req_no_match: "That req number did not match, so', 'req_no_match: "That req number did not match ' + String.fromCharCode(8212) + ' so')]], ["unitWords"]],
  ["the 400 for an ID the edge refuses clears the typed boxes", [["js/pages/search.js", (s) => s.replace('if (!r.ok && r.status === 400 && r.error.field === "kio") { setFormError(KIO_INVALID_MESSAGE);', 'if (!r.ok && r.status === 400 && r.error.field === "kio") { companyIn.value = ""; queryIn.value = ""; setFormError(KIO_INVALID_MESSAGE);')]], ["pageRefused"]],
  ["origin is not sent", [["js/pages/search.js", (s) => s.replace("const send = (b) => api.candidateSearch(Object.assign(b, ev));", "const send = (b) => api.candidateSearch(b);")]], ["pageOrigin", "pageFound"]],
  ["the host of the extension is not cleaned", [["js/fragment-prefill.js", (s) => s.replace('.replace(/^www\\./, "")', "")]], ["unitFragment", "pageOrigin"]],
  ["the origin of one search stays for every later search", [["js/pages/search.js", (s) => s.replace("const o = heldOrigin; heldOrigin = null;", "const o = heldOrigin;")]], ["pageOrigin"]],
  ["an invalid k throws away the company and the title again", [["js/fragment-prefill.js", (s) => s.replace('if (read.kind !== "kio" && (cK === "" || tK === ""))', 'if (read.kind !== "kio")')]], ["unitFragment", "pageFound"]],
  ["a KIO ID next to a req number is no longer refused", [["js/search-input.js", (s) => s.replace('if (q.kind !== "phrase") return { ok: false, message: KEY_WITH_REQ_MESSAGE', 'if (q.kind !== "phrase" && false) return { ok: false, message: KEY_WITH_REQ_MESSAGE')]], ["unitResolve", "pageNot"]],
  ["a title next to a req number is refused again", [["js/search-input.js", (s) => s.replace('return { ok: true, kind: "req", value: r.value, title: q.value };', 'return { ok: false, message: KEY_WITH_REQ_MESSAGE, focus: "req", clearResults: true };')]], ["unitResolve", "pageFound"]],
  ["an empty failover is worded as an ID answer", [["js/pages/search.js", (s) => s.replace("const wasKio = !failed && (", "const wasKio = (")]], ["pageEmpty"]],
  ["the failover of a 404 is dropped", [["js/pages/search.js", (s) => s.replace("const failReason = failOf(r.data);", "const failReason = r.ok ? failOf(r.data) : null;")]], ["pageEmpty"]],
  ["the sentence is not read out", [["js/pages/search.js", (s) => s.replace("[failoverText, mismatchText, ...(hints || []), missSpoken]", "[mismatchText, ...(hints || []), missSpoken]")]], ["pageFound", "pageEmpty"]],
  ["a malformed ID with nothing else is not sent", [["js/pages/search.js", (s) => s.replace("if (session && session.isCandidate && !staffMode) { busy = true; try {", "if (false) { busy = true; try {")]], ["pageInvalidAlone"]],
  ["the title is not sent with the key", [["js/pages/search.js", (s) => s.replace("{ kio: q.value, company: c.value, phrase: heldKio.title }", "{ kio: q.value, company: c.value }")]], ["pageFound"]],
  ["the title is not sent with the req number", [["js/pages/search.js", (s) => s.replace("{ company: c.value, req: q.value, phrase: q.title }", "{ company: c.value, req: q.value }")]], ["pageFound"]],
  ["the miss kind of an empty failover is dropped", [["js/pages/search.js", (s) => s.replace('mode: failed ? "phrase" : "code", truncated: false, results: [], miss_kind: r.data && typeof r.data === "object" ? r.data.miss_kind : undefined', 'mode: failed ? "phrase" : "code", truncated: false, results: [], miss_kind: undefined')]], ["pageEmpty"]],
  ["the sentence about what the record holds is gone", [["search.html", (s) => s.replace(" The record also holds any KIO ID or req number you typed or we read from the job page, and an ID you mistyped is kept as typed.", "")]], ["pageNotice"]],
  ["a failover is described when the answer has an unknown reason", [["js/search-input.js", (s) => s.replace("if (typeof reason !== \"string\" || !Object.prototype.hasOwnProperty.call(FAILOVER_SENTENCES, reason)) return null;", "if (typeof reason !== \"string\") return null;")]], ["unitWords"]],
];
test("negative controls: each planted defect makes a check fail", { timeout: 14400000 }, async () => {
  const missed = [];
  const only = process.env.FGJ_FO_ONLY;
  for (const [label, edits, scenarios] of DEFECTS) {
    if (only && !label.includes(only)) continue;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-fo-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) {
        const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8").replace(/\?v=[0-9a-f]{8}(?=["'])/g, ""), a0 = mutate(b0);
        assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel);
        fs.writeFileSync(p, a0);
      }
      const found = [];
      for (const n of scenarios) {
        try { for (const p of await SCENARIOS[n](dir)) found.push(n + ": " + p); } catch (e) { found.push(n + ": the scenario could not finish: " + String(e.message).slice(0, 100)); }
      }
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 150) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
