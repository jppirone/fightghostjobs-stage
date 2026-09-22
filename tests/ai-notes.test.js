// ai-notes.test.js - the employer's AI notes (pass D): the rule the pages apply before sending (the database's public.ai_note_problem, mirrored) and what a candidate reads.
import test from "node:test";
import assert from "node:assert/strict";
import { aiNoteProblem, aiNotes, MAX_AI_NOTE } from "../js/ai-notes.js";
import { validateForm, buildCreateBody } from "../js/register-form.js";
import { changedFields, checkEdit } from "../js/edit-form.js";
import { shapes } from "../js/api.js";

const NOTE = "Resumes are scored by an ATS keyword match before a recruiter reviews them.";

test("the rule: ordinary sentences pass; blank is no note; line breaks, control characters, 301 characters and any web address are refused", () => {
  assert.equal(aiNoteProblem(NOTE), null); assert.equal(aiNoteProblem(""), null); assert.equal(aiNoteProblem("x".repeat(MAX_AI_NOTE)), null);
  assert.equal(aiNoteProblem("We use an ATS, e.g. to rank by keywords; Acme Inc.'s recruiters review the top 20%."), null);
  assert.match(aiNoteProblem("one\ntwo"), /one paragraph/); assert.match(aiNoteProblem("a\tb"), /one paragraph/); assert.match(aiNoteProblem("a​b"), /one paragraph/);
  assert.match(aiNoteProblem("x".repeat(301)), /300 characters/);
  for (const bad of ["see https://acme.example", "see www.acme.example", "apply at acme.com today", "apply at acme．com today", "apply at acme[.]com today", "at 10.0.0.1"]) assert.match(aiNoteProblem(bad), /web address/, bad);
  assert.equal(aiNoteProblem("Acme. Com is not a link"), null);
});

test("what a candidate reads: only under a toggle that is on, in the designed order", () => {
  assert.deepEqual(aiNotes({ ai_filtering: true, ai_filtering_note: NOTE, ai_interview_other: false, ai_interview_note: null }), [{ key: "filtering", label: "AI filtering, in the employer's words", text: NOTE }]);
  assert.deepEqual(aiNotes({ ai_filtering: false, ai_filtering_note: NOTE }), []);            // a note the server should never send with a toggle off is not shown either
  assert.equal(aiNotes({ ai_filtering: true, ai_filtering_note: "F", ai_interview_other: true, ai_interview_note: "I" }).map((n) => n.key).join(","), "filtering,interview");
  assert.deepEqual(aiNotes({ ai_filtering: true }), []); assert.deepEqual(aiNotes(null), []);
});

test("register form: a note is checked and sent only while its toggle is on; a blank note is not sent", () => {
  const base = { title: "T", req: "R1", company: "Co", locEntries: [{ id: "gn:4671654", kind: "place", display: "Austin, TX" }], remote: false, appcap: "", closeout: "Filled", desc: "About the job", aiFilter: true, aiInterview: false, recruiter: false };
  assert.equal(validateForm(Object.assign({}, base, { aiFilterNote: NOTE })).aiFilterNote, undefined);
  assert.match(validateForm(Object.assign({}, base, { aiFilterNote: "see www.acme.example" })).aiFilterNote, /web address/);
  assert.equal(validateForm(Object.assign({}, base, { aiInterviewNote: "see www.acme.example" })).aiInterviewNote, undefined);       // the interview toggle is off: its box does not count
  const body = buildCreateBody(Object.assign({}, base, { aiFilterNote: "  " + NOTE + "  ", aiInterviewNote: "ignored" }));
  assert.equal(body.ai_filtering_note, NOTE); assert.equal("ai_interview_note" in body, false);
  assert.equal("ai_filtering_note" in buildCreateBody(Object.assign({}, base, { aiFilterNote: "   " })), false);
});

test("edit page: a note change is sent; turning the toggle off clears the note in the same edit; the note is checked", () => {
  const orig = { id: "3f1d5b1e-0000-4000-8000-000000000001", stored_status: "draft", title: "T", req_number: "R1", description_text: "About the job", location_ids: ["gn:4671654"], locations_attested: false, is_remote: false, ai_filtering: true, ai_interview_other: false, ai_filtering_note: NOTE, ai_interview_note: null, third_party_recruiter: false, destination_links_exclusive: false, applicant_cap: null };
  const v = { title: "T", req: "R1", desc: "About the job", locEntries: [{ id: "gn:4671654", kind: "place", display: "Austin, TX" }], attested: false, remote: false, appcap: "", aiFilter: true, aiInterview: false, aiFilterNote: NOTE, aiInterviewNote: "", recruiter: false, note: "" };
  assert.deepEqual(changedFields(orig, v), {});
  assert.deepEqual(changedFields(orig, Object.assign({}, v, { aiFilterNote: "New words." })), { ai_filtering_note: "New words." });
  assert.deepEqual(changedFields(orig, Object.assign({}, v, { aiFilterNote: "" })), { ai_filtering_note: null });
  assert.deepEqual(changedFields(orig, Object.assign({}, v, { aiFilter: false })), { ai_filtering: false, ai_filtering_note: null });
  assert.deepEqual(changedFields(orig, Object.assign({}, v, { aiInterview: true, aiInterviewNote: "Video interviews are transcribed." })), { ai_interview_other: true, ai_interview_note: "Video interviews are transcribed." });
  assert.match(checkEdit(orig, Object.assign({}, v, { aiFilterNote: "see www.acme.example" })).errors.aiFilterNote, /web address/);
});

test("the answers: the notes are accepted as null or a string of at most 300 characters, and an answer from before the pass (no fields) still passes", () => {
  const row = { company_name: "Meridian", title: "Analyst", locations: ["Remote"], is_remote: true, posted_at: "2026-09-02T12:00:00.000Z", closes_at: "2026-10-17T12:00:00.000Z", applicant_cap: null, status: "live", closed_reason: null, ai_filtering: true, ai_interview_other: false, ai_disclosure_shown: false, third_party_recruiter: false, masked_code: "****-****-QBF1", masked_req: null, posting_ref: "0123456789abcdefghjk", last_edited_at: null };
  assert.equal(shapes.searchRow(row), true);
  assert.equal(shapes.searchRow(Object.assign({}, row, { ai_filtering_note: NOTE, ai_interview_note: null })), true);
  assert.equal(shapes.searchRow(Object.assign({}, row, { ai_filtering_note: 7 })), false);
  assert.equal(shapes.searchRow(Object.assign({}, row, { ai_filtering_note: "x".repeat(301) })), false);
});
