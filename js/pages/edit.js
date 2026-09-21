// edit.js - an employer edits a posting they own: the form starts from what get-my-posting returns, only what CHANGED is sent to edit-posting, and every edit of a posting that is not a draft carries a change note.
// The server judges the rest (how much of the requirements text is kept, the location rule, duplicate req numbers) and this page shows its answer in words. Nothing here trusts the page for identity: the session token tells the server who is acting.

import { api, requirePoster, mountAccount, go, signOut, describeError, isAuthFailure } from "../app.js";
import { rememberNext } from "../session.js";
import { $, $$, h, clear, alertBox } from "../dom.js";
import { fmtClose, fmtStamp, waitText } from "../format.js";
import { statusChip } from "../dashboard-model.js";
import { checkEdit, mapEditErrors, KIND_TEXT, checkLinks, mapLinksErrors, planNotice, MAX_LINKS, MAX_URL, MAX_LABEL } from "../edit-form.js";
import { mountLocationPicker } from "../location-picker.js";
import { loadCatalog } from "../location-catalog.js";

const postingId = new URLSearchParams(location.search).get("id") || "";
const state = { orig: null, aiFilter: null, aiInterview: null, recruiter: false, exclusive: false, plan: null, busy: false, needNote: false, linksBusy: false, linkRowOf: [] };
const form = $("#form"), pageAlert = $("#pageAlert"), formAlert = $("#formAlert"), saveBtn = $("#saveBtn");
const picker = mountLocationPicker({ isRemote: () => $("#remote").checked });
$("#remote").addEventListener("change", () => picker.refresh());

const val = (id) => $(id).value;
function say(box, kind, text) { clear(box); box.hidden = !text; if (text) box.append(alertBox(kind, text)); }
function showErrors(byField) {
  for (const el of $$("[data-error-for]")) { const id = el.dataset.errorFor; const msg = byField[id]; el.hidden = !msg; el.textContent = msg || ""; const inp = $("#" + (id === "locpicker" ? "locq" : id)); if (inp) inp.setAttribute("aria-invalid", msg ? "true" : "false"); }
}
function setBusy(on) { state.busy = on; saveBtn.disabled = on; }
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
  });
}
wireToggle("#aiFilterToggle", "aiFilter"); wireToggle("#aiInterviewToggle", "aiInterview"); wireToggle("#recruiterToggle", "recruiter"); wireToggle("#exclusiveToggle", "exclusive");
const planActive = () => !!state.plan && state.plan.verified === true;

const collect = () => ({ title: val("#jtitle"), req: val("#req"), desc: val("#desc"), locEntries: picker.get().entries, attested: picker.get().attested, remote: $("#remote").checked, appcap: val("#appcap"),
  aiFilter: state.aiFilter, aiInterview: state.aiInterview, recruiter: state.recruiter, exclusive: planActive() ? state.exclusive : undefined, note: val("#note") });

// the catalog entries for the stored ids (a place the catalog no longer has still shows, by the display text the database stored)
async function entriesFor(p) {
  let catalog = null;
  try { catalog = await loadCatalog(); } catch { /* the fallback below still shows the stored names */ }
  const byId = new Map(catalog && catalog.entries ? catalog.entries.map((e) => [e.id, e]) : []);
  return p.location_ids.map((id, i) => byId.get(id) || { id, kind: "place", display: p.locations[i] || id });
}

function noteLabel(isDraft) {
  $("#noteLabel").textContent = isDraft && !state.needNote ? "What changed, and why? (optional on a draft; kept with the posting)." : "What changed, and why? (required; kept with the posting).";
}

function renderChanges(list) {
  const card = $("#changesCard"), ul = $("#changesList"); clear(ul);
  card.hidden = list.length === 0;
  for (const c of list) ul.append(h("li", {}, h("div", { style: "font-weight:600;" }, KIND_TEXT[c.kind] || "Edit", h("span", { style: "font-weight:400;color:var(--muted);" }, " · " + fmtStamp(c.at))), h("div", { style: "color:#4A453F;margin-top:2px;overflow-wrap:anywhere;" }, c.note)));
}

// ---- destination links: shown only for a posting that can be edited; a verified plan gets the form, a lapsed one a notice, anyone else the sales note
const planDay = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const linkRows = [];   // the row inputs: [{ u, l, ue, le }]
function addLinkRow(url, label) {
  const i = linkRows.length, host = $("#linkRows");
  const u = h("input", { type: "text", inputmode: "url", maxlength: MAX_URL, autocomplete: "off", spellcheck: "false", "aria-label": "Destination address " + (i + 1), placeholder: "Address, starting with https://" });
  const l = h("input", { type: "text", maxlength: MAX_LABEL, autocomplete: "off", "aria-label": "Label for link " + (i + 1) + " (optional)", placeholder: "Label (optional)" });
  const ue = h("div", { class: "field-error", hidden: true }), le = h("div", { class: "field-error", hidden: true });
  u.value = url || ""; l.value = label || "";
  host.append(h("div", { style: "display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:12px;" }, h("div", {}, u, ue), h("div", {}, l, le)));
  linkRows.push({ u, l, ue, le });
  $("#addLinkBtn").disabled = linkRows.length >= MAX_LINKS;
}
function resetLinkRows() { clear($("#linkRows")); linkRows.length = 0; addLinkRow(); $("#addLinkBtn").disabled = false; }
function showLinkErrors(byRow) {
  linkRows.forEach((r, i) => {
    const e = byRow[i] || {};
    for (const [inp, box, key] of [[r.u, r.ue, "url"], [r.l, r.le, "label"]]) { box.hidden = !e[key]; box.textContent = e[key] || ""; inp.setAttribute("aria-invalid", e[key] ? "true" : "false"); }
  });
}
function renderLinks(doc, editable) {
  const card = $("#linksCard"); card.hidden = !editable; if (!editable) return;
  const notice = planNotice(doc.plan, Date.now()), plan = $("#linksPlan"); clear(plan); plan.hidden = true;
  $("#linksLocked").hidden = notice.state === "active" || notice.state === "lapsed";
  $("#linksForm").hidden = notice.state !== "active";
  $("#exclusiveRow").hidden = notice.state !== "active";
  if (notice.state === "lapsed") {
    plan.hidden = false;
    plan.append(alertBox("notice", "Your verified plan ended" + (notice.endsAt ? " on " + planDay(notice.endsAt) : "") + ". Destination links are paused: candidates do not see them, and no one is sent to them. " + (doc.destination_links.length ? "The " + doc.destination_links.length + " you saved are kept and return as soon as your plan is renewed. " : "") + "To renew, write to sales@fightghostjobs.com."));
    $("#linksLocked").hidden = true;
  } else if (notice.state === "active" && notice.endsSoon) {
    plan.hidden = false; plan.append(alertBox("notice", "Your verified plan ends on " + planDay(notice.endsAt) + ". After that, destination links are paused (kept, but candidates do not see them) until it is renewed. To renew, write to sales@fightghostjobs.com."));
  }
  const stored = $("#linksStored"); clear(stored);
  if (notice.state === "active") {
    const n = doc.destination_links.length;
    stored.append(n === 0 ? "No destination links are stored for this posting yet." : h("span", {}, h("strong", {}, n === 1 ? "1 link is stored" : n + " links are stored"), ": ", doc.destination_links.map((x) => x.position + ". " + (x.label || "Application link " + x.position)).join(", "), "."));
    if (!state.linksBusy) resetLinkRows();
  }
}

async function populate(doc) {
  const p = doc.posting; state.orig = p;
  state.aiFilter = p.ai_filtering; state.aiInterview = p.ai_interview_other; state.recruiter = p.third_party_recruiter; state.needNote = false;
  state.plan = doc.plan; state.exclusive = p.destination_links_exclusive === true; setToggle("#exclusiveToggle", state.exclusive);
  $("#jtitle").value = p.title; $("#req").value = p.req_number || ""; $("#desc").value = p.description_text; $("#appcap").value = p.applicant_cap === null ? "" : String(p.applicant_cap);
  $("#remote").checked = p.is_remote; $("#companyShown").textContent = p.company_name; $("#note").value = "";
  setToggle("#aiFilterToggle", p.ai_filtering === true); setToggle("#aiInterviewToggle", p.ai_interview_other === true); setToggle("#recruiterToggle", p.third_party_recruiter);
  $("#aiFilterNote").textContent = p.ai_filtering === null ? "Not stated yet. Once you state it, it can be changed but not cleared." : "Shown to candidates as a plain fact, never scored.";
  $("#aiInterviewNote").textContent = p.ai_interview_other === null ? "Not stated yet. Once you state it, it can be changed but not cleared." : "Independent of filtering — an employer can have neither, either, or both on.";
  const chip = statusChip(p, Date.now());
  const line = $("#statusLine"); line.hidden = false; clear(line);
  line.append(h("span", { class: "status " + chip.cls }, chip.text), " ", p.stored_status === "draft" ? "Not visible to candidates yet." : (p.status === "live" || p.status === "paused") && p.expiration_date ? "Closes " + fmtClose(p.expiration_date) + "." : "");
  noteLabel(p.stored_status === "draft");
  renderChanges(doc.recent_changes);
  picker.set(await entriesFor(p), p.locations_attested);
  const editable = p.stored_status === "draft" || ((p.stored_status === "live" || p.stored_status === "paused") && p.status === p.stored_status);
  form.hidden = !editable;
  renderLinks(doc, editable);
  const ro = $("#readonlyNote"); ro.hidden = editable; clear(ro);
  if (!editable) {
    const why = p.stored_status === "flagged" ? "This posting is held for review, so it cannot be edited right now."
      : p.status === "expired" ? "This posting has expired. An expired or closed posting is the public record of what was advertised, so it cannot be edited."
      : "This posting is " + p.status + ". An expired or closed posting is the public record of what was advertised, so it cannot be edited.";
    ro.append(h("p", { style: "font-size:15px;line-height:1.6;" }, why), h("div", { style: "margin-top:16px;" }, h("a", { class: "btn btn-outline btn-sm", href: "dashboard.html" }, "Back to My postings")));
  }
}

async function load() {
  say(pageAlert, "error", "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postingId)) { say(pageAlert, "error", "This page needs a posting: open it from My postings."); return false; }
  const r = await api.getMyPosting(postingId);
  if (!r.ok) {
    if (isAuthFailure(r.error)) { await sessionEnded(); return false; }
    if (r.error.code === "not_found") { say(pageAlert, "error", "That posting was not found. The link may be wrong, or the posting may belong to a colleague."); return false; }
    say(pageAlert, "error", failureText(r.error) + " Reload the page to try again."); return false;
  }
  await populate(r.data); return true;
}

async function submit() {
  if (state.busy || !state.orig) return;
  say(formAlert, "error", "");
  const check = checkEdit(state.orig, collect());
  showErrors(check.errors);
  if (!check.body) {
    if (check.errors.form) { say(formAlert, "notice", check.errors.form + " Change something, then save."); return; }
    const first = ["jtitle", "req", "locpicker", "attest", "appcap", "desc", "note"].find((k) => check.errors[k]);
    if (first === "locpicker" || first === "attest") picker.focusFor(first); else if (first) $("#" + first).focus();
    return;
  }
  setBusy(true);
  try {
    const r = await api.editPosting(check.body);
    if (!r.ok) {
      if (isAuthFailure(r.error)) return sessionEnded();
      const m = mapEditErrors(r.error);
      if (m.needNote) { state.needNote = true; noteLabel(state.orig.stored_status === "draft"); }
      showErrors(m.byField);
      say(formAlert, "error", m.general || (Object.keys(m.byField).length ? "Nothing was saved. See the message under the field." : failureText(r.error)));
      if (m.newPosting) formAlert.append(h("div", { style: "margin-top:10px;" }, h("a", { class: "btn btn-outline btn-sm", href: "register.html" }, "Register a new posting →")));
      const firstId = Object.keys(m.byField)[0]; if (firstId) { if (firstId === "locpicker" || firstId === "attest") picker.focusFor(firstId); else $("#" + firstId).focus(); }
      return;
    }
    if (!r.data.edited) { say(formAlert, "notice", "Nothing was changed."); return; }
    const reload = await api.getMyPosting(postingId);
    if (reload.ok) await populate(reload.data);
    showErrors({});
    say(formAlert, "ok", "Saved. " + (r.data.changed_fields.length === 1 ? "1 field was changed." : r.data.changed_fields.length + " fields were changed.") + (r.data.similarity_pct !== null && r.data.similarity_pct !== undefined ? " " + r.data.similarity_pct + "% of the earlier requirements wording is kept." : ""));
    window.scrollTo({ top: 0, behavior: "smooth" });
  } finally { setBusy(false); }
}

async function submitLinks() {
  if (state.linksBusy || !state.orig) return;
  const box = $("#linksAlert"); say(box, "error", "");
  const check = checkLinks(linkRows.map((r) => ({ url: r.u.value, label: r.l.value })));
  showLinkErrors(check.errors);
  if (!check.ok) {
    if (check.form) say(box, "error", check.form);
    const bad = Object.keys(check.errors)[0]; if (bad !== undefined) (check.errors[bad].url ? linkRows[bad].u : linkRows[bad].l).focus(); else linkRows[0].u.focus();
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
      if (m.planRequired) { const reload = await api.getMyPosting(postingId); if (reload.ok) { state.linksBusy = false; await populate(reload.data); say($("#linksAlert"), "error", m.general); } }
      return;
    }
    state.linksBusy = false;
    const reload = await api.getMyPosting(postingId);
    if (reload.ok) await populate(reload.data);
    say($("#linksAlert"), "ok", r.data.changed === false ? "These are the links already stored, so nothing was changed." : "Saved. " + (r.data.active_links === 1 ? "1 destination link is" : r.data.active_links + " destination links are") + " now stored.");
  } finally { state.linksBusy = false; $("#saveLinksBtn").disabled = false; }
}
$("#addLinkBtn").addEventListener("click", () => { if (linkRows.length < MAX_LINKS) { addLinkRow(); linkRows[linkRows.length - 1].u.focus(); } });
$("#linksForm").addEventListener("submit", (ev) => { ev.preventDefault(); submitLinks(); });
form.addEventListener("submit", (ev) => { ev.preventDefault(); submit(); });

(async () => {
  const ctx = await requirePoster("edit.html?id=" + postingId);
  if (!ctx) return;
  await mountAccount($("#navAccount"), { cta: false });
  if (!ctx.info) { say(pageAlert, "error", describeError(ctx.error) + " Reload the page to try again."); return; }
  $("#orgName").textContent = ctx.info.organization.name;
  await load();
})();
