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
