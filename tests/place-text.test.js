// place-text.test.js - the place an employer types, in a real browser (prompt BH, October 11, 2026). The repo's own files and a fake backend (tests/fake-site.js; no real project, no key, no network).
//
// THE FORMS (register.html, edit.html): the choice "A place outside the US or not in the list" shows one plain text box in place of the US list. Chosen, the form sends the text and no list place (and on an edit sends
// the list cleared); the same rule as the server (a link, an email address, more than 100 characters, a tab, nothing at all are refused under the box and nothing is sent); Remote stays its own choice.
// THE EDIT PAGE: an opening with a typed place opens with the choice on and the box filled; a change counts as unsaved; moving back to the list sends the text cleared.
// MY OPENINGS (dashboard): the typed place is the opening's place line.
// Then negative controls: one defect at a time in the page code; each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/place-text.test.js
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
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

async function withSite(root, opts, fn) { const site = await startFakeSite(root, opts); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }
const text = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + JSON.stringify(sel) + "); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; })()");
const visible = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + JSON.stringify(sel) + "); return !!e && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none'; })()");
const typeIn = (tab, sel, value) => tab.eval("(() => { const e = document.querySelector(" + JSON.stringify(sel) + "); e.value = " + JSON.stringify(value) + "; e.dispatchEvent(new Event('input', { bubbles: true })); })()");
const click = (tab, sel) => tab.eval("document.querySelector(" + JSON.stringify(sel) + ").click()");
const callsOf = (site, name) => site.calls.filter((c) => c.name === name);
const value = (tab, sel) => tab.eval("document.querySelector(" + JSON.stringify(sel) + ").value");

async function signIn(tab, site) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=poster"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.viewport(1280, false);
}
async function openRegister(tab, site) {
  await signIn(tab, site);
  await tab.goto(site.url + "/register.html");
  await tab.waitFor("!!document.querySelector('#jtitle') && !!document.querySelector('#locOutside') && document.readyState === 'complete'", 10000); await sleep(700);
  await tab.eval("window.confirm = () => true;");
}
async function openEdit(tab, site) {
  await signIn(tab, site);
  await tab.goto(site.url + "/" + EDIT);
  await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden && !!document.querySelector('#jtitle').value", 10000); await sleep(800);
  await tab.eval("window.confirm = () => true;");
}
const fillRegister = async (tab) => { await typeIn(tab, "#jtitle", "Support Analyst"); await typeIn(tab, "#req", "R-2026-77"); await typeIn(tab, "#closeout", "Closes when the role is filled"); await typeIn(tab, "#desc", "A plain description of the role."); };

const SCENARIOS = {
  // ---- register.html
  async choice(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    if ((await text(tab, "label[for=locOutside]")) !== "A place outside the US or not in the list") bad.push("the choice reads '" + (await text(tab, "label[for=locOutside]")) + "'");
    if (!(await visible(tab, "#locCatalog")) || (await visible(tab, "#locTyped"))) bad.push("at the start the list is shown and the text box is not");
    await click(tab, "#locOutside"); await sleep(200);
    if ((await visible(tab, "#locCatalog")) || !(await visible(tab, "#locTyped"))) bad.push("with the choice on, the list is still shown or the text box is not");
    if (!(await tab.eval("document.activeElement && document.activeElement.id === 'loctext'"))) bad.push("the text box does not take focus when the choice is turned on");
    if ((await tab.eval("document.querySelector('#loctext').getAttribute('aria-label')")) !== "A place outside the US or not in the list") bad.push("the box has no accessible name");
    if (!/Shown to candidates as you wrote it\. It is not used to search, sort or filter/.test((await text(tab, "#loctextHint")) || "")) bad.push("the hint is missing");
    await click(tab, "#locOutside"); await sleep(200);
    if (!(await visible(tab, "#locCatalog")) || (await visible(tab, "#locTyped"))) bad.push("turning the choice off does not bring the list back");
    return bad; })); },
  async create(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await fillRegister(tab);
    // a place from the list was chosen first, then the choice "outside the US" is turned on: the list place is neither shown nor sent
    await typeIn(tab, "#locq", "Austin");
    await tab.waitFor("document.querySelectorAll('#locList li').length > 0", 10000);
    await tab.eval("document.querySelector('#locList li').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))"); await sleep(200);
    if (!/Austin/.test((await text(tab, "#locChips")) || "")) bad.push("the list place was not chosen for the test");
    await click(tab, "#locOutside"); await sleep(150);
    await typeIn(tab, "#loctext", "  Lisbon,    Portugal ");
    await click(tab, "#draftBtn");
    await tab.waitFor("document.querySelectorAll('#result *').length > 0 && !document.querySelector('#result').hidden", 8000).catch(() => null); await sleep(400);
    const c = callsOf(site, "create-posting");
    if (c.length !== 1) { bad.push("create-posting was called " + c.length + " times"); return bad; }
    const b = c[0].body;
    if (b.source_location_text !== "Lisbon, Portugal") bad.push("the typed place sent is " + JSON.stringify(b.source_location_text) + " (trimmed and collapsed expected)");
    if ("location_ids" in b || "locations_attested" in b || "locations" in b) bad.push("a list place was sent with the typed place: " + JSON.stringify(Object.keys(b)));
    if (b.is_remote !== false) bad.push("is_remote was " + b.is_remote);
    return bad; })); },
  async createRemote(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await fillRegister(tab);
    await click(tab, "#remote"); await click(tab, "#locOutside"); await sleep(150);
    await typeIn(tab, "#loctext", "Anywhere in Canada");
    await click(tab, "#draftBtn"); await sleep(1200);
    const c = callsOf(site, "create-posting");
    if (c.length !== 1 || c[0].body.is_remote !== true || c[0].body.source_location_text !== "Anywhere in Canada") bad.push("Remote with a typed place sent " + JSON.stringify(c.map((x) => x.body)));
    return bad; })); },
  async createRefused(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await fillRegister(tab);
    await click(tab, "#locOutside"); await sleep(150);
    const CASES = [["", "Enter the place."], ["see https://example.com/jobs", "No web addresses here."], ["jobs.example.com", "No web addresses here."], ["write to jo@example", "No email addresses here."],
      ["x".repeat(101), "Keep it to 100 characters or fewer."], ["Lisbon\tPortugal", "Keep it to plain text on one line."], ["<b>Lisbon</b>", "Keep it to plain text: no < or >."]];
    for (const [v, why] of CASES) {
      await typeIn(tab, "#loctext", v); await click(tab, "#draftBtn"); await sleep(250);
      const shown = await text(tab, '[data-error-for="loctext"]');
      if (shown !== why) bad.push(JSON.stringify(v.slice(0, 30)) + " is answered with '" + shown + "', expected '" + why + "'");
      if (callsOf(site, "create-posting").length) { bad.push("a refused place was sent: " + JSON.stringify(v.slice(0, 30))); break; }
    }
    return bad; })); },
  async createDropped(root) { return withSite(root, { plan: "verified", createDropsPlace: true }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await fillRegister(tab);
    await click(tab, "#locOutside"); await sleep(150);
    await typeIn(tab, "#loctext", "Lisbon, Portugal");
    await click(tab, "#draftBtn"); await sleep(1200);
    const note = (await text(tab, "#placeProblem")) || "";
    if (note !== "The opening was saved, but the place was not. Open it from My openings and type the place again.") bad.push("an answer without the typed place is not told to the person: '" + note + "'");
    return bad; })); },
  async createServerRefused(root) { return withSite(root, { plan: "verified", createRefusal: { status: 400, body: { error: "source_location_text must not contain a web address", field: "source_location_text", errors: [{ field: "source_location_text", message: "source_location_text must not contain a web address" }] } } }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    await fillRegister(tab);
    await click(tab, "#locOutside"); await sleep(150);
    await typeIn(tab, "#loctext", "Lisbon, Portugal");
    await click(tab, "#draftBtn"); await sleep(900);
    if (!/web address/.test((await text(tab, '[data-error-for="loctext"]')) || "")) bad.push("the server's refusal is not shown under the box: '" + (await text(tab, '[data-error-for="loctext"]')) + "'");
    return bad; })); },
  // ---- edit.html
  async editPrefilled(root) { return withSite(root, { plan: "verified", placeText: "Zürich, Switzerland" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    if (!(await tab.eval("document.querySelector('#locOutside').checked"))) bad.push("the choice is not on for an opening with a typed place");
    if ((await value(tab, "#loctext")) !== "Zürich, Switzerland") bad.push("the box holds '" + (await value(tab, "#loctext")) + "'");
    if ((await visible(tab, "#locCatalog")) || !(await visible(tab, "#locTyped"))) bad.push("the list is shown for an opening with a typed place");
    if (await visible(tab, "#unsavedBar")) bad.push("the unsaved bar is up on a fresh load");
    return bad; })); },
  async editChange(root) { return withSite(root, { plan: "verified", placeText: "Zürich, Switzerland" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await typeIn(tab, "#loctext", "Geneva,  Switzerland");
    if (!(await visible(tab, "#unsavedBar"))) bad.push("a changed typed place does not show the unsaved bar");
    await typeIn(tab, "#loctext", "Zürich, Switzerland");
    if (await visible(tab, "#unsavedBar")) bad.push("changing it back left the unsaved bar up");
    await typeIn(tab, "#loctext", "Geneva,  Switzerland");
    await typeIn(tab, "#req", "R-NEW-9"); await typeIn(tab, "#note", "Moved to Geneva");
    await click(tab, "#saveBtn");
    await tab.waitFor("(() => true)()", 1000); await sleep(1200);
    const c = callsOf(site, "edit-posting");
    if (c.length !== 1) { bad.push("edit-posting was called " + c.length + " times"); return bad; }
    const b = c[0].body;
    if (b.source_location_text !== "Geneva, Switzerland") bad.push("the typed place sent is " + JSON.stringify(b.source_location_text));
    if ("location_ids" in b) bad.push("the (empty) list was sent although it did not change: " + JSON.stringify(b.location_ids));
    if (b.req_number !== "R-NEW-9" || b.change_note !== "Moved to Geneva") bad.push("the new req number and note were not sent: " + JSON.stringify(b));
    return bad; })); },
  async editToTyped(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await click(tab, "#locOutside"); await sleep(150);
    await typeIn(tab, "#loctext", "Osaka, Japan");
    await typeIn(tab, "#req", "R-NEW-10"); await typeIn(tab, "#note", "A different office");
    await click(tab, "#saveBtn"); await sleep(1400);
    const c = callsOf(site, "edit-posting");
    if (c.length !== 1) { bad.push("edit-posting was called " + c.length + " times"); return bad; }
    const b = c[0].body;
    if (b.source_location_text !== "Osaka, Japan" || JSON.stringify(b.location_ids) !== "[]") bad.push("moving to a typed place must send the text and the list cleared: " + JSON.stringify(b));
    return bad; })); },
  async editToList(root) { return withSite(root, { plan: "verified", placeText: "Zürich, Switzerland" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await click(tab, "#locOutside"); await sleep(200);
    await typeIn(tab, "#locq", "Austin");
    await tab.waitFor("document.querySelectorAll('#locList li').length > 0", 10000);
    await tab.eval("document.querySelector('#locList li').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))"); await sleep(300);
    await typeIn(tab, "#req", "R-NEW-11"); await typeIn(tab, "#note", "Back to a US office");
    await click(tab, "#saveBtn"); await sleep(1400);
    const c = callsOf(site, "edit-posting");
    if (c.length !== 1) { bad.push("edit-posting was called " + c.length + " times (" + (await text(tab, "#formAlert")) + ")"); return bad; }
    const b = c[0].body;
    if (b.source_location_text !== null || !Array.isArray(b.location_ids) || b.location_ids.length !== 1) bad.push("moving back to the list must send the list place and the text cleared (null): " + JSON.stringify(b));
    return bad; })); },
  async editRefused(root) { return withSite(root, { plan: "verified", placeText: "Zürich, Switzerland" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await typeIn(tab, "#req", "R-NEW-12"); await typeIn(tab, "#note", "x");
    for (const [v, why] of [["https://example.com", "No web addresses here."], ["jo@example", "No email addresses here."], ["", "Enter the place."]]) {
      await typeIn(tab, "#loctext", v); await click(tab, "#saveBtn"); await sleep(300);
      if ((await text(tab, '[data-error-for="loctext"]')) !== why) bad.push(JSON.stringify(v) + " is answered with '" + (await text(tab, '[data-error-for="loctext"]')) + "'");
    }
    if (callsOf(site, "edit-posting").length) bad.push("a refused place was sent");
    return bad; })); },
  // ---- dashboard.html
  async dashboard(root) { return withSite(root, { plan: "verified", placeText: "Zürich, Switzerland" }, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site);
    await tab.goto(site.url + "/dashboard.html");
    await tab.waitFor("document.querySelectorAll('tbody tr').length > 0", 10000); await sleep(600);
    const first = await text(tab, "tbody tr");
    if (!/Zürich, Switzerland/.test(first || "")) bad.push("the first opening's place line is not the typed place: '" + first + "'");
    return bad; })); },
};

for (const [name, run] of Object.entries(SCENARIOS)) {
  test("the typed place, " + name, { timeout: 180000 }, async () => {
    const bad = await run(ROOT);
    assert.deepEqual(bad, [], bad.join("\n"));
  });
}

// ---- negative controls: one defect at a time in the page code; each must make a scenario fail
const DEFECTS = [
  ["turning the choice on leaves the list shown", [["js/place-choice.js", (s) => s.replace("typed.hidden = !choice.checked; catalog.hidden = choice.checked;", "typed.hidden = !choice.checked;")]], ["choice", "editPrefilled"]],
  ["a list place is sent together with the typed place (register)", [["js/pages/register.js", (s) => s.replace("locEntries: place.outside() ? [] : picker.get().entries", "locEntries: picker.get().entries")], ["js/register-form.js", (s) => s.replace("  else {\n    if (chosen.length) body.location_ids", "  {\n    if (chosen.length) body.location_ids")]], ["create"]],
  ["the register request does not carry the typed place", [["js/register-form.js", (s) => s.replace("if (v.outside === true) body[PLACE_FIELD] = collapsePlaceText(v.locText);", "if (false) body[PLACE_FIELD] = collapsePlaceText(v.locText);")]], ["create", "createRemote"]],
  ["an answer without the typed place is not told to the person", [["js/pages/register.js", (s) => s.replace("state.placeProblem = values.outside === true && storedPlaceText(created.data) !== collapsePlaceText(values.locText) ? PLACE_WORDS.NOT_SAVED : null;", "state.placeProblem = null;")]], ["createDropped"]],
  ["the typed place is not judged on the register form", [["js/register-form.js", (s) => s.replace("if (v.outside === true) { const p = placeTextProblem(collapsePlaceText(v.locText)); if (p) e.loctext = p; }", "if (v.outside === true) { /* not judged */ }")]], ["createRefused"]],
  ["the typed place is not judged on the edit form", [["js/edit-form.js", (s) => s.replace("if (PLACE_FIELD in changed) { const p = placeTextProblem(changed[PLACE_FIELD]); if (p) e.loctext = p; }", "")]], ["editRefused"]],
  ["the edit form does not send the list cleared when moving to a typed place", [["js/pages/edit.js", (s) => s.replace("locEntries: place.outside() ? [] : picker.get().entries", "locEntries: picker.get().entries")]], ["editToTyped"]],
  ["the stored typed place is not put in the box", [["js/pages/edit.js", (s) => s.replace("place.set((p.location_ids || []).length === 0 ? storedPlaceText(p) : \"\");", "place.set(\"\");")]], ["editPrefilled", "editChange"]],
  ["a changed typed place is not counted as unsaved work", [["js/dirty-state.js", (s) => s.replace("place: v.outside === true ? trim(v.locText) : null, ", "")]], ["editChange"]],
  ["moving back to the list does not clear the typed place", [["js/edit-form.js", (s) => s.replace("if (typed !== wasTyped) ch[PLACE_FIELD] = typed;", "if (typed !== wasTyped && typed !== null) ch[PLACE_FIELD] = typed;")]], ["editToList"]],
  ["My openings shows only the list place", [["js/pages/dashboard.js", (s) => s.replace("placeNodes(h, p, { note: false, hideNone: true })", "(Array.isArray(p.locations) && p.locations.length ? p.locations.join(\"; \") : \"Location not stated\")")]], ["dashboard"]],
];
test("negative controls: each defect in the typed place's page code makes a scenario fail", { timeout: 1800000 }, async () => {
  const missed = [];
  for (const [label, edits, scenarios] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-place-ctl-"));
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
