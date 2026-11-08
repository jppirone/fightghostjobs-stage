// order-note-box.test.js - the "check this" note of the phone entry in a real headless Chrome (prompt JE, November 8, 2026), the repo's own files and a fake backend (tests/fake-site.js; no real project, no key, no token).
// The Shortcut address search.html#x=<text> is built as the Shortcut builds it (encodeURIComponent). When the reader (reader-v3) had to guess which line is the job title and which the company (its flag orderAssumed) the page shows a note
// in the status region #orderNote INSIDE the search box, under the three fields and above the optional line and the Search button. Invented text and the lines named in the prompt only.
//   shown      flagged readings show the note (exact words, status role, polite) inside the box above the optional line and Search; unflagged readings, nothing found, the header pair and a refused address show nothing
//   place      at 390, 768, 999, 1000 and 1250 the note lies inside the box, above the optional line and above Search (never between the optional line and Search, never below it); Search stays the last item (stacked) or to the right of everything (wide); no sideways scroll
//   edits      editing the company box or the title box empties the note; editing the req number box does not; a search that runs empties it
//   search     with the note showing Search still searches (the note blocks nothing) and sends what the boxes hold
// Then planted breakages: one deliberate defect at a time in a COPY of the repo, each must make a scenario fail. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/order-note-box.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite } from "./fake-site.js";
import { EXTENSION_REPO } from "./copy-reader.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const enc = encodeURIComponent;
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

const NOTE = "Check that the company and the job title are correct, then click Search.";   // John's sentence of November 8, 2026 (prompt JN)
const FLAGGED = [["a bracket title over a company", "Customer Success (Remote)\nAxiom"], ["two lines with no title word", "Brand Strategy\nOrion Labs"], ["two unrelated plain lines", "Share this job\nReport this job"]];
const PLAIN = [["the Indeed pair", "Chief Project Technician\nAxiom"], ["the pair turned round", "Axiom\nChief Project Technician"], ["a title and a company with an ampersand", "Quality System Manager\nPratt & Whitney"],
  ["the LinkedIn lines with the alumni badge", "S\nOperational Improvement\nConsultant\nSlalom • Boston, MA\n16 school alumni"], ["a normal card", "Senior Logistics Analyst\nContoso Freight\nAustin, TX\n$85K/yr - $110K/yr\nViewed"],
  ["nothing found", "We are hiring a Senior Analyst at Contoso. Apply now."], ["the header pair", "Jobs for you\nSee more jobs"]];
// every size runs the phone entry (touch, no hover), also the wide ones
const SIZES = [{ n: "390", w: 390, h: 844, stacked: true }, { n: "768", w: 768, h: 1024, stacked: true }, { n: "999", w: 999, h: 900, stacked: true }, { n: "1000", w: 1000, h: 900, stacked: false }, { n: "1250", w: 1250, h: 900, stacked: false }];
const searches = (site) => site.calls.filter((c) => c.name === "candidate-search");

async function become(tab, site) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
async function openAt(tab, site, size, text, source = "") {
  await tab.viewport(size.w, true, size.h);
  await tab.goto(site.url + "/404.html"); await tab.goto(site.url + "/search.html#x=" + enc(text) + (source ? "&s=" + enc(source) : ""));
  await tab.waitFor("document.readyState === 'complete' && !!document.getElementById('company')", 15000);
  await sleep(1500);
}
const SNAP = `(() => { const g = (id) => document.getElementById(id), r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top + scrollY, b: b.bottom + scrollY, w: b.width, h: b.height }; }, n = g('orderNote'), form = g('searchForm');
  const words = (e) => e.innerText.replace(/\\s+/g, ' ').trim().split(' ').filter(Boolean).length;
  const lines = n && n.getClientRects().length ? Math.round((n.getBoundingClientRect().height - 4) / (parseFloat(getComputedStyle(n).fontSize) * 1.5)) : 0;   // prompt JN: the lines the note takes
  return { lines, has: !!n, text: n ? n.textContent : null, rendered: !!n && n.getClientRects().length > 0, role: n ? n.getAttribute('role') : null, live: n ? n.getAttribute('aria-live') : null, inForm: !!n && !!n.closest('#searchForm'),
    note: r(n), card: r(form), src: r(g('sourceBlock')), btn: r(g('searchBtn')), top: r(document.querySelector('.srch-top')), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    company: g('company').value, title: g('titleq').value, formWords: form ? words(form) : 0, state: g('phoneBody') ? !g('phoneBody').hidden : false }; })()`;
const type = (tab, id, v) => tab.eval(`(() => { const e = document.getElementById(${JSON.stringify(id)}); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event("input", { bubbles: true })); })()`);
const inside = (a, c) => a && c && a.l >= c.l - 0.5 && a.r <= c.r + 0.5 && a.t >= c.t - 0.5 && a.b <= c.b + 0.5;

const SCENARIOS = {
  async shown(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await become(tab, site);
      for (const [name, text] of FLAGGED) {
        await openAt(tab, site, SIZES[0], text); const s = await tab.eval(SNAP);
        if (s.text !== NOTE) bad.push(name + ": the note says " + JSON.stringify(s.text));
        if (!s.rendered) bad.push(name + ": the note is not on the page");
        if (s.role !== "status" || s.live !== "polite") bad.push(name + ": the note is not a polite status region (" + s.role + ", " + s.live + ")");
        if (!s.inForm) bad.push(name + ": the note is not inside the search box");
        if (!s.company || !s.title) bad.push(name + ": the boxes are not filled (" + s.company + " / " + s.title + ")");
      }
      for (const [name, text] of PLAIN) {
        await openAt(tab, site, SIZES[0], text); const s = await tab.eval(SNAP);
        if (s.text !== "" || s.rendered) bad.push(name + ": a note shows or holds text: " + JSON.stringify(s.text));
      }
      // a refused address (a control character) and the ordinary page
      await tab.viewport(390, true, 844); await tab.goto(site.url + "/404.html"); await tab.goto(site.url + "/search.html#x=" + enc("Axiom\u0007\nWelder")); await tab.waitFor("!!document.getElementById('company')", 15000); await sleep(1200);
      let s = await tab.eval(SNAP); if (s.text !== "" || s.rendered) bad.push("a refused address: a note shows");
      await tab.goto(site.url + "/404.html"); await tab.goto(site.url + "/search.html"); await tab.waitFor("!!document.getElementById('company')", 15000); await sleep(900);
      s = await tab.eval(SNAP); if (s.text !== "" || s.rendered) bad.push("the ordinary page: a note shows");
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async place(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await become(tab, site);
      for (const size of SIZES) {
        await openAt(tab, site, size, FLAGGED[1][1], "Jobs at LinkedIn"); const s = await tab.eval(SNAP), L = size.n + ": ";
        if (!s.rendered) { bad.push(L + "the note is not on the page"); continue; }
        for (const k of ["note", "src", "btn"]) if (!inside(s[k], s.card)) bad.push(L + k + " lies outside the box of the form");
        if (!(s.top.b <= s.note.t + 0.5)) bad.push(L + "the note is not under the three fields");
        if (s.lines > 2) bad.push(L + "the note takes " + s.lines + " lines (two at most)");
        if (process.env.FGJ_JE_REPORT) console.log("NOTE LINES at " + size.n + ": " + s.lines);
        if (!(s.note.b <= s.src.t + 0.5)) bad.push(L + "the note is not above the optional line (note bottom " + Math.round(s.note.b) + ", optional line top " + Math.round(s.src.t) + ")");
        if (size.stacked) {
          if (!(s.note.b <= s.btn.t + 0.5 && s.src.b <= s.btn.t + 0.5)) bad.push(L + "the note or the optional line is not above Search");
          if (!(s.card.b - s.btn.b < 40)) bad.push(L + "Search is not the last item of the box");
        } else {
          if (!(s.note.r <= s.btn.l + 0.5 && s.src.r <= s.btn.l + 0.5)) bad.push(L + "Search is not to the right of the note and the optional line");
        }
        if (s.sw > s.cw) bad.push(L + "the page scrolls sideways");
      }
      // the words of the form: the empty box and the box with the note differ by exactly the words of the note
      await openAt(tab, site, SIZES[0], FLAGGED[1][1]); const withNote = await tab.eval(SNAP);
      await openAt(tab, site, SIZES[0], PLAIN[0][1]); const without = await tab.eval(SNAP);
      const noteWords = NOTE.split(" ").length;
      if (withNote.formWords - without.formWords !== noteWords) bad.push("the box holds " + withNote.formWords + " visible words with the note and " + without.formWords + " without: the difference is not the " + noteWords + " words of the note");
      if (process.env.FGJ_JE_REPORT) console.log("FORM WORDS: with the note " + withNote.formWords + ", without " + without.formWords);
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async edits(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await become(tab, site);
      for (const [box, id] of [["the company box", "company"], ["the title box", "titleq"]]) {
        await openAt(tab, site, SIZES[0], FLAGGED[0][1]);
        if ((await tab.eval(SNAP)).text !== NOTE) { bad.push(box + ": the note did not show"); continue; }
        await type(tab, id, "Edited by hand"); await sleep(200);
        const s = await tab.eval(SNAP); if (s.text !== "" || s.rendered) bad.push("editing " + box + " does not end the note");
      }
      await openAt(tab, site, SIZES[0], FLAGGED[0][1]);
      await type(tab, "reqq", "R-1234"); await sleep(200);
      if ((await tab.eval(SNAP)).text !== NOTE) bad.push("editing the req number box ended the note (it is about the title and the company)");
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async search(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await become(tab, site);
      await openAt(tab, site, SIZES[0], "Brand Strategy\nOrion Labs");
      if ((await tab.eval(SNAP)).text !== NOTE) return ["the note did not show"];
      site.calls.length = 0;
      await tab.eval(`document.getElementById("searchBtn").click()`); await sleep(1800);
      const sent = searches(site);
      if (sent.length !== 1) bad.push("Search sent " + sent.length + " searches with the note showing (it must block nothing)");
      else if (sent[0].body.company !== "Orion Labs" || !JSON.stringify(sent[0].body).includes("Brand Strategy")) bad.push("the search did not send what the boxes held: " + JSON.stringify(sent[0].body));
      const s = await tab.eval(SNAP); if (s.text !== "" || s.rendered) bad.push("the note stays after a search has run");
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
};

for (const [name, fn] of Object.entries(SCENARIOS)) {
  test("the check this note: " + name, { timeout: 600000 }, async () => {
    const bad = await fn(ROOT);
    assert.deepEqual(bad, [], bad.join("\n"));
  });
}

// ---- planted breakages: [label, scenarios, [file, from, to]...] or "OLD_READER". Each must change the file (the anchor is in it exactly once) and be caught.
const PM = "js/phone-model.js", PE = "js/phone-entry.js", H = "search.html";
const NOTE_DIV = '      <div id="orderNote" class="order-note" role="status" aria-live="polite"></div>\n';
const DEFECTS = [
  ["the flag is dropped in js/phone-model.js", ["shown", "place"], [[PM, "orderAssumed: p.orderAssumed === true };", "orderAssumed: false };"]]],
  ["the page sets the flag false when the reader said true", ["shown"], [[PM, "titleBroken: r.titleBroken === true, orderAssumed: r.orderAssumed === true };\n  } else if", "titleBroken: r.titleBroken === true, orderAssumed: false };\n  } else if"]]],
  ["the note always shows", ["shown"], [[PE, "setOrder(parsed.boxes.orderAssumed === true);", "setOrder(true);"]]],
  ["the note never shows", ["shown", "place"], [[PE, "if (on === true && e) e.textContent = ORDER_NOTE;", "if (false && e) e.textContent = ORDER_NOTE;"]]],
  ["the note stays after an edit", ["edits"], [[PE, 'el.addEventListener("input", clearOrder);', 'el.addEventListener("input", () => {});']]],
  ["the note stays after a search", ["search"], [[PE, "function resetPanel() { clearOrder(); clear(line);", "function resetPanel() { clear(line);"]]],
  ["the note is not a status region", ["shown"], [[H, '<div id="orderNote" class="order-note" role="status" aria-live="polite">', '<div id="orderNote" class="order-note">']]],
  ["the note is below the Search button", ["place", "shown"], [[H, NOTE_DIV, ""], [H, '    </form>\n    <div id="formError"', "    </form>\n" + NOTE_DIV + '    <div id="formError"']]],
  ["the note is between the optional line and Search", ["place"], [[H, NOTE_DIV, ""], [H, '      </div>\n      <button type="submit" id="searchBtn"', NOTE_DIV + '      </div>\n      <button type="submit" id="searchBtn"']]],
  ["the note blocks Search", ["search"], [[PE, "if (on === true && e) e.textContent = ORDER_NOTE;", 'if (on === true && e) { e.textContent = ORDER_NOTE; doc.getElementById("searchBtn").disabled = true; }']]],
  ["the note words are changed", ["shown"], [["js/phone-text.js", "are correct, then click Search.", "are correct."]]],
  ["the old reader is copied back", ["shown"], "OLD_READER"],
];
test("planted breakages: each deliberate defect in the note makes a scenario fail", { timeout: 6000000 }, async () => {
  const missed = [], only = process.env.FGJ_JE_ONLY ? process.env.FGJ_JE_ONLY.split("|") : null;
  let n = 0;
  for (const [label, scenarios, edits] of DEFECTS) {
    if (only && !only.some((x) => label.includes(x))) continue;
    n++;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-je-ctl-")), t0 = Date.now();
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      if (edits === "OLD_READER") {
        if (!fs.existsSync(EXTENSION_REPO)) { console.log("skipped (no extension repository): " + label); continue; }
        const old = spawnSync("git", ["-C", EXTENSION_REPO, "show", "reader-v1:mobile-reader/reader.js"], { encoding: "utf8", maxBuffer: 20e6 });
        assert.equal(old.status, 0, "git show of the old reader");
        const p = path.join(dir, "js/mobile/mobile-reader/reader.js");
        assert.notEqual(old.stdout, fs.readFileSync(p, "utf8"), "the old reader equals the new one");
        fs.writeFileSync(p, old.stdout);
      } else {
        for (const [rel, from, to] of edits) {
          const p = path.join(dir, rel), clean = fs.readFileSync(p, "utf8").replace(/\?v=[0-9a-f]{8}(?=["'`])/g, "").replace(/\r\n/g, "\n");
          assert.equal(clean.split(from).length, 2, "the anchor of '" + label + "' is not in " + rel + " exactly once: " + from.slice(0, 60));
          fs.writeFileSync(p, clean.replace(from, () => to));
        }
      }
      const found = [];
      for (const name of scenarios) found.push(...(await SCENARIOS[name](dir)).map((x) => name + ": " + x));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  [" + ((Date.now() - t0) / 1000).toFixed(0) + " s]  (" + found[0].slice(0, 140) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  console.log("planted breakages run: " + n + ", missed: " + missed.length);
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
