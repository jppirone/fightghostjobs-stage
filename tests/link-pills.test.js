// link-pills.test.js - the link count pills of the opening tile (prompt LK, October 23, 2026), in a real browser on the repo's own files with a fake backend (tests/fake-site.js; no real project, no key).
// The tile says how many links the employer gave ("3 official links" / "3 employer links" / "No employer links") and how many recruiter firms ("2 recruiter links" / "Recruiter involved" / "No recruiter"), without opening the
// details. This test proves, for the counts 0, 1, 2, 3 and the maximum: the exact words, the place in the row, the "i" icons and their exact tooltips (mouse, keyboard, touch; the same behavior as an AI pill), that the number on the tile
// is the number the details window lists, that no address, token or one-time link is on the tile and none is issued by the search, that the status of the opening changes nothing, that an answer without counts invents nothing, how the
// row wraps at 1280, 1000, 768, 375 and 320 (no clipping, no overlap, not over the Registered mark), and the recap of the comments page. Then negative controls: one planted defect at a time; each must make a check fail.
// A missing browser FAILS the test (set FGJ_BROWSER).     Run: node --test tests/link-pills.test.js
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

const OFFICIAL = "The employer says these are the only places to apply for this opening. FightGhostJobs does not check that.";
const EMPLOYER = "Links the employer provided to apply for this opening. The employer has not said these are the only places to apply.";
// the words, written out here on purpose (not taken from the module): what a person must read
const appText = (n, ex) => (n === 0 ? "No employer links" : n + (ex ? (n === 1 ? " official link" : " official links") : (n === 1 ? " employer link" : " employer links")));
const recText = (on, firms) => (!on ? "No recruiter" : firms > 0 ? firms + (firms === 1 ? " recruiter link" : " recruiter links") : "Recruiter involved");
const c = (apply, firms, exclusive, recruiter, extra) => ({ apply, firms, exclusive, recruiter, extra });

async function openSearch(tab, site, width = 1280) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.goto(site.url + "/search.html");
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(500);
  void width;
}
const fill = (tab, company, title) => tab.eval(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }; set("company", ${JSON.stringify(company)}); set("titleq", ${JSON.stringify(title)}); set("reqq", ""); })()`);
async function runSearch(tab) { await fill(tab, "Meridian", "analyst"); await tab.eval(`document.getElementById("searchBtn").focus()`); await tab.key("Enter"); await tab.waitFor(`!document.getElementById("recap").hidden`, 6000); await sleep(500); }
const CARDS = `(() => Array.from(document.querySelectorAll('#results .card')).map((card) => ({ ref: card.getAttribute('data-ref'), html: card.outerHTML, text: card.innerText,
  chips: Array.from(card.querySelectorAll('.chip')).map((chip) => { const icon = chip.querySelector('.info-icon'), clone = chip.cloneNode(true), ic = clone.querySelector('.info-icon'); if (ic) ic.remove();
    return { text: clone.textContent.trim(), icon: !!icon, aria: icon ? icon.getAttribute('aria-label') : null, tip: icon ? ((icon.querySelector('.info-tooltip') || {}).textContent || null) : null, tabindex: icon ? icon.getAttribute('tabindex') : null, role: icon ? icon.getAttribute('role') : null }; }) })))()`;
async function modalRows(tab, i) {
  // prompt LM (October 23, 2026): a tile whose counts are all zero has no details window and no View links button; its window holds nothing, so it lists no rows
  if (await tab.eval(`!document.querySelectorAll('#results .card')[${i}].querySelector('.view-details')`)) return { rows: 0, policy: false, empty: false, noDetails: true };
  await tab.eval(`document.querySelectorAll('#results .card')[${i}].querySelector('.view-details').click()`);
  await tab.waitFor(`document.getElementById('modalBackdrop').classList.contains('open')`, 5000); await sleep(900);
  const r = await tab.eval(`({ rows: document.querySelectorAll('#modalLinks .source-row').length, policy: !document.getElementById('modalPolicy').hidden && document.querySelectorAll('#modalPolicy .source-row').length > 0, empty: !document.getElementById('modalEmpty').hidden })`);
  await tab.key("Escape"); await sleep(250);
  return r;
}
const numberOf = (t) => { const m = /^(\d+) /.exec(t || ""); return m ? Number(m[1]) : 0; };

// what the first two tiles must read, for a pair of cases; texts are in the designed order: ... recruiter pill, application links pill, cap ...
function expectedPills(k) { return [recText(k.recruiter === true, k.firms), appText(k.apply, k.exclusive === true)]; }
async function checkTiles(tab, site, cases, tag, bad, { details = true, policy = false } = {}) {
  const cards = await tab.eval(CARDS);
  if (cards.length !== cases.length) { bad.push(tag + ": " + cards.length + " tiles (wanted " + cases.length + ")"); return cards; }
  for (let i = 0; i < cases.length; i++) {
    const k = cases[i], t = cards[i].chips.map((x) => x.text), at = tag + " tile " + (i + 1) + ": ";
    const [rec, app] = expectedPills(k), iRec = t.indexOf(rec), iApp = t.indexOf(app);
    if (iRec < 0) bad.push(at + "no recruiter pill '" + rec + "' in " + JSON.stringify(t));
    if (iApp < 0) bad.push(at + "no application links pill '" + app + "' in " + JSON.stringify(t));
    if (iRec >= 0 && iApp >= 0 && iApp !== iRec + 1) bad.push(at + "the application links pill is not right after the recruiter pill: " + JSON.stringify(t));
    if (iApp >= 0 && !/applicants|cap/.test(t[iApp + 1] || "")) bad.push(at + "the cap pill does not follow: " + JSON.stringify(t));
    if (t.filter((x) => /link|recruiter|Recruiter/i.test(x)).length !== 2) bad.push(at + "there are not exactly two link pills: " + JSON.stringify(t));
    const ap = cards[i].chips[iApp], rp = cards[i].chips[iRec];
    if (ap) {
      const wantTip = k.apply === 0 ? null : k.exclusive === true ? OFFICIAL : EMPLOYER;
      if ((ap.tip || null) !== wantTip) bad.push(at + "the application pill tooltip is " + JSON.stringify(ap.tip) + " (wanted " + JSON.stringify(wantTip) + ")");
      if (wantTip !== null && (ap.aria !== wantTip || !ap.icon)) bad.push(at + "the icon is not read by a screen reader with the tooltip text: " + JSON.stringify(ap.aria));
      if (wantTip === null && ap.icon) bad.push(at + "'No employer links' carries an icon");
    }
    if (rp && rp.icon) bad.push(at + "the recruiter pill carries an icon (it has none today)");
    if (details) {
      const m = await modalRows(tab, i), listedApply = k.apply, listedFirms = k.recruiter === true ? k.firms : 0;
      const shown = (app === "No employer links" ? 0 : numberOf(app)) + (rec.endsWith("recruiter link") || rec.endsWith("recruiter links") ? numberOf(rec) : 0);
      if (m.rows !== shown) bad.push(at + "the pills add up to " + shown + " but the details window lists " + m.rows);
      if (m.rows !== listedApply + listedFirms) bad.push(at + "the details window lists " + m.rows + " (the fake sent " + (listedApply + listedFirms) + ")");
      if (policy && !m.policy) bad.push(at + "the policy link was not listed in the details window (the test needs it to be)");
    }
  }
  if (site.calls.some((x) => x.name === "candidate-link-issue")) bad.push(tag + ": a one-time link was issued without a click on a link");
  return cards;
}

async function withSite(root, opts, width, fn) {
  const site = await startFakeSite(root, opts), tab = await browser.newTab();
  try { await tab.focusEmulation(true); await tab.viewport(width, width < 700, width < 700 ? 800 : 900); await openSearch(tab, site, width); await tab.viewport(width, width < 700, width < 700 ? 800 : 900); return await fn(tab, site); } finally { await tab.close(); await site.close(); }
}

const PAIRS = [
  ["zero and one", [c(0, 0, false, false), c(1, 0, false, false)]],
  ["one official, one recruiter; two employer, two recruiters", [c(1, 1, true, true), c(2, 2, false, true)]],
  ["two official and three firms; three official, switch off with firms kept", [c(2, 3, true, true), c(3, 2, true, false)]],
  ["the maximum: ten official with no firm named; ten employer with three firms", [c(10, 0, true, true), c(10, 3, false, true)]],
  ["the statement with no links; a lapsed plan (nothing listed) with the switch on", [c(0, 0, true, false), c(0, 0, false, true)]],
];

const SCENARIOS = {
  async states(root) {
    const bad = [];
    for (const [name, pair] of PAIRS) await withSite(root, { linkCounts: pair }, 1280, async (tab, site) => { await runSearch(tab); await checkTiles(tab, site, pair, name, bad); });
    return bad;
  },
  // the AI and hiring policy link is listed in the details window but never counted; a status other than live changes nothing
  async policy(root) {
    const bad = [], pair = [c(2, 1, false, true), c(1, 0, true, false)];
    await withSite(root, { linkCounts: pair, policyDetail: true }, 1280, async (tab, site) => { await runSearch(tab); await checkTiles(tab, site, pair, "policy link present", bad, { policy: true }); });
    return bad;
  },
  async statuses(root) {
    const bad = [], pair = [c(3, 2, true, true, { status: "paused" }), c(1, 1, false, true, { status: "expired", closed_reason: "expired_no_action" })];
    await withSite(root, { linkCounts: pair }, 1280, async (tab, site) => { await runSearch(tab); await checkTiles(tab, site, pair, "paused and expired", bad, { details: false }); });
    return bad;
  },
  // an answer from before the database change: no application pill, nothing invented
  async absent(root) {
    const bad = [];
    await withSite(root, { placeOverrides: [{ third_party_recruiter: true }, {}] }, 1280, async (tab) => {
      await runSearch(tab);
      const cards = await tab.eval(CARDS);
      if (cards.length !== 2) { bad.push(cards.length + " tiles"); return; }
      const t0 = cards[0].chips.map((x) => x.text), t1 = cards[1].chips.map((x) => x.text);
      if (!t0.includes("Recruiter involved") || !t1.includes("No recruiter")) bad.push("the recruiter pills are " + JSON.stringify([t0, t1]));
      for (const t of [t0, t1]) if (t.some((x) => /employer link|official link|No employer links|recruiter link/.test(x))) bad.push("an answer without counts invented a link pill: " + JSON.stringify(t));
    });
    return bad;
  },
  // counts only: an address, a firm address, a token in the row never reach the page, and the search issues no one-time link
  async leak(root) {
    const bad = [], extra = { url: "https://leak.example.invalid/apply?t=SECRET", go_url: "https://go.example.invalid/f/SECRET", firm_url: "https://firm.example.invalid/SECRET", token: "tok_SECRET", label: "SECRET label" };
    await withSite(root, { linkCounts: [c(2, 1, true, true, extra), c(1, 0, false, false, extra)] }, 1280, async (tab, site) => {
      await runSearch(tab);
      const cards = await tab.eval(CARDS), all = await tab.eval("document.documentElement.outerHTML");
      if (cards.length !== 2) { bad.push(cards.length + " tiles"); return; }
      for (const card of cards) if (/SECRET|leak\.example|go\.example|firm\.example|https?:\/\//i.test(card.html + card.text)) bad.push("an address or token is on a tile: " + (/(SECRET|leak\.example|go\.example|firm\.example|https?:\/\/)/i.exec(card.html + card.text) || [])[0]);
      if (/SECRET|leak\.example|go\.example|firm\.example/i.test(all)) bad.push("an address or token is somewhere in the page");
      if (!cards[0].chips.some((x) => x.text === "2 official links")) bad.push("the pill is not there: " + JSON.stringify(cards[0].chips.map((x) => x.text)));
      const names = site.calls.map((x) => x.name);
      if (names.includes("candidate-link-issue") || names.includes("candidate-posting-detail")) bad.push("the search called more than the search: " + JSON.stringify(names));
    });
    return bad;
  },
  // the "i" icons: mouse, keyboard, touch; the same as an AI pill
  async icons(root) {
    const bad = [], pair = [c(1, 1, true, true), c(2, 0, false, false)];
    for (const [width, phone] of [[1280, false], [375, true]]) {
      await withSite(root, { linkCounts: pair }, width, async (tab) => {
        await runSearch(tab);
        const tag = "at " + width + ": ";
        const probe = (sel) => `(() => { const tip = ${sel}; if (!tip) return null; const icon = tip.parentElement, r = icon.getBoundingClientRect(), t = tip.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, shown: getComputedStyle(tip).display !== 'none' && t.width > 0, left: t.left, right: t.right, text: tip.textContent, vw: innerWidth, aria: icon.getAttribute('aria-label') }; })()`;
        // the icon of a pill by its text, and the icon of an existing AI pill to compare with
        const iconOf = (text) => `Array.from(document.querySelectorAll('#results .card')[0].querySelectorAll('.chip')).filter((c) => c.firstChild && c.firstChild.textContent.trim() === ${JSON.stringify(text)}).map((c) => c.querySelector('.info-tooltip'))[0]`;
        // prompt LM: the AI pills have no "i" of their own any more (they are buttons when the employer wrote words), so the new icon is no longer compared with one; its own behavior is checked as before
        const subjects = [["1 official link", OFFICIAL]];
        const seen = {};
        for (const [text, want] of subjects) {
          const at = tag + "'" + text + "': ";
          let p = await tab.eval(probe(iconOf(text)));
          if (!p) { bad.push(at + "no icon"); continue; }
          if (want !== null && (p.text !== want || p.aria !== want)) bad.push(at + "tooltip/aria is " + JSON.stringify([p.text, p.aria]));
          await tab.eval("document.activeElement && document.activeElement.blur()");
          // mouse
          await tab.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5 }); p = await tab.eval(probe(iconOf(text))); const hidden0 = !p.shown;
          await tab.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x, y: p.y }); await sleep(150); const hov = (await tab.eval(probe(iconOf(text)))).shown;
          await tab.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5 }); await sleep(150);
          // keyboard: tab from the top of the page until the icon has the focus
          await tab.eval(`window.scrollTo(0, 0); document.activeElement && document.activeElement.blur(); document.body.focus()`);
          let focused = false;
          for (let n = 0; n < 80 && !focused; n++) { await tab.key("Tab"); focused = await tab.eval(`(() => { const t = ${iconOf(text)}; return !!t && document.activeElement === t.parentElement; })()`); }
          const kb = focused ? (await tab.eval(probe(iconOf(text)))) : null;
          await tab.eval("document.activeElement && document.activeElement.blur()"); await sleep(100);
          // touch: a tap at the icon (touch emulation is on at phone width)
          p = await tab.eval(probe(iconOf(text)));
          await tab.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] }); await tab.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(250);
          const tap = await tab.eval(probe(iconOf(text)));
          seen[text] = { hidden0, hov, kb: !!(kb && kb.shown), kbText: kb && kb.text, tap: !!tap.shown, tapInside: tap.left >= -0.5 && tap.right <= tap.vw + 0.5 };
          await tab.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5 });
        }
        const a = seen["1 official link"], b = null;
        if (a) {
          if (!a.hidden0) bad.push(tag + "the new tooltip is visible before anything happens");
          if (!phone && !a.hov) bad.push(tag + "the new tooltip does not show on mouse over");
          if (!a.kb) bad.push(tag + "the new tooltip does not show on keyboard focus (Tab)");
          if (a.kb && a.kbText !== OFFICIAL) bad.push(tag + "the keyboard tooltip text is wrong");
          if (phone && !a.tap) bad.push(tag + "the new tooltip does not show on a tap");
          if (phone && a.tap && !a.tapInside) bad.push(tag + "the tapped tooltip runs off the screen");
          void b;
        }
        const info = await tab.eval(CARDS);
        const ia = info[0].chips.find((x) => x.text === "1 official link");
        if (!ia || ia.tabindex !== "0" || ia.role !== null) bad.push(tag + "the new icon is built differently from the other info icons (tabindex 0, no role): " + JSON.stringify(ia && [ia.tabindex, ia.role]));
        const second = info[1].chips.find((x) => x.text === "2 employer links");
        if (!second || second.tip !== EMPLOYER || second.aria !== EMPLOYER) bad.push(tag + "the employer links tooltip is " + JSON.stringify(second));
      });
    }
    return bad;
  },
  // the row wraps cleanly, nothing clipped, nothing over the Registered mark
  async layout(root) {
    const bad = [], pair = [c(10, 3, false, true), c(10, 0, true, true)];
    for (const width of [1280, 1000, 768, 375, 320]) {
      await withSite(root, { linkCounts: pair, registeredValues: [true, true] }, width, async (tab) => {
        await runSearch(tab);
        const r = await tab.eval(`(() => Array.from(document.querySelectorAll('#results .card')).map((card) => { const cr = card.getBoundingClientRect(), reg = card.querySelector('.badge-verified'), rr = reg ? reg.getBoundingClientRect() : null,
          chips = Array.from(card.querySelectorAll('.chip')).map((c) => { const b = c.getBoundingClientRect(); const tn = c.firstChild; let fit = true; if (tn && tn.nodeType === 3) { const rg = document.createRange(); rg.selectNodeContents(tn); const tr = rg.getBoundingClientRect(); fit = tr.left >= b.left - 0.5 && tr.right <= b.right + 0.5 && tr.height <= b.height + 0.5; }
            return { l: b.left, r: b.right, t: b.top, b: b.bottom, clipped: !fit, text: (c.firstChild && c.firstChild.textContent || '').trim() }; });
          return { cl: cr.left, cr: cr.right, reg: rr ? { l: rr.left, r: rr.right, t: rr.top, b: rr.bottom } : null, chips, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; }))()`);
        const x = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5;
        r.forEach((card, ci) => {
          const at = "at " + width + " tile " + (ci + 1) + ": ";
          if (card.sw > card.cw + 0.5) bad.push(at + "the page scrolls sideways");
          for (const ch of card.chips) { if (ch.l < card.cl - 0.5 || ch.r > card.cr + 0.5) bad.push(at + "'" + ch.text + "' sticks out of the tile"); if (ch.clipped) bad.push(at + "'" + ch.text + "' is clipped"); }
          for (let i = 0; i < card.chips.length; i++) for (let j = i + 1; j < card.chips.length; j++) if (x(card.chips[i], card.chips[j])) bad.push(at + "'" + card.chips[i].text + "' overlaps '" + card.chips[j].text + "'");
          if (card.reg) for (const ch of card.chips) if (x({ l: card.reg.l, r: card.reg.r, t: card.reg.t, b: card.reg.b }, ch)) bad.push(at + "'" + ch.text + "' overlaps the Registered mark");
          if (!card.chips.some((ch) => /^10 (official|employer) links$/.test(ch.text))) bad.push(at + "the longest pill is not there");
        });
      });
    }
    return bad;
  },
  // the comments page recap draws the same pills from the same list the details lists
  async comments(root) {
    const bad = [], pair = [c(1, 1, true, true), c(2, 0, false, false)];
    await withSite(root, { linkCounts: pair, policyDetail: true }, 1280, async (tab, site) => {
      await runSearch(tab);
      const cards = await tab.eval(CARDS);
      await tab.goto(site.url + "/comments.html?ref=" + cards[0].ref); await tab.waitFor("!document.querySelector('#threadWrap').hidden", 8000); await sleep(500);
      const chips = await tab.eval(`Array.from(document.querySelectorAll('#recapChips .chip')).map((c) => (c.firstChild && c.firstChild.textContent || '').trim())`);
      for (const want of ["1 recruiter link", "1 official link"]) if (!chips.includes(want)) bad.push("the comments page recap lacks '" + want + "': " + JSON.stringify(chips));
      if (chips.indexOf("1 official link") !== chips.indexOf("1 recruiter link") + 1) bad.push("the recap pills are not side by side in the designed order: " + JSON.stringify(chips));
    });
    return bad;
  },
};

test("link pills: the words, the place, the icons, the sum equals the details window, counts only, every status, no counts invented, wrapping, the comments page recap", { timeout: 900000 }, async () => {
  const problems = [];
  for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](ROOT)) problems.push(n + ": " + p);
  assert.deepEqual(problems, [], "link pill problems:\n" + problems.join("\n"));
});

const LP = "js/link-pills.js", CH = "js/chips.js", CM = "js/pages/comments.js";
const DEFECTS = [
  ["singular written as a plural (1 official links)", ["states"], [[LP, (s) => s.replace('c.apply + (c.apply === 1 ? " official link" : " official links")', 'c.apply + " official links"')]]],
  ["the statement is ignored (never official)", ["states", "icons"], [[LP, (s) => s.replace("if (c.exclusive) return", "if (false) return")]]],
  ["the statement is inverted", ["states"], [[LP, (s) => s.replace("if (c.exclusive) return", "if (!c.exclusive) return")]]],
  ["zero is written as a number", ["states"], [[LP, (s) => s.replace('if (c.apply === 0) return { text: "No employer links" };', 'if (c.apply === 0) return { text: "0 employer links" };')]]],
  ["the number on the pill is one too many", ["states", "layout"], [[LP, (s) => s.replace('return { text: c.apply + (c.apply === 1 ? " employer link" : " employer links"), tooltip: TOOLTIP_EMPLOYER };', 'return { text: (c.apply + 1) + (c.apply === 1 ? " employer link" : " employer links"), tooltip: TOOLTIP_EMPLOYER };')]]],
  ["the recruiter pill counts firms while the switch is off", ["states"], [[LP, (s) => s.replace('if (!row || row.third_party_recruiter !== true) return { text: "No recruiter" };', 'if (!row) return { text: "No recruiter" };')]]],
  ["a recruiter involved with no firm named still says No recruiter", ["states", "absent"], [[LP, (s) => s.replace('return { text: "Recruiter involved" };', 'return { text: "No recruiter" };')]]],
  ["one recruiter firm written as a plural", ["states"], [[LP, (s) => s.replace('c.firms + (c.firms === 1 ? " recruiter link" : " recruiter links")', 'c.firms + " recruiter links"')]]],
  ["the application pill sits before the recruiter pill", ["states"], [[CH, (s) => s.replace("chips.push(recruiterChip(p));\n  const links = applicationLinksChip(p);", "const links = applicationLinksChip(p); if (links !== null) chips.push(links);\n  chips.push(recruiterChip(p));").replace("  if (links !== null) chips.push(links);\n  chips.push({ text: Number", "  chips.push({ text: Number")]]],
  ["the official tooltip is reworded", ["states", "icons"], [[LP, (s) => s.replace("The employer says these are the only places to apply for this opening. FightGhostJobs does not check that.", "These are the only places to apply for this opening.")]]],
  ["the employer links pill has no icon", ["states", "icons"], [[LP, (s) => s.replace('tooltip: TOOLTIP_EMPLOYER };\n}', '};\n}')]]],
  ["the recruiter pill gets an icon", ["states"], [[LP, (s) => s.replace('return { text: c.firms + (c.firms === 1 ? " recruiter link" : " recruiter links") };', 'return { text: c.firms + (c.firms === 1 ? " recruiter link" : " recruiter links"), tooltip: TOOLTIP_EMPLOYER };')]]],
  ["the address of a link is put on the pill", ["leak"], [[LP, (s) => s.replace('if (c.apply === 0) return { text: "No employer links" };', 'if (c.apply === 0) return { text: "No employer links" };\n  if (row.url) return { text: c.apply + " links: " + row.url };')]]],
  ["a firm address is put on the recruiter pill", ["leak"], [[LP, (s) => s.replace('return { text: c.firms + (c.firms === 1 ? " recruiter link" : " recruiter links") };', 'return { text: c.firms + " recruiter links " + (row.firm_url || "") };')]]],
  ["the tile asks for the one-time links", ["leak"], [["js/pages/search.js", (s) => s.replace("function renderCard(row) {", "function renderCard(row) {\n  api.candidateLinkIssue(row.posting_ref);")]]],
  ["a paused or expired opening loses the pill", ["statuses"], [[CH, (s) => s.replace("if (links !== null) chips.push(links);", "if (links !== null && p.status === \"live\") chips.push(links);")]]],
  ["an answer without counts says No employer links", ["absent"], [[LP, (s) => s.replace("if (c === null) return null;", 'if (c === null) return { text: "No employer links" };')]]],
  ["the policy link is counted by the comments page", ["comments"], [[LP, (s) => s.replace('apply_link_count: kinds.filter((k) => k === "apply").length,', 'apply_link_count: kinds.filter((k) => k !== "recruiter").length,')]]],
  ["the comments page does not draw the counts", ["comments"], [[CM, (s) => s.replace("postingChips(Object.assign({}, p, countsFromDetail(d.data)))", "postingChips(p)")]]],
  ["a pill is given a fixed width wider than a phone tile (it runs out of the tile)", ["layout"], [["styles.css", (s) => s.replace(".chip{background:var(--panel);padding:8px 12px;", ".chip{width:400px;flex-shrink:0;background:var(--panel);padding:8px 12px;")]]],
  ["two pills are drawn on top of each other", ["layout"], [["styles.css", (s) => s.replace(".chip{background:var(--panel);padding:8px 12px;", ".chip:nth-child(6){margin-left:-60px;margin-top:-6px}.chip{background:var(--panel);padding:8px 12px;")]]],
  ["the pill is made one word wider than the tile (no wrapping)", ["layout"], [[CH, (s) => s.replace("if (links !== null) chips.push(links);", "if (links !== null) chips.push(Object.assign({}, links, { text: links.text + \" \".repeat(1) + \"x\".repeat(60) }));")]]],
];
test("negative controls: each planted defect in the link pills makes a check fail", { timeout: 3600000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-linkpills-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8").replace(/\?v=[0-9a-f]{8}(?=["'])/g, ""), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      for (const n of scenarios) found.push(...(await SCENARIOS[n](dir)).map((x) => n + ": " + x));
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 170) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
