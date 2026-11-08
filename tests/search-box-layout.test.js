// search-box-layout.test.js - the optional line is INSIDE the one white search box (prompt JK, November 7, 2026), in a real headless Chrome, the repo's own files and a fake backend (tests/fake-site.js; no real project, no key, no token).
// John's layout: one white box holds everything of the search; at 390 the order is Company, "Then one of these" (Req number, or, KIO ID or title), the optional line, then the black Search button as the LAST thing in the box; at 1250 the three fields are at
// the top, the optional line is under them and Search is to the right of everything. The optional line reads OPTIONAL (bold capitals) then Where you found this job, then one short help line, then the box. Nothing else is visible in it.
//   inside     at 390, 768 and 1250 the optional box, the label, the help line, the three fields and the Search button all lie inside the box of the form
//   order      at 390 the optional box is above Search and Search is the last item of the box; at 768 and 1250 the three fields are in the top area, the optional line under them, and Search is to the right of the optional box and of the three fields
//   tabs       Tab goes Company, Req number, KIO ID or title, the optional box, Search; Enter in the optional box searches and sends the source as before
//   words      OPTIONAL is bold capitals in front of Where you found this job on one line (390 and 1250); the visible words of the optional line are exactly the label and the short help line; the employer sentence and the old long instruction are not on the page; the info box holds the employer sentence under Your privacy
//   card       no second card: the block has no background, no radius, no shadow, only a thin line above it; no sideways scroll; Search is at least 44 by 44 pixels
// Then planted breakages: one deliberate defect at a time in a COPY of the repo, each must make a scenario fail. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/search-box-layout.test.js
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

// prompt JL (November 8, 2026): the stacked layout holds up to 999 pixels, the wide row starts at 1000 (stacked says which one the box must be in)
const S390 = { n: "390", w: 390, h: 844, phone: true, stacked: true }, S768 = { n: "768", w: 768, h: 1024, phone: false, stacked: true }, S820 = { n: "820", w: 820, h: 1180, phone: false, stacked: true }, S999 = { n: "999", w: 999, h: 900, phone: false, stacked: true }, S1000 = { n: "1000", w: 1000, h: 900, phone: false, stacked: false }, S1250 = { n: "1250", w: 1250, h: 900, phone: false, stacked: false };
const ALL = [S390, S768, S820, S999, S1000, S1250];
const HELP = "Site (ex. LinkedIn.com or LinkedIn) or email (ex. jobs@linkedin.com)";
const EMPLOYERS = "Employers see this exactly as you type it.";
const OLD_LONG = "Type a site name or domain, such as LinkedIn.com (LinkedIn alone is fine), or the address of the email the job came from, such as jobs@linkedin.com.";
const searches = (site) => site.calls.filter((c) => c.name === "candidate-search");

async function become(tab, site) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
}
async function openAt(tab, site, size) {
  await tab.viewport(size.w, size.phone, size.h);
  await tab.goto(site.url + "/404.html"); await tab.goto(site.url + "/search.html");
  await tab.waitFor("document.readyState === 'complete' && !!document.getElementById('company')", 15000);
  await sleep(1100);
}
const GEO = `(() => { const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top + scrollY, b: b.bottom + scrollY, w: b.width, h: b.height }; }, g = (id) => document.getElementById(id);
  const label = document.querySelector('label[for="sourceq"]'), opt = label && label.querySelector('.srch-opt'), block = g('sourceBlock'), cs = block ? getComputedStyle(block) : null, oc = opt ? getComputedStyle(opt) : null, lc = label ? getComputedStyle(label) : null;
  const lineH = label ? parseFloat(lc.lineHeight) || parseFloat(lc.fontSize) * 1.3 : 0;
  const kioLab = document.querySelector('label[for="titleq"]'), kc = kioLab ? getComputedStyle(kioLab) : null, probe = document.createElement('span');
  let kioLines = 0; if (kioLab) { probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:' + kc.font + ';text-transform:uppercase;letter-spacing:' + kc.letterSpacing; probe.textContent = 'X'; document.body.append(probe); const ph = probe.getBoundingClientRect().height; probe.remove(); kioLines = Math.max(1, Math.round(kioLab.getBoundingClientRect().height / ph)); }
  return { kioLines, card: r(g('searchForm')), block: r(block), src: r(g('sourceq')), label: r(label), help: r(g('sourceHint')), company: r(g('company')), req: r(g('reqq')), title: r(g('titleq')), btn: r(g('searchBtn')),
    labelText: label ? label.textContent.replace(/\\s+/g, ' ').trim() : null, optText: opt ? opt.textContent : null, optWeight: oc ? parseInt(oc.fontWeight, 10) : 0, optTransform: oc ? oc.textTransform : null, optTop: opt ? opt.getBoundingClientRect().top : null, labelTop: label ? label.getBoundingClientRect().top : null, labelH: label ? label.getBoundingClientRect().height : 0, lineH,
    blockBg: cs ? cs.backgroundColor : null, blockRadius: cs ? cs.borderTopLeftRadius : null, blockShadow: cs ? cs.boxShadow : null, blockBorders: cs ? [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].join(' ') : null, cards: document.querySelectorAll('.srch-source').length,
    blockText: block ? block.innerText.replace(/\\s+/g, ' ').trim() : null, mainText: document.getElementById('main').innerText.replace(/\\s+/g, ' ').trim(), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, formOwnerOfSource: g('sourceq') && g('sourceq').form ? g('sourceq').form.id : null }; })()`;
const inside = (a, c) => a && c && a.l >= c.l - 0.5 && a.r <= c.r + 0.5 && a.t >= c.t - 0.5 && a.b <= c.b + 0.5;

const SCENARIOS = {
  async inside(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await become(tab, site);
      for (const size of ALL) {
        await openAt(tab, site, size);
        const g = await tab.eval(GEO), L = size.n + ": ";
        if (!g.block || !g.src || !g.btn) { bad.push(L + "the optional line or the Search button is missing"); continue; }
        if (g.kioLines > 2) bad.push(L + "the KIO ID label takes " + g.kioLines + " lines (two at most)");
        if (size.stacked && g.card.w > 640.5) bad.push(L + "the stacked box is " + Math.round(g.card.w) + " pixels wide (640 at most, so it does not stretch across a tablet)");
        for (const k of ["block", "src", "label", "help", "company", "req", "title", "btn"]) if (!inside(g[k], g.card)) bad.push(L + k + " lies outside the box of the form: " + JSON.stringify([g[k], g.card]));
        if (g.formOwnerOfSource !== "searchForm") bad.push(L + "the optional input does not belong to the search form: " + g.formOwnerOfSource);
        if (g.cards !== 1) bad.push(L + "there are " + g.cards + " optional blocks");
        if (g.sw > g.cw) bad.push(L + "the page scrolls sideways");
        if (g.btn.w < 44 || g.btn.h < 44) bad.push(L + "Search is " + Math.round(g.btn.w) + " by " + Math.round(g.btn.h) + " pixels (need 44 by 44)");
      }
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async order(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await become(tab, site);
      for (const size of ALL) {
        await openAt(tab, site, size);
        const g = await tab.eval(GEO), L = size.n + ": ";
        if (!g.block || !g.src || !g.btn) { bad.push(L + "the optional line or the Search button is missing"); continue; }
        if (size.stacked) {
          if (!(g.src.b <= g.btn.t + 0.5)) bad.push(L + "the optional box is not above Search (box bottom " + Math.round(g.src.b) + ", Search top " + Math.round(g.btn.t) + ")");
          for (const k of ["company", "req", "title", "src"]) if (!(g[k].b <= g.btn.t + 0.5)) bad.push(L + k + " is not above Search");
          if (!(g.card.b - g.btn.b < 40)) bad.push(L + "Search is not the last item of the box (" + Math.round(g.card.b - g.btn.b) + " pixels of box below it)");
          if (!(g.company.b <= g.req.t + 0.5 && g.req.b <= g.title.t + 0.5 && g.title.b <= g.block.t + 0.5)) bad.push(L + "the order Company, Req number, KIO ID or title, optional line is broken");
        } else {
          for (const k of ["company", "req", "title"]) if (!(g[k].b <= g.block.t + 0.5)) bad.push(L + k + " is not in the top area above the optional line");
          if (!(g.company.l < g.req.l && g.req.l < g.title.l)) bad.push(L + "the three fields are not in a row, left to right");
          for (const k of ["src", "block", "req", "title", "company"]) if (!(g[k].r <= g.btn.l + 0.5)) bad.push(L + "Search is not to the right of " + k + " (" + Math.round(g[k].r) + " against " + Math.round(g.btn.l) + ")");
          if (!(g.btn.t <= g.company.t + 40 && g.btn.b >= g.src.b - 1)) bad.push(L + "Search does not stand beside the whole box");
          if (size.w >= 1250 && g.src.w < g.company.w * 2) bad.push(L + "the optional box is narrow at 1250 (" + Math.round(g.src.w) + ")");
        }
      }
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async tabs(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await become(tab, site);
      for (const size of [S390, S1250]) {
        await openAt(tab, site, size);
        const L = size.n + ": ";
        await tab.eval("document.getElementById('company').focus()");
        const seen = ["company"];
        for (let i = 0; i < 12; i++) { await tab.key("Tab"); const id = await tab.eval("document.activeElement && document.activeElement.id"); if (["company", "reqq", "titleq", "sourceq", "searchBtn"].includes(id)) seen.push(id); if (id === "searchBtn") break; }
        if (seen.join(",") !== "company,reqq,titleq,sourceq,searchBtn") bad.push(L + "the tab order is " + seen.join(","));
      }
      await openAt(tab, site, S1250);
      await tab.eval("(() => { document.getElementById('company').value = 'Contoso Freight'; document.getElementById('titleq').value = 'Senior Logistics Analyst'; const s = document.getElementById('sourceq'); s.value = 'Dice.com'; s.dispatchEvent(new Event('input', { bubbles: true })); s.focus(); })()");
      site.calls.length = 0; await tab.key("Enter"); await sleep(1500);
      const sent = searches(site);
      if (sent.length !== 1 || sent[0].body.source !== "Dice.com") bad.push("Enter in the optional box did not search with the source: " + JSON.stringify(sent[0] && sent[0].body));
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async words(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await become(tab, site);
      for (const size of [S390, S1250]) {
        await openAt(tab, site, size);
        const g = await tab.eval(GEO), L = size.n + ": ";
        if (g.optText !== "Optional") bad.push(L + "the tag says '" + g.optText + "'");
        if (g.optWeight < 700) bad.push(L + "the tag is not bold (weight " + g.optWeight + ")");
        if (g.optTransform !== "uppercase") bad.push(L + "the tag is not in capitals (" + g.optTransform + ")");
        if (g.labelText !== "Optional Where you found this job") bad.push(L + "the label reads '" + g.labelText + "'");
        if (g.optTop !== null && Math.abs(g.optTop - g.labelTop) > 6) bad.push(L + "the tag is not on the first line of the label");
        if (g.labelH > g.lineH * 1.6) bad.push(L + "the label takes more than one line (" + Math.round(g.labelH) + " pixels high)");
        if (g.blockText.toLowerCase() !== ("Optional Where you found this job " + HELP).toLowerCase()) bad.push(L + "the visible words of the optional line are '" + g.blockText + "'");
        if (!g.blockText.includes(HELP)) bad.push(L + "the help line is not exactly: " + HELP);
        if (g.mainText.includes(EMPLOYERS)) bad.push(L + "the employer sentence is on the page");
        if (g.mainText.includes(OLD_LONG) || g.mainText.includes("LinkedIn alone is fine")) bad.push(L + "the old long instruction is on the page");
      }
      await openAt(tab, site, S1250);
      await tab.eval("document.querySelector('#infoSlot .info-box-icon').click()"); await sleep(300);
      const box = await tab.eval(`(() => { const b = document.querySelector('.info-box-body'); if (!b) return null; const hs = Array.from(b.querySelectorAll('.info-section')).map((e) => e.textContent), ps = Array.from(b.querySelectorAll('.info-para')).map((e) => e.textContent.trim()); const i = ps.indexOf(${JSON.stringify(EMPLOYERS)}); let sec = null; if (i >= 0) { const node = Array.from(b.children).find((c) => c.textContent.trim() === ${JSON.stringify(EMPLOYERS)}); let p = node; while (p && !(p.classList && p.classList.contains('info-section'))) p = p.previousElementSibling; sec = p ? p.textContent : null; } return { found: i >= 0, section: sec, words: b.innerText.trim().split(/\\s+/).filter(Boolean).length }; })()`);
      await tab.eval("(() => { const c = document.querySelector('.info-box-close'); if (c) c.click(); })()");
      if (!box || !box.found) bad.push("the info box does not hold: " + EMPLOYERS);
      else if (box.section !== "Your privacy") bad.push("the employer sentence is under '" + box.section + "', not Your privacy");
      if (process.env.FGJ_JK_REPORT && box) console.log("INFO BOX WORDS: " + box.words);
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
  async card(root) {
    const bad = [], site = await startFakeSite(root, { kio: true }), tab = await browser.newTab();
    try {
      await tab.focusEmulation(true); await become(tab, site);
      for (const size of [S390, S768, S1250]) {
        await openAt(tab, site, size);
        const g = await tab.eval(GEO), L = size.n + ": ";
        if (!g.blockBg || !/rgba\(0, 0, 0, 0\)|transparent/.test(g.blockBg)) bad.push(L + "the optional line has its own background: " + g.blockBg);
        if (g.blockRadius !== "0px") bad.push(L + "the optional line has rounded corners: " + g.blockRadius);
        if (g.blockShadow && g.blockShadow !== "none") bad.push(L + "the optional line has a shadow");
        const [t, r, b, l] = (g.blockBorders || "0px 0px 0px 0px").split(" ").map((x) => parseFloat(x));
        if (r !== 0 || b !== 0 || l !== 0 || t > 1.5) bad.push(L + "the optional line has more than a thin line above it: " + g.blockBorders);
      }
    } finally { await tab.close(); await site.close(); }
    return bad;
  },
};

for (const [name, fn] of Object.entries(SCENARIOS)) {
  test("the search box: " + name, { timeout: 600000 }, async () => {
    const bad = await fn(ROOT);
    assert.deepEqual(bad, [], bad.join("\n"));
  });
}

// ---- planted breakages: [label, scenarios to run, [file, mutate(text)]...]. Each must make at least one scenario report a problem.
const H = "search.html", C = "app.css";
const BLOCK = /      <div id="sourceBlock"[\s\S]*?\n      <\/div>\n(?=      <\/div>\n      <button type="submit")/;
const BTN = '      <button type="submit" id="searchBtn" class="btn btn-dark">Search</button>\n';
const DEFECTS = [
  ["the optional field is back in its own card below Search", ["inside", "order"], [[H, (s) => { const b = s.match(BLOCK)[0]; return s.replace(b, "").replace("    </form>\n", "    </form>\n" + b); }]]],
  ["the optional field is after the Search button", ["order"], [[H, (s) => s.replace(BTN, "").replace('      <div id="sourceBlock"', BTN + '      <div id="sourceBlock"')]]],
  ["the optional field is hidden on a phone", ["inside", "order", "words"], [[C, (s) => s.replace(".srch-source[hidden]{display:none}", ".srch-source[hidden]{display:none}\n@media (max-width:760px){.srch-source{display:none}}")]]],
  ["the tab order changes (the optional box first)", ["tabs"], [[H, (s) => s.replace(' class="srch-input srch-source-input"', ' tabindex="1" class="srch-input srch-source-input"')]]],
  ["the word Optional is not in capitals", ["words"], [[C, (s) => s.replace(".srch-opt{text-transform:uppercase;", ".srch-opt{text-transform:none;")]]],
  ["the word Optional is not bold", ["words"], [[C, (s) => s.replace("letter-spacing:.05em;font-weight:700;color:var(--ink);margin-right:4px", "letter-spacing:.05em;font-weight:400;color:var(--ink);margin-right:4px")]]],
  ["the word Optional is removed", ["words"], [[H, (s) => s.replace('<span class="srch-opt">Optional</span> ', "")]]],
  ["Search is to the left of the optional line in the wide row", ["order"], [[C, (s) => s.replace(".srch-main{flex:1;", ".srch-form{flex-direction:row-reverse}\n.srch-main{flex:1;")]]],
  // prompt JL (November 8, 2026): the switch from the stacked layout to the wide row is at 1000 pixels
  ["the switch is back at 760 pixels", ["order", "inside"], [[C, (s) => s.split("@media (max-width:999px){.srch-").join("@media (max-width:760px){.srch-")]]],
  ["the switch is below 700 pixels", ["order", "inside"], [[C, (s) => s.split("@media (max-width:999px){.srch-").join("@media (max-width:640px){.srch-")]]],
  ["the stacked rule for the in between widths is removed", ["order"], [[C, (s) => s.replace(".srch-top{flex-direction:column!important}", "")]]],
  ["the stacked box stretches across a tablet", ["inside", "order"], [[C, (s) => s.replace(";max-width:640px!important}", "}")]]],
  ["the employer sentence is back on the form", ["words"], [[H, (s) => s.replace('<div id="sourceHint"', '<div class="field-hint">Employers see this exactly as you type it.</div><div id="sourceHint"')]]],
  ["the employer sentence is deleted from the info box", ["words"], [[H, (s) => s.replace('  <div id="sourceNote" class="field-hint">Employers see this exactly as you type it.</div>\n', "")]]],
  ["the old long instruction line is back", ["words"], [[H, (s) => s.replace(HELP, OLD_LONG)]]],
  ["the optional block is a white card again", ["card"], [[C, (s) => s.replace(".srch-source{display:flex;", ".srch-source{background:#fff;border-radius:12px;display:flex;")]]],
  ["the optional input is not in the form", ["inside", "tabs"], [[H, (s) => s.replace(' class="srch-input srch-source-input"', ' form="elsewhere" class="srch-input srch-source-input"')]]],
  ["the Search button is small", ["inside"], [[H, (s) => s.replace('<button type="submit" id="searchBtn" class="btn btn-dark">', '<button type="submit" id="searchBtn" class="btn btn-dark" style="padding:0;min-height:0;height:20px;width:30px">')]]],
  ["the page scrolls sideways on a phone", ["inside"], [[C, (s) => s.replace(".srch-main{flex:1;min-width:0;", ".srch-main{flex:1;min-width:1500px;")]]],
];
test("planted breakages: each deliberate defect in the search box makes a scenario fail", { timeout: 6000000 }, async () => {
  const missed = [], only = process.env.FGJ_JK_ONLY ? process.env.FGJ_JK_ONLY.split("|") : null;
  let n = 0;
  for (const [label, scenarios, edits] of DEFECTS) {
    if (only && !only.some((x) => label.includes(x))) continue;
    n++;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-jk-ctl-")), t0 = Date.now();
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) {
        const p = path.join(dir, rel), before = fs.readFileSync(p, "utf8").replace(/\?v=[0-9a-f]{8}(?=["'`])/g, "").replace(/\r\n/g, "\n"), after = mutate(before);
        assert.notEqual(after, before, "the defect '" + label + "' changed nothing in " + rel);
        fs.writeFileSync(p, after);
      }
      const found = [];
      for (const name of scenarios) found.push(...(await SCENARIOS[name](dir)).map((x) => name + ": " + x));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  [" + ((Date.now() - t0) / 1000).toFixed(0) + " s]  (" + found[0].slice(0, 150) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  console.log("planted breakages run: " + n + ", missed: " + missed.length);
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
