// api.js - every call the site makes to the backend, in one place.
// createApi() takes its dependencies as arguments (base URL, publishable key, a function that returns the current access token, a fetch), so the very same code runs in the browser and in
// Node (tests/api.test.js and the live end-to-end suite use it unchanged).
//
// Rules this file enforces for every page:
//   * it never throws for an HTTP problem: it returns { ok:false, status, error:{ code, message, field, errors, retryAfter } } and the page decides what to show;
//   * a 2xx answer is checked against the exact shape the page relies on; anything else is reported as { ok:false, error:{ code:"bad_response" } } (fail closed: a backend change must be noticed, not rendered);
//   * the session's access token goes in the Authorization header, the publishable key in apikey; the identity is NEVER sent in a body (the backend refuses poster_id / organization_id and reads who you are from the token).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF_RE = /^[0-9a-hjkmnp-tv-z]{20}$/;
const MASK_RE = /^\*{4}-\*{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
// the masked req number: at most 3 leading characters, a fixed block of four stars, at most 2 trailing characters (the full number is never sent to a candidate)
const MASKED_REQ_RE = /^.{0,3}[*]{4}.{0,2}$/;
const isStr = (v) => typeof v === "string";
const isBool = (v) => typeof v === "boolean";
const isNullable = (v, t) => v === null || t(v);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export const AUTH_FAILURE_CODES = ["unauthorized", "reverification_required", "no_candidate_identity", "not_a_candidate_session", "invalid_verification_time", "no_session"];
export const isAuthFailure = (err) => !!err && AUTH_FAILURE_CODES.includes(err.code);

const POSTING_STATUSES = ["draft", "live", "paused", "expired", "closed", "flagged"];
const EFFECTIVE_STATUSES = POSTING_STATUSES.concat(["scheduled"]);      // what the employer's views report: a draft that carries a go-live time reads "scheduled" (never a stored status)

// ---- response shapes (exactly what the pages read)
export const shapes = {
  // the organization's plan (item 3): verified now?, where it came from, when it ends, and whether it HAS ended (lapsed: links and named recruiter firms are stored but hidden)
  plan: (d) => isObj(d) && isBool(d.verified) && isNullable(d.source, isStr) && isNullable(d.expires_at, isStr) && isBool(d.lapsed),
  posterSession: (d) => isObj(d) && isObj(d.poster) && UUID_RE.test(d.poster.poster_id) && isStr(d.poster.full_name) && isBool(d.poster.is_org_admin) && isObj(d.organization) && isStr(d.organization.name) && isStr(d.verified_at) && (d.plan === undefined || shapes.plan(d.plan)),
  posting: (d) => isObj(d) && UUID_RE.test(d.id) && isStr(d.status) && isStr(d.title) && isStr(d.expiration_date) && /^[0-9A-Z]{12}$/.test(d.public_code) && REF_RE.test(d.posting_ref) && isNullable(d.closed_reason, isStr),
  searchRow: (r) => isObj(r) && isStr(r.company_name) && isStr(r.title) && Array.isArray(r.locations) && r.locations.every(isStr) && isBool(r.is_remote) && isStr(r.posted_at) && isStr(r.closes_at)
    && isNullable(r.applicant_cap, Number.isInteger) && isStr(r.status) && isNullable(r.closed_reason, isStr) && isNullable(r.ai_filtering, isBool) && isNullable(r.ai_interview_other, isBool) && isBool(r.ai_disclosure_shown)
    && isBool(r.third_party_recruiter) && MASK_RE.test(r.masked_code) && isNullable(r.masked_req, (v) => isStr(v) && MASKED_REQ_RE.test(v)) && REF_RE.test(r.posting_ref) && isNullable(r.last_edited_at, isStr),
  search: (d) => isObj(d) && (d.mode === "phrase" || d.mode === "code" || d.mode === "req") && isBool(d.truncated) && Array.isArray(d.results) && d.results.length <= 25 && d.results.every(shapes.searchRow),
  detail: (d) => isObj(d) && isObj(d.posting) && shapes.searchRow(Object.assign({ }, d.posting)) && Array.isArray(d.links) && d.links.length <= 13
    && d.links.every((l) => isObj(l) && Number.isInteger(l.position) && l.position >= 1 && l.position <= 10 && isNullable(l.label, isStr) && (l.kind === undefined || l.kind === "apply" || l.kind === "recruiter") && (l.firm === undefined || isNullable(l.firm, isStr)) && (l.kind !== "recruiter" || isStr(l.firm))),
  linkIssue: (d) => isObj(d) && isStr(d.expires_at) && Array.isArray(d.links) && d.links.every((l) => isObj(l) && Number.isInteger(l.position) && isNullable(l.label, isStr) && isStr(l.go_url) && /^https:\/\//.test(l.go_url) && (l.kind === undefined || l.kind === "apply" || l.kind === "recruiter")),
  comments: (d) => isObj(d) && Number.isInteger(d.total) && Array.isArray(d.comments) && d.comments.every((c) => isObj(c) && isStr(c.body) && isStr(c.created_at)) && isNullable(d.next_offset, Number.isInteger),
  // list-my-postings (the employer's own list): every field the dashboard reads, checked; anything else is ignored
  myPosting: (p) => isObj(p) && UUID_RE.test(p.id) && isStr(p.title) && isNullable(p.req_number, isStr) && /^[0-9A-Z]{12}$/.test(p.post_id) && EFFECTIVE_STATUSES.includes(p.status) && POSTING_STATUSES.includes(p.stored_status)
    && isNullable(p.closed_reason, isStr) && isBool(p.is_remote) && Array.isArray(p.locations) && p.locations.every(isStr) && Array.isArray(p.location_ids) && p.location_ids.every(isStr) && isBool(p.locations_attested)
    && Number.isInteger(p.window_days) && isNullable(p.posted_at, isStr) && isNullable(p.expiration_date, isStr) && isNullable(p.publish_by, isStr) && isNullable(p.go_live_at, isStr) && isNullable(p.applicant_cap, Number.isInteger)
    && isBool(p.bump_used) && isNullable(p.bump_days, Number.isInteger) && isStr(p.created_at) && isNullable(p.last_edited_at, isStr) && Number.isInteger(p.comment_count) && p.comment_count >= 0,
  myPostings: (d) => isObj(d) && Number.isInteger(d.total) && d.total >= 0 && Array.isArray(d.postings) && d.postings.length <= 50 && d.postings.every(shapes.myPosting) && isNullable(d.next_offset, Number.isInteger),
  // get-my-posting (one posting, for the edit page): the fields the form starts from, checked; recent_changes: the newest five log entries (when, note, kind, the NAMES of the fields; never values)
  openPosting: (p) => isObj(p) && UUID_RE.test(p.id) && isStr(p.title) && isNullable(p.req_number, isStr) && isStr(p.company_name) && /^[0-9A-Z]{12}$/.test(p.post_id) && EFFECTIVE_STATUSES.includes(p.status) && POSTING_STATUSES.includes(p.stored_status)
    && isNullable(p.closed_reason, isStr) && isBool(p.is_remote) && Array.isArray(p.locations) && p.locations.every(isStr) && Array.isArray(p.location_ids) && p.location_ids.every(isStr) && isBool(p.locations_attested)
    && isNullable(p.ai_filtering, isBool) && isNullable(p.ai_interview_other, isBool) && isBool(p.third_party_recruiter) && isBool(p.destination_links_exclusive) && isNullable(p.applicant_cap, Number.isInteger) && isStr(p.description_text) && Number.isInteger(p.window_days)
    && isNullable(p.posted_at, isStr) && isNullable(p.expiration_date, isStr) && isNullable(p.publish_by, isStr) && isNullable(p.go_live_at, isStr) && isStr(p.created_at) && isNullable(p.last_edited_at, isStr),
  // the destination links the employer stored: position and label only, NEVER the address (the server keeps that encrypted and does not send it back)
  // pass B: a stored link may also say what candidates see for it (shown_as: derived from where it goes, never from the label; null for a firm without a link) and how the liveness check went when it was saved.
  // pass C: kind 'apply' (an application link, up to 10) or 'recruiter' (a named recruiter firm, up to 3; firm = its name, a link optional)
  linkExtras: (x) => (x.shown_as === undefined || isNullable(x.shown_as, isStr)) && (x.check_status === undefined || x.check_status === null || ["ok", "failed", "skipped"].includes(x.check_status)) && (x.check_http === undefined || x.check_http === null || Number.isInteger(x.check_http))
    && (x.kind === undefined || x.kind === "apply" || x.kind === "recruiter") && (x.firm === undefined || isNullable(x.firm, isStr)) && (x.kind !== "recruiter" || isStr(x.firm)),
  storedLinks: (l) => Array.isArray(l) && l.length <= 13 && l.every((x) => isObj(x) && Number.isInteger(x.position) && x.position >= 1 && x.position <= 10 && isNullable(x.label, isStr) && shapes.linkExtras(x)),
  linksAnswer: (d) => isObj(d) && Number.isInteger(d.active_links) && shapes.storedLinks(d.links),
  openAnswer: (d) => isObj(d) && shapes.openPosting(d.posting) && shapes.storedLinks(d.destination_links) && shapes.plan(d.plan) && Array.isArray(d.recent_changes) && d.recent_changes.length <= 5
    && d.recent_changes.every((c) => isObj(c) && isStr(c.at) && isStr(c.note) && isNullable(c.kind, isStr) && Array.isArray(c.fields) && c.fields.every(isStr)),
  // schedule-posting: whether anything changed, the go-live time now stored (null = removed) and the resulting status
  scheduleAnswer: (d) => isObj(d) && isBool(d.changed) && isNullable(d.go_live_at, isStr) && (d.status === "draft" || d.status === "scheduled"),
  // the roster (poster-roster-list): every field the Team page reads
  rosterRow: (p) => isObj(p) && UUID_RE.test(p.poster_id) && isStr(p.full_name) && isStr(p.email) && isBool(p.is_org_admin) && (p.status === "active" || p.status === "invited") && isStr(p.added_at),
  roster: (d) => isObj(d) && Array.isArray(d.posters) && d.posters.length <= 50 && d.posters.every(shapes.rosterRow),
  rosterAdded: (d) => isObj(d) && UUID_RE.test(d.poster_id) && d.status === "invited",
  rosterRemoved: (d) => isObj(d) && Number.isInteger(d.transferred),
  rosterAdmin: (d) => isObj(d) && isBool(d.changed),
  // edit-posting: what the page reads is whether anything changed, which fields, and (for a requirements-text edit) how much of the wording was kept
  editAnswer: (d) => isObj(d) && Array.isArray(d.changed_fields) && d.changed_fields.every(isStr) && isBool(d.edited) && isNullable(d.similarity_pct === undefined ? null : d.similarity_pct, Number.isInteger),
  // pause / resume / bump / close: only the fact that it worked and the posting's new status are read
  actionAnswer: (d) => { const p = d && isObj(d.posting) ? d.posting : d; return isObj(p) && isStr(p.status); },
  comment: (d) => isObj(d) && isObj(d.comment) && isStr(d.comment.body) && isStr(d.comment.created_at),
};

export function createApi({ baseUrl, key, getToken, fetchImpl }) {
  const doFetch = fetchImpl || ((...a) => fetch(...a));

  // auth: "session" (default: a signed-in session is required) | "none" (public key only)
  async function call(fn, body, { auth = "session", validate } = {}) {
    const headers = { "Content-Type": "application/json", apikey: key };
    if (auth === "session") {
      const token = await getToken();
      if (!token) return { ok: false, status: 401, error: { code: "no_session" } };
      headers.Authorization = "Bearer " + token;
    }
    let res, text;
    try {
      res = await doFetch(baseUrl + "/functions/v1/" + fn, { method: "POST", headers, body: JSON.stringify(body === undefined ? {} : body), cache: "no-store" });
      text = await res.text();
    } catch {
      return { ok: false, status: 0, error: { code: "network" } };
    }
    let data = null;
    try { data = JSON.parse(text); } catch { /* not JSON */ }
    if (res.ok) {
      if (validate && !validate(data)) return { ok: false, status: res.status, error: { code: "bad_response" } };
      return { ok: true, status: res.status, data };
    }
    const ra = Number(res.headers && res.headers.get ? res.headers.get("retry-after") : NaN);
    let code = data && typeof data.code === "string" ? data.code : null;
    if (res.status === 401 && !AUTH_FAILURE_CODES.includes(code)) code = "unauthorized";      // the platform's own 401s carry an upper-case library code
    if (!code) code = res.status === 429 ? "rate_limited" : res.status === 404 ? "not_found" : res.status === 413 ? "body_too_large" : res.status >= 500 ? "server_error" : "request_refused";
    const errors = data && Array.isArray(data.errors) ? data.errors.filter((e) => isObj(e) && isStr(e.field) && isStr(e.message)) : [];
    return { ok: false, status: res.status, data, error: { code, message: data && isStr(data.error) ? data.error : null, field: data && isStr(data.field) ? data.field : null, errors, retryAfter: Number.isFinite(ra) && ra > 0 ? ra : null } };
  }

  const postingAnswer = (d) => shapes.posting(d && isObj(d.posting) ? d.posting : d);
  const unwrap = (r) => (r.ok && isObj(r.data) && isObj(r.data.posting) && !r.data.id ? Object.assign({}, r, { data: r.data.posting }) : r);

  return {
    call,
    // ---- employer (poster) side
    posterLoginIntent: (email) => call("poster-login-intent", { email }, { auth: "none" }),
    posterSession: () => call("poster-session", {}, { validate: shapes.posterSession }),
    createPosting: async (fields) => unwrap(await call("create-posting", fields, { validate: postingAnswer })),
    getMyPosting: (postingId) => call("get-my-posting", { posting_id: postingId }, { validate: shapes.openAnswer }),
    editPosting: (body) => call("edit-posting", body, { validate: shapes.editAnswer }),
    // sets, changes or removes (null) a DRAFT's scheduled go-live time; goLiveAt: an ISO instant with a time zone
    schedulePosting: (postingId, goLiveAt) => call("schedule-posting", { posting_id: postingId, go_live_at: goLiveAt }, { validate: shapes.scheduleAnswer }),
    // the roster (admins only): list, add (invited until their first sign-in), remove (naming a successor when they own postings), make / unmake an admin
    rosterList: () => call("poster-roster-list", {}, { validate: shapes.roster }),
    rosterAdd: (body) => call("poster-roster-add", body, { validate: shapes.rosterAdded }),
    rosterRemove: (targetId, successorId) => call("poster-roster-remove", successorId ? { target_poster_id: targetId, successor_poster_id: successorId } : { target_poster_id: targetId }, { validate: shapes.rosterRemoved }),
    rosterSetAdmin: (targetId, isAdmin) => call("poster-roster-set-admin", { target_poster_id: targetId, is_org_admin: isAdmin }, { validate: shapes.rosterAdmin }),
    // replaces the posting's whole set of destination links (verified plan): [{ url, label? }], 1 to 10; an EMPTY list removes them all (candidates then see no apply link)
    setDestinationLinks: (postingId, links) => call("set-destination-links", { posting_id: postingId, links }, { validate: shapes.linksAnswer }),
    // replaces the posting's whole set of named recruiter firms (verified plan, and only while the posting says a recruiter is involved): [{ name, url? }], 0 to 3; [] removes them all
    setRecruiterFirms: (postingId, firms) => call("set-destination-links", { posting_id: postingId, kind: "recruiter", links: firms }, { validate: shapes.linksAnswer }),
    listMyPostings: (offset) => call("list-my-postings", offset ? { offset } : {}, { validate: shapes.myPostings }),
    pausePosting: (postingId) => call("pause-posting", { posting_id: postingId }, { validate: shapes.actionAnswer }),
    resumePosting: (postingId) => call("resume-posting", { posting_id: postingId }, { validate: shapes.actionAnswer }),
    bumpPosting: (postingId, days, reason) => call("bump-posting", { posting_id: postingId, bump_days: days, bump_reason: reason }, { validate: shapes.actionAnswer }),
    closePosting: (postingId, reason, detail) => call("close-posting", Object.assign({ posting_id: postingId, closed_reason: reason }, detail ? { closed_detail: detail } : {}), { validate: shapes.actionAnswer }),
    publishPosting: async (postingId) => unwrap(await call("publish-posting", { posting_id: postingId }, { validate: postingAnswer })),
    // ---- candidate side
    candidateSession: () => call("candidate-session", {}),
    candidateSearch: (q) => call("candidate-search", q, { validate: shapes.search }),
    candidateDetail: (postingRef) => call("candidate-posting-detail", { posting_ref: postingRef }, { validate: shapes.detail }),
    candidateLinkIssue: (postingRef) => call("candidate-link-issue", { posting_ref: postingRef }, { validate: shapes.linkIssue }),
    candidateListComments: (postingRef, offset) => call("candidate-list-comments", offset ? { posting_ref: postingRef, offset } : { posting_ref: postingRef }, { validate: shapes.comments }),
    candidatePostComment: (postingRef, text) => call("candidate-post-comment", { posting_ref: postingRef, body: text }, { validate: shapes.comment }),
  };
}

// Human wording for a failed call; pages add their own context. Never shows raw server text for 5xx / unknown answers.
export function describeError(err, { what = "That" } = {}) {
  if (!err) return "Something went wrong.";
  switch (err.code) {
    case "network": return "Could not reach the server. Check your connection and try again.";
    case "rate_limited": return "Too many requests just now.";
    case "bad_response": return "The server answered in a way this page did not expect, so nothing was shown. Please try again, and tell us if it keeps happening.";
    case "server_error": return "The server had a problem. Nothing was changed; please try again in a moment.";
    case "unauthorized": case "no_session": return "Please sign in again.";
    case "reverification_required": return "Your email verification has expired. Please verify your email again.";
    case "no_candidate_identity": case "not_a_candidate_session": return "This page needs a verified candidate session.";
    case "not_found": return what + " could not be found.";
    case "body_too_large": return "That is too large to send.";
    default: return err.message ? String(err.message).slice(0, 200) : what + " was refused.";
  }
}
