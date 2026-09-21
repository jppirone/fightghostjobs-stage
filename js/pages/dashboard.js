// dashboard.js - "My postings": the postings the signed-in employer OWNS (a colleague's do not appear), with the row actions: publish a draft, pause, resume, extend (once) and close.
// Nothing here trusts the page for identity: the session token tells the server who is asking, and the server returns only that person's postings.

import { api, requirePoster, mountAccount, go, signOut, describeError, isAuthFailure } from "../app.js";
import { rememberNext } from "../session.js";
import { $, h, clear, alertBox } from "../dom.js";
import { groupCode, locationLine, waitText } from "../format.js";
import { FILTERS, statusChip, matchesFilter, matchesText, sortByPosted, reqCell, postedCell, capCell, closesCell } from "../dashboard-model.js";
import { actionsFor, publishWindowEnded } from "../dashboard-model.js";
import { runAction, ACTION_LABEL } from "../dashboard-actions.js";

const PAGE_CAP = 20;                       // 20 pages of 50: a hard stop, never an endless loop
const state = { rows: [], total: 0, filter: "all", sortDir: "desc", text: "", loaded: false };

async function sessionEnded() { await signOut(); rememberNext("dashboard.html", "poster"); go("employer-signin.html?reason=expired"); }

function failureText(err) {
  if (err.code === "rate_limited") return "Too many requests just now. Try again in " + waitText(err.retryAfter || 30) + ".";
  return describeError(err, { what: "Your postings" });
}

async function loadAll() {
  const rows = []; let offset = 0, total = 0;
  for (let page = 0; page < PAGE_CAP; page++) {
    const r = await api.listMyPostings(offset);
    if (!r.ok) return { ok: false, error: r.error };
    rows.push(...r.data.postings); total = r.data.total;
    if (r.data.next_offset === null) return { ok: true, rows, total };
    offset = r.data.next_offset;
  }
  return { ok: true, rows, total };            // more than 1,000 postings: show what was read, and say so
}

function renderFilters() {
  const box = $("#filters"); clear(box);
  for (const [key, label] of FILTERS) box.append(h("button", { type: "button", class: "filter-pill" + (state.filter === key ? " on" : ""), onclick: () => { state.filter = key; render(); } }, label));
}

function actionCells(p, now) {
  // Edit is a page of its own (a link); the others are one-click dialogs
  const out = actionsFor(p, now).map((k) => k === "edit" ? h("a", { class: "row-action", href: "edit.html?id=" + encodeURIComponent(p.id) }, ACTION_LABEL[k]) : h("button", { type: "button", class: "row-action", onclick: () => runAction(k, p, deps) }, ACTION_LABEL[k]));
  if (publishWindowEnded(p, now)) out.push(h("span", { class: "row-note" }, "Publish window ended"));
  return out;
}

function row(p, now) {
  const chip = statusChip(p, now);
  return h("tr", {},
    h("td", { style: "font-weight:600;" }, p.title, h("div", { style: "font-size:12px;font-weight:400;color:var(--muted);margin-top:3px;" }, locationLine(p.is_remote, p.locations))),
    h("td", { style: "color:var(--muted);" }, reqCell(p)),
    h("td", { style: "color:var(--muted);font-family:'Space Grotesk',sans-serif;letter-spacing:.03em;white-space:nowrap;" }, groupCode(p.post_id)),
    h("td", {}, h("span", { class: "status " + chip.cls }, chip.text)),
    h("td", { style: "white-space:nowrap;" }, actionCells(p, now)),          // right after the status: the actions must never be pushed off the edge of a narrow window
    h("td", { style: "color:var(--muted);" }, postedCell(p)),
    h("td", { style: "color:var(--muted);" }, closesCell(p), p.bump_used ? h("div", { class: "row-note" }, "extended " + p.bump_days + (p.bump_days === 1 ? " day" : " days")) : null),
    h("td", { style: "color:var(--muted);" }, capCell(p)),
    h("td", { style: "color:var(--muted);white-space:nowrap;" }, "💬 " + p.comment_count));
}

function render() {
  renderFilters();
  $("#sortArrow").textContent = state.sortDir === "desc" ? "↓" : "↑";
  const now = Date.now();
  const shown = sortByPosted(state.rows.filter((p) => matchesFilter(p, state.filter, now) && matchesText(p, state.text)), state.sortDir);
  const body = $("#rows"); clear(body);
  for (const p of shown) body.append(row(p, now));
  const note = $("#tableNote");
  if (state.loaded && state.rows.length === 0) {
    note.hidden = false; clear(note); note.append("You haven't registered a posting yet. ", h("a", { href: "register.html", style: "font-weight:600;" }, "Register your first posting →"));
  } else if (state.loaded && shown.length === 0) {
    note.hidden = false; clear(note); note.append("No postings match this filter.");
  } else note.hidden = true;
  $("#loadNote").textContent = state.loaded ? (state.total > state.rows.length ? "Showing the newest " + state.rows.length + " of " + state.total + " postings." : shown.length + " of " + state.rows.length + (state.rows.length === 1 ? " posting" : " postings")) : "";
}

// what the row actions need: the API, what to do after one worked, and what to do when the session has ended
const deps = {
  api,
  done: async (message) => { const n = $("#actionNote"); clear(n); n.hidden = false; n.append(alertBox("ok", message)); await refresh(); },
  sessionEnded: () => sessionEnded(),
};

async function refresh() {
  const box = $("#pageAlert"); box.hidden = true; clear(box);
  $("#loadNote").textContent = "Loading your postings…";
  const r = await loadAll();
  if (!r.ok) {
    if (isAuthFailure(r.error)) return sessionEnded();
    $("#loadNote").textContent = "";
    box.hidden = false; box.append(alertBox("error", failureText(r.error) + " "), h("button", { type: "button", class: "btn btn-outline btn-sm", style: "margin-top:10px;", onclick: refresh }, "Try again"));
    return;
  }
  state.rows = r.rows; state.total = r.total; state.loaded = true; render();
}

$("#textFilter").addEventListener("input", (ev) => { state.text = ev.target.value; render(); });
const toggleSort = () => { state.sortDir = state.sortDir === "desc" ? "asc" : "desc"; render(); };
$("#sortHead").addEventListener("click", toggleSort);
$("#sortHead").addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggleSort(); } });

(async () => {
  renderFilters();
  const ctx = await requirePoster("dashboard.html");
  if (!ctx) return;
  await mountAccount($("#navAccount"), { cta: false });
  if (!ctx.info) { $("#pageAlert").hidden = false; $("#pageAlert").append(alertBox("error", describeError(ctx.error) + " Reload the page to try again.")); return; }
  $("#orgName").textContent = ctx.info.organization.name;
  await refresh();
})();
