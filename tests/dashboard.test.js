// dashboard.test.js - the "My postings" model: status chips, the closing-soon boundary, filters, ordering, and the table cells. Run: node --test tests/dashboard.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { CLOSING_SOON_DAYS, FILTERS, isClosingSoon, statusChip, matchesFilter, matchesText, sortByPosted, reqCell, postedCell, capCell, closesCell } from "../js/dashboard-model.js";

const NOW = Date.parse("2026-09-21T12:00:00Z"), DAY = 86400000, at = (days) => new Date(NOW + days * DAY).toISOString();
const base = { id: "11111111-1111-4111-8111-111111111111", title: "Analyst", req_number: "R-1", post_id: "ABCD2345EFGH", status: "live", closed_reason: null, stored_status: "live", is_remote: false, locations: [], location_ids: [], locations_attested: false,
  window_days: 45, posted_at: at(-5), expiration_date: at(40), publish_by: null, applicant_cap: null, bump_used: false, bump_days: null, created_at: at(-5), last_edited_at: null, comment_count: 0 };
const row = (o) => Object.assign({}, base, o);

test("closing soon: live or paused, and 10 days or fewer left (exactly 10 days counts, 10 days and a second does not, already past does not)", () => {
  assert.equal(CLOSING_SOON_DAYS, 10);
  assert.equal(isClosingSoon(row({ expiration_date: at(10) }), NOW), true);
  assert.equal(isClosingSoon(row({ expiration_date: new Date(NOW + 10 * DAY + 1000).toISOString() }), NOW), false);
  assert.equal(isClosingSoon(row({ expiration_date: at(0.001) }), NOW), true);
  assert.equal(isClosingSoon(row({ expiration_date: at(-1) }), NOW), false);
  assert.equal(isClosingSoon(row({ status: "paused", expiration_date: at(3) }), NOW), true);
  assert.equal(isClosingSoon(row({ status: "closed", expiration_date: at(3) }), NOW), false);
  assert.equal(isClosingSoon(row({ status: "draft", expiration_date: null }), NOW), false);
});

test("status chips say what the posting is, in the site's own words", () => {
  const t = (o) => statusChip(row(o), NOW);
  assert.deepEqual(t({}), { text: "Live", cls: "status-active" });
  assert.deepEqual(t({ expiration_date: at(4) }), { text: "Closing soon", cls: "status-closing" });
  assert.equal(t({ status: "paused" }).text, "Paused");
  assert.equal(t({ status: "paused", expiration_date: at(2) }).text, "Paused · closing soon");
  assert.equal(t({ status: "draft", posted_at: null, expiration_date: null }).text, "Draft");
  assert.equal(t({ status: "flagged" }).text, "In review");
  assert.equal(t({ status: "expired", closed_reason: "expired_no_action" }).text, "Expired · No action taken");
  assert.equal(t({ status: "closed", closed_reason: "filled" }).text, "Closed · Filled");
  assert.equal(t({ status: "closed", closed_reason: "withdrawn" }).text, "Closed · Withdrawn");
  assert.equal(t({ status: "closed", closed_reason: null }).text, "Closed");
});

test("filters: each posting lands under the right pill; Closed includes expired; All includes everything", () => {
  const rows = { live: row({}), closing: row({ expiration_date: at(4) }), paused: row({ status: "paused" }), draft: row({ status: "draft" }), closed: row({ status: "closed" }), expired: row({ status: "expired" }), flagged: row({ status: "flagged" }) };
  const count = (key) => Object.entries(rows).filter(([, r]) => matchesFilter(r, key, NOW)).map(([n]) => n).sort().join(",");
  assert.equal(count("all"), "closed,closing,draft,expired,flagged,live,paused");
  assert.equal(count("live"), "closing,live");
  assert.equal(count("closing"), "closing");
  assert.equal(count("paused"), "paused");
  assert.equal(count("draft"), "draft");
  assert.equal(count("closed"), "closed,expired");
  assert.deepEqual(FILTERS.map((f) => f[0]), ["all", "live", "closing", "paused", "draft", "closed"]);
});

test("text filter: title, req number or postID, ignoring case and punctuation", () => {
  const r = row({ title: "Senior Data Analyst", req_number: "R-2026/0451", post_id: "K7Q3W9ZT2XPM" });
  assert.equal(matchesText(r, ""), true);
  assert.equal(matchesText(r, "data analyst"), true);
  assert.equal(matchesText(r, "r 2026 0451"), true);
  assert.equal(matchesText(r, "k7q3"), true);
  assert.equal(matchesText(r, "nurse"), false);
  assert.equal(matchesText(row({ req_number: null }), "R-1"), false);
});

test("sorting by posted date: newest first by default, oldest first when asked, drafts always last", () => {
  const a = row({ id: "a", posted_at: at(-1), created_at: at(-1) }), b = row({ id: "b", posted_at: at(-9), created_at: at(-9) }), d = row({ id: "d", status: "draft", posted_at: null, created_at: at(-3) }), d2 = row({ id: "d2", status: "draft", posted_at: null, created_at: at(-2) });
  assert.deepEqual(sortByPosted([b, d, a, d2], "desc").map((x) => x.id), ["a", "b", "d2", "d"]);
  assert.deepEqual(sortByPosted([b, d, a, d2], "asc").map((x) => x.id), ["b", "a", "d2", "d"]);
  const input = [b, a]; sortByPosted(input, "desc"); assert.deepEqual(input.map((x) => x.id), ["b", "a"]);          // the caller's array is not reordered
});

test("table cells: a missing req number, a draft with no dates, no cap, and the close cell per status", () => {
  assert.equal(reqCell(row({ req_number: null })), "—");
  assert.equal(reqCell(row({})), "R-1");
  assert.equal(postedCell(row({ posted_at: null })), "—");
  assert.equal(capCell(row({ applicant_cap: null })), "No cap set");
  assert.equal(capCell(row({ applicant_cap: 250 })), "250");
  assert.match(closesCell(row({ status: "draft", posted_at: null, expiration_date: null, publish_by: at(9) })), /^Publish by [A-Z][a-z]{2} \d{1,2}$/);
  assert.equal(closesCell(row({ status: "draft", posted_at: null, expiration_date: null, publish_by: null })), "—");
  assert.match(closesCell(row({})), /[AP]M/);                                    // a live posting's close date carries the exact time
  assert.match(closesCell(row({ status: "closed" })), /^[A-Z][a-z]{2} \d{1,2}$/);
});
