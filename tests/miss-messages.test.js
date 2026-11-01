// miss-messages.test.js - the three kinds of "nothing found" on the search page (prompt HD, October 31, 2026), in a real browser on the repo's own files with a fake backend (tests/fake-site.js; no real project, no key).
// The edge function (prompt HC) sends miss_kind: not_registered, registered_no_match or registered_none_live, on an EMPTY company based answer (a title search: 200; a req number or an old code: 404). The page then shows that kind's words after
// the echo "No openings found for ..." INSTEAD of the general note. With no kind, or any other value, the old words stay exactly. A found result never shows one. The words live in ONE place (js/search-input.js, MISS_MESSAGES) and the unit
// checks pin them letter for letter, with no forbidden word and no dash. No button. Then negative controls: one planted defect at a time on a copy of the repo; each must make a check fail.
// Run: node --test tests/miss-messages.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite } from "./fake-site.js";
import { MISS_MESSAGES, missMessage, missEmptyLines, noMatchMessage, NO_MATCH_NOTE, NO_MATCH_NOTE_REQ } from "../js/search-input.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

// John's words, letter for letter (October 31, 2026)
const WORDS = {
  not_registered: ["This employer is not registered with FightGhostJobs yet. That says nothing about the employer or its openings."],
  registered_no_match: ["This employer is registered with FightGhostJobs and has openings in our system, but none match the details you gave.",
    "Check the KIO ID, title or req number against the opening you are looking at. If the employer is advertising it but it is not here, the employer has not registered it with us."],
  registered_none_live: ["This employer is registered with FightGhostJobs. It has no live openings in our system right now."],
};
const FORBIDDEN = /\b(ghost|fake|scam|fraud|suspicious|verified|certified|trusted|safe|compliant|guaranteed|posting|postings)\b/i;

// ---- the words (no browser)
const UNIT = {
  words() {
    const bad = [];
    for (const [k, lines] of Object.entries(WORDS)) {
      const got = missMessage(k);
      if (JSON.stringify(got) !== JSON.stringify(lines)) bad.push(k + ": the words are not John's: " + JSON.stringify(got));
    }
    if (Object.keys(MISS_MESSAGES).length !== 3) bad.push("MISS_MESSAGES does not hold exactly three kinds");
    const all = Object.values(MISS_MESSAGES).flat().join(" ");
    // "FightGhostJobs" is the product name; it is taken out before the forbidden words are looked for
    if (FORBIDDEN.test(all.replace(/FightGhostJobs/g, "FGJ"))) bad.push("a forbidden word is in the strings: " + (all.replace(/FightGhostJobs/g, "FGJ").match(FORBIDDEN) || [])[0]);
    if (/[–—]/.test(all)) bad.push("a dash (em or en) is in the strings");
    if (/\bbutton\b|ask this employer/i.test(all)) bad.push("button text is in the strings");
    return bad;
  },
  kinds() {
    const bad = [];
    for (const v of [undefined, null, "", "bogus", "constructor", "__proto__", "toString", 5, true, {}, [], "NOT_REGISTERED", " not_registered"]) {
      if (missMessage(v) !== null) bad.push("a value that is not one of the three names gave words: " + JSON.stringify(v));
      if (missEmptyLines("Acme", "Nurse", "phrase", v) !== null) bad.push("missEmptyLines gave lines for " + JSON.stringify(v));
    }
    if (missEmptyLines("Acme", "Nurse", "kio", "not_registered") !== null) bad.push("a KIO ID search got miss lines");
    // the old words are unchanged
    if (noMatchMessage("Acme", "Nurse", "phrase") !== 'No openings found for "Acme" + "Nurse". ' + NO_MATCH_NOTE) bad.push("the old title words changed");
    if (noMatchMessage("Acme", "", "req") !== 'No openings found for "Acme" with that req number. ' + NO_MATCH_NOTE_REQ) bad.push("the old req words changed");
    return bad;
  },
};

// ---- the page
const REQCASE = "R-2026-0451", CODE = "D21M48YBZQBF";
async function openSearch(tab, site) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.goto(site.url + "/search.html");
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(500);
}
const fill = (tab, company, title, req) => tab.eval(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }; set("company", ${JSON.stringify(company)}); set("titleq", ${JSON.stringify(title)}); set("reqq", ${JSON.stringify(req)}); })()`);
const WATCH = `(() => { window.__said = []; const live = (n) => { const e = n.nodeType === 1 ? n : n.parentElement; return e && e.closest ? e.closest('[role=status],[role=alert],[aria-live]') : null; };
  new MutationObserver((ms) => { for (const m of ms) { const r = live(m.target); if (r && r.textContent.trim() !== "") window.__said.push(r.textContent.trim()); } }).observe(document, { childList: true, subtree: true, characterData: true }); })()`;
const READ = `(() => { const n = document.getElementById("emptyNote"); const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth;
  return { note: n ? n.textContent : null, lines: n ? Array.from(n.querySelectorAll("p.miss-line")).map((p) => p.textContent) : [], cards: document.querySelectorAll("#results .card").length, results: document.getElementById("results").textContent,
    buttons: n ? n.querySelectorAll("button, a, input").length : 0, said: window.__said || [], sw, cw, count: document.getElementById("resultCount") ? document.getElementById("resultCount").textContent : null }; })()`;
async function runCase(site, width, kindLabel, how, company, title, req) {
  const tab = await browser.newTab();
  try {
    await tab.focusEmulation(true);
    await tab.viewport(width, width < 700, width < 700 ? 700 : 900);
    await openSearch(tab, site); await tab.viewport(width, width < 700, width < 700 ? 700 : 900); await tab.eval(WATCH);
    await fill(tab, company, title, req);
    await tab.eval(`document.getElementById("searchBtn").focus()`); await tab.key("Enter");
    await tab.waitFor("!!document.getElementById('emptyNote') || document.querySelectorAll('#results .card').length > 0", 10000); await sleep(400);
    return await tab.eval(READ);
  } finally { await tab.close(); }
}
const leadOf = (how, company, title) => how === "req" ? `No openings found for "${company}" with that req number. ` : how === "code" ? `No openings found for "${company}" + code "${title}". ` : `No openings found for "${company}" + "${title}". `;
const MODES = [["title", "Zzz Nowhere", "Nurse", ""], ["req", "Zzz Nowhere", "", REQCASE], ["code", "Zzz Nowhere", CODE, ""]];

const SCENARIOS = {
  unitWords: async () => UNIT.words(),
  unitKinds: async () => UNIT.kinds(),
  // every kind, every mode, desktop and phone: the echo plus the kind's lines, each on its own line, instead of the note; nothing else on the page changes; no button; no sideways scroll; read out
  async pageKinds(root) {
    const bad = [];
    for (const [kind, lines] of Object.entries(WORDS)) {
      const site = await startFakeSite(root, { missKind: kind });
      try {
        for (const width of [1280, 375]) for (const [how, company, title, req] of MODES) {
          const tag = kind + " / " + how + " / " + width + ": ";
          const r = await runCase(site, width, kind, how, company, title, req);
          const lead = leadOf(how, company, title);
          const want = [lead + lines[0], ...lines.slice(1)];
          if (JSON.stringify(r.lines) !== JSON.stringify(want)) bad.push(tag + "the lines are " + JSON.stringify(r.lines));
          if (r.note === null || /An opening appears here only if an employer has added it/.test(r.note)) bad.push(tag + "the general note is still there");
          if (r.cards !== 0) bad.push(tag + "result cards are shown");
          if (r.buttons !== 0) bad.push(tag + "a button, link or box is in the message");
          if (r.sw > r.cw) bad.push(tag + "a sideways scroll bar (" + r.sw + " over " + r.cw + ")");
          if (!r.said.some((t) => t.includes(lines[0]))) bad.push(tag + "the message is not read out: " + JSON.stringify(r.said).slice(0, 200));
          if (r.count !== "No matching openings") bad.push(tag + "the count line is " + JSON.stringify(r.count));
        }
      } finally { await site.close(); }
    }
    return bad;
  },
  // no kind, or any other value: exactly the old words (and no p.miss-line)
  async pageOldWords(root) {
    const bad = [];
    for (const v of [undefined, "bogus", "constructor", null, "", 5, "NOT_REGISTERED"]) {
      const site = await startFakeSite(root, v === undefined ? {} : { missKind: v });
      try {
        for (const [how, company, title, req] of MODES) {
          const r = await runCase(site, 1280, "none", how, company, title, req);
          const want = how === "req" ? leadOf(how, company, title) + NO_MATCH_NOTE_REQ : leadOf(how, company, title) + NO_MATCH_NOTE;
          if (r.note !== want) bad.push(JSON.stringify(v) + " / " + how + ": the words are not the old words: " + String(r.note).slice(0, 80));
          if (r.lines.length) bad.push(JSON.stringify(v) + " / " + how + ": miss lines are shown");
        }
      } finally { await site.close(); }
    }
    return bad;
  },
  // a found result carrying a miss kind (a wrong answer) shows the results and none of the words
  async pageFound(root) {
    const bad = [];
    const site = await startFakeSite(root, { missKindOnFound: "not_registered" });
    try {
      const r = await runCase(site, 1280, "found", "title", "Meridian", "Nurse", "");
      if (r.cards < 1) bad.push("no result is shown");
      if (Object.values(WORDS).flat().some((t) => (r.results + " " + r.said.join(" ")).includes(t.slice(0, 40)))) bad.push("a miss message is on a page with a found result");
    } finally { await site.close(); }
    return bad;
  },
};

for (const [name, fn] of Object.entries(SCENARIOS)) {
  test("miss messages: " + name, { timeout: 900000 }, async () => { const bad = await fn(ROOT); assert.deepEqual(bad, []); });
}

// ---- negative controls: one planted defect at a time on a copy of the repo
const DEFECTS = [
  ["the registered_no_match words are shown for a not_registered company", [["js/search-input.js", (s) => s.replace('? MISS_MESSAGES[kind] : null', '? MISS_MESSAGES[kind === "not_registered" ? "registered_no_match" : kind] : null')]], ["pageKinds"]],
  ["a forbidden word is in a string (verified)", [["js/search-input.js", (s) => s.replace("This employer is not registered with FightGhostJobs yet.", "This employer is not verified with FightGhostJobs yet.")]], ["unitWords"]],
  ["an em dash is in a string", [["js/search-input.js", (s) => s.replace("That says nothing about the employer or its openings.", "That says nothing — about the employer or its openings.")]], ["unitWords"]],
  ["the word posting is in a string", [["js/search-input.js", (s) => s.replace("It has no live openings in our system right now.", "It has no live postings in our system right now.")]], ["unitWords"]],
  ["the message is shown on a found result", [["js/pages/search.js", (s) => s.replace("!wasKio && !gone && r.data.results.length === 0 ? r.data.miss_kind : undefined", "!wasKio && !gone ? r.data.miss_kind : undefined").replace("for (const row of data.results) resultsEl.append(renderCard(row));", "for (const row of data.results) resultsEl.append(renderCard(row));\n  if (searched.missKind && missMessage(searched.missKind)) resultsEl.append(h(\"p\", {}, missMessage(searched.missKind)[0]));")]], ["pageFound"]],
  ["an unknown kind value breaks the page", [["js/search-input.js", (s) => s.replace("Object.prototype.hasOwnProperty.call(MISS_MESSAGES, kind) ? MISS_MESSAGES[kind] : null", "MISS_MESSAGES[kind]").replace("if (!miss || kind === \"kio\") return null;", "if (kind === \"kio\") return null;")]], ["unitKinds", "pageOldWords"]],
  ["the general note is shown as well as the message", [["js/pages/search.js", (s) => s.replace("if (missLines) { clear(emptyNote);", "if (missLines) {")]], ["pageKinds"]],
  ["the message is not read out", [["js/pages/search.js", (s) => s.replace("[failoverText, mismatchText, ...(hints || []), missSpoken]", "[failoverText, mismatchText, ...(hints || [])]")]], ["pageKinds"]],
  ["the 404 body's kind is dropped", [["js/pages/search.js", (s) => s.replace("miss_kind: r.data && typeof r.data === \"object\" ? r.data.miss_kind : undefined", "miss_kind: undefined")]], ["pageKinds"]],
];
test("negative controls: each planted defect makes a check fail", { timeout: 7200000 }, async () => {
  const missed = [];
  const only = process.env.FGJ_MM_ONLY;
  for (const [label, edits, scenarios] of DEFECTS) {
    if (only && !label.includes(only)) continue;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-mm-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) {
        const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8").replace(/\?v=[0-9a-f]{8}(?=["'])/g, ""), a0 = mutate(b0);
        assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel);
        fs.writeFileSync(p, a0);
      }
      const found = [];
      for (const n of scenarios) {
        try {
          if (n.startsWith("unit")) {   // the unit checks read the module of the COPY
            const mod = await import("file:///" + path.join(dir, "js", "search-input.js").replace(/\\/g, "/") + "?x=" + Math.random());
            const u = n === "unitWords" ? (() => { const bad = []; const all = Object.values(mod.MISS_MESSAGES).flat().join(" "); for (const [k, lines] of Object.entries(WORDS)) if (JSON.stringify(mod.missMessage(k)) !== JSON.stringify(lines)) bad.push(k + " differs"); if (FORBIDDEN.test(all.replace(/FightGhostJobs/g, "FGJ"))) bad.push("forbidden word"); if (/[–—]/.test(all)) bad.push("dash"); return bad; })()
              : (() => { const bad = []; for (const v of ["bogus", "constructor", "toString", null]) { try { if (mod.missEmptyLines("A", "N", "phrase", v) !== null) bad.push("lines for " + v); } catch (e) { bad.push("threw for " + v); } } return bad; })();
            for (const p of u) found.push(n + ": " + p);
          } else for (const p of await SCENARIOS[n](dir)) found.push(n + ": " + p);
        } catch (e) { found.push(n + ": the scenario could not finish: " + String(e.message).slice(0, 100)); }
      }
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 150) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
