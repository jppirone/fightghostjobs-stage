// unsaved.test.js - the edit page must never let an employer leave with work that was not saved, and must say so calmly.
//   * js/dirty-state.js (pure): what counts as unsaved, compared with a snapshot of what was last loaded or saved, normalised the way the save normalises; the words
//   * js/unsaved-guard.js: the bar, the browser's leave-page question (beforeunload), the Save / Discard / Stay dialog, focus and keys, on a tiny fake DOM (no browser here)
//   * a small model of the page (the same moves edit.js makes: snapshot at load, compare, save, fail, revert) so the sequence "change, revert, save, failed save" is exercised end to end
//   * the page's own source and markup, for the wiring that cannot run without a browser
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { changedFields } from "../js/edit-form.js";
import { snapshotOf, valuesFromPosting, formDirty, rowsTyped, earlyRules, summarize, linkLeaves, capKey, UNSAVED, PANEL } from "../js/dirty-state.js";
import { mountUnsavedGuard } from "../js/unsaved-guard.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const ID = "3f1d5b1e-0000-4000-8000-000000000001";
const AUSTIN = { id: "gn:4671654", kind: "place", display: "Austin, TX" }, DALLAS = { id: "gn:4684888", kind: "place", display: "Dallas, TX" };
const posting = (o) => Object.assign({ id: ID, title: "Data Analyst", req_number: "R-100", company_name: "Acme", post_id: "ABCDEFGHJKMN", status: "live", stored_status: "live", is_remote: false, locations: ["Austin, TX"], location_ids: [AUSTIN.id],
  locations_attested: false, ai_filtering: false, ai_interview_other: null, ai_filtering_note: null, ai_interview_note: null, third_party_recruiter: false, req_searchable: true, destination_links_exclusive: false, applicant_cap: null, description_text: "Analyse the data." }, o || {});
const baselineOf = (p, planActive) => snapshotOf(valuesFromPosting(p, { planActive: !!planActive }));
const form = (o) => Object.assign({ title: "Data Analyst", req: "R-100", desc: "Analyse the data.", locEntries: [AUSTIN], attested: false, remote: false, appcap: "", aiFilter: false, aiInterview: null, aiFilterNote: "", aiInterviewNote: "", recruiter: false, reqSearchable: true, exclusive: undefined, note: "" }, o || {});

// ---- what counts as unsaved
test("nothing is unsaved straight after loading; the change note alone is not a change", () => {
  const b = baselineOf(posting());
  assert.equal(formDirty(b, form()), false);
  assert.equal(formDirty(b, form({ note: "I will explain later" })), false, "a note with nothing changed cannot be saved, so it is not an unsaved change");
  assert.equal(formDirty(null, form({ title: "x" })), false, "no snapshot yet (nothing loaded): never dirty");
});

test("every field the Save changes button covers makes the form unsaved, and putting it back clears it", () => {
  const plan = true, p = posting({ ai_filtering: true, ai_filtering_note: "ATS keyword match", ai_interview_other: true, ai_interview_note: "Recorded video" });
  const b = baselineOf(p, plan), same = form({ aiFilter: true, aiInterview: true, aiFilterNote: "ATS keyword match", aiInterviewNote: "Recorded video", exclusive: false });
  assert.equal(formDirty(b, same), false);
  const moves = {
    "job title": { title: "Senior Data Analyst" }, "req number": { req: "R-200" }, "description": { desc: "Analyse the data. Report weekly." }, "locations": { locEntries: [AUSTIN, DALLAS] },
    "a different location": { locEntries: [DALLAS] }, "remote": { remote: true }, "one-opening statement": { locEntries: [AUSTIN, DALLAS], attested: true }, "applicant cap": { appcap: "25" },
    "AI filtering answer": { aiFilter: false, aiFilterNote: "" }, "AI interviewing answer": { aiInterview: false, aiInterviewNote: "" }, "AI filtering note": { aiFilterNote: "Keyword match, then a recruiter" },
    "AI interviewing note": { aiInterviewNote: "" }, "recruiter toggle": { recruiter: true }, "req searchable": { reqSearchable: false }, "exclusive toggle": { exclusive: true },
  };
  for (const [name, change] of Object.entries(moves)) {
    assert.equal(formDirty(b, Object.assign({}, same, change)), true, name + " must count as unsaved");
    const back = {}; for (const k of Object.keys(change)) back[k] = same[k];
    assert.equal(formDirty(b, Object.assign({}, same, change, back)), false, name + ": reverted to the original value, it is not unsaved any more");
  }
});

test("it agrees with what Save would send: whatever changedFields reports as changed is unsaved, whatever it does not report is not", () => {
  const p = posting({ ai_filtering: true, ai_filtering_note: "n", applicant_cap: 25 }), b = baselineOf(p, true);
  const base = form({ aiFilter: true, aiFilterNote: "n", appcap: "25", exclusive: false });
  const variants = [{}, { title: "  Data Analyst  " }, { title: "Data Analyst II" }, { req: " R-100 " }, { desc: " Analyse the data.\n" }, { appcap: "025" }, { appcap: " 25 " }, { appcap: "26" }, { appcap: "" }, { aiFilterNote: "  n " }, { aiFilterNote: "m" },
    { aiInterviewNote: "typed while the toggle is off" }, { attested: true }, { recruiter: true }, { reqSearchable: false }, { remote: true }, { locEntries: [DALLAS] }, { exclusive: true }];
  for (const v of variants) {
    const vals = Object.assign({}, base, v), sends = Object.keys(changedFields(p, Object.assign({ aiInterview: null }, vals))).length > 0;
    assert.equal(formDirty(b, vals), sends, JSON.stringify(v));
  }
});

test("whitespace is normalised the way the save normalises it: padding, a trailing newline, line-break style and a leading zero are not changes", () => {
  const b = baselineOf(posting({ description_text: "Line one\nLine two", applicant_cap: 7 }));
  const same = form({ desc: "Line one\nLine two", appcap: "7" });
  assert.equal(formDirty(b, same), false);
  assert.equal(formDirty(b, Object.assign({}, same, { title: "   Data Analyst   ", req: "  R-100", desc: "  Line one\nLine two\n\n", appcap: " 007 " })), false);
  assert.equal(formDirty(baselineOf(posting({ description_text: "Line one\r\nLine two" })), form({ desc: "Line one\nLine two" })), false, "a stored text with Windows line breaks reads back from a text box with plain ones: not a change on load");
  assert.equal(formDirty(b, Object.assign({}, same, { desc: "Line one\nLine  two" })), true, "a real difference inside the text is a change");
  assert.equal(capKey("0"), "0"); assert.equal(capKey("abc"), "abc"); assert.equal(formDirty(baselineOf(posting()), form({ appcap: "abc" })), true, "a cap typed wrongly is still something typed and not saved");
});

test("an AI note only counts while its toggle is on, and a one-opening statement only with two or more places (the save drops them otherwise)", () => {
  const b = baselineOf(posting({ ai_filtering: false }));
  assert.equal(formDirty(b, form({ aiFilter: false, aiFilterNote: "typed, then the toggle was turned off" })), false);
  assert.equal(formDirty(b, form({ attested: true })), false, "one place: the statement is not in use");
  const never = baselineOf(posting({ ai_interview_other: null })); assert.equal(formDirty(never, form({ aiInterview: null })), false);
  assert.equal(formDirty(never, form({ aiInterview: true })), true, "an answer never stated, now stated: unsaved");
});

test("typed rows in the sections that save separately: blank boxes are not work, anything else is", () => {
  assert.equal(rowsTyped([{ url: "", label: "" }, { url: "  ", label: "" }]), false);
  assert.equal(rowsTyped([{ url: "", label: "" }, { url: "", label: "Careers" }]), true);
  assert.equal(rowsTyped([{ name: "", url: "https://x.example" }]), true);
  assert.equal(rowsTyped([{ name: "Acme Staffing", url: "" }]), true);
  assert.equal(rowsTyped(undefined), false); assert.equal(rowsTyped([]), false);
});

test("the rules found only on Save are shown as soon as they apply: a live or paused posting needs the note; a draft does not; the title rule appears when the title is changed", () => {
  const live = posting(), paused = posting({ stored_status: "paused", status: "paused" }), draft = posting({ stored_status: "draft", status: "draft" });
  assert.deepEqual(earlyRules(live, form(), false), { noteRequired: false, noteMissing: false, titleRule: false }, "nothing changed: nothing is required yet");
  assert.deepEqual(earlyRules(live, form({ desc: "x" }), true), { noteRequired: true, noteMissing: true, titleRule: false });
  assert.deepEqual(earlyRules(live, form({ desc: "x", note: "Typo" }), true), { noteRequired: true, noteMissing: false, titleRule: false });
  assert.equal(earlyRules(live, form({ desc: "x", note: "   " }), true).noteMissing, true, "blanks are not a note");
  assert.equal(earlyRules(paused, form({ recruiter: true }), true).noteRequired, true, "paused is treated like live");
  assert.deepEqual(earlyRules(draft, form({ title: "New title" }), true), { noteRequired: false, noteMissing: false, titleRule: false }, "a draft: no note rule, no title rule");
  assert.equal(earlyRules(live, form({ title: "Senior Data Analyst" }), true).titleRule, true);
  assert.equal(earlyRules(live, form({ title: " Data Analyst " }), false).titleRule, false, "the same title with padding is not a change");
});

test("the words: the bar says what is unsaved, never claims Save changes covers the sections that save separately, and has no em dash", () => {
  const f = summarize({ form: true, panels: [], status: "live", noteMissing: true, noteRequired: true });
  assert.equal(f.any, true); assert.equal(f.headline, "You have unsaved changes"); assert.equal(f.showSave, true);
  assert.equal(f.detail, "They take effect only when you press Save changes. This posting is live, so add a note saying what changed and why.");
  assert.equal(f.liveText, "You have unsaved changes. They take effect only when you press Save changes. This posting is live, so a change to it needs a note. Say what changed and why.");
  const typed = summarize({ form: true, panels: [], status: "live", noteMissing: false, noteRequired: true });
  assert.equal(typed.detail, "They take effect only when you press Save changes."); assert.equal(typed.liveText, f.liveText, "typing the note does not change what a screen reader is told, so it is not read again");
  const l = summarize({ form: false, panels: [PANEL.LINKS], status: "live" });
  assert.equal(l.headline, "Destination links not saved yet"); assert.equal(l.showSave, false, "Save changes does not cover the links, so the bar does not offer it");
  assert.equal(l.detail, "Save changes does not save them. Press Save destination links in that section, or press Discard.");
  assert.equal(summarize({ form: false, panels: [PANEL.FIRMS] }).headline, "Recruiter firms not saved yet");
  assert.equal(summarize({ form: false, panels: [PANEL.GOLIVE] }).headline, "Go-live time not saved yet");
  assert.equal(summarize({ form: false, panels: [PANEL.FIRMS, PANEL.LINKS] }).headline, "Destination links and recruiter firms not saved yet");
  assert.equal(summarize({ form: false, panels: [PANEL.GOLIVE, PANEL.FIRMS, PANEL.LINKS] }).headline, "Destination links, recruiter firms and go-live time not saved yet");
  const mixed = summarize({ form: true, panels: [PANEL.LINKS], status: "paused", noteMissing: false, noteRequired: true });
  assert.equal(mixed.headline, "You have unsaved changes"); assert.equal(mixed.showSave, true);
  assert.match(mixed.detail, /^Destination links not saved yet\. Save changes does not save it: use the button in that section\./);
  assert.equal(mixed.leaveSaveLabel, "Save changes", "with a section still unsaved, saving the form does not by itself let the person leave");
  assert.equal(summarize({ form: true, panels: [] }).leaveSaveLabel, "Save and leave");
  assert.equal(summarize({ form: false, panels: [] }).any, false); assert.equal(summarize({ form: false, panels: [PANEL.LINKS] }).leaveCanSave, false);
  assert.match(summarize({ form: false, panels: [PANEL.LINKS] }).dialogText, /saved with its own button, not with Save changes\./);
  const all = JSON.stringify([UNSAVED, summarize({ form: true, panels: [PANEL.LINKS, PANEL.FIRMS, PANEL.GOLIVE], status: "live", noteMissing: true, noteRequired: true }), UNSAVED.titleRule("live"), UNSAVED.noteRequired("paused")]);
  assert.equal(all.includes("—"), false, "no em dash");
  assert.equal(UNSAVED.titleRule("live"), "On a live posting, a new title must keep at least 60% of the wording of the current one. A bigger change needs a new posting.");
});

test("which clicks leave the page: a plain click on a link does; a new tab, a download, an anchor, mail and a modified click do not", () => {
  const ok = { button: 0 };
  assert.equal(linkLeaves(ok, { href: "dashboard.html" }), true);
  assert.equal(linkLeaves(ok, { href: "index.html#employers" }), true);
  assert.equal(linkLeaves(ok, { href: "register.html", target: "_self" }), true);
  for (const info of [{ href: "#main" }, { href: "" }, { href: "mailto:sales@fightghostjobs.com" }, { href: "tel:1" }, { href: "x.html", target: "_blank" }, { href: "x.html", download: true }, { href: "javascript:void(0)" }, {}]) assert.equal(linkLeaves(ok, info), false, JSON.stringify(info));
  for (const flag of ["ctrlKey", "metaKey", "shiftKey", "altKey"]) assert.equal(linkLeaves({ button: 0, [flag]: true }, { href: "dashboard.html" }), false, flag);
  assert.equal(linkLeaves({ button: 1 }, { href: "dashboard.html" }), false); assert.equal(linkLeaves({ defaultPrevented: true }, { href: "dashboard.html" }), false);
});

// ---- the guard on a tiny fake DOM
class FEl {
  constructor(tag, doc) { this.tag = tag; this.doc = doc; this.attrs = {}; this.children = []; this.listeners = {}; this.parent = null; this._text = ""; this.disabled = false; this.hidden = false; this.clicks = 0; }
  append(...kids) { for (const k of kids) { k.parent = this; this.children.push(k); } return this; }
  get textContent() { return this._text; } set textContent(v) { this._text = String(v); }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  async fire(t, ev) { const e = Object.assign({ type: t, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }, ev || {}); for (const fn of this.listeners[t] || []) await fn(e); return e; }
  focus() { this.doc.active = this; }
  click() { this.clicks++; return this.fire("click", { button: 0 }); }
}
const makeDom = () => {
  const doc = { active: null }, el = (tag) => new FEl(tag, doc), body = el("body"); doc.active = body;
  const bar = el("div"), head = el("strong"), detail = el("span"), live = el("div"), saveBtn = el("button"), discardBtn = el("button"), skip = el("a"); skip.hidden = true;
  const barText = el("div"); bar.append(barText, saveBtn, discardBtn); barText.append(head, detail); bar.hidden = true;
  const overlay = el("div"), dtitle = el("h2"), dtext = el("p"), dsave = el("button"), ddiscard = el("button"), dstay = el("button"), box = el("div");
  box.append(dtitle, dtext, dsave, ddiscard, dstay); overlay.append(box); overlay.hidden = true;
  const classes = new Set(), root = { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: (c) => classes.has(c) } };
  const wl = {}, win = { addEventListener: (t, f) => (wl[t] = wl[t] || []).push(f), removeEventListener: (t, f) => { wl[t] = (wl[t] || []).filter((x) => x !== f); }, count: (t) => (wl[t] || []).length, run: (t) => { const ev = { returnValue: undefined, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }; const results = (wl[t] || []).map((f) => f(ev)); return { ev, results }; } };
  const opener = el("a"), outside = el("input");
  return { doc, el, bar, head, detail, live, saveBtn, discardBtn, skip, dlg: { overlay, title: dtitle, text: dtext, save: dsave, discard: ddiscard, stay: dstay }, classes, root, win, opener, outside };
};

// a model of the page: a baseline snapshot, the values in the form, the sections that save separately; save() succeeds or is refused; the same moves edit.js makes
function makePage(o = {}) {
  const dom = makeDom(), p = o.posting || posting();
  const page = { dom, v: form(), baseline: baselineOf(p), panels: new Set(), status: p.stored_status, orig: p, saves: 0, saveOk: true, discarded: 0, went: [], confirm: true, rescued: 0 };
  page.model = () => { const dirty = formDirty(page.baseline, page.v), r = earlyRules(p, page.v, dirty); return { form: dirty, panels: Array.from(page.panels), status: page.status, noteMissing: r.noteMissing, noteRequired: r.noteRequired }; };
  page.guard = mountUnsavedGuard({ win: dom.win, root: dom.root, bar: dom.bar, head: dom.head, detail: dom.detail, live: dom.live, saveBtn: dom.saveBtn, discardBtn: dom.discardBtn, skip: dom.skip, dlg: dom.dlg,
    getModel: page.model,
    save: async () => { page.saves++; if (page.gate) await page.gate; if (!page.saveOk) return false; page.baseline = snapshotOf(page.v); page.guard.refresh(); return true; },
    discard: () => { page.discarded++; page.v = form(); page.panels.clear(); page.guard.refresh(); },
    go: (url) => page.went.push(url), activeElement: () => dom.doc.active, confirmDiscard: () => page.confirm, rescueFocus: () => { page.rescued++; dom.outside.focus(); } });
  page.edit = (c) => { Object.assign(page.v, c); page.guard.refresh(); };
  page.leaveClick = (href = "dashboard.html", extra) => page.guard.interceptClick({ button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...(extra || {}) }, Object.assign({ kind: "link", href, el: dom.opener }, extra && extra.target ? { target: extra.target } : {}));
  return page;
}

test("the bar: hidden and silent before any change; after a change it shows, says so, and the page gets the leave-page question; a change then a revert clears all of it", () => {
  const pg = makePage(), d = pg.dom;
  pg.guard.refresh();
  assert.equal(d.bar.hidden, true); assert.equal(d.live.textContent, ""); assert.equal(d.win.count("beforeunload"), 0, "no leave-page question while nothing is unsaved"); assert.equal(d.classes.has("unsaved-on"), false);
  let r = d.win.run("beforeunload"); assert.equal(r.ev.defaultPrevented, false);
  pg.edit({ title: "Senior Data Analyst" });
  assert.equal(d.bar.hidden, false); assert.equal(d.head.textContent, "You have unsaved changes"); assert.equal(d.saveBtn.hidden, false); assert.equal(d.classes.has("unsaved-on"), true);
  assert.match(d.live.textContent, /^You have unsaved changes\. They take effect only when you press Save changes\. This posting is live, so a change to it needs a note\./);
  assert.equal(d.win.count("beforeunload"), 1); r = d.win.run("beforeunload"); assert.equal(r.ev.defaultPrevented, true); assert.equal(r.ev.returnValue, "");
  pg.edit({ title: "Data Analyst" });
  assert.equal(d.bar.hidden, true); assert.equal(d.live.textContent, "No unsaved changes.", "the screen reader region says, once, that nothing is unsaved any more (October 5, 2026: it used to be emptied, which says nothing)"); assert.equal(d.win.count("beforeunload"), 0); assert.equal(d.win.run("beforeunload").ev.defaultPrevented, false); assert.equal(d.classes.has("unsaved-on"), false);
});

test("the bar's live region is announced once per change of meaning, not on every keystroke; the detail line follows the note", () => {
  const pg = makePage(), d = pg.dom; let writes = 0, text = "";
  Object.defineProperty(d.live, "textContent", { get: () => text, set: (v) => { writes++; text = String(v); } });
  pg.edit({ desc: "a" }); const first = writes;
  for (const x of ["ab", "abc", "abcd"]) pg.edit({ desc: x });
  assert.equal(writes, first, "typing more of the same change does not rewrite the region");
  assert.match(d.detail.textContent, /add a note saying what changed and why\.$/);
  pg.edit({ note: "Typo" }); assert.equal(d.detail.textContent, "They take effect only when you press Save changes.", "the visible line stops asking for the note once there is one"); assert.equal(writes, first, "but the spoken text did not change");
});

test("a successful save clears the bar and the warning; a refused save keeps both", async () => {
  const pg = makePage(), d = pg.dom;
  pg.edit({ desc: "Analyse the data. Report weekly.", note: "Added reporting" });
  pg.saveOk = false; await d.saveBtn.fire("click");
  assert.equal(pg.saves, 1); assert.equal(d.bar.hidden, false, "refused: the bar stays"); assert.equal(d.win.count("beforeunload"), 1, "refused: the leave-page question stays"); assert.equal(d.win.run("beforeunload").ev.defaultPrevented, true);
  pg.saveOk = true; await d.saveBtn.fire("click");
  assert.equal(pg.saves, 2); assert.equal(d.bar.hidden, true); assert.equal(d.win.count("beforeunload"), 0); assert.equal(d.win.run("beforeunload").ev.defaultPrevented, false, "after a save, leaving does not ask");
  pg.edit({ desc: "Analyse the data. Report weekly. Twice." });
  assert.equal(d.bar.hidden, false, "a further change after the save is unsaved again, against the new snapshot");
  pg.edit({ desc: "Analyse the data. Report weekly." }); assert.equal(d.bar.hidden, true, "and reverting to the SAVED value (not the first loaded one) clears it");
});

test("the bar's Save button is reachable and never offered for work Save changes does not cover; Discard asks, then puts the saved values back", async () => {
  const pg = makePage(), d = pg.dom;
  pg.edit({ title: "X" }); assert.equal(d.saveBtn.hidden, false); assert.equal(d.discardBtn.hidden, false);
  pg.confirm = false; await d.discardBtn.fire("click"); assert.equal(pg.discarded, 0); assert.equal(d.bar.hidden, false, "declined: nothing is discarded");
  pg.confirm = true; d.discardBtn.focus(); await d.discardBtn.fire("click");
  assert.equal(pg.discarded, 1); assert.equal(d.bar.hidden, true); assert.equal(pg.rescued, 1, "the bar closed under the focus: focus is moved somewhere sensible, not lost");
  pg.panels.add(PANEL.LINKS); pg.guard.refresh();
  assert.equal(d.bar.hidden, false); assert.equal(d.head.textContent, "Destination links not saved yet"); assert.equal(d.saveBtn.hidden, true, "the main Save is not offered for the links");
  assert.match(d.detail.textContent, /^Save changes does not save them\. Press Save destination links in that section, or press Discard\.$/); assert.equal(d.win.count("beforeunload"), 1, "a pending section also warns on leave");
  pg.edit({ title: "Y" }); assert.equal(d.saveBtn.hidden, false); assert.equal(d.head.textContent, "You have unsaved changes"); assert.match(d.detail.textContent, /Destination links not saved yet\. Save changes does not save it/);
});

test("focus is never taken: the bar appearing or changing does not move focus", () => {
  const pg = makePage(), d = pg.dom; d.outside.focus();
  pg.edit({ title: "A" }); pg.edit({ title: "AB" }); pg.panels.add(PANEL.FIRMS); pg.guard.refresh(); pg.panels.clear(); pg.edit({ title: "Data Analyst" });
  assert.equal(d.doc.active, d.outside); assert.equal(pg.rescued, 0);
});

test("leaving by one of the page's own links: nothing unsaved goes straight through; unsaved asks first, with focus in the dialog on Stay", () => {
  const pg = makePage(), d = pg.dom;
  assert.equal(pg.leaveClick(), false, "nothing unsaved: the click is not held back");
  pg.edit({ title: "Senior" });
  d.opener.focus(); const ev = {}; const held = pg.guard.interceptClick(Object.assign(ev, { button: 0, preventDefault() { ev.defaultPrevented = true; }, stopImmediatePropagation() { ev.stopped = true; } }), { kind: "link", href: "dashboard.html", el: d.opener });
  assert.equal(held, true); assert.equal(ev.defaultPrevented, true); assert.equal(ev.stopped, true); assert.equal(pg.went.length, 0, "not left yet");
  assert.equal(d.dlg.overlay.hidden, false); assert.equal(d.doc.active, d.dlg.stay, "focus moves into the dialog, on the choice that loses nothing");
  assert.equal(d.dlg.title.textContent, "You have unsaved changes"); assert.equal(d.dlg.text.textContent, "If you leave this page now, your changes to this posting are lost.");
  assert.equal(d.dlg.save.hidden, false); assert.equal(d.dlg.save.textContent, "Save and leave");
  assert.equal(pg.guard.dialogOpen(), true);
});

test("clicks that do not leave are not held back (new tab, anchor, mail, modified click)", () => {
  const pg = makePage(); pg.edit({ title: "Senior" });
  assert.equal(pg.leaveClick("#main"), false); assert.equal(pg.leaveClick("mailto:sales@fightghostjobs.com"), false); assert.equal(pg.leaveClick("dashboard.html", { ctrlKey: true }), false);
  assert.equal(pg.guard.interceptClick({ button: 0, preventDefault() {} }, { kind: "link", href: "x.html", target: "_blank", el: pg.dom.opener }), false);
  assert.equal(pg.guard.dialogOpen(), false);
});

test("the dialog: Stay (or Escape) closes it and returns focus to the link; Discard leaves without the browser asking again; Tab stays inside", async () => {
  const pg = makePage(), d = pg.dom, dlg = d.dlg;
  pg.edit({ title: "Senior" }); d.opener.focus(); pg.leaveClick();
  await dlg.stay.fire("click"); assert.equal(dlg.overlay.hidden, true); assert.equal(d.doc.active, d.opener, "focus returns to the link that opened it"); assert.equal(pg.went.length, 0); assert.equal(d.bar.hidden, false, "still unsaved");
  pg.leaveClick(); const esc = await dlg.overlay.fire("keydown", { key: "Escape" });
  assert.equal(esc.defaultPrevented, true); assert.equal(dlg.overlay.hidden, true); assert.equal(d.doc.active, d.opener); assert.equal(pg.went.length, 0, "Escape means Stay");
  pg.leaveClick(); assert.equal(d.doc.active, dlg.stay);
  await dlg.overlay.fire("keydown", { key: "Tab" }); assert.equal(d.doc.active, dlg.save, "Tab from the last button wraps to the first");
  await dlg.overlay.fire("keydown", { key: "Tab", shiftKey: true }); assert.equal(d.doc.active, dlg.stay, "Shift+Tab from the first wraps to the last");
  await dlg.overlay.fire("keydown", { key: "Tab", shiftKey: true }); assert.equal(d.doc.active, dlg.discard);
  await dlg.overlay.fire("keydown", { key: "Tab" }); assert.equal(d.doc.active, dlg.stay);
  await dlg.overlay.fire("keydown", { key: "a" }); assert.equal(dlg.overlay.hidden, false, "other keys do nothing");
  await dlg.discard.fire("click");
  assert.deepEqual(pg.went, ["dashboard.html"]); assert.equal(dlg.overlay.hidden, true); assert.equal(d.win.run("beforeunload").ev.defaultPrevented, false, "leaving on purpose: the browser's own question is not asked a second time");
});

test("the dialog's Save: a good save leaves; a refused save stays (bar and warning kept); the form saved but a section still unsaved also stays", async () => {
  let pg = makePage(), d = pg.dom;
  pg.edit({ title: "Senior", note: "n" }); pg.leaveClick(); await d.dlg.save.fire("click");
  assert.equal(pg.saves, 1); assert.deepEqual(pg.went, ["dashboard.html"]); assert.equal(d.dlg.overlay.hidden, true);
  pg = makePage(); d = pg.dom; pg.saveOk = false;
  pg.edit({ title: "Senior" }); d.opener.focus(); pg.leaveClick(); await d.dlg.save.fire("click");
  assert.equal(pg.saves, 1); assert.equal(pg.went.length, 0, "a refused save does not leave"); assert.equal(d.dlg.overlay.hidden, true, "the dialog closes so the person can read why");
  assert.equal(d.bar.hidden, false); assert.equal(d.win.count("beforeunload"), 1); assert.equal(d.doc.active, d.opener, "focus is back where it was");
  pg = makePage(); d = pg.dom; pg.panels.add(PANEL.LINKS);
  pg.edit({ title: "Senior" }); pg.leaveClick(); assert.equal(d.dlg.save.textContent, "Save changes"); assert.match(d.dlg.text.textContent, /Save changes saves the posting only\./);
  await d.dlg.save.fire("click");
  assert.equal(pg.saves, 1); assert.equal(pg.went.length, 0, "the posting is saved but the links are not: the person stays"); assert.equal(d.head.textContent, "Destination links not saved yet");
});

test("leaving with only a section unsaved: the dialog names it, offers no Save, and Discard leaves", async () => {
  const pg = makePage(), d = pg.dom; pg.panels.add(PANEL.FIRMS); pg.guard.refresh();
  pg.leaveClick(); assert.equal(d.dlg.title.textContent, "Recruiter firms not saved yet"); assert.equal(d.dlg.save.hidden, true);
  assert.equal(d.dlg.text.textContent, "If you leave this page now, what you typed in the recruiter firms section is lost. It is saved with its own button, not with Save changes.");
  await d.dlg.overlay.fire("keydown", { key: "Tab" }); assert.equal(d.doc.active, d.dlg.discard, "a hidden Save is skipped by Tab");
  await d.dlg.discard.fire("click"); assert.deepEqual(pg.went, ["dashboard.html"]);
});

test("a button that leaves the page itself (Sign out) is held back too, and runs when the person chooses Discard", async () => {
  const pg = makePage(), d = pg.dom, signOut = d.el("button"); let ran = 0;
  signOut.addEventListener("click", async (ev) => { if (pg.guard.interceptClick(ev, { kind: "button", el: signOut })) return; ran++; });
  pg.edit({ title: "Senior" }); signOut.focus();
  await signOut.fire("click", { button: 0 }); assert.equal(ran, 0); assert.equal(d.dlg.overlay.hidden, false);
  await d.dlg.stay.fire("click"); assert.equal(ran, 0); assert.equal(d.doc.active, signOut);
  await signOut.fire("click", { button: 0 }); await d.dlg.discard.fire("click"); assert.equal(ran, 1, "the button's own handler ran once the person chose to leave"); assert.equal(signOut.clicks, 1);
});

test("while the dialog is open a second leave click is not stacked, and a save in progress cannot be dismissed (Escape, Stay and Discard do nothing until it ends)", async () => {
  const pg = makePage(), d = pg.dom; let release; pg.gate = new Promise((r) => { release = r; });
  pg.edit({ title: "Senior" }); pg.leaveClick();
  assert.equal(pg.leaveClick("register.html"), false, "already asking");
  const saving = d.dlg.save.fire("click");
  assert.equal(d.dlg.save.disabled && d.dlg.discard.disabled && d.dlg.stay.disabled, true, "all three buttons are off while it saves");
  await d.dlg.overlay.fire("keydown", { key: "Escape" }); await d.dlg.stay.fire("click"); await d.dlg.discard.fire("click"); await d.dlg.save.fire("click");
  assert.equal(d.dlg.overlay.hidden, false); assert.equal(pg.went.length, 0); assert.equal(pg.saves, 1, "one save, however many clicks");
  release(); await saving;
  assert.deepEqual(pg.went, ["dashboard.html"]); assert.equal(d.dlg.save.disabled, false);
});

// ---- the sequence the page goes through, with the page's own rules (a model of edit.js: snapshot at load, compare, save, refusal)
test("sequence: load, change, bar; revert, no bar; change, refused save, bar stays; change again, good save, no bar, no warning; leaving afterwards asks nothing", async () => {
  const pg = makePage(), d = pg.dom; pg.guard.refresh();
  assert.equal(d.bar.hidden, true);
  pg.edit({ recruiter: true }); assert.equal(d.bar.hidden, false);
  pg.edit({ recruiter: false }); assert.equal(d.bar.hidden, true);
  pg.edit({ recruiter: true, note: "a recruiter helps" }); pg.saveOk = false; await d.saveBtn.fire("click"); assert.equal(d.bar.hidden, false); assert.equal(d.win.count("beforeunload"), 1);
  pg.saveOk = true; await d.saveBtn.fire("click"); assert.equal(d.bar.hidden, true); assert.equal(d.win.count("beforeunload"), 0);
  assert.equal(pg.leaveClick(), false); assert.equal(pg.went.length, 0);
});

// ---- the page's own wiring (it needs a browser to run; its source and markup are pinned here)
test("edit.js: the guard is wired in, every save path says whether it saved, and a save of one part never wipes what was typed in another", () => {
  const js = src("js/pages/edit.js");
  assert.match(js, /import \{ mountUnsavedGuard \} from "\.\.\/unsaved-guard\.js";/); assert.match(js, /guard = mountUnsavedGuard\(\{/);
  assert.match(js, /document\.addEventListener\("click", \(ev\) => \{[\s\S]*?guard\.interceptClick\(ev, \{ kind: "link"[\s\S]*?"#navAccount button:not\(\.avatar-btn\)"[\s\S]*?\}, true\);/, "a capture-phase click handler holds back links and Sign out (but not the initials circle, which only opens a label)");
  assert.ok(js.includes('for (const t of ["input", "change", "click", "keyup"]) document.addEventListener(t, () => refreshUnsaved());'));
  assert.ok(js.includes("onChange: () => refreshUnsaved()"), "the location picker reports its changes");
  assert.ok(js.includes("state.baseline = snapshotOf(collect());"), "the snapshot is taken when a posting is loaded or saved");
  assert.match(js, /async function submit\(\) \{\n  if \(state\.busy \|\| !state\.orig\) return false;/);
  const sub = js.slice(js.indexOf("async function submit() {"), js.indexOf("async function submitLinks"));
  assert.equal((sub.match(/return true;/g) || []).length, 2, "saved, and nothing-to-change"); assert.ok((sub.match(/return false;/g) || []).length >= 5, "every refusal returns false, so the warning stays");
  // the three sections that save separately read the posting again WITHOUT throwing away the main form's unsaved edits, and the main save without throwing away their typed work
  for (const [call, label] of [["populate(reload.data, { keepForm: true, saved: PANEL.LINKS })", "links form"], ["populate(reload.data, { keepForm: true, saved: PANEL.FIRMS })", "firms"], ["populate(reload.data, { keepForm: true, saved: PANEL.GOLIVE })", "go-live"]]) assert.ok(js.includes(call), label);
  assert.ok(js.includes("populate(reload.data, { keepForm: true, saved: PANEL.LINKS }); },"), "the links panel's stale reload");
  assert.equal((js.match(/populate\((reload|same)\.data\)/g) || []).length, 2, "only the main Save (saved, or the server found nothing to change) reads the posting into the whole form");
  assert.equal((js.match(/(await populate|function populate)\(/g) || []).length, 10, "populate: its definition and nine calls (load, the main Save twice, links form twice, links panel, firms, go-live, Discard): a new call must decide what it keeps");
  assert.ok(js.includes('populate(state.doc, { saved: "*" })'), "Discard puts the saved values back everywhere");
  assert.ok(js.includes("if (!state.linksBusy && !state.keepPanels.has(PANEL.LINKS)) resetLinkRows();") && js.includes("if (!state.firmsBusy && !state.keepPanels.has(PANEL.FIRMS)) firms.reset();") && js.includes("if (!state.keepPanels.has(PANEL.GOLIVE)) $(\"#gldate\").value = state.glBaseline;"));
  assert.ok(js.includes("const keepPanels = new Set(o.saved === \"*\" ? [] : panelsUnsaved().filter((n) => n !== o.saved));"));
  assert.ok(js.includes("(shown(\"#linksForm\") && rowsTyped(links.values())) || (shown(\"#linksPanel\") && linkPanel.hasPending())") && js.includes('shown("#firmsForm") && rowsTyped(firms.values())') && js.includes('$("#gldate").value !== state.glBaseline'));
});

test("edit.html: the bar, the polite status region and the leave dialog are there, in order, with the right roles", () => {
  const html = src("edit.html");
  assert.match(html, /<div id="unsavedLive" class="unsaved-sr" role="status" aria-live="polite" aria-atomic="true"><\/div>/);
  assert.match(html, /<div id="unsavedBar" class="unsaved-bar" role="region" aria-label="Unsaved changes" hidden>/);
  assert.match(html, /<button type="button" id="unsavedSave" class="btn btn-dark btn-sm">Save changes<\/button>\s*<button type="button" id="unsavedDiscard" class="btn btn-outline btn-sm">Discard<\/button>/);
  assert.match(html, /<div id="leaveOverlay" class="unsaved-overlay" hidden>\s*<div id="leaveDialog" class="unsaved-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leaveTitle" aria-describedby="leaveText">/);
  assert.match(html, /id="leaveSave"[^>]*>Save and leave<\/button>\s*<button type="button" id="leaveDiscard"[^>]*>Discard and leave<\/button>\s*<button type="button" id="leaveStay"[^>]*>Stay on this page<\/button>/);
  assert.ok(html.indexOf('id="unsavedBar"') > html.indexOf('id="linksCard"') && html.indexOf('id="unsavedBar"') < html.indexOf("</main>"), "the bar is the last thing in <main>, after the page content: sticky in the flow, so it ends above the footer");
  assert.ok(html.indexOf('id="leaveOverlay"') > html.indexOf("</main>") && html.indexOf('id="leaveOverlay"') < html.indexOf("<footer"));
  assert.match(html, /<h1 id="editHeading" tabindex="-1"/, "the heading can take the focus when the bar closes under it");
  const css = src("app.css");
  assert.match(css, /\.unsaved-bar\{position:sticky;bottom:0;z-index:30;/); assert.match(css, /html\.unsaved-on\{scroll-padding-bottom:\d+px\}/);
  assert.match(css, /@media \(max-width:720px\)\{\.unsaved-inner\{padding:10px 16px\}\.unsaved-actions\{width:100%\}\.unsaved-actions \.btn\{flex:1 1 auto;justify-content:center\}/);
  assert.match(css, /\.unsaved-inner\{[^}]*flex-wrap:wrap\}/, "the text and the buttons wrap instead of running off a narrow screen");
});

test("the skip link (October 5, 2026): exists only while the bar shows, goes to Save changes (or Discard when Save is not offered), and says nothing to a screen reader", async () => {
  const pg = makePage(), d = pg.dom;
  pg.guard.refresh();
  assert.equal(d.skip.hidden, true, "no link while nothing is unsaved");
  pg.edit({ title: "Senior Data Analyst" });
  assert.equal(d.skip.hidden, false, "the link appears with the bar"); const said = d.live.textContent;
  const e = await d.skip.fire("click", { button: 0 }); assert.equal(e.defaultPrevented, true, "the link does not navigate"); assert.equal(d.doc.active, d.saveBtn, "focus goes to Save changes"); assert.equal(d.live.textContent, said, "the announcement is not disturbed");
  pg.edit({ title: "Data Analyst" }); assert.equal(d.skip.hidden, true, "the link goes with the bar");
  // only a separately saved section is unsaved: Save changes is not offered, so Discard gets the focus
  pg.panels.add(PANEL.LINKS); pg.guard.refresh();
  assert.equal(d.skip.hidden, false); assert.equal(d.saveBtn.hidden, true);
  await d.skip.fire("click", { button: 0 }); assert.equal(d.doc.active, d.discardBtn);
  // the bar closes while the link has the focus: focus is not left on nothing
  const r0 = pg.rescued; d.skip.focus(); pg.panels.clear(); pg.guard.refresh(); assert.equal(d.skip.hidden, true); assert.equal(pg.rescued, r0 + 1, "focus was rescued");
});
