// staff-invite.unit.test.js - the pure parts of the staff page "Companies to invite" (prompt IV, November 6, 2026): the dates and inputs, the sort, the words, and the two database calls in js/api.js
// (the right function names, the person's own token, never cached, an exact answer shape or a plain not ok). The page in a real browser is tests/staff-invite.test.js. No network, no database.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../js/staff-invite-model.js";
import { createApi } from "../js/api.js";
import { INVITE_ROWS, INVITE_TITLES } from "./fake-site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dash = new RegExp("[" + String.fromCharCode(8211, 8212) + "]");

test("the default range is the last 3 full calendar months through today, in the person's own calendar", () => {
  assert.deepEqual(M.defaultRange(new Date(2026, 10, 6)), { from: "2026-08-01", to: "2026-11-06" });
  assert.deepEqual(M.defaultRange(new Date(2027, 0, 15)), { from: "2026-10-01", to: "2027-01-15" });
  assert.deepEqual(M.defaultRange(new Date(2028, 2, 31)), { from: "2027-12-01", to: "2028-03-31" });
  assert.deepEqual(M.defaultRange(new Date(2026, 4, 1)), { from: "2026-02-01", to: "2026-05-01" });
  assert.equal(M.checkInputs({ from: M.defaultRange(new Date(2026, 10, 6)).from, to: M.defaultRange(new Date(2026, 10, 6)).to, min: "1", company: "" }).ok, true, "the default range is accepted");
});

test("checkInputs: what is sent is exactly the four database arguments, trimmed; a blank company is null and a blank minimum is 1", () => {
  const r = M.checkInputs({ from: "2026-08-01", to: "2026-11-06", min: "", company: "  Zeta Works  " });
  assert.deepEqual(r.args, { p_from: "2026-08-01", p_to: "2026-11-06", p_company: "Zeta Works", p_min_searches: 1 });
  assert.deepEqual(M.checkInputs({ from: "2026-08-01", to: "2026-11-06", min: " 12 ", company: "   " }).args, { p_from: "2026-08-01", p_to: "2026-11-06", p_company: null, p_min_searches: 12 });
  assert.deepEqual(Object.keys(r.args), ["p_from", "p_to", "p_company", "p_min_searches"]);
});

test("checkInputs: a missing or impossible date, from after to, a range over 36 months, a bad minimum or a long company name is refused with a plain line", () => {
  const base = { from: "2026-08-01", to: "2026-11-06", min: "1", company: "" };
  for (const bad of [{ from: "" }, { to: "" }, { from: "2026-13-01" }, { to: "2026-02-30" }, { from: "08/01/2026" }, { from: "2026-8-1" }, { from: null }, { to: undefined }]) {
    const r = M.checkInputs({ ...base, ...bad }); assert.equal(r.ok, false, JSON.stringify(bad)); assert.ok(r.errors.from || r.errors.to, JSON.stringify(bad));
  }
  assert.equal(M.checkInputs({ ...base, from: "2026-11-07", to: "2026-11-06" }).errors.to, "The To date cannot be before the From date.");
  assert.equal(M.checkInputs({ ...base, from: "2026-12-01", to: "2026-11-30" }).errors.to, "The To date cannot be before the From date.", "from in a later month than to");
  assert.equal(M.checkInputs({ ...base, from: "2027-01-01", to: "2026-12-31" }).ok, false, "from in a later year than to");
  assert.equal(M.checkInputs({ ...base, from: "2026-11-06", to: "2026-11-06" }).ok, true, "the same day is a range");
  assert.equal(M.checkInputs({ ...base, from: "2023-12-01", to: "2026-11-30" }).ok, true, "exactly 36 months is accepted");
  assert.equal(M.checkInputs({ ...base, from: "2023-10-31", to: "2026-11-01" }).errors.to, "Use a range of at most 36 months.", "37 whole months is refused");
  for (const m of ["0", "-1", "1.5", "abc", "100001", "1e3", "٣"]) assert.ok(M.checkInputs({ ...base, min: m }).errors.min, "minimum " + m);
  assert.equal(M.checkInputs({ ...base, min: "100000" }).ok, true);
  assert.ok(M.checkInputs({ ...base, company: "x".repeat(201) }).errors.company);
  assert.equal(M.checkInputs({ ...base, company: "x".repeat(200) }).ok, true);
});

test("monthLabel, peopleText and statusText: the database's words, as returned", () => {
  assert.equal(M.monthLabel("2026-08-01"), "Aug 2026"); assert.equal(M.monthLabel("2026-12-01"), "Dec 2026"); assert.equal(M.monthLabel("garbage"), "garbage"); assert.equal(M.monthLabel(null), "");
  assert.equal(M.peopleText({ different_people: 5, people_exact: true }), "5");
  assert.equal(M.peopleText({ different_people: 6, people_exact: false }), "at least 6");
  assert.equal(M.statusText({ status: "paying customer" }), "paying customer");
  assert.equal(M.statusText({ status: "registered, plan expired" }), "registered, plan expired");
  assert.equal(M.statusText({ status: null }), "No match"); assert.equal(M.statusText({ status: "" }), "No match");
});

test("sortRows: most first by default, fewest first on request, ties by company key, and the input is not changed", () => {
  const rows = INVITE_ROWS.concat([{ ...INVITE_ROWS[0], company: "Bee", company_key: "bee", searches: 7 }]);
  const before = JSON.stringify(rows);
  assert.deepEqual(M.sortRows(rows, "most").map((r) => r.company_key), ["zeta works", "bee", "northwind traders", "acme rockets", "pilot example"]);
  assert.deepEqual(M.sortRows(rows, "fewest").map((r) => r.company_key), ["pilot example", "acme rockets", "bee", "northwind traders", "zeta works"]);
  assert.deepEqual(M.sortRows(rows, undefined).map((r) => r.company_key), M.sortRows(rows, "most").map((r) => r.company_key), "anything else is the default");
  assert.equal(JSON.stringify(rows), before);
});

test("failureKind: a refused range, an ended sign-in and a plain failure; never the database's own text", () => {
  assert.equal(M.failureKind({ ok: true }), null);
  assert.equal(M.failureKind({ ok: false, status: 400, error: { code: "refused" } }), "range");
  for (const s of [401, 403, 404]) assert.equal(M.failureKind({ ok: false, status: s, error: { code: "refused" } }), "session");
  assert.equal(M.failureKind({ ok: false, status: 401, error: { code: "no_session" } }), "session");
  for (const r of [{ ok: false, status: 500, error: { code: "refused" } }, { ok: false, status: 0, error: { code: "network" } }, { ok: false, status: 200, error: { code: "bad_response" } }]) assert.equal(M.failureKind(r), "failed");
});

test("the words: the agreed sentences, no dash, the word opening and never posting, none of the words kept out of public wording", () => {
  assert.equal(M.EMPTY_TEXT, "No searches for companies outside the system in this date range.");
  assert.equal(M.MAX_MONTHS, 36);
  const html = fs.readFileSync(path.join(ROOT, "staff-invite.html"), "utf8");
  for (const s of [M.HEADING, M.LEAD, M.COMPANY_NOTE, M.PEOPLE_NOTE]) assert.ok(html.includes(s.replace(/"/g, '"')), "the page carries the sentence: " + s);
  assert.match(M.COMPANY_NOTE, /whole name, not part of it/);
  const words = Object.values(M).filter((v) => typeof v === "string").concat([html.slice(html.indexOf("<main"), html.indexOf("</main>")).replace(/<[^>]*>/g, " ")]).join("\n");   // the page's own words (the shared header and footer carry the product name)
  assert.equal(dash.test(words), false, "no em or en dash");
  assert.equal(/\bposting|\bghost\b|\bfake\b|\bscam|\bfraud|\bsuspicious|\bverified\b|\bcertified\b|\btrusted\b|\bcompliant\b|\bguaranteed\b|\bloophole|\bcompliance\b|\bdetect|\bflag\b|\bexpose\b/i.test(words.replace(/FightGhostJobs/g, "").replace(/\(verified\)/g, "")), false, "no word kept out of the product's wording");
});

test("the fake rows are exactly the nine and the four keys, and the answer checks accept them", () => {
  for (const r of INVITE_ROWS) assert.equal(Object.keys(r).length, 9);
  for (const r of INVITE_TITLES) assert.equal(Object.keys(r).length, 4);
});

// ---- the two database calls
function fakeApi(handler, token = "tok") {
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push({ url, init }); const r = await handler(url, init); return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: { get: () => null }, text: async () => r.body }; };
  return { api: createApi({ baseUrl: "https://p.example", key: "pub", getToken: async () => token, fetchImpl }), seen };
}
const ARGS = { p_from: "2026-08-01", p_to: "2026-11-06", p_company: null, p_min_searches: 1 };

test("staffInviteList and staffInviteListTitles: the right function, the arguments as given, the person's own token, never cached", async () => {
  for (const [name, fn, rows] of [["staffInviteList", "staff_invite_list", INVITE_ROWS], ["staffInviteListTitles", "staff_invite_list_titles", INVITE_TITLES]]) {
    const { api, seen } = fakeApi(async () => ({ status: 200, body: JSON.stringify(rows) }));
    const r = await api[name](ARGS);
    assert.equal(r.ok, true, name); assert.deepEqual(r.data, rows);
    assert.equal(seen[0].url, "https://p.example/rest/v1/rpc/" + fn);
    assert.equal(seen[0].init.method, "POST"); assert.equal(seen[0].init.cache, "no-store");
    assert.equal(seen[0].init.headers.Authorization, "Bearer tok"); assert.equal(seen[0].init.headers.apikey, "pub");
    assert.deepEqual(JSON.parse(seen[0].init.body), ARGS);
  }
});

test("an empty list is an answer; no session sends nothing; every refusal, error or network failure is a plain not ok", async () => {
  assert.deepEqual((await fakeApi(async () => ({ status: 200, body: "[]" })).api.staffInviteList(ARGS)).data, []);
  const { api, seen } = fakeApi(async () => ({ status: 200, body: "[]" }), null);
  const r = await api.staffInviteList(ARGS); assert.deepEqual([r.ok, r.status, r.error.code], [false, 401, "no_session"]); assert.equal(seen.length, 0);
  for (const status of [400, 401, 403, 404, 429, 500, 503]) { const x = await fakeApi(async () => ({ status, body: '{"code":"FG404","message":"secret database words"}' })).api.staffInviteList(ARGS); assert.equal(x.ok, false); assert.equal(x.error.code, "refused"); assert.equal(JSON.stringify(x).includes("secret"), false, "the database's text is never passed on"); }
  const net = createApi({ baseUrl: "https://p.example", key: "pub", getToken: async () => "t", fetchImpl: async () => { throw new Error("down"); } });
  assert.equal((await net.staffInviteList(ARGS)).error.code, "network"); assert.equal((await net.staffInviteListTitles(ARGS)).error.code, "network");
});

test("the answer checks: only the exact nine keys (list) and four keys (titles); an extra key such as an account code, a missing key, a wrong type or a non array is refused whole", async () => {
  const list = async (rows) => (await fakeApi(async () => ({ status: 200, body: JSON.stringify(rows) })).api.staffInviteList(ARGS));
  const titles = async (rows) => (await fakeApi(async () => ({ status: 200, body: JSON.stringify(rows) })).api.staffInviteListTitles(ARGS));
  const row = INVITE_ROWS[0], trow = INVITE_TITLES[0];
  assert.equal((await list([row, INVITE_ROWS[1]])).ok, true);
  assert.equal((await list([{ ...row, status: "paying customer" }])).ok, true);
  for (const bad of [{ ...row, account_hash: "x" }, { ...row, extra: 1 }, (({ status, ...r }) => r)(row), { ...row, searches: "7" }, { ...row, searches: -1 }, { ...row, searches: 1.5 }, { ...row, different_people: null }, { ...row, people_exact: "true" }, { ...row, status: 5 }, { ...row, company: null }, { ...row, first_month: null }, null, "x"]) assert.equal((await list([row, bad])).error.code, "bad_response", JSON.stringify(bad));
  for (const bad of [{ rows: [] }, null, "x", 5, true]) assert.equal((await list(bad)).ok, false);
  assert.equal((await titles([trow])).ok, true);
  for (const bad of [{ ...trow, account_hash: "x" }, (({ title, ...r }) => r)(trow), { ...trow, searches: "3" }, { ...trow, title: null }, { ...trow, searches: -2 }]) assert.equal((await titles([bad])).error.code, "bad_response", JSON.stringify(bad));
});
