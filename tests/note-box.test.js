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
    // nothing announces the box: nothing inside it is a live region WITH words in it (prompt BN: the count's paste sentence is a live region like the other boxes', hidden and empty until a paste meets the limit)
    if (await tab.eval("Array.from(document.querySelectorAll('#noteBlock [role=alert], #noteBlock [role=status], #noteBlock [aria-live]')).some((e) => !e.hidden || e.textContent.trim() !== '')")) bad.push("the box carries a live region that says something");
    return bad; })); },
  // ---- the count (prompt BN): "x of 500" like every other box, redrawn from 0 when the box comes back
  async count(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    const COUNT = '#noteBlock [data-limit-for="note"][data-limit="count"]', SAID = '#noteBlock [data-limit-for="note"][data-limit="note"]';
    await typeIn(tab, "#jtitle", "Data Analyst II"); await sleep(150);
    if ((await text(tab, COUNT)) !== "0 of 500") bad.push("a new box reads '" + (await text(tab, COUNT)) + "' (0 of 500)");
    const own = await tab.eval("Array.from(document.querySelectorAll('#noteBlock .field-hint')).map((e) => e.innerText.trim()).filter((t) => t !== '')");
    if (own.filter((t) => /500 characters at most/.test(t)).length !== 1) bad.push("the box's own line is not there exactly once: " + JSON.stringify(own));
    if (own.some((t) => /^Up to 500 characters\.$/.test(t))) bad.push("a second 'Up to 500 characters.' line was added");
    // the count sits under the line of words
    const order = await tab.eval("(() => { const kids = Array.from(document.querySelector('#noteBlock').children); const at = (re) => kids.findIndex((k) => re.test(k.innerText)); return { line: at(/500 characters at most/), count: at(/^\\d[\\d,]* of 500$/) }; })()");
    if (order.line < 0 || order.count < order.line) bad.push("the count is not under the line of words: " + JSON.stringify(order));
    if ((await tab.eval("document.querySelector(" + q(COUNT) + ").getAttribute('aria-hidden')")) !== "true") bad.push("the count is read out as it changes");
    await typeIn(tab, "#note", "Level added"); await sleep(100);
    if ((await text(tab, COUNT)) !== "11 of 500") bad.push("after typing 11 characters the count reads '" + (await text(tab, COUNT)) + "'");
    // at the limit and a paste past it
    await tab.eval("(() => { const i = document.querySelector('#note'); i.focus(); i.value = 'x'.repeat(500); i.dispatchEvent(new Event('input', { bubbles: true })); i.setSelectionRange(500, 500); i.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: 'y', bubbles: true, cancelable: true })); })()");
    await sleep(100);
    if ((await text(tab, COUNT)) !== "500 of 500") bad.push("at the limit the count reads '" + (await text(tab, COUNT)) + "'");
    if ((await text(tab, SAID)) !== "That is all it can hold: 500 characters.") bad.push("typing past the limit says '" + (await text(tab, SAID)) + "'");
    await tab.eval("(() => { const i = document.querySelector('#note'); i.value = 'x'.repeat(495); i.dispatchEvent(new Event('input', { bubbles: true })); i.setSelectionRange(495, 495); const dt = new DataTransfer(); dt.setData('text/plain', 'abcdefghijkl'); i.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertFromPaste', dataTransfer: dt, bubbles: true, cancelable: true })); })()");
    await sleep(100);
    if (!/^What you pasted was longer than 500 characters, so it was cut at 500\.$/.test((await text(tab, SAID)) || "")) bad.push("a paste past the limit says '" + (await text(tab, SAID)) + "'");
    // the change undone: the box goes; the change again: it is back at 0 of 500 with no sentence
    await typeIn(tab, "#jtitle", "Data Analyst"); await sleep(150);
    if (await exists(tab, "#note")) bad.push("the box stays after the change was undone");
    await typeIn(tab, "#jtitle", "Data Analyst III"); await sleep(150);
    if ((await text(tab, COUNT)) !== "0 of 500") bad.push("the box put back reads '" + (await text(tab, COUNT)) + "' (0 of 500)");
    const said = await tab.eval("(() => { const e = document.querySelector(" + q(SAID) + "); return e ? { hidden: e.hidden, text: e.textContent.trim() } : null; })()");
    if (!said || !said.hidden || said.text !== "") bad.push("the limit sentence is still there when the box comes back: " + JSON.stringify(said));
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
    await typeIn(tab, "#note", "Level added to the title"); await sleep(100);
    // prompt BN: the error under the box says the note is missing, so it goes as soon as a note is typed (the sentence of the rule stays: it is true while a change exists)
    if ((await text(tab, '[data-error-for="note"]')) !== "") bad.push("the error under the box stays after a note was typed: '" + (await text(tab, '[data-error-for="note"]')) + "'");
    if ((await tab.eval("document.querySelector('#note').getAttribute('aria-invalid')")) !== "false") bad.push("the box is still marked invalid after a note was typed");
    if (!/needs a note/.test((await text(tab, "#noteNeeded")) || "")) bad.push("the rule sentence went when a note was typed: '" + (await text(tab, "#noteNeeded")) + "'");
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
  ["the note box has no count (prompt BN)", [["js/pages/edit.js", (s) => s.replace("const noteLimit = mountLimitHint({ input: noteInput, hint: false });", "const noteLimit = { refresh() {} };")]], ["count"]],
  ["the note box gets a second 'Up to 500 characters.' line", [["js/pages/edit.js", (s) => s.replace("const noteLimit = mountLimitHint({ input: noteInput, hint: false });", "const noteLimit = mountLimitHint({ input: noteInput, hint: true });")]], ["count"]],
  ["the count is not redrawn when the box goes and comes back", [["js/pages/edit.js", (s) => s.replace("    noteLimit.refresh();                       // the count goes back to 0 of 500 and the paste sentence is gone, ready for the next time the box is put back\n", "").replace(", noteLimit];", "];")]], ["count"]],
  ["the error under the box stays after a note is typed", [["js/pages/edit.js", (s) => s.replace('noteInput.addEventListener("input", () => { if (noteInput.value.trim() !== "" && !noteErrEl.hidden) { noteErrEl.hidden = true; noteErrEl.textContent = ""; noteInput.setAttribute("aria-invalid", "false"); } });', "")]], ["noteRuleUnchanged"]],
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
