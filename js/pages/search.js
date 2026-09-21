// search.js - a verified candidate looks up a posting: company + (title or req code). No browsing, ever: the backend refuses anything else.
// Flow: [sign in once by email] -> search -> result cards -> "View posting details" (records the view, lists the employer's destinations) -> a destination click (issues a 2-minute single-use link, opened in a new tab).

import { api, mountAccount, go, signOut, describeError, isAuthFailure } from "../app.js";
import { requestLink } from "../session.js";
import { $, h, clear, alertBox, chip, safeHref } from "../dom.js";
import { locationLine, waitText } from "../format.js";
import { postingChips, notOpenMessage } from "../chips.js";
import { checkCompany, classifyQuery } from "../search-input.js";

const PENDING_KEY = "fgj-pending-search";
const form = $("#searchForm"), companyIn = $("#company"), queryIn = $("#titleq"), searchBtn = $("#searchBtn"), formError = $("#formError");
const resultsEl = $("#results"), countEl = $("#resultCount");
const backdrop = $("#modalBackdrop");
let session = null, busy = false, cooldownTimer = null;

function setFormError(text) { formError.hidden = !text; formError.textContent = text || ""; }
function startCooldown(button, seconds, idleLabel) {
  clearInterval(cooldownTimer);
  let left = Math.max(1, Math.ceil(seconds));
  button.disabled = true;
  const tick = () => { if (left <= 0) { clearInterval(cooldownTimer); button.disabled = false; button.textContent = idleLabel; return; } button.textContent = "Wait " + left + "s"; left -= 1; };
  tick(); cooldownTimer = setInterval(tick, 1000);
}

// ---- who is here
function showSignIn(message) {
  $("#signinWrap").hidden = false;
  if (message) { const b = $("#candEmailError"); b.hidden = false; b.textContent = message; }
}
function applySession() {
  $("#signinWrap").hidden = !!(session && session.isCandidate);
  const notice = $("#roleNotice"); clear(notice); notice.hidden = true;
  if (session && session.isPoster && !session.isCandidate) {
    notice.hidden = false;
    notice.append(alertBox("notice", "You are signed in as an employer. Candidate search needs a verified candidate session: sign out, then verify a candidate email address."),
      h("div", { style: "margin-top:12px;" }, h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: async () => { await signOut(); go("search.html"); } }, "Sign out")));
    $("#signinWrap").hidden = true;
  }
}

// ---- candidate sign-in (email link)
$("#signinForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const email = $("#candEmail").value.trim(), err = $("#candEmailError"), send = $("#candSend");
  err.hidden = true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) { err.hidden = false; err.textContent = "Enter your email address."; return; }
  send.disabled = true; const label = send.textContent; send.textContent = "Sending…";
  try {
    const r = await requestLink(email, "candidate", "search.html");
    if (!r.ok) { err.hidden = false; err.textContent = r.status === 429 || /rate|seconds|after/i.test(r.message) ? "A link was just sent to this address, or too many were requested. Wait a minute and try again." : "We could not send the email. Please try again in a moment."; return; }
    $("#signinForm").hidden = true;
    const sent = $("#candSent"); sent.hidden = false; clear(sent);
    sent.append(alertBox("ok", "Check your email. The link takes you straight back here; your search will be waiting."));
  } finally { send.disabled = false; send.textContent = label; }
});

// ---- search
function renderCard(row) {
  const chips = postingChips(row).map(chip);
  return h("div", { class: "card", "data-ref": row.posting_ref },
    h("div", { style: "display:flex;justify-content:space-between;align-items:flex-start;" },
      h("div", {},
        h("div", { style: "font-size:12px;font-weight:600;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;" }, row.company_name),
        h("div", { style: "font-size:22px;font-weight:700;margin-top:4px;" }, row.title),
        h("div", { style: "font-size:14px;color:var(--muted);margin-top:2px;" }, locationLine(row.is_remote, row.locations) + " · Req " + row.masked_code)),
      h("div", { class: "pill badge-verified", style: "flex-shrink:0;" }, "✓ Verified")),
    h("div", { style: "display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;" }, chips),
    h("div", { style: "margin-top:22px;border-top:1px solid var(--line);padding-top:20px;display:flex;gap:12px;align-items:center;" },
      h("button", { type: "button", class: "btn btn-outline view-details", style: "flex:1;justify-content:center;", onclick: (ev) => openDetails(row, ev.currentTarget) }, "View posting details")));
}

function showResults(data) {
  clear(resultsEl);
  countEl.hidden = false;
  const n = data.results.length;
  if (n === 0) {
    countEl.textContent = "No matching postings";
    resultsEl.append(h("div", { class: "empty-note", style: "margin-top:0;" }, "No posting matched. A posting appears here only if a real employer has registered it with FightGhostJobs, so a missing posting is itself worth knowing. Check the company name and try a shorter part of the title."));
    return;
  }
  countEl.textContent = n + (n === 1 ? " matching posting" : " matching postings") + (data.truncated ? " — showing the first 25; add more of the title to narrow it" : "");
  for (const row of data.results) resultsEl.append(renderCard(row));
}

async function runSearch() {
  if (busy) return;
  setFormError("");
  const c = checkCompany(companyIn.value), q = classifyQuery(queryIn.value);
  if (!c.ok) { setFormError(c.message); companyIn.focus(); return; }
  if (!q.ok) { setFormError(q.message); queryIn.focus(); return; }
  if (!session || !session.isCandidate) {
    try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ company: companyIn.value, q: queryIn.value })); } catch { /* ignore */ }
    if (session && session.isPoster) { applySession(); return; }
    showSignIn("Verify your email first; your search is saved and runs as soon as you are back.");
    $("#candEmail").focus();
    return;
  }
  busy = true; searchBtn.disabled = true; const label = "Search"; searchBtn.textContent = "Searching…";
  let cooldown = 0;
  try {
    let r = await api.candidateSearch(q.kind === "code" ? { company: c.value, code: q.value } : { company: c.value, phrase: q.value });
    if (q.alsoTryCode && r.ok && r.data.results.length === 0) r = await api.candidateSearch({ company: c.value, code: q.value });
    if (!r.ok && r.status === 404 && r.error.code === "not_found") r = { ok: true, data: { mode: "code", truncated: false, results: [] } };   // a code that matches nothing is a plain "no such posting"
    if (r.ok) { showResults(r.data); return; }
    clear(resultsEl); countEl.hidden = true;
    if (isAuthFailure(r.error)) { session = null; applySession(); showSignIn(r.error.code === "reverification_required" ? "Your email verification has expired. Please verify your email again." : "Please verify your email to search."); return; }
    if (r.error.code === "rate_limited") { cooldown = r.error.retryAfter || 30; setFormError("You are searching too fast. Try again in " + waitText(cooldown) + "."); return; }
    if (r.status === 400 && r.error.field) { setFormError(r.error.message || "That search was not accepted."); return; }
    setFormError(describeError(r.error));
  } finally {
    busy = false;
    if (cooldown) startCooldown(searchBtn, cooldown, label); else { searchBtn.disabled = false; searchBtn.textContent = label; }
  }
}
form.addEventListener("submit", (ev) => { ev.preventDefault(); runSearch(); });

// ---- the details dialog
function openModal(row) {
  $("#modalCompany").textContent = row.company_name;
  $("#modalTitle").textContent = row.title;
  $("#modalIntro").textContent = "This listing is verified: a real employer registered it directly with FightGhostJobs, with the dates and disclosures shown on the search page.";
  clear($("#modalLinks")); const empty = $("#modalEmpty"); empty.hidden = true; empty.textContent = "";
  backdrop.classList.add("open");
  return { links: $("#modalLinks"), empty };
}
function closeModal() { backdrop.classList.remove("open"); }
$("#modalClose").addEventListener("click", closeModal);
backdrop.addEventListener("click", (ev) => { if (ev.target === backdrop) closeModal(); });
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeModal(); });

async function openDetails(row, button) {
  button.disabled = true; const label = button.textContent; button.textContent = "Opening…";
  let cooldown = 0;
  try {
    const r = await api.candidateDetail(row.posting_ref);
    const m = openModal(row);
    if (r.ok) {
      if (r.data.links.length === 0) {
        m.empty.hidden = false;
        m.empty.textContent = "This employer has confirmed the posting is live but hasn't provided a link to where you can apply. That's their choice to make, not a sign the posting is any less real.";
      } else {
        for (const l of r.data.links) m.links.append(linkRow(row, l));
      }
      return;
    }
    m.empty.hidden = false;
    if (r.status === 409 && r.data && r.data.code === "posting_not_open") m.empty.textContent = notOpenMessage(r.data.status, r.data.closed_reason || null);
    else if (r.error.code === "not_found") m.empty.textContent = "This posting is no longer available.";
    else if (isAuthFailure(r.error)) { closeModal(); session = null; applySession(); showSignIn("Please verify your email again."); }
    else if (r.error.code === "rate_limited") { cooldown = r.error.retryAfter || 30; m.empty.textContent = "You are opening details too fast. Try again in " + waitText(cooldown) + "."; }
    else m.empty.textContent = describeError(r.error);
  } finally {
    if (cooldown) startCooldown(button, cooldown, label); else { button.disabled = false; button.textContent = label; }
  }
}

// One destination. Clicking asks the server for a fresh single-use link (valid 2 minutes) for THIS candidate and opens it in a new tab.
function linkRow(row, link) {
  const go_ = h("span", { class: "go" }, "Continue →");
  const el = h("button", { type: "button", class: "source-row" }, h("span", { class: "source-row-label" }, link.label || "Application link " + link.position), go_);
  el.addEventListener("click", async () => {
    if (el.disabled) return;
    el.disabled = true; go_.textContent = "Redirecting…";
    try {
      const r = await api.candidateLinkIssue(row.posting_ref);
      const found = r.ok ? r.data.links.find((x) => x.position === link.position) : null;
      if (!found) {
        go_.textContent = r.ok ? "Unavailable" : r.error.code === "rate_limited" ? "Try again in " + waitText(r.error.retryAfter || 30) : r.status === 409 ? "Not open" : "Try again";
        return;
      }
      const url = safeHref(found.go_url);
      const w = url ? window.open(url, "_blank", "noopener,noreferrer") : null;
      if (w === null && url) {
        // the browser held back the new tab: give a real link the person can click themselves (it stays valid for 2 minutes)
        el.replaceWith(h("a", { class: "source-row", href: url, target: "_blank", rel: "noopener noreferrer", style: "text-decoration:none;" }, h("span", { class: "source-row-label" }, link.label || "Application link " + link.position), h("span", { class: "go" }, "Open link →")));
        return;
      }
      go_.textContent = "Opened ✓";
    } finally {
      setTimeout(() => { if (el.isConnected) { el.disabled = false; if (go_.textContent !== "Continue →") go_.textContent = "Continue →"; } }, 4000);
    }
  });
  return el;
}

// ---- start
(async () => {
  session = await mountAccount($("#navAccount"));
  applySession();
  // a search saved before the sign-in link was requested: fill it in and run it
  if (session && session.isCandidate) {
    try {
      const p = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
      if (p && typeof p.company === "string" && typeof p.q === "string") { sessionStorage.removeItem(PENDING_KEY); companyIn.value = p.company; queryIn.value = p.q; runSearch(); }
    } catch { /* nothing pending */ }
  }
})();
