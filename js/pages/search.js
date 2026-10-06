// search.js - a verified candidate looks up ONE posting they already know about: company + (req number, postID or part of the title). No browsing, ever: the backend refuses anything else.
// Flow: [sign in once by email] -> search -> result cards -> "View posting details" (records the view, lists the employer's destinations) -> a destination click (issues a 2-minute single-use link, opened in a new tab).

import { api, mountAccount, go, signOut, describeError, isAuthFailure, clearLandingNote } from "../app.js";
import { requestLink, currentSession, watchOtherTabSignIn } from "../session.js";
import { savePending, takePending } from "../signin-handoff.js";
import { roleNoteKind, BOTH_ROLES_TEXT } from "../landing-notice.js";
import { lockScroll } from "../scroll-lock.js";
import { trapFocus } from "../dialog-focus.js";
import { makeAnnouncer } from "../search-status.js";
import { recapSentence } from "../search-recap.js";
import { $, h, clear, alertBox, chip, safeHref } from "../dom.js";
import { locationLine, waitText } from "../format.js";
import { postingChips, notOpenMessage } from "../chips.js";
import { aiNotes } from "../ai-notes.js";
import { COMMENTS_VISIBLE } from "../config.js";
import { checkCompany, resolveSearch, noMatchMessage, searchErrorMessage, searchErrorFocus } from "../search-input.js";

const form = $("#searchForm"), companyIn = $("#company"), queryIn = $("#titleq"), reqIn = $("#reqq"), reqToggle = $("#reqToggle"), searchBtn = $("#searchBtn"), formError = $("#formError");
const resultsEl = $("#results"), countEl = $("#resultCount");
const recapEl = $("#recap"), recapTextEl = $("#recapText"), recapEditBtn = $("#recapEdit");
let lastSearch = null;   // what was typed in the three boxes for the search that just ran: in memory only, never stored; "Edit this search" puts it back
const backdrop = $("#modalBackdrop"), status = makeAnnouncer($("#searchStatus"), window);
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
  ensureWatch();
  if (message) { const b = $("#candEmailError"); b.hidden = false; b.textContent = message; }
}
function applySession() {
  $("#signinWrap").hidden = !!(session && session.isCandidate);
  const notice = $("#roleNotice"); clear(notice); notice.hidden = true;
  // an address that is both a candidate and an employer: the top bar shows the employer buttons; say so, and that searching works as a candidate (no sign-in rule and no header behavior changes)
  if (roleNoteKind(session) === "both") { notice.hidden = false; notice.append(alertBox("notice", BOTH_ROLES_TEXT)); }
  if (session && session.isPoster && !session.isCandidate) {
    notice.hidden = false;
    notice.append(alertBox("notice", "You are signed in as an employer. Candidate search needs a candidate sign-in: sign out, then confirm a candidate email address."),
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
    sent.append(alertBox("ok", "Check your email. Open the link in this same browser and your search will be waiting. If it opens in another browser or app, enter your search again there."));
  } finally { send.disabled = false; send.textContent = label; }
});

// ---- search
function renderCard(row) {
  const chips = postingChips(row).map(chip);
  return h("div", { class: "card", "data-ref": row.posting_ref },
    h("div", { class: "res-head", style: "display:flex;justify-content:space-between;align-items:flex-start;" },
      h("div", {},
        h("div", { style: "font-size:12px;font-weight:600;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;" }, row.company_name),
        h("div", { style: "font-size:22px;font-weight:700;margin-top:4px;" }, row.title),
        h("div", { style: "font-size:14px;color:var(--muted);margin-top:2px;" }, locationLine(row.is_remote, row.locations) + " · postID " + row.masked_code + (row.masked_req ? " · Req " + row.masked_req : ""))),
      h("div", { class: "pill badge-verified", style: "flex-shrink:0;" }, "✓ Registered")),
    h("div", { style: "display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;" }, chips),
    // the employer's own words about their AI use (pass D): shown verbatim, plainly attributed, only under a toggle that is on
    ...aiNotes(row).map((n) => h("div", { class: "ai-note", style: "margin-top:12px;padding:10px 14px;border-left:3px solid var(--line);font-size:14px;line-height:1.55;color:#4A453F;overflow-wrap:anywhere;" }, h("span", { style: "font-weight:600;color:var(--faint);font-size:12px;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:2px;" }, n.label), n.text)),
    h("div", { style: "margin-top:22px;border-top:1px solid var(--line);padding-top:20px;display:flex;gap:12px;align-items:center;" },
      h("button", { type: "button", class: "btn btn-outline view-details", style: "flex:1;justify-content:center;", onclick: (ev) => openDetails(row, ev.currentTarget) }, "View posting details")));
}

function showResults(data, searched) {
  clear(resultsEl);
  countEl.hidden = false;
  const n = data.results.length;
  if (n === 0) {
    countEl.textContent = "No matching postings";
    resultsEl.append(h("div", { class: "empty-note", style: "margin-top:0;" }, noMatchMessage(searched.company, searched.query, searched.kind)));
    return;
  }
  countEl.textContent = n + (n === 1 ? " matching posting" : " matching postings") + (data.truncated ? ": showing the first 25; add more of the title to narrow it" : "");
  for (const row of data.results) resultsEl.append(renderCard(row));
}

// ---- the recap (Part C): once a search has run, the boxes are emptied and this read-only sentence sits between the form and the results. The one spoken message of the search is this same sentence (js/search-status.js).
function hideRecap() { recapEl.hidden = true; recapTextEl.textContent = ""; }
function showRecap(typed, company, search, auto) {
  lastSearch = typed;
  companyIn.value = ""; queryIn.value = ""; reqIn.value = "";
  const text = recapSentence(company, search);
  recapTextEl.textContent = text; recapEl.hidden = false;
  // the one spoken message of the search: the recap sentence AND the count, in the visible count line's own words (so a search that found nothing says "No matching postings" too)
  const spoken = text + " " + countEl.textContent + ".";
  status.announce(spoken);
  // After a successful search the recap goes to the top of the window, so the recap and the first results are on screen (October 5, 2026). A scroll, never a focus move (focus stays on the Search button). Smooth; a person who prefers
  // reduced motion gets no scroll at all. Not for a replayed search (the person did nothing, and the landing note sits above), and never for a search that failed (showRecap is only called on success).
  if (!auto && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) recapEl.scrollIntoView({ block: "start", behavior: "smooth" });
}
recapEditBtn.addEventListener("click", () => {
  if (lastSearch) { companyIn.value = lastSearch.company; queryIn.value = lastSearch.q; reqIn.value = lastSearch.r; }
  lastSearch = null; hideRecap(); companyIn.focus();
});

async function runSearch(auto) {   // auto: the saved search replayed after the sign-in link (the person did nothing, so the landing note stays)
  if (busy) return;
  setFormError(""); hideRecap();
  const c = checkCompany(companyIn.value), q = resolveSearch(queryIn.value, reqIn.value);
  if (!c.ok) { setFormError(c.message); companyIn.focus(); return; }
  if (!q.ok) { setFormError(q.message); (q.focus === "req" ? reqIn : queryIn).focus(); return; }
  if (!session || !session.isCandidate) {
    // kept in localStorage (all tabs of this browser, one hour, removed when used, never sent anywhere): the emailed link opens in a NEW tab (signin-handoff.js)
    savePending(localStorage, { company: companyIn.value, q: queryIn.value, r: reqIn.value });
    if (session && session.isPoster) { applySession(); return; }
    showSignIn("Confirm your email first. We keep your search in this browser for one hour and run it when you open the link in this browser. If the link opens somewhere else, enter your search again.");
    $("#candEmail").focus();
    return;
  }
  const hadFocus = document.activeElement === searchBtn;   // a disabled button drops the focus: it is given back when the search is over (the screen-reader message that follows is spoken with the focus where it was)
  const typed = { company: companyIn.value, q: queryIn.value, r: reqIn.value };
  busy = true; searchBtn.disabled = true; const label = "Search"; searchBtn.textContent = "Searching…";
  status.clear();
  let cooldown = 0;
  try {
    let r = await api.candidateSearch(q.kind === "req" ? { company: c.value, req: q.value } : q.kind === "code" ? { company: c.value, code: q.value } : { company: c.value, phrase: q.value });
    if (q.alsoTryCode && r.ok && r.data.results.length === 0) r = await api.candidateSearch({ company: c.value, code: q.value });
    if (!r.ok && r.status === 404 && r.error.code === "not_found") r = { ok: true, data: { mode: "code", truncated: false, results: [] } };   // a code that matches nothing is a plain "no such posting"
    if (r.ok) { showResults(r.data, { company: c.value, query: q.value, kind: q.kind }); showRecap(typed, c.value, q, auto); return; }
    clear(resultsEl); countEl.hidden = true;
    if (isAuthFailure(r.error)) { session = null; applySession(); showSignIn(r.error.code === "reverification_required" ? "Your email confirmation has expired. Please confirm your email again." : "Please confirm your email to search."); return; }
    if (r.error.code === "rate_limited") { cooldown = r.error.retryAfter || 30; setFormError("You are searching too fast. Try again in " + waitText(cooldown) + "."); return; }
    // the backend refused the search itself (for example a 1 or 2 letter title that is not one of its short forms): say so calmly and put the cursor in the box that needs fixing
    if (r.status === 400 && r.error.field) { setFormError(searchErrorMessage(r.error)); const f = searchErrorFocus(r.error); (f === "company" ? companyIn : f === "req" ? reqIn : queryIn).focus(); return; }
    setFormError(describeError(r.error));
  } finally {
    busy = false;
    if (!auto) clearLandingNote();   // a search the person started has finished: the landing note has done its job
    if (cooldown) startCooldown(searchBtn, cooldown, label); else { searchBtn.disabled = false; searchBtn.textContent = label; if (hadFocus && document.activeElement === document.body) searchBtn.focus(); }
  }
}
form.addEventListener("submit", (ev) => { ev.preventDefault(); runSearch(); });
for (const el of [companyIn, queryIn, reqIn]) el.addEventListener("input", clearLandingNote);   // typing in a search box: the person is using the page, the landing note clears
// show / hide the req number while typing (hidden by default, like a password)
reqToggle.addEventListener("click", () => {
  const show = reqIn.type === "password";
  reqIn.type = show ? "text" : "password"; reqToggle.textContent = show ? "Hide" : "Show";
  reqToggle.setAttribute("aria-pressed", show ? "true" : "false"); reqToggle.setAttribute("aria-label", show ? "Hide the req number" : "Show the req number");
});

// ---- the details dialog
function openModal(row, opener) {
  $("#modalCompany").textContent = row.company_name;
  $("#modalTitle").textContent = row.title;
  $("#modalRefs").textContent = "postID " + row.masked_code + (row.masked_req ? " · Req " + row.masked_req : "");
  $("#modalIntro").textContent = "This posting was registered through FightGhostJobs by a registered poster. The dates and disclosures are the poster's own. FightGhostJobs has not confirmed that the job exists, that the poster works for the company named, or that the employer will respond.";
  clear($("#modalLinks")); const empty = $("#modalEmpty"); empty.hidden = true; empty.textContent = ""; $("#modalLinksNote").hidden = true; $("#modalMore").hidden = true; clear($("#modalMore"));
  backdrop.classList.add("open");
  if (!unlockScroll) unlockScroll = lockScroll(document, window);   // the page behind does not scroll while the window is open; undone exactly in closeModal
  // focus moves into the window, Tab stays inside it, the page behind is inert; closing returns focus to the button that opened it (js/dialog-focus.js)
  if (!releaseFocus) releaseFocus = trapFocus({ doc: document, dialog: backdrop.querySelector(".modal"), backdrop, opener, fallback: resultsEl });
  return { links: $("#modalLinks"), empty };
}
// the thread and the private wrong-link report live on the posting's own comments page (reached only with the posting's opaque reference; never listed anywhere)
function moreLinks(row, count, withReport) {
  const more = $("#modalMore"); clear(more);
  const page = "comments.html?ref=" + encodeURIComponent(row.posting_ref);
  if (COMMENTS_VISIBLE) more.append(h("a", { href: page }, "Comments" + (Number.isInteger(count) ? " (" + count + ")" : "") + " →"));   // the one comments switch (js/config.js)
  if (withReport) more.append(h("a", { href: page + "#report" }, "Report a wrong link →"));
  more.hidden = more.children.length === 0;
}
let unlockScroll = null, releaseFocus = null;
function closeModal() { backdrop.classList.remove("open"); if (unlockScroll) { unlockScroll(); unlockScroll = null; } if (releaseFocus) { releaseFocus(); releaseFocus = null; } }
$("#modalClose").addEventListener("click", closeModal);
backdrop.addEventListener("click", (ev) => { if (ev.target === backdrop) closeModal(); });
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeModal(); });

async function openDetails(row, button) {
  button.disabled = true; const label = button.textContent; button.textContent = "Opening…";
  let cooldown = 0;
  try {
    const r = await api.candidateDetail(row.posting_ref);
    const m = openModal(row, button);
    if (r.ok) {
      if (r.data.links.length === 0) {
        m.empty.hidden = false;
        m.empty.textContent = "This employer has marked the posting live but hasn't provided a link to where you can apply. That's their choice to make.";
      } else {
        for (const l of r.data.links) m.links.append(linkRow(row, l));
        $("#modalLinksNote").hidden = false;   // why the links look odd, and what to do when one is wrong
      }
      moreLinks(row, r.data.comment_count, r.data.links.length > 0);
      return;
    }
    moreLinks(row, null, false);   // a closed or expired posting keeps its thread: what happened after it closed is what other candidates want to know
    m.empty.hidden = false;
    if (r.status === 409 && r.data && r.data.code === "posting_not_open") m.empty.textContent = notOpenMessage(r.data.status, r.data.closed_reason || null);
    else if (r.error.code === "not_found") m.empty.textContent = "This posting is no longer available.";
    else if (isAuthFailure(r.error)) { closeModal(); session = null; applySession(); showSignIn("Please confirm your email again."); }
    else if (r.error.code === "rate_limited") { cooldown = r.error.retryAfter || 30; m.empty.textContent = "You are opening details too fast. Try again in " + waitText(cooldown) + "."; }
    else m.empty.textContent = describeError(r.error);
  } finally {
    if (cooldown) startCooldown(button, cooldown, label); else { button.disabled = false; button.textContent = label; }
  }
}

// One destination. Clicking asks the server for a fresh single-use link (valid 2 minutes) for THIS candidate and opens it in a new tab.
// A named recruiter firm (pass C) reads "Recruiter firm: <name>"; when the employer gave no link for it there is nothing to click.
const rowText = (link) => link.kind === "recruiter" ? "Recruiter firm: " + link.firm + (link.label ? " · " + link.label : "") : (link.label || "Application link " + link.position);
function linkRow(row, link) {
  if (link.kind === "recruiter" && link.label === null) return h("div", { class: "source-row", style: "cursor:default;" }, h("span", { class: "source-row-label" }, rowText(link)), h("span", { class: "go", style: "color:var(--faint);" }, "No link given"));
  const go_ = h("span", { class: "go" }, "Continue →");
  const el = h("button", { type: "button", class: "source-row" }, h("span", { class: "source-row-label" }, rowText(link)), go_);
  el.addEventListener("click", async () => {
    if (el.disabled) return;
    el.disabled = true; go_.textContent = "Redirecting…";
    try {
      const r = await api.candidateLinkIssue(row.posting_ref);
      const found = r.ok ? r.data.links.find((x) => x.position === link.position && (x.kind || "apply") === (link.kind || "apply")) : null;
      if (!found) {
        go_.textContent = r.ok ? "Unavailable" : r.error.code === "rate_limited" ? "Try again in " + waitText(r.error.retryAfter || 30) : r.status === 409 ? "Not open" : "Try again";
        return;
      }
      const url = safeHref(found.go_url);
      const w = url ? window.open(url, "_blank", "noopener,noreferrer") : null;
      if (w === null && url) {
        // the browser held back the new tab: give a real link the person can click themselves (it stays valid for 2 minutes)
        el.replaceWith(h("a", { class: "source-row", href: url, target: "_blank", rel: "noopener noreferrer", style: "text-decoration:none;" }, h("span", { class: "source-row-label" }, rowText(link)), h("span", { class: "go" }, "Open link →")));
        return;
      }
      go_.textContent = "Opened ✓";
    } finally {
      setTimeout(() => { if (el.isConnected) { el.disabled = false; if (go_.textContent !== "Continue →") go_.textContent = "Continue →"; } }, 4000);
    }
  });
  return el;
}

// a search saved before the sign-in link was requested: fill it in and run it (used once: takePending removes it)
function resumePending() {
  const p = takePending(localStorage);
  if (!p) return false;
  companyIn.value = p.company; queryIn.value = p.q; reqIn.value = p.r;
  runSearch(true);
  return true;
}

// ---- a sign-in completed in ANOTHER tab (the emailed link opens in a new tab): this tab moves to the signed-in state by itself, no reload
// The tab the person is looking at runs the saved search; a background tab only switches state and leaves the saved search for the tab that is in front (normally the one the link opened). When the person
// comes back to this tab the saved search, if nobody used it, runs then.
const inFront = () => document.visibilityState !== "hidden" && document.hasFocus();
function runWhenInFront() {
  if (inFront()) { resumePending(); return; }
  const back = () => { if (!inFront()) return; window.removeEventListener("focus", back); document.removeEventListener("visibilitychange", back); resumePending(); };
  window.addEventListener("focus", back); document.addEventListener("visibilitychange", back);
}
let watching = false;
function ensureWatch() { if (watching) return; watching = true; watchOtherTabSignIn(async (s) => { watching = false; await becameSignedIn(s); }); }
async function becameSignedIn(s) {
  session = s;
  await mountAccount($("#navAccount"));
  applySession();
  const err = $("#candEmailError"); err.hidden = true; err.textContent = "";
  if (session && session.isCandidate) runWhenInFront();
}

// ---- start
(async () => {
  session = await mountAccount($("#navAccount"));
  applySession();
  if (session && session.isCandidate) resumePending();
  else ensureWatch();
})();
