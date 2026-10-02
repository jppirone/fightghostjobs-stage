// contest-ui.js - the contested-comment screen parts (item A): the notice block on a contested comment, and the owner's "Contest this comment" control with its form and confirm step.
// The comments page (js/pages/comments.js) wires these in; the words and the rules are in js/comments-model.js, the call is api.contestComment. Rules this file keeps:
//   * only the posting's owner is ever offered the control (the page mounts it in the employer view only; the server decides who really is the owner and answers one neutral not_found otherwise);
//   * a comment is never edited, hidden or deleted from here: the only thing a contest changes on screen is the notice;
//   * nothing the person typed goes anywhere but the one call; it is never put in the page's text outside the box it was typed in.

import { h, alertBox } from "./dom.js";
import { isAuthFailure } from "./api.js";
import { CONTEST_NOTICE, CONTEST_CONFIRM, CONTEST_CATEGORIES, checkContestCategory, checkContestExplanation, contestCounter, contestLimits, contestRefusal } from "./comments-model.js";
import { fmtDate } from "./format.js";

// the bordered notice. employer: the owner's view also says "Under review" (with the date, when the contest was filed in this visit); candidates see the notice text alone.
export function contestNotice({ employer = false, since = null } = {}) {
  const tag = employer ? h("div", { class: "contest-notice-tag" }, since ? "Under review since " + fmtDate(since) : "Under review") : null;
  return h("div", { class: "contest-notice", role: "note", tabindex: "-1" }, tag, h("p", { class: "contest-notice-text" }, CONTEST_NOTICE));
}

// Adds the control to one comment's card: the button goes in `meta`, the form at the end of `card`, and a filed contest puts the notice right after `after` (the comment's text).
//   api: the page's api object (needs contestComment); limits: ONE shared { min, max } object that this code updates from the server's answers; onAuthFailure: called when the session has ended.
export function mountContest({ api, comment, card, after, meta, limits, onAuthFailure }) {
  const uid = "contest-" + comment.id;
  const trigger = h("button", { type: "button", class: "row-action", "aria-expanded": "false", "aria-controls": uid }, "Contest this comment");
  const err = h("div", { class: "field-error", id: uid + "-err", role: "alert", hidden: true });
  const select = h("select", { id: uid + "-cat", "aria-describedby": uid + "-err" }, h("option", { value: "" }, "Choose a reason"), CONTEST_CATEGORIES.map((c) => h("option", { value: c.code }, c.label)));
  const text = h("textarea", { id: uid + "-why", rows: "5", autocomplete: "off", "aria-describedby": uid + "-count " + uid + "-err" });
  const count = h("div", { class: "field-hint", id: uid + "-count" }, contestCounter("", limits));
  const next = h("button", { type: "submit", class: "btn btn-dark btn-sm" }, "Continue");
  const cancel = h("button", { type: "button", class: "btn btn-ghost btn-sm" }, "Cancel");
  const fields = h("div", { class: "contest-fields" },
    h("p", { class: "field-hint", style: "margin:0;" }, "Choose a reason and explain it. A written explanation is required for every reason. It is kept in the review record and is not shown to candidates."),
    h("label", { for: uid + "-cat" }, "Reason"), select,
    h("label", { for: uid + "-why" }, "Explanation"), text, count,
    h("div", { class: "contest-actions" }, next, cancel));
  const confirmTitle = h("p", { class: "contest-confirm-title", tabindex: "-1" }, "Confirm: contest this comment");
  const file = h("button", { type: "button", class: "btn btn-dark btn-sm" }, "File contest");
  const back = h("button", { type: "button", class: "btn btn-ghost btn-sm" }, "Go back");
  const confirm = h("div", { class: "contest-confirm", hidden: true }, confirmTitle, h("p", { style: "margin:0;" }, CONTEST_CONFIRM), h("div", { class: "contest-actions" }, file, back));
  const form = h("form", { id: uid, class: "contest-form", novalidate: true, hidden: true, "aria-label": "Contest this comment" }, fields, confirm, err);

  let sending = false, pending = null;
  const showErr = (msg, focus) => { err.hidden = !msg; err.textContent = msg || ""; if (msg && focus) focus.focus(); };
  const mark = (el, bad) => { if (bad) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid"); };
  const step = (n) => { fields.hidden = n !== 1; confirm.hidden = n !== 2; };
  const refreshCount = () => { count.textContent = contestCounter(text.value, limits); };
  const open = () => { form.hidden = false; trigger.setAttribute("aria-expanded", "true"); select.focus(); };
  const close = () => { form.hidden = true; trigger.setAttribute("aria-expanded", "false"); step(1); showErr(""); mark(select, false); mark(text, false); pending = null; trigger.focus(); };
  // the contest is filed: the control goes away for good and the notice takes its place
  const filed = (since) => { trigger.remove(); form.remove(); const n = contestNotice({ employer: true, since }); after.after(n); n.focus(); };
  // trying again cannot help (already contested, or the comment is not there for this person): the control goes away and the plain message stays in its place
  const settled = (message) => { trigger.remove(); form.remove(); card.append(alertBox("notice", message)); };

  trigger.addEventListener("click", () => { if (form.hidden) open(); else close(); });
  cancel.addEventListener("click", close);
  back.addEventListener("click", () => { step(1); text.focus(); });
  text.addEventListener("input", refreshCount);
  form.addEventListener("submit", (ev) => {
    ev.preventDefault(); if (sending) return;
    showErr(""); mark(select, false); mark(text, false);
    const cp = checkContestCategory(select.value); if (cp) { mark(select, true); showErr(cp, select); return; }
    const ex = checkContestExplanation(text.value, limits); if (ex.problem) { mark(text, true); showErr(ex.problem, text); return; }
    pending = { category: select.value, text: ex.text }; step(2); confirmTitle.focus();
  });
  file.addEventListener("click", async () => {
    if (sending || !pending) return;
    sending = true; file.disabled = true; back.disabled = true; showErr("");
    try {
      const r = await api.contestComment(comment.id, pending.category, pending.text);
      if (r.ok) { filed(r.data.contest.filed_at); return; }
      if (isAuthFailure(r.error)) { if (onAuthFailure) await onAuthFailure(); return; }
      Object.assign(limits, contestLimits(r.error, limits)); refreshCount();
      const out = contestRefusal(r.error, limits);
      if (out.settled) { settled(out.text); return; }
      if (out.where === "category") { step(1); mark(select, true); showErr(out.text, select); }
      else if (out.where === "explanation") { step(1); mark(text, true); showErr(out.text, text); }
      else showErr(out.text);
    } finally { sending = false; file.disabled = false; back.disabled = false; }
  });

  meta.append(trigger); card.append(form);
  return { trigger, form };
}
