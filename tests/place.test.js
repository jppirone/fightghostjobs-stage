// place.test.js - the display-only place text in a real browser (October 9, 2026, prompt AZ3). The repo's own files and a fake backend (tests/fake-site.js; no real project, no key, no network).
//
// THE RULE: an opening with NO catalog place may carry source_location_text, the place as the employer's job board gave it. The page shows it ONLY while the opening has no catalog place, always followed by the small note
// "as given by the employer's job board", in the results card, in the details window and in the staff view, as plain text (a "<script>" in it is shown as characters), at most 200 characters, and never sends it anywhere or uses it to search.
// Then negative controls: one defect at a time in the page code (the text shown with a catalog place, no length limit, no escaping); each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/place.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite } from "./fake-site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

const STAFF = "staff@example.test", PLAIN = "cand@example.test";
const NOTE = "as given by the employer's job board";
async function openSearch(tab, site, email, query) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate&email=" + encodeURIComponent(email));
  await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.goto(site.url + "/search.html" + (query || ""));
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(900);
}
async function runSearch(tab, phrase = "Analyst") {
  await tab.eval("(() => { document.querySelector('#company').value = 'Meridian'; document.querySelector('#titleq').value = " + JSON.stringify(phrase) + "; document.querySelector('#searchForm').requestSubmit(); })()");
  await tab.waitFor("document.querySelectorAll('#results .card').length > 0 && !document.querySelector('#searchBtn').disabled", 12000); await sleep(400);
}
// per card: the meta line (the second line under the title), whether it carries the note, and whether a script element or a markup child was made inside it
const SNAP = `(() => ({ cards: [...document.querySelectorAll('#results .card')].map((c) => { const meta = c.querySelector('.res-head > div > div:nth-child(3)'); return {
    meta: meta ? meta.innerText.replace(/\\s+/g, ' ').trim() : null, note: !!(meta && meta.querySelector('.place-note')), scripts: c.querySelectorAll('script').length, elements: meta ? meta.querySelectorAll('*:not(.place-note)').length : 0 }; }),
  xss: typeof window.__placeXss !== 'undefined' }))()`;
async function withSite(root, opts, fn) { const site = await startFakeSite(root, opts); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }

const SCENARIOS = {
  // the results card: a text only while there is no catalog place, with the note; a catalog place wins
  async card(root) { return withSite(root, { placeOverrides: [{ locations: [], is_remote: false, source_location_text: "São Paulo, Brazil" }, { locations: ["Boston, MA"], is_remote: false, source_location_text: "Tokyo, Japan" }] }, (site) => withTab(async (tab) => { const bad = [];
    await openSearch(tab, site, PLAIN, ""); await runSearch(tab); const o = await tab.eval(SNAP);
    if (o.cards.length !== 2) return ["expected 2 cards, got " + o.cards.length];
    if (!o.cards[0].meta.startsWith("São Paulo, Brazil") || !o.cards[0].note || !o.cards[0].meta.includes(NOTE)) bad.push("the card without a catalog place does not show the board's place with the note: " + o.cards[0].meta);
    if (!o.cards[1].meta.startsWith("Boston, MA") || o.cards[1].note || /Tokyo|as given by/.test(o.cards[1].meta)) bad.push("the card with a catalog place shows the board's text or the note: " + o.cards[1].meta);
    return bad; })); },
  // the details window: the place and the note for the first, nothing for the second
  async details(root) { return withSite(root, { placeOverrides: [{ locations: [], is_remote: false, source_location_text: "Tokyo, Japan" }, { locations: ["Boston, MA"], is_remote: false, source_location_text: "Berlin, Germany" }] }, (site) => withTab(async (tab) => { const bad = [];
    await openSearch(tab, site, PLAIN, ""); await runSearch(tab);
    for (const [i, want] of [[0, true], [1, false]]) {
      await tab.eval("document.querySelectorAll('#results .view-details')[" + i + "].click()");
      await tab.waitFor("document.querySelector('#modalBackdrop').classList.contains('open')", 8000); await sleep(500);
      const m = await tab.eval("(() => { const p = document.querySelector('#modalPlace'); return { hidden: p.hidden, text: p.innerText.replace(/\\s+/g, ' ').trim() }; })()");
      if (want && (m.hidden || !m.text.startsWith("Tokyo, Japan") || !m.text.includes("as given by the employer's job board"))) bad.push("the details window of the opening without a catalog place does not show the place and the note: " + JSON.stringify(m));
      if (!want && (!m.hidden || m.text !== "")) bad.push("the details window of the opening with a catalog place shows a board text: " + JSON.stringify(m));
      await tab.eval("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))"); await sleep(300);
    }
    return bad; })); },
  // markup in the board's text is shown as the characters it is
  async escaped(root) { return withSite(root, { placeOverrides: [{ locations: [], is_remote: false, source_location_text: "<script>window.__placeXss = 1</script><b>Tokyo</b>, Japan" }] }, (site) => withTab(async (tab) => { const bad = [];
    await openSearch(tab, site, PLAIN, ""); await runSearch(tab); const o = await tab.eval(SNAP);
    if (o.xss) bad.push("a script in the board's text ran");
    if (o.cards[0].scripts !== 0 || o.cards[0].elements !== 0) bad.push("markup was made from the board's text (" + o.cards[0].scripts + " script, " + o.cards[0].elements + " elements)");
    if (!o.cards[0].meta.includes("<script>window.__placeXss = 1</script><b>Tokyo</b>, Japan")) bad.push("the markup is not shown as characters: " + o.cards[0].meta);
    return bad; })); },
  // at most 200 characters, control characters out
  async limit(root) { return withSite(root, { placeOverrides: [{ locations: [], is_remote: false, source_location_text: "x".repeat(300) + "\u0007" }] }, (site) => withTab(async (tab) => { const bad = [];
    await openSearch(tab, site, PLAIN, ""); await runSearch(tab); const o = await tab.eval(SNAP);
    const line = o.cards[0].meta.split(" · Opening ID")[0].replace(NOTE, "").trim();
    if (line.length > 200) bad.push("more than 200 characters of the board's text are shown (" + line.length + ")");
    if (/\u0007/.test(o.cards[0].meta)) bad.push("a control character is shown");
    return bad; })); },
  // a control character inside the text is removed, not shown
  async control(root) { return withSite(root, { placeOverrides: [{ locations: [], is_remote: false, source_location_text: "To\u0007kyo, Japan" }] }, (site) => withTab(async (tab) => { const bad = [];
    await openSearch(tab, site, PLAIN, ""); await runSearch(tab); const o = await tab.eval(SNAP);
    if (/\u0007/.test(o.cards[0].meta)) bad.push("a control character is shown");
    if (!o.cards[0].meta.startsWith("Tokyo, Japan")) bad.push("the text is not cleaned to Tokyo, Japan: " + JSON.stringify(o.cards[0].meta));
    return bad; })); },
  // never used to search: the request carries what was typed and nothing from the place text; and the typed place word does not need the text to be there
  async notForSearch(root) { return withSite(root, { placeOverrides: [{ locations: [], is_remote: false, source_location_text: "Tokyo, Japan" }] }, (site) => withTab(async (tab) => { const bad = [];
    await openSearch(tab, site, PLAIN, ""); const s0 = site.calls.length; await runSearch(tab, "Tokyo");
    const sent = site.calls.slice(s0).filter((c) => c.name === "candidate-search");
    if (sent.length !== 1) return ["expected one candidate-search call, got " + sent.length];
    const keys = Object.keys(sent[0].body || {}).sort().join(",");
    if (keys !== "company,phrase") bad.push("the search request carries more than the typed company and phrase: " + keys);
    if (/Japan|as given by/.test(JSON.stringify(sent[0].body))) bad.push("the place text went into the search request");
    return bad; })); },
  // the staff view: the same rule (the draft without a catalog place shows its text with the note; the live one with a catalog place does not)
  async staff(root) { return withSite(root, { staffPlaceOverrides: [{ source_location_text: "Berlin, Germany" }, { locations: [], source_location_text: "Tokyo, Japan" }] }, (site) => withTab(async (tab) => { const bad = [];
    await openSearch(tab, site, STAFF, "?scope=all"); await tab.waitFor("!!document.querySelector('#staffBanner')", 8000); await runSearch(tab); const o = await tab.eval(SNAP);
    if (o.cards.length < 2) return ["the staff view returned " + o.cards.length + " cards"];
    if (/Berlin|as given by/.test(o.cards[0].meta)) bad.push("the staff card with a catalog place shows the board's text: " + o.cards[0].meta);
    if (!o.cards[1].meta.startsWith("Tokyo, Japan") || !o.cards[1].note) bad.push("the staff card without a catalog place does not show the board's place with the note: " + o.cards[1].meta);
    return bad; })); },
};

test("the display-only place text: shown only while the opening has no catalog place, with its note, as plain text, never used to search", { timeout: 900000 }, async () => {
  const problems = [];
  for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](ROOT)) problems.push(n + ": " + p);
  assert.deepEqual(problems, [], "place text problems:\n" + problems.join("\n"));
});

const DEFECTS = [
  ["the text is shown even when the opening has a catalog place", ["card", "staff"], [["js/place.js", (s) => s.replace('const src = locs.length === 0 ? sourcePlaceText(row) : "";', "const src = sourcePlaceText(row);")]]],
  ["there is no length limit", ["limit"], [["js/place.js", (s) => s.replace(".slice(0, MAX_PLACE_CHARS)", "")]]],
  ["control characters are not removed", ["control"], [["js/place.js", (s) => s.replace('.replace(/[\\u0000-\\u001f\\u007f-\\u009f]/g, "")', "")]]],
  ["the text is made into markup (no escaping)", ["escaped"], [["js/pages/search.js", (s) => s.replace("return [p.text, p.note ?", "const sp = document.createElement(\"span\"); sp.innerHTML = p.text; return [sp, p.note ?")]]],
  ["the note is left out", ["card", "details", "staff"], [["js/place.js", (s) => s.replace("note: PLACE_NOTE };\n}", "note: null };\n}")]]],
  ["the details window never shows it", ["details"], [["js/pages/search.js", (s) => s.replace("place.hidden = !shown;", "place.hidden = true;")]]],
  ["the place text goes into the search request", ["notForSearch"], [["js/pages/search.js", (s) => s.replace(": { company: c.value, phrase: q.value });", ": { company: c.value, phrase: q.value, place: \"Tokyo, Japan\" });")]]],
];
test("negative controls: each defect in the place text makes a scenario fail", { timeout: 1800000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-place-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      for (const n of scenarios) found.push(...(await SCENARIOS[n](dir)).map((x) => n + ": " + x));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0] + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
