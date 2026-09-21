// dashboard-model.js - what the "My postings" table shows for each row. Pure (no DOM): tested in Node.
// The backend (list-my-postings) already sends the EFFECTIVE status (a live or paused posting whose clock has run out reads as "expired"); this file only chooses labels, the filters and the order.
import { fmtDate, fmtClose } from "./format.js";

export const CLOSING_SOON_DAYS = 10;              // the top expiry-warning threshold: a live or paused posting with this many days or fewer left is "Closing soon"
const DAY_MS = 86400000;
export const FILTERS = [["all", "All"], ["live", "Live"], ["closing", "Closing soon"], ["paused", "Paused"], ["draft", "Draft"], ["closed", "Closed"]];
const CLOSED_TEXT = { filled: "Filled", withdrawn: "Withdrawn", expired_no_action: "No action taken" };

export function isClosingSoon(p, nowMs) {
  if (!(p.status === "live" || p.status === "paused") || typeof p.expiration_date !== "string") return false;
  const left = Date.parse(p.expiration_date) - nowMs;
  return left > 0 && left <= CLOSING_SOON_DAYS * DAY_MS;
}

// -> { text, cls }  (cls is one of the .status-* styles already in styles.css)
export function statusChip(p, nowMs) {
  switch (p.status) {
    case "live": return isClosingSoon(p, nowMs) ? { text: "Closing soon", cls: "status-closing" } : { text: "Live", cls: "status-active" };
    case "paused": return { text: isClosingSoon(p, nowMs) ? "Paused · closing soon" : "Paused", cls: "status-draft" };
    case "draft": return { text: "Draft", cls: "status-draft" };
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
    case "paused": return p.status === "paused";
    case "draft": return p.status === "draft";
    case "closed": return p.status === "closed" || p.status === "expired";
    default: return true;
  }
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function matchesText(p, q) {
  const n = norm(q); if (n === "") return true;
  return [p.title, p.req_number, p.post_id].some((v) => norm(v).includes(n));
}

// Posted date, newest first by default; a draft has no posted date and always sorts last.
export function sortByPosted(rows, dir) {
  const sign = dir === "asc" ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const ax = a.posted_at ? Date.parse(a.posted_at) : null, bx = b.posted_at ? Date.parse(b.posted_at) : null;
    if (ax === null && bx === null) return Date.parse(b.created_at) - Date.parse(a.created_at);
    if (ax === null) return 1;
    if (bx === null) return -1;
    return sign * (ax - bx) || Date.parse(b.created_at) - Date.parse(a.created_at);
  });
}

export const reqCell = (p) => (p.req_number ? p.req_number : "—");
export const postedCell = (p) => (p.posted_at ? fmtDate(p.posted_at) : "—");
export const capCell = (p) => (p.applicant_cap === null ? "No cap set" : String(p.applicant_cap));
export function closesCell(p) {
  if (p.status === "draft") return p.publish_by ? "Publish by " + fmtDate(p.publish_by) : "—";
  if (p.status === "live" || p.status === "paused") return fmtClose(p.expiration_date);
  return p.expiration_date ? fmtDate(p.expiration_date) : "—";
}

// ---- row actions (slice B)
export const MIN_BUMP_DAYS = 1, MAX_BUMP_DAYS = 15, MAX_REASON = 300, MAX_CLOSE_DETAIL = 500;      // the backend refuses anything else (bump-posting, close-posting)

// A draft can be published for 14 days after it was saved (publish_by); after that publish-posting refuses it.
export const publishWindowEnded = (p, nowMs) => p.status === "draft" && typeof p.publish_by === "string" && Date.parse(p.publish_by) <= nowMs;

// -> the action keys a row offers, in display order. Based on the EFFECTIVE status too: a live or paused posting whose clock has run out reads as expired and offers nothing.
export function actionsFor(p, nowMs) {
  if (p.status === "draft") return p.stored_status === "draft" && !publishWindowEnded(p, nowMs) ? ["publish"] : [];
  if (p.status === "live" && p.stored_status === "live") return p.bump_used ? ["pause", "close"] : ["pause", "extend", "close"];
  if (p.status === "paused" && p.stored_status === "paused") return ["resume", "close"];
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
