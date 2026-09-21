// edit.test.js - the edit page's pure logic (js/edit-form.js) and the answers it relies on.
import test from "node:test";
import assert from "node:assert/strict";
import { changedFields, checkEdit, mapEditErrors, reqKey, MAX_NOTE, MAX_DESC, KIND_TEXT } from "../js/edit-form.js";
import { shapes } from "../js/api.js";

const ID = "3f1d5b1e-0000-4000-8000-000000000001";
const AUSTIN = { id: "gn:4671654", kind: "place", display: "Austin, TX" }, DALLAS = { id: "gn:4684888", kind: "place", display: "Dallas, TX" };
const orig = (o) => Object.assign({ id: ID, title: "Data Analyst", req_number: "R-100", company_name: "Acme", post_id: "ABCDEFGHJKMN", status: "live", stored_status: "live", closed_reason: null, is_remote: false, locations: ["Austin, TX"], location_ids: [AUSTIN.id],
  locations_attested: false, ai_filtering: false, ai_interview_other: null, third_party_recruiter: false, applicant_cap: null, description_text: "Analyse the data.", window_days: 45, posted_at: "2026-09-01T00:00:00Z", expiration_date: "2026-10-16T00:00:00Z",
  publish_by: null, created_at: "2026-09-01T00:00:00Z", last_edited_at: null }, o || {});
const same = (o) => Object.assign({ title: "Data Analyst", req: "R-100", desc: "Analyse the data.", locEntries: [AUSTIN], attested: false, remote: false, appcap: "", aiFilter: false, aiInterview: null, recruiter: false, note: "" }, o || {});

test("nothing changed: nothing is sent", () => {
  assert.deepEqual(changedFields(orig(), same()), {});
  const r = checkEdit(orig(), same({ note: "hello" })); assert.equal(r.body, undefined); assert.ok(r.errors.form);
});

test("only what changed is sent, trimmed, with the note; the posting id comes from the loaded posting", () => {
  const r = checkEdit(orig(), same({ title: "  Data Analyst II ", note: "  Level fixed  " }));
  assert.deepEqual(r.errors, {}); assert.deepEqual(r.body, { posting_id: ID, title: "Data Analyst II", change_note: "Level fixed" });
  assert.deepEqual(Object.keys(changedFields(orig(), same({ desc: "Analyse the data well.", appcap: "25", recruiter: true, aiFilter: true }))).sort(), ["ai_filtering", "applicant_cap", "description_text", "third_party_recruiter"]);
});

test("an AI answer that was never stated is not sent until it is touched; a stated one can be flipped, never cleared", () => {
  assert.equal("ai_interview_other" in changedFields(orig(), same({ aiInterview: null })), false);
  assert.equal(changedFields(orig(), same({ aiInterview: true })).ai_interview_other, true);
  assert.equal(changedFields(orig(), same({ aiFilter: true })).ai_filtering, true);
  assert.equal("ai_filtering" in changedFields(orig(), same({ aiFilter: null })), false);
});

test("a posting that is not a draft: the note is required for every edit", () => {
  for (const blank of ["", "   ", undefined, null]) { const r = checkEdit(orig(), same({ title: "Data Analyst II", note: blank })); assert.ok(r.errors.note, JSON.stringify(blank)); assert.equal(r.body, undefined); }
  assert.ok(checkEdit(orig(), same({ title: "Data Analyst II", note: "x".repeat(MAX_NOTE + 1) })).errors.note);
  assert.equal(checkEdit(orig(), same({ title: "Data Analyst II", note: "x".repeat(MAX_NOTE) })).errors.note, undefined);
});

test("a draft: the note is optional and is sent only when given", () => {
  const d = orig({ status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: "2026-09-15T00:00:00Z" });
  const r = checkEdit(d, same({ title: "Data Analyst II" })); assert.deepEqual(r.errors, {}); assert.equal("change_note" in r.body, false);
  assert.equal(checkEdit(d, same({ title: "Data Analyst II", note: "why" })).body.change_note, "why");
  assert.ok(checkEdit(d, same({ title: "Data Analyst II", note: "x".repeat(MAX_NOTE + 1) })).errors.note);
});

test("the location rule: on a live posting a change to the places, the remote flag or the one-opening statement needs a NEW req number", () => {
  for (const v of [{ locEntries: [DALLAS] }, { remote: true }, { locEntries: [AUSTIN, DALLAS], attested: true }]) {
    const r = checkEdit(orig(), same(Object.assign({ note: "moved" }, v))); assert.ok(r.errors.req, JSON.stringify(v)); assert.equal(r.body, undefined);
    const same2 = checkEdit(orig(), same(Object.assign({ note: "moved", req: "r 100" }, v))); assert.ok(same2.errors.req, "the same number typed differently is not new");
    const ok = checkEdit(orig(), same(Object.assign({ note: "moved; new req number", req: "R-200" }, v))); assert.deepEqual(ok.errors, {}); assert.equal(ok.body.req_number, "R-200"); assert.ok(ok.body.location_ids || ok.body.is_remote !== undefined);
  }
  const d = orig({ status: "draft", stored_status: "draft" });
  assert.deepEqual(checkEdit(d, same({ locEntries: [DALLAS] })).errors, {}, "a draft's location changes freely");
});

test("the fields are checked the way the backend checks them", () => {
  assert.ok(checkEdit(orig(), same({ title: " ", note: "n" })).errors.jtitle);
  assert.ok(checkEdit(orig(), same({ req: "  ", note: "n" })).errors.req);
  assert.ok(checkEdit(orig(), same({ req: "---", note: "n" })).errors.req);
  assert.ok(checkEdit(orig(), same({ req: "x".repeat(101), note: "n" })).errors.req);
  assert.ok(checkEdit(orig(), same({ desc: "", note: "n" })).errors.desc);
  assert.ok(checkEdit(orig(), same({ desc: "x".repeat(MAX_DESC + 1), note: "n" })).errors.desc);
  for (const bad of ["0", "-1", "2.5", "abc", "99999999999"]) assert.ok(checkEdit(orig(), same({ appcap: bad, note: "n" })).errors.appcap, bad);
  assert.ok(checkEdit(orig(), same({ locEntries: [], remote: false, note: "n" })).errors.locpicker);
  assert.equal(reqKey("  R-100 "), "r100"); assert.equal(reqKey("---"), "");
});

test("server refusals land under the right input; the 'too much changed' ones offer a new posting; a draft's reused req asks for the note", () => {
  const t = mapEditErrors({ code: "text_changed_too_much", message: "This edit changes most of the requirements (about 55% ...", field: "description_text", errors: [] });
  assert.equal(t.byField.desc, "This edit changes most of the requirements (about 55% ..."); assert.equal(t.newPosting, true);
  assert.equal(mapEditErrors({ code: "text_drifted_too_far", message: "m" }).newPosting, true);
  const ti = mapEditErrors({ code: "title_changed_too_much", message: "m" }); assert.equal(ti.byField.jtitle, "m"); assert.equal(ti.newPosting, true);
  assert.equal(mapEditErrors({ code: "location_change_needs_new_req", message: "m" }).byField.req, "m");
  const d = mapEditErrors({ code: "duplicate_req", message: "m", field: "change_note" }); assert.equal(d.byField.note, "m"); assert.equal(d.needNote, true); assert.equal(d.newPosting, false);
  assert.equal(mapEditErrors({ code: "invalid_request", field: "change_note", message: "required", errors: [{ field: "change_note", message: "required" }] }).byField.note, "required");
  assert.equal(mapEditErrors({ code: "invalid_request", field: "status", message: "cannot be edited", errors: [] }).general, "cannot be edited");
  assert.ok(KIND_TEXT.text_correction && KIND_TEXT.location_change);
});

test("get-my-posting and edit-posting answers: the page fails closed on a shape it does not expect", () => {
  const change = { at: "2026-09-02T00:00:00Z", note: "n", kind: "edit", fields: ["title"] };
  assert.equal(shapes.openAnswer({ posting: orig(), recent_changes: [change] }), true);
  assert.equal(shapes.openAnswer({ posting: orig({ ai_filtering: null, applicant_cap: 5 }), recent_changes: [] }), true);
  assert.equal(shapes.openAnswer({ posting: orig({ description_text: 5 }), recent_changes: [] }), false);
  assert.equal(shapes.openAnswer({ posting: orig({ status: "bogus" }), recent_changes: [] }), false);
  assert.equal(shapes.openAnswer({ posting: orig(), recent_changes: [{ at: 5, note: "n", kind: null, fields: [] }] }), false);
  assert.equal(shapes.openAnswer({ posting: orig(), recent_changes: Array.from({ length: 6 }, () => change) }), false);
  assert.equal(shapes.editAnswer({ changed_fields: ["title"], edited: true, history_id: "x", edit_kind: "edit", similarity_pct: null }), true);
  assert.equal(shapes.editAnswer({ changed_fields: [], edited: false, history_id: null }), true);
  assert.equal(shapes.editAnswer({ changed_fields: "title", edited: true }), false);
});
