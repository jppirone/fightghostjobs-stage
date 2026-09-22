// register.js - an employer registers a posting: create it (a draft), then publish it (standard tier goes live immediately).
// "Save draft" stops after the first step: the draft is then found and published from My postings (dashboard.html). Nothing here trusts the page for identity: the session token tells the server who is acting.

import { api, requirePoster, mountAccount, go, signOut, describeError, isAuthFailure } from "../app.js";
import { rememberNext } from "../session.js";
import { $, $$, h, clear, alertBox } from "../dom.js";
import { fmtClose, groupCode, waitText } from "../format.js";
import { checkGoLive, mapScheduleError } from "../schedule-form.js";
import { validateForm, buildCreateBody, mapServerErrors, isDuplicateReq, collectLinks, linksOutcome } from "../register-form.js";
import { mapLinksErrors, planNotice, checkWarnings } from "../edit-form.js";
import { mountLinkRowsById } from "../link-rows.js";
import { mountLocationPicker } from "../location-picker.js";
import { wireInfoIcons } from "../info-icon.js";

wireInfoIcons();
// links: the destination-link rows, mounted only when the organization's plan allows links (null otherwise); linksSaved / linksProblem: what happened to them after the posting was created
const state = { aiFilter: false, aiInterview: false, recruiter: false, saved: null, busy: false, dupAsked: false, goLiveIso: null, links: null, linksSaved: null, linksProblem: null };
const form = $("#form"), result = $("#result"), pageAlert = $("#pageAlert"), formAlert = $("#formAlert");
const registerBtn = $("#registerBtn"), draftBtn = $("#draftBtn");
const picker = mountLocationPicker({ isRemote: () => $("#remote").checked });
$("#remote").addEventListener("change", () => picker.refresh());

function wireToggle(id, key) {
  const btn = $(id);
  btn.addEventListener("click", () => {
    if (state.busy || state.saved) return;
    state[key] = !state[key];
    btn.classList.toggle("on", state[key]);
    btn.setAttribute("aria-checked", state[key] ? "true" : "false");
    if (key === "recruiter") $("#recruiterPanel").style.display = state[key] ? "flex" : "none";
  });
}
wireToggle("#aiFilterToggle", "aiFilter");
wireToggle("#aiInterviewToggle", "aiInterview");
wireToggle("#recruiterToggle", "recruiter");

const val = (id) => $(id).value;
// "when should it go live": as soon as it is registered (the default) or at a time the employer chooses
const goLater = () => $("#glLater").checked;
function syncGoLive() { $("#glWhen").hidden = !goLater(); registerBtn.textContent = goLater() ? "Register and schedule" : "Register posting"; }
$("#glNow").addEventListener("change", syncGoLive); $("#glLater").addEventListener("change", syncGoLive);
const collect = () => ({ title: val("#jtitle"), req: val("#req"), company: val("#company"), locEntries: picker.get().entries, attested: picker.get().attested, remote: $("#remote").checked, appcap: val("#appcap"), win: val("#livedays"), closeout: val("#closeout"), desc: val("#desc"),
  aiFilter: state.aiFilter, aiInterview: state.aiInterview, recruiter: state.recruiter, dupAsked: state.dupAsked, dupNote: val("#dupnote"), goLater: goLater(), goLive: val("#gldate") });

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
  if (Object.keys(problems).length) { const first = Object.keys(problems)[0]; if (first === "locpicker" || first === "attest") picker.focusFor(first); else $("#" + first).focus(); return; }
  // the link rows are checked BEFORE anything is created, so a mistyped address never leaves a posting half done
  const lc = state.links ? collectLinks(state.links.values()) : { used: false, ok: true, links: [], rowOf: [], errors: {} };
  if (state.links) { state.links.showErrors(lc.errors); say($("#linksAlert"), "error", lc.ok ? "" : lc.form || "Nothing was saved. See the message under the address."); }
  if (!lc.ok) { state.links.focus(lc.errors); return; }
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
    // 2. the destination links, if any were entered: the posting exists now, so a refusal here is reported with the result, never as a failed registration
    if (lc.used && await saveLinks(lc) === "gone") return;
    if (mode === "draft") { showResult(created.data, "draft"); return; }
    // 3. publish now, or schedule the go-live for the time chosen
    if (goLater()) { state.goLiveIso = checkGoLive(val("#gldate"), Date.now()).iso || null; await schedule(); } else await publish();
  } finally {
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

// The link rows follow the organization's plan (poster-session): verified -> the rows; lapsed -> the paused notice; never verified -> the locked panel; plan unknown -> nothing is promised.
function setupLinks(plan) {
  const notice = planNotice(plan, Date.now());
  $("#linksSection").hidden = notice.state === "unknown";
  $("#linksLocked").hidden = notice.state !== "locked";
  $("#linksForm").hidden = notice.state !== "active";
  const box = $("#linksPlan"); clear(box); box.hidden = true;
  if (notice.state === "lapsed") { box.hidden = false; box.append(alertBox("notice", "Your verified plan ended" + (notice.endsAt ? " on " + planDay(notice.endsAt) : "") + ". Destination links are paused until it is renewed; the posting can still be registered without them. To renew, write to sales@fightghostjobs.com.")); }
  else if (notice.state === "active" && notice.endsSoon) { box.hidden = false; box.append(alertBox("notice", "Your verified plan ends on " + planDay(notice.endsAt) + ". After that, destination links are paused (kept, but candidates do not see them) until it is renewed.")); }
  if (notice.state === "active") state.links = mountLinkRowsById();
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

function lockForm() { for (const el of $$("input, textarea", form)) el.disabled = true; picker.setLocked(true); if (state.links) state.links.setLocked(true); registerBtn.hidden = true; draftBtn.hidden = true; }
function unlockForm() { for (const el of $$("input, textarea", form)) el.disabled = false; picker.setLocked(false); if (state.links) state.links.setLocked(false); registerBtn.hidden = false; draftBtn.hidden = false; }

function showResult(p, kind, problem, goLiveAt) {
  result.hidden = false; clear(result);
  const heading = kind === "live" ? "Registered — live now" : kind === "draft" ? "Saved as a draft" : kind === "scheduled" ? "Registered — scheduled" : kind === "schedule-failed" ? "Saved as a draft — the go-live time was not set" : kind === "publish-failed" ? "Saved as a draft — publishing did not finish" : "Registered";
  result.append(h("h2", { style: "font-size:22px;font-weight:700;" }, heading));
  if (kind === "publish-failed") {
    result.append(h("div", { style: "margin-top:12px;" }, alertBox("error", problem + " Your posting is saved as a draft; nothing is visible to candidates yet.")),
      h("div", { style: "margin-top:16px;display:flex;gap:12px;" }, h("button", { type: "button", class: "btn btn-dark btn-sm", id: "retryPublish", onclick: async (ev) => { ev.currentTarget.disabled = true; await publish(); } }, "Try publishing again")));
  }
  if (kind === "schedule-failed") {
    result.append(h("div", { style: "margin-top:12px;" }, alertBox("error", problem + " Your posting is saved as a draft; nothing is visible to candidates yet. You can set the time again from My postings (Edit), or publish it.")),
      h("div", { style: "margin-top:16px;display:flex;gap:12px;" }, h("button", { type: "button", class: "btn btn-dark btn-sm", id: "retrySchedule", onclick: async (ev) => { ev.currentTarget.disabled = true; await schedule(); } }, "Try scheduling again")));
  }
  const rows = [["Title", p.title], ["Status", kind === "scheduled" ? "Scheduled" : p.status]];
  if (kind === "scheduled") rows.push(["Goes live", fmtClose(goLiveAt) + " (within 15 minutes after that time)"]);
  if (kind === "live" || kind === "other") rows.push(["Closes", fmtClose(p.expiration_date)]);
  if (typeof state.linksSaved === "number") rows.push(["Destination links", String(state.linksSaved)]);
  result.append(h("dl", { style: "margin:18px 0 0 0;display:grid;grid-template-columns:auto 1fr;gap:8px 18px;font-size:14px;" },
    rows.flatMap(([k, v]) => [h("dt", { style: "color:var(--faint);font-weight:600;" }, k), h("dd", { style: "margin:0;" }, v)])));
  const lo = linksOutcome(state.linksSaved, state.linksProblem, checkWarnings(state.linksAnswer));
  if (lo) result.append(h("div", { style: "margin-top:12px;" }, alertBox(lo.kind, lo.text)));
  result.append(h("div", { style: "margin-top:20px;" },
    h("div", { style: "font-size:13px;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;" }, "Your postID"),
    h("span", { class: "code-box", id: "postId" }, groupCode(p.public_code)),
    h("p", { style: "font-size:13px;line-height:1.6;color:var(--muted);margin:12px 0 0 0;" }, "Candidates find this posting by your company name plus either the job title or this postID. They only ever see the last four characters of it.")));
  if (kind === "scheduled") result.append(h("div", { style: "margin-top:16px;" }, alertBox("notice", "Nothing is visible to candidates until it goes live. Its " + (p.window_days || 45) + "-day window is counted from the moment it actually goes live. You can change the time, remove it or publish it now from My postings.")));
  if (kind === "draft") result.append(h("div", { style: "margin-top:16px;" }, alertBox("notice", "Nothing is visible to candidates yet. Open My postings to publish it: a draft can be published for 14 days after it was saved, and the posting window starts when you publish.")));
  const actions = h("div", { style: "margin-top:22px;display:flex;gap:12px;flex-wrap:wrap;" });
  if (kind === "live") actions.append(h("a", { class: "btn btn-dark btn-sm", href: "search.html" }, "Look it up as a candidate →"));
  actions.append(h("a", { class: "btn btn-outline btn-sm", href: "dashboard.html" }, "View my postings"));
  actions.append(h("button", { type: "button", class: "btn btn-outline btn-sm", onclick: registerAnother }, "Register another posting"));
  result.append(actions);
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function registerAnother() {
  state.saved = null; result.hidden = true; clear(result);
  for (const id of ["#jtitle", "#req", "#appcap", "#closeout", "#desc"]) $(id).value = "";
  picker.reset();
  $("#livedays").value = "45";
  $("#remote").checked = false;
  for (const [id, key] of [["#aiFilterToggle", "aiFilter"], ["#aiInterviewToggle", "aiInterview"], ["#recruiterToggle", "recruiter"]]) { state[key] = false; $(id).classList.remove("on"); $(id).setAttribute("aria-checked", "false"); }
  $("#recruiterPanel").style.display = "none";
  state.linksSaved = null; state.linksAnswer = null; state.linksProblem = null; if (state.links) { state.links.reset(); say($("#linksAlert"), "error", ""); }
  dropReusedPrompt(); say(formAlert, "error", "");
  unlockForm(); $("#jtitle").focus();
}

form.addEventListener("submit", (ev) => { ev.preventDefault(); submit("register"); });
draftBtn.addEventListener("click", () => submit("draft"));

(async () => {
  const ctx = await requirePoster("register.html");
  if (!ctx) return;
  await mountAccount($("#navAccount"), { cta: false });
  if (!ctx.info) { say(pageAlert, "error", describeError(ctx.error) + " Reload the page to try again."); setBusy(true); return; }
  $("#orgName").textContent = ctx.info.organization.name;
  $("#company").value = ctx.info.organization.name;
  setupLinks(ctx.info.plan);
})();
