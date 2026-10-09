// staff-scope.js - the staff-only search scope (October 8, 2026). Pure (no DOM, no network): tested in Node by tests/staff-scope.unit.test.js.
//
// WHAT IT IS: the search page opened with the address parameter scope=all (the staff build of the browser extension adds it) shows EVERY opening that matches, not only the ones a candidate may see: drafts, scheduled drafts, openings held for
// review, paused, live, closed and expired ones, each with its status. It is read only.
// WHO GETS IT: only a signed-in staff person, and the DECISION IS THE DATABASE'S: js/pages/search.js asks public.is_staff() and calls public.staff_search_openings with the person's own token. Anything that is not a clear "yes" from the database
// (no session, not staff, the functions missing, an error, an odd answer) leaves the page exactly as it is for everyone. This file never decides who is staff; it only reads the address and words what is on screen.
// THE CONTRACT WITH THE EXTENSION: the address carries scope=all in its query string, nothing else is new. Absent, empty, repeated or any other value means "live only", exactly as before.

import { fmtDateTz, fmtClose } from "./format.js";
import { aiFilteringChip, aiInterviewChip, CLOSED_REASON_LABEL } from "./chips.js";

export const STAFF_BANNER = "Staff view: showing all openings, including ones that are not live.";
export const STAFF_STATUS_LABEL = { draft: "Draft", scheduled: "Scheduled", flagged: "Held for review", paused: "Paused", live: "Live", closed: "Closed", expired: "Expired" };

// true ONLY for exactly one scope parameter whose value is exactly "all" (no other value, no repeat, no case change)
export function wantsStaffScope(search) {
  try { const all = new URLSearchParams(String(search || "")).getAll("scope"); return all.length === 1 && all[0] === "all"; } catch { return false; }
}

// the one word a staff person reads for a row: a draft that has a go-live time reads Scheduled
export function staffStatusLabel(row) {
  if (row && row.status === "draft" && typeof row.go_live_at === "string" && row.go_live_at !== "") return STAFF_STATUS_LABEL.scheduled;
  return (row && STAFF_STATUS_LABEL[row.status]) || "Status unknown";
}

// the chips of a staff card, in the order they are drawn: the status first, then the dates that apply to it, then the disclosures
export function staffChips(row, tz) {
  const chips = [{ text: staffStatusLabel(row), bold: true }];
  if (row.status !== row.stored_status) chips.push({ text: "Stored as " + row.stored_status });
  switch (row.status) {
    case "draft": chips.push({ text: row.go_live_at ? "Goes live " + fmtDateTz(row.go_live_at, tz) : "Not live yet" }); break;
    case "flagged": chips.push({ text: "Held for review: candidates do not see it" }); break;
    case "live": chips.push({ text: "Went live " + fmtDateTz(row.posted_at, tz) }, { text: "Closes " + fmtClose(row.closes_at, tz) }); break;
    case "paused": chips.push({ text: "Went live " + fmtDateTz(row.posted_at, tz) }, { text: "Paused; the close date " + fmtClose(row.closes_at, tz) + " still runs" }); break;
    case "expired": chips.push({ text: "Went live " + fmtDateTz(row.posted_at, tz) }, { text: "Was set to close " + fmtClose(row.closes_at, tz) }); break;
    case "closed": chips.push({ text: "Closed: " + (CLOSED_REASON_LABEL[row.closed_reason] || "reason not recorded") }); break;
    default: break;
  }
  chips.push(aiFilteringChip(row.ai_filtering), aiInterviewChip(row.ai_interview_other));
  chips.push({ text: row.third_party_recruiter === true ? "Third-party recruiter involved" : "No recruiter" });
  chips.push({ text: Number.isInteger(row.applicant_cap) ? "Capped at " + row.applicant_cap + " applicants" : "No applicant cap set" });
  return chips;
}

// the second line of a staff card: who owns it and how to find it
export function staffIdLine(row) { return row.organization_name + " · Opening ID " + row.opening_id + (row.req_number ? " · Req " + row.req_number : ""); }

// the count line above the results
export function staffCountText(n, truncated) {
  return n === 0 ? "No matching openings" : n + (n === 1 ? " matching opening" : " matching openings") + (truncated ? ": showing the first 25; add more of the title to narrow it" : "");
}
