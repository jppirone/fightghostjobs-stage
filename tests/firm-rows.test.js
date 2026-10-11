// firm-rows.test.js - the Recruiter firms area of the opening editor as ROWS, in a real browser (prompt BC, October 10, 2026). The repo's own files and a fake backend (tests/fake-site.js; no real project, no key, no network).
//
// One row per named firm ("Firm 1: <name>", the line "Candidates see: Recruiter firm: <name> · <where it goes>", and Check link, Edit and Remove), the same shared rows panel the Destination links use (js/row-panel.js).
//   states: not on the tier (the locked notice, no rows, no form), lapsed (kept and hidden, said so), on the tier with no firm, one firm with an address, one without an address (no Check link, and the page says so), three firms,
//   a check that did not answer. Check link opens a one-time link in a new tab and the address is never on the page; Edit changes one firm; Remove takes out one firm; the add form under the rows adds one firm (prompt BG) and takes the lowest free position.
// Then negative controls: one defect at a time in the page code; each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/firm-rows.test.js
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
const PID = "3f1d5b1e-0000-4000-8000-000000000001";
const DOT = "·";
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

async function withSite(root, opts, fn) { const site = await startFakeSite(root, opts); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }
const text = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + JSON.stringify(sel) + "); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; })()");
const visible = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + JSON.stringify(sel) + "); return !!e && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none'; })()");
const typeIn = (tab, sel, value) => tab.eval("(() => { const e = document.querySelector(" + JSON.stringify(sel) + "); e.value = " + JSON.stringify(value) + "; e.dispatchEvent(new Event('input', { bubbles: true })); })()");
const callsOf = (site, name) => site.calls.filter((c) => c.name === name);
const titles = (tab) => tab.eval("[...document.querySelectorAll('#firmsList .link-row-title')].map((e) => e.innerText.trim())");
const rowButtons = (tab, n) => tab.eval("[...document.querySelectorAll('#firmsList .link-row[data-position=\"" + n + "\"] .link-row-actions button')].map((b) => [b.innerText.trim(), b.getAttribute('aria-label')])");
const clickIn = (tab, sel) => tab.eval("document.querySelector(" + JSON.stringify(sel) + ").click()");

async function openEdit(tab, site) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=poster"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.viewport(1280, false);
  await tab.goto(site.url + "/" + EDIT);
  await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden && !!document.querySelector('#jtitle').value", 10000); await sleep(600);
  await tab.eval("window.confirm = () => true;");
}
const THREE = [{ firm: "Acme Staffing" }, { firm: "Name Only Partners", with_address: false }, { firm: "Third Search Group", check_status: "failed" }];

const SCENARIOS = {
  async locked(root) { return withSite(root, { recruiter: true, firms: [{ firm: "Acme Staffing" }] }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    if (!(await visible(tab, "#firmsPanel"))) bad.push("the Recruiter firms area is not drawn");
    if (!(await visible(tab, "#firmsLocked"))) bad.push("an organization not on the tier does not see the locked notice");
    if (await visible(tab, "#firmsForm") || (await visible(tab, "#firmsList .link-row"))) bad.push("an organization not on the tier is offered the form or rows");
    if (callsOf(site, "set-destination-links").length || callsOf(site, "check-destination-link").length) bad.push("something was sent");
    return bad; })); },
  async lapsed(root) { return withSite(root, { plan: "lapsed", recruiter: true, firms: [{ firm: "Acme Staffing" }, { firm: "Beta Partners" }] }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    const note = await text(tab, "#firmsNote");
    if (!/Your destination links tier ended\. The 2 firms you named are kept but hidden from candidates until it is renewed\./.test(note || "")) bad.push("the lapsed notice is '" + note + "'");
    if (await visible(tab, "#firmsForm") || (await visible(tab, "#firmsList .link-row"))) bad.push("a lapsed organization is offered the form or rows of firms that are kept and hidden");
    return bad; })); },
  async empty(root) { return withSite(root, { plan: "verified", recruiter: true }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    if (!(await visible(tab, "#firmsForm"))) bad.push("an organization on the tier does not get the firms form");
    const t = await text(tab, "#firmsList");
    if (!/No recruiter firm is named yet\./.test(t || "")) bad.push("the empty sentence is '" + t + "'");
    if (await visible(tab, "#firmsList .link-row")) bad.push("a row is drawn with no firm");
    if (await visible(tab, "#firmsPanelHint")) bad.push("the panel hint is shown with no rows");
    if (await visible(tab, "#clearFirmsBtn")) bad.push("Remove all firms is offered with no firm");
    if (!(await visible(tab, "#addFirmBtn")) || (await text(tab, "#addFirmBtn")) !== "Add firm") bad.push("the add button is not 'Add firm': " + (await text(tab, "#addFirmBtn")));
    if (await tab.eval("!!document.querySelector('#saveFirmsBtn')") || /Replace recruiter firms|Add another firm|What you save replaces what is stored/.test(await tab.eval("document.querySelector('#firmsPanel').innerText"))) bad.push("the whole-set controls or sentence are still in the firms area");
    const boxes = await tab.eval("[...document.querySelectorAll('#firmRows input')].map((i) => i.getAttribute('aria-label'))");
    if (JSON.stringify(boxes) !== JSON.stringify(["Name of the firm to add", "Address of the firm to add (optional)"])) bad.push("the add boxes are " + JSON.stringify(boxes));
    if (await visible(tab, "#firmsLimit")) bad.push("the limit sentence is shown with no firm");
    return bad; })); },
  async rows(root) { return withSite(root, { plan: "verified", recruiter: true, firms: THREE }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    const t = await titles(tab);
    if (JSON.stringify(t) !== JSON.stringify(["Firm 1: Acme Staffing", "Firm 2: Name Only Partners", "Firm 3: Third Search Group"])) bad.push("the row titles are " + JSON.stringify(t));
    const m1 = await text(tab, "#firmsList .link-row[data-position=\"1\"] .link-row-main");
    if (!new RegExp("Candidates see: Recruiter firm: Acme Staffing " + DOT + " Employer's own site").test(m1 || "")) bad.push("firm 1 says '" + m1 + "'");
    const b1 = await rowButtons(tab, 1), b2 = await rowButtons(tab, 2), b3 = await rowButtons(tab, 3);
    if (JSON.stringify(b1) !== JSON.stringify([["Check link", "Check link for firm 1"], ["Edit", "Edit firm 1"], ["Remove", "Remove firm 1"]])) bad.push("firm 1 buttons are " + JSON.stringify(b1));
    if (JSON.stringify(b2) !== JSON.stringify([["Edit", "Edit firm 2"], ["Remove", "Remove firm 2"]])) bad.push("a firm with no address is offered Check link: " + JSON.stringify(b2));
    if (!/No address was added for this firm, so there is nothing to check\./.test((await text(tab, "#firmsList .link-row[data-position=\"2\"]")) || "")) bad.push("the firm with no address does not say so");
    if (!/did not answer when we checked: HTTP 404/.test((await text(tab, "#firmsList .link-row[data-position=\"3\"] .link-row-main")) || "")) bad.push("the check that did not answer is not shown on firm 3");
    if (JSON.stringify(b3.map((x) => x[0])) !== JSON.stringify(["Check link", "Edit", "Remove"])) bad.push("firm 3 buttons are " + JSON.stringify(b3));
    if (!(await visible(tab, "#firmsPanelHint"))) bad.push("the panel hint is missing");
    if (!(await visible(tab, "#clearFirmsBtn"))) bad.push("Remove all firms is not offered");
    if (/\bhttps?:\/\//.test(await tab.eval("document.querySelector('#firmsList').innerText"))) bad.push("an address is on the page");
    if (callsOf(site, "check-destination-link").length || callsOf(site, "set-destination-links").length) bad.push("something was sent when the page loaded");
    return bad; })); },
  async checkLink(root) { return withSite(root, { plan: "verified", recruiter: true, firms: THREE }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await tab.eval("window.__tabs = []; window.open = () => { const w = { closed: false, opener: 'the-opener', close() { this.closed = true; } }; Object.defineProperty(w, 'location', { set(v) { w.href = String(v); }, get() { return w.href; } }); window.__tabs.push(w); return w; };");
    await clickIn(tab, "#firmsList button[aria-label=\"Check link for firm 1\"]");
    await tab.waitFor("window.__tabs.length === 1 && !!window.__tabs[0].href", 8000); await sleep(300);
    const c = callsOf(site, "check-destination-link");
    if (c.length !== 1 || JSON.stringify(c[0].body) !== JSON.stringify({ posting_id: PID, kind: "recruiter", position: 1 })) bad.push("the check request was " + JSON.stringify(c.map((x) => x.body)));
    const tabs = await tab.eval("window.__tabs.map((w) => [w.href, w.opener])");
    if (JSON.stringify(tabs) !== JSON.stringify([["https://go.example.invalid/check/recruiter-1", null]])) bad.push("the new tab was " + JSON.stringify(tabs));
    if (/go\.example\.invalid/.test(await tab.eval("document.body.innerText"))) bad.push("the ticket link is on the page");
    if (!/Opened in a new tab\./.test((await text(tab, "#firmsList .link-row[data-position=\"1\"]")) || "")) bad.push("the row does not say the tab opened");
    if (callsOf(site, "set-destination-links").length) bad.push("Check link saved something");
    return bad; })); },
  async editName(root) { return withSite(root, { plan: "verified", recruiter: true, firms: THREE }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await clickIn(tab, "#firmsList button[aria-label=\"Edit firm 1\"]"); await sleep(300);
    const prefilled = await tab.eval("[...document.querySelectorAll('#firmsList .link-row[data-position=\"1\"] form input')].map((i) => i.value)");
    if (JSON.stringify(prefilled) !== JSON.stringify(["", "Acme Staffing"])) bad.push("the edit boxes start as " + JSON.stringify(prefilled) + " (the address box must be empty, the name prefilled)");
    await tab.eval("(() => { const i = document.querySelectorAll('#firmsList .link-row[data-position=\"1\"] form input')[1]; i.value = 'Acme Talent Partners'; i.dispatchEvent(new Event('input', { bubbles: true })); })()");
    if (!(await visible(tab, "#unsavedBar")) || !/Recruiter firms not saved yet/.test((await text(tab, "#unsavedHead")) || "")) bad.push("a changed name does not show the unsaved bar: " + (await text(tab, "#unsavedHead")));
    if ((await text(tab, "#unsavedDetail")) !== "Press Save on the firm you are editing, or press Discard.") bad.push("the bar's text for an open firm edit is '" + (await text(tab, "#unsavedDetail")) + "'");
    const real = await tab.eval("[...document.querySelectorAll('#firmsList .link-row[data-position=\"1\"] form button')].map((b) => b.innerText.trim() + (b.offsetParent === null ? ' (hidden)' : ''))");
    if (JSON.stringify(real) !== JSON.stringify(["Continue", "Cancel", "Save (hidden)", "Go back (hidden)"])) bad.push("the buttons of the open firm edit are " + JSON.stringify(real));
    if (!(await visible(tab, "#unsavedDiscard"))) bad.push("the bar's own Discard is not on screen");
    await tab.eval("document.querySelector('#firmsList .link-row[data-position=\"1\"] form').requestSubmit()"); await sleep(300);
    const step2 = await tab.eval("[...document.querySelectorAll('#firmsList .link-row[data-position=\"1\"] form button')].filter((b) => b.offsetParent !== null).map((b) => b.innerText.trim())");
    if (JSON.stringify(step2) !== JSON.stringify(["Save", "Go back"])) bad.push("the buttons on the confirm step are " + JSON.stringify(step2));
    if (callsOf(site, "set-destination-links").length) bad.push("something was sent before the person confirmed");
    await tab.eval("[...document.querySelectorAll('#firmsList .link-row[data-position=\"1\"] form button')].find((b) => b.innerText.trim() === 'Save').click()");
    await tab.waitFor("document.querySelector('#firmsList .link-row-title').innerText.indexOf('Acme Talent Partners') >= 0", 8000); await sleep(500);
    const c = callsOf(site, "set-destination-links");
    if (c.length !== 1 || JSON.stringify(c[0].body) !== JSON.stringify({ posting_id: PID, kind: "recruiter", op: "edit", position: 1, name: "Acme Talent Partners" })) bad.push("the request was " + JSON.stringify(c.map((x) => x.body)));
    const t = await titles(tab);
    if (JSON.stringify(t) !== JSON.stringify(["Firm 1: Acme Talent Partners", "Firm 2: Name Only Partners", "Firm 3: Third Search Group"])) bad.push("after the change the rows are " + JSON.stringify(t));
    if (callsOf(site, "edit-posting").length) bad.push("the opening itself was saved as well");
    if (callsOf(site, "get-my-posting").length < 2) bad.push("the change list was not read again");
    if (await visible(tab, "#unsavedBar")) bad.push("the unsaved bar stayed after the change");
    return bad; })); },
  async editAddress(root) { return withSite(root, { plan: "verified", recruiter: true, firms: THREE, firmCheck: "failed" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await clickIn(tab, "#firmsList button[aria-label=\"Edit firm 2\"]"); await sleep(300);
    await tab.eval("(() => { const i = document.querySelectorAll('#firmsList .link-row[data-position=\"2\"] form input')[0]; i.value = 'https://firm-two.own-employer.example/apply'; i.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await tab.eval("document.querySelector('#firmsList .link-row[data-position=\"2\"] form').requestSubmit()"); await sleep(300);
    if (!/Replace the address for Firm 2: Name Only Partners\? Candidates will be sent to the address you entered\. Your other firms are not changed\./.test((await text(tab, "#firmsList .link-row[data-position=\"2\"] form")) || "")) bad.push("the confirm sentence is '" + (await text(tab, "#firmsList .link-row[data-position=\"2\"] form")) + "'");
    await tab.eval("[...document.querySelectorAll('#firmsList .link-row[data-position=\"2\"] form button')].find((b) => b.innerText.trim() === 'Save').click()");
    await tab.waitFor("document.querySelector('#firmsList .link-row[data-position=\"2\"] .alert') !== null", 8000); await sleep(400);
    const c = callsOf(site, "set-destination-links");
    if (c.length !== 1 || JSON.stringify(c[0].body) !== JSON.stringify({ posting_id: PID, kind: "recruiter", op: "edit", position: 2, url: "https://firm-two.own-employer.example/apply" })) bad.push("the request was " + JSON.stringify(c.map((x) => x.body)));
    const row = await text(tab, "#firmsList .link-row[data-position=\"2\"]");
    if (!/Firm 2 has a new address\. When we checked, the address answered HTTP 404\. It is saved anyway\. Make sure it is right\./.test(row || "")) bad.push("the row says '" + row + "'");
    if (/own-employer\.example/.test(await tab.eval("document.body.innerText + [...document.querySelectorAll('input')].map((i) => i.value).join(' ')"))) bad.push("the address is on the page or left in a box");
    const b2 = await rowButtons(tab, 2);
    if (JSON.stringify(b2.map((x) => x[0])) !== JSON.stringify(["Check link", "Edit", "Remove"])) bad.push("after an address was added the firm is not offered Check link: " + JSON.stringify(b2));
    return bad; })); },
  async editRefused(root) { return withSite(root, { plan: "verified", recruiter: true, firms: THREE }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await clickIn(tab, "#firmsList button[aria-label=\"Edit firm 1\"]"); await sleep(300);
    await tab.eval("(() => { const i = document.querySelectorAll('#firmsList .link-row[data-position=\"1\"] form input')[0]; i.value = 'https://blocked.example/apply'; i.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await tab.eval("document.querySelector('#firmsList .link-row[data-position=\"1\"] form').requestSubmit()"); await sleep(300);
    await tab.eval("[...document.querySelectorAll('#firmsList .link-row[data-position=\"1\"] form button')].find((b) => b.innerText.trim() === 'Save').click()");
    await tab.waitFor("/not allowed/.test(document.querySelector('#firmsList .link-row[data-position=\"1\"] form').innerText)", 8000); await sleep(300);
    const box = await tab.eval("document.querySelectorAll('#firmsList .link-row[data-position=\"1\"] form input')[0].value");
    if (box !== "") bad.push("the refused address was left in the box (" + JSON.stringify(box) + ")");
    if (/blocked\.example/.test(await tab.eval("document.body.innerText"))) bad.push("the refused address is on the page");
    if (JSON.stringify(await titles(tab)) !== JSON.stringify(["Firm 1: Acme Staffing", "Firm 2: Name Only Partners", "Firm 3: Third Search Group"])) bad.push("a refused change moved the rows: " + JSON.stringify(await titles(tab)));
    return bad; })); },
  async remove(root) { return withSite(root, { plan: "verified", recruiter: true, firms: THREE }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await clickIn(tab, "#firmsList button[aria-label=\"Remove firm 2\"]"); await sleep(300);
    if (callsOf(site, "set-destination-links").length) bad.push("Remove sent something before the person confirmed");
    if (!/Remove Firm 2: Name Only Partners\? Candidates will no longer see it\. Your other firms are not changed\./.test((await text(tab, "#firmsList .link-row[data-position=\"2\"] .link-remove")) || "")) bad.push("the question is '" + (await text(tab, "#firmsList .link-row[data-position=\"2\"] .link-remove")) + "'");
    await clickIn(tab, "#firmsList .link-row[data-position=\"2\"] .link-remove button.btn-dark");
    await tab.waitFor("document.querySelectorAll('#firmsList .link-row').length === 2", 8000); await sleep(400);
    const c = callsOf(site, "set-destination-links");
    if (c.length !== 1 || JSON.stringify(c[0].body) !== JSON.stringify({ posting_id: PID, kind: "recruiter", op: "remove", position: 2 })) bad.push("the request was " + JSON.stringify(c.map((x) => x.body)));
    const t = await titles(tab);
    if (JSON.stringify(t) !== JSON.stringify(["Firm 1: Acme Staffing", "Firm 3: Third Search Group"])) bad.push("the other firms did not keep their numbers: " + JSON.stringify(t));
    if (!/Firm 2 is no longer named\./.test((await text(tab, "#firmsList")) || "")) bad.push("the sentence after the removal is missing");
    return bad; })); },
  async discard(root) { return withSite(root, { plan: "verified", recruiter: true, firms: THREE }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await clickIn(tab, "#firmsList button[aria-label=\"Edit firm 1\"]"); await sleep(300);
    await tab.eval("(() => { const i = document.querySelectorAll('#firmsList .link-row[data-position=\"1\"] form input')[0]; i.value = 'https://typed.example/a'; i.dispatchEvent(new Event('input', { bubbles: true })); })()");
    if (!(await visible(tab, "#unsavedBar"))) bad.push("a typed address does not show the unsaved bar");
    await clickIn(tab, "#unsavedDiscard"); await sleep(700);
    if (await visible(tab, "#unsavedBar")) bad.push("the bar stayed after Discard");
    if (await visible(tab, "#firmsList .link-row form")) bad.push("the open edit form stayed after Discard");
    if (callsOf(site, "set-destination-links").length) bad.push("Discard sent something");
    return bad; })); },
  async addFirst(root) { return withSite(root, { plan: "verified", recruiter: true, firms: [] }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await clickIn(tab, "#addFirmBtn"); await sleep(300);
    if (!/Enter the firm's name\./.test((await text(tab, "#firmAddBox")) || "")) bad.push("an empty name is not refused in words");
    if (callsOf(site, "set-destination-links").length) bad.push("an empty add sent something");
    await tab.eval("(() => { const i = document.querySelectorAll('#firmRows input'); i[0].value = 'Replacement Group'; i[0].dispatchEvent(new Event('input', { bubbles: true })); i[1].value = 'https://own.example/apply'; i[1].dispatchEvent(new Event('input', { bubbles: true })); })()");
    if (!(await visible(tab, "#unsavedBar")) || !/Recruiter firms not saved yet/.test((await text(tab, "#unsavedHead")) || "")) bad.push("text typed in the add form does not show the unsaved bar: " + (await text(tab, "#unsavedHead")));
    await clickIn(tab, "#addFirmBtn");
    await tab.waitFor("document.querySelector('#firmsList .link-row-title') && document.querySelector('#firmsList .link-row-title').innerText.indexOf('Replacement Group') >= 0", 8000); await sleep(500);
    const c = callsOf(site, "set-destination-links");
    if (c.length !== 1 || JSON.stringify(c[0].body) !== JSON.stringify({ posting_id: PID, kind: "recruiter", op: "add", name: "Replacement Group", url: "https://own.example/apply" })) bad.push("the add request was " + JSON.stringify(c.map((x) => x.body)));
    if (JSON.stringify(await titles(tab)) !== JSON.stringify(["Firm 1: Replacement Group"])) bad.push("the rows after the add are " + JSON.stringify(await titles(tab)));
    if (!/Firm 1 was added\./.test((await text(tab, "#firmsAlert")) || "")) bad.push("the sentence after the add is '" + (await text(tab, "#firmsAlert")) + "'");
    const boxes = await tab.eval("[...document.querySelectorAll('#firmRows input')].map((i) => i.value)");
    if (JSON.stringify(boxes) !== JSON.stringify(["", ""])) bad.push("the add boxes were not emptied: " + JSON.stringify(boxes));
    if (await visible(tab, "#unsavedBar")) bad.push("the unsaved bar stayed after the add");
    if (/own\.example/.test(await tab.eval("document.body.innerText + [...document.querySelectorAll('input')].map((i) => i.value).join(' ')"))) bad.push("the address is on the page");
    if (!(await visible(tab, "#clearFirmsBtn"))) bad.push("Remove all firms is not offered after the first firm");
    return bad; })); },
  async addSecond(root) { return withSite(root, { plan: "verified", recruiter: true, firms: [{ firm: "Acme Staffing" }] }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    if (!(await visible(tab, "#firmAddBox"))) bad.push("with one firm the add form is not offered");
    await tab.eval("(() => { const i = document.querySelectorAll('#firmRows input'); i[0].value = 'Beta Partners'; i[0].dispatchEvent(new Event('input', { bubbles: true })); })()");
    await clickIn(tab, "#addFirmBtn");
    await tab.waitFor("document.querySelectorAll('#firmsList .link-row').length === 2", 8000); await sleep(500);
    const c = callsOf(site, "set-destination-links");
    if (c.length !== 1 || JSON.stringify(c[0].body) !== JSON.stringify({ posting_id: PID, kind: "recruiter", op: "add", name: "Beta Partners" })) bad.push("the request was " + JSON.stringify(c.map((x) => x.body)) + " (only the new firm may be sent)");
    if (JSON.stringify(await titles(tab)) !== JSON.stringify(["Firm 1: Acme Staffing", "Firm 2: Beta Partners"])) bad.push("the rows are " + JSON.stringify(await titles(tab)));
    const b1 = await rowButtons(tab, 1), b2 = await rowButtons(tab, 2);
    if (JSON.stringify(b1.map((x) => x[0])) !== JSON.stringify(["Check link", "Edit", "Remove"])) bad.push("firm 1 lost a button: " + JSON.stringify(b1));
    if (JSON.stringify(b2.map((x) => x[0])) !== JSON.stringify(["Edit", "Remove"])) bad.push("the new firm with no address has " + JSON.stringify(b2));
    if (!(await visible(tab, "#firmAddBox"))) bad.push("with two firms the add form is not offered");
    return bad; })); },
  async limit(root) { return withSite(root, { plan: "verified", recruiter: true, firms: THREE }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    if (await visible(tab, "#firmAddBox") || await visible(tab, "#addFirmBtn")) bad.push("with three firms the add form is offered");
    if (!(await visible(tab, "#firmsLimit")) || (await text(tab, "#firmsLimit")) !== "Three firms are named. That is the most one opening can have: remove one to add another.") bad.push("the limit sentence is '" + (await text(tab, "#firmsLimit")) + "'");
    if (!(await visible(tab, "#clearFirmsBtn"))) bad.push("Remove all firms is not offered with three firms");
    await clickIn(tab, "#firmsList button[aria-label=\"Remove firm 2\"]"); await sleep(300);
    await clickIn(tab, "#firmsList .link-row[data-position=\"2\"] .link-remove button.btn-dark");
    await tab.waitFor("document.querySelectorAll('#firmsList .link-row').length === 2", 8000); await sleep(400);
    if (!(await visible(tab, "#firmAddBox")) || await visible(tab, "#firmsLimit")) bad.push("after a removal the add form did not come back");
    await tab.eval("(() => { const i = document.querySelectorAll('#firmRows input'); i[0].value = 'Fresh Firm'; i[0].dispatchEvent(new Event('input', { bubbles: true })); })()");
    await clickIn(tab, "#addFirmBtn");
    await tab.waitFor("document.querySelectorAll('#firmsList .link-row').length === 3", 8000); await sleep(400);
    if (JSON.stringify(await titles(tab)) !== JSON.stringify(["Firm 1: Acme Staffing", "Firm 2: Fresh Firm", "Firm 3: Third Search Group"])) bad.push("the new firm did not take the free position 2: " + JSON.stringify(await titles(tab)));
    if (await visible(tab, "#firmAddBox")) bad.push("the form is offered again at three firms");
    return bad; })); },
  async addRefused(root) { return withSite(root, { plan: "verified", recruiter: true, firms: [{ firm: "Acme Staffing" }] }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await tab.eval("(() => { const i = document.querySelectorAll('#firmRows input'); i[0].value = 'Late Firm'; i[0].dispatchEvent(new Event('input', { bubbles: true })); i[1].value = 'http://insecure.example/a'; i[1].dispatchEvent(new Event('input', { bubbles: true })); })()");
    await clickIn(tab, "#addFirmBtn"); await sleep(300);
    if (callsOf(site, "set-destination-links").length) bad.push("an address that does not start with https:// was sent");
    if (!/The address must start with https:\/\//.test((await text(tab, "#firmAddBox")) || "")) bad.push("the address is not refused in words");
    await tab.eval("(() => { const i = document.querySelectorAll('#firmRows input'); i[1].value = 'https://blocked.example/apply'; i[1].dispatchEvent(new Event('input', { bubbles: true })); })()");
    await clickIn(tab, "#addFirmBtn");
    await tab.waitFor("/not allowed/.test(document.querySelector('#firmAddBox').innerText)", 8000); await sleep(300);
    if (JSON.stringify(await titles(tab)) !== JSON.stringify(["Firm 1: Acme Staffing"])) bad.push("a refused add changed the rows: " + JSON.stringify(await titles(tab)));
    const typed = await tab.eval("[...document.querySelectorAll('#firmRows input')].map((i) => i.value)");
    if (typed[0] !== "Late Firm") bad.push("the name that was typed was lost after a refusal: " + JSON.stringify(typed));
    return bad; })); },
  async addLimitRefused(root) { return withSite(root, { plan: "verified", recruiter: true, firms: [{ firm: "Acme Staffing" }], addRefusal: { status: 409, body: { error: "A posting can name at most 3 recruiter firms; nothing was changed. Remove one first.", code: "firm_limit" } } }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await tab.eval("(() => { const i = document.querySelectorAll('#firmRows input'); i[0].value = 'Fourth Firm'; i[0].dispatchEvent(new Event('input', { bubbles: true })); })()");
    await clickIn(tab, "#addFirmBtn");
    await tab.waitFor("/most one opening can have/.test(document.querySelector('#firmsAlert').innerText)", 8000).catch(() => null); await sleep(300);
    const said = (await text(tab, "#firmsAlert")) || "";
    if (said !== "Three firms are named. That is the most one opening can have: remove one to add another.") bad.push("a refused add says '" + said + "'");
    if (JSON.stringify(await titles(tab)) !== JSON.stringify(["Firm 1: Acme Staffing"])) bad.push("a refused add changed the rows: " + JSON.stringify(await titles(tab)));
    return bad; })); },
  async removeAll(root) { return withSite(root, { plan: "verified", recruiter: true, firms: THREE }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await clickIn(tab, "#clearFirmsBtn");
    await tab.waitFor("document.querySelectorAll('#firmsList .link-row').length === 0", 8000); await sleep(400);
    const c = callsOf(site, "set-destination-links");
    if (c.length !== 1 || JSON.stringify(c[0].body) !== JSON.stringify({ posting_id: PID, kind: "recruiter", links: [] })) bad.push("the request was " + JSON.stringify(c.map((x) => x.body)));
    if (!/Removed\. No recruiter firm is named on this opening\./.test((await text(tab, "#firmsAlert")) || "")) bad.push("the sentence after Remove all firms is '" + (await text(tab, "#firmsAlert")) + "'");
    if (!(await visible(tab, "#firmAddBox")) || await visible(tab, "#clearFirmsBtn")) bad.push("after Remove all firms the form is not the empty one");
    return bad; })); },
  async addDiscard(root) { return withSite(root, { plan: "verified", recruiter: true, firms: [{ firm: "Acme Staffing" }] }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await tab.eval("(() => { const i = document.querySelectorAll('#firmRows input'); i[0].value = 'Typed Only'; i[0].dispatchEvent(new Event('input', { bubbles: true })); })()");
    if (!(await visible(tab, "#unsavedBar"))) bad.push("text typed in the add form does not show the bar");
    await clickIn(tab, "#unsavedDiscard"); await sleep(700);
    if (await visible(tab, "#unsavedBar")) bad.push("the bar stayed after Discard");
    const typed = await tab.eval("[...document.querySelectorAll('#firmRows input')].map((i) => i.value)");
    if (JSON.stringify(typed) !== JSON.stringify(["", ""])) bad.push("Discard left the add boxes as " + JSON.stringify(typed));
    if (callsOf(site, "set-destination-links").length) bad.push("Discard sent something");
    return bad; })); },
};

for (const [name, run] of Object.entries(SCENARIOS)) {
  test("the recruiter firms rows, " + name, { timeout: 120000 }, async () => {
    const bad = await run(ROOT);
    assert.deepEqual(bad, [], bad.join("\n"));
  });
}

// ---- negative controls: one defect at a time in the page code; each must make a scenario fail
const DEFECTS = [
  ["Check link is drawn for a firm with no address", [["js/firm-panel.js", (s) => s.replace("canCheck: (row) => row.hasAddress,", "canCheck: () => true,")]], ["rows"]],
  ["Edit replaces every firm (the whole-set call is used for one firm's change)", [["js/firm-panel.js", (s) => s.replace("runEdit: (row, change) => api.editRecruiterFirm(ctx.getPostingId(), row.position, change),", "runEdit: (row, change) => api.setRecruiterFirms(ctx.getPostingId(), [{ name: change.name || row.name }]),")]], ["editName"]],
  ["Remove removes every firm (the whole-set call with none)", [["js/firm-panel.js", (s) => s.replace("runRemove: (row) => api.removeRecruiterFirm(ctx.getPostingId(), row.position),", "runRemove: () => api.setRecruiterFirms(ctx.getPostingId(), []),")]], ["remove"]],
  ["Check link asks for an application link", [["js/firm-panel.js", (s) => s.replace("api.checkRecruiterFirm(ctx.getPostingId(), row.position)", "api.checkDestinationLink(ctx.getPostingId(), row.position)")]], ["checkLink"]],
  ["the address stays in the edit box after the request (it would be on the page)", [["js/row-panel.js", (s) => s.replace("finally { addr.value = \"\"; }", "finally { /* kept */ }")]], ["editRefused"]],
  ["the tier check is not applied to the firms form", [["js/pages/edit.js", (s) => s.replace("$(\"#firmsForm\").hidden = !(notice.state === \"active\" && savedOn && state.recruiter);", "$(\"#firmsForm\").hidden = !(savedOn && state.recruiter);")]], ["locked", "lapsed"]],
  ["a lapsed tier is treated as an active one (the rows and the form are drawn)", [["js/pages/edit.js", (s) => s.replace("$(\"#firmsForm\").hidden = !(notice.state === \"active\" && savedOn && state.recruiter);", "$(\"#firmsForm\").hidden = !(notice.state !== \"locked\" && savedOn && state.recruiter);")]], ["lapsed"]],
  ["Discard leaves an open firm edit", [["js/pages/edit.js", (s) => s.replace("    if (shown(\"#firmsForm\")) firmPanel.discard();             // the same for the recruiter firms' rows and for the policy link's row\n", "")]], ["discard"]],
  ["a changed firm name is not counted as unsaved work", [["js/pages/edit.js", (s) => s.replace(" || (shown(\"#firmsForm\") && firmPanel.hasPending())", "")]], ["editName", "discard"]],
  ["Add firm replaces the whole set (the whole-set call with only the new firm)", [["js/pages/edit.js", (s) => s.replace("api.addRecruiterFirm(postingId, plan.add)", "api.setRecruiterFirms(postingId, [plan.add])")]], ["addFirst", "addSecond"]],
  ["the add form is still offered at three firms", [["js/pages/edit.js", (s) => s.replace("$(\"#firmAddBox\").hidden = count >= 3;", "$(\"#firmAddBox\").hidden = false;")]], ["limit"]],
  ["the limit sentence is never shown", [["js/pages/edit.js", (s) => s.replace("lim.hidden = count < 3;", "lim.hidden = true;")]], ["limit"]],
  ["text typed in the add form is not counted as unsaved work", [["js/pages/edit.js", (s) => s.replace("(shown(\"#firmsForm\") && rowsTyped(firms.values())) || ", "")]], ["addFirst", "addDiscard"]],
  ["the add boxes keep what was typed after the add worked", [["js/pages/edit.js", (s) => s.replace("if (!state.firmsBusy && !state.keepPanels.has(PANEL.FIRMS)) firms.reset();", "")]], ["addFirst"]],
  ["a refused add is not told to the person", [["js/pages/edit.js", (s) => s.replace("      say(box, \"error\", f.text || failureText(r.error));\n      return;\n    }\n    state.firmsBusy = false;\n    const reload = await api.getMyPosting(postingId);\n    if (reload.ok) await populate(reload.data, { keepForm: true, saved: PANEL.FIRMS });\n    const warn = firmWarn", "      return;\n    }\n    state.firmsBusy = false;\n    const reload = await api.getMyPosting(postingId);\n    if (reload.ok) await populate(reload.data, { keepForm: true, saved: PANEL.FIRMS });\n    const warn = firmWarn")]], ["addLimitRefused"]],
  ["Remove all firms sends a one-firm remove instead of the empty set", [["js/pages/edit.js", (s) => s.replace("api.setRecruiterFirms(postingId, [])", "api.removeRecruiterFirm(postingId, 1)")]], ["removeAll"]],
  ["the bar uses the generic sentence for an open firm edit", [["js/pages/edit.js", (s) => s.replace("firmEdit: shown(\"#firmsForm\") && firmPanel.hasPending(), ", "")]], ["editName"]],
  ["the limit of three rows is not kept (a fourth firm is drawn)", [["js/firm-panel-model.js", (s) => s.replace("x.position > 3 ||", "x.position > 30 ||")]], ["__unit"]],
];
test("negative controls: each defect in the recruiter firms page code makes a scenario fail", { timeout: 1800000 }, async () => {
  const missed = [];
  for (const [label, edits, scenarios] of DEFECTS) {
    if (scenarios[0] === "__unit") continue;     // pinned by tests/rows-panels.unit.test.js and its mutation controls (tests/rows-panels.mutants.test.js)
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-firm-ctl-"));
    try {
      fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(src) });
      for (const [rel, mutate] of edits) { const p = path.join(dir, rel), b0 = fs.readFileSync(p, "utf8"), a0 = mutate(b0); assert.notEqual(a0, b0, "the defect '" + label + "' changed nothing in " + rel); fs.writeFileSync(p, a0); }
      const found = [];
      for (const n of scenarios) {
        // a scenario that cannot even finish (an element the page no longer draws) has caught the defect too
        try { for (const p of await SCENARIOS[n](dir)) found.push(n + ": " + p); } catch (e) { found.push(n + ": the scenario could not finish: " + String(e.message).slice(0, 100)); }
      }
      if (found.length === 0) missed.push(label); else console.log("caught  " + label + "  (" + found[0].slice(0, 150) + ")");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  assert.deepEqual(missed, [], "defects no scenario caught: " + missed.join("; "));
});
