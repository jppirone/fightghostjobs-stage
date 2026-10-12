// dashboard.js - "My postings": the postings the signed-in employer OWNS (a colleague's do not appear), with the row actions: publish a draft, pause, resume, extend (once) and close.
// Nothing here trusts the page for identity: the session token tells the server who is asking, and the server returns only that person's postings.
// Prompt BP (October 11, 2026): the table has Title (with the place and the day it was added under it), Req #, Opening ID, Status (only in a view that can hold more than one status), Actions, Closes (with a flag line when
// the date is near) and Comments; the sort box orders every loaded row; the Expiring pill gathers drafts near the end of their publish window.

import { api, requirePoster, mountAccount, go, signOut, describeError, isAuthFailure } from "../app.js?v=67bc7e98";
import { rememberNext } from "../session.js?v=c0af4232";
import { $, h, clear, alertBox } from "../dom.js?v=ff147636";
import { groupCode, waitText } from "../format.js?v=032c6fc5";
import { placeNodes } from "../place.js?v=915c680a";
import { FILTERS, SORTS, SORT_ANNOUNCE, defaultSort, sortRows, showsStatusColumn, statusChip, matchesFilter, matchesText, reqCell, addedCell, closesCell, expiryFlag } from "../dashboard-model.js?v=e406518f";
import { actionsFor, publishWindowEnded } from "../dashboard-model.js?v=e406518f";
import { runAction, ACTION_LABEL } from "../dashboard-actions.js?v=7c258c71";
import { COMMENTS_VISIBLE } from "../config.js?v=9bf25cae";

const PAGE_CAP = 20;                       // 20 pages of 50: a hard stop, never an endless loop
// sort: the choice the person made (null until they pick one; it stays while they change pills, until they pick another or reload); announce: the sentence the next draw says once
const state = { rows: [], total: 0, filter: "all", sort: null, text: "", loaded: false, announce: "", sortBoxStatus: null };

async function sessionEnded() { await signOut(); rememberNext("dashboard.html", "poster"); go("employer-signin.html?reason=expired"); }

function failureText(err) {
  if (err.code === "rate_limited") return "Too many requests just now. Try again in " + waitText(err.retryAfter || 30) + ".";
  return describeError(err, { what: "Your openings" });
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
  // prompt BL: the note is ONE block that wraps inside the cell at a fixed width (css: .my-openings .act-note); it used to be three inline pieces on one line, which stretched the Actions column of every row
  if (publishWindowEnded(p, now)) out.push(h("div", { class: "row-note act-note" }, "Publish window ended: a draft can be published for 14 days after it was added. To use it, ", h("a", { class: "row-action note-link", href: "register.html" }, "add it again"), " as a new opening."));
  return out;
}

// prompt BN: a date and its time never break in the middle. Each piece ("Goes live", "Nov 25,", "7:38 AM EST") is a no-wrap span (css: .my-openings .nb) and a line may break only between the pieces.
// The words are the same as the model's (js/dashboard-model.js): a value that is no date ("Not set", "None") is returned as it is. The pieces sit in ONE wrapper (class dt): on a phone the cell is a grid and
// each direct child is a grid item, so the value must stay a single child there, as the plain text was.
const DATE_BITS = /^(.*?)([A-Z][a-z]{2} \d{1,2},?)(?: (\d{1,2}:\d{2} [AP]M.*))?$/;
function dateBits(text) {
  const m = DATE_BITS.exec(String(text));
  if (!m) return text;
  const out = [];
  for (const bit of [m[1].trim(), m[2], m[3]]) { if (!bit) continue; if (out.length) out.push(" "); out.push(h("span", { class: "nb" }, bit)); }
  return h("span", { class: "dt" }, ...out);
}

// the columns of the table right now: Status is there only while the chosen pill can hold more than one status (js/dashboard-model.js showsStatusColumn)
function columnNames(showStatus) {
  return ["Title", "Req #", "KIO ID", ...(showStatus ? ["Status"] : []), "Actions", "Closes", ...(COMMENTS_VISIBLE ? ["Comments"] : [])];
}
function renderHead(showStatus) {
  const tr = $("#headRow"); clear(tr);
  for (const name of columnNames(showStatus)) tr.append(h("th", { role: "columnheader" }, name));
}

function row(p, now, showStatus) {
  const chip = statusChip(p, now);
  // prompt BL: the employer typed the place: no "as provided by the employer" here. Prompt BN: and nothing at all when nothing is set (no place, no Remote): the title often says it.
  const place = placeNodes(h, p, { note: false, hideNone: true });
  const flag = expiryFlag(p, now);
  return h("tr", { role: "row" },
    h("td", { role: "cell", "data-label": "Title", style: "font-weight:600;" }, p.title,
      place.length ? h("div", { class: "row-sub", "data-part": "place" }, place) : null,
      h("div", { class: "row-sub", "data-part": "added" }, addedCell(p))),                      // prompt BP: the day it was added, a small grey line under the place
    h("td", { role: "cell", "data-label": "Req #", style: "color:var(--muted);" }, reqCell(p)),
    h("td", { role: "cell", "data-label": "KIO ID", class: "mono", style: "color:var(--muted);white-space:nowrap;" }, groupCode(p.post_id)),
    showStatus ? h("td", { role: "cell", "data-label": "Status" }, h("span", { class: "status " + chip.cls }, chip.text)) : null,
    h("td", { role: "cell", "data-label": "Actions" }, actionCells(p, now)),          // right after the status: the actions must never be pushed off the edge of a narrow window (each action word stays on one line and the note wraps: css .my-openings)
    h("td", { role: "cell", "data-label": "Closes", style: "color:var(--muted);" }, dateBits(closesCell(p, now)),
      flag ? h("div", { class: "row-flag", "data-part": "flag" }, flag) : null,           // prompt BP: words and a dark amber colour, never colour alone; the same sentence a screen reader reads
      p.bump_used ? h("div", { class: "row-note" }, "extended " + p.bump_days + (p.bump_days === 1 ? " day" : " days")) : null),
    COMMENTS_VISIBLE ? h("td", { role: "cell", "data-label": "Comments", style: "white-space:nowrap;" }, h("a", { class: "row-action", href: "comments.html?id=" + encodeURIComponent(p.id), title: "Read the comments" }, "💬 " + p.comment_count)) : null);   // the one comments switch (js/config.js)
}

// the sort in force: the person's own choice when it makes sense in this view (Status only where the column is shown), otherwise the pill's default
function effectiveSort(showStatus) {
  const want = state.sort;
  if (want && SORTS.some(([k]) => k === want) && (want !== "status" || showStatus)) return want;
  return defaultSort(state.filter);
}
// the options are drawn again only when the Status option comes or goes, and the same select element is kept (its focus and its choice are never lost by a redraw)
function renderSortBox(showStatus, key) {
  const box = $("#sortBox");
  if (state.sortBoxStatus !== showStatus) {
    clear(box);
    for (const [k, label] of SORTS) if (k !== "status" || showStatus) box.append(h("option", { value: k }, label));
    state.sortBoxStatus = showStatus;
  }
  if (box.value !== key) box.value = key;
}

function render() {
  const showStatus = showsStatusColumn(state.filter), key = effectiveSort(showStatus);
  renderFilters();
  renderHead(showStatus);
  renderSortBox(showStatus, key);
  const now = Date.now();
  const shown = sortRows(state.rows.filter((p) => matchesFilter(p, state.filter, now) && matchesText(p, state.text)), key, now);
  const body = $("#rows"); clear(body);
  for (const p of shown) body.append(row(p, now, showStatus));
  const note = $("#tableNote");
  if (state.loaded && state.rows.length === 0) {
    note.hidden = false; clear(note); note.append("You haven't added an opening yet. ", h("a", { href: "register.html", style: "font-weight:600;" }, "Add your first opening →"));
  } else if (state.loaded && shown.length === 0) {
    note.hidden = false; clear(note); note.append("No openings match this filter.");
  } else note.hidden = true;
  const count = state.loaded ? (state.total > state.rows.length ? "Showing the newest " + state.rows.length + " of " + state.total + " openings." : shown.length + " of " + state.rows.length + (state.rows.length === 1 ? " opening" : " openings")) : "";
  $("#loadNote").textContent = (state.announce ? state.announce + ". " : "") + count;                  // the one live region: a changed sort says so once, then the count again
  state.announce = "";
  fitTable();
}

// ---- fitting the table to the card (prompt BP). The table is first drawn at its roomiest (the Actions, Closes, Opening ID and Comments columns each take exactly what their words need, one line each, and an expired-draft note
// keeps a block about 36 characters wide). If that is wider than the card, the note gives up its width ("snug"); if that is still too wide, the columns share the width and the words wrap between words and between a date
// and its time ("tight"). The page asks the browser (scrollWidth against clientWidth), so it follows the window and the fonts of whoever is looking, not a number worked out on another machine.
// The phone card list (640 pixels and below) is not a table of columns and is left alone.
const wide = window.matchMedia("(min-width:641px)");
function fitTable() {
  const table = document.querySelector(".my-openings"), card = table && table.closest(".card");
  if (!table || !card) return;
  // prompt BR (October 12, 2026): a level between "snug" and "tight": the Status pills may wrap between their words (one clean rounded box each) before any date breaks between its day and its time
  for (const level of ["", "snug", "wrap-status", "tight"]) {
    table.classList.toggle("snug", level === "snug"); table.classList.toggle("wrap-status", level === "wrap-status"); table.classList.toggle("tight", level === "tight");
    if (!wide.matches || level === "tight" || card.scrollWidth <= card.clientWidth + 1) break;
  }
}
if (typeof ResizeObserver === "function") new ResizeObserver(() => fitTable()).observe(document.querySelector(".card.flush"));
window.addEventListener("resize", fitTable);

// what the row actions need: the API, what to do after one worked, and what to do when the session has ended
const deps = {
  api,
  done: async (message) => { const n = $("#actionNote"); clear(n); n.hidden = false; n.append(alertBox("ok", message)); await refresh(); },
  sessionEnded: () => sessionEnded(),
};

async function refresh() {
  const box = $("#pageAlert"); box.hidden = true; clear(box);
  $("#loadNote").textContent = "Loading your openings…";
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
$("#sortBox").addEventListener("change", (ev) => {
  const k = ev.target.value, item = SORTS.find(([key]) => key === k);
  if (!item) return;
  state.sort = k; state.announce = SORT_ANNOUNCE(item[1]);
  render();
});

(async () => {
  render();
  const ctx = await requirePoster("dashboard.html");
  if (!ctx) return;
  await mountAccount($("#navAccount"), { cta: false });
  if (!ctx.info) { $("#pageAlert").hidden = false; $("#pageAlert").append(alertBox("error", describeError(ctx.error) + " Reload the page to try again.")); return; }
  $("#orgName").textContent = ctx.info.organization.name;
  await refresh();
})();
