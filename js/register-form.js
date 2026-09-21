// register-form.js - what the "Register a posting" form sends, and the checks made before it is sent. Pure (no DOM): tested in Node.
// The backend (create-posting) is the authority and refuses anything wrong; these checks only spare the employer a round trip and a rate-limit token.
// Facts fixed by the backend: the tier is always "standard" in this build (live on registration; the window is the poster's choice from 14 to 45 days, 45 when left alone; the extended tier is not
// offered); both AI disclosures are REQUIRED and are always sent as true or false (never omitted, never null); the acting employer and organization are never sent (the server reads them from the session).

import { problems as locationProblems } from "./location-rules.js";

export const MAX_APPLICANT_CAP = 2147483647;
export const MIN_WINDOW_DAYS = 14, MAX_WINDOW_DAYS = 45;      // the standard-tier window range: create-posting refuses anything else and so does the database (postings_window_days_check)

// The form's input ids -> the backend's field names (for showing a server refusal under the right input)
export const FIELD_OF_SERVER_NAME = {
  title: "jtitle", req_number: "req", company_name: "company", location_ids: "locpicker", locations: "locpicker", is_remote: "locpicker", locations_attested: "attest", applicant_cap: "appcap",
  initial_closeout_condition: "closeout", description_text: "desc", window_days: "livedays",
};

// values: { title, req, company, locEntries, attested, remote, appcap, win, closeout, desc, aiFilter, aiInterview, recruiter }     (locEntries: the catalog entries chosen in the picker, [{ id, kind, display }]; attested: the "one opening, fillable from any of these" box;  win: the days the posting stays live, as typed; empty means the default, 45)
export function validateForm(v) {
  const e = {};
  const need = (id, text, what) => { if (String(text || "").trim() === "") e[id] = "Enter " + what + "."; };
  need("jtitle", v.title, "the job title");
  need("company", v.company, "the company name");
  need("closeout", v.closeout, "what ends this posting");
  need("req", v.req, "your req number");
  need("desc", v.desc, "the job description");
  if (String(v.appcap || "").trim() !== "") {
    const t = String(v.appcap).trim();
    if (!/^\d+$/.test(t) || Number(t) < 1 || Number(t) > MAX_APPLICANT_CAP) e.appcap = "The cap must be a whole number of 1 or more, or left empty.";
  }
  const w = String(v.win == null ? "" : v.win).trim();
  if (w !== "" && (!/^\d{1,3}$/.test(w) || Number(w) < MIN_WINDOW_DAYS || Number(w) > MAX_WINDOW_DAYS)) e.livedays = "Enter a whole number of days from " + MIN_WINDOW_DAYS + " to " + MAX_WINDOW_DAYS + ".";
  const chosen = Array.isArray(v.locEntries) ? v.locEntries : [];
  if (v.remote !== true && chosen.length === 0) e.locpicker = "Choose a location from the list, or tick Remote role.";
  else Object.assign(e, locationProblems(chosen, v.remote === true, v.attested === true));
  return e;
}

export function buildCreateBody(v) {
  const chosen = Array.isArray(v.locEntries) ? v.locEntries : [];
  const body = {
    req_number: String(v.req).trim(),
    title: String(v.title).trim(),
    company_name: String(v.company).trim(),
    tier: "standard",
    initial_closeout_condition: String(v.closeout).trim(),
    description_text: String(v.desc).trim(),
    is_remote: v.remote === true,
    ai_filtering: v.aiFilter === true,
    ai_interview_other: v.aiInterview === true,
    third_party_recruiter: v.recruiter === true,
  };
  // Locations are sent as catalog ids ONLY (free text is refused by the backend); the display text is derived by the database. The attestation is sent when it applies (two or more locations).
  if (chosen.length) body.location_ids = chosen.map((c) => c.id);
  if (chosen.length >= 2) body.locations_attested = v.attested === true;
  if (String(v.appcap || "").trim() !== "") body.applicant_cap = Number(String(v.appcap).trim());
  const w = String(v.win == null ? "" : v.win).trim();
  if (w !== "") body.window_days = Number(w);          // omitted means 45 (the backend's default); a value outside 14-45 is refused by the backend, whatever this page checked
  return body;
}

// A refusal from the server -> { fieldId: message } plus a general message when nothing maps to an input.
export function mapServerErrors(err) {
  const byField = {}; let general = null;
  const list = err && Array.isArray(err.errors) && err.errors.length ? err.errors : err && err.field ? [{ field: err.field, message: err.message || "Not accepted." }] : [];
  for (const x of list) {
    const id = FIELD_OF_SERVER_NAME[x.field];
    if (id) { if (!byField[id]) byField[id] = x.message; } else if (!general) general = x.message;
  }
  if (!list.length && err && err.message) general = err.message;
  return { byField, general };
}
