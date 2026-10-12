// edit.js - an employer edits a posting they own: the form starts from what get-my-posting returns, only what CHANGED is sent to edit-posting, and every edit of a posting that is not a draft carries a change note.
// The server judges the rest (how much of the requirements text is kept, the location rule, duplicate req numbers) and this page shows its answer in words. Nothing here trusts the page for identity: the session token tells the server who is acting.
// Unsaved work is never lost silently: a bar at the bottom of the window says what is not saved, the browser asks before the page is left, and the page's own links ask with a dialog (js/unsaved-guard.js; what counts as unsaved is js/dirty-state.js).

import { api, requirePoster, mountAccount, go, signOut, describeError, isAuthFailure } from "../app.js?v=67bc7e98";
import { rememberNext } from "../session.js?v=c0af4232";
import { $, $$, h, clear, alertBox } from "../dom.js?v=ff147636";
import { fmtClose, fmtStamp, waitText } from "../format.js?v=032c6fc5";
import { kioBlock } from "../kio-block.js?v=6a7d21f6";
import { statusChip, actionsFor } from "../dashboard-model.js?v=b3715dc3";
import { runAction } from "../dashboard-actions.js?v=2e4990c2";
import { mountLimitHint } from "../limit-hint.js?v=1cfa5987";
import { checkEdit, mapEditErrors, KIND_TEXT, plainChangeNote, checkLinks, mapLinksErrors, planNotice, checkWarnings, applyLinks, recruiterFirms } from "../edit-form.js?v=b5757c87";
import { mountLocationPicker } from "../location-picker.js?v=ae8d9e28";
import { mountPlaceChoice } from "../place-choice.js?v=f65a1b27";
import { storedPlaceText } from "../place-text.js?v=cb5d7506";
import { placeNodes } from "../place.js?v=915c680a";
import { checkGoLive, toLocalInput, mapScheduleError } from "../schedule-form.js?v=b2985372";
import { loadCatalog } from "../location-catalog.js?v=bb0c937e";
import { mountLinkRowsById, mountLinkRows } from "../link-rows.js?v=a79f852e";
import { mountLinkPanel } from "../link-panel.js?v=0fc55760";
import { mountFirmPanel } from "../firm-panel.js?v=be826aba";
import { FP, planFirmAdd, firmRefusal, firmSuccess, firmWarn } from "../firm-panel-model.js?v=8884ef82";
import { mountPolicyPanel } from "../policy-panel.js?v=806fe4cf";
import { policyView, policyStoredText, policyLapsedText, policySavedText, mapPolicyError, checkPolicyUrl, policyLink } from "../policy-link.js?v=f2ea9573";
import { wireInfoIcons } from "../info-icon.js?v=66958a58";
import { snapshotOf, rowsTyped, earlyRules, UNSAVED, PANEL, ACTION, ADDED_LABEL, panelsFirstText } from "../dirty-state.js?v=7d4da23c";
import { mountUnsavedGuard } from "../unsaved-guard.js?v=206c5678";

wireInfoIcons();

const postingId = new URLSearchParams(location.search).get("id") || "";
const state = { orig: null, doc: null, aiFilter: null, aiInterview: null, recruiter: false, reqSearchable: true, exclusive: false, plan: null, busy: false, needNote: false, linksBusy: false, firmsBusy: false, policyBusy: false,
  baseline: null,        // the main form as it was last loaded or saved (dirty-state.js snapshotOf): "unsaved" means "different from this"
  glBaseline: "",        // the go-live box as it was last loaded or saved
  loading: false,        // true while populate() is filling the form, so a half-filled form is never taken for an edit
  keepPanels: new Set() };   // the sections with typed, unsaved work that this redraw must not wipe (populate() sets it)
let guard = null;        // the unsaved-changes guard (mounted at the bottom of this file)
const form = $("#form"), pageAlert = $("#pageAlert"), formAlert = $("#formAlert"), saveBtn = $("#saveBtn");
const picker = mountLocationPicker({ isRemote: () => $("#remote").checked, onChange: () => refreshUnsaved() });
$("#remote").addEventListener("change", () => picker.refresh());
const place = mountPlaceChoice({ onChange: () => refreshUnsaved() });      // prompt BH: "A place outside the US or not in the list"

const val = (id) => $(id).value;
// say() also drops the live mark (prompt BN): a sentence put there by syncLiveSentence() below is the ONLY kind that is taken away again when the condition ends; every other sentence stays until the next one replaces it
// prompt BR (October 12, 2026): a RESULT line (what a save or an action just did: kind "ok", or a notice passed result = true) is marked data-result and is taken away again by clearResults() the moment the next change begins
// (refreshUnsaved), by Discard and when the page comes back from the browser's cache. An error or a condition (the live sentence) is not a result and stays until it is answered.
function say(box, kind, text, result) {
  clear(box); box.removeAttribute("data-live-sentence"); box.removeAttribute("data-result");
  box.hidden = !text;
  if (text) { box.append(alertBox(kind, text)); if (kind === "ok" || result === true) box.setAttribute("data-result", "1"); }
}
function clearResults() { for (const box of Array.from(document.querySelectorAll("[data-result]"))) say(box, "error", ""); }
function showErrors(byField) {
  for (const el of $$("[data-error-for]")) { const id = el.dataset.errorFor; const msg = byField[id]; el.hidden = !msg; el.textContent = msg || ""; const inp = $("#" + (id === "locpicker" ? "locq" : id)); if (inp) inp.setAttribute("aria-invalid", msg ? "true" : "false"); }
}
const draftSaveBtn = $("#draftSaveBtn"), publishBtn = $("#publishBtn"), actionArea = $("#actionArea");
// prompt BM: "What changed, and why?" belongs to a CHANGE: its box (label, field, rule sentence, error line, limit hint) is taken out of the page while the main form has no change, and put back as soon as it has one.
// The elements are kept here, so everything that reads them (collect, the rules, the errors) keeps working while they are out of the page.
const noteBlock = $("#noteBlock"), noteInput = $("#note"), noteLabelEl = $("#noteLabel"), noteNeededEl = $("#noteNeeded"), noteErrEl = noteBlock.querySelector('[data-error-for="note"]');
noteBlock.remove();
function setBusy(on) { state.busy = on; saveBtn.disabled = on; draftSaveBtn.disabled = on; publishBtn.disabled = on; $("#unsavedSave").disabled = on; $("#unsavedDiscard").disabled = on; }
// the boxes that stop typing at a limit say so (prompt BK); the limit is each box's own maxlength. The description's own hint already says "Up to 20,000 characters.", so only its count and its limit sentence are added.
// prompt BN: the note box has its count too ("0 of 500", the limit sentence on a paste); its own line "One line, 500 characters at most. It is saved with the change." stays, so no second "Up to 500" line is added.
// Its count lives in the box's block, so it leaves the page and comes back with it (syncNoteBlock redraws it at 0 of 500).
const noteLimit = mountLimitHint({ input: noteInput, hint: false });
const limitHints = [mountLimitHint({ input: $("#jtitle") }), mountLimitHint({ input: $("#req") }), mountLimitHint({ input: $("#aiFilterNote") }), mountLimitHint({ input: $("#aiInterviewNote") }), mountLimitHint({ input: $("#desc"), hint: false }), noteLimit];
async function sessionEnded() { await signOut(); rememberNext("edit.html?id=" + postingId, "poster"); go("employer-signin.html?reason=expired"); }
function failureText(err) {
  if (err.code === "rate_limited") return "Too many requests just now. Try again in " + waitText(err.retryAfter || 30) + ".";
  return describeError(err, { what: "That" });
}

function setToggle(id, on) { const b = $(id); b.classList.toggle("on", !!on); b.setAttribute("aria-checked", on ? "true" : "false"); }
function wireToggle(id, key) {
  $(id).addEventListener("click", () => {
    if (state.busy || !state.orig) return;
    state[key] = key === "recruiter" ? !state.recruiter : state[key] !== true;
    setToggle(id, state[key] === true);
    if (key === "recruiter" && state.doc) renderFirms(state.doc, true);
    if (key === "aiFilter" || key === "aiInterview") syncNoteRows();
  });
}
wireToggle("#aiFilterToggle", "aiFilter"); wireToggle("#aiInterviewToggle", "aiInterview"); wireToggle("#recruiterToggle", "recruiter"); wireToggle("#exclusiveToggle", "exclusive"); wireToggle("#reqSearchToggle", "reqSearchable");
const planActive = () => !!state.plan && state.plan.verified === true;
// the employer's AI notes (pass D) are offered only while their toggle is on
function syncNoteRows() { $("#aiFilterNoteRow").hidden = state.aiFilter !== true; $("#aiInterviewNoteRow").hidden = state.aiInterview !== true; }

const collect = () => ({ title: val("#jtitle"), req: val("#req"), desc: val("#desc"), locEntries: place.outside() ? [] : picker.get().entries, attested: place.outside() ? false : picker.get().attested, outside: place.outside(), locText: place.text(), remote: $("#remote").checked, appcap: val("#appcap"),
  aiFilter: state.aiFilter, aiInterview: state.aiInterview, aiFilterNote: val("#aiFilterNote"), aiInterviewNote: val("#aiInterviewNote"), recruiter: state.recruiter, reqSearchable: state.reqSearchable, exclusive: planActive() ? state.exclusive : undefined, note: noteInput.value });

// the catalog entries for the stored ids (a place the catalog no longer has still shows, by the display text the database stored)
async function entriesFor(p) {
  let catalog = null;
  try { catalog = await loadCatalog(); } catch { /* the fallback below still shows the stored names */ }
  const byId = new Map(catalog && catalog.entries ? catalog.entries.map((e) => [e.id, e]) : []);
  return p.location_ids.map((id, i) => byId.get(id) || { id, kind: "place", display: p.locations[i] || id });
}

function noteLabel(isDraft) {
  noteLabelEl.textContent = isDraft && !state.needNote ? "What changed, and why? (optional on a draft; kept with the opening)." : "What changed, and why? (required; kept with the opening).";
  noteInput.setAttribute("aria-required", isDraft && !state.needNote ? "false" : "true");
}

function renderChanges(list) {
  const card = $("#changesCard"), ul = $("#changesList"); clear(ul);
  const added = state.orig && typeof state.orig.created_at === "string" && state.orig.created_at !== "" ? state.orig.created_at : null;
  card.hidden = list.length === 0 && added === null;
  for (const c of list) ul.append(h("li", {}, h("div", { style: "font-weight:600;" }, KIND_TEXT[c.kind] || "Edit", h("span", { style: "font-weight:400;color:var(--muted);" }, " · " + fmtStamp(c.at))), h("div", { style: "color:#4A453F;margin-top:2px;overflow-wrap:anywhere;" }, plainChangeNote(c.note))));
  // prompt BK: the oldest line, always last: when the opening was added (its own creation time), so the latest edit is never taken for the opening just being created
  if (added !== null) ul.append(h("li", { "data-added": "" }, h("div", { style: "font-weight:600;" }, ADDED_LABEL, h("span", { style: "font-weight:400;color:var(--muted);" }, " · " + fmtStamp(added)))));
}

// ---- the go-live time: a draft (scheduled or not) can carry one; the 15-minute scheduler publishes it, and the window starts then
function renderSchedule(p, editable) {
  const card = $("#scheduleCard"); card.hidden = !(editable && p.stored_status === "draft"); if (card.hidden) return;
  const scheduled = typeof p.go_live_at === "string";
  state.glBaseline = scheduled ? toLocalInput(p.go_live_at) : "";
  const st = $("#scheduleState"); clear(st);
  st.append(scheduled ? h("span", {}, h("strong", {}, "Scheduled: "), "goes live at " + fmtClose(p.go_live_at) + ", published within 15 minutes after that time. Its window is counted from then.")
    : "Not scheduled. It goes live when you publish it" + (p.publish_by ? " (a draft can be published for 14 days after it was added, until " + fmtClose(p.publish_by) + ")." : "."));
  if (!state.keepPanels.has(PANEL.GOLIVE)) $("#gldate").value = state.glBaseline;       // a time typed and not saved yet stays when another part of the page is saved
  $("#scheduleBtn").textContent = scheduled ? "Change the time" : "Schedule go-live";
  $("#unscheduleBtn").hidden = !scheduled;
  say($("#scheduleAlert"), "error", "");
}
async function submitSchedule(clearIt) {
  if (state.busy || !state.orig) return;
  const box = $("#scheduleAlert"); say(box, "error", "");
  let iso = null;
  if (!clearIt) {
    const c = checkGoLive($("#gldate").value, Date.now(), Date.parse(state.orig.created_at));
    showErrors({ gldate: c.ok ? "" : c.error });
    if (!c.ok) { $("#gldate").focus(); return; }
    iso = c.iso;
  } else showErrors({});
  setBusy(true);
  try {
    const r = await api.schedulePosting(postingId, iso);
    if (!r.ok) {
      if (isAuthFailure(r.error)) return sessionEnded();
      const m = mapScheduleError(r.error);
      if (m.where === "gldate") showErrors({ gldate: m.message }); else say(box, "error", m.message || failureText(r.error));
      return;
    }
    const reload = await api.getMyPosting(postingId);
    if (reload.ok) await populate(reload.data, { keepForm: true, saved: PANEL.GOLIVE });
    say($("#scheduleAlert"), "ok", r.data.changed === false ? "That is the time already set, so nothing was changed." : clearIt ? "The schedule is removed. It is a draft again." : "Saved. It goes live at " + fmtClose(r.data.go_live_at) + ", within 15 minutes after that time.");
  } finally { setBusy(false); }
}
$("#scheduleForm").addEventListener("submit", (ev) => { ev.preventDefault(); submitSchedule(false); });
$("#unscheduleBtn").addEventListener("click", () => submitSchedule(true));

// ---- destination links: shown only for a posting that can be edited; a verified plan gets the form, a lapsed one a notice, anyone else the sales note
const planDay = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const links = mountLinkRowsById();   // the shared Address | Label rows (link-rows.js); the register form uses the same component
const resetLinkRows = links.reset, showLinkErrors = links.showErrors;
// the rows panel (item 4): Check link, Edit and Remove on ONE stored application link. It draws from position, label and what candidates see; it never receives or shows an address.
const linkPanel = mountLinkPanel({
  host: $("#linksList"), hintEl: $("#linksPanelHint"), noteEl: $("#linksCheckNote"), api, getPostingId: () => postingId,
  isBlocked: () => state.linksBusy,
  onSessionEnded: () => sessionEnded(),
  onStale: async () => { const reload = await api.getMyPosting(postingId); if (reload.ok) await populate(reload.data, { keepForm: true, saved: PANEL.LINKS }); },     // the plan ended, the posting is no longer editable, or the link is gone: start again from the server
  onChanged: async (list) => {                                                                                                // an edit or a remove worked: keep what this page holds in step, then refresh the change list
    if (state.doc) state.doc.destination_links = list.concat(recruiterFirms(state.doc.destination_links), policyLink(state.doc.destination_links) ? [policyLink(state.doc.destination_links)] : []);
    $("#clearLinksBtn").hidden = list.length === 0;
    const reload = await api.getMyPosting(postingId);
    if (reload.ok) { state.doc.recent_changes = reload.data.recent_changes; renderChanges(reload.data.recent_changes); }
    refreshUnsaved();
  },
});
function renderLinks(doc, editable) {
  const card = $("#linksCard"); card.hidden = !editable; if (!editable) return;
  const notice = planNotice(doc.plan, Date.now()), plan = $("#linksPlan"); clear(plan); plan.hidden = true;
  $("#linksLocked").hidden = notice.state === "active" || notice.state === "lapsed";
  $("#linksForm").hidden = notice.state !== "active";
  $("#linksPanel").hidden = notice.state !== "active";
  $("#exclusiveRow").hidden = notice.state !== "active";
  if (notice.state === "lapsed") {
    plan.hidden = false;
    plan.append(alertBox("notice", "Your destination links tier ended" + (notice.endsAt ? " on " + planDay(notice.endsAt) : "") + ". Destination links are paused: candidates do not see them, and no one is sent to them. " + (doc.destination_links.length ? "The " + doc.destination_links.length + " you saved are kept and return as soon as your plan is renewed. " : "") + "To renew, write to sales@fightghostjobs.com."));
    $("#linksLocked").hidden = true;
  } else if (notice.state === "active" && notice.endsSoon) {
    plan.hidden = false; plan.append(alertBox("notice", "Your destination links tier ends on " + planDay(notice.endsAt) + ". After that, destination links are paused (kept, but candidates do not see them) until it is renewed. To renew, write to sales@fightghostjobs.com."));
  }
  if (notice.state === "active") {
    const n = applyLinks(doc.destination_links).length;
    linkPanel.render(doc.destination_links);
    $("#clearLinksBtn").hidden = n === 0;
    if (!state.linksBusy && !state.keepPanels.has(PANEL.LINKS)) resetLinkRows();
  }
}

// ---- recruiter firms (pass C): the same plan gate as the links; the rows are usable only while the SAVED posting says a recruiter is involved (the toggle above, saved).
// The panel sits in the Destination links card, below Save changes: the toggle (free) is above it, naming a firm and its links is the verified plan's part, and it saves with its own button.
// Why "saved first": set-destination-links reads the STORED third_party_recruiter flag inside its transaction and refuses with 409 recruiter_off when it is not true (and a database trigger refuses the insert too), so the toggle must be saved by Save changes before a firm can be stored.
// the add form under the rows (prompt BG): ONE name box and ONE optional address box; "Add firm" adds that one firm and never sends the firms already named
const firms = mountLinkRows({ host: $("#firmRows"), addBtn: null, mode: "firmAdd" });
// the rows panel (prompt BC): Check link, Edit and Remove on ONE named firm, the same shared rows panel the destination links use. It draws from position, name, what candidates see and the check result; it never receives or shows an address.
const firmPanel = mountFirmPanel({
  host: $("#firmsList"), hintEl: $("#firmsPanelHint"), api, getPostingId: () => postingId,
  isBlocked: () => state.firmsBusy,
  onSessionEnded: () => sessionEnded(),
  onStale: async () => { const reload = await api.getMyPosting(postingId); if (reload.ok) await populate(reload.data, { keepForm: true, saved: PANEL.FIRMS }); },
  onChanged: async (list) => {                                                                                                // an edit or a remove worked: keep what this page holds in step, then refresh the change list
    if (state.doc) state.doc.destination_links = applyLinks(state.doc.destination_links).concat(list, policyLink(state.doc.destination_links) ? [policyLink(state.doc.destination_links)] : []);
    syncFirmAdd(list.length);
    const reload = await api.getMyPosting(postingId);
    if (reload.ok) { state.doc.recent_changes = reload.data.recent_changes; renderChanges(reload.data.recent_changes); }
    refreshUnsaved();
  },
});
function renderFirms(doc, editable) {
  const panel = $("#firmsPanel"), stored = recruiterFirms(doc.destination_links);
  panel.hidden = !editable || (!state.recruiter && stored.length === 0);
  if (panel.hidden) return;
  const notice = planNotice(doc.plan, Date.now()), note = $("#firmsNote"); clear(note); note.hidden = true;
  $("#firmsLocked").hidden = notice.state === "active" || notice.state === "lapsed";
  const savedOn = doc.posting.third_party_recruiter === true;
  $("#firmsForm").hidden = !(notice.state === "active" && savedOn && state.recruiter);
  if (notice.state === "lapsed") { note.hidden = false; note.append(alertBox("notice", "Your destination links tier ended. " + (stored.length ? "The " + stored.length + " firm" + (stored.length === 1 ? "" : "s") + " you named " + (stored.length === 1 ? "is" : "are") + " kept but hidden from candidates until it is renewed." : "Naming a recruiter firm is paused until it is renewed."))); }
  else if (notice.state === "active" && !state.recruiter && stored.length) { note.hidden = false; note.append(alertBox("notice", "The toggle is off: " + (stored.length === 1 ? "the firm you named is" : "the " + stored.length + " firms you named are") + " kept but hidden from candidates. Turn it on and save to show them again.")); }
  else if (notice.state === "active" && state.recruiter && !savedOn) { note.hidden = false; note.append(alertBox("notice", "Naming a firm is optional. To name one here, first save this opening with the recruiter toggle on (Save changes, at the bottom of the page); then come back to this section.")); }
  if (!$("#firmsForm").hidden) {
    firmPanel.render(doc.destination_links);      // one row per named firm (or the sentence that none is named yet)
    syncFirmAdd(stored.length);
    if (!state.firmsBusy && !state.keepPanels.has(PANEL.FIRMS)) firms.reset();
  }
}
// three firms: the add form goes and one plain sentence says the limit; none: Remove all firms goes
function syncFirmAdd(count) {
  $("#firmAddBox").hidden = count >= 3;
  const lim = $("#firmsLimit"); lim.hidden = count < 3; lim.textContent = count >= 3 ? FP.LIMIT : "";
  $("#clearFirmsBtn").hidden = count === 0;
}
// Add firm (prompt BG): one firm through the one-firm add. The server picks the position; the other firms are neither sent nor changed.
async function submitFirmAdd() {
  if (state.firmsBusy || firmPanel.isBusy() || !state.orig) return;
  const box = $("#firmsAlert"); say(box, "error", "");
  const v = firms.values()[0] || { name: "", url: "" };
  const plan = planFirmAdd(v.name, v.url);
  firms.showErrors(plan.ok ? {} : { 0: plan.errors });
  if (!plan.ok) { firms.focus({ 0: plan.errors }); return; }
  state.firmsBusy = true; $("#addFirmBtn").disabled = true;
  try {
    const r = await api.addRecruiterFirm(postingId, plan.add);
    if (!r.ok) {
      if (isAuthFailure(r.error)) return sessionEnded();
      const f = firmRefusal("add", r.error, isAuthFailure);
      if (f.where === "second") { firms.showErrors({ 0: { name: f.text } }); firms.focus({ 0: { name: f.text } }); return; }
      if (f.where === "url") { firms.showErrors({ 0: { url: f.text } }); firms.focus({ 0: { url: f.text } }); return; }
      if (f.stale) { state.firmsBusy = false; const reload = await api.getMyPosting(postingId); if (reload.ok) await populate(reload.data, { keepForm: true, saved: PANEL.FIRMS }); }
      say(box, "error", f.text || failureText(r.error));
      return;
    }
    state.firmsBusy = false;
    const reload = await api.getMyPosting(postingId);
    if (reload.ok) await populate(reload.data, { keepForm: true, saved: PANEL.FIRMS });
    const warn = firmWarn(r.data, r.data.position);
    say($("#firmsAlert"), warn ? "notice" : "ok", firmSuccess("add", r.data, null) + (warn ? " " + warn : ""), true);
  } finally { state.firmsBusy = false; $("#addFirmBtn").disabled = false; }
}
// Remove all firms (the whole-set call with none: the only use this page still makes of it)
async function removeAllFirms() {
  if (state.firmsBusy || firmPanel.isBusy() || !state.orig) return;
  const box = $("#firmsAlert"); say(box, "error", "");
  state.firmsBusy = true; $("#clearFirmsBtn").disabled = true;
  try {
    const r = await api.setRecruiterFirms(postingId, []);
    if (!r.ok) {
      if (isAuthFailure(r.error)) return sessionEnded();
      const m = mapLinksErrors(r.error, []);
      say(box, "error", m.general || failureText(r.error));
      return;
    }
    state.firmsBusy = false;
    const reload = await api.getMyPosting(postingId);
    if (reload.ok) await populate(reload.data, { keepForm: true, saved: PANEL.FIRMS });
    say($("#firmsAlert"), "ok", r.data.changed === false ? "No firm was named, so nothing was changed." : "Removed. No recruiter firm is named on this opening.");
  } finally { state.firmsBusy = false; $("#clearFirmsBtn").disabled = false; }
}
$("#addFirmBtn").addEventListener("click", () => submitFirmAdd());
$("#clearFirmsBtn").addEventListener("click", () => { if (window.confirm("Remove every recruiter firm from this opening? You can name them again at any time.")) removeAllFirms(); });

// ---- the AI and hiring policy link (prompt BA, October 10, 2026): one more destination link, in the Disclosures area next to the AI toggles. The same tier gate as the links and the firms; its own Save and Remove buttons
// (Save changes does not save it); the address is write-only (the box starts empty and is never filled from the server). The words and the states are in js/policy-link.js.
function showPolicyField(msg) { const e = $("#policyError"); e.textContent = msg || ""; e.hidden = !msg; $("#policyUrl").setAttribute("aria-invalid", msg ? "true" : "false"); }
// prompt BC: with a link stored the section shows ONE ROW (Check link, Edit, Remove: js/policy-panel.js over the shared rows panel); with none it shows the box and Save policy link, as before
const policyPanel = mountPolicyPanel({
  host: $("#policyList"), hintEl: $("#policyPanelHint"), api, getPostingId: () => postingId,
  isBlocked: () => state.policyBusy,
  onSessionEnded: () => sessionEnded(),
  onStale: async () => { const reload = await api.getMyPosting(postingId); if (reload.ok) await populate(reload.data, { keepForm: true, saved: PANEL.POLICY }); },
  onChanged: async (list, said) => {            // a replace or a remove worked: keep the page's copy in step, draw the section again (the box comes back when the link is gone), and refresh the change list
    if (state.doc) {
      state.doc.destination_links = (state.doc.destination_links || []).filter((x) => x.kind !== "policy").concat(list.filter((x) => x.kind === "policy"));
      renderPolicy(state.doc, true);
    }
    if (said && said.op === "remove") say($("#policyAlert"), "ok", said.text);      // the row is gone, so its own sentence goes where the box's messages go
    const reload = await api.getMyPosting(postingId);
    if (reload.ok && state.doc) { state.doc.recent_changes = reload.data.recent_changes; renderChanges(reload.data.recent_changes); }
    refreshUnsaved();
  },
});
function renderPolicy(doc, editable) {
  const row = $("#policyRow"); row.hidden = !editable; if (!editable) return;
  const v = policyView(doc, Date.now()), note = $("#policyNote"); clear(note); note.hidden = true;
  $("#policyLocked").hidden = v.show !== "locked";
  const rowShown = v.show === "form" && v.stored;
  $("#policyPanel").hidden = !rowShown;
  $("#policyForm").hidden = !(v.show === "form" && !v.stored);
  if (v.show === "lapsed") { note.hidden = false; note.append(alertBox("notice", policyLapsedText(v))); }
  policyPanel.render(rowShown ? doc.destination_links : []);
  if (v.show !== "form") return;
  const stored = $("#policyStored"); stored.hidden = v.stored; stored.textContent = v.stored ? "" : policyStoredText(v);
  if (!state.policyBusy && !state.keepPanels.has(PANEL.POLICY)) { $("#policyUrl").value = ""; showPolicyField(""); }
}
async function submitPolicy() {
  if (state.policyBusy || !state.orig) return;
  const box = $("#policyAlert"); say(box, "error", ""); showPolicyField("");
  const c = checkPolicyUrl($("#policyUrl").value);
  if (!c.ok) { showPolicyField(c.error); $("#policyUrl").focus(); return; }
  state.policyBusy = true; $("#savePolicyBtn").disabled = true;
  try {
    const r = await api.setPolicyLink(postingId, c.url);
    if (!r.ok) {
      if (isAuthFailure(r.error)) return sessionEnded();
      const m = mapPolicyError(r.error);
      if (m.field) { showPolicyField(m.field); $("#policyUrl").focus(); } else say(box, "error", m.general || failureText(r.error));
      if (m.planRequired) { const reload = await api.getMyPosting(postingId); if (reload.ok) { state.policyBusy = false; await populate(reload.data, { keepForm: true, saved: PANEL.POLICY }); say($("#policyAlert"), "error", m.general); } }
      return;
    }
    state.policyBusy = false;
    const reload = await api.getMyPosting(postingId);
    if (reload.ok) await populate(reload.data, { keepForm: true, saved: PANEL.POLICY });
    const saved = r.data.links.find((x) => x.kind === "policy");
    say($("#policyAlert"), !saved || saved.check_status === "ok" ? "ok" : "notice", policySavedText(r.data, false), true);
  } finally { state.policyBusy = false; $("#savePolicyBtn").disabled = false; }
}
$("#savePolicyBtn").addEventListener("click", () => submitPolicy());
$("#policyUrl").addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); submitPolicy(); } });   // Enter saves the policy link, never the whole opening

// opts: keepForm: the main form's unsaved edits stay (another part of the page was just saved, so the posting is read again, but what was typed in the form is not thrown away);
//       saved: the section that was just saved ("*" = all of them, a discard): the other sections keep what was typed in them and not saved yet
async function populate(doc, opts) {
  const o = opts || {}, p = doc.posting;
  const editable = p.stored_status === "draft" || ((p.stored_status === "live" || p.stored_status === "paused") && p.status === p.stored_status);
  const keepForm = o.keepForm === true && editable && formUnsaved();
  const keepPanels = new Set(o.saved === "*" ? [] : panelsUnsaved().filter((n) => n !== o.saved));
  state.loading = true;
  try {
  state.orig = p; state.doc = doc; state.plan = doc.plan; state.keepPanels = keepPanels;
  if (!keepForm) {
    state.aiFilter = p.ai_filtering; state.aiInterview = p.ai_interview_other; state.recruiter = p.third_party_recruiter; state.needNote = false;
    state.exclusive = p.destination_links_exclusive === true; setToggle("#exclusiveToggle", state.exclusive);
    state.reqSearchable = p.req_searchable !== false; setToggle("#reqSearchToggle", state.reqSearchable);
    $("#jtitle").value = p.title; $("#req").value = p.req_number || ""; $("#desc").value = p.description_text; $("#appcap").value = p.applicant_cap === null ? "" : String(p.applicant_cap);
    $("#remote").checked = p.is_remote; noteInput.value = "";
    setToggle("#aiFilterToggle", p.ai_filtering === true); setToggle("#aiInterviewToggle", p.ai_interview_other === true); setToggle("#recruiterToggle", p.third_party_recruiter);
    $("#aiFilterNote").value = p.ai_filtering_note || ""; $("#aiInterviewNote").value = p.ai_interview_note || ""; syncNoteRows();
  }
  $("#companyShown").textContent = p.company_name;
  $("#aiFilterHint").textContent = p.ai_filtering === null ? "Not stated yet. Once you state it, it can be changed but not cleared." : "Shown to candidates as a plain fact, never scored.";
  $("#aiInterviewHint").textContent = p.ai_interview_other === null ? "Not stated yet. Once you state it, it can be changed but not cleared." : "Independent of filtering. An employer can have neither, either, or both on.";
  // the opening's ID, its short link and the lines for a job ad, each with a copy button (js/kio-block.js); text only, for every status including a draft. The ID is formatted the same way as the dashboard row and the comments page.
  const idLine = $("#postIdLine"); clear(idLine); idLine.append(kioBlock(p.post_id)); idLine.hidden = false;
  const chip = statusChip(p, Date.now());
  const line = $("#statusLine"); line.hidden = false; clear(line);
  line.append(h("span", { class: "status " + chip.cls }, chip.text), " ", p.stored_status === "draft" ? (p.go_live_at ? "Scheduled: not visible to candidates until it goes live." : "Not visible to candidates yet.") : (p.status === "live" || p.status === "paused") && p.expiration_date ? "Closes " + fmtClose(p.expiration_date) + "." : "");
  // the place line: the same one every other screen draws (js/place.js), from what is STORED (the form's own place boxes show what is being edited)
  // prompt BL: the employer typed it, so no "as provided by the employer" here. Prompt BN: and nothing at all, not even the label, when nothing is set (no place, no Remote): the title often says it.
  const pl = $("#placeLine"), placeKids = placeNodes(h, p, { note: false, hideNone: true }); clear(pl); pl.hidden = placeKids.length === 0;
  if (placeKids.length > 0) pl.append("Place: ", ...placeKids);
  noteLabel(p.stored_status === "draft");
  renderChanges(doc.recent_changes);
  if (!keepForm) { picker.set(await entriesFor(p), p.locations_attested); place.set((p.location_ids || []).length === 0 ? storedPlaceText(p) : ""); state.baseline = snapshotOf(collect()); }     // the snapshot every later edit is compared with
  form.hidden = !editable;
  renderLinks(doc, editable);
  renderFirms(doc, editable);
  renderPolicy(doc, editable);
  renderSchedule(p, editable);
  const ro = $("#readonlyNote"); ro.hidden = editable; clear(ro);
  if (!editable) {
    const why = p.stored_status === "flagged" ? "This opening is held for review, so it cannot be edited right now."
      : p.status === "expired" ? "This opening has expired. An expired or closed opening is the public record of what was advertised, so it cannot be edited."
      : "This opening is " + p.status + ". An expired or closed opening is the public record of what was advertised, so it cannot be edited.";
    ro.append(h("p", { style: "font-size:15px;line-height:1.6;" }, why), h("div", { style: "margin-top:16px;" }, h("a", { class: "btn btn-outline btn-sm", href: "dashboard.html" }, "Back to My openings")));
  }
  } finally { state.loading = false; state.keepPanels = new Set(); }
  refreshUnsaved();
}

async function load() {
  say(pageAlert, "error", "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postingId)) { say(pageAlert, "error", "This page needs an opening: open it from My openings."); return false; }
  const r = await api.getMyPosting(postingId);
  if (!r.ok) {
    if (isAuthFailure(r.error)) { await sessionEnded(); return false; }
    if (r.error.code === "not_found") { say(pageAlert, "error", "That opening was not found. The link may be wrong, or the opening may belong to a colleague."); return false; }
    say(pageAlert, "error", failureText(r.error) + " Reload the page to try again."); return false;
  }
  await populate(r.data); return true;
}

// -> true when the posting is saved (or the server says there was nothing to change), false when it is not: the leave dialog and the bar's Save need to know, and the unsaved warning stays after a refusal
async function submit() {
  if (state.busy || !state.orig) return false;
  say(formAlert, "error", "");
  const check = checkEdit(state.orig, collect());
  showErrors(check.errors);
  if (!check.body) {
    if (check.errors.form) { say(formAlert, "notice", check.errors.form + " Change something, then save."); return false; }
    const first = ["jtitle", "req", "locpicker", "loctext", "attest", "appcap", "desc", "aiFilterNote", "aiInterviewNote", "note"].find((k) => check.errors[k]);
    if (first === "locpicker" || first === "attest") picker.focusFor(first); else if (first) $("#" + first).focus();
    return false;
  }
  setBusy(true);
  try {
    const r = await api.editPosting(check.body);
    if (!r.ok) {
      if (isAuthFailure(r.error)) { await sessionEnded(); return false; }
      const m = mapEditErrors(r.error);
      if (m.needNote) { state.needNote = true; noteLabel(state.orig.stored_status === "draft"); }
      showErrors(m.byField);
      say(formAlert, "error", m.general || (Object.keys(m.byField).length ? "Nothing was saved. See the message under the field." : failureText(r.error)));
      if (m.newPosting) formAlert.append(h("div", { style: "margin-top:10px;" }, h("a", { class: "btn btn-outline btn-sm", href: "register.html" }, "Add a new opening →")));
      const firstId = Object.keys(m.byField)[0]; if (firstId) { if (firstId === "locpicker" || firstId === "attest") picker.focusFor(firstId); else $("#" + firstId).focus(); }
      return false;
    }
    if (!r.data.edited) {      // the server finds nothing to change: what is shown is what is stored, so the form is read again and nothing stays marked as unsaved
      const same = await api.getMyPosting(postingId);
      if (same.ok) await populate(same.data);
      say(formAlert, "notice", "Nothing was changed.", true); return true;
    }
    const reload = await api.getMyPosting(postingId);
    if (reload.ok) await populate(reload.data);
    showErrors({});
    say(formAlert, "ok", "Saved. " + (r.data.changed_fields.length === 1 ? "1 field was changed." : r.data.changed_fields.length + " fields were changed.") + (r.data.similarity_pct !== null && r.data.similarity_pct !== undefined ? " " + r.data.similarity_pct + "% of the earlier requirements wording is kept." : ""));
    formAlert.scrollIntoView({ block: "nearest", behavior: "smooth" });     // prompt BK: the message is at the bottom of the page now, next to the button that was pressed
    return true;
  } finally { setBusy(false); }
}

async function submitLinks(clearAll) {
  if (state.linksBusy || !state.orig) return;
  const box = $("#linksAlert"); say(box, "error", "");
  const check = clearAll ? { ok: true, links: [], rowOf: [], errors: {} } : checkLinks(links.values());
  showLinkErrors(check.errors);
  if (!check.ok) {
    if (check.form) say(box, "error", check.form);
    links.focus(check.errors);
    return;
  }
  state.linksBusy = true; $("#saveLinksBtn").disabled = true;
  try {
    const r = await api.setDestinationLinks(postingId, check.links);
    if (!r.ok) {
      if (isAuthFailure(r.error)) return sessionEnded();
      const m = mapLinksErrors(r.error, check.rowOf);
      showLinkErrors(m.rows);
      say(box, "error", m.general || (Object.keys(m.rows).length ? "Nothing was saved. See the message under the address." : failureText(r.error)));
      if (m.planRequired) { const reload = await api.getMyPosting(postingId); if (reload.ok) { state.linksBusy = false; await populate(reload.data, { keepForm: true, saved: PANEL.LINKS }); say($("#linksAlert"), "error", m.general); } }
      return;
    }
    state.linksBusy = false;
    const reload = await api.getMyPosting(postingId);
    if (reload.ok) await populate(reload.data, { keepForm: true, saved: PANEL.LINKS });
    const warn = clearAll ? null : checkWarnings(r.data.links);
    say($("#linksAlert"), warn ? "notice" : "ok", (r.data.changed === false ? (clearAll ? "There were no links stored, so nothing was changed." : "These are the links already stored, so nothing was changed.") : clearAll ? "Removed. No destination links are stored; candidates will see no apply link for this opening." : "Saved. " + (r.data.active_links === 1 ? "1 destination link is" : r.data.active_links + " destination links are") + " now stored.") + (warn ? " " + warn : ""), true);
  } finally { state.linksBusy = false; $("#saveLinksBtn").disabled = false; }
}
$("#linksForm").addEventListener("submit", (ev) => { ev.preventDefault(); submitLinks(false); });
$("#clearLinksBtn").addEventListener("click", () => { if (window.confirm("Remove all destination links from this opening? Candidates will then see no apply link. You can add links again at any time.")) submitLinks(true); });
// ---- the one action area at the bottom (prompt BK, October 11, 2026). The main button reads Save changes while something on the page has changed and Back to My openings while nothing has; the link sections keep their own
// saves in the middle, and the bottom button double checks them: a section with something not saved is named in one sentence, nothing is submitted, and the person saves that section first.
// Save as draft and Publish exist for a draft only: a live, paused or closed opening is never set back to draft by this page (the server refuses it too: tests\register-bk.test.js, the status guard test).
const anyUnsaved = () => formUnsaved() || panelsUnsaved().length > 0;
// -> true when the page may go on (nothing in a link section is waiting to be saved); otherwise the sentence is shown and false comes back
function linkSectionsClear() {
  const open = panelsUnsaved();
  if (open.length === 0) return true;
  say(formAlert, "notice", panelsFirstText(open));
  formAlert.setAttribute("data-live-sentence", "panels");        // prompt BN: syncLiveSentence() keeps it true or takes it away
  return false;
}
async function onMain() {
  if (state.busy || !state.orig) return;
  say(formAlert, "error", "");
  if (!anyUnsaved()) { guard.openDialog(() => go("dashboard.html"), saveBtn); return; }   // Back to My openings (the dialog asks first only if something turned out to be unsaved)
  if (!linkSectionsClear()) return;
  await submit();
}
async function onSaveAsDraft() {
  if (state.busy || !state.orig || state.orig.stored_status !== "draft") return;
  say(formAlert, "error", "");
  if (!linkSectionsClear()) return;
  if (formUnsaved() && !(await submit())) return;
  go("dashboard.html");           // it stays a draft; the way back to My openings
}
async function onPublish() {
  if (state.busy || !state.orig || state.orig.stored_status !== "draft") return;
  say(formAlert, "error", "");
  if (!linkSectionsClear()) return;
  if (formUnsaved() && !(await submit())) return;
  // the same confirmation, words and rules as Publish on My openings (js/dashboard-actions.js): goes live now, the window starts now
  runAction("publish", state.orig, {
    api,
    done: async (text) => { const r = await api.getMyPosting(postingId); if (r.ok) await populate(r.data); say(formAlert, "ok", text); },
    sessionEnded: () => sessionEnded(),
  });
}
saveBtn.addEventListener("click", () => onMain());
draftSaveBtn.addEventListener("click", () => onSaveAsDraft());
publishBtn.addEventListener("click", () => onPublish());
form.addEventListener("submit", (ev) => { ev.preventDefault(); onMain(); });
// Enter in a single-line box saves (or, when nothing has changed, does nothing: it never leaves the page by itself)
function enterSaves(ev) {
  if (ev.key !== "Enter" || ev.defaultPrevented) return;
  const t = ev.target;
  if (t && t.tagName === "INPUT" && t.type === "text") { ev.preventDefault(); if (anyUnsaved()) onMain(); }
}
form.addEventListener("keydown", enterSaves);
noteInput.addEventListener("keydown", enterSaves);

// ---- unsaved work (js/dirty-state.js decides what counts; js/unsaved-guard.js shows the bar, asks before the page is left, and holds the dialog)
// The main form is unsaved when it differs from the snapshot taken when it was last loaded or saved. The sections that save through their own buttons (destination links, recruiter firms, the go-live time)
// are reported on their own and the bar says Save changes does not cover them. Only what a person can see counts: a hidden section's boxes are not the person's unsaved work.
const shown = (sel) => { const el = $(sel); return !!el && !el.closest("[hidden]"); };
function formUnsaved() { return !!state.orig && state.baseline !== null && !form.hidden && snapshotOf(collect()) !== state.baseline; }
function panelsUnsaved() {
  const out = [];
  if (!state.orig) return out;
  if ((shown("#linksForm") && rowsTyped(links.values())) || (shown("#linksPanel") && linkPanel.hasPending())) out.push(PANEL.LINKS);
  if ((shown("#firmsForm") && rowsTyped(firms.values())) || (shown("#firmsForm") && firmPanel.hasPending())) out.push(PANEL.FIRMS);
  if ((shown("#policyForm") && $("#policyUrl").value.trim() !== "") || (shown("#policyPanel") && policyPanel.hasPending())) out.push(PANEL.POLICY);
  if (shown("#scheduleCard") && $("#gldate").value !== state.glBaseline) out.push(PANEL.GOLIVE);
  return out;
}
function unsavedModel() {
  if (!state.orig || state.loading) return { form: false, panels: [], status: "live", noteMissing: false, noteRequired: false, rules: { titleRule: false } };
  const dirty = formUnsaved(), rules = earlyRules(state.orig, collect(), dirty);
  // linkRows / linkEdit: which kind of destination links work is unsaved (typed new rows, or the open Edit of a stored link): the bar names the right button for each (js/dirty-state.js)
  return { form: dirty, panels: panelsUnsaved(), linkRows: shown("#linksForm") && rowsTyped(links.values()), linkEdit: shown("#linksPanel") && linkPanel.hasPending(), firmRows: shown("#firmsForm") && rowsTyped(firms.values()), firmEdit: shown("#firmsForm") && firmPanel.hasPending(), status: state.orig.stored_status, noteMissing: rules.noteMissing, noteRequired: rules.noteRequired, rules };
}
// the note box (prompt BM): in the page only while the main form differs from what is saved. Taken out again when the change is undone, with its text, its rule sentence and its error: a note that is not in
// the page can never be sent. Nothing moves the cursor: if it was inside the box when the box goes, it goes to the main button.
function syncNoteBlock(wanted) {
  const inPage = noteBlock.isConnected;
  if (wanted && !inPage) actionArea.insertBefore(noteBlock, actionArea.firstChild);
  else if (!wanted && inPage) {
    const had = noteBlock.contains(document.activeElement);
    noteBlock.remove();
    noteInput.value = ""; noteInput.setAttribute("aria-invalid", "false");
    noteErrEl.hidden = true; noteErrEl.textContent = "";
    noteNeededEl.hidden = true; noteNeededEl.textContent = "";
    noteLimit.refresh();                       // the count goes back to 0 of 500 and the paste sentence is gone, ready for the next time the box is put back
    if (state.needNote) { state.needNote = false; noteLabel(state.orig.stored_status === "draft"); }       // a server demand for an explanation belonged to that change
    if (had) saveBtn.focus();
  }
}
// the bottom area: shown for an opening that can be edited; the main button's words follow what is unsaved; Save as draft and Publish only for a draft (Publish while its publish window is open)
function syncActions() {
  const editable = !!state.orig && !form.hidden;
  actionArea.hidden = !editable;
  syncNoteBlock(editable && formUnsaved());
  if (!editable) return;
  const dirty = anyUnsaved(), draft = state.orig.stored_status === "draft";
  saveBtn.textContent = dirty ? ACTION.SAVE : ACTION.BACK;
  saveBtn.setAttribute("data-mode", dirty ? "save" : "back");
  draftSaveBtn.hidden = !draft;
  publishBtn.hidden = !(draft && actionsFor(state.orig, Date.now()).includes("publish"));
}
// the double check sentence above the bottom button (prompt BN): it describes a condition (a link section holds something not saved), so it is shown only while that is true. It follows the sections: gone the
// moment none of them holds anything (Cancel in a link form, Discard, a link saved or removed, the box emptied by hand), and re-worded when the set of sections changes.
function syncLiveSentence() {
  if (formAlert.getAttribute("data-live-sentence") !== "panels") return;
  const open = panelsUnsaved(), text = panelsFirstText(open);
  if (text === "") { say(formAlert, "error", ""); return; }
  if (text !== formAlert.textContent.trim()) { say(formAlert, "notice", text); formAlert.setAttribute("data-live-sentence", "panels"); }
}
// the error under the note box says the note is missing: it goes as soon as a note is typed (the next press checks it again)
noteInput.addEventListener("input", () => { if (noteInput.value.trim() !== "" && !noteErrEl.hidden) { noteErrEl.hidden = true; noteErrEl.textContent = ""; noteInput.setAttribute("aria-invalid", "false"); } });
function refreshUnsaved() {
  if (!guard) return;
  if (anyUnsaved() && document.querySelector("[data-result]")) clearResults();       // prompt BR: the next change has begun, so what the last save said is no longer the state of the page
  guard.refresh();
  for (const x of limitHints) x.refresh();         // the counts follow a value a script put in a box (a save, Discard)
  syncLiveSentence();
  syncActions();
  const m = unsavedModel(), status = state.orig ? state.orig.stored_status : "live";
  const need = noteNeededEl; need.hidden = !m.noteRequired; need.textContent = m.noteRequired ? UNSAVED.noteRequired(status) : "";          // the note rule, shown as soon as a change makes it apply
  const rule = $("#titleRule"); rule.hidden = !m.rules.titleRule; rule.textContent = m.rules.titleRule ? UNSAVED.titleRule(status) : "";           // and the title rule, as soon as the title is changed
}
// Discard: the saved values go back into the form and every section (a fresh read of what was last loaded or saved; nothing is sent)
async function discardAll() {
  if (!state.doc || state.busy) return;
  guard.hush(true);                          // the discard says its own sentence, so the bar going away is not announced a second time
  try {
    await populate(state.doc, { saved: "*" });
    if (shown("#linksPanel")) linkPanel.discard();            // the rows are drawn again from the stored links: an open edit form and what was typed in it are gone
    if (shown("#firmsForm")) firmPanel.discard();             // the same for the recruiter firms' rows and for the policy link's row
    if (shown("#policyPanel")) policyPanel.discard();
    showErrors({}); say(formAlert, "error", ""); clearResults();      // prompt BR: Discard also takes away what a link, firm, policy or schedule save said
    guard.refresh();
  } finally { guard.hush(false); }
  guard.announce(UNSAVED.DISCARDED);
}
guard = mountUnsavedGuard({
  win: window, root: document.documentElement,
  bar: $("#unsavedBar"), head: $("#unsavedHead"), detail: $("#unsavedDetail"), live: $("#unsavedLive"), saveBtn: $("#unsavedSave"), discardBtn: $("#unsavedDiscard"), skip: $("#skipToUnsaved"),
  dlg: { overlay: $("#leaveOverlay"), title: $("#leaveTitle"), text: $("#leaveText"), save: $("#leaveSave"), discard: $("#leaveDiscard"), stay: $("#leaveStay") },
  getModel: unsavedModel, save: () => submit(), discard: () => discardAll(), go,
  activeElement: () => document.activeElement, confirmDiscard: () => window.confirm(UNSAVED.CONFIRM_DISCARD), rescueFocus: () => $("#editHeading").focus(),
});
for (const t of ["input", "change", "click", "keyup"]) document.addEventListener(t, () => refreshUnsaved());
window.addEventListener("pageshow", (ev) => { if (ev.persisted) clearResults(); });       // prompt BR: coming back to this page from the browser's cache does not bring back what the last save said
// a click on any link of this page that leaves it, or on Sign out, is held back while something is unsaved (capture phase: before the link or the button acts)
document.addEventListener("click", (ev) => {
  const t = ev.target && ev.target.closest ? ev.target : null;
  if (!t) return;
  const a = t.closest("a[href]");
  if (a) { guard.interceptClick(ev, { kind: "link", href: a.getAttribute("href"), target: a.getAttribute("target"), download: a.hasAttribute("download"), el: a }); return; }
  const out = t.closest("#navAccount button:not(.avatar-btn)");   // Sign out, not the initials circle (that only opens a label)
  if (out) guard.interceptClick(ev, { kind: "button", el: out });
}, true);

(async () => {
  const ctx = await requirePoster("edit.html?id=" + postingId);
  if (!ctx) return;
  await mountAccount($("#navAccount"), { cta: false });
  if (!ctx.info) { say(pageAlert, "error", describeError(ctx.error) + " Reload the page to try again."); return; }
  $("#orgName").textContent = ctx.info.organization.name;
  await load();
})();
