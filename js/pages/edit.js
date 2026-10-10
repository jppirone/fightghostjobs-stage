// edit.js - an employer edits a posting they own: the form starts from what get-my-posting returns, only what CHANGED is sent to edit-posting, and every edit of a posting that is not a draft carries a change note.
// The server judges the rest (how much of the requirements text is kept, the location rule, duplicate req numbers) and this page shows its answer in words. Nothing here trusts the page for identity: the session token tells the server who is acting.
// Unsaved work is never lost silently: a bar at the bottom of the window says what is not saved, the browser asks before the page is left, and the page's own links ask with a dialog (js/unsaved-guard.js; what counts as unsaved is js/dirty-state.js).

import { api, requirePoster, mountAccount, go, signOut, describeError, isAuthFailure } from "../app.js";
import { rememberNext } from "../session.js";
import { $, $$, h, clear, alertBox } from "../dom.js";
import { fmtClose, fmtStamp, waitText, groupCode } from "../format.js";
import { statusChip } from "../dashboard-model.js";
import { checkEdit, mapEditErrors, KIND_TEXT, checkLinks, checkFirms, mapLinksErrors, planNotice, checkWarnings, storedLinkText, applyLinks, recruiterFirms } from "../edit-form.js";
import { mountLocationPicker } from "../location-picker.js";
import { checkGoLive, toLocalInput, mapScheduleError } from "../schedule-form.js";
import { loadCatalog } from "../location-catalog.js";
import { mountLinkRowsById, mountFirmRowsById } from "../link-rows.js";
import { mountLinkPanel } from "../link-panel.js";
import { policyView, policyStoredText, policyLapsedText, policySavedText, mapPolicyError, checkPolicyUrl, POLICY_REMOVE_CONFIRM, policyLink } from "../policy-link.js";
import { wireInfoIcons } from "../info-icon.js";
import { snapshotOf, rowsTyped, earlyRules, UNSAVED, PANEL } from "../dirty-state.js";
import { mountUnsavedGuard } from "../unsaved-guard.js";

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

const val = (id) => $(id).value;
function say(box, kind, text) { clear(box); box.hidden = !text; if (text) box.append(alertBox(kind, text)); }
function showErrors(byField) {
  for (const el of $$("[data-error-for]")) { const id = el.dataset.errorFor; const msg = byField[id]; el.hidden = !msg; el.textContent = msg || ""; const inp = $("#" + (id === "locpicker" ? "locq" : id)); if (inp) inp.setAttribute("aria-invalid", msg ? "true" : "false"); }
}
function setBusy(on) { state.busy = on; saveBtn.disabled = on; $("#unsavedSave").disabled = on; $("#unsavedDiscard").disabled = on; }
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

const collect = () => ({ title: val("#jtitle"), req: val("#req"), desc: val("#desc"), locEntries: picker.get().entries, attested: picker.get().attested, remote: $("#remote").checked, appcap: val("#appcap"),
  aiFilter: state.aiFilter, aiInterview: state.aiInterview, aiFilterNote: val("#aiFilterNote"), aiInterviewNote: val("#aiInterviewNote"), recruiter: state.recruiter, reqSearchable: state.reqSearchable, exclusive: planActive() ? state.exclusive : undefined, note: val("#note") });

// the catalog entries for the stored ids (a place the catalog no longer has still shows, by the display text the database stored)
async function entriesFor(p) {
  let catalog = null;
  try { catalog = await loadCatalog(); } catch { /* the fallback below still shows the stored names */ }
  const byId = new Map(catalog && catalog.entries ? catalog.entries.map((e) => [e.id, e]) : []);
  return p.location_ids.map((id, i) => byId.get(id) || { id, kind: "place", display: p.locations[i] || id });
}

function noteLabel(isDraft) {
  $("#noteLabel").textContent = isDraft && !state.needNote ? "What changed, and why? (optional on a draft; kept with the opening)." : "What changed, and why? (required; kept with the opening).";
  $("#note").setAttribute("aria-required", isDraft && !state.needNote ? "false" : "true");
}

function renderChanges(list) {
  const card = $("#changesCard"), ul = $("#changesList"); clear(ul);
  card.hidden = list.length === 0;
  for (const c of list) ul.append(h("li", {}, h("div", { style: "font-weight:600;" }, KIND_TEXT[c.kind] || "Edit", h("span", { style: "font-weight:400;color:var(--muted);" }, " · " + fmtStamp(c.at))), h("div", { style: "color:#4A453F;margin-top:2px;overflow-wrap:anywhere;" }, c.note)));
}

// ---- the go-live time: a draft (scheduled or not) can carry one; the 15-minute scheduler publishes it, and the window starts then
function renderSchedule(p, editable) {
  const card = $("#scheduleCard"); card.hidden = !(editable && p.stored_status === "draft"); if (card.hidden) return;
  const scheduled = typeof p.go_live_at === "string";
  state.glBaseline = scheduled ? toLocalInput(p.go_live_at) : "";
  const st = $("#scheduleState"); clear(st);
  st.append(scheduled ? h("span", {}, h("strong", {}, "Scheduled: "), "goes live at " + fmtClose(p.go_live_at) + ", published within 15 minutes after that time. Its window is counted from then.")
    : "Not scheduled. It goes live when you publish it" + (p.publish_by ? " (a draft can be published for 14 days after it was saved, until " + fmtClose(p.publish_by) + ")." : "."));
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
const firms = mountFirmRowsById();
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
  else if (notice.state === "active" && state.recruiter && !savedOn) { note.hidden = false; note.append(alertBox("notice", "Naming a firm is optional. To name one here, first save this opening with the recruiter toggle on (Save changes, above); then come back to this section.")); }
  if (!$("#firmsForm").hidden) {
    const box = $("#firmsStored"); clear(box);
    box.append(stored.length === 0 ? "No recruiter firm is named yet." : h("span", {}, h("strong", {}, stored.length === 1 ? "1 firm is named" : stored.length + " firms are named"), ": ", stored.map(storedLinkText).join("; "), "."));
    $("#clearFirmsBtn").hidden = stored.length === 0;
    if (!state.firmsBusy && !state.keepPanels.has(PANEL.FIRMS)) firms.reset();
  }
}
async function submitFirms(clearAll) {
  if (state.firmsBusy || !state.orig) return;
  const box = $("#firmsAlert"); say(box, "error", "");
  const check = clearAll ? { ok: true, links: [], rowOf: [], errors: {} } : checkFirms(firms.values());
  firms.showErrors(check.errors);
  if (!check.ok) { if (check.form) say(box, "error", check.form); firms.focus(check.errors); return; }
  state.firmsBusy = true; $("#saveFirmsBtn").disabled = true;
  try {
    const r = await api.setRecruiterFirms(postingId, check.links);
    if (!r.ok) {
      if (isAuthFailure(r.error)) return sessionEnded();
      const m = mapLinksErrors(r.error, check.rowOf);
      firms.showErrors(m.rows);
      say(box, "error", m.general || (Object.keys(m.rows).length ? "Nothing was saved. See the message under the firm." : failureText(r.error)));
      return;
    }
    state.firmsBusy = false;
    const reload = await api.getMyPosting(postingId);
    if (reload.ok) await populate(reload.data, { keepForm: true, saved: PANEL.FIRMS });
    const warn = clearAll ? null : checkWarnings(r.data.links);
    say($("#firmsAlert"), warn ? "notice" : "ok", (r.data.changed === false ? (clearAll ? "No firm was named, so nothing was changed." : "These are the firms already named, so nothing was changed.") : clearAll ? "Removed. No recruiter firm is named on this opening." : "Saved. " + (r.data.active_links === 1 ? "1 recruiter firm is" : r.data.active_links + " recruiter firms are") + " now named.") + (warn ? " " + warn : ""));
  } finally { state.firmsBusy = false; $("#saveFirmsBtn").disabled = false; }
}
$("#saveFirmsBtn").addEventListener("click", () => submitFirms(false));
$("#clearFirmsBtn").addEventListener("click", () => { if (window.confirm("Remove every recruiter firm from this opening? You can name them again at any time.")) submitFirms(true); });

// ---- the AI and hiring policy link (prompt BA, October 10, 2026): one more destination link, in the Disclosures area next to the AI toggles. The same tier gate as the links and the firms; its own Save and Remove buttons
// (Save changes does not save it); the address is write-only (the box starts empty and is never filled from the server). The words and the states are in js/policy-link.js.
function showPolicyField(msg) { const e = $("#policyError"); e.textContent = msg || ""; e.hidden = !msg; $("#policyUrl").setAttribute("aria-invalid", msg ? "true" : "false"); }
function renderPolicy(doc, editable) {
  const row = $("#policyRow"); row.hidden = !editable; if (!editable) return;
  const v = policyView(doc, Date.now()), note = $("#policyNote"); clear(note); note.hidden = true;
  $("#policyLocked").hidden = v.show !== "locked";
  $("#policyForm").hidden = v.show !== "form";
  if (v.show === "lapsed") { note.hidden = false; note.append(alertBox("notice", policyLapsedText(v))); }
  if (v.show !== "form") return;
  const trouble = v.status === "failed" || v.status === "unchecked";
  const stored = $("#policyStored"); stored.hidden = trouble; stored.textContent = trouble ? "" : policyStoredText(v);
  if (trouble) { note.hidden = false; note.append(alertBox("notice", policyStoredText(v))); }
  $("#removePolicyBtn").hidden = !v.stored;
  if (!state.policyBusy && !state.keepPanels.has(PANEL.POLICY)) { $("#policyUrl").value = ""; showPolicyField(""); }
}
async function submitPolicy(remove) {
  if (state.policyBusy || !state.orig) return;
  const box = $("#policyAlert"); say(box, "error", ""); showPolicyField("");
  let url = null;
  if (!remove) {
    const c = checkPolicyUrl($("#policyUrl").value);
    if (!c.ok) { showPolicyField(c.error); $("#policyUrl").focus(); return; }
    url = c.url;
  }
  state.policyBusy = true; $("#savePolicyBtn").disabled = true; $("#removePolicyBtn").disabled = true;
  try {
    const r = await api.setPolicyLink(postingId, url);
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
    say($("#policyAlert"), remove || !saved || saved.check_status === "ok" ? "ok" : "notice", policySavedText(r.data, remove));
  } finally { state.policyBusy = false; $("#savePolicyBtn").disabled = false; $("#removePolicyBtn").disabled = false; }
}
$("#savePolicyBtn").addEventListener("click", () => submitPolicy(false));
$("#removePolicyBtn").addEventListener("click", () => { if (window.confirm(POLICY_REMOVE_CONFIRM)) submitPolicy(true); });
$("#policyUrl").addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); submitPolicy(false); } });   // Enter saves the policy link, never the whole opening

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
    $("#remote").checked = p.is_remote; $("#note").value = "";
    setToggle("#aiFilterToggle", p.ai_filtering === true); setToggle("#aiInterviewToggle", p.ai_interview_other === true); setToggle("#recruiterToggle", p.third_party_recruiter);
    $("#aiFilterNote").value = p.ai_filtering_note || ""; $("#aiInterviewNote").value = p.ai_interview_note || ""; syncNoteRows();
  }
  $("#companyShown").textContent = p.company_name;
  $("#aiFilterHint").textContent = p.ai_filtering === null ? "Not stated yet. Once you state it, it can be changed but not cleared." : "Shown to candidates as a plain fact, never scored.";
  $("#aiInterviewHint").textContent = p.ai_interview_other === null ? "Not stated yet. Once you state it, it can be changed but not cleared." : "Independent of filtering. An employer can have neither, either, or both on.";
  $("#postId").textContent = groupCode(p.post_id); $("#postIdLine").hidden = false;   // the same postID, formatted the same way, as the dashboard row and the comments page
  const chip = statusChip(p, Date.now());
  const line = $("#statusLine"); line.hidden = false; clear(line);
  line.append(h("span", { class: "status " + chip.cls }, chip.text), " ", p.stored_status === "draft" ? (p.go_live_at ? "Scheduled: not visible to candidates until it goes live." : "Not visible to candidates yet.") : (p.status === "live" || p.status === "paused") && p.expiration_date ? "Closes " + fmtClose(p.expiration_date) + "." : "");
  noteLabel(p.stored_status === "draft");
  renderChanges(doc.recent_changes);
  if (!keepForm) { picker.set(await entriesFor(p), p.locations_attested); state.baseline = snapshotOf(collect()); }     // the snapshot every later edit is compared with
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
    const first = ["jtitle", "req", "locpicker", "attest", "appcap", "desc", "aiFilterNote", "aiInterviewNote", "note"].find((k) => check.errors[k]);
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
      say(formAlert, "notice", "Nothing was changed."); return true;
    }
    const reload = await api.getMyPosting(postingId);
    if (reload.ok) await populate(reload.data);
    showErrors({});
    say(formAlert, "ok", "Saved. " + (r.data.changed_fields.length === 1 ? "1 field was changed." : r.data.changed_fields.length + " fields were changed.") + (r.data.similarity_pct !== null && r.data.similarity_pct !== undefined ? " " + r.data.similarity_pct + "% of the earlier requirements wording is kept." : ""));
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    say($("#linksAlert"), warn ? "notice" : "ok", (r.data.changed === false ? (clearAll ? "There were no links stored, so nothing was changed." : "These are the links already stored, so nothing was changed.") : clearAll ? "Removed. No destination links are stored; candidates will see no apply link for this opening." : "Saved. " + (r.data.active_links === 1 ? "1 destination link is" : r.data.active_links + " destination links are") + " now stored.") + (warn ? " " + warn : ""));
  } finally { state.linksBusy = false; $("#saveLinksBtn").disabled = false; }
}
$("#linksForm").addEventListener("submit", (ev) => { ev.preventDefault(); submitLinks(false); });
$("#clearLinksBtn").addEventListener("click", () => { if (window.confirm("Remove all destination links from this opening? Candidates will then see no apply link. You can add links again at any time.")) submitLinks(true); });
form.addEventListener("submit", (ev) => { ev.preventDefault(); submit(); });

// ---- unsaved work (js/dirty-state.js decides what counts; js/unsaved-guard.js shows the bar, asks before the page is left, and holds the dialog)
// The main form is unsaved when it differs from the snapshot taken when it was last loaded or saved. The sections that save through their own buttons (destination links, recruiter firms, the go-live time)
// are reported on their own and the bar says Save changes does not cover them. Only what a person can see counts: a hidden section's boxes are not the person's unsaved work.
const shown = (sel) => { const el = $(sel); return !!el && !el.closest("[hidden]"); };
function formUnsaved() { return !!state.orig && state.baseline !== null && !form.hidden && snapshotOf(collect()) !== state.baseline; }
function panelsUnsaved() {
  const out = [];
  if (!state.orig) return out;
  if ((shown("#linksForm") && rowsTyped(links.values())) || (shown("#linksPanel") && linkPanel.hasPending())) out.push(PANEL.LINKS);
  if (shown("#firmsForm") && rowsTyped(firms.values())) out.push(PANEL.FIRMS);
  if (shown("#policyForm") && $("#policyUrl").value.trim() !== "") out.push(PANEL.POLICY);
  if (shown("#scheduleCard") && $("#gldate").value !== state.glBaseline) out.push(PANEL.GOLIVE);
  return out;
}
function unsavedModel() {
  if (!state.orig || state.loading) return { form: false, panels: [], status: "live", noteMissing: false, noteRequired: false, rules: { titleRule: false } };
  const dirty = formUnsaved(), rules = earlyRules(state.orig, collect(), dirty);
  // linkRows / linkEdit: which kind of destination links work is unsaved (typed new rows, or the open Edit of a stored link): the bar names the right button for each (js/dirty-state.js)
  return { form: dirty, panels: panelsUnsaved(), linkRows: shown("#linksForm") && rowsTyped(links.values()), linkEdit: shown("#linksPanel") && linkPanel.hasPending(), status: state.orig.stored_status, noteMissing: rules.noteMissing, noteRequired: rules.noteRequired, rules };
}
function refreshUnsaved() {
  if (!guard) return;
  guard.refresh();
  const m = unsavedModel(), status = state.orig ? state.orig.stored_status : "live";
  const need = $("#noteNeeded"); need.hidden = !m.noteRequired; need.textContent = m.noteRequired ? UNSAVED.noteRequired(status) : "";          // the note rule, shown as soon as a change makes it apply
  const rule = $("#titleRule"); rule.hidden = !m.rules.titleRule; rule.textContent = m.rules.titleRule ? UNSAVED.titleRule(status) : "";           // and the title rule, as soon as the title is changed
}
// Discard: the saved values go back into the form and every section (a fresh read of what was last loaded or saved; nothing is sent)
async function discardAll() {
  if (!state.doc || state.busy) return;
  guard.hush(true);                          // the discard says its own sentence, so the bar going away is not announced a second time
  try {
    await populate(state.doc, { saved: "*" });
    if (shown("#linksPanel")) linkPanel.discard();            // the rows are drawn again from the stored links: an open edit form and what was typed in it are gone
    showErrors({}); say(formAlert, "error", "");
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
