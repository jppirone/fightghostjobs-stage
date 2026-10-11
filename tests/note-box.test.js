// note-box.test.js - prompt BM (October 11, 2026), in a real browser: the opening editor's "What changed, and why?" box is on the page ONLY while the main form has a change, and with nothing changed the main
// button reads "Back to My openings" and goes there (it was "Close", which reads as closing the opening). The repo's own files and a fake backend (tests/fake-site.js; no real project, no key).
// Then negative controls: one defect at a time in the page code; each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/note-box.test.js
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
const BACK = "Back to My openings";
const PANELS_FIRST_ONE = "The destination links section has something that is not saved. Use the button in that section to save it first, then press Save changes.";
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

async function withSite(root, opts, fn) { const site = await startFakeSite(root, opts); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }
const q = JSON.stringify;
const text = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; })()");
const exists = (tab, sel) => tab.eval("!!document.querySelector(" + q(sel) + ")");
const typeIn = (tab, sel, value) => tab.eval("(() => { const e = document.querySelector(" + q(sel) + "); e.value = " + q(value) + "; e.dispatchEvent(new Event('input', { bubbles: true })); })()");
const click = (tab, sel) => tab.eval("document.querySelector(" + q(sel) + ").click()");
const callsOf = (site, name) => site.calls.filter((c) => c.name === name);
async function openEdit(tab, site) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=poster"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.viewport(1366, false, 900);
  await tab.goto(site.url + "/" + EDIT);
  await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden && !!document.querySelector('#jtitle').value", 10000); await sleep(800);
  await tab.eval("window.confirm = () => true;");
}

const SCENARIOS = {
  // ---- nothing changed: no box, the old words, no request that carries a note
  async nothingChanged(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    for (const sel of ["#note", "#noteLabel", "#noteNeeded", '[data-error-for="note"]', "#noteBlock"]) if (await exists(tab, sel)) bad.push(sel + " is on the page with nothing changed");
    if ((await text(tab, "#saveBtn")) !== BACK) bad.push("the button reads '" + (await text(tab, "#saveBtn")) + "'");
    const words = await tab.eval("Array.from(document.querySelectorAll('#actionArea button')).filter((b) => !b.hidden).map((b) => b.textContent.trim())");
    if (words.some((w) => /^close$/i.test(w))) bad.push("a button of the bottom area reads Close: " + JSON.stringify(words));
    if (await tab.eval("/\\bClose\\b/.test(document.querySelector('#actionArea').innerText)")) bad.push("the word Close is in the bottom area");
    const focusables = await tab.eval("Array.from(document.querySelectorAll('input, button, a[href], textarea, select')).filter((e) => !e.closest('[hidden]')).map((e) => e.id || e.tagName)");
    if (focusables.includes("note")) bad.push("the note box is in the tab order");
    await click(tab, "#saveBtn");
    await tab.waitFor("location.pathname === '/dashboard.html'", 8000);
    if ((await tab.eval("location.pathname")) !== "/dashboard.html") bad.push("the button did not go to My openings");
    if (callsOf(site, "edit-posting").length) bad.push("a save was sent");
    if (site.calls.some((c) => JSON.stringify(c.body || {}).includes("change_note"))) bad.push("a request carried a change note");
    return bad; })); },
  // ---- a change: the box, the old rule, the button word
  async change(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await typeIn(tab, "#jtitle", "Data Analyst II"); await sleep(150);
    if (!(await exists(tab, "#actionArea #note"))) { bad.push("no note box after a change"); return bad; }
    if ((await text(tab, "#noteLabel")) !== "What changed, and why? (required; kept with the opening).") bad.push("the label reads '" + (await text(tab, "#noteLabel")) + "'");
    if (!(await tab.eval("document.querySelector('#noteBlock').innerText.includes('One line, 500 characters at most.')"))) bad.push("the limit hint is not with the box");
    if ((await tab.eval("document.querySelector('#note').getAttribute('aria-required')")) !== "true") bad.push("the box is not marked required");
    if ((await text(tab, "#saveBtn")) !== "Save changes") bad.push("the button reads '" + (await text(tab, "#saveBtn")) + "'");
    if (!/needs a note/.test((await text(tab, "#noteNeeded")) || "")) bad.push("the rule sentence is missing: '" + (await text(tab, "#noteNeeded")) + "'");
    // the box comes before the buttons in the tab order and is the first thing of the bottom area
    const order = await tab.eval("Array.from(document.querySelectorAll('#actionArea input, #actionArea button')).filter((e) => !e.closest('[hidden]') && !e.hidden).map((e) => e.id)");
    if (order[0] !== "note" || order[1] !== "saveBtn") bad.push("the order in the bottom area is " + JSON.stringify(order));
    // nothing announces the box: no live region or alert inside it
    if (await tab.eval("!!document.querySelector('#noteBlock [role=alert], #noteBlock [role=status], #noteBlock [aria-live]')")) bad.push("the box carries a live region");
    return bad; })); },
  async changeThenUndo(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await typeIn(tab, "#jtitle", "Data Analyst II"); await sleep(100);
    await typeIn(tab, "#note", "Level added to the title"); await sleep(100);
    await typeIn(tab, "#jtitle", "Data Analyst"); await sleep(150);
    if (await exists(tab, "#note")) bad.push("the note box is still on the page after the change was undone");
    if ((await text(tab, "#saveBtn")) !== BACK) bad.push("the button reads '" + (await text(tab, "#saveBtn")) + "'");
    // the change again: the box comes back EMPTY (a hidden note can never be sent)
    await typeIn(tab, "#jtitle", "Data Analyst III"); await sleep(150);
    if (!(await exists(tab, "#note"))) { bad.push("no box after the second change"); return bad; }
    if ((await tab.eval("document.querySelector('#note').value")) !== "") bad.push("the earlier note came back: '" + (await tab.eval("document.querySelector('#note').value")) + "'");
    await typeIn(tab, "#jtitle", "Data Analyst"); await sleep(150);
    await click(tab, "#saveBtn");
    await tab.waitFor("location.pathname === '/dashboard.html'", 8000);
    if (callsOf(site, "edit-posting").length) bad.push("a save was sent");
    if (site.calls.some((c) => JSON.stringify(c.body || {}).includes("Level added"))) bad.push("the typed sentence was sent");
    return bad; })); },
  async noteRuleUnchanged(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await typeIn(tab, "#jtitle", "Data Analyst II"); await sleep(100);
    await click(tab, "#saveBtn"); await sleep(400);
    if (!/^Say what changed and why\./.test((await text(tab, '[data-error-for="note"]')) || "")) bad.push("without a note the error reads '" + (await text(tab, '[data-error-for="note"]')) + "'");
    if (callsOf(site, "edit-posting").length) bad.push("a live opening was saved without a note");
    await typeIn(tab, "#note", "Level added to the title");
    await click(tab, "#saveBtn"); await sleep(1200);
    const c = callsOf(site, "edit-posting");
    if (c.length !== 1 || c[0].body.change_note !== "Level added to the title") bad.push("the save did not carry the note: " + JSON.stringify(c.map((x) => x.body)));
    if (await exists(tab, "#note")) bad.push("the box stays after the save (nothing differs any more)");
    if ((await text(tab, "#saveBtn")) !== BACK) bad.push("after the save the button reads '" + (await text(tab, "#saveBtn")) + "'");
    return bad; })); },
  // ---- a link section only: BK's behavior, and no box
  async linkSectionOnly(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await typeIn(tab, '#linkRows input[aria-label="Destination address 1"]', "https://example.com/apply"); await sleep(150);
    if (await exists(tab, "#note")) bad.push("the note box shows for a link section only");
    if ((await text(tab, "#saveBtn")) !== "Save changes") bad.push("the button reads '" + (await text(tab, "#saveBtn")) + "'");
    await click(tab, "#saveBtn"); await sleep(300);
    if ((await text(tab, "#formAlert")) !== PANELS_FIRST_ONE) bad.push("the double check says '" + (await text(tab, "#formAlert")) + "'");
    if (callsOf(site, "edit-posting").length || callsOf(site, "set-destination-links").length) bad.push("something was sent");
    // the form changed as well: the box is there, and still nothing is submitted
    await typeIn(tab, "#jtitle", "Data Analyst II"); await sleep(150);
    if (!(await exists(tab, "#note"))) bad.push("no note box with the form changed");
    await typeIn(tab, "#note", "Level added");
    await click(tab, "#saveBtn"); await sleep(300);
    if ((await text(tab, "#formAlert")) !== PANELS_FIRST_ONE || callsOf(site, "edit-posting").length) bad.push("with both unsaved the double check did not hold: '" + (await text(tab, "#formAlert")) + "'");
    return bad; })); },
  // ---- drafts
  async drafts(root) { const bad = [];
    for (const status of ["draft", "scheduled"]) {
      await withSite(root, { plan: "verified", postingStatus: status }, (site) => withTab(async (tab) => {
        await openEdit(tab, site);
        if (await exists(tab, "#note")) bad.push(status + ": the note box shows with nothing changed");
        const w = await tab.eval("Array.from(document.querySelectorAll('#actionArea button')).filter((b) => !b.hidden).map((b) => b.textContent.trim())");
        if (JSON.stringify(w) !== JSON.stringify([BACK, "Save as draft", "Publish"])) bad.push(status + ": the buttons are " + JSON.stringify(w));
        await typeIn(tab, "#jtitle", "Data Analyst II"); await sleep(150);
        if (!(await exists(tab, "#note"))) bad.push(status + ": no note box after a change");
        else if (!/optional on a draft/.test((await text(tab, "#noteLabel")) || "")) bad.push(status + ": the label reads '" + (await text(tab, "#noteLabel")) + "'");
        const w2 = await tab.eval("Array.from(document.querySelectorAll('#actionArea button')).filter((b) => !b.hidden).map((b) => b.textContent.trim())");
        if (JSON.stringify(w2) !== JSON.stringify(["Save changes", "Save as draft", "Publish"])) bad.push(status + ": after a change the buttons are " + JSON.stringify(w2));
        await typeIn(tab, "#jtitle", "Data Analyst"); await sleep(150);
        if (await exists(tab, "#note")) bad.push(status + ": the box stays after the change was undone");
      }));
    }
    return bad; },
  // ---- the cursor and the tab order
  async cursorStays(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await tab.eval("document.querySelector('#jtitle').focus()");
    await typeIn(tab, "#jtitle", "Data Analyst II"); await sleep(150);
    if (!(await tab.eval("document.activeElement && document.activeElement.id === 'jtitle'"))) bad.push("the box appeared and the cursor moved: " + (await tab.eval("document.activeElement && document.activeElement.id")));
    // Tab from the last field of the form reaches the note box, then the buttons: the bottom area is last
    const last = await tab.eval("(() => { const f = Array.from(document.querySelectorAll('main input, main button, main a[href], main textarea, main select')).filter((e) => !e.closest('[hidden]') && !e.hidden && !e.disabled && e.tabIndex >= 0); return f.slice(-4).map((e) => e.id || e.textContent.trim().slice(0, 20)); })()");
    if (last[last.length - 1] !== "saveBtn" && last[last.length - 1] !== "unsavedDiscard" && last[last.length - 1] !== "unsavedSave") bad.push("the last controls of the page are " + JSON.stringify(last));
    return bad; })); },
};

for (const [name, run] of Object.entries(SCENARIOS)) {
  test("prompt BM, " + name, { timeout: 240000 }, async () => {
    const bad = await run(ROOT);
    assert.deepEqual(bad, [], bad.join("\n"));
  });
}

// ---- negative controls: one defect at a time in the page code; each must make a scenario fail
const DEFECTS = [
  ["the note box is always put in", [["js/pages/edit.js", (s) => s.replace("syncNoteBlock(editable && formUnsaved());", "syncNoteBlock(editable);")]], ["nothingChanged"]],
  ["the note box shows for a link section only", [["js/pages/edit.js", (s) => s.replace("syncNoteBlock(editable && formUnsaved());", "syncNoteBlock(editable && anyUnsaved());")]], ["linkSectionOnly"]],
  ["the note text stays when the box goes", [["js/pages/edit.js", (s) => s.replace('    noteInput.value = ""; noteInput.setAttribute("aria-invalid", "false");', '    noteInput.setAttribute("aria-invalid", "false");')]], ["changeThenUndo"]],
  ["the button is called Close again", [["js/dirty-state.js", (s) => s.replace('BACK: "Back to My openings"', 'BACK: "Close"')]], ["nothingChanged", "changeThenUndo"]],
  ["the note is no longer required for a live opening", [["js/edit-form.js", (s) => s.replace('if (note === "" && !e.note) e.note = "Say what changed and why. The note is required and is kept with the opening.";', "")]], ["noteRuleUnchanged"]],
  ["the cursor jumps into the box when it appears", [["js/pages/edit.js", (s) => s.replace("if (wanted && !inPage) actionArea.insertBefore(noteBlock, actionArea.firstChild);", "if (wanted && !inPage) { actionArea.insertBefore(noteBlock, actionArea.firstChild); noteInput.focus(); }")]], ["cursorStays"]],
  ["a draft's box shows with nothing changed", [["js/pages/edit.js", (s) => s.replace("syncNoteBlock(editable && formUnsaved());", "syncNoteBlock(editable && (formUnsaved() || state.orig.stored_status === \"draft\"));")]], ["drafts"]],
  ["the box is put back after the box is built for the page but never taken out again", [["js/pages/edit.js", (s) => s.replace("else if (!wanted && inPage) {", "else if (false) {")]], ["changeThenUndo", "drafts"]],
];
test("negative controls: each defect makes a scenario fail", { timeout: 3600000 }, async () => {
  const missed = [];
  for (const [label, edits, scenarios] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-bm-ctl-"));
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
