// register-bk.unit.test.js - prompt BK (October 11, 2026): the words and rules of the editor's one action area, the limit hint words, the search refusal and the focus ring helper. Pure functions: no browser, no network.
import test from "node:test";
import assert from "node:assert/strict";
import { ACTION, ADDED_LABEL, panelsFirstText, PANEL } from "../js/dirty-state.js";
import { limitWords } from "../js/limit-hint.js";
import { resolveSearch } from "../js/search-input.js";
import { focusWithRing } from "../js/focus-ring.js";

test("the action area's words", () => {
  // prompt BM: the main button with nothing changed reads "Back to My openings" (it was "Close", which reads as closing the opening)
  assert.deepEqual(ACTION, { SAVE: "Save changes", BACK: "Back to My openings", SAVE_DRAFT: "Save as draft", PUBLISH: "Publish" });
  assert.equal(Object.values(ACTION).some((w) => /^close$/i.test(w)), false, "no button of the editor is called Close");
  assert.equal(ADDED_LABEL, "Added");
});

test("the double check names the sections that hold something not saved, in the page's order, in one sentence", () => {
  assert.equal(panelsFirstText([]), "");
  assert.equal(panelsFirstText(null), "");
  assert.equal(panelsFirstText([PANEL.LINKS]), "The destination links section has something that is not saved. Use the button in that section to save it first, then press Save changes.");
  assert.equal(panelsFirstText([PANEL.FIRMS]), "The recruiter firms section has something that is not saved. Use the button in that section to save it first, then press Save changes.");
  assert.equal(panelsFirstText([PANEL.LINKS, PANEL.POLICY]), "These sections have something that is not saved: AI and hiring policy link and destination links. Use the button in each one to save it first, then press Save changes.");
  assert.equal(panelsFirstText([PANEL.GOLIVE, PANEL.FIRMS, PANEL.LINKS]), "These sections have something that is not saved: destination links, recruiter firms and go-live time. Use the button in each one to save it first, then press Save changes.");
  for (const p of [[PANEL.LINKS], [PANEL.POLICY, PANEL.FIRMS]]) assert.equal(/—/.test(panelsFirstText(p)), false, "no em dash");
});

test("the limit words follow the box's own limit", () => {
  const w = limitWords(200);
  assert.equal(w.HINT, "Up to 200 characters.");
  assert.equal(w.COUNT(0), "0 of 200");
  assert.equal(w.COUNT(37), "37 of 200");
  assert.equal(w.FULL, "That is all it can hold: 200 characters.");
  assert.equal(w.CUT, "What you pasted was longer than 200 characters, so it was cut at 200.");
  assert.equal(limitWords(20000).HINT, "Up to 20,000 characters.");
  assert.equal(limitWords(20000).COUNT(1234), "1,234 of 20,000");
});

test("the search refusal: only 'both boxes filled' asks the page to clear the old results", () => {
  const both = resolveSearch("Nurse", "R-2026-0451");
  assert.equal(both.ok, false);
  assert.equal(both.message, "Fill in the req number, or the KIO ID / title box, not both.");
  assert.equal(both.clearResults, true);
  assert.equal(both.focus, "req");
  const others = [resolveSearch("", ""), resolveSearch("", "!!"), resolveSearch("x".repeat(81), "")].filter((r) => r.ok === false);
  assert.ok(others.length >= 2, "at least the empty boxes and a bad req number are refused");
  for (const r of others) assert.notEqual(r.clearResults, true, "another refusal leaves the results as they were");
  assert.equal(resolveSearch("Nurse", "").ok, true);
});

test("focusWithRing: the cursor goes to the button the caller named and its ring is drawn until the cursor leaves", () => {
  const log = [], classes = new Set(), listeners = {};
  const el = { focus() { log.push("focus"); }, classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) }, addEventListener: (t, f) => { listeners[t] = f; }, removeEventListener: (t) => { delete listeners[t]; } };
  focusWithRing(el);
  assert.deepEqual(log, ["focus"]);
  assert.equal(classes.has("focus-ring"), true);
  listeners.blur();
  assert.equal(classes.has("focus-ring"), false);
  assert.equal(listeners.blur, undefined);
  assert.doesNotThrow(() => focusWithRing(null));
  assert.doesNotThrow(() => focusWithRing({ focus() {} }), "a node without a class list is still focused");
});
