// register-form.js - what the "Register a posting" form sends, and the checks made before it is sent. Pure (no DOM): tested in Node.
// The backend (create-posting) is the authority and refuses anything wrong; these checks only spare the employer a round trip and a rate-limit token.
// Facts fixed by the backend: the tier is always "standard" in this build (45-day window, live on registration); both AI disclosures are REQUIRED and are always sent as true or false
// (never omitted, never null); the acting employer and organization are never sent (the server reads them from the session).

export const MAX_APPLICANT_CAP = 2147483647;

// The form's input ids -> the backend's field names (for showing a server refusal under the right input)
export const FIELD_OF_SERVER_NAME = {
  title: "jtitle", req_number: "req", company_name: "company", locations: "loc", is_remote: "loc", applicant_cap: "appcap",
  initial_closeout_condition: "closeout", description_text: "desc",
};

// values: { title, req, company, loc, remote, appcap, closeout, desc, aiFilter, aiInterview, recruiter }
export function validateForm(v) {
  const e = {};
  const need = (id, text, what) => { if (String(text || "").trim() === "") e[id] = "Enter " + what + "."; };
  need("jtitle", v.title, "the job title");
  need("req", v.req, "your req number");
  need("company", v.company, "the company name");
  need("closeout", v.closeout, "what ends this posting");
  need("desc", v.desc, "the job description");
  if (String(v.appcap || "").trim() !== "") {
    const t = String(v.appcap).trim();
    if (!/^\d+$/.test(t) || Number(t) < 1 || Number(t) > MAX_APPLICANT_CAP) e.appcap = "The cap must be a whole number of 1 or more, or left empty.";
  }
  if (v.remote !== true && String(v.loc || "").trim() === "") e.loc = "Enter a location, or tick Remote role.";
  return e;
}

export function buildCreateBody(v) {
  const loc = String(v.loc || "").trim();
  const body = {
    req_number: String(v.req).trim(),
    title: String(v.title).trim(),
    company_name: String(v.company).trim(),
    tier: "standard",
    initial_closeout_condition: String(v.closeout).trim(),
    description_text: String(v.desc).trim(),
    is_remote: v.remote === true,
    locations: loc === "" ? [] : [loc],
    ai_filtering: v.aiFilter === true,
    ai_interview_other: v.aiInterview === true,
    third_party_recruiter: v.recruiter === true,
  };
  if (String(v.appcap || "").trim() !== "") body.applicant_cap = Number(String(v.appcap).trim());
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
