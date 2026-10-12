// register.js - an employer registers a posting: create it (a draft), then publish it (standard tier goes live immediately).
// "Save draft" stops after the first step: the draft is then found and published from My postings (dashboard.html). Nothing here trusts the page for identity: the session token tells the server who is acting.

import { api, requirePoster, mountAccount, go, signOut, describeError, isAuthFailure } from "../app.js?v=67bc7e98";
import { rememberNext } from "../session.js?v=c0af4232";
import { $, $$, h, clear, alertBox } from "../dom.js?v=ff147636";
import { fmtClose, waitText } from "../format.js?v=032c6fc5";
import { kioBlock } from "../kio-block.js?v=6a7d21f6";
import { checkGoLive, mapScheduleError } from "../schedule-form.js?v=b2985372";
import { validateForm, buildCreateBody, mapServerErrors, isDuplicateReq, collectLinks, linksOutcome, collectFirms, firmsOutcome, collectPolicy, policyOutcome, mapPolicyError, linkProblems, checkReport } from "../register-form.js?v=baec0d26";
import { mapLinksErrors, planNotice, addressProblem } from "../edit-form.js?v=b5757c87";
import { policyView, policyLapsedText } from "../policy-link.js?v=f2ea9573";
import { registerSnapshot, summarizeRegister, REGISTER_UNSAVED, rowsTyped } from "../dirty-state.js?v=7d4da23c";
import { mountUnsavedGuard } from "../unsaved-guard.js?v=206c5678";
import { mountLinkRowsById, mountFirmRowsById } from "../link-rows.js?v=a79f852e";
import { mountLocationPicker } from "../location-picker.js?v=ae8d9e28";
import { mountPlaceChoice } from "../place-choice.js?v=f65a1b27";
import { PLACE_WORDS, storedPlaceText, collapsePlaceText } from "../place-text.js?v=cb5d7506";
import { wireInfoIcons } from "../info-icon.js?v=66958a58";
import { mountLimitHint } from "../limit-hint.js?v=1cfa5987";

wireInfoIcons();
// links: the destination-link rows, mounted only when the organization's plan allows links (null otherwise); linksSaved / linksProblem: what happened to them after the posting was created
// firms: the recruiter-firm rows (pass C), mounted with the links when the plan allows; they matter only while the recruiter toggle is on
const state = { aiFilter: false, aiInterview: false, recruiter: false, saved: null, busy: false, dupAsked: false, goLiveIso: null, links: null, linksSaved: null, linksAnswer: null, linksProblem: null, firms: null, firmsSaved: null, firmsProblem: null, firmsAnswer: null, placeProblem: null, policyOn: false, policySaved: null, policyProblem: null, baseline: null, guard: null };
const form = $("#form"), result = $("#result"), pageAlert = $("#pageAlert"), formAlert = $("#formAlert");
const registerBtn = $("#registerBtn"), draftBtn = $("#draftBtn"), waitWord = $("#waitWord");
const WAIT_ONE = "Checking address", WAIT_MANY = "Checking addresses";      // prompt BK: shown next to the buttons while the server asks each address once
const RECRUITER_CLEARED = "The firm names you typed were cleared because Third-party recruiter involved is off.";
// the boxes that stop typing at a limit say so (prompt BK): job title, req number, close-out text, the two AI notes and the description; the limit is each box's own maxlength
const limitHints = ["#jtitle", "#req", "#closeout", "#aiFilterNote", "#aiInterviewNote", "#desc"].map((sel) => mountLimitHint({ input: $(sel) }));
const picker = mountLocationPicker({ isRemote: () => $("#remote").checked });
$("#remote").addEventListener("change", () => picker.refresh());
const place = mountPlaceChoice();      // prompt BH: "A place outside the US or not in the list" (one plain text box instead of the list)

function wireToggle(id, key) {
  const btn = $(id);
  btn.addEventListener("click", () => {
    if (state.busy || state.saved) return;
    state[key] = !state[key];
    btn.classList.toggle("on", state[key]);
    btn.setAttribute("aria-checked", state[key] ? "true" : "false");
    if (key === "recruiter") {
      $("#recruiterPanel").hidden = !state[key];
      // prompt BK: turning the switch off clears the firm names that were typed (nothing is saved yet on this page) and says so next to the switch; turning it on again says nothing
      const said = $("#recruiterCleared");
      if (!state[key] && state.firms && rowsTyped(state.firms.values())) {
        state.firms.reset(); say($("#firmsAlert"), "error", "");
        said.textContent = RECRUITER_CLEARED; said.hidden = false;
        refreshUnsaved();
      } else { said.textContent = ""; said.hidden = true; }
    }
    if (key === "aiFilter") $("#aiFilterNoteRow").hidden = !state[key];
    if (key === "aiInterview") $("#aiInterviewNoteRow").hidden = !state[key];
  });
}
wireToggle("#aiFilterToggle", "aiFilter");
wireToggle("#aiInterviewToggle", "aiInterview");
wireToggle("#recruiterToggle", "recruiter");

const val = (id) => $(id).value;
// what the three link sections hold right now, as typed (the unsaved bar compares it with the blank form)
const rowsNow = () => ({ links: state.links ? state.links.values() : [], firms: state.firms ? state.firms.values() : [], policy: state.policyOn ? val("#policyUrl") : "" });
// the policy address box: judged when the person leaves it (the edit page's rule), the sentence goes away when it is edited
function showPolicyField(msg) { const e = $("#policyError"); e.textContent = msg || ""; e.hidden = !msg; $("#policyUrl").setAttribute("aria-invalid", msg ? "true" : "false"); }
$("#policyUrl").addEventListener("blur", () => { const c = collectPolicy(val("#policyUrl")); showPolicyField(c.used && !c.ok ? c.error : ""); });
$("#policyUrl").addEventListener("input", () => showPolicyField(""));
// "when should it go live": as soon as it is registered (the default) or at a time the employer chooses
const goLater = () => $("#glLater").checked;
function syncGoLive() { $("#glWhen").hidden = !goLater(); registerBtn.textContent = goLater() ? "Add and schedule" : "Add opening"; }
$("#glNow").addEventListener("change", syncGoLive); $("#glLater").addEventListener("change", syncGoLive);
const collect = () => ({ title: val("#jtitle"), req: val("#req"), locEntries: place.outside() ? [] : picker.get().entries, attested: place.outside() ? false : picker.get().attested, outside: place.outside(), locText: place.text(), remote: $("#remote").checked, appcap: val("#appcap"), win: val("#livedays"), closeout: val("#closeout"), desc: val("#desc"),
  aiFilter: state.aiFilter, aiInterview: state.aiInterview, aiFilterNote: val("#aiFilterNote"), aiInterviewNote: val("#aiInterviewNote"), recruiter: state.recruiter, dupAsked: state.dupAsked, dupNote: val("#dupnote"), goLater: goLater(), goLive: val("#gldate") });

function showErrors(byField) {
  for (const el of $$("[data-error-for]")) { const id = el.dataset.errorFor; const msg = byField[id]; el.hidden = !msg; el.textContent = msg || ""; const inp = $("#" + (id === "locpicker" ? "locq" : id)); if (inp) inp.setAttribute("aria-invalid", msg ? "true" : "false"); }
}
// The reused-req prompt: shown when the backend says this company already has a posting with this req number; the explanation is then required and sent with the next attempt. Not a block.
function askWhyReused() {
  state.dupAsked = true; $("#dupPrompt").hidden = false; $("#dupnote").focus();
  say(formAlert, "error", "");
}
function dropReusedPrompt() { state.dupAsked = false; $("#dupPrompt").hidden = true; $("#dupnote").value = ""; showErrors({}); }
$("#dupChange").addEventListener("click", () => { dropReusedPrompt(); $("#req").focus(); });
$("#req").addEventListener("input", () => { if (state.dupAsked) dropReusedPrompt(); });          // the explanation belongs to one req number
function setBusy(on) { state.busy = on; registerBtn.disabled = on; draftBtn.disabled = on; }
function say(box, kind, text) { clear(box); box.hidden = !text; if (text) box.append(alertBox(kind, text)); }

// A session that the server no longer accepts: sign out here and send the employer to sign in again (their work is not lost from the server side: nothing was created).
async function sessionEnded() { await signOut(); rememberNext("register.html", "poster"); go("employer-signin.html?reason=expired"); }

function failureText(err) {
  if (err.code === "rate_limited") return "Too many requests just now. Try again in " + waitText(err.retryAfter || 30) + ".";
  return describeError(err, { what: "That" });
}

async function submit(mode) {
  if (state.busy) return;
  say(formAlert, "error", "");
  const values = collect();
  const problems = validateForm(values);
  showErrors(problems);
  // the link sections are checked BEFORE anything is created, so a mistyped address never leaves a posting half done, and ALL of them are judged together: every box shows its own sentence and one plain
  // list at the bottom names every section that needs fixing (never one section at a time)
  const none = { used: false, ok: true, links: [], rowOf: [], errors: {} };
  const lc = state.links ? collectLinks(state.links.values()) : none;
  const fc = state.firms ? collectFirms(state.firms.values(), state.recruiter) : none;
  const pc = state.policyOn ? collectPolicy(val("#policyUrl")) : { used: false, ok: true };
  if (state.links) { state.links.showErrors(lc.errors); say($("#linksAlert"), "error", ""); }
  if (state.firms) { state.firms.showErrors(fc.errors); say($("#firmsAlert"), "error", ""); }
  showPolicyField(pc.used && !pc.ok ? pc.error : "");
  const lp = linkProblems({ links: lc, firms: fc, policy: pc });
  if (Object.keys(problems).length || !lp.ok) {
    say(formAlert, "error", lp.ok ? "" : lp.text);
    if (Object.keys(problems).length) { const first = Object.keys(problems)[0]; if (first === "locpicker" || first === "attest") picker.focusFor(first); else $("#" + first).focus(); }
    else if (!lc.ok) state.links.focus(lc.errors);
    else if (!fc.ok) state.firms.focus(fc.errors);
    else $("#policyUrl").focus();
    return;
  }
  setBusy(true);
  try {
    // 1. create (a draft)
    const created = await api.createPosting(buildCreateBody(values));
    if (!created.ok) {
      if (isAuthFailure(created.error)) return sessionEnded();
      if (isDuplicateReq(created.error)) { askWhyReused(); return; }
      const m = mapServerErrors(created.error);
      showErrors(m.byField);
      say(formAlert, "error", m.general || (Object.keys(m.byField).length ? "Some fields were not accepted. Nothing was saved." : failureText(created.error)));
      return;
    }
    state.saved = created.data;
    lockForm();
    // prompt BH: a server that does not know the typed place yet answers without it: the result says so, so nobody believes the place was saved
    state.placeProblem = values.outside === true && storedPlaceText(created.data) !== collapsePlaceText(values.locText) ? PLACE_WORDS.NOT_SAVED : null;
    // 2. the destination links, if any were entered: the posting exists now, so a refusal here is reported with the result, never as a failed registration
    // prompt BK: each address is asked once by the server while these calls run (up to about 12 seconds per call when a host is slow), so the person is told what the buttons are waiting for
    const addresses = (lc.used ? lc.links.length : 0) + (fc.used ? fc.links.filter((x) => typeof x.url === "string" && x.url !== "").length : 0) + (pc.used ? 1 : 0);
    if (addresses > 0) { waitWord.textContent = addresses === 1 ? WAIT_ONE : WAIT_MANY; waitWord.hidden = false; }
    if (lc.used && await saveLinks(lc) === "gone") return;
    if (fc.used && await saveFirms(fc) === "gone") return;
    if (pc.used && await savePolicy(pc) === "gone") return;
    waitWord.textContent = ""; waitWord.hidden = true;           // the checks are over
    if (mode === "draft") { showResult(created.data, "draft"); return; }
    // 3. publish now, or schedule the go-live for the time chosen
    if (goLater()) { state.goLiveIso = checkGoLive(val("#gldate"), Date.now()).iso || null; await schedule(); } else await publish();
  } finally {
    waitWord.textContent = ""; waitWord.hidden = true;
    setBusy(false);
  }
}

// -> "saved" | "refused" | "gone" (the session ended: the posting is saved on the server, the person is sent to sign in)
async function saveLinks(lc) {
  const r = await api.setDestinationLinks(state.saved.id, lc.links);
  if (r.ok) { state.linksSaved = r.data.active_links; state.linksAnswer = r.data.links; state.linksProblem = null; return "saved"; }
  if (isAuthFailure(r.error)) { await sessionEnded(); return "gone"; }
  state.linksProblem = mapLinksErrors(r.error, lc.rowOf);
  if (!state.linksProblem.general && !Object.keys(state.linksProblem.rows).length) state.linksProblem.general = failureText(r.error);
  state.links.showErrors(state.linksProblem.rows);
  say($("#linksAlert"), "error", state.linksProblem.general || "The links were not accepted. See the message under the address.");
  return "refused";
}

async function saveFirms(fc) {
  const r = await api.setRecruiterFirms(state.saved.id, fc.links);
  if (r.ok) { state.firmsSaved = r.data.active_links; state.firmsAnswer = r.data.links; state.firmsProblem = null; return "saved"; }
  if (isAuthFailure(r.error)) { await sessionEnded(); return "gone"; }
  state.firmsProblem = mapLinksErrors(r.error, fc.rowOf);
  if (!state.firmsProblem.general && !Object.keys(state.firmsProblem.rows).length) state.firmsProblem.general = failureText(r.error);
  state.firms.showErrors(state.firmsProblem.rows);
  say($("#firmsAlert"), "error", state.firmsProblem.general || "The firms were not accepted. See the message under the firm.");
  return "refused";
}

// the AI and hiring policy link: one more address, saved by its own call right after the opening exists (the same call the edit page's box makes)
async function savePolicy(pc) {
  const r = await api.setPolicyLink(state.saved.id, pc.url);
  if (r.ok) { state.policySaved = r.data; state.policyProblem = null; return "saved"; }
  if (isAuthFailure(r.error)) { await sessionEnded(); return "gone"; }
  const m = mapPolicyError(r.error);
  state.policyProblem = { general: m.field || m.general || failureText(r.error) };
  return "refused";
}

// The link rows (and the recruiter-firm rows) follow the organization's plan (poster-session): verified -> the rows; lapsed -> the paused notice; never verified -> the locked panel; plan unknown -> nothing is promised.
function setupLinks(plan) {
  const notice = planNotice(plan, Date.now());
  $("#firmsLocked").hidden = notice.state === "active";
  $("#firmsForm").hidden = notice.state !== "active";
  if (notice.state === "active") state.firms = mountFirmRowsById({ checkAddress: addressProblem });
  setupLinkRows(notice);
  setupPolicy(plan);
}
// the AI and hiring policy link box is always on the page; on the tier it is a box, otherwise the edit page's own sentence (locked, or the tier ended)
function setupPolicy(plan) {
  const v = policyView({ plan, destination_links: [] }, Date.now());
  $("#policyRow").hidden = planNotice(plan, Date.now()).state === "unknown";      // a plan the server did not state: nothing is promised, the row stays away (as the links section does)
  state.policyOn = v.show === "form";
  $("#policyLocked").hidden = v.show !== "locked";
  $("#policyForm").hidden = v.show !== "form";
  const note = $("#policyNote"); clear(note); note.hidden = true;
  if (v.show === "lapsed") { note.hidden = false; note.append(alertBox("notice", policyLapsedText(v))); }
}
function setupLinkRows(notice) {
  $("#linksSection").hidden = notice.state === "unknown";
  $("#linksLocked").hidden = notice.state !== "locked";
  $("#linksForm").hidden = notice.state !== "active";
  const box = $("#linksPlan"); clear(box); box.hidden = true;
  if (notice.state === "lapsed") { box.hidden = false; box.append(alertBox("notice", "Your destination links tier ended" + (notice.endsAt ? " on " + planDay(notice.endsAt) : "") + ". Destination links are paused until it is renewed; the opening can still be added without them. To renew, write to sales@fightghostjobs.com.")); }
  else if (notice.state === "active" && notice.endsSoon) { box.hidden = false; box.append(alertBox("notice", "Your destination links tier ends on " + planDay(notice.endsAt) + ". After that, destination links are paused (kept, but candidates do not see them) until it is renewed.")); }
  if (notice.state === "active") state.links = mountLinkRowsById({ checkAddress: addressProblem });
}
const planDay = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

async function publish() {
  const r = await api.publishPosting(state.saved.id);
  if (!r.ok) {
    if (isAuthFailure(r.error)) return sessionEnded();
    showResult(state.saved, "publish-failed", failureText(r.error));
    return;
  }
  state.saved = r.data;
  showResult(r.data, r.data.status === "live" ? "live" : "other");
}

async function schedule() {
  const r = await api.schedulePosting(state.saved.id, state.goLiveIso);
  if (!r.ok) {
    if (isAuthFailure(r.error)) return sessionEnded();
    const m = mapScheduleError(r.error);
    showResult(state.saved, "schedule-failed", m.message || failureText(r.error));
    return;
  }
  showResult(state.saved, "scheduled", null, r.data.go_live_at);
}

function lockForm() { for (const el of $$("input, textarea", form)) el.disabled = true; picker.setLocked(true); if (state.links) state.links.setLocked(true); if (state.firms) state.firms.setLocked(true); registerBtn.hidden = true; draftBtn.hidden = true; }
function unlockForm() { for (const el of $$("input, textarea", form)) el.disabled = false; picker.setLocked(false); if (state.links) state.links.setLocked(false); if (state.firms) state.firms.setLocked(false); registerBtn.hidden = false; draftBtn.hidden = false; }

function showResult(p, kind, problem, goLiveAt) {
  result.hidden = false; clear(result);
  const heading = kind === "live" ? "Added. It is live now." : kind === "draft" ? "Saved as a draft" : kind === "scheduled" ? "Added. It is scheduled." : kind === "schedule-failed" ? "Saved as a draft. The go-live time was not set." : kind === "publish-failed" ? "Saved as a draft. Publishing did not finish." : "Added";
  result.append(h("h2", { style: "font-size:22px;font-weight:700;" }, heading));
  if (kind === "publish-failed") {
    result.append(h("div", { style: "margin-top:12px;" }, alertBox("error", problem + " Your opening is saved as a draft; nothing is visible to candidates yet.")),
      h("div", { style: "margin-top:16px;display:flex;gap:12px;" }, h("button", { type: "button", class: "btn btn-dark btn-sm", id: "retryPublish", onclick: async (ev) => { ev.currentTarget.disabled = true; await publish(); } }, "Try publishing again")));
  }
  if (kind === "schedule-failed") {
    result.append(h("div", { style: "margin-top:12px;" }, alertBox("error", problem + " Your opening is saved as a draft; nothing is visible to candidates yet. You can set the time again from My openings (Edit), or publish it.")),
      h("div", { style: "margin-top:16px;display:flex;gap:12px;" }, h("button", { type: "button", class: "btn btn-dark btn-sm", id: "retrySchedule", onclick: async (ev) => { ev.currentTarget.disabled = true; await schedule(); } }, "Try scheduling again")));
  }
  const rows = [["Title", p.title], ["Status", kind === "scheduled" ? "Scheduled" : p.status]];
  if (kind === "scheduled") rows.push(["Goes live", fmtClose(goLiveAt) + " (within 15 minutes after that time)"]);
  if (kind === "live" || kind === "other") rows.push(["Closes", fmtClose(p.expiration_date)]);
  if (typeof state.linksSaved === "number") rows.push(["Destination links", String(state.linksSaved)]);
  result.append(h("dl", { style: "margin:18px 0 0 0;display:grid;grid-template-columns:auto 1fr;gap:8px 18px;font-size:14px;" },
    rows.flatMap(([k, v]) => [h("dt", { style: "color:var(--faint);font-weight:600;" }, k), h("dd", { style: "margin:0;" }, v)])));
  const lo = linksOutcome(state.linksSaved, state.linksProblem, null);
  if (lo) result.append(h("div", { style: "margin-top:12px;" }, alertBox(lo.kind, lo.text)));
  const fo = firmsOutcome(state.firmsSaved, state.firmsProblem);
  if (fo) result.append(h("div", { style: "margin-top:12px;" }, alertBox(fo.kind, fo.text)));
  const po = policyOutcome(state.policySaved, state.policyProblem);
  if (po) result.append(h("div", { style: "margin-top:12px;", id: "policyOutcome" }, alertBox(po.kind, po.text)));
  // what the address check found, for every address that did not answer, in ONE sentence (they are saved anyway)
  const cr = checkReport({ links: state.linksAnswer, firms: state.firmsAnswer });      // the policy link has its own words above (prompt BK)
  if (cr) result.append(h("div", { style: "margin-top:12px;", id: "checkReport" }, alertBox(cr.kind, cr.text)));
  if (state.placeProblem) result.append(h("div", { style: "margin-top:12px;", id: "placeProblem" }, alertBox("error", state.placeProblem)));
  result.append(h("div", { style: "margin-top:20px;" },
    h("div", { style: "font-size:13px;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;" }, "Your KIO ID"),
    // prompt BQ: the ID, its short link and the lines for a job ad, each with a copy button (js/kio-block.js); the ID keeps the big "code-box" look it has always had here
    kioBlock(p.public_code, { idClass: "code-box" }),
    h("p", { style: "font-size:13px;line-height:1.6;color:var(--muted);margin:12px 0 0 0;" }, "Candidates can look this opening up with its ID alone, or with your company name plus the job title. The whole ID is shown to them.")));
  if (kind === "scheduled") result.append(h("div", { style: "margin-top:16px;" }, alertBox("notice", "Nothing is visible to candidates until it goes live. Its " + (p.window_days || 45) + "-day window is counted from the moment it actually goes live. You can change the time, remove it or publish it now from My openings.")));
  if (kind === "draft") result.append(h("div", { style: "margin-top:16px;" }, alertBox("notice", "Nothing is visible to candidates yet. Open My openings to publish it: a draft can be published for 14 days after it was added, and the opening window starts when you publish.")));
  const actions = h("div", { style: "margin-top:22px;display:flex;gap:12px;flex-wrap:wrap;" });
  if (kind === "live") actions.append(h("a", { class: "btn btn-dark btn-sm", href: "search.html" }, "Look it up as a candidate →"));
  actions.append(h("a", { class: "btn btn-outline btn-sm", href: "dashboard.html" }, "View my openings"));
  actions.append(h("button", { type: "button", class: "btn btn-outline btn-sm", onclick: registerAnother }, "Add another opening"));
  result.append(actions);
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function registerAnother() { resetForm(); unlockForm(); $("#jtitle").focus(); refreshUnsaved(); }
function resetForm() {
  state.saved = null; result.hidden = true; clear(result);
  for (const id of ["#jtitle", "#req", "#appcap", "#closeout", "#desc", "#aiFilterNote", "#aiInterviewNote", "#policyUrl", "#gldate"]) $(id).value = "";
  showPolicyField("");
  $("#glNow").checked = true; $("#glLater").checked = false; syncGoLive();
  $("#aiFilterNoteRow").hidden = true; $("#aiInterviewNoteRow").hidden = true;
  picker.reset(); place.reset();
  $("#livedays").value = "45";
  $("#remote").checked = false;
  for (const [id, key] of [["#aiFilterToggle", "aiFilter"], ["#aiInterviewToggle", "aiInterview"], ["#recruiterToggle", "recruiter"]]) { state[key] = false; $(id).classList.remove("on"); $(id).setAttribute("aria-checked", "false"); }
  $("#recruiterPanel").hidden = true;
  $("#recruiterCleared").hidden = true; $("#recruiterCleared").textContent = "";
  state.linksSaved = null; state.linksAnswer = null; state.linksProblem = null; if (state.links) { state.links.reset(); say($("#linksAlert"), "error", ""); }
  state.firmsSaved = null; state.firmsProblem = null; state.firmsAnswer = null; if (state.firms) { state.firms.reset(); say($("#firmsAlert"), "error", ""); }
  state.policySaved = null; state.policyProblem = null;
  state.placeProblem = null;
  dropReusedPrompt(); say(formAlert, "error", "");
  state.baseline = registerSnapshot(collect(), rowsNow());
}

form.addEventListener("submit", (ev) => { ev.preventDefault(); submit("register"); });
draftBtn.addEventListener("click", () => submit("draft"));

// ---- unsaved work (js/dirty-state.js decides and words it; js/unsaved-guard.js shows the bar, asks before the page is left and holds the dialog). Nothing is on the server until Add opening or Save draft,
// so everything typed counts; once the opening exists the form is locked and nothing is unsaved.
const SECTIONS = () => { const r = rowsNow(), out = []; if (rowsTyped(r.links)) out.push("destination links"); if (rowsTyped(r.firms)) out.push("recruiter firms"); if (r.policy.trim() !== "") out.push("AI and hiring policy link"); return out; };
function unsavedModel() {
  if (state.baseline === null || state.saved) return { dirty: false, sections: [] };
  return { dirty: registerSnapshot(collect(), rowsNow()) !== state.baseline, sections: SECTIONS() };
}
function refreshUnsaved() { for (const x of limitHints) x.refresh(); if (state.guard) state.guard.refresh(); }      // the counts follow a value a script put in a box (Discard, Add another opening)
const toNext = (url) => go(url);
state.guard = mountUnsavedGuard({
  win: window, root: document.documentElement,
  bar: $("#unsavedBar"), head: $("#unsavedHead"), detail: $("#unsavedDetail"), live: $("#unsavedLive"), saveBtn: $("#unsavedSave"), discardBtn: $("#unsavedDiscard"), skip: $("#skipToUnsaved"),
  dlg: { overlay: $("#leaveOverlay"), title: $("#leaveTitle"), text: $("#leaveText"), save: $("#leaveSave"), discard: $("#leaveDiscard"), stay: $("#leaveStay") },
  getModel: unsavedModel, summarize: summarizeRegister,
  save: async () => { await submit("draft"); return state.saved !== null; },        // the bar and the dialog keep it as a draft (nothing goes live from a leave prompt)
  discard: () => { state.guard.hush(true); try { resetForm(); unlockForm(); showErrors({}); } finally { state.guard.hush(false); } state.guard.refresh(); state.guard.announce(REGISTER_UNSAVED.DISCARDED); },
  go: toNext,
  activeElement: () => document.activeElement, confirmDiscard: () => window.confirm(REGISTER_UNSAVED.CONFIRM_DISCARD), rescueFocus: () => $("#jtitle").focus(),
});
for (const ev of ["input", "change", "click", "keyup"]) document.addEventListener(ev, () => refreshUnsaved());
// a click on a link of this page that leaves it, or on Sign out, is held back while something is unsaved
document.addEventListener("click", (ev) => {
  const el = ev.target && ev.target.closest ? ev.target : null;
  if (!el) return;
  const a = el.closest("a[href]");
  if (a) { state.guard.interceptClick(ev, { kind: "link", href: a.getAttribute("href"), target: a.getAttribute("target"), download: a.hasAttribute("download"), el: a }); return; }
  const out = el.closest("#navAccount button:not(.avatar-btn)");
  if (out) state.guard.interceptClick(ev, { kind: "button", el: out });
}, true);

(async () => {
  const ctx = await requirePoster("register.html");
  if (!ctx) return;
  await mountAccount($("#navAccount"), { cta: false });
  if (!ctx.info) { say(pageAlert, "error", describeError(ctx.error) + " Reload the page to try again."); setBusy(true); return; }
  $("#orgName").textContent = ctx.info.organization.name;
  $("#companyShown").textContent = ctx.info.organization.name;   // read only: the server takes the company name from the organization and ignores any in the request
  setupLinks(ctx.info.plan);
  state.baseline = registerSnapshot(collect(), rowsNow());     // the blank form the page starts as: what is "unsaved" is measured from here
  refreshUnsaved();
})();
