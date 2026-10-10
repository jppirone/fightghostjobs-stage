// registered.unit.test.js - the page side of the "Registered" check mark rule (October 9, 2026, prompt AZ): js/registered.js and the one new key of the staff answer in js/api.js.
// The RULE itself (an active paid plan: plan verified, plan_source paid, not expired; no part of it is destination links) lives in the database and is proven there: registered-check-migration\registered-check-test.sql and
// registered-check-migration\localdb-proof.mjs (outside this repository, because Pages serves everything in it). No network, no database here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isRegistered } from "../js/registered.js";
import { createApi } from "../js/api.js";

test("only a real boolean true is registered; every other value, a missing key and a missing row are not", () => {
  assert.equal(isRegistered({ is_registered: true }), true);
  for (const v of [false, "true", "True", 1, "1", null, undefined, {}, [], [true], "yes", "Registered", 0, NaN]) assert.equal(isRegistered({ is_registered: v }), false, JSON.stringify(v));
  assert.equal(isRegistered({}), false, "the key is missing (an answer from before the database change)");
  assert.equal(isRegistered(null), false); assert.equal(isRegistered(undefined), false); assert.equal(isRegistered("row"), false);
});

const BASE = { company_name: "Acme", organization_name: "Acme Org", title: "Analyst", locations: ["Austin, TX"], is_remote: false, status: "live", stored_status: "live", closed_reason: null, posted_at: "2026-09-02T14:00:00Z", closes_at: "2026-11-06T17:02:00Z",
  go_live_at: null, applicant_cap: null, ai_filtering: false, ai_interview_other: true, third_party_recruiter: true, opening_id: "D21M-48YB-ZQBF", req_number: "4471" };
const answer = (rows) => JSON.stringify({ mode: "phrase", truncated: false, results: rows });
const staffSearch = async (rows) => createApi({ baseUrl: "https://p.example", key: "pub", getToken: async () => "tok", fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => answer(rows) }) }).staffSearch({ p_company: "Acme", p_phrase: "Analyst" });

test("a staff row may carry is_registered (the 18th key) or not (the 17 keys of before the database change); any other extra key still refuses the row", async () => {
  assert.equal((await staffSearch([BASE])).ok, true, "17 keys");
  assert.equal((await staffSearch([{ ...BASE, is_registered: true }])).ok, true, "18 keys with is_registered true");
  assert.equal((await staffSearch([{ ...BASE, is_registered: false }])).ok, true, "18 keys with is_registered false");
  assert.equal((await staffSearch([{ ...BASE, is_registered: true, plan: "verified" }])).ok, false, "a plan name rides along: refused whole");
  assert.equal((await staffSearch([{ ...BASE, is_registered: true, plan_source: "paid" }])).ok, false, "a plan source rides along: refused whole");
  assert.equal((await staffSearch([{ ...BASE, is_registered: true, plan_expires_at: "2027-01-01T00:00:00Z" }])).ok, false, "a plan expiry rides along: refused whole");
  assert.equal((await staffSearch([{ ...BASE, is_registered: true, posting_ref: "m".repeat(20) }])).ok, false, "a posting reference rides along: refused whole");
  const { title, ...noTitle } = BASE;
  assert.equal((await staffSearch([{ ...noTitle, is_registered: true }])).ok, false, "a required key missing is still refused");
});
