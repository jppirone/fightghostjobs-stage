// place-text.unit.test.js - the typed place's rule, words and form helpers (prompt BH, October 11, 2026). Pure (no DOM): js/place-text.js, js/edit-form.js, js/register-form.js, js/dirty-state.js.
import test from "node:test";
import assert from "node:assert/strict";
import { PLACE_FIELD, MAX_PLACE_TEXT, PLACE_WORDS, collapsePlaceText, placeTextProblem, storedPlaceText, placeFromForm } from "../js/place-text.js";
import { changedFields, checkEdit, LOCATION_GROUP, FIELD_OF_SERVER_NAME } from "../js/edit-form.js";
import { validateForm, buildCreateBody, FIELD_OF_SERVER_NAME as REG_FIELDS } from "../js/register-form.js";
import { snapshotOf, valuesFromPosting, formDirty } from "../js/dirty-state.js";

const OK = ["Berlin, Germany", "São Paulo, Brazil", "Japan", "Remote, anywhere in Canada", "St. Louis, MO", "Washington D.C.", "Zürich", "x".repeat(100), "東京, 日本"];
const BAD = [
  ["", PLACE_WORDS.EMPTY], ["   ", PLACE_WORDS.EMPTY],
  ["https://example.com", PLACE_WORDS.LINK], ["www.example.com", PLACE_WORDS.LINK], ["jobs.example.com/x", PLACE_WORDS.LINK], ["example[.]com", PLACE_WORDS.LINK], ["10.0.0.1", PLACE_WORDS.LINK],
  ["write to jo@example", PLACE_WORDS.EMAIL], ["@home", PLACE_WORDS.EMAIL],
  ["x".repeat(101), PLACE_WORDS.LONG], ["a\nb", PLACE_WORDS.CHARS], ["a\tb", PLACE_WORDS.CHARS], ["a\u0007b", PLACE_WORDS.CHARS], ["a​b", PLACE_WORDS.CHARS],
  ["<b>Berlin</b>", PLACE_WORDS.MARKUP], ["a > b", PLACE_WORDS.MARKUP],
];

test("the rule: acceptable places pass and every refusal says what is wrong", () => {
  for (const t of OK) assert.equal(placeTextProblem(collapsePlaceText(t)), null, t);
  for (const [t, why] of BAD) assert.equal(placeTextProblem(collapsePlaceText(t)), why, JSON.stringify(t));
  assert.equal(MAX_PLACE_TEXT, 100);
  assert.equal(placeTextProblem("x".repeat(100)), null); assert.equal(placeTextProblem("x".repeat(101)), PLACE_WORDS.LONG);
});

test("collapse: runs of spaces and other spaces become one space, the ends are trimmed, a line break or a tab is NOT collapsed", () => {
  assert.equal(collapsePlaceText("  Berlin ,   Germany  "), "Berlin , Germany");
  assert.equal(collapsePlaceText("Berlin  Germany"), "Berlin Germany");
  assert.equal(collapsePlaceText("Berlin　Germany"), "Berlin Germany");
  assert.equal(collapsePlaceText("Berlin\nGermany"), "Berlin\nGermany", "kept, so the rule refuses it");
  assert.equal(collapsePlaceText("a\tb"), "a\tb");
  assert.equal(collapsePlaceText(null), ""); assert.equal(collapsePlaceText(undefined), "");
});

test("the words: no em or en dash, none of the banned vocabulary", () => {
  for (const [k, w] of Object.entries(PLACE_WORDS)) {
    assert.ok(!/[–—]/.test(w), k);
    assert.ok(!/\b(listing|posting|registry|certified|compliant|verified)\b/i.test(w), k + ": " + w);
  }
  assert.equal(PLACE_WORDS.CHOICE, "A place outside the US or not in the list");
});

test("the helpers read the stored place from an answer and never anything else", () => {
  assert.equal(PLACE_FIELD, "source_location_text");
  assert.equal(storedPlaceText({ [PLACE_FIELD]: "Lisbon, Portugal" }), "Lisbon, Portugal");
  assert.equal(storedPlaceText({ [PLACE_FIELD]: null }), ""); assert.equal(storedPlaceText({}), ""); assert.equal(storedPlaceText(null), ""); assert.equal(storedPlaceText({ [PLACE_FIELD]: 5 }), "");
  assert.deepEqual(placeFromForm({ outside: true, locText: "  Oslo   Norway " }), { outside: true, text: "Oslo Norway" });
  assert.deepEqual(placeFromForm({ outside: false, locText: "ignored" }), { outside: false, text: null });
});

const orig = (extra) => ({ id: "3f1d5b1e-0000-4000-8000-000000000001", title: "Analyst", req_number: "R-1", description_text: "d", location_ids: ["gn:1"], locations: ["Austin, TX"], locations_attested: false, is_remote: false,
  ai_filtering: false, ai_interview_other: false, ai_filtering_note: null, ai_interview_note: null, third_party_recruiter: false, req_searchable: true, destination_links_exclusive: false, applicant_cap: null, stored_status: "draft", ...extra });
const form = (extra) => ({ title: "Analyst", req: "R-1", desc: "d", locEntries: [{ id: "gn:1" }], attested: false, remote: false, outside: false, locText: "", appcap: "", aiFilter: false, aiInterview: false, recruiter: false, reqSearchable: true, note: "", ...extra });

test("an edit that moves from a list place to a typed place sends the text and the list cleared; back sends the list and the text cleared", () => {
  const c1 = changedFields(orig(), form({ outside: true, locEntries: [], locText: "  Lisbon,  Portugal " }));
  assert.deepEqual(c1, { location_ids: [], [PLACE_FIELD]: "Lisbon, Portugal" });
  const o2 = orig({ location_ids: [], locations: [], [PLACE_FIELD]: "Lisbon, Portugal" });
  const c2 = changedFields(o2, form({ outside: false, locEntries: [{ id: "gn:1" }] }));
  assert.deepEqual(c2, { location_ids: ["gn:1"], [PLACE_FIELD]: null });
  // unchanged: nothing is sent for a typed place that is the stored one (whitespace aside)
  assert.deepEqual(changedFields(o2, form({ outside: true, locEntries: [], locText: " Lisbon,   Portugal" })), {});
  assert.ok(LOCATION_GROUP.includes(PLACE_FIELD), "a change of the typed place is a location change (a new req number on a live opening)");
});

test("checkEdit: the typed place is judged only when it changed; the list rule does not apply to it; a live opening needs a new req number and a note", () => {
  const o = orig();
  assert.equal(checkEdit(o, form({ outside: true, locEntries: [], locText: "" })).errors.loctext, PLACE_WORDS.EMPTY);
  assert.equal(checkEdit(o, form({ outside: true, locEntries: [], locText: "see https://example.com" })).errors.loctext, PLACE_WORDS.LINK);
  assert.equal(checkEdit(o, form({ outside: true, locEntries: [], locText: "jo@example" })).errors.loctext, PLACE_WORDS.EMAIL);
  const ok = checkEdit(o, form({ outside: true, locEntries: [], locText: "Lisbon, Portugal" }));
  assert.deepEqual(ok.errors, {}); assert.deepEqual(ok.body, { posting_id: o.id, location_ids: [], [PLACE_FIELD]: "Lisbon, Portugal" });
  assert.equal(checkEdit(o, form({ outside: true, locEntries: [], remote: false, locText: "Lisbon" })).errors.locpicker, undefined, "no list place is asked for while a typed place is chosen");
  // an opening staged with a long board text is not refused for it while that text is untouched
  const staged = orig({ location_ids: [], locations: [], [PLACE_FIELD]: "x".repeat(150) });
  const un = checkEdit(staged, form({ outside: true, locEntries: [], locText: "x".repeat(150), title: "Analyst II" }));
  assert.equal(un.errors.loctext, undefined); assert.deepEqual(un.body, { posting_id: staged.id, title: "Analyst II" });
  // live: new req number and a note, as for every location change
  const live = orig({ stored_status: "live" });
  const e = checkEdit(live, form({ outside: true, locEntries: [], locText: "Lisbon, Portugal", note: "moved" }));
  assert.ok(/needs a new req number/.test(e.errors.req || ""));
  const good = checkEdit(live, form({ outside: true, locEntries: [], locText: "Lisbon, Portugal", note: "moved", req: "R-2" }));
  assert.deepEqual(good.errors, {}); assert.equal(good.body[PLACE_FIELD], "Lisbon, Portugal"); assert.equal(good.body.req_number, "R-2");
  assert.equal(FIELD_OF_SERVER_NAME[PLACE_FIELD], "loctext");
});

test("register: the typed place stands in for the list place; the same rule; the request carries the text and no list place", () => {
  const v = { title: "T", req: "R-1", closeout: "filled", desc: "d", locEntries: [], attested: false, remote: false, outside: true, locText: "  Lisbon,   Portugal ", appcap: "", win: "", aiFilter: false, aiInterview: false, recruiter: false };
  assert.deepEqual(validateForm(v), {});
  assert.deepEqual(validateForm({ ...v, locText: "" }), { loctext: PLACE_WORDS.EMPTY });
  assert.deepEqual(validateForm({ ...v, locText: "a@b" }), { loctext: PLACE_WORDS.EMAIL });
  assert.equal(validateForm({ ...v, outside: false, locEntries: [] }).locpicker, "Choose a location from the list, or tick Remote role.");
  const body = buildCreateBody(v);
  assert.equal(body[PLACE_FIELD], "Lisbon, Portugal"); assert.ok(!("location_ids" in body) && !("locations_attested" in body));
  const body2 = buildCreateBody({ ...v, outside: false, locEntries: [{ id: "gn:1" }, { id: "gn:2" }], attested: true });
  assert.ok(!(PLACE_FIELD in body2)); assert.deepEqual(body2.location_ids, ["gn:1", "gn:2"]); assert.equal(body2.locations_attested, true);
  assert.equal(REG_FIELDS[PLACE_FIELD], "loctext");
  assert.equal(buildCreateBody({ ...v, remote: true }).is_remote, true, "Remote stays its own choice");
});

test("the unsaved bar counts a typed place: typed, changed and reverted are judged like every other field", () => {
  const p = { title: "T", req_number: "R", description_text: "d", location_ids: [], locations: [], locations_attested: false, is_remote: false, [PLACE_FIELD]: "Lisbon, Portugal" };
  const v0 = valuesFromPosting(p);
  assert.equal(v0.outside, true); assert.equal(v0.locText, "Lisbon, Portugal");
  const base = snapshotOf(v0);
  assert.equal(formDirty(base, v0), false);
  assert.equal(formDirty(base, { ...v0, locText: "Porto, Portugal" }), true);
  assert.equal(formDirty(base, { ...v0, locText: "  Lisbon, Portugal  " }), false, "whitespace around is not a change");
  assert.equal(formDirty(base, { ...v0, outside: false, locText: "" }), true);
  const withList = valuesFromPosting({ ...p, location_ids: ["gn:1"], locations: ["Austin, TX"], [PLACE_FIELD]: null });
  assert.equal(withList.outside, false);
});
