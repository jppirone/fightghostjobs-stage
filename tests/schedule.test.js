// schedule.test.js - the scheduled go-live: the form's checks, the answers the pages accept, and the dashboard's view of a scheduled draft.
import test from "node:test";
import assert from "node:assert/strict";
import { checkGoLive, toLocalInput, mapScheduleError, MIN_LEAD_MS, MAX_DAYS, GO_LIVE_HINT } from "../js/schedule-form.js";
import { validateForm } from "../js/register-form.js";
import { shapes, createApi } from "../js/api.js";
import { statusChip, matchesFilter, closesCell, actionsFor, FILTERS } from "../js/dashboard-model.js";

const HOUR = 3600000, DAY = 86400000;
const NOW = new Date(2026, 8, 21, 12, 0, 0).getTime();                 // a local time: the control reads the browser's own zone
const loc = (ms) => toLocalInput(new Date(ms).toISOString());
const ID = "3f1d5b1e-0000-4000-8000-000000000001";

test("the go-live time: at least 1 hour ahead (with a little slack for the round trip), at most 90 days, a real local date and time", () => {
  assert.equal(checkGoLive("", NOW).ok, false); assert.equal(checkGoLive("tomorrow", NOW).ok, false); assert.equal(checkGoLive("2026-13-45T10:00", NOW).ok, false); assert.equal(checkGoLive(null, NOW).ok, false);
  assert.equal(checkGoLive(loc(NOW + 30 * 60000), NOW).ok, false);
  assert.equal(checkGoLive(loc(NOW + HOUR), NOW).ok, false);                       // exactly an hour is inside the slack: the server would judge it against ITS clock
  assert.match(checkGoLive(loc(NOW + HOUR), NOW).error, /at least 1 hour/);
  const ok = checkGoLive(loc(NOW + 2 * HOUR), NOW); assert.equal(ok.ok, true); assert.equal(ok.iso, new Date(new Date(loc(NOW + 2 * HOUR)).getTime()).toISOString());
  assert.equal(checkGoLive(loc(NOW + 89 * DAY), NOW).ok, true); assert.equal(checkGoLive(loc(NOW + 91 * DAY), NOW).ok, false);
  assert.match(checkGoLive(loc(NOW + 91 * DAY), NOW).error, /90 days from now/);
  // an existing draft: 90 days after ITS creation
  const created = NOW - 30 * DAY;
  assert.equal(checkGoLive(loc(NOW + 50 * DAY), NOW, created).ok, true); assert.equal(checkGoLive(loc(NOW + 61 * DAY), NOW, created).ok, false);
  assert.match(checkGoLive(loc(NOW + 61 * DAY), NOW, created).error, /after this draft was saved/);
  assert.ok(MIN_LEAD_MS === HOUR && MAX_DAYS === 90);
});

test("datetime-local round trip and the refusals from the backend in words", () => {
  const iso = new Date(NOW + 5 * HOUR).toISOString(); assert.equal(new Date(toLocalInput(iso)).getTime(), Date.parse(iso) - (Date.parse(iso) % 60000)); assert.equal(toLocalInput("nope"), "");
  assert.equal(mapScheduleError({ code: "go_live_too_soon" }).where, "gldate"); assert.match(mapScheduleError({ code: "go_live_too_soon" }).message, /less than an hour/);
  assert.match(mapScheduleError({ code: "go_live_too_late" }).message, /90 days/);
  assert.match(mapScheduleError({ code: "invalid_request", field: "status" }).message, /not a draft/);
  assert.equal(mapScheduleError({ code: "invalid_request", field: "go_live_at", message: "m" }).message, "m");
  assert.equal(mapScheduleError({ code: "server_error" }).message, null);
  assert.ok(GO_LIVE_HINT.includes("within 15 minutes") && GO_LIVE_HINT.includes("counted from the moment it actually goes live"));
});

test("the register form checks the time only when 'on a date and time I choose' is selected", () => {
  const base = { title: "T", req: "R1", company: "C", closeout: "x", desc: "d", remote: true, locEntries: [], attested: false, appcap: "", win: "45", nowMs: NOW };
  assert.equal(validateForm(Object.assign({}, base, { goLater: false, goLive: "" })).gldate, undefined);
  assert.ok(validateForm(Object.assign({}, base, { goLater: true, goLive: "" })).gldate);
  assert.ok(validateForm(Object.assign({}, base, { goLater: true, goLive: loc(NOW + 10 * 60000) })).gldate);
  assert.equal(validateForm(Object.assign({}, base, { goLater: true, goLive: loc(NOW + 3 * HOUR) })).gldate, undefined);
});

test("schedule-posting and the employer's views: the answers the pages accept, and only those", () => {
  assert.equal(shapes.scheduleAnswer({ posting_id: ID, changed: true, go_live_at: "2026-10-05T14:00:00.000Z", status: "scheduled" }), true);
  assert.equal(shapes.scheduleAnswer({ posting_id: ID, changed: false, go_live_at: null, status: "draft" }), true);
  assert.equal(shapes.scheduleAnswer({ changed: "yes", go_live_at: null, status: "draft" }), false); assert.equal(shapes.scheduleAnswer({ changed: true, go_live_at: 5, status: "scheduled" }), false); assert.equal(shapes.scheduleAnswer({ changed: true, go_live_at: null, status: "live" }), false);
  const row = { id: ID, title: "T", req_number: "R1", post_id: "ABCDEFGHJKMN", status: "scheduled", stored_status: "draft", closed_reason: null, is_remote: true, locations: [], location_ids: [], locations_attested: false, window_days: 45, posted_at: null, expiration_date: null, publish_by: null, go_live_at: "2026-10-05T14:00:00Z", applicant_cap: null, bump_used: false, bump_days: null, created_at: "2026-09-21T00:00:00Z", last_edited_at: null, comment_count: 0 };
  assert.equal(shapes.myPosting(row), true);
  assert.equal(shapes.myPosting(Object.assign({}, row, { status: "bogus" })), false);
  assert.equal(shapes.myPosting(Object.assign({}, row, { stored_status: "scheduled" })), false);            // "scheduled" is never a STORED status
  const noKey = Object.assign({}, row); delete noKey.go_live_at; assert.equal(shapes.myPosting(noKey), false);      // an answer without the key is not trusted
});

test("schedulePosting sends the posting id and the instant (or null to remove it)", async () => {
  const calls = []; const api = createApi({ baseUrl: "https://x.example", key: "k", getToken: async () => "T", fetchImpl: async (url, init) => { calls.push([url, JSON.parse(init.body)]); return { ok: true, status: 200, headers: new Map(), text: async () => JSON.stringify({ posting_id: ID, changed: true, go_live_at: null, status: "draft" }) }; } });
  const r = await api.schedulePosting(ID, null); assert.equal(r.ok, true); assert.deepEqual(calls[0], ["https://x.example/functions/v1/schedule-posting", { posting_id: ID, go_live_at: null }]);
  await api.schedulePosting(ID, "2026-10-05T14:00:00.000Z"); assert.deepEqual(calls[1][1], { posting_id: ID, go_live_at: "2026-10-05T14:00:00.000Z" });
});

test("My postings: a scheduled draft has its own chip, filter, date column and actions (and is exempt from the 14-day window)", () => {
  const p = { id: ID, title: "T", status: "scheduled", stored_status: "draft", go_live_at: new Date(NOW + 5 * DAY).toISOString(), publish_by: null, created_at: new Date(NOW - 30 * DAY).toISOString(), closed_reason: null };
  assert.deepEqual(statusChip(p, NOW), { text: "Scheduled", cls: "status-draft" });
  assert.equal(matchesFilter(p, "scheduled", NOW), true); assert.equal(matchesFilter(p, "draft", NOW), false); assert.equal(matchesFilter(Object.assign({}, p, { status: "draft" }), "scheduled", NOW), false);
  assert.ok(FILTERS.some((f) => f[0] === "scheduled"));
  assert.match(closesCell(p), /^Goes live [A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2} [AP]M/);
  assert.deepEqual(actionsFor(p, NOW), ["edit", "publish", "unschedule"]);                       // 30 days old: a plain draft would offer nothing
  assert.deepEqual(actionsFor(Object.assign({}, p, { stored_status: "live" }), NOW), []);
  assert.deepEqual(actionsFor({ status: "draft", stored_status: "draft", publish_by: new Date(NOW - DAY).toISOString() }, NOW), []);   // an unscheduled draft past its 14 days: unchanged
});
