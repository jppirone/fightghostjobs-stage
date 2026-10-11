// register-bk.test.js - prompt BK (October 11, 2026), in a real browser: the opening editor's one action area at the very bottom (Save changes or Close, the link sections' double check, the draft rules, Save as
// draft, Publish, an "Added" line in Recent changes), and the follow-ups from the Add an opening hand checks (typed firms cleared when the switch goes off, the wait word, the limit hints on more boxes, the focus ring
// of a dialog's button, the search refusal that clears the old results). The repo's own files and a fake backend (tests/fake-site.js; no real project, no key).
// Then negative controls: one defect at a time in the page code; each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/register-bk.test.js
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
const EDIT = "edit.html?id=3f1d5b1e-0000-4000-8000-000000000001";
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

async function withSite(root, opts, fn) { const site = await startFakeSite(root, opts); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }
const q = JSON.stringify;
const text = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; })()");
const visible = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); return !!e && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none'; })()");
const typeIn = (tab, sel, value) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); e.value = " + q(value) + "; e.dispatchEvent(new Event('input', { bubbles: true })); })()");
const click = (tab, sel) => tab.eval("document.querySelector(" + q(sel) + ").click()");
const value = (tab, sel) => tab.eval("document.querySelector(" + q(sel) + ").value");
const callsOf = (site, name) => site.calls.filter((c) => c.name === name);
const path_ = (tab) => tab.eval("location.pathname");
// a real mouse click (trusted), at the middle of the element: the way a person opens a dialog
async function mouseClick(tab, sel) {
  const p = await tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
  await tab.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x, y: p.y });
  await tab.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await tab.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
  await sleep(300);
}
async function signIn(tab, site, kind = "poster") {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=" + kind); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.viewport(1280, false);
}
async function openEdit(tab, site) {
  await signIn(tab, site);
  await tab.goto(site.url + "/" + EDIT);
  await tab.waitFor("(document.querySelector('#form') && !document.querySelector('#form').hidden && !!document.querySelector('#jtitle').value) || !document.querySelector('#readonlyNote').hidden", 10000); await sleep(800);
  await tab.eval("window.confirm = () => true;");
}
async function openRegister(tab, site) {
  await signIn(tab, site);
  await tab.goto(site.url + "/register.html");
  await tab.waitFor("!!document.querySelector('#jtitle') && document.readyState === 'complete' && !document.querySelector('#policyRow').hidden", 10000).catch(() => null); await sleep(700);
  await tab.eval("window.confirm = () => true;");
}
const fillRegister = async (tab) => { await typeIn(tab, "#jtitle", "Support Analyst"); await typeIn(tab, "#req", "R-2026-77"); await typeIn(tab, "#closeout", "Closes when the role is filled"); await typeIn(tab, "#desc", "A plain description of the role."); };
async function pickAustin(tab) {
  await typeIn(tab, "#locq", "Austin");
  await tab.waitFor("document.querySelectorAll('#locList li').length > 0", 10000);
  await tab.eval("document.querySelector('#locList li').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))"); await sleep(200);
}
const PANELS_FIRST_ONE = "The destination links section has something that is not saved. Use the button in that section to save it first, then press Save changes.";
const PANELS_FIRST_TWO = "These sections have something that is not saved: AI and hiring policy link and destination links. Use the button in each one to save it first, then press Save changes.";
// the ring: the width, style and colour the browser really draws, and its contrast against what is behind the button
const RING = (sel) => "(() => { const e = document.querySelector(" + q(sel) + "); if (!e) return null; const cs = getComputedStyle(e); const lum = (c) => { const m = /rgba?\\((\\d+), (\\d+), (\\d+)/.exec(c); if (!m) return null; const f = (v) => { v = Number(v) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[1]) + 0.7152 * f(m[2]) + 0.0722 * f(m[3]); };"
  + " let bg = e; let bgc = 'rgba(0, 0, 0, 0)'; while (bg) { bgc = getComputedStyle(bg).backgroundColor; if (!/rgba\\(\\d+, \\d+, \\d+, 0\\)/.test(bgc) && bgc !== 'transparent') break; bg = bg.parentElement; } if (!bg) bgc = 'rgb(255, 255, 255)';"
  + " const a = lum(cs.outlineColor), b = lum(bgc); const ratio = a === null || b === null ? null : (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);"
  + " return { active: document.activeElement === e, width: cs.outlineWidth, style: cs.outlineStyle, color: cs.outlineColor, ratio }; })()";

const SCENARIOS = {
  // ---- the opening editor: ONE action area, at the very bottom
  async editBottomArea(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    const o = await tab.eval(`(() => {
      const idx = (s) => { const e = document.querySelector(s); return e ? Array.from(document.querySelectorAll('*')).indexOf(e) : -1; };
      const area = document.querySelector('#actionArea'), btn = document.querySelector('#saveBtn');
      const left = area ? area.parentElement : null;
      const after = left ? Array.from(left.children).slice(Array.from(left.children).indexOf(area) + 1).filter((e) => !e.hidden) : [];
      const focusables = area ? Array.from(area.querySelectorAll('button, a[href], input, select, textarea')).filter((e) => !e.hidden && !e.closest('[hidden]')) : [];
      return { form: idx('#form'), schedule: idx('#scheduleCard'), links: idx('#linksCard'), firms: idx('#firmsPanel'), policy: idx('#policyRow'), area: idx('#actionArea'), btn: idx('#saveBtn'), inForm: !!document.querySelector('#form #saveBtn'),
        areaShown: !!area && !area.hidden, afterVisible: after.map((e) => e.id || e.tagName), lastControl: focusables.length ? focusables[focusables.length - 1].id : null, backLink: !!document.querySelector('#form a[href="dashboard.html"]'),
        label: btn ? btn.textContent.trim() : null, leftLast: left ? Array.from(left.children).filter((e) => !e.hidden).map((e) => e.id).slice(-2) : [] };
    })()`);
    if (!o.areaShown) { bad.push("the action area is not on the page"); return bad; }
    if (!(o.form < o.schedule && o.schedule < o.links && o.links < o.firms && o.firms < o.area)) bad.push("the order is not form, go-live card, destination links, recruiter firms, action area: " + JSON.stringify(o));
    if (!(o.policy < o.area)) bad.push("the policy link is not above the action area");
    if (o.inForm) bad.push("the main button is still inside the main form");
    if (o.backLink) bad.push("the old Back to My openings button is still in the form");
    if (o.afterVisible.length) bad.push("something visible follows the action area in its column: " + JSON.stringify(o.afterVisible));
    if (o.label !== "Back to My openings") bad.push("with nothing changed the main button reads '" + o.label + "'");
    return bad; })); },
  async editButtonLabel(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    if ((await text(tab, "#saveBtn")) !== "Back to My openings") bad.push("fresh page: the button reads '" + (await text(tab, "#saveBtn")) + "'");
    await typeIn(tab, "#jtitle", "Data Analyst II"); await sleep(100);
    if ((await text(tab, "#saveBtn")) !== "Save changes") bad.push("something changed: the button reads '" + (await text(tab, "#saveBtn")) + "'");
    await typeIn(tab, "#jtitle", "Data Analyst"); await sleep(100);
    if ((await text(tab, "#saveBtn")) !== "Back to My openings") bad.push("changed back by hand: the button reads '" + (await text(tab, "#saveBtn")) + "'");
    // Back to My openings goes to My openings and sends nothing
    await click(tab, "#saveBtn");
    await tab.waitFor("location.pathname === '/dashboard.html'", 8000);
    if ((await path_(tab)) !== "/dashboard.html") bad.push("Back to My openings did not go to My openings");
    if (callsOf(site, "edit-posting").length) bad.push("Back to My openings sent a save");
    // Save changes saves, and the button goes back to Back to My openings
    await tab.goto(site.url + "/" + EDIT);
    await tab.waitFor("!!document.querySelector('#jtitle').value", 10000); await sleep(600);
    await typeIn(tab, "#jtitle", "Data Analyst II"); await typeIn(tab, "#note", "Level added to the title");
    await click(tab, "#saveBtn"); await sleep(1200);
    if (callsOf(site, "edit-posting").length !== 1) bad.push("Save changes sent " + callsOf(site, "edit-posting").length + " saves");
    if ((await text(tab, "#saveBtn")) !== "Back to My openings") bad.push("after a save the button reads '" + (await text(tab, "#saveBtn")) + "'");
    if (!/^Saved\./.test((await text(tab, "#formAlert")) || "")) bad.push("the saved sentence is not next to the button: '" + (await text(tab, "#formAlert")) + "'");
    return bad; })); },
  // ---- the link sections keep their own saves; the bottom button double checks them
  async editLinkCheck(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await typeIn(tab, '#linkRows input[aria-label="Destination address 1"]', "https://example.com/apply"); await sleep(100);
    if ((await text(tab, "#saveBtn")) !== "Save changes") bad.push("an unsaved link row alone: the button reads '" + (await text(tab, "#saveBtn")) + "'");
    await click(tab, "#saveBtn"); await sleep(300);
    if ((await text(tab, "#formAlert")) !== PANELS_FIRST_ONE) bad.push("one section: the sentence is '" + (await text(tab, "#formAlert")) + "'");
    if (callsOf(site, "edit-posting").length || callsOf(site, "set-destination-links").length) bad.push("the bottom button sent something");
    if ((await path_(tab)) !== "/edit.html") bad.push("the page was left");
    // the main form changed as well: still nothing is submitted
    await typeIn(tab, "#jtitle", "Data Analyst II"); await typeIn(tab, "#note", "Level added");
    await click(tab, "#saveBtn"); await sleep(300);
    if ((await text(tab, "#formAlert")) !== PANELS_FIRST_ONE || callsOf(site, "edit-posting").length) bad.push("with the form changed too, the sentence or the submit is wrong: '" + (await text(tab, "#formAlert")) + "' / " + callsOf(site, "edit-posting").length);
    // two sections: both are named, in the page's order
    await typeIn(tab, "#policyUrl", "https://example.com/ai-hiring-policy");
    await click(tab, "#saveBtn"); await sleep(300);
    if ((await text(tab, "#formAlert")) !== PANELS_FIRST_TWO) bad.push("two sections: the sentence is '" + (await text(tab, "#formAlert")) + "'");
    // each section is saved with its own button, then the bottom button saves the rest
    await click(tab, "#savePolicyBtn"); await sleep(700);
    await click(tab, "#saveLinksBtn"); await sleep(900);
    await click(tab, "#saveBtn"); await sleep(1200);
    if (callsOf(site, "edit-posting").length !== 1) bad.push("after the sections were saved, Save changes sent " + callsOf(site, "edit-posting").length + " saves");
    return bad; })); },
  // ---- the draft rules
  async editDraftButtons(root) { const bad = [];
    for (const [status, draftBtn, publishBtn, area] of [["draft", true, true, true], ["scheduled", true, true, true], ["live", false, false, true], ["paused", false, false, true], ["closed", false, false, false], ["expired", false, false, false]]) {
      await withSite(root, { plan: "verified", postingStatus: status }, (site) => withTab(async (tab) => {
        await openEdit(tab, site);
        const shown = { area: await visible(tab, "#actionArea"), draft: await visible(tab, "#draftSaveBtn"), publish: await visible(tab, "#publishBtn") };
        if (shown.area !== area) bad.push(status + ": the action area is " + (shown.area ? "shown" : "hidden"));
        if (area && shown.draft !== draftBtn) bad.push(status + ": Save as draft is " + (shown.draft ? "offered (an opening that is not a draft must never be set back to draft here)" : "missing"));
        if (area && shown.publish !== publishBtn) bad.push(status + ": Publish is " + (shown.publish ? "offered" : "missing"));
        if (!area && !(await visible(tab, "#readonlyNote"))) bad.push(status + ": no read-only note");
        if (area && draftBtn) {
          if ((await text(tab, "#draftSaveBtn")) !== "Save as draft" || (await text(tab, "#publishBtn")) !== "Publish") bad.push(status + ": the words are '" + (await text(tab, "#draftSaveBtn")) + "' and '" + (await text(tab, "#publishBtn")) + "'");
        }
      }));
    }
    return bad; },
  async editAddedLine(root) { return withSite(root, { plan: "verified", createdAt: "2026-09-02T15:30:00.000Z" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    const items = await tab.eval("Array.from(document.querySelectorAll('#changesList li')).map((li) => li.innerText.replace(/\\s+/g, ' ').trim())");
    if (items.length !== 3) bad.push("expected two changes and the added line, got " + JSON.stringify(items));
    const last = items[items.length - 1] || "";
    if (!/^Added · Sep 2, 2026/.test(last)) bad.push("the last line is '" + last + "'");
    if (items.slice(0, -1).some((t) => /^Added/.test(t))) bad.push("the added line is not last");
    return bad; })); },
  async editAddedLineAlone(root) { return withSite(root, { plan: "verified", recentChanges: [] }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    if (!(await visible(tab, "#changesCard"))) bad.push("an opening with no edit has no history card");
    const items = await tab.eval("Array.from(document.querySelectorAll('#changesList li')).map((li) => li.innerText.replace(/\\s+/g, ' ').trim())");
    if (items.length !== 1 || !/^Added · /.test(items[0])) bad.push("the history is " + JSON.stringify(items));
    return bad; })); },
  async editSaveAsDraft(root) { return withSite(root, { plan: "verified", postingStatus: "draft" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    // something typed in a link section: named, nothing sent, the page stays
    await typeIn(tab, '#linkRows input[aria-label="Destination address 1"]', "https://example.com/apply");
    await click(tab, "#draftSaveBtn"); await sleep(300);
    if ((await text(tab, "#formAlert")) !== PANELS_FIRST_ONE || (await path_(tab)) !== "/edit.html") bad.push("Save as draft with a link row typed: '" + (await text(tab, "#formAlert")) + "' at " + (await path_(tab)));
    await typeIn(tab, '#linkRows input[aria-label="Destination address 1"]', "");
    // a change: saved, then back to My openings; it stays a draft (nothing publishes)
    await typeIn(tab, "#jtitle", "Data Analyst II");
    await click(tab, "#draftSaveBtn");
    await tab.waitFor("location.pathname === '/dashboard.html'", 8000);
    if (callsOf(site, "edit-posting").length !== 1) bad.push("Save as draft sent " + callsOf(site, "edit-posting").length + " saves");
    if (callsOf(site, "publish-posting").length) bad.push("Save as draft published the opening");
    if ((await path_(tab)) !== "/dashboard.html") bad.push("Save as draft did not go back to My openings");
    return bad; })); },
  async editPublish(root) { return withSite(root, { plan: "verified", postingStatus: "draft" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await typeIn(tab, "#jtitle", "Data Analyst II");
    await click(tab, "#publishBtn"); await sleep(1000);
    if (callsOf(site, "edit-posting").length !== 1) bad.push("the change was not saved before publishing (" + callsOf(site, "edit-posting").length + ")");
    if (!(await visible(tab, ".modal-backdrop .modal"))) { bad.push("Publish did not ask first"); return bad; }
    if (callsOf(site, "publish-posting").length) bad.push("Publish went through without the question being answered");
    const title = await text(tab, ".modal h2");
    if (title !== "Publish this opening?") bad.push("the question's title is '" + title + "'");
    await tab.eval("(() => { const b = Array.from(document.querySelectorAll('.modal button')).find((x) => /Publish now/.test(x.textContent)); b.click(); })()");
    await sleep(1200);
    if (callsOf(site, "publish-posting").length !== 1) bad.push("publish-posting was called " + callsOf(site, "publish-posting").length + " times");
    if (!/is live\. It closes/.test((await text(tab, "#formAlert")) || "")) bad.push("the live sentence is missing: '" + (await text(tab, "#formAlert")) + "'");
    if (await visible(tab, "#draftSaveBtn") || await visible(tab, "#publishBtn")) bad.push("an opening that is live still offers Save as draft or Publish");
    return bad; })); },
  async editEnter(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await tab.eval("document.querySelector('#jtitle').focus()");
    await tab.key("Enter"); await sleep(400);
    if ((await path_(tab)) !== "/edit.html" || callsOf(site, "edit-posting").length) bad.push("Enter with nothing changed left the page or sent a save");
    await typeIn(tab, "#jtitle", "Data Analyst II"); await typeIn(tab, "#note", "Level added");
    await tab.eval("document.querySelector('#jtitle').focus()");
    await tab.key("Enter"); await sleep(1000);
    if (callsOf(site, "edit-posting").length !== 1) bad.push("Enter with a change sent " + callsOf(site, "edit-posting").length + " saves");
    return bad; })); },
  // ---- limit hints
  async limitHints(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    const one = async (page, id, max, shown, hint) => {
      const sel = (kind) => '[data-limit-for="' + id + '"][data-limit="' + kind + '"]';
      const nm = (n) => n.toLocaleString("en-US");
      if (hint && (await text(tab, sel("hint"))) !== "Up to " + nm(max) + " characters.") bad.push(page + " " + id + ": the hint reads '" + (await text(tab, sel("hint"))) + "'");
      if (!hint && (await tab.eval("!!document.querySelector(" + q(sel("hint")) + ")"))) bad.push(page + " " + id + ": a second 'Up to' line was added where the page already says it");
      if ((await text(tab, sel("count"))) !== "0 of " + nm(max) && (await value(tab, "#" + id)) === "") bad.push(page + " " + id + ": the count reads '" + (await text(tab, sel("count"))) + "'");
      await typeIn(tab, "#" + id, "x".repeat(17));
      if ((await text(tab, sel("count"))) !== "17 of " + nm(max)) bad.push(page + " " + id + ": after 17 letters the count reads '" + (await text(tab, sel("count"))) + "'");
      await typeIn(tab, "#" + id, "x".repeat(max));
      await tab.eval("(() => { const i = document.querySelector('#" + id + "'); i.focus(); i.setSelectionRange(" + max + ", " + max + "); i.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: 'y', bubbles: true, cancelable: true })); })()");
      if ((await text(tab, sel("note"))) !== "That is all it can hold: " + nm(max) + " characters.") bad.push(page + " " + id + ": typing past the limit says '" + (await text(tab, sel("note"))) + "'");
      await typeIn(tab, "#" + id, "x".repeat(max - 5));
      if (await visible(tab, sel("note"))) bad.push(page + " " + id + ": the limit sentence stays after text was removed");
      await tab.eval("(() => { const i = document.querySelector('#" + id + "'); i.focus(); i.setSelectionRange(" + (max - 5) + ", " + (max - 5) + "); const dt = new DataTransfer(); dt.setData('text/plain', 'abcdefghijkl'); i.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertFromPaste', dataTransfer: dt, bubbles: true, cancelable: true })); })()");
      if (!new RegExp("was longer than " + nm(max).replace(",", ",") + " characters, so it was cut at " + nm(max) + "\\.").test((await text(tab, sel("note"))) || "")) bad.push(page + " " + id + ": a paste past the limit says '" + (await text(tab, sel("note"))) + "'");
      await typeIn(tab, "#" + id, "");
    };
    await openRegister(tab, site);
    await click(tab, "#aiFilterToggle"); await click(tab, "#aiInterviewToggle"); await sleep(100);
    for (const [id, max] of [["jtitle", 200], ["req", 100], ["closeout", 300], ["aiFilterNote", 300], ["aiInterviewNote", 300], ["desc", 20000]]) await one("register", id, max, true, true);
    await openEdit(tab, site);
    await click(tab, "#aiFilterToggle"); await click(tab, "#aiInterviewToggle"); await sleep(100);
    for (const [id, max, hint] of [["jtitle", 200, true], ["req", 100, true], ["aiFilterNote", 300, true], ["aiInterviewNote", 300, true], ["desc", 20000, false]]) await one("editor", id, max, true, hint);
    return bad; })); },
  // ---- Add an opening: typed firms are cleared when the switch goes off
  async firmsCleared(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    const SENT = "The firm names you typed were cleared because Third-party recruiter involved is off.";
    await click(tab, "#recruiterToggle"); await sleep(150);
    // nothing typed: turning it off says nothing
    await click(tab, "#recruiterToggle"); await sleep(150);
    if (await visible(tab, "#recruiterCleared")) bad.push("the sentence shows although nothing was typed");
    await click(tab, "#recruiterToggle"); await sleep(150);
    await typeIn(tab, 'input[aria-label="Recruiter firm 1"]', "Northwind Staffing");
    if (!(await visible(tab, "#unsavedBar")) || !/recruiter firms/.test((await text(tab, "#unsavedDetail")) || "")) bad.push("a typed firm does not count as unsaved: '" + (await text(tab, "#unsavedDetail")) + "'");
    await click(tab, "#recruiterToggle"); await sleep(200);
    if ((await text(tab, "#recruiterCleared")) !== SENT) bad.push("the sentence next to the switch is '" + (await text(tab, "#recruiterCleared")) + "'");
    if ((await tab.eval("document.querySelector('#recruiterCleared').getAttribute('role')")) !== "status") bad.push("the sentence is not announced (role status)");
    if ((await value(tab, 'input[aria-label="Recruiter firm 1"]')) !== "") bad.push("the typed firm name is still in the row");
    if (await visible(tab, "#unsavedBar")) bad.push("the unsaved bar still lists the cleared firm");
    // turned on again: no sentence, and the row is empty
    await click(tab, "#recruiterToggle"); await sleep(200);
    if (await visible(tab, "#recruiterCleared")) bad.push("the sentence stays after the switch is on again");
    if ((await value(tab, 'input[aria-label="Recruiter firm 1"]')) !== "") bad.push("the cleared firm came back");
    // and nothing is sent for a firm after the switch went off
    await fillRegister(tab); await pickAustin(tab);
    await click(tab, "#draftBtn"); await sleep(1200);
    if (callsOf(site, "set-destination-links").filter((c) => c.body.kind === "recruiter").length) bad.push("a firm was sent");
    return bad; })); },
  // ---- the wait word
  async waitWord(root) { return withSite(root, { plan: "verified", linkDelayMs: 1500 }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await fillRegister(tab); await pickAustin(tab);
    // nothing to check: the word never shows
    await click(tab, "#draftBtn");
    let seen = false; for (let i = 0; i < 8; i++) { if (await visible(tab, "#waitWord")) seen = true; await sleep(100); }
    if (seen) bad.push("the wait word showed for a form with no address");
    // one address
    await tab.goto(site.url + "/register.html"); await tab.waitFor("!document.querySelector('#policyRow').hidden", 10000); await sleep(600);
    await fillRegister(tab); await pickAustin(tab);
    await typeIn(tab, 'input[aria-label="Destination address 1"]', "https://example.com/apply");
    await click(tab, "#draftBtn"); await sleep(500);
    if ((await text(tab, "#waitWord")) !== "Checking address") bad.push("one address: the word is '" + (await text(tab, "#waitWord")) + "'");
    if (!(await tab.eval("document.querySelector('#draftBtn').disabled && document.querySelector('#registerBtn').disabled"))) bad.push("the buttons are not disabled while it shows");
    if ((await tab.eval("document.querySelector('#waitWord').getAttribute('role')")) !== "status") bad.push("the word is not announced (role status)");
    await tab.waitFor("!document.querySelector('#result').hidden", 10000); await sleep(300);
    if (await visible(tab, "#waitWord")) bad.push("the wait word stays after the checks");
    // two addresses (one link and the policy link)
    await tab.goto(site.url + "/register.html"); await tab.waitFor("!document.querySelector('#policyRow').hidden", 10000); await sleep(600);
    await fillRegister(tab); await pickAustin(tab);
    await typeIn(tab, 'input[aria-label="Destination address 1"]', "https://example.com/apply");
    await typeIn(tab, "#policyUrl", "https://example.com/policy");
    await click(tab, "#draftBtn"); await sleep(500);
    if ((await text(tab, "#waitWord")) !== "Checking addresses") bad.push("two addresses: the word is '" + (await text(tab, "#waitWord")) + "'");
    return bad; })); },
  // ---- the ring on the button a dialog gives the cursor to
  async ringLeaveDialog(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await typeIn(tab, "#jtitle", "Support Analyst");
    await mouseClick(tab, 'a[href="search.html"]');
    if (!(await visible(tab, "#leaveOverlay"))) { bad.push("the leave dialog did not open"); return bad; }
    const r = await tab.eval(RING("#leaveStay"));
    if (!r.active) bad.push("the cursor is not on Stay on this page");
    if (r.style !== "solid" || r.width !== "2px") bad.push("no ring is drawn on Stay when the dialog is opened with a mouse click: " + JSON.stringify(r));
    if (!(r.ratio >= 3)) bad.push("the ring's contrast is " + r.ratio + " (3 is the least)");
    return bad; })); },
  async ringEditorDialog(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await typeIn(tab, "#jtitle", "Data Analyst II");
    await mouseClick(tab, 'a[href="search.html"]');
    if (!(await visible(tab, "#leaveOverlay"))) { bad.push("the leave dialog did not open"); return bad; }
    const r = await tab.eval(RING("#leaveStay"));
    if (!r.active || r.style !== "solid" || r.width !== "2px") bad.push("the editor's leave dialog: " + JSON.stringify(r));
    return bad; })); },
  async ringDashboardDialog(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site);
    await tab.goto(site.url + "/dashboard.html");
    await tab.waitFor("document.querySelectorAll('tbody tr').length > 0", 10000); await sleep(600);
    await tab.eval("(() => { const b = Array.from(document.querySelectorAll('tbody button.row-action')).find((x) => x.textContent.trim() === 'Publish'); b.id = 'pubTest'; })()");
    await mouseClick(tab, "#pubTest");
    if (!(await visible(tab, ".modal-backdrop .modal"))) { bad.push("the dialog did not open"); return bad; }
    const r = await tab.eval("(() => { const e = document.activeElement; if (!e || e.tagName !== 'BUTTON') return { button: false }; const cs = getComputedStyle(e); return { button: true, style: cs.outlineStyle, width: cs.outlineWidth }; })()");
    if (!r.button) bad.push("the cursor is not on a button of the dialog");
    else if (r.style !== "solid" || r.width !== "2px") bad.push("no ring on the dialog's button: " + JSON.stringify(r));
    return bad; })); },
  async ringTeamDialog(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site);
    await tab.goto(site.url + "/team.html");
    await tab.waitFor("document.querySelectorAll('tbody tr').length > 0", 10000); await sleep(600);
    await tab.eval("(() => { const b = Array.from(document.querySelectorAll('tbody button.row-action')).find((x) => /^Remove/.test(x.textContent.trim())); b.id = 'teamTest'; })()");
    await mouseClick(tab, "#teamTest");
    if (!(await visible(tab, ".modal-backdrop .modal"))) { bad.push("the dialog did not open"); return bad; }
    const r = await tab.eval("(() => { const e = document.activeElement; if (!e || e.tagName !== 'BUTTON') return { button: false }; const cs = getComputedStyle(e); return { button: true, style: cs.outlineStyle, width: cs.outlineWidth }; })()");
    if (!r.button) bad.push("the cursor is not on a button of the dialog");
    else if (r.style !== "solid" || r.width !== "2px") bad.push("no ring on the dialog's button: " + JSON.stringify(r));
    return bad; })); },
  // ---- the search refusal that clears the old results
  async searchRefusal(root) { return withSite(root, {}, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site, "candidate");
    await tab.goto(site.url + "/search.html"); await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(600);
    const fill = (company, title, req) => tab.eval("(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; set('company', " + q(company) + "); set('titleq', " + q(title) + "); set('reqq', " + q(req) + "); })()");
    const run = async () => { await tab.eval("document.getElementById('searchBtn').focus()"); await tab.key("Enter"); await sleep(900); };
    await fill("Meridian", "Nurse", ""); await run();
    const had = await tab.eval("document.querySelectorAll('#results .card').length");
    if (!(had > 0) || !(await visible(tab, "#resultCount"))) { bad.push("the first search found nothing to clear"); return bad; }
    // another refusal (nothing to search for) leaves the results as they were
    await fill("Meridian", "", ""); await run();
    if ((await tab.eval("document.querySelectorAll('#results .card').length")) !== had) bad.push("a different refusal cleared the results");
    // both the req number and the title: the refusal, and nothing from the earlier search under it
    await fill("Meridian", "Nurse", "R-2026-0451"); await run();
    if ((await text(tab, "#formError")) !== "Fill in the req number, or the Opening ID / title box, not both.") bad.push("the refusal reads '" + (await text(tab, "#formError")) + "'");
    if ((await tab.eval("document.querySelectorAll('#results > *').length")) !== 0) bad.push("the earlier results are still under the refusal");
    if (await visible(tab, "#resultCount")) bad.push("the earlier count is still above the refusal");
    if (await visible(tab, "#recap")) bad.push("a recap is shown");
    if (callsOf(site, "candidate-search").length !== 1) bad.push("the refusal made a request (" + callsOf(site, "candidate-search").length + " searches)");
    return bad; })); },
};

for (const [name, run] of Object.entries(SCENARIOS)) {
  test("prompt BK, " + name, { timeout: 240000 }, async () => {
    const bad = await run(ROOT);
    assert.deepEqual(bad, [], bad.join("\n"));
  });
}

// ---- negative controls: one defect at a time in the page code; each must make a scenario fail
const DEFECTS = [
  ["the main button never reads Back to My openings", [["js/pages/edit.js", (s) => s.replace("saveBtn.textContent = dirty ? ACTION.SAVE : ACTION.BACK;", "saveBtn.textContent = ACTION.SAVE;")]], ["editBottomArea", "editButtonLabel"]],
  ["the main button never reads Save changes", [["js/pages/edit.js", (s) => s.replace("saveBtn.textContent = dirty ? ACTION.SAVE : ACTION.BACK;", "saveBtn.textContent = ACTION.BACK;")]], ["editButtonLabel", "editLinkCheck"]],
  ["Back to My openings saves instead of leaving", [["js/pages/edit.js", (s) => s.replace("if (!anyUnsaved()) { guard.openDialog(() => go(\"dashboard.html\"), saveBtn); return; }", "if (!anyUnsaved()) { await submit(); return; }")]], ["editButtonLabel"]],
  ["the bottom button submits while a link section has typed text", [["js/pages/edit.js", (s) => s.replace("  if (!linkSectionsClear()) return;\n  await submit();", "  await submit();")]], ["editLinkCheck"]],
  ["the double check names no section", [["js/dirty-state.js", (s) => s.replace('return "The " + names[0] + " section has something', 'return "A section has something')]], ["editLinkCheck"]],
  ["the double check ignores the policy link box", [["js/pages/edit.js", (s) => s.replace("if ((shown(\"#policyForm\") && $(\"#policyUrl\").value.trim() !== \"\") || (shown(\"#policyPanel\") && policyPanel.hasPending())) out.push(PANEL.POLICY);", "")]], ["editLinkCheck"]],
  ["Save as draft is offered for an opening that is live", [["js/pages/edit.js", (s) => s.replace("draftSaveBtn.hidden = !draft;", "draftSaveBtn.hidden = false;")]], ["editDraftButtons"]],
  ["Publish is offered for an opening that is live", [["js/pages/edit.js", (s) => s.replace("publishBtn.hidden = !(draft && actionsFor(state.orig, Date.now()).includes(\"publish\"));", "publishBtn.hidden = false;")]], ["editDraftButtons"]],
  ["Save as draft is not offered for a draft", [["js/pages/edit.js", (s) => s.replace("draftSaveBtn.hidden = !draft;", "draftSaveBtn.hidden = true;")]], ["editDraftButtons"]],
  ["the action area is shown for a closed opening", [["js/pages/edit.js", (s) => s.replace("actionArea.hidden = !editable;", "actionArea.hidden = false;")]], ["editDraftButtons"]],
  ["Save as draft publishes", [["js/pages/edit.js", (s) => s.replace("  go(\"dashboard.html\");           // it stays a draft; the way back to My openings", "  await api.publishPosting(postingId); go(\"dashboard.html\");")]], ["editSaveAsDraft"]],
  ["Save as draft does not save the change", [["js/pages/edit.js", (s) => s.replace("  if (formUnsaved() && !(await submit())) return;\n  go(\"dashboard.html\");", "  go(\"dashboard.html\");")]], ["editSaveAsDraft"]],
  ["Publish does not ask first", [["js/pages/edit.js", (s) => s.replace("  runAction(\"publish\", state.orig, {", "  await api.publishPosting(postingId); await load(); runAction(\"none\", state.orig, {")]], ["editPublish"]],
  ["Publish does not save the change first", [["js/pages/edit.js", (s) => s.replace("async function onPublish() {\n  if (state.busy || !state.orig || state.orig.stored_status !== \"draft\") return;\n  say(formAlert, \"error\", \"\");\n  if (!linkSectionsClear()) return;\n  if (formUnsaved() && !(await submit())) return;", "async function onPublish() {\n  if (state.busy || !state.orig || state.orig.stored_status !== \"draft\") return;\n  say(formAlert, \"error\", \"\");\n  if (!linkSectionsClear()) return;")]], ["editPublish"]],
  ["the history has no added line", [["js/pages/edit.js", (s) => s.replace("if (added !== null) ul.append(", "if (false) ul.append(")]], ["editAddedLine", "editAddedLineAlone"]],
  ["the added line comes first", [["js/pages/edit.js", (s) => s.replace("  for (const c of list) ul.append(", "  if (added !== null) ul.append(h(\"li\", {}, h(\"div\", {}, ADDED_LABEL + \" · \" + fmtStamp(added))));\n  for (const c of list) ul.append(")]], ["editAddedLine"]],
  ["Enter with nothing changed leaves the page", [["js/pages/edit.js", (s) => s.replace("ev.preventDefault(); if (anyUnsaved()) onMain(); }", "ev.preventDefault(); onMain(); }")]], ["editEnter"]],
  ["the title box does not count", [["js/pages/edit.js", (s) => s.replace("mountLimitHint({ input: $(\"#jtitle\") }), ", "")]], ["limitHints"]],
  ["the req number box does not say its limit", [["js/limit-hint.js", (s) => s.replace("const hintEl = hint ? h(", "const hintEl = hint && id !== \"req\" ? h(")]], ["limitHints"]],
  ["a paste that is cut says nothing (limit hint)", [["js/limit-hint.js", (s) => s.replace("if (incoming.length > room) say(incoming.length > 1 ? words.CUT : words.FULL);", "")]], ["limitHints"]],
  ["typed firms stay when the switch goes off", [["js/pages/register.js", (s) => s.replace("state.firms.reset(); say($(\"#firmsAlert\"), \"error\", \"\");\n        said.textContent", "said.textContent")]], ["firmsCleared"]],
  ["the cleared-firms sentence is not shown", [["js/pages/register.js", (s) => s.replace("said.textContent = RECRUITER_CLEARED; said.hidden = false;", "said.textContent = \"\"; said.hidden = true;")]], ["firmsCleared"]],
  ["the wait word is never shown", [["js/pages/register.js", (s) => s.replace("if (addresses > 0) { waitWord.textContent = addresses === 1 ? WAIT_ONE : WAIT_MANY; waitWord.hidden = false; }", "")]], ["waitWord"]],
  ["the wait word says one address for several", [["js/pages/register.js", (s) => s.replace("addresses === 1 ? WAIT_ONE : WAIT_MANY", "WAIT_ONE")]], ["waitWord"]],
  ["the wait word is not taken away", [["js/pages/register.js", (s) => s.replace("    waitWord.textContent = \"\"; waitWord.hidden = true;\n    setBusy(false);", "    setBusy(false);").replace("    waitWord.textContent = \"\"; waitWord.hidden = true;           // the checks are over\n", "")]], ["waitWord"]],
  ["the leave dialog's Stay has no ring when opened with a mouse", [["js/unsaved-guard.js", (s) => s.replace("focusWithRing(dlg.stay);", "dlg.stay.focus();")]], ["ringLeaveDialog", "ringEditorDialog"]],
  ["the My openings dialog's button has no ring", [["js/dashboard-actions.js", (s) => s.replace("focusWithRing(focusable(form)[0] || confirm);", "(focusable(form)[0] || confirm).focus();")]], ["ringDashboardDialog"]],
  ["the team dialog's button has no ring", [["js/pages/team.js", (s) => s.replace("focusWithRing(confirm);", "confirm.focus();")]], ["ringTeamDialog"]],
  ["the ring is too thin", [["app.css", (s) => s.replace("button.focus-ring,a.focus-ring{outline:2px solid var(--ember);outline-offset:2px}", "button.focus-ring,a.focus-ring{outline:1px solid var(--ember);outline-offset:2px}")]], ["ringLeaveDialog"]],
  ["the refusal leaves the earlier results", [["js/pages/search.js", (s) => s.replace("if (q.clearResults) { clear(resultsEl); countEl.hidden = true; hideRecap(); lastSearch = null; status.clear(); }", "")]], ["searchRefusal"]],
  ["every refusal clears the results", [["js/search-input.js", (s) => s.replace("if (!hasTitle && !hasReq) return { ok: false, message: \"Enter a req number, an Opening ID or part of the job title.\", focus: \"req\" };", "if (!hasTitle && !hasReq) return { ok: false, message: \"Enter a req number, an Opening ID or part of the job title.\", focus: \"req\", clearResults: true };")]], ["searchRefusal"]],
];
test("negative controls: each defect in the editor's and the register page's code makes a scenario fail", { timeout: 5400000 }, async () => {
  const missed = [];
  for (const [label, edits, scenarios] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-bk-ctl-"));
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
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
