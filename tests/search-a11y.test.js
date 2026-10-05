// search-a11y.test.js - the search page for keyboard and screen-reader users, in a real browser (October 5, 2026; John's keyboard-only pass on stage, October 4, 2026). The repo's own files, a fake backend (tests/fake-site.js).
// STATUS (B2): when a search finishes, ONE polite status message says how many postings matched (or "No matching postings"); it is announced once per search (the same search twice is announced twice), focus does not move,
// no second live region speaks, a search that stops on a message says nothing here, and the visible count is not read a second time.
// DETAILS WINDOW (B3): opening "View posting details" moves focus into the window, Tab and Shift+Tab stay inside it (the page's handler takes the key, it is not left to the browser), everything behind it is inert, Escape,
// the close button and a click on the dark backdrop all close it, focus returns to the EXACT button that opened it (the second card's, not the first's), nothing stays inert afterwards, and the scroll lock from the last round
// still holds while it is open and is undone when it closes. Desktop (1280) and a phone-size window (375 by 667, touch).
// Then negative controls: one defect at a time per rule; each must make a check fail. A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/search-a11y.test.js
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

async function openSearch(tab, site) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.goto(site.url + "/search.html");
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(600);
}
const fill = (tab, company, title) => tab.eval(`(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); }; set("company", ${JSON.stringify(company)}); set("titleq", ${JSON.stringify(title)}); set("reqq", ""); })()`);

// every live region of the page (status, alert, aria-live): a text change to something non-empty is recorded with the region's id; the search status is read separately
const WATCH = `(() => {
  window.__said = [];
  const live = (n) => { const e = n.nodeType === 1 ? n : n.parentElement; return e && e.closest ? e.closest('[role=status],[role=alert],[aria-live]') : null; };
  new MutationObserver((ms) => { for (const m of ms) { const r = live(m.target); if (r && r.textContent.trim() !== "") window.__said.push({ id: r.id, text: r.textContent.trim() }); } }).observe(document, { childList: true, subtree: true, characterData: true });
})()`;
const SAID = `JSON.stringify(window.__said)`;

async function runFrom(tab, how) {
  // how: "button" (the Search button has the focus and is pressed) or "enter" (the title box has the focus and Enter is pressed)
  await tab.eval("window.__said = []");
  if (how === "button") { await tab.eval(`document.getElementById("searchBtn").focus()`); await tab.key("Enter"); }
  else { await tab.eval(`document.getElementById("titleq").focus()`); await tab.key("Enter"); }
}

const SCENARIOS = {
  async status(site) {
    const bad = [], tab = await browser.newTab();
    try {
      await tab.focusEmulation(true);
      await openSearch(tab, site); await tab.eval(WATCH);
      const el = await tab.eval(`(() => { const s = document.getElementById("searchStatus"); return s ? { role: s.getAttribute("role"), live: s.getAttribute("aria-live"), atomic: s.getAttribute("aria-atomic"), cls: s.className } : null; })()`);
      if (!el || el.role !== "status" || el.live !== "polite") bad.push("the search status is not a polite status message in the page from the start: " + JSON.stringify(el));
      const countHidden = await tab.eval(`document.getElementById("resultCount").getAttribute("aria-hidden") === "true"`);
      if (!countHidden) bad.push("the visible count is also exposed to a screen reader (it would be read a second time)");
      for (const [how, company, title, want] of [["button", "Meridian", "Nurse", "2 matching postings"], ["button", "Meridian", "Nurse", "2 matching postings"], ["enter", "Zzyzx Unknown", "Nurse", "No matching postings"]]) {
        await fill(tab, company, title); await runFrom(tab, how === "enter" ? "enter" : "button");
        await tab.waitFor(`window.__said.some((x) => x.id === "searchStatus")`, 6000); await sleep(700);
        const said = JSON.parse(await tab.eval(SAID)), mine = said.filter((x) => x.id === "searchStatus"), others = said.filter((x) => x.id !== "searchStatus");
        if (mine.length !== 1) bad.push(want + " (" + how + "): the status was set " + mine.length + " times (wanted once)");
        else if (mine[0].text !== want) bad.push(want + ": the status says '" + mine[0].text + "'");
        if (others.length) bad.push(want + ": another live region spoke too: " + JSON.stringify(others));
        const at = await tab.eval(`document.activeElement.id`);
        const wantFocus = how === "enter" ? "titleq" : "searchBtn";
        if (at !== wantFocus) bad.push(want + " (" + how + "): focus moved to '" + at + "' (wanted it to stay on " + wantFocus + ")");
      }
      // a search that stops on a message says nothing in the status
      await fill(tab, "", "Nurse"); await runFrom(tab, "button"); await sleep(600);
      const stopped = JSON.parse(await tab.eval(SAID));
      if (stopped.some((x) => x.id === "searchStatus")) bad.push("a search stopped by a missing company spoke through the search status");
      if (!stopped.some((x) => x.id === "formError")) bad.push("the missing company message is not announced (the alert region must still speak)");
    } finally { await tab.close(); }
    return bad;
  },
};

// ---- the details window
const FOCUSABLE_OUTSIDE = `(() => {
  const back = document.getElementById("modalBackdrop"), all = Array.from(document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')).filter((e) => !back.contains(e) && getComputedStyle(e).display !== "none" && e.getClientRects().length > 0);
  return { total: all.length, reachable: all.filter((e) => !e.closest("[inert]")).map((e) => (e.id || e.className || e.tagName) + "").slice(0, 6) };
})()`;
const IN_DIALOG = `(() => { const a = document.activeElement, m = document.querySelector("#modalBackdrop .modal"); return { in: !!a && m.contains(a), isDialog: a === m, label: a ? (a.id || a.getAttribute("aria-label") || a.textContent || a.tagName).trim().slice(0, 30) : "" }; })()`;

async function detailsProblems(tab, site, width, phone) {
  const bad = [], tag = (phone ? "phone " : "desktop ") + width + ": ";
  await tab.viewport(width, phone, phone ? 667 : 900); await sleep(300);
  await openSearch(tab, site); await tab.viewport(width, phone, phone ? 667 : 900);
  await fill(tab, "Meridian", "Nurse"); await tab.eval(`document.getElementById("searchBtn").click()`);
  await tab.waitFor(`document.querySelectorAll(".view-details").length === 2`, 8000); await sleep(400);
  await tab.eval(`window.__keys = []; window.addEventListener("keydown", (e) => { if (e.key === "Tab") window.__keys.push({ shift: e.shiftKey, prevented: e.defaultPrevented, at: document.activeElement && (document.activeElement.id || document.activeElement.getAttribute("aria-label") || document.activeElement.textContent.trim().slice(0, 20)) }); });`);
  for (const [name, closer] of [["Escape", "esc"], ["the close button", "button"], ["the dark backdrop", "backdrop"]]) {
    // open the SECOND card's details with the keyboard (focus the button, press Enter)
    await tab.eval(`(() => { const b = document.querySelectorAll(".view-details")[1]; b.setAttribute("data-opener", "second"); b.focus(); })()`);
    await tab.key("Enter");
    if (!(await tab.waitFor(`document.getElementById("modalBackdrop").classList.contains("open")`, 6000))) { bad.push(tag + "the window did not open"); return bad; }
    await sleep(300);
    const into = await tab.eval(IN_DIALOG);
    if (!into.in) bad.push(tag + "focus did not move into the window (it is on '" + into.label + "')");
    const out = await tab.eval(FOCUSABLE_OUTSIDE);
    if (out.reachable.length) bad.push(tag + "the page behind the window is still reachable (" + out.reachable.join(", ") + ")");
    // locked scroll: still the same lock as the last round
    const lock = await tab.eval(`document.documentElement.style.overflow + "|" + document.body.style.overflow`);
    if (lock !== "hidden|hidden") bad.push(tag + "the page's scroll lock is not applied while the window is open (" + lock + ")");
    if (closer === "esc") {
      // Tab forward through everything: it must stay inside, wrap from the last control to the first, and the page's own handler must take the wrapping keys
      const seen = [];
      for (let i = 0; i < 9; i++) { await tab.key("Tab"); const s = await tab.eval(IN_DIALOG); if (!s.in) bad.push(tag + "Tab left the window (to '" + s.label + "')"); seen.push(s.label); }
      for (let i = 0; i < 9; i++) { await tab.key("Tab", { shift: true }); const s = await tab.eval(IN_DIALOG); if (!s.in) bad.push(tag + "Shift+Tab left the window (to '" + s.label + "')"); }
      const keys = JSON.parse(await tab.eval("JSON.stringify(window.__keys)"));
      if (!keys.some((k) => !k.shift && k.prevented)) bad.push(tag + "no forward Tab was taken by the window's own trap (from the last control it is left to the browser)");
      if (!keys.some((k) => k.shift && k.prevented)) bad.push(tag + "no Shift+Tab was taken by the window's own trap (from the first control it is left to the browser)");
      if (new Set(seen).size < 3) bad.push(tag + "Tab found fewer than 3 different controls in the window: " + seen.join(" > "));
      await tab.key("Escape");
    } else if (closer === "button") await tab.eval(`document.getElementById("modalClose").click()`);
    else await tab.eval(`document.getElementById("modalBackdrop").dispatchEvent(new MouseEvent("click", { bubbles: true }))`);
    await sleep(300);
    const closed = await tab.eval(`!document.getElementById("modalBackdrop").classList.contains("open")`);
    if (!closed) bad.push(tag + name + " did not close the window");
    const back = await tab.eval(`(() => { const a = document.activeElement; return { opener: !!a && a.getAttribute("data-opener") === "second", label: a ? (a.id || a.textContent || a.tagName).trim().slice(0, 30) : "" }; })()`);
    if (!back.opener) bad.push(tag + "after " + name + " focus is on '" + back.label + "', not on the button that opened the window");
    const left = await tab.eval(`document.querySelectorAll("[inert]").length + "|" + document.documentElement.style.overflow + "|" + document.body.getAttribute("style")`);
    if (left !== "0||null") bad.push(tag + "after " + name + " something is left behind (inert elements | html overflow | body style): " + left);
    await tab.eval(`document.querySelectorAll("[data-opener]").forEach((e) => e.removeAttribute("data-opener"))`);
  }
  // the window fits the screen on a phone and its own box can be reached by keyboard
  if (phone) {
    await tab.eval(`document.querySelectorAll(".view-details")[0].click()`); await tab.waitFor(`document.getElementById("modalBackdrop").classList.contains("open")`, 6000); await sleep(300);
    const r = await tab.eval(`(() => { const m = document.querySelector("#modalBackdrop .modal").getBoundingClientRect(); return { l: m.left, r: m.right, t: m.top, b: m.bottom, w: innerWidth, h: innerHeight }; })()`);
    if (r.l < 0 || r.r > r.w + 0.5 || r.t < 0 || r.b > r.h + 0.5) bad.push(tag + "the window does not fit inside the phone screen: " + JSON.stringify(r));
    await tab.key("Escape"); await sleep(200);
  }
  return bad;
}
SCENARIOS.detailsDesktop = async (site) => { const tab = await browser.newTab(); try { await tab.focusEmulation(true); return await detailsProblems(tab, site, 1280, false); } finally { await tab.close(); } };
SCENARIOS.detailsPhone = async (site) => { const tab = await browser.newTab(); try { await tab.focusEmulation(true); return await detailsProblems(tab, site, 375, true); } finally { await tab.close(); } };

async function withSite(root, fn) { const site = await startFakeSite(root); try { return await fn(site); } finally { await site.close(); } }

test("search page: one polite status message per search; the details window takes focus, traps Tab, makes the page inert and gives focus back", { timeout: 600000 }, async () => {
  const problems = [];
  await withSite(ROOT, async (site) => { for (const n of Object.keys(SCENARIOS)) for (const p of await SCENARIOS[n](site)) problems.push(n + ": " + p); });
  assert.deepEqual(problems, [], "search accessibility problems:\n" + problems.join("\n"));
});

const DEFECTS = [
  // B2
  ["the status is not a live region any more", ["status"], [["search.html", (s) => s.replace(' role="status" aria-live="polite" aria-atomic="true"></div>\n    <div id="resultCount"', '></div>\n    <div id="resultCount"')]]],
  ["a result count is never announced", ["status"], [["js/pages/search.js", (s) => s.replace('  status.announce(countEl.textContent);   // the one spoken message of this search (js/search-status.js)\n', "")]]],
  ["no match is never announced", ["status"], [["js/pages/search.js", (s) => s.replace('countEl.textContent = "No matching postings"; status.announce(countEl.textContent);', 'countEl.textContent = "No matching postings";')]]],
  ["the visible count is a live region too (read twice)", ["status"], [["search.html", (s) => s.replace('<div id="resultCount" class="result-count" aria-hidden="true" hidden></div>', '<div id="resultCount" class="result-count" role="status" hidden></div>')]]],
  ["the same search twice is announced only once", ["status"], [["js/search-status.js", (s) => s.replace('announce(text) { stop(); el.textContent = "";', "announce(text) { stop(); if (el.textContent === text) return;")], ["js/pages/search.js", (s) => s.replace("\n  status.clear();", "")]]],
  ["a search announces twice", ["status"], [["js/search-status.js", (s) => s.replace("timer = win.setTimeout(() => { timer = null; el.textContent = text; }, ANNOUNCE_DELAY_MS); },", "timer = win.setTimeout(() => { timer = null; el.textContent = text; win.setTimeout(() => { el.textContent = \"\"; el.textContent = text; }, 250); }, ANNOUNCE_DELAY_MS); },")]]],
  ["focus is moved to the results when a search finishes", ["status"], [["js/pages/search.js", (s) => s.replace("  status.announce(countEl.textContent);   // the one spoken message of this search (js/search-status.js)\n", "  status.announce(countEl.textContent);\n  resultsEl.setAttribute(\"tabindex\", \"-1\"); resultsEl.focus();\n")]]],
  ["focus is dropped by the disabled Search button and not given back", ["status"], [["js/pages/search.js", (s) => s.replace(" if (hadFocus && document.activeElement === document.body) searchBtn.focus();", "")]]],
  // B3
  ["focus does not move into the window", ["detailsDesktop"], [["js/dialog-focus.js", (s) => s.replace("dialog.focus({ preventScroll: true });\n\n  const onKey", "void 0;\n\n  const onKey")]]],
  ["the page behind is not inert", ["detailsDesktop", "detailsPhone"], [["js/dialog-focus.js", (s) => s.replace('sib.setAttribute("inert", ""); made.push(sib);', "made.push(sib);")]]],
  ["the page stays inert after the window closes", ["detailsDesktop"], [["js/dialog-focus.js", (s) => s.replace('for (const el of made) el.removeAttribute("inert");', "")]]],
  ["Tab is not trapped by the window", ["detailsDesktop"], [["js/dialog-focus.js", (s) => s.replace('doc.addEventListener("keydown", onKey, true);', "void onKey;")]]],
  ["Escape no longer closes the window", ["detailsDesktop"], [["js/pages/search.js", (s) => s.replace('document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeModal(); });', "")]]],
  ["focus returns to the first card's button, not the one that opened the window", ["detailsDesktop", "detailsPhone"], [["js/pages/search.js", (s) => s.replace("const m = openModal(row, button);", 'const m = openModal(row, document.querySelector(".view-details"));')]]],
  ["focus does not return anywhere", ["detailsDesktop"], [["js/dialog-focus.js", (s) => s.replace("if (target) target.focus({ preventScroll: true });", "")]]],
  ["the scroll lock is gone", ["detailsDesktop"], [["js/pages/search.js", (s) => s.replace("if (!unlockScroll) unlockScroll = lockScroll(document, window);", "")]]],
  ["the window never releases (no restore on close)", ["detailsDesktop"], [["js/pages/search.js", (s) => s.replace(" if (releaseFocus) { releaseFocus(); releaseFocus = null; } }", " }")]]],
];
test("negative controls: each defect in the status message or the details window makes a check fail", { timeout: 3000000 }, async () => {
  const missed = [];
  for (const [label, scenarios, edits] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-sa11y-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      await withSite(dir, async (site) => { for (const n of scenarios) found.push(...(await SCENARIOS[n](site)).map((x) => n + ": " + x)); });
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 160) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no check caught: " + missed.join("; "));
});
