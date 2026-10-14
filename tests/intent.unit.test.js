// intent.unit.test.js - the employer's optional statement of the kind of an opening (prompt ST1, October 14, 2026): the pure logic (js/intent-statement.js), what the register form and the edit form send and
// judge, what counts as unsaved, the answers the pages accept, and what a candidate is shown. No browser (the pages themselves are in tests/intent.test.js).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { INTENT_CODES, INTENT_DATE_CODES, takesDate, DEFAULT_INTENT_OPTIONS, INTENT_WORDS, intentOptionsOk, optionsFor, dayOk, intentProblem, intentFields, intentChange, intentNotes, INTENT_FIELD_IDS } from "../js/intent-statement.js";
import { validateForm, buildCreateBody, mapServerErrors, FIELD_OF_SERVER_NAME as REG_FIELDS } from "../js/register-form.js";
import { changedFields, checkEdit, mapEditErrors, plainChangeNote, FIELD_OF_SERVER_NAME as EDIT_FIELDS } from "../js/edit-form.js";
import { snapshotOf, registerSnapshot, valuesFromPosting } from "../js/dirty-state.js";
import { shapes } from "../js/api.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ID = "3f1d5b1e-0000-4000-8000-000000000001";
const FORBIDDEN = /complian|certif|verif|\bpostings?\b|s ?8877|satisf/i;

test("the four codes and which two take a date are fixed", () => {
  assert.deepEqual(INTENT_CODES, ["fill_by", "fill_no_sooner", "not_current", "legal_requirement"]);
  assert.deepEqual(INTENT_DATE_CODES, ["fill_by", "fill_no_sooner"]);
  assert.deepEqual(INTENT_CODES.map(takesDate), [true, true, false, false]);
  assert.deepEqual(DEFAULT_INTENT_OPTIONS.map((o) => [o.code, o.needs_date]), [["fill_by", true], ["fill_no_sooner", true], ["not_current", false], ["legal_requirement", false]]);
});

test("a real calendar day only (YYYY-MM-DD)", () => {
  for (const ok of ["2026-12-01", "2027-02-28", "2028-02-29"]) assert.equal(dayOk(ok), true, ok);
  for (const bad of ["", "2026-02-31", "2026-13-01", "12/01/2026", "2026-1-1", "2026-12-01T00:00", "tomorrow", null, undefined, 20261201, "1999-12-31"]) assert.equal(dayOk(bad), false, String(bad));
});

test("not stated is fine; a value that takes a date needs a real one; a value that takes none is fine without", () => {
  assert.equal(intentProblem("", ""), null);
  assert.equal(intentProblem(undefined, undefined), null);
  assert.equal(intentProblem("not_current", ""), null);
  assert.equal(intentProblem("legal_requirement", "garbage"), null, "a date is not judged for a value that takes none");
  assert.equal(intentProblem("fill_by", ""), INTENT_WORDS.DATE_NEEDED);
  assert.equal(intentProblem("fill_no_sooner", "   "), INTENT_WORDS.DATE_NEEDED);
  assert.equal(intentProblem("fill_by", "2026-02-31"), INTENT_WORDS.DATE_BAD);
  assert.equal(intentProblem("fill_by", "2026-12-01"), null);
  assert.equal(intentProblem("whatever", ""), INTENT_WORDS.UNAVAILABLE);
});

test("create sends nothing when not stated, the code and the day for the two values that take one, only the code for the others", () => {
  assert.deepEqual(intentFields("", ""), {});
  assert.deepEqual(intentFields(undefined, "2026-12-01"), {});
  assert.deepEqual(intentFields("fill_by", " 2026-12-01 "), { intent_statement: "fill_by", intent_date: "2026-12-01" });
  assert.deepEqual(intentFields("fill_no_sooner", "2027-01-09"), { intent_statement: "fill_no_sooner", intent_date: "2027-01-09" });
  assert.deepEqual(intentFields("not_current", "2026-12-01"), { intent_statement: "not_current" }, "a day left in the box is not sent with a value that takes none");
  assert.deepEqual(intentFields("legal_requirement", ""), { intent_statement: "legal_requirement" });
  assert.deepEqual(intentFields("nonsense", ""), {});
});

test("edit sends only what changed; taking it away is the word not_stated; a day goes null with a value that takes none", () => {
  const none = { intent_statement: null, intent_date: null }, by = { intent_statement: "fill_by", intent_date: "2026-12-01" }, cur = { intent_statement: "not_current", intent_date: null };
  assert.deepEqual(intentChange(none, "", ""), {});
  assert.deepEqual(intentChange(none, "fill_by", "2026-12-01"), { intent_statement: "fill_by", intent_date: "2026-12-01" });
  assert.deepEqual(intentChange(none, "not_current", ""), { intent_statement: "not_current" });
  assert.deepEqual(intentChange(by, "fill_by", "2026-12-01"), {});
  assert.deepEqual(intentChange(by, "fill_by", "2026-12-15"), { intent_date: "2026-12-15" });
  assert.deepEqual(intentChange(by, "fill_no_sooner", "2026-12-01"), { intent_statement: "fill_no_sooner", intent_date: "2026-12-01" }, "a new value that takes a day sends the day too (the server judges the resulting state)");
  assert.deepEqual(intentChange(by, "not_current", ""), { intent_statement: "not_current", intent_date: null });
  assert.deepEqual(intentChange(by, "", ""), { intent_statement: "not_stated" });
  assert.deepEqual(intentChange(cur, "", ""), { intent_statement: "not_stated" });
  assert.deepEqual(intentChange(cur, "legal_requirement", ""), { intent_statement: "legal_requirement" });
  assert.deepEqual(intentChange(cur, "fill_by", "2027-02-01"), { intent_statement: "fill_by", intent_date: "2027-02-01" });
  assert.deepEqual(intentChange(undefined, "", ""), {});
  // the stored value is never rewritten by a form that did not touch it: the same code and the same day is nothing
  assert.deepEqual(intentChange({ intent_statement: "fill_by", intent_date: "2026-12-01" }, "fill_by", "2026-12-01"), {});
});

test("the options: the database's list when it is good, else the spec's wording; a stored value that is no longer offered stays selectable", () => {
  const good = [{ code: "fill_by", label: " Fill by ", meaning: "m1 meaning text", needs_date: true }, { code: "not_current", label: "Not now", meaning: "m3 meaning text", needs_date: false }];
  assert.equal(intentOptionsOk(good), true);
  assert.deepEqual(optionsFor(good, "").map((o) => [o.code, o.label]), [["fill_by", "Fill by"], ["not_current", "Not now"]], "the staff wording is used, trimmed");
  assert.deepEqual(optionsFor(null, "").map((o) => o.code), INTENT_CODES, "no list: the spec's four");
  assert.deepEqual(optionsFor([], "").map((o) => o.code), INTENT_CODES, "an empty list is not good");
  assert.deepEqual(optionsFor(good, "legal_requirement").map((o) => o.code), ["fill_by", "not_current", "legal_requirement"], "a value the opening holds stays selectable");
  for (const bad of [[{ code: "other", label: "x", meaning: "y", needs_date: false }], [{ code: "fill_by", label: "x", meaning: "y", needs_date: false }], [{ code: "fill_by", label: "", meaning: "y", needs_date: true }], "nope", [{ code: "fill_by" }]]) {
    assert.equal(intentOptionsOk(bad), false, JSON.stringify(bad));
  }
});

test("register form: not stated adds nothing to the body; a stated kind is judged and sent", () => {
  const base = { title: "Data Analyst", req: "R-1", closeout: "x", desc: "d", remote: true, locEntries: [], aiFilter: false, aiInterview: false };
  assert.deepEqual(validateForm(base), {});
  assert.equal("intent_statement" in buildCreateBody(base), false);
  assert.equal("intent_date" in buildCreateBody(base), false);
  assert.deepEqual(validateForm({ ...base, intent: "fill_by", intentDate: "" }), { intentDate: INTENT_WORDS.DATE_NEEDED });
  assert.deepEqual(validateForm({ ...base, intent: "fill_by", intentDate: "2026-02-31" }), { intentDate: INTENT_WORDS.DATE_BAD });
  assert.deepEqual(validateForm({ ...base, intent: "fill_by", intentDate: "2026-12-01" }), {});
  assert.deepEqual(validateForm({ ...base, intent: "legal_requirement", intentDate: "" }), {});
  const b = buildCreateBody({ ...base, intent: "fill_no_sooner", intentDate: "2027-01-09" });
  assert.equal(b.intent_statement, "fill_no_sooner"); assert.equal(b.intent_date, "2027-01-09");
  const c = buildCreateBody({ ...base, intent: "not_current", intentDate: "2027-01-09" });
  assert.equal(c.intent_statement, "not_current"); assert.equal("intent_date" in c, false);
});

test("a refusal of the server is shown under the kind-of-opening box, for both fields", () => {
  assert.equal(REG_FIELDS.intent_statement, "intentDate"); assert.equal(REG_FIELDS.intent_date, "intentDate");
  assert.equal(EDIT_FIELDS.intent_statement, "intentDate"); assert.equal(EDIT_FIELDS.intent_date, "intentDate");
  assert.deepEqual(INTENT_FIELD_IDS, { intent_statement: "intentDate", intent_date: "intentDate" });
  const r = mapServerErrors({ errors: [{ field: "intent_date", message: "intent_date is required with fill_by: give the day" }] });
  assert.deepEqual(r.byField, { intentDate: "intent_date is required with fill_by: give the day" });
  const e = mapEditErrors({ errors: [{ field: "intent_statement", message: "x" }] });
  assert.deepEqual(e.byField, { intentDate: "x" });
});

const orig = (o) => Object.assign({ id: ID, title: "Data Analyst", req_number: "R-100", company_name: "Acme", post_id: "ABCDEFGHJKMN", status: "live", stored_status: "live", closed_reason: null, is_remote: true, locations: [], location_ids: [], locations_attested: false,
  ai_filtering: false, ai_interview_other: false, third_party_recruiter: false, destination_links_exclusive: false, applicant_cap: null, description_text: "Analyse the data.", window_days: 45, posted_at: null, expiration_date: null, publish_by: null, go_live_at: null,
  created_at: "2026-09-01T00:00:00Z", last_edited_at: null, intent_statement: null, intent_date: null }, o || {});
const same = (o) => Object.assign({ title: "Data Analyst", req: "R-100", desc: "Analyse the data.", locEntries: [], remote: true, attested: false, appcap: "", aiFilter: false, aiInterview: false, recruiter: false, note: "", intent: "", intentDate: "" }, o || {});

test("edit form: an opening that states nothing and a form that states nothing send nothing; a page without the choice (intent undefined) sends nothing", () => {
  assert.deepEqual(changedFields(orig(), same()), {});
  assert.deepEqual(changedFields(orig(), same({ intent: undefined })), {});
  assert.deepEqual(changedFields(orig({ intent_statement: "fill_by", intent_date: "2026-12-01" }), same({ intent: undefined })), {}, "a page that could not offer the choice never clears it");
});

test("edit form: set, change the day, change the value, take it away", () => {
  assert.deepEqual(changedFields(orig(), same({ intent: "fill_by", intentDate: "2026-12-01" })), { intent_statement: "fill_by", intent_date: "2026-12-01" });
  const by = orig({ intent_statement: "fill_by", intent_date: "2026-12-01" });
  assert.deepEqual(changedFields(by, same({ intent: "fill_by", intentDate: "2026-12-01" })), {});
  assert.deepEqual(changedFields(by, same({ intent: "fill_by", intentDate: "2026-12-20" })), { intent_date: "2026-12-20" });
  assert.deepEqual(changedFields(by, same({ intent: "legal_requirement", intentDate: "" })), { intent_statement: "legal_requirement", intent_date: null });
  assert.deepEqual(changedFields(by, same({ intent: "", intentDate: "" })), { intent_statement: "not_stated" });
});

test("edit form: a live opening needs a note for a change of the kind; the date is judged; the body carries only the change", () => {
  const live = orig();
  const noNote = checkEdit(live, same({ intent: "not_current" }));
  assert.ok(noNote.errors.note, "a live opening needs a change note"); assert.equal(noNote.body, undefined);
  const ok = checkEdit(live, same({ intent: "not_current", note: "stating the kind" }));
  assert.deepEqual(ok.errors, {}); assert.deepEqual(ok.body, { posting_id: ID, intent_statement: "not_current", change_note: "stating the kind" });
  const noDay = checkEdit(live, same({ intent: "fill_by", intentDate: "", note: "x" }));
  assert.equal(noDay.errors.intentDate, INTENT_WORDS.DATE_NEEDED); assert.equal(noDay.body, undefined);
  const draft = checkEdit(orig({ status: "draft", stored_status: "draft" }), same({ intent: "legal_requirement" }));
  assert.deepEqual(draft.errors, {}); assert.deepEqual(draft.body, { posting_id: ID, intent_statement: "legal_requirement" });
});

test("the history list in Recent changes names the change in plain words", () => {
  assert.equal(plainChangeNote("edit-posting: changed intent_statement, intent_date"), "Kind of opening changed");
  assert.equal(plainChangeNote("edit-posting: changed title, intent_statement"), "Changed: job title and kind of opening.");
});

test("unsaved work: choosing a kind, changing its day or taking it away counts; whitespace and a day left under a value that takes none do not", () => {
  const v0 = valuesFromPosting(orig());
  const base = snapshotOf(v0);
  assert.equal(snapshotOf({ ...v0, intent: "" }), base);
  assert.notEqual(snapshotOf({ ...v0, intent: "not_current" }), base);
  const by = valuesFromPosting(orig({ intent_statement: "fill_by", intent_date: "2026-12-01" }));
  assert.equal(by.intent, "fill_by"); assert.equal(by.intentDate, "2026-12-01");
  const bySnap = snapshotOf(by);
  assert.notEqual(snapshotOf({ ...by, intentDate: "2026-12-02" }), bySnap);
  assert.notEqual(snapshotOf({ ...by, intent: "" }), bySnap);
  assert.equal(snapshotOf({ ...by, intentDate: " 2026-12-01 " }), bySnap);
  const cur = valuesFromPosting(orig({ intent_statement: "not_current" }));
  assert.equal(snapshotOf({ ...cur, intentDate: "2026-12-01" }), snapshotOf(cur), "a day under a value that takes none is not part of the form's state");
  // the register page's snapshot
  const r0 = registerSnapshot({ title: "", req: "" }, {});
  assert.notEqual(registerSnapshot({ title: "", req: "", intent: "legal_requirement" }, {}), r0);
  assert.equal(registerSnapshot({ title: "", req: "", intent: "" }, {}), r0);
});

test("the answers the pages accept: an answer from before the database change still passes; a bad code, a bad day or a long line is a broken answer", () => {
  const row = { company_name: "Acme", title: "Analyst", locations: [], is_remote: true, posted_at: "2026-09-01T00:00:00Z", closes_at: "2026-10-30T00:00:00Z", applicant_cap: null, status: "live", closed_reason: null, ai_filtering: false, ai_interview_other: false,
    ai_disclosure_shown: false, third_party_recruiter: false, masked_code: "****-****-ABCD", masked_req: null, posting_ref: "a".repeat(20), last_edited_at: null };
  assert.equal(shapes.searchRow(row), true, "without the field (before the change)");
  assert.equal(shapes.searchRow({ ...row, intent_line: null }), true);
  assert.equal(shapes.searchRow({ ...row, intent_line: "The employer says: Not a current vacancy" }), true);
  assert.equal(shapes.searchRow({ ...row, intent_line: "x".repeat(301) }), false);
  assert.equal(shapes.searchRow({ ...row, intent_line: 5 }), false);
  const open = orig({ post_id: "ABCDEFGHJKMN", req_searchable: true });
  assert.equal(shapes.openPosting(open), true);
  assert.equal(shapes.openPosting({ ...open, intent_statement: "fill_by", intent_date: "2026-12-01" }), true);
  assert.equal(shapes.openPosting({ ...open, intent_statement: "compliant" }), false);
  assert.equal(shapes.openPosting({ ...open, intent_statement: "fill_by", intent_date: "12/01/2026" }), false);
  assert.equal(shapes.intentOptions(DEFAULT_INTENT_OPTIONS), true);
  assert.equal(shapes.intentOptions([]), false);
});

test("what a candidate reads: only a plain sentence that begins The employer says; nothing at all otherwise", () => {
  assert.deepEqual(intentNotes({}), []);
  assert.deepEqual(intentNotes({ intent_line: null }), []);
  assert.deepEqual(intentNotes(null), []);
  const ok = intentNotes({ intent_line: "The employer says: Current vacancy, fill by Dec 1, 2026" });
  assert.equal(ok.length, 1); assert.equal(ok[0].key, "intent"); assert.equal(ok[0].text, "The employer says: Current vacancy, fill by Dec 1, 2026"); assert.equal(ok[0].label, "Kind of opening");
  assert.deepEqual(intentNotes({ intent_line: "Current vacancy, fill by Dec 1, 2026" }), [], "a sentence that does not begin The employer says is never shown");
  assert.deepEqual(intentNotes({ intent_line: "The employer says: " + "x".repeat(300) }), []);
  assert.deepEqual(intentNotes({ intent_line: "The employer says: a\nline break" }), []);
  assert.deepEqual(intentNotes({ intent_line: "Short" }), []);
});

test("the words rule: nothing a person reads in the new module holds compliant, certified, verified, posting or any claim to satisfy a law", () => {
  const texts = [...Object.values(INTENT_WORDS), ...DEFAULT_INTENT_OPTIONS.flatMap((o) => [o.label, o.meaning])];
  for (const t of texts) assert.equal(FORBIDDEN.test(t), false, t);
  for (const t of texts) assert.equal(/—/.test(t), false, "no em dash: " + t);
  const html = ["register.html", "edit.html"].map((f) => fs.readFileSync(path.join(ROOT, f), "utf8"));
  for (const t of html) { const seg = t.slice(t.indexOf('id="intentRow"'), t.indexOf('id="policyRow"')); assert.ok(seg.length > 200); assert.equal(FORBIDDEN.test(seg), false, seg.slice(0, 120)); assert.equal(/—/.test(seg), false); }
  // every candidate sentence the module can show starts with the words the rule requires
  assert.equal(intentNotes({ intent_line: "The employer says this opening is advertised to meet a legal or policy requirement, and a candidate may already be identified." }).length, 1);
});
