// firm-panel-model.js - the "Recruiter firms" rows (prompt BC, October 10, 2026): one row per named recruiter firm, with Check link, Edit and Remove, like the Destination links rows. Pure (no DOM): tested in Node.
// WRITE-ONLY RULE, as for the destination links: the page never receives an address and never shows one. A row is built from the firm's position, its name, what candidates see for its address (null when it has
// none) and the save-time check result. Whether the firm has an address is read from shown_as only (the server sends it for a firm that has an address and null for one that has none).
// The words are the destination links rows' own (js/link-panel-model.js LP) wherever the meaning is the same; the sentences that name a firm are new and listed in reports\stage-bc-report.txt.

import { MAX_FIRM_NAME, recruiterFirms, addressProblem } from "./edit-form.js?v=80d9d54e";
import { LP } from "./link-panel-model.js?v=0fe982ef";

const hasControl = (s) => Array.from(String(s)).some((ch) => { const c = ch.codePointAt(0); return c < 32 || c === 127; });

export const firmName = (position) => "Firm " + position;                                  // by the STORED position: after a Remove the others keep their numbers
// ONE form for a row's title and for the edit and remove texts: "Firm 2: Acme Staffing"
export const firmTitle = (position, name) => firmName(position) + (typeof name === "string" && name.trim() !== "" ? ": " + name.trim() : "");
export const checkAria = (n) => "Check link for firm " + n, editAria = (n) => "Edit firm " + n, removeAria = (n) => "Remove firm " + n;

export const FP = {
  // the same words as the destination links rows
  CHECK: LP.CHECK, EDIT: LP.EDIT, REMOVE: LP.REMOVE, SAVE: LP.SAVE, CONTINUE: LP.CONTINUE, CANCEL: LP.CANCEL, GO_BACK: LP.GO_BACK,
  OPENED: LP.OPENED, BLOCKED: LP.BLOCKED, EXPIRED: LP.EXPIRED, NOTHING_CHANGED: LP.NOTHING_CHANGED, SAME_ADDRESS: LP.SAME_ADDRESS,
  ADDRESS_PLACEHOLDER: LP.ADDRESS_PLACEHOLDER, CHECKED_FAST: LP.rateLimitedCheck, rateLimited: LP.rateLimited,
  // the page's existing firm sentences, reused
  EMPTY: "No recruiter firm is named yet.",                                                   // js/pages/edit.js (the old stored-firms sentence)
  RECRUITER_OFF: "Recruiter firms can be named only while the opening says a third-party recruiter is involved. Turn that on and save the opening first.",   // js/edit-form.js mapLinksErrors
  // NEW (named in the report)
  NO_ADDRESS: "No address was added for this firm, so there is nothing to check.",
  EDIT_HELP: "The current address is not shown. Enter the full new address to replace it, or leave the box empty to keep it. You can change the name too.",
  NAME_PLACEHOLDER: "Firm name",
  nameAria: (n) => "Name of firm " + n,
  addressAria: (n) => "Address for firm " + n,
  editTitle: (n, name) => "Change " + firmTitle(n, name),
  removeConfirm: (n, name) => "Remove " + firmTitle(n, name) + "? Candidates will no longer see it. Your other firms are not changed.",
  confirmReplace: (n, alsoName, name) => "Replace the address for " + firmTitle(n, name) + "? Candidates will be sent to the address you entered. Your other firms are not changed." + (alsoName ? " The name is changed too." : ""),
  confirmName: (n, name) => "Change the name of " + firmTitle(n, name) + "? The address is kept. Your other firms are not changed.",
  replaced: (n) => "Firm " + n + " has a new address.",
  renamed: (n) => "Firm " + n + " was renamed.",
  removed: (n) => "Firm " + n + " is no longer named.",
  FIRM_GONE: "That firm is no longer named, so nothing was changed.",
  openLabel: (n) => "Open firm " + n + " link",
  NAME_REQUIRED: "Enter the firm's name.",
  // prompt BG (October 10, 2026): the add form under the rows
  ADD: "Add firm",
  added: (n) => "Firm " + n + " was added.",
  LIMIT: "Three firms are named. That is the most one opening can have: remove one to add another.",
  nameAddAria: "Name of the firm to add",
  addressAddAria: "Address of the firm to add (optional)",
};

// get-my-posting's destination_links (or an answer's links) -> one row per named firm, in position order. Only position, firm, shown_as and the check result are read.
export function firmRows(list) {
  const seen = new Set(), rows = [];
  for (const x of recruiterFirms((Array.isArray(list) ? list : []).filter((e) => e !== null && typeof e === "object"))) {
    if (!Number.isInteger(x.position) || x.position < 1 || x.position > 3 || seen.has(x.position) || typeof x.firm !== "string" || x.firm.trim() === "") continue;
    seen.add(x.position);
    const shownAs = typeof x.shown_as === "string" && x.shown_as !== "" ? x.shown_as : null;
    rows.push({ position: x.position, name: x.firm.trim(), title: firmTitle(x.position, x.firm), shownAs, hasAddress: shownAs !== null,
      checkFailed: shownAs !== null && x.check_status === "failed", checkHttp: Number.isInteger(x.check_http) ? x.check_http : null });
  }
  return rows.sort((a, b) => a.position - b.position);
}
// what a candidate sees ("Recruiter firm: <name> · <where it goes>", the same separator the details window uses) and the save-time check in the page's existing words
export function firmMeta(row) {
  const see = "Candidates see: Recruiter firm: " + row.name + (row.shownAs ? " · " + row.shownAs : "") + (row.checkFailed ? " (did not answer when we checked" + (row.checkHttp !== null ? ": HTTP " + row.checkHttp : "") + ")" : "");
  return row.hasAddress ? [see] : [see, FP.NO_ADDRESS];
}
export const firmSignature = (rows) => JSON.stringify(rows.map((r) => [r.position, r.name, r.shownAs, r.hasAddress, r.checkFailed, r.checkHttp]));

// addressText: what was typed in the address box; nameText: the name box; currentName: the stored name.
// -> { ok, errors: { url?, second? }, change: { url?, name? } | null, replacesAddress, changesName }
//   a blank address keeps the stored address; the name is sent only when it differs from the stored one; nothing to send -> change null
export function planFirmEdit(addressText, nameText, currentName) {
  const url = String(addressText == null ? "" : addressText).trim(), name = String(nameText == null ? "" : nameText).trim(), was = currentName == null ? "" : String(currentName).trim();
  const errors = {};
  if (url !== "") { const p = addressProblem(url); if (p) errors.url = p; }
  if (name === "") errors.second = FP.NAME_REQUIRED;
  else if (Array.from(name).length > MAX_FIRM_NAME) errors.second = "Keep the name to " + MAX_FIRM_NAME + " characters or fewer.";
  else if (hasControl(name)) errors.second = "Keep the name to plain text.";
  const out = { ok: Object.keys(errors).length === 0, errors, change: null, replacesAddress: url !== "", changesName: name !== was };
  if (!out.ok) return out;
  const change = {};
  if (url !== "") change.url = url;
  if (name !== was) change.name = name;
  out.change = Object.keys(change).length ? change : null;
  return out;
}
export const firmConfirmText = (position, plan, name) => plan.replacesAddress ? FP.confirmReplace(position, plan.changesName, name) : FP.confirmName(position, name);

// the add form's boxes -> { ok, errors: { name?, url? }, add: { name, url? } | null }. The name is required; a blank address means a firm named without an address.
export function planFirmAdd(nameText, addressText) {
  const name = String(nameText == null ? "" : nameText).trim(), url = String(addressText == null ? "" : addressText).trim();
  const errors = {};
  if (name === "") errors.name = FP.NAME_REQUIRED;
  else if (Array.from(name).length > MAX_FIRM_NAME) errors.name = "Keep the name to " + MAX_FIRM_NAME + " characters or fewer.";
  else if (hasControl(name)) errors.name = "Keep the name to plain text.";
  if (url !== "") { const p = addressProblem(url); if (p) errors.url = p; }
  const ok = Object.keys(errors).length === 0;
  return { ok, errors, add: ok ? (url === "" ? { name } : { name, url }) : null };
}

// what each answer of the server means on this panel. op: "check" | "edit" | "remove" | "add"; err: what js/api.js returned.
// -> { text, where: "url" | "second" | "row" | "panel", sessionEnded, stale }
export function firmRefusal(op, err, isAuth) {
  const out = { text: "", where: "row", sessionEnded: false, stale: false };
  if (!err) { out.text = "Something went wrong."; return out; }
  if (isAuth && isAuth(err)) { out.sessionEnded = true; return out; }
  const code = err.code;
  if (code === "plan_required") { out.text = LP.PLAN_REQUIRED; out.stale = true; return out; }
  if (code === "recruiter_off") { out.text = FP.RECRUITER_OFF; out.stale = true; return out; }
  if (code === "posting_status" || err.field === "status") { out.stale = true; return out; }
  if (code === "link_not_found") { out.text = FP.FIRM_GONE; out.where = "panel"; out.stale = true; return out; }
  if (code === "firm_limit") { out.text = FP.LIMIT; out.where = "panel"; out.stale = true; return out; }
  if (code === "not_found") { out.text = LP.POSTING_NOT_FOUND; return out; }
  if (code === "rate_limited") { out.text = op === "check" ? LP.rateLimitedCheck(err.retryAfter) : LP.rateLimited(err.retryAfter); return out; }
  if (op === "edit" || op === "add") {
    const list = Array.isArray(err.errors) && err.errors.length ? err.errors : err.field ? [{ field: err.field, message: err.message || "Not accepted." }] : [];
    for (const x of list) {
      if (x.field === "url") { out.where = "url"; out.text = x.message; return out; }
      if (x.field === "name") { out.where = "second"; out.text = x.message; return out; }
    }
  }
  out.text = describe(err);
  return out;
}
function describe(err) {
  switch (err.code) {
    case "network": return "Could not reach the server. Check your connection and try again.";
    case "bad_response": return "The server answered in a way this page did not expect, so nothing was shown. Please try again, and tell us if it keeps happening.";
    case "server_error": return "The server had a problem. Nothing was changed; please try again in a moment.";
    case "invalid_request": return "That could not be sent. Check what you entered and try again.";
    default: return "That was refused.";
  }
}

// what a successful edit or remove says. data: the (checked) answer; plan: what planFirmEdit decided to send (an edit only)
export function firmSuccess(op, data, plan) {
  if (op === "remove") return FP.removed(data.position);
  if (op === "add") return FP.added(data.position);
  if (data.changed === false) return plan && plan.replacesAddress ? FP.SAME_ADDRESS : FP.NOTHING_CHANGED;
  return plan && plan.replacesAddress ? FP.replaced(data.position) : FP.renamed(data.position);
}

// the advisory sentence after an address was replaced and the check did not answer (the firm is saved anyway); null when it answered or was not tried
export function firmWarn(data, position) {
  const l = Array.isArray(data && data.links) ? data.links.find((x) => x && x.position === position) : null;
  if (!l || l.check_status !== "failed") return null;
  return "When we checked, the address " + (Number.isInteger(l.check_http) ? "answered HTTP " + l.check_http : "could not be reached") + ". It is saved anyway. Make sure it is right.";
}
