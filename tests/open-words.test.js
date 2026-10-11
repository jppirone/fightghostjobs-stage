// open-words.test.js - the words on every row of links in the candidate's details window (prompt BG, October 10, 2026), in a real browser. The repo's own files and a fake backend (tests/fake-site.js).
//
// Every row that opens a new tab reads "Open", then the standard external link icon (an inline SVG, hidden from assistive technology), then text only a screen reader reads: "opens in a new tab".
// The word and the icon are one unit that never breaks across lines: checked at 320, 390, 768 and 1280 pixels with the longest firm name the editor allows (200 characters).
// Every one of those rows really opens a new tab (window.open with "_blank" and "noopener"; the fallback link is target="_blank" rel="noopener noreferrer"). A firm named without an address is not a link: it keeps
// "No link given" and gets no icon and no hidden text. Nothing else a candidate reads changed.
// Then negative controls: one defect at a time in the page code or the style; each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/open-words.test.js
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

const LONGEST = "Northbridge " + "Executive Search and Staffing Partners ".repeat(5).trim();   // padded below to exactly 200 characters
const NAME200 = (LONGEST + " ".repeat(200)).slice(0, 200).trim().padEnd(200, "x");
const OPTS = { policyDetail: true, detailFirms: [{ firm: NAME200 }, { firm: "Short Firm", label: "Employer's own site" }, { firm: "Name Only Partners", label: null }] };

async function withSite(root, opts, fn) { const site = await startFakeSite(root, opts); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }
async function open(tab, site, width) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate&email=cand%40example.test");
  await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.viewport(width, width < 768);
  await tab.goto(site.url + "/search.html");
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(900);
  await tab.eval("(() => { document.querySelector('#company').value = 'Meridian'; document.querySelector('#titleq').value = 'Analyst'; document.querySelector('#searchForm').requestSubmit(); })()");
  await tab.waitFor("document.querySelectorAll('#results .card').length > 0 && !document.querySelector('#searchBtn').disabled", 12000); await sleep(400);
  await tab.eval("document.querySelectorAll('#results .view-details')[0].click()");
  await tab.waitFor("document.querySelector('#modalBackdrop').classList.contains('open') && !document.querySelector('#modalIntro').hidden", 8000); await sleep(700);
}
// what every row of the window looks like
const ROWS = `(() => [...document.querySelectorAll('#modalLinks .source-row, #modalPolicy .source-row')].map((r) => {
  const go = r.querySelector('.go'), unit = r.querySelector('.go-open'), svg = r.querySelector('svg'), hid = r.querySelector('.sr-only');
  const rect = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), r: Math.round(b.right) }; };
  const modal = document.querySelector('.modal').getBoundingClientRect();
  return { tag: r.tagName, label: r.querySelector('.source-row-label').innerText.trim(), goText: go ? (unit ? [...unit.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : go.innerText.replace(/\\s+/g, ' ').trim()) : null, hasUnit: !!unit, hasSvg: !!svg,
    svgHidden: svg ? svg.getAttribute('aria-hidden') : null, hidden: hid ? hid.textContent.trim() : null, unit: rect(unit), svgRect: rect(svg), row: rect(r), modalRight: Math.round(modal.right), modalLeft: Math.round(modal.left),
    whole: r.textContent.replace(/\\s+/g, ' ').trim(), sideways: document.documentElement.scrollWidth > window.innerWidth };
}))()`;

const SCENARIOS = {
  async words(root) { return withSite(root, OPTS, (site) => withTab(async (tab) => { const bad = [];
    await open(tab, site, 1280);
    const rows = await tab.eval(ROWS);
    if (rows.length !== 6) bad.push("expected 2 application links, 3 firms and the policy line, got " + rows.length);
    for (const r of rows) {
      const nameOnly = /Name Only Partners/.test(r.label);
      if (nameOnly) {
        if (r.hasUnit || r.hasSvg || r.hidden !== null) bad.push("the firm with no address is not a link and must not carry the icon or the hidden text: " + JSON.stringify(r));
        if (r.goText !== "No link given") bad.push("the firm with no address says '" + r.goText + "'");
        continue;
      }
      if (r.goText !== "Open") bad.push("'" + r.label.slice(0, 40) + "' says '" + r.goText + "' (visible text must be exactly Open)");
      if (!r.hasSvg || r.svgHidden !== "true") bad.push("'" + r.label.slice(0, 40) + "' has no icon hidden from assistive technology");
      if (r.hidden !== "opens in a new tab") bad.push("'" + r.label.slice(0, 40) + "' has the hidden text '" + r.hidden + "'");
      if (/→|Continue|Open link/.test(r.whole)) bad.push("an old word is left on a row: " + r.whole.slice(0, 80));
    }
    return bad; })); },
  async fit(root) { return withSite(root, OPTS, async (site) => { const bad = [];
    for (const width of [320, 390, 768, 1280]) {
      await withTab(async (tab) => {
        await open(tab, site, width);
        const rows = await tab.eval(ROWS);
        for (const r of rows) {
          if (r.sideways) bad.push(width + ": the page scrolls sideways");
          if (r.row && (r.row.r > r.modalRight + 1 || r.row.l < r.modalLeft - 1)) bad.push(width + ": a row is wider than the window: " + JSON.stringify(r.row) + " vs " + r.modalLeft + "-" + r.modalRight);
          if (!r.hasUnit) continue;
          if (r.unit.h > 24) bad.push(width + ": the word and the icon are on two lines (the unit is " + r.unit.h + " px high) on '" + r.label.slice(0, 30) + "'");
          if (r.unit.r > r.modalRight + 1) bad.push(width + ": the unit leaves the window on '" + r.label.slice(0, 30) + "'");
          const mid = (b) => b.t + b.h / 2;
          if (Math.abs(mid(r.svgRect) - mid(r.unit)) > 6) bad.push(width + ": the icon is not level with the word on '" + r.label.slice(0, 30) + "'");
        }
      });
    }
    return bad; }); },
  async newTab(root) { return withSite(root, OPTS, (site) => withTab(async (tab) => { const bad = [];
    await open(tab, site, 1280);
    // window.open with noopener returns null in a real browser: the stub does the same, so the fallback link is drawn as it is in practice
    await tab.eval("window.__opened = []; window.open = (u, t, f) => { window.__opened.push([String(u), t, f]); return null; };");
    const n = await tab.eval("document.querySelectorAll('#modalLinks .source-row, #modalPolicy .source-row').length");
    for (let i = 0; i < n; i++) {
      const isNameOnly = await tab.eval("(() => { const r = document.querySelectorAll('#modalLinks .source-row, #modalPolicy .source-row')[" + i + "]; return r.tagName !== 'BUTTON'; })()");
      if (isNameOnly) continue;
      await tab.eval("document.querySelectorAll('#modalLinks .source-row, #modalPolicy .source-row')[" + i + "].click()"); await sleep(900);
    }
    const opened = await tab.eval("window.__opened");
    if (opened.length !== 5) bad.push("five rows should have opened a tab, " + opened.length + " did: " + JSON.stringify(opened.map((o) => o[0])));
    for (const [u, t, f] of opened) { if (t !== "_blank" || !/noopener/.test(f || "")) bad.push("a row did not ask for a new tab with noopener: " + JSON.stringify([u, t, f])); if (!/^https:\/\/go\.example\.invalid\//.test(u)) bad.push("a row opened " + u); }
    // after the click the browser held nothing back, but the fallback link is drawn (window.open returned null): it carries the same unit and opens a new tab itself
    const anchors = await tab.eval("[...document.querySelectorAll('#modalLinks a.source-row, #modalPolicy a.source-row')].map((a) => ({ target: a.getAttribute('target'), rel: a.getAttribute('rel'), text: [...a.querySelector('.go-open').childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(), svg: !!a.querySelector('svg[aria-hidden=\"true\"]'), hidden: (a.querySelector('.sr-only') || {}).textContent }))");
    if (anchors.length === 0) bad.push("the fallback link was not drawn when window.open returned nothing");
    for (const a of anchors) {
      if (a.target !== "_blank" || !/noopener/.test(a.rel || "")) bad.push("a fallback link does not open a new tab safely: " + JSON.stringify(a));
      if (a.text !== "Open" || !a.svg || (a.hidden || "").trim() !== "opens in a new tab") bad.push("a fallback link does not carry the same unit: " + JSON.stringify(a));
    }
    return bad; })); },
  async states(root) { return withSite(root, OPTS, (site) => withTab(async (tab) => { const bad = [];
    await open(tab, site, 1280);
    // a click shows the state words the page always showed, and the unit comes back
    await tab.eval("window.open = () => ({ closed: false });");
    await tab.eval("document.querySelector('#modalLinks .source-row').click()");
    await tab.waitFor("/Opened/.test(document.querySelector('#modalLinks .source-row .go').innerText)", 6000).catch(() => null);
    const during = await tab.eval("document.querySelector('#modalLinks .source-row .go').innerText.trim()");
    if (!/^(Redirecting…|Opened ✓)$/.test(during)) bad.push("during the click the row says '" + during + "'");
    await sleep(4600);
    const after = await tab.eval("(() => { const g = document.querySelector('#modalLinks .source-row .go'); const u = g.querySelector('.go-open'); return { text: u ? [...u.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : g.innerText.trim(), unit: !!u }; })()");
    if (after.text !== "Open" || !after.unit) bad.push("the word did not come back after the click: " + JSON.stringify(after));
    return bad; })); },
};

for (const [name, run] of Object.entries(SCENARIOS)) {
  test("the candidate's link rows, " + name, { timeout: 240000 }, async () => {
    const bad = await run(ROOT);
    assert.deepEqual(bad, [], bad.join("\n"));
  });
}

// ---- negative controls: one defect at a time; each must make a scenario fail
const DEFECTS = [
  ["the old words come back on the rows", [["js/pages/search.js", (s) => s.replace('const go_ = h("span", { class: "go" }, openUnit());', 'const go_ = h("span", { class: "go" }, "Continue →");')]], ["words"]],
  ["the icon is not hidden from assistive technology", [["js/open-link.js", (s) => s.replace('["aria-hidden", "true"], ', "")]], ["words"]],
  ["the hidden text is missing", [["js/open-link.js", (s) => s.replace('export const OPEN_HIDDEN = "opens in a new tab";', 'export const OPEN_HIDDEN = "";')]], ["words"]],
  ["the word and the icon can break across lines", [["app.css", (s) => s.replace(".source-row .go-open{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}", ".source-row .go-open{display:block;white-space:normal;width:20px}")]], ["fit"]],
  ["a long firm name pushes the row out of the window", [["app.css", (s) => s.replace("min-width:0;overflow-wrap:anywhere;margin-right:12px}", "min-width:max-content;margin-right:12px}")]], ["fit"]],
  ["the fallback link is drawn without the unit", [["js/pages/search.js", (s) => s.replace('h("span", { class: "go" }, openUnit())));', 'h("span", { class: "go" }, "Open link →")));')]], ["newTab"]],
  ["a row opens in the same tab", [["js/pages/search.js", (s) => s.replace('window.open(url, "_blank", "noopener,noreferrer")', 'window.open(url, "_self", "noopener,noreferrer")')]], ["newTab"]],
  ["the firm with no address gets the icon", [["js/pages/search.js", (s) => s.replace('h("span", { class: "go", style: "color:var(--faint);" }, "No link given")', 'h("span", { class: "go", style: "color:var(--faint);" }, openUnit())')]], ["words"]],
  ["the word does not come back after a click", [["js/pages/search.js", (s) => s.replace('if (go_.querySelector(".go-open") === null) go_.replaceChildren(openUnit());', "")]], ["states"]],
];
test("negative controls: each defect makes a scenario fail", { timeout: 1800000 }, async () => {
  const missed = [];
  for (const [label, edits, scenarios] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-open-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      for (const n of scenarios) {
        try { for (const p of await SCENARIOS[n](dir)) found.push(n + ": " + p); } catch (e) { found.push(n + ": the scenario could not finish: " + String(e.message).slice(0, 100)); }
      }
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 150) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
