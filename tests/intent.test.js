// intent.test.js - the employer's optional statement of the kind of an opening, in a real browser (prompt ST1, October 14, 2026). The repo's own files and a fake backend (tests/fake-site.js; no real project,
// no key, no network).
//
// THE FORMS (register.html, edit.html): one optional choice, "Not stated" or one of four kinds with the employer's labels read from the database (so staff can reword them with no deploy); a date box that is in
// the page only for the two kinds that take one; nothing is sent when nothing is chosen; a kind that needs a date and has none is refused under the box and nothing is sent; a database that cannot take the
// statement (an answer without the field, or no list) leaves the choice out of the page and nothing is sent for it.
// THE EDIT PAGE: the stored kind and date are shown; only what changed is sent; taking it away sends the word not_stated; a live opening needs a change note, as for every change.
// THE CANDIDATE'S SCREENS: the search card and the comments page show "The employer says: ..." beside the AI lines, only for a sentence that begins that way, and nothing when the kind is not stated.
// Then negative controls: one defect at a time in the page code; each must make a scenario fail.
// A missing browser FAILS the test (set FGJ_BROWSER). Run: node --test tests/intent.test.js
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./cdp-tabs.js";
import { startFakeSite, INTENT_OPTIONS } from "./fake-site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EDIT = "edit.html?id=3f1d5b1e-0000-4000-8000-000000000001";
const REF = "d21m48ybzqbfxxxxxxxx";
const FORBIDDEN = /complian|certif|verif|\bpostings?\b|s ?8877|satisf/i;
let browser;
before(async () => { browser = await launchBrowser(); });
after(async () => { if (browser) await browser.close(); });

async function withSite(root, opts, fn) { const site = await startFakeSite(root, opts); try { return await fn(site); } finally { await site.close(); } }
async function withTab(fn) { const tab = await browser.newTab(); try { return await fn(tab); } finally { await tab.close(); } }
const text = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + JSON.stringify(sel) + "); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; })()");
const visible = (tab, sel) => tab.eval("(() => { const e = document.querySelector(" + JSON.stringify(sel) + "); return !!e && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none'; })()");
const typeIn = (tab, sel, value) => tab.eval("(() => { const e = document.querySelector(" + JSON.stringify(sel) + "); e.value = " + JSON.stringify(value) + "; e.dispatchEvent(new Event('input', { bubbles: true })); })()");
const choose = (tab, value) => tab.eval("(() => { const e = document.querySelector('#intentSelect'); e.value = " + JSON.stringify(value) + "; e.dispatchEvent(new Event('change', { bubbles: true })); })()");
const click = (tab, sel) => tab.eval("document.querySelector(" + JSON.stringify(sel) + ").click()");
const callsOf = (site, name) => site.calls.filter((c) => c.name === name);
const value = (tab, sel) => tab.eval("document.querySelector(" + JSON.stringify(sel) + ").value");
const optionTexts = (tab) => tab.eval("[...document.querySelectorAll('#intentSelect option')].map((o) => o.value + '=' + o.textContent)");

async function signIn(tab, site) {
  await tab.focusEmulation(true);
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=poster"); await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.viewport(1280, false);
}
async function openRegister(tab, site) {
  await signIn(tab, site);
  await tab.goto(site.url + "/register.html");
  await tab.waitFor("!!document.querySelector('#jtitle') && !!document.querySelector('#intentSelect') && document.readyState === 'complete'", 10000); await sleep(900);
  await tab.eval("window.confirm = () => true;");
}
async function openEdit(tab, site) {
  await signIn(tab, site);
  await tab.goto(site.url + "/" + EDIT);
  await tab.waitFor("document.querySelector('#form') && !document.querySelector('#form').hidden && !!document.querySelector('#jtitle').value", 10000); await sleep(900);
  await tab.eval("window.confirm = () => true;");
}
const fillRegister = async (tab) => { await typeIn(tab, "#jtitle", "Support Analyst"); await typeIn(tab, "#req", "R-2026-77"); await typeIn(tab, "#closeout", "Closes when the role is filled"); await typeIn(tab, "#desc", "A plain description of the role."); };
async function openSearch(tab, site) {
  await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
  await tab.goto(site.url + "/_dev/link?kind=candidate");
  await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
  await tab.goto(site.url + "/search.html");
  await tab.waitFor("!!document.querySelector('#company') && document.readyState === 'complete'"); await sleep(900);
  await tab.eval("(() => { document.querySelector('#company').value = 'Meridian'; document.querySelector('#titleq').value = 'Analyst'; document.querySelector('#searchForm').requestSubmit(); })()");
  await tab.waitFor("document.querySelectorAll('#results .card').length > 0 && !document.querySelector('#searchBtn').disabled", 12000); await sleep(400);
}
const LINE = "The employer says: Current vacancy, fill by Dec 1, 2026";
const CUSTOM = INTENT_OPTIONS.map((o, i) => ({ ...o, label: ["Hiring now, by a date", "Hiring later, after a date", "Collecting applications", "A rule requires this ad"][i] }));

const SCENARIOS = {
  // ---- register.html
  async registerChoice(root) { return withSite(root, { plan: "verified", intent: true, intentOptions: CUSTOM }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    if (!(await visible(tab, "#intentRow"))) return ["the choice is not in the page"];
    const o = await optionTexts(tab);
    const want = ["=Not stated", "fill_by=Hiring now, by a date", "fill_no_sooner=Hiring later, after a date", "not_current=Collecting applications", "legal_requirement=A rule requires this ad"];
    if (JSON.stringify(o) !== JSON.stringify(want)) bad.push("the options are " + JSON.stringify(o) + " (the labels must be the database's, with Not stated first)");
    if ((await value(tab, "#intentSelect")) !== "") bad.push("the choice does not start as Not stated");
    if (await visible(tab, "#intentDateRow")) bad.push("the date box is shown before anything is chosen");
    if (await visible(tab, "#intentMeaning")) bad.push("a meaning is shown for Not stated");
    await choose(tab, "fill_by"); await sleep(150);
    if (!(await visible(tab, "#intentDateRow")) || (await text(tab, "#intentDateLabel")) !== "Fill by (date)") bad.push("fill by: the date box or its label is wrong: " + (await text(tab, "#intentDateLabel")));
    if ((await text(tab, "#intentMeaning")) !== INTENT_OPTIONS[0].meaning) bad.push("the meaning of the kind is not shown");
    await choose(tab, "fill_no_sooner"); await sleep(150);
    if (!(await visible(tab, "#intentDateRow")) || (await text(tab, "#intentDateLabel")) !== "Earliest fill date") bad.push("fill no sooner: the date label is wrong: " + (await text(tab, "#intentDateLabel")));
    await typeIn(tab, "#intentDate", "2027-01-09");
    await choose(tab, "not_current"); await sleep(150);
    if (await visible(tab, "#intentDateRow")) bad.push("a kind that takes no date shows the date box");
    if ((await value(tab, "#intentDate")) !== "") bad.push("the date typed before the kind changed is still in the box");
    const words = (await text(tab, "#intentRow")) || "";
    if (FORBIDDEN.test(words)) bad.push("the words of the choice hold a forbidden word: " + words);
    return bad; })); },
  async registerDefault(root) { return withSite(root, { plan: "verified", intent: true }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site); await fillRegister(tab);
    await click(tab, "#remote"); await sleep(100);
    await click(tab, "#draftBtn"); await sleep(1500);
    const c = callsOf(site, "create-posting");
    if (c.length !== 1) return ["create-posting was called " + c.length + " times (" + (await text(tab, "#formAlert")) + ")"];
    const b = c[0].body;
    if ("intent_statement" in b || "intent_date" in b) bad.push("nothing was chosen, yet the request carries the kind: " + JSON.stringify(b));
    return bad; })); },
  async registerStated(root) { return withSite(root, { plan: "verified", intent: true }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site); await fillRegister(tab);
    await click(tab, "#remote"); await sleep(100);
    await choose(tab, "fill_by"); await typeIn(tab, "#intentDate", "2026-12-01");
    await click(tab, "#draftBtn"); await sleep(1500);
    const c = callsOf(site, "create-posting");
    if (c.length !== 1) return ["create-posting was called " + c.length + " times (" + (await text(tab, "#formAlert")) + ")"];
    const b = c[0].body;
    if (b.intent_statement !== "fill_by" || b.intent_date !== "2026-12-01") bad.push("fill by with its day was not sent: " + JSON.stringify(b));
    return bad; })); },
  async registerNoDate(root) { return withSite(root, { plan: "verified", intent: true }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site); await fillRegister(tab);
    await click(tab, "#remote"); await sleep(100);
    await choose(tab, "legal_requirement");
    await typeIn(tab, "#intentDate", "2026-12-01");   // no box for it: nothing, even if a script put a value there
    await click(tab, "#draftBtn"); await sleep(1500);
    const c = callsOf(site, "create-posting");
    if (c.length !== 1) return ["create-posting was called " + c.length + " times (" + (await text(tab, "#formAlert")) + ")"];
    const b = c[0].body;
    if (b.intent_statement !== "legal_requirement" || "intent_date" in b) bad.push("a kind that takes no date was sent with one: " + JSON.stringify(b));
    return bad; })); },
  async registerDateMissing(root) { return withSite(root, { plan: "verified", intent: true }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site); await fillRegister(tab);
    await click(tab, "#remote"); await sleep(100);
    await choose(tab, "fill_no_sooner");
    await click(tab, "#draftBtn"); await sleep(700);
    const e = await text(tab, '[data-error-for="intentDate"]');
    if (e !== "Choose the date that goes with this kind of opening.") bad.push("the refusal under the box reads '" + e + "'");
    if (callsOf(site, "create-posting").length) bad.push("a kind that needs a date was sent without one");
    return bad; })); },
  async registerUnavailable(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await signIn(tab, site);
    await tab.goto(site.url + "/register.html");
    await tab.waitFor("!!document.querySelector('#jtitle') && document.readyState === 'complete'", 10000); await sleep(1200);
    if (await visible(tab, "#intentRow")) bad.push("the choice is in the page although the database cannot take it");
    await fillRegister(tab); await click(tab, "#remote"); await sleep(100);
    await click(tab, "#draftBtn"); await sleep(1500);
    const c = callsOf(site, "create-posting");
    if (c.length !== 1) return bad.concat(["create-posting was called " + c.length + " times"]);
    if ("intent_statement" in c[0].body || "intent_date" in c[0].body) bad.push("the request carries the kind although the page could not offer it");
    return bad; })); },
  async registerUnsaved(root) { return withSite(root, { plan: "verified", intent: true }, (site) => withTab(async (tab) => { const bad = [];
    await openRegister(tab, site);
    if (await visible(tab, "#unsavedBar")) bad.push("the unsaved bar is up on a fresh page");
    await choose(tab, "not_current"); await sleep(300);
    if (!(await visible(tab, "#unsavedBar"))) bad.push("choosing a kind does not count as unsaved work");
    await choose(tab, ""); await sleep(300);
    if (await visible(tab, "#unsavedBar")) bad.push("choosing Not stated again left the unsaved bar up");
    return bad; })); },
  // ---- edit.html
  async editPrefilled(root) { return withSite(root, { plan: "verified", intent: true, intentValue: { code: "fill_by", date: "2026-12-01" } }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    if ((await value(tab, "#intentSelect")) !== "fill_by") bad.push("the stored kind is not selected: '" + (await value(tab, "#intentSelect")) + "'");
    if (!(await visible(tab, "#intentDateRow")) || (await value(tab, "#intentDate")) !== "2026-12-01") bad.push("the stored date is not in its box: '" + (await value(tab, "#intentDate")) + "'");
    if (await visible(tab, "#unsavedBar")) bad.push("the unsaved bar is up on a fresh load");
    return bad; })); },
  async editChangeDay(root) { return withSite(root, { plan: "verified", intent: true, intentValue: { code: "fill_by", date: "2026-12-01" } }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await typeIn(tab, "#intentDate", "2026-12-20"); await sleep(300);
    if (!(await visible(tab, "#unsavedBar"))) bad.push("a changed date does not count as unsaved");
    await typeIn(tab, "#note", "The date moved");
    await click(tab, "#saveBtn"); await sleep(1500);
    const c = callsOf(site, "edit-posting");
    if (c.length !== 1) return bad.concat(["edit-posting was called " + c.length + " times (" + (await text(tab, "#formAlert")) + ")"]);
    const b = c[0].body;
    if (b.intent_date !== "2026-12-20" || "intent_statement" in b) bad.push("only the changed date must be sent: " + JSON.stringify(b));
    return bad; })); },
  async editTakeAway(root) { return withSite(root, { plan: "verified", intent: true, intentValue: { code: "fill_by", date: "2026-12-01" } }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await choose(tab, ""); await sleep(200);
    if (await visible(tab, "#intentDateRow")) bad.push("the date box stays after Not stated is chosen");
    await typeIn(tab, "#note", "No longer stating the kind");
    await click(tab, "#saveBtn"); await sleep(1500);
    const c = callsOf(site, "edit-posting");
    if (c.length !== 1) return bad.concat(["edit-posting was called " + c.length + " times (" + (await text(tab, "#formAlert")) + ")"]);
    if (c[0].body.intent_statement !== "not_stated") bad.push("taking the kind away must send the word not_stated: " + JSON.stringify(c[0].body));
    return bad; })); },
  async editOtherChange(root) { return withSite(root, { plan: "verified", intent: true, intentValue: { code: "not_current", date: null } }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await typeIn(tab, "#jtitle", "Data Analyst II"); await typeIn(tab, "#note", "Level fixed");
    await click(tab, "#saveBtn"); await sleep(1500);
    const c = callsOf(site, "edit-posting");
    if (c.length !== 1) return bad.concat(["edit-posting was called " + c.length + " times"]);
    if ("intent_statement" in c[0].body || "intent_date" in c[0].body) bad.push("an edit of the title carries the kind: " + JSON.stringify(c[0].body));
    return bad; })); },
  async editNeedsNote(root) { return withSite(root, { plan: "verified", intent: true }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    await choose(tab, "legal_requirement"); await sleep(200);
    await click(tab, "#saveBtn"); await sleep(600);
    if (callsOf(site, "edit-posting").length) bad.push("a change of the kind on a live opening was sent with no change note");
    const n = (await text(tab, '[data-error-for="note"]')) || "";
    if (!/Say what changed and why/.test(n)) bad.push("the note is not asked for: '" + n + "'");
    return bad; })); },
  async editOld(root) { return withSite(root, { plan: "verified" }, (site) => withTab(async (tab) => { const bad = [];
    await openEdit(tab, site);
    if (await visible(tab, "#intentRow")) bad.push("the choice is in the page for an answer that has no such field");
    await typeIn(tab, "#jtitle", "Data Analyst II"); await typeIn(tab, "#note", "Level fixed");
    await click(tab, "#saveBtn"); await sleep(1500);
    const c = callsOf(site, "edit-posting");
    if (c.length !== 1) return bad.concat(["edit-posting was called " + c.length + " times"]);
    if ("intent_statement" in c[0].body || "intent_date" in c[0].body) bad.push("a page that could not offer the choice sent it");
    return bad; })); },
  // ---- the candidate's screens
  async searchCard(root) { return withSite(root, { placeOverrides: [{ intent_line: LINE }, { intent_line: "Current vacancy, fill by Dec 1, 2026" }] }, (site) => withTab(async (tab) => { const bad = [];
    await openSearch(tab, site);
    const cards = await tab.eval("[...document.querySelectorAll('#results .card')].map((c) => ({ intent: [...c.querySelectorAll('.intent-note')].map((n) => n.innerText.replace(/\\s+/g, ' ').trim()), ai: c.querySelectorAll('.ai-note:not(.intent-note)').length }))");
    if (cards.length !== 2) return ["expected 2 cards, got " + cards.length];
    if (cards[0].intent.length !== 1 || !cards[0].intent[0].endsWith(LINE)) bad.push("the first card does not show the kind of opening: " + JSON.stringify(cards[0].intent));
    if (cards[1].intent.length !== 0) bad.push("a sentence that does not begin The employer says was shown: " + JSON.stringify(cards[1].intent));
    return bad; })); },
  async searchCardNothing(root) { return withSite(root, {}, (site) => withTab(async (tab) => { const bad = [];
    await openSearch(tab, site);
    const n = await tab.eval("document.querySelectorAll('#results .intent-note').length");
    if (n !== 0) bad.push("an opening that states no kind shows " + n + " kind of opening line(s)");
    if (/The employer says/.test((await text(tab, "#results")) || "")) bad.push("The employer says appears on a card that states nothing");
    return bad; })); },
  async commentsPage(root) { return withSite(root, { detailOverride: { intent_line: LINE } }, (site) => withTab(async (tab) => { const bad = [];
    await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
    await tab.goto(site.url + "/_dev/link?kind=candidate");
    await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
    await tab.goto(site.url + "/comments.html?ref=" + REF);
    await tab.waitFor("!document.querySelector('#threadWrap').hidden || !document.querySelector('#pageAlert').hidden", 10000); await sleep(500);
    const t = (await text(tab, "#recapNotes")) || "";
    if (!t.includes(LINE)) bad.push("the comments page does not show the kind of opening: '" + t + "' (page alert: '" + (await text(tab, "#pageAlert")) + "', thread shown: " + (await visible(tab, "#threadWrap")) + ", recap: '" + (await text(tab, "#recap")) + "')");
    return bad; })); },
  async commentsPageNothing(root) { return withSite(root, {}, (site) => withTab(async (tab) => { const bad = [];
    await tab.goto(site.url + "/404.html"); await tab.eval("try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}");
    await tab.goto(site.url + "/_dev/link?kind=candidate");
    await tab.waitFor("location.pathname.indexOf('auth-callback') < 0 && !!localStorage.getItem('fgj-auth')", 10000); await sleep(500);
    await tab.goto(site.url + "/comments.html?ref=" + REF);
    await tab.waitFor("!document.querySelector('#threadWrap').hidden || !document.querySelector('#pageAlert').hidden", 10000); await sleep(500);
    const t = (await text(tab, "#recapNotes")) || "";
    if (/The employer says/.test(t)) bad.push("the comments page shows a kind of opening for an opening that states none: '" + t + "'");
    return bad; })); },
};

for (const [name, run] of Object.entries(SCENARIOS)) {
  test("the kind of opening, " + name, { timeout: 180000 }, async () => {
    const bad = await run(ROOT);
    assert.deepEqual(bad, [], bad.join("\n"));
  });
}

// ---- negative controls: one defect at a time in the page code; each must make a scenario fail
const DEFECTS = [
  ["the date box stays shown for a kind that takes none", [["js/intent-box.js", (s) => s.replace("dateRow.hidden = !needs;", "dateRow.hidden = false;")]], ["registerChoice"]],
  ["the date is not required on the register form", [["js/register-form.js", (s) => s.replace("{ const p = intentProblem(v.intent, v.intentDate); if (p) e.intentDate = p; }", "{ /* not judged */ }")]], ["registerDateMissing"]],
  ["a day under a kind that takes none is sent", [["js/intent-statement.js", (s) => s.replace("return takesDate(c) ? { intent_statement: c, intent_date: String(date).trim() } : { intent_statement: c };", "return { intent_statement: c, intent_date: String(date).trim() };")]], ["registerNoDate"]],
  ["a kind is sent when nothing was chosen", [["js/intent-statement.js", (s) => s.replace("  if (!INTENT_CODES.includes(c)) return {};\n  return takesDate(c)", "  if (!INTENT_CODES.includes(c)) return { intent_statement: \"not_current\" };\n  return takesDate(c)")]], ["registerDefault"]],
  ["the labels are the page's own, not the database's", [["js/intent-box.js", (s) => s.replace("options = optionsFor(list, current);", "options = optionsFor(null, current);")]], ["registerChoice"]],
  ["the choice is shown when the database cannot take it (register)", [["js/pages/register.js", (s) => s.replace("else intent.hide();", "else { /* shown anyway */ }")]], ["registerUnavailable"]],
  ["the choice is shown for an answer without the field (edit)", [["js/pages/edit.js", (s) => s.replace("intent.hide();\n    else {", "{ /* shown anyway */ }\n    {")]], ["editOld"]],
  ["choosing a kind is not unsaved work", [["js/dirty-state.js", (s) => s.replace("return { intent: code, intentDate: takesDate(code) ? trim(v.intentDate) : \"\" }; };", "return {}; };")]], ["registerUnsaved", "editChangeDay"]],
  ["the editor does not put the stored kind in the box", [["js/pages/edit.js", (s) => s.replace("intent.set(p.intent_statement || \"\", p.intent_date || \"\");", "intent.set(\"\", \"\");")]], ["editPrefilled", "editTakeAway"]],
  ["an edit that changed nothing about the kind sends it", [["js/edit-form.js", (s) => s.replace("if (v.intent !== undefined) Object.assign(ch, intentChange({ intent_statement: orig.intent_statement, intent_date: orig.intent_date }, v.intent, v.intentDate));", "if (v.intent !== undefined && v.intent !== \"\") ch.intent_statement = v.intent;")]], ["editOtherChange"]],
  ["taking the kind away sends null (which leaves it alone)", [["js/intent-statement.js", (s) => s.replace("{ intent_statement: \"not_stated\" };", "{ intent_statement: null };")]], ["editTakeAway"]],
  ["the editor sends the whole kind when only the day changed", [["js/intent-statement.js", (s) => s.replace("if (c !== was) out.intent_statement = c;", "out.intent_statement = c;")]], ["editChangeDay"]],
  ["the search card does not show the kind of opening", [["js/pages/search.js", (s) => s.replace("...intentNotes(row).map(", "...[].map(")]], ["searchCard"]],
  ["the comments page does not show the kind of opening", [["js/pages/comments.js", (s) => s.replace("[...aiNotes(p), ...intentNotes(p)]", "[...aiNotes(p)]")]], ["commentsPage"]],
  ["a sentence that does not begin The employer says is shown", [["js/intent-statement.js", (s) => s.replace("|| !s.startsWith(INTENT_LINE_START)", "")]], ["searchCard"]],
];
test("negative controls: each defect in the kind of opening's page code makes a scenario fail", { timeout: 3600000 }, async () => {
  const missed = [];
  for (const [label, edits, scenarios] of DEFECTS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fgj-intent-ctl-"));
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
