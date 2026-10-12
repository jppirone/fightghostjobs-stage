// dashboard.test.js - the "My postings" model: status chips, the closing-soon boundary, filters, ordering, and the table cells. Run: node --test tests/dashboard.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { CLOSING_SOON_DAYS, EXPIRY_FLAG_DAYS, FILTERS, SORTS, isClosingSoon, isExpiring, expiryFlag, lapseAt, statusChip, matchesFilter, matchesText, sortRows, defaultSort, closesAt, addedAt, statusesIn, showsStatusColumn, reqCell, addedCell, closesCell } from "../js/dashboard-model.js";

const NOW = Date.parse("2026-09-21T12:00:00Z"), DAY = 86400000, at = (days) => new Date(NOW + days * DAY).toISOString();
const base = { id: "11111111-1111-4111-8111-111111111111", title: "Analyst", req_number: "R-1", post_id: "ABCD2345EFGH", status: "live", closed_reason: null, stored_status: "live", is_remote: false, locations: [], location_ids: [], locations_attested: false,
  window_days: 45, posted_at: at(-5), expiration_date: at(40), publish_by: null, go_live_at: null, applicant_cap: null, bump_used: false, bump_days: null, created_at: at(-5), last_edited_at: null, comment_count: 0 };
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

test("status chips say what the opening is, in the site's own words", () => {
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

test("filters: each opening lands under the right pill; Closed includes expired; All includes everything", () => {
  const rows = { live: row({}), closing: row({ expiration_date: at(4) }), paused: row({ status: "paused" }), draft: row({ status: "draft" }), closed: row({ status: "closed" }), expired: row({ status: "expired" }), flagged: row({ status: "flagged" }) };
  const count = (key) => Object.entries(rows).filter(([, r]) => matchesFilter(r, key, NOW)).map(([n]) => n).sort().join(",");
  assert.equal(count("all"), "closed,closing,draft,expired,flagged,live,paused");
  assert.equal(count("live"), "closing,live");
  assert.equal(count("closing"), "closing");
  assert.equal(count("paused"), "paused");
  assert.equal(count("draft"), "draft");
  assert.equal(count("closed"), "closed,expired");
  assert.deepEqual(FILTERS.map((f) => f[0]), ["all", "live", "closing", "expiring", "paused", "scheduled", "draft", "closed"]);       // prompt BP: Expiring sits next to Closing soon
  assert.deepEqual(FILTERS.map((f) => f[1]), ["All", "Live", "Closing soon", "Expiring", "Paused", "Scheduled", "Draft", "Closed"]);
});

test("text filter: title, req number or Opening ID, ignoring case and punctuation", () => {
  const r = row({ title: "Senior Data Analyst", req_number: "R-2026/0451", post_id: "K7Q3W9ZT2XPM" });
  assert.equal(matchesText(r, ""), true);
  assert.equal(matchesText(r, "data analyst"), true);
  assert.equal(matchesText(r, "r 2026 0451"), true);
  assert.equal(matchesText(r, "k7q3"), true);
  assert.equal(matchesText(r, "nurse"), false);
  assert.equal(matchesText(row({ req_number: null }), "R-1"), false);
});

// ---- prompt BP (October 11, 2026): sorting, the flag, the Expiring pill, the Status column
test("the sort options: six in the agreed words, Status only on request; defaults per pill", () => {
  assert.deepEqual(SORTS.map((s) => s[1]), ["Added, newest first", "Added, oldest first", "Closes, soonest first", "Closes, furthest first", "Title, A to Z", "Title, Z to A", "Status"]);
  for (const key of ["all", "live", "paused", "scheduled", "draft", "closed"]) assert.equal(defaultSort(key), "added_desc", key);
  assert.equal(defaultSort("closing"), "closes_asc");
  assert.equal(defaultSort("expiring"), "closes_asc");
});

test("sort by Added: newest first or oldest first, by the day the opening was added; ties by title; the caller's array is not reordered", () => {
  const a = row({ id: "a", title: "B", created_at: at(-1) }), b = row({ id: "b", title: "A", created_at: at(-9) }), d = row({ id: "d", title: "C", status: "draft", posted_at: null, created_at: at(-3) }), same = row({ id: "s", title: "A2", created_at: at(-9) });
  assert.deepEqual(sortRows([b, d, a, same], "added_desc", NOW).map((x) => x.id), ["a", "d", "b", "s"].map((x) => x));   // b and s have the same day: b ("A") before s ("A2")
  assert.deepEqual(sortRows([b, d, a, same], "added_asc", NOW).map((x) => x.id), ["b", "s", "d", "a"]);
  const input = [b, a]; sortRows(input, "added_desc", NOW); assert.deepEqual(input.map((x) => x.id), ["b", "a"]);
  assert.equal(addedAt(a), Date.parse(at(-1)));
});

test("sort by Closes: the date the Closes cell shows (close date, publish-by, go-live); rows with no date go last in BOTH directions", () => {
  const live = row({ id: "live", expiration_date: at(20) }), soon = row({ id: "soon", expiration_date: at(2) }), draft = row({ id: "draft", status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: at(9) }),
    sched = row({ id: "sched", status: "scheduled", stored_status: "draft", posted_at: null, expiration_date: null, go_live_at: at(5) }), none = row({ id: "none", status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: null }),
    closed = row({ id: "closed", status: "closed", expiration_date: at(-4) });
  assert.equal(closesAt(none), null);
  assert.equal(closesAt(sched), Date.parse(at(5)));
  // prompt BR (October 12, 2026): a closed or expired row goes after every open row in both directions (its scheduled expiration_date never happened); it used to sort by that date, in among the live ones
  assert.deepEqual(sortRows([live, none, soon, draft, sched, closed], "closes_asc", NOW).map((x) => x.id), ["soon", "sched", "draft", "live", "none", "closed"]);
  assert.deepEqual(sortRows([live, none, soon, draft, sched, closed], "closes_desc", NOW).map((x) => x.id), ["live", "draft", "sched", "soon", "none", "closed"]);
});

test("prompt BR: closed and expired rows follow the open ones in both directions and, among themselves, the day they really ended (expired: its expiration date; closed: closed_at, none while the server does not send it)", () => {
  const open = row({ id: "open", expiration_date: at(30) }), none = row({ id: "none", status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: null });
  const c1 = row({ id: "c1", status: "closed", expiration_date: at(40), closed_at: at(-9) }), c2 = row({ id: "c2", status: "closed", expiration_date: at(2), closed_at: at(-3) });
  const e1 = row({ id: "e1", status: "expired", stored_status: "live", closed_reason: "expired_no_action", expiration_date: at(-20) });
  const cx = row({ id: "cx", status: "closed", expiration_date: at(-1) });          // closed, closing day not sent: no date, after the dated ones
  assert.equal(closesAt(c1), Date.parse(at(-9)), "the closing day, not the scheduled date");
  assert.equal(closesAt(e1), Date.parse(at(-20)));
  assert.equal(closesAt(cx), null);
  const all = [c2, open, cx, e1, c1, none];
  assert.deepEqual(sortRows(all, "closes_asc", NOW).map((x) => x.id), ["open", "none", "e1", "c1", "c2", "cx"]);
  assert.deepEqual(sortRows(all, "closes_desc", NOW).map((x) => x.id), ["open", "none", "c2", "c1", "e1", "cx"]);
  // the Closed pill holds only these rows: the same order by the real day
  assert.deepEqual(sortRows([c2, cx, e1, c1], "closes_asc", NOW).map((x) => x.id), ["e1", "c1", "c2", "cx"]);
});

test("sort by Title: A to Z and Z to A ignoring case, numbers in order; sort by Status groups by the chip's words", () => {
  const t = (id, title, o) => row(Object.assign({ id, title }, o));
  const rows = [t("c", "zebra"), t("a", "Apple 10"), t("b", "apple 9"), t("d", "Mango")];
  assert.deepEqual(sortRows(rows, "title_asc", NOW).map((x) => x.id), ["b", "a", "d", "c"]);
  assert.deepEqual(sortRows(rows, "title_desc", NOW).map((x) => x.id), ["c", "d", "a", "b"]);
  const st = [t("x", "X", { status: "paused" }), t("y", "Y", { status: "live" }), t("z", "Z", { status: "draft", stored_status: "draft" })];
  assert.deepEqual(sortRows(st, "status", NOW).map((x) => x.id), ["z", "y", "x"]);          // Draft, Live, Paused
});

test("the flag: words only inside the one constant (7 days); whole units rounded down; none for closed, scheduled, no date or a date already past", () => {
  assert.equal(EXPIRY_FLAG_DAYS, 7);
  const f = (o, now = NOW) => expiryFlag(row(o), now);
  assert.equal(f({ expiration_date: at(7) }), "in 7 days");
  assert.equal(f({ expiration_date: new Date(NOW + 7 * DAY + 1000).toISOString() }), "");                       // 7 days and a second: no flag
  assert.equal(f({ expiration_date: at(3.5) }), "in 3 days");
  assert.equal(f({ expiration_date: at(1) }), "in 1 day");
  assert.equal(f({ expiration_date: new Date(NOW + 5 * 3600000 + 60000).toISOString() }), "in 5 hours");
  assert.equal(f({ expiration_date: new Date(NOW + 3600000 + 1000).toISOString() }), "in 1 hour");
  assert.equal(f({ expiration_date: new Date(NOW + 59 * 60000).toISOString() }), "in less than an hour");
  assert.equal(f({ expiration_date: at(-1) }), "", "already past: no new wording");
  assert.equal(f({ status: "paused", expiration_date: at(4) }), "in 4 days");
  assert.equal(f({ status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: at(5) }), "in 5 days");
  assert.equal(f({ status: "scheduled", stored_status: "draft", posted_at: null, expiration_date: null, go_live_at: at(2) }), "", "a go-live time is not a lapse");
  assert.equal(f({ status: "closed", expiration_date: at(2) }), "");
  assert.equal(f({ status: "expired", expiration_date: at(-2) }), "");
  assert.equal(f({ status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: null }), "");
  assert.equal(lapseAt(row({ status: "closed" })), null);
});

test("Expiring: a draft within 7 days of the end of its window; not a live or paused one (Closing soon covers them), not one already past, not a scheduled one", () => {
  const d = (days, o) => row(Object.assign({ status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: at(days) }, o));
  assert.equal(isExpiring(d(5), NOW), true);
  assert.equal(isExpiring(d(7), NOW), true);
  assert.equal(isExpiring(d(8), NOW), false);
  assert.equal(isExpiring(d(-1), NOW), false);
  assert.equal(isExpiring(d(2, { status: "scheduled", publish_by: null, go_live_at: at(2) }), NOW), false);
  assert.equal(isExpiring(row({ expiration_date: at(3) }), NOW), false);
  assert.equal(isExpiring(row({ status: "paused", expiration_date: at(3) }), NOW), false);
  assert.equal(matchesFilter(d(5), "expiring", NOW), true);
  assert.equal(matchesFilter(d(5), "draft", NOW), true, "an expiring draft is still a draft");
  assert.equal(matchesFilter(row({ expiration_date: at(3) }), "closing", NOW), true, "Closing soon is unchanged");
});

test("the Status column: shown only in a view that can hold more than one status, worked out from the filters themselves", () => {
  for (const key of ["live", "paused", "scheduled", "draft", "expiring"]) assert.equal(showsStatusColumn(key), false, key + " holds one status");
  for (const key of ["all", "closing", "closed"]) assert.equal(showsStatusColumn(key), true, key + " can hold more than one");
  assert.deepEqual(statusesIn("closing").sort(), ["live", "paused"]);
  assert.deepEqual(statusesIn("closed").sort(), ["closed", "expired"]);
  assert.deepEqual(statusesIn("expiring"), ["draft"]);
});

test("table cells: a missing req number, the Added line, and the close cell per status", () => {
  assert.equal(reqCell(row({ req_number: null })), "None");
  assert.equal(reqCell(row({})), "R-1");
  assert.match(addedCell(row({})), /^Added [A-Z][a-z]{2} \d{1,2}$/);
  assert.match(addedCell(row({ status: "draft", posted_at: null })), /^Added [A-Z][a-z]{2} \d{1,2}$/, "a draft has an added day too");
  assert.match(closesCell(row({ status: "draft", posted_at: null, expiration_date: null, publish_by: at(9) })), /^Publish by [A-Z][a-z]{2} \d{1,2}$/);
  assert.equal(closesCell(row({ status: "draft", posted_at: null, expiration_date: null, publish_by: null })), "Not set");
  assert.match(closesCell(row({})), /[AP]M/);                                    // a live posting's close date carries the exact time
  // prompt BR (October 12, 2026): the day it really ended, with the word for how; a closed row never shows its scheduled date (it used to show that date, bare)
  assert.equal(closesCell(row({ status: "closed", expiration_date: at(25) })), "Closed", "closed, closing day not sent: the word alone, never the scheduled date");
  assert.match(closesCell(row({ status: "closed", expiration_date: at(25), closed_at: at(-3) })), /^Closed [A-Z][a-z]{2} \d{1,2}$/);
  assert.match(closesCell(row({ status: "expired", stored_status: "live", expiration_date: at(-2) })), /^Expired [A-Z][a-z]{2} \d{1,2}$/);
  assert.equal(closesCell(row({ status: "expired", stored_status: "live", expiration_date: null })), "Expired");
});

// ---- slice B: row actions
import { actionsFor, publishWindowEnded, checkBump, checkClose, MAX_BUMP_DAYS, MAX_REASON, MAX_CLOSE_DETAIL } from "../js/dashboard-model.js";

test("actions per row: exactly what each status can do, and nothing for an expired, closed, held or out-of-time row", () => {
  const A = (o) => actionsFor(row(o), NOW).join(",");
  assert.equal(A({}), "edit,pause,extend,close");                                                                // live
  assert.equal(A({ bump_used: true, bump_days: 5 }), "edit,pause,close");                                       // the one-time extension is used
  assert.equal(A({ status: "paused", stored_status: "paused" }), "edit,resume,close");                         // paused: no extend (the backend refuses it)
  assert.equal(A({ status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: at(5) }), "edit,publish");
  assert.equal(A({ status: "draft", stored_status: "draft", posted_at: null, expiration_date: null, publish_by: at(-0.001) }), "");   // the 14-day publish window has ended
  assert.equal(A({ status: "expired", stored_status: "live", closed_reason: "expired_no_action" }), "");         // a live posting whose clock ran out: expired for the candidate, nothing to do
  assert.equal(A({ status: "expired", stored_status: "paused", closed_reason: "expired_no_action" }), "");
  assert.equal(A({ status: "closed", stored_status: "closed", closed_reason: "filled" }), "");
  assert.equal(A({ status: "flagged", stored_status: "flagged" }), "");
  assert.equal(publishWindowEnded(row({ status: "draft", publish_by: at(-1) }), NOW), true);
  assert.equal(publishWindowEnded(row({ status: "draft", publish_by: at(1) }), NOW), false);
  assert.equal(publishWindowEnded(row({ status: "live", publish_by: null }), NOW), false);
});

test("extend: whole days from 1 to 15 and a reason, checked before anything is sent", () => {
  assert.equal(MAX_BUMP_DAYS, 15);
  for (const ok of ["1", "15", " 7 ", "07"]) assert.equal(checkBump(ok, "hiring took longer").ok, true, ok);
  for (const bad of ["0", "16", "-1", "1.5", "abc", "", " ", "100", "1e1", "1 5", null, undefined]) { const c = checkBump(bad, "why"); assert.equal(c.ok, false, String(bad)); assert.ok(c.errors.bumpDays, String(bad)); }
  for (const bad of ["", "   ", null, undefined, "x".repeat(MAX_REASON + 1)]) { const c = checkBump("3", bad); assert.equal(c.ok, false); assert.ok(c.errors.bumpReason); }
  assert.equal(checkBump("3", "x".repeat(MAX_REASON)).ok, true);
  assert.deepEqual(checkBump(" 4 ", "  final interviews  ").body, { bump_days: 4, bump_reason: "final interviews" });
  assert.deepEqual(Object.keys(checkBump("0", "").errors).sort(), ["bumpDays", "bumpReason"]);
});

test("close: filled or withdrawn; the detail is sent only for withdrawn, trimmed, and never longer than 500", () => {
  assert.deepEqual(checkClose("filled", "").body, { closed_reason: "filled" });
  assert.deepEqual(checkClose("filled", "this text must not be sent").body, { closed_reason: "filled" });        // detail belongs to withdrawn only
  assert.deepEqual(checkClose("withdrawn", "").body, { closed_reason: "withdrawn" });
  assert.deepEqual(checkClose("withdrawn", "  budget freeze  ").body, { closed_reason: "withdrawn", closed_detail: "budget freeze" });
  assert.equal(checkClose("withdrawn", "x".repeat(MAX_CLOSE_DETAIL)).ok, true);
  assert.equal(checkClose("withdrawn", "x".repeat(MAX_CLOSE_DETAIL + 1)).ok, false);
  assert.equal(checkClose("filled", "x".repeat(MAX_CLOSE_DETAIL + 1)).ok, true);          // ignored for filled, so its length does not matter
  for (const bad of ["", "expired_no_action", "FILLED", null, undefined]) assert.equal(checkClose(bad, "").ok, false, String(bad));
});
