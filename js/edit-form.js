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
// v: { title, req, desc, locEntries, attested, remote, appcap, aiFilter, aiInterview, recruiter, exclusive, note }     (aiFilter / aiInterview: true, false or null = never stated and not touched; exclusive: true / false, or undefined = the employer's plan does not offer it, so it is not touched)
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
  if (typeof v.exclusive === "boolean" && v.exclusive !== (orig.destination_links_exclusive === true)) ch.destination_links_exclusive = v.exclusive;
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

// ---- destination links (verified plan). set-destination-links replaces the WHOLE set (1 to 10 addresses); the addresses are write-only (never sent back), so the page asks for the full set again to change it.
export const MAX_LINKS = 10, MAX_URL = 2048, MAX_LABEL = 100, PLAN_WARN_DAYS = 14;

// rows: [{ url, label }] as typed (a row with both boxes empty is ignored). -> { ok, errors: { rowIndex: { url?, label? } }, form?, links: [{ url, label? }] (the rows that are fine, in order), rowOf: [rowIndex of each link] }
export function checkLinks(rows) {
  const errors = {}, links = [], rowOf = [], seen = new Set(); let used = 0;
  (Array.isArray(rows) ? rows : []).forEach((r, i) => {
    const url = String(r && r.url != null ? r.url : "").trim(), label = String(r && r.label != null ? r.label : "").trim();
    if (url === "" && label === "") return;
    used++;
    const e = {};
    if (url === "") e.url = "Enter the address, or clear this row.";
    else if (url.length > MAX_URL) e.url = "Keep the address to " + MAX_URL + " characters or fewer.";
    else if (!/^https:\/\//i.test(url)) e.url = "The address must start with https://";
    else {
      let href = null; try { const u = new URL(url); if (u.protocol === "https:" && u.hostname !== "") href = u.href; } catch { /* not an address */ }
      if (href === null) e.url = "That does not look like a web address.";
      else if (seen.has(href)) e.url = "This address is already in the list.";
      else seen.add(href);
    }
    if (Array.from(label).length > MAX_LABEL) e.label = "Keep the label to " + MAX_LABEL + " characters or fewer.";
    else if (hasControl(label)) e.label = "Keep the label to plain text.";
    if (Object.keys(e).length) errors[i] = e; else { links.push(label === "" ? { url } : { url, label }); rowOf.push(i); }
  });
  const out = { ok: false, errors, links, rowOf };
  if (used === 0) out.form = "Enter at least one address.";
  else if (used > MAX_LINKS) out.form = "Up to " + MAX_LINKS + " destination links.";
  out.ok = !out.form && Object.keys(errors).length === 0;
  return out;
}

// A refusal from set-destination-links -> { rows: { rowIndex: { url?, label? } }, general, planRequired }. rowOf: the row each SENT link came from (the server counts the links it was sent).
export function mapLinksErrors(err, rowOf) {
  const rows = {}; let general = null;
  if (!err) return { rows, general: "Something went wrong.", planRequired: false };
  if (err.code === "plan_required") return { rows, general: err.message || "Destination links are part of the verified plan. Your organization is not on it (or the plan has ended), so nothing was changed.", planRequired: true };
  const list = Array.isArray(err.errors) && err.errors.length ? err.errors : err.field ? [{ field: err.field, message: err.message || "Not accepted." }] : [];
  for (const x of list) {
    const m = /^links\[(\d+)\]\.(url|label)/.exec(x.field);
    const row = m && Array.isArray(rowOf) ? rowOf[Number(m[1])] : undefined;
    if (m && row !== undefined) { rows[row] = rows[row] || {}; if (!rows[row][m[2]]) rows[row][m[2]] = x.message; } else if (!general) general = x.message;
  }
  if (!list.length && err.message) general = err.message;
  return { rows, general, planRequired: false };
}

// What the page says about the plan. plan: what get-my-posting / poster-session returned.
// -> { state: "active" | "lapsed" | "locked" | "unknown", endsAt, endsSoon }   (active: verified now; lapsed: it ended, the links and names are kept but hidden; locked: never verified)
export function planNotice(plan, nowMs) {
  if (!plan || typeof plan !== "object") return { state: "unknown", endsAt: null, endsSoon: false };
  if (plan.verified === true) { const ends = plan.expires_at ? Date.parse(plan.expires_at) : NaN; return { state: "active", endsAt: plan.expires_at || null, endsSoon: Number.isFinite(ends) && ends - nowMs <= PLAN_WARN_DAYS * 86400000 }; }
  if (plan.lapsed === true) return { state: "lapsed", endsAt: plan.expires_at || null, endsSoon: false };
  return { state: "locked", endsAt: null, endsSoon: false };
}
