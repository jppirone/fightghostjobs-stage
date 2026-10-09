// staff-scope.unit.test.js - the pure parts of the staff-only search scope (October 8, 2026): which address asks for it (js/staff-scope.js), the words on a staff card, and the two database calls in js/api.js
// (the right address, the person's own token, never cached, any refusal or odd answer is a plain not ok). The page behavior in a real browser is tests/staff-scope.test.js. No network, no database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { wantsStaffScope, staffStatusLabel, staffChips, staffIdLine, staffCountText, STAFF_BANNER, STAFF_STATUS_LABEL } from "../js/staff-scope.js";
import { createApi } from "../js/api.js";

test("only exactly one scope parameter with exactly the value all asks for the staff scope", () => {
  for (const s of ["?scope=all", "scope=all", "?x=1&scope=all", "?scope=all&x=1"]) assert.equal(wantsStaffScope(s), true, s);
  for (const s of ["", "?", "?scope=", "?scope", "?scope=ALL", "?scope=All", "?scope=live", "?scope=all%20", "?scope=%61ll%00", "?scope=all&scope=all", "?scope=all&scope=live", "?scopes=all", "?xscope=all", "?scope[]=all", null, undefined, 5, {}]) assert.equal(wantsStaffScope(s), false, String(s));
  assert.equal(wantsStaffScope("?scope=%61ll"), true, "a percent-escaped a is the same value");
});

test("every status has its one plain word; a draft with a go-live time reads Scheduled", () => {
  assert.deepEqual(Object.keys(STAFF_STATUS_LABEL).sort(), ["closed", "draft", "expired", "flagged", "live", "paused", "scheduled"]);
  assert.equal(staffStatusLabel({ status: "draft", go_live_at: null }), "Draft");
  assert.equal(staffStatusLabel({ status: "draft", go_live_at: "2026-10-12T14:00:00Z" }), "Scheduled");
  assert.equal(staffStatusLabel({ status: "flagged" }), "Held for review");
  for (const [s, w] of [["live", "Live"], ["paused", "Paused"], ["closed", "Closed"], ["expired", "Expired"]]) assert.equal(staffStatusLabel({ status: s }), w);
  assert.equal(staffStatusLabel({ status: "weird" }), "Status unknown");
  assert.equal(STAFF_BANNER, "Staff view: showing all openings, including ones that are not live.");
});

const BASE = { company_name: "Acme", organization_name: "Acme Org", title: "Analyst", locations: ["Austin, TX"], is_remote: false, status: "live", stored_status: "live", closed_reason: null, posted_at: "2026-09-02T14:00:00Z", closes_at: "2026-11-06T17:02:00Z",
  go_live_at: null, applicant_cap: null, ai_filtering: false, ai_interview_other: true, third_party_recruiter: true, opening_id: "D21M-48YB-ZQBF", req_number: "4471" };

test("a staff card's chips are the dates that apply, then the disclosures; the status word is not a chip (the card shows it once, in its pill); nothing a candidate could act on", () => {
  const words = (row) => staffChips(row).map((c) => c.text);
  assert.ok(words(BASE).some((x) => /^Went live /.test(x)) && words(BASE).some((x) => /^Closes /.test(x)));
  assert.equal(words({ ...BASE, status: "draft", stored_status: "draft", posted_at: null, closes_at: null })[0], "Not live yet");
  assert.match(words({ ...BASE, status: "draft", stored_status: "draft", posted_at: null, closes_at: null, go_live_at: "2026-10-12T14:00:00Z" })[0], /^Goes live /);
  assert.equal(words({ ...BASE, status: "flagged", stored_status: "flagged" })[0], "Candidates do not see it");
  assert.ok(words({ ...BASE, status: "expired", stored_status: "live", closed_reason: "expired_no_action" }).includes("Stored as live"), "an expired row that is stored as live says so");
  assert.ok(words({ ...BASE, status: "closed", stored_status: "closed", closed_reason: "filled" }).includes("Reason: Filled"));
  // the status word appears ONCE on a card (October 9, 2026: "Draft" was drawn in the pill and again as a chip): no chip of any status repeats the pill's word
  for (const [status, extra] of [["draft", {}], ["draft", { go_live_at: "2026-10-12T14:00:00Z" }], ["flagged", {}], ["live", {}], ["paused", {}], ["closed", { closed_reason: "filled" }], ["expired", { stored_status: "live" }]]) {
    const row = { ...BASE, status, stored_status: extra.stored_status || status, ...extra }, label = staffStatusLabel(row);
    const repeats = staffChips(row).filter((c) => new RegExp("\\b" + label + "\\b").test(c.text));
    assert.deepEqual(repeats, [], status + ": a chip repeats the status word " + label);
  }
  assert.ok(words(BASE).includes("Third-party recruiter involved") && words(BASE).includes("No applicant cap set"));
  const all = [BASE, { ...BASE, status: "draft", stored_status: "draft" }, { ...BASE, status: "paused", stored_status: "paused" }].map((r) => staffChips(r).map((c) => c.text).join(" | ")).join(" ");
  for (const bad of [/\bcomment/i, /\bwatch/i, /\bapply\b/i, /tell the employer/i, /\bposting/i, /\blisting/i, /verif/i, /certif/i, /complian/i]) assert.doesNotMatch(all, bad, String(bad));
  assert.equal(staffIdLine(BASE), "Acme Org · Opening ID D21M-48YB-ZQBF · Req 4471");
  assert.equal(staffIdLine({ ...BASE, req_number: null }), "Acme Org · Opening ID D21M-48YB-ZQBF");
  assert.equal(staffCountText(0, false), "No matching openings"); assert.equal(staffCountText(1, false), "1 matching opening"); assert.match(staffCountText(25, true), /^25 matching openings: showing the first 25/);
});

// ---- the two database calls
function fakeApi(handler, token = "tok") {
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push({ url, init }); const r = await handler(url, init); return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: { get: () => null }, text: async () => r.body }; };
  return { api: createApi({ baseUrl: "https://p.example", key: "pub", getToken: async () => token, fetchImpl }), seen };
}
const answer = (rows, extra) => JSON.stringify({ mode: "phrase", truncated: false, results: rows, ...extra });

test("is_staff: the right address, the person's own token, never cached; only a JSON true or false is an answer", async () => {
  const { api, seen } = fakeApi(async () => ({ status: 200, body: "true" }));
  const r = await api.isStaff();
  assert.deepEqual([r.ok, r.data], [true, true]);
  assert.equal(seen[0].url, "https://p.example/rest/v1/rpc/is_staff");
  assert.equal(seen[0].init.method, "POST"); assert.equal(seen[0].init.cache, "no-store");
  assert.equal(seen[0].init.headers.Authorization, "Bearer tok"); assert.equal(seen[0].init.headers.apikey, "pub");
  assert.equal(seen[0].init.body, "{}");
  for (const body of ['"true"', "1", "null", "{}", "[true]", "yes", ""]) assert.equal((await fakeApi(async () => ({ status: 200, body })).api.isStaff()).ok, false, "answer " + body);
  assert.equal((await fakeApi(async () => ({ status: 200, body: "false" })).api.isStaff()).data, false);
});

test("every refusal, missing function, error or network failure is a plain not ok, and no session means no request at all", async () => {
  for (const status of [400, 401, 403, 404, 429, 500, 503]) { const r = await fakeApi(async () => ({ status, body: '{"code":"x"}' })).api.isStaff(); assert.equal(r.ok, false, "status " + status); assert.equal(r.error.code, "refused"); }
  const net = createApi({ baseUrl: "https://p.example", key: "pub", getToken: async () => "t", fetchImpl: async () => { throw new Error("down"); } });
  assert.equal((await net.isStaff()).ok, false); assert.equal((await net.staffSearch({ p_company: "Acme", p_phrase: "Analyst" })).error.code, "network");
  const { api, seen } = fakeApi(async () => ({ status: 200, body: "true" }), null);
  const r = await api.isStaff(); assert.deepEqual([r.ok, r.status, r.error.code], [false, 401, "no_session"]); assert.equal(seen.length, 0, "nothing was sent without a session");
});

test("staffSearch: only the exact answer shape is accepted; any extra key, wrong status, wrong id shape or more than 25 rows is refused whole", async () => {
  const ok = async (rows, extra) => (await fakeApi(async () => ({ status: 200, body: answer(rows, extra) })).api.staffSearch({ p_company: "Acme", p_phrase: "Analyst" }));
  const good = await ok([BASE, { ...BASE, status: "draft", stored_status: "draft", posted_at: null, closes_at: null, go_live_at: "2026-10-12T14:00:00Z", req_number: null, ai_filtering: null }]);
  assert.equal(good.ok, true); assert.equal(good.data.results.length, 2);
  for (const [name, rows, extra] of [
    ["an extra key in a row (posting_ref)", [{ ...BASE, posting_ref: "m".repeat(20) }]], ["an extra key in a row (description_text)", [{ ...BASE, description_text: "x" }]], ["a missing key", [(({ title, ...r }) => r)(BASE)]],
    ["a status that does not exist", [{ ...BASE, status: "scheduled" }]], ["a stored status that does not exist", [{ ...BASE, stored_status: "weird" }]], ["an opening id of the wrong shape", [{ ...BASE, opening_id: "D21M48YBZQBF" }]],
    ["lower case in the opening id", [{ ...BASE, opening_id: "d21m-48yb-zqbf" }]], ["locations that are not text", [{ ...BASE, locations: [1] }]], ["26 rows", Array.from({ length: 26 }, () => BASE)],
    ["an extra key on the answer", [BASE], { extra: 1 }], ["a wrong mode", [BASE], { mode: "all" }], ["truncated not a boolean", [BASE], { truncated: "no" }],
  ]) assert.equal((await ok(rows, extra)).ok, false, name);
  assert.equal((await fakeApi(async () => ({ status: 200, body: "not json" })).api.staffSearch({})).error.code, "bad_response");
});

test("staffSearch sends only the search words to the right address, with the person's own token, never cached", async () => {
  const { api, seen } = fakeApi(async () => ({ status: 200, body: answer([]) }));
  await api.staffSearch({ p_company: "Acme", p_req: "4471" });
  assert.equal(seen[0].url, "https://p.example/rest/v1/rpc/staff_search_openings"); assert.equal(seen[0].init.cache, "no-store");
  assert.deepEqual(JSON.parse(seen[0].init.body), { p_company: "Acme", p_req: "4471" }); assert.equal(seen[0].init.headers.Authorization, "Bearer tok");
});
