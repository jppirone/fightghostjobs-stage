// staff-invite.js - the staff page "Companies to invite" (prompt IV, November 6, 2026): the companies that people searched for and the system does not know, for a signed-in STAFF person only.
// Flow: [sign in on the search page] -> open this address -> the page asks the database public.is_staff() with the person's own token -> only a clear "true" shows the filters and the table; anything else (signed out, not staff,
// an error, an odd answer) shows one plain line and NO data. The list comes from public.staff_invite_list and the titles from public.staff_invite_list_titles; both check is_staff() again inside the database. Nothing is stored in the
// browser, nothing is written anywhere, and when the page is left (or kept for Back) the rows are removed from it. The page has no link from any public page; staff open it by its address.

import { api, mountAccount, currentSession } from "../app.js?v=fc8efa20";
import { $, $$, h, clear, alertBox } from "../dom.js?v=5c78a8cd";
import { focusWithRing } from "../focus-ring.js?v=98307f3f";
import { defaultRange, checkInputs, monthLabel, peopleText, statusText, sortRows, countText, failureKind, EMPTY_TEXT, TITLES_EMPTY_TEXT, SIGNED_OUT_TEXT, NOT_AVAILABLE_TEXT, CHECK_FAILED_TEXT, LOAD_FAILED_TEXT, TITLES_FAILED_TEXT, RANGE_REFUSED_TEXT, SESSION_ENDED_TEXT } from "../staff-invite-model.js?v=ee8cf2a6";

const gate = $("#gate"), gateText = $("#gateText"), area = $("#area"), form = $("#filters"), showBtn = $("#showBtn");
const fFrom = $("#fFrom"), fTo = $("#fTo"), fCompany = $("#fCompany"), fMin = $("#fMin"), fSort = $("#fSort");
const listAlert = $("#listAlert"), countLine = $("#countLine"), listCard = $("#listCard"), rowsEl = $("#rows"), peopleNote = $("#peopleNote"), emptyNote = $("#emptyNote");
const titlesPanel = $("#titlesPanel"), titlesHeading = $("#titlesHeading"), titlesClose = $("#titlesClose"), titlesAlert = $("#titlesAlert"), titlesCard = $("#titlesCard"), titleRows = $("#titleRows"), titlesEmpty = $("#titlesEmpty");

let rows = [], shown = null, listSeq = 0, titlesSeq = 0, returnTo = null;   // shown: the arguments of the list on screen (the titles use the same dates)

function say(box, kind, text) { clear(box); box.hidden = !text; if (text) box.append(alertBox(kind, text)); }
function showErrors(byField) {
  for (const el of $$("[data-error-for]")) { const id = el.dataset.errorFor, msg = byField[id]; el.hidden = !msg; el.textContent = msg || ""; $("#" + id).setAttribute("aria-invalid", msg ? "true" : "false"); }
}

// every row of data is taken off the page: used when the sign-in ends, when a call is refused, and when the page is left
function wipe() {
  rows = []; shown = null; listSeq++; titlesSeq++; returnTo = null;
  clear(rowsEl); clear(titleRows);
  listCard.hidden = true; emptyNote.hidden = true; peopleNote.hidden = true; titlesPanel.hidden = true; titlesCard.hidden = true; titlesEmpty.hidden = true;
  say(listAlert, "error", ""); say(titlesAlert, "error", ""); countLine.textContent = "";
}
function showGate(text) { wipe(); area.hidden = true; gateText.textContent = text; gate.hidden = false; }

function cell(label, ...kids) { return h("td", { role: "cell", "data-label": label }, ...kids); }
function render() {
  clear(rowsEl);
  const list = sortRows(rows, fSort.value);
  listCard.hidden = list.length === 0;
  emptyNote.hidden = list.length !== 0;
  if (list.length === 0) { emptyNote.textContent = EMPTY_TEXT; peopleNote.hidden = true; return; }
  for (const r of list) {
    rowsEl.append(h("tr", { role: "row" },
      cell("Company", h("span", { style: "font-weight:600;" }, r.company)),
      cell("Searches", String(r.searches)),
      cell("Different people", peopleText(r)),
      cell("First month", monthLabel(r.first_month)),
      cell("Last month", monthLabel(r.last_month)),
      cell("Status", statusText(r)),
      h("td", { role: "cell", "data-label": "Titles", style: "white-space:nowrap;" },
        h("button", { type: "button", class: "row-action", "aria-label": "Titles for " + r.company, onclick: (ev) => openTitles(r, ev.currentTarget) }, "Titles"))));
  }
  peopleNote.hidden = !list.some((r) => r.people_exact === false);
}

async function load() {
  const checked = checkInputs({ from: fFrom.value, to: fTo.value, min: fMin.value, company: fCompany.value });
  showErrors({ fFrom: checked.errors.from, fTo: checked.errors.to, fCompany: checked.errors.company, fMin: checked.errors.min });
  if (!checked.ok) { const first = [["from", fFrom], ["to", fTo], ["company", fCompany], ["min", fMin]].find(([k]) => checked.errors[k]); if (first) first[1].focus(); return; }
  const mine = ++listSeq;
  closeTitles(false);
  say(listAlert, "error", ""); showBtn.disabled = true; countLine.textContent = "Loading.";
  const r = await api.staffInviteList(checked.args);
  if (mine !== listSeq) return;   // a newer request replaced this one
  showBtn.disabled = false;
  if (!r.ok) {
    const kind = failureKind(r);
    if (kind === "session") { showGate(SESSION_ENDED_TEXT); return; }
    rows = []; shown = null; clear(rowsEl); listCard.hidden = true; emptyNote.hidden = true; peopleNote.hidden = true; countLine.textContent = "";
    say(listAlert, "error", kind === "range" ? RANGE_REFUSED_TEXT : LOAD_FAILED_TEXT);
    return;
  }
  rows = r.data; shown = checked.args;
  countLine.textContent = countText(rows.length) + " in this date range.";
  render();
}

function closeTitles(restoreFocus) {
  titlesSeq++;
  titlesPanel.hidden = true; titlesCard.hidden = true; titlesEmpty.hidden = true; clear(titleRows); say(titlesAlert, "error", "");
  const back = returnTo; returnTo = null;
  if (restoreFocus && back && back.isConnected) focusWithRing(back);
}

async function openTitles(row, button) {
  if (!shown) return;
  const mine = ++titlesSeq;
  returnTo = button;
  clear(titleRows); titlesCard.hidden = true; titlesEmpty.hidden = true; say(titlesAlert, "error", "");
  titlesHeading.textContent = "Titles searched for " + row.company;
  titlesPanel.hidden = false;
  focusWithRing(titlesHeading);
  const r = await api.staffInviteListTitles({ p_from: shown.p_from, p_to: shown.p_to, p_company: row.company_key, p_min_searches: 1 });
  if (mine !== titlesSeq) return;
  if (!r.ok) {
    if (failureKind(r) === "session") { showGate(SESSION_ENDED_TEXT); return; }
    say(titlesAlert, "error", TITLES_FAILED_TEXT);
    return;
  }
  const own = r.data.filter((t) => t.company_key === row.company_key);   // the database already limits the answer to this company; this only keeps the panel to the row that was opened
  if (own.length === 0) { titlesEmpty.textContent = TITLES_EMPTY_TEXT; titlesEmpty.hidden = false; return; }
  for (const t of own) titleRows.append(h("tr", { role: "row" }, cell("Title", t.title), cell("Searches", String(t.searches))));
  titlesCard.hidden = false;
}

form.addEventListener("submit", (ev) => { ev.preventDefault(); load(); });
fSort.addEventListener("change", () => { if (rows.length > 0) render(); });
titlesClose.addEventListener("click", () => closeTitles(true));
titlesPanel.addEventListener("keydown", (ev) => { if (ev.key === "Escape") { ev.preventDefault(); closeTitles(true); } });
// nothing staff-only stays in a page the browser keeps for Back: the rows are removed when the page is left, and a page brought back from that store starts again from the sign-in check
window.addEventListener("pagehide", () => { wipe(); });
window.addEventListener("pageshow", (ev) => { if (ev.persisted) location.reload(); });

(async function start() {
  mountAccount($("#navAccount"), { cta: false }).catch(() => { });
  const session = await currentSession();
  if (!session) { showGate(SIGNED_OUT_TEXT); return; }
  const staff = await api.isStaff();   // only a clear true counts; false, an error, a missing function or an odd answer all show the same plain line
  if (!(staff.ok && staff.data === true)) { showGate(staff.error && staff.error.code === "network" ? CHECK_FAILED_TEXT : NOT_AVAILABLE_TEXT); return; }
  const range = defaultRange(new Date());
  fFrom.value = range.from; fTo.value = range.to;
  gate.hidden = true; area.hidden = false;
  await load();
})();
