// edit-form.js - what the "Edit a posting" page sends, and the checks made before it is sent. Pure (no DOM): tested in Node.
// The backend (edit-posting) is the authority and refuses anything wrong; these checks only spare the employer a round trip and a rate-limit token, and they say the same things the backend says.
// Rules held by the backend (see edit-posting): only what CHANGED is sent; a posting that is not a draft needs a change note for every edit; a change to the locations, the remote flag or the one-opening statement needs a
// NEW req number in the same edit; a changed requirements text must keep at least 90% of the stored wording (and 75% of the go-live text), a changed title 60%: those three are judged by the server, which answers 409.
// Company name, dates, tier and the closeout condition are never editable.

import { problems as locationProblems } from "./location-rules.js";

export const MAX_NOTE = 500, MAX_DESC = 20000, MAX_REQ = 100;
export const MAX_APPLICANT_CAP = 2147483647;

// The input each server field is shown under (the ids on edit.html)
export const FIELD_OF_SERVER_NAME = {
  title: "jtitle", req_number: "req", description_text: "desc", location_ids: "locpicker", is_remote: "locpicker", locations_attested: "attest", applicant_cap: "appcap", change_note: "note",
};

// how req numbers are compared everywhere (case, spaces and punctuation ignored)
export const reqKey = (t) => String(t == null ? "" : t).toLowerCase().replace(/[^a-z0-9]+/g, "");

const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
const hasControl = (s) => Array.from(String(s)).some((ch) => { const c = ch.codePointAt(0); return c < 32 || c === 127; });

// orig: the posting object get-my-posting returned.
// v: { title, req, desc, locEntries, attested, remote, appcap, aiFilter, aiInterview, recruiter, note }     (aiFilter / aiInterview: true, false or null = never stated and not touched)
// -> the fields that changed, by their backend names.
export function changedFields(orig, v) {
  const ch = {};
  const title = String(v.title == null ? "" : v.title).trim(), req = String(v.req == null ? "" : v.req).trim(), desc = String(v.desc == null ? "" : v.desc).trim();
  if (title !== orig.title) ch.title = title;
  if (req !== (orig.req_number == null ? "" : orig.req_number)) ch.req_number = req;
  if (desc !== String(orig.description_text).trim()) ch.description_text = desc;
  const ids = (Array.isArray(v.locEntries) ? v.locEntries : []).map((e) => e.id);
  if (!sameList(ids, orig.location_ids)) ch.location_ids = ids;
  if ((v.remote === true) !== orig.is_remote) ch.is_remote = v.remote === true;
  const attested = ids.length >= 2 && v.attested === true;
  if (attested !== orig.locations_attested) ch.locations_attested = attested;
  if (v.aiFilter !== null && v.aiFilter !== undefined && v.aiFilter !== orig.ai_filtering) ch.ai_filtering = v.aiFilter;
  if (v.aiInterview !== null && v.aiInterview !== undefined && v.aiInterview !== orig.ai_interview_other) ch.ai_interview_other = v.aiInterview;
  if ((v.recruiter === true) !== orig.third_party_recruiter) ch.third_party_recruiter = v.recruiter === true;
  const capText = String(v.appcap == null ? "" : v.appcap).trim(), cap = capText === "" ? null : Number(capText);
  if (/^[0-9]+$/.test(capText) ? cap !== orig.applicant_cap : (capText === "" && orig.applicant_cap !== null)) ch.applicant_cap = cap;
  return ch;
}

export const LOCATION_GROUP = ["location_ids", "is_remote", "locations_attested"];

// -> { errors: { fieldInputId: message, form?: message }, changed, body?: { posting_id, ...changed, change_note? } }
export function checkEdit(orig, v) {
  const e = {}, isDraft = orig.stored_status === "draft";
  const changed = changedFields(orig, v);
  const need = (id, text, what) => { if (String(text == null ? "" : text).trim() === "") e[id] = "Enter " + what + "."; };
  need("jtitle", v.title, "the job title"); need("req", v.req, "your req number"); need("desc", v.desc, "the job description");
  if (String(v.req || "").trim().length > MAX_REQ) e.req = "Keep the req number to " + MAX_REQ + " characters or fewer.";
  else if (String(v.req || "").trim() !== "" && reqKey(v.req) === "") e.req = "The req number needs at least one letter or digit.";
  else if (hasControl(String(v.req || "").trim())) e.req = "The req number must be plain text on one line.";
  if (String(v.desc || "").length > MAX_DESC) e.desc = "The job description is too long (" + MAX_DESC.toLocaleString("en-US") + " characters at most).";
  const capText = String(v.appcap == null ? "" : v.appcap).trim();
  if (capText !== "" && (!/^[0-9]+$/.test(capText) || Number(capText) < 1 || Number(capText) > MAX_APPLICANT_CAP)) e.appcap = "The cap must be a whole number of 1 or more, or left empty.";
  const chosen = Array.isArray(v.locEntries) ? v.locEntries : [];
  if (v.remote !== true && chosen.length === 0) e.locpicker = "Choose a location from the list, or tick Remote role.";
  else Object.assign(e, locationProblems(chosen, v.remote === true, v.attested === true));
  const note = String(v.note == null ? "" : v.note).trim();
  if (note.length > MAX_NOTE) e.note = "Keep the note to " + MAX_NOTE + " characters or fewer.";
  else if (hasControl(note)) e.note = "Keep the note to plain text.";
  const keys = Object.keys(changed);
  if (keys.length === 0) { e.form = "Nothing has changed."; return { errors: e, changed }; }
  if (!isDraft) {
    if (note === "" && !e.note) e.note = "Say what changed and why. The note is required and is kept with the posting.";
    if (keys.some((k) => LOCATION_GROUP.includes(k))) {
      if (!("req_number" in changed) || reqKey(changed.req_number) === reqKey(orig.req_number)) e.req = "Changing the location, the remote flag or the one-opening statement needs a new req number. Enter one and say what changed in the note.";
    }
  }
  if (Object.keys(e).length) return { errors: e, changed };
  const body = Object.assign({ posting_id: orig.id }, changed);
  if (note !== "") body.change_note = note;
  return { errors: e, changed, body };
}

// A refusal from the server -> { byField: { inputId: message }, general, newPosting, needNote }.
// newPosting: the refusal says "register a new posting" (the page then offers the link). needNote: a draft's reused req number needs the note as its explanation.
export function mapEditErrors(err) {
  const byField = {}; let general = null, newPosting = false, needNote = false;
  if (!err) return { byField, general: "Something went wrong.", newPosting, needNote };
  const code = err.code;
  if (code === "text_changed_too_much" || code === "text_drifted_too_far") { byField.desc = err.message || "This edit changes most of the requirements."; newPosting = true; }
  else if (code === "title_changed_too_much") { byField.jtitle = err.message || "This edit changes most of the title."; newPosting = true; }
  else if (code === "location_change_needs_new_req") byField.req = err.message || "Changing the location needs a new req number.";
  else if (code === "duplicate_req") { byField.note = err.message || "This company already has a posting with this req number. Add a short note saying why it is being reused, then save again."; needNote = true; }
  else {
    const list = Array.isArray(err.errors) && err.errors.length ? err.errors : err.field ? [{ field: err.field, message: err.message || "Not accepted." }] : [];
    for (const x of list) { const id = FIELD_OF_SERVER_NAME[x.field]; if (id) { if (!byField[id]) byField[id] = x.message; } else if (!general) general = x.message; }
    if (!list.length && err.message) general = err.message;
  }
  return { byField, general, newPosting, needNote };
}

// what an edit is called in the change list (the kind the backend logged)
export const KIND_TEXT = { draft_edit: "Draft edit", edit: "Edit", text_correction: "Requirements text corrected", req_change: "Req number changed", location_change: "Location changed" };
