// dashboard-model.js - what the "My postings" table shows for each row. Pure (no DOM): tested in Node.
// The backend (list-my-postings) already sends the EFFECTIVE status (a live or paused posting whose clock has run out reads as "expired"); this file only chooses labels, the filters and the order.
import { fmtDate, fmtClose } from "./format.js?v=032c6fc5";

export const CLOSING_SOON_DAYS = 10;              // the top expiry-warning threshold: a live or paused posting with this many days or fewer left is "Closing soon"
// prompt BP (October 11, 2026): THE ONE number of the at-a-glance flag and of the Expiring pill. A row whose date that matters (the close date of a live or paused opening, the publish-by date of a draft) is within
// this many days gets a small flag line under its date ("in 3 days"), and a draft this close to the end of its publish window is under Expiring. Change it here, nowhere else.
export const EXPIRY_FLAG_DAYS = 7;
const DAY_MS = 86400000, HOUR_MS = 3600000;
export const FILTERS = [["all", "All"], ["live", "Live"], ["closing", "Closing soon"], ["expiring", "Expiring"], ["paused", "Paused"], ["scheduled", "Scheduled"], ["draft", "Draft"], ["closed", "Closed"]];
const CLOSED_TEXT = { filled: "Filled", withdrawn: "Withdrawn", expired_no_action: "No action taken" };

export function isClosingSoon(p, nowMs) {
  if (!(p.status === "live" || p.status === "paused") || typeof p.expiration_date !== "string") return false;
  const left = Date.parse(p.expiration_date) - nowMs;
  return left > 0 && left <= CLOSING_SOON_DAYS * DAY_MS;
}

// ---- the date that matters for a row, and the flag under it (prompt BP)
// A live or paused opening lapses at its close date (a pause never stops or moves that clock); a draft without a go-live time lapses at its publish-by date (the server sets it to 14 days after the draft was added);
// a scheduled draft is exempt from that window and goes live at its go-live time; a closed or expired opening has nothing left to lapse. -> an ISO string, or null
export function lapseAt(p) {
  if ((p.status === "live" || p.status === "paused") && typeof p.expiration_date === "string") return p.expiration_date;
  if (p.status === "draft" && p.stored_status === "draft" && typeof p.publish_by === "string") return p.publish_by;
  return null;
}
// milliseconds left before the row lapses when that is more than 0 and within EXPIRY_FLAG_DAYS days; otherwise null
function leftWithinFlag(p, nowMs) {
  const at = lapseAt(p);
  if (at === null) return null;
  const left = Date.parse(at) - nowMs;
  return left > 0 && left <= EXPIRY_FLAG_DAYS * DAY_MS ? left : null;
}
// "in 3 days", "in 1 day", "in 5 hours", "in 1 hour", "in less than an hour", or "" (no flag). Whole units, rounded down: the flag never promises more time than there is.
export function expiryFlag(p, nowMs) {
  const left = leftWithinFlag(p, nowMs);
  if (left === null) return "";
  if (left >= DAY_MS) { const d = Math.floor(left / DAY_MS); return "in " + d + (d === 1 ? " day" : " days"); }
  if (left >= HOUR_MS) { const h = Math.floor(left / HOUR_MS); return "in " + h + (h === 1 ? " hour" : " hours"); }
  return "in less than an hour";
}
// Expiring: a DRAFT near the end of its publish window. A live or paused opening near its close date is already under Closing soon (a wider window, ten days), so it is not repeated here.
export const isExpiring = (p, nowMs) => p.status === "draft" && leftWithinFlag(p, nowMs) !== null && !isClosingSoon(p, nowMs);

// -> { text, cls }  (cls is one of the .status-* styles already in styles.css)
export function statusChip(p, nowMs) {
  switch (p.status) {
    case "live": return isClosingSoon(p, nowMs) ? { text: "Closing soon", cls: "status-closing" } : { text: "Live", cls: "status-active" };
    case "paused": return { text: isClosingSoon(p, nowMs) ? "Paused · closing soon" : "Paused", cls: "status-draft" };
    case "draft": return { text: "Draft", cls: "status-draft" };
    case "scheduled": return { text: "Scheduled", cls: "status-draft" };
    case "flagged": return { text: "In review", cls: "status-draft" };
    case "expired": return { text: "Expired · " + (CLOSED_TEXT[p.closed_reason] || "No action taken"), cls: "status-closed" };
    case "closed": return { text: "Closed" + (CLOSED_TEXT[p.closed_reason] ? " · " + CLOSED_TEXT[p.closed_reason] : ""), cls: "status-closed" };
    default: return { text: String(p.status), cls: "status-draft" };
  }
}

export function matchesFilter(p, key, nowMs) {
  switch (key) {
    case "live": return p.status === "live";
    case "closing": return isClosingSoon(p, nowMs);
    case "expiring": return isExpiring(p, nowMs);
    case "paused": return p.status === "paused";
    case "draft": return p.status === "draft";
    case "scheduled": return p.status === "scheduled";
    case "closed": return p.status === "closed" || p.status === "expired";
    default: return true;
  }
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function matchesText(p, q) {
  const n = norm(q); if (n === "") return true;
  return [p.title, p.req_number, p.post_id].some((v) => norm(v).includes(n));
}

// ---- which views can hold more than one status (prompt BP). Worked out from matchesFilter itself, with one sample row of every status the server can send, so the Status column follows the real rules:
// it is shown only in a view that can hold rows of different statuses, because in any other view every row says the same thing.
const SAMPLE_NOW = Date.parse("2026-01-15T12:00:00Z");
const SAMPLE_AT = (days) => new Date(SAMPLE_NOW + days * DAY_MS).toISOString();
const SAMPLE_ROWS = [
  { status: "live", stored_status: "live", expiration_date: SAMPLE_AT(3) }, { status: "live", stored_status: "live", expiration_date: SAMPLE_AT(40) },
  { status: "paused", stored_status: "paused", expiration_date: SAMPLE_AT(3) }, { status: "paused", stored_status: "paused", expiration_date: SAMPLE_AT(40) },
  { status: "draft", stored_status: "draft", publish_by: SAMPLE_AT(3), expiration_date: null }, { status: "draft", stored_status: "draft", publish_by: SAMPLE_AT(12), expiration_date: null },
  { status: "draft", stored_status: "draft", publish_by: SAMPLE_AT(-2), expiration_date: null },
  { status: "scheduled", stored_status: "draft", go_live_at: SAMPLE_AT(2), expiration_date: null, publish_by: null },
  { status: "closed", stored_status: "closed", expiration_date: SAMPLE_AT(5) }, { status: "expired", stored_status: "live", expiration_date: SAMPLE_AT(-2) },
  { status: "flagged", stored_status: "flagged", expiration_date: SAMPLE_AT(5) },
];
export function statusesIn(filterKey) {
  return Array.from(new Set(SAMPLE_ROWS.filter((r) => matchesFilter(r, filterKey, SAMPLE_NOW)).map((r) => r.status)));
}
export const showsStatusColumn = (filterKey) => statusesIn(filterKey).length > 1;

// ---- sorting (prompt BP). Done in the page over every loaded row, together with the pill and the search words.
export const SORTS = [["added_desc", "Added, newest first"], ["added_asc", "Added, oldest first"], ["closes_asc", "Closes, soonest first"], ["closes_desc", "Closes, furthest first"],
  ["title_asc", "Title, A to Z"], ["title_desc", "Title, Z to A"], ["status", "Status"]];
export const SORT_ANNOUNCE = (label) => "Sorted by " + label;
export const defaultSort = (filterKey) => (filterKey === "closing" || filterKey === "expiring" ? "closes_asc" : "added_desc");
// the date a row's Closes cell shows, in milliseconds (a close date, a publish-by date, a go-live time), or null when the row has none: such rows go last in both Closes directions
export function closesAt(p) {
  const v = p.status === "scheduled" ? p.go_live_at : p.status === "draft" ? p.publish_by : p.expiration_date;
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isNaN(t) ? null : t;
}
// "Added" is the day the opening was added (the opening's own creation time, the same date the editor's history ends with)
export const addedAt = (p) => { const t = Date.parse(p.created_at); return Number.isNaN(t) ? 0 : t; };
const byTitle = (a, b) => String(a.title || "").localeCompare(String(b.title || ""), undefined, { sensitivity: "base", numeric: true });
export function sortRows(rows, key, nowMs) {
  const list = rows.slice();
  const tie = (a, b) => addedAt(b) - addedAt(a) || byTitle(a, b);          // equal keys: newest added first, then by title, so the order never jumps
  switch (key) {
    case "added_asc": return list.sort((a, b) => addedAt(a) - addedAt(b) || byTitle(a, b));
    case "title_asc": return list.sort((a, b) => byTitle(a, b) || tie(a, b));
    case "title_desc": return list.sort((a, b) => byTitle(b, a) || tie(a, b));
    case "closes_asc": case "closes_desc": {
      const sign = key === "closes_asc" ? 1 : -1;
      return list.sort((a, b) => { const x = closesAt(a), y = closesAt(b); if (x === null && y === null) return tie(a, b); if (x === null) return 1; if (y === null) return -1; return sign * (x - y) || tie(a, b); });
    }
    case "status": return list.sort((a, b) => statusChip(a, nowMs).text.localeCompare(statusChip(b, nowMs).text) || tie(a, b));
    default: return list.sort(tie);                                         // added_desc
  }
}

export const reqCell = (p) => (p.req_number ? p.req_number : "None");
export const addedCell = (p) => "Added " + fmtDate(p.created_at);
export function closesCell(p) {
  if (p.status === "scheduled") return p.go_live_at ? "Goes live " + fmtClose(p.go_live_at) : "Not set";
  if (p.status === "draft") return p.publish_by ? "Publish by " + fmtDate(p.publish_by) : "Not set";
  if (p.status === "live" || p.status === "paused") return fmtClose(p.expiration_date);
  return p.expiration_date ? fmtDate(p.expiration_date) : "None";
}

// ---- row actions (slice B)
export const MIN_BUMP_DAYS = 1, MAX_BUMP_DAYS = 15, MAX_REASON = 300, MAX_CLOSE_DETAIL = 500;      // the backend refuses anything else (bump-posting, close-posting)

// A draft can be published for 14 days after it was saved (publish_by); after that publish-posting refuses it.
export const publishWindowEnded = (p, nowMs) => p.status === "draft" && typeof p.publish_by === "string" && Date.parse(p.publish_by) <= nowMs;

// -> the action keys a row offers, in display order. Based on the EFFECTIVE status too: a live or paused posting whose clock has run out reads as expired and offers nothing.
export function actionsFor(p, nowMs) {
  if (p.status === "scheduled") return p.stored_status === "draft" ? ["edit", "publish", "unschedule"] : [];      // a scheduled draft is exempt from the 14-day publish window
  if (p.status === "draft") return p.stored_status === "draft" && !publishWindowEnded(p, nowMs) ? ["edit", "publish"] : [];
  if (p.status === "live" && p.stored_status === "live") return p.bump_used ? ["edit", "pause", "close"] : ["edit", "pause", "extend", "close"];
  if (p.status === "paused" && p.stored_status === "paused") return ["edit", "resume", "close"];
  return [];
}

// -> { ok, errors: { bumpDays?, bumpReason? }, body?: { bump_days, bump_reason } }
export function checkBump(daysText, reasonText) {
  const errors = {}, d = String(daysText == null ? "" : daysText).trim(), r = String(reasonText == null ? "" : reasonText).trim();
  if (!/^[0-9]{1,2}$/.test(d) || Number(d) < MIN_BUMP_DAYS || Number(d) > MAX_BUMP_DAYS) errors.bumpDays = "Enter a whole number of days from " + MIN_BUMP_DAYS + " to " + MAX_BUMP_DAYS + ".";
  if (r === "") errors.bumpReason = "Enter a reason (it is recorded)."; else if (r.length > MAX_REASON) errors.bumpReason = "Keep the reason to " + MAX_REASON + " characters or fewer.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, errors, body: { bump_days: Number(d), bump_reason: r } };
}

// -> { ok, errors: { closeDetail? }, body?: { closed_reason, closed_detail? } }.  The detail belongs to "withdrawn" only: for "filled" it is never sent.
export function checkClose(reason, detailText) {
  if (reason !== "filled" && reason !== "withdrawn") return { ok: false, errors: { closeReason: "Choose filled or withdrawn." } };
  const detail = String(detailText == null ? "" : detailText).trim();
  if (reason === "withdrawn" && detail.length > MAX_CLOSE_DETAIL) return { ok: false, errors: { closeDetail: "Keep the detail to " + MAX_CLOSE_DETAIL + " characters or fewer." } };
  return { ok: true, errors: {}, body: reason === "withdrawn" && detail !== "" ? { closed_reason: reason, closed_detail: detail } : { closed_reason: reason } };
}
