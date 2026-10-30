// lm-cleanup.test.js - the opening tile and the details window (prompt LM, October 23, 2026), in a real browser on the repo's own files with a fake backend (tests/fake-site.js; no real project, no key).
// Everything that fits is on the tile; the details window holds only the link rows and the recruiter firms; the two explanation paragraphs sit behind small "i" icons, word for word; the buttons follow the counts; an AI pill
// with the employer's words is a button that opens them as plain text; the AI hiring policy pill makes its one-time link only when pressed. Scenarios: moved (the paragraphs and where they are), boxes (the icons by mouse,
// keyboard and touch: open, Escape, close control, outside click, focus back, a box over the details window), buttons (the four kinds of row), ai (plain text only), policy (the link made on the press and never before),
// leak (no address or token on the tile, nothing made on load), layout (five widths, nothing clipped or overlapping, touch sizes), words. Then negative controls: one planted defect at a time; each must make a check fail.
// A missing browser FAILS the test (set FGJ_BROWSER).     Run: node --test tests/lm-cleanup.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
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

// the two paragraphs as they were before this prompt (the same pins as tests/lm-cleanup.unit.test.js; the words are NOT taken from the site's own module here)
const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
const P1 = { len: 263, sha: "0258b0df49f69751910a2933452a09e9b29148e2cd770e0e494f75357373ead7" };
const P2 = { len: 513, sha: "06889c31f446776d14031827f86da5944877d922dcfce14b1178f6260b8b22ef" };
const isP = (text, pin) => text.length === pin.len && sha(text) === pin.sha;
const NOTE_MARKUP = 'Our tool <b onmouseover="window.__pwned=1">ranks</b> resumes <a href="https://evil.example.invalid/x">here</a> <img src=x onerror="window.__pwned=1"> and www.evil.example.invalid';
const c = (apply, firms, exclusive, recruiter, extra) => ({ apply, firms, exclusive, recruiter, extra });
const DASH = new RegExp(String.fromCharCode(8212) + "|" + String.fromCharCode(8211));

async function openSearch(tab, site) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.goto(site.url + "/search.html");
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(500);
}
const fill = (tab, company, title) => tab.eval(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }; set("company", ${JSON.stringify(company)}); set("titleq", ${JSON.stringify(title)}); set("reqq", ""); })()`);
async function runSearch(tab) { await fill(tab, "Meridian", "analyst"); await tab.eval(`document.getElementById("searchBtn").focus()`); await tab.key("Enter"); await tab.waitFor(`!document.getElementById("recap").hidden`, 6000); await sleep(500); }
async function withSite(root, opts, width, fn) {
  const site = await startFakeSite(root, opts), tab = await browser.newTab();
  try { await tab.focusEmulation(true); const phone = width < 700; await tab.viewport(width, phone, phone ? 800 : 900); await openSearch(tab, site); await tab.viewport(width, phone, phone ? 800 : 900); await runSearch(tab); return await fn(tab, site); } finally { await tab.close(); await site.close(); }
}
// a real mouse click at the middle of the element, a tap, and a keyboard focus by Tab
const centre = (sel) => `(() => { const e = ${sel}; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`;
async function mouseClick(tab, sel) { const p = await tab.eval(centre(sel)); if (!p) return false; await tab.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 }); await tab.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 }); await sleep(250); return true; }
async function tap(tab, sel) { const p = await tab.eval(centre(sel)); if (!p) return false; await tab.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] }); await tab.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(300); return true; }
async function tabTo(tab, sel) { await tab.eval(`window.scrollTo(0, 0); document.activeElement && document.activeElement.blur(); document.body.focus()`); for (let n = 0; n < 120; n++) { await tab.key("Tab"); if (await tab.eval(`document.activeElement === (${sel})`)) return true; } return false; }

const CARD = (i) => `document.querySelectorAll('#results .card')[${i}]`;
const REG_ICON = (i) => `${CARD(i)}.querySelector('.reg-holder .info-icon')`;
const BOX = `(() => { const b = document.querySelector('.info-box'); if (!b) return null; const body = b.querySelector('.info-box-body'), title = b.querySelector('.info-box-title'), close = b.querySelector('.info-box-close'), r = b.getBoundingClientRect();
  const para = body.querySelector('p');
  return { pHtml: para ? para.innerHTML : null, role: b.getAttribute('role'), modal: b.getAttribute('aria-modal'), labelledby: b.getAttribute('aria-labelledby'), titleId: title && title.id, title: title && title.textContent, text: body.textContent, html: body.innerHTML, kids: body.children.length, links: body.querySelectorAll('a').length,
    closeLabel: close && close.getAttribute('aria-label'), closeSize: close ? [close.getBoundingClientRect().width, close.getBoundingClientRect().height] : null, rect: [r.left, r.top, r.right, r.bottom], vw: innerWidth, vh: innerHeight, inside: b.contains(document.activeElement) }; })()`;
const detailsOpen = `document.getElementById('modalBackdrop').classList.contains('open')`;
const activeIs = (sel) => `document.activeElement === (${sel})`;
async function openDetails(tab, i) { await tab.eval(`${CARD(i)}.querySelector('.view-details').click()`); await tab.waitFor(detailsOpen, 5000); await sleep(900); }
const MODAL = `(() => { const m = document.querySelector('#modalBackdrop .modal'); return { text: m.innerText, reg: (document.getElementById('modalRegistered').querySelector('.badge-verified') || {}).textContent || null, regIcon: !!document.getElementById('modalRegistered').querySelector('.info-icon'),
  headHidden: document.getElementById('modalLinksHead').hidden, head: (document.getElementById('modalLinksHead').querySelector('h3') || {}).textContent || '', headIcon: !!document.getElementById('modalLinksHead').querySelector('.info-icon'), rows: document.querySelectorAll('#modalLinks .source-row').length,
  policy: !document.getElementById('modalPolicy').hidden && document.querySelectorAll('#modalPolicy .source-row').length, more: document.getElementById('modalMore').innerText, paras: document.querySelectorAll('#modalBackdrop .modal p').length, intro: !!document.getElementById('modalIntro'), note: !!document.getElementById('modalLinksNote') }; })()`;

const SCENARIOS = {
  // the two paragraphs: gone from the details window, behind the icons, word for word
  async moved(root) {
    const bad = [], pair = [c(2, 0, false, false, { comment_count: 1 }), c(1, 0, true, false)];
    await withSite(root, { linkCounts: pair, registeredValues: [true, false] }, 1280, async (tab) => {
      const cards = await tab.eval(`Array.from(document.querySelectorAll('#results .card')).map((c) => ({ badge: !!c.querySelector('.badge-verified'), badgeText: (c.querySelector('.badge-verified') || {}).textContent || null, icon: !!c.querySelector('.reg-holder .info-icon'), text: c.innerText }))`);
      if (cards.length !== 2) { bad.push(cards.length + " tiles"); return; }
      if (!cards[0].badge || cards[0].badgeText !== "✓ Registered") bad.push("the Registered mark changed: " + JSON.stringify(cards[0].badgeText));
      if (cards[1].badge) bad.push("a tile that is not registered draws the mark");
      if (!cards[0].icon || !cards[1].icon) bad.push("a tile has no icon in the header: " + JSON.stringify(cards.map((x) => x.icon)));
      for (const t of cards.map((x) => x.text)) if (t.includes("This opening was added through FightGhostJobs")) bad.push("the first paragraph is on the tile itself");
      // the Registered icon of each tile opens the first paragraph, exactly
      for (const i of [0, 1]) {
        await mouseClick(tab, REG_ICON(i));
        const b = await tab.eval(BOX);
        if (!b) { bad.push("tile " + (i + 1) + ": the Registered icon opens nothing"); continue; }
        if (b.title !== "About this information") bad.push("tile " + (i + 1) + ": the box title is " + JSON.stringify(b.title));
        if (!isP(b.text, P1)) bad.push("tile " + (i + 1) + ": the first paragraph is not word for word what it was: " + JSON.stringify(b.text.slice(0, 80)));
        await tab.key("Escape"); await sleep(200);
      }
      // the details window: neither paragraph in its body; the Registered mark and the Links heading with their icons
      await openDetails(tab, 0);
      const m = await tab.eval(MODAL);
      if (m.intro || m.note || m.paras !== 0) bad.push("the details window still has a paragraph element (" + m.paras + ")");
      if (m.text.includes("This opening was added through") || m.text.includes("These links look unusual")) bad.push("a paragraph is still in the details window text");
      if (m.reg !== "✓ Registered" || !m.regIcon) bad.push("the details header lacks the Registered mark with its icon: " + JSON.stringify([m.reg, m.regIcon]));
      if (m.headHidden || m.head.trim() !== "Links" || !m.headIcon) bad.push("the Links heading with its icon is missing: " + JSON.stringify([m.headHidden, m.head, m.headIcon]));
      if (m.rows !== 2) bad.push("the details window lists " + m.rows + " rows (wanted 2)");
      if (!/Comments \(1\)/.test(m.more) || !/Report a wrong link/.test(m.more)) bad.push("the details window lacks its Comments and Report links: " + JSON.stringify(m.more));
      // the links icon opens the second paragraph with its bold phrase
      await mouseClick(tab, `document.getElementById('modalLinksHead').querySelector('.info-icon')`);
      const lb = await tab.eval(BOX);
      if (!lb) bad.push("the links icon opens nothing");
      else {
        if (lb.title !== "About these links") bad.push("the links box title is " + JSON.stringify(lb.title));
        if (lb.pHtml === null || !isP(lb.pHtml, P2)) bad.push("the one-time link paragraph is not word for word what it was: " + JSON.stringify((lb.pHtml || lb.html).slice(0, 90)));
        if (!/<strong>Report a wrong link<\/strong>/.test(lb.html)) bad.push("the bold phrase is lost");
      }
      await tab.key("Escape"); await sleep(250);
      if (!(await tab.eval(detailsOpen))) bad.push("Escape in the box closed the details window as well");
      await tab.key("Escape"); await sleep(250);
      if (await tab.eval(detailsOpen)) bad.push("a second Escape did not close the details window");
      // the Registered icon of the details header opens the first paragraph
      await openDetails(tab, 0);
      await mouseClick(tab, `document.getElementById('modalRegistered').querySelector('.info-icon')`);
      const rb = await tab.eval(BOX);
      if (!rb || !isP(rb.text, P1)) bad.push("the details header icon does not open the first paragraph");
      await tab.key("Escape"); await sleep(150); await tab.key("Escape"); await sleep(250);
    });
    return bad;
  },

  // the icons by mouse, keyboard and touch; Escape, the close control and a click outside; focus goes back; a box over the details window keeps its own Tab loop
  async boxes(root) {
    const bad = [], pair = [c(2, 0, false, false), c(0, 0, false, false)];
    for (const [width, phone] of [[1280, false], [375, true]]) {
      await withSite(root, { linkCounts: pair, registeredValues: [true, true] }, width, async (tab) => {
        const at = "at " + width + ": ";
        const icon = REG_ICON(0);
        const meta = await tab.eval(`(() => { const i = ${icon}; return { role: i.getAttribute('role'), label: i.getAttribute('aria-label'), pop: i.getAttribute('aria-haspopup'), tab: i.getAttribute('tabindex') }; })()`);
        if (meta.role !== "button" || meta.label !== "About this information" || meta.pop !== "dialog" || meta.tab !== "0") bad.push(at + "the Registered icon is not announced as a button that opens a dialog: " + JSON.stringify(meta));
        const modes = [["mouse", async () => mouseClick(tab, icon)], ["keyboard Enter", async () => { if (!(await tabTo(tab, icon))) return false; await tab.key("Enter"); await sleep(250); return true; }], ["keyboard Space", async () => { if (!(await tabTo(tab, icon))) return false; await tab.key(" "); await sleep(250); return true; }]];
        if (phone) modes.push(["touch", async () => tap(tab, icon)]);
        for (const [mode, opener] of modes) {
          const tag = at + mode + ": ";
          for (const closer of ["Escape", "the close control", "a click outside"]) {
            if (!(await opener())) { bad.push(tag + "could not reach the icon"); break; }
            const b = await tab.eval(BOX);
            if (!b) { bad.push(tag + "the box did not open"); break; }
            if (b.role !== "dialog" || b.modal !== "true" || !b.labelledby || b.labelledby !== b.titleId || !b.title) bad.push(tag + "the box is not a named modal dialog: " + JSON.stringify([b.role, b.modal, b.labelledby, b.titleId]));
            if (b.closeLabel !== "Close") bad.push(tag + "the close control has no name");
            if (!b.inside) bad.push(tag + "focus did not move into the box");
            if (!(await tab.eval(`document.documentElement.style.overflow === 'hidden'`))) bad.push(tag + "the page behind the box can still scroll");
            await tab.key("Tab");
            if (!(await tab.eval(`document.activeElement === document.querySelector('.info-box-close')`))) bad.push(tag + "the first Tab did not go to the close control");
            if (b.rect[0] < -0.5 || b.rect[2] > b.vw + 0.5 || b.rect[1] < -0.5 || b.rect[3] > b.vh + 0.5) bad.push(tag + "the box runs off the screen: " + JSON.stringify(b.rect));
            if (phone && (b.closeSize[0] < 43.5 || b.closeSize[1] < 43.5)) bad.push(tag + "the close control is smaller than 44 by 44 on a phone: " + JSON.stringify(b.closeSize));
            // Tab stays in the box
            for (let n = 0; n < 4; n++) await tab.key("Tab");
            if (!(await tab.eval(BOX)).inside) bad.push(tag + "Tab left the box");
            if (closer === "Escape") await tab.key("Escape");
            else if (closer === "the close control") await mouseClick(tab, `document.querySelector('.info-box-close')`);
            else await tab.eval(`document.querySelector('.info-box-backdrop').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
            await sleep(250);
            if (await tab.eval(BOX)) { bad.push(tag + "the box did not close with " + closer); await tab.key("Escape"); continue; }
            if (!(await tab.eval(activeIs(icon)))) bad.push(tag + "focus did not return to the icon after " + closer);
            if (await tab.eval(`document.querySelectorAll('[inert]').length`)) bad.push(tag + "the page is still inert after " + closer);
            if (await tab.eval(`document.documentElement.style.overflow === 'hidden'`)) bad.push(tag + "the page scroll is still locked after " + closer);
          }
        }
        // a box over the details window: Tab stays in the box, the window under it does not pull focus, closing returns focus to the icon in the window
        await openDetails(tab, 0);
        const linksIcon = `document.getElementById('modalLinksHead').querySelector('.info-icon')`;
        if (!(await tabTo(tab, linksIcon))) bad.push(at + "could not Tab to the links icon in the details window");
        else {
          await tab.key("Enter"); await sleep(300);
          await tab.key("Tab");
          if (!(await tab.eval(`document.activeElement === document.querySelector('.info-box-close')`))) bad.push(at + "over the details window: the first Tab did not go to the close control of the box");
          for (let n = 0; n < 5; n++) await tab.key("Tab");
          if (!(await tab.eval(BOX)).inside) bad.push(at + "over the details window: Tab left the box");
          await tab.key("Escape"); await sleep(250);
          if (!(await tab.eval(activeIs(linksIcon)))) bad.push(at + "over the details window: focus did not return to the links icon");
          if (!(await tab.eval(detailsOpen))) bad.push(at + "over the details window: Escape closed the window too");
        }
        await tab.key("Escape"); await sleep(250);
        if (!(await tab.eval(activeIs(`${CARD(0)}.querySelector('.view-details')`)))) bad.push(at + "after the details window closed, focus is not on View links");
      });
    }
    return bad;
  },

  // the four kinds of row
  async buttons(root) {
    const bad = [];
    // links and no links, with counts
    await withSite(root, { linkCounts: [c(2, 0, false, false, { comment_count: 1 }), c(0, 0, false, false, { comment_count: 0 })], registeredValues: [true, true], commentsTotal: 1 }, 1280, async (tab, site) => {
      const s = await tab.eval(`Array.from(document.querySelectorAll('#results .card')).map((c) => { const v = c.querySelector('.view-details'), cm = c.querySelector('.tile-comments'), cmm = c.querySelector('.tile-comments-main'), r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
        return { ref: c.getAttribute('data-ref'), view: v ? v.textContent : null, comments: cm ? cm.textContent : null, href: cm ? cm.getAttribute('href') : cmm ? cmm.getAttribute('href') : null, main: cmm ? cmm.textContent : null, mainTag: cmm ? cmm.tagName : null, mainClass: cmm ? cmm.className : null, vr: r(v), mr: r(cmm), text: c.innerText }; })`);
      if (s.length !== 2) { bad.push(s.length + " tiles"); return; }
      if (s[0].view !== "View links" || s[0].comments !== "Comments (1)" || s[0].main !== null) bad.push("a tile with links: " + JSON.stringify([s[0].view, s[0].comments, s[0].main]));
      if (s[0].href !== "comments.html?ref=" + s[0].ref) bad.push("the Comments link goes to " + s[0].href);
      if (s[1].view !== null || s[1].comments !== null || s[1].main !== "Comments (0)" || s[1].mainTag !== "A") bad.push("a tile with no links: " + JSON.stringify([s[1].view, s[1].comments, s[1].main, s[1].mainTag]));
      if (s[1].href !== "comments.html?ref=" + s[1].ref) bad.push("the main Comments button goes to " + s[1].href);
      if (/View opening details|View links/.test(s[1].text)) bad.push("a tile with no links still offers a details window");
      if (s[0].vr && s[1].mr && Math.abs((s[0].vr[3] - s[0].vr[1]) - (s[1].mr[3] - s[1].mr[1])) > 1.5) bad.push("the main Comments button is not the size of the main button: " + JSON.stringify([s[0].vr, s[1].mr]));
      if (!/btn/.test(s[1].mainClass || "")) bad.push("the main Comments button is not styled as the main button");
      // View links opens the window; the Comments link opens the SAME comments page the window links to, and shows the same number
      await openDetails(tab, 0);
      const m = await tab.eval(MODAL);
      if (!/Comments \(1\)/.test(m.more)) bad.push("the details window says " + JSON.stringify(m.more));
      const winHref = await tab.eval(`document.getElementById('modalMore').querySelector('a').getAttribute('href')`);
      if (winHref !== s[0].href) bad.push("the details window links to " + winHref + " but the tile to " + s[0].href);
      await tab.key("Escape"); await sleep(250);
      await mouseClick(tab, `${CARD(0)}.querySelector('.tile-comments')`);
      await tab.waitFor("location.pathname.indexOf('comments.html') >= 0 && !document.querySelector('#threadWrap').hidden && /Comments \\(/.test(document.getElementById('threadHead').textContent)", 8000); await sleep(300);
      const page =await tab.eval(`({ ref: new URLSearchParams(location.search).get('ref'), head: document.getElementById('threadHead').textContent, company: document.getElementById('recapCompany').textContent })`);
      if (page.ref !== s[0].ref) bad.push("the comments page opened for " + page.ref + " (wanted " + s[0].ref + ")");
      if (page.head !== "Comments (1)") bad.push("the comments page heading is " + JSON.stringify(page.head) + " (the tile said 1)");
      if (site.calls.some((x) => x.name === "candidate-link-issue")) bad.push("opening the comments made a one-time link");
      await tab.goto(site.url + "/search.html"); await tab.waitFor("!!document.querySelector('#company')"); await sleep(300);
    });
    // the zero-link tile's main button opens its comments page
    await withSite(root, { linkCounts: [c(1, 0, false, false), c(0, 0, false, false, { comment_count: 0 })] }, 1280, async (tab, site) => {
      await mouseClick(tab, `${CARD(1)}.querySelector('.tile-comments-main')`);
      await tab.waitFor("location.pathname.indexOf('comments.html') >= 0 && !document.querySelector('#threadWrap').hidden", 8000); await sleep(400);
      const ref = await tab.eval("new URLSearchParams(location.search).get('ref')");
      if (!/^[0-9a-z]{20}$/.test(ref || "")) bad.push("the main Comments button opened nothing sensible: " + ref);
      if (site.calls.some((x) => x.name === "candidate-link-issue")) bad.push("opening the comments of a tile with no links made a one-time link");
    });
    // named recruiter firms alone are enough; a row with counts but no comment count says Comments without a number
    await withSite(root, { linkCounts: [c(0, 2, false, true, { comment_count: 4 }), c(1, 0, false, false)] }, 1280, async (tab) => {
      const s = await tab.eval(`Array.from(document.querySelectorAll('#results .card')).map((c) => ({ view: (c.querySelector('.view-details') || {}).textContent || null, comments: (c.querySelector('.tile-comments') || {}).textContent || null }))`);
      if (s[0].view !== "View links" || s[0].comments !== "Comments (4)") bad.push("firms only: " + JSON.stringify(s[0]));
      if (s[1].comments !== "Comments") bad.push("a row without a comment count says " + JSON.stringify(s[1].comments) + " (wanted Comments)");
      await openDetails(tab, 0);
      const m = await tab.eval(MODAL);
      if (m.rows !== 2) bad.push("firms only: the window lists " + m.rows + " rows");
    });
    // no counts at all (an answer from before the database change): the tile is what it always was
    await withSite(root, {}, 1280, async (tab) => {
      const s = await tab.eval(`Array.from(document.querySelectorAll('#results .card')).map((c) => ({ view: (c.querySelector('.view-details') || {}).textContent || null, comments: !!c.querySelector('.tile-comments, .tile-comments-main') }))`);
      for (const x of s) if (x.view !== "View opening details" || x.comments) bad.push("a row without counts: " + JSON.stringify(x));
      await openDetails(tab, 0);
      const m = await tab.eval(MODAL);
      if (m.intro || m.note || m.paras !== 0) bad.push("the details window of a row without counts still has a paragraph");
      if (m.rows !== 2) bad.push("the details window of a row without counts lists " + m.rows);
    });
    return bad;
  },

  // an AI pill with the employer's words is a button that opens them as plain text; without words it is plain text with no icon
  async ai(root) {
    const bad = [], extra0 = { ai_filtering: true, ai_filtering_note: NOTE_MARKUP, ai_interview_other: false }, extra1 = { ai_filtering: false, ai_filtering_note: "left over words", ai_interview_other: true, ai_interview_note: null };
    for (const [width, phone] of [[1280, false], [375, true]]) {
      await withSite(root, { linkCounts: [c(1, 0, false, false, extra0), c(1, 0, false, false, extra1)] }, width, async (tab) => {
        const at = "at " + width + ": ";
        const pills = await tab.eval(`Array.from(document.querySelectorAll('#results .card')).map((card) => Array.from(card.querySelectorAll('.chip')).filter((p) => /AI/.test(p.textContent)).map((p) => ({ text: (p.firstChild && p.firstChild.textContent || '').trim(), tag: p.tagName, pop: p.getAttribute('aria-haspopup'), icon: !!p.querySelector('.info-icon'), iconHidden: p.querySelector('.info-icon') ? p.querySelector('.info-icon').getAttribute('aria-hidden') : null, tip: !!p.querySelector('.info-tooltip'), tabbable: p.tagName === 'BUTTON' })))`);
        const f = pills[0].find((p) => p.text === "AI-assisted filtering"), i0 = pills[0].find((p) => /interview/i.test(p.text)), i1 = pills[1].find((p) => /interview/i.test(p.text)), f1 = pills[1].find((p) => /filtering/i.test(p.text));
        if (!f || f.tag !== "BUTTON" || f.pop !== "dialog" || !f.icon || f.iconHidden !== "true" || f.tip) bad.push(at + "the AI filtering pill with words is not a button with a plain small i: " + JSON.stringify(f));
        for (const [name, p] of [["No AI interview pill (no words)", i0], ["AI interview pill (no words)", i1], ["No AI filtering pill (leftover words under a toggle that is off)", f1]]) if (!p || p.tag !== "DIV" || p.icon || p.tip || p.pop) bad.push(at + name + " is not plain text with no icon: " + JSON.stringify(p));
        const inline = await tab.eval(`Array.from(document.querySelectorAll('#results .ai-note')).map((n) => n.textContent)`);
        if (inline.some((t) => /employer's words|left over words|ranks/.test(t))) bad.push(at + "the employer's words are still printed on the tile: " + JSON.stringify(inline));
        const pill = `${CARD(0)}.querySelector('.chip-button')`;
        const modes = [["mouse", async () => mouseClick(tab, pill)], ["keyboard Enter", async () => { if (!(await tabTo(tab, pill))) return false; await tab.key("Enter"); await sleep(250); return true; }], ["keyboard Space", async () => { if (!(await tabTo(tab, pill))) return false; await tab.key(" "); await sleep(250); return true; }]];
        if (phone) modes.push(["touch", async () => tap(tab, pill)]);
        for (const [mode, opener] of modes) {
          const tag = at + mode + ": ";
          await tab.eval("window.__pwned = 0");
          if (!(await opener())) { bad.push(tag + "could not reach the AI pill"); continue; }
          const b = await tab.eval(BOX);
          if (!b) { bad.push(tag + "the pill opened nothing"); continue; }
          if (b.title !== "AI filtering, in the employer's words") bad.push(tag + "the box title is " + JSON.stringify(b.title));
          if (b.text !== NOTE_MARKUP) bad.push(tag + "the box does not show the employer's words exactly as typed: " + JSON.stringify(b.text.slice(0, 80)));
          if (b.kids !== 0 || b.links !== 0) bad.push(tag + "the words became markup or a link (" + b.kids + " elements, " + b.links + " links)");
          if (await tab.eval("window.__pwned")) bad.push(tag + "the employer's words ran as script");
          if (await tab.eval(`document.querySelectorAll('a[href*="evil.example"], img[src="x"]').length`)) bad.push(tag + "a web address in the words became a link or an image on the page");
          await tab.key("Escape"); await sleep(250);
          if (await tab.eval(BOX)) bad.push(tag + "Escape did not close the box");
          if (!(await tab.eval(activeIs(pill)))) bad.push(tag + "focus did not return to the pill");
        }
      });
    }
    return bad;
  },

  // the AI hiring policy pill: the one-time link is made when it is pressed, never before; the policy row leaves the details window only when the pill is there
  async policy(root) {
    const bad = [], POLICY_URL = "https://go.example.invalid/f/policy-1";
    await withSite(root, { linkCounts: [c(1, 0, false, false, { has_policy_link: true, comment_count: 0 }), c(1, 0, false, false)], policyDetail: true }, 1280, async (tab, site) => {
      const names0 = site.calls.map((x) => x.name);
      if (names0.includes("candidate-link-issue") || names0.includes("candidate-posting-detail")) bad.push("the search made more than the search: " + JSON.stringify(names0));
      const chips = await tab.eval(`Array.from(document.querySelectorAll('#results .card')).map((c) => Array.from(c.querySelectorAll('.chip')).map((p) => (p.firstChild && p.firstChild.textContent || '').trim()))`);
      if (!chips[0].includes("AI hiring policy")) bad.push("the flagged tile has no AI hiring policy pill: " + JSON.stringify(chips[0]));
      if (chips[1].includes("AI hiring policy")) bad.push("a tile without the flag has the pill");
      const html0 = await tab.eval("document.documentElement.outerHTML");
      if (/go\.example|policy-1|https?:\/\/(?!stage\.fightghostjobs|127\.0\.0\.1|localhost)/i.test(html0.replace(/https:\/\/www\.fightghostjobs\.com\/privacy\.html/g, "").replace(/https?:\/\/(127\.0\.0\.1|localhost)[:0-9]*/g, ""))) bad.push("an address is somewhere in the page before the pill is pressed");
      await tab.eval("window.__opened = []; window.open = (...a) => { window.__opened.push(a); return {}; };");
      const pill = `Array.from(${CARD(0)}.querySelectorAll('.chip-button')).find((p) => /AI hiring policy/.test(p.textContent))`;
      if ((await tab.eval(`${pill}.getAttribute('aria-haspopup')`)) !== null) bad.push("the policy pill says it opens a dialog (it opens a new tab)");
      if (!/opens in a new tab/.test(await tab.eval(`${pill}.textContent`))) bad.push("the policy pill does not tell a screen reader it opens a new tab");
      await mouseClick(tab, pill); await sleep(500);
      const issued = site.calls.filter((x) => x.name === "candidate-link-issue");
      if (issued.length !== 1) bad.push("pressing the pill made " + issued.length + " one-time link requests (wanted 1)");
      const opened = await tab.eval("window.__opened");
      if (opened.length !== 1 || opened[0][0] !== POLICY_URL || opened[0][1] !== "_blank" || opened[0][2] !== "noopener,noreferrer") bad.push("the pill opened " + JSON.stringify(opened));
      if (site.calls.some((x) => x.name === "candidate-posting-detail")) bad.push("pressing the pill asked for the details");
      // a browser that holds the new tab back: the pill becomes a real link to the address it was given
      await sleep(4300);
      await tab.eval("window.open = () => null;");
      await mouseClick(tab, `Array.from(${CARD(0)}.querySelectorAll('.chip-button')).find((p) => /AI hiring policy/.test(p.textContent))`); await sleep(500);
      const a = await tab.eval(`(() => { const l = Array.from(${CARD(0)}.querySelectorAll('a.chip-button')).find((p) => /AI hiring policy/.test(p.textContent)); return l ? [l.getAttribute('href'), l.getAttribute('target'), l.getAttribute('rel')] : null; })()`);
      if (!a || a[0] !== POLICY_URL || a[1] !== "_blank" || !/noopener/.test(a[2] || "")) bad.push("a held back tab does not leave a real link: " + JSON.stringify(a));
      // the details window of the flagged tile has no policy row; the window of the tile without the flag still has it (and the Links heading)
      await tab.goto(site.url + "/search.html"); await tab.waitFor("!!document.querySelector('#company')"); await sleep(300); await runSearch(tab);
      await openDetails(tab, 0); const m0 = await tab.eval(MODAL); await tab.key("Escape"); await sleep(250);
      if (m0.policy) bad.push("the details window of a tile with the pill still lists the policy link");
      if (m0.rows !== 1) bad.push("the window lists " + m0.rows + " application rows (wanted 1)");
      await openDetails(tab, 1); const m1 = await tab.eval(MODAL); await tab.key("Escape"); await sleep(250);
      if (!m1.policy) bad.push("a tile without the flag lost its policy row in the details window");
      if (m1.headHidden) bad.push("the Links heading is missing when the policy row is listed");
    });
    // an answer without counts whose details list only the policy link: the row is listed (the tile has no pill to reach it) and so is the Links heading with its icon
    await withSite(root, { policyDetail: "only" }, 1280, async (tab) => {
      await openDetails(tab, 0); const m = await tab.eval(MODAL); await tab.key("Escape"); await sleep(250);
      if (!m.policy) bad.push("with only a policy link the details window does not list it");
      if (m.headHidden || !m.headIcon) bad.push("with only a policy row the Links heading and its icon are missing: " + JSON.stringify([m.headHidden, m.headIcon]));
    });
    // an opening that has only the policy pill: no details window, the Comments button is the main one
    await withSite(root, { linkCounts: [c(0, 0, false, false, { has_policy_link: true, comment_count: 2 }), c(0, 0, false, false)], policyDetail: "only" }, 1280, async (tab) => {
      const s = await tab.eval(`Array.from(document.querySelectorAll('#results .card')).map((c) => ({ view: !!c.querySelector('.view-details'), main: (c.querySelector('.tile-comments-main') || {}).textContent || null, pill: Array.from(c.querySelectorAll('.chip')).some((p) => /AI hiring policy/.test(p.textContent)) }))`);
      if (s[0].view || s[0].main !== "Comments (2)" || !s[0].pill) bad.push("an opening with only a policy link: " + JSON.stringify(s[0]));
    });
    return bad;
  },

  // counts and flags only: nothing the tile is given can put an address or a token on the page, and nothing is made on load
  async leak(root) {
    const bad = [], extra = { url: "https://leak.example.invalid/apply?t=SECRET", go_url: "https://go.example.invalid/f/SECRET", firm_url: "https://firm.example.invalid/SECRET", token: "tok_SECRET", label: "SECRET label", has_policy_link: true, comment_count: 3 };
    await withSite(root, { linkCounts: [c(2, 1, true, true, extra), c(0, 0, false, false, extra)], policyDetail: true }, 1280, async (tab, site) => {
      const cards = await tab.eval(`Array.from(document.querySelectorAll('#results .card')).map((c) => c.outerHTML + ' ' + c.innerText)`), all = await tab.eval("document.documentElement.outerHTML");
      if (cards.length !== 2) { bad.push(cards.length + " tiles"); return; }
      for (const t of cards) if (/SECRET|leak\.example|go\.example|firm\.example|https?:\/\//i.test(t)) bad.push("an address or token is on a tile: " + (/(SECRET|leak\.example|go\.example|firm\.example|https?:\/\/)/i.exec(t) || [])[0]);
      if (/SECRET|leak\.example|go\.example|firm\.example/i.test(all)) bad.push("an address or token is somewhere in the page");
      const names = site.calls.map((x) => x.name);
      if (names.includes("candidate-link-issue") || names.includes("candidate-posting-detail")) bad.push("the search called more than the search: " + JSON.stringify(names));
      if (!cards[0].includes("Comments (3)")) bad.push("the numbers did not arrive");
    });
    return bad;
  },

  // five widths: nothing clipped, nothing on top of anything, nothing sticking out, no sideways scroll; touch sizes; the boxes inside the screen
  async layout(root) {
    const bad = [], extra = { comment_count: 12, has_policy_link: true, ai_filtering: true, ai_filtering_note: "An employer note", ai_interview_other: true, ai_interview_note: "Another employer note" };
    for (const width of [1280, 1000, 768, 375, 320]) {
      const phone = width < 700;
      await withSite(root, { linkCounts: [c(10, 3, true, true, extra), c(0, 0, false, false, { comment_count: 0 })], registeredValues: [true, true] }, width, async (tab) => {
        const r = await tab.eval(`(() => Array.from(document.querySelectorAll('#results .card')).map((card) => { const R = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; }, cr = R(card);
          const chips = Array.from(card.querySelectorAll('.chip')).map((c) => { const b = R(c); const tn = c.firstChild; let fit = true; if (tn && tn.nodeType === 3) { const rg = document.createRange(); rg.selectNodeContents(tn); const tr = rg.getBoundingClientRect(); fit = tr.left >= b.l - 0.5 && tr.right <= b.r + 0.5 && tr.height <= b.h + 0.5; } return Object.assign(b, { clipped: !fit, text: (c.firstChild && c.firstChild.textContent || '').trim() }); });
          const holder = R(card.querySelector('.reg-holder')), actions = Array.from(card.querySelectorAll('.tile-actions > *')).map((e) => Object.assign(R(e), { text: e.textContent.trim() }));
          const icon = card.querySelector('.reg-holder .info-icon'), cm = card.querySelector('.tile-comments'), chipBtn = card.querySelector('.chip-button');
          return { cr, chips, holder, actions, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, iconBefore: icon ? getComputedStyle(icon, '::before').top : null, cmH: cm ? cm.getBoundingClientRect().height : null, chipBefore: chipBtn ? getComputedStyle(chipBtn, '::before').top : null }; }))()`);
        const x = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5;
        r.forEach((card, ci) => {
          const at = "at " + width + " tile " + (ci + 1) + ": ";
          if (card.sw > card.cw + 0.5) bad.push(at + "the page scrolls sideways");
          for (const ch of card.chips) { if (ch.l < card.cr.l - 0.5 || ch.r > card.cr.r + 0.5) bad.push(at + "'" + ch.text + "' sticks out of the tile"); if (ch.clipped) bad.push(at + "'" + ch.text + "' is clipped"); }
          for (let i = 0; i < card.chips.length; i++) for (let j = i + 1; j < card.chips.length; j++) if (x(card.chips[i], card.chips[j])) bad.push(at + "'" + card.chips[i].text + "' overlaps '" + card.chips[j].text + "'");
          for (const ch of card.chips) if (x(card.holder, ch)) bad.push(at + "'" + ch.text + "' overlaps the Registered mark and its icon");
          if (card.holder.l < card.cr.l - 0.5 || card.holder.r > card.cr.r + 0.5) bad.push(at + "the Registered mark and its icon stick out of the tile");
          for (let i = 0; i < card.actions.length; i++) { const a = card.actions[i]; if (a.l < card.cr.l - 0.5 || a.r > card.cr.r + 0.5) bad.push(at + "'" + a.text + "' sticks out of the tile"); for (let j = i + 1; j < card.actions.length; j++) if (x(a, card.actions[j])) bad.push(at + "'" + a.text + "' overlaps '" + card.actions[j].text + "'"); }
          if (!card.actions.length) bad.push(at + "the tile has no buttons");
          if (phone) { if (card.iconBefore !== "-15px") bad.push(at + "the info icon's touch area is not the phone size: " + card.iconBefore); if (card.cmH !== null && card.cmH < 43.5) bad.push(at + "the Comments link is " + card.cmH + " high (wanted 44 on a phone)"); const main = card.actions.find((a) => /Comments|View links/.test(a.text)); if (main && main.h < 43.5) bad.push(at + "'" + main.text + "' is " + main.h + " high on a phone"); if (card.chipBefore !== null && card.chipBefore !== "-6px") bad.push(at + "the AI pill button's touch area is " + card.chipBefore); }
        });
        // the boxes and the details window inside the screen
        await mouseClick(tab, REG_ICON(0));
        const b = await tab.eval(BOX);
        if (!b) bad.push("at " + width + ": the Registered box did not open");
        else if (b.rect[0] < -0.5 || b.rect[2] > b.vw + 0.5 || b.rect[3] > b.vh + 0.5) bad.push("at " + width + ": the Registered box runs off the screen " + JSON.stringify(b.rect));
        await tab.key("Escape"); await sleep(200);
        await openDetails(tab, 0);
        const m = await tab.eval(`(() => { const md = document.querySelector('#modalBackdrop .modal'), r = md.getBoundingClientRect(), reg = document.getElementById('modalRegistered').getBoundingClientRect(), cl = document.getElementById('modalClose').getBoundingClientRect(); return { l: r.left, r: r.right, sw: md.scrollWidth, cw: md.clientWidth, regR: reg.right, regB: reg.bottom, clL: cl.left, clT: cl.top, clB: cl.bottom, vw: innerWidth }; })()`);
        if (m.sw > m.cw + 0.5) bad.push("at " + width + ": the details window scrolls sideways");
        if (m.l < -0.5 || m.r > m.vw + 0.5) bad.push("at " + width + ": the details window runs off the screen");
        await tab.key("Escape"); await sleep(200);
      });
    }
    return bad;
  },

  // the words a person reads in the new boxes, titles and buttons: no dash, nothing verified, Registered is still Registered
  async words(root) {
    const bad = [];
    await withSite(root, { linkCounts: [c(2, 0, false, false, { comment_count: 1, has_policy_link: true, ai_filtering: true, ai_filtering_note: "A plain note" }), c(0, 0, false, false, { comment_count: 0 })], registeredValues: [true, false], policyDetail: true }, 1280, async (tab) => {
      const seen = [];
      seen.push(await tab.eval("document.getElementById('results').innerText"));
      await mouseClick(tab, REG_ICON(0)); seen.push((await tab.eval(BOX)).text, (await tab.eval(BOX)).title); await tab.key("Escape"); await sleep(200);
      await mouseClick(tab, `${CARD(0)}.querySelector('.chip-button')`); seen.push((await tab.eval(BOX)).text, (await tab.eval(BOX)).title); await tab.key("Escape"); await sleep(200);
      await openDetails(tab, 0); seen.push((await tab.eval(MODAL)).text);
      await mouseClick(tab, `document.getElementById('modalLinksHead').querySelector('.info-icon')`); seen.push((await tab.eval(BOX)).text, (await tab.eval(BOX)).title);
      for (const t of seen) { if (DASH.test(t)) bad.push("a dash in: " + t.slice(0, 80)); if (/verif/i.test(t)) bad.push("the word verified in: " + t.slice(0, 80)); }
      await tab.key("Escape"); await sleep(150); await tab.key("Escape"); await sleep(200);
      if (!/Registered/.test(seen[0]) || /Listed/.test(seen[0])) bad.push("the Registered label changed");
    });
    return bad;
  },
};

test("tile and details: paragraphs moved word for word, icons by mouse keyboard and touch, buttons by the counts, AI words as plain text, policy link only on a press, nothing leaked, five widths", { timeout: 1800000 }, async () => {
  const problems = [];
  for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](ROOT)) problems.push(n + ": " + p);
  assert.deepEqual(problems, [], "tile problems:\n" + problems.join("\n"));
});

const SJ = "js/pages/search.js", IB = "js/info-box.js", TA = "js/tile-actions.js", CH = "js/chips.js", DOM = "js/dom.js", AT = "js/about-text.js", DF = "js/dialog-focus.js", CSS = "app.css";
const DEFECTS = [
  ["the first paragraph is reworded", ["moved"], [[AT, (s) => s.replace("The dates and disclosures are the employer's own.", "The dates and disclosures are the employer's own words.")]]],
  ["the one-time link paragraph is reworded", ["moved"], [[AT, (s) => s.replace("on purpose:", "by design:")]]],
  ["the first paragraph is left in the details window as well", ["moved"], [[SJ, (s) => s.replace('const head = $("#modalLinksHead");', 'const head = $("#modalLinksHead"); reg.after(h("p", {}, ABOUT_TEXT));')]]],
  ["the one-time link paragraph is left in the details window as well", ["moved"], [[SJ, (s) => s.replace('m.head.hidden = false; }', 'm.head.hidden = false; m.head.after(h("p", {}, LINKS_ABOUT_BEFORE)); }')]]],
  ["the tile loses the Registered icon", ["moved", "boxes"], [[SJ, (s) => s.replace('h("div", { class: "reg-holder" }, registeredMark(row), aboutIcon())', 'h("div", { class: "reg-holder" }, registeredMark(row))')]]],
  ["the details header loses the Registered icon", ["moved"], [[SJ, (s) => s.replace("reg.append(...[registeredMark(row), aboutIcon()].filter(Boolean));", "reg.append(...[registeredMark(row)].filter(Boolean));")]]],
  ["the Links heading has no icon", ["moved", "boxes"], [[SJ, (s) => s.replace("h(\"h3\", { class: \"links-heading\" }, LINKS_HEADING), linksAboutIcon()", "h(\"h3\", { class: \"links-heading\" }, LINKS_HEADING)")]]],
  ["focus does not go back to the icon", ["boxes"], [[IB, (s) => s.replace("trapFocus({ doc, dialog, backdrop, opener, fallback: null })", "trapFocus({ doc, dialog, backdrop, opener: null, fallback: null })")]]],
  ["Escape does not close the box", ["boxes", "moved"], [[IB, (s) => s.replace('ev.key === "Escape"', 'ev.key === "Esc"')]]],
  ["Escape also closes the details window under the box", ["moved", "boxes"], [[IB, (s) => s.replace("ev.stopPropagation(); close();", "close();")]]],
  ["the close control does nothing", ["boxes"], [[IB, (s) => s.replace('closeBtn.addEventListener("click", close);', "")]]],
  ["a click outside does not close the box", ["boxes"], [[IB, (s) => s.replace("if (ev.target === backdrop) close();", "")]]],
  ["the icon cannot be reached by keyboard", ["boxes"], [[IB, (s) => s.replace('tabindex: "0", role: "button"', 'role: "button"')]]],
  ["the icon is not announced as a button", ["boxes"], [[IB, (s) => s.replace('role: "button", "aria-label"', '"aria-label"')]]],
  ["the box is not a dialog", ["boxes"], [[IB, (s) => s.replace('role: "dialog"', 'role: "group"')]]],
  ["the box has no title for a screen reader", ["boxes"], [[IB, (s) => s.replace('"aria-labelledby": titleId', '"data-x": titleId')]]],
  ["the page behind stays scrollable", ["boxes"], [[IB, (s) => s.replace("const unlock = lockScroll(doc, win);", "const unlock = () => {};")]]],
  ["a box over the details window loses its Tab loop (windows no longer stack)", ["boxes"], [[DF, (s) => s.replace("stack[stack.length - 1] !== token", "false")]]],
  ["the details window exists with nothing in it", ["buttons"], [[TA, (s) => s.replace("c.apply > 0 || c.firms > 0", "true")]]],
  ["named recruiter firms alone get no details window", ["buttons"], [[TA, (s) => s.replace("c.apply > 0 || c.firms > 0", "c.apply > 0")]]],
  ["the comment count is wrong", ["buttons", "leak"], [[TA, (s) => s.replace('return n === null ? "Comments" : "Comments (" + n + ")";', 'return n === null ? "Comments" : "Comments (" + (n + 1) + ")";')]]],
  ["the Comments link goes to another place", ["buttons"], [[TA, (s) => s.replace('"comments.html?ref=" + encodeURIComponent(row.posting_ref)', '"comments.html"')]]],
  ["the main Comments button is not styled as the main button", ["buttons", "layout"], [[SJ, (s) => s.replace('class: "btn btn-outline tile-comments-main"', 'class: "tile-comments-main"')]]],
  ["a row without counts loses the old button text", ["buttons"], [[TA, (s) => s.replace('export const LEGACY_DETAILS = "View opening details";', 'export const LEGACY_DETAILS = "View links";')]]],
  ["the tile carries an address", ["leak", "policy"], [[SJ, (s) => s.replace('h("div", { class: "card", "data-ref": row.posting_ref },', 'h("div", { class: "card", "data-ref": row.posting_ref, title: row.go_url || row.url || row.token },')]]],
  ["the tile asks for a one-time link when it is drawn", ["leak", "policy"], [[SJ, (s) => s.replace("function renderCard(row) {", "function renderCard(row) {\n  api.candidateLinkIssue(row.posting_ref);")]]],
  ["the tile asks for the details when it is drawn", ["leak", "policy"], [[SJ, (s) => s.replace("function renderCard(row) {", "function renderCard(row) {\n  api.candidateDetail(row.posting_ref);")]]],
  ["the employer's words are shown as markup", ["ai"], [[SJ, (s) => s.replace("nodes: [spec.note.text], opener: btn", "nodes: [(() => { const d = document.createElement('div'); d.innerHTML = spec.note.text; return d; })()], opener: btn")]]],
  ["an AI pill without words keeps a tooltip icon", ["ai"], [[CH, (s) => s.replace(": { text: spec.text };\n}", ": { text: spec.text, tooltip: TOOLTIP_FILTERING };\n}")]]],
  ["an AI pill with words is not a button", ["ai", "policy"], [[DOM, (s) => s.replace('typeof spec.press === "function"', 'typeof spec.pressX === "function"')]]],
  ["the employer's words are printed on the tile as well", ["ai"], [[SJ, (s) => s.replace("    buttons.length ?", "    ...postingChips(row).slice(0, 0), h(\"div\", { class: \"ai-note\" }, (row.ai_filtering_note || \"\")),\n    buttons.length ?")]]],
  ["the policy link is made when the results load", ["policy"], [[SJ, (s) => s.replace("function renderCard(row) {", "function renderCard(row) {\n  if (row.has_policy_link === true) api.candidateLinkIssue(row.posting_ref);")]]],
  ["the pill opens an application link, not the policy link", ["policy"], [[SJ, (s) => s.replace('r.data.links.find((x) => x.kind === "policy")', 'r.data.links.find((x) => x.kind !== "policy")')]]],
  ["the pill opens in the same tab", ["policy"], [[SJ, (s) => s.replace('window.open(url, "_blank", "noopener,noreferrer") : null;\n    if (w === null && url) {\n      // the browser held back the new tab: a real link the person can press themselves', 'window.open(url, "_self", "noopener,noreferrer") : null;\n    if (w === null && url) {\n      // the browser held back the new tab: a real link the person can press themselves')]]],
  ["the policy row stays in the details window next to the pill", ["policy"], [[SJ, (s) => s.replace("policy && row.has_policy_link !== true ? policy : null", "policy ? policy : null")]]],
  ["the Links heading is missing when only the policy row is listed", ["policy"], [[SJ, (s) => s.replace("if (applyLinks.length > 0 || policyRow) {", "if (applyLinks.length > 0) {")]]],
  ["a chip button is given a width wider than a phone tile", ["layout"], [[CSS, (s) => s.replace(".chip-button{border:0;", ".chip-button{width:400px;flex-shrink:0;border:0;")]]],
  ["the Registered holder is laid over the pills", ["layout"], [[CSS, (s) => s.replace(".reg-holder{display:flex;", ".reg-holder{position:absolute;left:20px;top:110px;display:flex;")]]],
  ["the Comments link is small on a phone", ["layout"], [[CSS, (s) => s.replace("  .tile-comments{min-height:44px}\n", "")]]],
  ["the info icon's touch area shrinks on a phone", ["layout"], [[CSS, (s) => s.replace("  .info-icon::before{content:\"\";position:absolute;inset:-15px}", "  .info-icon::before{content:\"\";position:absolute;inset:-5px}")]]],
  ["the box is given a width wider than a phone screen", ["layout", "boxes"], [[CSS, (s) => s.replace(".info-box{width:440px}", ".info-box{width:520px;min-width:520px}")]]],
  ["a dash is put in the box title", ["words"], [[AT, (s) => s.replace('export const LINKS_ABOUT_TITLE = "About these links";', 'export const LINKS_ABOUT_TITLE = "About ' + String.fromCharCode(8212) + ' these links";')]]],
  ["a box title says verified", ["words"], [[AT, (s) => s.replace('export const ABOUT_TITLE = "About this information";', 'export const ABOUT_TITLE = "About this verified information";')]]],
  ["the Registered label becomes Listed", ["words", "moved"], [[SJ, (s) => s.replace('"✓ Registered"', '"✓ Listed"')]]],
];
test("negative controls: each planted defect makes a check fail", { timeout: 7200000 }, async () => {
  const missed = [];
  const only = process.env.FGJ_LM_ONLY ? process.env.FGJ_LM_ONLY.split("|") : null;   // (a re-run of a few defects by their words; the full run leaves it unset)
  for (const [label, scenarios, edits] of DEFECTS) {
    if (only && !only.some((w) => label.includes(w))) continue;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-lm-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n").replace(/\?v=[0-9a-f]{8}(?=["'])/g, ""), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      // a check that cannot even find the thing it looks at (the icon is gone) has failed too: its crash is the catch
      for (const n of scenarios) { try { found.push(...(await SCENARIOS[n](dir)).map((x) => n + ": " + x)); } catch (e) { found.push(n + ": the check stopped: " + String(e.message).split("\n")[0].slice(0, 110)); } }
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 170) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
