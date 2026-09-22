// team.js - the organization's roster (admins only): who can register postings, add a person (invited until their first sign-in), make or unmake an admin, remove a person (naming who takes over
// their postings when they own any). Every rule is enforced by the backend; this page shows its answers in words. Nothing here trusts the page for identity: the session token tells the server who is acting.

import { api, requirePoster, mountAccount, go, signOut, describeError, isAuthFailure } from "../app.js";
import { rememberNext } from "../session.js";
import { $, $$, h, clear, alertBox } from "../dom.js";
import { checkAdd, successorChoices, statusText, roleText, actionsFor, mapRosterError } from "../roster-model.js";

const state = { me: null, roster: [], busy: false };
const rowsEl = $("#rows"), note = $("#actionNote"), pageAlert = $("#pageAlert"), addForm = $("#addForm"), addBtn = $("#addBtn");

function say(box, kind, text) { clear(box); box.hidden = !text; if (text) box.append(alertBox(kind, text)); }
function showErrors(byField) { for (const el of $$("[data-error-for]")) { const id = el.dataset.errorFor, msg = byField[id]; el.hidden = !msg; el.textContent = msg || ""; $("#" + id).setAttribute("aria-invalid", msg ? "true" : "false"); } }
async function sessionEnded() { await signOut(); rememberNext("team.html", "poster"); go("employer-signin.html?reason=expired"); }
const failureText = (err) => mapRosterError(err) || describeError(err, { what: "That" });

async function refuse(r) {
  if (isAuthFailure(r.error)) { await sessionEnded(); return true; }
  if (r.error.code === "forbidden") { $("#adminArea").hidden = true; $("#notAdmin").hidden = false; return true; }
  return false;
}

async function load() {
  const r = await api.rosterList();
  if (!r.ok) { if (await refuse(r)) return; say(pageAlert, "error", failureText(r.error) + " Reload the page to try again."); return; }
  state.roster = r.data.posters; $("#notAdmin").hidden = true; $("#adminArea").hidden = false; render();
}

function render() {
  clear(rowsEl);
  for (const p of state.roster) {
    const you = p.poster_id === state.me;
    rowsEl.append(h("tr", {},
      h("td", { style: "font-weight:600;" }, p.full_name, you ? h("span", { class: "row-note", style: "margin-left:8px;" }, "(you)") : null),
      h("td", { style: "color:var(--muted);" }, p.email),
      h("td", {}, roleText(p)),
      h("td", {}, h("span", { class: "status " + (p.status === "active" ? "status-active" : "status-draft") }, statusText(p))),
      h("td", { style: "white-space:nowrap;" }, actionsFor(p, state.me, state.roster).map((k) => h("button", { type: "button", class: "row-action", onclick: () => act(k, p) }, k === "remove" ? "Remove" : k === "promote" ? "Make admin" : "Remove admin")))));
  }
  const t = $("#tableNote"); t.hidden = state.roster.length > 0; if (state.roster.length === 0) { clear(t); t.append("Nobody is on the roster."); }
}

function openDialog({ title, content, confirmLabel, onSubmit }) {
  const previous = document.activeElement; let busy = false;
  const errBox = h("div", { class: "alert alert-error", role: "alert", hidden: true, style: "margin-top:14px;" });
  const confirm = h("button", { type: "submit", class: "btn btn-primary btn-sm" }, confirmLabel), cancel = h("button", { type: "button", class: "btn btn-outline btn-sm" }, "Cancel");
  const form = h("form", { novalidate: true }, content, errBox, h("div", { style: "display:flex;gap:10px;justify-content:flex-end;margin-top:20px;" }, cancel, confirm));
  const box = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": title }, h("h2", { style: "font-size:20px;font-weight:700;margin-bottom:12px;" }, title), form);
  const backdrop = h("div", { class: "modal-backdrop open" }, box);
  const close = () => { backdrop.remove(); document.removeEventListener("keydown", onKey); if (previous && previous.focus) previous.focus(); };
  function onKey(ev) { if (ev.key === "Escape" && !busy) { ev.preventDefault(); close(); } }
  backdrop.addEventListener("mousedown", (ev) => { if (ev.target === backdrop && !busy) close(); });
  cancel.addEventListener("click", () => { if (!busy) close(); });
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault(); if (busy) return;
    busy = true; confirm.disabled = true; cancel.disabled = true; errBox.hidden = true;
    const r = await onSubmit(); busy = false; confirm.disabled = false; cancel.disabled = false;
    if (r && r.error) { errBox.hidden = false; errBox.textContent = r.error; return; }
    close();
  });
  document.body.append(backdrop); document.addEventListener("keydown", onKey); confirm.focus();
}
const para = (text) => h("p", { style: "font-size:14px;line-height:1.6;color:var(--muted);margin:0 0 12px 0;" }, text);

async function finish(r, okText) {
  if (r.ok) { say(note, "ok", typeof okText === "function" ? okText(r.data) : okText); await load(); return undefined; }
  if (isAuthFailure(r.error)) { await sessionEnded(); return { error: "Please sign in again." }; }
  return { error: failureText(r.error) };
}

function act(kind, p) {
  const who = "“" + p.full_name + "”";
  if (kind === "promote") return openDialog({ title: "Make this person an admin?", confirmLabel: "Make admin", content: [para(who + " will be able to add and remove people on this roster and make other admins.")],
    onSubmit: async () => finish(await api.rosterSetAdmin(p.poster_id, true), who + " is now an admin.") });
  if (kind === "demote") return openDialog({ title: "Remove admin rights?", confirmLabel: "Remove admin", content: [para(who + " keeps their postings and their access; they can no longer manage this roster.")],
    onSubmit: async () => finish(await api.rosterSetAdmin(p.poster_id, false), who + " is no longer an admin.") });
  if (kind === "remove") {
    const others = successorChoices(state.roster, p.poster_id);
    const sel = h("select", { id: "successor", style: "width:100%;" }, h("option", { value: "" }, "Nobody (only possible when they own no postings)"), others.map((o) => h("option", { value: o.poster_id }, o.full_name + " (" + o.email + ")")));
    return openDialog({ title: "Remove this person?", confirmLabel: "Remove",
      content: [para(who + " loses access immediately; a sign-in link they already hold stops working. If they own postings, choose who takes those over: the postings stay live under the new owner."),
        h("label", { for: "successor", style: "display:block;margin-top:12px;" }, "Their postings go to"), sel],
      onSubmit: async () => finish(await api.rosterRemove(p.poster_id, sel.value || null), (d) => who + " was removed" + (d && d.transferred ? " and " + d.transferred + (d.transferred === 1 ? " posting was" : " postings were") + " handed over." : ".")) });
  }
}

addForm.addEventListener("submit", async (ev) => {
  ev.preventDefault(); if (state.busy) return;
  say($("#addAlert"), "error", "");
  const c = checkAdd($("#addEmail").value, $("#addName").value, $("#addAdmin").checked); showErrors({ addEmail: c.errors.email, addName: c.errors.name });
  if (!c.ok) { (c.errors.name ? $("#addName") : $("#addEmail")).focus(); return; }
  state.busy = true; addBtn.disabled = true;
  try {
    const r = await api.rosterAdd(c.body);
    if (!r.ok) { if (await refuse(r)) return; say($("#addAlert"), "error", failureText(r.error)); return; }
    $("#addName").value = ""; $("#addEmail").value = ""; $("#addAdmin").checked = false;
    say(note, "ok", c.body.full_name + " is on the roster as invited. Tell them to request a sign-in link with " + c.body.email + ".");
    await load();
  } finally { state.busy = false; addBtn.disabled = false; }
});

(async () => {
  const ctx = await requirePoster("team.html");
  if (!ctx) return;
  await mountAccount($("#navAccount"), { cta: false });
  if (!ctx.info) { say(pageAlert, "error", describeError(ctx.error) + " Reload the page to try again."); return; }
  state.me = ctx.info.poster.poster_id; $("#orgName").textContent = ctx.info.organization.name;
  if (!ctx.info.poster.is_org_admin) { $("#notAdmin").hidden = false; return; }
  await load();
})();
