// link-panel-model.js - the "Destination links" rows panel on the edit page (item 4): the rows, the words, the checks made before a request, and the plain message for every refusal. Pure (no DOM): tested in Node.
// WRITE-ONLY RULE: the page never receives an address (get-my-posting and the answers of set-destination-links carry position, label, what candidates see and the save-time check result only), and the
// page never shows one. A row is built from those five fields and nothing else. The address box of the edit form is never given a value; what is typed in it goes into one request and the box is emptied.
// The words are the owner-approved or proposed wording of PLAN-item-4-destination-links.md section 9 (plan sentences first), the page's existing sentences, and a short list of new sentences marked NEW below
// (linkcheck\NOTES-frontend.md lists every one for the owner's review).

import { applyLinks, MAX_URL, MAX_LABEL } from "./edit-form.js";
import { waitText } from "./format.js";
import { isAuthFailure } from "./api.js";

const hasControl = (s) => Array.from(String(s)).some((ch) => { const c = ch.codePointAt(0); return c < 32 || c === 127; });

// ---- the words
export const LP = {
  // plan section 9 (hint replacement, address-bar note, After Check, popup blocked, ticket expired, rate limited, edit title and help, remove confirm, successes, no change)
  // (the panel sentence and the address-bar note are static text in edit.html, once each; tests/site-check.js S38 pins them)
  CHECK: "Check link", EDIT: "Edit", REMOVE: "Remove",
  OPENED: "Opened in a new tab. This one-time check link is used up; press Check link again to open it again.",
  BLOCKED: "Your browser blocked the new tab. Open the link here (it works for one minute): ",
  EXPIRED: "That check expired before it opened. Press Check link again.",
  rateLimitedCheck: (seconds) => "You are checking links too fast. Try again in " + waitText(seconds || 30) + ".",
  editTitle: (n, label) => "Replace the address for " + linkTitle(n, label),
  EDIT_HELP: "The current address is not shown. Enter the full new address, or leave the box empty to keep it. You can change the label too.",
  removeConfirm: (n, label) => "Remove " + linkTitle(n, label) + "? Candidates will no longer see it. Your other links are not changed.",
  replaced: (n) => "Link " + n + " was replaced.",
  removed: (n) => "Link " + n + " was removed.",
  SAME_ADDRESS: "That is the address already stored, so nothing was changed.",
  // the page's existing sentences, reused
  EMPTY: "No destination links are stored for this opening yet.",                       // js/pages/edit.js (the old stored-links sentence)
  NOTHING_CHANGED: "Nothing was changed.",                                              // js/pages/edit.js
  ADDRESS_PLACEHOLDER: "Address, starting with https://",                              // js/link-rows.js
  LABEL_PLACEHOLDER: "Label (optional, for you only)",                                  // js/link-rows.js
  addressAria: (n) => "Destination address " + n,                                       // js/link-rows.js
  labelAria: (n) => "Label for link " + n + " (optional)",                              // js/link-rows.js
  CONTINUE: "Continue", CANCEL: "Cancel", GO_BACK: "Go back",                           // js/contest-ui.js
  PLAN_REQUIRED: "Destination links are part of the destination links tier. Your organization is not on it (or the tier has ended), so nothing was changed.",   // js/edit-form.js mapLinksErrors
  POSTING_NOT_FOUND: "That opening was not found. The link may be wrong, or the opening may belong to a colleague.",     // js/pages/edit.js
  rateLimited: (seconds) => "Too many requests just now. Try again in " + waitText(seconds || 30) + ".",               // js/pages/edit.js failureText
  // NEW (not in the plan): listed for the owner in NOTES-frontend.md
  SAVE: "Save",
  confirmReplace: (n, alsoLabel, label) => "Replace the address for " + linkTitle(n, label) + "? Candidates will be sent to the address you entered. Your other links are not changed." + (alsoLabel ? " The label is changed too." : ""),
  confirmLabel: (n, label) => "Change the label for " + linkTitle(n, label) + "? The address is kept. Your other links are not changed.",
  labelChanged: (n) => "The label for Link " + n + " was changed.",
  LINK_GONE: "That link is no longer stored, so nothing was changed.",
};

// ---- the rows
export const linkName = (position) => "Link " + position;                               // by the STORED position: after a Remove the others keep their numbers (a gap stays a gap)
// ONE form for a row's title and for the edit and remove dialog texts: "Link 3: Careers site" for a labelled row, "Link 3" for an unlabelled one (a display format only; the label is the stored note, shown as text)
export const linkTitle = (position, label) => linkName(position) + (typeof label === "string" && label.trim() !== "" ? ": " + label.trim() : "");
export const checkAria = (n) => "Check Link " + n, editAria = (n) => "Edit Link " + n, removeAria = (n) => "Remove Link " + n;

// get-my-posting's destination_links -> one row per stored APPLICATION link, in position order. Only position, label, what candidates see and the save-time check are ever read.
// Recruiter firms are not rows (they stay in the recruiter-firms panel). A row without a usable position (1 to 10) is dropped; a duplicate position keeps its first entry.
export function panelRows(list) {
  const seen = new Set(), rows = [];
  for (const x of applyLinks((Array.isArray(list) ? list : []).filter((e) => e !== null && typeof e === "object"))) {
    if (!x || !Number.isInteger(x.position) || x.position < 1 || x.position > 10 || seen.has(x.position)) continue;
    seen.add(x.position);
    const label = typeof x.label === "string" && x.label.trim() !== "" ? x.label.trim() : null;
    rows.push({ position: x.position, label, title: linkTitle(x.position, label), shownAs: typeof x.shown_as === "string" && x.shown_as !== "" ? x.shown_as : null,
      checkFailed: x.check_status === "failed", checkHttp: Number.isInteger(x.check_http) ? x.check_http : null });
  }
  return rows.sort((a, b) => a.position - b.position);
}
// "Candidates see: LinkedIn" (plan), and the save-time check result in the page's existing words
export function rowMeta(row) {
  return "Candidates see: " + (row.shownAs || "Application link " + row.position) + (row.checkFailed ? " (did not answer when we checked" + (row.checkHttp !== null ? ": HTTP " + row.checkHttp : "") + ")" : "");
}
// what makes two renderings of the same rows the same (the page does not rebuild the panel, and so does not lose a half-typed edit, unless something shown changed)
export const rowsSignature = (rows) => JSON.stringify(rows.map((r) => [r.position, r.title, r.shownAs, r.checkFailed, r.checkHttp]));

// ---- the edit form
// addressText: what was typed in the address box; labelText: the label box; currentLabel: the stored label (null for none).
// -> { ok, errors: { url?, label? }, change: { url?, label? } | null, replacesAddress, changesLabel }
//   a blank address keeps the stored address; the label is sent only when it differs from the stored one (blank = clear it: null); nothing to send -> change null
export function planEdit(addressText, labelText, currentLabel) {
  const url = String(addressText == null ? "" : addressText).trim(), label = String(labelText == null ? "" : labelText).trim(), was = currentLabel == null ? "" : String(currentLabel).trim();
  const errors = {};
  if (url !== "") {
    if (url.length > MAX_URL) errors.url = "Keep the address to " + MAX_URL + " characters or fewer.";
    else if (!/^https:\/\//i.test(url)) errors.url = "The address must start with https://";
    else { let ok = false; try { const u = new URL(url); ok = u.protocol === "https:" && u.hostname !== ""; } catch { /* not an address */ } if (!ok) errors.url = "That does not look like a web address."; }
  }
  if (Array.from(label).length > MAX_LABEL) errors.label = "Keep the label to " + MAX_LABEL + " characters or fewer.";
  else if (hasControl(label)) errors.label = "Keep the label to plain text.";
  const out = { ok: Object.keys(errors).length === 0, errors, change: null, replacesAddress: url !== "", changesLabel: label !== was };
  if (!out.ok) return out;
  const change = {};
  if (url !== "") change.url = url;
  if (label !== was) change.label = label === "" ? null : label;
  out.change = Object.keys(change).length ? change : null;
  return out;
}
export const confirmText = (position, plan, label) => plan.replacesAddress ? LP.confirmReplace(position, plan.changesLabel, label) : LP.confirmLabel(position, label);

// ---- what each answer of the server means on this panel
// op: "check" | "edit" | "remove"; err: what js/api.js returned. -> { text, where: "url" | "label" | "row" | "panel", sessionEnded, planLost, stale }
//   sessionEnded: send the person to sign in again; planLost / stale: the page reloads the posting from the server (the plan ended, the posting is no longer editable, the link is no longer stored)
export function refusalFor(op, err) {
  const out = { text: "", where: "row", sessionEnded: false, planLost: false, stale: false };
  if (!err) { out.text = "Something went wrong."; return out; }
  if (isAuthFailure(err)) { out.sessionEnded = true; return out; }
  const code = err.code;
  if (code === "plan_required") { out.text = LP.PLAN_REQUIRED; out.planLost = true; out.stale = true; return out; }
  if (code === "posting_status" || err.field === "status") { out.stale = true; return out; }                       // the page then shows its existing read-only note for a posting that can no longer be edited
  if (code === "link_not_found") { out.text = LP.LINK_GONE; out.where = "panel"; out.stale = true; return out; }
  if (code === "not_found") { out.text = LP.POSTING_NOT_FOUND; return out; }
  if (code === "rate_limited") { out.text = op === "check" ? LP.rateLimitedCheck(err.retryAfter) : LP.rateLimited(err.retryAfter); return out; }
  if (op === "edit" && code !== "kind_not_supported") {
    const list = Array.isArray(err.errors) && err.errors.length ? err.errors : err.field ? [{ field: err.field, message: err.message || "Not accepted." }] : [];
    for (const x of list) { const m = /^(?:links\[\d+\]\.)?(url|label)$/.exec(x.field); if (m) { out.where = m[1]; out.text = x.message; return out; } }
  }
  out.text = describeRefusal(err);
  return out;
}
// the page's own generic wording for the failures that carry no code of ours (network, server, broken answer, anything else)
function describeRefusal(err) {
  switch (err.code) {
    case "network": return "Could not reach the server. Check your connection and try again.";
    case "bad_response": return "The server answered in a way this page did not expect, so nothing was shown. Please try again, and tell us if it keeps happening.";
    case "server_error": return "The server had a problem. Nothing was changed; please try again in a moment.";
    case "invalid_request": return "That could not be sent. Check what you entered and try again.";
    default: return "That was refused.";
  }
}

// what a successful edit or remove says. data: the (checked) answer; plan: what planEdit decided to send (an edit only)
export function successText(op, data, plan) {
  if (op === "remove") return LP.removed(data.position);
  if (data.changed === false) return plan && plan.replacesAddress ? LP.SAME_ADDRESS : LP.NOTHING_CHANGED;
  return plan && plan.replacesAddress ? LP.replaced(data.position) : LP.labelChanged(data.position);
}
