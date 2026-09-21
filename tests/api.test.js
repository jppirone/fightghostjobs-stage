// api.test.js - the API layer against a fake fetch: what it sends, how it reads every answer, and that it fails closed. Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { createApi, describeError, isAuthFailure, shapes } from "../js/api.js";

const BASE = "https://example.test", KEY = "sb_publishable_TESTKEY";
const uuid = "11111111-1111-4111-8111-111111111111";
const ref = "0123456789abcdefghjk";
const searchRow = { company_name: "Meridian", title: "Analyst", locations: ["Remote"], is_remote: true, posted_at: "2026-09-02T12:00:00.000Z", closes_at: "2026-10-17T12:00:00.000Z", applicant_cap: null, status: "live", closed_reason: null,
  ai_filtering: false, ai_interview_other: true, ai_disclosure_shown: false, third_party_recruiter: false, masked_code: "****-****-QBF1", posting_ref: ref, last_edited_at: null };
const posting = { id: uuid, status: "draft", title: "Analyst", expiration_date: "2026-10-17T12:00:00.000Z", public_code: "D21M48YBZQBF", posting_ref: ref, closed_reason: null };

function fake(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: init && init.body ? JSON.parse(init.body) : null });
    const r = await handler(url, init, calls.length);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: { get: (k) => (r.headers || {})[k.toLowerCase()] ?? null }, text: async () => (typeof r.body === "string" ? r.body : JSON.stringify(r.body)) };
  };
  return { fetchImpl, calls };
}
const mk = (handler, token = "TOKEN.abc.def") => { const f = fake(handler); return { api: createApi({ baseUrl: BASE, key: KEY, getToken: async () => token, fetchImpl: f.fetchImpl }), calls: f.calls }; };

test("a session call sends the token and the publishable key, and never an identity", async () => {
  const { api, calls } = mk(() => ({ status: 201, body: { posting } }));
  const r = await api.createPosting({ title: "x" });
  assert.equal(r.ok, true); assert.equal(r.data.id, uuid);                                    // { posting } is unwrapped
  assert.equal(calls[0].url, BASE + "/functions/v1/create-posting");
  assert.equal(calls[0].init.headers.Authorization, "Bearer TOKEN.abc.def"); assert.equal(calls[0].init.headers.apikey, KEY);
  assert.equal(JSON.stringify(calls[0].body).includes("poster_id"), false);
});

test("no session -> nothing is sent at all", async () => {
  const f = fake(() => ({ status: 200, body: {} }));
  const api = createApi({ baseUrl: BASE, key: KEY, getToken: async () => null, fetchImpl: f.fetchImpl });
  const r = await api.posterSession();
  assert.equal(r.ok, false); assert.equal(r.error.code, "no_session"); assert.equal(f.calls.length, 0); assert.equal(isAuthFailure(r.error), true);
});

test("the employer sign-in intent uses the public key only (no Authorization header)", async () => {
  const { api, calls } = mk(() => ({ status: 202, body: { ok: true } }));
  const r = await api.posterLoginIntent("a@b.co");
  assert.equal(r.ok, true); assert.equal("Authorization" in calls[0].init.headers, false); assert.equal(calls[0].init.headers.apikey, KEY); assert.deepEqual(calls[0].body, { email: "a@b.co" });
});

test("errors are returned, never thrown: 400 with field errors, 401 variants, 404, 429 with Retry-After, 5xx, network", async () => {
  const cases = [
    [{ status: 400, body: { error: "req_number is required", field: "req_number", errors: [{ field: "req_number", message: "req_number is required" }] } }, (r) => { assert.equal(r.status, 400); assert.equal(r.error.field, "req_number"); assert.equal(r.error.errors.length, 1); assert.equal(r.error.code, "request_refused"); }],
    [{ status: 401, body: { error: "unauthorized", code: "unauthorized" } }, (r) => assert.equal(r.error.code, "unauthorized")],
    [{ status: 401, body: { source: "@supabase/server", code: "INVALID_JWT" } }, (r) => { assert.equal(r.error.code, "unauthorized"); assert.equal(isAuthFailure(r.error), true); }],
    [{ status: 401, body: { error: "x", code: "reverification_required" } }, (r) => assert.equal(r.error.code, "reverification_required")],
    [{ status: 401, body: { error: "x", code: "no_candidate_identity" } }, (r) => assert.equal(isAuthFailure(r.error), true)],
    [{ status: 404, body: { error: "not_found", code: "not_found" } }, (r) => assert.equal(r.error.code, "not_found")],
    [{ status: 429, headers: { "retry-after": "17" }, body: { error: "rate_limited", code: "rate_limited" } }, (r) => { assert.equal(r.error.code, "rate_limited"); assert.equal(r.error.retryAfter, 17); }],
    [{ status: 429, body: "not json" }, (r) => { assert.equal(r.error.code, "rate_limited"); assert.equal(r.error.retryAfter, null); }],
    [{ status: 500, body: { error: "Internal error" } }, (r) => { assert.equal(r.error.code, "server_error"); assert.match(describeError(r.error), /try again/i); }],
    [{ status: 502, body: "<html>bad gateway</html>" }, (r) => assert.equal(r.error.code, "server_error")],
    [{ status: 413, body: { error: "big", code: "body_too_large" } }, (r) => assert.equal(r.error.code, "body_too_large")],
  ];
  for (const [resp, check] of cases) { const { api } = mk(() => resp); check(await api.call("x", {})); }
  const f = createApi({ baseUrl: BASE, key: KEY, getToken: async () => "t", fetchImpl: async () => { throw new TypeError("Failed to fetch"); } });
  const n = await f.call("x", {}); assert.equal(n.ok, false); assert.equal(n.error.code, "network"); assert.match(describeError(n.error), /reach the server/i);
});

test("search answers are checked field by field; anything else fails closed", async () => {
  const good = { mode: "phrase", truncated: false, results: [searchRow] };
  assert.equal((await mk(() => ({ status: 200, body: good })).api.candidateSearch({ company: "Meridian", phrase: "Analyst" })).ok, true);
  const bads = [
    Object.assign({}, good, { results: [Object.assign({}, searchRow, { masked_code: "D21M48YBZQBF" })] }),           // a FULL code must never be accepted from the server
    Object.assign({}, good, { results: [Object.assign({}, searchRow, { ai_filtering: "yes" })] }),
    Object.assign({}, good, { results: [Object.assign({}, searchRow, { posting_ref: "short" })] }),
    Object.assign({}, good, { mode: "everything" }),
    Object.assign({}, good, { results: Array.from({ length: 26 }, () => searchRow) }),                                  // never more than 25
    { results: [] },
    "[]",
  ];
  for (const b of bads) { const r = await mk(() => ({ status: 200, body: b })).api.candidateSearch({ company: "Meridian", phrase: "Analyst" }); assert.equal(r.ok, false); assert.equal(r.error.code, "bad_response"); }
});

test("the search rows keep the two AI answers apart (the fields are read as sent, never swapped or merged)", () => {
  assert.equal(shapes.searchRow(Object.assign({}, searchRow, { ai_filtering: null, ai_interview_other: null })), true);
  assert.equal(shapes.searchRow(Object.assign({}, searchRow, { ai_filtering: undefined })), false);
});

test("detail: live answer, and the 409 not-open answer keeps its reason", async () => {
  const live = { posting: Object.assign({}, searchRow, { destination_links_exclusive: false }), links: [{ position: 1, label: "Careers site" }, { position: 2, label: null }] };
  assert.equal((await mk(() => ({ status: 200, body: live })).api.candidateDetail(ref)).ok, true);
  const r = await mk(() => ({ status: 409, body: { error: "posting_not_open", code: "posting_not_open", status: "closed", closed_reason: "filled" } })).api.candidateDetail(ref);
  assert.equal(r.ok, false); assert.equal(r.status, 409); assert.equal(r.data.status, "closed"); assert.equal(r.data.closed_reason, "filled");
  assert.equal((await mk(() => ({ status: 200, body: { posting: live.posting, links: Array.from({ length: 11 }, (_, i) => ({ position: 1, label: "x" })) } })).api.candidateDetail(ref)).ok, false);
});

test("link issue: only https go-links are accepted", async () => {
  const ok = { expires_at: "2026-09-20T12:00:00Z", links: [{ position: 1, label: "Careers", go_url: "https://x.supabase.co/functions/v1/go/1.abc.123.tag" }] };
  assert.equal((await mk(() => ({ status: 200, body: ok })).api.candidateLinkIssue(ref)).ok, true);
  for (const bad of ["http://x/go/1", "javascript:alert(1)", "//x/go/1", "/go/1"]) {
    const r = await mk(() => ({ status: 200, body: { expires_at: "t", links: [{ position: 1, label: "L", go_url: bad }] } })).api.candidateLinkIssue(ref);
    assert.equal(r.ok, false, bad);
  }
});

test("poster session shape; comments shape", async () => {
  const ps = { poster: { poster_id: uuid, full_name: "John", is_org_admin: true }, organization: { organization_id: uuid, name: "Acme" }, verified_at: "2026-09-20T00:00:00Z", reverify_by: "2026-10-20T00:00:00Z" };
  assert.equal((await mk(() => ({ status: 200, body: ps })).api.posterSession()).ok, true);
  assert.equal((await mk(() => ({ status: 200, body: { poster: { poster_id: "nope" } } })).api.posterSession()).ok, false);
  assert.equal((await mk(() => ({ status: 200, body: { total: 1, comments: [{ body: "hi", created_at: "2026-09-20T00:00:00Z" }], next_offset: null } })).api.candidateListComments(ref)).ok, true);
  assert.equal((await mk(() => ({ status: 200, body: { total: "1", comments: [] , next_offset: null } })).api.candidateListComments(ref)).ok, false);
});

test("create / publish answers are checked: a row without a proper public code or reference is refused", async () => {
  assert.equal((await mk(() => ({ status: 201, body: posting })).api.createPosting({})).ok, true);
  assert.equal((await mk(() => ({ status: 201, body: { posting } })).api.publishPosting(uuid)).ok, true);
  for (const bad of [Object.assign({}, posting, { public_code: "short" }), Object.assign({}, posting, { posting_ref: "x" }), Object.assign({}, posting, { id: "nope" }), {}]) {
    const r = await mk(() => ({ status: 201, body: bad })).api.createPosting({}); assert.equal(r.ok, false); assert.equal(r.error.code, "bad_response");
  }
});

test("wording for failures never shows raw server text for 5xx", () => {
  assert.doesNotMatch(describeError({ code: "server_error", message: "SQL exploded at line 9" }), /SQL/);
  assert.match(describeError({ code: "reverification_required" }), /verify your email again/i);
  assert.match(describeError({ code: "request_refused", message: "closed_reason must be filled or withdrawn" }), /closed_reason/);
});
