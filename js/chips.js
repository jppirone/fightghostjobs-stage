// chips.js - what a posting's facts are called on screen. Pure (no DOM): tested in Node.
// The wording of the two AI disclosures and their tooltips is the FINAL design copy (design brief addendum, section 12): the tooltip describes the mechanism, never an outcome.

import { fmtDateTz, fmtClose } from "./format.js";

export const TOOLTIP_FILTERING = "Resume screening or keyword/ATS-style matching used to prioritize applications before a human reviews them.";
export const TOOLTIP_INTERVIEW = "Any AI that interacts with a candidate directly, such as an AI-conducted interview or a chatbot screening call.";

// null means the employer has not stated it (only possible for rows written outside the normal registration flow): say so plainly, never guess.
export function aiFilteringChip(v) {
  return { text: v === true ? "AI-assisted filtering" : v === false ? "No AI filtering" : "AI filtering not disclosed", tooltip: TOOLTIP_FILTERING };
}
export function aiInterviewChip(v) {
  return { text: v === true ? "AI used for interviewing/other" : v === false ? "No AI interview/other" : "AI interview/other not disclosed", tooltip: TOOLTIP_INTERVIEW };
}

export const CLOSED_REASON_LABEL = { filled: "Filled", withdrawn: "Withdrawn", expired_no_action: "No action taken" };

// The status statement a candidate sees (design brief 13): live -> the close date; paused; expired (the system's auto-close); closed (what the employer chose).
export function statusChips(p, tz) {
  const closes = fmtClose(p.closes_at, tz);      // the exact moment with its time zone: "Nov 4, 9:08 PM EST"
  switch (p.status) {
    case "live": return [{ text: "Closes " + closes, bold: true }];
    case "paused": return [{ text: "Paused", bold: true }, { text: "Close date " + closes + " (the clock keeps running)" }];
    case "expired": return [{ text: "Expired · " + (CLOSED_REASON_LABEL[p.closed_reason] || "No action taken"), bold: true }, { text: "Was set to close " + closes }];
    case "closed": return [{ text: "Closed · " + (CLOSED_REASON_LABEL[p.closed_reason] || "Reason not recorded"), bold: true }];
    default: return [{ text: String(p.status || "Status unknown"), bold: true }];
  }
}

// Every chip of a search result / posting header, in the designed order.
export function postingChips(p, tz) {
  const chips = [{ text: "Registered " + fmtDateTz(p.posted_at, tz) }];
  chips.push(...statusChips(p, tz));
  chips.push(aiFilteringChip(p.ai_filtering), aiInterviewChip(p.ai_interview_other));
  chips.push({ text: p.third_party_recruiter === true ? "Third-party recruiter involved" : "No recruiter" });
  chips.push({ text: Number.isInteger(p.applicant_cap) ? "Capped at " + p.applicant_cap + " applicants" : "No applicant cap set" });
  if (typeof p.last_edited_at === "string" && p.last_edited_at !== "") chips.push({ text: "Edited " + fmtDateTz(p.last_edited_at, tz) });
  return chips;
}

// What the detail dialog says when a posting is not live (candidate-posting-detail answers 409 posting_not_open).
export function notOpenMessage(status, closedReason) {
  if (status === "paused") return "This opening is paused. The employer has paused it, so it is not accepting applicants right now.";
  if (status === "expired") return "This opening has expired" + (closedReason === "expired_no_action" ? " with no action taken by the employer." : ".");
  if (status === "closed") return closedReason === "filled" ? "This opening is closed: the employer reports the role was filled." : closedReason === "withdrawn" ? "This opening is closed: the employer withdrew it." : "This opening is closed.";
  return "This opening is not open.";
}

// The comments page for a posting that is not open (candidate-posting-detail answers 409 posting_not_open): the small line, the heading and the note under it.
// A PAUSED posting is expected to return, so it gets its own heading and the short sentence; closed, expired and every other status keep the long sentence.
export function notOpenHeading(status) {
  return status === "paused" ? "This opening is paused" : "This opening is no longer open";
}
export function notOpenComments(status) {
  return status === "paused" ? "Comments stay open." : "Comments stay open: what happened after it closed is exactly what other candidates want to know.";
}
export function notOpenRecap(status, closedReason, withComments = true) {   // withComments false: the comments switch is off, so the line about comments staying open is left out
  return { company: "Opening", title: notOpenHeading(status), note: notOpenMessage(status, closedReason || null) + (withComments ? " " + notOpenComments(status) : "") };
}
