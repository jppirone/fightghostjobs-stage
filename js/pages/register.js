// register.js - an employer registers a posting: create it (a draft), then publish it (standard tier goes live immediately).
// "Save draft" stops after the first step. Nothing here trusts the page for identity: the session token tells the server who is acting.

import { api, requirePoster, mountAccount, go, signOut, describeError, isAuthFailure } from "../app.js";
import { rememberNext } from "../session.js";
import { $, $$, h, clear, alertBox } from "../dom.js";
import { fmtClose, groupCode, waitText } from "../format.js";
import { validateForm, buildCreateBody, mapServerErrors } from "../register-form.js";

const state = { aiFilter: false, aiInterview: false, recruiter: false, saved: null, busy: false };
const form = $("#form"), result = $("#result"), pageAlert = $("#pageAlert"), formAlert = $("#formAlert");
const registerBtn = $("#registerBtn"), draftBtn = $("#draftBtn");

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
const collect = () => ({ title: val("#jtitle"), req: val("#req"), company: val("#company"), loc: val("#loc"), remote: $("#remote").checked, appcap: val("#appcap"), win: val("#livedays"), closeout: val("#closeout"), desc: val("#desc"),
  aiFilter: state.aiFilter, aiInterview: state.aiInterview, recruiter: state.recruiter });

function showErrors(byField) {
  for (const el of $$("[data-error-for]")) { const id = el.dataset.errorFor; const msg = byField[id]; el.hidden = !msg; el.textContent = msg || ""; const inp = $("#" + id); if (inp) inp.setAttribute("aria-invalid", msg ? "true" : "false"); }
}
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
  if (Object.keys(problems).length) { const first = Object.keys(problems)[0]; $("#" + first).focus(); return; }
  setBusy(true);
  try {
    // 1. create (a draft)
    const created = await api.createPosting(buildCreateBody(values));
    if (!created.ok) {
      if (isAuthFailure(created.error)) return sessionEnded();
      const m = mapServerErrors(created.error);
      showErrors(m.byField);
      say(formAlert, "error", m.general || (Object.keys(m.byField).length ? "Some fields were not accepted. Nothing was saved." : failureText(created.error)));
      return;
    }
    state.saved = created.data;
    lockForm();
    if (mode === "draft") { showResult(created.data, "draft"); return; }
    // 2. publish
    await publish();
  } finally {
    setBusy(false);
  }
}

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

function lockForm() { for (const el of $$("input, textarea", form)) el.disabled = true; registerBtn.hidden = true; draftBtn.hidden = true; }
function unlockForm() { for (const el of $$("input, textarea", form)) el.disabled = false; registerBtn.hidden = false; draftBtn.hidden = false; }

function showResult(p, kind, problem) {
  result.hidden = false; clear(result);
  const heading = kind === "live" ? "Registered — live now" : kind === "draft" ? "Saved as a draft" : kind === "publish-failed" ? "Saved as a draft — publishing did not finish" : "Registered";
  result.append(h("h2", { style: "font-size:22px;font-weight:700;" }, heading));
  if (kind === "publish-failed") {
    result.append(h("div", { style: "margin-top:12px;" }, alertBox("error", problem + " Your posting is saved as a draft; nothing is visible to candidates yet.")),
      h("div", { style: "margin-top:16px;display:flex;gap:12px;" }, h("button", { type: "button", class: "btn btn-dark btn-sm", id: "retryPublish", onclick: async (ev) => { ev.currentTarget.disabled = true; await publish(); } }, "Try publishing again")));
  }
  const rows = [["Title", p.title], ["Status", p.status]];
  if (kind === "live" || kind === "other") rows.push(["Closes", fmtClose(p.expiration_date)]);
  result.append(h("dl", { style: "margin:18px 0 0 0;display:grid;grid-template-columns:auto 1fr;gap:8px 18px;font-size:14px;" },
    rows.flatMap(([k, v]) => [h("dt", { style: "color:var(--faint);font-weight:600;" }, k), h("dd", { style: "margin:0;" }, v)])));
  result.append(h("div", { style: "margin-top:20px;" },
    h("div", { style: "font-size:13px;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;" }, "Your req code"),
    h("span", { class: "code-box", id: "publicCode" }, groupCode(p.public_code)),
    h("p", { style: "font-size:13px;line-height:1.6;color:var(--muted);margin:12px 0 0 0;" }, "Candidates find this posting by your company name plus either the job title or this code. They only ever see the last four characters of it.")));
  const actions = h("div", { style: "margin-top:22px;display:flex;gap:12px;flex-wrap:wrap;" });
  if (kind === "live") actions.append(h("a", { class: "btn btn-dark btn-sm", href: "search.html" }, "Look it up as a candidate →"));
  actions.append(h("button", { type: "button", class: "btn btn-outline btn-sm", onclick: registerAnother }, "Register another posting"));
  result.append(actions);
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function registerAnother() {
  state.saved = null; result.hidden = true; clear(result);
  for (const id of ["#jtitle", "#req", "#loc", "#appcap", "#closeout", "#desc"]) $(id).value = "";
  $("#livedays").value = "45";
  $("#remote").checked = false;
  for (const [id, key] of [["#aiFilterToggle", "aiFilter"], ["#aiInterviewToggle", "aiInterview"], ["#recruiterToggle", "recruiter"]]) { state[key] = false; $(id).classList.remove("on"); $(id).setAttribute("aria-checked", "false"); }
  $("#recruiterPanel").style.display = "none";
  showErrors({}); say(formAlert, "error", "");
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
})();
