// comments.js - one posting's comment thread on a page of its own (design brief 7.4, 13, 16). Reached only from a posting's details (the page needs the posting's opaque reference and a
// verified candidate session: the address alone shows nothing, and the site never lists postings). The owner reads the same thread from My postings (?id=, a poster session) and can contest a comment (once; it stays visible, with a notice, while it is under review).
// Posting a comment: the page checks length and plain text, the backend applies the whole rule (no web address, no naming where the posting was found unless this posting already shows
// that platform, no slurs or profanity) and says why in words. Wrong links go to a private report, not to the thread.

import { api, requirePoster, mountAccount, go, signOut, describeError, isAuthFailure, currentSession } from "../app.js";
import { requestLink, watchOtherTabSignIn } from "../session.js";
import { $, h, clear, alertBox, chip } from "../dom.js";
import { locationLine, waitText, groupCode } from "../format.js";
import { postingChips, notOpenRecap } from "../chips.js";
import { aiNotes } from "../ai-notes.js";
import { checkComment, checkReason, checkLinkReport, refusalText, ago, linkChoices, detailLinks, showLinkPicker, cooldownMs, parseLinkChoice, COMMENT_RULES, MAX_COMMENT, MAX_LINK_REPORT, DEFAULT_CONTEST_LIMITS } from "../comments-model.js";
import { addContestPart } from "../contest-ui.js";
import { COMMENTS_VISIBLE } from "../config.js";   // the one comments switch: while false this page is only the wrong-link report

const params = new URLSearchParams(location.search);
const ref = String(params.get("ref") || "").toLowerCase(), pid = String(params.get("id") || "").toLowerCase();
const REF_RE = /^[0-9a-hjkmnp-tv-z]{20}$/, UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const state = { mode: REF_RE.test(ref) ? "candidate" : UUID_RE.test(pid) ? "employer" : "none", session: null, links: [], nextOffset: null, busy: false, cooldownTimer: null, contestLimits: { min: DEFAULT_CONTEST_LIMITS.min, max: DEFAULT_CONTEST_LIMITS.max } };
const pageAlert = $("#pageAlert");
function say(box, kind, text) { clear(box); box.hidden = !text; if (text) box.append(alertBox(kind, text)); }
// a rate-limited send button stays disabled with its normal label until one timer ends; the wait is stated once, in words, in the message ("Try again in ...")
function startCooldown(button, seconds, idleLabel) {
  clearTimeout(state.cooldownTimer); button.disabled = true; button.textContent = idleLabel;
  state.cooldownTimer = setTimeout(() => { button.disabled = false; }, cooldownMs(seconds));
}

// ---- the thread (both modes)
function commentCard(c) {
  const meta = h("div", { style: "font-size:12px;color:var(--faint);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;" }, h("span", {}, "Candidate · " + ago(c.created_at)));
  const body = h("p", { style: "font-size:15px;line-height:1.6;margin:0;white-space:pre-wrap;overflow-wrap:anywhere;" }, c.body);
  const card = h("article", { class: "card", style: "padding:16px 20px;display:flex;flex-direction:column;gap:8px;" }, meta, body);
  // everything about a contest on this comment (js/contest-ui.js decides from c.contest_state, by view): the notice for an open contest, the owner's control when none exists, the plain sentence after a decision
  addContestPart({ mode: state.mode, comment: c, api, card, after: body, meta, limits: state.contestLimits, onAuthFailure: employerSessionEnded });
  if (state.mode === "candidate") {
    const form = h("form", { novalidate: true, hidden: true, style: "display:flex;flex-direction:column;gap:8px;margin-top:6px;" });
    const reason = h("input", { type: "text", maxlength: "300", placeholder: "Why should we look at this comment?", "aria-label": "Why report this comment" });
    const err = h("div", { class: "field-error", hidden: true }), done = h("div", { hidden: true });
    const send = h("button", { type: "submit", class: "btn btn-outline btn-sm" }, "Send report");
    form.append(reason, h("div", { style: "display:flex;gap:10px;align-items:center;" }, send, h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: () => { form.hidden = true; } }, "Cancel")), err, done);
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault(); err.hidden = true;
      const p = checkReason(reason.value); if (p) { err.hidden = false; err.textContent = p; reason.focus(); return; }
      send.disabled = true;
      try {
        const r = await api.candidateReportComment(c.id, reason.value.trim());
        if (r.ok) { form.hidden = true; clear(done); done.hidden = false; done.append(alertBox("ok", "Reported. Thank you: we read every report.")); return; }
        if (isAuthFailure(r.error)) return sessionEnded();
        if (r.status === 409) { err.hidden = false; err.textContent = "You already reported this comment."; return; }
        if (r.error.code === "rate_limited") { err.hidden = false; err.textContent = "Too many reports just now. Try again in " + waitText(r.error.retryAfter || 60) + "."; return; }
        err.hidden = false; err.textContent = describeError(r.error);
      } finally { send.disabled = false; }
    });
    meta.append(h("button", { type: "button", class: "row-action", onclick: () => { form.hidden = !form.hidden; if (!form.hidden) reason.focus(); } }, "Report"));
    card.append(form, done);
  }
  return card;
}
function renderPage(page, append) {
  const thread = $("#thread"); if (!append) clear(thread);
  for (const c of page.comments) thread.append(commentCard(c));
  $("#threadEmpty").hidden = page.total !== 0;
  $("#threadHead").textContent = page.total === 0 ? "Comments" : "Comments (" + page.total + ")";
  state.nextOffset = page.next_offset;
  $("#loadMore").hidden = state.nextOffset === null;
}
async function loadThread(offset) {
  const r = state.mode === "candidate" ? await api.candidateListComments(ref, offset) : await api.employerListComments(pid, offset);
  if (!r.ok) {
    if (isAuthFailure(r.error)) return sessionEnded();
    if (r.error.code === "rate_limited") { say(pageAlert, "notice", "You are reading too fast. Try again in " + waitText(r.error.retryAfter || 30) + "."); return; }
    if (r.error.code === "not_found") { say(pageAlert, "error", "This opening was not found."); return; }
    say(pageAlert, "error", describeError(r.error)); return;
  }
  renderPage(r.data, offset > 0);
}
$("#loadMore").addEventListener("click", () => { if (state.nextOffset !== null) loadThread(state.nextOffset); });

// ---- the candidate side
async function sessionEnded() { state.session = null; $("#threadWrap").hidden = true; $("#composeWrap").hidden = true; $("#reportWrap").hidden = true; showSignIn("Please confirm your email again."); }
let watching = false;
function showSignIn(message) { $("#signinWrap").hidden = false; ensureWatch(); if (message) { const b = $("#candEmailError"); b.hidden = false; b.textContent = message; } }
$("#signinForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const email = $("#candEmail").value.trim(), err = $("#candEmailError"), send = $("#candSend");
  err.hidden = true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) { err.hidden = false; err.textContent = "Enter your email address."; return; }
  send.disabled = true; const label = send.textContent; send.textContent = "Sending…";
  try {
    const r = await requestLink(email, "candidate", "comments.html?ref=" + encodeURIComponent(ref));
    if (!r.ok) { err.hidden = false; err.textContent = r.status === 429 || /rate|seconds|after/i.test(r.message) ? "A link was just sent to this address, or too many were requested. Wait a minute and try again." : "We could not send the email. Please try again in a moment."; return; }
    $("#signinForm").hidden = true;
    const sent = $("#candSent"); sent.hidden = false; clear(sent);
    sent.append(alertBox("ok", "Check your email. The link brings you straight back to these comments."));
  } finally { send.disabled = false; send.textContent = label; }
});

function renderRecap(d) {
  const recap = $("#recap"); recap.hidden = false; state.links = detailLinks(d);
  if (d.ok) {
    const p = d.data.posting;
    $("#recapCompany").textContent = p.company_name; $("#recapTitle").textContent = p.title;
    $("#recapMeta").textContent = locationLine(p.is_remote, p.locations) + " · Opening ID " + p.masked_code + (p.masked_req ? " · Req " + p.masked_req : "");
    const chips = $("#recapChips"); clear(chips); for (const c of postingChips(p)) chips.append(chip(c));
    const notes = $("#recapNotes"); clear(notes);
    for (const n of aiNotes(p)) notes.append(h("div", { style: "margin-top:12px;padding:10px 14px;border-left:3px solid var(--line);font-size:14px;line-height:1.55;color:#4A453F;overflow-wrap:anywhere;" }, h("span", { style: "font-weight:600;color:var(--faint);font-size:12px;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:2px;" }, n.label), n.text));
    $("#recapNote").textContent = d.data.links.length ? "The employer's links (" + d.data.links.length + ") are on the opening's details in Search. If one of them led you somewhere wrong, use “Report a wrong link” at the bottom of this page." : "This employer has not provided a link to where you can apply.";
  } else if (d.status === 409 && d.data && d.data.code === "posting_not_open") {
    const nr = notOpenRecap(d.data.status, d.data.closed_reason || null, COMMENTS_VISIBLE);
    $("#recapCompany").textContent = nr.company; $("#recapTitle").textContent = nr.title; $("#recapMeta").textContent = ""; $("#recapNote").textContent = nr.note;
  } else {
    recap.hidden = true;
  }
}
// the emailed link opens in a NEW tab: when the sign-in is completed there, this tab shows the thread by itself (no reload)
function ensureWatch() { if (watching) return; watching = true; watchOtherTabSignIn(async () => { watching = false; $("#signinWrap").hidden = true; $("#candSent").hidden = true; await candidateMode(); }, (x) => x.isCandidate); }
async function candidateMode() {
  state.session = await currentSession();
  await mountAccount($("#navAccount"));
  if (!state.session || !state.session.isCandidate) {
    if (state.session && state.session.isPoster) {
      const n = $("#roleNotice"); n.hidden = false; clear(n);
      n.append(alertBox("notice", "You are signed in as an employer. Reading and posting comments here needs a candidate sign-in: sign out, then confirm a candidate email address. (Your own openings' comments are in My openings.)"),
        h("div", { style: "margin-top:12px;" }, h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: async () => { await signOut(); go("comments.html?ref=" + encodeURIComponent(ref)); } }, "Sign out")));
      return;
    }
    showSignIn(); return;
  }
  const d = await api.candidateDetail(ref);
  if (!d.ok && isAuthFailure(d.error)) return sessionEnded();
  if (!d.ok && d.error && d.error.code === "not_found") { say(pageAlert, "error", "This opening was not found. Open it from Search."); return; }
  if (!d.ok && d.error && d.error.code === "rate_limited") { say(pageAlert, "notice", "You are viewing openings too fast. Try again in " + waitText(d.error.retryAfter || 30) + "."); return; }
  renderRecap(d);
  if (COMMENTS_VISIBLE) { $("#threadWrap").hidden = false; $("#composeWrap").hidden = false; $("#composeRules").textContent = COMMENT_RULES; }
  const sel = $("#reportLink"); clear(sel); for (const c of linkChoices(state.links)) sel.append(h("option", { value: c.value }, c.text));
  const picker = showLinkPicker(state.links); sel.hidden = !picker; $("#reportLinkLabel").hidden = !picker;   // no links to choose from: no picker; the select keeps its one empty choice, so a report goes with no specific link
  // "Report a wrong link" is for a posting that HAS links: with none (or none known, as for a closed posting) the whole section stays hidden. This is decided here, once, from the posting alone; nothing the visitor does afterwards
  // (posting a comment, sending a report, reloading) changes it, and a direct address ending in #report on such a posting simply shows the page.
  $("#reportWrap").hidden = !picker;
  if (COMMENTS_VISIBLE) await loadThread(0);
}
$("#commentText").addEventListener("input", () => { $("#commentCount").textContent = Array.from($("#commentText").value).length.toLocaleString("en-US") + " / " + MAX_COMMENT.toLocaleString("en-US"); });
$("#reportDetail").addEventListener("input", () => { $("#reportCount").textContent = Array.from($("#reportDetail").value).length + " / " + MAX_LINK_REPORT; });
$("#composeForm").addEventListener("submit", async (ev) => {
  ev.preventDefault(); if (state.busy) return;
  const err = $("#commentError"), box = $("#composeAlert"), send = $("#commentSend"); err.hidden = true; say(box, "ok", "");
  const c = checkComment($("#commentText").value);
  if (c.problem) { err.hidden = false; err.textContent = c.problem; $("#commentText").focus(); return; }
  state.busy = true; send.disabled = true; const label = send.textContent; send.textContent = "Posting…"; let cooldown = 0;
  try {
    const r = await api.candidatePostComment(ref, c.text);
    if (r.ok) { $("#commentText").value = ""; $("#commentCount").textContent = "0 / 2,000"; say(box, "ok", "Posted. Every candidate who has confirmed their email can see it now."); await loadThread(0); return; }
    if (isAuthFailure(r.error)) return sessionEnded();
    if (r.error.code === "rate_limited") { cooldown = r.error.retryAfter || 60; err.hidden = false; err.textContent = "You are commenting too fast (at most a few an hour, and two on the same opening in six hours). Try again in " + waitText(cooldown) + "."; return; }
    if (r.status === 400) { err.hidden = false; err.textContent = refusalText(r.error); return; }
    if (r.error.code === "not_found") { say(box, "error", "This opening was not found."); return; }
    say(box, "error", describeError(r.error));
  } finally { state.busy = false; if (cooldown) startCooldown(send, cooldown, label); else { send.disabled = false; send.textContent = label; } }
});
$("#reportForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const err = $("#reportError"), box = $("#reportAlert"), send = $("#reportSend"); err.hidden = true; say(box, "ok", "");
  const p = checkLinkReport($("#reportDetail").value); if (p) { err.hidden = false; err.textContent = p; $("#reportDetail").focus(); return; }
  const which = parseLinkChoice($("#reportLink").value);
  send.disabled = true;
  try {
    const r = await api.candidateReportLink(ref, which.kind, which.position, $("#reportDetail").value.replace(/\r\n?/g, "\n").trim());
    if (r.ok) { $("#reportDetail").value = ""; $("#reportCount").textContent = "0 / " + MAX_LINK_REPORT; say(box, "ok", "Sent. Thank you: a person reads every report, and a wrong link gets looked at."); return; }
    if (isAuthFailure(r.error)) return sessionEnded();
    if (r.error.code === "rate_limited") { err.hidden = false; err.textContent = "Too many reports just now. Try again in " + waitText(r.error.retryAfter || 60) + "."; return; }
    err.hidden = false; err.textContent = r.status === 400 && r.error.message ? r.error.message : describeError(r.error);
  } finally { send.disabled = false; }
});

// ---- the employer side: reads the thread; the one action on a comment is the contest control (js/contest-ui.js)
async function employerSessionEnded() { await signOut(); go("employer-signin.html?reason=expired"); }
async function employerMode() {
  const ctx = await requirePoster("comments.html?id=" + pid);
  if (!ctx) return;
  await mountAccount($("#navAccount"), { cta: false });
  const g = await api.getMyPosting(pid);
  if (!g.ok) {
    if (isAuthFailure(g.error)) { await signOut(); go("employer-signin.html?reason=expired"); return; }
    say(pageAlert, "error", g.error.code === "not_found" ? "That opening was not found. Open it from My openings." : describeError(g.error)); return;
  }
  const p = g.data.posting; const recap = $("#recap"); recap.hidden = false;
  $("#recapCompany").textContent = p.company_name; $("#recapTitle").textContent = p.title;
  $("#recapMeta").textContent = "Opening ID " + groupCode(p.post_id) + " · " + p.status;
  if (!COMMENTS_VISIBLE) return;   // comments are switched off: the employer sees the posting's identity and nothing else here
  $("#recapNote").textContent = "What candidates wrote about this opening. You are told by email when there is something new (at most once every six hours).";
  $("#threadIntro").textContent = "Written by candidates, newest first, anonymous to everyone. A comment is about the opening, never about a person. You can contest a comment on this opening once; it stays visible, with a notice, while it is under review.";
  $("#threadWrap").hidden = false; $("#employerNote").hidden = false;
  await loadThread(0);
}

if (state.mode === "candidate") candidateMode();
else if (state.mode === "employer") employerMode();
else { say(pageAlert, "error", "This page needs an opening: open the comments from an opening's details in Search, or from My openings."); }
